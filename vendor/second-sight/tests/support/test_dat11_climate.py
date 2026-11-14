"""DAT-11 tests on SYNTHETIC rasters and polygons (DATA CONTOH).

AI-assisted code (see docs/ai_acknowledgement.md).
"""
import io

import numpy as np
import pandas as pd
from shapely.geometry import box

from pipeline.support import climate


def test_grid_window_alignment():
    (rs, cs), lons, lats = climate.grid_window((100.0, 0.0, 101.0, 1.0))
    assert len(lons) == 20 and len(lats) == 20
    assert np.isclose(lons[0], 100.025) and np.isclose(lats[0], 0.975)
    assert cs.start == int((100 + 180) / 0.05) and rs.start == int((50 - 1) / 0.05)


def test_read_tif_bytes_nodata():
    from PIL import Image

    a = np.array([[1.5, -9999.0], [2.0, 3.0]], dtype=np.float32)
    buf = io.BytesIO()
    Image.fromarray(a, mode="F").save(buf, format="TIFF")
    out = climate.read_tif_bytes(buf.getvalue())
    assert np.isnan(out[0, 1]) and out[1, 1] == 3.0


def _synthetic_loader(values):
    lons = np.array([100.25, 100.75, 101.25, 101.75])
    lats = np.array([0.75, 0.25])

    def load(y, m):
        g = np.full((2, 4), np.nan, dtype=np.float32)
        g[:, :2] = values[(y, m)][0]
        g[:, 2:] = values[(y, m)][1]
        return g, lons, lats

    return load


def test_climate_monthly_and_rolling():
    units = [("SYNTH_A", box(100, 0, 101, 1)), ("SYNTH_B", box(101, 0, 102, 1))]
    months = [(2019, 1), (2019, 2), (2019, 3), (2019, 5)]
    vals = {(2019, 1): (310.0, 0.0), (2019, 2): (280.0, 28.0), (2019, 3): (310.0, 31.0), (2019, 5): (31.0, 31.0)}
    df = climate.climate_monthly(months, units, loader=_synthetic_loader(vals))
    a = df[df.aoi_id == "SYNTH_A"].set_index("month")
    assert np.isclose(a.loc[1, "precip_1m_mm_day"], 10.0)
    assert np.isclose(a.loc[3, "precip_3m_mm_day"], 900.0 / 90)
    assert np.isnan(a.loc[1, "precip_3m_mm_day"]) and np.isnan(a.loc[5, "precip_3m_mm_day"])  # gap in April
    nat = df[(df.aoi_id == "NATIONAL") & (df.month == 1)].iloc[0]
    assert np.isclose(nat.precip_mm, 155.0, rtol=1e-3)  # equal-area halves at the equator
    assert (df.valid_frac == 1.0).all()


def test_month_range():
    assert climate.month_range("2019-11", "2020-02") == [(2019, 11), (2019, 12), (2020, 1), (2020, 2)]
