"""TRI-01..03 - triangulation of three fire-activity series (doc 09 U3).

Three series with different (and largely independent) failure modes:

* ``H``        - calibrated harmonised detection count (owned by
                 ``pipeline/science``; taken here as an input column).
* ``H_large``  - TRI-01: number of cell-days with sum FRP >= F* (PHY-01). No
                 calibration: above F* both sensors detect (almost) everything.
* ``H_energy`` - TRI-02: monthly sum FRP ("fire radiative energy proxy" -
                 label in UI as *energi radiatif api*, NOT carbon/emissions),
                 with a light per-satellite energy-ratio calibration fitted on
                 the overlap 2012-2021.

TRI-03 converts each series to a percentile against its own baseline (same
AOI and calendar month) and to an anomaly class; agreement is
A = all three in the same class, B = exactly two agree, C = all differ.

Input schema: ``daily_cell`` from ``pipeline/data`` with columns
``local_date, cell_id, satellite, daynight, n_det, sum_frp, max_frp,
mean_A_pix, island_region``.
"""
from __future__ import annotations

from typing import Callable, Mapping

import numpy as np
import pandas as pd

__all__ = [
    "h_large",
    "energy_calibration_factors",
    "h_energy",
    "empirical_percentile",
    "baseline_percentiles",
    "anomaly_class",
    "agreement",
    "agreement_table",
]


def _prep(daily_cell: pd.DataFrame, aoi_col: str, cell_to_aoi: Mapping | None) -> pd.DataFrame:
    df = daily_cell.copy()
    if cell_to_aoi is not None:
        df["aoi"] = df["cell_id"].map(cell_to_aoi)
        df = df[df["aoi"].notna()]
    else:
        df["aoi"] = df[aoi_col]
    df["month"] = pd.to_datetime(df["local_date"]).dt.to_period("M").dt.to_timestamp()
    return df


# --------------------------------------------------------------------------- TRI-01
def h_large(
    daily_cell: pd.DataFrame,
    f_star: float | Mapping[str, float],
    aoi_col: str = "island_region",
    cell_to_aoi: Mapping | None = None,
    satellites: list[str] | None = None,
    frp_col: str = "sum_frp",
) -> pd.DataFrame:
    """TRI-01: cell-days with sum FRP >= F* per AOI-month.

    ``f_star`` is a scalar or ``{"D": F_day, "N": F_night}`` (keys matching
    ``daynight``; a missing key or ``None`` value excludes those rows). A
    cell-day counts once if ANY row (satellite x daynight) passes. Pass
    ``satellites`` to keep a constant constellation (e.g. ``["Aqua"]``) - the
    number of overpasses per day grows when S-NPP/NOAA-20 join, which slightly
    raises the chance of catching a large fire.

    Returns ``aoi, month, H_large``.
    """
    df = _prep(daily_cell, aoi_col, cell_to_aoi)
    if satellites is not None:
        df = df[df["satellite"].isin(satellites)]
    if isinstance(f_star, Mapping):
        thr = df["daynight"].map(lambda d: f_star.get(d)).astype(float)
    else:
        thr = pd.Series(float(f_star), index=df.index)
    hit = df[thr.notna() & (df[frp_col] >= thr)]
    out = (
        hit.drop_duplicates(["cell_id", "local_date"])
        .groupby(["aoi", "month"]).size().rename("H_large").reset_index()
    )
    # make months with zero large fires explicit
    full = df[["aoi", "month"]].drop_duplicates()
    out = full.merge(out, on=["aoi", "month"], how="left").fillna({"H_large": 0})
    out["H_large"] = out["H_large"].astype(int)
    return out.sort_values(["aoi", "month"]).reset_index(drop=True)


# --------------------------------------------------------------------------- TRI-02
def energy_calibration_factors(
    daily_cell: pd.DataFrame,
    reference: str = "Aqua",
    overlap_years: tuple[int, int] = (2012, 2021),
    frp_col: str = "sum_frp",
) -> dict[str, float]:
    """Light energy-ratio calibration: ``c_s = sum FRP_ref / sum FRP_s`` over
    months in ``overlap_years`` where both ``reference`` and ``s`` have data.
    ``c_ref = 1``. Satellites without overlap get NaN."""
    df = daily_cell.copy()
    df["month"] = pd.to_datetime(df["local_date"]).dt.to_period("M").dt.to_timestamp()
    y = df["month"].dt.year
    df = df[(y >= overlap_years[0]) & (y <= overlap_years[1])]
    m = df.groupby(["satellite", "month"])[frp_col].sum().unstack("satellite")
    factors: dict[str, float] = {}
    for sat in sorted(set(daily_cell["satellite"])):
        if sat == reference:
            factors[sat] = 1.0
            continue
        if reference not in m or sat not in m:
            factors[sat] = float("nan")
            continue
        both = m[[reference, sat]].dropna()
        den = both[sat].sum()
        factors[sat] = float(both[reference].sum() / den) if den > 0 else float("nan")
    return factors


def h_energy(
    daily_cell: pd.DataFrame,
    factors: Mapping[str, float] | None = None,
    aoi_col: str = "island_region",
    cell_to_aoi: Mapping | None = None,
    frp_col: str = "sum_frp",
    **calib_kwargs,
) -> pd.DataFrame:
    """TRI-02: monthly sum FRP per AOI in reference-satellite units.

    ``H_energy(aoi, month) = mean_s [ c_s * sum FRP_s(aoi, month) ]`` over the
    satellites with a finite factor that observed anything in that month
    (mean, not sum, so adding satellites does not inflate the series).
    Unit: MW summed over detections (an energy proxy - NOT carbon).

    Returns ``aoi, month, H_energy``.
    """
    if factors is None:
        factors = energy_calibration_factors(daily_cell, frp_col=frp_col, **calib_kwargs)
    df = _prep(daily_cell, aoi_col, cell_to_aoi)
    per_sat = df.groupby(["aoi", "month", "satellite"])[frp_col].sum().reset_index()
    per_sat["c"] = per_sat["satellite"].map(factors).astype(float)
    per_sat = per_sat[np.isfinite(per_sat["c"])]
    per_sat["e"] = per_sat[frp_col] * per_sat["c"]
    out = per_sat.groupby(["aoi", "month"])["e"].mean().rename("H_energy").reset_index()
    return out.sort_values(["aoi", "month"]).reset_index(drop=True)


# --------------------------------------------------------------------------- TRI-03
def empirical_percentile(value: float, reference) -> float:
    """Minimal empirical percentile (0-100) of ``value`` in ``reference``
    using the mid-rank convention ``100 * (n_below + 0.5 * n_equal) / n``.
    NaN if the reference is empty or value is NaN."""
    ref = np.asarray(reference, dtype=float)
    ref = ref[np.isfinite(ref)]
    if ref.size == 0 or not np.isfinite(value):
        return float("nan")
    return float(100.0 * ((ref < value).sum() + 0.5 * (ref == value).sum()) / ref.size)


def baseline_percentiles(
    monthly: pd.DataFrame,
    col: str,
    baseline_years: tuple[int, int] = (2003, 2022),
    percentile_fn: Callable[[float, np.ndarray], float] = empirical_percentile,
) -> pd.Series:
    """Percentile of ``monthly[col]`` against the same AOI and calendar month
    in ``baseline_years``. ``monthly`` needs ``aoi, month``. A baseline value
    is compared with the other baseline years only (leave-self-out), so
    in-baseline percentiles are not biased toward the middle."""
    mon = pd.to_datetime(monthly["month"])
    cal = mon.dt.month
    yr = mon.dt.year
    in_base = (yr >= baseline_years[0]) & (yr <= baseline_years[1])
    out = pd.Series(np.nan, index=monthly.index, name=f"{col}_pct")
    for (_, _), idx in monthly.groupby([monthly["aoi"], cal]).groups.items():
        base_idx = [i for i in idx if in_base.loc[i]]
        for i in idx:
            ref = monthly.loc[[j for j in base_idx if j != i], col].to_numpy()
            out.loc[i] = percentile_fn(monthly.loc[i, col], ref)
    return out


def anomaly_class(pct, low: float = 10.0, high: float = 90.0) -> pd.Series:
    """Map percentiles to ``'low'`` (< low), ``'high'`` (> high), ``'normal'``;
    NaN stays missing."""
    p = pd.Series(pct, dtype=float)
    cls = np.where(p > high, "high", np.where(p < low, "low", "normal"))
    return pd.Series(cls, index=p.index, dtype=object).where(p.notna(), None)


def agreement(c1, c2, c3) -> str | None:
    """A = all three classes equal, B = exactly two equal, C = all differ.
    ``None`` if any class is missing (not enough information)."""
    cs = [c1, c2, c3]
    if any(c is None or (isinstance(c, float) and np.isnan(c)) for c in cs):
        return None
    n = len(set(cs))
    return {1: "A", 2: "B", 3: "C"}[n]


def agreement_table(
    monthly: pd.DataFrame,
    series=("H", "H_large", "H_energy"),
    baseline_years: tuple[int, int] = (2003, 2022),
    low: float = 10.0,
    high: float = 90.0,
    percentile_fn: Callable[[float, np.ndarray], float] = empirical_percentile,
) -> pd.DataFrame:
    """Add ``<s>_pct``, ``<s>_class`` for each series and ``agreement``.

    ``monthly`` is the ``monthly_aoi``-like table with ``aoi, month`` and the
    three series columns (merge the outputs of :func:`h_large`,
    :func:`h_energy` and the science-layer ``H`` first). ``percentile_fn`` lets
    the caller plug in the ANO-01 baseline percentile.
    """
    out = monthly.copy()
    for s in series:
        out[f"{s}_pct"] = baseline_percentiles(out, s, baseline_years, percentile_fn)
        out[f"{s}_class"] = anomaly_class(out[f"{s}_pct"], low, high)
    cls = out[[f"{s}_class" for s in series]].to_numpy()
    out["agreement"] = [agreement(*row) for row in cls]
    return out
