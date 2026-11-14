"""AI-04 · Rule-based anomaly explainer (doc 08 §3E A3).

Deterministic, literature-based rules. Each triggered rule yields one
bilingual sentence from a controlled vocabulary ("titik panas/hotspot",
"konsisten dengan/consistent with"; never "disebabkan oleh/caused by") plus
fixed citations. The same findings feed the "Bulan Ini" screen and the brief.
Numbers inside sentences come only from the fact table.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .facts import FactTable
from .fmt import fmt_month, fmt_num

# Fixed citation list. Rules may only cite keys from here.
CITATIONS: dict[str, str] = {
    "field2016": (
        "Field, R. D. et al. 2016. Indonesian fire activity and smoke pollution in "
        "2015 show persistent nonlinear sensitivity to El Niño-induced drought. PNAS."
    ),
    "giglio2016": (
        "Giglio, L., Schroeder, W. & Justice, C. O. 2016. The collection 6 MODIS "
        "active fire detection algorithm and fire products. Remote Sensing of Environment."
    ),
    "schroeder2014": (
        "Schroeder, W. et al. 2014. The New VIIRS 375 m active fire detection data "
        "product: Algorithm description and initial assessment. Remote Sensing of Environment."
    ),
    "firms_nrt": "NASA FIRMS. Near Real-Time (NRT) vs. Standard Processing (SP) data, FAQ.",
}
CITATION_SHORT = {
    "field2016": "Field et al. 2016",
    "giglio2016": "Giglio et al. 2016",
    "schroeder2014": "Schroeder et al. 2014",
    "firms_nrt": "NASA FIRMS NRT FAQ",
}

# Known sensor change / drift dates (doc 11 VAL-04 seam dates, doc 08 D-3/D-8).
KNOWN_SENSOR_EVENTS: dict[str, tuple[str, str]] = {
    "2002-07": ("Aqua-MODIS mulai beroperasi", "Aqua-MODIS starts"),
    "2012-01": ("VIIRS S-NPP mulai dipakai", "VIIRS S-NPP enters the record"),
    "2018-01": ("NOAA-20 VIIRS mulai dipakai", "NOAA-20 VIIRS enters the record"),
    "2022-01": ("awal drift orbit Aqua/Terra", "start of Aqua/Terra orbit drift"),
    "2026-11": ("pergantian S-NPP ke NOAA-20", "switch from S-NPP to NOAA-20"),
}

SPIKE_RATIO = 2.0
SPIKE_PERCENTILE = 90.0
ONI_EL_NINO = 0.5

BANNED_TERMS = {
    "id": ["titik api", "disebabkan oleh", "penyebabnya"],
    "en": ["caused by", "fire point"],
}


@dataclass
class Finding:
    rule_id: str
    severity: str  # "info" | "caution" | "warning"
    text: dict[str, str]  # locale -> sentence (with **bold** numbers)
    citations: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)  # fact-table field names

    def sentence(self, locale: str = "id", with_citation: bool = True) -> str:
        loc = locale[:2]
        s = self.text[loc]
        if with_citation and self.citations:
            s = s.rstrip(".") + " (" + "; ".join(CITATION_SHORT[c] for c in self.citations) + ")."
        return s


def _dp(x: float) -> int:
    return 0 if float(x).is_integer() else 1


def _months_between(a: str, b: str) -> int:
    ya, ma = int(a[:4]), int(a[5:7])
    yb, mb = int(b[:4]), int(b[5:7])
    return abs((ya * 12 + ma) - (yb * 12 + mb))


def sensor_event_for(ft: FactTable, window_months: int = 1) -> tuple[str, str] | None:
    if ft.sensor_event:
        return (ft.sensor_event, ft.sensor_event)
    for date, labels in KNOWN_SENSOR_EVENTS.items():
        if _months_between(ft.period, date) <= window_months:
            return labels
    return None


def is_spike(ft: FactTable) -> bool:
    return ((ft.ratio_vs_median or 0) >= SPIKE_RATIO
            or (ft.percentile or 0) >= SPIKE_PERCENTILE)


def explain(ft: FactTable) -> list[Finding]:
    """Return the findings of every rule that fires, in display order."""
    out: list[Finding] = []
    n = fmt_num

    rain, thr, oni = ft.rain_90d_mm_day, ft.rain_threshold_mm_day, ft.oni
    if rain is not None and oni is not None and rain < thr and oni >= ONI_EL_NINO:
        out.append(Finding(
            "R1_ENSO_DROUGHT", "warning",
            {"id": (f"Hujan {ft.rain_window_days} hari **{n(rain, 'id', 1)} mm/hari**, di bawah "
                    f"ambang {n(thr, 'id', _dp(thr))} mm/hari, dengan ONI **{n(oni, 'id', 1, sign=True)}**: "
                    "konsisten dengan pola kekeringan El Niño."),
             "en": (f"{ft.rain_window_days}-day rain **{n(rain, 'en', 1)} mm/day**, below the "
                    f"{n(thr, 'en', _dp(thr))} mm/day threshold, with ONI **{n(oni, 'en', 1, sign=True)}**: "
                    "consistent with the El Niño drought pattern.")},
            ["field2016"], ["rain_90d_mm_day", "rain_threshold_mm_day", "oni"]))
    elif rain is not None and rain < thr:
        out.append(Finding(
            "R1b_DRY", "caution",
            {"id": (f"Hujan {ft.rain_window_days} hari **{n(rain, 'id', 1)} mm/hari**, di bawah "
                    f"ambang {n(thr, 'id', _dp(thr))} mm/hari: konsisten dengan kondisi kering yang "
                    "meningkatkan peluang titik panas di gambut."),
             "en": (f"{ft.rain_window_days}-day rain **{n(rain, 'en', 1)} mm/day**, below the "
                    f"{n(thr, 'en', _dp(thr))} mm/day threshold: consistent with dry conditions that "
                    "raise the chance of hotspots on peat.")},
            ["field2016"], ["rain_90d_mm_day", "rain_threshold_mm_day"]))

    ev = sensor_event_for(ft)
    if ev and is_spike(ft):
        out.append(Finding(
            "R2_SENSOR_ARTEFACT", "caution",
            {"id": (f"Lonjakan {fmt_month(ft.period, 'id')} bertepatan dengan {ev[0]}: "
                    "kemungkinan artefak sensor; lihat penanda di kalender."),
             "en": (f"The {fmt_month(ft.period, 'en')} spike coincides with {ev[1]}: "
                    "possible sensor artefact; see the calendar marker.")},
            ["schroeder2014"], ["ratio_vs_median"]))

    if ft.obs_class in ("partial", "not_observed"):
        o_id = f" (O = {n(ft.observability, 'id', 2)})" if ft.observability is not None else ""
        o_en = f" (O = {n(ft.observability, 'en', 2)})" if ft.observability is not None else ""
        out.append(Finding(
            "R3_LOW_OBSERVABILITY", "caution",
            {"id": f"Observasi terbatas oleh awan atau asap{o_id}; nilai mungkin terlalu rendah.",
             "en": f"Limited observation due to cloud or smoke{o_en}; value may be underestimated."},
            ["giglio2016"], ["observability"]))

    if ft.provisional:
        out.append(Finding(
            "R4_NRT_PROVISIONAL", "info",
            {"id": "Sementara (data NRT, bisa berubah) sampai data standar (SP) tersedia.",
             "en": "Provisional (near-real-time, may change) until standard (SP) data are available."},
            ["firms_nrt"], []))

    if ft.triangulation == "C":
        out.append(Finding(
            "R5_METHODS_DISAGREE", "caution",
            {"id": "Metode tidak sepakat: baca nilai ini bersama indeks pendamping.",
             "en": "Methods disagree: read this value together with the companion indices."},
            [], ["triangulation"]))
    return out


def check_vocabulary(text: str, locale: str = "id") -> list[str]:
    """Return banned (non-controlled-vocabulary) terms found in text."""
    low = text.lower()
    return [t for t in BANNED_TERMS[locale[:2]] if t in low]


# Data sources printed in every brief (bilingual).
DATA_SOURCES: dict[str, list[str]] = {
    "id": [
        "NASA FIRMS: MODIS C6.1 dan VIIRS 375 m (S-NPP, NOAA-20), arsip standar + NRT",
        "Indeks ONI (NOAA CPC) dan DMI (NOAA PSL)",
        "Curah hujan CHIRPS (UCSB Climate Hazards Center)",
        "Batas KHG (KLHK) dan peta gambut",
    ],
    "en": [
        "NASA FIRMS: MODIS C6.1 and VIIRS 375 m (S-NPP, NOAA-20), standard archive + NRT",
        "ONI (NOAA CPC) and DMI (NOAA PSL) indices",
        "CHIRPS rainfall (UCSB Climate Hazards Center)",
        "KHG boundaries (KLHK) and peat map",
    ],
}


def static_literals() -> list[str]:
    """Fixed reference strings whose digits are labels, not facts (longest first)."""
    lits = (list(CITATIONS.values()) + list(CITATION_SHORT.values())
            + DATA_SOURCES["id"] + DATA_SOURCES["en"])
    return sorted(lits, key=len, reverse=True)
