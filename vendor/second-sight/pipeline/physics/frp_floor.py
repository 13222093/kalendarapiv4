"""PHY-01 - FRP floor curve R(F) and selection of the common threshold F*.

Idea (doc 08 P5, doc 09 S6): above some fire radiative power F both MODIS and
VIIRS detect essentially every fire, so the count of "large" fires should be
sensor-independent. We compare

    R(F) = N_VIIRS(cell sum FRP >= F) / N_MODIS(pixel FRP >= F)

on a log grid of F (default 1-200 MW), separately for day and night, over the
overlap period (2012-2021, filtered by the caller).

* VIIRS: sum FRP of all 375 m detections falling in one ~1 km cell during one
  overpass (so a VIIRS "event" is comparable to one ~1 km MODIS pixel).
* MODIS: single-pixel FRP, restricted to near-nadir pixels
  (``A_pix <= a_pix_max``, ~ scan angle <= 40 deg) to avoid the strong
  off-nadir pixel growth.

F* is the smallest grid value where |R(F) - 1| < tol for that point AND the
following ``k`` grid points (stability). If none satisfies the rule, F* is
``None`` and that must be recorded; TRI-01 is then postponed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

__all__ = [
    "MODIS_APIX_MAX_KM2",
    "log_grid",
    "modis_near_nadir",
    "viirs_cell_overpass_frp",
    "frp_ratio_curve",
    "select_f_star",
    "frp_floor",
]

#: MODIS pixel area at ~40 deg scan angle is roughly 1.7-2 km^2 (1 km^2 at
#: nadir). Default threshold; [UNVERIFIED] - check against the MODIS
#: along/along-scan pixel-size formula before final numbers.
MODIS_APIX_MAX_KM2 = 2.0


def log_grid(f_min: float = 1.0, f_max: float = 200.0, n: int = 40) -> np.ndarray:
    """Logarithmically spaced FRP thresholds in MW."""
    return np.geomspace(f_min, f_max, n)


def modis_near_nadir(modis: pd.DataFrame, a_pix_max: float = MODIS_APIX_MAX_KM2,
                     a_pix_col: str = "A_pix") -> pd.DataFrame:
    """Keep MODIS detections with pixel area <= ``a_pix_max`` (km^2)."""
    return modis[modis[a_pix_col] <= a_pix_max]


def viirs_cell_overpass_frp(
    viirs: pd.DataFrame,
    overpass_cols=("satellite", "acq_date", "acq_time"),
    cell_col: str = "cell_id",
    frp_col: str = "frp",
) -> pd.DataFrame:
    """Aggregate VIIRS detections to sum FRP per (cell, overpass, daynight).

    ``overpass_cols`` identifies one overpass (granule time). Only columns that
    exist are used, so a daily table works too (coarser, slightly biased up).
    Returns columns ``[*keys, 'sum_frp']``.
    """
    keys = [c for c in overpass_cols if c in viirs.columns] + [cell_col, "daynight"]
    return viirs.groupby(keys, as_index=False)[frp_col].sum().rename(columns={frp_col: "sum_frp"})


def _exceed_counts(values: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """Number of values >= each grid threshold (vectorised)."""
    v = np.sort(np.asarray(values, dtype=float)[np.isfinite(values)])
    return v.size - np.searchsorted(v, grid, side="left")


def frp_ratio_curve(
    viirs_cell_frp: pd.DataFrame,
    modis_pixels: pd.DataFrame,
    grid: np.ndarray | None = None,
    a_pix_max: float = MODIS_APIX_MAX_KM2,
    viirs_frp_col: str = "sum_frp",
    modis_frp_col: str = "frp",
) -> pd.DataFrame:
    """Compute R(F) per daynight.

    Parameters
    ----------
    viirs_cell_frp : DataFrame
        One row per VIIRS (cell, overpass) with ``sum_frp`` and ``daynight``
        (see :func:`viirs_cell_overpass_frp`).
    modis_pixels : DataFrame
        MODIS detections with ``frp``, ``A_pix`` and ``daynight``.
    grid : array, optional
        FRP thresholds in MW; default :func:`log_grid`.

    Returns
    -------
    DataFrame ``daynight, F, n_viirs, n_modis, R`` (R is NaN when n_modis = 0).
    """
    grid = log_grid() if grid is None else np.asarray(grid, dtype=float)
    modis = modis_near_nadir(modis_pixels, a_pix_max)
    out = []
    dns = sorted(set(viirs_cell_frp["daynight"]).union(set(modis["daynight"])))
    for dn in dns:
        nv = _exceed_counts(viirs_cell_frp.loc[viirs_cell_frp["daynight"] == dn, viirs_frp_col].to_numpy(), grid)
        nm = _exceed_counts(modis.loc[modis["daynight"] == dn, modis_frp_col].to_numpy(), grid)
        with np.errstate(divide="ignore", invalid="ignore"):
            r = np.where(nm > 0, nv / np.where(nm > 0, nm, 1), np.nan)
        out.append(pd.DataFrame({"daynight": dn, "F": grid, "n_viirs": nv, "n_modis": nm, "R": r}))
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame(
        columns=["daynight", "F", "n_viirs", "n_modis", "R"])


def select_f_star(F, R, tol: float = 0.15, k: int = 3, min_count=None, n_modis=None) -> float | None:
    """Smallest F with ``|R(F) - 1| < tol`` holding for it and the next ``k``
    grid points. Points whose MODIS count is below ``min_count`` (if given)
    are treated as failing. Returns ``None`` if no F qualifies.
    """
    F = np.asarray(F, dtype=float)
    R = np.asarray(R, dtype=float)
    ok = np.isfinite(R) & (np.abs(R - 1.0) < tol)
    if min_count is not None and n_modis is not None:
        ok &= np.asarray(n_modis) >= min_count
    for i in range(len(F) - k):
        if ok[i : i + k + 1].all():
            return float(F[i])
    return None


def frp_floor(
    viirs_cell_frp: pd.DataFrame,
    modis_pixels: pd.DataFrame,
    grid: np.ndarray | None = None,
    a_pix_max: float = MODIS_APIX_MAX_KM2,
    tol: float = 0.15,
    k: int = 3,
    min_count: int = 30,
) -> dict:
    """Full PHY-01: curve plus F* per daynight.

    Returns ``{"curve": DataFrame, "f_star": {daynight: float|None},
    "params": {...}}``; ``f_star`` with ``params`` is what goes into
    ``physics/f_star.json``. ``min_count`` guards against ratios from a handful
    of very large fires at the top of the grid.
    """
    curve = frp_ratio_curve(viirs_cell_frp, modis_pixels, grid, a_pix_max)
    f_star = {}
    for dn, g in curve.groupby("daynight"):
        f_star[dn] = select_f_star(g["F"], g["R"], tol, k, min_count, g["n_modis"])
    return {
        "curve": curve,
        "f_star": f_star,
        "params": {"tol": tol, "k": k, "min_count": min_count, "a_pix_max_km2": a_pix_max},
    }
