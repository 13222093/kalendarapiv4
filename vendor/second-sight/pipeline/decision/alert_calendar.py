"""ANO-03 + DEC-02 - conditional climatology for the alert calendar (doc 09 U6b).

For every AOI x calendar month x ENSO class:

    P(H > p90 | class) = (k + 1) / (n + 2)        (Laplace / rule of succession)

* n = number of years of that ENSO class with a value for (AOI, month)
* k = how many of those years had H above the AOI-month p90 baseline

With ~5 El Nino years in 2003-2025, raw frequencies would be 0 % or 100 %
far too often; the Laplace estimator shrinks toward 0.5 and is reported with
n so the UI can show how thin the evidence is.

Inputs
------
``monthly``: ``aoi, month, H`` (month = Timestamp or date string).
``enso``: mapping ``{year: class}`` from ``pipeline/science`` (ANO-02), e.g.
``"el_nino" / "neutral" / "la_nina"``.
``p90``: optional DataFrame ``aoi, cal_month, p90`` from the ANO-01 baseline;
if absent a minimal p90 is computed here from ``baseline_years``.
"""
from __future__ import annotations

from typing import Iterable, Mapping

import numpy as np
import pandas as pd

__all__ = ["laplace", "p90_threshold", "conditional_climatology", "calendar_records"]


def laplace(k, n):
    """(k + 1) / (n + 2)."""
    return (np.asarray(k, dtype=float) + 1.0) / (np.asarray(n, dtype=float) + 2.0)


def _with_cal(monthly: pd.DataFrame) -> pd.DataFrame:
    df = monthly.copy()
    m = pd.to_datetime(df["month"])
    df["year"] = m.dt.year
    df["cal_month"] = m.dt.month
    return df


def p90_threshold(
    monthly: pd.DataFrame,
    value_col: str = "H",
    baseline_years: tuple[int, int] = (2003, 2022),
    exclude_years: Iterable[int] = (),
    q: float = 0.9,
) -> pd.DataFrame:
    """Minimal p90 per (aoi, cal_month) over ``baseline_years`` minus
    ``exclude_years`` (needed for leave-one-year-out). Returns
    ``aoi, cal_month, p90``."""
    df = _with_cal(monthly)
    ex = set(exclude_years)
    sel = df[(df["year"] >= baseline_years[0]) & (df["year"] <= baseline_years[1]) & ~df["year"].isin(ex)]
    out = sel.groupby(["aoi", "cal_month"])[value_col].quantile(q).rename("p90").reset_index()
    return out


def conditional_climatology(
    monthly: pd.DataFrame,
    enso: Mapping[int, str],
    p90: pd.DataFrame | None = None,
    value_col: str = "H",
    baseline_years: tuple[int, int] = (2003, 2022),
    exclude_years: Iterable[int] = (),
) -> pd.DataFrame:
    """ANO-03 table: ``aoi, cal_month, enso_class, n, k, p_exceed``.

    ``exclude_years`` are dropped from both the threshold (when computed
    here) and the counts, so the function can be called inside a fold.
    """
    ex = set(exclude_years)
    if p90 is None:
        p90 = p90_threshold(monthly, value_col, baseline_years, ex)
    df = _with_cal(monthly)
    df = df[~df["year"].isin(ex)]
    df["enso_class"] = df["year"].map(enso)
    df = df[df["enso_class"].notna() & df[value_col].notna()]
    df = df.merge(p90, on=["aoi", "cal_month"], how="inner")
    df["exceed"] = df[value_col] > df["p90"]
    g = df.groupby(["aoi", "cal_month", "enso_class"])["exceed"]
    out = pd.DataFrame({"n": g.size(), "k": g.sum().astype(int)}).reset_index()
    out["p_exceed"] = laplace(out["k"], out["n"])
    return out.sort_values(["aoi", "cal_month", "enso_class"]).reset_index(drop=True)


def calendar_records(table: pd.DataFrame) -> list[dict]:
    """DEC-02: JSON-ready records for ``alert_calendar.json``
    (AOI x month x ENSO class -> probability, with n and k kept)."""
    return [
        {"aoi": r.aoi, "month": int(r.cal_month), "enso_class": r.enso_class,
         "p_exceed_p90": round(float(r.p_exceed), 4), "n_years": int(r.n), "k_years": int(r.k),
         "estimator": "laplace (k+1)/(n+2)"}
        for r in table.itertuples(index=False)
    ]
