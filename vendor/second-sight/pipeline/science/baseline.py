"""ANO-01: calendar-month baseline and anomalies (08 §7.6.2 step 9, §7.6.3).

- baseline: median, p10, p90, MAD per (keys, calendar month) over 2003-2022
  (``exclude_years`` lets validation compute it inside a fold).
- anomalies: log_ratio = log((H+1)/(median+1)); robust_z = (H - median)/(1.4826 MAD), only
  when median >= MIN_MEDIAN; percentile = rank of H(y,m) among {H(y',m): y' < y} / count.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

BASELINE_YEARS = (2003, 2022)
MIN_MEDIAN = 5.0


def _mad(x):
    x = np.asarray(x, float)
    return float(np.median(np.abs(x - np.median(x)))) if len(x) else np.nan


def compute_baseline(df: pd.DataFrame, value: str = "H", keys: list[str] | None = None,
                     years=BASELINE_YEARS, exclude_years=()) -> pd.DataFrame:
    keys = list(keys or [])
    d = df[(df["year"] >= years[0]) & (df["year"] <= years[1])
           & ~df["year"].isin(list(exclude_years))]
    g = d.groupby(keys + ["month"], observed=True)[value]
    out = g.agg(median="median", p10=lambda x: np.percentile(x, 10),
                p90=lambda x: np.percentile(x, 90), mad=_mad, n_years="count").reset_index()
    return out


def percentile_rank_prior(df: pd.DataFrame, value: str = "H", keys: list[str] | None = None,
                          ties: str = "half") -> pd.Series:
    """Rank of H(y,m) among the same calendar month of earlier years, in [0, 1].

    Ties count half (mid-rank). NaN when no earlier year exists.
    """
    keys = list(keys or [])
    res = pd.Series(np.nan, index=df.index)
    for _, grp in df.groupby(keys + ["month"], observed=True):
        grp = grp.sort_values("year")
        vals = grp[value].to_numpy(float)
        for i, idx in enumerate(grp.index):
            prior = vals[:i]
            if len(prior) == 0:
                continue
            below = np.sum(prior < vals[i]) + (0.5 * np.sum(prior == vals[i]) if ties == "half" else 0)
            res[idx] = below / len(prior)
    return res


def add_anomalies(df: pd.DataFrame, baseline: pd.DataFrame, value: str = "H",
                  keys: list[str] | None = None, min_median: float = MIN_MEDIAN) -> pd.DataFrame:
    keys = list(keys or [])
    out = df.merge(baseline, on=keys + ["month"], how="left")
    out.index = df.index
    h = out[value].astype(float)
    out["log_ratio"] = np.log((h + 1) / (out["median"] + 1))
    scale = 1.4826 * out["mad"]
    z = (h - out["median"]) / scale.where(scale > 0)
    out["robust_z"] = z.where(out["median"] >= min_median)
    out["percentile"] = percentile_rank_prior(out, value, keys)
    out["anomaly_class"] = np.select([h > out["p90"], h < out["p10"]], ["above_p90", "below_p10"],
                                     default="normal")
    out.loc[out["median"].isna(), "anomaly_class"] = None
    return out


def season_months(baseline: pd.DataFrame, keys: list[str] | None = None, frac: float = 0.5):
    """Fire season = months with median >= frac x the peak month's median."""
    keys = list(keys or [])
    b = baseline.copy()
    peak = b.groupby(keys, observed=True)["median"].transform("max") if keys else b["median"].max()
    b["in_season"] = b["median"] >= frac * peak
    return b
