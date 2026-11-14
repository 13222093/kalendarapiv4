"""Second Sight alert brief: fact table, rule-based explainer, template
renderer and numeric verifier (tickets AI-01..AI-05). No LLM required.

Backend entry point::

    from api.brief import make_brief
    out = make_brief(record, locale="id", fmt="md")   # "md" | "html" | "wa"
    out["text"], out["verified"], out["untraceable"], out["facts"], out["findings"]
"""
from __future__ import annotations

from typing import Any, Mapping

from .facts import FACT_TABLE_JSON_SCHEMA, FactTable, build_fact_table  # noqa: F401
from .render import to_html, to_markdown, to_whatsapp
from .rules import explain
from .verify import verify_text

_RENDER = {"md": to_markdown, "html": to_html, "wa": to_whatsapp}


def make_brief(record: Mapping[str, Any], locale: str = "id", fmt: str = "md",
               **render_kw: Any) -> dict[str, Any]:
    """Build facts, fire rules, render one format and verify it in one call."""
    ft = build_fact_table(record)
    findings = explain(ft)
    text = _RENDER[fmt](ft, locale, findings=findings, **render_kw)
    res = verify_text(text, ft, locale)
    return {
        "text": text,
        "format": fmt,
        "locale": locale,
        "verified": res.ok,
        "untraceable": [n.raw for n in res.untraceable],
        "facts": ft.to_dict(),
        "findings": [{"rule_id": f.rule_id, "severity": f.severity,
                      "text": f.sentence(locale), "citations": f.citations}
                     for f in findings],
    }
