"""AI-06 agent eval: plan exact-match accuracy, untraceable numbers, refusal correctness.

python eval/agent_eval.py [--llm]    # default: rule-based planner (no key, no network)
Writes eval/agent_report.md.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.agent.planner import ask, client_from_env  # noqa: E402

K, S, SL, P, J = "region-kalimantan", "region-sumatra", "region-sulawesi", "region-papua", "region-jnbm"
R, H = "REFUSE", "HANDOFF"


def mv(a, y, m):
    return [("month_vs_history", (("aoi_id", a), ("year", y), ("month", m)))]


def en(a, y, m):
    return [("compare_enso_analogs", (("aoi_id", a), ("year", y), ("month", m)))]


def br(a, y, m):
    return [("make_brief", (("aoi_id", a), ("year", y), ("month", m)))]


def ex(a, y, m):
    return mv(a, y, m) + [("explain_anomaly", (("aoi_id", a), ("year", y), ("month", m)))]


def cal(a, s, e):
    return [("get_calendar", (("aoi_id", a), ("start", s), ("end", e)))]


# (question, locale, expected) ; expected = analysis steps after resolve_aoi, or R / H
CASES = [
    # formal Indonesian
    ("Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain", "id", en(K, 2015, 9)),
    ("Berapa jumlah titik panas di Sumatra pada Agustus 2019?", "id", mv(S, 2019, 8)),
    ("Bagaimana kondisi kebakaran Kalimantan Tengah bulan Oktober 2023 dibanding riwayat?", "id", mv(K, 2023, 10)),
    ("Buatkan brief siaga untuk Riau September 2019", "id", br(S, 2019, 9)),
    ("Mengapa September 2015 di Sumatera Selatan sangat tinggi?", "id", ex(S, 2015, 9)),
    ("Tampilkan tren bulanan Kalimantan sepanjang 2019", "id", cal(K, "2019", "2019")),
    ("Bandingkan Oktober 2006 di Kalimantan dengan tahun El Nino lainnya", "id", en(K, 2006, 10)),
    ("Laporan ringkasan Papua November 2015", "id", br(P, 2015, 11)),
    ("Apakah Sulawesi pada September 2023 lebih tinggi dari median?", "id", mv(SL, 2023, 9)),
    ("Jelaskan anomali Kalimantan Agustus 2019", "id", ex(K, 2019, 8)),
    ("Titik api nasional Indonesia September 2015", "id", mv("IDN", 2015, 9)),
    ("Kondisi Jawa dan Nusa Tenggara Oktober 2019", "id", mv(J, 2019, 10)),
    # abbreviations
    ("Kalteng Sept 2015 vs tahun El Nino", "id", en(K, 2015, 9)),
    ("brief kalbar okt 2023", "id", br(K, 2023, 10)),
    ("sumsel agt 2019 dibanding median", "id", mv(S, 2019, 8)),
    ("knp kalsel sep 2019 tinggi?", "id", ex(K, 2019, 9)),
    ("OKI 2015-09 analog ENSO", "id", en(S, 2015, 9)),
    ("NTT des 2019", "id", mv(J, 2019, 12)),
    ("sulteng 09/2023", "id", mv(SL, 2023, 9)),
    ("RI sept 2023 brief", "id", br("IDN", 2023, 9)),
    # typos
    ("sepetember 2015 kalteng", "id", mv(K, 2015, 9)),
    ("bandingkan septembr 2015 kalimntan dgn el nino", "id", en(K, 2015, 9)),
    ("kebakran sumatra agustsu 2019", "id", mv(S, 2019, 8)),
    ("oktobr 2023 sulawsi", "id", mv(SL, 2023, 10)),
    ("ringkasan papau novembr 2015", "id", br(P, 2015, 11)),
    # mixed English
    ("Compare September 2015 in Kalimantan with other El Nino years", "en", en(K, 2015, 9)),
    ("How did Sumatra do in August 2019 vs history?", "en", mv(S, 2019, 8)),
    ("Why was Riau so high in September 2019?", "en", ex(S, 2019, 9)),
    ("Make a brief for Papua October 2015", "en", br(P, 2015, 10)),
    ("Monthly trend for Sulawesi 2015", "en", cal(SL, "2015", "2015")),
    ("tolong compare kalteng Oct 2023 with El Nino years", "id", en(K, 2023, 10)),
    ("Borneo fires September 2006", "en", mv(K, 2006, 9)),
    # handoff (missing period)
    ("Bagaimana kondisi Riau?", "id", H),
    ("Brief Kalimantan dong", "id", H),
    # out of scope
    ("Prediksi kebakaran Kalimantan tahun 2030", "id", R),
    ("Forecast hotspots in Sumatra next year", "en", R),
    ("Berapa titik api di Thailand September 2015?", "id", R),
    ("Hotspots in Australia December 2019", "en", R),
    ("Harga saham hari ini?", "id", R),
    ("Kalimantan September 1997", "id", R),
    ("Kalimantan September 2027", "id", R),
    ("Ramalkan musim kebakaran Riau berikutnya", "id", R),
    ("Bitcoin price September 2015", "en", R),
]


def run(llm=None) -> tuple[list[dict], dict]:
    rows = []
    for q, loc, exp in CASES:
        out = ask(q, loc, llm)
        plan = out["plan"]
        got_sig = [(s["tool"], tuple((k, s["args"][k]) for k in ("aoi_id", "year", "month", "start", "end")
                                     if k in s["args"])) for s in plan["steps"] if s["tool"] != "resolve_aoi"]
        if exp == R:
            ok = out["status"] == "refused"
        elif exp == H:
            ok = out["status"] == "needs_confirmation"
        else:
            ok = out["status"] == "answered" and got_sig == exp
        rows.append({"q": q, "locale": loc, "expected": exp if isinstance(exp, str) else "plan",
                     "status": out["status"], "ok": ok, "untraceable": out["untraceable"],
                     "got": got_sig, "want": exp})
    n = len(rows)
    plan_rows = [r for r in rows if r["expected"] == "plan"]
    ref_rows = [r for r in rows if r["expected"] == R]
    m = {"n": n, "plan_acc": sum(r["ok"] for r in plan_rows) / len(plan_rows),
         "n_plan": len(plan_rows),
         "refusal_acc": sum(r["ok"] for r in ref_rows) / len(ref_rows), "n_refusal": len(ref_rows),
         "handoff_acc": sum(r["ok"] for r in rows if r["expected"] == H) / max(1, sum(r["expected"] == H for r in rows)),
         "false_refusals": sum(r["status"] == "refused" for r in plan_rows),
         "untraceable_total": sum(len(r["untraceable"]) for r in rows),
         "overall": sum(r["ok"] for r in rows) / n}
    return rows, m


def report(rows, m, planner: str) -> str:
    L = ["# AI-06 agent eval report", "",
         f"**Planner evaluated: {planner}.** No LLM was called unless stated here; numbers come only from",
         "deterministic tools, and the final text is template-rendered and checked by the number verifier.", "",
         f"- Questions: {m['n']} (formal Indonesian, abbreviations, typos, mixed English, hand-off, out-of-scope)",
         f"- Plan exact-match accuracy (tool names + aoi_id/year/month/start/end): "
         f"{m['plan_acc']:.1%} ({m['n_plan']} plan cases)",
         f"- Refusal correctness: {m['refusal_acc']:.1%} ({m['n_refusal']} out-of-scope cases); "
         f"false refusals on in-scope questions: {m['false_refusals']}",
         f"- Hand-off correctness (missing period -> ask user): {m['handoff_acc']:.1%}",
         f"- Untraceable numbers in final answers: {m['untraceable_total']}",
         f"- Overall: {m['overall']:.1%}", "",
         "Caveat: the same author wrote these questions and the rule planner's regexes and aliases, so",
         "this is an in-sample check of the rule planner, not a measure of how it generalises. Use a",
         "held-out set from real BPBD / Manggala Agni questions before quoting accuracy.", "",
         "Reproduce: `python eval/agent_eval.py` (rule planner, offline). `--llm` evaluates the planner",
         "from `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` instead; the result has not been measured yet.", "",
         "| # | ok | status | question | got | expected |", "|---|---|---|---|---|---|"]
    for i, r in enumerate(rows, 1):
        g = "; ".join(f"{t}{dict(a)}" for t, a in r["got"]) or "-"
        w = r["want"] if isinstance(r["want"], str) else "; ".join(f"{t}{dict(a)}" for t, a in r["want"])
        L.append(f"| {i} | {'Y' if r['ok'] else 'N'} | {r['status']} | {r['q']} | {g if r['status'] == 'answered' else '-'} | {w} |")
    return "\n".join(L) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", action="store_true")
    a = ap.parse_args()
    llm = client_from_env() if a.llm else None
    planner = llm.name if llm else "rule-based planner (no LLM key; deterministic)"
    rows, m = run(llm)
    out = Path(__file__).with_name("agent_report.md")
    out.write_text(report(rows, m, planner), encoding="utf-8")
    for r in rows:
        if not r["ok"]:
            print("FAIL", r["q"], r["status"], r["got"], r["want"])
    print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in m.items()})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
