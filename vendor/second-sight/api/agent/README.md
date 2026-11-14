# api/agent: agentic analyst (AI-06)

Science is the engine, AI is the steering wheel. The planner (an LLM, or the
rule-based planner when no key is set) only picks whitelisted tools and their
arguments. The tools in `tools.py` are deterministic and read only the bundle and
pipeline outputs. Templates render the final answer from tool results, and the
number verifier blocks any number that a tool result did not produce.

```
python -m api.agent "Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain" --locale id --trace
python -m api.agent "..." --json        # trace JSON (schema below)
python -m api.agent "..." --no-llm      # force the rule planner
```

Planner selection (`client_from_env`): `AGENT_LLM_PROVIDER` = `anthropic` | `openai` (optional).
- Anthropic: `pip install anthropic`, set `ANTHROPIC_API_KEY`, optional `AGENT_LLM_MODEL` (default `claude-opus-5-5`).
- OpenAI: `pip install openai`, set `OPENAI_API_KEY`, optional `AGENT_OPENAI_MODEL` (default `gpt-4o-mini`).
- No key means the rule-based planner, labelled `rules (no LLM key)` in the trace.

The deterministic scope gate (future/forecast, outside the data, off-topic) runs
before any LLM call, whichever planner is active.

API: `propose(question, locale, llm) -> Plan` (plan chips; editable `steps[].args`),
`execute(plan_or_dict) -> {status, text, verified, untraceable, trace}`, `ask()` runs both,
`trace_to_json(trace, answer)`, `render_trace(trace)`.

## Trace JSON schema (`second-sight.agent-trace/v1`)

```json
{
  "schema": "second-sight.agent-trace/v1",
  "question": "string",
  "planner": "rules (no LLM key) | model:anthropic/<model> | model:openai/<model> | model:fake/scripted",
  "steps": [
    {
      "step_no": 1,
      "actor": "Agen Second Sight | Aturan | Pipeline",
      "t_offset_s": 1.2,
      "engine": "model:<provider/model> | rules | deterministic",
      "kind": "gate | action | handoff | refusal | answer",
      "tool": "month_vs_history | null",
      "title": "short label (id/en)",
      "detail": "verified action summary (never model chain-of-thought)",
      "cited_inputs": {"args": {}, "evidence_ids": ["bundle:<aoi_id>:<YYYY-MM>:<field>"], "untraceable": [], "choices": []},
      "gate_result": {"status": "passed | blocked", "reason": "'' | out_of_scope | ambiguous_input | tool_not_whitelisted | untraceable_numbers | data_unavailable | no_plan_from_model | tool_error: ..."},
      "outcome": "string"
    }
  ],
  "answer": {"status": "answered | refused | needs_confirmation | fallback", "text": "string",
             "verified": true, "untraceable": [], "locale": "id | en"}
}
```

Show steps with `gate_result.status == "blocked"`. A `handoff` step (ambiguous AOI
or missing period) carries `cited_inputs.choices`: the agent asks the user to pick
instead of guessing. Render `t_offset_s` as `+1.2 dtk`.
