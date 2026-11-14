"""EXP-01: static bundle for the frontend.

Writes ``$SS_DATA_DIR/bundle/`` (never inside the repo):

* ``index.json``             AOI list + metadata (data version, generated_at, windows, files).
* ``monthly_<aoi_id>.json``  one row per month for each preset AOI (frontend schema, see README).
* ``grid005/grid005_<year>.parquet``  monthly 0.05 deg grid split by year for custom AOIs.

AOIs: Indonesia national (``IDN``), the 5 island regions and 34 provinces (``prov-<slug>``); regency
and KHG AOIs follow. 2026 months come from ``*_2026nrt.parquet`` with ``flag_nrt``.

Harmonized values (H, intervals, baseline, pct_rank, obs_class, sensor_used, agreement)
come only from ``pipeline.science`` (see ``_science_adapter``). When it is not importable the
bundle carries raw columns only, H fields are ``null`` and ``index.json`` says
``"harmonized": false``. Nothing harmonized is ever fabricated here.

Usage::

    python -m pipeline.export.bundle [--out DIR]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import re
import importlib
import json
import math
from pathlib import Path

import pandas as pd

try:  # duckdb optional: pandas/pyarrow fallbacks
    import duckdb
except ImportError:  # pragma: no cover
    duckdb = None

from pipeline.data import config

# satellite label in derived data -> raw column in the frontend schema
SAT_COLS = {"Aqua": "A_raw", "Terra": "T_raw", "SNPP": "V_raw", "NOAA20": "N20_raw"}

REGIONS = {
    "Sumatra": "region-sumatra",
    "Kalimantan": "region-kalimantan",
    "Sulawesi": "region-sulawesi",
    "Papua": "region-papua",
    "Jawa-NusaTenggara-Bali-Maluku": "region-jnbm",
}
NATIONAL_ID = "IDN"

CALIBRATION_WINDOW = [2012, 2021]  # 08 §7.6.1 D-3
BASELINE_PERIOD = [2003, 2022]     # 08 §7.6.1 D-10
SP_LAST_YEAR = 2025                # standard-processing archive ends here; later months are NRT

FIELDS = ["aoi_id", "year", "month", "H", "H_lo", "H_hi", "A_raw", "T_raw", "V_raw", "N20_raw",
          "sensor_used", "baseline_median", "pct_rank", "obs_class", "flag_nrt", "flag_partial",
          "agreement"]
SCIENCE_FIELDS = ["H", "H_lo", "H_hi", "sensor_used", "baseline_median", "pct_rank",
                  "obs_class", "agreement"]


REGION_NAMES = {  # display names (id, en)
    "Sumatra": ("Sumatera", "Sumatra"), "Kalimantan": ("Kalimantan", "Kalimantan (Borneo)"),
    "Sulawesi": ("Sulawesi", "Sulawesi"), "Papua": ("Papua", "Papua"),
    "Jawa-NusaTenggara-Bali-Maluku": ("Jawa-Nusa Tenggara-Bali-Maluku",
                                      "Java-Nusa Tenggara-Bali-Maluku"),
}
J = "Jawa-NusaTenggara-Bali-Maluku"
# province (geoBoundaries gbHumanitarian ADM1 name as labelled) -> parent island region
PROVINCE_ISLAND = {
    "Aceh": "Sumatra", "Sumatera Utara": "Sumatra", "Sumatera Barat": "Sumatra", "Riau": "Sumatra",
    "Kepulauan Riau": "Sumatra", "Jambi": "Sumatra", "Sumatera Selatan": "Sumatra",
    "Kepulauan Bangka Belitung": "Sumatra", "Bengkulu": "Sumatra", "Lampung": "Sumatra",
    "Kalimantan Barat": "Kalimantan", "Kalimantan Tengah": "Kalimantan",
    "Kalimantan Selatan": "Kalimantan", "Kalimantan Timur": "Kalimantan",
    "Kalimantan Utara": "Kalimantan",
    "Sulawesi Utara": "Sulawesi", "Gorontalo": "Sulawesi", "Sulawesi Tengah": "Sulawesi",
    "Sulawesi Barat": "Sulawesi", "Sulawesi Selatan": "Sulawesi", "Sulawesi Tenggara": "Sulawesi",
    "Papua": "Papua", "Papua Barat": "Papua",
    "Dki Jakarta": J, "Banten": J, "Jawa Barat": J, "Jawa Tengah": J,
    "Daerah Istimewa Yogyakarta": J, "Jawa Timur": J, "Bali": J, "Nusa Tenggara Barat": J,
    "Nusa Tenggara Timur": J, "Maluku": J, "Maluku Utara": J,
}
FEATURED_PROVINCES = ["Riau", "Kalimantan Tengah", "Sumatera Selatan", "Jambi", "Kalimantan Barat"]
PROVINCE_EN = {
    "Sumatera Utara": "North Sumatra", "Sumatera Barat": "West Sumatra",
    "Sumatera Selatan": "South Sumatra", "Kepulauan Riau": "Riau Islands",
    "Kepulauan Bangka Belitung": "Bangka Belitung Islands",
    "Kalimantan Barat": "West Kalimantan", "Kalimantan Tengah": "Central Kalimantan",
    "Kalimantan Selatan": "South Kalimantan", "Kalimantan Timur": "East Kalimantan",
    "Kalimantan Utara": "North Kalimantan", "Sulawesi Utara": "North Sulawesi",
    "Sulawesi Tengah": "Central Sulawesi", "Sulawesi Barat": "West Sulawesi",
    "Sulawesi Selatan": "South Sulawesi", "Sulawesi Tenggara": "Southeast Sulawesi",
    "Papua Barat": "West Papua", "Dki Jakarta": "Jakarta", "Jawa Barat": "West Java",
    "Jawa Tengah": "Central Java", "Jawa Timur": "East Java",
    "Daerah Istimewa Yogyakarta": "Yogyakarta", "Nusa Tenggara Barat": "West Nusa Tenggara",
    "Nusa Tenggara Timur": "East Nusa Tenggara", "Maluku Utara": "North Maluku",
}


def province_id(name: str) -> str:
    return "prov-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def aoi_list(provinces=None) -> list[dict]:
    """National + 5 island regions + provinces (featured provinces first)."""
    aois = [{"aoi_id": NATIONAL_ID, "name": "Indonesia", "name_id": "Indonesia",
             "name_en": "Indonesia", "level": "national", "island_region": None}]
    for reg, aid in REGIONS.items():
        nid, nen = REGION_NAMES.get(reg, (reg, reg))
        aois.append({"aoi_id": aid, "name": reg, "name_id": nid, "name_en": nen,
                     "level": "island_region", "island_region": reg})
    provs = [] if provinces is None else list(provinces)
    provs = [p for p in FEATURED_PROVINCES if p in provs] + \
        [p for p in provs if p not in FEATURED_PROVINCES]
    for p in provs:
        aois.append({"aoi_id": province_id(p), "name": p, "name_id": p,
                     "name_en": PROVINCE_EN.get(p, p), "level": "province",
                     "island_region": PROVINCE_ISLAND.get(p), "province": p,
                     "featured": p in FEATURED_PROVINCES})
    return aois


def province_areas() -> dict:
    """ADM1 area in km2 (geoBoundaries gbHumanitarian, equal-area EPSG:6933); {} if unavailable."""
    try:
        import geopandas as gpd
        from pipeline.support import boundaries
        g = gpd.read_file(boundaries.boundary_path("ADM1"))
        a = g.to_crs(6933).area / 1e6
        return {str(n).title(): round(float(v), 1) for n, v in zip(g[boundaries.NAME_FIELD], a)}
    except Exception:  # noqa: BLE001
        return {}


def data_version(manifest: Path | None = None) -> str:
    """sha256 of ``data_manifest.json`` (the data version shown everywhere)."""
    manifest = manifest or config.data_dir() / "data_manifest.json"
    if not manifest.exists():
        return "unknown"
    return hashlib.sha256(manifest.read_bytes()).hexdigest()


def with_nrt(sp: pd.DataFrame, nrt: pd.DataFrame | None) -> pd.DataFrame:
    """Append 2026 NRT/SP-2026 rows to the SP archive without overlap.

    SP rows at or after the first NRT-table month are dropped (the SP tail month is a partial
    archive edge). ``flag_nrt`` is per row: False for the SP archive, the NRT table's own flag
    for 2026 rows (missing flag -> True, never silently treated as SP)."""
    sp = sp.copy()
    sp["month"] = pd.to_datetime(sp["month"])
    sp["flag_nrt"] = False
    if nrt is None or not len(nrt):
        return sp
    nrt = nrt.copy()
    nrt["month"] = pd.to_datetime(nrt["month"])
    if "flag_nrt" not in nrt:
        nrt["flag_nrt"] = True
    nrt["flag_nrt"] = nrt["flag_nrt"].fillna(True).astype(bool)
    sp = sp[sp["month"] < nrt["month"].min()]
    return pd.concat([sp, nrt], ignore_index=True)


def load_stratum(path: Path | None = None, nrt_path: Path | None = None) -> pd.DataFrame:
    path = Path(path or config.derived_dir() / "monthly_stratum.parquet")
    nrt_path = Path(nrt_path or path.with_name(path.stem + "_2026nrt.parquet"))
    return with_nrt(pd.read_parquet(path), pd.read_parquet(nrt_path) if nrt_path.exists() else None)


def load_province(path: Path | None = None, nrt_path: Path | None = None,
                  stratum_nrt: Path | None = None) -> pd.DataFrame | None:
    """Province-labelled monthly table + 2026 append (island_region = parent island), or None.

    The province NRT table has no flag_nrt column; it is taken per month from the island
    stratum NRT table (same source rows)."""
    path = Path(path or config.derived_dir() / "monthly_province_labeled.parquet")
    if not path.exists():
        return None
    nrt_path = Path(nrt_path or path.with_name(path.stem + "_2026nrt.parquet"))
    nrt = pd.read_parquet(nrt_path) if nrt_path.exists() else None
    if nrt is not None and "flag_nrt" not in nrt:
        snrt = Path(stratum_nrt or path.with_name("monthly_stratum_2026nrt.parquet"))
        hint = {}
        if snrt.exists():
            t = pd.read_parquet(snrt)
            hint = t.groupby(pd.to_datetime(t["month"]))["flag_nrt"].any().to_dict()
        nrt = nrt.copy()
        nrt["flag_nrt"] = [bool(hint.get(m, True)) for m in pd.to_datetime(nrt["month"])]
    p = with_nrt(pd.read_parquet(path), nrt)
    p["island_region"] = p["province"].map(PROVINCE_ISLAND)
    return p


def raw_monthly(stratum: pd.DataFrame, island_region: str | None,
                province: str | None = None, province_table: pd.DataFrame | None = None,
                today: dt.date | None = None) -> pd.DataFrame:
    """Monthly raw fire cell-days per satellite for one AOI.

    Months run from the first to the last month in the whole stratum table. A satellite's
    column is 0 inside its national active window (first..last month it has any data) and
    ``None`` outside it (sensor not flying / not in archive), so "no fire" and "no sensor"
    stay distinguishable. The series ends at the last month in which at least two satellites
    report nationally: a lone tail month (e.g. 2026-01 holding only the few UTC-31-Dec
    detections shifted to local 1 Jan) is a partial archive edge, not a real month.
    """
    s = stratum.copy()
    s["month"] = pd.to_datetime(s["month"])
    n_sat = s.groupby("month")["satellite"].nunique()
    last = n_sat[n_sat >= 2].index.max() if (n_sat >= 2).any() else s["month"].max()
    s = s[s["month"] <= last]
    active = s.groupby("satellite")["month"].agg(["min", "max"])
    nrt_by_month = (s.groupby("month")["flag_nrt"].any() if "flag_nrt" in s
                    else pd.Series(dtype=bool))
    if province is not None:
        s = province_table.copy()
        s["month"] = pd.to_datetime(s["month"])
        s = s[(s["province"] == province) & (s["month"] <= last)]
    elif island_region is not None:
        s = s[s["island_region"] == island_region]
    months = pd.date_range(pd.to_datetime(stratum["month"]).min(), last, freq="MS")
    wide = (s.groupby(["month", "satellite"])["n_cells"].sum().unstack("satellite")
            .reindex(months))
    out = pd.DataFrame({"month_ts": months})
    for sat, col in SAT_COLS.items():
        vals = wide[sat] if sat in wide.columns else pd.Series(index=months, dtype=float)
        vals = vals.fillna(0)
        if sat in active.index:
            lo, hi = active.loc[sat, "min"], active.loc[sat, "max"]
            vals[(months < lo) | (months > hi)] = math.nan
        else:
            vals[:] = math.nan
        out[col] = vals.to_numpy()
    out["year"] = out["month_ts"].dt.year
    out["month"] = out["month_ts"].dt.month
    flag = nrt_by_month.reindex(months)
    out["flag_nrt"] = [bool(f) if pd.notna(f) else bool(m.year > SP_LAST_YEAR)
                       for f, m in zip(flag.to_numpy(), months)]
    today = today or dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).date()
    out["flag_partial"] = (out["month_ts"] >= pd.Timestamp(today.year, today.month, 1)).to_numpy()
    return out.drop(columns="month_ts")


def to_science_schema(stratum: pd.DataFrame, season_of_month: dict) -> pd.DataFrame:
    """derived/monthly_stratum (month date, peat, n_cells) -> science schema
    (year, month int, season, is_peat, cell_days). Season is recomputed from the calendar
    month with the science module's definition (season is a pure function of month)."""
    m = pd.to_datetime(stratum["month"])
    out = pd.DataFrame({
        "year": m.dt.year, "month": m.dt.month,
        "island_region": stratum["island_region"], "daynight": stratum["daynight"],
        "is_peat": stratum["peat"] if "peat" in stratum else stratum["is_peat"],
        "satellite": stratum["satellite"],
        "cell_days": stratum["n_cells"] if "n_cells" in stratum else stratum["cell_days"],
    })
    out["season"] = out["month"].map(season_of_month)
    return out


def _science_adapter(stratum: pd.DataFrame, province_table: pd.DataFrame | None = None):
    """Return ``f(aoi_id, raw_df) -> DataFrame`` built on pipeline.science, or None.

    Uses CAL-01 ``fit_kappa``, CAL-03 chain factors, CAL-04 ``build_series`` and ANO-01
    baseline/percentile. Any import/fit failure -> None (raw-only bundle, never fabricated).
    """
    try:
        series = importlib.import_module("pipeline.science.series")
        calibrate = importlib.import_module("pipeline.science.calibrate")
        chain = importlib.import_module("pipeline.science.chain")
        baseline = importlib.import_module("pipeline.science.baseline")
        common = importlib.import_module("pipeline.science.common")
    except Exception:  # noqa: BLE001 - absent science module means raw-only
        return None
    try:
        ms = to_science_schema(stratum, common.SEASON_OF_MONTH)
        kappa = calibrate.fit_kappa(ms)
        ta, ns = chain.terra_to_aqua(ms), chain.noaa20_to_snpp(ms)
        nat = series.build_series(ms, kappa, ta, ns, by=[])
        reg = series.build_series(ms, kappa, ta, ns, by=["island_region"])
    except Exception as e:  # noqa: BLE001
        print(f"[bundle] science fit failed, exporting raw only: {e!r}")
        return None
    per_aoi = {NATIONAL_ID: nat}
    if province_table is not None:
        try:  # provinces reuse the parent island's kappa strata (island_region key)
            pt = province_table[province_table["island_region"].notna()]
            pms = to_science_schema(pt, common.SEASON_OF_MONTH)
            pms["province"] = pt["province"].to_numpy()
            prov = series.build_series(pms, kappa, ta, ns, by=["province"])
            for name in prov["province"].unique():
                per_aoi[province_id(name)] = prov[prov["province"] == name].drop(
                    columns=[c for c in ("province", "island_region") if c in prov])
        except Exception as e:  # noqa: BLE001
            print(f"[bundle] province series failed, provinces raw only: {e!r}")
    for name, aid in REGIONS.items():
        per_aoi[aid] = reg[reg["island_region"] == name].drop(columns="island_region")

    def harmonized_monthly(aoi_id: str, raw: pd.DataFrame) -> pd.DataFrame | None:
        s = per_aoi.get(aoi_id)
        if s is None or not len(s):
            return None
        s = s[["year", "month", "H", "H_lo", "H_hi", "sensor_used"]].merge(
            raw[["year", "month"] + list(SAT_COLS.values())], on=["year", "month"], how="right")
        # H is null where the era's sensor has no data in the archive (not 0 fire)
        col = s["sensor_used"].map(SAT_COLS)
        missing = [pd.isna(r[c]) if isinstance(c, str) else True
                   for c, (_, r) in zip(col, s.iterrows())]
        s.loc[missing, ["H", "H_lo", "H_hi"]] = math.nan
        ok = s[s["H"].notna()].copy()
        base = baseline.compute_baseline(ok, value="H")
        an = baseline.add_anomalies(ok, base, value="H")
        s = s.merge(an[["year", "month", "median", "percentile"]], on=["year", "month"], how="left")
        s = s.rename(columns={"median": "baseline_median", "percentile": "pct_rank"})
        return s[["year", "month", "H", "H_lo", "H_hi", "sensor_used", "baseline_median",
                  "pct_rank"]]

    harmonized_monthly.meta = {"kappa": kappa.meta, "terra_to_aqua": ta.meta,
                               "noaa20_to_snpp": ns.meta}
    return harmonized_monthly


def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):
        v = v.item()
        if isinstance(v, float) and math.isnan(v):
            return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def monthly_rows(aoi: dict, stratum: pd.DataFrame, science=None,
                 province_table: pd.DataFrame | None = None) -> tuple[list[dict], bool]:
    raw = raw_monthly(stratum, aoi["island_region"], aoi.get("province"), province_table)
    harmonized = False
    if science is not None:
        sci = science(aoi["aoi_id"], raw)
        if sci is not None and len(sci):
            keep = ["year", "month"] + [c for c in SCIENCE_FIELDS if c in sci.columns]
            raw = raw.merge(sci[keep], on=["year", "month"], how="left")
            harmonized = bool("H" in sci.columns and sci["H"].notna().any())
    raw["aoi_id"] = aoi["aoi_id"]
    for c in FIELDS:
        if c not in raw.columns:
            raw[c] = None
    rows = [{k: _clean(r[k]) for k in FIELDS} for r in raw[FIELDS].to_dict("records")]
    return rows, harmonized


def _split_grid_pandas(grid_path: Path, out_dir: Path) -> list[dict]:
    g = pd.read_parquet(grid_path)
    m = pd.to_datetime(g["month"])
    files = []
    for y in sorted(m.dt.year.unique()):
        part = g[m.dt.year == y]
        out = pd.DataFrame({
            "month": pd.to_datetime(part["month"]).dt.month.astype("int8"),
            "g_id": part["g_id"], "g_lat": part["g_lat"], "g_lon": part["g_lon"],
            "satellite": part["satellite"], "n_cells": part["n_cells"].astype("int32"),
            "sum_frp": part["sum_frp"].astype("float32")}).sort_values(
            ["month", "satellite", "g_id"])
        dst = out_dir / f"grid005_{int(y)}.parquet"
        out.to_parquet(dst, compression="zstd", row_group_size=50000, index=False)
        files.append({"year": int(y), "file": f"grid005/{dst.name}", "rows": len(out),
                      "bytes": dst.stat().st_size})
    return files


def split_grid(grid_path: Path, out_dir: Path) -> list[dict]:
    """Split the monthly 0.05 deg grid into one zstd Parquet per year (sorted for row-group pruning)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    if duckdb is None:
        return _split_grid_pandas(grid_path, out_dir)
    con = duckdb.connect()
    src = Path(grid_path).as_posix()
    years = [y for (y,) in con.execute(
        f"SELECT DISTINCT year(month) FROM read_parquet('{src}') ORDER BY 1").fetchall()]
    files = []
    for y in years:
        dst = out_dir / f"grid005_{y}.parquet"
        con.execute(f"""
            COPY (SELECT CAST(month(month) AS TINYINT) AS month, g_id, g_lat, g_lon, satellite,
                         CAST(n_cells AS INTEGER) AS n_cells, CAST(sum_frp AS FLOAT) AS sum_frp
                  FROM read_parquet('{src}') WHERE year(month) = {y}
                  ORDER BY month, satellite, g_id)
            TO '{dst.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 50000)""")
        n = con.execute(f"SELECT count(*) FROM read_parquet('{dst.as_posix()}')").fetchone()[0]
        files.append({"year": y, "file": f"grid005/{dst.name}", "rows": n,
                      "bytes": dst.stat().st_size})
    return files


def build(out_dir: Path | None = None, stratum_path: Path | None = None,
          grid_path: Path | None = None, manifest: Path | None = None,
          province_path: Path | None = None) -> dict:
    out_dir = Path(out_dir or config.data_dir() / "bundle")
    out_dir.mkdir(parents=True, exist_ok=True)
    stratum = load_stratum(stratum_path)
    if province_path is None and stratum_path is not None:  # province table sits beside stratum
        province_path = Path(stratum_path).with_name("monthly_province_labeled.parquet")
    ptab = load_province(province_path)
    science = _science_adapter(stratum, ptab) if ptab is not None else _science_adapter(stratum)
    aois, any_harmonized = [], False
    areas = province_areas()
    plist = sorted(p for p in ptab["province"].dropna().unique() if p in PROVINCE_ISLAND) \
        if ptab is not None else []
    for aoi in aoi_list(plist):
        rows, harm = monthly_rows(aoi, stratum, science, ptab)
        if aoi.get("province"):
            aoi["area_km2"] = areas.get(aoi["province"])
        any_harmonized |= harm
        f = out_dir / f"monthly_{aoi['aoi_id']}.json"
        f.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
        aois.append({**aoi, "file": f.name, "n_months": len(rows), "bytes": f.stat().st_size,
                     "harmonized": harm,
                     "first": f"{rows[0]['year']}-{rows[0]['month']:02d}" if rows else None,
                     "last": f"{rows[-1]['year']}-{rows[-1]['month']:02d}" if rows else None,
                     "provisional_months": [f"{r['year']}-{r['month']:02d}" for r in rows
                                            if r["flag_nrt"] or r["flag_partial"]],
                     "partial_month": next((f"{r['year']}-{r['month']:02d}" for r in rows
                                            if r["flag_partial"]), None)})
    grid_path = Path(grid_path or config.derived_dir() / "monthly_grid005.parquet")
    grid_files = split_grid(grid_path, out_dir / "grid005") if grid_path.exists() else []
    nrt_grid = grid_path.with_name(grid_path.stem + "_2026nrt.parquet")
    if grid_files and nrt_grid.exists():
        grid_files = [g for g in grid_files if g["year"] < 2026] + \
            split_grid(nrt_grid, out_dir / "grid005")
    index = {
        "app": "Second Sight",
        "data_version": data_version(manifest),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "calibration_window": CALIBRATION_WINDOW,
        "baseline_period": BASELINE_PERIOD,
        "harmonized": any_harmonized,
        "harmonized_note": None if any_harmonized else
            "pipeline.science not available at export time: H/H_lo/H_hi/baseline/pct_rank/"
            "obs_class/sensor_used/agreement are null; raw columns only.",
        "unit": "fire cell-days (0.01 deg cell x local date x satellite x day/night)",
        "raw_columns": SAT_COLS,
        "null_raw_means": "satellite outside its active window in the archive",
        "flag_nrt_rule": "flag_nrt from derived/*_2026nrt.parquet (FIRMS NRT months); SP archive "
                         f"through {SP_LAST_YEAR} plus SP-2026 months are false",
        "flag_partial_rule": "current calendar month (WIB) at export time: incomplete",
        "province_kappa": "provinces use the parent island_region kappa strata",
        "fields": FIELDS,
        "science_meta": getattr(science, "meta", None) if any_harmonized else None,
        "not_yet_filled": ["obs_class", "agreement"] + ([] if any_harmonized else SCIENCE_FIELDS),
        "aois": aois,
        "grid005": {"deg": config.AOI_GRID_DEG,
                    "columns": ["month", "g_id", "g_lat", "g_lon", "satellite", "n_cells", "sum_frp"],
                    "files": grid_files,
                    "total_bytes": sum(g["bytes"] for g in grid_files)},
    }
    (out_dir / "index.json").write_text(json.dumps(index, indent=1, default=str), encoding="utf-8")
    return index


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)
    idx = build(a.out)
    print(json.dumps({"harmonized": idx["harmonized"], "data_version": idx["data_version"][:12],
                      "aois": [(x["aoi_id"], x["n_months"], x["bytes"]) for x in idx["aois"]],
                      "grid_total_bytes": idx["grid005"]["total_bytes"],
                      "grid_max_bytes": max((g["bytes"] for g in idx["grid005"]["files"]), default=0)},
                     indent=1))


if __name__ == "__main__":
    main()
