import datetime as dt

import pytest

from api.brief.facts import build_fact_table
from api.brief.fmt import fmt_num, fmt_ratio
from api.brief.render import render_all, to_html, to_markdown, to_pdf, to_whatsapp
from api.brief.rules import check_vocabulary

D = dt.date(2026, 11, 14)


def test_number_formats():
    assert fmt_num(12345, "id-ID") == "12.345"
    assert fmt_num(12345, "en-GB") == "12,345"
    assert fmt_ratio(3.14, "id") == "3,1×"
    assert fmt_ratio(3.14, "en") == "3.1×"
    assert fmt_num(-0.34, "id", 1) == "−0,3"
    assert fmt_num(1.8, "en", 1, sign=True) == "+1.8"
    assert fmt_num(12345, "id", sig=3) == "12.300"


def test_markdown_id(record):
    md = to_markdown(build_fact_table(record), "id", generated=D)
    assert md.startswith("# Brief siaga karhutla: KHG Sebangau")
    assert "**3,1×** median 2003-2022" in md
    assert "**peringkat 1 dari 9** tahun El Niño" in md
    assert "kemungkinan 10.500-14.300 (9 dari 10)" in md
    assert "Titik panas bukan berarti kebakaran pasti" in md
    assert "Dibuat 2026-11-14" in md
    assert "[^1]: EV-" in md
    assert "NASA logo" not in md and "logo" not in md.lower()
    assert check_vocabulary(md, "id") == []


def test_markdown_en(record):
    md = to_markdown(build_fact_table(record), "en", generated=D)
    assert "**3.1×** the 2003-2022 median" in md
    assert "likely 10,500-14,300 (9 in 10)" in md
    assert "A hotspot is not a confirmed fire" in md
    assert check_vocabulary(md, "en") == []


def test_html_and_whatsapp(record):
    ft = build_fact_table(record)
    h = to_html(ft, "id", generated=D)
    assert h.startswith("<!doctype html>") and '<sup class="fn">1</sup>' in h
    assert "<strong>3,1×</strong>" in h and "<img" not in h
    wa = to_whatsapp(ft, "id", generated=D)
    assert "*3,1×*" in wa and "**" not in wa and "<" not in wa
    assert "ID bukti: EV-" in wa
    assert len(wa) < 2500


def test_render_all_keys(record):
    out = render_all(build_fact_table(record), generated=D)
    assert set(out) == {f"{l}.{k}" for l in ("id", "en") for k in ("md", "html", "wa")}


def test_minimal_record_renders():
    ft = build_fact_table({"aoi_name": "Kab. Contoh (SYNTHETIC)", "period": "2025-03",
                           "H": 12, "baseline_median": 0})
    md = to_markdown(ft, "id", generated=D)
    assert "Tidak ada aturan penjelas" in md


def test_pdf_optional(record, tmp_path):
    try:
        import weasyprint  # noqa: F401
    except Exception:
        with pytest.raises(RuntimeError):
            to_pdf(build_fact_table(record), str(tmp_path / "b.pdf"))
        return
    assert to_pdf(build_fact_table(record), str(tmp_path / "b.pdf"))
