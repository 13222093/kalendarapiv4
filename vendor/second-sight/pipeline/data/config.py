"""Shared paths and constants for the data pipeline.

All data is written under ``SS_DATA_DIR`` (env var), never inside the git repo.
"""
from __future__ import annotations

import os
from pathlib import Path

DEFAULT_DATA_DIR = "D:/Lomba/Hackathon/nasa/second-sight-data"


def data_dir() -> Path:
    """Root data directory (env ``SS_DATA_DIR`` overrides the default)."""
    p = Path(os.environ.get("SS_DATA_DIR", DEFAULT_DATA_DIR))
    p.mkdir(parents=True, exist_ok=True)
    return p


def raw_csv_dir() -> Path:
    return data_dir() / "raw_csv"


def raw_parquet_dir() -> Path:
    return data_dir() / "raw"


def derived_dir() -> Path:
    p = data_dir() / "derived"
    p.mkdir(parents=True, exist_ok=True)
    return p


# FIRMS standard-processing (SP) yearly country archives.
FIRMS_COUNTRY_URL = (
    "https://firms.modaps.eosdis.nasa.gov/data/country/{source}/{year}/{source}_{year}_{country}.csv"
)
COUNTRY = "Indonesia"

# source -> (first_year, last_year).
SOURCES: dict[str, tuple[int, int]] = {
    "modis": (2000, 2025),
    "viirs-snpp": (2012, 2025),
    "viirs-jpss1": (2018, 2025),
}
# Best effort: NOAA-21 (viirs-jpss2) may not exist in the country archive.
OPTIONAL_SOURCES: dict[str, tuple[int, int]] = {
    "viirs-jpss2": (2024, 2025),
}

# Grid resolutions (degrees)
CELL_DEG = 0.01
AOI_GRID_DEG = 0.05
