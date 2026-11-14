"""Shared helpers: data directory, polite HTTP download, provenance sidecars.

AI-assisted code (see docs/ai_acknowledgement.md).
Downloaded files live OUTSIDE the repo under ${SS_DATA_DIR}/support/.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
from pathlib import Path

import requests

DEFAULT_DATA_DIR = "D:/Lomba/Hackathon/nasa/second-sight-data"
USER_AGENT = "second-sight-pipeline/0.1 (research; NASA Space Apps 2026)"


def support_dir(*parts: str) -> Path:
    """Return ${SS_DATA_DIR}/support/<parts...>, creating it."""
    root = Path(os.environ.get("SS_DATA_DIR", DEFAULT_DATA_DIR)) / "support"
    p = root.joinpath(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


def utc_now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def http_get(url: str, *, params: dict | None = None, timeout: int = 120, **kw) -> requests.Response:
    headers = {"User-Agent": USER_AGENT, **kw.pop("headers", {})}
    r = requests.get(url, params=params, timeout=timeout, headers=headers, **kw)
    r.raise_for_status()
    return r


def write_provenance(path: Path, *, source_url: str, license: str, notes: str = "", **extra) -> Path:
    """Write <file>.source.json next to a downloaded file (feeds DAT-04 manifest)."""
    meta = {
        "file": path.name,
        "source_url": source_url,
        "license": license,
        "downloaded_utc": utc_now_iso(),
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
        "notes": notes,
        **extra,
    }
    side = path.with_name(path.name + ".source.json")
    side.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return side


def download(url: str, dest: Path, *, license: str, notes: str = "", force: bool = False, **extra) -> Path:
    """Download url -> dest (skip if exists) and record provenance."""
    if dest.exists() and not force:
        return dest
    r = http_get(url, timeout=600, stream=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with open(tmp, "wb") as f:
        for chunk in r.iter_content(1 << 20):
            f.write(chunk)
    tmp.replace(dest)
    write_provenance(dest, source_url=url, license=license, notes=notes, **extra)
    return dest
