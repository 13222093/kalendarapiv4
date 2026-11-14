"""VAL-09: peat hypotheses H1-H3 (08 §7.7, validation_plan.md §2).

rho = sum V / sum A (S-NPP cell-days per Aqua cell-day = 1/kappa), 2012-2021,
Sumatra + Kalimantan, 90% CI from a year-block bootstrap (same years for all cells).
For H3 the bootstrap resamples El Nino years and other years separately.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .calibrate import CAL_YEARS
from .common import AQUA, SEED, SNPP, normalize_satellite
from .validate import result

PEAT_REGIONS = ("Sumatra", "Kalimantan")


def _cells(ms, years, regions):
    d = ms[ms["year"].isin(list(years)) & ms["island_region"].isin(list(regions))].copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    d = d[d["satellite"].isin([AQUA, SNPP])]
    g = d.groupby(["year", "is_peat", "daynight", "satellite"], observed=True)["cell_days"].sum()
    return g.unstack("satellite", fill_value=0).reset_index()


def _rho(c, mask):
    sv, sa = c.loc[mask, SNPP].sum(), c.loc[mask, AQUA].sum()
    return sv / sa if sa > 0 else np.nan


def _boot(c, years, stat, n_boot, rng, groups=None):
    """Resample years (within groups if given) and evaluate stat(c_resampled)."""
    years = np.asarray(years)
    out = np.empty(n_boot)
    by_year = {y: c[c["year"] == y] for y in years}
    pools = [years] if groups is None else [years[groups == g] for g in np.unique(groups)]
    for i in range(n_boot):
        pick = np.concatenate([rng.choice(p, len(p), replace=True) for p in pools if len(p)])
        cb = pd.concat([by_year[y] for y in pick], ignore_index=True)
        out[i] = stat(cb)
    return np.nanpercentile(out, [5, 95])


def peat_hypotheses(ms: pd.DataFrame, enso_classes: pd.DataFrame | None = None,
                    years=CAL_YEARS, regions=PEAT_REGIONS, n_boot: int = 1000,
                    seed: int = SEED) -> list[dict]:
    rng = np.random.default_rng(seed)
    if "peat_known" in ms.columns and not ms["peat_known"].any():
        return [result("V9", m, None, "see validation_plan.md H1-H3", None,
                       notes="not run: no peat labels in monthly_stratum (peat='unknown')")
                for m in ("H1 decision", "H2 log rho_night - log rho_day (peat)",
                          "H3 log rho_ElNino - log rho_other (peat)")]
    c = _cells(ms, years, regions)
    yrs = np.array(sorted(c["year"].unique()))
    res = []

    def lr_peat_min(dn):
        return lambda cb: np.log(_rho(cb, cb.is_peat & (cb.daynight == dn))) - \
            np.log(_rho(cb, ~cb.is_peat & (cb.daynight == dn)))

    h1_pos = []
    for dn in ("D", "N"):
        f = lr_peat_min(dn)
        val, ci = f(c), _boot(c, yrs, f, n_boot, rng)
        h1_pos.append(ci[0] > 0)
        res.append(result("V9", f"H1 log rho_peat - log rho_mineral ({dn})", val,
                          "90% CI > 0 in day and night", ci[0] > 0, ci=ci))
    h1 = "accepted" if all(h1_pos) else ("partially accepted" if any(h1_pos) else "rejected")
    res.append(result("V9", "H1 decision", None, "CI>0 both day and night", all(h1_pos), notes=h1))

    f2 = lambda cb: np.log(_rho(cb, cb.is_peat & (cb.daynight == "N"))) - \
        np.log(_rho(cb, cb.is_peat & (cb.daynight == "D")))
    ci2 = _boot(c, yrs, f2, n_boot, rng)
    ci_n = _boot(c, yrs, lambda cb: _rho(cb, cb.is_peat & (cb.daynight == "N")), n_boot, rng)
    ci_d = _boot(c, yrs, lambda cb: _rho(cb, cb.is_peat & (cb.daynight == "D")), n_boot, rng)
    h2 = bool(ci2[0] > 0 and ci_n[0] > ci_d[1])
    res.append(result("V9", "H2 log rho_night - log rho_day (peat)", f2(c),
                      "CI of difference > 0 and rho CIs do not overlap", h2, ci=ci2,
                      notes=f"rho_night CI={np.round(ci_n, 3).tolist()}, "
                            f"rho_day CI={np.round(ci_d, 3).tolist()}"))

    if enso_classes is not None:
        en_years = set(enso_classes.loc[enso_classes["enso_class"] == "el_nino", "year"])
        is_en = np.array([y in en_years for y in yrs])
        cc = c.assign(_en=c["year"].isin(en_years))
        f3 = lambda cb: np.log(_rho(cb, cb.is_peat & cb._en)) - np.log(_rho(cb, cb.is_peat & ~cb._en))
        n_en = int(is_en.sum())
        if n_en == 0 or n_en == len(yrs):
            res.append(result("V9", "H3 log rho_ElNino - log rho_other (peat)", None,
                              "90% CI < 0", None, notes="no El Nino / other contrast in window"))
        else:
            ci3 = _boot(cc, yrs, f3, n_boot, rng, groups=is_en.astype(int))
            v3 = f3(cc)
            verdict = "accepted" if ci3[1] < 0 else ("rejected, opposite sign" if ci3[0] > 0 else "rejected")
            note = f"{verdict}; El Nino years={sorted(int(y) for y in yrs[is_en])}"
            if n_en < 2:
                note += "; only one El Nino year: CI reflects other-year variability only"
            res.append(result("V9", "H3 log rho_ElNino - log rho_other (peat)", v3, "90% CI < 0",
                              ci3[1] < 0, ci=ci3, notes=note))
    return res
