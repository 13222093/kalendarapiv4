"""Agentic analyst (AI-06): science is the engine, the LLM only steers.

The LLM (or the rule-based planner when no key is set) proposes which
whitelisted tools to call. Tools are deterministic; the final answer is rendered
by templates from tool results and every number in it is checked against the
values those tools returned (untraceable -> blocked, template fallback/refusal).
No chain-of-thought is recorded: the trace holds verified action summaries only.
"""
from __future__ import annotations

import difflib
import json
import os
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Protocol

from api.brief.fmt import fmt_num

from . import tools as T

MAX_STEPS = 6
ACTOR_AGENT, ACTOR_RULES, ACTOR_PIPE = "Agen Second Sight", "Aturan", "Pipeline"

MONTHS = {
    1: ["januari", "january", "jan"], 2: ["februari", "february", "feb", "pebruari"],
    3: ["maret", "march", "mar"], 4: ["april", "apr"], 5: ["mei", "may"],
    6: ["juni", "june", "jun"], 7: ["juli", "july", "jul"],
    8: ["agustus", "august", "agu", "agt", "aug", "agust"],
    9: ["september", "sept", "sep"], 10: ["oktober", "october", "okt", "oct"],
    11: ["november", "nov", "nop", "nopember"], 12: ["desember", "december", "des", "dec"],
}
_MWORDS = {w: m for m, ws in MONTHS.items() for w in ws}
MONTH_NAME = {"id": ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
                     "September", "Oktober", "November", "Desember"],
              "en": ["", "January", "February", "March", "April", "May", "June", "July", "August",
                     "September", "October", "November", "December"]}

RE_FUTURE = re.compile(r"\b(predik\w*|ramal\w*|forecast\w*|predict\w*|proyeksi|akan datang|masa depan|future|tahun depan|next year)\b")
RE_OFFTOPIC = re.compile(r"\b(saham|stock|crypto|bitcoin|resep|recipe|cuaca besok|weather tomorrow|politik|pemilu|siapa presiden|harga)\b")
INTENTS = [
    ("compare_enso_analogs", re.compile(r"el ?nin|la ?nin|enso|analog|tahun.{0,12}(kering|serupa|mirip)|similar years")),
    ("make_brief", re.compile(r"\b(brief|ringkasan|laporan|siaga|summary|report|buatkan|bikin)\b")),
    ("explain_anomaly", re.compile(r"\b(kenapa|mengapa|knp|why|explain|jelaskan|penyebab|sebab|alasan|anomali)\b")),
    ("get_calendar", re.compile(r"\b(tren|trend|kalender|calendar|deret|series|sepanjang|time ?series|grafik|bulanan|tiap bulan|each month)\b")),
]


# ------------------------------------------------------------------ trace
@dataclass
class Step:
    step_no: int
    actor: str
    t_offset_s: float
    engine: str
    title: str
    detail: str
    cited_inputs: dict
    gate_result: dict
    outcome: str
    kind: str = "action"          # action | gate | handoff | refusal | answer
    tool: str | None = None


@dataclass
class Trace:
    question: str
    planner: str
    steps: list[Step] = field(default_factory=list)
    t0: float = field(default_factory=time.monotonic)

    def add(self, actor: str, engine: str, title: str, detail: str = "", cited: dict | None = None,
            passed: bool = True, reason: str = "", outcome: str = "", kind: str = "action",
            tool: str | None = None) -> Step:
        s = Step(len(self.steps) + 1, actor, round(time.monotonic() - self.t0, 2), engine, title,
                 detail, cited or {}, {"status": "passed" if passed else "blocked", "reason": reason},
                 outcome, kind, tool)
        self.steps.append(s)
        return s


def trace_to_json(trace: Trace, answer: dict | None = None, indent: int | None = 2) -> str:
    d = {"schema": "second-sight.agent-trace/v1", "question": trace.question, "planner": trace.planner,
         "steps": [asdict(s) for s in trace.steps]}
    if answer is not None:
        d["answer"] = {k: answer.get(k) for k in ("status", "text", "verified", "untraceable", "locale")}
    return json.dumps(d, ensure_ascii=False, indent=indent, default=str)


def render_trace(trace: Trace) -> str:
    out = [f"Planner: {trace.planner}"]
    for s in trace.steps:
        gate = "OK" if s.gate_result["status"] == "passed" else f"BLOCKED ({s.gate_result['reason']})"
        out.append(f"[{s.step_no:>2}] +{s.t_offset_s:.1f} dtk  {s.actor:<18} {s.engine:<28} {s.kind.upper():<8} {s.title}")
        if s.detail:
            out.append(f"      {s.detail}")
        if s.cited_inputs:
            out.append(f"      inputs: {json.dumps(s.cited_inputs, ensure_ascii=False, default=str)[:240]}")
        out.append(f"      gate: {gate}  ->  {s.outcome}")
    return "\n".join(out)


# ------------------------------------------------------------------ plans
@dataclass
class PlanStep:
    tool: str
    args: dict
    label: str = ""
    editable: bool = True


@dataclass
class Plan:
    question: str
    locale: str
    status: str                     # ready | refused | needs_confirmation
    steps: list[PlanStep] = field(default_factory=list)
    message: str = ""               # refusal / handoff text
    choices: list[dict] = field(default_factory=list)
    engine: str = "rules"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Plan":
        d = dict(d)
        d["steps"] = [PlanStep(**s) for s in d.get("steps", [])]
        return cls(**d)

    def signature(self) -> list[tuple]:
        keys = ("aoi_id", "year", "month", "start", "end")
        return [(s.tool, tuple((k, s.args[k]) for k in keys if k in s.args)) for s in self.steps]


# ------------------------------------------------------------------ LLM clients
class LLMClient(Protocol):
    name: str

    def plan(self, messages: list[dict], tools: list[dict]) -> list[dict]:
        """Return tool calls [{"id", "name", "args"}]; empty list = done."""


SYSTEM = ("You plan analyses of Indonesian fire-hotspot statistics (harmonized MODIS/VIIRS, 2000-11..2025-12). "
          "Only call the given tools. First call resolve_aoi for the place, then one analysis tool. "
          "Never state numbers yourself. If the question is out of scope (future predictions, places "
          "outside Indonesia, non-fire topics), call no tool.")


class AnthropicClient:
    """Anthropic Messages API tool use. Key: ANTHROPIC_API_KEY; model: AGENT_LLM_MODEL."""

    def __init__(self, model: str | None = None):
        import anthropic  # type: ignore  # optional dependency
        self.client = anthropic.Anthropic()
        self.model = model or os.environ.get("AGENT_LLM_MODEL", "claude-opus-5-5")
        self.name = f"model:anthropic/{self.model}"

    def plan(self, messages: list[dict], tools: list[dict]) -> list[dict]:
        msgs: list[dict] = []
        for m in messages:
            if m["role"] == "user":
                msgs.append({"role": "user", "content": m["content"]})
            elif m["role"] == "calls":
                msgs.append({"role": "assistant", "content": m.get("raw") or [
                    {"type": "tool_use", "id": c["id"], "name": c["name"], "input": c["args"]} for c in m["calls"]]})
            elif m["role"] == "results":
                msgs.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": r["id"], "content": r["content"],
                     "is_error": r.get("is_error", False)} for r in m["results"]]})
        resp = self.client.messages.create(
            model=self.model, max_tokens=4000, system=SYSTEM, output_config={"effort": "low"},
            tools=[{"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
                   for t in tools],
            tool_choice={"type": "auto"}, messages=msgs)
        if resp.stop_reason == "refusal":
            return []
        calls = [{"id": b.id, "name": b.name, "args": dict(b.input)} for b in resp.content if b.type == "tool_use"]
        self.last_raw = [b.model_dump(exclude_none=True) for b in resp.content]  # replay thinking + tool_use unchanged
        return calls


class OpenAIClient:
    """OpenAI chat-completions function calling. Key: OPENAI_API_KEY; model: AGENT_OPENAI_MODEL."""

    def __init__(self, model: str | None = None):
        import openai  # type: ignore  # optional dependency
        self.client = openai.OpenAI()
        self.model = model or os.environ.get("AGENT_OPENAI_MODEL", "gpt-4o-mini")
        self.name = f"model:openai/{self.model}"

    def plan(self, messages: list[dict], tools: list[dict]) -> list[dict]:
        msgs: list[dict] = [{"role": "system", "content": SYSTEM}]
        for m in messages:
            if m["role"] == "user":
                msgs.append({"role": "user", "content": m["content"]})
            elif m["role"] == "calls":
                msgs.append({"role": "assistant", "content": None, "tool_calls": [
                    {"id": c["id"], "type": "function",
                     "function": {"name": c["name"], "arguments": json.dumps(c["args"])}} for c in m["calls"]]})
            elif m["role"] == "results":
                msgs += [{"role": "tool", "tool_call_id": r["id"], "content": r["content"]} for r in m["results"]]
        resp = self.client.chat.completions.create(
            model=self.model, messages=msgs,
            tools=[{"type": "function", "function": {"name": t["name"], "description": t["description"],
                                                     "parameters": t["input_schema"]}} for t in tools])
        tc = resp.choices[0].message.tool_calls or []
        return [{"id": c.id, "name": c.function.name, "args": json.loads(c.function.arguments or "{}")} for c in tc]


class FakeLLM:
    """Scripted client for tests: returns queued tool-call batches in order."""

    def __init__(self, script: list[list[dict]], name: str = "model:fake/scripted"):
        self.script, self.name, self.seen = list(script), name, []

    def plan(self, messages: list[dict], tools: list[dict]) -> list[dict]:
        self.seen.append(list(messages))
        batch = self.script.pop(0) if self.script else []
        return [{"id": c.get("id", f"c{i}"), "name": c["name"], "args": c.get("args", {})} for i, c in enumerate(batch)]


def client_from_env() -> LLMClient | None:
    prov = os.environ.get("AGENT_LLM_PROVIDER", "").lower()
    try:
        if (prov in ("", "anthropic")) and os.environ.get("ANTHROPIC_API_KEY"):
            return AnthropicClient()
        if (prov in ("", "openai")) and os.environ.get("OPENAI_API_KEY"):
            return OpenAIClient()
    except ImportError:
        return None
    return None


# ------------------------------------------------------------------ rule planner
def _norm(q: str) -> str:
    return T.norm(q)


def parse_period(q: str) -> tuple[int | None, int | None, list[int]]:
    n = _norm(q)
    years = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", n)]
    month = None
    for tok in n.split():
        if tok in _MWORDS:
            month = _MWORDS[tok]
            break
        if len(tok) >= 5 and not tok.isdigit():
            m = difflib.get_close_matches(tok, [w for w in _MWORDS if len(w) >= 5], n=1, cutoff=0.8)
            if m:
                month = _MWORDS[m[0]]
                break
    mm = re.search(r"\b(20\d\d)-(\d{1,2})\b", q) or re.search(r"\b(\d{1,2})/(20\d\d)\b", q)
    if month is None and mm:
        a, b = mm.groups()
        month = int(b) if len(a) == 4 else int(a)
    return (years[0] if years else None), month, years


def _intent(n: str) -> str:
    for tool, rx in INTENTS:
        if rx.search(n):
            return tool
    return "month_vs_history"


def _refuse(question: str, locale: str, why_id: str, why_en: str) -> Plan:
    msg = why_id if locale == "id" else why_en
    return Plan(question, locale, "refused", message=msg)


def rule_plan(question: str, locale: str = "id") -> Plan:
    n = _norm(question)
    year, month, years = parse_period(question)
    idx = T.index()
    last = max(a["last"] for a in idx["aois"])
    ly, lm = int(last[:4]), int(last[5:7])
    if RE_FUTURE.search(n) or (year and (year, month or 1) > (ly, lm)):
        return _refuse(question, locale,
                       f"Maaf, Second Sight hanya menganalisis data historis sampai {MONTH_NAME['id'][lm]} {ly}; kami tidak membuat prediksi.",
                       f"Sorry, Second Sight only analyses historical data up to {MONTH_NAME['en'][lm]} {ly}; it does not forecast.")
    if RE_OFFTOPIC.search(n):
        return _refuse(question, locale, "Maaf, pertanyaan ini di luar cakupan Second Sight (statistik titik panas kebakaran Indonesia).",
                       "Sorry, this is outside Second Sight's scope (Indonesian fire-hotspot statistics).")
    if year and year < 2000 or (year == 2000 and (month or 12) < 11):
        return _refuse(question, locale, "Maaf, data Second Sight dimulai November 2000.",
                       "Sorry, Second Sight data starts in November 2000.")
    cands = T.resolve_aoi(question)["candidates"]
    if not cands:
        return _refuse(question, locale, "Maaf, wilayah tersebut tidak ada dalam data Second Sight (Indonesia dan 5 wilayah pulau).",
                       "Sorry, that area is not in the Second Sight data (Indonesia and 5 island regions).")
    top = cands[0]
    rivals = [c for c in cands[1:] if c["score"] >= top["score"] - 0.05 and c["aoi_id"] != top["aoi_id"]
              and c["level"] != "national"]
    if top["level"] == "national" and len(cands) > 1:   # "Riau, Indonesia" -> the specific one
        top, rivals = cands[1], []
    resolve = PlanStep("resolve_aoi", {"name": top["matched"]}, "Cari wilayah" if locale == "id" else "Resolve area", False)
    if rivals:
        return Plan(question, locale, "needs_confirmation", [resolve],
                    message=("Wilayah mana yang dimaksud?" if locale == "id" else "Which area do you mean?"),
                    choices=[top] + rivals)
    intent = _intent(n)
    aoi = top["aoi_id"]
    if intent == "get_calendar" or (year and month is None and len(set(years)) >= 1 and intent == "month_vs_history"):
        ys = sorted(set(years)) or [ly]
        args = {"aoi_id": aoi, "start": f"{ys[0]}-{month or 1:02d}" if month else str(ys[0]),
                "end": f"{ys[-1]}-{month:02d}" if month and len(ys) > 1 else str(ys[-1])}
        if month and len(ys) == 1:
            args = {"aoi_id": aoi, "start": str(ys[0]), "end": str(ys[0])}
        return Plan(question, locale, "ready", [resolve, PlanStep("get_calendar", args, "Deret bulanan")])
    if not year or not month:
        return Plan(question, locale, "needs_confirmation", [resolve],
                    message=("Bulan dan tahun berapa yang dimaksud? (data 2000-11 s.d. %s)" % last if locale == "id"
                             else "Which month and year? (data 2000-11 to %s)" % last))
    args: dict[str, Any] = {"aoi_id": aoi, "year": year, "month": month}
    if intent in ("make_brief", "explain_anomaly"):
        args["locale"] = locale
    label = {"compare_enso_analogs": "Banding tahun ENSO", "make_brief": "Brief terverifikasi",
             "explain_anomaly": "Penjelasan aturan", "month_vs_history": "Banding riwayat"}[intent]
    steps = [resolve, PlanStep(intent, args, label)]
    if intent == "explain_anomaly":   # show the number being explained, then the rules
        steps.insert(1, PlanStep("month_vs_history", {"aoi_id": aoi, "year": year, "month": month}, "Banding riwayat"))
    return Plan(question, locale, "ready", steps)


# ------------------------------------------------------------------ agent
def _summ(name: str, res: dict) -> str:
    if name == "resolve_aoi":
        return ", ".join(f"{c['aoi_id']} ({c['score']})" for c in res["candidates"][:3]) or "no match"
    if name == "get_calendar":
        return f"{len(res['values'])} months"
    if name == "compare_enso_analogs":
        return f"class={res['enso_class']} rank={res['analog_rank']}/{res['analog_n']}"
    if name == "month_vs_history":
        return f"H={res['H']} rank={res['rank']}/{res['rank_n']}"
    if name == "make_brief":
        return f"verified={res['verified']}"
    return f"{len(res.get('findings', []))} findings"


def propose(question: str, locale: str = "id", llm: LLMClient | None = None,
            trace: Trace | None = None) -> Plan:
    """Plan chips: proposed steps, editable by the user before execute()."""
    trace = trace or Trace(question, llm.name if llm else "rules")
    pre = rule_plan(question, locale)   # deterministic scope gate always runs first
    trace.add(ACTOR_RULES, "rules", "Gerbang cakupan" if locale == "id" else "Scope gate",
              cited={"question": question}, passed=pre.status != "refused",
              reason="out_of_scope" if pre.status == "refused" else "",
              outcome=pre.message or "in scope", kind="gate")
    if pre.status == "refused" or llm is None:
        if pre.status == "ready":
            trace.add(ACTOR_AGENT, "rules", "Rencana diusulkan" if locale == "id" else "Plan proposed",
                      detail=" -> ".join(s.tool for s in pre.steps), cited={"steps": [asdict(s) for s in pre.steps]},
                      outcome="ready")
        return pre
    msgs: list[dict] = [{"role": "user", "content": question}]
    steps: list[PlanStep] = []
    for _ in range(MAX_STEPS):
        calls = llm.plan(msgs, T.tool_specs())
        if not calls:
            break
        results, deferred = [], False
        for c in calls:
            if c["name"] not in T.TOOLS:
                trace.add(ACTOR_AGENT, llm.name, f"Tool ditolak: {c['name']}", cited={"args": c["args"]},
                          passed=False, reason="tool_not_whitelisted", outcome="skipped", kind="gate")
                results.append({"id": c["id"], "content": "error: tool not allowed", "is_error": True})
                continue
            steps.append(PlanStep(c["name"], c["args"], c["name"], c["name"] != "resolve_aoi"))
            if c["name"] == "resolve_aoi":
                try:
                    r = T.call_tool("resolve_aoi", c["args"])
                    results.append({"id": c["id"], "content": json.dumps(r)})
                except T.ToolError as e:
                    results.append({"id": c["id"], "content": f"error: {e}", "is_error": True})
            else:
                deferred = True
                results.append({"id": c["id"], "content": "queued for user-approved execution"})
        msgs += [{"role": "calls", "calls": calls, "raw": getattr(llm, "last_raw", None)}, {"role": "results", "results": results}]
        if deferred:
            break
    if not any(s.tool != "resolve_aoi" for s in steps):
        trace.add(ACTOR_AGENT, llm.name, "Model tidak mengusulkan analisis", passed=False,
                  reason="no_plan_from_model", outcome="fallback to rule plan", kind="gate")
        return pre
    plan = Plan(question, locale, "ready", steps, engine=llm.name)
    trace.add(ACTOR_AGENT, llm.name, "Rencana diusulkan" if locale == "id" else "Plan proposed",
              detail=" -> ".join(s.tool for s in steps), cited={"steps": [asdict(s) for s in steps]}, outcome="ready")
    return plan


class Allowed:
    """Collects every formatted number that came from a tool result."""

    def __init__(self, locale: str):
        self.loc, self.tokens = locale, set()

    def n(self, x: Any, d: int = 0) -> str:
        s = fmt_num(float(x), self.loc, decimals=d) if x is not None else "-"
        self.tokens.add(s)
        return s

    def raw(self, x: Any) -> str:
        s = str(x)
        self.tokens.add(s)
        return s


def untraceable(text: str, allowed: Allowed) -> list[str]:
    nums = re.findall(r"\d[\d.,]*\d|\d", re.sub(r"\[\^\d+\]", "", text))
    return [x for x in nums if x.rstrip(".,") not in allowed.tokens]


def _render(results: list[tuple[str, dict]], loc: str) -> tuple[str, Allowed]:
    A = Allowed(loc)
    mn = MONTH_NAME[loc]
    out: list[str] = []
    for name, r in results:
        if name == "month_vs_history":
            y, m = int(r["period"][:4]), int(r["period"][5:7])
            b0, b1 = r["baseline_period"]
            if loc == "id":
                out.append(f"{mn[m]} {A.raw(y)} di {r['aoi_name']}: {A.n(r['H'])} hari-sel api (rentang "
                           f"{A.n(r['H_lo'])}-{A.n(r['H_hi'])}), median {A.raw(b0)}-{A.raw(b1)} {A.n(r['baseline_median'])}; "
                           f"peringkat {A.raw(r['rank'])} dari {A.raw(r['rank_n'])} {mn[m]}.")
            else:
                out.append(f"{mn[m]} {A.raw(y)} in {r['aoi_name']}: {A.n(r['H'])} fire cell-days (range "
                           f"{A.n(r['H_lo'])}-{A.n(r['H_hi'])}), {A.raw(b0)}-{A.raw(b1)} median {A.n(r['baseline_median'])}; "
                           f"rank {A.raw(r['rank'])} of {A.raw(r['rank_n'])} {mn[m]}s.")
        elif name == "compare_enso_analogs":
            y, m = int(r["period"][:4]), int(r["period"][5:7])
            cls = (r["enso_class"] or "netral").replace("_", " ").replace("el nino", "El Nino").replace("la nina", "La Nina")
            if not r["enso_class"]:
                out.append(f"Kelas ENSO {A.raw(y)} tidak tersedia." if loc == "id" else f"ENSO class for {A.raw(y)} unavailable.")
                continue
            peers = "; ".join(f"{A.raw(a['year'])}: {A.n(a['H'])}" for a in r["analogs"])
            out.append((f"{mn[m]} {A.raw(y)} ({cls}) peringkat {A.raw(r['analog_rank'])} dari {A.raw(r['analog_n'])} "
                        f"tahun {cls} untuk {mn[m]}. Tahun pembanding: {peers}.") if loc == "id" else
                       (f"{mn[m]} {A.raw(y)} ({cls}) ranks {A.raw(r['analog_rank'])} of {A.raw(r['analog_n'])} "
                        f"{cls} years for {mn[m]}. Analog years: {peers}."))
        elif name == "get_calendar":
            vals = [v for v in r["values"] if v["value"] is not None]
            if vals:
                top = max(vals, key=lambda v: v["value"])
                p = top["period"]
                out.append((f"{A.raw(len(r['values']))} bulan {r['aoi_id']} ({r['series']}); tertinggi "
                            f"{mn[int(p[5:7])]} {A.raw(int(p[:4]))}: {A.n(top['value'])}.") if loc == "id" else
                           (f"{A.raw(len(r['values']))} months of {r['aoi_id']} ({r['series']}); peak "
                            f"{mn[int(p[5:7])]} {A.raw(int(p[:4]))}: {A.n(top['value'])}."))
        elif name == "explain_anomaly":
            fs = r["findings"]
            if not fs:
                out.append("Tidak ada aturan penjelas yang terpicu." if loc == "id" else "No explanatory rule fired.")
            for f in fs:
                for tok in re.findall(r"\d[\d.,]*\d|\d", f["text"]):
                    A.tokens.add(tok.rstrip(".,"))      # rule sentences come from api.brief.rules (verified there)
                out.append(f"- {f['text']}")
        elif name == "make_brief":
            for tok in re.findall(r"\d[\d.,]*\d|\d", r["text"]):
                if r["verified"]:
                    A.tokens.add(tok.rstrip(".,"))      # verified by api.brief.verify
            out.append(r["text"])
    return "\n".join(out), A


def execute(plan: Plan | dict, trace: Trace | None = None) -> dict:
    """Run a (possibly user-edited) plan. Returns {status, text, verified, untraceable, trace}."""
    plan = Plan.from_dict(plan) if isinstance(plan, dict) else plan
    trace = trace or Trace(plan.question, plan.engine)
    loc = plan.locale if plan.locale in ("id", "en") else "id"
    if plan.status == "refused":
        trace.add(ACTOR_AGENT, "rules", "Penolakan sopan" if loc == "id" else "Polite refusal",
                  passed=False, reason="out_of_scope", outcome=plan.message, kind="refusal")
        return {"status": "refused", "text": plan.message, "verified": True, "untraceable": [], "locale": loc, "trace": trace}
    if plan.status == "needs_confirmation":
        trace.add(ACTOR_AGENT, "rules", "Serah ke pengguna" if loc == "id" else "Hand-off to user",
                  detail=plan.message, cited={"choices": plan.choices}, passed=False,
                  reason="ambiguous_input", outcome="awaiting user confirmation", kind="handoff")
        return {"status": "needs_confirmation", "text": plan.message, "choices": plan.choices,
                "verified": True, "untraceable": [], "locale": loc, "trace": trace}
    results: list[tuple[str, dict]] = []
    for s in plan.steps[:MAX_STEPS]:
        try:
            r = T.call_tool(s.tool, s.args)
        except (T.ToolError, TypeError, ValueError) as e:
            trace.add(ACTOR_PIPE, "deterministic", s.tool, cited={"args": s.args}, passed=False,
                      reason=f"tool_error: {e}", outcome="stopped", tool=s.tool)
            msg = (f"Maaf, data tidak tersedia: {e}" if loc == "id" else f"Sorry, data unavailable: {e}")
            trace.add(ACTOR_AGENT, "rules", "Penolakan sopan" if loc == "id" else "Polite refusal",
                      passed=False, reason="data_unavailable", outcome=msg, kind="refusal")
            return {"status": "refused", "text": re.sub(r"\d", "#", msg), "verified": True, "untraceable": [],
                    "locale": loc, "trace": trace}
        trace.add(ACTOR_PIPE, "deterministic", s.tool, detail=_summ(s.tool, r),
                  cited={"args": s.args, "evidence_ids": r.get("evidence_ids", [])[:8]},
                  outcome="ok", tool=s.tool)
        if s.tool != "resolve_aoi":
            results.append((s.tool, r))
    text, allowed = _render(results, loc)
    bad = untraceable(text, allowed)
    trace.add(ACTOR_RULES, "rules", "Verifikasi angka" if loc == "id" else "Number verifier",
              detail=f"{len(allowed.tokens)} traced values", cited={"untraceable": bad},
              passed=not bad, reason="untraceable_numbers" if bad else "",
              outcome="answer released" if not bad else "answer withheld", kind="gate")
    if bad:
        text = ("Maaf, jawaban tidak dapat diverifikasi; silakan lihat grafik di dasbor."
                if loc == "id" else "Sorry, the answer could not be verified; please see the dashboard chart.")
    trace.add(ACTOR_AGENT, "rules", "Jawaban (templat)" if loc == "id" else "Answer (template)",
              outcome="released" if not bad else "fallback", kind="answer")
    return {"status": "answered" if not bad else "fallback", "text": text, "verified": not bad,
            "untraceable": bad, "locale": loc, "trace": trace}


def ask(question: str, locale: str = "id", llm: LLMClient | None = None) -> dict:
    trace = Trace(question, llm.name if llm else "rules (no LLM key)")
    plan = propose(question, locale, llm, trace)
    out = execute(plan, trace)
    out["plan"] = plan.to_dict()
    return out
