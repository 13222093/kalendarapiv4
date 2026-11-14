import importlib.util
from pathlib import Path

import pytest

from api.agent import tools as T

pytestmark = pytest.mark.skipif(not (T.bundle_dir() / "index.json").exists(), reason="bundle not present")


def test_eval_rule_planner():
    p = Path(__file__).resolve().parents[2] / "eval" / "agent_eval.py"
    spec = importlib.util.spec_from_file_location("agent_eval", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert len(mod.CASES) >= 40
    _, m = mod.run(None)
    assert m["untraceable_total"] == 0
    assert m["refusal_acc"] == 1.0
    assert m["plan_acc"] >= 0.9
