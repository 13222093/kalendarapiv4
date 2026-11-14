"""DAT-10: cloud observability from the MODIS CMG fire products (MOD14CMQ / MYD14CMQ).

AI-assisted code (see docs/ai_acknowledgement.md).

Facts below are from the MODIS C6/C6.1 Active Fire User's Guide v1.0 (Giglio, Schroeder & Hall,
May 2021; https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf),
sections 4.3 and 5.4, read on 2026-11-14:
  * Access: UMD SFTP server fuoco.geog.umd.edu, login and password published in the guide
    (section 4.3: login "fire"; the password is printed there because the data are public).
    Directory: data/MODIS/C6/Mx14CMQ  (check for a C61 sibling directory when connecting).
  * Files: M?D14CMQ.YYYYMM.CCC.VV.hdf (O = Terra, Y = Aqua), HDF4, 0.25 deg, 1440 x 720.
  * Layers: CorrFirePix int16, CloudCorrFirePix int16, MeanCloudFraction int8, RawFirePix int16,
    CloudPix int32 ("number of cloud pixels"), TotalPix int32 ("total number of pixels"),
    MeanFRP float32 (MW), NumPixFRP int16.
  * Navigation: y = floor((90 - lat)/0.25), x = floor((lon + 180)/0.25);
    cell centre lat = 89.875 - 0.25*y, lon = -179.875 + 0.25*x.
The download is NOT automated here (needs an SFTP client; this agent did not log in).
Manual step, e.g.:  sftp fire@fuoco.geog.umd.edu  ->  cd data/MODIS/C6/Mx14CMQ  ->  get MYD14CMQ.2019*.hdf
Put the files in ${SS_DATA_DIR}/support/cloud/cmg_hdf/.

f_cloud = CloudPix / TotalPix per 0.25 deg cell x month (NaN where TotalPix == 0).
Combined Terra+Aqua: f_cloud = (CloudPix_T + CloudPix_A) / (TotalPix_T + TotalPix_A).
Fallback if CMG files cannot be obtained: ERA5 monthly "total cloud cover" (tcc) from the
Copernicus CDS (reanalysis-era5-single-levels-monthly-means), regridded to 0.25 deg (native).
Note that ERA5 tcc is all-day mean cloud, not cloud at overpass time; mark rows `source=ERA5`.

Output: ${SS_DATA_DIR}/support/cloud/f_cloud_monthly.parquet
columns: lat, lon, year, month, satellite (TERRA|AQUA|COMBINED), cloud_pix, total_pix, f_cloud, source
"""
from __future__ import annotations

import math
import re
from pathlib import Path

import numpy as np
import pandas as pd

from ._common import support_dir

RES = 0.25
NX, NY = 1440, 720
IDN_BBOX = (94.0, -11.5, 141.5, 6.5)
FNAME_RE = re.compile(r"M([OY])D14CMQ\.(\d{4})(\d{2})\.(\d{3})\.(\d{2})\.hdf$", re.I)
SAT = {"O": "TERRA", "Y": "AQUA"}


def latlon_to_xy(lat, lon):
    y = np.floor((90.0 - np.asarray(lat, float)) / RES).astype(int)
    x = np.floor((np.asarray(lon, float) + 180.0) / RES).astype(int)
    return np.clip(x, 0, NX - 1), np.clip(y, 0, NY - 1)


def xy_to_latlon(x, y):
    return 89.875 - RES * np.asarray(y), -179.875 + RES * np.asarray(x)


def bbox_window(bbox=IDN_BBOX):
    lon0, lat0, lon1, lat1 = bbox
    x0, y0 = int(math.floor((lon0 + 180) / RES)), int(math.floor((90 - lat1) / RES))
    x1, y1 = int(math.ceil((lon1 + 180) / RES)), int(math.ceil((90 - lat0) / RES))
    return slice(y0, y1), slice(x0, x1)


def parse_name(path) -> dict | None:
    m = FNAME_RE.search(Path(path).name)
    if not m:
        return None
    s, y, mo, c, v = m.groups()
    return {"satellite": SAT[s.upper()], "year": int(y), "month": int(mo), "collection": c, "version": v}


def read_cmg_layers(path, layers=("CloudPix", "TotalPix")) -> dict[str, np.ndarray]:
    """Read SDS layers from an HDF4 CMG file. Tries pyhdf, then GDAL."""
    try:
        from pyhdf.SD import SD, SDC

        sd = SD(str(path), SDC.READ)
        try:
            return {n: np.asarray(sd.select(n).get()) for n in layers}
        finally:
            sd.end()
    except ImportError:
        pass
    try:
        from osgeo import gdal

        ds = gdal.Open(str(path))
        subs = {name.split(":")[-1]: name for name, _ in ds.GetSubDatasets()}
        return {n: gdal.Open(subs[n]).ReadAsArray() for n in layers}
    except ImportError as e:
        raise ImportError("Reading MOD14CMQ HDF4 needs pyhdf (pip install pyhdf) or GDAL") from e


def f_cloud(cloud_pix: np.ndarray, total_pix: np.ndarray) -> np.ndarray:
    c = np.asarray(cloud_pix, float)
    t = np.asarray(total_pix, float)
    with np.errstate(invalid="ignore", divide="ignore"):
        f = np.where(t > 0, c / t, np.nan)
    return np.clip(f, 0.0, 1.0)


def cmg_to_frame(cloud_pix, total_pix, year, month, satellite, bbox=IDN_BBOX, source="MxD14CMQ") -> pd.DataFrame:
    """Subset global 720x1440 layers to bbox and return a long table (one row per cell)."""
    ys, xs = bbox_window(bbox)
    c, t = np.asarray(cloud_pix)[ys, xs], np.asarray(total_pix)[ys, xs]
    yy, xx = np.mgrid[ys, xs]
    lat, lon = xy_to_latlon(xx, yy)
    return pd.DataFrame({"lat": lat.ravel(), "lon": lon.ravel(), "year": year, "month": month,
                         "satellite": satellite, "cloud_pix": c.ravel().astype(np.int64),
                         "total_pix": t.ravel().astype(np.int64), "f_cloud": f_cloud(c, t).ravel(),
                         "source": source})


def combine_satellites(df: pd.DataFrame) -> pd.DataFrame:
    """Add COMBINED rows: pooled counts across TERRA and AQUA per cell-month."""
    g = (df[df.satellite.isin(["TERRA", "AQUA"])]
         .groupby(["lat", "lon", "year", "month"], as_index=False)[["cloud_pix", "total_pix"]].sum())
    g["satellite"] = "COMBINED"
    g["f_cloud"] = f_cloud(g.cloud_pix, g.total_pix)
    g["source"] = "MxD14CMQ"
    return pd.concat([df, g[df.columns]], ignore_index=True)


def coverage(df: pd.DataFrame, satellite: str = "COMBINED") -> float:
    """Share of cell-months with a finite f_cloud (DAT-10 gate: >= 0.90 over Indonesia land cells)."""
    d = df[df.satellite == satellite]
    return float(np.isfinite(d.f_cloud).mean()) if len(d) else 0.0


def build_from_dir(hdf_dir: Path | None = None) -> pd.DataFrame:
    hdf_dir = Path(hdf_dir or support_dir("cloud", "cmg_hdf"))
    frames = []
    for p in sorted(hdf_dir.glob("M*D14CMQ.*.hdf")):
        meta = parse_name(p)
        if meta:
            lay = read_cmg_layers(p)
            frames.append(cmg_to_frame(lay["CloudPix"], lay["TotalPix"], meta["year"], meta["month"],
                                       meta["satellite"]))
    if not frames:
        raise FileNotFoundError(f"no MxD14CMQ .hdf files in {hdf_dir} (see module docstring)")
    return combine_satellites(pd.concat(frames, ignore_index=True))


if __name__ == "__main__":
    df = build_from_dir()
    out = support_dir("cloud") / "f_cloud_monthly.parquet"
    df.to_parquet(out, index=False)
    print(out, len(df), "rows; coverage COMBINED =", round(coverage(df), 3))
