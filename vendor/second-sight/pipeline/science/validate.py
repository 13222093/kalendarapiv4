"""VAL-01 / VAL-02 / VAL-03: LOYO, LORO, seam test with placebo, MODIS-sunset backtest.

Pass rules follow docs/validation_plan.md (pre-registered). Every test returns a list of
result dicts {test_id, metric, value, ci, rule, passed, notes} for validation_results.json.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy import stats

from .calibrate import CAL_YEARS, KappaFit, apply_kappa, fit_kappa, fit_simple_ratio
from .common import AQUA, SEED, SNPP, month_index, normalize_satellite

# ---------------------------------------------------------------- metrics


def mdape(pred, obs) -> float:
    pred, obs = np.asarray(pred, float), np.asarray(obs, float)
    ok = obs > 0
    return float(np.median(np.abs(pred[ok] - obs[ok]) / obs[ok]) * 100) if ok.any() else np.nan


def median_bias(pred, obs) -> float:
    pred, obs = np.asarray(pred, float), np.asarray(obs, float)
    ok = obs > 0
    return float(np.median((pred[ok] - obs[ok]) / obs[ok]) * 100) if ok.any() else np.nan


def kge(sim, obs) -> float:
    sim, obs = np.asarray(sim, float), np.asarray(obs, float)
    if len(sim) < 2 or np.std(obs) == 0 or np.mean(obs) == 0:
        return np.nan
    r = np.corrcoef(sim, obs)[0, 1]
    return float(1 - np.sqrt((r - 1) ** 2 + (np.std(sim) / np.std(obs) - 1) ** 2
                             + (np.mean(sim) / np.mean(obs) - 1) ** 2))


def spearman(a, b) -> float:
    if len(a) < 3:
        return np.nan
    return float(stats.spearmanr(a, b).statistic)


def result(test_id, metric, value, rule, passed, ci=None, notes="") -> dict:
    def _f(x):
        return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else float(x)
    return {"test_id": test_id, "metric": metric, "value": _f(value),
            "ci": None if ci is None else [_f(ci[0]), _f(ci[1])], "rule": rule,
            "passed": None if passed is None else bool(passed), "notes": notes}


def write_results(results: list[dict], path: str | Path) -> None:
    Path(path).write_text(json.dumps(results, indent=2))


# ---------------------------------------------------------------- methods

FitFn = Callable[[pd.DataFrame, tuple], KappaFit]

METHODS: dict[str, FitFn] = {
    "M1": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=[]),
    "M2": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=["island_region", "season"]),
    "M3": lambda df, yrs: fit_kappa(df, years=yrs, n_boot=0),
}

# For LORO the held-out region has no own stratum: drop island_region from the strata.
LORO_METHODS: dict[str, FitFn] = {
    "M1": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=[]),
    "M2": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=["season"]),
    "M3": lambda df, yrs: fit_kappa(df, years=yrs, n_boot=0,
                                    keys=["season", "daynight", "is_peat"],
                                    parent_keys=["daynight"], gp_keys=[]),
}


def _sat(df):
    d = df.copy()
    d["satellite"] = normalize_satellite(d["satellite"])
    return d


def predict_aqua(fit: KappaFit, df: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    """Predicted (kappa x SNPP) and observed Aqua cell-days grouped by ``by``."""
    d = _sat(df)
    v = d[d["satellite"] == SNPP].copy()
    if hasattr(fit, "covariates"):  # DynamicKappaFit (M4) with attached covariates
        v = v.merge(fit.covariates[["year", "month", "island_region", "phi", "eta"]],
                    on=["year", "month", "island_region"], how="left")
        k = fit.kappa(v.fillna({"phi": 0.5, "eta": 0.0}))
        v["pred"] = v["cell_days"].to_numpy() * k
    else:
        v["pred"] = apply_kappa(v, fit)
    a = d[d["satellite"] == AQUA]
    out = v.groupby(by)["pred"].sum().to_frame().join(a.groupby(by)["cell_days"].sum().rename("obs"),
                                                       how="outer").fillna(0)
    return out.reset_index()


# ---------------------------------------------------------------- V1 / V2


def loyo(ms: pd.DataFrame, methods: dict[str, FitFn] | None = None, years=CAL_YEARS,
         highlight=(2015, 2019)):
    """Leave-one-year-out. Returns (per-year table, results)."""
    methods = methods or METHODS
    rows = []
    for name, fn in methods.items():
        for y in years:
            train = tuple(x for x in years if x != y)
            fit = fn(ms, train)
            p = predict_aqua(fit, ms[ms["year"] == y], ["year"])
            rows.append({"method": name, "year": y, "pred": float(p["pred"].sum()),
                         "obs": float(p["obs"].sum())})
    tab = pd.DataFrame(rows)
    tab["ape"] = np.abs(tab["pred"] - tab["obs"]) / tab["obs"] * 100
    res, md = [], {}
    for name, g in tab.groupby("method"):
        md[name] = mdape(g["pred"], g["obs"])
        rho = spearman(g["pred"], g["obs"])
        hl = {int(r.year): round(float(r.ape), 2) for r in g.itertuples() if r.year in highlight}
        res.append(result("V1", f"LOYO MdAPE {name}", md[name], "see V1 rule", None,
                          notes=f"spearman={rho:.3f}; bias={median_bias(g['pred'], g['obs']):.2f}%; "
                                f"APE {hl}"))
        res.append(result("V1", f"LOYO Spearman {name}", rho, ">= 0.8", rho >= 0.8))
    if "M3" in md and "M1" in md:
        rho3 = spearman(*tab[tab.method == "M3"][["pred", "obs"]].to_numpy().T)
        ok = md["M3"] <= md["M1"] and md["M3"] <= 25 and rho3 >= 0.8
        res.append(result("V1", "LOYO decision (M3 vs M1)", md["M3"],
                          "MdAPE(M3) <= MdAPE(M1) and MdAPE(M3) <= 25% and Spearman >= 0.8", ok))
    if "M4" in md and "M3" in md:
        res.append(result("V1", "M4 adoption", md["M4"], "MdAPE(M4) <= MdAPE(M3)",
                          md["M4"] <= md["M3"]))
    return tab, res


def loro(ms: pd.DataFrame, methods: dict[str, FitFn] | None = None, years=CAL_YEARS,
         v1_mdape_m3: float | None = None):
    """Leave-one-region-out: annual totals of the held-out region."""
    methods = methods or LORO_METHODS
    rows = []
    regions = sorted(ms["island_region"].unique())
    for name, fn in methods.items():
        for reg in regions:
            fit = fn(ms[ms["island_region"] != reg], tuple(years))
            test = ms[(ms["island_region"] == reg) & ms["year"].isin(list(years))]
            p = predict_aqua(fit, test, ["year"])
            for r in p.itertuples():
                rows.append({"method": name, "region": reg, "year": r.year, "pred": r.pred,
                             "obs": r.obs})
    tab = pd.DataFrame(rows)
    res = []
    for (name, reg), g in tab.groupby(["method", "region"]):
        m = mdape(g["pred"], g["obs"])
        passed = None
        rule = "MdAPE <= 2 x MdAPE(V1, M3) and <= 40%"
        if name == "M3":
            passed = m <= 40 and (v1_mdape_m3 is None or m <= 2 * v1_mdape_m3)
        res.append(result("V2", f"LORO MdAPE {name} {reg}", m, rule, passed))
    return tab, res


# ---------------------------------------------------------------- V3 seam test


def ratio_series(h: pd.DataFrame, ref: pd.DataFrame, h_col="H", ref_col="R") -> pd.DataFrame:
    """z_t = log(H_t + 1) - log(R_t + 1) on common (year, month)."""
    m = h[["year", "month", h_col]].merge(ref[["year", "month", ref_col]], on=["year", "month"])
    m["z"] = np.log(m[h_col] + 1) - np.log(m[ref_col] + 1)
    m["t"] = month_index(m["year"], m["month"])
    return m.sort_values("t").reset_index(drop=True)


def pettitt(z) -> dict:
    """Pettitt change-point test. K = max |U_t|, p ~= 2 exp(-6K^2/(n^3+n^2))."""
    z = np.asarray(z, float)
    n = len(z)
    if n < 3:
        return {"K": np.nan, "p": np.nan, "tau": None}
    sgn = np.sign(z[None, :] - z[:, None])  # sgn(z_j - z_i)
    U = np.array([sgn[: t + 1, t + 1:].sum() for t in range(n - 1)])
    tau = int(np.argmax(np.abs(U)))
    K = float(np.abs(U[tau]))
    p = min(1.0, 2 * np.exp(-6 * K ** 2 / (n ** 3 + n ** 2)))
    return {"K": K, "p": float(p), "tau": tau}  # change after position tau


def pelt(z, penalty: float | None = None, model: str = "l2"):
    """PELT breakpoints via ruptures (None if ruptures is not installed)."""
    try:
        import ruptures as rpt
    except ImportError:
        return None
    z = np.asarray(z, float).reshape(-1, 1)
    pen = penalty if penalty is not None else 2 * np.log(len(z)) * max(np.var(z), 1e-12)
    return [int(b) for b in rpt.Pelt(model=model, min_size=3).fit(z).predict(pen=pen)[:-1]]


def seam_delta(zdf: pd.DataFrame, seam_t: int, window: int = 12) -> float:
    before = zdf[(zdf["t"] < seam_t) & (zdf["t"] >= seam_t - window)]["z"]
    after = zdf[(zdf["t"] >= seam_t) & (zdf["t"] < seam_t + window)]["z"]
    if len(before) < window // 2 or len(after) < window // 2:
        return np.nan
    return float(after.mean() - before.mean())


def _block_boot_delta(zdf, seam_t, window, n_boot, block, rng):
    before = zdf[(zdf["t"] < seam_t) & (zdf["t"] >= seam_t - window)]["z"].to_numpy()
    after = zdf[(zdf["t"] >= seam_t) & (zdf["t"] < seam_t + window)]["z"].to_numpy()

    def _res(x):
        nb = int(np.ceil(len(x) / block))
        starts = rng.integers(0, max(1, len(x) - block + 1), nb)
        return np.concatenate([x[s:s + block] for s in starts])[: len(x)]
    d = [_res(after).mean() - _res(before).mean() for _ in range(n_boot)]
    return np.percentile(d, [5, 95])


SEAMS = {"2002-07 Terra->Aqua": (2002, 7), "2012-01 MODIS->VIIRS overlap": (2012, 1),
         "2018-04 NOAA-20": (2018, 4), "2022-01 SNPP x kappa": (2022, 1),
         "2026-11 NOAA-20 x r x kappa": (2026, 11)}


def seam_test(zdf: pd.DataFrame, seams: dict | None = None, window: int = 12,
              exclusion: int = 12, n_boot: int = 1000, block: int = 3, seed: int = SEED,
              method: str = "M3", pettitt_window: int = 3) -> list[dict]:
    """V3: Delta_seam vs placebo distribution (all months >= exclusion from any seam)."""
    seams = seams or SEAMS
    seam_ts = {k: int(month_index(*v)) for k, v in seams.items()}
    rng = np.random.default_rng(seed)
    cand = zdf["t"].to_numpy()
    far = np.array([all(abs(t - s) >= exclusion for s in seam_ts.values()) for t in cand])
    placebo = np.array([seam_delta(zdf, int(t), window) for t in cand[far]])
    placebo = placebo[np.isfinite(placebo)]
    p_lo, p_hi = (np.percentile(placebo, [5, 95]) if len(placebo) >= 10 else (np.nan, np.nan))
    res = []
    for name, st in seam_ts.items():
        d = seam_delta(zdf, st, window)
        if not np.isfinite(d):
            res.append(result("V3", f"seam {name} {method}", None, "inside placebo 90%", None,
                              notes="insufficient data around seam"))
            continue
        ci = _block_boot_delta(zdf, st, window, n_boot, block, rng)
        seg = zdf[(zdf["t"] >= st - 2 * window) & (zdf["t"] < st + 2 * window)].reset_index(drop=True)
        pt = pettitt(seg["z"])
        near = pt["tau"] is not None and abs(int(seg["t"].iloc[pt["tau"] + 1]) - st) <= pettitt_window
        notes = f"placebo90=[{p_lo:.3f},{p_hi:.3f}] n_placebo={len(placebo)}; Pettitt p={pt['p']:.3f}"
        if near and pt["p"] < 0.10:
            notes += "; FAILURE NOTE: Pettitt change point at seam (p<0.10)"
        passed = bool(p_lo <= d <= p_hi) if np.isfinite(p_lo) else None
        res.append(result("V3", f"seam {name} {method}", d, "Delta_seam inside placebo 90% range",
                          passed, ci=ci, notes=notes))
    bkps = pelt(zdf["z"])
    if bkps is not None:
        dates = [f"{int(zdf['year'].iloc[b])}-{int(zdf['month'].iloc[b]):02d}" for b in bkps]
        res.append(result("V3", f"PELT breakpoints {method}", len(bkps), "descriptive", None,
                          notes=", ".join(dates)))
    return res


# ---------------------------------------------------------------- V5 sunset


def sunset_backtest(ms: pd.DataFrame, methods: dict[str, FitFn] | None = None,
                    cal_years=tuple(range(2012, 2017)), test_years=tuple(range(2017, 2022))):
    """Calibrate on 2012-2016, reconstruct monthly national Aqua 2017-2021 from SNPP."""
    methods = methods or METHODS
    test = ms[ms["year"].isin(list(test_years))]
    out, kges = [], {}
    for name, fn in methods.items():
        p = predict_aqua(fn(ms, cal_years), test, ["year", "month"])
        kges[name] = kge(p["pred"], p["obs"])
        out.append(result("V5", f"sunset KGE {name}", kges[name], "see V5 rule", None,
                          notes=f"cal {cal_years[0]}-{cal_years[-1]}, test {test_years[0]}-{test_years[-1]}"))
    if "M3" in kges and "M1" in kges:
        out.append(result("V5", "sunset decision M3", kges["M3"], "KGE(M3) >= 0.7 and KGE(M3) > KGE(M1)",
                          kges["M3"] >= 0.7 and kges["M3"] > kges["M1"]))
    if "M4" in kges and "M1" in kges:
        out.append(result("V5", "sunset decision M4", kges["M4"], "KGE(M4) > KGE(M1)",
                          kges["M4"] > kges["M1"]))
    return out
