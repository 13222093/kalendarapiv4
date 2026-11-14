"""Tests on SYNTHETIC data and short text snippets in the official file formats."""
import numpy as np
import pandas as pd

from pipeline.science.baseline import add_anomalies, compute_baseline, percentile_rank_prior
from pipeline.science.enso import analog_rank, classify_years, parse_dmi, parse_oni


def _toy_series():
    rows = [dict(year=y, month=m, H=float(10 * m + (y - 2000))) for y in range(2001, 2027)
            for m in range(1, 13)]
    return pd.DataFrame(rows)


def test_baseline_median_and_spread():
    s = _toy_series()
    b = compute_baseline(s)
    jan = b[b.month == 1].iloc[0]
    assert jan["n_years"] == 20
    assert jan["median"] == np.median([10 + y - 2000 for y in range(2003, 2023)])
    assert jan["p10"] < jan["median"] < jan["p90"]
    b2 = compute_baseline(s, exclude_years=[2003])
    assert b2[b2.month == 1].iloc[0]["n_years"] == 19


def test_anomalies():
    s = _toy_series()
    a = add_anomalies(s, compute_baseline(s))
    last = a[(a.year == 2026) & (a.month == 1)].iloc[0]
    assert last["percentile"] == 1.0          # monotone toy series: always the highest so far
    assert last["log_ratio"] > 0 and last["robust_z"] > 0
    assert last["anomaly_class"] == "above_p90"
    first = a[(a.year == 2001)]
    assert first["percentile"].isna().all()


def test_percentile_ties():
    s = pd.DataFrame({"year": [2001, 2002, 2003], "month": [1, 1, 1], "H": [5.0, 5.0, 5.0]})
    p = percentile_rank_prior(s)
    assert p.iloc[2] == 0.5


ONI_SNIPPET = """ SEAS  YR   TOTAL   ANOM
  JAS 2015  28.39   1.71
  JAS 2016  26.73  -0.36
  JAS 2017  26.75  -0.12
"""

DMI_SNIPPET = """ 2015 2017
2015 0 0 0 0 0 0 0 0 0.6 0.5 0.4 0
2016 0 0 0 0 0 0 0 0 -0.8 -0.6 -0.4 0
2017 0 0 0 0 0 0 0 0 0.1 0.2 -9999.000 0
-9999
DMI HadISST1.1
"""


def test_parse_and_classify():
    oni, dmi = parse_oni(ONI_SNIPPET), parse_dmi(DMI_SNIPPET)
    assert len(oni) == 3 and len(dmi) == 36
    c = classify_years(oni, dmi).set_index("year")
    assert c.loc[2015, "enso_class"] == "el_nino" and c.loc[2015, "iod_class"] == "iod_pos"
    assert c.loc[2016, "enso_class"] == "neutral" and c.loc[2016, "iod_class"] == "iod_neg"
    assert c.loc[2017, "iod_class"] is None    # incomplete SON


def test_analog_rank():
    s = pd.DataFrame({"year": [2015, 2019, 2023, 2016], "month": 9, "H": [100.0, 80.0, 90.0, 500.0]})
    cls = pd.DataFrame({"year": [2015, 2019, 2023, 2016],
                        "enso_class": ["el_nino", "el_nino", "el_nino", "neutral"]})
    r = analog_rank(s, cls, 2023, 9)
    assert r["rank"] == 2 and r["n"] == 3


def test_analog_rank_missing_class_has_no_rank():
    # B3 regression: a NaN class must not be treated as a real class
    s = pd.DataFrame({"year": [2015, 2017], "month": 9, "H": [100.0, 80.0]})
    cls = pd.DataFrame({"year": [2015, 2017], "enso_class": ["el_nino", float("nan")]})
    r = analog_rank(s, cls, 2017, 9)
    assert r["class"] is None and r["rank"] is None and r["n"] == 0
