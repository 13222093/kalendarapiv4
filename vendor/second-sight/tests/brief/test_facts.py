import json

import pytest

from api.brief.facts import FACT_TABLE_JSON_SCHEMA, build_fact_table, obs_class_from


def test_build_from_record(record):
    ft = build_fact_table(record)
    assert ft.period == "2026-09" and ft.year == 2026
    assert ft.ratio_vs_median == pytest.approx(12345 / 3980)
    assert ft.enso_class == "el_nino"
    assert ft.obs_class == "good"
    assert ft.provisional and "nrt_provisional" in ft.flags
    assert ft.rain_threshold_mm_day == 4.0
    assert ft.evidence_ids["h_value"].startswith("EV-SEBANGAU")
    for name in ("h_value", "h_lo", "h_hi", "ratio_vs_median", "percentile",
                 "analog_rank", "oni", "dmi", "rain_90d_mm_day", "observability"):
        assert ft.ev(name), name


def test_json_roundtrip_matches_schema_keys(record):
    d = json.loads(build_fact_table(record).to_json())
    assert set(FACT_TABLE_JSON_SCHEMA["required"]) <= set(d)
    assert set(d) <= set(FACT_TABLE_JSON_SCHEMA["properties"])


def test_aliases_and_explicit_evidence(record):
    record["month"] = record.pop("period")
    record["h_value"] = record.pop("H")
    record["evidence_ids"] = {"h_value": "EV-CUSTOM-1"}
    ft = build_fact_table(record)
    assert ft.h_value == 12345 and ft.ev("h_value") == "EV-CUSTOM-1"


def test_missing_required():
    with pytest.raises(ValueError):
        build_fact_table({"aoi_name": "X", "period": "2026-09"})


@pytest.mark.parametrize("o,cls", [(0.6, "good"), (0.45, "partial"), (0.1, "not_observed"),
                                   (None, None)])
def test_obs_class(o, cls):
    assert obs_class_from(o) == cls
