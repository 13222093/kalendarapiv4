"""CLI: python -m api.brief record.json [--locale id|en] [--format md|html|wa] [-o out]

Exit code 2 if the rendered brief contains an untraceable number.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import make_brief


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m api.brief")
    ap.add_argument("record", help="JSON file with one monthly record (see facts.py)")
    ap.add_argument("--locale", default="id", choices=["id", "en"])
    ap.add_argument("--format", default="md", choices=["md", "html", "wa"])
    ap.add_argument("-o", "--out")
    a = ap.parse_args(argv)
    rec = json.loads(Path(a.record).read_text(encoding="utf-8"))
    out = make_brief(rec, a.locale, a.format)
    if a.out:
        Path(a.out).write_text(out["text"], encoding="utf-8")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdout.write(out["text"])
    if not out["verified"]:
        print(f"untraceable numbers: {out['untraceable']}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
