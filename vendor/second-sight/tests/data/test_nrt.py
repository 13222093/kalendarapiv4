"""DAT-02 normalisation + NRT staging on a tiny SYNTHETIC mirror-like fixture.

All rows below are invented for testing (SYNTHETIC, not FIRMS data).
"""
from __future__ import annotations

import datetime as dt

import duckdb
import pandas as pd
import pytest

from pipeline.data import clean, grid, nrt

MIRROR_COLS = ["lon", "lat", "acq_datetime", "acq_date", "sensor", "satellite", "instrument",
               "quality", "version", "brightness", "bright_t31", "bright_ti4", "bright_ti5",
               "scan", "track", "frp", "daynight", "confidence", "type"]
T = dt.datetime
SYNTHETIC_MIRROR = [
    (101.5, 0.5, T(2026, 8, 20, 6, 5), dt.date(2026, 8, 20), "MODIS", "Aqua", "MODIS", "nrt",
     "6.1NRT", 330.0, 300.0, None, None, 1.0, 1.0, 20.0, "D", "75", None),
    (113.0, -2.0, T(2026, 9, 1, 18, 42), dt.date(2026, 9, 1), "VIIRS_SNPP", "Suomi-NPP", "VIIRS",
     "nrt", "2.0NRT", None, None, 340.0, 290.0, 0.4, 0.4, 5.0, "N", "h", None),
    (122.155, -2.825, T(2026, 9, 2, 5, 0), dt.date(2026, 9, 2), "VIIRS_NOAA21", "NOAA-21", "VIIRS",
     "nrt", "2.0NRT", None, None, 360.0, 300.0, 0.5, 0.5, 80.0, "D", "nominal", None),
    (140.0, -4.0, T(2026, 3, 3, 4, 9), dt.date(2026, 3, 3), "VIIRS_NOAA20", "NOAA-20", "VIIRS",
     "sp", "2", None, None, 330.0, 290.0, 0.4, 0.4, 3.0, "D", "l", 0),
]


@pytest.fixture()
def con():
    c = duckdb.connect()
    c.register("m", pd.DataFrame(SYNTHETIC_MIRROR, columns=MIRROR_COLS))
    c.execute(f"CREATE TABLE norm AS {nrt.normalise_sql('m', lon_expr='lon', lat_expr='lat')}")
    yield c
    c.close()


def test_normalise_matches_sp_schema(con):
    df = con.execute("SELECT * FROM norm ORDER BY acq_date").df()
    for col in ["latitude", "longitude", "scan", "track", "acq_date", "acq_time", "satellite",
                "confidence", "frp", "daynight", "type", "source", "quality"]:
        assert col in df.columns
    snpp = df[df.source == "viirs-snpp"].iloc[0]
    assert snpp.acq_time == 1842 and snpp.satellite == "N" and snpp.confidence == "h"
    assert df[df.source == "viirs-jpss2"].iloc[0].confidence == "n"  # 'nominal' -> 'n'
    assert set(df.source) == {"modis", "viirs-snpp", "viirs-jpss1", "viirs-jpss2"}
    assert set(df.quality) == {"NRT", "SP"}
    modis = df[df.source == "modis"].iloc[0]
    assert modis.acq_time == 605 and modis.satellite == "Aqua" and modis.confidence == "75"
    assert pd.isna(modis.type)


def test_stage_fills_type_from_static_mask_and_clean_accepts(con):
    # SYNTHETIC mask: the NOAA-21 point's 0.01 deg cell (a "smelter")
    cid = grid.cell_id(-2.825, 122.155, 0.01)
    con.execute(f"CREATE TABLE static_mask AS SELECT {cid}::BIGINT AS cell_id")
    con.execute(f"CREATE TABLE staged AS {nrt.stage_sql('norm', 'static_mask', None)}")
    st = con.execute("SELECT source, type, in_mask FROM staged ORDER BY source").df()
    assert st.set_index("source").type.to_dict() == {
        "modis": 0, "viirs-jpss1": 0, "viirs-jpss2": 2, "viirs-snpp": 0}
    con.execute("CREATE VIEW s AS SELECT * EXCLUDE (in_mask, in_country) FROM staged")
    rep = clean.build_clean(con, "s")
    # dropped: masked NOAA-21 (non_vegetation_type), NOAA-20 'l' (low_confidence)
    assert rep["rows_kept"] == 2
    assert rep["dropped"]["non_vegetation_type"] == 1 and rep["dropped"]["low_confidence"] == 1
    assert set(con.execute("SELECT satellite FROM detections").df().satellite) == {"Aqua", "SNPP"}
