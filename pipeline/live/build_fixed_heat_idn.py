"""KalenderApi: mask of known fixed heat sources of Indonesia on the 0.01 degree grid.

Question it serves: is this hot spot at a place where NASA's archive already records heat that is not a land fire
(a volcano, a gas flare, a smelter, a platform at sea)?

NASA FIRMS near-real-time files carry no source type, so the list "Still burning?" cannot tell a refinery flare from a
fire that came back. The FIRMS standard archive can: its column "type" is 0 for a presumed vegetation fire, 1 for an
active volcano, 2 for another static land source and 3 for offshore. This script reads the archive of the five newest
full years on disk, counts the detections of type 1, 2 and 3 per 0.01 degree cell, and writes the cells that have
MIN_DETECTIONS or more, each with its kind (the type with the most detections there). The grid is the one of
vendor/second-sight/pipeline/data/grid.py (rows and columns counted from -90, -180), so a place falls in the same cell
here, in the peat mask (peat_mask_idn.json) and in the browser (app/src/lib/fixedheat.ts).

What the mask is not: it is NASA's presumption per detection, not a ground check; a facility newer than the archive,
a place outside the Indonesia country files, and a heat source that NASA still types 0 are not in it.

Only years from 2021 on are read. A registered test locks 1 Jan to 31 Oct 2019 for Central Kalimantan: no file of a
year before 2021 is opened, and the run stops if the years found on disk would reach further back.

Deterministic: the same archive files give the same cells ("cells_sha256" in the output). Only "generated_at" changes.

Checks, each of which stops the run with an error:
1. the years used are the five newest full years on disk, none before 2021, and every row of a file is dated in the
   year of its folder; a year is full when every sensor's file has detections in January and in December;
2. every file has the number of rows the download manifest (data-raw/ss/data_manifest.json) records for its CSV;
3. the cell arithmetic here gives the same cell as grid.py of Second Sight;
4. a recount with the other reader (pyarrow and numpy, no SQL) gives exactly the same cells and the same counts;
5. the five known places (a refinery flare, three nickel smelters, a volcano) are in the mask with a fitting kind;
6. the written file, read back and decoded, gives exactly the same cells; "cells" equals their number; no cell has
   two kinds.

Output
- <ka_data_dir>/fixed_heat_idn.json

Usage (venv python of docs/DATA.md section 2: duckdb, pyarrow, numpy), from the repository root or anywhere else
  python -I pipeline/live/build_fixed_heat_idn.py [<raw_dir> <ka_data_dir>]
"""
import gzip
import hashlib
import importlib.util
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import duckdb
import numpy as np
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW_DEFAULT = os.path.join(ROOT, 'data-raw', 'ss', 'raw')
KA_DEFAULT = os.path.join(ROOT, 'app', 'public', 'ka-data')
GRID_PY = os.path.join(ROOT, 'vendor', 'second-sight', 'pipeline', 'data', 'grid.py')

FORMAT = 'ka-fixed-heat-1'
FIRST_ALLOWED_YEAR = 2021         # nothing older is opened (a registered test locks part of 2019)
N_YEARS = 5
SOURCES = ('modis', 'viirs-snpp', 'viirs-jpss1')
SENSOR_NAME = {'modis': 'MODIS on Terra and Aqua', 'viirs-snpp': 'VIIRS 375 m on S-NPP',
               'viirs-jpss1': 'VIIRS 375 m on NOAA-20'}
BOX = (95.0, -11.0, 141.0, 6.0)   # west, south, east, north: the box of /api/live (app/public/api/live.js)
RES = 0.01                        # cell size in degrees
COLS = 36000                      # columns of the global grid at 0.01 degree
ROWS = 18000
EPS = 1e-7                        # as in grid.py: a point exactly on a cell edge goes to the cell above / to the east
KINDS = ('static', 'volcano', 'offshore')          # also the order that settles a tie
TYPE_OF = {'volcano': 1, 'static': 2, 'offshore': 3}

# N = 3, kept after looking at the 2021 to 2025 counts (21 Nov 2026): of the 4,660 cells with any detection of type 1,
# 2 or 3, 2,839 have exactly one and so no repeat at all, while 1,107 of the 1,160 cells with three or more were
# detected on two or more days (all 692 static ones). Raising N to 5 or 10 leaves 760 or 493 cells and changes the
# check on that day's live hot spots by one cell at most, so the lower N costs nothing there and keeps the weak sources.
MIN_DETECTIONS = 3
LOOK_AT = (1, 2, 3, 5, 10)        # the thresholds whose cell counts are written out next to the one used

# Places known from the ground, seen on 7 of 7 days in the live data of 21 Nov 2026: (lat, lon, kinds that fit).
# The Balikpapan flare stands on the shore and NASA types most of its detections offshore.
KNOWN = {
    'Balikpapan refinery flare': (-1.2427, 116.8156, ('offshore', 'static')),
    'Sorowako nickel smelter': (-2.576, 121.3815, ('static',)),
    'Morosi nickel smelters': (-3.8712, 122.4009, ('static',)),
    'Obi nickel smelter': (-1.4577, 127.4363, ('static',)),
    'Lewotolok volcano': (-8.2741, 123.5062, ('volcano',)),
}

RULE = ('A cell of 0.01 degree (about 1.1 km) is a known fixed heat source when the NASA FIRMS standard archive of '
        '{y0} to {y1} holds {n} or more detections there that NASA typed as an active volcano, another static land '
        'source or offshore; its kind is the type with the most detections in the cell.')
KEY = ('row = floor((lat + 90) / 0.01 + 1e-7), column = floor((lon + 180) / 0.01 + 1e-7), '
       'cell = row * 36000 + column; the centre of a cell is ((row + 0.5) * 0.01 - 90, (column + 0.5) * 0.01 - 180).')
ENCODING = ('Each list under "kinds" holds the cell numbers of that kind in rising order: the first number is a cell '
            'number, every later number is the cell number minus the one before it. A cell is in one list only.')
KIND_RULE = ('volcano = type 1 (active volcano), static = type 2 (other static land source), offshore = type 3 '
             '(offshore). When two types have the same count in a cell: static, then volcano, then offshore.')
LIMITATION = ('The type is NASA\'s presumption for each detection, not a ground check, and a source on the shore can be '
              'typed offshore. Near-real-time data has no type, so a facility newer than the archive is not in the '
              'mask; nor is a place outside the Indonesia country files (the live box also covers parts of Malaysia, '
              'Brunei, Timor-Leste, Papua New Guinea and open sea), nor a fixed heat source whose detections NASA '
              'types as a presumed vegetation fire. A cell in the mask can still hold a land fire next to the source: '
              'the mask is a reason to set a place aside, not proof that nothing burns there.')
TYPE_DOC = ('0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source, 3 = offshore. Types 1, 2 '
            'and 3 are counted; no confidence filter is applied to them.')
CELL_SQL = (f'CAST(floor((latitude + 90) / {RES} + {EPS}) AS BIGINT) * {COLS}'
            f' + CAST(floor((longitude + 180) / {RES} + {EPS}) AS BIGINT)')


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def part(raw, source, year):
    """The archive file of one sensor and year. The year is checked here, so no older file can be named at all."""
    assert year >= FIRST_ALLOWED_YEAR, f'{year} is before {FIRST_ALLOWED_YEAR}: not opened'
    return os.path.join(raw, f'source={source}', f'year={year}', 'part.parquet').replace(os.sep, '/')


def years_on_disk(raw):
    """Years that have a file for every sensor, from the folder names only (no file is opened here)."""
    per = []
    for s in SOURCES:
        d = os.path.join(raw, f'source={s}')
        found = set()
        for name in os.listdir(d):
            m = re.fullmatch(r'year=(\d{4})', name)
            if m and os.path.exists(os.path.join(d, name, 'part.parquet')):
                found.add(int(m.group(1)))
        per.append(found)
    return sorted(set.intersection(*per))


def file_head(con, path):
    """Rows, first and last date and the version values of one file."""
    n, d0, d1, versions = con.execute(
        'SELECT count(*), min(acq_date), max(acq_date), list(DISTINCT version ORDER BY version) '
        'FROM read_parquet(?, hive_partitioning = false)', [path]).fetchone()
    return {'rows': int(n), 'first': d0, 'last': d1, 'versions': [str(v) for v in versions]}


def pick_years(con, raw):
    """The five newest full years on disk, never one before FIRST_ALLOWED_YEAR. Also the head of every file read."""
    on_disk = years_on_disk(raw)
    heads, years = {}, []
    for y in sorted((y for y in on_disk if y >= FIRST_ALLOWED_YEAR), reverse=True):
        full = True
        for s in SOURCES:
            h = file_head(con, part(raw, s, y))
            assert h['rows'] > 0 and h['first'].year == y == h['last'].year, f'{s} {y}: rows dated outside {y}'
            heads[(s, y)] = h
            full = full and h['first'].month == 1 and h['last'].month == 12
        if full:
            years.append(y)
        if len(years) == N_YEARS:
            break
    years.sort()
    assert len(years) == N_YEARS, f'only {len(years)} full years from {FIRST_ALLOWED_YEAR} on: {years}'
    assert years[0] >= FIRST_ALLOWED_YEAR and years == list(range(years[0], years[0] + N_YEARS)), years
    return years, on_disk, heads


def count_sql(con, path):
    """Detections of type 1, 2 and 3 inside the box, per cell: [(cell, n1, n2, n3)]."""
    w, s, e, n = BOX
    return con.execute(
        f'SELECT {CELL_SQL} AS cell, count(*) FILTER (WHERE type = 1), count(*) FILTER (WHERE type = 2), '
        'count(*) FILTER (WHERE type = 3) FROM read_parquet(?, hive_partitioning = false) '
        'WHERE type IN (1, 2, 3) AND longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ? '
        'GROUP BY 1', [path, w, e, s, n]).fetchall()


def count_again(paths):
    """The same count with the other reader: pyarrow and numpy, no SQL. {cell * 4 + type: detections}."""
    w, s, e, n = BOX
    tot = {}
    for p in paths:
        t = pq.read_table(p, columns=['latitude', 'longitude', 'type'], partitioning=None)
        lat = t.column('latitude').to_numpy()
        lon = t.column('longitude').to_numpy()
        typ = t.column('type').fill_null(-1).to_numpy().astype(np.int64)
        m = np.isin(typ, (1, 2, 3)) & (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n)
        cell = (np.floor((lat[m] + 90) / RES + EPS).astype(np.int64) * COLS
                + np.floor((lon[m] + 180) / RES + EPS).astype(np.int64))
        keys, counts = np.unique(cell * 4 + typ[m], return_counts=True)
        for k, c in zip(keys.tolist(), counts.tolist()):
            tot[k] = tot.get(k, 0) + c
    return tot


def cell_of(lat, lon):
    """Cell number of a point, the arithmetic of grid.py."""
    return int(np.floor((lat + 90) / RES + EPS)) * COLS + int(np.floor((lon + 180) / RES + EPS))


def kind_of(n1, n2, n3):
    """The type with the most detections in the cell; a tie goes to the first of KINDS."""
    by = {'volcano': n1, 'static': n2, 'offshore': n3}
    return max(KINDS, key=lambda k: (by[k], -KINDS.index(k)))


def check_grid(cells):
    """The arithmetic above against grid.py of Second Sight, on the known places, some edge points and mask cells."""
    spec = importlib.util.spec_from_file_location('ss_grid', GRID_PY)
    grid = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(grid)
    assert grid.ncols(RES) == COLS and grid.EPS == EPS, 'grid.py uses another grid'
    pts = [(lat, lon) for lat, lon, _ in KNOWN.values()]
    pts += [(1.23, 101.45), (-2.305, 113.995), (0.0, 110.0), (-0.00001, 109.99999), (-10.999, 95.001), (5.99, 140.99)]
    for lat, lon in pts:
        assert grid.cell_id(lat, lon, RES) == cell_of(lat, lon), f'cell of {lat}, {lon} differs from grid.py'
    for cid in cells[:: max(1, len(cells) // 300)]:
        lat, lon = grid.cell_center(cid, RES)
        assert grid.cell_id(lat, lon, RES) == cid == cell_of(lat, lon), f'centre of cell {cid} is not in it'
    return len(pts)


def encode(ids):
    """Rising cell numbers -> the first, then the differences."""
    return [ids[0]] + [b - a for a, b in zip(ids, ids[1:])] if ids else []


def decode(deltas):
    """The decoder the app uses (lib/fixedheat.ts), written out again here for the read-back check."""
    out, at = [], 0
    for d in deltas:
        at += d
        out.append(at)
    return out


def main():
    t0 = time.time()
    raw, ka = (sys.argv[1], sys.argv[2]) if len(sys.argv) >= 3 else (RAW_DEFAULT, KA_DEFAULT)
    con = duckdb.connect()

    # 1. which years: the five newest full ones on disk, none before 2021
    years, on_disk, heads = pick_years(con, raw)
    y0, y1 = years[0], years[-1]
    print(f'years on disk for all three sensors: {on_disk[0]} to {on_disk[-1]}; used: {y0} to {y1}', file=sys.stderr)

    # 2. every file is the one the download manifest describes (by its number of rows)
    manifest_path = os.path.join(os.path.dirname(raw.rstrip('/\\')), 'data_manifest.json')
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)
    listed = {(m['source'], m['year']): m for m in manifest['files'] if m.get('year') in years}

    counts, files, paths = {}, [], []            # cell -> [n1, n2, n3]
    for s in SOURCES:
        for y in years:
            p = part(raw, s, y)
            h, m = heads[(s, y)], listed[(s, y)]
            assert h['rows'] == m['rows'], f'{s} {y}: {h["rows"]} rows, the manifest says {m["rows"]}'
            in_box = 0
            for cell, n1, n2, n3 in count_sql(con, p):
                c = counts.setdefault(int(cell), [0, 0, 0])
                c[0] += n1
                c[1] += n2
                c[2] += n3
                in_box += n1 + n2 + n3
            paths.append(p)
            files.append({'sensor': s, 'year': y, 'rows': h['rows'], 'rows_type_1_2_3_in_box': in_box,
                          'version': h['versions'], 'first_date': h['first'].isoformat(),
                          'last_date': h['last'].isoformat(), 'url': m['url'], 'downloaded_utc': m['downloaded_utc'],
                          'csv_sha256': m['sha256'], 'parquet_sha256': sha256_of(p)})

    # 4. the recount: another reader, the same numbers
    again = count_again(paths)
    first = {c * 4 + t: n for c, (n1, n2, n3) in counts.items() for t, n in ((1, n1), (2, n2), (3, n3)) if n}
    assert first == again, (f'recount differs: {len(first)} cell-types against {len(again)}, '
                            f'{len(set(first.items()) ^ set(again.items()))} entries in one and not the other')

    total = {c: sum(v) for c, v in counts.items()}
    kind = {c: kind_of(*v) for c, v in counts.items()}
    look = {}
    for n in LOOK_AT:
        sel = [c for c in total if total[c] >= n]
        look[str(n)] = {'cells': len(sel), **{k: sum(1 for c in sel if kind[c] == k) for k in ('volcano', 'static', 'offshore')}}
    mask = sorted(c for c in total if total[c] >= MIN_DETECTIONS)
    assert mask and mask[0] >= 0 and mask[-1] < ROWS * COLS
    by_kind = {k: [c for c in mask if kind[c] == k] for k in ('volcano', 'static', 'offshore')}
    detections = {k: sum(counts[c][i] for c in counts) for k, i in (('volcano', 0), ('static', 1), ('offshore', 2))}
    in_mask = sum(total[c] for c in mask)
    print(f'{sum(detections.values())} detections of type 1, 2, 3 in {len(counts)} cells; '
          f'{len(mask)} cells with {MIN_DETECTIONS} or more, {time.time() - t0:.1f} s', file=sys.stderr)

    # 3. same grid as Second Sight;  5. the places known from the ground are in the mask, with a kind that fits
    n_grid = check_grid(mask)
    known = {}
    in_set = set(mask)
    for name, (lat, lon, fits) in KNOWN.items():
        c = cell_of(lat, lon)
        assert c in in_set, f'{name} ({lat}, {lon}) is not in the mask'
        assert kind[c] in fits, f'{name}: kind {kind[c]}, expected one of {fits}'
        known[name] = {'lat': lat, 'lon': lon, 'kind': kind[c], 'detections': total[c],
                       'volcano': counts[c][0], 'static': counts[c][1], 'offshore': counts[c][2]}

    versions = {s: sorted({v for f in files if f['sensor'] == s for v in f['version']}) for s in SOURCES}
    sensors = ', '.join(f'{SENSOR_NAME[s]} (version {" and ".join(versions[s])})' for s in SOURCES)
    kinds_doc = {k: encode(by_kind[k]) for k in ('volcano', 'static', 'offshore')}
    kinds_text = json.dumps(kinds_doc, separators=(',', ':'))
    doc = {
        'format': FORMAT,
        'title': 'Known fixed heat sources of Indonesia on the 0.01 degree grid',
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'built_by': 'kalenderapi-v4-integrated/pipeline/live/build_fixed_heat_idn.py',
        'cell_deg': RES,
        'cols': COLS,
        'origin': {'lat': -90, 'lon': -180},
        'key': KEY,
        'bbox': list(BOX),
        'period': {'first_year': y0, 'last_year': y1},
        'min_detections': MIN_DETECTIONS,
        'rule': RULE.format(y0=y0, y1=y1, n=MIN_DETECTIONS),
        'kind_rule': KIND_RULE,
        'limitation': LIMITATION,
        'source': {
            'citation': f'NASA FIRMS standard-processing archive (country files for Indonesia), {y0} to {y1}, '
                        f'attribute "type": {sensors}',
            'version_note': 'The versions are the values of the "version" column of the files, as NASA wrote them.',
            'publisher': 'NASA LANCE / FIRMS',
            'product': manifest['files'][0]['product'],
            'type_attribute': TYPE_DOC,
            'url_pattern': 'https://firms.modaps.eosdis.nasa.gov/data/country/{source}/{year}/{source}_{year}_Indonesia.csv',
            'license': manifest['files'][0]['license'],
            'manifest': {'file': 'data-raw/ss/data_manifest.json', 'sha256': sha256_of(manifest_path),
                         'generated_utc': manifest['generated_utc']},
            'read_from': 'data-raw/ss/raw/source=<sensor>/year=<year>/part.parquet (the downloaded CSV as parquet)',
            'files': files,
        },
        'checks': {
            'years_on_disk': [on_disk[0], on_disk[-1]],
            'recount': 'equal',
            'grid': f'same cell as vendor/second-sight/pipeline/data/grid.py on {n_grid} points and on mask cells',
            'known_places': known,
        },
        'detections': {**detections, 'total': sum(detections.values()), 'in_the_cells_of_the_mask': in_mask},
        'cells_by_min_detections': look,
        'encoding': ENCODING,
        'cells': len(mask),
        'cells_by_kind': {k: len(by_kind[k]) for k in ('volcano', 'static', 'offshore')},
        'cells_sha256': hashlib.sha256(kinds_text.encode('ascii')).hexdigest(),
        'kinds': kinds_doc,
    }
    os.makedirs(ka, exist_ok=True)
    out = os.path.join(ka, 'fixed_heat_idn.json')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, separators=(',', ':'))

    # 6. what was written is what was found
    with open(out, encoding='utf-8') as f:
        back = json.load(f)
    got = {k: decode(back['kinds'][k]) for k in ('volcano', 'static', 'offshore')}
    assert got == by_kind, 'the written lists do not decode to the cells found'
    flat = [c for k in got for c in got[k]]
    assert len(flat) == len(set(flat)) == back['cells'] == len(mask), 'cell count differs from a recount'
    assert sorted(flat) == mask and all(total[c] >= back['min_detections'] for c in flat)
    assert back['cells'] == look[str(MIN_DETECTIONS)]['cells'] == sum(back['cells_by_kind'].values())

    with open(out, 'rb') as f:
        body = f.read()
    print(json.dumps({
        'out': out, 'out_bytes': len(body), 'out_gzip9_bytes': len(gzip.compress(body, 9, mtime=0)),
        'out_sha256': hashlib.sha256(body).hexdigest(), 'cells_sha256': doc['cells_sha256'],
        'years_on_disk': doc['checks']['years_on_disk'], 'period': doc['period'], 'min_detections': MIN_DETECTIONS,
        'cells': len(mask), 'cells_by_kind': doc['cells_by_kind'], 'cells_by_min_detections': look,
        'detections': doc['detections'], 'versions': versions, 'known_places': known, 'recount': 'equal',
        'seconds': round(time.time() - t0, 1)}, indent=1))


if __name__ == '__main__':
    main()
