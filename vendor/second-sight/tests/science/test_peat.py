"""Tests on SYNTHETIC data only (synthetic truth: peat and night have lower kappa = higher rho)."""
import pandas as pd

from pipeline.science.peat import peat_hypotheses


def test_peat_hypotheses_synthetic(synth):
    cls = pd.DataFrame({"year": range(2012, 2022),
                        "enso_class": ["el_nino" if y in (2015, 2019) else "neutral"
                                       for y in range(2012, 2022)]})
    res = peat_hypotheses(synth, cls, n_boot=200)
    by = {r["metric"]: r for r in res}
    assert by["H1 decision"]["passed"] is True
    assert by["H2 log rho_night - log rho_day (peat)"]["passed"] is True
    h3 = by["H3 log rho_ElNino - log rho_other (peat)"]
    assert h3["ci"][0] < 0 < h3["ci"][1] or h3["passed"] is False  # no El Nino effect in synthetic truth
