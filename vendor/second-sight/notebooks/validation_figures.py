"""EXP-05: validation figures (PNG + SVG) into ${SS_DATA_DIR}/figures/.

Reads only files written by pipeline/run/validate_all.py:
series_H_national.parquet, ablation_table.csv, monthly_stratum.parquet.
Run from the repo root: python notebooks/validation_figures.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.run.validate_all import load_monthly_stratum  # noqa: E402
from pipeline.science.common import AQUA, NOAA20, SNPP, TERRA, data_dir  # noqa: E402

INK, MUTED, GRID = "#1f2933", "#6b7785", "#e4e7eb"
C_RAW, C_H, C_REF = "#c2410c", "#1d4ed8", "#6b7785"


def _style(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", color=GRID, lw=0.8)
    ax.tick_params(colors=INK, labelsize=9)


def _save(fig, out, name):
    for ext in ("png", "svg"):
        fig.savefig(out / f"{name}.{ext}", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("wrote", out / f"{name}.png")


def main():
    root = data_dir()
    der, out = root / "derived", root / "figures"
    out.mkdir(parents=True, exist_ok=True)
    H = pd.read_parquet(der / "series_H_national.parquet")
    H["date"] = pd.to_datetime(dict(year=H.year, month=H.month, day=1))
    ms, _ = load_monthly_stratum(root)
    from pipeline.science.common import normalize_satellite
    ms["satellite"] = normalize_satellite(ms["satellite"])
    w = ms.pivot_table(index=["year", "month"], columns="satellite", values="cell_days",
                       aggfunc="sum", fill_value=0).reset_index()
    for s in (TERRA, AQUA, SNPP, NOAA20):
        if s not in w:
            w[s] = 0.0
    w["date"] = pd.to_datetime(dict(year=w.year, month=w.month, day=1))
    # naive raw concat: Terra before Aqua, Aqua to 2011, SNPP 2012+
    w["raw"] = np.where(w.year >= 2012, w[SNPP], np.where(w[AQUA] > 0, w[AQUA], w[TERRA]))

    # 1. national calendar raw vs harmonized
    fig, ax = plt.subplots(figsize=(11, 3.6))
    ax.plot(w.date, w.raw, color=C_RAW, lw=1, label="raw concatenation (MODIS to 2011, VIIRS S-NPP 2012+)")
    ax.plot(H.date, H.H, color=C_H, lw=1.2, label="harmonized H (Aqua scale)")
    if "H_lo" in H:
        ax.fill_between(H.date, H.H_lo, H.H_hi, color=C_H, alpha=0.2, lw=0)
    for x in ("2012-01-01", "2022-01-01"):
        ax.axvline(pd.Timestamp(x), color=MUTED, lw=0.8, ls="--")
    ax.set_ylabel("fire cell-days / month", color=INK)
    ax.set_title("Indonesia monthly fire activity: raw vs harmonized", loc="left", color=INK)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    _style(ax)
    _save(fig, out, "national_raw_vs_harmonized")

    # 2. seam plot: z = log(H+1) - log(Aqua+1) around 2012 and 2022 (main + raw)
    m = H.merge(w[["year", "month", AQUA, "raw", "date"]], on=["year", "month"], suffixes=("", "_w"))
    m = m[m[AQUA] > 0]
    zH = np.log(m.H + 1) - np.log(m[AQUA] + 1)
    zR = np.log(m.raw + 1) - np.log(m[AQUA] + 1)
    fig, ax = plt.subplots(figsize=(11, 3.4))
    ax.plot(m.date, zR, color=C_RAW, lw=1, label="raw concatenation vs Aqua")
    ax.plot(m.date, zH, color=C_H, lw=1.2, label="harmonized H vs Aqua")
    ax.axhline(0, color=INK, lw=0.6)
    for x in ("2012-01-01", "2022-01-01"):
        ax.axvline(pd.Timestamp(x), color=MUTED, lw=0.8, ls="--")
    ax.set_xlim(pd.Timestamp("2009-01-01"), m.date.max())
    ax.set_ylabel("z = log(H+1) - log(Aqua+1)", color=INK)
    ax.set_title("Seam test: log ratio to the Aqua reference", loc="left", color=INK)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    _style(ax)
    _save(fig, out, "seam_plot")

    # 3. ablation bar chart (LOYO MdAPE and sunset KGE)
    ab = pd.read_csv(der / "ablation_table.csv")
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.4))
    for ax, col, lab in ((axes[0], "loyo_mdape", "LOYO MdAPE (%) - lower is better"),
                         (axes[1], "sunset_kge", "Sunset KGE - higher is better")):
        vals = ab[col].astype(float)
        bars = ax.bar(ab.method, vals, color=[C_H if mm == "M3" else C_REF for mm in ab.method])
        for b, v in zip(bars, vals):
            if np.isfinite(v):
                ax.text(b.get_x() + b.get_width() / 2, v, f"{v:.2f}", ha="center",
                        va="bottom", fontsize=8, color=INK)
        ax.set_title(lab, loc="left", fontsize=10, color=INK)
        _style(ax)
    _save(fig, out, "ablation")


if __name__ == "__main__":
    main()
