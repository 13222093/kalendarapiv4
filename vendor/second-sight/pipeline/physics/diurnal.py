"""PHY-03 - diurnal fire-activity model and predicted drift ratio (doc 09 U5).

Model (relative fire activity vs local solar time t, hours):

    f(t) = b + exp(-(t - h)^2 / (2 s^2))

* h : hour of peak activity
* s : width (hours)
* b : night-time / background floor relative to the peak amplitude

Default parameters are LITERATURE-BASED PLACEHOLDERS: Giglio (2007, RSE 108)
reports tropical fire activity peaking between ~13:00 and 18:30 LST, earlier
in dense forest. The exact values below are [UNVERIFIED] - they are a
reasonable mid-range choice, not numbers taken from a table in the paper.
They can be replaced by :func:`fit_diurnal_from_terra_aqua`, which fits the
observed Terra/Aqua detection ratio with a Gaussian prior centred on these
defaults.

The drift prediction is ``R_pred(t) = f(LST_Aqua(t)) / f(LST_VIIRS(t))``: if
Aqua's overpass drifts later (or earlier) while VIIRS stays at ~13:30, the
Aqua/VIIRS count ratio is expected to change by this factor for purely
physical (diurnal-sampling) reasons. VAL-05 compares it to the observed ratio.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize

__all__ = [
    "DiurnalParams",
    "DEFAULT_PARAMS",
    "DEFAULT_PRIOR_SD",
    "diurnal_f",
    "ratio_pred",
    "fit_diurnal_from_terra_aqua",
    "drift_ratio_series",
]


@dataclass(frozen=True)
class DiurnalParams:
    h: float  # peak hour (LST)
    s: float  # width (hours)
    b: float  # background floor (relative)
    source: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


#: [UNVERIFIED] placeholder: peak inside Giglio (2007) tropical 13:00-18:30
#: window, ~2.5 h width, small night floor. Replace with fitted values.
DEFAULT_PARAMS = DiurnalParams(
    h=14.5, s=2.5, b=0.05,
    source="placeholder inspired by Giglio 2007 (tropical peak 13:00-18:30 LST) [UNVERIFIED]",
)

#: Prior standard deviations for (h, s, b) used in fitting. [UNVERIFIED]
DEFAULT_PRIOR_SD = {"h": 1.5, "s": 1.0, "b": 0.05}


def diurnal_f(t, params: DiurnalParams = DEFAULT_PARAMS) -> np.ndarray:
    """Evaluate f(t). Uses the shortest circular distance to the peak so that
    t near midnight is handled (t in hours, any real number)."""
    t = np.asarray(t, dtype=float)
    d = np.mod(t - params.h + 12.0, 24.0) - 12.0
    return params.b + np.exp(-(d**2) / (2.0 * params.s**2))


def ratio_pred(t_num, t_den, params: DiurnalParams = DEFAULT_PARAMS) -> np.ndarray:
    """Predicted detection ratio f(t_num) / f(t_den)."""
    return diurnal_f(t_num, params) / diurnal_f(t_den, params)


def fit_diurnal_from_terra_aqua(
    lst_terra,
    lst_aqua,
    ratio_obs,
    prior: DiurnalParams = DEFAULT_PARAMS,
    prior_sd: dict | None = None,
    sigma_log_ratio: float = 0.2,
) -> DiurnalParams:
    """MAP fit of (h, s, b) to observed Terra/Aqua count ratios.

    Minimises
        sum_i [(log R_obs_i - log f(T_i)/f(A_i)) / sigma]^2
        + sum_p ((p - p_prior) / sd_p)^2
    with s >= 0.5 h and b >= 1e-3 (keeps f > 0). With only two overpass times the data
    constrain mainly one combination of parameters; the prior keeps the fit
    physically plausible.

    Parameters
    ----------
    lst_terra, lst_aqua : array-like
        Effective day overpass LST (from PHY-02) per period.
    ratio_obs : array-like
        Observed N_Terra / N_Aqua (same-cell, same-period; after any common
        detection-efficiency correction the caller deems necessary).
    """
    sd = {**DEFAULT_PRIOR_SD, **(prior_sd or {})}
    tt = np.asarray(lst_terra, float)
    ta = np.asarray(lst_aqua, float)
    lr = np.log(np.asarray(ratio_obs, float))
    m = np.isfinite(tt) & np.isfinite(ta) & np.isfinite(lr)
    tt, ta, lr = tt[m], ta[m], lr[m]
    if tt.size == 0:
        raise ValueError("no finite Terra/Aqua ratio observations to fit")
    x0 = np.array([prior.h, prior.s, prior.b])

    def obj(x):
        p = DiurnalParams(x[0], max(x[1], 0.5), max(x[2], 1e-3))
        resid = (lr - np.log(ratio_pred(tt, ta, p))) / sigma_log_ratio
        pen = ((x - x0) / np.array([sd["h"], sd["s"], sd["b"]])) ** 2
        return float(np.sum(resid**2) + np.sum(pen))

    res = minimize(obj, x0, method="L-BFGS-B",
                   bounds=[(prior.h - 6, prior.h + 6), (0.5, 8.0), (1e-3, 1.0)])
    h, s, b = res.x
    return DiurnalParams(float(h), float(s), float(b),
                         source=f"MAP fit to {tt.size} Terra/Aqua ratios, prior: {prior.source}")


def drift_ratio_series(
    overpass: pd.DataFrame,
    params: DiurnalParams = DEFAULT_PARAMS,
    num_sat: str = "Aqua",
    den_sat: str = "SNPP",
    daynight: str = "D",
) -> pd.DataFrame:
    """R_pred per month from a PHY-02 overpass table.

    ``overpass`` has ``satellite, month, daynight, lst_median``. Returns
    ``month, lst_num, lst_den, R_pred`` for months where both sensors exist.
    """
    o = overpass[overpass["daynight"] == daynight]
    a = o[o["satellite"] == num_sat][["month", "lst_median"]].rename(columns={"lst_median": "lst_num"})
    v = o[o["satellite"] == den_sat][["month", "lst_median"]].rename(columns={"lst_median": "lst_den"})
    out = a.merge(v, on="month", how="inner").sort_values("month").reset_index(drop=True)
    out["R_pred"] = ratio_pred(out["lst_num"].to_numpy(), out["lst_den"].to_numpy(), params)
    return out
