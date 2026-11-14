"""CAL-06 (U1 / M4): FRP-conditioned dynamic kappa via a negative-binomial GLM.

    log E[A_{s,t}] = log V_{s,t} + log kappa_s^{M3} + beta0 + beta1 * logit(phi_t) + beta2 * eta_t

The stratum effect beta0_s is taken from the M3 empirical-Bayes factor (an offset), which
gives the shrinkage asked for in 09 U1 without extra parameters; beta0 recentres it.
phi_t = share of VIIRS cell-days with sum FRP >= F*, eta_t = share of night VIIRS cell-days,
both per (year, month, island_region) and computed from VIIRS only (usable after MODIS ends).
NB dispersion alpha: Cameron-Trivedi auxiliary regression on a Poisson fit.
Interval: year-block bootstrap with refit of kappa_s^{M3} and the GLM.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import statsmodels.api as sm

from .calibrate import CAL_YEARS, fit_kappa
from .common import AQUA, SEED, SNPP, STRATUM_KEYS, normalize_satellite
from .validate import result

COV_KEYS = ["year", "month", "island_region"]
PHI_CLIP = 0.005


def frp_covariates(daily_cell: pd.DataFrame, f_star: float, satellite: str = SNPP,
                   date_col: str = "local_date") -> pd.DataFrame:
    """phi (share of cell-days with sum_frp >= F*) and eta (night share) per year-month-region."""
    d = daily_cell.copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    d = d[d["satellite"] == satellite]
    if "year" not in d or "month" not in d:
        dt = pd.to_datetime(d[date_col])
        d["year"], d["month"] = dt.dt.year, dt.dt.month
    d["_large"] = d["sum_frp"] >= f_star
    d["_night"] = d["daynight"].astype(str).str.upper().str.startswith("N")
    g = d.groupby(COV_KEYS, observed=True)
    return g.agg(phi=("_large", "mean"), eta=("_night", "mean"), n_cells=("_large", "size")).reset_index()


def _logit(p):
    p = np.clip(np.asarray(p, float), PHI_CLIP, 1 - PHI_CLIP)
    return np.log(p / (1 - p))


def _design(ms: pd.DataFrame, cov: pd.DataFrame, kappa_tab: pd.DataFrame, years) -> pd.DataFrame:
    d = ms[ms["year"].isin(list(years))].copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    w = d.pivot_table(index=STRATUM_KEYS + ["year", "month"], columns="satellite",
                      values="cell_days", aggfunc="sum", fill_value=0, observed=True).reset_index()
    for s in (AQUA, SNPP):
        if s not in w:
            w[s] = 0
    w = w[w[SNPP] > 0]
    w = w.merge(cov[COV_KEYS + ["phi", "eta"]], on=COV_KEYS, how="inner")
    w = w.merge(kappa_tab[STRATUM_KEYS + ["kappa"]], on=STRATUM_KEYS, how="left")
    w["logit_phi"] = _logit(w["phi"])
    w["offset"] = np.log(w[SNPP]) + np.log(w["kappa"])
    return w.dropna(subset=["offset", "logit_phi", "eta"])


def _fit_glm(w: pd.DataFrame):
    X = sm.add_constant(w[["logit_phi", "eta"]].to_numpy(float), has_constant="add")
    y = w[AQUA].to_numpy(float)
    off = w["offset"].to_numpy(float)
    pois = sm.GLM(y, X, family=sm.families.Poisson(), offset=off).fit()
    mu = pois.mu
    aux = ((y - mu) ** 2 - y) / mu
    alpha = float(max(np.sum(aux * mu) / np.sum(mu ** 2), 1e-8))
    nb = sm.GLM(y, X, family=sm.families.NegativeBinomial(alpha=alpha), offset=off).fit()
    return nb.params, alpha


@dataclass
class DynamicKappaFit:
    params: np.ndarray                     # beta0, beta1, beta2
    alpha: float
    kappa_static: pd.DataFrame             # M3 table used as offset
    param_draws: np.ndarray | None = None  # (n_boot, 3)
    meta: dict = field(default_factory=dict)

    def kappa(self, rows: pd.DataFrame, params: np.ndarray | None = None) -> np.ndarray:
        """kappa(s,t) for rows with stratum keys + phi + eta."""
        b = self.params if params is None else params
        k = rows[STRATUM_KEYS].merge(self.kappa_static[STRATUM_KEYS + ["kappa"]],
                                     on=STRATUM_KEYS, how="left")["kappa"].to_numpy()
        return k * np.exp(b[0] + b[1] * _logit(rows["phi"]) + b[2] * rows["eta"].to_numpy(float))

    def coefficient_results(self) -> list[dict]:
        out = []
        for i, name in ((1, "beta1 (logit phi)"), (2, "beta2 (eta)")):
            ci = (np.percentile(self.param_draws[:, i], [5, 95])
                  if self.param_draws is not None else None)
            passed = (bool(ci[0] > 0) if (i == 1 and ci is not None) else None)
            out.append(result("V15", name, float(self.params[i]),
                              "beta1: 90% CI > 0 (H4); beta2: reported", passed, ci=ci,
                              notes=f"alpha={self.alpha:.4g}; n_boot={self.meta.get('n_boot')}"))
        return out


def m4_method(cov: pd.DataFrame, n_boot: int = 0):
    """Method callable for validate.loyo / sunset_backtest: fn(df, years) -> fit with covariates."""
    def _fn(df, years):
        fit = fit_dynamic_kappa(df, cov, years=years, n_boot=n_boot)
        fit.covariates = cov
        return fit
    return _fn


def fit_dynamic_kappa(ms: pd.DataFrame, cov: pd.DataFrame, years=CAL_YEARS, n_boot: int = 200,
                      seed: int = SEED) -> DynamicKappaFit:
    years = tuple(years)
    k_tab = fit_kappa(ms, years=years, n_boot=0).table
    w = _design(ms, cov, k_tab, years)
    params, alpha = _fit_glm(w)
    draws = None
    if n_boot:
        rng = np.random.default_rng(seed)
        yrs = np.array(sorted(years))
        draws = np.full((n_boot, 3), np.nan)
        for i in range(n_boot):
            pick = rng.choice(yrs, len(yrs), replace=True)
            # replicate the chosen years (each copy keeps its own rows)
            parts = [ms[ms["year"] == y].assign(year=1_000_000 + j) for j, y in enumerate(pick)]
            cparts = [cov[cov["year"] == y].assign(year=1_000_000 + j) for j, y in enumerate(pick)]
            msb, covb = pd.concat(parts), pd.concat(cparts)
            new_years = tuple(range(1_000_000, 1_000_000 + len(pick)))
            try:
                kb = fit_kappa(msb, years=new_years, n_boot=0).table
                draws[i] = _fit_glm(_design(msb, covb, kb, new_years))[0]
            except Exception:  # noqa: BLE001 - degenerate resample, leave NaN
                pass
        draws = draws[np.isfinite(draws).all(1)]
    return DynamicKappaFit(params=np.asarray(params), alpha=alpha, kappa_static=k_tab,
                           param_draws=draws,
                           meta={"method": "M4 NB-GLM, offset log V + log kappa_M3",
                                 "years": list(years), "n_boot": int(n_boot), "seed": seed})
