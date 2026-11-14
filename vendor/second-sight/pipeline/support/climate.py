"""DAT-11: CHIRPS monthly precipitation aggregated per province (+ national).

AI-assisted code (see docs/ai_acknowledgement.md).

Source (checked 2026-11-14): CHIRPS v2.0 global monthly GeoTIFF, 0.05 deg, 50S-50N, mm/month,
nodata -9999. CHC moved the tree: the old /products/CHIRPS-2.0/ path now 404s.
  https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_monthly/tifs/chirps-v2.0.YYYY.MM.tif.gz
  (~14 MB each; the newest month may be an uncompressed .tif)
License: CHIRPS is public domain / CC0-like ("To the extent possible under law, ... waived all
copyright"), cite Funk et al. 2015, Sci. Data 2:150066.
Each month is cropped to the Indonesia bbox right away and stored as a small .npz; the global
file is not kept. The reader uses Pillow (no rasterio/GDAL needed); rasterio is optional.

"Rolling 30/90 days" at monthly resolution:
  precip_1m_mm_day = P(m) / days(m)
  precip_3m_mm_day = (P(m-2) + P(m-1) + P(m)) / (days(m-2) + days(m-1) + days(m))
Drought Code (GEFF-ERA5) is NOT implemented here (optional in DAT-11; needs a CDS account).

Output: ${SS_DATA_DIR}/support/climate/climate_monthly.parquet (or .csv if pyarrow is missing)
columns: aoi_type, aoi_id, year, month, precip_mm, precip_1m_mm_day, precip_3m_mm_day, valid_frac
CLI: python -m pipeline.support.climate --start 2001-01 --end 2026-10
"""
from __future__ import annotations

import argparse
import calendar
import gzip
import io
from pathlib import Path

import numpy as np
import pandas as pd

from ._common import http_get, sha256_file, support_dir, write_provenance

BASE = "https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_monthly/tifs/"
LICENSE = "CHIRPS v2.0: public domain (copyright waived by CHC/UCSB); cite Funk et al. 2015"
NODATA = -9999.0
RES = 0.05
GLOBAL_WEST, GLOBAL_NORTH = -180.0, 50.0
# Indonesia bbox (lon_min, lat_min, lon_max, lat_max), aligned to the 0.05 deg grid
IDN_BBOX = (94.0, -11.5, 141.5, 6.5)


# ----------------------------------------------------------------------------- raster IO
def grid_window(bbox=IDN_BBOX, west=GLOBAL_WEST, north=GLOBAL_NORTH, res=RES):
    """Row/col slice of the global grid covering bbox, plus the cell-centre lon/lat vectors."""
    lon0, lat0, lon1, lat1 = bbox
    c0, c1 = int(round((lon0 - west) / res)), int(round((lon1 - west) / res))
    r0, r1 = int(round((north - lat1) / res)), int(round((north - lat0) / res))
    lons = west + (np.arange(c0, c1) + 0.5) * res
    lats = north - (np.arange(r0, r1) + 0.5) * res
    return (slice(r0, r1), slice(c0, c1)), lons, lats


def read_tif_bytes(b: bytes) -> np.ndarray:
    """Read a single-band float GeoTIFF into float32 with NaN for nodata."""
    try:
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = None
        a = np.array(Image.open(io.BytesIO(b)), dtype=np.float32)
    except Exception:  # fall back to rasterio if Pillow cannot decode (e.g. COG with odd compression)
        import rasterio
        from rasterio.io import MemoryFile

        with MemoryFile(b) as mf, mf.open() as ds:
            a = ds.read(1).astype(np.float32)
    a[a <= NODATA + 1] = np.nan
    return a


def month_path(year: int, month: int) -> Path:
    return support_dir("climate", "chirps_idn") / f"chirps_idn_{year:04d}_{month:02d}.npz"


def fetch_month(year: int, month: int, force: bool = False) -> Path:
    """Download one global month, crop to Indonesia, save .npz (+ provenance)."""
    dest = month_path(year, month)
    if dest.exists() and not force:
        return dest
    name = f"chirps-v2.0.{year:04d}.{month:02d}.tif"
    try:
        url = BASE + name + ".gz"
        raw = gzip.decompress(http_get(url, timeout=600).content)
    except Exception:
        url = BASE + name  # newest month is sometimes uncompressed
        raw = http_get(url, timeout=600).content
    a = read_tif_bytes(raw)
    win, lons, lats = grid_window()
    tmp = dest.with_suffix(".part")
    with open(tmp, "wb") as f:  # atomic: never leave a half-written .npz
        np.savez_compressed(f, precip_mm=a[win], lons=lons, lats=lats)
    tmp.replace(dest)
    write_provenance(dest, source_url=url, license=LICENSE,
                     notes=f"cropped to bbox {IDN_BBOX}; global file discarded",
                     source_sha256_uncompressed=__import__("hashlib").sha256(raw).hexdigest())
    return dest


def load_month(path: Path):
    z = np.load(path)
    return z["precip_mm"], z["lons"], z["lats"]


# ----------------------------------------------------------------------------- aggregation
def build_masks(units: list[tuple[str, object]], lons: np.ndarray, lats: np.ndarray) -> dict[str, np.ndarray]:
    """Boolean mask per AOI: grid cell centre inside polygon."""
    import shapely

    X, Y = np.meshgrid(lons, lats)
    masks = {}
    for name, geom in units:
        shapely.prepare(geom)
        m = shapely.contains_xy(geom, X, Y)
        if m.any():
            masks[name] = masks[name] | m if name in masks else m
    return masks


def area_weights(lats: np.ndarray, ncols: int) -> np.ndarray:
    return np.repeat(np.cos(np.deg2rad(lats))[:, None], ncols, axis=1)


def aggregate(grid: np.ndarray, masks: dict[str, np.ndarray], weights: np.ndarray) -> dict[str, tuple[float, float]]:
    """Area-weighted mean of grid within each mask -> {aoi: (mean, valid_fraction)}."""
    out = {}
    valid = np.isfinite(grid)
    for name, m in masks.items():
        mv = m & valid
        w = weights[mv]
        mean = float(np.sum(grid[mv] * w) / np.sum(w)) if w.size else np.nan
        out[name] = (mean, float(mv.sum() / m.sum()) if m.sum() else 0.0)
    return out


def add_rolling(df: pd.DataFrame) -> pd.DataFrame:
    """Add 1- and 3-month mean precipitation (mm/day) per AOI; requires year, month, precip_mm."""
    df = df.sort_values(["aoi_type", "aoi_id", "year", "month"]).copy()
    df["days"] = [calendar.monthrange(int(y), int(m))[1] for y, m in zip(df["year"], df["month"])]
    df["precip_1m_mm_day"] = df["precip_mm"] / df["days"]
    t = df["year"] * 12 + df["month"]
    parts = []
    for _, g in df.groupby(["aoi_type", "aoi_id"], sort=False):
        g = g.copy()
        gt = t.loc[g.index]
        contiguous = (gt.diff(1) == 1) & (gt.diff(2) == 2)  # m-1 and m-2 present
        num = g["precip_mm"].rolling(3).sum()
        den = g["days"].rolling(3).sum()
        g["precip_3m_mm_day"] = (num / den).where(contiguous)
        parts.append(g)
    return pd.concat(parts).drop(columns="days")


def climate_monthly(months: list[tuple[int, int]], units: list[tuple[str, object]],
                    loader=None) -> pd.DataFrame:
    """Aggregate a list of (year, month) to provinces + NATIONAL. loader(y, m) -> (grid, lons, lats)."""
    loader = loader or (lambda y, m: load_month(fetch_month(y, m)))
    masks = weights = None
    rows = []
    for y, m in months:
        grid, lons, lats = loader(y, m)
        if masks is None:
            masks = build_masks(units, lons, lats)
            national = np.zeros_like(next(iter(masks.values())))
            for mk in masks.values():
                national |= mk
            weights = area_weights(lats, len(lons))
        for name, (v, f) in aggregate(grid, masks, weights).items():
            rows.append(("province", name, y, m, v, f))
        (v, f), = aggregate(grid, {"NATIONAL": national}, weights).values()
        rows.append(("national", "NATIONAL", y, m, v, f))
    df = pd.DataFrame(rows, columns=["aoi_type", "aoi_id", "year", "month", "precip_mm", "valid_frac"])
    return add_rolling(df)


def month_range(start: str, end: str) -> list[tuple[int, int]]:
    return [(p.year, p.month) for p in pd.period_range(start, end, freq="M")]


def write_output(df: pd.DataFrame) -> Path:
    out = support_dir("climate") / "climate_monthly.parquet"
    try:
        df.to_parquet(out, index=False)
    except Exception:
        out = out.with_suffix(".csv")
        df.to_csv(out, index=False)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="CHIRPS monthly -> province climate_monthly")
    ap.add_argument("--start", default="2001-01")
    ap.add_argument("--end", default="2026-09")
    ap.add_argument("--download-only", action="store_true")
    ap.add_argument("--workers", type=int, default=4, help="parallel downloads (be polite)")
    a = ap.parse_args(argv)
    months = month_range(a.start, a.end)
    if a.download_only:
        from concurrent.futures import ThreadPoolExecutor

        def one(ym):
            try:
                return str(fetch_month(*ym))
            except Exception as e:
                return f"FAILED {ym[0]}-{ym[1]:02d}: {e}"

        with ThreadPoolExecutor(a.workers) as ex:
            for line in ex.map(one, months):
                print(line, flush=True)
        return
    from .boundaries import boundary_path, load_units

    avail = [(y, m) for y, m in months if month_path(y, m).exists()]
    df = climate_monthly(avail, load_units(boundary_path("ADM1")))
    p = write_output(df)
    print(p, len(df), "rows,", len(avail), "months")


if __name__ == "__main__":
    main()
