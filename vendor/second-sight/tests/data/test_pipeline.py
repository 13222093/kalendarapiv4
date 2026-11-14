"""Unit tests for the R1 data pipeline on tiny SYNTHETIC fixtures.

All rows below are invented for testing (SYNTHETIC, not FIRMS data).
"""
from __future__ import annotations

import duckdb
import pandas as pd
import pytest

from pipeline.data import aggregate, cells, clean, grid, static_mask

COLS = ["latitude", "longitude", "scan", "track", "acq_date", "acq_time", "satellite",
        "confidence", "frp", "daynight", "type", "source"]

# SYNTHETIC raw detections
SYNTHETIC_RAW = [
    # kept: Aqua, Riau (Sumatra), conf 50 -> nominal
    (0.501, 101.501, 1.0, 1.0, "2015-09-01", 630, "Aqua", "50", 10.0, "D", 0, "modis"),
    # kept: Aqua, same 0.01 cell + same day -> same cell-day; conf 90 -> high
    (0.5049, 101.5049, 2.0, 1.5, "2015-09-01", 630, "Aqua", "90", 30.0, "D", 0, "modis"),
    # dropped: low MODIS confidence
    (0.5, 101.5, 1.0, 1.0, "2015-09-01", 630, "Aqua", "20", 5.0, "D", 0, "modis"),
    # dropped: Terra before Nov 2000
    (-2.0, 113.0, 1.0, 1.0, "2000-10-15", 300, "Terra", "80", 5.0, "D", 0, "modis"),
    # dropped: static source type 2
    (-2.0, 121.0, 0.4, 0.4, "2015-09-02", 530, "N", "n", 50.0, "N", 2, "viirs-snpp"),
    # dropped: VIIRS low confidence
    (-2.0, 113.0, 0.4, 0.4, "2015-09-02", 530, "N", "l", 1.0, "D", 0, "viirs-snpp"),
    # kept: SNPP Kalimantan, high
    (-2.0, 113.0, 0.4, 0.5, "2015-09-02", 530, "N", "h", 8.0, "D", 0, "viirs-snpp"),
    # kept: NOAA-20 Papua, night, crosses midnight in local solar time (UTC 16:00 + 9.4 h)
    (-4.0, 141.0, 0.5, 0.5, "2019-08-31", 1600, "1", "n", 4.0, "N", 0, "viirs-jpss1"),
]


@pytest.fixture()
def con():
    c = duckdb.connect()
    df = pd.DataFrame(SYNTHETIC_RAW, columns=COLS)
    c.register("raw_df", df)
    c.execute("CREATE TABLE raw AS SELECT * EXCLUDE (acq_date), CAST(acq_date AS DATE) AS acq_date FROM raw_df")
    yield c
    c.close()


def test_grid_roundtrip_and_edges():
    res = 0.01
    cid = grid.cell_id(1.23, 101.45, res)  # exactly on an edge
    lat, lon = grid.cell_center(cid, res)
    assert lat == pytest.approx(1.235) and lon == pytest.approx(101.455)
    con = duckdb.connect()
    sql_id = con.execute(f"SELECT {grid.cell_id_sql('1.23', '101.45', res)}").fetchone()[0]
    assert sql_id == cid


def test_clean_drops_and_attributes(con):
    rep = clean.build_clean(con, "raw")
    assert rep["rows_in"] == 8 and rep["rows_kept"] == 4
    assert rep["dropped"] == {"unknown_satellite": 0, "terra_pre_2000_11": 1,
                              "non_vegetation_type": 1, "low_confidence": 2}
    assert rep["unexpected_nulls_in_required_columns"] == 0
    df = con.execute("SELECT * FROM detections ORDER BY satellite, frp").df()
    assert set(df.satellite) == {"Aqua", "SNPP", "NOAA20"}
    aqua = df[df.satellite == "Aqua"].sort_values("frp")
    assert list(aqua.conf_class) == ["nominal", "high"]
    assert aqua.a_pix.tolist() == pytest.approx([1.0, 3.0])
    assert set(aqua.island_region) == {"Sumatra"}
    assert df[df.satellite == "SNPP"].island_region.item() == "Kalimantan"
    n20 = df[df.satellite == "NOAA20"].iloc[0]
    assert n20.island_region == "Papua"
    # UTC 2019-08-31 16:00 + 141/15 h = 01:24 next day local solar time
    assert str(n20.local_date)[:10] == "2019-09-01"
    assert n20.lst_hour == pytest.approx(1.4, abs=1e-6)
    assert df.is_peat.isna().all() and df.province.isna().all()


def test_cells_dedup_and_ratio(con):
    clean.build_clean(con, "raw")
    rep = cells.build_cells(con, "detections")
    assert rep["duplicate_keys"] == 0
    assert rep["det_to_cell"]["Aqua"] == {"n_det": 2, "n_cells": 1, "det_per_cell": 2.0}
    row = con.execute("SELECT * FROM daily_cell WHERE satellite = 'Aqua'").df().iloc[0]
    assert row.sum_frp == pytest.approx(40.0) and row.max_frp == pytest.approx(30.0)
    assert row.mean_a_pix == pytest.approx(2.0)


def test_static_mask_threshold():
    c = duckdb.connect()
    # SYNTHETIC: a "smelter" cell with type-2 detections on 12 days, a cell with 3 days
    rows = [(-2.555, 121.355, f"2020-01-{d:02d}", 2) for d in range(1, 13)]
    rows += [(-1.0, 110.0, f"2020-02-{d:02d}", 1) for d in range(1, 4)]
    c.register("r", pd.DataFrame(rows, columns=["latitude", "longitude", "acq_date", "type"]))
    static_mask.build_static_days(c, "r", years=(2012, 2025))
    assert static_mask.build_mask(c, 10) == 1
    assert static_mask.build_mask(c, 3) == 2
    lat, lon = c.execute("SELECT cell_lat, cell_lon FROM static_mask WHERE n_days = 12").fetchone()
    assert lat == pytest.approx(-2.555) and lon == pytest.approx(121.355)


def test_aggregate_mass_conservation(con):
    clean.build_clean(con, "raw")
    cells.build_cells(con, "detections")
    aggregate.build_monthly_stratum(con)
    aggregate.build_grid(con)
    chk = aggregate.conservation_check(con)
    assert chk["ok"] and chk["month_satellite_groups"] == 3
    s = con.execute("SELECT season, peat FROM monthly_stratum WHERE satellite = 'Aqua'").fetchone()
    assert s == ("dry", "unknown")
