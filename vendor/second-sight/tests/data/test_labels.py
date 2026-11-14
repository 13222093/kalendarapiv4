"""DAT-03: synthetic-fixture test for cell labelling (peat / province / regency)."""
import duckdb
import pandas as pd
import pytest

shapely = pytest.importorskip("shapely")
from shapely.geometry import box  # noqa: E402

from pipeline.data import aggregate, labels  # noqa: E402


def _layers():
    peat = [box(0, 0, 1, 1)]                       # peat square inside province A
    adm1 = [("A", box(0, 0, 2, 2)), ("B", box(2, 0, 4, 2))]
    adm2 = [("A1", box(0, 0, 2, 2)), ("B1", box(2, 0, 4, 2))]
    return peat, adm1, adm2


def test_label_points():
    out = labels.label_points([0.5, 1.5, 0.5, 5.0], [0.5, 0.5, 3.0, 5.0], *_layers())
    assert out.peat.tolist() == ["peat", "mineral", "mineral", "unknown"]
    assert out.province.tolist()[:3] == ["A", "A", "B"] and pd.isna(out.province.iloc[3])
    assert out.regency.tolist()[:3] == ["A1", "A1", "B1"] and pd.isna(out.regency.iloc[3])


def test_build_labeled_and_aggregate():
    dc = pd.DataFrame({
        "local_date": pd.to_datetime(["2015-09-01", "2015-09-02", "2015-09-02"]).date,
        "cell_id": [1, 2, 3], "satellite": ["Aqua", "Aqua", "Suomi NPP"], "daynight": ["D", "N", "N"],
        "sensor": ["MODIS", "MODIS", "VIIRS"], "n_det": [2, 1, 3], "sum_frp": [10.0, 5.0, 9.0],
        "max_frp": [6.0, 5.0, 4.0], "mean_a_pix": [1.0, 1.0, 0.14], "mean_lst_hour": [13.5, 1.5, 1.5],
        "island_region": ["Sumatra"] * 3, "is_peat": [None] * 3, "province": [None] * 3,
        "regency": [None] * 3, "khg_id": [None] * 3,
        "cell_lat": [0.5, 1.5, 5.0], "cell_lon": [0.5, 0.5, 5.0], "in_static_mask": [False] * 3})
    con = duckdb.connect()
    con.register("daily_cell", dc)
    lab = labels.label_points(dc.cell_lat, dc.cell_lon, *_layers())
    labels.build_labeled(con, lab)
    got = con.execute("SELECT cell_id, peat, is_peat, province FROM daily_cell_labeled ORDER BY 1").fetchall()
    assert got == [(1, "peat", True, "A"), (2, "mineral", False, "A"), (3, "unknown", None, None)]
    aggregate.build_monthly_stratum(con, cell_rel="daily_cell_labeled")
    ms = con.execute("SELECT peat, sum(n_det) FROM monthly_stratum GROUP BY 1 ORDER BY 1").fetchall()
    assert ms == [("mineral", 1), ("peat", 2), ("unknown", 3)]
    labels.build_monthly_province(con)
    assert con.execute("SELECT sum(n_det) FROM monthly_province").fetchone()[0] == 6
