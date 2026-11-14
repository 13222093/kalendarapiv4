"""DAT-03: Indonesia peatland layer + point labelling (is_peat).

AI-assisted code (see docs/ai_acknowledgement.md).

Primary source (downloadable, verified 2026-11-14):
  GFW "Indonesia peat lands" Feature Service (ArcGIS item d52e0e67ad21401cbf3a2c002599cf58)
  https://gis-gfw.wri.org/arcgis/rest/services/country_data/asia/MapServer/10  (1524 polygons)
  Original data: Ministry of Agriculture (Kementan / BBSDLP) peat map as republished by GFW.
  License: the ArcGIS item has no licenseInfo; GFW open data is generally CC BY 4.0 but this
  is NOT verified for this layer -> recorded as "UNVERIFIED (GFW open data, CC BY 4.0 assumed)".
Fallback: PEATMAP (Xu et al. 2018, Univ. of Leicester, doi:10.25392/leicester.data.7313270).
See pipeline/support/README.md.

CLI:  python -m pipeline.support.peat
"""
from __future__ import annotations

import json
from pathlib import Path

from ._common import http_get, support_dir, write_provenance

LAYER_URL = "https://gis-gfw.wri.org/arcgis/rest/services/country_data/asia/MapServer/10"
LICENSE = "UNVERIFIED (GFW open data portal; CC BY 4.0 assumed; original: Kementan/BBSDLP peat map)"
PAGE = 500


def peat_path() -> Path:
    return support_dir("peat") / "gfw_indonesia_peat_lands.geojson"


def _strip_z(coords):
    if coords and isinstance(coords[0], (int, float)):
        return coords[:2]
    return [_strip_z(c) for c in coords]


def download_peat(max_offset_deg: float = 0.002, force: bool = False) -> Path:
    """Page through the ArcGIS layer as GeoJSON (EPSG:4326), lightly generalised."""
    dest = peat_path()
    if dest.exists() and not force:
        return dest
    feats, offset = [], 0
    while True:
        params = {
            "where": "1=1", "outFields": "objectid", "outSR": 4326, "f": "geojson",
            "returnZ": "false", "returnM": "false", "maxAllowableOffset": max_offset_deg,
            "resultOffset": offset, "resultRecordCount": PAGE, "orderByFields": "objectid",
        }
        page = http_get(LAYER_URL + "/query", params=params, timeout=300).json()
        batch = page.get("features", [])
        for f in batch:
            if f.get("geometry"):
                f["geometry"]["coordinates"] = _strip_z(f["geometry"]["coordinates"])
        feats += batch
        if len(batch) < PAGE:
            break
        offset += PAGE
    dest.write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    write_provenance(dest, source_url=LAYER_URL, license=LICENSE, feature_count=len(feats),
                     notes=f"ArcGIS REST query, maxAllowableOffset={max_offset_deg} deg")
    return dest


def load_peat_geoms(path: Path | None = None) -> list:
    from shapely.geometry import shape
    from shapely.validation import make_valid

    gj = json.loads(Path(path or peat_path()).read_text(encoding="utf-8"))
    out = []
    for f in gj["features"]:
        if f.get("geometry"):
            g = shape(f["geometry"])
            out.append(g if g.is_valid else make_valid(g))
    return out


class PeatLabeler:
    """Fast is_peat lookup for many points using a shapely STRtree."""

    def __init__(self, geoms: list):
        from shapely import STRtree

        self.geoms = geoms
        self.tree = STRtree(geoms)

    def is_peat(self, lats, lons):
        import numpy as np
        import shapely

        pts = shapely.points(np.asarray(lons, float), np.asarray(lats, float))
        hit = np.zeros(len(pts), dtype=bool)
        idx_pt, _ = self.tree.query(pts, predicate="intersects")
        hit[np.unique(idx_pt)] = True
        return hit


def label_peat(lats, lons, path: Path | None = None):
    """Return a boolean numpy array: True where (lat, lon) falls in a peat polygon."""
    return PeatLabeler(load_peat_geoms(path)).is_peat(lats, lons)


if __name__ == "__main__":
    p = download_peat()
    print(p, p.stat().st_size, "bytes", len(load_peat_geoms(p)), "polygons")
