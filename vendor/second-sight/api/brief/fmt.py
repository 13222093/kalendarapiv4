"""Locale-aware number and date formatting for briefs (doc 10 §4.4).

id-ID: 12.345 · 3,1× · −0,3     en-GB: 12,345 · 3.1× · −0.3
"""
from __future__ import annotations

import math

MINUS = "−"  # typographic minus, accepted by the verifier

MONTHS = {
    "id": ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
           "Agustus", "September", "Oktober", "November", "Desember"],
    "en": ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"],
}


def norm_locale(locale: str) -> str:
    """Map 'id', 'id-ID', 'en', 'en-GB' to 'id' or 'en'."""
    code = (locale or "id").lower()[:2]
    if code not in ("id", "en"):
        raise ValueError(f"unsupported locale: {locale!r}")
    return code


def round_sig(x: float, sig: int = 3) -> float:
    if x == 0:
        return 0.0
    digits = sig - int(math.floor(math.log10(abs(x)))) - 1
    return round(x, digits)


def fmt_num(x: float, locale: str = "id", decimals: int = 0, sign: bool = False,
            sig: int | None = None) -> str:
    """Format a number for the given locale.

    sig: round values >= 1000 to this many significant figures (doc 10 §4.4:
    2-3 significant figures in running text).
    """
    loc = norm_locale(locale)
    v = float(x)
    if sig and abs(v) >= 1000:
        v = round_sig(v, sig)
    s = f"{abs(v):,.{decimals}f}"
    if loc == "id":
        s = s.replace(",", "\0").replace(".", ",").replace("\0", ".")
    if v < 0 and float(s.replace(".", "").replace(",", "")) != 0:
        s = MINUS + s
    elif sign and v > 0:
        s = "+" + s
    return s


def fmt_ratio(x: float, locale: str = "id") -> str:
    return fmt_num(x, locale, decimals=1) + "×"


def fmt_month(period: str, locale: str = "id") -> str:
    """'2026-09' -> 'September 2026'."""
    year, month = period.split("-")[:2]
    return f"{MONTHS[norm_locale(locale)][int(month) - 1]} {year}"
