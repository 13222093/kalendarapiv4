"""PHY-02 - effective overpass local solar time (LST) per satellite.

The effective overpass time of a sensor over the study region is estimated as
the median local solar time of its active-fire detections, grouped by
(satellite, month, daynight). A drifting orbit (Terra/Aqua after ~2020) shows
up as a trend in this table; the result is reported as observed, without
assuming the drift exists.

Inputs follow the `pipeline/data` detection schema: at least `satellite`,
`daynight` and either `lst` (hours, [0, 24)) or `utc_hour` + `longitude`, and a
date column (`local_date` or `acq_date`).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

__all__ = ["local_solar_time", "circular_median_hours", "effective_overpass_time"]


def local_solar_time(utc_hour, lon) -> np.ndarray:
    """Approximate local solar time in hours: ``LST = UTC hour + lon / 15``.

    The result is wrapped into ``[0, 24)`` (e.g. 23.5 UTC at 105 E -> 6.5).
    Equation-of-time corrections (<= ~16 min) are ignored on purpose.

    Parameters
    ----------
    utc_hour : array-like
        Decimal UTC hour (e.g. 06:30 UTC -> 6.5).
    lon : array-like
        Longitude in degrees east (negative west).
    """
    utc_hour = np.asarray(utc_hour, dtype=float)
    lon = np.asarray(lon, dtype=float)
    return np.mod(utc_hour + lon / 15.0, 24.0)


def circular_median_hours(hours) -> float:
    """Median of clock times that is robust to the midnight wraparound.

    Times are re-centred on their circular mean before taking the ordinary
    median, so night overpasses at 23:30 and 01:30 give ~00:30 rather than
    12:30. Returns NaN for empty input.
    """
    h = np.asarray(hours, dtype=float)
    h = h[np.isfinite(h)]
    if h.size == 0:
        return float("nan")
    ang = h / 24.0 * 2 * np.pi
    centre = np.arctan2(np.sin(ang).mean(), np.cos(ang).mean()) / (2 * np.pi) * 24.0
    shifted = np.mod(h - centre + 12.0, 24.0) - 12.0  # in [-12, 12) around centre
    return float(np.mod(np.median(shifted) + centre, 24.0))


def effective_overpass_time(
    detections: pd.DataFrame,
    date_col: str | None = None,
    min_count: int = 1,
) -> pd.DataFrame:
    """Median LST per (satellite, month, daynight).

    Parameters
    ----------
    detections : DataFrame
        Detection table. Uses ``lst`` if present, otherwise computes it from
        ``utc_hour`` and ``longitude``.
    date_col : str, optional
        Date column; defaults to the first of ``local_date``, ``acq_date``,
        ``date`` that exists.
    min_count : int
        Groups with fewer detections are dropped.

    Returns
    -------
    DataFrame with columns ``satellite, month (Timestamp, month start),
    daynight, lst_median, lst_iqr, n``. Output path per ticket:
    ``physics/overpass_time.parquet`` (written by the caller).
    """
    df = detections
    if date_col is None:
        date_col = next((c for c in ("local_date", "acq_date", "date") if c in df.columns), None)
        if date_col is None:
            raise KeyError("no date column (local_date/acq_date/date) in detections")
    if "lst" in df.columns:
        lst = df["lst"].astype(float).to_numpy()
    elif {"utc_hour", "longitude"} <= set(df.columns):
        lst = local_solar_time(df["utc_hour"], df["longitude"])
    else:
        raise KeyError("detections need `lst` or (`utc_hour`, `longitude`)")

    work = pd.DataFrame(
        {
            "satellite": df["satellite"].to_numpy(),
            "daynight": df["daynight"].to_numpy(),
            "month": pd.to_datetime(df[date_col]).dt.to_period("M").dt.to_timestamp().to_numpy(),
            "lst": lst,
        }
    )

    rows = []
    for (sat, month, dn), g in work.groupby(["satellite", "month", "daynight"], sort=True):
        vals = g["lst"].to_numpy()
        vals = vals[np.isfinite(vals)]
        if vals.size < min_count or vals.size == 0:
            continue
        med = circular_median_hours(vals)
        dev = np.mod(vals - med + 12.0, 24.0) - 12.0
        q75, q25 = np.percentile(dev, [75, 25])
        rows.append(
            {"satellite": sat, "month": month, "daynight": dn,
             "lst_median": med, "lst_iqr": float(q75 - q25), "n": int(vals.size)}
        )
    cols = ["satellite", "month", "daynight", "lst_median", "lst_iqr", "n"]
    out = pd.DataFrame(rows, columns=cols)
    return out.sort_values(["satellite", "daynight", "month"]).reset_index(drop=True)
