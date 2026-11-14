"""Tests on SYNTHETIC data only."""
import numpy as np

from pipeline.science.calibrate import fit_kappa
from pipeline.science.chain import noaa20_to_snpp, terra_to_aqua
from pipeline.science.series import assign_era, build_series


def test_assign_era():
    e = assign_era([2001, 2002, 2002, 2021, 2022, 2026, 2026], [5, 6, 7, 12, 1, 10, 11])
    assert list(e) == ["Terra", "Terra", "Aqua", "Aqua", "SNPP", "SNPP", "NOAA20"]


def _fits(synth):
    return (fit_kappa(synth, n_boot=100), terra_to_aqua(synth, n_boot=100),
            noaa20_to_snpp(synth, n_boot=100))


def test_series_national(synth):
    k, ta, ns = _fits(synth)
    h = build_series(synth, k, ta, ns)
    assert {"H", "H_lo", "H_hi", "A_raw", "T_raw", "V_raw", "N20_raw", "sensor_used"} <= set(h)
    aq = h[h.sensor_used == "Aqua"]
    assert np.allclose(aq["H"], aq["A_raw"])
    assert (h["H_lo"] <= h["H"]).all() and (h["H"] <= h["H_hi"]).all()
    # in the overlap the harmonized VIIRS sum should match the true Aqua scale (synthetic truth)
    hv = build_series(synth, k, ta, ns, aqua_end=(2011, 12))
    ov = hv[(hv.year >= 2012) & (hv.year <= 2021)]
    assert abs(ov["H"].sum() / ov["A_raw"].sum() - 1) < 0.03
    assert set(h["sensor_used"]) == {"Terra", "Aqua", "SNPP", "NOAA20"}
    assert (h[h.sensor_used == "SNPP"]["H_hi"] > h[h.sensor_used == "SNPP"]["H_lo"]).all()


def test_series_decomposition_sums_to_total(synth):
    k, ta, ns = _fits(synth)
    tot = build_series(synth, k, ta, ns)
    dec = build_series(synth, k, ta, ns, by=["is_peat", "daynight"])
    s = dec.groupby(["year", "month"])["H"].sum().reset_index()
    m = tot.merge(s, on=["year", "month"], suffixes=("", "_dec"))
    assert np.allclose(m["H"], m["H_dec"])
