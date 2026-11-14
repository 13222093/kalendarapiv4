"""CAL-04 regression: build_series must accept fits coarser than the full strata."""
import numpy as np
import pandas as pd

from pipeline.science.calibrate import KappaFit, fit_simple_ratio
from pipeline.science.series import build_series, expand_fit


def _ms():
    rows = []
    for reg, va in (("A", 10.0), ("B", 20.0)):
        for dn in ("D", "N"):
            for year, sats in ((2012, (("Aqua", 2.0), ("SNPP", va))), (2023, (("SNPP", va),))):
                for sat, v in sats:
                    rows.append(dict(year=year, month=8, island_region=reg, season="dry",
                                     daynight=dn, is_peat=False, satellite=sat, cell_days=v))
    return pd.DataFrame(rows)


def test_pooled_fit_no_strata_keys():
    ms = _ms()
    fit = fit_simple_ratio(ms, years=(2012,), keys=[])
    s = build_series(ms, fit, by=[])
    h23 = s.loc[s["year"] == 2023, "H"].item()
    k = float(fit.table["kappa"].iloc[0])
    assert np.isclose(h23, 60.0 * k)


def test_region_only_fit_broadcasts():
    ms = _ms()
    t = pd.DataFrame({"island_region": ["A", "B"], "kappa": [0.1, 0.05],
                      "sum_A": [0.1, 0.05], "sum_V": [1.0, 1.0]})
    draws = np.array([[0.1, 0.05], [0.2, 0.1], [0.05, 0.025]])
    fit = KappaFit(table=t, draws=draws, meta={"strata_keys": ["island_region"]})
    s = build_series(ms, fit, by=["island_region"])
    r = s[s["year"] == 2023].set_index("island_region")["H"]
    assert np.isclose(r["A"], 2 * 10 * 0.1) and np.isclose(r["B"], 2 * 20 * 0.05)
    full = expand_fit(fit, ms)
    assert {"island_region", "season", "daynight", "is_peat"} <= set(full.table.columns)
    assert full.draws is not None and full.draws.shape == (3, len(full.table))
    s2 = build_series(ms, full, by=["island_region"])
    assert np.allclose(s["H"], s2["H"]) and np.allclose(s["H_hi"], s2["H_hi"])


def test_aoi_cells_sum_to_region_series():
    from pipeline.science.aoi import check_aggregation, grid_stratum_table, kappa_grid
    rows = []
    pts = [(-0.51, 101.4, "A", "P1"), (-0.52, 101.41, "A", "P1"),
           (-1.2, 113.9, "B", "P2"), (-1.3, 113.8, "A", "P3")]
    for d, (lat, lon, reg, prov) in enumerate(pts):
        for sat in ("Aqua", "SNPP"):
            for day in (1, 2, 3)[: 1 + d % 3]:
                rows.append(dict(local_date=f"2015-08-0{day}", satellite=sat, daynight="D",
                                 island_region=reg, is_peat=None, province=prov,
                                 cell_lat=lat, cell_lon=lon))
    grid = grid_stratum_table(pd.DataFrame(rows))
    assert grid["g_id"].nunique() == 3  # first two points share a 0.05 deg cell
    ms = grid.groupby(["year", "month", "satellite", "island_region", "season", "daynight",
                       "is_peat"], as_index=False)["cell_days"].sum()
    fit = fit_simple_ratio(ms, years=(2015,), keys=["island_region"])
    kg = kappa_grid(grid, fit)
    assert np.isfinite(kg["kappa"]).all()
    res = check_aggregation(grid, ms, fit, provinces=("P1",))
    assert all(r["passed"] for r in res)
