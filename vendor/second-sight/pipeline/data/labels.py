"""DAT-03 / DAT-09: label 0.01 deg cells with peat, province (ADM1) and regency (ADM2).

AI-assisted code (see docs/ai_acknowledgement.md).

Labelling is done once per distinct cell centroid (``cell_lat``, ``cell_lon``) of
``daily_cell`` with shapely STRtree point-in-polygon lookups, then joined back. Rules:

* ``peat`` = 'peat' if the centroid falls in a peat polygon (GFW "Indonesia peat lands",
  Kementan/BBSDLP-derived, see pipeline/support/peat.py); 'mineral' if it falls inside an
  Indonesian province polygon but no peat polygon; 'unknown' otherwise (offshore / outside
  the ADM1 boundaries, where the peat map makes no statement).
* ``province`` / ``regency`` = geoBoundaries gbHumanitarian ADM1 / ADM2 ``shapeName``
  (None outside all polygons).

Outputs (new files; the unlabelled ones are left untouched) under ``$SS_DATA_DIR/derived/``:
``cell_labels.parquet``, ``daily_cell_labeled.parquet``, ``monthly_stratum_labeled.parquet``
(same schema as monthly_stratum, with real peat labels), ``monthly_province_labeled.parquet``
(month x province x peat x daynight x satellite) and ``labels_report.json``.

CLI:  python -m pipeline.data.labels [--input daily_cell.parquet] [--suffix ""]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from pipeline.data import aggregate, config


def label_points(lats, lons, peat_geoms: list, adm1_units: list, adm2_units: list) -> pd.DataFrame:
    """Label points. ``*_units`` are [(name, geometry)], ``peat_geoms`` a list of geometries."""
    from pipeline.support.boundaries import PointLabeler
    from pipeline.support.peat import PeatLabeler

    lats, lons = np.asarray(lats, float), np.asarray(lons, float)
    in_peat = PeatLabeler(peat_geoms).is_peat(lats, lons) if peat_geoms else np.zeros(len(lats), bool)
    prov = PointLabeler(adm1_units).label(lats, lons) if adm1_units else [None] * len(lats)
    reg = PointLabeler(adm2_units).label(lats, lons) if adm2_units else [None] * len(lats)
    has_prov = np.array([p is not None for p in prov])
    peat = np.where(in_peat, "peat", np.where(has_prov, "mineral", "unknown"))
    return pd.DataFrame({"cell_lat": lats, "cell_lon": lons, "peat": peat,
                         "province": prov, "regency": reg})


def _load_layers():
    from pipeline.support.boundaries import boundary_path, load_units
    from pipeline.support.peat import load_peat_geoms

    return load_peat_geoms(), load_units(boundary_path("ADM1")), load_units(boundary_path("ADM2"))


def label_cells(con: duckdb.DuckDBPyConnection, cell_rel: str = "daily_cell") -> pd.DataFrame:
    cells = con.execute(f"SELECT DISTINCT cell_lat, cell_lon FROM {cell_rel}").df()
    return label_points(cells.cell_lat.values, cells.cell_lon.values, *_load_layers())


def build_labeled(con: duckdb.DuckDBPyConnection, labels: pd.DataFrame,
                  cell_rel: str = "daily_cell") -> None:
    """Create table ``daily_cell_labeled`` = cell_rel with is_peat/province/regency filled + peat."""
    con.register("cell_labels_df", labels)
    con.execute(f"""
    CREATE OR REPLACE TABLE daily_cell_labeled AS
    SELECT d.* REPLACE (
             CASE l.peat WHEN 'peat' THEN TRUE WHEN 'mineral' THEN FALSE ELSE NULL END AS is_peat,
             l.province AS province, l.regency AS regency),
           coalesce(l.peat, 'unknown') AS peat
    FROM {cell_rel} d
    LEFT JOIN cell_labels_df l USING (cell_lat, cell_lon)
    """)


def build_monthly_province(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("""
    CREATE OR REPLACE TABLE monthly_province AS
    SELECT CAST(date_trunc('month', local_date) AS DATE) AS month,
           coalesce(province, 'UNKNOWN') AS province, peat, daynight, satellite,
           count(*) AS n_cells, sum(n_det) AS n_det, sum(sum_frp) AS sum_frp, max(max_frp) AS max_frp
    FROM daily_cell_labeled GROUP BY ALL
    """)


def coverage_report(con: duckdb.DuckDBPyConnection, labels: pd.DataFrame) -> dict:
    n = len(labels)
    rep = {"n_cells": n,
           "cells_peat_known_pct": round(100 * float((labels.peat != "unknown").mean()), 2) if n else None,
           "cells_on_peat_pct": round(100 * float((labels.peat == "peat").mean()), 2) if n else None,
           "cells_with_province_pct": round(100 * float(labels.province.notna().mean()), 2) if n else None,
           "cells_with_regency_pct": round(100 * float(labels.regency.notna().mean()), 2) if n else None}
    by_year = con.execute("""
    SELECT year(local_date) AS year, satellite,
           sum(n_det) AS n_det,
           sum(n_det) FILTER (WHERE peat = 'peat') AS n_det_peat,
           sum(n_det) FILTER (WHERE peat <> 'unknown') AS n_det_known
    FROM daily_cell_labeled GROUP BY ALL ORDER BY 1, 2
    """).df()
    by_year["peat_share_pct"] = (100 * by_year.n_det_peat.fillna(0) / by_year.n_det_known).round(2)
    rep["detections_on_peat_by_year"] = by_year.drop(columns="n_det_known").fillna(0).to_dict("records")
    tot = con.execute("""
    SELECT sum(n_det) FILTER (WHERE peat='peat') / sum(n_det) FILTER (WHERE peat<>'unknown'),
           sum(n_det) FILTER (WHERE peat='unknown') / sum(n_det) FROM daily_cell_labeled
    """).fetchone()
    rep["detections_on_peat_pct_all_years"] = round(100 * float(tot[0]), 2)
    rep["detections_unknown_pct"] = round(100 * float(tot[1]), 2)
    return rep


def main(argv=None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=None, help="daily_cell parquet (default derived/daily_cell.parquet)")
    ap.add_argument("--suffix", default="", help="output suffix, e.g. _2026nrt")
    a = ap.parse_args(argv)
    d = config.derived_dir()
    src = Path(a.input) if a.input else d / f"daily_cell{a.suffix}.parquet"
    con = duckdb.connect()
    con.execute(f"CREATE VIEW daily_cell AS SELECT * FROM read_parquet('{src.as_posix()}')")
    labels = label_cells(con)
    labels.to_parquet(d / f"cell_labels{a.suffix}.parquet", index=False)
    build_labeled(con, labels)
    aggregate.build_monthly_stratum(con, cell_rel="daily_cell_labeled")
    build_monthly_province(con)
    outs = {"daily_cell_labeled": d / f"daily_cell_labeled{a.suffix}.parquet",
            "monthly_stratum": d / f"monthly_stratum_labeled{a.suffix}.parquet",
            "monthly_province": d / f"monthly_province_labeled{a.suffix}.parquet"}
    for tbl, p in outs.items():
        con.execute(f"COPY {tbl} TO '{p.as_posix()}' (FORMAT parquet)")
    rep = coverage_report(con, labels)
    rep["input"] = str(src)
    rep["sources"] = {"peat": "support/peat/gfw_indonesia_peat_lands.geojson (+ .source.json)",
                      "admin": "support/boundaries/geoBoundaries-IDN-ADM{1,2}-gbHumanitarian_simplified.geojson"}
    rep["outputs"] = {k: str(v) for k, v in outs.items()}
    (d / f"labels_report{a.suffix}.json").write_text(json.dumps(rep, indent=2, default=str))
    print(json.dumps({k: v for k, v in rep.items() if k != "detections_on_peat_by_year"}, indent=2))


if __name__ == "__main__":
    main()
