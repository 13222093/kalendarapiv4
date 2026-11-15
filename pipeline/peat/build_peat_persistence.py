"""KalenderApi: peat persistence index for Central Kalimantan (persistence of fire activity on peat).

Question it serves: after the hotspots vanish, where should a Manggala Agni crew go back and re-check?

For every built Aug to Oct season except 2019 it snaps the VIIRS hotspots of kalteng_<Y>_season.json to the 0.01 degree
grid of build_visibility.py, finds the cells on peat where fire was detected day after day or came back after a gap, and
classes each gap by what Terra and Aqua could see of that cell on the gap days (MODIS FireMask, the files that
build_visibility.py cached and listed in visibility_kalteng_<Y>.json).

Counts and classes only. Nothing here says that fire was present during a gap, under cloud or otherwise; nothing is
estimated or forecast. This is exploratory and is not the registered re-appearance test.

2019 is locked by a registered test: no file with 2019 in its name is opened, and no MODIS file dated 2019 is read.

Outputs
- <ka_data_dir>/peat_persistence_kalteng.json
- <ka_data_dir>/peat_kalteng.geojson (the peat polygons clipped to the season box and simplified, for drawing)

Usage (venv python of docs/DATA.md section 2: numpy, tifffile, Pillow, shapely, geopandas)
  python -I pipeline/peat/build_peat_persistence.py <raw_dir> <ka_data_dir> <geoboundaries_geojson> <peat_geojson> <districts_index_json>
"""
import hashlib
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone

import numpy as np
import shapely
from shapely.geometry import box, mapping

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'visibility'))   # -I does not add the script folder
import build_visibility as bv  # noqa: E402  (grid, sinusoidal index and FireMask reader are reused, not copied)

LOCKED = 2019
W_M, N_M = 110700, 900            # west and north edge of the box in thousandths of a degree
NX, NY = bv.NX, bv.NY             # 520 x 450 cells of 0.01 degree
GAP_MIN = 2                       # a gap is a run of this many or more days with no detection
DAYS_MIN = 3                      # detected on this many or more days in the season
TOP_N = 40
F_, T_, U_, N_ = 1, 2, 3, 4
CLASSES = ('under_cloud', 'seen_quiet', 'no_data', 'modis_fire')
MAX_GEOJSON_BYTES = 1_500_000

RULE = (
    'A persistent peat site is a 0.01 degree cell (about 1.1 km) whose centre lies on peat and where, within one '
    'season (1 Aug to 31 Oct), VIIRS S-NPP detected fire on three or more days, or fire was detected again after at '
    'least one gap. A gap is a run of two or more days in a row with no VIIRS detection in the cell, between two days '
    'with a detection. Each gap is one come-back.'
)
DEFINITIONS = {
    'cell': 'The 0.01 degree grid of the visibility layer: box 110.7 to 115.9 E, -3.6 to 0.9 N. A hotspot belongs to '
            'the cell with column floor((lon - 110.7) / 0.01) and row floor((0.9 - lat) / 0.01), computed on whole '
            'thousandths of a degree. lon and lat of a site are the cell centre.',
    'peat': 'The cell centre lies inside a polygon of the Global Forest Watch Indonesia peat lands layer (the source '
            'polygons, not the simplified ones drawn on the map).',
    'district': 'The cell centre lies inside the district outline (geoBoundaries gbOpen ADM2). Only the 14 districts '
                'of Central Kalimantan are counted.',
    'days_detected': 'Number of days (FIRMS acq_date, UTC) in the season with at least one VIIRS hotspot in the cell. '
                     'Hotspots are the ones in the season file: type 0, confidence nominal or high.',
    'night_share': 'Night detections divided by all detections of the cell in the season (0 to 1, 2 decimals).',
    'gap': 'A run of two or more days in a row with no VIIRS detection in the cell, between two detection days of the '
           'same season. There is no upper limit on its length inside the season. In a site, each gap gives "from" '
           'and "to" (first and last day with no detection), "days", "class", and "missing_sensor_file": true when '
           'the catalogue had no file of Terra or Aqua (or both) for one of its days.',
    'under_cloud_with_a_day_without_a_modis_sensor_file': 'Per season: the "under_cloud" gaps with at least one day '
                                                          'on which only one MODIS sensor had a file, so that class '
                                                          'rests on a single sensor there.',
    'come_backs': 'Number of gaps of the cell in the season: the fire activity was detected again after each of them.',
    'gap_day_look': 'What Terra and Aqua recorded for the cell on a gap day (MODIS FireMask of the 1 km pixel at the '
                    'cell centre, daily composite of all passes): fire when either classed it fire (7, 8, 9); else a '
                    'cloud-free look with no fire when either saw clear land (5); else cloud when either saw cloud '
                    '(4); else no usable look (not processed, water, unknown, or no file that day).',
    'under_cloud': 'No gap day had a cloud-free look: on every gap day the cell was classed cloud. The quiet days of '
                   'this gap were not observed, so the zero should not have been trusted.',
    'seen_quiet': 'At least one gap day had a cloud-free look with no fire, and MODIS classed no gap day as fire. The '
                  'place was looked at, nothing was detected, and fire activity was detected again later.',
    'no_data': 'Neither of the above and no MODIS fire: no gap day had a cloud-free look and at least one gap day had '
               'no usable look at all.',
    'modis_fire': 'Terra or Aqua classed the cell as fire on at least one gap day, so the gap exists only in the '
                  'VIIRS record. Counted apart; these gaps are in none of the three classes above.',
    'peat_cells_with_fire': 'Peat cells of the district with at least one VIIRS detection in the season.',
    'persistent_peat_sites': 'Peat cells of the district that meet the rule in that season.',
    'top_sites': 'Persistent peat sites of the most recent season in which the district has any, ranked by days '
                 'detected, then by come-backs (ties: west to east, then north to south). At most 40 per district; '
                 '"persistent_peat_sites_in_that_season" gives the number before the cut.',
}
NOTES = {
    'wording': 'This describes persistence of fire activity on peat as the satellites recorded it. It does not say '
               'that fire was present during a gap, under cloud or anywhere else, and it is not a forecast.',
    'smoke': 'Thick smoke is usually not flagged as cloud in the MODIS fire mask. A gap day under thick smoke can be '
             'recorded as a cloud-free look with no fire, so "seen quiet" does not prove the ground was visible, and '
             '"under cloud" is a lower bound of the gaps with no clear view.',
    'exploratory': 'Exploratory description, written after looking at the data. It is not the registered '
                   're-appearance test: the rule differs (0.01 degree cells, any gap of two or more days) and 2019, '
                   'the season that test locks, is left out entirely and was not read.',
    'detection_limit': 'A cloud-free look with no fire is not proof that nothing burned: small or smouldering peat '
                       'fires can stay below the detection limit of both sensors.',
    'provisional': 'The 2026 season comes from near-real-time FIRMS data and is provisional. From 16 to 31 October '
                   '2026 the catalogue has no file of one or both MODIS sensors for part or all of the box, so the '
                   'class of a gap there rests on one sensor or on none. Each season entry counts the "under_cloud" '
                   'gaps of that kind, and such gaps carry "missing_sensor_file" in a site.',
    'season_edges': 'Only 1 Aug to 31 Oct is looked at. A detection before 1 Aug or after 31 Oct is not seen, so a '
                    'site can have more days and more gaps than counted here.',
}


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def built_seasons(ka):
    """Years with both kalteng_<Y>_season.json and visibility_kalteng_<Y>.json, never 2019 (name is not opened)."""
    years = []
    for name in sorted(os.listdir(ka)):
        m = re.fullmatch(r'kalteng_(\d{4})_season\.json', name)
        if not m or int(m.group(1)) == LOCKED:
            continue
        if os.path.exists(os.path.join(ka, f'visibility_kalteng_{m.group(1)}.json')):
            years.append(int(m.group(1)))
    assert LOCKED not in years
    return years


def cell_of(lon, lat):
    return (N_M - round(lat * 1000)) // 10, (round(lon * 1000) - W_M) // 10     # row from the north, column


def centre(j, i):
    return (W_M + 10 * i + 5) / 1000, (N_M - 10 * j - 5) / 1000                 # lon, lat


def grid_masks(geo_path, peat_path):
    """District number (1..14, 0 = none) and peat flag for every cell centre; also the peat polygons in the box."""
    import geopandas as gpd
    lon = (W_M + 10 * np.arange(NX) + 5) / 1000
    lat = (N_M - 10 * np.arange(NY) - 5) / 1000
    LON, LAT = np.meshgrid(lon, lat)
    pts = shapely.points(LON.ravel(), LAT.ravel())
    tree = shapely.STRtree(pts)

    g = gpd.read_file(geo_path)
    g = g[g['shapeName'].isin(bv.DISTRICTS)].sort_values('shapeName').reset_index(drop=True)
    assert list(g['shapeName']) == sorted(bv.DISTRICTS), list(g['shapeName'])
    dist = np.zeros(NX * NY, np.int16)
    pi, ci = tree.query(shapely.make_valid(g.geometry.values), predicate='contains')
    assert len(np.unique(ci)) == len(ci), 'a cell centre lies in two districts'
    dist[ci] = pi + 1

    p = gpd.read_file(peat_path)
    n_all = len(p)
    bb = box(bv.W, bv.S, bv.E, bv.N)
    p = p[p.intersects(bb)].reset_index(drop=True)
    geoms = shapely.make_valid(p.geometry.values)
    peat = np.zeros(NX * NY, bool)
    _, ci = tree.query(geoms, predicate='contains')
    peat[ci] = True
    return (dist.reshape(NY, NX), list(g['shapeName']), peat.reshape(NY, NX),
            [(int(o), gm) for o, gm in zip(p['objectid'], geoms)], n_all, bb)


def write_peat_geojson(path, polys, bb, licence, src):
    """Clip to the box, simplify until the file is under the size limit, 4 decimals."""
    def rnd(c):
        return [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

    for tol in (0.0, 0.0005, 0.001, 0.002, 0.003, 0.004, 0.005, 0.0075, 0.01, 0.015, 0.02):   # 0 = clip only
        feats = []
        for oid, gm in polys:
            cl = shapely.intersection(gm, bb)
            parts = [x for x in shapely.get_parts(cl) if x.geom_type in ('Polygon', 'MultiPolygon')] \
                if cl.geom_type == 'GeometryCollection' else [cl]
            for part in parts:
                if part.is_empty or part.geom_type not in ('Polygon', 'MultiPolygon'):
                    continue
                s = part.simplify(tol, preserve_topology=True) if tol else part
                if s.is_empty:
                    continue
                m = mapping(s)
                feats.append({'type': 'Feature', 'properties': {'objectid': oid},
                              'geometry': {'type': m['type'], 'coordinates': rnd(m['coordinates'])}})
        doc = {
            'type': 'FeatureCollection',
            'name': 'peat_kalteng',
            'source': src,
            'license': licence,
            'bbox': [bv.W, bv.S, bv.E, bv.N],
            'note': 'Peat polygons clipped to the box around Central Kalimantan (not the province outline), '
                    + (f'simplified with a tolerance of {tol} degree, ' if tol else 'not simplified further, ')
                    + 'coordinates to 4 decimals, for drawing only. The source layer was itself downloaded with a '
                    'generalisation of 0.002 degree. The peat test of peat_persistence_kalteng.json uses the source '
                    'polygons, so a site near an edge can sit just outside the drawn outline.',
            'simplify_tolerance_deg': tol,
            'features': feats,
        }
        text = json.dumps(doc, separators=(',', ':'))
        if len(text.encode('utf-8')) <= MAX_GEOJSON_BYTES:
            break
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return tol, len(feats), os.path.getsize(path)


def season_cells(ka, year):
    """(row, col) -> {day index: [detections, night detections]} from the season file."""
    assert year != LOCKED
    path = os.path.join(ka, f'kalteng_{year}_season.json')
    with open(path, encoding='utf-8') as f:
        s = json.load(f)
    days = [d['date'] for d in s['days']]
    start = date(year, 8, 1)
    assert days == [(start + timedelta(k)).isoformat() for k in range(92)], f'{path} is not 1 Aug to 31 Oct'
    cells, outside, n = {}, 0, 0
    for di, d in enumerate(s['days']):
        for lon, lat, _frp, night in d['pts']:
            n += 1
            j, i = cell_of(lon, lat)
            if not (0 <= i < NX and 0 <= j < NY):
                outside += 1          # exactly on the east or south edge of the box
                continue
            e = cells.setdefault((j, i), {}).setdefault(di, [0, 0])
            e[0] += 1
            e[1] += night
    return days, cells, n, outside, bool(s['source'].get('provisional')), sha256_of(path)


def gap_day_looks(raw, ka, year, days, keys, grid_idx):
    """states[day, k] for the cells in keys: F_, T_, U_ or N_ from the cached FireMask files of that season."""
    assert year != LOCKED
    vpath = os.path.join(ka, f'visibility_kalteng_{year}.json')
    with open(vpath, encoding='utf-8') as f:
        vis = json.load(f)
    items = vis['source']['firemask']['items']
    for it in items:
        assert re.search(r'\.A(\d{4})\d{3}\.', it['id']).group(1) != str(LOCKED), it['id']
        fp = os.path.join(raw, 'modis14a1', it['file'])
        assert sha256_of(fp) == it['sha256'], f'{it["file"]} differs from the file the visibility layer used'
    bv.YEAR, bv.START, bv.END = year, date(year, 8, 1), date(year, 10, 31)
    v, r, c = grid_idx
    days2, grids = bv.read_firemask(raw, items, v, r, c)
    assert days2 == days
    jj = np.array([k[0] for k in keys], int)
    ii = np.array([k[1] for k in keys], int)
    st = np.empty((len(days), len(keys)), np.uint8)
    for di, d in enumerate(days):
        t, a = grids['terra'][d][jj, ii], grids['aqua'][d][jj, ii]
        fire = np.isin(t, (7, 8, 9)) | np.isin(a, (7, 8, 9))
        clear = (t == 5) | (a == 5)
        cloud = (t == 4) | (a == 4)
        st[di] = np.where(fire, F_, np.where(clear, T_, np.where(cloud, U_, N_)))
    no_file = vis.get('no_file_days', {}).get('days', {})
    return st, len(items), sha256_of(vpath), sorted(no_file)


def gap_class(seg):
    if (seg == F_).any():
        return 'modis_fire'
    if (seg == T_).any():
        return 'seen_quiet'
    if (seg == U_).all():
        return 'under_cloud'
    return 'no_data'


def empty_counts():
    return {'total': 0, **{k: 0 for k in CLASSES}}


def main():
    t0 = time.time()
    raw, ka, geo, peat_path, index_path = sys.argv[1:6]
    for a in sys.argv[1:]:
        assert str(LOCKED) not in os.path.basename(a)
    with open(peat_path + '.source.json', encoding='utf-8') as f:
        peat_src = json.load(f)
    licence = peat_src['license']
    assert sha256_of(peat_path) == peat_src['sha256']
    with open(index_path, encoding='utf-8') as f:
        index = json.load(f)
    aoi = {d['name']: d for d in index['districts'] if d['province'] == 'Kalimantan Tengah'}
    assert sorted(aoi) == sorted(bv.DISTRICTS), sorted(aoi)

    dist, names, peat, polys, n_peat_all, bb = grid_masks(geo, peat_path)
    grid_idx = bv.grid_index()
    years = built_seasons(ka)

    seasons_out, inputs = [], []
    per = {nm: [] for nm in names}             # district -> one entry per season
    sites = {nm: {} for nm in names}           # district -> year -> list of persistent peat sites
    for y in years:
        days, cells, n_pts, outside, provisional, season_sha = season_cells(ka, y)
        keys = [k for k in sorted(cells) if peat[k] and dist[k] > 0]
        st, n_items, vis_sha, no_file = gap_day_looks(raw, ka, y, days, keys, grid_idx)
        tot = {'peat_cells_with_fire': 0, 'persistent_peat_sites': 0, 'come_backs': empty_counts()}
        by_d = {nm: {'peat_cells_with_fire': 0, 'persistent_peat_sites': 0, 'come_backs': empty_counts()}
                for nm in names}
        nf, uc_missing = set(no_file), 0
        for col, k in enumerate(keys):
            nm = names[dist[k] - 1]
            dd = sorted(cells[k])
            gaps = []
            for a, b in zip(dd, dd[1:]):
                if b - a - 1 >= GAP_MIN:
                    gaps.append({'from': days[a + 1], 'to': days[b - 1], 'days': b - a - 1,
                                 'class': gap_class(st[a + 1:b, col])})
                    if any(x in nf for x in days[a + 1:b]):      # a gap day without a file of one or both sensors
                        gaps[-1]['missing_sensor_file'] = True
                        uc_missing += gaps[-1]['class'] == 'under_cloud'
            cb = empty_counts()
            for gp in gaps:
                cb['total'] += 1
                cb[gp['class']] += 1
            persistent = len(dd) >= DAYS_MIN or len(gaps) >= 1
            for tgt in (tot, by_d[nm]):
                tgt['peat_cells_with_fire'] += 1
                tgt['persistent_peat_sites'] += persistent
                for kk in cb:
                    tgt['come_backs'][kk] += cb[kk]
            if persistent:
                n_det = sum(cells[k][d][0] for d in dd)
                n_night = sum(cells[k][d][1] for d in dd)
                lon, lat = centre(*k)
                sites[nm].setdefault(y, []).append({
                    'lon': lon, 'lat': lat, 'days_detected': len(dd), 'first_date': days[dd[0]],
                    'last_date': days[dd[-1]], 'come_backs': cb, 'night_share': round(n_night / n_det, 2),
                    'detections': n_det, 'gaps': gaps,
                })
        label = {'season': y, 'window': f'{y}-08-01 to {y}-10-31', 'provisional': provisional}
        seasons_out.append({**label, **tot,
                            'cells_with_fire_any_land': sum(1 for k in cells if dist[k] > 0),
                            'days_without_a_modis_sensor_file': len(no_file),
                            'under_cloud_with_a_day_without_a_modis_sensor_file': uc_missing})
        for nm in names:
            per[nm].append({'season': y, 'provisional': provisional, **by_d[nm]})
        inputs.append({'season': y, 'season_file': f'kalteng_{y}_season.json', 'season_sha256': season_sha,
                       'hotspots_in_file': n_pts, 'hotspots_on_the_box_edge_left_out': outside,
                       'visibility_file': f'visibility_kalteng_{y}.json', 'visibility_sha256': vis_sha,
                       'firemask_files_read': n_items})
        print(y, json.dumps(tot), file=sys.stderr)

    districts = []
    for nm in names:
        with_sites = [y for y in years if sites[nm].get(y)]
        top_year = max(with_sites) if with_sites else None
        ranked = sorted(sites[nm].get(top_year, []),
                        key=lambda s: (-s['days_detected'], -s['come_backs']['total'], s['lon'], -s['lat']))
        districts.append({
            'aoi_id': aoi[nm]['aoi_id'], 'name': nm, 'province': aoi[nm]['province'],
            'peat_cells': int((peat & (dist == names.index(nm) + 1)).sum()),
            'seasons': per[nm],
            'top_sites_season': top_year,
            'top_sites_provisional': None if top_year is None else bool(
                next(s['provisional'] for s in seasons_out if s['season'] == top_year)),
            'persistent_peat_sites_in_that_season': len(ranked),
            'top_sites': ranked[:TOP_N],
        })

    total = {'peat_cells_with_fire': 0, 'persistent_peat_sites': 0, 'come_backs': empty_counts()}
    for s in seasons_out:
        total['peat_cells_with_fire'] += s['peat_cells_with_fire']
        total['persistent_peat_sites'] += s['persistent_peat_sites']
        for kk in total['come_backs']:
            total['come_backs'][kk] += s['come_backs'][kk]

    peat_out = os.path.join(ka, 'peat_kalteng.geojson')
    src_line = ('Global Forest Watch, Indonesia peat lands (original: Kementan/BBSDLP peat map), '
                + peat_src['source_url'])
    tol, n_feat, gj_bytes = write_peat_geojson(peat_out, polys, bb, licence, src_line)

    doc = {
        'title': 'Peat persistence index, Central Kalimantan: persistence of fire activity on peat, 1 Aug to 31 Oct',
        'generated_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'rule': RULE,
        'decision': 'Where a Manggala Agni crew should go back and re-check after the hotspots vanish.',
        'definitions': DEFINITIONS,
        'notes': NOTES,
        'seasons_included': years,
        'seasons_not_included': {str(LOCKED): 'Locked by a registered test (Central Kalimantan and Pulang Pisau, 1 Jan '
                                              'to 31 Oct 2019). Not read, not computed, not emitted.',
                                 '2025': 'No season file was built for Aug to Oct 2025.'},
        'come_back_classes': list(CLASSES),
        'grid': {'bbox': [bv.W, bv.S, bv.E, bv.N], 'step_deg': bv.STEP, 'width': NX, 'height': NY,
                 'peat_cells_in_the_14_districts': int((peat & (dist > 0)).sum())},
        'totals_note': 'Sums over the 14 districts. "total" adds the seasons up, so a cell that qualifies in three '
                       'seasons is counted three times there (site-seasons).',
        'total': {'seasons': len(years), **total},
        'seasons': seasons_out,
        'districts': districts,
        'sources': {
            'hotspots': 'NASA FIRMS VIIRS S-NPP 375 m, as filtered in app/public/ka-data/kalteng_<Y>_season.json '
                        '(standard processing; 2026 near-real-time, provisional)',
            'cloud_states': 'NASA MODIS MOD14A1 (Terra) and MYD14A1 (Aqua) Collection 6.1 FireMask, the files listed '
                            'in visibility_kalteng_<Y>.json (each checked against its recorded sha256), read with '
                            'pipeline/visibility/build_visibility.py',
            'peat': {'name': src_line, 'file': 'data-raw/ss/support/peat/' + peat_src['file'],
                     'sha256': peat_src['sha256'], 'downloaded_utc': peat_src['downloaded_utc'],
                     'polygons_in_file': n_peat_all, 'polygons_touching_the_box': len(polys),
                     'license': licence,
                     'drawn_copy': {'file': 'peat_kalteng.geojson', 'features': n_feat, 'bytes': gj_bytes,
                                    'simplify_tolerance_deg': tol}},
            'districts': {'name': 'geoBoundaries gbOpen IDN ADM2 (simplified), from BPS, WFP and OCHA ROAP',
                          'license': 'CC BY 3.0 IGO', 'sha256': sha256_of(geo),
                          'ids': 'aoi_id, name and province as in app/public/ss-data/districts/index.json'},
            'per_season': inputs,
            'built_by': 'kalenderapi-v4-integrated/pipeline/peat/build_peat_persistence.py',
        },
    }
    out = os.path.join(ka, 'peat_persistence_kalteng.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    print(json.dumps({'out_bytes': os.path.getsize(out), 'out_sha256': sha256_of(out), 'geojson_bytes': gj_bytes,
                      'geojson_sha256': sha256_of(peat_out), 'geojson_features': n_feat, 'geojson_tolerance': tol,
                      'total': doc['total'], 'seconds': round(time.time() - t0, 1)}, indent=1))


if __name__ == '__main__':
    main()
