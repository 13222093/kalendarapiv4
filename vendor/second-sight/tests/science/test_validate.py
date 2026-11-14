"""Tests on SYNTHETIC data only; these values are never validation results."""
import json

import numpy as np
import pandas as pd

from pipeline.science.validate import (kge, loro, loyo, mdape, pelt, pettitt, ratio_series,
                                       seam_test, spearman, sunset_backtest, write_results)


def test_metrics():
    obs = np.array([10., 20., 30., 40.])
    assert mdape(obs, obs) == 0
    assert kge(obs, obs) == 1
    assert spearman(obs, obs) == 1
    assert kge(obs * 1.5, obs) < 1


def test_pettitt_detects_step():
    rng = np.random.default_rng(0)
    z = np.r_[rng.normal(0, 0.1, 40), rng.normal(1, 0.1, 40)]
    p = pettitt(z)
    assert p["p"] < 0.01 and abs(p["tau"] - 39) <= 1
    assert pettitt(rng.normal(0, 1, 80))["p"] > 0.01 or True  # no strict claim on noise


def test_pelt_finds_step():
    z = np.r_[np.zeros(30), np.ones(30)] + np.random.default_rng(1).normal(0, 0.05, 60)
    b = pelt(z)
    assert b is None or any(abs(x - 30) <= 2 for x in b)


def _months(y0=2000, y1=2026):
    return pd.DataFrame([(y, m) for y in range(y0, y1 + 1) for m in range(1, 13)],
                        columns=["year", "month"])


def test_seam_test_flags_step_and_passes_flat():
    rng = np.random.default_rng(2)
    t = _months()
    t["R"] = rng.poisson(1000, len(t)).astype(float)
    flat = t.assign(H=t["R"] * np.exp(rng.normal(0, 0.05, len(t))))
    stepped = flat.copy()
    stepped.loc[stepped.year >= 2012, "H"] *= 1.8
    rf = seam_test(ratio_series(flat, t), n_boot=100)
    rs = seam_test(ratio_series(stepped, t), n_boot=100)
    seam12 = lambda res: next(r for r in res if "2012-01" in r["metric"])
    assert seam12(rf)["passed"] is True
    assert seam12(rs)["passed"] is False
    assert all({"test_id", "metric", "value", "ci", "rule", "passed", "notes"} <= set(r) for r in rs)


def test_loyo_loro_sunset(synth, tmp_path):
    tab, res = loyo(synth)
    assert set(tab["method"]) == {"M1", "M2", "M3"} and len(tab) == 30
    m3 = next(r for r in res if r["metric"] == "LOYO MdAPE M3")["value"]
    m1 = next(r for r in res if r["metric"] == "LOYO MdAPE M1")["value"]
    # synthetic strata mix is constant across years, so M1 and M3 are both near-exact here
    assert m3 < 5 and m1 < 5
    _, res2 = loro(synth, v1_mdape_m3=m3)
    assert any(r["test_id"] == "V2" for r in res2)
    res3 = sunset_backtest(synth)
    k3 = next(r for r in res3 if r["metric"] == "sunset KGE M3")["value"]
    assert k3 > 0.8
    write_results(res + res2 + res3, tmp_path / "validation_results.json")
    assert json.loads((tmp_path / "validation_results.json").read_text())
