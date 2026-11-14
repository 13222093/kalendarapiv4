"""AI-02 · Template brief (no LLM). Always-available fallback.

One page, Bahasa Indonesia by default, English on request, in three forms:
Markdown, standalone HTML (print to PDF), and WhatsApp plain text. Every
number comes from the fact table and carries an evidence-ID footnote. No NASA
logo or branding (doc 08 §3E, doc 10 §3.7).

Internal mini-markup used by the block builder:
    **bold**              -> <strong> / *bold* (WhatsApp)
    [[ev:field_name]]     -> footnote with that field's evidence ID
"""
from __future__ import annotations

import datetime as _dt
import html as _html
import re
from dataclasses import dataclass

from .facts import FactTable
from .fmt import fmt_month, fmt_num, fmt_ratio, norm_locale
from .rules import CITATIONS, DATA_SOURCES, Finding, explain

APP_NAME = "Second Sight"

L = {
    "id": {
        "title": "Brief siaga karhutla",
        "verdict_head": "Ringkasan",
        "value_head": "Nilai bulan ini",
        "climate_head": "Konteks iklim",
        "quality_head": "Kualitas data",
        "why_head": "Penjelasan (berbasis aturan)",
        "limits_head": "Keterbatasan",
        "sources_head": "Sumber",
        "refs_head": "Rujukan",
        "fn_head": "ID bukti",
        "unit": "hari-sel api (skala setara Aqua-MODIS)",
        "analog": {"el_nino": "tahun El Niño", "la_nina": "tahun La Niña",
                   "neutral": "tahun netral", None: "tahun pembanding"},
        "enso": {"el_nino": "El Niño", "la_nina": "La Niña", "neutral": "netral"},
        "obs": {"good": "baik", "partial": "sebagian",
                "not_observed": "tidak teramati: awan atau asap"},
        "tri": {"A": "Tiga metode sepakat", "B": "Dua metode sepakat",
                "C": "Metode tidak sepakat"},
        "provisional": "Sementara (data NRT, bisa berubah)",
        "no_rule": "Tidak ada aturan penjelas yang terpicu untuk bulan ini.",
        "limits": ("Titik panas bukan berarti kebakaran pasti. Nilai adalah estimasi "
                   "harmonisasi MODIS-VIIRS dengan ketidakpastian; awan, asap, dan jam lintas "
                   "satelit dapat membuat nilai terlalu rendah. Kalimat penjelas menunjukkan "
                   "kesesuaian pola, bukan sebab."),
        "footer": ("Dibuat {date}{ver}. Teks dari templat tanpa LLM; setiap angka diverifikasi "
                   "otomatis terhadap tabel fakta."),
        "ver": " · versi data {v}",
    },
    "en": {
        "title": "Fire alert brief",
        "verdict_head": "Summary",
        "value_head": "This month",
        "climate_head": "Climate context",
        "quality_head": "Data quality",
        "why_head": "Explanation (rule-based)",
        "limits_head": "Limitations",
        "sources_head": "Sources",
        "refs_head": "References",
        "fn_head": "Evidence IDs",
        "unit": "fire cell-days (Aqua-MODIS-equivalent scale)",
        "analog": {"el_nino": "El Niño years", "la_nina": "La Niña years",
                   "neutral": "neutral years", None: "comparison years"},
        "enso": {"el_nino": "El Niño", "la_nina": "La Niña", "neutral": "neutral"},
        "obs": {"good": "good", "partial": "partial",
                "not_observed": "not observed: cloud or smoke"},
        "tri": {"A": "Three methods agree", "B": "Two agree", "C": "Methods disagree"},
        "provisional": "Provisional (near-real-time, may change)",
        "no_rule": "No explanatory rule fired for this month.",
        "limits": ("A hotspot is not a confirmed fire. Values are harmonised MODIS-VIIRS "
                   "estimates with uncertainty; cloud, smoke and satellite overpass times can "
                   "make them too low. Explanatory sentences show consistency with a pattern, "
                   "not a cause."),
        "footer": ("Generated {date}{ver}. Template text, no LLM; every number is "
                   "automatically checked against the fact table."),
        "ver": " · data version {v}",
    },
}


@dataclass
class Block:
    kind: str  # h1 | h2 | p | li | small
    text: str


def _cnt(x: float | None, loc: str) -> str:
    """Counts in running text: integers, 3 significant figures from 1,000."""
    return fmt_num(x, loc, 0, sig=3)


def _verdict(ft: FactTable, loc: str) -> str:
    t = L[loc]
    month = fmt_month(ft.period, loc)
    base = f"{ft.baseline_start}-{ft.baseline_end}"
    if loc == "id":
        v = f"**{month}** di {ft.aoi_name}"
        if ft.ratio_vs_median is not None:
            v += f": **{fmt_ratio(ft.ratio_vs_median, loc)}** median {base}[[ev:ratio_vs_median]]"
        if ft.analog_rank and ft.analog_n:
            v += (f", **peringkat {ft.analog_rank} dari {ft.analog_n}** "
                  f"{t['analog'][ft.enso_class]} sejak {ft.analog_since}[[ev:analog_rank]]")
    else:
        v = f"**{month}** in {ft.aoi_name}"
        if ft.ratio_vs_median is not None:
            v += (f": **{fmt_ratio(ft.ratio_vs_median, loc)}** the {base} median"
                  "[[ev:ratio_vs_median]]")
        if ft.analog_rank and ft.analog_n:
            v += (f", **rank {ft.analog_rank} of {ft.analog_n}** "
                  f"{t['analog'][ft.enso_class]} since {ft.analog_since}[[ev:analog_rank]]")
    return v + "."


def verdict_sentence(ft: FactTable, locale: str = "id", markup: bool = False) -> str:
    """Verdict for the "Bulan Ini" screen (doc 10 §3.3), from the same facts as the
    brief. markup=True keeps **bold** markers; evidence markers are always removed."""
    s = _EV.sub("", _verdict(ft, norm_locale(locale)))
    return s if markup else s.replace("**", "")


def build_blocks(ft: FactTable, locale: str = "id", findings: list[Finding] | None = None,
                 generated: _dt.date | None = None) -> list[Block]:
    loc = norm_locale(locale)
    t = L[loc]
    findings = explain(ft) if findings is None else findings
    month = fmt_month(ft.period, loc)
    b: list[Block] = [Block("h1", f"{t['title']}: {ft.aoi_name}, {month}")]
    if ft.provisional:
        b.append(Block("small", t["provisional"] + "[[ev:flags]]"))

    # Verdict (doc 10 §4.6 / §3.3)
    b.append(Block("h2", t["verdict_head"]))
    b.append(Block("p", _verdict(ft, loc)))
    base = f"{ft.baseline_start}-{ft.baseline_end}"

    # Value + interval + percentile
    b.append(Block("h2", t["value_head"]))
    odds_n, odds_d = round(ft.interval_level * 10), 10
    val = f"**{_cnt(ft.h_value, loc)}** {t['unit']}[[ev:h_value]]"
    if ft.h_lo is not None and ft.h_hi is not None:
        rng = f"{_cnt(ft.h_lo, loc)}-{_cnt(ft.h_hi, loc)}"
        val += (f", kemungkinan {rng} ({odds_n} dari {odds_d})" if loc == "id"
                else f", likely {rng} ({odds_n} in {odds_d})") + "[[ev:h_lo]]"
    val += "."
    b.append(Block("li", val))
    med = _cnt(ft.baseline_median, loc)
    b.append(Block("li", (f"Median {base}: {med}" if loc == "id"
                          else f"{base} median: {med}") + "[[ev:baseline_median]]."))
    if ft.percentile is not None:
        p = fmt_num(ft.percentile, loc, 0)
        b.append(Block("li", (f"Persentil {p} terhadap {base}" if loc == "id"
                              else f"Percentile {p} against {base}") + "[[ev:percentile]]."))

    # Climate context
    parts = []
    if ft.oni is not None:
        enso = f" ({t['enso'][ft.enso_class]})" if ft.enso_class in t["enso"] else ""
        parts.append(f"ONI {fmt_num(ft.oni, loc, 1, sign=True)}{enso}[[ev:oni]]")
    if ft.dmi is not None:
        parts.append(f"DMI {fmt_num(ft.dmi, loc, 1, sign=True)}[[ev:dmi]]")
    if ft.rain_90d_mm_day is not None:
        thr = fmt_num(ft.rain_threshold_mm_day, loc,
                      0 if float(ft.rain_threshold_mm_day).is_integer() else 1)
        r = fmt_num(ft.rain_90d_mm_day, loc, 1)
        parts.append(
            (f"hujan {ft.rain_window_days} hari {r} mm/hari (ambang {thr} mm/hari)" if loc == "id"
             else f"{ft.rain_window_days}-day rain {r} mm/day ({thr} mm/day threshold)")
            + "[[ev:rain_90d_mm_day]]")
    if parts:
        b.append(Block("h2", t["climate_head"]))
        b.append(Block("p", " · ".join(parts) + "."))

    # Data quality
    q = []
    if ft.obs_class:
        o = (f" (O = {fmt_num(ft.observability, loc, 2)})" if ft.observability is not None
             else "")
        q.append(("Observabilitas: " if loc == "id" else "Observability: ")
                 + t["obs"][ft.obs_class] + o + "[[ev:observability]]")
    if ft.triangulation in t["tri"]:
        q.append(("Keyakinan: " if loc == "id" else "Confidence: ")
                 + f"{t['tri'][ft.triangulation]} ({ft.triangulation})[[ev:triangulation]]")
    if q:
        b.append(Block("h2", t["quality_head"]))
        b.append(Block("p", " · ".join(q) + "."))

    # Rule-based explanation
    b.append(Block("h2", t["why_head"]))
    if findings:
        for f in findings:
            refs = "".join(f"[[ev:{e}]]" for e in f.evidence[:1])
            b.append(Block("li", f.sentence(loc) + refs))
    else:
        b.append(Block("p", t["no_rule"]))

    b.append(Block("h2", t["limits_head"]))
    b.append(Block("p", t["limits"]))

    b.append(Block("h2", t["sources_head"]))
    for s in DATA_SOURCES[loc]:
        b.append(Block("li", s))
    cited = sorted({c for f in findings for c in f.citations})
    if cited:
        b.append(Block("h2", t["refs_head"]))
        for c in cited:
            b.append(Block("li", CITATIONS[c]))

    date = (generated or _dt.date.today()).isoformat()
    ver = t["ver"].format(v=ft.data_version) if ft.data_version else ""
    b.append(Block("small", f"{APP_NAME} · " + t["footer"].format(date=date, ver=ver)))
    return b


_EV = re.compile(r"\[\[ev:([a-z0-9_]+)\]\]")
_BOLD = re.compile(r"\*\*(.+?)\*\*")


def _footnotes(blocks: list[Block], ft: FactTable) -> tuple[list[Block], list[tuple[str, str]]]:
    """Resolve [[ev:x]] markers to numbered footnotes; drop unknown evidence."""
    order: dict[str, int] = {}
    notes: list[tuple[str, str]] = []

    def sub(m: re.Match) -> str:
        eid = ft.ev(m.group(1))
        if not eid:
            return ""
        if eid not in order:
            order[eid] = len(order) + 1
            notes.append((eid, m.group(1)))
        return f"\x00{order[eid]}\x01"

    return [Block(x.kind, _EV.sub(sub, x.text)) for x in blocks], notes


def to_markdown(ft: FactTable, locale: str = "id", **kw) -> str:
    loc = norm_locale(locale)
    blocks, notes = _footnotes(build_blocks(ft, loc, **kw), ft)
    out: list[str] = []
    prev = ""
    for x in blocks:
        txt = x.text.replace("\x00", "[^").replace("\x01", "]")
        if x.kind == "h1":
            line = f"# {txt}"
        elif x.kind == "h2":
            line = f"\n## {txt}"
        elif x.kind == "li":
            line = f"- {txt}"
        elif x.kind == "small":
            line = f"\n_{txt}_" if prev else f"_{txt}_"
        else:
            line = txt
        out.append(line)
        prev = x.kind
    out.append("")
    out += [f"[^{i}]: {eid} ({name})" for i, (eid, name) in enumerate(notes, 1)]
    return "\n".join(out) + "\n"


CSS = """
body{font:14px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#15181c;
max-width:720px;margin:24px auto;padding:0 16px;background:#fff}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:16px 0 4px;text-transform:uppercase;
letter-spacing:.04em;color:#444}p,ul{margin:4px 0}small{color:#555;display:block;margin-top:8px}
sup.fn{font-size:10px;color:#555}ol.fn{font-size:11px;color:#555;padding-left:20px}
@page{size:A4;margin:16mm}
"""


def to_html(ft: FactTable, locale: str = "id", **kw) -> str:
    loc = norm_locale(locale)
    t = L[loc]
    blocks, notes = _footnotes(build_blocks(ft, loc, **kw), ft)
    body: list[str] = []
    in_ul = False
    title = ""
    for x in blocks:
        txt = _html.escape(x.text, quote=False)
        txt = _BOLD.sub(r"<strong>\1</strong>", txt)
        txt = re.sub("\x00(\\d+)\x01", r'<sup class="fn">\1</sup>', txt)
        if x.kind == "li" and not in_ul:
            body.append("<ul>")
            in_ul = True
        elif x.kind != "li" and in_ul:
            body.append("</ul>")
            in_ul = False
        if x.kind == "h1":
            title = re.sub(r"<[^>]+>", "", txt)
            body.append(f"<h1>{txt}</h1>")
        elif x.kind == "h2":
            body.append(f"<h2>{txt}</h2>")
        elif x.kind == "li":
            body.append(f"<li>{txt}</li>")
        elif x.kind == "small":
            body.append(f"<small>{txt}</small>")
        else:
            body.append(f"<p>{txt}</p>")
    if in_ul:
        body.append("</ul>")
    if notes:
        body.append(f"<h2>{t['fn_head']}</h2><ol class=\"fn\">")
        body += [f"<li><code>{_html.escape(e)}</code> ({_html.escape(n)})</li>" for e, n in notes]
        body.append("</ol>")
    return (f'<!doctype html>\n<html lang="{loc}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{title}</title><style>{CSS}</style></head><body>\n"
            + "\n".join(body) + "\n</body></html>\n")


def to_whatsapp(ft: FactTable, locale: str = "id", **kw) -> str:
    """Plain text for WhatsApp: *bold*, no tables, sources and references trimmed."""
    loc = norm_locale(locale)
    t = L[loc]
    blocks = build_blocks(ft, loc, **kw)
    skip = {t["sources_head"], t["refs_head"]}
    out: list[str] = []
    skipping = False
    evids: list[str] = []
    for x in blocks:
        for m in _EV.finditer(x.text):
            e = ft.ev(m.group(1))
            if e and e not in evids:
                evids.append(e)
        txt = _BOLD.sub(r"*\1*", _EV.sub("", x.text))
        if x.kind == "h2":
            skipping = txt in skip
            if not skipping:
                out.append(f"\n_{txt}_")
            continue
        if skipping:
            continue
        if x.kind == "h1":
            out.append(f"*{txt}*")
        elif x.kind == "li":
            out.append(f"- {txt}")
        else:
            out.append(txt)
    out.append(("Sumber: NASA FIRMS, NOAA, CHIRPS, KLHK." if loc == "id"
                else "Sources: NASA FIRMS, NOAA, CHIRPS, KLHK."))
    if evids:
        out.append(f"{t['fn_head']}: " + ", ".join(evids))
    return "\n".join(out).strip() + "\n"


def to_pdf(ft: FactTable, path: str, locale: str = "id", **kw) -> str:
    """Optional PDF via WeasyPrint. On Windows WeasyPrint needs GTK/Pango; when it
    is unavailable this raises RuntimeError and callers should serve to_html()
    (print-ready, A4 @page CSS) instead."""
    try:
        from weasyprint import HTML  # type: ignore
    except Exception as exc:  # ImportError or missing native libs (OSError)
        raise RuntimeError("WeasyPrint unavailable; use to_html() and print to PDF") from exc
    HTML(string=to_html(ft, locale, **kw)).write_pdf(path)
    return path


def render_all(ft: FactTable, generated: _dt.date | None = None) -> dict[str, str]:
    """All formats, both locales: keys like 'id.md', 'en.html', 'id.wa'."""
    out = {}
    for loc in ("id", "en"):
        out[f"{loc}.md"] = to_markdown(ft, loc, generated=generated)
        out[f"{loc}.html"] = to_html(ft, loc, generated=generated)
        out[f"{loc}.wa"] = to_whatsapp(ft, loc, generated=generated)
    return out
