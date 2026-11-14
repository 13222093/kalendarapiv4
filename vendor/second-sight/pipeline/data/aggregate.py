"""DAT-09 (stage S5): monthly aggregation per stratum and on a 0.05 deg grid.

* ``monthly_stratum.parquet``: month x island_region x season x daynight x peat x
  satellite -> n_cells (fire cell-days), n_det, sum_frp, max_frp, mean_a_pix.
  ``season`` = 'dry' for Jun-Oct, else 'wet'. ``peat`` = 'peat' / 'mineral' /
  'unknown' (unknown until the peat map is joined, DAT-03).
* ``monthly_grid005.parquet``: month x 0.05 deg cell x satellite -> n_cells, n_det,
  sum_frp (for custom client-side AOIs).

Mass-conservation check: per (month, satellite) the national total computed straight
from ``daily_cell`` equals the sum over regions of ``monthly_stratum`` and the sum
over grid cells of ``monthly_grid005``. Province/regency/KHG aggregates follow once
those labels exist.

Output under ``$SS_DATA_DIR/derived/`` (+ ``aggregate_report.json``).
"""
from __future__ import annotations

import json

import duckdb

from pipeline.data import config, grid

DRY_MONTHS = (6, 7, 8, 9, 10)


def build_monthly_stratum(con: duckdb.DuckDBPyConnection, cell_rel: str = "daily_cell") -> None:
    con.execute(f"""
    CREATE OR REPLACE TABLE monthly_stratum AS
    SELECT CAST(date_trunc('month', local_date) AS DATE) AS month,
           island_region,
           CASE WHEN month(local_date) IN {DRY_MONTHS} THEN 'dry' ELSE 'wet' END AS season,
           daynight,
           CASE WHEN is_peat THEN 'peat' WHEN NOT is_peat THEN 'mineral' ELSE 'unknown' END AS peat,
           satellite,
           count(*) AS n_cells,
           sum(n_det) AS n_det,
           sum(sum_frp) AS sum_frp,
           max(max_frp) AS max_frp,
           avg(mean_a_pix) AS mean_a_pix
    FROM {cell_rel}
    GROUP BY ALL
    """)


def build_grid(con: duckdb.DuckDBPyConnection, cell_rel: str = "daily_cell",
               res: float = config.AOI_GRID_DEG) -> None:
    gid = grid.cell_id_sql("cell_lat", "cell_lon", res)
    con.execute(f"""
    CREATE OR REPLACE TABLE monthly_grid AS
    SELECT month, g_id,
           {grid.center_lat_sql('g_id', res)} AS g_lat,
           {grid.center_lon_sql('g_id', res)} AS g_lon,
           satellite, n_cells, n_det, sum_frp
    FROM (
      SELECT CAST(date_trunc('month', local_date) AS DATE) AS month, {gid} AS g_id, satellite,
             count(*) AS n_cells, sum(n_det) AS n_det, sum(sum_frp) AS sum_frp
      FROM {cell_rel} GROUP BY ALL
    )
    """)


def conservation_check(con: duckdb.DuckDBPyConnection, cell_rel: str = "daily_cell") -> dict:
    """Compare national totals from cells vs. strata vs. grid; return mismatch counts."""
    q = f"""
    WITH nat AS (
      SELECT CAST(date_trunc('month', local_date) AS DATE) AS month, satellite,
             count(*) AS n_cells, sum(n_det) AS n_det FROM {cell_rel} GROUP BY ALL),
    strat AS (SELECT month, satellite, sum(n_cells) AS n_cells, sum(n_det) AS n_det
              FROM monthly_stratum GROUP BY ALL),
    grd AS (SELECT month, satellite, sum(n_cells) AS n_cells, sum(n_det) AS n_det
            FROM monthly_grid GROUP BY ALL)
    SELECT count(*) AS n_groups,
           count(*) FILTER (WHERE s.n_cells IS DISTINCT FROM nat.n_cells
                             OR s.n_det IS DISTINCT FROM nat.n_det) AS stratum_mismatch,
           count(*) FILTER (WHERE g.n_cells IS DISTINCT FROM nat.n_cells
                             OR g.n_det IS DISTINCT FROM nat.n_det) AS grid_mismatch
    FROM nat LEFT JOIN strat s USING (month, satellite) LEFT JOIN grd g USING (month, satellite)
    """
    n, sm, gm = con.execute(q).fetchone()
    return {"month_satellite_groups": int(n), "stratum_mismatch": int(sm), "grid_mismatch": int(gm),
            "ok": sm == 0 and gm == 0}


def main() -> None:
    d = config.derived_dir()
    con = duckdb.connect()
    con.execute(f"CREATE VIEW daily_cell AS SELECT * FROM read_parquet('{(d / 'daily_cell.parquet').as_posix()}')")
    build_monthly_stratum(con)
    build_grid(con)
    check = conservation_check(con)
    outs = {"monthly_stratum": d / "monthly_stratum.parquet", "monthly_grid": d / "monthly_grid005.parquet"}
    for table, path in outs.items():
        con.execute(f"COPY (SELECT * FROM {table} ORDER BY ALL) TO '{path.as_posix()}' "
                    f"(FORMAT PARQUET, COMPRESSION ZSTD)")
    report = {
        "conservation": check,
        "rows": {t: int(con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]) for t in outs},
        "bytes": {t: p.stat().st_size for t, p in outs.items()},
    }
    (d / "aggregate_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report, indent=1))
    if not check["ok"]:
        raise SystemExit("mass conservation check FAILED")


if __name__ == "__main__":
    main()
