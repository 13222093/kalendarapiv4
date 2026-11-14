"""QA black-box tests: drive public CLIs / published outputs only (exit codes, files, schemas,
locale number formats, CSV header comments, no secrets). Real data from $SS_DATA_DIR."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("SS_DATA_DIR", "D:/Lomba/Hackathon/nasa/second-sight-data"))
DERIVED = DATA / "derived"
BUNDLE = DATA / "bundle"
PY = sys.executable

SECRET_RE = re.compile(
    r"(MAP_KEY\s*[=:]\s*\w+|FIRMS_MAP_KEY|api[_-]?key\s*[=:]|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|"
    r"Bearer\s+[A-Za-z0-9._-]{20,}|password\s*[=:]|token\s*[=:]\s*\w{16,}|\b[0-9a-f]{32}\b)", re.I)

RECORD = {
    "aoi_name": "KHG Sebangau", "aoi_type": "khg", "period": "2019-09",
    "H": 12345.6, "H_lo": 11000.2, "H_hi": 13900.8, "baseline_median": 2468.0,
    "percentile": 96.5, "analog_rank": 2, "analog_n": 7, "enso_class": "el_nino",
    "oni": 0.9, "dmi": 1.8, "rain_90d": 2.4, "observability": 0.72, "triangulation": "A",
    "nrt": False, "data_version": "qa-test",
}


def run(args, **kw):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=kw.pop("timeout", 600), **kw)


# ---------------------------------------------------------------- scripts/pipeline.sh
@pytest.mark.skipif(shutil.which("bash") is None, reason="bash not available")
def test_pipeline_sh_help():
    r = run(["bash", "scripts/pipeline.sh", "help"])
    assert r.returncode == 0, r.stderr
    assert "Usage" in r.stdout


# ---------------------------------------------------------------- python -m api.brief
@pytest.fixture
def record_file(tmp_path):
    p = tmp_path / "record.json"
    p.write_text(json.dumps(RECORD), encoding="utf-8")
    return p


@pytest.mark.parametrize("fmt", ["md", "html", "wa"])
def test_brief_cli_id(record_file, tmp_path, fmt):
    out = tmp_path / f"brief.{fmt}"
    r = run([PY, "-m", "api.brief", str(record_file), "--locale", "id", "--format", fmt, "-o", str(out)])
    assert r.returncode == 0, r.stderr
    t = out.read_text(encoding="utf-8")
    assert t.strip()
    if fmt == "html":
        assert re.search(r"<(html|section|article|div|p)\b", t, re.I)
        assert 'lang="id"' in t or "lang='id'" in t or "<html" not in t.lower()
    # id-ID: thousands '.', decimal ',' briefs round to 3 s.f.: 12.300 (id) vs 12,300 (en)
    assert re.search(r"\b12\.3\d\d\b", t), "Indonesian thousands separator missing"
    assert not re.search(r"\b12,3\d\d\b", t), "English number format leaked into ID brief"
    assert "Sebangau" in t
    assert not SECRET_RE.search(t)


def test_brief_cli_en_stdout(record_file):
    r = run([PY, "-m", "api.brief", str(record_file), "--locale", "en", "--format", "md"])
    assert r.returncode == 0, r.stderr
    assert re.search(r"\b12,3\d\d\b", r.stdout)
    assert not re.search(r"\b12\.3\d\d\b", r.stdout)


def test_brief_cli_bad_args(record_file):
    r = run([PY, "-m", "api.brief", str(record_file), "--locale", "fr"])
    assert r.returncode == 2  # argparse usage error
    r = run([PY, "-m", "api.brief", "does-not-exist.json"])
    assert r.returncode != 0


def test_brief_cli_minimal_record(tmp_path):
    p = tmp_path / "min.json"
    p.write_text(json.dumps({"aoi_name": "Riau", "period": "2015-09", "H": 900, "baseline_median": 300}), encoding="utf-8")
    r = run([PY, "-m", "api.brief", str(p), "--locale", "id", "--format", "html"])
    assert r.returncode == 0, r.stderr
    assert "Riau" in r.stdout


# ---------------------------------------------------------------- pipeline.data on a copy
@pytest.mark.skipif(not (DERIVED / "daily_cell.parquet").exists(), reason="no real daily_cell")
def test_aggregate_cli_on_copy(tmp_path):
    """Re-run `python -m pipeline.data.aggregate` against a COPY of daily_cell (never touches real data)."""
    d = tmp_path / "data" / "derived"
    d.mkdir(parents=True)
    shutil.copy(DERIVED / "daily_cell.parquet", d / "daily_cell.parquet")
    env = {**os.environ, "SS_DATA_DIR": str(tmp_path / "data")}
    r = run([PY, "-m", "pipeline.data.aggregate"], env=env)
    assert r.returncode == 0, r.stderr[-2000:]
    rep = json.loads((d / "aggregate_report.json").read_text(encoding="utf-8"))
    assert rep["conservation"]["ok"] is True
    assert rep["conservation"]["stratum_mismatch"] == 0 and rep["conservation"]["grid_mismatch"] == 0
    import pandas as pd
    ms = pd.read_parquet(d / "monthly_stratum.parquet")
    for c in ["month", "island_region", "season", "daynight", "satellite", "n_cells", "sum_frp"]:
        assert c in ms.columns, c
    ref = pd.read_parquet(DERIVED / "monthly_stratum.parquet")
    assert int(ms["n_cells"].sum()) == int(ref["n_cells"].sum())


# ---------------------------------------------------------------- eval runner
def test_brief_eval_runner(tmp_path):
    p = ROOT / "eval" / "brief_eval.py"
    if not p.exists():
        pytest.skip("eval/brief_eval.py absent")
    before = (ROOT / "eval" / "report.md").read_bytes() if (ROOT / "eval" / "report.md").exists() else None
    try:
        r = run([PY, str(p)])
        assert r.returncode == 0, r.stderr[-2000:]
        assert (ROOT / "eval" / "report.md").exists()
    finally:  # do not leave modified tracked files behind
        if before is not None:
            (ROOT / "eval" / "report.md").write_bytes(before)


# ---------------------------------------------------------------- published bundle (EXP-01/02)
needs_bundle = pytest.mark.skipif(not (BUNDLE / "index.json").exists(), reason="bundle not available")


@needs_bundle
def test_bundle_index_schema():
    idx = json.loads((BUNDLE / "index.json").read_text(encoding="utf-8"))
    for k in ["app", "data_version", "generated_at", "fields", "aois", "unit"]:
        assert k in idx, k
    for a in idx["aois"]:
        f = BUNDLE / a["file"]
        assert f.exists(), a["file"]
        rows = json.loads(f.read_text(encoding="utf-8"))
        rows = rows["rows"] if isinstance(rows, dict) else rows
        assert len(rows) == a["n_months"], a["file"]
        assert set(idx["fields"]) <= set(rows[0].keys()), a["file"]


@needs_bundle
def test_bundle_csv_header_comments_and_columns():
    csvs = sorted((BUNDLE / "csv").glob("*.csv"))
    assert csvs
    for f in csvs:
        lines = f.read_text(encoding="utf-8").splitlines()
        head = [ln for ln in lines[:40] if ln.startswith("#")]
        assert lines[0].startswith("#"), f.name
        keys = {ln[1:].split(":", 1)[0].strip() for ln in head}
        for k in ["data_version", "citation", "license", "filters"]:
            assert k in keys, f"{f.name}: header comment '{k}' missing"
        body = [ln for ln in lines if not ln.startswith("#")]
        assert len(body) >= 2, f.name
        ncol = body[0].count(",")
        assert all(ln.count(",") == ncol for ln in body[1:50] if '"' not in ln), f.name


@needs_bundle
def test_bundle_monthly_csv_columns():
    for f in sorted((BUNDLE / "csv").glob("second_sight_*_monthly.csv")):
        hdr = next(ln for ln in f.read_text(encoding="utf-8").splitlines() if not ln.startswith("#")).split(",")
        for c in ["aoi_id", "year", "month", "H", "H_lo", "H_hi", "sensor_used", "baseline_median", "flag_nrt", "evidence_id"]:
            assert c in hdr, f"{f.name}: column {c} missing"


@needs_bundle
def test_bundle_data_version_consistent():
    idx = json.loads((BUNDLE / "index.json").read_text(encoding="utf-8"))
    versions = {}
    for f in sorted((BUNDLE / "csv").glob("*.csv")):
        m = re.search(r"^# data_version:\s*(\S+)", f.read_text(encoding="utf-8"), re.M)
        versions[f.name] = m.group(1) if m else None
    bad = {k: v for k, v in versions.items() if v != idx["data_version"]}
    assert not bad, f"index.json data_version {idx['data_version'][:12]} != CSV {bad}"


@needs_bundle
def test_bundle_harmonized_flag_matches_content():
    idx = json.loads((BUNDLE / "index.json").read_text(encoding="utf-8"))
    rows = json.loads((BUNDLE / "monthly_IDN.json").read_text(encoding="utf-8"))
    has_h = any(r.get("H") is not None for r in rows)
    assert bool(idx.get("harmonized")) == has_h


@needs_bundle
def test_no_secrets_in_published_outputs():
    hits = []
    for f in list(BUNDLE.rglob("*.json")) + list(BUNDLE.rglob("*.csv")):
        t = f.read_text(encoding="utf-8", errors="replace")
        t = re.sub(r"data_version\W+[0-9a-f]{64}", "", t)  # sha256 version ids are fine
        t = re.sub(r":[0-9a-f]{12}\b", "", t)
        m = SECRET_RE.search(t)
        if m:
            hits.append((f.name, m.group(0)[:20]))
    assert hits == []


# ---------------------------------------------------------------- real science outputs (CAL-01/04)
@pytest.mark.skipif(not (DERIVED / "series_H_national.parquet").exists(), reason="no series_H_national")
def test_real_series_H_era_boundaries():
    import pandas as pd
    s = pd.read_parquet(DERIVED / "series_H_national.parquet")
    ym = s["year"] * 100 + s["month"]
    assert set(s.loc[ym <= 200206, "sensor_used"].dropna()) == {"Terra"}
    assert set(s.loc[(ym >= 200207) & (ym <= 202112), "sensor_used"].dropna()) == {"Aqua"}
    assert set(s.loc[(ym >= 202201) & (ym <= 202610), "sensor_used"].dropna()) <= {"SNPP"}
    assert (s["H"].dropna() >= 0).all()
    iv = s[["H_lo", "H", "H_hi"]].dropna()
    assert ((iv["H_lo"] <= iv["H"] + 1e-6) & (iv["H"] <= iv["H_hi"] + 1e-6)).all()


@pytest.mark.skipif(not (DERIVED / "strata_factors.json").exists(), reason="no strata_factors.json")
def test_real_kappa_in_unit_interval():
    sf = json.loads((DERIVED / "strata_factors.json").read_text(encoding="utf-8"))
    ks = [s["kappa"] for s in sf["strata"] if s.get("kappa") is not None]
    assert ks
    assert all(0 < k < 1 for k in ks), [k for k in ks if not 0 < k < 1]
    for s in sf["strata"]:
        lo, hi = s.get("kappa_lo"), s.get("kappa_hi")
        if lo is not None and hi is not None:
            assert lo <= s["kappa"] <= hi


# ---------------------------------------------------------------- pipeline.export CLIs (to tmp only)
@pytest.mark.skipif(not (DERIVED / "monthly_stratum.parquet").exists(), reason="no real derived data")
def test_export_bundle_cli_to_tmp(tmp_path):
    out = tmp_path / "bundle"
    r = run([PY, "-m", "pipeline.export.bundle", "--out", str(out)], timeout=900)
    assert r.returncode == 0, r.stderr[-2000:]
    info = json.loads(r.stdout[r.stdout.index("{"):])
    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert info["data_version"] == idx["data_version"][:12]
    assert {a["aoi_id"] for a in idx["aois"]} >= {"IDN"}
    for a in idx["aois"]:
        assert (out / a["file"]).exists()
    assert info["grid_max_bytes"] < 5_000_000, "grid file too large for the browser (DAT-09)"


@pytest.mark.skipif(not (DERIVED / "detections.parquet").exists(), reason="no real detections")
def test_export_detections_csv_cli(tmp_path):
    out = tmp_path / "riau.csv"
    r = run([PY, "-m", "pipeline.export.csv_export", "detections", "--bbox", "101", "0", "102", "1",
             "--start", "2019-09-01", "--end", "2019-09-03", "--out", str(out)])
    assert r.returncode == 0, r.stderr[-2000:]
    lines = out.read_text(encoding="utf-8").splitlines()
    assert lines[0].startswith("#")
    hdr = next(ln for ln in lines if not ln.startswith("#")).split(",")
    for c in ["latitude", "longitude", "satellite"]:
        assert any(c in h.lower() for h in hdr), f"column like {c} missing: {hdr}"
    assert not SECRET_RE.search("\n".join(ln for ln in lines if ln.startswith("#")))


def test_export_csv_cli_bad_args():
    r = run([PY, "-m", "pipeline.export.csv_export", "detections", "--bbox", "1", "2"])
    assert r.returncode == 2
