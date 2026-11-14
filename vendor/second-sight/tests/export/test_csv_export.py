"""EXP-02 tests on SYNTHETIC bundle/detection fixtures (invented values, not FIRMS data)."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json

import pandas as pd

from pipeline.export import csv_export


def _bundle(tmp_path):
    b = tmp_path / "bundle"
    b.mkdir()
    index = {"data_version": "a" * 64, "generated_at": "2026-11-14T00:00:00+00:00",
             "calibration_window": [2012, 2021], "baseline_period": [2003, 2022],
             "harmonized": False, "aois": [{"aoi_id": "IDN", "name": "Indonesia"}]}
    (b / "index.json").write_text(json.dumps(index))
    rows = [  # SYNTHETIC
        {"aoi_id": "IDN", "year": 2021, "month": 12, "H": None, "H_lo": None, "H_hi": None,
         "A_raw": 4, "T_raw": 3, "V_raw": 10, "N20_raw": None, "sensor_used": None,
         "baseline_median": None, "pct_rank": None, "obs_class": None, "flag_nrt": False,
         "agreement": None},
        {"aoi_id": "IDN", "year": 2026, "month": 1, "H": None, "H_lo": None, "H_hi": None,
         "A_raw": None, "T_raw": None, "V_raw": 2, "N20_raw": 0, "sensor_used": None,
         "baseline_median": None, "pct_rank": None, "obs_class": None, "flag_nrt": True,
         "agreement": None},
    ]
    (b / "monthly_IDN.json").write_text(json.dumps(rows))
    return b


def _split(text):
    comments = [ln for ln in text.splitlines() if ln.startswith("#")]
    body = "\n".join(ln for ln in text.splitlines() if not ln.startswith("#"))
    return comments, list(csv.DictReader(io.StringIO(body)))


def test_aggregate_header_and_columns(tmp_path):
    b = _bundle(tmp_path)
    p = csv_export.write_aggregate("IDN", b, tmp_path / "out.csv")
    comments, rows = _split(p.read_text(encoding="utf-8"))
    joined = "\n".join(comments)
    for key in ["app:", "data_version: " + "a" * 64, "download_date:", "filters:", "baseline:",
                "calibration_window: 2012-2021", "citation:", "license:", "ai_acknowledgement:",
                "harmonized: false"]:
        assert key in joined
    assert list(rows[0]) == csv_export.AGG_COLUMNS
    r0, r1 = rows
    assert (r0["terra_raw"], r0["aqua_raw"], r0["snpp_raw"], r0["noaa20_raw"]) == ("3", "4", "10", "")
    assert r0["H"] == "" and r0["kappa"] == "" and r0["pct_rank"] == ""   # never fabricated
    assert r0["flag_drift_era"] == "0" and r1["flag_drift_era"] == "1"
    assert r1["flag_nrt"] == "1" and r1["noaa20_raw"] == "0"
    assert r0["evidence_id"] == "IDN:2021-12:" + "a" * 12
    assert r0["aoi_name"] == "Indonesia"


def test_detections_bbox_and_dates(tmp_path):
    b = _bundle(tmp_path)
    det = pd.DataFrame({  # SYNTHETIC detections
        "latitude": [0.5, 0.5, 5.0, 0.6], "longitude": [101.5, 101.5, 101.5, 101.6],
        "satellite": ["Aqua", "N", "Aqua", "Terra"], "frp": [10.0, 3.0, 8.0, 1.0],
        "local_date": [dt.date(2019, 9, 1), dt.date(2019, 9, 30), dt.date(2019, 9, 1),
                       dt.date(2019, 10, 1)],
        "acq_ts_utc": pd.to_datetime(["2019-09-01 06:30", "2019-09-30 05:30",
                                      "2019-09-01 06:30", "2019-10-01 03:00"]),
    })
    src = tmp_path / "detections.parquet"
    det.to_parquet(src)
    out = tmp_path / "det.csv"
    n = csv_export.write_detections((101, 0, 102, 1), "2019-09-01", "2019-09-30", out, src, b)
    assert n == 2
    comments, rows = _split(out.read_text(encoding="utf-8"))
    assert any("bbox lon 101.0..102.0" in c for c in comments)
    assert list(rows[0]) == csv_export.DET_COLUMNS
    assert [r["satellite"] for r in rows] == ["Aqua", "N"]
    assert rows[0]["province"] == ""   # column absent in source -> empty


def test_restamp_data_version_matches_index(tmp_path):
    # B5 regression: every bundle CSV carries index.json's data_version
    (tmp_path / "csv").mkdir()
    (tmp_path / "index.json").write_text(json.dumps({"data_version": "f2849b7bnew"}), encoding="utf-8")
    stale = tmp_path / "csv" / "detections_sample.csv"
    stale.write_text("# app: x\n# data_version: 7f03b336old\nlatitude\n1.0\n", encoding="utf-8")
    assert csv_export.restamp_data_version(tmp_path) == [stale]
    text = stale.read_text(encoding="utf-8")
    assert "# data_version: f2849b7bnew\n" in text and "latitude\n1.0\n" in text
