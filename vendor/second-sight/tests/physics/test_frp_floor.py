"""PHY-01 tests on SYNTHETIC FRP samples (not results)."""
import numpy as np
import pandas as pd
import pytest

from pipeline.physics.frp_floor import (
    frp_floor,
    frp_ratio_curve,
    log_grid,
    select_f_star,
    viirs_cell_overpass_frp,
)


def _synthetic(seed=0):
    """SYNTHETIC: both sensors see the same large fires (FRP ~ Pareto);
    VIIRS additionally sees many small fires < 10 MW that MODIS misses."""
    rng = np.random.default_rng(seed)
    big = 10.0 * (1 + rng.pareto(1.2, 4000))  # >= 10 MW, shared population
    small = rng.uniform(1.0, 10.0, 6000)  # VIIRS-only
    viirs = pd.DataFrame({"sum_frp": np.r_[big, small], "daynight": "D"})
    modis = pd.DataFrame({"frp": big, "A_pix": rng.uniform(1.0, 1.9, big.size), "daynight": "D"})
    # off-nadir MODIS pixels must be excluded
    off = pd.DataFrame({"frp": np.full(500, 50.0), "A_pix": 4.0, "daynight": "D"})
    return viirs, pd.concat([modis, off], ignore_index=True)


def test_log_grid():
    g = log_grid(1, 200, 5)
    assert g[0] == pytest.approx(1) and g[-1] == pytest.approx(200)
    assert np.allclose(np.diff(np.log(g)), np.log(200) / 4)


def test_select_f_star_rule():
    F = [1, 2, 4, 8, 16, 32]
    R = [3.0, 1.1, 1.3, 1.05, 0.95, 1.02]
    assert select_f_star(F, R, tol=0.15, k=2) == 8.0  # 2 fails stability
    assert select_f_star(F, [3] * 6, k=2) is None


def test_curve_and_f_star_synthetic():
    viirs, modis = _synthetic()
    res = frp_floor(viirs, modis, grid=log_grid(1, 200, 30), k=3, min_count=30)
    curve = res["curve"]
    low = curve[curve.F < 5]
    assert (low.R > 1.5).all()  # small-fire excess in VIIRS
    fs = res["f_star"]["D"]
    assert fs is not None and 5 < fs <= 12
    # off-nadir pixels excluded: at F just above 10 counts must match exactly
    row = curve.iloc[(curve.F - 15).abs().argmin()]
    assert row.n_viirs == row.n_modis


def test_none_when_never_converges():
    viirs = pd.DataFrame({"sum_frp": np.full(100, 50.0), "daynight": "N"})
    modis = pd.DataFrame({"frp": np.full(30, 50.0), "A_pix": 1.0, "daynight": "N"})
    res = frp_floor(viirs, modis, min_count=1)
    assert res["f_star"]["N"] is None


def test_viirs_aggregation():
    det = pd.DataFrame({"satellite": "SNPP", "acq_date": "2015-09-01", "acq_time": [600, 600, 1800],
                        "cell_id": ["c1", "c1", "c1"], "daynight": ["D", "D", "N"], "frp": [3.0, 4.0, 2.0]})
    agg = viirs_cell_overpass_frp(det)
    assert sorted(agg.sum_frp) == [2.0, 7.0]
    curve = frp_ratio_curve(agg, pd.DataFrame({"frp": [7.0], "A_pix": [1.0], "daynight": ["D"]}), grid=[5.0])
    assert curve.loc[curve.daynight == "D", "R"].item() == 1.0
    assert np.isnan(curve.loc[curve.daynight == "N", "R"].item())
