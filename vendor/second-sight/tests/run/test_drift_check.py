from pipeline.run.drift_check import evaluate_v4, fisher_ci


def _val(m3, m3x):
    return {"results": [{"test_id": "V1", "metric": "LOYO MdAPE M3", "value": m3},
                        {"test_id": "V1", "metric": "LOYO MdAPE M3x", "value": m3x}]}


def _phys(r, p, flag="[UNVERIFIED] placeholder"):
    return {"phy03_drift": {"pearson_r": r, "pearson_p": p, "n_months": 48, "slope": 1.0,
                            "intercept": 0.0, "params": {"source": "x"}, "flag": flag}}


def test_pass_when_both_clauses_hold():
    row = evaluate_v4(_phys(0.5, 0.001), _val(7.0, 7.5))
    assert row["passed"] is True
    assert row["components"]["diurnal_params_unverified"] is True
    assert "[UNVERIFIED]" in row["notes"]


def test_fail_when_m3x_not_worse():
    assert evaluate_v4(_phys(0.5, 0.001), _val(7.5, 7.0))["passed"] is False


def test_fail_when_p_too_large_or_r_negative():
    assert evaluate_v4(_phys(0.2, 0.2), _val(7.0, 7.5))["passed"] is False
    assert evaluate_v4(_phys(-0.5, 0.001), _val(7.0, 7.5))["passed"] is False


def test_not_run_when_inputs_missing():
    row = evaluate_v4({}, _val(7.0, 7.5))
    assert row["status"] == "not_run" and row["passed"] is None


def test_fisher_ci_brackets_r():
    lo, hi = fisher_ci(0.5, 48)
    assert lo < 0.5 < hi
    assert fisher_ci(0.5, 3) is None
