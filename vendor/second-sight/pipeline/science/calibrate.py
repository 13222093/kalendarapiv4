"""CAL-01 / CAL-02: stratified VIIRS(S-NPP) -> Aqua conversion factor kappa.

Model (08 §7.6.2 step 6). For stratum s (island_region x season x daynight x is_peat)
and calibration years 2012-2021::

    A_s ~ Poisson(kappa_s * V_s),   kappa_s ~ Gamma(a_p, b_p)   (p = parent of s)
    kappa_hat_s = (a_p + sum A_s) / (b_p + sum V_s)

(a_p, b_p) come from the method of moments over the children of parent p
(island_region, daynight). If a parent has < 2 informative children or no
between-stratum variance, the grandparent (daynight) prior is used. Uncertainty
comes from a year-block bootstrap: the same resampled years are used for every
stratum so that cross-strata correlation is kept.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .common import (AQUA, GRANDPARENT_KEYS, N_BOOT, PARENT_KEYS, SEED, SNPP,
                     STRATUM_KEYS, normalize_satellite)

CAL_YEARS = tuple(range(2012, 2022))
MIN_REL_SD = 0.05  # floor on between-stratum relative SD of kappa (prevents infinite b)


@dataclass
class KappaFit:
    """Result of a calibration: per-stratum table plus bootstrap draws."""
    table: pd.DataFrame                      # one row per stratum
    draws: np.ndarray | None = None          # (n_boot, n_strata) kappa draws
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        rows = self.table.replace({np.nan: None}).to_dict(orient="records")
        return {"meta": self.meta, "strata": rows}

    def write_json(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2, default=_json_default))


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.bool_):
        return bool(o)
    raise TypeError(type(o))


def year_stratum_matrix(df: pd.DataFrame, years, num_sat: str = AQUA, den_sat: str = SNPP,
                        keys: list[str] | None = None):
    """Return (strata DataFrame, years array, A[y, s], V[y, s]) of cell-day sums."""
    keys = keys or STRATUM_KEYS
    d = df[df["year"].isin(list(years))].copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    d = d[d["satellite"].isin([num_sat, den_sat])]
    strata = d[keys].drop_duplicates().sort_values(keys).reset_index(drop=True)
    strata["_s"] = np.arange(len(strata))
    years = np.array(sorted(years))
    y_idx = {y: i for i, y in enumerate(years)}
    d = d.merge(strata, on=keys, how="left")
    A = np.zeros((len(years), len(strata)))
    V = np.zeros((len(years), len(strata)))
    g = d.groupby(["year", "_s", "satellite"], observed=True)["cell_days"].sum()
    for (y, s, sat), val in g.items():
        (A if sat == num_sat else V)[y_idx[y], s] += val
    return strata.drop(columns="_s"), years, A, V


def _group_index(strata: pd.DataFrame, keys: list[str]) -> np.ndarray:
    return strata.groupby(keys, sort=True, observed=True).ngroup().to_numpy()


def _mom_prior(A: np.ndarray, V: np.ndarray, min_rel_sd: float = MIN_REL_SD):
    """Method-of-moments gamma prior from children counts. Returns (a, b, ok)."""
    m_mask = V > 0
    tot_v = V[m_mask].sum()
    if tot_v <= 0:
        return np.nan, np.nan, False
    m = A[m_mask].sum() / tot_v
    if m <= 0:
        m = 0.5 / tot_v  # no Aqua at all: weak prior near zero
    v = V[m_mask]
    r = A[m_mask] / v
    n = m_mask.sum()
    ok = n >= 2
    # exposure-weighted moment estimator of the between-stratum variance of kappa
    # (Poisson noise of each child ratio has variance m / V_i)
    denom = tot_v - (v ** 2).sum() / tot_v
    s2 = (np.sum(v * (r - m) ** 2) - (n - 1) * m) / denom if (ok and denom > 0) else -1.0
    # no detectable heterogeneity -> strong (but finite) pooling to the parent mean
    s2 = max(s2, (min_rel_sd * m) ** 2)
    return m * m / s2, m / s2, ok


def eb_kappa(A_s: np.ndarray, V_s: np.ndarray, parent_idx: np.ndarray, gp_idx: np.ndarray,
             min_rel_sd: float = MIN_REL_SD):
    """Empirical-Bayes kappa from per-stratum sums. Returns dict of arrays."""
    n = len(A_s)
    a = np.full(n, np.nan)
    b = np.full(n, np.nan)
    level = np.empty(n, dtype=object)
    gp_prior = {}
    for g in np.unique(gp_idx):
        sel = gp_idx == g
        gp_prior[g] = _mom_prior(A_s[sel], V_s[sel], min_rel_sd)
    for p in np.unique(parent_idx):
        sel = parent_idx == p
        pa, pb, ok = _mom_prior(A_s[sel], V_s[sel], min_rel_sd)
        if not ok or not np.isfinite(pa):
            g = gp_idx[sel][0]
            ga, gb, _ = gp_prior[g]
            if np.isfinite(ga):
                pa, pb, lvl = ga, gb, "grandparent"
            else:
                lvl = "parent"
        else:
            lvl = "parent"
        a[sel], b[sel], level[sel] = pa, pb, lvl
    kappa = (a + A_s) / (b + V_s)
    weight = V_s / (b + V_s)  # weight on the stratum's own data
    return {"a": a, "b": b, "kappa": kappa, "shrink_weight": weight, "prior_level": level}


def fit_kappa(df: pd.DataFrame, years=CAL_YEARS, n_boot: int = N_BOOT, seed: int = SEED,
              keys: list[str] | None = None, parent_keys: list[str] | None = None,
              gp_keys: list[str] | None = None, min_rel_sd: float = MIN_REL_SD,
              q: tuple[float, float] = (5, 95)) -> KappaFit:
    """Fit stratified EB kappa (Aqua/SNPP) and its year-bootstrap interval."""
    keys = keys or STRATUM_KEYS
    parent_keys = parent_keys if parent_keys is not None else PARENT_KEYS
    gp_keys = gp_keys if gp_keys is not None else GRANDPARENT_KEYS
    strata, yrs, A, V = year_stratum_matrix(df, years, keys=keys)
    p_idx = _group_index(strata, parent_keys) if parent_keys else np.zeros(len(strata), int)
    g_idx = _group_index(strata, gp_keys) if gp_keys else np.zeros(len(strata), int)
    A_s, V_s = A.sum(0), V.sum(0)
    est = eb_kappa(A_s, V_s, p_idx, g_idx, min_rel_sd)
    table = strata.copy()
    table["sum_A"], table["sum_V"] = A_s, V_s
    table["raw_ratio"] = np.where(V_s > 0, A_s / np.where(V_s > 0, V_s, 1), np.nan)
    for k, v in est.items():
        table[k] = v
    draws = None
    if n_boot and n_boot > 0:
        rng = np.random.default_rng(seed)
        ny = len(yrs)
        draws = np.empty((n_boot, len(strata)))
        for i in range(n_boot):
            w = np.bincount(rng.integers(0, ny, ny), minlength=ny)
            draws[i] = eb_kappa(w @ A, w @ V, p_idx, g_idx, min_rel_sd)["kappa"]
        lo, hi = np.nanpercentile(draws, q, axis=0)
        table["kappa_lo"] = np.minimum(lo, table["kappa"])
        table["kappa_hi"] = np.maximum(hi, table["kappa"])
    table["plausible"] = (table["kappa"] > 0) & (table["kappa"] < 1)
    meta = {"method": "M3 stratified empirical-Bayes gamma-Poisson (ratio Aqua/SNPP)",
            "years": [int(y) for y in yrs], "strata_keys": keys, "parent_keys": parent_keys,
            "grandparent_keys": gp_keys, "n_boot": int(n_boot or 0), "seed": int(seed),
            "interval_percentiles": list(q), "min_rel_sd": min_rel_sd}
    return KappaFit(table=table, draws=draws, meta=meta)


def fit_simple_ratio(df: pd.DataFrame, years=CAL_YEARS, keys: list[str] | None = None,
                     n_boot: int = 0, seed: int = SEED) -> KappaFit:
    """Unshrunk ratio of sums per group (M1 if keys=[], M2 if region x season)."""
    keys = list(keys or [])
    d = df.copy()
    if not keys:
        d["_all"] = "all"
        keys_eff = ["_all"]
    else:
        keys_eff = keys
    strata, yrs, A, V = year_stratum_matrix(d, years, keys=keys_eff)
    A_s, V_s = A.sum(0), V.sum(0)
    table = strata.copy()
    table["sum_A"], table["sum_V"] = A_s, V_s
    table["kappa"] = np.where(V_s > 0, A_s / np.where(V_s > 0, V_s, 1), np.nan)
    draws = None
    if n_boot:
        rng = np.random.default_rng(seed)
        draws = np.empty((n_boot, len(strata)))
        for i in range(n_boot):
            w = np.bincount(rng.integers(0, len(yrs), len(yrs)), minlength=len(yrs))
            a, v = w @ A, w @ V
            draws[i] = np.where(v > 0, a / np.where(v > 0, v, 1), np.nan)
        table["kappa_lo"], table["kappa_hi"] = np.nanpercentile(draws, [5, 95], axis=0)
    if "_all" in table:
        table = table.drop(columns="_all")
    return KappaFit(table=table, draws=draws,
                    meta={"method": f"ratio of sums by {keys or 'global'}",
                          "years": [int(y) for y in yrs], "strata_keys": keys})


def apply_kappa(df_v: pd.DataFrame, fit: KappaFit, value: str = "cell_days",
                fallback: float | None = None) -> pd.Series:
    """kappa * value for each row of a VIIRS table (rows matched on the fit's strata keys)."""
    keys = fit.meta.get("strata_keys") or []
    if not keys:
        k = float(fit.table["kappa"].iloc[0])
        return df_v[value] * k
    m = df_v[keys].merge(fit.table[keys + ["kappa"]], on=keys, how="left")["kappa"].to_numpy()
    if fallback is None:
        tot = fit.table
        fallback = float(tot["sum_A"].sum() / tot["sum_V"].sum()) if tot["sum_V"].sum() > 0 else 0.0
    m = np.where(np.isfinite(m), m, fallback)
    return pd.Series(df_v[value].to_numpy() * m, index=df_v.index)


def strata_factors(df: pd.DataFrame, path: str | Path | None = None, **kw) -> dict:
    """Convenience wrapper: fit M3 and return (optionally write) strata_factors JSON dict."""
    fit = fit_kappa(df, **kw)
    if path is not None:
        fit.write_json(path)
    return fit.to_dict()
