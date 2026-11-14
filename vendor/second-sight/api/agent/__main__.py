"""CLI: python -m api.agent "Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain" --locale id --trace"""
from __future__ import annotations

import argparse
import sys

from .planner import ask, client_from_env, render_trace, trace_to_json


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m api.agent")
    ap.add_argument("question")
    ap.add_argument("--locale", default="id", choices=["id", "en"])
    ap.add_argument("--trace", action="store_true", help="print the step timeline")
    ap.add_argument("--json", action="store_true", help="print trace JSON")
    ap.add_argument("--no-llm", action="store_true", help="force the rule-based planner")
    a = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass
    llm = None if a.no_llm else client_from_env()
    print(f"[planner: {llm.name if llm else 'rule-based (no LLM key; deterministic)'}]")
    out = ask(a.question, a.locale, llm)
    if a.json:
        print(trace_to_json(out["trace"], out))
        return 0
    if a.trace:
        print(render_trace(out["trace"]))
        print("-" * 60)
    print(out["text"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
