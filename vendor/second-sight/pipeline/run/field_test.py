"""VAL-08: Field (2016) physical test, pre-registered as V8 in docs/validation_plan.md.

Aug-Oct fire activity vs Aug-Oct mean CHIRPS rainfall (mm/day), fitted separately for
2003-2011 and 2012-2025 as log(activity) = a + b * rain. Two series are compared, both
with the sensor switch at 2012-01 (aqua_end = 2011-12) so the second period is S-NPP:

* raw: M0 concatenation (Aqua to 2011, raw S-NPP counts from 2012),
* H:   M3 harmonized (Aqua to 2011, S-NPP x kappa from 2012).

The 2003-2011 period is Aqua in both, so only the 2012-2025 fit differs. Slope CIs are
90% percentile intervals from a year bootstrap within each period.

Rule (V8): pass if the CIs of the two slopes overlap for H **and** do not overlap for raw
(or the raw slope difference is larger than the H difference). The national series is the
decision unit; Kalimantan and Sumatra are reported with the same rule.

Writes ``derived/validation_results_v8.json`` (validate.result format) and does not modify
``validation_results.json``.

    python -m pipeline.run.field_test [--data-root D:/.../second-sight-data] [--n-boot 2000]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.run.validate_all import kappa_one, load_monthly_stratum
from pipeline.science import validate as V
from pipeline.science.calibrate import CAL_YEARS, fit_kappa
from pipeline.science.common import data_dir
from pipeline.science.series import build_series

PERIODS = {"2003-2011": (2003, 2011), "2012-2025": (2012, 2025)}
SEASON = (8, 9, 10)
REGION_PROVINCES = {
    "Kalimantan": lambda p: p.startswith("Kalimantan"),
    "Sumatra": lambda p: p.startswith("Sumatera") or p in (
        "Aceh", "Riau", "Jambi", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung",
        "Kepulauan Riau"),
}
RULE = ("pass if 90% CIs of the 2003-2011 and 2012-2025 slopes overlap for H and do not "
        "overlap for raw (or |raw slope diff| > |H slope diff|)")


def season_rain(clim: pd.DataFrame, region: str) -> pd.Series:
    c = clim[clim["month"].isin(SEASON)]
    if region == "national":
        c = c[c["aoi_id"] == "NATIONAL"]
    else:
        sel = c["aoi_type"].eq("province") & c["aoi_id"].map(REGION_PROVINCES[region])
        c = c[sel]  # unweighted mean over the region's provinces
    return c.groupby("year")["precip_1m_mm_day"].mean()


def season_activity(series: pd.DataFrame, region: str) -> pd.Series:
    s = series[series["month"].isin(SEASON)]
    if region != "national":
        s = s[s["island_region"] == region]
    return s.groupby("year")["H"].sum()


def fit_slope(rain: np.ndarray, act: np.ndarray, n_boot: int, rng) -> tuple[float, list[float], int]:
    ok = act > 0
    x, y = rain[ok], np.log(act[ok])
    b = float(np.polyfit(x, y, 1)[0])
    draws = []
    for _ in range(n_boot):
        i = rng.integers(0, len(x), len(x))
        if np.ptp(x[i]) > 0:
            draws.append(np.polyfit(x[i], y[i], 1)[0])
    lo, hi = np.percentile(draws, [5, 95])
    return b, [float(lo), float(hi)], int(ok.sum())


def overlap(a, b) -> bool:
    return a[0] <= b[1] and b[0] <= a[1]


def run(ms, clim, n_boot=2000, seed=8) -> list[dict]:
    fit = fit_kappa(ms, years=CAL_YEARS, n_boot=0)
    series = {
        "raw": build_series(ms, kappa_one(), by=["island_region"], aqua_end=(2011, 12)),
        "H": build_series(ms, fit, by=["island_region"], aqua_end=(2011, 12)),
    }
    out = []
    for region in ("national", "Kalimantan", "Sumatra"):
        rain = season_rain(clim, region)
        slopes = {}
        for sname, s in series.items():
            act = season_activity(s, region)
            for pname, (y0, y1) in PERIODS.items():
                yrs = [y for y in range(y0, y1 + 1) if y in rain.index and y in act.index]
                rng = np.random.default_rng(seed)
                b, ci, n = fit_slope(rain.loc[yrs].to_numpy(), act.loc[yrs].to_numpy(),
                                     n_boot, rng)
                slopes[(sname, pname)] = (b, ci)
                out.append(V.result("V8", f"slope log({sname}) per mm/day {region} {pname}", b,
                                    "descriptive", None, ci=ci,
                                    notes=f"Aug-Oct sum vs Aug-Oct mean CHIRPS precip_1m; "
                                          f"n_years={n}; year bootstrap n={n_boot}"))
        p1, p2 = PERIODS
        (bh1, ch1), (bh2, ch2) = slopes[("H", p1)], slopes[("H", p2)]
        (br1, cr1), (br2, cr2) = slopes[("raw", p1)], slopes[("raw", p2)]
        dh, dr = abs(bh2 - bh1), abs(br2 - br1)
        passed = overlap(ch1, ch2) and ((not overlap(cr1, cr2)) or dr > dh)
        out.append(V.result(
            "V8", f"field test decision {region}", dh, RULE, passed,
            notes=f"|H slope diff|={dh:.4f}, |raw slope diff|={dr:.4f}; H CIs overlap="
                  f"{overlap(ch1, ch2)}; raw CIs overlap={overlap(cr1, cr2)}; "
                  + ("decision unit" if region == "national" else "secondary (same rule)")))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", default=None)
    ap.add_argument("--n-boot", type=int, default=2000)
    args = ap.parse_args(argv)
    root = Path(args.data_root) if args.data_root else data_dir()
    ms, _ = load_monthly_stratum(root)
    clim = pd.read_parquet(root / "support" / "climate" / "climate_monthly.parquet")
    res = run(ms, clim, n_boot=args.n_boot)
    path = root / "derived" / "validation_results_v8.json"
    V.write_results(res, path)
    for r in res:
        print(json.dumps(r))
    print("wrote", path)


if __name__ == "__main__":
    main()
