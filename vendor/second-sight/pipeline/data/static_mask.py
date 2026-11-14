"""DAT-07 (stage S3): historical static-source mask for NRT data.

NRT detections have no ``type`` attribute, so persistent non-vegetation heat
sources (smelters, gas flares, volcanoes) must be removed with a mask learned from
the SP archive: a 0.01 deg cell is masked when it has SP detections with
``type IN (1, 2, 3)`` on at least ``N`` distinct days in ``YEARS`` (default
2012-2025, the VIIRS era). N is configurable (default 10); the report also gives
cell counts for N in {5, 10, 20} and the share of type-0 SP detections that would
be removed by each mask (a proxy for the NRT share masked, until DAT-02 lands).

Output: ``$SS_DATA_DIR/derived/static_mask.parquet`` (+ ``static_mask_report.json``).
"""
from __future__ import annotations

import argparse
import json

import duckdb

from pipeline.data import config, grid

DEFAULT_MIN_DAYS = 10
DEFAULT_YEARS = (2012, 2025)
SENSITIVITY_N = (5, 10, 20)
# Approximate centres of known industrial heat sources (quality gate: should be masked;
# report gives the number of masked cells within +/-0.1 deg).
KNOWN_SITES = {
    "Morowali IMIP nickel smelter (Sulawesi)": (-2.82, 122.15),
    "Weda Bay IWIP nickel smelter (Halmahera)": (0.47, 127.94),
}


def build_static_days(con: duckdb.DuckDBPyConnection, raw_rel: str = "raw",
                      years: tuple[int, int] = DEFAULT_YEARS) -> None:
    """Table ``static_days``: per 0.01 deg cell, distinct days with type 1/2/3."""
    cid = grid.cell_id_sql("latitude", "longitude", config.CELL_DEG)
    con.execute(f"""
    CREATE OR REPLACE TABLE static_days AS
    SELECT {cid} AS cell_id,
           count(DISTINCT CAST(acq_date AS DATE)) AS n_days,
           count(*) AS n_det,
           mode(type) AS main_type
    FROM {raw_rel}
    WHERE type IN (1, 2, 3)
      AND year(CAST(acq_date AS DATE)) BETWEEN {years[0]} AND {years[1]}
    GROUP BY 1
    """)


def build_mask(con: duckdb.DuckDBPyConnection, min_days: int = DEFAULT_MIN_DAYS) -> int:
    """Table ``static_mask`` from ``static_days``; returns number of masked cells."""
    res = config.CELL_DEG
    con.execute(f"""
    CREATE OR REPLACE TABLE static_mask AS
    SELECT cell_id,
           {grid.center_lat_sql('cell_id', res)} AS cell_lat,
           {grid.center_lon_sql('cell_id', res)} AS cell_lon,
           n_days, n_det, main_type, {min_days} AS min_days
    FROM static_days WHERE n_days >= {min_days}
    """)
    return con.execute("SELECT count(*) FROM static_mask").fetchone()[0]


def masked_share(con: duckdb.DuckDBPyConnection, det_rel: str, min_days: int) -> float | None:
    """Share (%) of ``det_rel`` rows that fall in cells with n_days >= min_days."""
    cid = grid.cell_id_sql("d.latitude", "d.longitude", config.CELL_DEG)
    tot, hit = con.execute(f"""
      SELECT count(*), count(s.cell_id)
      FROM {det_rel} d LEFT JOIN (SELECT cell_id FROM static_days WHERE n_days >= {min_days}) s
        ON s.cell_id = {cid}""").fetchone()
    return round(100 * hit / tot, 4) if tot else None


def main(argv: list[str] | None = None) -> None:
    from pipeline.data.clean import read_raw_view

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--min-days", type=int, default=DEFAULT_MIN_DAYS)
    ap.add_argument("--years", nargs=2, type=int, default=list(DEFAULT_YEARS))
    a = ap.parse_args(argv)

    con = duckdb.connect()
    read_raw_view(con)
    build_static_days(con, years=tuple(a.years))
    det = config.derived_dir() / "detections.parquet"
    report: dict = {"years": a.years, "min_days": a.min_days, "sensitivity": {}}
    for n in SENSITIVITY_N:
        n_cells = con.execute(f"SELECT count(*) FROM static_days WHERE n_days >= {n}").fetchone()[0]
        entry = {"cells": int(n_cells)}
        if det.exists():
            con.execute(f"CREATE OR REPLACE VIEW det AS SELECT * FROM read_parquet('{det.as_posix()}')")
            entry["pct_type0_sp_detections_masked"] = masked_share(con, "det", n)
        report["sensitivity"][str(n)] = entry
    report["masked_cells"] = build_mask(con, a.min_days)
    report["by_main_type"] = {str(k): int(v) for k, v in con.execute(
        "SELECT main_type, count(*) FROM static_mask GROUP BY 1 ORDER BY 1").fetchall()}
    report["known_sites"] = {
        name: int(con.execute(f"""SELECT count(*) FROM static_mask
              WHERE abs(cell_lat - ({lat})) < 0.1 AND abs(cell_lon - ({lon})) < 0.1""").fetchone()[0])
        for name, (lat, lon) in KNOWN_SITES.items()}
    out = config.derived_dir() / "static_mask.parquet"
    con.execute(f"COPY static_mask TO '{out.as_posix()}' (FORMAT PARQUET)")
    (config.derived_dir() / "static_mask_report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report, indent=1))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
