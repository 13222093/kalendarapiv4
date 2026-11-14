"""DAT-08 (stage S4): fire cell-days.

Snaps cleaned detections to the 0.01 deg grid and keeps one row per
(local_date, cell_id, satellite, daynight). This removes VIIRS small-pixel
inflation, bow-tie duplicates and overlapping-orbit duplicates.

Columns: local_date, cell_id, cell_lat, cell_lon, satellite, sensor, daynight,
n_det, sum_frp, max_frp, mean_a_pix, mean_lst_hour, island_region,
is_peat/province/regency/khg_id (nullable labels), in_static_mask.

Output: ``$SS_DATA_DIR/derived/daily_cell.parquet`` (+ ``cells_report.json``).
"""
from __future__ import annotations

import json

import duckdb

from pipeline.data import config, grid

KEY = ("local_date", "cell_id", "satellite", "daynight")


def build_cells(con: duckdb.DuckDBPyConnection, det_rel: str = "detections",
                mask_rel: str | None = None) -> dict:
    """Create table ``daily_cell`` from ``det_rel``; return a report dict."""
    res = config.CELL_DEG
    cid = grid.cell_id_sql("latitude", "longitude", res)
    mask_join = (f"LEFT JOIN (SELECT cell_id AS m_id FROM {mask_rel}) m ON m.m_id = c.cell_id"
                 if mask_rel else "")
    mask_col = "m.m_id IS NOT NULL" if mask_rel else "CAST(NULL AS BOOLEAN)"
    con.execute(f"""
    CREATE OR REPLACE TABLE daily_cell AS
    SELECT c.*,
           {grid.center_lat_sql('c.cell_id', res)} AS cell_lat,
           {grid.center_lon_sql('c.cell_id', res)} AS cell_lon,
           {mask_col} AS in_static_mask
    FROM (
      SELECT local_date, {cid} AS cell_id, satellite, daynight,
             any_value(sensor) AS sensor,
             count(*) AS n_det,
             sum(frp) AS sum_frp,
             max(frp) AS max_frp,
             avg(a_pix) AS mean_a_pix,
             avg(lst_hour) AS mean_lst_hour,
             mode(island_region) AS island_region,
             bool_or(is_peat) AS is_peat,
             mode(province) AS province,
             mode(regency) AS regency,
             mode(khg_id) AS khg_id
      FROM {det_rel}
      GROUP BY local_date, {cid}, satellite, daynight
    ) c {mask_join}
    """)
    dup = con.execute(f"""SELECT count(*) FROM (SELECT {', '.join(KEY)} FROM daily_cell
                          GROUP BY ALL HAVING count(*) > 1)""").fetchone()[0]
    ratio = con.execute("""
      SELECT satellite, sum(n_det) AS n_det, count(*) AS n_cells,
             round(sum(n_det) / count(*), 4) AS det_per_cell
      FROM daily_cell GROUP BY 1 ORDER BY 1""").fetchall()
    return {
        "duplicate_keys": int(dup),
        "det_to_cell": {s: {"n_det": int(d), "n_cells": int(c), "det_per_cell": float(r)}
                        for s, d, c, r in ratio},
    }


def main() -> None:
    det = config.derived_dir() / "detections.parquet"
    mask = config.derived_dir() / "static_mask.parquet"
    con = duckdb.connect()
    con.execute(f"CREATE VIEW detections AS SELECT * FROM read_parquet('{det.as_posix()}')")
    mask_rel = None
    if mask.exists():
        con.execute(f"CREATE VIEW static_mask AS SELECT * FROM read_parquet('{mask.as_posix()}')")
        mask_rel = "static_mask"
    report = build_cells(con, "detections", mask_rel)
    out = config.derived_dir() / "daily_cell.parquet"
    con.execute(f"COPY (SELECT * FROM daily_cell ORDER BY satellite, local_date, cell_id) "
                f"TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    (config.derived_dir() / "cells_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report, indent=1))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
