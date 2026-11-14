"""Regular lat/lon grid helpers shared by mask, cell-days and aggregation.

A cell at resolution ``res`` degrees is indexed by integer row/column counted from
(-90, -180)::

    iy = floor((lat + 90) / res + EPS),  ix = floor((lon + 180) / res + EPS)
    cell_id = iy * ncols + ix,           ncols = round(360 / res)

``EPS`` guards against float representation errors for points that sit exactly on
a cell edge (e.g. lat = 1.23 at res 0.01). The same formula is used in SQL
(``cell_id_sql``) and Python (``cell_id``) so tests can check both.
"""
from __future__ import annotations

import math

EPS = 1e-7


def ncols(res: float) -> int:
    return round(360 / res)


def cell_id(lat: float, lon: float, res: float) -> int:
    iy = math.floor((lat + 90) / res + EPS)
    ix = math.floor((lon + 180) / res + EPS)
    return iy * ncols(res) + ix


def cell_center(cid: int, res: float) -> tuple[float, float]:
    iy, ix = divmod(cid, ncols(res))
    return (iy + 0.5) * res - 90, (ix + 0.5) * res - 180


def cell_id_sql(lat: str, lon: str, res: float) -> str:
    n = ncols(res)
    return (f"(CAST(floor(({lat} + 90) / {res} + {EPS}) AS BIGINT) * {n}"
            f" + CAST(floor(({lon} + 180) / {res} + {EPS}) AS BIGINT))")


def center_lat_sql(cid: str, res: float) -> str:
    return f"CAST(((({cid}) // {ncols(res)}) + 0.5) * {res} - 90 AS DOUBLE)"


def center_lon_sql(cid: str, res: float) -> str:
    return f"CAST(((({cid}) % {ncols(res)}) + 0.5) * {res} - 180 AS DOUBLE)"
