"""PHY-03 tests on SYNTHETIC overpass times / ratios (not results)."""
import numpy as np
import pandas as pd
import pytest

from pipeline.physics.diurnal import (
    DEFAULT_PARAMS,
    DiurnalParams,
    diurnal_f,
    drift_ratio_series,
    fit_diurnal_from_terra_aqua,
    ratio_pred,
)


def test_f_peak_and_floor():
    p = DiurnalParams(15.0, 2.0, 0.1)
    assert diurnal_f(15.0, p) == pytest.approx(1.1)
    assert diurnal_f(3.0, p) == pytest.approx(0.1, abs=1e-6)
    assert diurnal_f(13.0, p) == pytest.approx(diurnal_f(17.0, p))  # symmetric
    assert diurnal_f(15.0 + 24, p) == pytest.approx(1.1)  # circular


def test_ratio_identity_and_direction():
    assert ratio_pred(13.5, 13.5) == pytest.approx(1.0)
    # Aqua drifting later toward the peak (14.5) -> more detections than VIIRS at 13.5
    assert ratio_pred(14.3, 13.5) > 1.0
    assert "UNVERIFIED" in DEFAULT_PARAMS.source


def test_fit_recovers_shift_toward_truth():
    # SYNTHETIC: truth peak at 16.0; observations generated without noise.
    truth = DiurnalParams(16.0, 2.5, 0.05)
    tt = np.full(20, 10.5)
    ta = np.full(20, 13.5)
    r = ratio_pred(tt, ta, truth)
    fit = fit_diurnal_from_terra_aqua(tt, ta, r)
    err_fit = abs(np.log(ratio_pred(10.5, 13.5, fit)) - np.log(r[0]))
    err_prior = abs(np.log(ratio_pred(10.5, 13.5, DEFAULT_PARAMS)) - np.log(r[0]))
    assert err_fit < err_prior


def test_fit_raises_on_empty():
    with pytest.raises(ValueError):
        fit_diurnal_from_terra_aqua([np.nan], [13.5], [1.0])


def test_drift_series():
    ov = pd.DataFrame({
        "satellite": ["Aqua", "Aqua", "SNPP", "SNPP", "Terra"],
        "month": pd.to_datetime(["2022-01-01", "2023-01-01", "2022-01-01", "2023-01-01", "2022-01-01"]),
        "daynight": "D",
        "lst_median": [13.6, 14.2, 13.5, 13.5, 10.4],
    })
    s = drift_ratio_series(ov)
    assert len(s) == 2
    assert s.R_pred.iloc[1] > s.R_pred.iloc[0]
