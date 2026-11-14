"""ANO-03/DEC-02 tests on SYNTHETIC monthly series and ENSO labels (not results)."""
import json

import numpy as np
import pandas as pd
import pytest

from pipeline.decision.alert_calendar import (
    calendar_records,
    conditional_climatology,
    laplace,
    p90_threshold,
)

YEARS = list(range(2003, 2023))
# SYNTHETIC labels: every 10th year "el_nino" (2003, 2013)
ENSO = {y: ("el_nino" if (y - 2003) % 10 == 0 else "neutral") for y in YEARS}


def _monthly():
    # SYNTHETIC: September H is 100 in El Nino years, 1..18 otherwise.
    vals = []
    i = 0
    for y in YEARS:
        if ENSO[y] == "el_nino":
            v = 100.0
        else:
            i += 1
            v = float(i)
        vals.append(("Kalimantan", f"{y}-09-01", v))
    return pd.DataFrame(vals, columns=["aoi", "month", "H"])


def test_laplace():
    assert laplace(0, 0) == pytest.approx(0.5)
    assert laplace(5, 5) == pytest.approx(6 / 7)


def test_conditional_climatology():
    m = _monthly()
    p90 = p90_threshold(m)
    assert p90["p90"].item() < 100
    t = conditional_climatology(m, ENSO).set_index("enso_class")
    assert t.loc["el_nino", "n"] == 2 and t.loc["el_nino", "k"] == 2
    assert t.loc["el_nino", "p_exceed"] == pytest.approx(3 / 4)
    assert t.loc["neutral", "k"] == 0
    assert t.loc["neutral", "p_exceed"] == pytest.approx(1 / 20)


def test_exclude_year_and_records():
    m = _monthly()
    t = conditional_climatology(m, ENSO, exclude_years=[2013])
    assert t.set_index("enso_class").loc["el_nino", "n"] == 1
    recs = calendar_records(t)
    json.dumps(recs)  # serialisable
    assert recs[0]["month"] == 9 and "estimator" in recs[0]
