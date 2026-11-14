"""Run the science chain on the data layer's monthly_stratum and write outputs.

    python -m pipeline.science.run [--n-boot 1000] [--out DIR]

Outputs (default SS_DATA_DIR/science/): strata_factors.json, chain_factors.json,
series_national.parquet, series_by_region.parquet, baseline.parquet, enso_class.json,
validation_results.json. Nothing here is committed to git.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .baseline import add_anomalies, compute_baseline
from .calibrate import fit_kappa
from .chain import noaa20_to_snpp, terra_to_aqua
from .common import AQUA, N_BOOT, SEED, data_dir, load_monthly_stratum
from .dynamic import fit_dynamic_kappa, frp_covariates, m4_method
from .enso import load_enso_classes
from .peat import peat_hypotheses
from .series import build_series
from .validate import METHODS, loro, loyo, ratio_series, seam_test, sunset_backtest, write_results


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-boot", type=int, default=N_BOOT)
    ap.add_argument("--out", default=None)
    ap.add_argument("--input", default=None)
    ap.add_argument("--f-star", type=float, default=None,
                    help="FRP floor F* (MW) from PHY-01; enables M4 (CAL-06) and V15")
    a = ap.parse_args(argv)
    out = Path(a.out) if a.out else data_dir() / "science"
    out.mkdir(parents=True, exist_ok=True)

    ms = load_monthly_stratum(a.input)
    kfit = fit_kappa(ms, n_boot=a.n_boot, seed=SEED)
    kfit.meta["peat_labels_available"] = bool(ms["peat_known"].any())
    kfit.write_json(out / "strata_factors.json")
    ta, ns = terra_to_aqua(ms, n_boot=a.n_boot), noaa20_to_snpp(ms, n_boot=a.n_boot)
    (out / "chain_factors.json").write_text(json.dumps(
        {"terra_to_aqua": ta.to_dict(), "noaa20_to_snpp": ns.to_dict()}, indent=2, default=str))

    nat = build_series(ms, kfit, ta, ns)
    reg = build_series(ms, kfit, ta, ns, by=["island_region"])
    base = compute_baseline(nat)
    nat = add_anomalies(nat, base)
    nat.to_parquet(out / "series_national.parquet", index=False)
    reg.to_parquet(out / "series_by_region.parquet", index=False)
    base.to_parquet(out / "baseline.parquet", index=False)
    enso = load_enso_classes(path=out / "enso_class.json")

    results = []
    methods = dict(METHODS)
    if a.f_star is not None:
        import pandas as pd
        dc = pd.read_parquet(data_dir() / "derived" / "daily_cell.parquet",
                             columns=["local_date", "satellite", "daynight", "sum_frp",
                                      "island_region"])
        cov = frp_covariates(dc, a.f_star)
        cov.to_parquet(out / "frp_covariates.parquet", index=False)
        dyn = fit_dynamic_kappa(ms, cov, n_boot=min(a.n_boot, 200))
        results += dyn.coefficient_results()
        methods["M4"] = m4_method(cov)
    tab, r1 = loyo(ms, methods)
    results += r1
    m3 = next(r["value"] for r in r1 if r["metric"] == "LOYO MdAPE M3")
    results += loro(ms, v1_mdape_m3=m3)[1]
    # V3: seam test of H (M3) and raw concatenation (M0) against the Aqua-only reference
    ref = ms[ms["satellite"] == AQUA].groupby(["year", "month"])["cell_days"].sum() \
        .rename("R").reset_index()
    results += seam_test(ratio_series(nat, ref), method="M3", n_boot=a.n_boot)
    raw = ms.groupby(["year", "month", "satellite"])["cell_days"].sum().unstack(fill_value=0)
    m0 = nat[["year", "month", "sensor_used"]].copy()
    m0["H"] = [raw.loc[(y, m), s] if (y, m) in raw.index and s in raw.columns else 0
               for y, m, s in zip(m0.year, m0.month, m0.sensor_used)]
    results += seam_test(ratio_series(m0, ref), method="M0", n_boot=a.n_boot)
    results += sunset_backtest(ms, methods)
    results += peat_hypotheses(ms, enso, n_boot=a.n_boot)
    write_results(results, out / "validation_results.json")
    print(f"wrote {len(results)} validation entries to {out}")


if __name__ == "__main__":
    main()
