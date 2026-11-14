"""KalenderApi: build the "what could the satellites see?" layer for "Play the season" (#/season).

Central Kalimantan, 1 Aug to 31 Oct <year> (default 2019), one entry per day (UTC), nothing interpolated.

Inputs
- NASA MODIS daily fire mask (the FireMask layer of MOD14A1 = Terra and MYD14A1 = Aqua, Collection 6.1, tiles h29v08
  and h29v09). Read as the Cloud Optimized GeoTIFF copies on Microsoft Planetary Computer (STAC collection
  modis-14A1-061; free, no login). Each file holds 8 days; the file's own "Dates" metadata says which band is which day.
- The VIIRS S-NPP 375 m hotspots the page already draws (public/ka-data/kalteng_<year>_season.json).
- District polygons: geoBoundaries gbOpen IDN ADM2, simplified (CC BY 3.0 IGO; source BPS, WFP, OCHA ROAP).

Outputs (into <ka_data_dir>)
- visibility_kalteng_<year>.json: the rule, season totals, per-district totals and per-day totals.
- vis<year>/<YYYY-MM-DD>.png: one image per day on a 0.01 degree grid over the season box, drawn only inside the 14
  districts: hatching = blind zero, dots = no data, transparent = fire, trusted zero, water or outside.
- kalteng_districts.json: the 14 district outlines, for drawing their borders. Written for 2019 (the v1.0 behaviour)
  and, for any other year, only when it does not exist yet (the outlines do not depend on the year).

Usage
  python build_visibility.py <raw_dir> <ka_data_dir> <geoboundaries_geojson> [year]
  year defaults to 2019 (the v1.0 behaviour, output unchanged). Run build_season.py for the same year first: this
  script reads <ka_data_dir>/kalteng_<year>_season.json for the VIIRS hotspots.
  (needs numpy, Pillow and tifffile; downloads the MODIS files of that season into <raw_dir>/modis14a1 once, then
  reuses them. Files of different years do not collide: the file name carries the acquisition date.)
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

import numpy as np
import tifffile
from PIL import Image, ImageDraw

YEAR = 2019   # default; main() overrides it from the optional 4th argument
START, END = date(YEAR, 8, 1), date(YEAR, 10, 31)
W, S, E, N = 110.7, -3.6, 115.9, 0.9          # the same box as kalteng_2019_season.json
STEP = 0.01
NX, NY = round((E - W) / STEP), round((N - S) / STEP)

STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
SIGN = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign'
COLLECTION = 'modis-14A1-061'
UA = {'User-Agent': 'KalenderApi-build/1.0'}

# MODIS sinusoidal grid (MODLAND)
R = 6371007.181
TILE = 1111950.5196666666
PIX = TILE / 1200
X0, Y0 = -20015109.354, 10007554.677

DISTRICTS = [
    'Barito Selatan', 'Barito Timur', 'Barito Utara', 'Gunung Mas', 'Kapuas', 'Katingan', 'Kota Palangka Raya',
    'Kotawaringin Barat', 'Kotawaringin Timur', 'Lamandau', 'Murung Raya', 'Pulang Pisau', 'Seruyan', 'Sukamara',
]

RULE = (
    'Each cell is 0.01 degree (about 1.1 km) and takes the class of the MODIS 1 km pixel at its centre. A cell-day is: '
    'FIRE when Terra or Aqua classed it fire (FireMask 7, 8 or 9) or a VIIRS hotspot shown on the map falls in it; '
    'TRUSTED ZERO when there was no fire and at least one of Terra or Aqua saw clear land (FireMask 5); '
    'BLIND ZERO when there was no fire, neither saw clear land and at least one saw cloud (FireMask 4); '
    'NO DATA when neither had a usable look (not processed 0 to 2, or unknown 6). '
    'FireMask is a daily composite of every Terra (or Aqua) pass that day, day and night, keeping the highest class, '
    'so one clear pass is enough for clear land, and an "unknown" pass can hide a clear one. '
    'Cells that were water (FireMask 3) on more days than they were clear land are left out. '
    'Blind share = blind zeros / (trusted zeros + blind zeros). Only cells inside the 14 districts are counted. '
    'Thick smoke can be classed as cloud; thinner smoke is classed as clear land, and a fire under it may or may not be '
    'detected. A trusted zero is not proof that nothing burned: small or smouldering peat fires can stay below the '
    'detection limit.'
)

F_, T_, U_, N_, OUT = 1, 2, 3, 4, 0


def get_json(url, data=None):
    req = urllib.request.Request(url, data=data, headers={**UA, 'Content-Type': 'application/json'} if data else UA)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(10 * (attempt + 1))


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def fetch_items(raw):
    """Find the MOD14A1/MYD14A1 files over the box and download each FireMask COG once."""
    body = json.dumps({'collections': [COLLECTION], 'bbox': [W, S, E, N],
                       'datetime': f'{START.isoformat()}T00:00:00Z/{END.isoformat()}T23:59:59Z', 'limit': 200}).encode()
    feats = get_json(STAC, body)['features']
    out = os.path.join(raw, 'modis14a1')
    os.makedirs(out, exist_ok=True)
    items = []
    sas = None  # the signature covers the whole storage container, so sign once and reuse it
    for it in sorted(feats, key=lambda f: f['id']):
        path = os.path.join(out, it['id'] + '.FireMask.tif')
        if not os.path.exists(path):
            href = it['assets']['FireMask']['href']
            if sas is None:
                sas = urllib.parse.urlsplit(get_json(SIGN + '?' + urllib.parse.urlencode({'href': href}))['href']).query
            signed = href + '?' + sas
            with urllib.request.urlopen(urllib.request.Request(signed, headers=UA), timeout=120) as r, \
                    open(path + '.part', 'wb') as f:
                f.write(r.read())
            os.replace(path + '.part', path)
            time.sleep(0.2)
        items.append({'id': it['id'], 'file': os.path.basename(path), 'sha256': sha256_of(path),
                      'bytes': os.path.getsize(path)})
    return items


def grid_index():
    """For every 0.01 degree cell centre: MODIS tile (v) and row/column inside the tile. All cells are in h29."""
    lon = W + (np.arange(NX) + 0.5) * STEP
    lat = N - (np.arange(NY) + 0.5) * STEP
    LON, LAT = np.meshgrid(lon, lat)
    x = R * np.radians(LON) * np.cos(np.radians(LAT))
    y = R * np.radians(LAT)
    col = np.floor((x - X0) / PIX).astype(int)
    row = np.floor((Y0 - y) / PIX).astype(int)
    h, v = col // 1200, row // 1200
    assert (h == 29).all(), 'box leaves MODIS tile column h29'
    return v, row % 1200, col % 1200


def read_firemask(raw, items, v, r, c):
    """sensor -> date -> (NY, NX) uint8 FireMask class; 255 = no file for that cell/day."""
    days = [(START + timedelta(d)).isoformat() for d in range((END - START).days + 1)]
    grids = {s: {d: np.full((NY, NX), 255, np.uint8) for d in days} for s in ('terra', 'aqua')}
    for it in items:
        sensor = 'terra' if it['id'].startswith('MOD') else 'aqua'
        tv = int(re.search(r'\.h29v(\d\d)\.', it['id']).group(1))
        sel = v == tv
        if not sel.any():
            continue
        with tifffile.TiffFile(os.path.join(raw, 'modis14a1', it['file'])) as t:
            arr = t.pages[0].asarray()
            meta = str(t.pages[0].tags['GDAL_METADATA'].value)
        dates = re.search(r'<Item name="Dates">([^<]+)</Item>', meta).group(1).split()
        assert arr.shape[:2] == (1200, 1200) and arr.shape[2] == len(dates), (it['id'], arr.shape, dates)
        for b, d in enumerate(dates):
            if d in grids[sensor]:
                grids[sensor][d][sel] = arr[r[sel], c[sel], b]
    return days, grids


def district_raster(geojson_path):
    with open(geojson_path, encoding='utf-8') as f:
        gj = json.load(f)
    feats = [f for f in gj['features'] if f['properties']['shapeName'] in DISTRICTS]
    found = sorted(f['properties']['shapeName'] for f in feats)
    assert found == sorted(DISTRICTS), f'districts found: {found}'

    def polys(g):
        return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']

    def area(ring):
        a = np.array(ring)
        return abs(np.dot(a[:-1, 0], a[1:, 1]) - np.dot(a[1:, 0], a[:-1, 1])) / 2

    def px(ring):
        return [((lon - W) / STEP, (N - lat) / STEP) for lon, lat in ring]

    # big districts first, so a district drawn later inside another's hole stays on top
    feats.sort(key=lambda f: -sum(area(p[0]) for p in polys(f['geometry'])))
    img = Image.new('L', (NX, NY), 0)
    dr = ImageDraw.Draw(img)
    out = []
    for i, f in enumerate(feats, start=1):
        for p in polys(f['geometry']):
            dr.polygon(px(p[0]), fill=i)
            for hole in p[1:]:
                dr.polygon(px(hole), fill=0)
        rings = []
        for p in polys(f['geometry']):
            for ring in p:
                kept = [ring[0]]
                for q in ring[1:]:
                    if abs(q[0] - kept[-1][0]) + abs(q[1] - kept[-1][1]) >= 0.004:
                        kept.append(q)
                if kept[-1] != ring[-1]:
                    kept.append(ring[-1])
                if len(kept) >= 4:
                    rings.append([[round(a, 3), round(b, 3)] for a, b in kept])
        out.append({'id': i, 'name': f['properties']['shapeName'], 'shapeID': f['properties']['shapeID'],
                    'type': f['properties']['shapeType'], 'rings': rings})
        xs = [q[0] for r_ in rings for q in r_]
        ys = [q[1] for r_ in rings for q in r_]
        if min(xs) < W or max(xs) > E or min(ys) < S or max(ys) > N:
            print(f'warning: {f["properties"]["shapeName"]} reaches outside the box', file=sys.stderr)
    return np.array(img), out


def write_png(path, idx):
    # 0 transparent, 1 dark hatch line, 2 light hatch line, 3 no-data dot
    im = Image.frombytes('P', (idx.shape[1], idx.shape[0]), idx.astype(np.uint8).tobytes())
    im.putpalette([0, 0, 0, 30, 42, 51, 243, 238, 223, 152, 160, 163] + [0, 0, 0] * 252)
    im.save(path, optimize=True, transparency=bytes([0, 225, 205, 210] + [0] * 252))


def pct(a, b):
    return None if b == 0 else round(100 * a / b, 1)


def main():
    global YEAR, START, END
    raw, ka, geo = sys.argv[1], sys.argv[2], sys.argv[3]
    YEAR = int(sys.argv[4]) if len(sys.argv) > 4 else YEAR
    START, END = date(YEAR, 8, 1), date(YEAR, 10, 31)
    items = fetch_items(raw)
    print(f'{len(items)} MODIS files', file=sys.stderr)
    v, r, c = grid_index()
    days, grids = read_firemask(raw, items, v, r, c)
    dist, outlines = district_raster(geo)
    inside = dist > 0

    with open(os.path.join(ka, f'kalteng_{YEAR}_season.json'), encoding='utf-8') as f:
        season = json.load(f)
    viirs = {}
    for d in season['days']:
        m = np.zeros((NY, NX), bool)
        for lon, lat, *_ in d['pts']:
            i, j = int((lon - W) / STEP), int((N - lat) / STEP)
            if 0 <= i < NX and 0 <= j < NY:
                m[j, i] = True
        viirs[d['date']] = m

    T, A = grids['terra'], grids['aqua']
    n3 = sum((T[d] == 3).astype(int) + (A[d] == 3) for d in days)
    n5 = sum((T[d] == 5).astype(int) + (A[d] == 5) for d in days)
    land = inside & ~(n3 > n5)

    os.makedirs(os.path.join(ka, f'vis{YEAR}'), exist_ok=True)
    jj, ii = np.mgrid[0:NY, 0:NX]
    hatch_dark = (ii + jj) % 5 == 0
    hatch_light = (ii + jj) % 5 == 1
    dots = (ii % 3 == 1) & (jj % 3 == 1)

    tot = dict(F=0, T=0, U=0, N=0)
    by_d = {o['id']: dict(F=0, T=0, U=0, N=0) for o in outlines}
    order = sorted(outlines, key=lambda o: o['name'])   # the order of "districts" and of each day's "d"
    f_viirs_only = one_clear = some_clear = unknown_n = 0
    out_days = []
    for d in days:
        t, a = T[d], A[d]
        mfire = np.isin(t, (7, 8, 9)) | np.isin(a, (7, 8, 9))
        fire = mfire | viirs.get(d, np.zeros((NY, NX), bool))
        tc, ac = t == 5, a == 5
        clear = tc | ac
        cloud = (t == 4) | (a == 4)
        st = np.where(fire, F_, np.where(clear, T_, np.where(cloud, U_, N_)))
        st = np.where(land, st, OUT)

        counts = {k: int((st == val).sum()) for k, val in (('F', F_), ('T', T_), ('U', U_), ('N', N_))}
        for k in tot:
            tot[k] += counts[k]
        today = {}
        for o in outlines:
            sel = st[dist == o['id']]
            for k, val in (('F', F_), ('T', T_), ('U', U_), ('N', N_)):
                c_ = int((sel == val).sum())
                by_d[o['id']][k] += c_
                today[(o['id'], k)] = c_
        f_viirs_only += int((land & fire & ~mfire).sum())
        zc = land & ~fire & clear
        some_clear += int(zc.sum())
        one_clear += int((zc & (tc ^ ac)).sum())
        unknown_n += int((land & (st == N_) & ((t == 6) | (a == 6))).sum())

        idx = np.zeros((NY, NX), np.uint8)
        idx[(st == U_) & hatch_dark] = 1
        idx[(st == U_) & hatch_light] = 2
        idx[(st == N_) & dots] = 3
        write_png(os.path.join(ka, f'vis{YEAR}', f'{d}.png'), idx)

        usable = lambda g: round(100 * float((land & np.isin(g, (4, 5, 7, 8, 9))).sum()) / max(1, int(land.sum())), 1)
        out_days.append({'date': d, **counts, 'blind': pct(counts['U'], counts['T'] + counts['U']),
                         'terra_seen': usable(t), 'aqua_seen': usable(a),
                         'd': [[today[(o['id'], 'T')], today[(o['id'], 'U')]] for o in order]})

    daily = np.array([x['blind'] for x in out_days if x['blind'] is not None])
    zero_days = tot['T'] + tot['U']
    result = {
        'title': f'What could Terra and Aqua see? Central Kalimantan, 1 Aug to 31 Oct {YEAR}',
        'rule': RULE,
        'grid': {'bbox': [W, S, E, N], 'step_deg': STEP, 'width': NX, 'height': NY, 'land_cells': int(land.sum()),
                 'note': 'Images are drawn only inside the 14 districts; water cells are left out.'},
        'season': {**tot, 'blind': pct(tot['U'], zero_days),
                   'daily_blind_median': round(float(np.median(daily)), 1),
                   'daily_blind_q1': round(float(np.percentile(daily, 25)), 1),
                   'daily_blind_q3': round(float(np.percentile(daily, 75)), 1),
                   'nodata_pct': pct(tot['N'], sum(tot.values())),
                   'nodata_from_unknown_pct': pct(unknown_n, tot['N']),
                   'fire_from_viirs_only_pct': pct(f_viirs_only, tot['F']),
                   'one_sensor_only_clear_pct': pct(one_clear, some_clear)},
        'districts': [{'name': o['name'], **by_d[o['id']],
                       'blind': pct(by_d[o['id']]['U'], by_d[o['id']]['T'] + by_d[o['id']]['U'])} for o in order],
        'days_d_note': 'Each day\'s "d" lists [trusted zeros, blind zeros] per district, in the order of "districts".',
        'days': out_days,
        'source': {
            'firemask': {
                'product': 'MODIS MOD14A1 (Terra) and MYD14A1 (Aqua) Collection 6.1, FireMask, NASA LP DAAC',
                'doi': ['https://doi.org/10.5067/MODIS/MOD14A1.061', 'https://doi.org/10.5067/MODIS/MYD14A1.061'],
                'access': 'Microsoft Planetary Computer, STAC collection modis-14A1-061 (Cloud Optimized GeoTIFF '
                          'copies of the NASA files)',
                'read_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                'items': items,
            },
            'hotspots': f'kalteng_{YEAR}_season.json (NASA FIRMS VIIRS S-NPP 375 m), the points the map draws',
            'districts': {
                'name': 'geoBoundaries gbOpen IDN ADM2 (simplified), build 12 Dec 2023, from BPS, WFP and OCHA ROAP',
                'license': 'CC BY 3.0 IGO',
                'url': 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/'
                       'geoBoundaries-IDN-ADM2_simplified.geojson',
                'sha256': sha256_of(geo),
            },
        },
    }
    with open(os.path.join(ka, f'visibility_kalteng_{YEAR}.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, separators=(',', ':'))
    districts_path = os.path.join(ka, 'kalteng_districts.json')
    if YEAR == 2019 or not os.path.exists(districts_path):   # the outlines do not depend on the year
        with open(districts_path, 'w', encoding='utf-8') as f:
            json.dump({'source': result['source']['districts'],
                       'districts': [{k: o[k] for k in ('name', 'shapeID', 'type', 'rings')} for o in outlines]},
                      f, separators=(',', ':'))
    print(json.dumps(result['season']), file=sys.stderr)
    for x in result['districts']:
        print(f"{x['name']:20s} blind {x['blind']}%  F {x['F']} T {x['T']} U {x['U']} N {x['N']}", file=sys.stderr)


if __name__ == '__main__':
    main()
