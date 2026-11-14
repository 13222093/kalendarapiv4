"""DAT-04: data manifest (S1 quality gate).

Writes ``$SS_DATA_DIR/data_manifest.json`` with, per raw file: source URL, download
date (file mtime, UTC), sha256, size and row count. Row counts come from
``raw_row_counts.csv`` written by ``ingest.py`` (rows of the CSV == rows of its Parquet).

Usage::

    python -m pipeline.data.manifest [--copy-to docs/data/data_manifest.json]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path

from pipeline.data import config


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def build() -> dict:
    counts: dict[str, dict] = {}
    counts_path = config.data_dir() / "raw_row_counts.csv"
    if counts_path.exists():
        with open(counts_path, newline="") as f:
            for r in csv.DictReader(f):
                counts[Path(r["url"]).name] = r

    files = []
    for p in sorted(config.raw_csv_dir().glob("*/*.csv")):
        c = counts.get(p.name, {})
        files.append({
            "file": p.relative_to(config.data_dir()).as_posix(),
            "source": p.parent.name,
            "year": int(c["year"]) if c else None,
            "url": c.get("url"),
            "downloaded_utc": dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc).isoformat(timespec="seconds"),
            "bytes": p.stat().st_size,
            "sha256": sha256(p),
            "rows": int(c["rows"]) if c else None,
            "product": "FIRMS standard processing (SP) country archive",
            "license": "NASA FIRMS open data (no restrictions; cite LANCE/FIRMS)",
        })
    missing = [r for r in counts.values() if r["status"] != "ok"]
    m = {
        "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "data_dir": str(config.data_dir()),
        "n_files": len(files),
        "total_rows": sum(f["rows"] or 0 for f in files),
        "missing": [{"source": r["source"], "year": int(r["year"]), "status": r["status"]} for r in missing],
        "files": files,
    }
    m["nrt_files"] = build_nrt()
    return m


def build_nrt() -> list[dict]:
    """DAT-02 entries (``raw_nrt/``), from ``raw_nrt_row_counts.csv`` written by ``nrt.py``."""
    path = config.data_dir() / "raw_nrt_row_counts.csv"
    if not path.exists():
        return []
    by_file: dict[str, list[dict]] = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            by_file.setdefault(r["file"], []).append(r)
    out = []
    for rel, rs in sorted(by_file.items()):
        p = config.data_dir() / rel
        if not p.exists():
            continue
        out.append({
            "file": rel,
            "source": rs[0]["source"],
            "year": int(rs[0]["year"]),
            "url": rs[0]["url"],
            "downloaded_utc": dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc).isoformat(timespec="seconds"),
            "bytes": p.stat().st_size,
            "sha256": sha256(p),
            "rows": sum(int(r["rows"]) for r in rs),
            "rows_by_quality": {r["quality"]: int(r["rows"]) for r in rs},
            "date_range": [min(r["first_date"] for r in rs), max(r["last_date"] for r in rs)],
            "product": "FIRMS area-API detections via portolan-mirrors/firms-catalog GeoParquet "
                       "(Source Cooperative), Indonesia bbox 94..142E, 11S..7N",
            "license": "Data CC0-1.0 / NASA FIRMS open data (cite LANCE/FIRMS); mirror code Apache-2.0",
        })
    return out


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--copy-to", type=Path, help="also write a copy here (e.g. docs/data/data_manifest.json)")
    a = ap.parse_args(argv)
    m = build()
    out = config.data_dir() / "data_manifest.json"
    text = json.dumps(m, indent=1)
    out.write_text(text, encoding="utf-8")
    print(f"manifest: {m['n_files']} files, {m['total_rows']:,} rows -> {out}")
    if a.copy_to:
        a.copy_to.parent.mkdir(parents=True, exist_ok=True)
        a.copy_to.write_text(text, encoding="utf-8")
        print(f"copy -> {a.copy_to}")


if __name__ == "__main__":
    main()
