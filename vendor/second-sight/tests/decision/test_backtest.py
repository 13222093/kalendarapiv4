"""DEC-03 tests on SYNTHETIC monthly series and ENSO labels (not results)."""
import pandas as pd
import pytest

from pipeline.decision.backtest import backtest_alert_rule, summarise_backtest

YEARS = list(range(1996, 2026))  # 30 SYNTHETIC years so p90 sits below the 3 large years
BASE = (1996, 2025)
# SYNTHETIC: El Nino years 2006, 2015, 2019
EL = {2006, 2015, 2019}
ENSO = {y: ("el_nino" if y in EL else "neutral") for y in YEARS}


def _monthly():
    # SYNTHETIC: Sep/Oct H is huge in El Nino years except 2006 (a "dud");
    # neutral years small, except 2012 (a non-El Nino fire year).
    rows = []
    for i, y in enumerate(YEARS):
        for mo in (9, 10):
            if y in EL and y != 2006:
                v = 1000.0 + i
            elif y == 2012:
                v = 900.0
            else:
                v = float(i + mo)
            rows.append(("Riau", f"{y}-{mo:02d}-01", v))
    return pd.DataFrame(rows, columns=["aoi", "month", "H"])


def test_loyo_outcomes():
    bt = backtest_alert_rule(_monthly(), ENSO, YEARS, baseline_years=BASE).set_index("year")
    assert bt.loc[2015, "outcome"] == "hit"
    assert bt.loc[2006, "outcome"] == "false_alarm"
    assert bt.loc[2012, "outcome"] == "miss"
    assert bt.loc[2010, "outcome"] == "correct_negative"
    # LOYO: for 2015 the calendar must not count 2015 itself: n = 2 (2006, 2019),
    # k = 1 (2019) -> p = (1 + 1) / (2 + 2)
    assert bt.loc[2015, "p_max"] == pytest.approx(0.5)
    # for the 2006 dud the other two El Nino years both exceeded -> 3/4
    assert bt.loc[2006, "p_max"] == pytest.approx(0.75)


def test_summary():
    bt = backtest_alert_rule(_monthly(), ENSO, YEARS, baseline_years=BASE)
    s = summarise_backtest(bt)
    r = s.loc["Riau"]
    assert r["hit"] == 2 and r["false_alarm"] == 1 and r["miss"] == 1
    assert r["hit_rate"] == pytest.approx(2 / 3)
    assert r["false_alarm_ratio"] == pytest.approx(1 / 3)
    tot = summarise_backtest(bt, by=None)
    assert int(tot[["hit", "miss", "false_alarm", "correct_negative"]].sum(axis=1).item()) == len(YEARS)


def test_declared_override():
    bt = backtest_alert_rule(_monthly(), ENSO, [2015], declared={2015: False}, baseline_years=BASE)
    assert bt["outcome"].item() == "miss"
