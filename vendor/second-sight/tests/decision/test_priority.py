"""DEC-01 tests on SYNTHETIC bootstrap replicates (not results)."""
import json

import numpy as np
import pandas as pd
import pytest

from pipeline.decision.priority import priority_records, rank_probability, season_totals


def _reps(n_rep=200, seed=1):
    # SYNTHETIC: unit A clearly largest, B and C close (noisy), D small.
    rng = np.random.default_rng(seed)
    means = {"A": 100.0, "B": 50.0, "C": 49.0, "D": 5.0}
    rows = [(u, r, mu + rng.normal(0, 5)) for r in range(n_rep) for u, mu in means.items()]
    return pd.DataFrame(rows, columns=["unit", "replicate", "value"])


def test_rank_probability_top1_and_top2():
    t1 = rank_probability(_reps(), k=1).set_index("unit")
    assert t1.loc["A", "p_topk"] == 1.0
    assert t1.loc["D", "p_topk"] == 0.0
    t2 = rank_probability(_reps(), k=2).set_index("unit")
    assert 0.2 < t2.loc["B", "p_topk"] < 0.9 and 0.1 < t2.loc["C", "p_topk"] < 0.8
    assert t2.loc["B", "p_topk"] + t2.loc["C", "p_topk"] == pytest.approx(1.0)
    assert t2.loc["D", "median_rank"] == 4.0


def test_missing_unit_ranked_last_and_records():
    reps = _reps(10)
    reps = reps[~((reps.unit == "A") & (reps.replicate == 0))]
    t = rank_probability(reps, k=1)
    a = t.set_index("unit").loc["A"]
    assert a.p_topk == pytest.approx(0.9)
    recs = priority_records(t, k=1)
    json.dumps(recs)
    assert recs[0]["unit"] == "A" and "p_top1" in recs[0]


def test_season_totals():
    df = pd.DataFrame({
        "unit": "A", "replicate": 0,
        "month": ["2015-06-01", "2015-08-01", "2015-09-01", "2016-09-01"],
        "H": [1.0, 2.0, 3.0, 100.0],
    })
    s = season_totals(df, years=[2015])
    assert s["value"].item() == 5.0
