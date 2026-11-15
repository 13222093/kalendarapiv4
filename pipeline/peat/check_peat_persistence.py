"""Checks of peat_persistence_kalteng.json, written apart from the builder.

No shapely or geopandas here: point-in-polygon is an even-odd ray cast on the raw GeoJSON rings, the cell of a hotspot
is found with Decimal arithmetic, and the MODIS pixel of a cell centre is looked up with this file's own sinusoidal
formula. 2019 is never opened (season files and MODIS files with 2019 in the name are skipped).

Usage: python -I pipeline/peat/check_peat_persistence.py <raw_dir> <ka_data_dir> <geoboundaries_geojson> <peat_geojson>
"""
import json
import math
import os
import re
import sys
from datetime import date, timedelta
from decimal import Decimal

import numpy as np
import tifffile

CLASSES = ('under_cloud', 'seen_quiet', 'no_data', 'modis_fire')


def crossings(x, y, ring):
    a = np.asarray(ring, float)
    x1, y1, x2, y2 = a[:-1, 0], a[:-1, 1], a[1:, 0], a[1:, 1]
    cond = (y1 > y) != (y2 > y)
    with np.errstate(divide='ignore', invalid='ignore'):
        xi = (x2 - x1) * (y - y1) / (y2 - y1) + x1
    return int((cond & (x < xi)).sum())


def inside(x, y, geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return any(sum(crossings(x, y, r) for r in p) % 2 == 1 for p in polys)


def bbox_of(geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    a = np.concatenate([np.asarray(p[0], float) for p in polys])
    return a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()


def cell_centre_of(lon, lat):
    """Centre of the 0.01 degree cell of a hotspot, by Decimal floor (west and north edges belong to the cell)."""
    dx = (Decimal(str(lon)) - Decimal('110.7')) / Decimal('0.01')
    dy = (Decimal('0.9') - Decimal(str(lat))) / Decimal('0.01')
    i, j = math.floor(dx), math.floor(dy)
    return float(Decimal('110.705') + Decimal(i) * Decimal('0.01')), float(Decimal('0.895') - Decimal(j) * Decimal('0.01'))


_by_cell = {}


def recount(season, lon, lat):
    """Detection days of one cell straight from the season file: {date: [detections, night]}."""
    key = id(season)
    if key not in _by_cell:          # one pass over the file, then a lookup per site
        table = {}
        for d in season['days']:
            for p in d['pts']:
                e = table.setdefault(cell_centre_of(p[0], p[1]), {}).setdefault(d['date'], [0, 0])
                e[0] += 1
                e[1] += p[3]
        _by_cell[key] = table
    return _by_cell[key].get((lon, lat), {})


def gaps_of(dates):
    ds = sorted(date.fromisoformat(x) for x in dates)
    return [((a + timedelta(1)).isoformat(), (b - timedelta(1)).isoformat(), (b - a).days - 1)
            for a, b in zip(ds, ds[1:]) if (b - a).days - 1 >= 2]


R, TILE = 6371007.181, 1111950.5196666666
_cache = {}


def firemask(raw, sensor, day, lon, lat):
    """FireMask class of the MODIS 1 km pixel at (lon, lat) on a day; None when no file holds that day."""
    x = R * math.radians(lon) * math.cos(math.radians(lat))
    y = R * math.radians(lat)
    h = math.floor((x + 20015109.354) / TILE)
    v = math.floor((10007554.677 - y) / TILE)
    col = math.floor(((x + 20015109.354) - h * TILE) / (TILE / 1200))
    row = math.floor(((10007554.677 - y) - v * TILE) / (TILE / 1200))
    prefix = ('MOD14A1' if sensor == 'terra' else 'MYD14A1')
    folder = os.path.join(raw, 'modis14a1')
    for name in sorted(os.listdir(folder)):
        m = re.match(rf'{prefix}\.A(\d{{4}})(\d{{3}})\.h(\d\d)v(\d\d)\.', name)
        if not m or m.group(1) == '2019' or (int(m.group(3)), int(m.group(4))) != (h, v):
            continue
        first = date(int(m.group(1)), 1, 1) + timedelta(int(m.group(2)) - 1)
        if not (first <= date.fromisoformat(day) <= first + timedelta(7)):
            continue
        if name not in _cache:
            with tifffile.TiffFile(os.path.join(folder, name)) as t:
                meta = str(t.pages[0].tags['GDAL_METADATA'].value)
                _cache[name] = (t.pages[0].asarray(),
                                re.search(r'<Item name="Dates">([^<]+)</Item>', meta).group(1).split())
        arr, dates = _cache[name]
        if day in dates:
            return int(arr[row, col, dates.index(day)])
    return None


def look(t, a):
    fire, clear, cloud = (7, 8, 9), 5, 4
    if t in fire or a in fire:
        return 'fire'
    if t == clear or a == clear:
        return 'clear'
    if t == cloud or a == cloud:
        return 'cloud'
    return 'none'


def class_of(looks):
    if 'fire' in looks:
        return 'modis_fire'
    if 'clear' in looks:
        return 'seen_quiet'
    if all(x == 'cloud' for x in looks):
        return 'under_cloud'
    return 'no_data'


def main():
    raw, ka, geo, peat_path = sys.argv[1:5]
    with open(os.path.join(ka, 'peat_persistence_kalteng.json'), encoding='utf-8') as f:
        doc = json.load(f)
    fails = []

    def check(ok, msg):
        if not ok:
            fails.append(msg)

    # 1. totals
    check(2019 not in doc['seasons_included'], '2019 is in seasons_included')
    for s in doc['seasons']:
        y = s['season']
        rows = [next(x for x in d['seasons'] if x['season'] == y) for d in doc['districts']]
        for k in ('peat_cells_with_fire', 'persistent_peat_sites'):
            check(sum(r[k] for r in rows) == s[k], f'{y} {k} districts do not add up')
        for k in ('total',) + CLASSES:
            check(sum(r['come_backs'][k] for r in rows) == s['come_backs'][k], f'{y} come_backs {k} do not add up')
        check(s['come_backs']['total'] == sum(s['come_backs'][k] for k in CLASSES), f'{y} classes do not add up')
        cb = s['come_backs']
        print(f"{y}{' (provisional)' if s['provisional'] else ''}: peat cells with fire {s['peat_cells_with_fire']}, "
              f"persistent peat sites {s['persistent_peat_sites']}, come-backs {cb['total']} = under cloud "
              f"{cb['under_cloud']} + seen quiet {cb['seen_quiet']} + no data {cb['no_data']} + MODIS fire {cb['modis_fire']}")
    for k in ('peat_cells_with_fire', 'persistent_peat_sites'):
        check(sum(s[k] for s in doc['seasons']) == doc['total'][k], f'total {k}')
    for k in ('total',) + CLASSES:
        check(sum(s['come_backs'][k] for s in doc['seasons']) == doc['total']['come_backs'][k], f'total come_backs {k}')
    print('total', json.dumps(doc['total']))

    # 2. every reported site: in its district, on peat, a cell centre, meets the rule, and equals a recount
    with open(geo, encoding='utf-8') as f:
        dfeat = {x['properties']['shapeName']: x['geometry'] for x in json.load(f)['features']}
    with open(peat_path, encoding='utf-8') as f:
        peat = [(bbox_of(x['geometry']), x['geometry']) for x in json.load(f)['features']]
    with open(os.path.join(ka, 'peat_kalteng.geojson'), encoding='utf-8') as f:
        drawn = [(bbox_of(x['geometry']), x['geometry']) for x in json.load(f)['features']]
    seasons, n_sites, off_drawn, all_sites = {}, 0, 0, []
    for d in doc['districts']:
        y = d['top_sites_season']
        with_sites = [x['season'] for x in d['seasons'] if x['persistent_peat_sites'] > 0]
        check(y == (max(with_sites) if with_sites else None), f"{d['name']} top_sites_season")
        if y is None:
            check(d['top_sites'] == [], f"{d['name']} sites without a season")
            continue
        check(y != 2019 and len(d['top_sites']) <= 40, f"{d['name']} season or cut")
        row = next(x for x in d['seasons'] if x['season'] == y)
        check(d['persistent_peat_sites_in_that_season'] == row['persistent_peat_sites'], f"{d['name']} site count")
        check(len(d['top_sites']) == min(40, row['persistent_peat_sites']), f"{d['name']} number of sites")
        keys = [(-s['days_detected'], -s['come_backs']['total'], s['lon'], -s['lat']) for s in d['top_sites']]
        check(keys == sorted(keys), f"{d['name']} ranking")
        if y not in seasons:
            with open(os.path.join(ka, f'kalteng_{y}_season.json'), encoding='utf-8') as f:
                seasons[y] = json.load(f)
        for s in d['top_sites']:
            n_sites += 1
            tag = f"{d['name']} {s['lon']},{s['lat']}"
            all_sites.append((d, y, s))
            check(round(s['lon'] * 1000) % 10 == 5 and round(s['lat'] * 1000) % 10 == 5, f'{tag} not a cell centre')
            check(inside(s['lon'], s['lat'], dfeat[d['name']]), f'{tag} outside its district')
            on_peat = any(b[0] <= s['lon'] <= b[2] and b[1] <= s['lat'] <= b[3] and inside(s['lon'], s['lat'], g)
                          for b, g in peat)
            check(on_peat, f'{tag} not inside a peat polygon')
            off_drawn += not any(b[0] <= s['lon'] <= b[2] and b[1] <= s['lat'] <= b[3]
                                 and inside(s['lon'], s['lat'], g) for b, g in drawn)
            check(s['days_detected'] >= 3 or s['come_backs']['total'] >= 1, f'{tag} does not meet the rule')
            rc = recount(seasons[y], s['lon'], s['lat'])
            det, night = sum(v[0] for v in rc.values()), sum(v[1] for v in rc.values())
            check(len(rc) == s['days_detected'] and min(rc) == s['first_date'] and max(rc) == s['last_date']
                  and det == s['detections'] and round(night / det, 2) == s['night_share'], f'{tag} recount differs')
            check([(g['from'], g['to'], g['days']) for g in s['gaps']] == gaps_of(rc), f'{tag} gaps differ')
            check(s['come_backs']['total'] == len(s['gaps'])
                  and all(s['come_backs'][k] == sum(g['class'] == k for g in s['gaps']) for k in CLASSES),
                  f'{tag} come-back counts differ from its gaps')
    print(f'{n_sites} reported sites in {sum(1 for d in doc["districts"] if d["top_sites"])} districts: district, peat, '
          f'cell-centre, rule, ranking and recount checks run; {off_drawn} of them lie outside the drawn (clipped) outline')

    # 3. three sites by hand: one per gap class where the reported sites have one
    picked = []
    for cls in ('under_cloud', 'seen_quiet', 'modis_fire', 'no_data'):
        hit = next(((d, y, s) for d, y, s in all_sites if s['come_backs'][cls] > 0
                    and all(s is not p[2] for p in picked)), None)
        if hit and len(picked) < 3:
            picked.append(hit)
    for d, y, s in picked:
        rc = recount(seasons[y], s['lon'], s['lat'])
        print(f"\nBY HAND  {d['name']} {y}  cell centre {s['lon']}, {s['lat']}")
        print('  season file, detections per day [all, night]:', json.dumps(rc))
        print(f"  file says: days {s['days_detected']}, {s['first_date']} to {s['last_date']}, night share "
              f"{s['night_share']}, come-backs {json.dumps(s['come_backs'])}")
        for g in s['gaps']:
            a, b = date.fromisoformat(g['from']), date.fromisoformat(g['to'])
            looks, codes = [], []
            for k in range((b - a).days + 1):
                day = (a + timedelta(k)).isoformat()
                t, q = firemask(raw, 'terra', day, s['lon'], s['lat']), firemask(raw, 'aqua', day, s['lon'], s['lat'])
                codes.append(f'{day[5:]}:T{t}/A{q}')
                looks.append(look(t, q))
            mine = class_of(looks)
            check(mine == g['class'], f"by hand {d['name']} gap {g['from']}: {mine} vs {g['class']}")
            print(f"  gap {g['from']} to {g['to']} ({g['days']} d) file: {g['class']}, by hand: {mine}   "
                  f"FireMask Terra/Aqua {' '.join(codes)}")

    print('\nFAILED:' if fails else '\nall checks passed')
    for m in fails[:40]:
        print(' -', m)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
