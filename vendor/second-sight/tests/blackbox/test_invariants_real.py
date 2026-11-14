"""QA white-box invariants on REAL derived data in $SS_DATA_DIR (skipped if absent).

Covers: national = sum of regions, no duplicate keys in daily_cell, era boundaries of the
harmonized series, kappa in (0, 1) on real monthly_stratum, brief verifier on real-data facts.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

DATA = Path(os.environ.get("SS_DATA_DIR", "D:/Lomba/Hackathon/nasa/second-sight-data"))
DERIVED = DATA / "derived"
BUNDLE = DATA / "bundle"

needs_derived = pytest.mark.skipif(not (DERIVED / "monthly_stratum.parquet").exists(),
                                   reason="real derived data not available")
needs_bundle = pytest.mark.skipif(not (BUNDLE / "index.json").exists(), reason="bundle not available")


@pytest.fixture(scope="module")
def ms() -> pd.DataFrame:
    return pd.read_parquet(DERIVED / "monthly_stratum.parquet")


def to_science_schema(ms: pd.DataFrame) -> pd.DataFrame:
    """Adapter: pipeline/data monthly_stratum -> pipeline/science schema (QA-side, see BUG report)."""
    out = ms.copy()
    m = pd.to_datetime(out["month"])
    out["year"], out["month"] = m.dt.year, m.dt.month
    if "is_peat" not in out:
        out["is_peat"] = out["peat"].astype(str)
    if "cell_days" not in out:
        out["cell_days"] = out["n_cells"]
    return out


# ---------------------------------------------------------------- data (DAT-08/09)
@needs_derived
def test_daily_cell_no_duplicate_keys():
    duckdb = pytest.importorskip("duckdb")
    p = (DERIVED / "daily_cell.parquet").as_posix()
    con = duckdb.connect()
    n, nd = con.execute(
        f"SELECT count(*), count(DISTINCT (local_date, cell_id, satellite, daynight)) FROM '{p}'").fetchone()
    assert n == nd, f"{n - nd} duplicate (local_date, cell_id, satellite, daynight) rows"
    nulls = con.execute(
        f"SELECT count(*) FROM '{p}' WHERE local_date IS NULL OR cell_id IS NULL OR satellite IS NULL").fetchone()[0]
    assert nulls == 0


@needs_derived
def test_monthly_stratum_conserves_daily_cell(ms):
    duckdb = pytest.importorskip("duckdb")
    p = (DERIVED / "daily_cell.parquet").as_posix()
    con = duckdb.connect()
    dc = con.execute(f"SELECT satellite, count(*) n FROM '{p}' GROUP BY 1").df().set_index("satellite")["n"]
    st = ms.groupby("satellite")["n_cells"].sum()
    for sat in dc.index:
        assert int(st.get(sat, 0)) == int(dc[sat]), sat


@pytest.mark.skipif(not (DERIVED / "monthly_province_labeled.parquet").exists(), reason="labels not built")
def test_national_equals_sum_of_provinces_labeled():
    """DAT-09: national total = sum of provinces (on the labelled outputs of pipeline.data.labels)."""
    duckdb = pytest.importorskip("duckdb")
    con = duckdb.connect()
    p = (DERIVED / "daily_cell.parquet").as_posix()
    lab = (DERIVED / "daily_cell_labeled.parquet").as_posix()
    nat = dict(con.execute(f"SELECT satellite, count(*) FROM '{p}' GROUP BY 1").fetchall())
    mp = pd.read_parquet(DERIVED / "monthly_province_labeled.parquet")
    byp = mp.groupby("satellite")["n_cells"].sum()
    for sat, c in nat.items():
        assert int(byp.get(sat, 0)) == c, f"{sat}: sum of provinces {int(byp.get(sat, 0))} != national {c}"
    if (DERIVED / "daily_cell_labeled.parquet").exists():
        n, n_prov, n_peat = con.execute(f"SELECT count(*), count(province), count(peat) FROM '{lab}'").fetchone()
        assert n == sum(nat.values())
        assert n_prov >= 0.99 * n, f"province labelled for only {n_prov}/{n}"
        assert n_peat == n


@needs_derived
@pytest.mark.xfail(reason="DAT-09/DAT-03: labels are only in daily_cell_labeled.parquet; the canonical "
                          "daily_cell.parquet still has NULL province/regency/khg_id/is_peat", strict=False)
def test_national_equals_sum_of_provinces_and_labels_joined():
    duckdb = pytest.importorskip("duckdb")
    p = (DERIVED / "daily_cell.parquet").as_posix()
    con = duckdb.connect()
    n, n_prov, n_peat = con.execute(
        f"SELECT count(*), count(province), count(is_peat) FROM '{p}'").fetchone()
    assert n_prov > 0.95 * n, f"province labelled for only {n_prov}/{n} cell-days"
    assert n_peat > 0.95 * n, f"is_peat labelled for only {n_peat}/{n} cell-days"
    tot = con.execute(f"SELECT satellite, count(*) FROM '{p}' GROUP BY 1").fetchall()
    byp = dict(con.execute(f"SELECT satellite, count(*) FROM '{p}' WHERE province IS NOT NULL GROUP BY 1").fetchall())
    for sat, c in tot:
        assert byp.get(sat, 0) == c, sat


@needs_derived
def test_monthly_stratum_unique_and_nonnegative(ms):
    keys = [c for c in ["month", "island_region", "season", "daynight", "peat", "satellite"] if c in ms]
    assert not ms.duplicated(keys).any()
    assert (ms["n_cells"] >= 0).all()
    assert ms["island_region"].nunique() == 5


@needs_bundle
@needs_derived
def test_bundle_national_equals_sum_of_regions(ms):
    idx = json.loads((BUNDLE / "index.json").read_text(encoding="utf-8"))
    raw_cols = list(idx["raw_columns"].values())
    nat = pd.DataFrame(json.loads((BUNDLE / "monthly_IDN.json").read_text(encoding="utf-8")))
    regs = [a for a in idx["aois"] if a["level"] == "island_region"]
    assert len(regs) == 5
    parts = pd.concat([pd.DataFrame(json.loads((BUNDLE / a["file"]).read_text(encoding="utf-8"))) for a in regs])
    s = parts.groupby(["year", "month"])[raw_cols].sum(min_count=1).reset_index()
    m = nat.merge(s, on=["year", "month"], suffixes=("", "_sum"), how="outer", indicator=True)
    assert (m["_merge"] == "both").all(), "months differ between national and regions"
    for c in raw_cols:
        a, b = m[c].fillna(0).to_numpy(), m[f"{c}_sum"].fillna(0).to_numpy()
        assert np.array_equal(a, b), f"{c}: national != sum of regions in {int((a != b).sum())} months"
    # national bundle also equals monthly_stratum summed over all strata
    inv = {v: k for k, v in idx["raw_columns"].items()}
    g = ms.assign(y=pd.to_datetime(ms["month"]).dt.year, mo=pd.to_datetime(ms["month"]).dt.month)
    tot = g.groupby(["y", "mo", "satellite"])["n_cells"].sum()
    for _, r in nat.iterrows():
        if bool(r.get("flag_nrt")):  # NRT months come from monthly_stratum_2026nrt, not the archive table
            continue
        for c in raw_cols:
            if pd.notna(r[c]):
                assert int(r[c]) == int(tot.get((r["year"], r["month"], inv[c]), 0)), (r["year"], r["month"], c)


# ---------------------------------------------------------------- science (CAL-01/04)
def test_era_boundaries():
    from pipeline.science.series import assign_era
    from pipeline.science.common import AQUA, NOAA20, SNPP, TERRA
    ym = pd.period_range("2000-11", "2026-12", freq="M")
    era = assign_era(ym.year.to_numpy(), ym.month.to_numpy())
    got = dict(zip(ym.strftime("%Y-%m"), era))
    assert got["2000-11"] == TERRA and got["2002-06"] == TERRA
    assert got["2002-07"] == AQUA and got["2021-12"] == AQUA
    assert got["2022-01"] == SNPP and got["2026-10"] == SNPP
    assert got["2026-11"] == NOAA20
    # monotone: each era is one contiguous block
    changes = [k for k, (a, b) in enumerate(zip(era[:-1], era[1:])) if a != b]
    assert len(changes) == 3


@needs_derived
def test_kappa_in_unit_interval_on_real_data(ms):
    from pipeline.science.calibrate import fit_kappa
    df = to_science_schema(ms)
    fit = fit_kappa(df, n_boot=50)
    k = fit.table["kappa"].to_numpy(dtype=float)
    k = k[np.isfinite(k)]
    assert k.size > 0
    assert ((k > 0) & (k < 1)).all(), f"kappa outside (0,1): {np.round(k[(k <= 0) | (k >= 1)], 3)}"


@needs_derived
def test_harmonized_series_eras_on_real_data(ms):
    from pipeline.science.calibrate import fit_kappa
    from pipeline.science.series import build_series
    from pipeline.science.chain import terra_to_aqua
    df = to_science_schema(ms)
    kf = fit_kappa(df, n_boot=30)
    try:
        ta = terra_to_aqua(df, n_boot=30)
    except Exception:  # noqa: BLE001 - chain may need more overlap than available
        ta = None
    s = build_series(df, kf, terra_aqua=ta)
    s = s.sort_values(["year", "month"])
    ym = s["year"] * 100 + s["month"]
    assert set(s.loc[ym <= 200206, "sensor_used"]) <= {"Terra"}
    assert set(s.loc[(ym >= 200207) & (ym <= 202112), "sensor_used"]) == {"Aqua"}
    assert set(s.loc[(ym >= 202201) & (ym <= 202610), "sensor_used"]) <= {"SNPP"}
    h = s["H"].to_numpy(dtype=float)
    assert np.nanmin(h) >= 0
    if {"H_lo", "H_hi"} <= set(s):
        ok = s[["H_lo", "H", "H_hi"]].dropna()
        assert ((ok["H_lo"] <= ok["H"] + 1e-9) & (ok["H"] <= ok["H_hi"] + 1e-9)).all()
    # Aqua era: H equals raw Aqua cell-days summed over strata
    aq = df[(df["satellite"] == "Aqua")].groupby(["year", "month"])["cell_days"].sum()
    sa = s[(ym >= 200207) & (ym <= 202112)].set_index(["year", "month"])["H"]
    j = sa.to_frame().join(aq.rename("A"), how="inner")
    assert np.allclose(j["H"], j["A"])


# ---------------------------------------------------------------- brief (AI-05)
@needs_bundle
@pytest.mark.parametrize("locale", ["id", "en"])
@pytest.mark.parametrize("fmt", ["md", "html", "wa"])
def test_brief_verifier_zero_untraceable_on_real_months(locale, fmt):
    from api.brief import make_brief
    nat = pd.DataFrame(json.loads((BUNDLE / "monthly_region-kalimantan.json").read_text(encoding="utf-8")))
    nat = nat[nat["A_raw"].notna()]
    bad = []
    for _, r in nat.iterrows():
        if r["month"] not in (8, 9, 10) or r["year"] < 2003:
            continue
        same = nat[(nat["month"] == r["month"]) & nat["year"].between(2003, 2022)]["A_raw"]
        rec = {"aoi_name": "Kalimantan", "aoi_type": "pulau", "period": f"{int(r.year)}-{int(r.month):02d}",
               "H": float(r["A_raw"]), "baseline_median": float(same.median()),
               "percentile": float((same < r["A_raw"]).mean() * 100), "nrt": bool(r["flag_nrt"])}
        out = make_brief(rec, locale, fmt)
        if out["untraceable"]:
            bad.append((rec["period"], out["untraceable"]))
    assert bad == []
