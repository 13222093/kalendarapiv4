"""DAT-06 (stage S3): clean FIRMS SP detections and add attributes.

Drop rules, applied in this order (each row is counted under the first rule it hits):

1. ``unknown_satellite``   satellite/source not recognised
2. ``terra_pre_2000_11``   Terra before 2000-11-01 (early-mission instrument problems)
3. ``non_vegetation_type`` ``type != 0`` (1 = active volcano, 2 = other static land
   source, 3 = offshore); these feed the static mask (DAT-07) instead
4. ``low_confidence``      MODIS confidence < 30, VIIRS confidence ``l``

Added attributes:

* ``satellite``  normalised: Terra, Aqua, SNPP, NOAA20, NOAA21; ``sensor`` MODIS/VIIRS
* ``acq_ts_utc`` from acq_date + acq_time (HHMM, UTC)
* ``lst_ts``     local solar time = UTC + lon/15 h; ``local_date`` = date(lst_ts);
  ``lst_hour``  decimal hour of local solar time
* ``a_pix``      pixel area proxy = scan * track (km^2)
* ``conf_class`` MODIS: nominal (30-79) / high (>=80); VIIRS: nominal (n) / high (h)
* ``island_region`` PLACEHOLDER lon/lat boxes (see ``REGION_BOXES_DOC``) until the
  province boundaries (DAT-03) are joined
* ``is_peat``, ``province``, ``regency``, ``khg_id`` nullable, filled by later joins

Output: ``$SS_DATA_DIR/derived/detections.parquet`` and ``clean_report.json``.
"""
from __future__ import annotations

import json

import duckdb

from pipeline.data import config

MODIS_MIN_CONF = 30
MODIS_HIGH_CONF = 80

# Placeholder island regions, evaluated top to bottom (first match wins).
# Simple boxes; known inaccuracies: Aru/Kei islands (Maluku, lon > 131) fall in
# Papua; Bangka-Belitung and Riau Islands fall in Sumatra (correct by province
# grouping); a sliver of West Sulawesi coast west of 118.8E falls in Kalimantan.
REGION_BOXES_DOC = [
    ("Sumatra", "lon < 108.5 AND lat > -5.95"),
    ("Kalimantan", "108.5 <= lon < 118.8 AND lat >= -4.5 (lon < 119.2 when lat >= 0.5)"),
    ("Sulawesi", "118.8 <= lon < 126.0 AND -7.0 < lat < 5.0"),
    ("Papua", "lon >= 131.0"),
    ("Jawa-NusaTenggara-Bali-Maluku", "everything else"),
]

ISLAND_REGION_SQL = """
CASE
  WHEN longitude < 108.5 AND latitude > -5.95 THEN 'Sumatra'
  WHEN longitude >= 108.5 AND latitude >= -4.5
       AND (longitude < 118.8 OR (latitude >= 0.5 AND longitude < 119.2)) THEN 'Kalimantan'
  WHEN longitude >= 118.8 AND longitude < 126.0
       AND latitude > -7.0 AND latitude < 5.0 THEN 'Sulawesi'
  WHEN longitude >= 131.0 THEN 'Papua'
  ELSE 'Jawa-NusaTenggara-Bali-Maluku'
END
"""

SATELLITE_SQL = """
CASE
  WHEN source = 'modis' AND satellite IN ('Terra', 'T') THEN 'Terra'
  WHEN source = 'modis' AND satellite IN ('Aqua', 'A') THEN 'Aqua'
  WHEN source = 'viirs-snpp' THEN 'SNPP'
  WHEN source = 'viirs-jpss1' THEN 'NOAA20'
  WHEN source = 'viirs-jpss2' THEN 'NOAA21'
END
"""

DROP_REASONS = ["unknown_satellite", "terra_pre_2000_11", "non_vegetation_type", "low_confidence"]


def build_clean(con: duckdb.DuckDBPyConnection, raw_rel: str = "raw") -> dict:
    """Create table ``detections`` from relation ``raw_rel``; return the drop report.

    ``raw_rel`` needs columns: latitude, longitude, scan, track, acq_date, acq_time,
    satellite, confidence (text), frp, daynight, type, source.
    """
    con.execute(f"""
    CREATE OR REPLACE TEMP TABLE _staged AS
    SELECT *,
      CASE
        WHEN sat_norm IS NULL THEN 'unknown_satellite'
        WHEN sat_norm = 'Terra' AND acq_day < DATE '2000-11-01' THEN 'terra_pre_2000_11'
        WHEN type IS DISTINCT FROM 0 THEN 'non_vegetation_type'
        WHEN sensor = 'MODIS' AND coalesce(conf_num, -1) < {MODIS_MIN_CONF} THEN 'low_confidence'
        WHEN sensor = 'VIIRS' AND conf_txt NOT IN ('n', 'h') THEN 'low_confidence'
      END AS drop_reason
    FROM (
      SELECT r.*,
        {SATELLITE_SQL} AS sat_norm,
        CASE WHEN source = 'modis' THEN 'MODIS' ELSE 'VIIRS' END AS sensor,
        CAST(acq_date AS DATE) AS acq_day,
        TRY_CAST(confidence AS INTEGER) AS conf_num,
        lower(trim(CAST(confidence AS VARCHAR))) AS conf_txt
      FROM {raw_rel} r
    )
    """)
    total = con.execute("SELECT count(*) FROM _staged").fetchone()[0]
    by_reason = dict(con.execute(
        "SELECT drop_reason, count(*) FROM _staged WHERE drop_reason IS NOT NULL GROUP BY 1").fetchall())

    con.execute(f"""
    CREATE OR REPLACE TABLE detections AS
    SELECT
      latitude, longitude,
      sat_norm AS satellite, sensor,
      acq_ts_utc,
      lst_ts,
      CAST(lst_ts AS DATE) AS local_date,
      hour(lst_ts) + minute(lst_ts) / 60.0 + second(lst_ts) / 3600.0 AS lst_hour,
      daynight,
      CAST(frp AS DOUBLE) AS frp,
      CAST(scan AS DOUBLE) AS scan, CAST(track AS DOUBLE) AS track,
      CAST(scan AS DOUBLE) * CAST(track AS DOUBLE) AS a_pix,
      CASE WHEN sensor = 'MODIS' THEN CAST(conf_num AS VARCHAR) ELSE conf_txt END AS confidence_raw,
      CASE
        WHEN sensor = 'MODIS' AND conf_num >= {MODIS_HIGH_CONF} THEN 'high'
        WHEN sensor = 'MODIS' THEN 'nominal'
        WHEN conf_txt = 'h' THEN 'high'
        ELSE 'nominal'
      END AS conf_class,
      {ISLAND_REGION_SQL} AS island_region,
      CAST(NULL AS BOOLEAN) AS is_peat,
      CAST(NULL AS VARCHAR) AS province,
      CAST(NULL AS VARCHAR) AS regency,
      CAST(NULL AS VARCHAR) AS khg_id
    FROM (
      SELECT *,
        acq_day + to_minutes(CAST((acq_time // 100) * 60 + acq_time % 100 AS BIGINT)) AS acq_ts_utc,
        acq_day + to_minutes(CAST((acq_time // 100) * 60 + acq_time % 100 AS BIGINT))
                + to_seconds(CAST(round(longitude / 15.0 * 3600) AS BIGINT)) AS lst_ts
      FROM _staged WHERE drop_reason IS NULL
    )
    """)
    kept = con.execute("SELECT count(*) FROM detections").fetchone()[0]
    nulls = con.execute("""
      SELECT count(*) FILTER (WHERE local_date IS NULL OR a_pix IS NULL OR frp IS NULL
                              OR island_region IS NULL OR conf_class IS NULL)
      FROM detections""").fetchone()[0]
    con.execute("DROP TABLE _staged")
    report = {
        "rows_in": int(total),
        "rows_kept": int(kept),
        "pct_kept": round(100 * kept / total, 3) if total else None,
        "dropped": {r: int(by_reason.get(r, 0)) for r in DROP_REASONS},
        "pct_dropped": {r: round(100 * by_reason.get(r, 0) / total, 3) if total else None
                        for r in DROP_REASONS},
        "unexpected_nulls_in_required_columns": int(nulls),
        "island_region_boxes": REGION_BOXES_DOC,
    }
    return report


def read_raw_view(con: duckdb.DuckDBPyConnection, view: str = "raw") -> None:
    glob = (config.raw_parquet_dir() / "source=*" / "year=*" / "part.parquet").as_posix()
    con.execute(f"""CREATE OR REPLACE VIEW {view} AS
      SELECT * FROM read_parquet('{glob}', hive_partitioning=true, union_by_name=true)""")


def main() -> None:
    con = duckdb.connect()
    read_raw_view(con)
    report = build_clean(con)
    out = config.derived_dir() / "detections.parquet"
    con.execute(f"COPY (SELECT * FROM detections ORDER BY satellite, local_date) "
                f"TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    report["by_satellite_kept"] = dict(con.execute(
        "SELECT satellite, count(*) FROM detections GROUP BY 1 ORDER BY 1").fetchall())
    (config.derived_dir() / "clean_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "island_region_boxes"}, indent=1))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
