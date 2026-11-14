"""AI-01 · Fact table for one (AOI, month).

The fact table is the single source of truth for every number that may appear
in a brief, the "Bulan Ini" verdict sentence, or an LLM-written paragraph
("facts-first, LLM-second, verifier-last", doc 08 §3E A2). Every number carries
an evidence ID that is printed as a footnote.

Input: a dict-like monthly record (one row of ``monthly_aoi`` joined with
climate context). Recognised keys (aliases in brackets):

    aoi_name            str    e.g. "KHG Sebangau"                  (required)
    aoi_type            str    "khg" | "kabupaten" | "provinsi" | ...
    period              str    "YYYY-MM"            [month]          (required)
    H                   float  harmonised fire cell-days, Aqua-MODIS scale
                               [h_value]                            (required)
    H_lo, H_hi          float  90% interval bounds  [h_lo, h_hi]
    interval_level      float  default 0.9
    baseline_median     float  median of the same calendar month   (required)
    baseline_start/end  int    default 2003 / 2022 (doc 08 D-10)
    ratio_vs_median     float  computed as H / baseline_median if absent
    percentile          float  0-100, vs the baseline years
    analog_rank         int    rank n among analog years (1 = highest)
    analog_n            int    N analog years
    analog_since        int    first year of the analog set, default 2001
    enso_class          str    "el_nino" | "la_nina" | "neutral"
    oni, dmi            float  ENSO / IOD indices
    rain_90d            float  mean rain over the last 90 days, mm/day
                               [rain_90d_mm_day]
    rain_threshold      float  default 4.0 mm/day (Field et al. 2016)
    observability       float  O = (1 - f_cloud)(1 - f_missing), 0-1  [O]
    obs_class           str    "good" | "partial" | "not_observed"
                               (derived from O if absent; TRI-04 thresholds)
    triangulation       str    "A" | "B" | "C" | None
    nrt                 bool   NRT / provisional data           [provisional]
    sensor_event        str    label if the month coincides with a sensor
                               change/drift date (else derived by rules.py)
    data_version        str    e.g. "v0.3"
    evidence_ids        dict   field -> evidence ID (defaults generated)
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Mapping

OBS_GOOD = 0.6
OBS_PARTIAL = 0.3

# Fields whose numeric value may appear in rendered text, with their evidence key.
NUMERIC_FIELDS = (
    "h_value", "h_lo", "h_hi", "baseline_median", "ratio_vs_median",
    "percentile", "analog_rank", "analog_n", "oni", "dmi", "rain_90d_mm_day",
    "rain_threshold_mm_day", "observability",
)

FACT_TABLE_JSON_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "SecondSightFactTable",
    "type": "object",
    "required": ["aoi_name", "period", "h_value", "baseline_median",
                 "ratio_vs_median", "evidence_ids"],
    "properties": {
        "aoi_name": {"type": "string"},
        "aoi_type": {"type": ["string", "null"]},
        "period": {"type": "string", "pattern": r"^\d{4}-\d{2}$"},
        "unit": {"type": "string"},
        "h_value": {"type": "number"},
        "h_lo": {"type": ["number", "null"]},
        "h_hi": {"type": ["number", "null"]},
        "interval_level": {"type": "number"},
        "baseline_median": {"type": "number"},
        "baseline_start": {"type": "integer"},
        "baseline_end": {"type": "integer"},
        "ratio_vs_median": {"type": ["number", "null"]},
        "percentile": {"type": ["number", "null"], "minimum": 0, "maximum": 100},
        "analog_rank": {"type": ["integer", "null"]},
        "analog_n": {"type": ["integer", "null"]},
        "analog_since": {"type": "integer"},
        "enso_class": {"enum": ["el_nino", "la_nina", "neutral", None]},
        "oni": {"type": ["number", "null"]},
        "dmi": {"type": ["number", "null"]},
        "rain_90d_mm_day": {"type": ["number", "null"]},
        "rain_threshold_mm_day": {"type": "number"},
        "rain_window_days": {"type": "integer"},
        "observability": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
        "obs_class": {"enum": ["good", "partial", "not_observed", None]},
        "triangulation": {"enum": ["A", "B", "C", None]},
        "flags": {"type": "array", "items": {"type": "string"}},
        "sensor_event": {"type": ["string", "null"]},
        "data_version": {"type": ["string", "null"]},
        "evidence_ids": {"type": "object",
                         "additionalProperties": {"type": "string"}},
    },
}


@dataclass
class FactTable:
    aoi_name: str
    period: str
    h_value: float
    baseline_median: float
    aoi_type: str | None = None
    unit: str = "fire_cell_days_aqua_modis_equiv"
    h_lo: float | None = None
    h_hi: float | None = None
    interval_level: float = 0.9
    baseline_start: int = 2003
    baseline_end: int = 2022
    ratio_vs_median: float | None = None
    percentile: float | None = None
    analog_rank: int | None = None
    analog_n: int | None = None
    analog_since: int = 2001
    enso_class: str | None = None
    oni: float | None = None
    dmi: float | None = None
    rain_90d_mm_day: float | None = None
    rain_threshold_mm_day: float = 4.0
    rain_window_days: int = 90
    observability: float | None = None
    obs_class: str | None = None
    triangulation: str | None = None
    flags: list[str] = field(default_factory=list)
    sensor_event: str | None = None
    data_version: str | None = None
    evidence_ids: dict[str, str] = field(default_factory=dict)

    @property
    def year(self) -> int:
        return int(self.period[:4])

    @property
    def provisional(self) -> bool:
        return "nrt_provisional" in self.flags

    def ev(self, name: str) -> str:
        return self.evidence_ids.get(name, "")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_json(self, **kw: Any) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, **kw)

    def numeric_values(self) -> list[tuple[str, float]]:
        """All numbers a brief may legitimately print, with their origin."""
        out: list[tuple[str, float]] = []
        for name in NUMERIC_FIELDS:
            v = getattr(self, name)
            if v is not None:
                out.append((name, float(v)))
        lvl = self.interval_level
        out += [("interval_level", lvl), ("interval_level_pct", lvl * 100),
                ("interval_odds_num", round(lvl * 10)), ("interval_odds_den", 10.0)]
        out += [("period_year", float(self.year)),
                ("baseline_start", float(self.baseline_start)),
                ("baseline_end", float(self.baseline_end)),
                ("analog_since", float(self.analog_since)),
                ("rain_window_days", float(self.rain_window_days))]
        return out


def _first(rec: Mapping[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in rec and rec[k] is not None:
            return rec[k]
    return default


def obs_class_from(o: float | None) -> str | None:
    """TRI-04 thresholds: good >= 0.6, partial 0.3-0.6, not_observed < 0.3."""
    if o is None:
        return None
    if o >= OBS_GOOD:
        return "good"
    if o >= OBS_PARTIAL:
        return "partial"
    return "not_observed"


def _slug(name: str) -> str:
    s = re.sub(r"^(khg|kab\.?|kabupaten|kota|provinsi)\s+", "", name.strip(), flags=re.I)
    return re.sub(r"[^A-Z0-9]+", "", s.upper())[:12] or "AOI"


def evidence_id(aoi_name: str, period: str, field_name: str) -> str:
    """Default evidence ID, e.g. EV-SEBANGAU-202609-H."""
    tag = {"h_value": "H", "h_lo": "HLO", "h_hi": "HHI"}.get(field_name, field_name.upper())
    return f"EV-{_slug(aoi_name)}-{period.replace('-', '')}-{tag}".replace("_", "")


def _num(v: Any) -> float | None:
    return None if v is None else float(v)


def _int(v: Any) -> int | None:
    return None if v is None else int(v)


def build_fact_table(rec: Mapping[str, Any]) -> FactTable:
    """Build a FactTable from a dict-like monthly record (schema above)."""
    aoi = _first(rec, "aoi_name", "aoi")
    period = str(_first(rec, "period", "month"))[:7]
    h = _first(rec, "H", "h_value")
    med = _first(rec, "baseline_median", "median")
    if aoi is None or h is None or med is None or not re.match(r"^\d{4}-\d{2}$", period):
        raise ValueError("record needs aoi_name, period (YYYY-MM), H and baseline_median")
    h, med = float(h), float(med)

    ratio = _first(rec, "ratio_vs_median", "ratio")
    if ratio is None and med > 0:
        ratio = h / med
    obs = _num(_first(rec, "observability", "O"))
    flags = list(_first(rec, "flags", default=[]))
    if _first(rec, "nrt", "provisional", default=False) and "nrt_provisional" not in flags:
        flags.append("nrt_provisional")
    sensor_event = _first(rec, "sensor_event")
    if sensor_event and "sensor_event" not in flags:
        flags.append("sensor_event")
    enso = _first(rec, "enso_class")
    if enso is not None:
        enso = str(enso).lower().replace(" ", "_").replace("ñ", "n").replace("-", "_")

    ft = FactTable(
        aoi_name=str(aoi),
        aoi_type=_first(rec, "aoi_type"),
        period=period,
        h_value=h,
        h_lo=_num(_first(rec, "H_lo", "h_lo")),
        h_hi=_num(_first(rec, "H_hi", "h_hi")),
        interval_level=float(_first(rec, "interval_level", default=0.9)),
        baseline_median=med,
        baseline_start=int(_first(rec, "baseline_start", default=2003)),
        baseline_end=int(_first(rec, "baseline_end", default=2022)),
        ratio_vs_median=_num(ratio),
        percentile=_num(_first(rec, "percentile")),
        analog_rank=_int(_first(rec, "analog_rank")),
        analog_n=_int(_first(rec, "analog_n")),
        analog_since=int(_first(rec, "analog_since", default=2001)),
        enso_class=enso,
        oni=_num(_first(rec, "oni", "ONI")),
        dmi=_num(_first(rec, "dmi", "DMI")),
        rain_90d_mm_day=_num(_first(rec, "rain_90d", "rain_90d_mm_day")),
        rain_threshold_mm_day=float(_first(rec, "rain_threshold", "rain_threshold_mm_day",
                                           default=4.0)),
        observability=obs,
        obs_class=_first(rec, "obs_class") or obs_class_from(obs),
        triangulation=_first(rec, "triangulation"),
        flags=flags,
        sensor_event=sensor_event,
        data_version=_first(rec, "data_version"),
    )
    given = dict(_first(rec, "evidence_ids", default={}))
    for name in NUMERIC_FIELDS + ("enso_class", "obs_class", "triangulation", "flags"):
        if name in given:
            ft.evidence_ids[name] = str(given[name])
        elif getattr(ft, name) not in (None, []):
            ft.evidence_ids[name] = evidence_id(ft.aoi_name, period, name)
    return ft
