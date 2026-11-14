from api.brief.facts import build_fact_table
from api.brief.rules import CITATION_SHORT, CITATIONS, check_vocabulary, explain


def ids(findings):
    return [f.rule_id for f in findings]


def test_el_nino_drought_and_nrt(record):
    fs = explain(build_fact_table(record))
    assert ids(fs) == ["R1_ENSO_DROUGHT", "R4_NRT_PROVISIONAL"]
    s = fs[0].sentence("id")
    assert "konsisten dengan pola kekeringan El Niño" in s
    assert "2,1 mm/hari" in s and "ambang 4 mm/hari" in s and "+1,8" in s
    assert "(Field et al. 2016)" in s
    assert "2.1 mm/day" in fs[0].sentence("en") and "consistent with" in fs[0].sentence("en")


def test_dry_without_el_nino(record):
    record["oni"] = 0.2
    assert ids(explain(build_fact_table(record)))[0] == "R1b_DRY"


def test_no_drought_when_wet(record):
    record["rain_90d"] = 6.0
    record["nrt"] = False
    assert explain(build_fact_table(record)) == []


def test_sensor_artefact_on_event_month(record):
    record["period"] = "2022-01"
    record["rain_90d"] = 6.0
    fs = explain(build_fact_table(record))
    assert "R2_SENSOR_ARTEFACT" in ids(fs)
    f = next(f for f in fs if f.rule_id == "R2_SENSOR_ARTEFACT")
    assert "kemungkinan artefak sensor" in f.sentence("id")
    assert "possible sensor artefact" in f.sentence("en")


def test_no_sensor_artefact_without_spike(record):
    record.update(period="2022-01", H=4000.0, percentile=55)
    assert "R2_SENSOR_ARTEFACT" not in ids(explain(build_fact_table(record)))


def test_low_observability_and_disagreement(record):
    record.update(observability=0.25, triangulation="C")
    fs = explain(build_fact_table(record))
    assert {"R3_LOW_OBSERVABILITY", "R5_METHODS_DISAGREE"} <= set(ids(fs))
    f = next(f for f in fs if f.rule_id == "R3_LOW_OBSERVABILITY")
    assert "nilai mungkin terlalu rendah" in f.sentence("id")
    assert "value may be underestimated" in f.sentence("en")


def test_controlled_vocabulary_and_fixed_citations(record):
    record.update(period="2022-01", observability=0.2, triangulation="C")
    for f in explain(build_fact_table(record)):
        assert set(f.citations) <= set(CITATIONS) <= set(CITATION_SHORT)
        for loc in ("id", "en"):
            assert check_vocabulary(f.sentence(loc), loc) == []
    assert check_vocabulary("Titik api disebabkan oleh El Niño", "id") == ["titik api",
                                                                          "disebabkan oleh"]
