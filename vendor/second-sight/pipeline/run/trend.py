"""FND-04: robust trend tests on annual fire-count totals (naive stitch vs summed vs fair H).

Theil-Sen slope (95% CI), modified Mann-Kendall (Hamed & Rao 1998) p-value, window
comparisons, ENSO-exclusion sensitivity. Descriptive only: no causal attribution.

Usage: python -m pipeline.run.trend --bundle <dir> --out <derived/trend.json>
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy import stats

YEARS = list(range(2001, 2026))
STITCH_LAST_MODIS_YEAR = 2011
# El Nino years (ONI JAS >= +0.5, as in pipeline.science.enso rules)
EL_NINO_YEARS = [2002, 2004, 2006, 2009, 2015, 2019, 2023]
WINDOWS = [((2003, 2007), (2019, 2023)), ((2001, 2005), (2021, 2025))]
SERIES = ("naive", "summed", "fair", "fair_lo", "fair_hi")


def mk_hamed_rao(x) -> dict:
    """Modified Mann-Kendall test with Hamed & Rao (1998) variance correction."""
    x = np.asarray(x, float)
    n = len(x)
    s = sum(np.sign(x[j] - x[i]) for i in range(n - 1) for j in range(i + 1, n))
    _, counts = np.unique(x, return_counts=True)
    var_s = (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in counts)) / 18.0
    slope = stats.theilslopes(x).slope
    detr = x - slope * np.arange(1, n + 1)
    r = stats.rankdata(detr)
    r = r - r.mean()
    denom = np.sum(r * r)
    bound = 1.96 / math.sqrt(n)
    acc = 0.0
    for k in range(1, n - 1):
        rho = np.sum(r[:-k] * r[k:]) / denom if denom else 0.0
        if abs(rho) > bound:
            acc += (n - k) * (n - k - 1) * (n - k - 2) * rho
    corr = 1 + 2.0 / (n * (n - 1) * (n - 2)) * acc
    var_s *= max(corr, 1e-9)
    if s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return {"S": float(s), "z": float(z), "p": float(p), "var_correction": float(corr)}


def theil_sen(years, x) -> dict:
    res = stats.theilslopes(x, years, alpha=0.95)
    mean = float(np.mean(x))

    def pct(v):
        return 100.0 * v / mean if mean else None

    return {"slope": float(res.slope), "lo": float(res.low_slope), "hi": float(res.high_slope),
            "pct_of_mean_per_yr": pct(res.slope), "pct_lo": pct(res.low_slope),
            "pct_hi": pct(res.high_slope), "mean": mean}


def window_ratio(series: dict, a, b) -> dict:
    ma = float(np.mean([series[y] for y in range(a[0], a[1] + 1)]))
    mb = float(np.mean([series[y] for y in range(b[0], b[1] + 1)]))
    return {"early": f"{a[0]}-{a[1]}", "late": f"{b[0]}-{b[1]}", "early_mean": ma, "late_mean": mb,
            "ratio": mb / ma if ma else None, "pct_change": 100.0 * (mb / ma - 1) if ma else None}


def annual_series(rows: list) -> dict:
    """Annual totals for naive, summed, fair (and fair lo/hi). Missing months count as 0."""
    out = {k: {y: 0.0 for y in YEARS} for k in SERIES}
    nmonths = {y: 0 for y in YEARS}
    for r in rows:
        y = r["year"]
        if y not in nmonths:
            continue
        a, v = r.get("A_raw") or 0, r.get("V_raw") or 0
        out["naive"][y] += a if y <= STITCH_LAST_MODIS_YEAR else v
        out["summed"][y] += a + v
        out["fair"][y] += r.get("H") or 0
        out["fair_lo"][y] += r.get("H_lo") or 0
        out["fair_hi"][y] += r.get("H_hi") or 0
        nmonths[y] += 1
    out["_nmonths"] = nmonths
    return out


def analyse_series(series: dict, years=YEARS) -> dict:
    x = [series[y] for y in years]
    return {"n_years": len(years), "theil_sen": theil_sen(np.array(years, float), x),
            "mk_hamed_rao": mk_hamed_rao(x)}


def sign_of(res: dict) -> str:
    ts = res["theil_sen"]
    if ts["lo"] > 0:
        return "increase"
    if ts["hi"] < 0:
        return "decrease"
    return "up (CI spans 0)" if ts["slope"] > 0 else "down (CI spans 0)"


def analyse_aoi(rows: list) -> dict:
    s = annual_series(rows)
    no_nino = [y for y in YEARS if y not in EL_NINO_YEARS]
    out = {"annual": {k: {str(y): v[y] for y in YEARS} for k, v in s.items()}}
    for name in SERIES:
        full = analyse_series(s[name])
        excl = analyse_series(s[name], no_nino)
        out[name] = {"all_years": full, "sign": sign_of(full),
                     "excl_el_nino": excl, "sign_excl_el_nino": sign_of(excl),
                     "windows": [window_ratio(s[name], a, b) for a, b in WINDOWS]}
    out["fair_sign_robust"] = len({out[k][f] for k in ("fair", "fair_lo", "fair_hi")
                                   for f in ("sign", "sign_excl_el_nino")}) == 1
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default="D:/Lomba/Hackathon/nasa/second-sight-data/bundle")
    ap.add_argument("--out", default="D:/Lomba/Hackathon/nasa/second-sight-data/derived/trend.json")
    a = ap.parse_args(argv)
    result = {"method": {"slope": "Theil-Sen, 95% CI", "test": "Mann-Kendall, Hamed & Rao 1998",
                         "years": [YEARS[0], YEARS[-1]],
                         "naive": f"A_raw <= {STITCH_LAST_MODIS_YEAR}, V_raw after",
                         "enso": f"exclude El Nino years {EL_NINO_YEARS}",
                         "m1_m2_sensitivity": "skipped (H_lo/H_hi band used instead)"}, "aoi": {}}
    for f in sorted(Path(a.bundle).glob("monthly_*.json")):
        aoi = f.stem.removeprefix("monthly_")
        result["aoi"][aoi] = analyse_aoi(json.loads(f.read_text()))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(result, indent=1))
    for aoi, r in result["aoi"].items():
        for k in ("naive", "summed", "fair", "fair_lo", "fair_hi"):
            ts = r[k]["all_years"]["theil_sen"]
            ex = r[k]["excl_el_nino"]["theil_sen"]
            print(f"{aoi:22s} {k:7s} {r[k]['sign']:18s} {ts['pct_of_mean_per_yr']:+.1f}%/yr "
                  f"[{ts['pct_lo']:+.1f},{ts['pct_hi']:+.1f}] p={r[k]['all_years']['mk_hamed_rao']['p']:.3f} "
                  f"| exNino {r[k]['sign_excl_el_nino']:18s} {ex['pct_of_mean_per_yr']:+.1f} "
                  f"[{ex['pct_lo']:+.1f},{ex['pct_hi']:+.1f}] p={r[k]['excl_el_nino']['mk_hamed_rao']['p']:.3f} "
                  f"| w1 {r[k]['windows'][0]['pct_change']:+.0f}% w2 {r[k]['windows'][1]['pct_change']:+.0f}%")
        print(aoi, "fair sign robust:", r["fair_sign_robust"], "nmonths2025:", r["annual"]["_nmonths"]["2025"])


if __name__ == "__main__":
    main()
