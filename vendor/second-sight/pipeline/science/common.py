"""Shared constants and helpers for the science modules."""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd

DEFAULT_DATA_DIR = "D:/Lomba/Hackathon/nasa/second-sight-data/"
SEED = 20261114
N_BOOT = 1000

STRATUM_KEYS = ["island_region", "season", "daynight", "is_peat"]
PARENT_KEYS = ["island_region", "daynight"]
GRANDPARENT_KEYS = ["daynight"]

TERRA, AQUA, SNPP, NOAA20 = "Terra", "Aqua", "SNPP", "NOAA20"
_SAT_ALIASES = {
    "terra": TERRA, "t": TERRA, "mod": TERRA,
    "aqua": AQUA, "a": AQUA, "myd": AQUA,
    "snpp": SNPP, "s-npp": SNPP, "suomi npp": SNPP, "suomi-npp": SNPP, "npp": SNPP, "n": SNPP,
    "noaa20": NOAA20, "noaa-20": NOAA20, "noaa 20": NOAA20, "n20": NOAA20, "j1": NOAA20,
    "jpss-1": NOAA20, "noaa_20": NOAA20,
}

SEASON_OF_MONTH = {12: "wet", 1: "wet", 2: "wet", 3: "wet",
                   4: "transition", 5: "transition", 6: "transition", 7: "transition",
                   8: "dry", 9: "dry", 10: "dry", 11: "dry"}


def data_dir() -> Path:
    return Path(os.environ.get("SS_DATA_DIR", DEFAULT_DATA_DIR))


def normalize_satellite(values: pd.Series) -> pd.Series:
    """Map satellite labels (e.g. 'N', 'NOAA-20', 'Aqua') to canonical names."""
    return values.map(lambda v: _SAT_ALIASES.get(str(v).strip().lower(), str(v)))


def month_index(year, month):
    """Months since year 0 (vectorised), for window comparisons."""
    return np.asarray(year) * 12 + np.asarray(month) - 1


def in_window(df: pd.DataFrame, start: tuple[int, int], end: tuple[int, int]) -> pd.Series:
    """Boolean mask for rows with (year, month) in [start, end] inclusive."""
    mi = month_index(df["year"], df["month"])
    return pd.Series((mi >= month_index(*start)) & (mi <= month_index(*end)), index=df.index)


_PEAT_TRUE = {"peat", "true", "1", "yes", "gambut"}
_PEAT_FALSE = {"mineral", "non-peat", "nonpeat", "non_peat", "false", "0", "no"}


def standardize_monthly(df: pd.DataFrame, season_scheme: str = "plan") -> pd.DataFrame:
    """Adapt the data layer's monthly_stratum to the science schema.

    Handles ``month`` as a date (-> year, month ints), ``n_cells`` -> ``cell_days`` and
    ``peat`` labels -> boolean ``is_peat`` plus ``peat_known`` (False for 'unknown').
    Unknown peat is treated as not-peat for stratification; peat tests must check
    ``peat_known`` and refuse to run without labels.
    """
    d = df.copy()
    if "year" not in d.columns:
        dt = pd.to_datetime(d["month"])
        d["year"], d["month"] = dt.dt.year.astype(int), dt.dt.month.astype(int)
    if "cell_days" not in d.columns and "n_cells" in d.columns:
        d["cell_days"] = d["n_cells"]
    if "is_peat" not in d.columns and "peat" in d.columns:
        lab = d["peat"].astype(str).str.strip().str.lower()
        d["is_peat"] = lab.isin(_PEAT_TRUE)
        d["peat_known"] = lab.isin(_PEAT_TRUE | _PEAT_FALSE)
    elif "peat_known" not in d.columns:
        d["peat_known"] = True
    d["is_peat"] = d["is_peat"].astype(bool)
    d["satellite"] = normalize_satellite(d["satellite"])
    if season_scheme == "plan":
        # pre-registered 3 seasons (validation_plan.md); season is a function of month,
        # so re-deriving it from the monthly rows is exact
        d["season"] = d["month"].map(SEASON_OF_MONTH)
    return d


def load_monthly_stratum(path: str | Path | None = None, season_scheme: str = "plan") -> pd.DataFrame:
    """Read monthly_stratum.parquet from SS_DATA_DIR and standardize it.

    Only additive columns are summed downstream, so rows that collapse to the same
    stratum after re-deriving the season are simply added together.
    """
    path = Path(path) if path else data_dir() / "derived" / "monthly_stratum.parquet"
    if not path.exists():
        path = data_dir() / "monthly_stratum.parquet"
    return standardize_monthly(pd.read_parquet(path), season_scheme=season_scheme)


def wide_by_satellite(df: pd.DataFrame, keys: list[str], value: str = "cell_days") -> pd.DataFrame:
    """Pivot a long monthly table to one column per satellite (missing -> 0)."""
    d = df.copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    out = d.pivot_table(index=keys, columns="satellite", values=value, aggfunc="sum",
                        fill_value=0, observed=True)
    out.columns.name = None
    out = out.reset_index()
    for sat in (TERRA, AQUA, SNPP, NOAA20):
        if sat not in out.columns:
            out[sat] = 0.0
    return out
