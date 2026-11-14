"""DAT-05 tests. All series are SYNTHETIC (DATA CONTOH).

AI-assisted code (see docs/ai_acknowledgement.md).
"""
import numpy as np
import pandas as pd

from pipeline.support import data_health as dh

HTML = """<tr>
            <td>2026-07-16</td>
            <td>Suomi NPP (VIIRS)</td>
            <td>2024-03-06</td>
            <td>NOAA-21 (VIIRS)</td>
        </tr>
<tr><td></td><td></td><td>2024-03-05</td><td>NOAA-21 (VIIRS)</td></tr>"""


def test_parse_missing_html():
    rows = dh.parse_missing_html(HTML)
    assert {"date": "2026-07-16", "satellite": "SNPP", "data_type": "SP"} in rows
    assert {"date": "2024-03-06", "satellite": "NOAA21", "data_type": "NRT"} in rows
    assert len(rows) == 3


def test_pettitt_finds_step():
    rng = np.random.default_rng(0)
    x = np.r_[rng.normal(0, 1, 200), rng.normal(3, 1, 200)]
    k, K, p = dh.pettitt(x)
    assert abs((k + 1) - 200) <= 5 and p < 1e-6


def test_pettitt_no_step():
    rng = np.random.default_rng(1)
    _, _, p = dh.pettitt(rng.normal(0, 1, 400))
    assert p > 0.01


def _synthetic_counts():
    # SYNTHETIC: AQUA daily counts, level drop at 2012-01-20 (unmatched for AQUA -> unexplained),
    # and a gap during the real Aqua FMU outage window 2020-08-16..2020-09-02.
    idx = pd.date_range("2010-01-01", "2021-12-31", freq="D")
    rng = np.random.default_rng(2)
    lam = np.where(idx < "2016-06-01", 50, 15)
    c = rng.poisson(lam).astype(float)
    c[(idx >= "2020-08-16") & (idx <= "2020-09-02")] = 0
    return pd.DataFrame({"date": idx, "satellite": "Aqua", "count": c})


def test_build_health_offline():
    h = dh.build_health(_synthetic_counts(), missing=[], availability=(None, "skipped: no FIRMS_MAP_KEY"))
    gaps = [g for g in h["gaps"] if g["satellite"] == "AQUA"]
    assert any(g["start"] == "2020-08-16" and g["explained"] for g in gaps)
    assert h["breaks"], "expected the synthetic 2016 level shift to be detected"
    br = min(h["breaks"], key=lambda b: abs((pd.Timestamp(b["date"]) - pd.Timestamp("2016-06-01")).days))
    assert abs((pd.Timestamp(br["date"]) - pd.Timestamp("2016-06-01")).days) < 60
    assert br["label"] == "tak terjelaskan"
    assert h["per_date_satellite"][0].keys() >= {"date", "satellite", "count", "firms_missing", "in_gap"}


def test_match_event():
    assert dh.match_event("SNPP", "2012-02-10") == "S-NPP VIIRS record starts"
    assert dh.match_event("TERRA", "2012-02-10") is None


def test_availability_skips_without_key(monkeypatch):
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)
    assert dh.fetch_data_availability() == (None, "skipped: no FIRMS_MAP_KEY")
