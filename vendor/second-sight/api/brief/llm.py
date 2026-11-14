"""AI-03 · LLM narrative with placeholders + numeric verifier + template fallback.

Flow ("facts-first, LLM-second, verifier-last", doc 08 §3E A2):
  1. Build a prompt that lists placeholders such as {{ratio}} and the rule
     findings that fired. The LLM must write prose with placeholders only,
     never digits.
  2. Reject any draft that contains digits or unknown placeholders.
  3. Fill placeholders with locale-formatted values from the fact table.
  4. Run the numeric verifier and the controlled-vocabulary check.
  5. Two failed attempts -> template text (render.py). The UI never depends on
     the LLM being up.

The LLM is any callable ``prompt -> str``. ``anthropic_llm_from_env()`` builds
one from the Anthropic SDK only when ANTHROPIC_API_KEY is set (the key lives in
the backend environment, never in the repo). Model: BRIEF_LLM_MODEL, default
claude-opus-5-5. Responses can be cached on disk for the demo (cache_dir).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .facts import FactTable
from .fmt import fmt_month, fmt_num, fmt_ratio, norm_locale
from .render import L, _cnt, to_markdown
from .rules import CITATION_SHORT, Finding, check_vocabulary, explain
from .verify import verify_text

LLM = Callable[[str], str]
MAX_ATTEMPTS = 2
_PH = re.compile(r"\{\{\s*([a-z0-9_]+)\s*\}\}")


def placeholders(ft: FactTable, locale: str = "id") -> dict[str, str]:
    """Placeholder name -> formatted value (only facts that exist)."""
    loc = norm_locale(locale)
    t = L[loc]
    p: dict[str, str] = {
        "aoi": ft.aoi_name,
        "month": fmt_month(ft.period, loc),
        "h_value": _cnt(ft.h_value, loc),
        "baseline_median": _cnt(ft.baseline_median, loc),
        "baseline_period": f"{ft.baseline_start}-{ft.baseline_end}",
        "rain_threshold": fmt_num(ft.rain_threshold_mm_day, loc,
                                  0 if float(ft.rain_threshold_mm_day).is_integer() else 1),
        "rain_window_days": str(ft.rain_window_days),
    }
    if ft.h_lo is not None and ft.h_hi is not None:
        p["h_range"] = f"{_cnt(ft.h_lo, loc)}-{_cnt(ft.h_hi, loc)}"
        n = round(ft.interval_level * 10)
        p["interval_odds"] = f"{n} dari 10" if loc == "id" else f"{n} in 10"
    if ft.ratio_vs_median is not None:
        p["ratio"] = fmt_ratio(ft.ratio_vs_median, loc)
    if ft.percentile is not None:
        p["percentile"] = fmt_num(ft.percentile, loc, 0)
    if ft.analog_rank and ft.analog_n:
        p["analog_rank"] = str(ft.analog_rank)
        p["analog_n"] = str(ft.analog_n)
        p["analog_label"] = t["analog"][ft.enso_class]
        p["analog_since"] = str(ft.analog_since)
    if ft.oni is not None:
        p["oni"] = fmt_num(ft.oni, loc, 1, sign=True)
    if ft.dmi is not None:
        p["dmi"] = fmt_num(ft.dmi, loc, 1, sign=True)
    if ft.rain_90d_mm_day is not None:
        p["rain_90d"] = fmt_num(ft.rain_90d_mm_day, loc, 1)
    if ft.observability is not None:
        p["observability"] = fmt_num(ft.observability, loc, 2)
    return p


def build_prompt(ft: FactTable, locale: str = "id", findings: list[Finding] | None = None) -> str:
    loc = norm_locale(locale)
    findings = explain(ft) if findings is None else findings
    ph = placeholders(ft, loc)
    lang = "Bahasa Indonesia" if loc == "id" else "British English"
    vocab = ('use "titik panas" (never "titik api") and "konsisten dengan" '
             '(never "disebabkan oleh")' if loc == "id"
             else 'use "hotspot" and "consistent with" (never "caused by")')
    rules = "\n".join(f"- {f.rule_id}: {f.sentence(loc, with_citation=False)}"
                      for f in findings) or "- (none)"
    return (
        f"Write a 3-5 sentence alert summary in {lang} for a district disaster agency "
        f"(BPBD) about hotspot activity in {{{{aoi}}}}, {{{{month}}}}.\n"
        "Hard rules:\n"
        "1. Do not write any digit. Every number must be one of these placeholders, "
        "written exactly as {{name}}: " + ", ".join(sorted(ph)) + ".\n"
        f"2. Controlled vocabulary: {vocab}.\n"
        "3. You may explain the anomaly only with the rule findings below; add no other "
        "cause, no prediction and no advice.\n"
        "4. End with one limitation sentence (a hotspot is not a confirmed fire; "
        "cloud or smoke can hide fires).\n"
        "5. Plain text only, no headings, no lists.\n"
        f"Rule findings that fired:\n{rules}\n"
        f"Citations you may name: {', '.join(CITATION_SHORT[c] for f in findings for c in f.citations) or 'none'}.\n"
    )


def fill(template: str, ph: dict[str, str]) -> str:
    def sub(m: re.Match) -> str:
        if m.group(1) not in ph:
            raise KeyError(m.group(1))
        return ph[m.group(1)]
    return _PH.sub(sub, template)


@dataclass
class BriefResult:
    source: str  # "llm" | "template"
    text: str  # verified narrative (LLM) or template Markdown
    brief_markdown: str  # full one-page brief
    attempts: int = 0
    errors: list[str] = field(default_factory=list)


def check_draft(draft: str, ft: FactTable, loc: str) -> tuple[str | None, list[str]]:
    """Return (filled_text, errors). filled_text is None if the draft fails."""
    errs: list[str] = []
    no_ph = _PH.sub("", draft)
    no_ph = re.sub(r"\b[A-Z][A-Za-z'-]+ et al\.? \d{4}\b", "", no_ph)
    if re.search(r"\d", no_ph):
        errs.append("draft contains raw digits outside placeholders")
    try:
        filled = fill(draft, placeholders(ft, loc))
    except KeyError as e:
        return None, errs + [f"unknown placeholder {e}"]
    bad = [n.raw for n in verify_text(filled, ft, loc).untraceable]
    if bad:
        errs.append(f"untraceable numbers: {bad}")
    banned = check_vocabulary(filled, loc)
    if banned:
        errs.append(f"banned terms: {banned}")
    return (None if errs else filled), errs


def _cached(llm: LLM, cache_dir: str | os.PathLike | None) -> LLM:
    if not cache_dir:
        return llm
    d = Path(cache_dir)

    def call(prompt: str) -> str:
        f = d / (hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:24] + ".json")
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))["text"]
        text = llm(prompt)
        d.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps({"text": text}, ensure_ascii=False), encoding="utf-8")
        return text
    return call


def generate_brief(ft: FactTable, locale: str = "id", llm: LLM | None = None,
                   cache_dir: str | os.PathLike | None = None, **render_kw) -> BriefResult:
    loc = norm_locale(locale)
    findings = explain(ft)
    template_md = to_markdown(ft, loc, findings=findings, **render_kw)
    if llm is None:
        llm = anthropic_llm_from_env()
    if llm is None:
        return BriefResult("template", template_md, template_md, 0, ["no LLM configured"])
    call = _cached(llm, cache_dir)
    prompt = build_prompt(ft, loc, findings)
    errors: list[str] = []
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = call(prompt if attempt == 1 else
                         prompt + "\nYour previous draft was rejected: " + "; ".join(errors[-2:]))
        except Exception as exc:  # network, quota, SDK errors -> fallback
            errors.append(f"LLM error: {type(exc).__name__}")
            continue
        filled, errs = check_draft(draft, ft, loc)
        if filled:
            head = "\n## " + L[loc]["value_head"]
            brief = template_md.replace(head, "\n" + filled.strip() + "\n" + head, 1)
            return BriefResult("llm", filled.strip(), brief, attempt, errors)
        errors += errs
    return BriefResult("template", template_md, template_md, MAX_ATTEMPTS, errors)


def anthropic_llm_from_env() -> LLM | None:
    """Anthropic SDK adapter; None unless ANTHROPIC_API_KEY is set and the SDK is
    installed. Model from BRIEF_LLM_MODEL (default claude-opus-5-5)."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic  # type: ignore
    except ImportError:
        return None
    client = anthropic.Anthropic()
    model = os.environ.get("BRIEF_LLM_MODEL", "claude-opus-5-5")

    def call(prompt: str) -> str:
        resp = client.messages.create(
            model=model,
            max_tokens=2000,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": prompt}],
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("LLM refusal")
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return call
