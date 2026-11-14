"""DEC-03 - leave-one-year-out backtest of the alert-calendar rule (V11).

Rule under test (doc 09 U6c):

    raise alert for (AOI, year)  <=>  El Nino is declared for that year
                                     AND max_{m in target months} P(H > p90 | El Nino) >= 0.5

For each test year y the calendar (ANO-03) AND the p90 threshold are
recomputed WITHOUT year y, so the decision never sees the outcome it is
scored on. The event is "H > p90 in at least one target month of y" (p90 also
without y). The decision is assumed to be taken before September, hence the
default target months Sep-Oct.

Caveat: ``declared`` defaults to "ENSO class of y == El Nino", which uses the
season-mean ONI; real-time declaration timing (e.g. BMKG / NOAA advisories
before September) is not modelled unless the caller passes ``declared``.
"""
from __future__ import annotations

from typing import Iterable, Mapping

import pandas as pd

from .alert_calendar import conditional_climatology, p90_threshold

__all__ = ["backtest_alert_rule", "summarise_backtest"]


def backtest_alert_rule(
    monthly: pd.DataFrame,
    enso: Mapping[int, str],
    test_years: Iterable[int],
    target_months: Iterable[int] = (9, 10),
    p_threshold: float = 0.5,
    el_nino_label: str = "el_nino",
    declared: Mapping[int, bool] | None = None,
    value_col: str = "H",
    baseline_years: tuple[int, int] = (2003, 2022),
) -> pd.DataFrame:
    """Per (aoi, year) decision vs outcome with leave-one-year-out.

    ``monthly``: ``aoi, month, H`` (AOI = province for the V11 table).
    Returns ``aoi, year, declared, p_max, alert, event, outcome`` with
    outcome in {hit, miss, false_alarm, correct_negative}; rows where the
    event cannot be evaluated (no data / no threshold) are dropped.
    """
    target_months = list(target_months)
    m = pd.to_datetime(monthly["month"])
    df = monthly.assign(year=m.dt.year, cal_month=m.dt.month)
    rows = []
    for y in test_years:
        is_declared = bool(declared[y]) if declared is not None and y in declared else enso.get(y) == el_nino_label
        p90 = p90_threshold(monthly, value_col, baseline_years, exclude_years=[y])
        clim = conditional_climatology(monthly, enso, p90=p90, value_col=value_col, exclude_years=[y])
        clim = clim[(clim["enso_class"] == el_nino_label) & clim["cal_month"].isin(target_months)]
        pmax = clim.groupby("aoi")["p_exceed"].max()

        obs = df[(df["year"] == y) & df["cal_month"].isin(target_months)].merge(p90, on=["aoi", "cal_month"])
        obs = obs[obs[value_col].notna()]
        event = (obs[value_col] > obs["p90"]).groupby(obs["aoi"]).any()
        for aoi, ev in event.items():
            p = float(pmax.get(aoi, float("nan")))
            alert = bool(is_declared and p >= p_threshold)  # NaN >= x is False
            outcome = ("hit" if ev else "false_alarm") if alert else ("miss" if ev else "correct_negative")
            rows.append({"aoi": aoi, "year": int(y), "declared": is_declared, "p_max": p,
                         "alert": alert, "event": bool(ev), "outcome": outcome})
    cols = ["aoi", "year", "declared", "p_max", "alert", "event", "outcome"]
    return pd.DataFrame(rows, columns=cols)


def summarise_backtest(bt: pd.DataFrame, by: str | None = "aoi") -> pd.DataFrame:
    """Counts of hit / miss / false_alarm / correct_negative (per ``by`` or
    overall) plus hit rate H/(H+M) and false-alarm ratio FA/(H+FA)."""
    cats = ["hit", "miss", "false_alarm", "correct_negative"]
    if by is None:
        c = bt["outcome"].value_counts().reindex(cats, fill_value=0).to_frame().T.reset_index(drop=True)
    else:
        c = pd.crosstab(bt[by], bt["outcome"]).reindex(columns=cats, fill_value=0)
    h, mi, fa = c["hit"], c["miss"], c["false_alarm"]
    c["hit_rate"] = (h / (h + mi)).where((h + mi) > 0)
    c["false_alarm_ratio"] = (fa / (h + fa)).where((h + fa) > 0)
    return c
