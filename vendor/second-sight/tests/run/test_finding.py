import numpy as np

from pipeline.run.finding import artefact_share, ratio, spearman, theil_sen


def test_theil_sen_linear_and_outlier():
    x = np.arange(2001, 2026)
    y = 3.0 * x + 10
    assert abs(theil_sen(x, y) - 3.0) < 1e-9
    y2 = y.copy()
    y2[5] = 1e6  # robust to a single outlier
    assert abs(theil_sen(x, y2) - 3.0) < 1e-9


def test_ratio_bounds():
    r = ratio(50.0, 100.0, 40.0, 60.0)
    assert r == {"ratio": 0.5, "lo": 0.4, "hi": 0.6}
    assert ratio(1.0, 0.0)["ratio"] is None


def test_artefact_share():
    assert abs(artefact_share(10.0, 2.5) - 0.75) < 1e-12
    assert artefact_share(0.0, 1.0) is None


def test_spearman():
    assert abs(spearman([1, 2, 3], [10, 20, 30]) - 1.0) < 1e-12
    assert abs(spearman([1, 2, 3], [30, 20, 10]) + 1.0) < 1e-12
