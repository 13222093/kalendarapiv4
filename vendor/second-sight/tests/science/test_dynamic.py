"""Tests on SYNTHETIC data only: kappa depends on phi with a known beta1 = 0.4."""
import numpy as np
import pandas as pd

from pipeline.science.dynamic import _logit, fit_dynamic_kappa, frp_covariates
from conftest import make_monthly_stratum, true_kappa

BETA1 = 0.4


def _synthetic_with_phi(seed=5):
    rng = np.random.default_rng(seed)
    cov = pd.DataFrame([(y, m, r) for y in range(2012, 2022) for m in range(1, 13)
                        for r in ("Sumatra", "Kalimantan", "Sulawesi")],
                       columns=["year", "month", "island_region"])
    cov["phi"] = rng.uniform(0.05, 0.5, len(cov))
    cov["eta"] = rng.uniform(0.1, 0.4, len(cov))
    mean_lp = _logit(cov["phi"]).mean()
    eff = dict(zip(zip(cov.year, cov.month, cov.island_region),
                   np.exp(BETA1 * (_logit(cov["phi"]) - mean_lp))))
    ms = make_monthly_stratum(seed=seed, years=range(2012, 2022))
    a = ms.satellite == "Aqua"
    v = ms[ms.satellite == "SNPP"].set_index(["year", "month", "island_region", "season",
                                               "daynight", "is_peat"])["cell_days"]
    keys = list(zip(ms.year, ms.month, ms.island_region, ms.season, ms.daynight, ms.is_peat))
    lam = [v.get(k, 0) * true_kappa(*k[2:]) * eff[k[:3]] for k in keys]
    ms.loc[a, "cell_days"] = rng.poisson(np.array(lam)[a.to_numpy()])
    return ms, cov


def test_beta1_recovered():
    ms, cov = _synthetic_with_phi()
    fit = fit_dynamic_kappa(ms, cov, n_boot=30)
    assert abs(fit.params[1] - BETA1) < 0.1
    assert abs(fit.params[2]) < 0.5
    res = fit.coefficient_results()
    assert res[0]["passed"] is True and res[0]["ci"][0] > 0
    rows = ms[ms.satellite == "SNPP"].merge(cov, on=["year", "month", "island_region"])
    k = fit.kappa(rows)
    assert np.all((k > 0) & (k < 1))


def test_m4_runs_in_loyo():
    from pipeline.science.dynamic import m4_method
    from pipeline.science.validate import METHODS, loyo
    ms, cov = _synthetic_with_phi()
    methods = {"M3": METHODS["M3"], "M4": m4_method(cov)}
    tab, res = loyo(ms, methods)
    assert set(tab.method) == {"M3", "M4"}
    assert any(r["metric"] == "M4 adoption" for r in res)


def test_frp_covariates():
    dc = pd.DataFrame({"local_date": ["2015-09-01"] * 4, "satellite": ["N"] * 4,
                       "daynight": ["D", "D", "N", "N"], "sum_frp": [1.0, 50.0, 2.0, 80.0],
                       "island_region": ["Sumatra"] * 4})
    c = frp_covariates(dc, f_star=10)
    assert c.loc[0, "phi"] == 0.5 and c.loc[0, "eta"] == 0.5
