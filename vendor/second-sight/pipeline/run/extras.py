"""VAL-04 ablation, VAL-06 SiPongi, VAL-07 sensitivity (partial), VAL-10 flag agreement, V12.

Called from ``validate_all``; every function returns result dicts (validate.result format).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.science import validate as V
from pipeline.science.baseline import compute_baseline
from pipeline.science.calibrate import CAL_YEARS, fit_kappa, fit_simple_ratio
from pipeline.science.common import AQUA, SNPP
from pipeline.science.series import build_series, expand_fit  # noqa: F401 (re-export)

REPO = Path(__file__).resolve().parents[2]


def _cal(ms):
    return ms[ms["year"].isin(list(CAL_YEARS))]


def _monthly_pred(ms, fit):
    return V.predict_aqua(fit, _cal(ms), ["year", "month"])


# ---------------------------------------------------------------- V10


def _f1_kappa(a: np.ndarray, b: np.ndarray):
    a, b = a.astype(bool), b.astype(bool)
    tp, fp, fn = (a & b).sum(), (~a & b).sum(), (a & ~b).sum()
    f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else np.nan
    n = len(a)
    po = (a == b).mean()
    pe = a.mean() * b.mean() + (1 - a.mean()) * (1 - b.mean())
    ck = (po - pe) / (1 - pe) if pe < 1 else np.nan
    return float(f1), float(ck), int(tp), int(fp), int(fn), n


def v10_flag_agreement(ms, fit):
    """Flag >= p90 (Aqua baseline 2003-2022 per calendar month) for Aqua native vs SNPP*kappa."""
    a = ms[ms["satellite"] == AQUA].groupby(["year", "month"], as_index=False)["cell_days"].sum()
    base = compute_baseline(a.rename(columns={"cell_days": "H"}), value="H")
    p = _monthly_pred(ms, fit).merge(base[["month", "p90"]], on="month")
    f1, ck, tp, fp, fn, n = _f1_kappa(p["obs"] >= p["p90"], p["pred"] >= p["p90"])
    note = (f"national monthly 2012-2021, n={n}, TP={tp} FP={fp} FN={fn}; threshold = Aqua p90 "
            "per calendar month 2003-2022; kappa M3 fitted in-sample 2012-2021")
    res = [V.result("V10", "flag agreement F1", f1, ">= 0.7", f1 >= 0.7, notes=note),
           V.result("V10", "flag agreement Cohen kappa", ck, ">= 0.6", ck >= 0.6, notes=note),
           V.result("V10", "flag agreement decision", None, "Cohen kappa >= 0.6 and F1 >= 0.7",
                    bool(ck >= 0.6 and f1 >= 0.7))]
    return res


# ---------------------------------------------------------------- V12


def v12_extreme_years(ms, fit):
    p = V.predict_aqua(fit, _cal(ms), ["year"])
    rho = V.spearman(p["pred"], p["obs"])
    top_o = set(p.nlargest(3, "obs")["year"].astype(int))
    top_p = set(p.nlargest(3, "pred")["year"].astype(int))
    return [V.result("V12", "annual rank Spearman Aqua vs SNPP*kappa", rho,
                     "Spearman >= 0.9 and top-3 years identical",
                     bool(rho >= 0.9 and top_o == top_p),
                     notes=f"top3 Aqua={sorted(top_o)} top3 SNPP*kappa={sorted(top_p)}; "
                           "H equals Aqua in 2012-2021, so SNPP*kappa (in-sample M3) is compared")]


# ---------------------------------------------------------------- V6


def v6_sipongi(ms, H):
    path = REPO / "pipeline" / "support" / "sipongi_burned_area.csv"
    if not path.exists():
        return [{"test_id": "V6", "metric": "SiPongi Spearman", "value": None, "ci": None,
                 "rule": None, "passed": None, "notes": "sipongi csv missing", "status": "not_run"}]
    sp = pd.read_csv(path)
    sp = sp[(sp["province"] == "NATIONAL")
            & sp["verification_status"].astype(str).str.startswith("verified")]
    raw = build_series(ms, expand_fit(V.KappaFit(table=pd.DataFrame({"kappa": [1.0], "sum_A": [1.0],
                                                          "sum_V": [1.0]}),
                                      meta={"strata_keys": []}), ms), by=[])
    ha = H.groupby("year")["H"].sum()
    ra = raw.groupby("year")["H"].sum()
    d = sp[["year", "burned_area_ha"]].copy()
    d["H"], d["raw"] = d["year"].map(ha), d["year"].map(ra)
    d = d.dropna()
    rh, rr = V.spearman(d["H"], d["burned_area_ha"]), V.spearman(d["raw"], d["burned_area_ha"])
    note = (f"verified national years only: {d['year'].tolist()} (n={len(d)}); descriptive "
            f"because n < 5; H={d['H'].round(0).tolist()} raw={d['raw'].round(0).tolist()} "
            f"BA={d['burned_area_ha'].tolist()}")
    return [V.result("V6", "SiPongi Spearman H (national)", rh, "rho(H) >= rho(raw); descriptive",
                     None, notes=note),
            V.result("V6", "SiPongi Spearman raw concat (national)", rr, "descriptive", None,
                     notes=note)]


# ---------------------------------------------------------------- V7 (partial)


def v7_sensitivity(root: Path, ms=None):
    """Only the strata/shrinkage variants are feasible from monthly_stratum; see notes."""
    if ms is None:
        from pipeline.run.validate_all import load_monthly_stratum
        ms, _ = load_monthly_stratum(root)
        ms["satellite"] = V._sat(ms)["satellite"]
    variants = {
        "M3 main": fit_kappa(ms, n_boot=0),
        "M3 min_rel_sd x0.5": fit_kappa(ms, n_boot=0, min_rel_sd=0.025),
        "M3 min_rel_sd x2": fit_kappa(ms, n_boot=0, min_rel_sd=0.10),
        "strata region x daynight": fit_kappa(ms, n_boot=0, keys=["island_region", "daynight"],
                                              parent_keys=["daynight"], gp_keys=[]),
        "M2 region x season": fit_simple_ratio(ms, keys=["island_region", "season"]),
        "M1 global": fit_simple_ratio(ms, keys=[]),
    }
    last = ms[["year", "month"]].drop_duplicates().sort_values(["year", "month"]).iloc[-1]
    classes = {}
    for name, f in variants.items():
        s = build_series(ms, expand_fit(f, ms), by=[]).groupby(["year", "month"], as_index=False)["H"].sum()
        b = compute_baseline(s, value="H")
        row = s[(s.year == last.year) & (s.month == last.month)].merge(b, on="month")
        h, lo, hi = float(row["H"].iloc[0]), float(row["p10"].iloc[0]), float(row["p90"].iloc[0])
        classes[name] = "below_p10" if h < lo else "above_p90" if h > hi else "normal"
    share = np.mean([c == classes["M3 main"] for c in classes.values()])
    note = (f"latest month {int(last.year)}-{int(last.month):02d}; classes {classes}. PARTIAL: "
            "only strata/shrinkage variants are computable from monthly_stratum. Confidence "
            "filter (all / high only), grid 0.01 vs 0.05 deg and static mask N=5/20 need "
            "re-running pipeline/data clean+aggregate with those settings. min_rel_sd is the "
            "available shrinkage knob (no n0 parameter in calibrate.py).")
    return [V.result("V7", "share of variants with unchanged anomaly class (partial)", share * 100,
                     ">= 80% of variants unchanged (full variant set required)", None, notes=note)]


# ---------------------------------------------------------------- VAL-04 ablation


def seam_metrics(ms, f, ref, n_boot=0):
    """Delta_seam at 2012-01 and Pettitt p (+-24 months) on the switch-at-2012 series."""
    s = build_series(ms, expand_fit(f, ms), by=[], aqua_end=(2011, 12))
    z = V.ratio_series(s.groupby(["year", "month"], as_index=False)["H"].sum(), ref)
    st = int(2012 * 12)  # month_index(2012, 1)
    d = V.seam_delta(z, st)
    seg = z[(z["t"] >= st - 24) & (z["t"] < st + 24)]
    return d, V.pettitt(seg["z"])["p"]


def ablation(ms, meths, loyo_tab, sunset_res, seam_info_fn):
    ref = None
    rows, res = [], []
    for name, fn in meths.items():
        f = fn(ms, CAL_YEARS)
        p = _monthly_pred(ms, f)
        g = loyo_tab[loyo_tab["method"] == name]
        sk = next((r["value"] for r in sunset_res if r["metric"] == f"sunset KGE {name}"), None)
        d12, pp = seam_info_fn(f)
        rows.append({"method": name, "overlap_kge": V.kge(p["pred"], p["obs"]),
                     "loyo_mdape": V.mdape(g["pred"], g["obs"]),
                     "ape_2015": float(g.loc[g.year == 2015, "ape"].iloc[0]),
                     "ape_2019": float(g.loc[g.year == 2019, "ape"].iloc[0]),
                     "sunset_kge": sk, "delta_seam_2012": d12, "pettitt_p_2012": pp})
    tab = pd.DataFrame(rows)
    for r in tab.itertuples():
        res.append(V.result("VAL-04", f"ablation {r.method}", r.loyo_mdape, "descriptive", None,
                            notes=f"overlap_kge={r.overlap_kge:.3f}; loyo_mdape={r.loyo_mdape:.2f}%; "
                                  f"APE2015={r.ape_2015:.2f}%; APE2019={r.ape_2019:.2f}%; "
                                  f"sunset_kge={r.sunset_kge if r.sunset_kge is None else round(r.sunset_kge, 3)}; "
                                  f"delta_seam_2012={r.delta_seam_2012:.3f}; pettitt_p={r.pettitt_p_2012:.3g}"))
    m3 = tab.set_index("method")
    if {"M3", "M3x"} <= set(m3.index):
        res.append(V.result("V4/H5", "M3x LOYO MdAPE > M3 LOYO MdAPE (drift component)",
                            m3.loc["M3x", "loyo_mdape"], "MdAPE(M3x) > MdAPE(M3)",
                            None, notes=f"M3={m3.loc['M3', 'loyo_mdape']:.2f}%, M3x="
                                        f"{m3.loc['M3x', 'loyo_mdape']:.2f}%; component only, "
                                        "physics slope part of V4 not run"))
    return tab, res
