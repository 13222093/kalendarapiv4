"""ANO-02: ENSO / IOD year classes and analog ranking.

Sources (verified 2026-11-14):
- ONI: NOAA CPC, https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
  (columns SEAS YR TOTAL ANOM; 'JAS' = Jul-Sep running mean).
- DMI: NOAA PSL (HadISST1.1), https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data
  (header 'first_year last_year', then year + 12 monthly values, missing = -9999).

Classes (validation_plan.md): El Nino if ONI JAS >= +0.5, La Nina if <= -0.5;
IOD+ if mean DMI Sep-Nov >= +0.4, IOD- if <= -0.4.
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from .common import data_dir

ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
DMI_URL = "https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data"
ONI_THRESHOLD = 0.5
DMI_THRESHOLD = 0.4


def _cache_path(name: str) -> Path:
    p = data_dir() / "external"
    p.mkdir(parents=True, exist_ok=True)
    return p / name


def fetch_text(url: str, name: str, refresh: bool = False) -> str:
    """Download ``url`` once and cache it under SS_DATA_DIR/external/."""
    path = _cache_path(name)
    if refresh or not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "second-sight-pipeline"})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return path.read_text(errors="replace")


def parse_oni(text: str) -> pd.DataFrame:
    rows = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 4 and parts[1].isdigit():
            rows.append((parts[0], int(parts[1]), float(parts[2]), float(parts[3])))
    return pd.DataFrame(rows, columns=["season", "year", "total", "anom"])


def parse_dmi(text: str) -> pd.DataFrame:
    """Long table (year, month, dmi) from the PSL fixed format."""
    lines = text.splitlines()
    first, last = (int(x) for x in lines[0].split()[:2])
    rows = []
    for line in lines[1:]:
        parts = line.split()
        if len(parts) == 13 and parts[0].isdigit() and first <= int(parts[0]) <= last:
            y = int(parts[0])
            for m, v in enumerate(parts[1:], start=1):
                val = float(v)
                rows.append((y, m, np.nan if val <= -99 else val))
    return pd.DataFrame(rows, columns=["year", "month", "dmi"])


def classify_years(oni: pd.DataFrame, dmi: pd.DataFrame, years=None) -> pd.DataFrame:
    """One row per year: oni_jas, dmi_son, enso_class, iod_class."""
    jas = oni[oni["season"] == "JAS"].set_index("year")["anom"]
    son = (dmi[dmi["month"].isin([9, 10, 11])].groupby("year")["dmi"]
           .agg(lambda x: x.mean() if x.notna().sum() == 3 else np.nan))
    yrs = sorted(set(jas.index) | set(son.index)) if years is None else list(years)
    out = pd.DataFrame({"year": yrs})
    out["oni_jas"] = out["year"].map(jas)
    out["dmi_son"] = out["year"].map(son)
    out["enso_class"] = np.select(
        [out["oni_jas"] >= ONI_THRESHOLD, out["oni_jas"] <= -ONI_THRESHOLD],
        ["el_nino", "la_nina"], default="neutral").astype(object)
    out["enso_class"] = out["enso_class"].astype(object).where(out["oni_jas"].notna(), None)
    out["iod_class"] = np.select(
        [out["dmi_son"] >= DMI_THRESHOLD, out["dmi_son"] <= -DMI_THRESHOLD],
        ["iod_pos", "iod_neg"], default="neutral").astype(object)
    out["iod_class"] = out["iod_class"].astype(object).where(out["dmi_son"].notna(), None)
    return out


def load_enso_classes(refresh: bool = False, path: str | Path | None = None) -> pd.DataFrame:
    """Download (cached) ONI + DMI, classify, optionally write enso_class.json."""
    oni = parse_oni(fetch_text(ONI_URL, "oni.ascii.txt", refresh))
    dmi = parse_dmi(fetch_text(DMI_URL, "dmi.had.long.data", refresh))
    cls = classify_years(oni, dmi)
    if path is not None:
        payload = {"sources": {"oni": ONI_URL, "dmi": DMI_URL},
                   "rules": {"el_nino": "ONI JAS >= +0.5", "la_nina": "ONI JAS <= -0.5",
                             "iod_pos": "mean DMI Sep-Nov >= +0.4",
                             "iod_neg": "mean DMI Sep-Nov <= -0.4"},
                   "years": cls.replace({np.nan: None}).to_dict(orient="records")}
        Path(path).write_text(json.dumps(payload, indent=2))
    return cls


def analog_rank(series: pd.DataFrame, classes: pd.DataFrame, year: int, month: int,
                value: str = "H", class_col: str = "enso_class") -> dict:
    """Rank of H(year, month) among years of the same class (1 = highest, includes itself)."""
    cmap = classes.set_index("year")[class_col]
    cls = cmap.get(year)
    if cls is not None and pd.isna(cls):
        cls = None
    s = series[series["month"] == month].copy()
    s["cls"] = s["year"].map(cmap)
    peers = s[s["cls"] == cls] if cls is not None else s.iloc[0:0]
    if year not in set(peers["year"]):
        return {"year": year, "month": month, "class": cls, "rank": None, "n": len(peers)}
    v = float(peers.loc[peers["year"] == year, value].iloc[0])
    rank = int((peers[value] > v).sum() + 1)
    return {"year": year, "month": month, "class": cls, "rank": rank, "n": int(len(peers)),
            "peer_years": sorted(int(y) for y in peers["year"])}
