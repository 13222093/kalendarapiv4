"""EXP-01 tests on a tiny SYNTHETIC monthly_stratum fixture (invented numbers, not FIRMS data)."""
from __future__ import annotations

import json


import pandas as pd
import pytest

from pipeline.export import bundle


@pytest.fixture
def synthetic(tmp_path):
    # SYNTHETIC rows: Terra Jan-Apr 2015, Aqua Feb-Apr 2015, SNPP only Apr 2015
    rows = [
        ("2015-01-01", "Sumatra", "Terra", 5), ("2015-02-01", "Sumatra", "Terra", 3),
        ("2015-04-01", "Kalimantan", "Terra", 7),
        ("2015-02-01", "Sumatra", "Aqua", 2), ("2015-04-01", "Sumatra", "Aqua", 4),
        ("2015-04-01", "Kalimantan", "Aqua", 1),
        ("2015-04-01", "Kalimantan", "SNPP", 9),
    ]
    df = pd.DataFrame(rows, columns=["month", "island_region", "satellite", "n_cells"])
    df["month"] = pd.to_datetime(df["month"]).dt.date
    for c, v in {"season": "dry", "daynight": "D", "peat": "unknown"}.items():
        df[c] = v
    df["n_det"] = df["n_cells"] * 1.0
    df["sum_frp"] = df["n_cells"] * 10.0
    sp = tmp_path / "monthly_stratum.parquet"
    df.to_parquet(sp)
    grid = pd.DataFrame({"month": pd.to_datetime(["2015-01-01", "2016-03-01"]).date,
                         "g_id": [1, 2], "g_lat": [0.025, 0.075], "g_lon": [101.025, 101.075],
                         "satellite": ["Terra", "Aqua"], "n_cells": [1, 2], "n_det": [1.0, 2.0],
                         "sum_frp": [5.0, 6.0]})
    gp = tmp_path / "grid.parquet"
    grid.to_parquet(gp)
    man = tmp_path / "data_manifest.json"
    man.write_text('{"synthetic": true}')
    return sp, gp, man


def test_raw_monthly_windows(synthetic):
    sp, _, _ = synthetic
    s = bundle.load_stratum(sp)
    nat = bundle.raw_monthly(s, None).set_index("month")
    assert list(nat.index) == [1, 2, 3, 4]
    assert nat.loc[1, "T_raw"] == 5 and nat.loc[4, "T_raw"] == 7
    assert nat.loc[3, "T_raw"] == 0            # inside Terra window, no fire -> 0
    assert pd.isna(nat.loc[1, "A_raw"])        # before Aqua's first month -> null
    assert nat.loc[3, "A_raw"] == 0
    assert pd.isna(nat.loc[3, "V_raw"]) and nat.loc[4, "V_raw"] == 9
    assert nat["N20_raw"].isna().all()
    kal = bundle.raw_monthly(s, "Kalimantan").set_index("month")
    assert kal.loc[1, "T_raw"] == 0 and kal.loc[4, "T_raw"] == 7
    assert not nat["flag_nrt"].any()


def test_build_raw_only_never_fabricates(synthetic, tmp_path, monkeypatch):
    sp, gp, man = synthetic
    monkeypatch.setattr(bundle, "_science_adapter", lambda s: None)
    idx = bundle.build(tmp_path / "bundle", sp, gp, man)
    assert idx["harmonized"] is False and idx["harmonized_note"]
    assert len(idx["data_version"]) == 64
    assert {a["aoi_id"] for a in idx["aois"]} == {"IDN", *bundle.REGIONS.values()}
    rows = json.loads((tmp_path / "bundle" / "monthly_IDN.json").read_text())
    assert list(rows[0]) == bundle.FIELDS
    assert all(r[c] is None for r in rows for c in bundle.SCIENCE_FIELDS)
    years = [g["year"] for g in idx["grid005"]["files"]]
    assert years == [2015, 2016]
    gfile = (tmp_path / "bundle" / "grid005" / "grid005_2016.parquet").as_posix()
    g = pd.read_parquet(gfile)
    assert len(g) == 1 and int(g["month"][0]) == 3


def test_build_uses_science_when_available(synthetic, tmp_path, monkeypatch):
    sp, gp, man = synthetic

    def fake_science(aoi_id, raw):  # SYNTHETIC stand-in for pipeline.science
        return pd.DataFrame({"year": raw["year"], "month": raw["month"], "H": 1.5,
                             "H_lo": 1.0, "H_hi": 2.0, "sensor_used": "Aqua"})

    monkeypatch.setattr(bundle, "_science_adapter", lambda s: fake_science)
    idx = bundle.build(tmp_path / "b2", sp, gp, man)
    assert idx["harmonized"] is True
    rows = json.loads((tmp_path / "b2" / "monthly_region-sumatra.json").read_text())
    assert rows[0]["H"] == 1.5 and rows[0]["sensor_used"] == "Aqua" and rows[0]["pct_rank"] is None


def test_lone_tail_month_dropped_and_science_schema(synthetic):
    sp, _, _ = synthetic
    s = bundle.load_stratum(sp)
    tail = s.iloc[[0]].copy()  # SYNTHETIC: one SNPP-only month after the archive end
    tail["month"] = pd.Timestamp("2015-05-01").date()
    tail["satellite"] = "SNPP"
    s2 = pd.concat([s, tail], ignore_index=True)
    assert bundle.raw_monthly(s2, None)["month"].max() == 4
    sci = bundle.to_science_schema(s, {m: "wet" for m in range(1, 13)})
    assert {"year", "month", "season", "is_peat", "cell_days", "satellite"} <= set(sci.columns)
    assert sci["cell_days"].sum() == s["n_cells"].sum()
