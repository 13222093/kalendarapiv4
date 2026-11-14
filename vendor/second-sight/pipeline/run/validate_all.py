"""VAL-12: end-to-end validation runner on the real derived data.

Loads ``derived/monthly_stratum.parquet``, adapts it to the science-module schema, fits
kappa (CAL-01/02), chain factors (CAL-03), the harmonized series H (CAL-04), baseline and
ENSO classes (ANO-01/02), then runs every validation that the data allow and writes
``derived/validation_results.json``. Pass/fail follows docs/validation_plan.md; a test that
cannot run is written with ``status = "not_run"`` and a reason. Nothing is imputed.

Usage: python -m pipeline.run.validate_all [--n-boot 1000] [--skip-enso]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
import traceback
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.science import validate as V
from pipeline.science.baseline import compute_baseline
from pipeline.science.calibrate import CAL_YEARS, KappaFit, fit_kappa, fit_simple_ratio
from pipeline.science.chain import noaa20_to_snpp, terra_to_aqua
from pipeline.science.common import AQUA, SEASON_OF_MONTH, SNPP, data_dir, month_index
from pipeline.science.series import build_series

M3X_EXTRA = tuple(range(2022, 2026))
RESULTS: list[dict] = []


# ---------------------------------------------------------------- helpers


def add(res):
    for r in res if isinstance(res, list) else [res]:
        r.setdefault("status", "run")
        RESULTS.append(r)


def not_run(test_id, metric, reason):
    add({"test_id": test_id, "metric": metric, "value": None, "ci": None, "rule": None,
         "passed": None, "notes": reason, "status": "not_run"})


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True,
                                       cwd=Path(__file__).parent).strip()
    except Exception:
        return "unknown"


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_monthly_stratum(root: Path, name: str = "monthly_stratum.parquet") -> tuple[pd.DataFrame, dict]:
    """Adapt derived/monthly_stratum.parquet to the science schema.

    Data layer columns: month (date), peat (peat/mineral/unknown), season (dry Jun-Oct /
    wet), n_cells. Science layer expects year, month (int), is_peat (bool), cell_days and the
    pre-registered 3 seasons (wet Dec-Mar, transition Apr-Jul, dry Aug-Nov). The season is
    recomputed from the month so the pre-registered strata are used.
    """
    raw = pd.read_parquet(root / "derived" / name)
    d = raw.copy()
    m = pd.to_datetime(d["month"])
    d["year"], d["month"] = m.dt.year.astype(int), m.dt.month.astype(int)
    d["season_data_layer"] = d["season"]
    d["season"] = d["month"].map(SEASON_OF_MONTH)
    peat_vals = sorted(d["peat"].astype(str).unique())
    info = {"peat_values": peat_vals, "rows": int(len(d)),
            "season_note": "data layer season (dry Jun-Oct / wet) replaced by pre-registered "
                           "3-season split from the month"}
    info["peat_joined"] = any(v in ("peat", "mineral") for v in peat_vals) and "unknown" not in peat_vals
    d["is_peat"] = d["peat"].astype(str).eq("peat")
    d["cell_days"] = d["n_cells"].astype(float)
    keep = ["year", "month", "island_region", "season", "daynight", "is_peat", "satellite",
            "cell_days", "n_det", "sum_frp"]
    d = d[keep].groupby([c for c in keep if c not in ("cell_days", "n_det", "sum_frp")],
                        as_index=False, observed=True).sum()
    return d, info


def kappa_one() -> KappaFit:
    """M0: no conversion (kappa = 1)."""
    return KappaFit(table=pd.DataFrame({"kappa": [1.0], "sum_A": [1.0], "sum_V": [1.0]}),
                    meta={"method": "M0 raw", "strata_keys": []})


def methods_all() -> dict:
    return {
        "M0": lambda df, yrs: kappa_one(),
        "M1": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=[]),
        "M2": lambda df, yrs: fit_simple_ratio(df, years=yrs, keys=["island_region", "season"]),
        "M3": lambda df, yrs: fit_kappa(df, years=yrs, n_boot=0),
        "M3x": lambda df, yrs: fit_kappa(df, years=tuple(yrs) + M3X_EXTRA, n_boot=0),
    }


def national(series: pd.DataFrame, col="H") -> pd.DataFrame:
    return series.groupby(["year", "month"], as_index=False)[col].sum()


def aqua_ref(ms: pd.DataFrame) -> pd.DataFrame:
    a = ms[ms["satellite"] == AQUA].groupby(["year", "month"], as_index=False)["cell_days"].sum()
    return a.rename(columns={"cell_days": "R"})


def series_for(ms, fit, ta, ns, aqua_end):
    from pipeline.run.extras import expand_fit
    return build_series(ms, expand_fit(fit, ms), terra_aqua=ta, n20_snpp=ns, by=[], aqua_end=aqua_end)


# ---------------------------------------------------------------- main


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-boot", type=int, default=1000)
    ap.add_argument("--skip-enso", action="store_true")
    ap.add_argument("--input", default="monthly_stratum.parquet",
                    help="stratum parquet under derived/ (e.g. monthly_stratum_labeled.parquet)")
    ap.add_argument("--tag", default="",
                    help="suffix for every output file, e.g. _peat -> validation_results_peat.json")
    args = ap.parse_args(argv)
    root = data_dir()
    out_dir = root / "derived"
    tag = args.tag
    ms, info = load_monthly_stratum(root, args.input)
    info["file"] = args.input
    ms["satellite"] = V._sat(ms)["satellite"]
    run_meta = {"run_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "commit": git_commit(), "data_dir": str(root),
                "data_manifest_sha256": sha256(root / "data_manifest.json"),
                "monthly_stratum_sha256": sha256(out_dir / args.input),
                "n_boot": args.n_boot, "input": info,
                "year_range": [int(ms.year.min()), int(ms.year.max())],
                "last_month": f"{int(ms.year.max())}-{int(ms[ms.year == ms.year.max()].month.max()):02d}"}
    print("loaded", info)

    # CAL-01/02/03/04
    fit = fit_kappa(ms, years=CAL_YEARS, n_boot=args.n_boot)
    fit.write_json(out_dir / f"strata_factors{tag}.json")
    ta = terra_to_aqua(ms, n_boot=args.n_boot)
    ns = noaa20_to_snpp(ms, n_boot=args.n_boot)
    H = series_for(ms, fit, ta, ns, (2021, 12))
    H.to_parquet(out_dir / f"series_H_national{tag}.parquet")
    kt = fit.table
    for (reg, dn), g in kt.groupby(["island_region", "daynight"]):
        k = float(g["sum_A"].sum() / g["sum_V"].sum()) if g["sum_V"].sum() > 0 else np.nan
        add(V.result("CAL", f"kappa pooled {reg} {dn}", k, "descriptive", None,
                     notes=f"EB stratum kappa range [{g['kappa'].min():.3f},{g['kappa'].max():.3f}]; "
                           f"sum_A={g['sum_A'].sum():.0f} sum_V={g['sum_V'].sum():.0f}"))
    pooled = float(kt["sum_A"].sum() / kt["sum_V"].sum())
    add(V.result("CAL", "kappa pooled national", pooled, "descriptive", None,
                 notes=f"n strata={len(kt)}; plausible(0<k<1)={int(kt['plausible'].sum())}"))
    for name, f in (("Terra->Aqua", ta), ("NOAA20->SNPP", ns)):
        p = f.meta.get("pooled_ratio")
        add(V.result("CAL", f"chain pooled {name}", p, "descriptive", None,
                     notes=f"window {f.meta.get('window', '')}"))

    # ANO-01/02
    base = compute_baseline(national(H), value="H")
    base.to_parquet(out_dir / f"baseline_national{tag}.parquet")
    enso = None
    if not args.skip_enso:
        try:
            from pipeline.science.enso import load_enso_classes
            enso = load_enso_classes(path=out_dir / "enso_class.json")
            en = enso[(enso.enso_class == "el_nino") & enso.year.between(2000, 2026)]
            add(V.result("ENSO", "el nino years 2000-2026", len(en), "descriptive", None,
                         notes=", ".join(str(int(y)) for y in en.year)))
        except Exception as e:  # network may be unavailable
            not_run("ENSO", "ONI/DMI classes", f"download failed: {e!r}")

    meths = methods_all()
    # V1 LOYO (M0..M3x)
    tab1, r1 = V.loyo(ms, methods=meths)
    add(r1)
    md = {m: V.mdape(g["pred"], g["obs"]) for m, g in tab1.groupby("method")}
    tab1.to_csv(out_dir / f"val_loyo{tag}.csv", index=False)
    # V2 LORO
    try:
        tab2, r2 = V.loro(ms, v1_mdape_m3=md.get("M3"))
        add(r2)
        m3 = [r for r in r2 if r["metric"].startswith("LORO MdAPE M3")]
        add(V.result("V2", "LORO decision M3 (all regions)", None,
                     "every region MdAPE <= 2 x V1 M3 and <= 40%",
                     all(r["passed"] for r in m3) if m3 else None))
    except Exception as e:
        not_run("V2", "LORO", f"error: {e!r}")
    # V5 sunset
    r5 = V.sunset_backtest(ms, methods=meths)
    add(r5)

    # V3 seam: main series (switch 2022-01) and a 2012 switch variant (tests kappa at 2012-01)
    ref = aqua_ref(ms)
    seam_info = {}
    for label, aqua_end in (("main", (2021, 12)), ("switch2012", (2011, 12))):
        for mname in ("M0", "M3"):
            f = kappa_one() if mname == "M0" else fit
            s = series_for(ms, f, None if mname == "M0" else ta, None if mname == "M0" else ns,
                           aqua_end)
            z = V.ratio_series(national(s), ref)
            res = V.seam_test(z, n_boot=args.n_boot, method=f"{mname}/{label}")
            for r in res:
                r["notes"] += ("; reference R = Aqua native (MCD64A1 not available); in the Aqua "
                               "era z == 0 by construction")
                if r["value"] == 0.0 and r["ci"] == [0.0, 0.0]:
                    # H == Aqua on both sides: no sensor switch in this configuration
                    r["passed"], r["status"] = None, "not_applicable"
                    r["notes"] += "; NOT APPLICABLE: no sensor switch at this date in this series"
            add(res)
            seam_info[(label, mname)] = z
    # required decision per plan: M3 passes 2012-01 and 2022-01
    def _seam(label, m, key):
        return next((r for r in RESULTS if r["test_id"] == "V3"
                     and r["metric"] == f"seam {key} {m}/{label}"), None)
    r12 = _seam("switch2012", "M3", "2012-01 MODIS->VIIRS overlap")
    r22 = _seam("main", "M3", "2022-01 SNPP x kappa")
    if r12 and r22:
        ok = None if r12["passed"] is None or r22["passed"] is None else (r12["passed"] and r22["passed"])
        add(V.result("V3", "seam decision M3 (2012-01 and 2022-01)", None,
                     "M3 passes 2012-01 (switch2012 variant) and 2022-01 (main)", ok))

    # V9 peat
    if info["peat_joined"]:
        from pipeline.science.peat import peat_hypotheses
        add(peat_hypotheses(ms, enso_classes=enso, n_boot=args.n_boot))
    else:
        not_run("V9", "peat hypotheses H1-H3",
                f"peat labels not joined in monthly_stratum (peat values {info['peat_values']}); "
                "DAT-03 peat join pending")

    # V10, V12, V6, V7, VAL-04 (ablation) live in extras so the runner stays readable
    from pipeline.run import extras
    add(extras.v10_flag_agreement(ms, fit))
    add(extras.v12_extreme_years(ms, fit))
    add(extras.v6_sipongi(ms, H))
    add(extras.v7_sensitivity(root, ms))
    abl, rabl = extras.ablation(ms, meths, tab1, r5, seam_info_fn=lambda f: extras.seam_metrics(
        ms, f, ref, args.n_boot))
    add(rabl)
    abl.to_csv(out_dir / f"ablation_table{tag}.csv", index=False)
    run_meta["ablation"] = abl.replace({np.nan: None}).to_dict(orient="records")

    for tid, why in (("V4", "physics drift prediction R_pred not wired (pipeline/physics) in runner"),
                     ("V8", "dry-season rainfall series not available in derived/"),
                     ("V11", "readiness calendar backtest not wired"),
                     ("V13", "observability O and burned area per cell-month not available"),
                     ("V14", "triangulation classes not in derived/"),
                     ("V15", "M4 FRP-conditioned kappa needs daily_cell covariates; not run here"),
                     ("V16", "physics prior m_s not available"),
                     ("V17", "Amazon-west data not ingested")):
        not_run(tid, tid, why)

    payload = {"meta": run_meta, "results": RESULTS}
    (out_dir / f"validation_results{tag}.json").write_text(json.dumps(payload, indent=2, default=str))
    n_pass = sum(r["passed"] is True for r in RESULTS)
    n_fail = sum(r["passed"] is False for r in RESULTS)
    n_nr = sum(r["status"] == "not_run" for r in RESULTS)
    print(f"wrote {out_dir / f'validation_results{tag}.json'}: {len(RESULTS)} entries, "
          f"pass={n_pass} fail={n_fail} not_run={n_nr}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
