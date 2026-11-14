"""CAL-03: satellite chain factors (ratio of sums + year bootstrap).

- r_T->A    = sum Aqua / sum Terra     over 2002-07 .. 2005-12, per (island_region, daynight, season)
- r_N20->SNPP = sum SNPP / sum NOAA20  over 2018-04 .. 2026-10, per (island_region, daynight)

H = Terra * r_T->A ; H = NOAA20 * r_N20->SNPP * kappa. Chain-closure error is carried as the
bootstrap SD of log r (``sd_log``), which adds in quadrature to the log-variance of kappa.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .calibrate import KappaFit, _json_default
from .common import AQUA, N_BOOT, NOAA20, SEED, SNPP, TERRA, in_window, normalize_satellite

TERRA_AQUA_WINDOW = ((2002, 7), (2005, 12))
N20_SNPP_WINDOW = ((2018, 4), (2026, 10))
TERRA_AQUA_KEYS = ["island_region", "daynight", "season"]
N20_SNPP_KEYS = ["island_region", "daynight"]


def chain_factor(df: pd.DataFrame, num_sat: str, den_sat: str, start, end,
                 keys: list[str] | None = None, n_boot: int = N_BOOT, seed: int = SEED,
                 q=(5, 95)) -> KappaFit:
    """Ratio of sums num/den per group within [start, end], with year-block bootstrap.

    Only months in which *both* satellites report are used, so partial coverage does
    not bias the ratio. Groups with no denominator get the pooled ratio (flag ``pooled``).
    """
    keys = list(keys or [])
    d = df[in_window(df, start, end)].copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    d = d[d["satellite"].isin([num_sat, den_sat])]
    if not keys:
        d["_all"] = "all"
    k_eff = keys or ["_all"]
    w = d.pivot_table(index=k_eff + ["year", "month"], columns="satellite", values="cell_days",
                      aggfunc="sum", fill_value=0, observed=True)
    for s in (num_sat, den_sat):
        if s not in w:
            w[s] = 0
    w = w.reset_index()
    both = w.groupby(["year", "month"])[[num_sat, den_sat]].transform("sum")
    w = w[(both[num_sat] > 0) & (both[den_sat] > 0)]
    groups = w[k_eff].drop_duplicates().sort_values(k_eff).reset_index(drop=True)
    groups["_g"] = np.arange(len(groups))
    w = w.merge(groups, on=k_eff)
    yrs = np.array(sorted(w["year"].unique()))
    yi = {y: i for i, y in enumerate(yrs)}
    N = np.zeros((len(yrs), len(groups)))
    D = np.zeros_like(N)
    for row in w[["year", "_g", num_sat, den_sat]].itertuples(index=False):
        N[yi[row[0]], row[1]] += row[2]
        D[yi[row[0]], row[1]] += row[3]

    def _ratio(n, dd):
        pooled = n.sum() / dd.sum() if dd.sum() > 0 else np.nan
        r = np.where(dd > 0, n / np.where(dd > 0, dd, 1), pooled)
        return r, pooled

    r, pooled = _ratio(N.sum(0), D.sum(0))
    table = groups.drop(columns="_g").copy()
    table["sum_num"], table["sum_den"] = N.sum(0), D.sum(0)
    table["r"] = r
    table["pooled"] = D.sum(0) <= 0
    draws = None
    if n_boot and len(yrs):
        rng = np.random.default_rng(seed)
        draws = np.empty((n_boot, len(groups)))
        for i in range(n_boot):
            wt = np.bincount(rng.integers(0, len(yrs), len(yrs)), minlength=len(yrs))
            draws[i] = _ratio(wt @ N, wt @ D)[0]
        lo, hi = np.nanpercentile(draws, q, axis=0)
        table["r_lo"], table["r_hi"] = np.minimum(lo, r), np.maximum(hi, r)
        with np.errstate(divide="ignore", invalid="ignore"):
            table["sd_log"] = np.nanstd(np.log(draws), axis=0)
    if "_all" in table:
        table = table.drop(columns="_all")
    meta = {"num_sat": num_sat, "den_sat": den_sat, "window": [list(start), list(end)],
            "keys": keys, "years": [int(y) for y in yrs], "n_boot": int(n_boot or 0),
            "seed": int(seed), "pooled_ratio": float(pooled) if np.isfinite(pooled) else None}
    return KappaFit(table=table, draws=draws, meta=meta)


def terra_to_aqua(df: pd.DataFrame, **kw) -> KappaFit:
    kw.setdefault("keys", TERRA_AQUA_KEYS)
    return chain_factor(df, AQUA, TERRA, *TERRA_AQUA_WINDOW, **kw)


def noaa20_to_snpp(df: pd.DataFrame, **kw) -> KappaFit:
    kw.setdefault("keys", N20_SNPP_KEYS)
    return chain_factor(df, SNPP, NOAA20, *N20_SNPP_WINDOW, **kw)


def chain_factors(df: pd.DataFrame, path: str | Path | None = None, **kw) -> dict:
    """Both chain factors as a JSON-ready dict (optionally written to ``chain_factors.json``)."""
    out = {"terra_to_aqua": terra_to_aqua(df, **kw).to_dict(),
           "noaa20_to_snpp": noaa20_to_snpp(df, **kw).to_dict()}
    if path is not None:
        Path(path).write_text(json.dumps(out, indent=2, default=_json_default))
    return out
