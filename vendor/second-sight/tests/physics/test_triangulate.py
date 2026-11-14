"""TRI-01..03 tests on SYNTHETIC daily_cell / monthly tables (not results)."""
import numpy as np
import pandas as pd
import pytest

from pipeline.physics.triangulate import (
    agreement,
    agreement_table,
    anomaly_class,
    empirical_percentile,
    energy_calibration_factors,
    h_energy,
    h_large,
)


def _daily():
    # SYNTHETIC daily_cell rows
    return pd.DataFrame({
        "local_date": ["2015-09-01", "2015-09-01", "2015-09-01", "2015-09-02", "2015-10-01", "2015-09-03"],
        "cell_id": ["c1", "c1", "c2", "c1", "c1", "c3"],
        "satellite": ["Aqua", "SNPP", "Aqua", "Aqua", "Aqua", "SNPP"],
        "daynight": ["D", "D", "N", "D", "D", "N"],
        "n_det": 1,
        "sum_frp": [30.0, 40.0, 12.0, 5.0, 1.0, 25.0],
        "max_frp": 1.0,
        "mean_A_pix": 1.0,
        "island_region": ["Kalimantan"] * 5 + ["Sumatra"],
    })


def test_h_large_counts_cell_days_once():
    out = h_large(_daily(), {"D": 20.0, "N": 10.0})
    k = out.set_index(["aoi", "month"])["H_large"]
    assert k[("Kalimantan", pd.Timestamp("2015-09-01"))] == 2  # c1 (two sats, once) + c2 night
    assert k[("Kalimantan", pd.Timestamp("2015-10-01"))] == 0  # explicit zero
    assert k[("Sumatra", pd.Timestamp("2015-09-01"))] == 1


def test_h_large_constant_constellation_and_mapping():
    out = h_large(_daily(), 20.0, satellites=["Aqua"], cell_to_aoi={"c1": "KHG-1"})
    assert out["aoi"].unique().tolist() == ["KHG-1"]
    assert out.loc[out.month == "2015-09-01", "H_large"].item() == 1


def test_energy_calibration_and_series():
    # SYNTHETIC: SNPP sees 2x Aqua energy in every overlap month -> c_SNPP = 0.5
    rows = []
    for m in range(1, 13):
        d = f"2016-{m:02d}-15"
        rows += [(d, "c1", "Aqua", "D", 10.0), (d, "c1", "SNPP", "D", 20.0)]
    rows.append(("2008-08-15", "c1", "Terra", "D", 7.0))
    df = pd.DataFrame(rows, columns=["local_date", "cell_id", "satellite", "daynight", "sum_frp"])
    df["island_region"] = "Kalimantan"
    f = energy_calibration_factors(df)
    assert f["Aqua"] == 1.0 and f["SNPP"] == pytest.approx(0.5)
    assert np.isnan(f["Terra"])  # no overlap -> excluded, not guessed
    e = h_energy(df, f)
    assert np.allclose(e["H_energy"], 10.0)
    assert len(e) == 12


def test_percentile_and_classes():
    assert empirical_percentile(5, [1, 2, 3, 4]) == 100.0
    assert empirical_percentile(2, [1, 2, 3, 4]) == pytest.approx(37.5)
    assert np.isnan(empirical_percentile(1, []))
    c = anomaly_class([5, 50, 95, np.nan])
    assert c.tolist()[:3] == ["low", "normal", "high"] and c.iloc[3] is None


def test_agreement_rule():
    assert agreement("high", "high", "high") == "A"
    assert agreement("high", "normal", "high") == "B"
    assert agreement("high", "normal", "low") == "C"
    assert agreement("high", None, "high") is None


def test_agreement_table():
    # SYNTHETIC: September baseline 2003-2022 = 1..20; 2023 extreme in all three
    # series except H_energy which is normal -> B.
    years = list(range(2003, 2024))
    vals = list(range(1, 21)) + [100]
    m = pd.DataFrame({
        "aoi": "Kalimantan",
        "month": pd.to_datetime([f"{y}-09-01" for y in years]),
        "H": vals, "H_large": vals, "H_energy": list(range(1, 21)) + [10],
    })
    out = agreement_table(m)
    last = out.iloc[-1]
    assert last["H_class"] == "high" and last["H_energy_class"] == "normal"
    assert last["agreement"] == "B"
    assert out.iloc[10]["agreement"] == "A"  # mid-baseline year: all normal
