import datetime as dt

import pytest

from api.brief.facts import build_fact_table
from api.brief.render import render_all, to_markdown
from api.brief.verify import extract_numbers, untraceable_numbers, verify_text

D = dt.date(2026, 11, 14)


def vals(text, loc):
    return [n.value for n in extract_numbers(text, loc)]


def test_extract_indonesian_formats():
    t = "Nilai 12.345 titik, 3,1× median, 45 persen, 7,5%, ONI −0,4, kisaran 1.050-1.430."
    assert vals(t, "id") == [12345, 3.1, 45, 7.5, -0.4, 1050, 1430]


def test_extract_english_formats():
    t = "Value 12,345, 3.1× the median, 45%, ONI -0.4 (likely 1,050-1,430)."
    assert vals(t, "en") == [12345, 3.1, 45, -0.4, 1050, 1430]


def test_ignores_ids_dates_citations_versions():
    t = "EV-SEB-202609-H [^3] dibuat 2026-11-14 versi v0.3 (Field et al. 2016) NOAA-20 C2"
    assert vals(t, "id") == []


@pytest.mark.parametrize("variant", [
    {},
    {"period": "2022-01", "observability": 0.25, "triangulation": "C", "nrt": False},
    {"oni": -0.7, "enso_class": "la_nina", "rain_90d": 7.3, "dmi": -0.2},
    {"H": 87.0, "H_lo": 60.0, "H_hi": 120.0, "baseline_median": 40.0, "percentile": 71},
    {"oni": 0.3, "rain_90d": 3.4, "rain_threshold": 4.5},
])
def test_template_outputs_are_fully_traceable(record, variant):
    record.update(variant)
    ft = build_fact_table(record)
    for key, text in render_all(ft, generated=D).items():
        res = verify_text(text, ft, key[:2])
        assert res.ok, (key, [n.raw for n in res.untraceable])
        assert len(res.numbers) >= 8


def test_tampered_text_is_caught(record):
    ft = build_fact_table(record)
    md = to_markdown(ft, "id", generated=D)
    assert untraceable_numbers(md, ft, "id") == []
    tampered = md.replace("**3,1×**", "**4,7×**")
    assert untraceable_numbers(tampered, ft, "id") == ["4,7"]
    injected = md + "\nLuas terbakar diperkirakan 50.000 hektar.\n"
    assert untraceable_numbers(injected, ft, "id") == ["50.000"]
    en = to_markdown(ft, "en", generated=D).replace("rank 1 of 9", "rank 2 of 9")
    assert untraceable_numbers(en, ft, "en") == ["2"]


def test_rounding_tolerance(record):
    ft = build_fact_table(record)  # ratio 3.1017..., H 12345
    assert untraceable_numbers("3,1× dan 3,10× dan 12.300 dan 12.345", ft, "id") == []
    assert untraceable_numbers("3,2× dan 12.400", ft, "id") == ["3,2", "12.400"]
