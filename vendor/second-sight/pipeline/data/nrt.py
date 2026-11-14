"""DAT-02: 2026 detections (Jan to latest available) without a FIRMS MAP_KEY.

Source: the CC0 (data) / Apache-2.0 (code) GeoParquet mirror of the FIRMS area API
``portolan-mirrors/firms-catalog`` on Source Cooperative
(``https://data.source.coop/portolan-mirrors/firms-catalog/detections/year=<Y>/detections.parquet``).
It carries MODIS (Terra, Aqua), VIIRS S-NPP, NOAA-20 and NOAA-21 with a ``quality``
column (``sp`` / ``nrt``; FIRMS guarantees non-overlapping SP/NRT date ranges per
sensor). Only the Indonesia bbox (lon 94..142, lat -11..7) is queried via DuckDB httpfs.

Steps:

1. ``fetch``: query the mirror, normalise to the SP raw schema written by ``ingest.py``
   (latitude/longitude, acq_date, acq_time HHMM, satellite code, confidence text, ...)
   plus ``quality`` (``SP``/``NRT``, upper-cased), and write
   ``$SS_DATA_DIR/raw_nrt/source={source}/year={year}/part.parquet`` (same partition
   scheme as ``raw/``; the distinct root ``raw_nrt`` is the source tag, so the SP
   pipeline's ``raw/source=*`` glob is not affected). Row counts ->
   ``raw_nrt_row_counts.csv``. If the mirror is unreachable and ``FIRMS_MAP_KEY`` is
   set, fall back to the FIRMS area API (5-day windows).
2. ``process``: clip to Indonesia (geoBoundaries ADM1 + 0.05 deg buffer, because the
   SP country archive is clipped to the country and the mirror is a bbox), apply the
   DAT-07 static mask (NRT has no ``type``: masked cells -> type 2, else type 0, SP rows
   keep their own ``type``), then run clean -> cells -> aggregate separately per
   quality and add ``flag_nrt``. Outputs (same columns as the SP outputs + ``flag_nrt``,
   so they can be UNIONed with them) under ``$SS_DATA_DIR/derived/``:
   ``detections_{year}nrt.parquet``, ``daily_cell_{year}nrt.parquet``,
   ``monthly_stratum_{year}nrt.parquet``, ``monthly_grid005_{year}nrt.parquet`` and
   ``nrt_report.json``.

Usage::

    python -m pipeline.data.nrt                 # fetch + process 2026
    python -m pipeline.data.nrt --skip-fetch    # reprocess existing raw_nrt
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import urllib.request

import duckdb

from pipeline.data import aggregate, cells, clean, config, grid

YEAR = 2026
BBOX = (94.0, -11.0, 142.0, 7.0)  # lon_min, lat_min, lon_max, lat_max
MIRROR_URL = ("https://data.source.coop/portolan-mirrors/firms-catalog/detections/"
              "year={year}/detections.parquet")
CLIP_BUFFER_DEG = 0.05
BOUNDARY_FILE = "support/boundaries/geoBoundaries-IDN-ADM1-gbHumanitarian_simplified.geojson"

# mirror ``sensor``/``satellite`` -> (SP source tag, FIRMS satellite code as in SP CSVs)
SOURCE_SQL = """
CASE
  WHEN sensor = 'MODIS' THEN 'modis'
  WHEN sensor = 'VIIRS_SNPP' THEN 'viirs-snpp'
  WHEN sensor = 'VIIRS_NOAA20' THEN 'viirs-jpss1'
  WHEN sensor = 'VIIRS_NOAA21' THEN 'viirs-jpss2'
END
"""
SAT_CODE_SQL = """
CASE
  WHEN satellite IN ('Terra', 'T') THEN 'Terra'
  WHEN satellite IN ('Aqua', 'A') THEN 'Aqua'
  WHEN satellite IN ('Suomi-NPP', 'N') THEN 'N'
  WHEN satellite IN ('NOAA-20', 'N20', '1') THEN 'N20'
  WHEN satellite IN ('NOAA-21', 'N21', '2') THEN 'N21'
  ELSE satellite
END
"""
API_SOURCES = {"MODIS_NRT": "MODIS", "VIIRS_SNPP_NRT": "VIIRS_SNPP",
               "VIIRS_NOAA20_NRT": "VIIRS_NOAA20", "VIIRS_NOAA21_NRT": "VIIRS_NOAA21"}


def normalise_sql(src_rel: str, lon_expr: str = "ST_X(geometry)",
                  lat_expr: str = "ST_Y(geometry)") -> str:
    """SELECT turning mirror rows into the SP raw schema (+ ``source``, ``quality``).

    ``src_rel`` needs the mirror columns (``sensor``, ``satellite``, ``acq_datetime``
    or ``acq_date``+``acq_time``, ...). ``acq_time`` is rebuilt as HHMM integer UTC.
    """
    return f"""
    SELECT
      CAST({lat_expr} AS DOUBLE) AS latitude,
      CAST({lon_expr} AS DOUBLE) AS longitude,
      CAST(brightness AS DOUBLE) AS brightness,
      CAST(bright_t31 AS DOUBLE) AS bright_t31,
      CAST(bright_ti4 AS DOUBLE) AS bright_ti4,
      CAST(bright_ti5 AS DOUBLE) AS bright_ti5,
      CAST(scan AS DOUBLE) AS scan,
      CAST(track AS DOUBLE) AS track,
      CAST(acq_date AS DATE) AS acq_date,
      CAST(hour(acq_datetime) * 100 + minute(acq_datetime) AS INTEGER) AS acq_time,
      {SAT_CODE_SQL} AS satellite,
      CAST(instrument AS VARCHAR) AS instrument,
      CASE WHEN sensor = 'MODIS' THEN CAST(confidence AS VARCHAR)
           ELSE lower(substr(trim(CAST(confidence AS VARCHAR)), 1, 1)) END AS confidence,
      CAST(version AS VARCHAR) AS version,
      CAST(frp AS DOUBLE) AS frp,
      CAST(daynight AS VARCHAR) AS daynight,
      CAST(type AS BIGINT) AS type,
      upper(CAST(quality AS VARCHAR)) AS quality,
      {SOURCE_SQL} AS source
    FROM {src_rel}
    """


def _connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    return con


def _mirror_rel(con: duckdb.DuckDBPyConnection, year: int) -> None:
    x0, y0, x1, y1 = BBOX
    url = MIRROR_URL.format(year=year)
    con.execute(f"""CREATE OR REPLACE TEMP TABLE src AS
      SELECT * FROM read_parquet('{url}')
      WHERE ST_Intersects(geometry, ST_MakeEnvelope({x0}, {y0}, {x1}, {y1}))
        AND ST_X(geometry) BETWEEN {x0} AND {x1} AND ST_Y(geometry) BETWEEN {y0} AND {y1}""")


def _api_rel(con: duckdb.DuckDBPyConnection, year: int, key: str) -> None:
    """Fallback: FIRMS area API, 5-day windows (needs FIRMS_MAP_KEY)."""
    import pandas as pd

    frames = []
    end = min(dt.date.today(), dt.date(year, 12, 31))
    bbox = ",".join(str(v) for v in BBOX)
    for api_src, sensor in API_SOURCES.items():
        d = dt.date(year, 1, 1)
        while d <= end:
            url = (f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{api_src}/"
                   f"{bbox}/5/{d.isoformat()}")
            req = urllib.request.Request(url, headers={"User-Agent": "second-sight-pipeline/0.1"})
            with urllib.request.urlopen(req, timeout=300) as r:
                df = pd.read_csv(io.BytesIO(r.read()), dtype={"confidence": str, "version": str})
            if len(df):
                df["sensor"] = sensor
                df["quality"] = "nrt"
                frames.append(df)
            d += dt.timedelta(days=5)
    df = pd.concat(frames, ignore_index=True)
    for c in ("brightness", "bright_t31", "bright_ti4", "bright_ti5", "instrument", "type"):
        if c not in df:
            df[c] = None
    con.register("api_df", df)
    con.execute("""CREATE OR REPLACE TEMP TABLE src AS SELECT *,
      CAST(acq_date AS DATE) + to_minutes(CAST((acq_time // 100) * 60 + acq_time % 100 AS BIGINT))
        AS acq_datetime,
      ST_Point(longitude, latitude) AS geometry FROM api_df""")


def fetch(year: int = YEAR) -> list[dict]:
    """Download ``year`` for the Indonesia bbox into ``raw_nrt/``; return row counts."""
    con = _connect()
    origin = MIRROR_URL.format(year=year)
    try:
        _mirror_rel(con, year)
    except Exception as e:  # mirror unreachable
        key = os.environ.get("FIRMS_MAP_KEY")
        if not key:
            raise RuntimeError(f"mirror unreachable ({e}) and FIRMS_MAP_KEY not set") from e
        print(f"mirror failed ({e}); falling back to FIRMS area API", file=sys.stderr)
        _api_rel(con, year, key)
        origin = "https://firms.modaps.eosdis.nasa.gov/api/area/ (NRT sources)"
    con.execute(f"CREATE OR REPLACE TEMP TABLE norm AS {normalise_sql('src')}")
    rows = []
    for (source,) in con.execute("SELECT DISTINCT source FROM norm WHERE source IS NOT NULL "
                                 "ORDER BY 1").fetchall():
        out = config.data_dir() / "raw_nrt" / f"source={source}" / f"year={year}" / "part.parquet"
        out.parent.mkdir(parents=True, exist_ok=True)
        con.execute(f"""COPY (SELECT * EXCLUDE (source) FROM norm WHERE source = '{source}'
                        ORDER BY acq_date, acq_time) TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
        for q, n, d0, d1 in con.execute(f"""SELECT quality, count(*), min(acq_date), max(acq_date)
              FROM norm WHERE source = '{source}' GROUP BY 1 ORDER BY 1""").fetchall():
            rows.append({"source": source, "year": year, "quality": q, "rows": int(n),
                         "first_date": str(d0), "last_date": str(d1), "url": origin,
                         "file": out.relative_to(config.data_dir()).as_posix()})
            print(f"[ok] {source} {year} {q}: {n:,} rows {d0}..{d1}", flush=True)
    path = config.data_dir() / "raw_nrt_row_counts.csv"
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return rows


def read_nrt_view(con: duckdb.DuckDBPyConnection, year: int = YEAR, view: str = "raw_nrt") -> None:
    glob = (config.data_dir() / "raw_nrt" / "source=*" / f"year={year}" / "part.parquet").as_posix()
    con.execute(f"""CREATE OR REPLACE VIEW {view} AS
      SELECT * FROM read_parquet('{glob}', hive_partitioning=true, union_by_name=true)""")


def stage_sql(raw_rel: str, mask_rel: str | None, clip_rel: str | None) -> str:
    """Raw rows with ``in_country`` / ``in_mask`` flags and the NRT ``type`` filled.

    NRT ``type`` is NULL: a row in a static-mask cell gets type 2 (so ``clean`` drops it
    as ``non_vegetation_type``), otherwise 0. Rows that carry a ``type`` keep it.
    """
    cid = grid.cell_id_sql("r.latitude", "r.longitude", config.CELL_DEG)
    mjoin = (f"LEFT JOIN (SELECT cell_id AS m_id FROM {mask_rel}) m ON m.m_id = {cid}"
             if mask_rel else "")
    in_mask = "m.m_id IS NOT NULL" if mask_rel else "FALSE"
    in_country = (f"ST_Intersects(ST_Point(r.longitude, r.latitude), (SELECT g FROM {clip_rel}))"
                  if clip_rel else "TRUE")
    return f"""
    SELECT r.* REPLACE (CAST(CASE WHEN r.type IS NOT NULL THEN r.type
                                  WHEN {in_mask} THEN 2 ELSE 0 END AS BIGINT) AS type),
           {in_mask} AS in_mask, {in_country} AS in_country
    FROM {raw_rel} r {mjoin}
    """


def process(year: int = YEAR) -> dict:
    con = _connect()
    read_nrt_view(con, year)
    d = config.derived_dir()
    mask = d / "static_mask.parquet"
    mask_rel = None
    if mask.exists():
        con.execute(f"CREATE VIEW static_mask AS SELECT * FROM read_parquet('{mask.as_posix()}')")
        mask_rel = "static_mask"
    clip_rel = None
    bnd = config.data_dir() / BOUNDARY_FILE
    if bnd.exists():
        con.execute(f"""CREATE TABLE clip AS SELECT ST_Buffer(ST_Union_Agg(geom), {CLIP_BUFFER_DEG}) AS g
                        FROM ST_Read('{bnd.as_posix()}')""")
        clip_rel = "clip"
    con.execute(f"CREATE TABLE staged AS {stage_sql('raw_nrt', mask_rel, clip_rel)}")

    report: dict = {"year": year, "bbox": BBOX, "static_mask": str(mask) if mask_rel else None,
                    "country_clip": f"{BOUNDARY_FILE} + {CLIP_BUFFER_DEG} deg buffer" if clip_rel else None}
    report["raw"] = [dict(zip(("source", "quality", "rows", "first_date", "last_date", "in_country",
                               "in_mask_of_in_country"), (s, q, int(n), str(a), str(b), int(c), int(m))))
                     for s, q, n, a, b, c, m in con.execute("""
        SELECT source, quality, count(*), min(acq_date), max(acq_date),
               count(*) FILTER (WHERE in_country), count(*) FILTER (WHERE in_country AND in_mask)
        FROM staged GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()]
    tot, inc, msk = con.execute("""SELECT count(*), count(*) FILTER (WHERE in_country),
        count(*) FILTER (WHERE in_country AND in_mask AND quality = 'NRT') FROM staged""").fetchone()
    nrt_in = con.execute("SELECT count(*) FROM staged WHERE in_country AND quality = 'NRT'").fetchone()[0]
    report["pct_outside_country_clip"] = round(100 * (tot - inc) / tot, 3) if tot else None
    report["pct_nrt_masked_static"] = round(100 * msk / nrt_in, 3) if nrt_in else None

    det_parts, cell_parts, strat_parts, grid_parts = [], [], [], []
    report["clean"], report["cells"], report["conservation"] = {}, {}, {}
    for (q,) in con.execute("SELECT DISTINCT quality FROM staged ORDER BY 1").fetchall():
        flag = "TRUE" if q == "NRT" else "FALSE"
        con.execute(f"CREATE OR REPLACE VIEW stage_q AS SELECT * EXCLUDE (in_mask, in_country) "
                    f"FROM staged WHERE in_country AND quality = '{q}'")
        rep = clean.build_clean(con, "stage_q")
        rep.pop("island_region_boxes", None)
        report["clean"][q] = rep
        report["cells"][q] = cells.build_cells(con, "detections", mask_rel)
        aggregate.build_monthly_stratum(con)
        aggregate.build_grid(con)
        report["conservation"][q] = aggregate.conservation_check(con)
        for src, parts in (("detections", det_parts), ("daily_cell", cell_parts),
                           ("monthly_stratum", strat_parts), ("monthly_grid", grid_parts)):
            con.execute(f"CREATE TABLE {src}_{q} AS SELECT *, {flag} AS flag_nrt FROM {src}")
            parts.append(f"SELECT * FROM {src}_{q}")

    outs = {"detections": (det_parts, f"detections_{year}nrt.parquet", "satellite, local_date"),
            "daily_cell": (cell_parts, f"daily_cell_{year}nrt.parquet", "satellite, local_date, cell_id"),
            "monthly_stratum": (strat_parts, f"monthly_stratum_{year}nrt.parquet", "ALL"),
            "monthly_grid": (grid_parts, f"monthly_grid005_{year}nrt.parquet", "ALL")}
    report["outputs"] = {}
    for name, (parts, fname, order) in outs.items():
        path = d / fname
        con.execute(f"COPY ({' UNION ALL BY NAME '.join(parts)} ORDER BY {order}) "
                    f"TO '{path.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        report["outputs"][name] = {"file": path.name, "rows": int(con.execute(
            f"SELECT count(*) FROM '{path.as_posix()}'").fetchone()[0])}
    report["monthly_cell_days_by_satellite"] = [
        {"month": str(m), "satellite": s, "n_cells": int(n), "flag_nrt": bool(f)}
        for m, s, n, f in con.execute(f"""SELECT month, satellite, sum(n_cells), bool_or(flag_nrt)
            FROM '{(d / outs['monthly_stratum'][1]).as_posix()}' GROUP BY 1, 2 ORDER BY 1, 2""").fetchall()]
    (d / "nrt_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", type=int, default=YEAR)
    ap.add_argument("--skip-fetch", action="store_true")
    a = ap.parse_args(argv)
    if not a.skip_fetch:
        fetch(a.year)
    rep = process(a.year)
    print(json.dumps({k: v for k, v in rep.items() if k != "monthly_cell_days_by_satellite"}, indent=1))


if __name__ == "__main__":
    main()
