"""AI-05 · Brief eval suite (doc 08 §3E A4, doc 11 AI-05).

Runs on 100 SYNTHETIC fact tables (random, seeded; not real data):
  1. Numeric consistency: verifier over every template output
     (id/en × Markdown/HTML/WhatsApp) -> target 0 untraceable numbers.
  2. Groundedness: every causal/attribution sentence in a brief must be the
     verbatim sentence of a rule that fired -> target 100%.
  3. Controlled vocabulary: no banned terms -> target 0.
  4. Tamper detection: change one traced number in each brief -> share caught.
  5. LLM fallback: adversarial fake LLM drafts (raw digits, banned terms,
     invented placeholders) must all fall back to the template.

Usage:  python eval/brief_eval.py   (writes eval/report.md)
"""
from __future__ import annotations

import datetime as dt
import random
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.brief.facts import build_fact_table  # noqa: E402
from api.brief.fmt import fmt_num  # noqa: E402
from api.brief.llm import generate_brief  # noqa: E402
from api.brief.render import render_all  # noqa: E402
from api.brief.rules import check_vocabulary, explain  # noqa: E402
from api.brief.verify import clean_text, extract_numbers, verify_text  # noqa: E402

N = 100
SEED = 2026
GEN_DATE = dt.date(2026, 11, 14)
AOIS = ["KHG Sebangau", "KHG Sungai Kampar", "Kab. Ogan Komering Ilir", "Kab. Pulang Pisau",
        "Provinsi Riau", "KHG Sungai Siak", "Kab. Ketapang", "Provinsi Jambi"]
CAUSAL = {"id": ["konsisten dengan", "kemungkinan artefak", "observasi terbatas"],
          "en": ["consistent with", "possible sensor artefact", "limited observation"]}


def synthetic_record(rng: random.Random, i: int) -> dict:
    year = rng.randint(2001, 2026)
    month = rng.randint(1, 12) if year < 2026 else rng.randint(1, 11)
    med = round(rng.lognormvariate(5, 1.2), 0)
    ratio = rng.choice([rng.uniform(0.1, 1.5), rng.uniform(1.5, 6.0)])
    h = round(med * ratio, 1)
    oni = round(rng.uniform(-2.0, 2.5), 1)
    enso = "el_nino" if oni >= 0.5 else "la_nina" if oni <= -0.5 else "neutral"
    lo = rng.uniform(0.75, 0.95)
    rec = {
        "aoi_name": f"{rng.choice(AOIS)} (SYNTHETIC)",
        "period": f"{year}-{month:02d}",
        "H": h, "H_lo": round(h * lo, 1), "H_hi": round(h * (2 - lo), 1),
        "baseline_median": med,
        "percentile": rng.randint(5, 100),
        "analog_n": (n := rng.randint(5, 10)), "analog_rank": rng.randint(1, n),
        "enso_class": enso, "oni": oni, "dmi": round(rng.uniform(-1.0, 1.5), 1),
        "rain_90d": round(rng.uniform(0.5, 9.0), 1),
        "observability": round(rng.uniform(0.05, 0.98), 2),
        "triangulation": rng.choice(["A", "B", "C", None]),
        "nrt": year == 2026,
        "data_version": "v0.3",
    }
    # Some tables miss optional facts.
    for k in ("H_lo", "dmi", "triangulation", "percentile"):
        if rng.random() < 0.1:
            rec.pop(k, None)
    if i % 17 == 0:  # force sensor-event months
        rec["period"] = rng.choice(["2012-01", "2018-01", "2022-01", "2026-11"])
    return rec


def sentences(text: str) -> list[str]:
    t = re.sub(r"\[\^\d+\]|\*\*|\*|_", "", clean_text(text))
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n", t) if s.strip()]


def tamper(text: str, ft, loc: str, rng: random.Random) -> str | None:
    nums = [n for n in verify_text(text, ft, loc).numbers if n.match]
    if not nums:
        return None
    n = rng.choice(nums)
    d = len(re.split(r"[.,]", n.raw.lstrip("+-−"))[-1]) if re.search(
        r"[,.]\d{1,2}$", n.raw) else 0
    new = fmt_num(abs(n.value) * 1.37 + 1.3, loc, d)
    i = clean_text(text).find(n.raw)  # tamper the cleaned text at the same spot
    c = clean_text(text)
    return c[:i] + new + c[i + len(n.raw):]


def main() -> int:
    rng = random.Random(SEED)
    stats = Counter()
    rule_counts = Counter()
    untraceable_examples: list[str] = []
    ungrounded_examples: list[str] = []
    for i in range(N):
        ft = build_fact_table(synthetic_record(rng, i))
        findings = explain(ft)
        rule_counts.update(f.rule_id for f in findings)
        outs = render_all(ft, generated=GEN_DATE)
        for key, text in outs.items():
            loc = key[:2]
            res = verify_text(text, ft, loc)
            stats["outputs"] += 1
            stats["numbers"] += len(res.numbers)
            stats["untraceable"] += len(res.untraceable)
            if res.untraceable and len(untraceable_examples) < 5:
                untraceable_examples.append(f"{key} {ft.period}: {[n.raw for n in res.untraceable]}")
            stats["banned"] += len(check_vocabulary(text, loc))
            if key.endswith(".md"):
                allowed = [clean_text(f.sentence(loc)).replace("**", "") for f in findings]
                for s in sentences(text):
                    if any(c in s.lower() for c in CAUSAL[loc]):
                        stats["causal"] += 1
                        if any(s.rstrip(".") in a or a.rstrip(".") in s for a in allowed):
                            stats["grounded"] += 1
                        elif len(ungrounded_examples) < 5:
                            ungrounded_examples.append(s)
                t = tamper(text, ft, loc, rng)
                if t is not None:
                    stats["tampered"] += 1
                    if not verify_text(t, ft, loc).ok:
                        stats["tamper_caught"] += 1
        # Adversarial fake LLM: must always fall back to the template.
        for bad in ("Sekitar 50.000 hektar terbakar.", "Titik api disebabkan oleh El Niño.",
                    "Luas {{burned_area}} hektar."):
            r = generate_brief(ft, "id", llm=lambda p, b=bad: b, generated=GEN_DATE)
            stats["llm_adversarial"] += 1
            stats["llm_fallback"] += r.source == "template"

    grounded_pct = 100.0 * stats["grounded"] / max(stats["causal"], 1)
    tamper_pct = 100.0 * stats["tamper_caught"] / max(stats["tampered"], 1)
    rows = [
        ("Numeric consistency (template, 6 outputs × 100 tables)",
         f"{stats['untraceable']} untraceable of {stats['numbers']} numbers "
         f"in {stats['outputs']} outputs", "0 untraceable",
         "PASS" if stats["untraceable"] == 0 else "FAIL"),
        ("Groundedness of causal sentences (Markdown, id+en)",
         f"{stats['grounded']}/{stats['causal']} ({grounded_pct:.1f}%)", "100%",
         "PASS" if stats["grounded"] == stats["causal"] else "FAIL"),
        ("Controlled vocabulary", f"{stats['banned']} banned terms", "0",
         "PASS" if stats["banned"] == 0 else "FAIL"),
        ("Tamper detection (one number changed per brief)",
         f"{stats['tamper_caught']}/{stats['tampered']} ({tamper_pct:.1f}%)", "report",
         "INFO"),
        ("Adversarial LLM drafts fall back to template",
         f"{stats['llm_fallback']}/{stats['llm_adversarial']}", "100%",
         "PASS" if stats["llm_fallback"] == stats["llm_adversarial"] else "FAIL"),
    ]
    lines = [
        "# Brief eval report (AI-05)",
        "",
        f"Generated by `eval/brief_eval.py` on {GEN_DATE.isoformat()}, seed {SEED}, "
        f"{N} **SYNTHETIC** fact tables (random values, not real data). No real LLM was "
        "called; the LLM path is tested with adversarial fake drafts.",
        "",
        "| Test | Result | Target | Status |",
        "|---|---|---|---|",
        *[f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows],
        "",
        "## Rules fired across the 100 tables",
        "",
        "| Rule | Count |",
        "|---|---|",
        *[f"| {k} | {v} |" for k, v in sorted(rule_counts.items())],
        "",
        "## Notes",
        "",
        "- A tampered number can escape detection only when the new value happens to match "
        "another fact in the same table within rounding tolerance (for example a changed "
        "rank that equals another integer fact). The verifier checks provenance against the "
        "whole table, not position.",
        "- Numbers that are labels, not facts (evidence IDs, ISO generation date, data "
        "version, satellite names, fixed citations and data sources) are stripped before "
        "checking.",
    ]
    if untraceable_examples:
        lines += ["", "## Untraceable examples", "", *[f"- {e}" for e in untraceable_examples]]
    if ungrounded_examples:
        lines += ["", "## Ungrounded examples", "", *[f"- {e}" for e in ungrounded_examples]]
    out = ROOT / "eval" / "report.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    failed = any(r[3] == "FAIL" for r in rows)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
