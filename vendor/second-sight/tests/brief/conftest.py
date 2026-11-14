import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# SYNTHETIC example record: invented numbers for tests only, not real data.
SYNTHETIC_RECORD = {
    "aoi_name": "KHG Sebangau (SYNTHETIC)",
    "aoi_type": "khg",
    "period": "2026-09",
    "H": 12345.0,
    "H_lo": 10520.0,
    "H_hi": 14310.0,
    "baseline_median": 3980.0,
    "percentile": 96,
    "analog_rank": 1,
    "analog_n": 9,
    "enso_class": "El Nino",
    "oni": 1.8,
    "dmi": 0.9,
    "rain_90d": 2.1,
    "observability": 0.72,
    "triangulation": "A",
    "nrt": True,
    "data_version": "v0.3",
}


@pytest.fixture
def record():
    return dict(SYNTHETIC_RECORD)
