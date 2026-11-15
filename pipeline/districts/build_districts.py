"""KalenderApi project 4: a monthly fire record for every Indonesian district (kabupaten/kota).

Method: a share-out of the province record, nothing more.
1. Every 0.05 degree grid cell of the Second Sight bundle (ss-data/grid005) is given to the district (geoBoundaries
   gbOpen ADM2) that contains the cell centre; a centre that falls just outside every polygon (simplified coast) goes
   to the nearest district within 0.05 degree, otherwise the cell is left out. A district belongs to the province
   (geoBoundaries gbHumanitarian ADM1, the layer the bundle's province records were built with) it overlaps most.
2. The grid is checked against the bundle first: nationally (same unit?) and per province and satellite.
3. District value for a month = district raw count of the sensor named in the province's `sensor_used`
   x (province H / province raw count of that sensor). The same factor is used for H_lo and H_hi. Province raw 0 -> 0.
4. baseline_median and pct_rank follow vendor/second-sight/pipeline/science/baseline.py: median of H over the same
   calendar month in 2003-2022; rank of H among the same calendar month of earlier years (ties count half).
   They are computed on the rounded H that is written to the file.

Locked months: nothing is aggregated or written for the districts of Kalimantan Tengah for 2019-01 to 2019-10
(a registered test of a sibling project locks them). Those rows carry null values, and the province is left out of
the grid check for those ten months.

Usage (from the project root, with the project venv):
  .venv/Scripts/python.exe pipeline/districts/build_districts.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import time
import unicodedata
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import shapely
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[2]
SATS = {"Aqua": "A_raw", "Terra": "T_raw", "SNPP": "V_raw", "NOAA20": "N20_raw"}
FIELDS = ["aoi_id", "year", "month", "H", "H_lo", "H_hi", "A_raw", "T_raw", "V_raw", "N20_raw", "sensor_used",
          "baseline_median", "pct_rank", "obs_class", "flag_nrt", "flag_partial", "agreement"]
LOCK_PROVINCE, LOCK_YEAR, LOCK_LAST_MONTH = "Kalimantan Tengah", 2019, 10
NEAR_DEG = 0.05          # a cell centre this close to a district still counts as that district
LOW_DATA = 50            # fire cell-days a year (harmonized), below this the district is flagged low_data
CHECK_MIN = 100          # months with fewer province cell-days are left out of max_abs_pct_diff
MAX_GEOJSON_BYTES = 3_000_000
# units of the ADM2 layer that are not a kabupaten or kota (lakes, reservoirs, one forest polygon): left out
NOT_A_DISTRICT = ("Danau", "Danau Toba", "Hutan", "Waduk Cirata", "Wadung Kedungombo")
BOUNDARY_SOURCE = ("geoBoundaries gbOpen IDN ADM2 (simplified), boundary id IDN-ADM2-22746128, build 12 Dec 2023, from "
                   "Badan Pusat Statistik (BPS), World Food Programme and OCHA ROAP; www.geoboundaries.org")
# the licence the geoBoundaries API reports for this layer (read 2026-11-15); the geoBoundaries database is CC BY 4.0
BOUNDARY_LICENCE = "CC BY 3.0 IGO"
BOUNDARY_LICENCE_NOTE = ("geoBoundaries metadata for IDN ADM2 gbOpen gives 'Creative Commons Attribution 3.0 "
                         "Intergovernmental Organisations (CC BY 3.0 IGO)' for the boundary data; the geoBoundaries "
                         "database itself is published under CC BY 4.0")


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_units(path: Path, skip=()):
    with open(path, encoding="utf-8") as f:
        gj = json.load(f)
    names, geoms = [], []
    for ft in gj["features"]:
        g = shape(ft["geometry"])
        if not g.is_valid:
            g = shapely.make_valid(g)
            if g.geom_type == "GeometryCollection":
                g = shapely.unary_union([p for p in g.geoms if p.geom_type in ("Polygon", "MultiPolygon")])
        if ft["properties"]["shapeName"] in skip:
            continue
        names.append(ft["properties"]["shapeName"])
        geoms.append(g)
    return names, geoms


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def num(v, nd=None):
    if v is None:
        return None
    v = float(v)
    if math.isnan(v):
        return None
    if nd is not None:
        v = round(v, nd)
    return int(v) if v.is_integer() else v


def baseline_and_rank(H: np.ndarray, years: np.ndarray, months: np.ndarray, period):
    """H: (n, T) with NaN for 'no value'. Returns baseline_median (n, T) and pct_rank (n, T)."""
    n, T = H.shape
    base = np.full((n, T), np.nan)
    rank = np.full((n, T), np.nan)
    for m in range(1, 13):
        idx = np.where(months == m)[0]                       # ascending in time
        yrs = years[idx]
        v = H[:, idx]                                        # (n, k)
        inb = (yrs >= period[0]) & (yrs <= period[1])
        vb = v[:, inb]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            med = np.where(np.isfinite(vb).any(axis=1), np.nanmedian(np.where(np.isfinite(vb), vb, np.nan), axis=1),
                           np.nan) if vb.shape[1] else np.full(n, np.nan)
        base[:, idx] = med[:, None]
        for i in range(1, len(idx)):
            prior, cur = v[:, :i], v[:, i]
            ok = np.isfinite(prior)
            cnt = ok.sum(axis=1)
            below = (ok & (prior < cur[:, None])).sum(axis=1) + 0.5 * (ok & (prior == cur[:, None])).sum(axis=1)
            with np.errstate(all="ignore"):
                r = below / cnt
            rank[:, idx[i]] = np.where((cnt > 0) & np.isfinite(cur), r, np.nan)
    base[~np.isfinite(H)] = np.nan                           # the bundle gives no baseline to a row without H
    return base, rank


def round_coords(obj, nd=4):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [round_coords(o, nd) for o in obj]
    return obj


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=str(ROOT))
    a = ap.parse_args(argv)
    t0 = time.time()
    root = Path(a.root)
    ss = root / "app/public/ss-data"
    out = ss / "districts"
    adm2_path = root / "data-raw/geoboundaries/geoBoundaries-IDN-ADM2_simplified.geojson"
    adm1_path = root / "data-raw/ss/support/boundaries/geoBoundaries-IDN-ADM1-gbHumanitarian_simplified.geojson"
    ss_index = json.loads((ss / "index.json").read_text(encoding="utf-8"))
    period = ss_index["baseline_period"]
    provs = [x for x in ss_index["aois"] if x["level"] == "province"]
    pname = [x["name"] for x in provs]
    P = len(provs)

    # ---- boundaries -------------------------------------------------------------------------------------------
    dnames, dgeoms = load_units(adm2_path, skip=NOT_A_DISTRICT)
    p1names, p1geoms = load_units(adm1_path)
    assert sorted(p1names) == sorted(pname), "ADM1 names differ from the bundle's province names"
    D = len(dnames)
    tree1 = shapely.STRtree(p1geoms)
    dprov, dshare = [], []
    for g in dgeoms:
        best, barea = -1, 0.0
        for j in tree1.query(g, predicate="intersects"):
            ar = g.intersection(p1geoms[j]).area
            if ar > barea:
                best, barea = int(j), ar
        if best < 0:
            best = int(tree1.nearest(g))
        dprov.append(pname.index(p1names[best]))
        dshare.append(barea / g.area if g.area else 0.0)
    dprov = np.array(dprov)
    slugs = [slug(nm) for nm in dnames]
    assert len(set(slugs)) == D, "district slugs are not unique"
    aoi_ids = ["kab-" + s for s in slugs]
    print(f"[districts] {D} districts, {P} provinces; lowest province overlap share {min(dshare):.3f}")

    # ---- grid -------------------------------------------------------------------------------------------------
    fr = []
    grid_files = sorted((ss / "grid005").glob("grid005_*.parquet"))
    for p in grid_files:
        d = pd.read_parquet(p, columns=["month", "g_id", "g_lat", "g_lon", "satellite", "n_cells"])
        d["year"] = int(p.stem.split("_")[1])
        fr.append(d)
    G = pd.concat(fr, ignore_index=True)
    G["month"] = G["month"].astype(int)
    G = G[G["satellite"].isin(list(SATS))].reset_index(drop=True)      # NOAA-21 has no raw column in the bundle
    cells_all = pd.concat(fr, ignore_index=True).groupby("g_id")[["g_lat", "g_lon"]].first()
    del fr
    pts = shapely.points(cells_all["g_lon"].to_numpy(), cells_all["g_lat"].to_numpy())
    tree2 = shapely.STRtree(dgeoms)
    pi, di = tree2.query(pts, predicate="intersects")
    cell_d = np.full(len(cells_all), -1)
    cell_d[pi[::-1]] = di[::-1]                                        # first match wins
    n_inside = int((cell_d >= 0).sum())
    un = np.where(cell_d < 0)[0]
    if len(un):
        qi, ni = tree2.query_nearest(pts[un], max_distance=NEAR_DEG, all_matches=False)
        cell_d[un[qi]] = ni
    n_near = int((cell_d >= 0).sum()) - n_inside
    n_out = int((cell_d < 0).sum())
    cell_of = pd.Series(cell_d, index=cells_all.index)
    G["d"] = cell_of.reindex(G["g_id"]).to_numpy()
    tot_cd = float(G["n_cells"].sum())
    out_cd = float(G.loc[G["d"] < 0, "n_cells"].sum())
    print(f"[districts] cells with fire: {len(cells_all)}; centre inside a district {n_inside}, nearest within "
          f"{NEAR_DEG} deg {n_near}, left out {n_out} ({100 * out_cd / tot_cd:.3f}% of cell-days)")

    # months of the record = months of the province files
    prow = {x["aoi_id"]: json.loads((ss / x["file"]).read_text(encoding="utf-8")) for x in provs}
    months = [(r["year"], r["month"]) for r in prow[provs[0]["aoi_id"]]]
    T = len(months)
    yrs = np.array([y for y, _ in months])
    mos = np.array([m for _, m in months])
    tidx = {ym: i for i, ym in enumerate(months)}
    G["t"] = [tidx.get(k, -1) for k in zip(G["year"].to_numpy(), G["month"].to_numpy())]

    # ---- unit check: national grid sums against monthly_IDN.json -------------------------------------------
    idn = json.loads((ss / "monthly_IDN.json").read_text(encoding="utf-8"))
    assert [(r["year"], r["month"]) for r in idn] == months
    unit = {}
    for sat, col in SATS.items():
        g = np.zeros(T)
        s = G[(G["satellite"] == sat) & (G["t"] >= 0)]
        np.add.at(g, s["t"].to_numpy(), s["n_cells"].to_numpy())
        f = np.array([np.nan if r[col] is None else r[col] for r in idn], float)
        ok = np.isfinite(f)
        unit[sat] = {"months": int(ok.sum()), "sum_grid": int(g[ok].sum()), "sum_file": int(f[ok].sum()),
                     "max_abs_diff": float(np.abs(g[ok] - f[ok]).max())}
    print("[districts] national unit check:", unit)
    if any(u["max_abs_diff"] != 0 for u in unit.values()):
        raise SystemExit("grid n_cells does not reproduce monthly_IDN.json: unit differs, stopping")

    # ---- locked months: drop before anything is aggregated -------------------------------------------------
    lock_p = pname.index(LOCK_PROVINCE)
    lock_t = np.array([(y == LOCK_YEAR and m <= LOCK_LAST_MONTH) for y, m in months])
    G["p"] = np.where(G["d"] >= 0, dprov[np.clip(G["d"].to_numpy(), 0, None)], -1)
    G = G[(G["d"] >= 0) & (G["t"] >= 0)
          & ~((G["p"] == lock_p) & (G["year"] == LOCK_YEAR) & (G["month"] <= LOCK_LAST_MONTH))]

    raw_d = {}
    for sat in SATS:
        arr = np.zeros((D, T))
        s = G[G["satellite"] == sat]
        np.add.at(arr, (s["d"].to_numpy(), s["t"].to_numpy()), s["n_cells"].to_numpy())
        raw_d[sat] = arr

    # ---- province arrays ------------------------------------------------------------------------------------
    def col(rows, k):
        return np.array([np.nan if r[k] is None else r[k] for r in rows], float)

    pv = []
    for x in provs:
        rows = prow[x["aoi_id"]]
        assert [(r["year"], r["month"]) for r in rows] == months
        pv.append({"H": col(rows, "H"), "H_lo": col(rows, "H_lo"), "H_hi": col(rows, "H_hi"),
                   "raw": {s: col(rows, c) for s, c in SATS.items()},
                   "sensor": [r["sensor_used"] for r in rows],
                   "flag_nrt": [r["flag_nrt"] for r in rows], "flag_partial": [r["flag_partial"] for r in rows],
                   "base": col(rows, "baseline_median"), "rank": col(rows, "pct_rank")})
        # months in which no active satellite saw fire anywhere in the province: the bundle writes H null and
        # sensor_used null there (it has no rows to harmonize); the raw counts are all 0
        stack = np.array(list(pv[-1]["raw"].values()))
        pv[-1]["zero"] = (np.array([s is None for s in pv[-1]["sensor"]]) & np.isfinite(stack).any(axis=0)
                          & (np.nansum(stack, axis=0) == 0))

    # ---- grid check per province and satellite ---------------------------------------------------------------
    grid_check = []
    for pi_, x in enumerate(provs):
        members = np.where(dprov == pi_)[0]
        for sat in SATS:
            g = raw_d[sat][members].sum(axis=0)
            f = pv[pi_]["raw"][sat]
            ok = np.isfinite(f)
            if pi_ == lock_p:
                ok &= ~lock_t
            big = ok & (f >= CHECK_MIN)
            sf, sg = float(f[ok].sum()), float(g[ok].sum())
            grid_check.append({
                "province": x["name"], "satellite": sat,
                "max_abs_pct_diff": round(float((100 * np.abs(g[big] - f[big]) / f[big]).max()), 2) if big.any() else None,
                "total_pct_diff": round(100 * (sg - sf) / sf, 3) if sf else None,
                "months_compared": int(ok.sum()), "months_with_100_or_more": int(big.sum()),
            })
    worst = sorted((c for c in grid_check if c["total_pct_diff"] is not None), key=lambda c: -abs(c["total_pct_diff"]))
    print("[districts] grid check, largest total differences:")
    for c in worst[:8]:
        print("   ", c)

    # ---- definition check: reproduce the provinces' own baseline and rank ------------------------------------
    keep = [i for i in range(P) if i != lock_p]
    Hp = np.array([pv[i]["H"] for i in keep])
    b, r = baseline_and_rank(Hp, yrs, mos, period)
    fb = np.array([pv[i]["base"] for i in keep])
    fr_ = np.array([pv[i]["rank"] for i in keep])
    def_check = {
        "provinces": len(keep),
        "baseline_median_max_abs_diff": float(np.nanmax(np.abs(b - fb))),
        "pct_rank_max_abs_diff": float(np.nanmax(np.abs(r - fr_))),
        "null_pattern_equal": bool((np.isfinite(b) == np.isfinite(fb)).all() and (np.isfinite(r) == np.isfinite(fr_)).all()),
    }
    print("[districts] definition check against the province files:", def_check)

    # ---- district values --------------------------------------------------------------------------------------
    Hd = {k: np.full((D, T), np.nan) for k in ("H", "H_lo", "H_hi")}
    fire_but_prov_zero = 0
    for d in range(D):
        p = pv[dprov[d]]
        raw_p = np.array([p["raw"][s][t] if s in SATS else np.nan for t, s in enumerate(p["sensor"])])
        raw_dd = np.array([raw_d[s][d, t] if s in SATS else np.nan for t, s in enumerate(p["sensor"])])
        any_d = sum(raw_d[s][d] for s in SATS) > 0
        fire_but_prov_zero += int(((raw_p == 0) & (raw_dd > 0)).sum()) + int((p["zero"] & any_d).sum())
        for k in Hd:
            with np.errstate(all="ignore"):
                conv = np.where(raw_p > 0, p[k] / raw_p, 0.0)
            v = raw_dd * conv
            v[~np.isfinite(raw_p) | ~np.isfinite(p[k])] = np.nan
            v[p["zero"]] = 0.0                       # province raw count 0 -> district value 0
            if dprov[d] == lock_p:
                v[lock_t] = np.nan
            Hd[k][d] = np.round(v, 2)
    base, rank = baseline_and_rank(Hd["H"], yrs, mos, period)

    # ---- write --------------------------------------------------------------------------------------------------
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("monthly_kab-*.json"):          # this folder is owned by this script
        old.unlink()
    import geopandas as gpd
    area = (gpd.GeoSeries(dgeoms, crs=4326).to_crs(6933).area / 1e6).to_numpy()
    full_years = [y for y in sorted(set(yrs.tolist())) if (yrs == y).sum() == 12 and y < dt.date.today().year]
    entries, total_bytes, n_rows = [], 0, 0
    for d in range(D):
        p = pv[dprov[d]]
        locked = dprov[d] == lock_p
        rows = []
        for t, (y, m) in enumerate(months):
            lk = locked and lock_t[t]
            row = {"aoi_id": aoi_ids[d], "year": y, "month": m,
                   "H": num(Hd["H"][d, t]), "H_lo": num(Hd["H_lo"][d, t]), "H_hi": num(Hd["H_hi"][d, t])}
            for s, c in SATS.items():
                row[c] = None if (lk or not np.isfinite(p["raw"][s][t])) else int(raw_d[s][d, t])
            row.update({"sensor_used": p["sensor"][t], "baseline_median": num(base[d, t], 2),
                        "pct_rank": num(rank[d, t], 4), "obs_class": None, "flag_nrt": p["flag_nrt"][t],
                        "flag_partial": p["flag_partial"][t], "agreement": None})
            rows.append({k: row[k] for k in FIELDS})
        f = out / f"monthly_{aoi_ids[d]}.json"
        f.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
        total_bytes += f.stat().st_size
        n_rows += len(rows)
        ann = [Hd["H"][d, yrs == y] for y in full_years]
        ann = [float(v.sum()) for v in ann if np.isfinite(v).all()]
        mean_cd = round(sum(ann) / len(ann), 1) if ann else None
        g = dgeoms[d]
        c = g.centroid
        w, s_, e, n_ = g.bounds
        entries.append({
            "aoi_id": aoi_ids[d], "name": dnames[d], "province": pname[dprov[d]],
            "province_aoi": provs[dprov[d]]["aoi_id"], "island_region": provs[dprov[d]]["island_region"],
            "level": "district", "area_km2": round(float(area[d]), 1),
            "centroid": [round(c.x, 4), round(c.y, 4)], "bbox": [round(w, 4), round(s_, 4), round(e, 4), round(n_, 4)],
            "file": f"districts/{f.name}", "n_months": len(rows),
            "first": f"{rows[0]['year']}-{rows[0]['month']:02d}", "last": f"{rows[-1]['year']}-{rows[-1]['month']:02d}",
            "provisional_months": [f"{r['year']}-{r['month']:02d}" for r in rows if r["flag_nrt"] or r["flag_partial"]],
            "mean_cell_days_per_year": mean_cd, "low_data": bool(mean_cd is None or mean_cd < LOW_DATA),
            "years_in_mean": len(ann), "province_overlap_share": round(dshare[d], 3),
            **({"locked_months": [f"{y}-{m:02d}" for (y, m), lk in zip(months, lock_t) if lk]} if locked else {}),
        })

    # district polygons, simplified until the file is small enough
    tol_used = None
    for tol in (0.001, 0.002, 0.003, 0.004, 0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05):
        feats = []
        for d in range(D):
            g = shapely.simplify(dgeoms[d], tol, preserve_topology=True)
            if g.is_empty:
                g = dgeoms[d]
            m_ = mapping(g)
            feats.append({"type": "Feature",
                          "properties": {"aoi_id": aoi_ids[d], "name": dnames[d], "province": pname[dprov[d]]},
                          "geometry": {"type": m_["type"], "coordinates": round_coords(m_["coordinates"])}})
        txt = json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":"))
        if len(txt.encode("utf-8")) < MAX_GEOJSON_BYTES:
            tol_used = tol
            break
    gj_path = out / "districts.geojson"
    gj_path.write_text(txt, encoding="utf-8")

    keep_c = cell_d >= 0
    cells_path = out / "cells.json"
    cells_path.write_text(json.dumps({
        "g_id": [int(v) for v in cells_all.index.to_numpy()[keep_c]],
        "district": [int(v) for v in cell_d[keep_c]],
        "g_id_rule": "g_id = floor((lat + 90) / 0.05) * 7200 + floor((lon + 180) / 0.05); the cell centre is the "
                     "lower-left corner plus 0.025 degree",
        "district_rule": f"index into districts[] of districts/index.json; the district that contains the cell centre, "
                         f"or the nearest one within {NEAR_DEG} degree",
        "left_out": {"cells": n_out, "share_of_cell_days_pct": round(100 * out_cd / tot_cd, 3),
                     "why": f"centre more than {NEAR_DEG} degree from every district (sea, or outside Indonesia)"},
    }, separators=(",", ":")), encoding="utf-8")

    tp = [c["total_pct_diff"] for c in grid_check if c["total_pct_diff"] is not None]
    index = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "approximate": True,
        "method": "Each 0.05 degree grid cell is given to the district that contains its centre, and the district's "
                  "monthly count from the sensor its province uses that month is multiplied by the province's own "
                  "conversion for that month (province H divided by the province's raw count from that sensor). "
                  "District values are a share-out of the province record, not a separate harmonization, and they "
                  "are approximate near district borders.",
        "unit": ss_index["unit"],
        "fields": FIELDS,
        "baseline_period": period,
        "definitions": {
            "H": "district raw count of the province's sensor_used x (province H / province raw count of that sensor); "
                 "0 when the province raw count is 0, which includes the months where the province row has H null and "
                 "sensor_used null because no satellite saw fire anywhere in the province (sensor_used stays null "
                 "there); null only in the locked months; rounded to 2 decimals",
            "baseline_median": "median of the district's H over the same calendar month, "
                               f"{period[0]} to {period[1]} (the bundle's definition), on the rounded H",
            "pct_rank": "rank of H among the same calendar month of earlier years, ties count half, null when there is "
                        "no earlier year (the bundle's definition), on the rounded H; with many zero months the rank "
                        "of a zero is the share of ties, not a sign of fire",
            "flags": "flag_nrt and flag_partial are copied from the province row; obs_class and agreement are null "
                     "(not computed)",
            "mean_cell_days_per_year": f"mean yearly sum of H over the complete calendar years {full_years[0]} to "
                                       f"{full_years[-1]} (years with a null month are skipped; years_in_mean says "
                                       f"how many were used); low_data is true below {LOW_DATA}",
        },
        "boundaries": {
            "source": BOUNDARY_SOURCE, "licence": BOUNDARY_LICENCE, "licence_note": BOUNDARY_LICENCE_NOTE,
            "file": "districts/districts.geojson", "sha256": sha256_of(gj_path),
            "simplify_tolerance_deg": tol_used, "bytes": gj_path.stat().st_size,
            "source_file": "data-raw/geoboundaries/" + adm2_path.name, "source_sha256": sha256_of(adm2_path),
            "province_layer": "geoBoundaries gbHumanitarian IDN ADM1 (CC BY 3.0 IGO), the layer of the bundle's "
                              "province records; a district belongs to the province it overlaps most",
            "province_layer_sha256": sha256_of(adm1_path),
        },
        "locked": {
            "province": LOCK_PROVINCE,
            "months": [f"{y}-{m:02d}" for (y, m), lk in zip(months, lock_t) if lk],
            "districts": [aoi_ids[d] for d in range(D) if dprov[d] == lock_p],
            "note": "For these districts the rows of these months have null H, H_lo, H_hi, raw counts and pct_rank: "
                    "a registered test of a sibling project locks Central Kalimantan and Pulang Pisau for 1 January "
                    "to 31 October 2019, so nothing was computed. Their baseline and ranks leave 2019 out for January "
                    "to October. The province record still has those months.",
        },
        "unit_check": {"what": "national grid sums against monthly_IDN.json, every month", "by_satellite": unit},
        "grid_check_note": "Grid cells summed per province (through the districts) against the province file's raw "
                           f"column, month by month. max_abs_pct_diff is the largest monthly difference over months "
                           f"with at least {CHECK_MIN} province cell-days; total_pct_diff compares the sums over all "
                           "months. The differences come from 0.05 degree cells that straddle a province border and "
                           "from the two boundary layers (gbOpen ADM2 here, gbHumanitarian ADM1 in the bundle). "
                           "Districts add up to their province to within this difference.",
        "grid_check_summary": {"pairs": len(grid_check),
                               "median_abs_total_pct_diff": round(float(np.median(np.abs(tp))), 3),
                               "max_abs_total_pct_diff": round(float(np.max(np.abs(tp))), 3)},
        "grid_check": grid_check,
        "definition_check": {"what": "this script's baseline_median and pct_rank applied to the province H series "
                                     "against the values in the province files (Kalimantan Tengah left out)",
                             **def_check},
        "cells": {"file": "districts/cells.json", "with_fire": int(len(cells_all)), "centre_inside": n_inside,
                  "nearest_within_0.05_deg": n_near, "left_out": n_out,
                  "left_out_share_of_cell_days_pct": round(100 * out_cd / tot_cd, 3)},
        "district_months_with_fire_but_province_raw_zero": fire_but_prov_zero,
        "excluded_units": {"names": list(NOT_A_DISTRICT),
                           "why": "units of the ADM2 layer that are lakes, reservoirs or a forest polygon, not a "
                                  "kabupaten or kota; a grid cell centred on one goes to the nearest district within "
                                  f"{NEAR_DEG} degree or is left out"},
        "n_districts": D, "n_rows": n_rows, "monthly_files_bytes": total_bytes,
        "districts": entries,
    }
    (out / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    print(f"[districts] wrote {D} monthly files ({n_rows} rows, {total_bytes} bytes), districts.geojson "
          f"({gj_path.stat().st_size} bytes, tolerance {tol_used}), cells.json ({cells_path.stat().st_size} bytes), "
          f"index.json; low_data {sum(e['low_data'] for e in entries)} of {D}; {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
