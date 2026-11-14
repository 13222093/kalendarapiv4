"""Tests on SYNTHETIC data only."""
import json

import numpy as np

from pipeline.science.calibrate import eb_kappa, fit_kappa, fit_simple_ratio, apply_kappa
from conftest import true_kappa


def test_fit_kappa_recovers_truth(synth):
    fit = fit_kappa(synth, n_boot=200)
    t = fit.table
    truth = t.apply(lambda r: true_kappa(r.island_region, r.season, r.daynight, r.is_peat), axis=1)
    rel = np.abs(t["kappa"] / truth - 1)
    assert rel.max() < 0.08
    assert t["plausible"].all()
    assert (t["kappa_lo"] <= t["kappa"]).all() and (t["kappa"] <= t["kappa_hi"]).all()
    # true value inside interval for the large majority of strata
    assert ((truth >= t["kappa_lo"]) & (truth <= t["kappa_hi"])).mean() > 0.7
    assert fit.draws.shape == (200, len(t))
    assert set(fit.meta["years"]) == set(range(2012, 2022))


def test_bootstrap_is_seeded(synth):
    a = fit_kappa(synth, n_boot=50, seed=3).table["kappa_lo"]
    b = fit_kappa(synth, n_boot=50, seed=3).table["kappa_lo"]
    assert np.allclose(a, b)


def test_shrinkage_small_stratum_pulled_to_parent():
    # parent with 3 big strata at 0.3 and one tiny stratum with an extreme raw ratio
    A = np.array([3000., 3100., 2900., 3.])
    V = np.array([10000., 10000., 10000., 4.])
    est = eb_kappa(A, V, np.zeros(4, int), np.zeros(4, int))
    assert abs(est["kappa"][3] - 0.3) < 0.1        # raw 0.75 shrunk toward 0.3
    assert est["shrink_weight"][3] < est["shrink_weight"][0]
    assert np.all(np.isfinite(est["kappa"]))


def test_empty_stratum_gets_prior_mean():
    A = np.array([300., 330., 0.])
    V = np.array([1000., 1000., 0.])
    est = eb_kappa(A, V, np.zeros(3, int), np.zeros(3, int))
    assert abs(est["kappa"][2] - 0.315) < 0.02


def test_json_roundtrip(synth, tmp_path):
    fit = fit_kappa(synth, n_boot=20)
    p = tmp_path / "strata_factors.json"
    fit.write_json(p)
    d = json.loads(p.read_text())
    assert len(d["strata"]) == len(fit.table)
    assert {"kappa", "kappa_lo", "kappa_hi", "shrink_weight", "a", "b"} <= set(d["strata"][0])


def test_simple_ratio_and_apply(synth):
    m1 = fit_simple_ratio(synth)
    assert 0.1 < m1.table["kappa"].iloc[0] < 0.4
    v = synth[(synth.satellite == "SNPP") & (synth.year == 2022)]
    assert (apply_kappa(v, m1) <= v["cell_days"]).all()


def test_standardize_monthly_adapter():
    import datetime as dt
    import pandas as pd
    from pipeline.science.common import standardize_monthly
    raw = pd.DataFrame({"month": [dt.date(2015, 9, 1), dt.date(2015, 1, 1)],
                        "island_region": ["Sumatra"] * 2, "season": ["dry", "wet"],
                        "daynight": ["D", "N"], "peat": ["unknown", "peat"],
                        "satellite": ["N", "Aqua"], "n_cells": [5, 7], "sum_frp": [1.0, 2.0]})
    d = standardize_monthly(raw)
    assert list(d.year) == [2015, 2015] and list(d.month) == [9, 1]
    assert list(d.cell_days) == [5, 7] and list(d.satellite) == ["SNPP", "Aqua"]
    assert list(d.is_peat) == [False, True] and list(d.peat_known) == [False, True]
    assert list(d.season) == ["dry", "wet"]
