"""KalenderApi: nationwide mask of mapped peat on the 0.01 degree grid.

Question it serves: is this hot spot on land that the national peat map shows as peat?

It reads the peat polygons that the Central Kalimantan peat index already uses
(data-raw/ss/support/peat/gfw_indonesia_peat_lands.geojson), tests the centre of every 0.01 degree cell against them and
writes the cells whose centre lies inside a polygon, as runs along the rows. The grid is the one of
vendor/second-sight/pipeline/data/grid.py (rows and columns counted from -90, -180), so a cell here is the same cell as
in Second Sight's cell_labels.parquet and in peat_persistence_kalteng.json.

This is a mask of mapped peat, not a fire statistic. No hot spot, no date and no fire file is read. The only other data
file opened is peat_persistence_kalteng.json, for the coordinates of the sites it lists (check 3 below); that file holds
no 2019 season, and no file with 2019 in its name is opened.

Deterministic: the same polygons give the same runs ("runs_sha256" in the output). Only "generated_at" changes.

Checks, each of which stops the run with an error:
1. the polygon file has the sha256 recorded in its .source.json;
2. the cell arithmetic here gives the same cell and the same centre as grid.py of Second Sight;
3. every peat site listed in peat_persistence_kalteng.json is in the mask;
4. a recount with the other method (a tree of all cell centres of the box, queried with each polygon, as in
   build_peat_persistence.py) gives exactly the same cells;
5. the written file, read back and decoded, gives exactly the same cells, and "cells" equals their number.

Output
- <ka_data_dir>/peat_mask_idn.json

Usage (venv python of docs/DATA.md section 2: numpy, shapely), from the repository root or anywhere else
  python -I pipeline/peat/build_peat_mask_idn.py [<peat_geojson> <ka_data_dir>]
"""
import gzip
import hashlib
import importlib.util
import json
import math
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np
import shapely
from shapely.geometry import shape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PEAT_DEFAULT = os.path.join(ROOT, 'data-raw', 'ss', 'support', 'peat', 'gfw_indonesia_peat_lands.geojson')
KA_DEFAULT = os.path.join(ROOT, 'app', 'public', 'ka-data')
GRID_PY = os.path.join(ROOT, 'vendor', 'second-sight', 'pipeline', 'data', 'grid.py')

LOCKED = 2019                     # a registered test locks that season; nothing of it is needed or opened here
FORMAT = 'ka-peat-mask-1'
RES = 0.01                        # cell size in degrees
COLS = 36000                      # columns of the global grid at 0.01 degree
ROWS = 18000
EPS = 1e-7                        # as in grid.py: a point exactly on a cell edge goes to the cell above / to the east
BAND = 64                         # rows per step of the recount

RULE = ('A cell of 0.01 degree (about 1.1 km) is in the mask when its centre lies inside a polygon of the peat map; '
        'a place is "on mapped peat" when the cell it falls in is in the mask.')
KEY = ('row = floor((lat + 90) / 0.01 + 1e-7), column = floor((lon + 180) / 0.01 + 1e-7), '
       'cell = row * 36000 + column; the centre of a cell is ((row + 0.5) * 0.01 - 90, (column + 0.5) * 0.01 - 180).')
ENCODING = ('"runs" is a flat list of pairs. Each pair is one run of neighbouring cells in a row: the first number is '
            'the cell number of the first cell minus that of the first cell of the run before (for the first run, the '
            'cell number itself), the second is how many cells the run has. Runs are in rising order and do not touch.')
LIMITATION = ('The test is made at the centre of a 0.01 degree cell, on a map drawn at 1:250,000 and downloaded with a '
              'generalisation of 0.002 degree (about 220 m), so a place near the edge of a peat area can be tagged '
              'wrongly. The map is the 2011 national map; it says where peat was mapped, not how deep it is or what '
              'state it is in.')
LICENSE = ('No licence is stated for the Global Forest Watch copy: the licence field of its metadata and of the ArcGIS '
           'item is empty (checked 21 Nov 2026). The same national map (Ritung et al. 2011) is included in PEATMAP '
           '(Xu et al. 2018, University of Leeds, doi:10.5518/252), which is published under CC BY 4.0.')


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def cell_of(lat, lon):
    """Cell number of a point (arrays or numbers), the arithmetic of grid.py."""
    iy = np.floor((np.asarray(lat, float) + 90) / RES + EPS).astype(np.int64)
    ix = np.floor((np.asarray(lon, float) + 180) / RES + EPS).astype(np.int64)
    return iy * COLS + ix


def centre_lat(iy):
    return (iy + 0.5) * RES - 90


def centre_lon(ix):
    return (ix + 0.5) * RES - 180


def load_polygons(path):
    with open(path, encoding='utf-8') as f:
        gj = json.load(f)
    geoms = [shapely.make_valid(shape(ft['geometry'])) for ft in gj['features'] if ft.get('geometry')]
    return geoms, len(gj['features'])


def rasterise(geoms):
    """Cells whose centre lies inside a polygon: for each polygon, the centres within its bounds are tested."""
    out = []
    for g in geoms:
        x0, y0, x1, y1 = g.bounds
        ixs = np.arange(math.floor((x0 + 180) / RES) - 1, math.floor((x1 + 180) / RES) + 2)
        iys = np.arange(math.floor((y0 + 90) / RES) - 1, math.floor((y1 + 90) / RES) + 2)
        IX, IY = np.meshgrid(ixs, iys)
        shapely.prepare(g)
        m = shapely.contains_xy(g, centre_lon(IX.ravel()), centre_lat(IY.ravel()))
        out.append(IY.ravel()[m] * COLS + IX.ravel()[m])
    return np.unique(np.concatenate(out)).astype(np.int64)


def recount(geoms, iy0, iy1, ix0, ix1):
    """The same cells found the other way round: every centre of the box goes into a tree, band by band, and each
    polygon asks the tree which centres it contains (the method of build_peat_persistence.py)."""
    arr = np.array(geoms, dtype=object)
    ixs = np.arange(ix0, ix1 + 1)
    out = []
    for a in range(iy0, iy1 + 1, BAND):
        iys = np.arange(a, min(a + BAND, iy1 + 1))
        IX, IY = np.meshgrid(ixs, iys)
        tree = shapely.STRtree(shapely.points(centre_lon(IX.ravel()), centre_lat(IY.ravel())))
        _, ci = tree.query(arr, predicate='contains')
        ci = np.unique(ci)
        out.append(IY.ravel()[ci] * COLS + IX.ravel()[ci])
    return np.unique(np.concatenate(out)).astype(np.int64)


def to_runs(ids):
    """Sorted cell numbers -> flat [start delta, length, start delta, length, ...]."""
    brk = np.flatnonzero(np.diff(ids) != 1)
    starts = np.concatenate(([ids[0]], ids[brk + 1]))
    ends = np.concatenate((ids[brk], [ids[-1]]))
    assert (starts // COLS == ends // COLS).all(), 'a run crosses the end of a row'
    flat = np.empty(2 * len(starts), np.int64)
    flat[0::2] = np.diff(starts, prepend=0)
    flat[1::2] = ends - starts + 1
    return flat.tolist()


def from_runs(flat):
    """The decoder the app uses, written out again here for the read-back check."""
    ids, start = [], 0
    for k in range(0, len(flat), 2):
        start += flat[k]
        ids.append(np.arange(start, start + flat[k + 1], dtype=np.int64))
    return np.concatenate(ids)


def check_grid(ids, pts):
    """The arithmetic above against grid.py of Second Sight, on the given points and on cells of the mask."""
    spec = importlib.util.spec_from_file_location('ss_grid', GRID_PY)
    grid = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(grid)
    assert grid.ncols(RES) == COLS and grid.EPS == EPS, 'grid.py uses another grid'
    pts = list(pts) + [(1.23, 101.45), (-2.305, 113.995), (0.0, 110.0), (-0.00001, 109.99999), (-10.999, 95.001)]
    for lat, lon in pts:
        assert grid.cell_id(lat, lon, RES) == int(cell_of(lat, lon)), f'cell of {lat}, {lon} differs from grid.py'
    for cid in [int(x) for x in ids[:: max(1, len(ids) // 500)]] + [int(ids[0]), int(ids[-1])]:
        iy, ix = divmod(cid, COLS)
        assert grid.cell_center(cid, RES) == (centre_lat(iy), centre_lon(ix)), f'centre of cell {cid} differs'
        assert grid.cell_id(centre_lat(iy), centre_lon(ix), RES) == cid, f'centre of cell {cid} is not in it'
    return len(pts)


def listed_sites(ka):
    """(lat, lon) of every site listed in peat_persistence_kalteng.json. Coordinates only; nothing else is used."""
    path = os.path.join(ka, 'peat_persistence_kalteng.json')
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    assert LOCKED not in doc['seasons_included'], 'the peat persistence file holds the locked season'
    return [(s['lat'], s['lon']) for d in doc['districts'] for s in d['top_sites']], sha256_of(path)


def main():
    t0 = time.time()
    peat_path, ka = (sys.argv[1], sys.argv[2]) if len(sys.argv) >= 3 else (PEAT_DEFAULT, KA_DEFAULT)
    for a in (peat_path, ka):
        assert str(LOCKED) not in os.path.basename(a)

    # 1. the polygon file is the one its .source.json describes
    with open(peat_path + '.source.json', encoding='utf-8') as f:
        src = json.load(f)
    sha = sha256_of(peat_path)
    assert sha == src['sha256'], 'the peat polygon file differs from its .source.json'

    geoms, n_features = load_polygons(peat_path)
    assert len(geoms) == n_features == src['feature_count'], 'number of polygons differs from the .source.json'
    ids = rasterise(geoms)
    assert len(ids) > 0 and ids[0] >= 0 and ids[-1] < ROWS * COLS
    iy, ix = np.divmod(ids, COLS)
    print(f'{len(geoms)} polygons, {len(ids)} cells, {time.time() - t0:.1f} s', file=sys.stderr)

    # 2. same grid as Second Sight;  3. the sites the app already lists as peat sites are in the mask
    sites, sites_sha = listed_sites(ka)
    n_grid = check_grid(ids, sites)
    assert sites, 'peat_persistence_kalteng.json lists no site'
    missing = [s for s in sites if int(cell_of(*s)) not in set(ids.tolist())]
    assert not missing, f'{len(missing)} of {len(sites)} listed peat sites are not in the mask, e.g. {missing[:3]}'

    # 4. recount with the other method, over the whole box of the polygons
    b = shapely.bounds(np.array(geoms, dtype=object))
    box = (math.floor((b[:, 1].min() + 90) / RES) - 1, math.floor((b[:, 3].max() + 90) / RES) + 1,
           math.floor((b[:, 0].min() + 180) / RES) - 1, math.floor((b[:, 2].max() + 180) / RES) + 1)
    again = recount(geoms, *box)
    assert np.array_equal(ids, again), (f'recount differs: {len(ids)} cells against {len(again)}, '
                                        f'{len(np.setxor1d(ids, again))} cells in one and not the other')
    print(f'recount equal ({len(again)} cells of {(box[1] - box[0] + 1) * (box[3] - box[2] + 1)} centres), '
          f'{time.time() - t0:.1f} s', file=sys.stderr)

    runs = to_runs(ids)
    runs_text = json.dumps(runs, separators=(',', ':'))
    doc = {
        'format': FORMAT,
        'title': 'Mapped peat of Indonesia on the 0.01 degree grid',
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'built_by': 'kalenderapi-v4-integrated/pipeline/peat/build_peat_mask_idn.py',
        'cell_deg': RES,
        'cols': COLS,
        'origin': {'lat': -90, 'lon': -180},
        'key': KEY,
        'rule': RULE,
        'limitation': LIMITATION,
        'bbox': [round(float(centre_lon(ix.min()) - RES / 2), 2), round(float(centre_lat(iy.min()) - RES / 2), 2),
                 round(float(centre_lon(ix.max()) + RES / 2), 2), round(float(centre_lat(iy.max()) + RES / 2), 2)],
        'source': {
            'title': 'National peat map of Indonesia',
            'title_id': 'Peta Lahan Gambut Indonesia skala 1:250.000',
            'publisher': 'BBSDLP, Ministry of Agriculture',
            'year': 2011,
            'scale': '1:250,000',
            'citation': 'Ritung et al. 2011',
            'via': 'Global Forest Watch',
            'via_title': 'Indonesia peat lands (2012), ArcGIS item d52e0e67ad21401cbf3a2c002599cf58',
            'url': src['source_url'],
            'file': 'data-raw/ss/support/peat/' + src['file'],
            'sha256': sha,
            'downloaded_utc': src['downloaded_utc'],
            'polygons': len(geoms),
            'generalisation_deg': 0.002,
            'license': LICENSE,
        },
        'checks': {
            'listed_peat_sites_in_mask': f'{len(sites)} of {len(sites)}',
            'listed_peat_sites_file': 'peat_persistence_kalteng.json',
            'listed_peat_sites_sha256': sites_sha,
            'recount': 'equal',
            'grid': f'same cell and centre as vendor/second-sight/pipeline/data/grid.py on {n_grid} points',
        },
        'encoding': ENCODING,
        'cells': int(len(ids)),
        'n_runs': len(runs) // 2,
        'runs_sha256': hashlib.sha256(runs_text.encode('ascii')).hexdigest(),
        'runs': runs,
    }
    out = os.path.join(ka, 'peat_mask_idn.json')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, separators=(',', ':'))

    # 5. what was written is what was found
    with open(out, encoding='utf-8') as f:
        back = json.load(f)
    decoded = from_runs(back['runs'])
    assert np.array_equal(decoded, ids), 'the written runs do not decode to the cells found'
    assert back['cells'] == len(decoded) == sum(back['runs'][1::2]) == len(ids), 'cell count differs from a recount'
    assert back['n_runs'] * 2 == len(back['runs'])

    km2 = (RES * 111.195) ** 2 * np.cos(np.radians(centre_lat(iy)))
    with open(out, 'rb') as f:
        raw = f.read()
    print(json.dumps({
        'out': out, 'out_bytes': len(raw), 'out_gzip9_bytes': len(gzip.compress(raw, 9, mtime=0)),
        'out_sha256': hashlib.sha256(raw).hexdigest(), 'cells': int(len(ids)), 'runs': len(runs) // 2,
        'runs_sha256': doc['runs_sha256'], 'bbox': doc['bbox'],
        'listed_peat_sites_in_mask': doc['checks']['listed_peat_sites_in_mask'], 'recount': 'equal',
        'area_of_the_cells_mha': round(float(km2.sum()) / 1e4, 3), 'seconds': round(time.time() - t0, 1)}, indent=1))


if __name__ == '__main__':
    main()
