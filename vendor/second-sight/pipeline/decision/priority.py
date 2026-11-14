"""DEC-01 - rank probability of priority units (KHG / kabupaten) (doc 09 U6a).

Instead of a single ranked list, every bootstrap replicate of the harmonised
series H (from ``pipeline/science``, CAL-02) gives one ranking of units by
their El Nino dry-season total. Across replicates we report

* ``p_topk``      - share of replicates where the unit is in the top K
* ``median_rank`` - median rank (1 = most fire)
* ``rank_lo`` / ``rank_hi`` - central interval of the rank (default 5-95 %)

so the brief can say "unit X is in the top 10 in 97 % of replicates" rather
than "unit X is #3".

Input (long): ``unit, replicate, value`` - value = the quantity to rank on,
e.g. :func:`season_totals` of replicate monthly H.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd

__all__ = ["DRY_SEASON_MONTHS", "season_totals", "rank_probability", "priority_records"]

#: Jul-Oct; main Indonesian peat-fire season. [UNVERIFIED] choice - confirm
#: against the climatology figure before final numbers.
DRY_SEASON_MONTHS = (7, 8, 9, 10)


def season_totals(
    monthly_reps: pd.DataFrame,
    years: Iterable[int],
    months: Iterable[int] = DRY_SEASON_MONTHS,
    value_col: str = "H",
) -> pd.DataFrame:
    """Sum ``value_col`` over ``months`` of ``years`` (e.g. El Nino years) per
    (unit, replicate). Input columns: ``unit, replicate, month, <value_col>``.
    Returns ``unit, replicate, value``."""
    m = pd.to_datetime(monthly_reps["month"])
    sel = monthly_reps[m.dt.year.isin(list(years)) & m.dt.month.isin(list(months))]
    return sel.groupby(["unit", "replicate"])[value_col].sum().rename("value").reset_index()


def rank_probability(
    replicates: pd.DataFrame,
    k: int = 10,
    interval: tuple[float, float] = (5.0, 95.0),
) -> pd.DataFrame:
    """P(unit in top-K) and rank summary from bootstrap replicates.

    Ranks are computed within each replicate (1 = largest value; ties get
    the minimum rank, so tied units can share a top-K slot). A unit missing in
    a replicate is ranked last there.

    Returns ``unit, p_topk, median_rank, rank_lo, rank_hi, n_rep`` sorted by
    ``p_topk`` desc then ``median_rank``.
    """
    wide = replicates.pivot_table(index="replicate", columns="unit", values="value", aggfunc="sum")
    n_units = wide.shape[1]
    ranks = wide.rank(axis=1, ascending=False, method="min").fillna(n_units)
    r = ranks.to_numpy()
    out = pd.DataFrame({
        "unit": wide.columns,
        "p_topk": (r <= k).mean(axis=0),
        "median_rank": np.median(r, axis=0),
        "rank_lo": np.percentile(r, interval[0], axis=0),
        "rank_hi": np.percentile(r, interval[1], axis=0),
        "n_rep": r.shape[0],
    })
    return out.sort_values(["p_topk", "median_rank"], ascending=[False, True]).reset_index(drop=True)


def priority_records(table: pd.DataFrame, k: int = 10) -> list[dict]:
    """JSON-ready rows for ``priority.json``."""
    return [
        {"unit": r.unit, f"p_top{k}": round(float(r.p_topk), 4), "median_rank": float(r.median_rank),
         "rank_interval": [float(r.rank_lo), float(r.rank_hi)], "n_replicates": int(r.n_rep)}
        for r in table.itertuples(index=False)
    ]
