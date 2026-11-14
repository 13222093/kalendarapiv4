"""TRI-04 tests on SYNTHETIC cloud/missing fractions (not results)."""
import numpy as np
import pandas as pd
import pytest

from pipeline.physics.observability import add_observability, class_shares, obs_class, observability


def test_formula_and_clip():
    assert observability(0.5, 0.2) == pytest.approx(0.4)
    assert observability(1.2, 0.0) == pytest.approx(0.0)
    assert np.isnan(observability(np.nan, 0.1))


def test_class_boundaries():
    c = obs_class([0.6, 0.59, 0.3, 0.29, np.nan]).tolist()
    assert c == ["good", "partial", "partial", "unobserved", None]


def test_add_and_shares():
    df = pd.DataFrame({"year": [2015, 2015, 2023, 2023],
                       "f_cloud": [0.1, 0.5, 0.8, 0.0], "f_missing": [0.0, 0.0, 0.0, 0.9]})
    out = add_observability(df)
    assert out["obs_class"].tolist() == ["good", "partial", "unobserved", "unobserved"]
    tot = class_shares(out)
    assert tot["unobserved"].item() == pytest.approx(50.0)
    per = class_shares(out, by="year")
    assert per.loc[2023, "unobserved"] == pytest.approx(100.0)
    assert per.loc[2015, "good"] == pytest.approx(50.0)
