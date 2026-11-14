"""VAL-05b: evaluate V4 (physics drift, H5) from existing outputs.

Pre-registered rule (docs/validation_plan.md, V4 / H5): pass if the R_obs ~ R_pred relation
for 2022-2026 has r > 0 with p < 0.10 **and** M3x LOYO MdAPE > M3 LOYO MdAPE.

Inputs (read only, nothing is refitted here):
  derived/physics/physics_summary.json  -> phy03_drift (slope, pearson_r, pearson_p, n_months)
  derived/validation_results.json       -> V1 "LOYO MdAPE M3" and "LOYO MdAPE M3x"
Output: derived/validation_results_v4.json (single V4 entry + provenance).

The diurnal-cycle parameters behind R_pred are placeholders flagged [UNVERIFIED] in the
physics output, so a pass is reported as conditional on those parameters.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

RULE = ("r(R_obs ~ R_pred, 2022-2026) > 0 with p < 0.10 AND "
        "LOYO MdAPE(M3x, cal 2012-2025) > LOYO MdAPE(M3, cal 2012-2021)")
UNVERIFIED = "[UNVERIFIED]"


def fisher_ci(r: float, n: int, level: float = 0.90) -> list[float] | None:
    """Fisher-z CI for a Pearson r; None when n <= 3 or |r| >= 1."""
    if r is None or n is None or n <= 3 or not (-1 < r < 1):
        return None
    z = {0.90: 1.6448536269514722, 0.95: 1.959963984540054}[level]
    zr, se = math.atanh(r), 1 / math.sqrt(n - 3)
    return [math.tanh(zr - z * se), math.tanh(zr + z * se)]


def _mdape(results: list[dict], method: str) -> float | None:
    for r in results:
        if r.get("test_id") == "V1" and r.get("metric") == f"LOYO MdAPE {method}":
            return r.get("value")
    return None


def evaluate_v4(physics: dict, validation: dict, alpha: float = 0.10) -> dict:
    """Return one V4 result row in the validation_results schema."""
    drift = physics.get("phy03_drift") or {}
    r, p, n = drift.get("pearson_r"), drift.get("pearson_p"), drift.get("n_months")
    m3, m3x = _mdape(validation.get("results", []), "M3"), _mdape(validation.get("results", []), "M3x")
    params = drift.get("params", {})
    unverified = UNVERIFIED in json.dumps(params) or UNVERIFIED in str(drift.get("flag", ""))
    missing = [k for k, v in (("pearson_r", r), ("pearson_p", p), ("MdAPE M3", m3), ("MdAPE M3x", m3x))
               if v is None]
    row = {"test_id": "V4", "metric": "physics drift: Pearson r of R_obs ~ R_pred 2022-2026",
           "value": r, "ci": fisher_ci(r, n) if not missing else None, "rule": RULE,
           "passed": None, "status": "run", "notes": ""}
    if missing:
        row.update(status="not_run", notes=f"missing inputs: {', '.join(missing)}")
        return row
    clause_phys = bool(r > 0 and p < alpha)
    clause_m3x = bool(m3x > m3)
    row["passed"] = clause_phys and clause_m3x
    row["components"] = {
        "slope": drift.get("slope"), "intercept": drift.get("intercept"),
        "pearson_r": r, "pearson_p": p, "n_months": n,
        "r_ci90_fisher": row["ci"], "slope_ci90": None,
        "clause_physics_r_pos_p_lt_0.10": clause_phys,
        "mdape_M3": m3, "mdape_M3x": m3x, "clause_M3x_worse_than_M3": clause_m3x,
        "R_pred_range": drift.get("R_pred_range"), "R_obs_median": drift.get("R_obs_median"),
        "diurnal_params": params, "diurnal_params_unverified": unverified,
    }
    row["notes"] = (
        f"r={r:.3f} (p={p:.2g}, n={n}), slope={drift.get('slope'):.2f}; "
        f"MdAPE M3x={m3x:.2f}% vs M3={m3:.2f}% (margin {m3x - m3:+.2f} pp). "
        "Slope 90% CI not available in physics_summary.json (only r CI via Fisher z). "
        + (f"Diurnal parameters are placeholders {UNVERIFIED}: the physics clause is conditional "
           "on them." if unverified else ""))
    return row


def _sha(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def main(argv=None) -> dict:
    from pipeline.run.validate_all import data_dir

    ap = argparse.ArgumentParser()
    ap.add_argument("--validation", default="validation_results.json")
    ap.add_argument("--out", default="validation_results_v4.json")
    args = ap.parse_args(argv)
    der = data_dir() / "derived"
    phys_p, val_p = der / "physics" / "physics_summary.json", der / args.validation
    row = evaluate_v4(json.loads(phys_p.read_text()), json.loads(val_p.read_text()))
    payload = {"meta": {"run_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                        "physics_summary_sha256": _sha(phys_p), "validation_sha256": _sha(val_p),
                        "validation_file": args.validation}, "results": [row]}
    (der / args.out).write_text(json.dumps(payload, indent=2, default=str))
    print(json.dumps(row, indent=2, default=str))
    return payload


if __name__ == "__main__":
    main()
