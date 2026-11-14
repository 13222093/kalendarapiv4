import pytest

from api.agent import tools as t

pytestmark = pytest.mark.skipif(not (t.bundle_dir() / "index.json").exists(), reason="bundle not present")


def test_resolve_alias_and_typo():
    assert t.resolve_aoi("Kalteng")["candidates"][0]["aoi_id"] == "region-kalimantan"
    assert t.resolve_aoi("sumatera selatan")["candidates"][0]["aoi_id"] == "region-sumatra"
    assert t.resolve_aoi("kalimntan")["candidates"][0]["aoi_id"] == "region-kalimantan"
    assert t.resolve_aoi("Thailand")["candidates"] == []


def test_month_vs_history_and_enso():
    mv = t.month_vs_history("region-kalimantan", 2015, 9)
    assert mv["rank"] == 1 and mv["evidence_ids"]
    an = t.compare_enso_analogs("region-kalimantan", 2015, 9)
    assert an["enso_class"] == "el_nino" and an["analog_n"] >= 2


def test_brief_verified_and_whitelist():
    assert t.make_brief("region-kalimantan", 2015, 9)["verified"]
    with pytest.raises(t.ToolError):
        t.call_tool("os_system", {})
    with pytest.raises(t.ToolError):
        t.month_vs_history("region-kalimantan", 1990, 9)
