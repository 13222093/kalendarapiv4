"""EXP-01 v2: 2026 NRT append + province AOI selection (synthetic fixtures)."""
import datetime as dt

import pandas as pd

from pipeline.export import bundle


def _rows(months, sats, region="Sumatra", n=5, **extra):
    out = []
    for m in months:
        for s in sats:
            out.append({"month": pd.Timestamp(m), "island_region": region, "season": "dry",
                        "daynight": "D", "peat": "peat", "satellite": s, "n_cells": n, **extra})
    return pd.DataFrame(out)


def test_with_nrt_drops_sp_overlap_and_keeps_flags():
    sp = _rows(["2025-11-01", "2025-12-01", "2026-01-01"], ["Aqua", "SNPP"])
    nrt = _rows(["2026-01-01", "2026-02-01"], ["Aqua", "SNPP"], n=7)
    nrt["flag_nrt"] = [False, False, True, True]  # Jan = SP-2026, Feb = NRT
    out = bundle.with_nrt(sp, nrt)
    jan = out[out["month"] == "2026-01-01"]
    assert len(jan) == 2 and (jan["n_cells"] == 7).all()  # SP tail replaced, not doubled
    assert not out[out["month"] < "2026-01-01"]["flag_nrt"].any()
    assert out[out["month"] == "2026-02-01"]["flag_nrt"].all()


def test_raw_monthly_flags_nrt_and_partial():
    sp = _rows(["2025-11-01", "2025-12-01"], ["Aqua", "SNPP"])
    nrt = _rows(["2026-01-01", "2026-02-01", "2026-03-01"], ["Aqua", "SNPP"])
    nrt["flag_nrt"] = [False, False, True, True, True, True]
    s = bundle.with_nrt(sp, nrt)
    raw = bundle.raw_monthly(s, "Sumatra", today=dt.date(2026, 3, 14))
    assert list(zip(raw["year"], raw["month"]))[-1] == (2026, 3)
    assert raw["flag_nrt"].tolist() == [False, False, False, True, True]
    assert raw["flag_partial"].tolist() == [False, False, False, False, True]


def test_province_selection_and_ids():
    aois = bundle.aoi_list(["Aceh", "Riau", "Jambi", "Kalimantan Tengah"])
    ids = [a["aoi_id"] for a in aois]
    assert ids[:6] == ["IDN", "region-sumatra", "region-kalimantan", "region-sulawesi",
                       "region-papua", "region-jnbm"]
    # featured provinces first, in featured order
    assert ids[6:] == ["prov-riau", "prov-kalimantan-tengah", "prov-jambi", "prov-aceh"]
    kt = next(a for a in aois if a["aoi_id"] == "prov-kalimantan-tengah")
    assert kt["island_region"] == "Kalimantan" and kt["name_en"] == "Central Kalimantan"
    assert bundle.province_id("Sumatera Selatan") == "prov-sumatera-selatan"
    assert set(bundle.FEATURED_PROVINCES) <= set(bundle.PROVINCE_ISLAND)
    assert len(bundle.PROVINCE_ISLAND) == 34


def test_raw_monthly_province_subset(tmp_path):
    sp = _rows(["2025-12-01"], ["Aqua", "SNPP"])
    nrt = _rows(["2026-01-01"], ["Aqua", "SNPP"])
    nrt["flag_nrt"] = True
    psp = pd.DataFrame({"month": [pd.Timestamp("2025-12-01")] * 3,
                        "province": ["Riau", "Riau", "Jambi"], "peat": "peat", "daynight": "D",
                        "satellite": ["Aqua", "SNPP", "SNPP"], "n_cells": [1, 2, 9]})
    pnrt = psp.assign(month=pd.Timestamp("2026-01-01"), n_cells=[3, 4, 9])
    psp.to_parquet(tmp_path / "monthly_province_labeled.parquet")
    pnrt.to_parquet(tmp_path / "monthly_province_labeled_2026nrt.parquet")
    nrt.to_parquet(tmp_path / "monthly_stratum_2026nrt.parquet")
    ptab = bundle.load_province(tmp_path / "monthly_province_labeled.parquet")
    assert set(ptab["island_region"]) == {"Sumatra"}
    s = bundle.with_nrt(sp, nrt)
    raw = bundle.raw_monthly(s, "Sumatra", "Riau", ptab, today=dt.date(2026, 3, 1))
    assert raw["A_raw"].tolist() == [1, 3] and raw["V_raw"].tolist() == [2, 4]
    assert raw["flag_nrt"].tolist() == [False, True]
