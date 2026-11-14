import json

import pytest

from api.agent import tools as T
from api.agent.planner import Allowed, FakeLLM, ask, execute, propose, trace_to_json, untraceable

pytestmark = pytest.mark.skipif(not (T.bundle_dir() / "index.json").exists(), reason="bundle not present")


def test_rule_plan_enso():
    p = propose("Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain")
    assert p.status == "ready"
    assert [s.tool for s in p.steps] == ["resolve_aoi", "compare_enso_analogs"]
    assert p.steps[1].args == {"aoi_id": "region-kalimantan", "year": 2015, "month": 9}


def test_answer_numbers_traceable_and_trace_json():
    out = ask("Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain")
    assert out["status"] == "answered" and out["verified"] and not out["untraceable"]
    d = json.loads(trace_to_json(out["trace"], out))
    assert d["schema"] == "second-sight.agent-trace/v1"
    s = d["steps"][0]
    assert {"step_no", "actor", "t_offset_s", "engine", "title", "detail", "cited_inputs",
            "gate_result", "outcome"} <= set(s)


def test_refusals():
    for q in ["Prediksi kebakaran Kalimantan 2030", "Berapa titik api di Thailand September 2015?",
              "harga saham hari ini"]:
        out = ask(q)
        assert out["status"] == "refused", q
        assert any(s.kind == "refusal" for s in out["trace"].steps)


def test_handoff_when_period_missing():
    out = ask("Bagaimana kondisi Riau?")
    assert out["status"] == "needs_confirmation"
    assert out["trace"].steps[-1].kind == "handoff"


def test_edited_plan_chips():
    p = propose("September 2015 di Kalimantan").to_dict()
    p["steps"][1]["args"]["year"] = 2019
    out = execute(p)
    assert "2019" in out["text"] and out["verified"]


def test_verifier_blocks_untraceable():
    a = Allowed("id")
    a.n(16079)
    assert untraceable("nilai 16.079 dan 999", a) == ["999"]


def test_fake_llm_plan_and_whitelist():
    llm = FakeLLM([[{"name": "resolve_aoi", "args": {"name": "Kalimantan"}}],
                   [{"name": "rm_rf", "args": {}},
                    {"name": "month_vs_history", "args": {"aoi_id": "region-kalimantan", "year": 2015, "month": 9}}]])
    out = ask("September 2015 Kalimantan", llm=llm)
    assert out["status"] == "answered"
    steps = out["trace"].steps
    assert any(s.gate_result["reason"] == "tool_not_whitelisted" for s in steps)
    assert any(s.engine == "model:fake/scripted" for s in steps)
    assert not out["untraceable"]


def test_handoff_on_ambiguous_aoi():
    out = ask("Kalimantan atau Sumatra September 2015?")
    assert out["status"] == "needs_confirmation"
    ids = {c["aoi_id"] for c in out["choices"]}
    assert {"region-kalimantan", "region-sumatra"} <= ids
