"""Tests on SYNTHETIC data only."""
import numpy as np

from pipeline.science.chain import chain_factors, noaa20_to_snpp, terra_to_aqua


def test_terra_to_aqua_recovers_ratio(synth):
    fit = terra_to_aqua(synth, n_boot=100)
    assert np.allclose(fit.table["r"], 1.25, rtol=0.15)
    assert abs(fit.meta["pooled_ratio"] - 1.25) < 0.03
    assert (fit.table["r_lo"] <= fit.table["r"]).all()
    assert set(fit.meta["years"]) == {2002, 2003, 2004, 2005}


def test_noaa20_to_snpp_near_one(synth):
    fit = noaa20_to_snpp(synth, n_boot=100)
    assert np.allclose(fit.table["r"], 1.0, rtol=0.05)
    assert (fit.table["sd_log"] > 0).all()


def test_chain_factors_dict(synth, tmp_path):
    d = chain_factors(synth, path=tmp_path / "chain_factors.json", n_boot=20)
    assert {"terra_to_aqua", "noaa20_to_snpp"} <= set(d)
    assert (tmp_path / "chain_factors.json").exists()
