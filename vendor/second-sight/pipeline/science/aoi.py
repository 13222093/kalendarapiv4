"""CAL-05: custom AOI support. kappa on the 0.05 deg grid and harmonized series for any cell set.

A client that draws a polygon sums the 0.05 deg cells inside it. Because kappa is defined per
stratum (island_region x season x daynight x is_peat), the grid table keeps those keys per
cell-month (a cell can hold both day and night rows, and peat/mineral rows when labels
exist). The harmonized series for a cell set is computed with the same ``build_series`` used
for regions, so a region-sized cell set reproduces the region series.

* ``grid_stratum_table`` - daily_cell -> monthly 0.05 deg table with stratum keys.
* ``kappa_grid``         - per (g_id, island_region, daynight, is_peat, season) kappa.
* ``harmonized_cells``   - harmonized monthly series for an arbitrary set of g_id.
* ``check_aggregation``  - region/province-sized cell sets vs the direct series (<= 1%).

    python -m pipeline.science.aoi [--data-root ...]   # runs the check on real data
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .calibrate import CAL_YEARS, KappaFit, fit_kappa
from .common import SEASON_OF_MONTH, STRATUM_KEYS, data_dir
from .series import ERA_AQUA_END, _lookup, build_series

RES = 0.05
EPS = 1e-9


def grid_id(lat, lon, res: float = RES) -> np.ndarray:
    """Same cell id as pipeline.data.grid.cell_id_sql."""
    n = int(round(360 / res))
    return (np.floor((np.asarray(lat) + 90) / res + EPS).astype(np.int64) * n
            + np.floor((np.asarray(lon) + 180) / res + EPS).astype(np.int64))


def grid_stratum_table(daily_cell: pd.DataFrame | str | Path, res: float = RES,
                       use_peat: bool = True) -> pd.DataFrame:
    """Monthly cell-days per (g_id, stratum, province, satellite) from daily_cell rows.

    ``is_peat`` is True only where labels say peat (unknown -> False, as in validate_all).
    """
    if not isinstance(daily_cell, pd.DataFrame):
        cols = ["local_date", "satellite", "daynight", "island_region", "is_peat", "province",
                "cell_lat", "cell_lon"]
        daily_cell = pd.read_parquet(daily_cell, columns=cols)
    d = daily_cell
    dt = pd.to_datetime(d["local_date"])
    out = pd.DataFrame({
        "year": dt.dt.year.astype(int), "month": dt.dt.month.astype(int),
        "g_id": grid_id(d["cell_lat"], d["cell_lon"], res),
        "island_region": d["island_region"].astype(str), "daynight": d["daynight"].astype(str),
        "is_peat": d["is_peat"].fillna(False).astype(bool) if use_peat else False,
        "province": d["province"].fillna("").astype(str) if "province" in d else "",
        "satellite": d["satellite"].astype(str),
    })
    out["season"] = out["month"].map(SEASON_OF_MONTH)
    keys = ["year", "month", "g_id", "province", "satellite"] + STRATUM_KEYS
    g = out.groupby(keys, observed=True).size().rename("cell_days").reset_index()
    g["cell_days"] = g["cell_days"].astype(float)
    n = int(round(360 / res))
    g["g_lat"] = (g["g_id"] // n + 0.5) * res - 90
    g["g_lon"] = (g["g_id"] % n + 0.5) * res - 180
    return g


def kappa_grid(grid: pd.DataFrame, fit: KappaFit) -> pd.DataFrame:
    """kappa for every (g_id, island_region, daynight, is_peat, season) present in ``grid``."""
    t = grid[["g_id", "g_lat", "g_lon"] + STRATUM_KEYS].drop_duplicates().reset_index(drop=True)
    t["kappa"], _ = _lookup(t, fit, STRATUM_KEYS, "kappa")
    return t


def harmonized_cells(grid: pd.DataFrame, fit: KappaFit, cells=None, terra_aqua=None,
                     n20_snpp=None, aqua_end=ERA_AQUA_END) -> pd.DataFrame:
    """Harmonized national-style monthly series (H, H_lo, H_hi, raw) for a set of g_id."""
    g = grid if cells is None else grid[grid["g_id"].isin(set(cells))]
    ms = g.groupby(["year", "month", "satellite"] + STRATUM_KEYS, as_index=False,
                   observed=True)["cell_days"].sum()
    return build_series(ms, fit, terra_aqua=terra_aqua, n20_snpp=n20_snpp, by=[],
                        aqua_end=aqua_end)


def _rel_err(a: pd.DataFrame, b: pd.DataFrame, min_h: float) -> dict:
    m = a[["year", "month", "H"]].merge(b[["year", "month", "H"]], on=["year", "month"],
                                        how="outer", suffixes=("_cells", "_ref")).fillna(0.0)
    tot = abs(m["H_cells"].sum() - m["H_ref"].sum()) / max(m["H_ref"].sum(), EPS)
    big = m[m["H_ref"] >= min_h]
    mx = float((abs(big["H_cells"] - big["H_ref"]) / big["H_ref"]).max()) if len(big) else 0.0
    return {"total_rel_err": float(tot), "max_monthly_rel_err": mx, "n_months": int(len(big))}


def check_aggregation(grid: pd.DataFrame, ms_ref: pd.DataFrame, fit: KappaFit,
                      provinces=("Riau", "Kalimantan Tengah"), tol=0.01, min_h=10.0) -> list[dict]:
    """Region-sized cell sets vs ``build_series`` on ``ms_ref`` (monthly_stratum schema), and
    province-sized cell sets vs the province series from the same grid table.

    Cells are assigned to a region/province by their rows' label (a boundary cell is split
    between AOIs), which is what an exact polygon sum gives at 0.05 deg.
    """
    out = []
    ref = build_series(ms_ref, fit, by=["island_region"])
    for reg, r in ref.groupby("island_region"):
        h = harmonized_cells(grid[grid["island_region"] == reg], fit)
        e = _rel_err(h, r, min_h)
        out.append({"aoi": f"region {reg}", **e, "passed": e["max_monthly_rel_err"] <= tol
                    and e["total_rel_err"] <= tol})
    msp = grid.groupby(["year", "month", "satellite", "province"] + STRATUM_KEYS,
                       as_index=False, observed=True)["cell_days"].sum()
    pref = build_series(msp, fit, by=["province"])
    for p in provinces:
        h = harmonized_cells(grid[grid["province"] == p], fit)
        e = _rel_err(h, pref[pref["province"] == p], min_h)
        out.append({"aoi": f"province {p}", **e, "passed": e["max_monthly_rel_err"] <= tol
                    and e["total_rel_err"] <= tol})
    # additivity: per-province harmonized series summed over a region == region series
    for reg in ("Sumatra", "Kalimantan"):
        g = grid[grid["island_region"] == reg]
        parts = [harmonized_cells(gp, fit) for _, gp in g.groupby("province")]
        if not parts:
            continue
        h = pd.concat(parts).groupby(["year", "month"], as_index=False)["H"].sum()
        e = _rel_err(h, ref[ref["island_region"] == reg], min_h)
        out.append({"aoi": f"sum of provinces {reg}", **e, "passed":
                    e["max_monthly_rel_err"] <= tol and e["total_rel_err"] <= tol})
    return out


def main(argv=None):
    from pipeline.run.validate_all import load_monthly_stratum
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", default=None)
    args = ap.parse_args(argv)
    root = Path(args.data_root) if args.data_root else data_dir()
    ms, info = load_monthly_stratum(root)
    fit = fit_kappa(ms, years=CAL_YEARS, n_boot=0)
    src = root / "derived" / "daily_cell_labeled.parquet"
    src = src if src.exists() else root / "derived" / "daily_cell.parquet"
    # peat keys only when the fit was made with peat labels (else every row is one stratum)
    grid = grid_stratum_table(src,
                              use_peat=bool(info.get("peat_joined")))
    res = check_aggregation(grid, ms, fit)
    for r in res:
        print(json.dumps(r))
    print("all passed:", all(r["passed"] for r in res))


if __name__ == "__main__":
    main()
