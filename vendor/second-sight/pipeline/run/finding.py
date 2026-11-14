"""VAL-04 finding: raw-concat (M0) vs harmonized (M3) event magnitudes and trend artefact.

PRELIMINARY. Writes ${SS_DATA_DIR}/derived/finding.json. See docs/finding.md.

- M0 raw concat: Terra/Aqua (MODIS) counts until 2011-12, S-NPP counts from 2012-01, no
  conversion (what a naive user sees when switching to the "newer" sensor).
- H (M3): pipeline harmonized series on the Aqua scale (Aqua native until 2021-12,
  S-NPP * kappa_s 2022-01..2026-10). Intervals are the per-month kappa bootstrap 5/95
  bounds summed over months (comonotone approximation: kappa draws are shared across
  months, so summed percentiles approximate the percentile of the sum). 2015 and 2019 are
  in the Aqua era and carry no calibration uncertainty, so ratio bounds are H_lo/H2015,
  H_hi/H2015.
- 2026 comes from the NRT tables (provisional) and is compared on the same months-to-date
  (Jan..last S-NPP-era month) in every year.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pandas as pd

YEARS = (2015, 2019, 2023, 2026)
REGIONS = {"national": None, "Kalimantan": "Kalimantan", "Sumatra": "Sumatra"}
FIRE_MONTHS = (8, 9, 10)


# ------------------------------------------------------------------ helpers (tested)

def theil_sen(x, y) -> float:
    """Median of pairwise slopes."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    i, j = np.triu_indices(len(x), 1)
    dx = x[j] - x[i]
    ok = dx != 0
    return float(np.median((y[j] - y[i])[ok] / dx[ok]))


def ratio(num, den, num_lo=None, num_hi=None) -> dict:
    """Ratio with bounds when only the numerator is uncertain (denominator in Aqua era)."""
    out = {"ratio": float(num / den) if den else None}
    if num_lo is not None and den:
        out["lo"], out["hi"] = float(num_lo / den), float(num_hi / den)
    return out


def artefact_share(slope_raw: float, slope_h: float) -> float | None:
    """Fraction of the raw trend removed by harmonization: 1 - slope_H / slope_raw."""
    if slope_raw == 0:
        return None
    return float(1.0 - slope_h / slope_raw)


def spearman(a, b) -> float:
    ra = pd.Series(list(a)).rank().to_numpy()
    rb = pd.Series(list(b)).rank().to_numpy()
    return float(np.corrcoef(ra, rb)[0, 1])


# ------------------------------------------------------------------ data

def _adapt(raw: pd.DataFrame) -> pd.DataFrame:
    from pipeline.run import validate_all as VA
    from pipeline.science import validate as V
    d = raw.copy()
    m = pd.to_datetime(d["month"])
    d["year"], d["month"] = m.dt.year.astype(int), m.dt.month.astype(int)
    d["season"] = d["month"].map(VA.SEASON_OF_MONTH)
    d["is_peat"] = d["peat"].astype(str).eq("peat")
    d["cell_days"] = d["n_cells"].astype(float)
    keep = ["year", "month", "island_region", "season", "daynight", "is_peat", "satellite",
            "cell_days", "n_det", "sum_frp"]
    d = d[keep].groupby([c for c in keep if c not in ("cell_days", "n_det", "sum_frp")],
                        as_index=False, observed=True).sum()
    d["satellite"] = V._sat(d)["satellite"]
    return d


def load(root: Path):
    from pipeline.run import validate_all as VA
    from pipeline.science import validate as V
    ms, info = VA.load_monthly_stratum(root)
    ms["satellite"] = V._sat(ms)["satellite"]
    nrt = _adapt(pd.read_parquet(root / "derived" / "monthly_stratum_2026nrt.parquet"))
    nrt = nrt[nrt["year"] == 2026]
    both = pd.concat([ms[ms["year"] < 2026], nrt], ignore_index=True)
    return ms, both, info


def main(n_boot: int = 300):
    from pipeline.run import validate_all as VA
    from pipeline.run.extras import REPO, expand_fit
    from pipeline.science.calibrate import CAL_YEARS, fit_kappa
    from pipeline.science.chain import terra_to_aqua
    from pipeline.science.series import build_series

    root = VA.data_dir()
    ms, both, info = load(root)
    fit = fit_kappa(ms, years=CAL_YEARS, n_boot=n_boot)
    ta = terra_to_aqua(ms, n_boot=n_boot)
    H = build_series(both, fit, terra_aqua=ta, n20_snpp=None, by=["island_region"],
                     aqua_end=(2021, 12))
    R = build_series(both, expand_fit(VA.kappa_one(), both), terra_aqua=None, n20_snpp=None,
                     by=["island_region"], aqua_end=(2011, 12))
    # Terra-era raw: build_series has no terra_aqua factor -> NaN; use raw Terra counts.
    R["raw"] = np.where(R["sensor_used"] == "Terra", R["T_raw"], R["H"])
    R = R[["island_region", "year", "month", "raw"]]
    df = H.merge(R, on=["island_region", "year", "month"], how="left")
    m26 = df[(df.year == 2026) & (df.sensor_used == "SNPP")].month
    last26 = int(m26.max())
    out = {"meta": {"run_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                    "commit": VA.git_commit(),
                    "data_manifest_sha256": VA.sha256(root / "data_manifest.json"),
                    "monthly_stratum_sha256": VA.sha256(root / "derived" / "monthly_stratum.parquet"),
                    "nrt_sha256": VA.sha256(root / "derived" / "monthly_stratum_2026nrt.parquet"),
                    "n_boot": n_boot, "status": "PRELIMINARY",
                    "peat_values": info.get("peat_values"),
                    "ytd_months": f"Jan-{last26:02d}", "y2026": "NRT provisional",
                    "raw_definition": "MODIS (Terra/Aqua) to 2011-12, S-NPP raw from 2012-01",
                    "H_definition": "M3 EB kappa, Aqua native to 2021-12, S-NPP*kappa after",
                    "interval": "5/95 kappa bootstrap, monthly bounds summed (comonotone approx)"},
           "regions": {}}
    for name, reg in REGIONS.items():
        d = df if reg is None else df[df.island_region == reg]
        res = {}
        for wname, mask in {"annual": d.month > 0, "aug_oct": d.month.isin(FIRE_MONTHS),
                            "ytd": d.month <= last26}.items():
            g = d[mask].groupby("year")[["raw", "H", "H_lo", "H_hi"]].sum()
            tot = {int(y): {k: float(g.loc[y, k]) for k in g.columns} for y in YEARS if y in g.index}
            if wname == "annual":
                tot.pop(2026, None)
            rat = {}
            for y in (2019, 2023, 2026):
                if y not in tot or 2015 not in tot:
                    continue
                b = tot[2015]
                rat[f"{y}/2015"] = {"raw": ratio(tot[y]["raw"], b["raw"]),
                                    "H": ratio(tot[y]["H"], b["H"], tot[y]["H_lo"], tot[y]["H_hi"])}
            res[wname] = {"totals": tot, "ratios": rat}
        ann = d[(d.year >= 2001) & (d.year <= 2025)].groupby("year")[["raw", "H", "H_lo", "H_hi"]].sum()
        sr, sh = theil_sen(ann.index, ann.raw), theil_sen(ann.index, ann.H)
        res["trend_2001_2025"] = {"slope_raw_per_yr": sr, "slope_H_per_yr": sh,
                                  "slope_H_lo": theil_sen(ann.index, ann.H_lo),
                                  "slope_H_hi": theil_sen(ann.index, ann.H_hi),
                                  "artefact_share": artefact_share(sr, sh),
                                  "mean_raw": float(ann.raw.mean()), "mean_H": float(ann.H.mean())}
        out["regions"][name] = res
    sp = pd.read_csv(REPO / "pipeline" / "support" / "sipongi_burned_area.csv")
    sp = sp[(sp.province == "NATIONAL") & sp.year.isin([2015, 2019, 2023])].set_index("year")
    nat = out["regions"]["national"]["annual"]["totals"]
    ys = [2015, 2019, 2023]
    ba = [float(sp.loc[y, "burned_area_ha"]) for y in ys]
    raw_v, h_v = [nat[y]["raw"] for y in ys], [nat[y]["H"] for y in ys]
    out["sipongi_rank"] = {
        "years": ys, "burned_area_ha": ba,
        "verification": [str(sp.loc[y, "verification_status"]) for y in ys],
        "ba_ratio_2019_2015": ba[1] / ba[0], "ba_ratio_2023_2015": ba[2] / ba[0],
        "spearman_raw": spearman(raw_v, ba), "spearman_H": spearman(h_v, ba),
        "rank_order_ba": [ys[i] for i in np.argsort(ba)[::-1]],
        "rank_order_raw": [ys[i] for i in np.argsort(raw_v)[::-1]],
        "rank_order_H": [ys[i] for i in np.argsort(h_v)[::-1]],
        "note": "descriptive only, n=3"}
    path = root / "derived" / "finding.json"
    path.write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=1, default=str))
    return out


if __name__ == "__main__":
    main()
