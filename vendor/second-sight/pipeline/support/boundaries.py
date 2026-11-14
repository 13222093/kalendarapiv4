"""DAT-03: Indonesia ADM1/ADM2 boundaries from geoBoundaries.

AI-assisted code (see docs/ai_acknowledgement.md).

Release choice (verified from the geoBoundaries API on 2026-11-14):
  * gbOpen/IDN/ADM1  -> source OpenStreetMap/Wambacher, license **ODbL 1.0**  (NOT used)
  * gbHumanitarian/IDN/ADM1 -> OCHA ROAP / HDX (BPS-derived), **CC BY 3.0 IGO**, 34 units, year 2019
  * gbHumanitarian/IDN/ADM2 -> OCHA ROAP / HDX (BPS-derived), **CC BY 3.0 IGO**, 522 units, year 2019
We use gbHumanitarian so that no ODbL file enters the project. The license is
read from the API metadata at download time and stored in the sidecar.

CLI:  python -m pipeline.support.boundaries
"""
from __future__ import annotations

import json
from pathlib import Path

from ._common import download, http_get, support_dir

API = "https://www.geoboundaries.org/api/current/{release}/IDN/{level}/"
RELEASE = "gbHumanitarian"
# geoBoundaries attribute holding the unit name
NAME_FIELD = "shapeName"


def fetch_metadata(level: str, release: str = RELEASE) -> dict:
    return http_get(API.format(release=release, level=level), timeout=60).json()


def boundary_path(level: str) -> Path:
    return support_dir("boundaries") / f"geoBoundaries-IDN-{level}-{RELEASE}_simplified.geojson"


def download_boundaries(levels=("ADM1", "ADM2"), simplified: bool = True, force: bool = False) -> dict[str, Path]:
    out = {}
    for level in levels:
        meta = fetch_metadata(level)
        lic = meta.get("boundaryLicense", "UNKNOWN")
        if "ODbL" in lic or "Open Database" in lic:
            raise RuntimeError(f"{RELEASE}/{level} is ODbL ({lic}); refusing per DAT-03 rule")
        url = meta["simplifiedGeometryGeoJSON"] if simplified else meta["gjDownloadURL"]
        dest = boundary_path(level) if simplified else boundary_path(level).with_name(
            f"geoBoundaries-IDN-{level}-{RELEASE}.geojson")
        download(url, dest, license=lic, force=force,
                 notes=f"geoBoundaries {RELEASE} IDN {level}; source: {meta.get('boundarySource')}",
                 boundary_id=meta.get("boundaryID"), year_represented=meta.get("boundaryYearRepresented"),
                 unit_count=meta.get("admUnitCount"), api_url=API.format(release=RELEASE, level=level))
        out[level] = dest
    return out


def load_units(path: Path, name_field: str = NAME_FIELD) -> list[tuple[str, object]]:
    """Return [(name, shapely geometry)] from a GeoJSON FeatureCollection."""
    from shapely.geometry import shape

    gj = json.loads(Path(path).read_text(encoding="utf-8"))
    return [(f["properties"].get(name_field), shape(f["geometry"])) for f in gj["features"] if f.get("geometry")]


class PointLabeler:
    """Assign each (lat, lon) to the polygon containing it (STRtree), else None."""

    def __init__(self, units: list[tuple[str, object]]):
        from shapely import STRtree

        self.names = [n for n, _ in units]
        self.geoms = [g for _, g in units]
        self.tree = STRtree(self.geoms)

    def label(self, lats, lons) -> list:
        import numpy as np
        import shapely

        pts = shapely.points(np.asarray(lons, float), np.asarray(lats, float))
        out = [None] * len(pts)
        idx_pt, idx_geom = self.tree.query(pts, predicate="intersects")
        for i, j in zip(idx_pt, idx_geom):
            if out[i] is None:  # first hit wins on shared borders
                out[i] = self.names[j]
        return out


def label_admin(lats, lons, level: str = "ADM1") -> list:
    """Label points with province (ADM1) or regency (ADM2) name."""
    return PointLabeler(load_units(boundary_path(level))).label(lats, lons)


if __name__ == "__main__":
    for lvl, p in download_boundaries().items():
        print(lvl, p, p.stat().st_size, "bytes")
