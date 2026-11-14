"""CAL-04: harmonized series H on the Aqua scale (08 §7.6.2 step 8).

Eras (monthly resolution):

| period              | H                                   |
|---------------------|-------------------------------------|
| .. 2002-06          | Terra  * r_T->A                     |
| 2002-07 .. 2021-12  | Aqua (native)                       |
| 2022-01 .. 2026-10  | SNPP   * kappa_s                    |
| 2026-11 ..          | NOAA20 * r_N20->SNPP * kappa_s      |

S-NPP ended on 2 Nov 2026; at monthly resolution November 2026 is assigned to NOAA-20
(the two S-NPP days are dropped). Intervals: the stratum-level bootstrap draws (same
resampled years for every stratum) are summed to the output group, then the 5/95
percentiles are taken. kappa and chain draws are paired by draw index (independent
bootstrap streams). The Aqua era carries no calibration uncertainty.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calibrate import KappaFit
from .chain import N20_SNPP_KEYS, TERRA_AQUA_KEYS
from .common import AQUA, NOAA20, SNPP, STRATUM_KEYS, TERRA, month_index, wide_by_satellite

ERA_TERRA_END = (2002, 6)
ERA_AQUA_END = (2021, 12)
ERA_SNPP_END = (2026, 10)


def assign_era(year, month, aqua_end=ERA_AQUA_END, snpp_end=ERA_SNPP_END) -> np.ndarray:
    mi = month_index(year, month)
    return np.select(
        [mi <= month_index(*ERA_TERRA_END), mi <= month_index(*aqua_end),
         mi <= month_index(*snpp_end)],
        [TERRA, AQUA, SNPP], default=NOAA20).astype(object)


def _lookup(rows: pd.DataFrame, fit: KappaFit | None, keys: list[str], col: str):
    """Return (point array, draw-column index array or -1) for each row."""
    n = len(rows)
    if fit is None:
        return np.full(n, np.nan), np.full(n, -1)
    # Coarser fits (M0/M1/M2, reduced strata) carry only a subset of ``keys``: match on the
    # keys present and broadcast; a key-less (pooled) fit applies its single factor to all rows.
    keys = [k for k in keys if k in fit.table.columns]
    t = fit.table[keys + [col]].copy()
    t["_i"] = np.arange(len(t))
    if keys:
        m = rows[keys].merge(t, on=keys, how="left")
        point = m[col].to_numpy(dtype=float)
        idx = m["_i"].fillna(-1).astype(int).to_numpy()
    elif len(t) == 1:
        point, idx = np.full(n, float(t[col].iloc[0])), np.zeros(n, dtype=int)
    else:
        point, idx = np.full(n, np.nan), np.full(n, -1)
    fallback = np.nanmedian(t[col]) if len(t) else np.nan
    if "sum_A" in fit.table and fit.table["sum_V"].sum() > 0:
        fallback = fit.table["sum_A"].sum() / fit.table["sum_V"].sum()
    elif fit.meta.get("pooled_ratio") is not None:
        fallback = fit.meta["pooled_ratio"]
    point = np.where(np.isfinite(point), point, fallback)
    return point, idx


def expand_fit(fit: KappaFit, ms: pd.DataFrame) -> KappaFit:
    """Broadcast a coarse fit (strata keys a subset of STRATUM_KEYS) to every stratum in ``ms``.

    ``build_series`` already accepts coarse fits directly; this helper is kept for callers
    that need an explicit full-strata table. Bootstrap draws are re-indexed, not dropped.
    """
    if set(STRATUM_KEYS) <= set(fit.table.columns):
        return fit
    strata = ms[STRATUM_KEYS].drop_duplicates().reset_index(drop=True)
    point, idx = _lookup(strata, fit, STRATUM_KEYS, "kappa")
    strata["kappa"] = point
    strata["sum_A"], strata["sum_V"] = strata["kappa"], 1.0
    draws = None
    if fit.draws is not None and (idx >= 0).all():
        draws = fit.draws[:, idx]
    return KappaFit(table=strata, draws=draws,
                    meta={**fit.meta, "strata_keys": list(STRATUM_KEYS)})


def _draw_matrix(point, idx, fit: KappaFit | None, n_boot: int):
    """(rows, n_boot) draws; rows without a fitted stratum use the point value."""
    out = np.repeat(point[:, None], n_boot, axis=1)
    if fit is not None and fit.draws is not None:
        ok = idx >= 0
        out[ok] = fit.draws[:n_boot, idx[ok]].T
    return out


def build_series(ms: pd.DataFrame, kappa: KappaFit, terra_aqua: KappaFit | None = None,
                 n20_snpp: KappaFit | None = None, by: list[str] | None = None,
                 q=(5, 95), aqua_end=ERA_AQUA_END) -> pd.DataFrame:
    """Harmonized monthly series grouped by ``by`` (e.g. [], ['is_peat','daynight'], ['province']).

    ``ms`` is a long monthly table (monthly_stratum or monthly_aoi) that must contain the
    stratum keys; extra AOI keys listed in ``by`` are carried through.
    """
    by = list(by or [])
    row_keys = list(dict.fromkeys(STRATUM_KEYS + [b for b in by] + ["year", "month"]))
    w = wide_by_satellite(ms, row_keys)
    era = assign_era(w["year"], w["month"], aqua_end=aqua_end)
    w["sensor_used"] = era

    k_pt, k_idx = _lookup(w, kappa, STRATUM_KEYS, "kappa")
    ta_pt, ta_idx = _lookup(w, terra_aqua, TERRA_AQUA_KEYS, "r")
    ns_pt, ns_idx = _lookup(w, n20_snpp, N20_SNPP_KEYS, "r")
    n_boot = min([f.draws.shape[0] for f in (kappa, terra_aqua, n20_snpp)
                  if f is not None and f.draws is not None] or [0])

    is_t, is_a, is_s, is_n = (era == TERRA), (era == AQUA), (era == SNPP), (era == NOAA20)
    raw = np.select([is_t, is_a, is_s, is_n],
                    [w[TERRA], w[AQUA], w[SNPP], w[NOAA20]], default=0).astype(float)
    fac = np.select([is_t, is_a, is_s, is_n], [ta_pt, 1.0, k_pt, ns_pt * k_pt], default=np.nan)
    w["H"] = raw * fac

    out_keys = by + ["year", "month"]
    agg = w.groupby(out_keys, observed=True).agg(
        H=("H", "sum"), T_raw=(TERRA, "sum"), A_raw=(AQUA, "sum"), V_raw=(SNPP, "sum"),
        N20_raw=(NOAA20, "sum"), sensor_used=("sensor_used", "first")).reset_index()

    if n_boot > 0:
        kd = _draw_matrix(k_pt, k_idx, kappa, n_boot)
        fd = np.ones((len(w), n_boot))
        fd[is_t] = _draw_matrix(ta_pt, ta_idx, terra_aqua, n_boot)[is_t]
        fd[is_s] = kd[is_s]
        fd[is_n] = (_draw_matrix(ns_pt, ns_idx, n20_snpp, n_boot) * kd)[is_n]
        contrib = pd.DataFrame(raw[:, None] * fd)
        gsum = contrib.groupby([w[k] for k in out_keys], observed=True).sum()
        lo, hi = np.nanpercentile(gsum.to_numpy(), q, axis=1)
        bounds = pd.DataFrame({"H_lo": lo, "H_hi": hi}, index=gsum.index).reset_index()
        bounds.columns = out_keys + ["H_lo", "H_hi"]
        agg = agg.merge(bounds, on=out_keys, how="left")
        agg["H_lo"] = np.minimum(agg["H_lo"], agg["H"])
        agg["H_hi"] = np.maximum(agg["H_hi"], agg["H"])
    else:
        agg["H_lo"] = agg["H_hi"] = agg["H"]
    aqua_rows = agg["sensor_used"] == AQUA
    agg.loc[aqua_rows, "H_lo"] = agg.loc[aqua_rows, "H"]
    agg.loc[aqua_rows, "H_hi"] = agg.loc[aqua_rows, "H"]
    cols = out_keys + ["H", "H_lo", "H_hi", "A_raw", "T_raw", "V_raw", "N20_raw", "sensor_used"]
    return agg[cols].sort_values(out_keys).reset_index(drop=True)
