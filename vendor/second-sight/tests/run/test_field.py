import numpy as np

from pipeline.run.field_test import fit_slope, overlap


def test_fit_slope_recovers_exponential_relation():
    rng = np.random.default_rng(0)
    rain = np.linspace(1, 10, 20)
    act = np.exp(5 - 0.4 * rain)
    b, ci, n = fit_slope(rain, act, 200, rng)
    assert np.isclose(b, -0.4) and n == 20 and ci[0] <= b <= ci[1]


def test_overlap():
    assert overlap([0, 1], [0.5, 2]) and not overlap([0, 1], [1.5, 2])
