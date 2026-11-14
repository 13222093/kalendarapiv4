"""PHY-02 tests on SYNTHETIC detections (not results)."""
import numpy as np
import pandas as pd
import pytest

from pipeline.physics.overpass import (
    circular_median_hours,
    effective_overpass_time,
    local_solar_time,
)


def test_lst_basic_and_wraparound():
    assert local_solar_time(6.0, 105.0) == pytest.approx(13.0)
    assert local_solar_time(23.5, 105.0) == pytest.approx(6.5)  # wraps past 24
    assert local_solar_time(1.0, -30.0) == pytest.approx(23.0)  # wraps below 0


def test_circular_median_midnight():
    assert circular_median_hours([23.5, 0.5, 1.5]) == pytest.approx(0.5)
    assert np.isnan(circular_median_hours([]))


def test_effective_overpass_groups():
    # SYNTHETIC: Aqua day ~13:30 in Jan, ~14:00 in Feb; Terra night ~22:30.
    df = pd.DataFrame(
        {
            "satellite": ["Aqua"] * 6 + ["Terra"] * 3,
            "daynight": ["D"] * 6 + ["N"] * 3,
            "local_date": ["2020-01-03", "2020-01-10", "2020-01-20",
                           "2020-02-03", "2020-02-10", "2020-02-20",
                           "2020-01-05", "2020-01-06", "2020-01-07"],
            "lst": [13.4, 13.5, 13.6, 13.9, 14.0, 14.1, 22.4, 22.5, 22.6],
        }
    )
    out = effective_overpass_time(df)
    assert len(out) == 3
    aqua = out[out.satellite == "Aqua"]["lst_median"].to_numpy()
    assert aqua[0] == pytest.approx(13.5)
    assert aqua[1] == pytest.approx(14.0)
    assert out.loc[out.satellite == "Terra", "n"].item() == 3


def test_effective_overpass_from_utc():
    df = pd.DataFrame(
        {"satellite": ["SNPP"] * 2, "daynight": ["D"] * 2,
         "acq_date": ["2022-08-01", "2022-08-02"],
         "utc_hour": [6.0, 6.2], "longitude": [105.0, 105.0]}
    )
    out = effective_overpass_time(df)
    assert out["lst_median"].item() == pytest.approx(13.1)


def test_min_count_filters():
    df = pd.DataFrame({"satellite": ["Terra"], "daynight": ["D"],
                       "local_date": ["2010-01-01"], "lst": [10.5]})
    assert effective_overpass_time(df, min_count=2).empty
