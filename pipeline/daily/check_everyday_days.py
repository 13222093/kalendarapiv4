"""KalenderApi: do the days add up to the months? Read back from the files the app loads.

For every area and every month of the record this script sums the days of app/public/ka-data/daily/<aoi_id>.json
and compares them with the same area's monthly record (app/public/ss-data/monthly_<aoi>.json, districts/...):
  - each sensor's cell-days (a, t, v, n) against the month's raw column: whole numbers, must be equal;
  - the one-scale value h against the month's H: equal up to the rounding of h to 3 decimals.
It also checks that a withheld month has no day in any file, that h is null exactly where the rules of index.json
say a day has no value, and that the files on disk are the ones index.json lists.

It is written apart from the export (plain json, no numpy) and prints only a summary: no value of any day.
Exit code 0 when everything holds, 1 otherwise.

Usage (from the project root): python pipeline/daily/check_everyday_days.py [--root DIR] [--tolerance 0.02]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = {"a": ("A_raw", "A", "Aqua"), "t": ("T_raw", "T", "Terra"), "v": ("V_raw", "S", "SNPP"), "n": ("N20_raw", "N", "NOAA20")}
SENSOR_CODE = {"Aqua": "A", "Terra": "T", "SNPP": "S", "NOAA20": "N"}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--tolerance", type=float, default=0.02,
                    help="largest allowed |sum of days - month| for the one-scale value (31 days x 0.0005 = 0.0155)")
    a = ap.parse_args(argv)
    root = Path(a.root)
    ss, daily = root / "app/public/ss-data", root / "app/public/ka-data/daily"
    index = json.loads((daily / "index.json").read_text(encoding="utf-8"))
    ss_index = json.loads((ss / "index.json").read_text(encoding="utf-8"))
    d_index = json.loads((ss / "districts/index.json").read_text(encoding="utf-8"))
    monthly_file = {x["aoi_id"]: (x["level"], ss / x["file"]) for x in ss_index["aois"]}
    monthly_file.update({x["aoi_id"]: ("district", ss / x["file"]) for x in d_index["districts"]})

    code_sat = {v["code"]: k for k, v in index["satellites"].items()}
    first = {k: dt.date.fromisoformat(v["first_day"]) for k, v in index["satellites"].items()}
    last = {k: dt.date.fromisoformat(v["last_day"]) for k, v in index["satellites"].items()}
    silent: dict[str, set] = {}
    for k, v in index["satellites"].items():
        s = set()
        for lo, hi in v["silent_days"]:
            d, end = dt.date.fromisoformat(lo), dt.date.fromisoformat(hi)
            while d <= end:
                s.add(d)
                d += dt.timedelta(days=1)
        silent[k] = s
    w = index["withheld"]
    w_from, w_to = dt.date.fromisoformat(w["from"]), dt.date.fromisoformat(w["to"])
    w_areas = set(w["areas"])

    problems: list[str] = []

    def problem(text: str) -> None:
        if len(problems) < 30:
            problems.append(text)

    on_disk = sorted(p.stem for p in daily.glob("*.json") if p.name != "index.json")
    if on_disk != sorted(index["areas"]):
        problem(f"files on disk ({len(on_disk)}) differ from index.json areas ({len(index['areas'])})")
    if sorted(index["areas"]) != sorted(monthly_file):
        problem(f"index.json lists {len(index['areas'])} areas, the monthly record has {len(monthly_file)}")

    levels: dict[str, dict] = {}
    total_bytes = 0
    for aoi in on_disk:
        if aoi not in monthly_file:
            problem(f"{aoi}: no monthly record")
            continue
        level, mfile = monthly_file[aoi]
        st = levels.setdefault(level, {"areas": 0, "area_months": 0, "withheld_months": 0, "raw_sums_compared": 0,
                                       "raw_sums_different": 0, "months_with_a_value": 0, "months_without_a_value": 0,
                                       "max_abs_diff": 0.0, "max_abs_diff_at": None, "over_tolerance": 0,
                                       "days_listed": 0, "days_with_a_value": 0, "days_with_no_value": 0})
        f = daily / f"{aoi}.json"
        total_bytes += f.stat().st_size
        doc = json.loads(f.read_text(encoding="utf-8"))
        rows = json.loads(mfile.read_text(encoding="utf-8"))
        months = doc["months"]
        y0, mo0 = int(doc["first_month"][:4]), int(doc["first_month"][5:7])
        if len(months) != len(rows) or (rows[0]["year"], rows[0]["month"]) != (y0, mo0):
            problem(f"{aoi}: months of the daily file differ from the monthly record")
            continue
        st["areas"] += 1
        st["area_months"] += len(rows)
        t_of = {(r["year"], r["month"]): i for i, r in enumerate(rows)}
        sums = {k: [0] * len(rows) for k in ("h", "a", "t", "v", "n")}
        for y, block in doc["years"].items():
            n = len(block["d"])
            if any(len(block[k]) != n for k in block):
                problem(f"{aoi} {y}: columns of different length")
                continue
            if block["d"] != sorted(set(block["d"])):
                problem(f"{aoi} {y}: days are not ascending and unique")
            jan1 = dt.date(int(y), 1, 1)
            for i, doy in enumerate(block["d"]):
                day = jan1 + dt.timedelta(days=doy - 1)
                t = t_of.get((day.year, day.month))
                if day.year != int(y) or t is None:
                    problem(f"{aoi}: a day outside the record or its year block")
                    continue
                code = months[t]
                st["days_listed"] += 1
                if code == "x" or (aoi in w_areas and w_from <= day <= w_to):
                    problem(f"{aoi}: a withheld day is in the file")
                    continue
                if not any(block.get(k, [0] * n)[i] for k in RAW):
                    problem(f"{aoi}: a listed day with no cell-day")
                for k in RAW:
                    sums[k][t] += block[k][i] if k in block else 0
                h = block["h"][i]
                # where the rules say a day has no value, h must be null, and only there
                if code == "-":
                    no_value = True
                elif code == "0":
                    no_value = False
                else:
                    s = code_sat[code]
                    no_value = day < first[s] or day > last[s] or day in silent[s]
                if (h is None) != no_value:
                    problem(f"{aoi}: h is {'null' if h is None else 'a number'} on a day the rules call "
                            f"{'no value' if no_value else 'a value'}")
                if h is None:
                    st["days_with_no_value"] += 1
                else:
                    st["days_with_a_value"] += 1
                    sums["h"][t] += h
        for t, r in enumerate(rows):
            key = f"{r['year']}-{r['month']:02d}"
            code = months[t]
            held = code == "x"
            if held != (aoi in w_areas and w_from <= dt.date(r["year"], r["month"], 1) <= w_to):
                problem(f"{aoi} {key}: withheld code and withheld scope disagree")
            if held:
                st["withheld_months"] += 1
                if any(sums[k][t] for k in sums):
                    problem(f"{aoi} {key}: a withheld month has days")
                continue
            for k, (col, _, _) in RAW.items():
                st["raw_sums_compared"] += 1
                if sums[k][t] != (r[col] or 0):
                    st["raw_sums_different"] += 1
                    problem(f"{aoi} {key}: {col} of the month differs from the sum of its days")
            want = "-" if r["H"] is None else "0" if r["sensor_used"] is None else SENSOR_CODE[r["sensor_used"]]
            if code != want:
                problem(f"{aoi} {key}: month code {code}, the monthly record says {want}")
            if r["H"] is None:
                st["months_without_a_value"] += 1
                continue
            st["months_with_a_value"] += 1
            diff = abs(sums["h"][t] - r["H"])
            if diff > st["max_abs_diff"]:
                st["max_abs_diff"], st["max_abs_diff_at"] = diff, f"{aoi} {key}"
            if diff > a.tolerance:
                st["over_tolerance"] += 1
                problem(f"{aoi} {key}: the days differ from the month by more than {a.tolerance}")

    n_months = sum(s["area_months"] for s in levels.values())
    n_value = sum(s["months_with_a_value"] for s in levels.values())
    n_raw = sum(s["raw_sums_compared"] for s in levels.values())
    n_raw_bad = sum(s["raw_sums_different"] for s in levels.values())
    worst = max(levels.values(), key=lambda s: s["max_abs_diff"]) if levels else None
    print(f"[check] {len(on_disk)} area files, {total_bytes} bytes (index.json {(daily / 'index.json').stat().st_size} bytes)")
    for level, s in levels.items():
        s["max_abs_diff"] = round(s["max_abs_diff"], 6)
        print(f"[check] {level}: {s}")
    print(f"[check] area-months: {n_months}; withheld (not compared, no day in any file): "
          f"{sum(s['withheld_months'] for s in levels.values())}; with a monthly value: {n_value}; "
          f"without one: {sum(s['months_without_a_value'] for s in levels.values())}")
    print(f"[check] raw sums compared: {n_raw}, different: {n_raw_bad}")
    if worst:
        print(f"[check] one-scale value, largest |sum of days - month|: {worst['max_abs_diff']} at {worst['max_abs_diff_at']} "
              f"(rounding of the days to 3 decimals; tolerance {a.tolerance})")
    for p in problems:
        print("[check] PROBLEM", p)
    ok = not problems and n_raw_bad == 0
    print("[check] PASS: the days add up to the months" if ok else "[check] FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
