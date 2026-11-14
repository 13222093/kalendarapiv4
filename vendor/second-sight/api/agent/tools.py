"""Deterministic analyst tools (AI-06). Every number an answer can contain comes
from here: they read only the published bundle / pipeline outputs, never the LLM.

Data location: env SECOND_SIGHT_BUNDLE (default ../second-sight-data/bundle);
ENSO classes from <bundle>/../derived/enso_class.json (pipeline.science.enso output).
"""
from __future__ import annotations

import difflib
import json
import os
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

_DEFAULT_BUNDLE = Path(__file__).resolve().parents[2].parent.parent.parent.parent / "second-sight-data" / "bundle"


def bundle_dir() -> Path:
    env = os.environ.get("SECOND_SIGHT_BUNDLE")
    if env:
        return Path(env)
    for cand in (Path("D:/Lomba/Hackathon/nasa/second-sight-data/bundle"), _DEFAULT_BUNDLE,
                 Path(__file__).resolve().parents[2] / "data" / "bundle"):
        if (cand / "index.json").exists():
            return cand
    return _DEFAULT_BUNDLE


class ToolError(ValueError):
    """Raised for bad arguments / data outside the bundle (agent turns it into a refusal)."""


@lru_cache(maxsize=4)
def _index(root: str) -> dict:
    p = Path(root) / "index.json"
    if not p.exists():
        raise ToolError(f"bundle index not found at {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def index() -> dict:
    return _index(str(bundle_dir()))


@lru_cache(maxsize=16)
def _monthly(root: str, aoi_id: str) -> tuple:
    aoi = {a["aoi_id"]: a for a in _index(root)["aois"]}.get(aoi_id)
    if aoi is None:
        raise ToolError(f"unknown aoi_id {aoi_id!r}")
    return tuple(json.loads((Path(root) / aoi["file"]).read_text(encoding="utf-8")))


def monthly(aoi_id: str) -> list[dict]:
    return list(_monthly(str(bundle_dir()), aoi_id))


def _aoi(aoi_id: str) -> dict:
    for a in index()["aois"]:
        if a["aoi_id"] == aoi_id:
            return a
    raise ToolError(f"unknown aoi_id {aoi_id!r}")


def evid(aoi_id: str, year: int, month: int, field: str) -> str:
    return f"bundle:{aoi_id}:{year:04d}-{month:02d}:{field}"


# ---------------------------------------------------------------- gazetteer
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s).strip()


# Indonesian aliases -> island-region AOI until province AOIs ship in the bundle.
ALIASES: dict[str, str] = {
    "indonesia": "IDN", "nasional": "IDN", "ri": "IDN", "idn": "IDN", "national": "IDN",
    "seluruh indonesia": "IDN", "nusantara": "IDN",
    "kalimantan": "region-kalimantan", "borneo": "region-kalimantan", "kalteng": "region-kalimantan",
    "kalbar": "region-kalimantan", "kalsel": "region-kalimantan", "kaltim": "region-kalimantan",
    "kaltara": "region-kalimantan", "kalimantan tengah": "region-kalimantan",
    "kalimantan barat": "region-kalimantan", "kalimantan selatan": "region-kalimantan",
    "kalimantan timur": "region-kalimantan", "palangkaraya": "region-kalimantan",
    "palangka raya": "region-kalimantan", "pontianak": "region-kalimantan",
    "sumatra": "region-sumatra", "sumatera": "region-sumatra", "riau": "region-sumatra",
    "jambi": "region-sumatra", "sumsel": "region-sumatra", "sumatera selatan": "region-sumatra",
    "sumatra selatan": "region-sumatra", "palembang": "region-sumatra", "pekanbaru": "region-sumatra",
    "aceh": "region-sumatra", "sumut": "region-sumatra", "sumbar": "region-sumatra",
    "lampung": "region-sumatra", "bengkulu": "region-sumatra", "babel": "region-sumatra",
    "ogan komering ilir": "region-sumatra", "oki": "region-sumatra",
    "sulawesi": "region-sulawesi", "celebes": "region-sulawesi", "sulsel": "region-sulawesi",
    "sulteng": "region-sulawesi", "sultra": "region-sulawesi", "sulut": "region-sulawesi",
    "papua": "region-papua", "irian": "region-papua", "merauke": "region-papua",
    "papua selatan": "region-papua", "papua barat": "region-papua",
    "jawa": "region-jnbm", "java": "region-jnbm", "bali": "region-jnbm", "ntt": "region-jnbm",
    "ntb": "region-jnbm", "nusa tenggara": "region-jnbm", "maluku": "region-jnbm",
    "jnbm": "region-jnbm",
}


def resolve_aoi(name: str) -> dict:
    """Fuzzy gazetteer over bundle AOIs + Indonesian aliases. Returns candidates
    sorted by score; empty list means the place is outside the data."""
    q = norm(name or "")
    if not q:
        return {"query": name, "candidates": []}
    aois = {a["aoi_id"]: a for a in index()["aois"]}
    keys: dict[str, str] = {k: v for k, v in ALIASES.items() if v in aois}
    for a in aois.values():
        keys[norm(a["name"])] = a["aoi_id"]
        keys[norm(a["aoi_id"])] = a["aoi_id"]
    scores: dict[str, tuple[float, str]] = {}

    def add(aid: str, sc: float, via: str) -> None:
        if sc > scores.get(aid, (0.0, ""))[0]:
            scores[aid] = (sc, via)

    if q in keys:
        add(keys[q], 1.0, q)
    toks = q.split()
    grams = toks + [" ".join(toks[i:i + 2]) for i in range(len(toks) - 1)] + \
        [" ".join(toks[i:i + 3]) for i in range(len(toks) - 2)]
    for g in grams:
        if g in keys:
            add(keys[g], 0.95, g)
        elif len(g) >= 4:
            for m in difflib.get_close_matches(g, list(keys), n=2, cutoff=0.8):
                add(keys[m], round(0.6 + 0.3 * difflib.SequenceMatcher(None, g, m).ratio(), 3), m)
    cands = [{"aoi_id": aid, "name": aois[aid]["name"], "level": aois[aid]["level"],
              "score": sc, "matched": via,
              "approximate": aois[aid]["level"] != "national" and via not in
              {norm(aois[aid]["name"]), norm(aid)} and ALIASES.get(via) == aid
              and via not in ("borneo", "sumatera", "celebes", "java", "irian", "jawa")}
             for aid, (sc, via) in scores.items()]
    cands.sort(key=lambda c: -c["score"])
    return {"query": name, "candidates": cands}


# ---------------------------------------------------------------- series tools
SERIES = ("H", "H_lo", "H_hi", "A_raw", "T_raw", "V_raw", "N20_raw", "baseline_median")


def _row(aoi_id: str, year: int, month: int) -> dict:
    for r in monthly(aoi_id):
        if r["year"] == year and r["month"] == month:
            return r
    a = _aoi(aoi_id)
    raise ToolError(f"no data for {aoi_id} {year}-{month:02d} (bundle covers {a['first']}..{a['last']})")


def _ym(s: str) -> tuple[int, int]:
    m = re.match(r"^(\d{4})(?:-(\d{1,2}))?$", str(s))
    if not m:
        raise ToolError(f"bad period {s!r}, want YYYY or YYYY-MM")
    return int(m.group(1)), int(m.group(2) or 1)


def get_calendar(aoi_id: str, start: str, end: str, series: str = "H") -> dict:
    if series not in SERIES:
        raise ToolError(f"series must be one of {SERIES}")
    s, e = _ym(start), _ym(end)
    if re.match(r"^\d{4}$", str(end)):
        e = (e[0], 12)
    rows = [r for r in monthly(aoi_id) if s <= (r["year"], r["month"]) <= e]
    if not rows:
        raise ToolError(f"no data for {aoi_id} in {start}..{end}")
    return {"aoi_id": aoi_id, "series": series,
            "values": [{"period": f"{r['year']:04d}-{r['month']:02d}", "value": r.get(series),
                        "evidence_id": evid(aoi_id, r["year"], r["month"], series)} for r in rows]}


def month_vs_history(aoi_id: str, year: int, month: int) -> dict:
    year, month = int(year), int(month)
    r = _row(aoi_id, year, month)
    idx = index()
    b0, b1 = idx.get("baseline_period", [2003, 2022])
    peers = [x for x in monthly(aoi_id) if x["month"] == month and x.get("H") is not None]
    hist = sorted((x["H"] for x in peers if b0 <= x["year"] <= b1))
    h = r["H"]
    pct = None if not hist else round(100.0 * sum(v <= h for v in hist) / len(hist), 1)
    rank = 1 + sum(x["H"] > h for x in peers)
    return {"aoi_id": aoi_id, "aoi_name": _aoi(aoi_id)["name"], "period": f"{year:04d}-{month:02d}",
            "H": h, "H_lo": r.get("H_lo"), "H_hi": r.get("H_hi"),
            "baseline_median": r.get("baseline_median"), "baseline_period": [b0, b1],
            "percentile": pct, "rank": rank, "rank_n": len(peers),
            "sensor_used": r.get("sensor_used"), "flag_nrt": r.get("flag_nrt"),
            "obs_class": r.get("obs_class"), "agreement": r.get("agreement"),
            "evidence_ids": [evid(aoi_id, year, month, f) for f in ("H", "H_lo", "H_hi", "baseline_median")]}


@lru_cache(maxsize=2)
def _enso(root: str) -> dict:
    p = Path(root).parent / "derived" / "enso_class.json"
    if p.exists():
        return {int(y["year"]): y for y in json.loads(p.read_text(encoding="utf-8"))["years"]}
    try:  # pipeline cache (no network: refresh=False reads data/external if present)
        from pipeline.science.enso import load_enso_classes  # type: ignore
        df = load_enso_classes(refresh=False)
        return {int(r["year"]): dict(r) for r in df.to_dict(orient="records")}
    except Exception as exc:  # noqa: BLE001
        raise ToolError(f"ENSO classes unavailable: {exc}") from exc


def compare_enso_analogs(aoi_id: str, year: int, month: int) -> dict:
    year, month = int(year), int(month)
    classes = _enso(str(bundle_dir()))
    me = classes.get(year) or {}
    cls = me.get("enso_class")
    peers = [x for x in monthly(aoi_id) if x["month"] == month and x.get("H") is not None
             and (classes.get(x["year"]) or {}).get("enso_class") == cls and cls is not None]
    peers.sort(key=lambda x: -x["H"])
    target = _row(aoi_id, year, month)
    rank = 1 + sum(x["H"] > target["H"] for x in peers) if cls else None
    return {"aoi_id": aoi_id, "period": f"{year:04d}-{month:02d}", "enso_class": cls,
            "iod_class": me.get("iod_class"), "H": target["H"], "analog_rank": rank,
            "analog_n": len(peers),
            "analogs": [{"year": x["year"], "H": x["H"], "H_lo": x.get("H_lo"), "H_hi": x.get("H_hi"),
                         "iod_class": (classes.get(x["year"]) or {}).get("iod_class"),
                         "evidence_id": evid(aoi_id, x["year"], month, "H")} for x in peers],
            "evidence_ids": [evid(aoi_id, x["year"], month, "H") for x in peers],
            "source": "derived/enso_class.json (ONI JAS >= +0.5 El Nino; <= -0.5 La Nina)"}


def _record(aoi_id: str, year: int, month: int) -> dict:
    mv = month_vs_history(aoi_id, year, month)
    rec = {"aoi_name": mv["aoi_name"], "aoi_type": _aoi(aoi_id)["level"], "period": mv["period"],
           "H": mv["H"], "H_lo": mv["H_lo"], "H_hi": mv["H_hi"],
           "baseline_median": mv["baseline_median"], "baseline_start": mv["baseline_period"][0],
           "baseline_end": mv["baseline_period"][1], "percentile": mv["percentile"],
           "nrt": bool(mv["flag_nrt"]), "sensor": mv["sensor_used"]}
    try:
        an = compare_enso_analogs(aoi_id, year, month)
        if an["enso_class"]:
            rec.update(enso_class=an["enso_class"], analog_rank=an["analog_rank"], analog_n=an["analog_n"])
    except ToolError:
        pass
    return rec


def explain_anomaly(aoi_id: str, year: int, month: int, locale: str = "id") -> dict:
    from api.brief import build_fact_table
    from api.brief.rules import explain
    ft = build_fact_table(_record(aoi_id, int(year), int(month)))
    fs = explain(ft)
    return {"aoi_id": aoi_id, "period": ft.period,
            "findings": [{"rule_id": f.rule_id, "severity": f.severity, "text": f.sentence(locale),
                          "citations": f.citations} for f in fs],
            "evidence_ids": [evid(aoi_id, int(year), int(month), "H")]}


def make_brief(aoi_id: str, year: int, month: int, locale: str = "id", fmt: str = "md") -> dict:
    from api.brief import make_brief as _mb
    out = _mb(_record(aoi_id, int(year), int(month)), locale=locale, fmt=fmt)
    out["evidence_ids"] = [evid(aoi_id, int(year), int(month), f) for f in ("H", "baseline_median")]
    return out


# ---------------------------------------------------------------- registry
_AOI = {"type": "string", "description": "AOI id from resolve_aoi, e.g. region-kalimantan"}
_Y = {"type": "integer", "minimum": 2000, "maximum": 2026}
_M = {"type": "integer", "minimum": 1, "maximum": 12}


def _schema(props: dict, req: list[str]) -> dict:
    return {"type": "object", "properties": props, "required": req, "additionalProperties": False}


TOOLS: dict[str, dict[str, Any]] = {
    "resolve_aoi": {"fn": resolve_aoi, "description": "Resolve a place name (Indonesian or English, abbreviations like Kalteng) to AOI candidates in the data bundle.",
                    "schema": _schema({"name": {"type": "string"}}, ["name"])},
    "get_calendar": {"fn": get_calendar, "description": "Monthly harmonized series for an AOI between start and end (YYYY or YYYY-MM).",
                     "schema": _schema({"aoi_id": _AOI, "start": {"type": "string"}, "end": {"type": "string"},
                                        "series": {"type": "string", "enum": list(SERIES)}}, ["aoi_id", "start", "end"])},
    "month_vs_history": {"fn": month_vs_history, "description": "One month's harmonized value, 90% interval, baseline median, percentile and rank among the same calendar month.",
                         "schema": _schema({"aoi_id": _AOI, "year": _Y, "month": _M}, ["aoi_id", "year", "month"])},
    "compare_enso_analogs": {"fn": compare_enso_analogs, "description": "Compare a month with the same month in other years of the same ENSO class (El Nino / La Nina / neutral).",
                             "schema": _schema({"aoi_id": _AOI, "year": _Y, "month": _M}, ["aoi_id", "year", "month"])},
    "explain_anomaly": {"fn": explain_anomaly, "description": "Rule-based explanation (sensor change, NRT, ENSO, spike) for a month.",
                        "schema": _schema({"aoi_id": _AOI, "year": _Y, "month": _M,
                                           "locale": {"type": "string", "enum": ["id", "en"]}}, ["aoi_id", "year", "month"])},
    "make_brief": {"fn": make_brief, "description": "Verified alert brief for a month (template rendered, numbers traced).",
                   "schema": _schema({"aoi_id": _AOI, "year": _Y, "month": _M,
                                      "locale": {"type": "string", "enum": ["id", "en"]}}, ["aoi_id", "year", "month"])},
}


def call_tool(name: str, args: dict) -> dict:
    if name not in TOOLS:
        raise ToolError(f"tool {name!r} is not whitelisted")
    fn: Callable[..., dict] = TOOLS[name]["fn"]
    allowed = set(TOOLS[name]["schema"]["properties"])
    bad = set(args) - allowed
    if bad:
        raise ToolError(f"unexpected args for {name}: {sorted(bad)}")
    return fn(**args)


def tool_specs() -> list[dict]:
    """Provider-neutral specs: name, description, JSON schema."""
    return [{"name": n, "description": t["description"], "input_schema": t["schema"]} for n, t in TOOLS.items()]
