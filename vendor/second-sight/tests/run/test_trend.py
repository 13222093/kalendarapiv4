import numpy as np

from pipeline.run.trend import YEARS, analyse_aoi, mk_hamed_rao, theil_sen, window_ratio


def test_theil_sen_linear():
    y = np.arange(2001, 2026, dtype=float)
    r = theil_sen(y, 100 - 2 * (y - 2001))
    assert abs(r["slope"] + 2) < 1e-9 and r["hi"] < 0


def test_mk_detects_trend_and_noise():
    rng = np.random.default_rng(0)
    assert mk_hamed_rao(np.arange(25) + rng.normal(0, 1, 25))["p"] < 0.01
    assert mk_hamed_rao(np.tile([0.0, 1.0, 0.5], 9)[:25])["p"] > 0.2


def test_window_ratio():
    s = {y: (10.0 if y < 2010 else 5.0) for y in YEARS}
    assert window_ratio(s, (2003, 2007), (2019, 2023))["pct_change"] == -50.0


def test_analyse_aoi_naive_vs_fair():
    rows = []
    for y in YEARS:
        for m in range(1, 13):
            h = 100.0 - 2 * (y - 2001)
            rows.append({"year": y, "month": m, "A_raw": h * 0.5, "V_raw": h * 3.0,
                         "H": h, "H_lo": h * 0.9, "H_hi": h * 1.1})
    r = analyse_aoi(rows)
    assert r["fair"]["sign"] == "decrease" and r["fair_sign_robust"]
    assert r["naive"]["windows"][0]["ratio"] > 1  # sensor jump makes naive stitch rise
