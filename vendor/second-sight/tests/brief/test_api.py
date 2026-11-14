import datetime as dt
import json

from api.brief import make_brief
from api.brief.__main__ import main
from api.brief.facts import build_fact_table
from api.brief.render import verdict_sentence

D = dt.date(2026, 11, 14)


def test_verdict_sentence(record):
    ft = build_fact_table(record)
    assert verdict_sentence(ft, "id") == (
        "September 2026 di KHG Sebangau (SYNTHETIC): 3,1× median 2003-2022, "
        "peringkat 1 dari 9 tahun El Niño sejak 2001.")
    assert verdict_sentence(ft, "en", markup=True).startswith("**September 2026** in")


def test_make_brief(record):
    for fmt in ("md", "html", "wa"):
        out = make_brief(record, "en", fmt, generated=D)
        assert out["verified"] and out["untraceable"] == []
        assert out["findings"][0]["rule_id"] == "R1_ENSO_DROUGHT"
        json.dumps(out, ensure_ascii=False)


def test_cli(record, tmp_path):
    p = tmp_path / "rec.json"
    p.write_text(json.dumps(record), encoding="utf-8")
    out = tmp_path / "brief.html"
    assert main([str(p), "--format", "html", "-o", str(out)]) == 0
    assert out.read_text(encoding="utf-8").startswith("<!doctype html>")
