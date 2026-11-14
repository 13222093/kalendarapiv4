"""SYNTHETIC fixtures for the science unit tests. These numbers are made up and are
never results: they only check that the estimators recover known parameters."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipeline.science.common import SEASON_OF_MONTH  # noqa: E402

REGIONS = ["Sumatra", "Kalimantan", "Sulawesi"]


def true_kappa(region, season, daynight, is_peat):
    """Synthetic 'true' Aqua/SNPP factor (peat and night: VIIRS sees relatively more)."""
    k = 0.30
    k *= 0.8 if is_peat else 1.0
    k *= 0.6 if daynight == "N" else 1.0
    k *= {"Sumatra": 1.0, "Kalimantan": 1.1, "Sulawesi": 0.9}[region]
    k *= {"dry": 1.05, "wet": 0.95, "transition": 1.0}[season]
    return k


def make_monthly_stratum(seed=0, years=range(2000, 2027), scale=1.0, kappa_fn=true_kappa,
                         r_ta=1.25, r_ns=1.0):
    """Synthetic monthly_stratum with Poisson counts consistent with the true factors."""
    rng = np.random.default_rng(seed)
    rows = []
    for y in years:
        year_eff = rng.lognormal(0, 0.6)
        for m in range(1, 13):
            season = SEASON_OF_MONTH[m]
            for reg in REGIONS:
                for dn in ("D", "N"):
                    for peat in (False, True):
                        lam_v = scale * 400 * year_eff * (3 if season == "dry" else 1) \
                            * (0.4 if dn == "N" else 1) * (0.7 if peat else 1)
                        k = kappa_fn(reg, season, dn, peat)
                        mi = y * 12 + m - 1
                        v = rng.poisson(lam_v)
                        a = rng.poisson(lam_v * k)
                        sats = {}
                        if mi >= 2000 * 12 + 10:
                            sats["Terra"] = rng.poisson(lam_v * k / r_ta)
                        if mi >= 2002 * 12 + 6:
                            sats["Aqua"] = a
                        if y >= 2012:
                            sats["SNPP"] = v
                        if mi >= 2018 * 12 + 3:
                            sats["NOAA20"] = rng.poisson(lam_v / r_ns)
                        for sat, c in sats.items():
                            rows.append(dict(year=y, month=m, island_region=reg, season=season,
                                             daynight=dn, is_peat=peat, satellite=sat,
                                             cell_days=int(c), sum_frp=float(c) * 20.0))
    return pd.DataFrame(rows)


@pytest.fixture(scope="session")
def synth():
    return make_monthly_stratum(seed=1)
