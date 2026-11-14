"""DAT-10 tests on SYNTHETIC CMG arrays (DATA CONTOH).

AI-assisted code (see docs/ai_acknowledgement.md).
"""
import numpy as np
import pandas as pd

from pipeline.support import cloud


def test_navigation_roundtrip():
    x, y = cloud.latlon_to_xy(-2.9, 114.2)
    lat, lon = cloud.xy_to_latlon(x, y)
    assert abs(lat - -2.9) <= 0.125 and abs(lon - 114.2) <= 0.125
    assert cloud.xy_to_latlon(0, 0) == (89.875, -179.875)


def test_parse_name():
    m = cloud.parse_name("MYD14CMQ.200412.006.01.hdf")
    assert m == {"satellite": "AQUA", "year": 2004, "month": 12, "collection": "006", "version": "01"}
    assert cloud.parse_name("README.txt") is None


def test_f_cloud_and_frame():
    total = np.full((cloud.NY, cloud.NX), 100, dtype=np.int32)
    cl = np.full_like(total, 40)
    hx, hy = cloud.latlon_to_xy(0.1, 100.1)
    total[hy, hx] = 0  # one empty cell (no Terra observations)
    cl[hy, hx] = 0
    t = cloud.cmg_to_frame(cl, total, 2019, 9, "TERRA")
    a = cloud.cmg_to_frame(np.full_like(total, 80), np.full_like(total, 100), 2019, 9, "AQUA")
    assert t.lat.between(-11.5, 6.5).all() and t.lon.between(94, 141.5).all()
    assert np.isclose(np.nanmean(t.f_cloud), 0.4)
    df = cloud.combine_satellites(pd.concat([t, a], ignore_index=True))
    comb = df[df.satellite == "COMBINED"]
    hole = comb[(comb.lat == 0.125) & (comb.lon == 100.125)].iloc[0]
    assert np.isclose(hole.f_cloud, 0.8)  # only Aqua pixels in that cell
    assert np.isclose(comb.f_cloud.median(), 0.6)
    assert cloud.coverage(df) == 1.0 and cloud.coverage(df, "TERRA") < 1.0
