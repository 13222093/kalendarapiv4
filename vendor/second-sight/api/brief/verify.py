"""Numeric verifier (core of AI-03 / AI-05). No LLM needed.

Extracts every number from a rendered brief (Markdown, HTML or WhatsApp text;
Indonesian or English number format; percentages; ratios like 3,1×) and checks
that each one matches a value in the fact table within rounding tolerance.
Anything left over is "untraceable" and must block the text.

Not treated as facts (stripped before extraction): evidence IDs (EV-...),
footnote markers, ISO dates (generation date), data version tags (v0.3),
satellite names (NOAA-20), and the fixed citation / data-source strings
from rules.py.
"""
from __future__ import annotations

import html as _html
import re
from dataclasses import dataclass

from .facts import FactTable
from .fmt import norm_locale
from .rules import static_literals

_STRIP = [
    re.compile(r"<style\b.*?</style>", re.S | re.I),
    re.compile(r'<sup class="fn">\d+</sup>'),
    re.compile(r"<[^>]+>"),
]
_NON_FACT = [
    re.compile(r"\bEV-[A-Za-z0-9-]+"),
    re.compile(r"\[\^?\d+\]:?"),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\bv\d+(?:\.\d+)*\b"),
    re.compile(r"\b(?:NOAA|S-NPP|Suomi-NPP|JPSS)-?\d+\b"),
    re.compile(r"\b[A-Z][A-Za-z'-]+ et al\.? \d{4}\b"),
]
_NUM = re.compile(r"(?P<sign>[+\-−])?(?P<num>\d(?:[\d.,]*\d)?)")
_SIGN_OK_BEFORE = set(" \t\n(:[= ") | {""}


# Facts printed with decimals; an integer in the text cannot be traced to them.
DECIMAL_FIELDS = {"ratio_vs_median", "oni", "dmi", "rain_90d_mm_day", "observability",
                  "interval_level", "rain_threshold_mm_day"}


@dataclass
class Number:
    raw: str
    value: float
    tol: float
    pos: int
    match: str | None = None  # fact-table field it was traced to


def _parse(num: str, loc: str) -> tuple[float, int, int]:
    """Return (value, decimals, trailing_zeros_of_integer_part)."""
    thou, dec = (".", ",") if loc == "id" else (",", ".")
    s = num
    # A lone separator followed by exactly 3 digits is a thousands separator.
    if dec in s:
        ip, fp = s.rsplit(dec, 1)
    else:
        ip, fp = s, ""
    ip = ip.replace(thou, "")
    if not ip.isdigit() or (fp and not fp.isdigit()):
        # Mixed/foreign format (e.g. "3.1" inside Indonesian text): fall back.
        alt = num.replace(dec, "\0").replace(thou, "").replace("\0", ".")
        try:
            v = float(alt)
        except ValueError:
            v = float(re.sub(r"[^\d]", "", num) or 0)
        d = len(alt.split(".")[1]) if "." in alt else 0
        return v, d, 0
    v = float(f"{ip}.{fp}" if fp else ip)
    tz = len(ip) - len(ip.rstrip("0")) if not fp and len(ip) >= 4 else 0
    return v, len(fp), tz


def clean_text(text: str) -> str:
    for rx in _STRIP:
        text = rx.sub(" ", text)
    text = _html.unescape(text)
    for lit in static_literals():
        text = text.replace(lit, " ")
    for rx in _NON_FACT:
        text = rx.sub(" ", text)
    return text


def extract_numbers(text: str, locale: str = "id") -> list[Number]:
    loc = norm_locale(locale)
    t = clean_text(text)
    out: list[Number] = []
    for m in _NUM.finditer(t):
        start = m.start()
        before = t[start - 1] if start > 0 else ""
        sign = m.group("sign")
        if sign and before not in _SIGN_OK_BEFORE:
            sign = None  # range dash such as "1.050-1.430" or "ke-95"
        elif not sign and (before.isalnum() or before == "_"):
            continue  # part of an identifier such as "C2" or "H1"
        v, d, tz = _parse(m.group("num"), loc)
        if sign in ("-", "−"):
            v = -v
        tol = 0.5 * 10 ** (-d) if d else 0.5 * 10 ** tz
        out.append(Number(m.group(0), v, tol + 1e-9, start))
    return out


@dataclass
class VerifyResult:
    numbers: list[Number]
    untraceable: list[Number]

    @property
    def ok(self) -> bool:
        return not self.untraceable


def verify_text(text: str, ft: FactTable, locale: str = "id") -> VerifyResult:
    facts = ft.numeric_values()
    nums = extract_numbers(text, locale)
    bad: list[Number] = []
    for n in nums:
        has_dec = n.tol < 0.5
        for name, fv in facts:
            if not has_dec and name in DECIMAL_FIELDS and not float(fv).is_integer():
                continue  # "2" must not be traced to ONI +1.8
            if abs(n.value - fv) <= n.tol:
                n.match = name
                break
        else:
            bad.append(n)
    return VerifyResult(nums, bad)


def untraceable_numbers(text: str, ft: FactTable, locale: str = "id") -> list[str]:
    """Convenience: raw strings of numbers not found in the fact table."""
    return [n.raw for n in verify_text(text, ft, locale).untraceable]
