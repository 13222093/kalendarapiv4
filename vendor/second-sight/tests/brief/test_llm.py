import datetime as dt

from api.brief.facts import build_fact_table
from api.brief.llm import build_prompt, generate_brief

D = dt.date(2026, 11, 14)

GOOD_ID = ("Pada {{month}}, {{aoi}} mencatat {{h_value}} hari-sel api, {{ratio}} median "
           "{{baseline_period}} dan peringkat {{analog_rank}} dari {{analog_n}} {{analog_label}}. "
           "Hujan {{rain_window_days}} hari {{rain_90d}} mm/hari dengan ONI {{oni}} konsisten "
           "dengan pola kekeringan El Niño (Field et al. 2016). Titik panas bukan berarti "
           "kebakaran pasti.")


class Fake:
    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def __call__(self, prompt):
        self.calls += 1
        return self.outputs.pop(0)


def test_prompt_lists_placeholders_and_rules(record):
    p = build_prompt(build_fact_table(record), "id")
    assert "ratio" in p and "R1_ENSO_DROUGHT" in p and "Do not write any digit" in p


def test_llm_success_is_verified(record):
    ft = build_fact_table(record)
    fake = Fake(GOOD_ID)
    r = generate_brief(ft, "id", llm=fake, generated=D)
    assert r.source == "llm" and r.attempts == 1
    assert "3,1× median 2003-2022" in r.text
    assert r.text in r.brief_markdown


def test_raw_digits_then_fallback_to_template(record):
    ft = build_fact_table(record)
    fake = Fake("Nilai 50.000 hektar terbakar.", "Titik api disebabkan oleh El Niño {{ratio}}.")
    r = generate_brief(ft, "id", llm=fake, generated=D)
    assert r.source == "template" and fake.calls == 2
    assert any("raw digits" in e for e in r.errors)
    assert any("banned terms" in e for e in r.errors)
    assert r.text.startswith("# Brief siaga karhutla")


def test_unknown_placeholder_and_llm_error(record):
    ft = build_fact_table(record)

    def boom(prompt):
        raise ConnectionError("down")

    r = generate_brief(ft, "en", llm=Fake("Area {{burned_ha}}.", "Area {{burned_ha}}."),
                       generated=D)
    assert r.source == "template" and "unknown placeholder" in r.errors[0]
    r2 = generate_brief(ft, "en", llm=boom, generated=D)
    assert r2.source == "template" and "LLM error" in r2.errors[0]


def test_no_key_means_template(record, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = generate_brief(build_fact_table(record), "id", generated=D)
    assert r.source == "template" and r.errors == ["no LLM configured"]


def test_cache(record, tmp_path):
    ft = build_fact_table(record)
    fake = Fake(GOOD_ID)
    generate_brief(ft, "id", llm=fake, cache_dir=tmp_path, generated=D)
    r = generate_brief(ft, "id", llm=Fake(), cache_dir=tmp_path, generated=D)
    assert r.source == "llm" and fake.calls == 1
