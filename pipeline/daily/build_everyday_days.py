"""KalenderApi: the days of the fire record, one small file per area, for the "Every day" calendar of the
Harmonize page (#/record?aoi=<id>&sec=days&y=<year>).

WHAT IS COUNTED
  The monthly record the app shows (app/public/ss-data/monthly_<aoi>.json and districts/monthly_kab-*.json) counts
  fire cell-days: a 0.01 degree cell on one local date with at least one detection, per satellite and per day or
  night pass (vegetation fires only, low confidence removed: vendor/second-sight/pipeline/data/clean.py, cells.py).
  This script counts the very same rows per local date instead of per month, so the days of a month add up to the
  month. Nothing is modelled or filled in.

AREAS (the membership of the monthly record)
  IDN        every row
  region-*   rows whose island_region is the region            (vendor .../export/bundle.py, raw_monthly)
  prov-*     rows whose cell centre is labelled with the province (vendor .../data/labels.py, daily_cell_labeled)
  kab-*      rows whose 0.05 degree grid cell belongs to the district in ss-data/districts/cells.json
             (pipeline/districts/build_districts.py: centre inside the district, or the nearest within 0.05 degree)
  2026 comes from the near-real-time table; rows of the archive table at or after its first month are dropped, and
  NOAA-21 has no column, exactly as the bundle does.

ONE SCALE (the Aqua MODIS scale)
  A month of the monthly record names the sensor its value comes from (sensor_used) and gives the value H. A day's
  value is: the day's cell-days of that sensor x (H of the month / the month's cell-days of that sensor), both read
  from the same area's monthly row. From July 2002 to December 2021 the sensor is Aqua and the factor is 1 (Aqua's
  own count). From 2022 it is VIIRS (S-NPP, NOAA-20 for November 2026) and before July 2002 it is Terra: ONE factor
  for the whole month, so those days are approximate. No finer factor is fitted. Values are rounded to 3 decimals.

NO VALUE IS NOT ZERO
  A day is a zero only when the month's sensor was delivering data and recorded nothing in the area. It has no value
  (h is null, or the day is simply not in the file and falls under one of these rules) when
    - it lies outside the sensor's first and last local date in the files (index.json "satellites"),
    - the sensor recorded nothing anywhere in Indonesia on that date ("silent_days": the sensor was off, or it is a
      true nationwide zero; the files cannot tell which),
    - the monthly record has no value for the month (code "-"), or
    - the month is withheld (code "x").

WITHHELD: 1 January to 31 October 2019, Central Kalimantan and its 14 districts
  A registered test of a sibling project covers those days. The district export leaves the months out
  (ss-data/districts/index.json "locked"; docs/DATA.md 13.2 and 14.8) and the app adds no new statistic for the
  province in them (app/src/lib/record.ts, HELD and lockedMonths). Here the rows of those days are dropped for the
  province and for its districts BEFORE anything is counted, nothing about them is printed, and no file holds them.
  Indonesia and the Kalimantan region keep those days: they are other, larger areas.

FILES WRITTEN (app/public/ka-data/daily/)
  index.json     the notes, the sensors' first and last day and silent days, the withheld scope, the checks,
                 and "areas": {aoi_id: [days in the file, bytes]}. Written last: its presence means a full set.
  <aoi_id>.json  {"format", "aoi_id", "name", "level", "first_month", "months", "years", ...}
                 "months": one character per month from first_month:
                      A Aqua's own count | T Terra converted | S VIIRS S-NPP converted | N VIIRS NOAA-20 converted
                      0 the month's value is 0 with no sensor named (a district whose province saw no fire)
                      - the monthly record has no value | x withheld
                 "years": {"2015": {"d": [...], "h": [...], "a": [...], "t": [...], "v": [...], "n": [...]}}
                      d  day of the year (1 = 1 January) of every local date with at least one cell-day
                      h  fire cell-days on one scale that day (null = no value, see above)
                      a, t, v, n  cell-days as recorded by MODIS Aqua, MODIS Terra, VIIRS S-NPP, VIIRS NOAA-20;
                         a column that is left out is 0 on every listed day of that year
                 A date that is not listed has no cell-day from any of the four sensors.

Usage (from the project root; numpy and pyarrow only, no network; data-raw is read, never written):
  python pipeline/daily/build_everyday_days.py [--data-raw DIR] [--out DIR]
Then: python pipeline/daily/check_everyday_days.py   (the days-add-up-to-months test, read back from the files)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
FORMAT = "kalenderapi-daily/1"
# satellite label of the derived tables -> (raw column of the monthly record, column of a daily file, month code)
SATS = {"Aqua": ("A_raw", "a", "A"), "Terra": ("T_raw", "t", "T"), "SNPP": ("V_raw", "v", "S"), "NOAA20": ("N20_raw", "n", "N")}
SAT_NAMES = list(SATS)
KALTENG = "prov-kalimantan-tengah"
# The app holds January to October 2019 for the province too (lib/record.ts: "adds no new statistic for those
# months"); a day's value would be a new statistic. Set to False only when the registered test has been run.
WITHHOLD_PROVINCE_DAYS = True
H_DECIMALS = 3
GRID_DEG, GRID_EPS, GRID_COLS = 0.05, 1e-7, 7200     # vendor/second-sight/pipeline/data/grid.py at 0.05 degree
COLS = ["local_date", "satellite", "cell_lat", "cell_lon", "island_region", "province"]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def epoch_day(iso: str) -> int:
    return int(np.datetime64(iso, "D").astype(np.int64))


def iso_day(i: int) -> str:
    return str(np.datetime64(int(i), "D"))


def month_of(days: np.ndarray) -> np.ndarray:
    """Months since 1970-01 of days since 1970-01-01."""
    return days.astype("datetime64[D]").astype("datetime64[M]").astype(np.int64)


def month_key(i: int) -> str:
    return f"{1970 + i // 12}-{i % 12 + 1:02d}"


def load_cells(path: Path) -> dict[str, np.ndarray]:
    """One row = one fire cell-day (cell x local date x satellite x day or night pass)."""
    t = pq.read_table(path, columns=COLS)
    return {
        "day": t["local_date"].cast("int32").to_numpy().astype(np.int64),
        "sat": np.asarray(t["satellite"].to_pylist(), dtype=object),
        "lat": t["cell_lat"].to_numpy(), "lon": t["cell_lon"].to_numpy(),
        "region": np.asarray(t["island_region"].to_pylist(), dtype=object),
        "province": np.asarray(t["province"].to_pylist(), dtype=object),
    }


def code_of(values: np.ndarray, names: list[str]) -> np.ndarray:
    """Index of each value in names, -1 when it is not one of them (or is missing)."""
    look = {n: i for i, n in enumerate(names)}
    return np.fromiter((look.get(v, -1) for v in values), dtype=np.int64, count=len(values))


def count_days(area: np.ndarray, day: np.ndarray, sat: np.ndarray, n_area: int, day0: int, span: int):
    """Cell-days per (area, day, satellite). Returns {area: (days ascending, counts[:, 4])}."""
    keep = area >= 0
    ad = area[keep] * span + (day[keep] - day0)
    u, c = np.unique(ad * 4 + sat[keep], return_counts=True)
    uad, inv = np.unique(u // 4, return_inverse=True)
    mat = np.zeros((len(uad), 4), dtype=np.int64)
    mat[inv, u % 4] = c
    areas, days = uad // span, uad % span + day0
    cut = np.searchsorted(areas, np.arange(n_area + 1))
    return {i: (days[cut[i]:cut[i + 1]], mat[cut[i]:cut[i + 1]]) for i in range(n_area)}


def runs(days: np.ndarray) -> list[list[str]]:
    """Sorted days as [first, last] runs of consecutive dates."""
    out: list[list[int]] = []
    for d in days.tolist():
        if out and d - out[-1][1] == 1:
            out[-1][1] = d
        else:
            out.append([d, d])
    return [[iso_day(a), iso_day(b)] for a, b in out]


def number(v: float):
    v = round(float(v), H_DECIMALS)
    return int(v) if v.is_integer() else v


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(ROOT), help="project root (default: two folders above this file)")
    ap.add_argument("--data-raw", default=None, help="the data-raw folder (default: <root>/data-raw); read only")
    ap.add_argument("--out", default=None, help="output folder (default: <root>/app/public/ka-data/daily)")
    a = ap.parse_args(argv)
    t0 = time.time()
    root = Path(a.root)
    derived = Path(a.data_raw or root / "data-raw") / "ss" / "derived"
    ss = root / "app/public/ss-data"
    out = Path(a.out or root / "app/public/ka-data/daily")

    # ---- the monthly record the app shows ------------------------------------------------------------------
    ss_index = json.loads((ss / "index.json").read_text(encoding="utf-8"))
    d_index = json.loads((ss / "districts/index.json").read_text(encoding="utf-8"))
    cells_json = json.loads((ss / "districts/cells.json").read_text(encoding="utf-8"))
    nat = [x for x in ss_index["aois"] if x["level"] == "national"]
    regs = [x for x in ss_index["aois"] if x["level"] == "island_region"]
    provs = [x for x in ss_index["aois"] if x["level"] == "province"]
    dists = d_index["districts"]
    assert len(nat) == 1, "one national area expected"
    nat_rows = json.loads((ss / nat[0]["file"]).read_text(encoding="utf-8"))
    months = [(r["year"], r["month"]) for r in nat_rows]
    T = len(months)
    m0 = (months[0][0] - 1970) * 12 + months[0][1] - 1                      # first month, months since 1970-01
    assert [(1970 + (m0 + i) // 12, (m0 + i) % 12 + 1) for i in range(T)] == months, "months are not consecutive"
    day0 = epoch_day(f"{months[0][0]}-{months[0][1]:02d}-01")
    day_end = int(np.datetime64(month_key(m0 + T), "M").astype("datetime64[D]").astype(np.int64))   # first day after
    span = day_end - day0

    # ---- the withheld scope, read from the monthly export's own record ------------------------------------
    lock = d_index["locked"]
    lock_months = sorted(lock["months"])
    lm = [(int(k[:4]) - 1970) * 12 + int(k[5:7]) - 1 for k in lock_months]
    assert lm == list(range(lm[0], lm[0] + len(lm))), "locked months are not one run"
    lock_from = epoch_day(f"{lock_months[0]}-01")
    lock_to = int(np.datetime64(month_key(lm[-1] + 1), "M").astype("datetime64[D]").astype(np.int64)) - 1
    lock_prov = [i for i, x in enumerate(provs) if x["name"] == lock["province"]]
    assert len(lock_prov) == 1 and provs[lock_prov[0]]["aoi_id"] == KALTENG, "the locked province is not Central Kalimantan"
    lock_dist = [i for i, x in enumerate(dists) if x["province_aoi"] == KALTENG]
    assert sorted(dists[i]["aoi_id"] for i in lock_dist) == sorted(lock["districts"]), "locked districts differ from index.json"
    assert all(sorted(dists[i].get("locked_months", [])) == lock_months for i in lock_dist)
    lock_t = np.zeros(T, dtype=bool)
    lock_t[[i - m0 for i in lm]] = True
    withheld_ids = ([KALTENG] if WITHHOLD_PROVINCE_DAYS else []) + [dists[i]["aoi_id"] for i in lock_dist]

    # ---- the cell-days ---------------------------------------------------------------------------------------
    sp_path, nrt_path = derived / "daily_cell_labeled.parquet", derived / "daily_cell_labeled_2026nrt.parquet"
    for labelled, plain in ((sp_path, "daily_cell.parquet"), (nrt_path, "daily_cell_2026nrt.parquet")):
        n1, n2 = pq.ParquetFile(labelled).metadata.num_rows, pq.ParquetFile(derived / plain).metadata.num_rows
        assert n1 == n2, f"{labelled.name} has {n1} rows, {plain} has {n2}"
    sp, nrt = load_cells(sp_path), load_cells(nrt_path)
    # bundle.with_nrt: archive rows at or after the first month of the near-real-time table are dropped
    cut = int(np.datetime64(iso_day(nrt["day"].min())[:7], "M").astype("datetime64[D]").astype(np.int64))
    keep_sp = sp["day"] < cut
    n_sp_dropped = int((~keep_sp).sum())
    rows = {k: np.concatenate([sp[k][keep_sp], nrt[k]]) for k in sp}
    del sp, nrt
    sat = code_of(rows["sat"], SAT_NAMES)
    inside = (sat >= 0) & (rows["day"] >= day0) & (rows["day"] < day_end)
    n_other_sat = int((sat < 0).sum())
    n_outside = int(((sat >= 0) & ~((rows["day"] >= day0) & (rows["day"] < day_end))).sum())
    rows = {k: v[inside] for k, v in rows.items()}
    sat, day = sat[inside], rows["day"]
    n_rows = len(day)

    region = code_of(rows["region"], [x["island_region"] for x in regs])
    prov = code_of(rows["province"], [x["name"] for x in provs])
    iy = np.floor((rows["lat"] + 90) / GRID_DEG + GRID_EPS).astype(np.int64)
    ix = np.floor((rows["lon"] + 180) / GRID_DEG + GRID_EPS).astype(np.int64)
    g_ids = np.asarray(cells_json["g_id"], dtype=np.int64)
    order = np.argsort(g_ids)
    g_sorted, d_sorted = g_ids[order], np.asarray(cells_json["district"], dtype=np.int64)[order]
    gid = iy * GRID_COLS + ix
    pos = np.clip(np.searchsorted(g_sorted, gid), 0, len(g_sorted) - 1)
    dist = np.where(g_sorted[pos] == gid, d_sorted[pos], -1)
    n_no_region, n_no_prov, n_no_dist = int((region < 0).sum()), int((prov < 0).sum()), int((dist < 0).sum())

    # the withheld days leave the province and its districts here, before anything is counted
    in_lock = (day >= lock_from) & (day <= lock_to)
    if WITHHOLD_PROVINCE_DAYS:
        prov[in_lock & (prov == lock_prov[0])] = -1
    dist[in_lock & np.isin(dist, lock_dist)] = -1

    # ---- sensors: first and last local date in the files, and the dates with nothing anywhere in Indonesia ----
    sat_info, first_day, last_day, silent = {}, {}, {}, {}
    for j, s in enumerate(SAT_NAMES):
        have = np.unique(day[sat == j])
        first_day[s], last_day[s] = int(have.min()), int(have.max())
        silent[s] = np.setdiff1d(np.arange(first_day[s], last_day[s] + 1), have)
        sat_info[s] = {"monthly_column": SATS[s][0], "column": SATS[s][1], "code": SATS[s][2],
                       "first_day": iso_day(first_day[s]), "last_day": iso_day(last_day[s]),
                       "days_with_a_detection": int(len(have)), "silent_day_count": int(len(silent[s])),
                       "silent_days": runs(silent[s])}

    groups = [
        ("national", nat, count_days(np.zeros(n_rows, dtype=np.int64), day, sat, 1, day0, span)),
        ("island_region", regs, count_days(region, day, sat, len(regs), day0, span)),
        ("province", provs, count_days(prov, day, sat, len(provs), day0, span)),
        ("district", dists, count_days(dist, day, sat, len(dists), day0, span)),
    ]
    del rows, region, prov, dist, gid, iy, ix

    # ---- one file per area -------------------------------------------------------------------------------------
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):                     # this folder is owned by this script
        old.unlink()
    areas, checks = {}, {}
    problems: list[str] = []
    total_bytes = total_days = 0
    for level, entries, counted in groups:
        ck = {"areas": 0, "area_months": 0, "area_months_withheld": 0, "raw_sums_compared": 0, "raw_sums_different": 0,
              "months_with_a_value": 0, "months_without_a_value": 0, "max_abs_diff": 0.0, "max_abs_diff_at": None,
              "value_without_raw": 0}
        for i, e in enumerate(entries):
            aoi = e["aoi_id"]
            mrows = json.loads((ss / e["file"]).read_text(encoding="utf-8"))
            assert [(r["year"], r["month"]) for r in mrows] == months, f"{aoi}: months differ from the national file"
            days_i, mat = counted[i]
            locked = lock_t if aoi in withheld_ids else np.zeros(T, dtype=bool)
            t_of = month_of(days_i) - m0
            assert not locked[t_of].any(), f"{aoi}: a withheld day was counted"
            ck["areas"] += 1
            ck["area_months"] += T
            ck["area_months_withheld"] += int(locked.sum())

            # the days of each sensor add up to the month's raw column (whole numbers: must be equal)
            for j, s in enumerate(SAT_NAMES):
                got = np.bincount(t_of, weights=mat[:, j], minlength=T)
                want = np.array([np.nan if r[SATS[s][0]] is None else r[SATS[s][0]] for r in mrows], dtype=float)
                cmp = ~locked
                bad = cmp & (np.where(np.isfinite(want), want, 0) != got)
                ck["raw_sums_compared"] += int(cmp.sum())
                ck["raw_sums_different"] += int(bad.sum())
                if bad.any() and len(problems) < 20:
                    problems.append(f"{aoi} {s}: {int(bad.sum())} months differ, first {month_key(m0 + int(np.argmax(bad)))}")

            # the month's code and its one factor
            codes, factor = [], np.zeros(T)
            for t, r in enumerate(mrows):
                if locked[t]:
                    codes.append("x")
                elif r["H"] is None:
                    codes.append("-")
                elif r["sensor_used"] is None:
                    assert r["H"] == 0, f"{aoi} {month_key(m0 + t)}: a value with no sensor named"
                    codes.append("0")
                else:
                    s = r["sensor_used"]
                    raw_m = r[SATS[s][0]]
                    assert raw_m is not None, f"{aoi} {month_key(m0 + t)}: no raw count for the sensor used"
                    if raw_m > 0:
                        factor[t] = r["H"] / raw_m
                    elif r["H"] != 0:
                        ck["value_without_raw"] += 1
                    codes.append(SATS[s][2])
            code_t = np.array(codes)

            # the day's value on one scale
            h = np.full(len(days_i), np.nan)
            for j, s in enumerate(SAT_NAMES):
                sel = code_t[t_of] == SATS[s][2]
                ok = sel & (days_i >= first_day[s]) & (days_i <= last_day[s]) & ~np.isin(days_i, silent[s])
                assert not (mat[sel & ~ok, j] > 0).any(), f"{aoi}: a count on a day the sensor has no data"
                h[ok] = np.round(mat[ok, j] * factor[t_of[ok]], H_DECIMALS)
            h[code_t[t_of] == "0"] = 0.0

            # the days add up to the month's value (rounding only)
            got = np.bincount(t_of, weights=np.where(np.isfinite(h), h, 0), minlength=T)
            for t, r in enumerate(mrows):
                if locked[t] or r["H"] is None:
                    ck["months_without_a_value"] += int(not locked[t])
                    continue
                ck["months_with_a_value"] += 1
                diff = abs(float(got[t]) - float(r["H"]))
                if diff > ck["max_abs_diff"]:
                    ck["max_abs_diff"], ck["max_abs_diff_at"] = diff, f"{aoi} {month_key(m0 + t)}"

            years: dict[str, dict] = {}
            dates = days_i.astype("datetime64[D]")
            yr = dates.astype("datetime64[Y]").astype(np.int64) + 1970
            doy = (dates - dates.astype("datetime64[Y]")).astype(np.int64) + 1
            for y in np.unique(yr).tolist():
                sel = yr == y
                block = {"d": doy[sel].tolist(), "h": [None if np.isnan(v) else number(v) for v in h[sel]]}
                for j, s in enumerate(SAT_NAMES):
                    if mat[sel, j].any():
                        block[SATS[s][1]] = mat[sel, j].tolist()
                years[str(y)] = block
            doc = {"format": FORMAT, "aoi_id": aoi, "name": e.get("name_en") or e.get("name") or aoi, "level": level}
            if level == "district":
                doc["province_aoi"] = e["province_aoi"]
                doc["approximate"] = True
            doc["first_month"] = month_key(m0)
            doc["months"] = "".join(codes)
            if locked.any():
                doc["withheld"] = [[iso_day(lock_from), iso_day(lock_to)]]
            doc["years"] = years
            f = out / f"{aoi}.json"
            f.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
            size = f.stat().st_size
            areas[aoi] = [int(len(days_i)), size]
            total_bytes += size
            total_days += int(len(days_i))
        ck["max_abs_diff"] = round(ck["max_abs_diff"], 6)
        checks[level] = ck

    ok = not problems and all(c["raw_sums_different"] == 0 and c["value_without_raw"] == 0 for c in checks.values())
    index = {
        "format": FORMAT,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "built_by": "pipeline/daily/build_everyday_days.py",
        "data_version": ss_index.get("data_version"),
        "monthly_record_generated_at": ss_index.get("generated_at"),
        "unit": "fire cell-days a day: 0.01 degree cells with at least one detection on a local date, counted per "
                "satellite and per day or night pass (vegetation fires only, low confidence removed); "
                "the one-scale value is on the Aqua MODIS scale",
        "record": {"first_month": month_key(m0), "last_month": month_key(m0 + T - 1), "first_day": iso_day(day0),
                   "last_day": iso_day(max(last_day.values()))},
        "notes": [
            "The days of a month add up to that month of the monthly record (ss-data/monthly_<aoi>.json), for the "
            "one-scale value and for each sensor's raw count.",
            "h, the value on one scale, is the day's cell-days of the month's sensor times one factor for the whole "
            "month (the month's value divided by the month's cell-days of that sensor). The factor is 1 from July "
            "2002 to December 2021 (Aqua MODIS's own count). From 2022 the days are converted from VIIRS and before "
            "July 2002 from Terra with the month's factor: approximate. No finer factor is fitted.",
            "District values share their province's monthly conversion and are approximate (ss-data/districts).",
            "A date that is not in an area's file has no cell-day from any sensor. It is a zero only inside the "
            "sensor's first and last day and when that sensor recorded something somewhere in Indonesia that day; "
            "otherwise it has no value. A zero means nothing was detected, not that nothing burned: cloud and "
            "smoke hide fires.",
            "silent_days: dates inside a sensor's first and last day on which it recorded nothing anywhere in "
            "Indonesia. The sensor was off, or it is a true nationwide zero; the files cannot tell which, so "
            "those dates have no value.",
            "Days of the months in provisional_months come from near-real-time data and may change; the month in "
            "partial_months was still running when the files were read.",
            "Fire cell-days are not burned area.",
        ],
        "file_format": {
            "file": "<aoi_id>.json",
            "months": "one character per month from first_month: A Aqua's own count, T Terra converted, S VIIRS "
                      "S-NPP converted, N VIIRS NOAA-20 converted, 0 the month's value is 0 with no sensor named, "
                      "- the monthly record has no value, x withheld",
            "years": "per year: d = day of the year (1 = 1 January) of each local date with a cell-day; h = value "
                     "on one scale (null = no value); a, t, v, n = cell-days as recorded by MODIS Aqua, MODIS "
                     "Terra, VIIRS S-NPP, VIIRS NOAA-20 (a column left out is 0 on every listed day of the year)",
        },
        "satellites": sat_info,
        "provisional_months": [f"{r['year']}-{r['month']:02d}" for r in nat_rows if r["flag_nrt"]],
        "partial_months": [f"{r['year']}-{r['month']:02d}" for r in nat_rows if r["flag_partial"]],
        "withheld": {
            "from": iso_day(lock_from), "to": iso_day(lock_to), "areas": withheld_ids,
            "why": "A registered test of a sibling project (KalenderApi v1.1) covers Central Kalimantan and Pulang "
                   "Pisau for these days and has not been run. The rows of these days were dropped for the province "
                   "and its districts before anything was counted; no file holds them. They are not zeros.",
            "read_from": "ss-data/districts/index.json \"locked\" (the district export), docs/DATA.md 13.2 and 14.8, "
                         "and app/src/lib/record.ts HELD and lockedMonths (the province)",
        },
        "rows": {"cell_days_counted": int(n_rows), "archive_rows_dropped_at_or_after_the_first_nrt_month": n_sp_dropped,
                 "rows_of_other_satellites_left_out": n_other_sat, "rows_outside_the_record_months": n_outside,
                 "rows_without_a_region": n_no_region, "rows_without_a_province": n_no_prov,
                 "rows_without_a_district": n_no_dist},
        "check": {
            "what": "computed while writing: each sensor's days summed per month against the month's raw column "
                    "(must be equal), and the days' one-scale values summed per month against the month's value "
                    "(max_abs_diff, rounding to 3 decimals only). Withheld months are in neither.",
            "passed": ok, "by_level": checks, "problems": problems,
        },
        "inputs": {
            "daily_cell_labeled.parquet": sha256_of(sp_path),
            "daily_cell_labeled_2026nrt.parquet": sha256_of(nrt_path),
            "ss-data/index.json": sha256_of(ss / "index.json"),
            "ss-data/districts/index.json": sha256_of(ss / "districts/index.json"),
            "ss-data/districts/cells.json": sha256_of(ss / "districts/cells.json"),
        },
        "n_files": len(areas), "total_days": total_days, "area_files_bytes": total_bytes,
        "areas": areas,
    }
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    idx_bytes = (out / "index.json").stat().st_size

    print(f"[days] {n_rows} cell-days; {len(areas)} area files, {total_days} listed days, {total_bytes} bytes; "
          f"index.json {idx_bytes} bytes; {time.time() - t0:.1f} s")
    print(f"[days] withheld {iso_day(lock_from)} to {iso_day(lock_to)} for {len(withheld_ids)} areas "
          f"(province days withheld: {WITHHOLD_PROVINCE_DAYS})")
    for s in SAT_NAMES:
        print(f"[days] {s}: {sat_info[s]['first_day']} to {sat_info[s]['last_day']}, silent days {sat_info[s]['silent_day_count']}")
    for level, ck in checks.items():
        print(f"[days] {level}: {ck}")
    for p in problems:
        print("[days] PROBLEM", p)
    if not ok:
        print("[days] the days do NOT add up to the monthly record: see the problems above")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
