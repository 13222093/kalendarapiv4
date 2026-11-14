"""TRI-04 - observability index O and the three-state display (doc 09 U4).

    O = (1 - f_cloud) * (1 - f_missing)

* ``f_cloud``   - fraction of overpass looks obscured by cloud (e.g. from the
                  MODIS/VIIRS cloud mask or the CMG cloud fraction; ERA5 cloud
                  cover as fallback proxy - DAT-10).
* ``f_missing`` - fraction of expected overpasses with no data (missing
                  granules, outages, the 2022-2023 Aqua/Terra gaps, ...).

Classes: ``good`` (O >= 0.6), ``partial`` (0.3 <= O < 0.6),
``unobserved`` (O < 0.3). The point is honesty: "no fire detected" in an
``unobserved`` month is shown as *no information*, not as *no fire*.
If only ``f_missing`` is available (fallback 5 in the ticket plan), pass
``f_cloud`` as 0 and the class becomes an upper bound on observability.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

__all__ = ["GOOD_MIN", "PARTIAL_MIN", "observability", "obs_class", "add_observability", "class_shares"]

GOOD_MIN = 0.6
PARTIAL_MIN = 0.3


def observability(f_cloud, f_missing) -> np.ndarray:
    """O = (1 - f_cloud)(1 - f_missing); inputs clipped to [0, 1]; NaN kept."""
    fc = np.clip(np.asarray(f_cloud, dtype=float), 0.0, 1.0)
    fm = np.clip(np.asarray(f_missing, dtype=float), 0.0, 1.0)
    return (1.0 - fc) * (1.0 - fm)


def obs_class(o, good_min: float = GOOD_MIN, partial_min: float = PARTIAL_MIN) -> pd.Series:
    """Map O to ``good`` / ``partial`` / ``unobserved``; NaN -> None."""
    o = pd.Series(o, dtype=float)
    cls = np.where(o >= good_min, "good", np.where(o >= partial_min, "partial", "unobserved"))
    return pd.Series(cls, index=o.index, dtype=object).where(o.notna(), None)


def add_observability(df: pd.DataFrame, f_cloud_col: str = "f_cloud",
                      f_missing_col: str = "f_missing") -> pd.DataFrame:
    """Return a copy with ``observability`` and ``obs_class`` columns
    (the ``monthly_aoi`` columns named in the ticket)."""
    out = df.copy()
    out["observability"] = observability(out[f_cloud_col], out[f_missing_col])
    out["obs_class"] = obs_class(out["observability"]).to_numpy()
    return out


def class_shares(df: pd.DataFrame, by: str | list[str] | None = None) -> pd.DataFrame:
    """Percentage of rows (e.g. cell-months) per ``obs_class``, optionally per
    group ``by`` (e.g. year or era). Columns: good, partial, unobserved (%)."""
    cats = ["good", "partial", "unobserved"]
    if by is None:
        s = df["obs_class"].value_counts(normalize=True).reindex(cats, fill_value=0.0) * 100
        return s.to_frame("pct").T.reset_index(drop=True)
    tab = pd.crosstab(df[by] if isinstance(by, str) else [df[b] for b in by],
                      df["obs_class"], normalize="index") * 100
    return tab.reindex(columns=cats, fill_value=0.0)
