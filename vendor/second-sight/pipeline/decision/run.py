"""Run DEC-02 (alert calendar) and DEC-03 (leave-one-year-out backtest).

    python -m pipeline.decision.run

Needs ``derived/physics/monthly_H.parquet`` from ``python -m pipeline.physics.run``
(national + island_region harmonised H). Writes ``alert_calendar.json``,
``backtest.parquet`` and ``decision_summary.json`` to ``derived/physics/``.

DEC-01 (priority from bootstrap replicates) is not run: ``pipeline.science``
returns only H_lo/H_hi, not per-replicate series.
"""
from __future__ import annotations

import json

import pandas as pd

from pipeline.data.config import data_dir
from pipeline.decision import alert_calendar, backtest
from pipeline.physics.run import provenance
from pipeline.science.enso import load_enso_classes

TEST_YEARS = range(2003, 2026)


def main() -> dict:
    out = data_dir() / "derived" / "physics"
    Hm = pd.read_parquet(out / "monthly_H.parquet")[["aoi", "month", "H"]]
    Hm["month"] = pd.to_datetime(Hm["month"])
    cls = load_enso_classes()
    enso = {int(r.year): r.enso_class for r in cls.itertuples() if r.enso_class is not None}

    tab = alert_calendar.conditional_climatology(Hm, enso)
    recs = alert_calendar.calendar_records(tab)
    prov = provenance()
    (out / "alert_calendar.json").write_text(json.dumps(
        {"provenance": prov, "baseline_years": [2003, 2022], "records": recs}, indent=2))

    bt = backtest.backtest_alert_rule(Hm, enso, TEST_YEARS, target_months=(9, 10), p_threshold=0.5)
    bt.to_parquet(out / "backtest.parquet", index=False)
    by_aoi = backtest.summarise_backtest(bt, by="aoi")
    overall = backtest.summarise_backtest(bt[bt["aoi"] != "Indonesia"], by=None)

    sepoct = tab[tab["cal_month"].isin([9, 10])]
    summary = {
        "provenance": prov,
        "enso_years": {c: sorted(y for y, k in enso.items() if k == c and 2003 <= y <= 2025)
                       for c in ("el_nino", "neutral", "la_nina")},
        "calendar_sep_oct": sepoct.to_dict(orient="records"),
        "backtest_by_aoi": by_aoi.reset_index().to_dict(orient="records"),
        "backtest_islands_pooled": overall.to_dict(orient="records"),
        "backtest_rows": bt.to_dict(orient="records"),
        "dec01": "not run: pipeline.science exposes no per-replicate bootstrap series",
    }
    (out / "decision_summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print(sepoct.to_string())
    print(by_aoi.to_string())
    print(overall.to_string())
    return summary


if __name__ == "__main__":
    main()
