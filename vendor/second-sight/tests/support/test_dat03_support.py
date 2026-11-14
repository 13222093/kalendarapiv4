"""DAT-03 tests. All geometries here are SYNTHETIC (DATA CONTOH), not real boundaries/peat.

AI-assisted code (see docs/ai_acknowledgement.md).
"""
import csv
import json
from pathlib import Path

import numpy as np

from pipeline.support import boundaries, peat

SQUARE_A = {"type": "Polygon", "coordinates": [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]]}
SQUARE_B = {"type": "Polygon", "coordinates": [[[101, 0], [102, 0], [102, 1], [101, 1], [101, 0]]]}


def _fc(tmp_path: Path, feats, name="fc.geojson") -> Path:
    p = tmp_path / name
    p.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    return p


def test_admin_labeler_synthetic(tmp_path):
    p = _fc(tmp_path, [
        {"type": "Feature", "properties": {"shapeName": "SYNTH_A"}, "geometry": SQUARE_A},
        {"type": "Feature", "properties": {"shapeName": "SYNTH_B"}, "geometry": SQUARE_B},
    ])
    lab = boundaries.PointLabeler(boundaries.load_units(p))
    out = lab.label([0.5, 0.5, 5.0], [100.5, 101.5, 100.5])
    assert out == ["SYNTH_A", "SYNTH_B", None]


def test_peat_labeler_synthetic(tmp_path):
    p = _fc(tmp_path, [{"type": "Feature", "properties": {}, "geometry": SQUARE_A}])
    hit = peat.label_peat(np.array([0.5, 0.5, -3]), np.array([100.5, 101.5, 100.5]), path=p)
    assert hit.tolist() == [True, False, False]


def test_strip_z():
    assert peat._strip_z([[[1.0, 2.0, 0.0, None], [3.0, 4.0, 0.0, None]]]) == [[[1.0, 2.0], [3.0, 4.0]]]


def test_sipongi_csv_schema():
    p = Path(peat.__file__).with_name("sipongi_burned_area.csv")
    rows = list(csv.DictReader(p.open(encoding="utf-8")))
    assert rows, "csv empty"
    for r in rows:
        assert {"year", "province", "burned_area_ha", "source_url", "accessed_date", "verification_status"} <= r.keys()
        assert r["source_url"].startswith("http")
        float(r["burned_area_ha"])
