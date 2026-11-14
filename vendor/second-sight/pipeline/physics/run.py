"""Run PHY-01/02/03 and TRI-01..03 on the real derived tables.

    python -m pipeline.physics.run

Reads ``$SS_DATA_DIR/derived/{detections,daily_cell}.parquet``; writes to
``$SS_DATA_DIR/derived/physics/`` and ``$SS_DATA_DIR/figures/`` (never git).
A machine-readable summary of every headline number is written to
``derived/physics/physics_summary.json``.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.data.config import data_dir
from pipeline.physics import diurnal, frp_floor, overpass, triangulate
from pipeline.science import calibrate, chain, series
from pipeline.science.common import SEASON_OF_MONTH

NATIONAL = "Indonesia"
GRID_RES = 0.01


def _paths():
    d = data_dir()
    out = d / "derived" / "physics"
    fig = d / "figures"
    out.mkdir(parents=True, exist_ok=True)
    fig.mkdir(parents=True, exist_ok=True)
    return d, out, fig


def provenance() -> dict:
    d = data_dir()
    man = d / "data_manifest.json"
    h = hashlib.sha256(man.read_bytes()).hexdigest() if man.exists() else None
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:  # pragma: no cover
        commit = None
    return {"run_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "manifest_sha256": h, "commit": commit}


def _cell_id(lat, lon, res=GRID_RES):
    eps = 1e-7
    iy = np.floor((np.asarray(lat) + 90) / res + eps).astype(np.int64)
    ix = np.floor((np.asarray(lon) + 180) / res + eps).astype(np.int64)
    return iy * round(360 / res) + ix


# --------------------------------------------------------------------------- PHY-02
def run_overpass(det: pd.DataFrame, fig_dir: Path) -> tuple[pd.DataFrame, dict]:
    d = det[(det["local_date"].dt.year >= 2003) & (det["local_date"].dt.year <= 2025)]
    d = d.rename(columns={"lst_hour": "lst"})[["satellite", "daynight", "local_date", "lst"]]
    ov = overpass.effective_overpass_time(d, date_col="local_date", min_count=30)
    summ = {}
    for (sat, dn), g in ov.groupby(["satellite", "daynight"]):
        y = pd.to_datetime(g["month"]).dt.year
        early = g.loc[(y >= 2003) & (y <= 2012), "lst_median"]
        if sat in ("SNPP",):
            early = g.loc[(y >= 2012) & (y <= 2014), "lst_median"]
        if sat in ("NOAA20",):
            early = g.loc[(y >= 2018) & (y <= 2020), "lst_median"]
        late = g.loc[(y >= 2023) & (y <= 2025), "lst_median"]
        # robust to midnight wrap: shift around early mean
        if len(early) and len(late):
            c = overpass.circular_median_hours(early)
            e = np.median(np.mod(early - c + 12, 24) - 12)
            l_ = np.median(np.mod(late - c + 12, 24) - 12)
            shift = float((l_ - e) * 60)
        else:
            shift = None
        yr = g.assign(year=y).groupby("year")["lst_median"].apply(overpass.circular_median_hours)
        summ[f"{sat}_{dn}"] = {
            "early_median_lst": float(overpass.circular_median_hours(early)) if len(early) else None,
            "late_2023_2025_median_lst": float(overpass.circular_median_hours(late)) if len(late) else None,
            "shift_minutes_late_minus_early": shift,
            "yearly_median_lst": {int(k): round(float(v), 3) for k, v in yr.items()},
            "n_months": int(len(g)),
        }
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), sharex=True)
        for ax, dn in zip(axes, ["D", "N"]):
            for sat, g in ov[ov["daynight"] == dn].groupby("satellite"):
                v = g["lst_median"].to_numpy()
                if dn == "N":
                    v = np.mod(v + 12, 24) - 12  # show night around midnight
                ax.plot(pd.to_datetime(g["month"]), v, ".", ms=3, label=sat)
            ax.set_title(f"Effective overpass LST ({'day' if dn == 'D' else 'night'})")
            ax.set_ylabel("median LST of detections [h]" + (" (rel. midnight)" if dn == "N" else ""))
            ax.legend()
            ax.grid(alpha=.3)
        fig.tight_layout()
        fig.savefig(fig_dir / "phy02_overpass_lst.png", dpi=120)
        plt.close(fig)
    except ImportError:
        pass
    return ov, summ


# --------------------------------------------------------------------------- PHY-01
def run_frp_floor(det: pd.DataFrame, fig_dir: Path) -> dict:
    y = det["local_date"].dt.year
    ov = det[(y >= 2012) & (y <= 2021)]
    v = ov[ov["satellite"] == "SNPP"].copy()
    v["cell_id"] = _cell_id(v["latitude"].to_numpy(), v["longitude"].to_numpy())
    vcell = frp_floor.viirs_cell_overpass_frp(v, overpass_cols=("satellite", "local_date"))
    m = ov[ov["satellite"] == "Aqua"].rename(columns={"a_pix": "A_pix"})
    res = frp_floor.frp_floor(vcell, m)
    curve = res["curve"]
    # SENSITIVITY (not pre-registered): VIIRS counts all scan angles but MODIS only
    # A_pix <= 2 km2, so R(F) may plateau at a sampling ratio != 1. Normalise by the
    # plateau (median R for F >= 20 MW) and apply the same F* rule.
    sens = {}
    for dn, g in curve.groupby("daynight"):
        plateau = float(np.nanmedian(g.loc[g["F"] >= 20, "R"]))
        sens[dn] = {"plateau_R": plateau,
                    "f_star": frp_floor.select_f_star(g["F"], g["R"] / plateau, 0.15, 3, 30, g["n_modis"])}
    res["f_star_sensitivity"] = sens
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(7, 4.5))
        for dn, g in curve.groupby("daynight"):
            ax.semilogx(g["F"], g["R"], "o-", ms=3, label=f"{dn}  F*={res['f_star'].get(dn)}"
                        f" (plateau-normalised F*={sens[dn]['f_star']})")
        ax.axhspan(0.85, 1.15, color="grey", alpha=.2)
        ax.axhline(1, color="k", lw=.8)
        ax.set_xlabel("F [MW]")
        ax.set_ylabel("R(F) = N_VIIRS(sumFRP>=F) / N_Aqua(FRP>=F, A_pix<=2)")
        ax.set_title("PHY-01 FRP ratio curve, SNPP vs Aqua 2012-2021")
        ax.legend()
        ax.grid(alpha=.3, which="both")
        fig.tight_layout()
        fig.savefig(fig_dir / "phy01_frp_ratio_curve.png", dpi=120)
        plt.close(fig)
    except ImportError:
        pass
    return res


# --------------------------------------------------------------------------- science H
def monthly_cell_days(dc: pd.DataFrame) -> pd.DataFrame:
    """Long monthly table for pipeline.science from daily_cell (cell_days = rows)."""
    t = pd.to_datetime(dc["local_date"])
    df = pd.DataFrame({"island_region": dc["island_region"].to_numpy(),
                       "daynight": dc["daynight"].to_numpy(),
                       "satellite": dc["satellite"].to_numpy(),
                       "year": t.dt.year.to_numpy(), "month": t.dt.month.to_numpy()})
    df["season"] = df["month"].map(SEASON_OF_MONTH)
    df["is_peat"] = "unknown"  # no peat labels in derived tables yet
    return (df.groupby(["island_region", "season", "daynight", "is_peat", "satellite", "year", "month"])
            .size().rename("cell_days").reset_index())


def harmonized_H(ms: pd.DataFrame, n_boot: int = 200) -> dict:
    kap = calibrate.fit_kappa(ms, n_boot=n_boot)
    ta = chain.terra_to_aqua(ms, n_boot=n_boot)
    ns = chain.noaa20_to_snpp(ms, n_boot=n_boot)
    out = {"kappa": kap}
    for name, by in [("national", []), ("island", ["island_region"]), ("daynight", ["daynight"])]:
        s = series.build_series(ms, kap, ta, ns, by=by)
        s["month_ts"] = pd.to_datetime(dict(year=s["year"], month=s["month"], day=1))
        out[name] = s
    return out


def _monthly_H(sc: dict) -> pd.DataFrame:
    nat = sc["national"].assign(aoi=NATIONAL)
    isl = sc["island"].rename(columns={"island_region": "aoi"})
    m = pd.concat([nat, isl], ignore_index=True)
    return m.rename(columns={"month": "cal_m"}).assign(month=lambda x: x["month_ts"])[
        ["aoi", "month", "H", "H_lo", "H_hi", "A_raw", "V_raw", "sensor_used"]]


# --------------------------------------------------------------------------- TRI
def run_triangulation(dc: pd.DataFrame, f_star: dict, Hm: pd.DataFrame, f_sens: dict | None = None) -> tuple[pd.DataFrame, dict]:
    dc = dc.copy()
    dcn = dc.assign(national=NATIONAL)
    fs = {k: v for k, v in f_star.items() if v is not None}
    if not fs and f_sens:
        fs = {k: v for k, v in f_sens.items() if v is not None}
    parts = []
    for col, d in [("island_region", dc), ("national", dcn)]:
        hl = triangulate.h_large(d, fs, aoi_col=col, satellites=["Aqua"]) if fs else None
        he = triangulate.h_energy(d, aoi_col=col)
        t = he if hl is None else hl.merge(he, on=["aoi", "month"], how="outer")
        parts.append(t)
    tri = pd.concat(parts, ignore_index=True)
    tri["month"] = pd.to_datetime(tri["month"])
    tri = tri.merge(Hm[["aoi", "month", "H"]], on=["aoi", "month"], how="left")
    tri = tri[(tri["month"].dt.year >= 2003)].reset_index(drop=True)
    series_cols = ("H", "H_large", "H_energy") if fs else ("H", "H_energy")
    if "H_large" in tri:
        tri["H_large"] = tri["H_large"].fillna(0)
    tab = triangulate.agreement_table(tri, series=series_cols)
    y = tab["month"].dt.year
    tab["era"] = np.select([y < 2012, y <= 2021], ["pre-2012", "2012-2021"], "2022+")
    summ = {}
    for scope, sub in [("national", tab[tab["aoi"] == NATIONAL]), ("island", tab[tab["aoi"] != NATIONAL])]:
        s = {}
        for era, g in sub.groupby("era"):
            a = g["agreement"].dropna()
            vc = a.value_counts(normalize=True).reindex(["A", "B", "C"], fill_value=0)
            s[era] = {"n": int(a.size), **{k: round(float(v), 3) for k, v in vc.items()}}
        summ[scope] = s
    return tab, summ


# --------------------------------------------------------------------------- PHY-03
def run_drift_ratio(ov: pd.DataFrame, sc: dict, fig_dir: Path) -> dict:
    rp = diurnal.drift_ratio_series(ov, num_sat="Aqua", den_sat="SNPP", daynight="D")
    rp["month"] = pd.to_datetime(rp["month"])
    dn = sc["daynight"]
    d = dn[(dn["daynight"] == "D") & (dn["year"] >= 2022) & (dn["year"] <= 2025)].copy()
    d["R_obs"] = d["A_raw"] / d["H"]  # H in SNPP era = V_raw * kappa
    j = d[["month_ts", "R_obs", "A_raw", "H"]].merge(rp, left_on="month_ts", right_on="month")
    j = j[np.isfinite(j["R_obs"]) & (j["H"] >= 50)]
    out = {"params": diurnal.DEFAULT_PARAMS.as_dict(), "flag": "[UNVERIFIED] placeholder diurnal parameters",
           "n_months": int(len(j))}
    if len(j) >= 3:
        x, yv = j["R_pred"].to_numpy(), j["R_obs"].to_numpy()
        slope, intercept = np.polyfit(x, yv, 1)
        out.update({"slope": float(slope), "intercept": float(intercept),
                    "pearson_r": float(np.corrcoef(x, yv)[0, 1]),
                    "pearson_p": float(__import__("scipy.stats").stats.pearsonr(x, yv)[1]),
                    "R_pred_range": [float(x.min()), float(x.max())],
                    "R_obs_median": float(np.median(yv)),
                    "R_obs_iqr": [float(np.percentile(yv, 25)), float(np.percentile(yv, 75))],
                    "note": "R_obs = Aqua day cell-days / (SNPP day cell-days x kappa); months with H>=50"})
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            fig, ax = plt.subplots(1, 2, figsize=(12, 4.5))
            ax[0].plot(j["month_ts"], j["R_obs"], "o-", ms=3, label="R_obs Aqua/(SNPP*kappa)")
            ax[0].plot(j["month_ts"], j["R_pred"], "s-", ms=3, label="R_pred diurnal [UNVERIFIED]")
            ax[0].legend(); ax[0].grid(alpha=.3)
            ax[1].scatter(x, yv, s=10)
            ax[1].set_xlabel("R_pred"); ax[1].set_ylabel("R_obs")
            ax[1].set_title(f"slope={slope:.2f} r={out['pearson_r']:.2f}")
            fig.suptitle("PHY-03 drift ratio 2022-2025 (day) - placeholder params [UNVERIFIED]")
            fig.tight_layout()
            fig.savefig(fig_dir / "phy03_drift_ratio.png", dpi=120)
            plt.close(fig)
        except ImportError:
            pass
    j.to_parquet(fig_dir.parent / "derived" / "physics" / "drift_ratio.parquet", index=False)
    return out


def main() -> dict:
    d, out, fig = _paths()
    prov = provenance()
    t0 = time.time()
    det = pd.read_parquet(d / "derived" / "detections.parquet",
                          columns=["latitude", "longitude", "satellite", "local_date", "lst_hour",
                                   "daynight", "frp", "a_pix"])
    det["local_date"] = pd.to_datetime(det["local_date"])
    summary = {"provenance": prov}

    ov, s_ov = run_overpass(det, fig)
    ov.to_parquet(out / "overpass_time.parquet", index=False)
    summary["phy02_overpass"] = s_ov
    print("PHY-02 done", round(time.time() - t0), "s", flush=True)

    res = run_frp_floor(det, fig)
    res["curve"].to_parquet(out / "frp_ratio_curve.parquet", index=False)
    fs = {"f_star_MW": res["f_star"], "params": res["params"], "years": [2012, 2021],
          "viirs": "SNPP sum FRP per (cell 0.01 deg, local_date, daynight)",
          "modis": "Aqua pixel FRP with A_pix <= 2 km2", "provenance": prov,
          "f_star_sensitivity_NOT_PREREGISTERED": res["f_star_sensitivity"],
          "curve": res["curve"].replace({np.nan: None}).to_dict(orient="records")}
    (out / "f_star.json").write_text(json.dumps(fs, indent=2, default=float))
    summary["phy01_f_star"] = res["f_star"]
    summary["phy01_f_star_sensitivity"] = res["f_star_sensitivity"]
    print("PHY-01 done", res["f_star"], round(time.time() - t0), "s", flush=True)
    del det

    dc = pd.read_parquet(d / "derived" / "daily_cell.parquet",
                         columns=["local_date", "cell_id", "satellite", "daynight", "sum_frp", "island_region"])
    dc["local_date"] = pd.to_datetime(dc["local_date"])
    ms = monthly_cell_days(dc)
    sc = harmonized_H(ms)
    Hm = _monthly_H(sc)
    Hm.to_parquet(out / "monthly_H.parquet", index=False)
    summary["kappa_table"] = sc["kappa"].table.replace({np.nan: None}).to_dict(orient="records")
    print("science H done", round(time.time() - t0), "s", flush=True)

    f_sens = {k: v["f_star"] for k, v in res["f_star_sensitivity"].items()}
    tab, s_tri = run_triangulation(dc, res["f_star"], Hm, f_sens)
    s_tri["f_star_used"] = {k: v for k, v in res["f_star"].items() if v is not None} or {
        "sensitivity_plateau_normalised": f_sens}
    tab.to_parquet(out / "triangulation.parquet", index=False)
    summary["tri_agreement"] = s_tri
    print("TRI done", s_tri, round(time.time() - t0), "s", flush=True)

    summary["phy03_drift"] = run_drift_ratio(ov, sc, fig)
    print("PHY-03 done", summary["phy03_drift"], flush=True)

    (out / "physics_summary.json").write_text(json.dumps(summary, indent=2, default=str))
    return summary


if __name__ == "__main__":
    main()
