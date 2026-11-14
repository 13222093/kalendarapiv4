"""DAT-05: data health (FIRMS missing data / availability + structural breaks per sensor).

AI-assisted code (see docs/ai_acknowledgement.md).

Endpoints (checked 2026-11-14, FIRMS API v4.2.8):
  * missing_data: https://firms.modaps.eosdis.nasa.gov/api/missing_data/?action=fetch_data
    (no key; JSON {"success", "html"} where html is <tr> rows of
    [SP date, SP satellite, NRT date, NRT satellite]; NRT only listed after the last SP date)
  * data_availability: https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{MAP_KEY}/ALL
    (needs MAP_KEY; read from env FIRMS_MAP_KEY; skipped if absent)

data_health.json schema (version 1)::

    {
      "schema_version": 1,
      "generated_utc": "2026-11-14T02:30:00+00:00",
      "sources": {"missing_data": url, "data_availability": url | null},
      "data_availability": [{"data_id": str, "min_date": "YYYY-MM-DD", "max_date": "YYYY-MM-DD"}]
                           | null,
      "data_availability_status": "ok" | "skipped: no FIRMS_MAP_KEY" | "error: ...",
      "missing_data": [{"date": "YYYY-MM-DD", "satellite": "SNPP", "data_type": "SP" | "NRT"}],
      "per_date_satellite": [   # only when a daily count table is supplied
          {"date": "YYYY-MM-DD", "satellite": "AQUA", "count": int,
           "firms_missing": bool, "in_gap": bool}],
      "gaps": [{"satellite", "start", "end", "n_days", "matched_event", "explained"}],
      "breaks": [{"satellite", "date", "method": "pettitt", "p_value", "mean_before", "mean_after",
                  "ratio_after_before", "matched_event": str | null, "explained": bool,
                  "label": "<event name>" | "tak terjelaskan"}],
      "known_events": [{"satellite", "date", "end": str | null, "event", "verified": str}]
    }

Satellite keys: TERRA, AQUA, SNPP, NOAA20, NOAA21.
CLI: python -m pipeline.support.data_health [--counts counts.csv]   (csv: date,satellite,count)
"""
from __future__ import annotations

import argparse
import html as _html
import json
import os
import re
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ._common import http_get, support_dir, utc_now_iso

MISSING_URL = "https://firms.modaps.eosdis.nasa.gov/api/missing_data/"
AVAIL_URL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{key}/ALL"

SAT_ALIASES = {
    "TERRA": "TERRA", "T": "TERRA", "TERRA (MODIS)": "TERRA", "MOD": "TERRA",
    "AQUA": "AQUA", "A": "AQUA", "AQUA (MODIS)": "AQUA", "MYD": "AQUA",
    "SNPP": "SNPP", "N": "SNPP", "NPP": "SNPP", "SUOMI NPP": "SNPP", "SUOMI NPP (VIIRS)": "SNPP",
    "VIIRS_SNPP": "SNPP",
    "NOAA20": "NOAA20", "NOAA-20": "NOAA20", "N20": "NOAA20", "1": "NOAA20", "J1": "NOAA20",
    "NOAA-20 (VIIRS)": "NOAA20", "VIIRS_NOAA20": "NOAA20",
    "NOAA21": "NOAA21", "NOAA-21": "NOAA21", "N21": "NOAA21", "2": "NOAA21", "J2": "NOAA21",
    "NOAA-21 (VIIRS)": "NOAA21", "VIIRS_NOAA21": "NOAA21",
}


def norm_sat(name: str) -> str:
    key = str(name).strip().upper()
    return SAT_ALIASES.get(key, key)


@dataclass
class SensorEvent:
    satellite: str
    date: str
    event: str
    end: str | None = None
    verified: str = "task brief; verify before freeze"


# Dates from the DAT-05 brief. Not all are independently verified yet.
KNOWN_EVENTS = [
    SensorEvent("AQUA", "2002-07-04", "Aqua MODIS record starts (2002-07)"),
    SensorEvent("SNPP", "2012-01-20", "S-NPP VIIRS record starts"),
    SensorEvent("NOAA20", "2018-04-01", "NOAA-20 VIIRS record starts in FIRMS (2018-04)",
                verified="FIRMS archive download page + ARSET 2026 FIRMS Q&A: 01 Apr 2018 to present"),
    SensorEvent("NOAA20", "2020-01-01", "NOAA-20 processing/collection change (2020, approx.)"),
    SensorEvent("NOAA21", "2024-01-17", "NOAA-21 VIIRS record starts in FIRMS",
                verified="FIRMS archive download page: 17 Jan 2024 to present (NOAA NDE test data from 2023-02)"),
    SensorEvent("AQUA", "2020-08-16", "Aqua MODIS FMU outage", end="2020-09-02"),
    SensorEvent("SNPP", "2026-11-02", "S-NPP end of record"),
]


# ----------------------------------------------------------------------------- FIRMS calls
def parse_missing_html(html_rows: str) -> list[dict]:
    """Parse FIRMS missing-data <tr> rows -> [{date, satellite, data_type}]."""
    out = []
    for tr in re.findall(r"<tr>(.*?)</tr>", html_rows, flags=re.S):
        cells = [_html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                 for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]
        cells += [""] * (4 - len(cells))
        for (d, s), typ in (((cells[0], cells[1]), "SP"), ((cells[2], cells[3]), "NRT")):
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) and s:
                out.append({"date": d, "satellite": norm_sat(s), "data_type": typ})
    return out


def fetch_missing_data() -> list[dict]:
    r = http_get(MISSING_URL, params={"action": "fetch_data"},
                 headers={"X-Requested-With": "XMLHttpRequest"}, timeout=120)
    js = r.json()
    if not js.get("success"):
        raise RuntimeError("FIRMS missing_data returned success=false")
    return parse_missing_html(js["html"])


def fetch_data_availability(map_key: str | None = None) -> tuple[list[dict] | None, str]:
    key = map_key or os.environ.get("FIRMS_MAP_KEY")
    if not key:
        return None, "skipped: no FIRMS_MAP_KEY"
    try:
        from io import StringIO

        txt = http_get(AVAIL_URL.format(key=key), timeout=60).text
        if "Invalid MAP_KEY" in txt:
            return None, "error: Invalid MAP_KEY"
        df = pd.read_csv(StringIO(txt))
        return df.astype(str).to_dict(orient="records"), "ok"
    except Exception as e:  # network or format problem: report, do not crash the pipeline
        return None, f"error: {type(e).__name__}: {e}"


# ----------------------------------------------------------------------------- break detection
def pettitt(x) -> tuple[int, float, float]:
    """Pettitt (1979) change-point test.

    Returns (k, K, p): x[:k+1] before / x[k+1:] after, statistic K, approx. two-sided p-value.
    Uses the rank form U_t = 2*sum_{i<=t} r_i - t(n+1) (ties get average ranks).
    """
    x = np.asarray(x, float)
    n = len(x)
    if n < 3:
        return 0, 0.0, 1.0
    r = pd.Series(x).rank().to_numpy()
    t = np.arange(1, n + 1)
    u = 2 * np.cumsum(r) - t * (n + 1)
    k = int(np.argmax(np.abs(u[:-1])))
    K = float(abs(u[k]))
    p = min(1.0, 2 * np.exp(-6 * K**2 / (n**3 + n**2)))
    return k, K, p


def cusum(x) -> np.ndarray:
    """Plain CUSUM of deviations from the mean (for plotting / quick inspection)."""
    x = np.asarray(x, float)
    return np.cumsum(x - np.nanmean(x))


def detect_breaks(series: pd.Series, *, alpha: float = 0.01, min_seg: int = 90,
                  max_breaks: int = 6, smooth_days: int = 31) -> list[dict]:
    """Binary segmentation with the Pettitt test on log1p(count), smoothed.

    series: daily counts indexed by date (gaps should be filled with 0 or NaN).
    Smoothing (centered rolling median) damps single-day spikes; seasonal cycles may
    still produce breaks, which is why every break is matched against known events and
    unmatched ones are labelled "tak terjelaskan" rather than dropped.
    """
    s = series.sort_index().asfreq("D")
    y = np.log1p(s.fillna(0).to_numpy(float))
    if smooth_days > 1:
        y = pd.Series(y).rolling(smooth_days, center=True, min_periods=1).median().to_numpy()
    raw = s.fillna(0).to_numpy(float)
    found: list[tuple[int, float]] = []
    segs = [(0, len(y))]
    while segs and len(found) < max_breaks:
        a, b = segs.pop(0)
        if b - a < 2 * min_seg:
            continue
        k, _, p = pettitt(y[a:b])
        cp = a + k + 1  # first index of the "after" segment
        if p < alpha and (cp - a) >= min_seg and (b - cp) >= min_seg:
            found.append((cp, p))
            segs += [(a, cp), (cp, b)]
    out = []
    for cp, p in sorted(found):
        before, after = raw[max(0, cp - min_seg):cp], raw[cp:cp + min_seg]
        mb, ma = float(before.mean()), float(after.mean())
        out.append({"date": s.index[cp].strftime("%Y-%m-%d"), "method": "pettitt", "p_value": float(p),
                    "mean_before": mb, "mean_after": ma,
                    "ratio_after_before": (ma / mb) if mb > 0 else None})
    return out


def detect_gaps(series: pd.Series, min_days: int = 3) -> list[dict]:
    """Runs of >= min_days consecutive days with zero/missing counts (inside the record)."""
    s = series.sort_index().asfreq("D").fillna(0)
    nz = np.flatnonzero(s.to_numpy() > 0)
    if len(nz) == 0:
        return []
    s = s.iloc[nz[0]:nz[-1] + 1]
    zero = (s.to_numpy() == 0).astype(int)
    out, start = [], None
    for i, z in enumerate(np.append(zero, 0)):
        if z and start is None:
            start = i
        elif not z and start is not None:
            if i - start >= min_days:
                out.append({"start": s.index[start].strftime("%Y-%m-%d"),
                            "end": s.index[i - 1].strftime("%Y-%m-%d"), "n_days": i - start})
            start = None
    return out


def match_event(satellite: str, date: str, events=KNOWN_EVENTS, tol_days: int = 45,
                end: str | None = None) -> str | None:
    """Return the name of the known event of this satellite within tol_days (or overlapping)."""
    d0 = pd.Timestamp(date)
    d1 = pd.Timestamp(end) if end else d0
    best, best_dt = None, None
    for ev in events:
        if ev.satellite != satellite:
            continue
        e0 = pd.Timestamp(ev.date)
        e1 = pd.Timestamp(ev.end) if ev.end else e0
        if d0 <= e1 + pd.Timedelta(days=tol_days) and d1 >= e0 - pd.Timedelta(days=tol_days):
            dt = abs((d0 - e0).days)
            if best_dt is None or dt < best_dt:
                best, best_dt = ev.event, dt
    return best


# ----------------------------------------------------------------------------- assemble
def build_health(counts: pd.DataFrame | None = None, *, missing: list[dict] | None = None,
                 availability: tuple[list[dict] | None, str] | None = None,
                 events=KNOWN_EVENTS, **break_kw) -> dict:
    """counts: DataFrame[date, satellite, count] of daily detections (any satellite naming)."""
    if missing is None:
        try:
            missing = fetch_missing_data()
        except Exception as e:
            missing, miss_err = [], f"{type(e).__name__}: {e}"
        else:
            miss_err = None
    else:
        miss_err = None
    avail, avail_status = availability if availability is not None else fetch_data_availability()

    health = {
        "schema_version": 1,
        "generated_utc": utc_now_iso(),
        "sources": {"missing_data": MISSING_URL + "?action=fetch_data",
                    "data_availability": AVAIL_URL.format(key="<FIRMS_MAP_KEY>") if avail is not None else None},
        "data_availability": avail,
        "data_availability_status": avail_status,
        "missing_data": missing,
        "missing_data_error": miss_err,
        "per_date_satellite": [],
        "gaps": [],
        "breaks": [],
        "known_events": [asdict(e) for e in events],
    }
    if counts is None or counts.empty:
        return health

    df = counts.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["satellite"] = df["satellite"].map(norm_sat)
    miss_set = {(m["date"], m["satellite"]) for m in missing}
    for sat, g in df.groupby("satellite"):
        s = g.groupby("date")["count"].sum().asfreq("D").fillna(0)
        gaps = detect_gaps(s)
        gap_days = set()
        for gp in gaps:
            ev = match_event(sat, gp["start"], events, end=gp["end"])
            if ev is None and any((d, sat) in miss_set for d in
                                  pd.date_range(gp["start"], gp["end"]).strftime("%Y-%m-%d")):
                ev = "FIRMS missing_data list"
            health["gaps"].append({"satellite": sat, **gp, "matched_event": ev, "explained": ev is not None})
            gap_days |= set(pd.date_range(gp["start"], gp["end"]).strftime("%Y-%m-%d"))
        for br in detect_breaks(s, **break_kw):
            ev = match_event(sat, br["date"], events)
            health["breaks"].append({"satellite": sat, **br, "matched_event": ev, "explained": ev is not None,
                                     "label": ev or "tak terjelaskan"})
        for d, c in s.items():
            ds = d.strftime("%Y-%m-%d")
            health["per_date_satellite"].append({"date": ds, "satellite": sat, "count": int(c),
                                                 "firms_missing": (ds, sat) in miss_set,
                                                 "in_gap": ds in gap_days})
    return health


def write_health(health: dict, path=None):
    path = path or support_dir("health") / "data_health.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(health, f, indent=1, ensure_ascii=False, default=str)
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--counts", help="CSV with date,satellite,count (daily detections)")
    ap.add_argument("--out", help="output path (default ${SS_DATA_DIR}/support/health/data_health.json)")
    a = ap.parse_args(argv)
    counts = pd.read_csv(a.counts) if a.counts else None
    h = build_health(counts)
    p = write_health(h, a.out)
    print(p, "missing rows:", len(h["missing_data"]), "| availability:", h["data_availability_status"],
          "| breaks:", len(h["breaks"]), "| gaps:", len(h["gaps"]))


if __name__ == "__main__":
    main()
