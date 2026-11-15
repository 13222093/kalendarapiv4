"""Project 4: count the district-days of Central Kalimantan with no cloud-free look for most of the district.

Reads the per-day, per-district totals that build_visibility.py stored in app/public/ka-data/visibility_kalteng_*.json
("d": [trusted zeros T, blind zeros U] per district) and writes app/public/ka-data/blind_rule_kalteng.json.

Rule: a district-day counts when U / (T + U) > 0.5, that is when more than half of the district's no-fire cell-days of
that day had no cloud-free look from Terra or Aqua (cloud in the MODIS FireMask).

- Every visibility file in the folder is used except 2019: a file with "2019" in its name is never opened (a registered
  test of a sibling project locks that season).
- Days for which the catalogue had no FireMask file of one sensor ("no_file_days" in the visibility file) are left out,
  so every counted day had a look from both Terra and Aqua.
- "total", "districts" and "seasons" hold the Aug to Oct seasons only. Any other window (the Jan to Mar 2023 wet-season
  quarter) is kept apart under "wet_season_contrast", so the two are never added up unnoticed.
- Per season it also names the single counted day with the highest share of no-fire cell-days with no cloud-free look.
- Nothing about re-appearing fires or hidden fire is computed here.

Usage: python -I build_blind_rule.py <ka_data_dir>
"""
import glob
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

THRESHOLD = 0.5
LOCKED = '2019'


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def tally():
    return {'district_days_above': 0, 'district_days': 0}


def add(t, k, n):
    t['district_days_above'] += k
    t['district_days'] += n


def done(t):
    return {**t, 'share_pct': None if t['district_days'] == 0 else round(100 * t['district_days_above'] / t['district_days'], 1)}


def block(seasons, names):
    """Totals and per-district totals over a list of season entries."""
    tot, by_d = tally(), {nm: tally() for nm in names}
    for s in seasons:
        add(tot, s['district_days_above'], s['district_days'])
        for d in s['districts']:
            add(by_d[d['name']], d['district_days_above'], d['district_days'])
    return {'seasons': len(seasons), **done(tot)}, [{'name': nm, **done(by_d[nm])} for nm in names]


def main():
    ka = sys.argv[1]
    files = sorted(glob.glob(os.path.join(ka, 'visibility_kalteng_*.json')))
    files = [f for f in files if LOCKED not in os.path.basename(f)]          # the 2019 file is never opened
    seasons, names = [], None
    undefined = 0
    for path in files:
        base = os.path.basename(path)
        sid = re.fullmatch(r'visibility_kalteng_(\d{4}(?:_[a-z0-9]+)?)\.json', base).group(1)
        with open(path, encoding='utf-8') as f:
            doc = json.load(f)
        dn = [x['name'] for x in doc['districts']]
        names = names or dn
        assert dn == names, f'{base}: district order differs'
        first, last = doc['days'][0]['date'], doc['days'][-1]['date']
        no_file = doc.get('no_file_days', {}).get('days', {})
        s_t, s_d = tally(), [tally() for _ in names]
        worst, counted = None, 0
        for day in doc['days']:
            if day['date'] in no_file:
                continue
            counted += 1
            for i, (t, u) in enumerate(day['d']):
                if t + u == 0:
                    undefined += 1
                    continue
                k = 1 if u / (t + u) > THRESHOLD else 0
                add(s_t, k, 1)
                add(s_d[i], k, 1)
            zero = day['T'] + day['U']
            if zero and (worst is None or day['U'] / zero > worst[0]):
                worst = (day['U'] / zero, day)
        w = worst[1]
        seasons.append({
            'year': int(sid[:4]), 'season': sid, 'window': doc['title'].split('Central Kalimantan, ')[1],
            'aug_oct': first[5:] == '08-01' and last[5:] == '10-31',
            'file': base, 'sha256': sha256_of(path),
            'days': len(doc['days']), 'days_counted': counted,
            'days_left_out': [{'date': d, 'no_file_from': s} for d, s in sorted(no_file.items())],
            **done(s_t),
            'worst_day': {
                'date': w['date'],
                'share_no_cloud_free_look': round(worst[0], 4),
                'fire_cells': w['F'],
                'no_fire_cells_with_cloud_free_look': w['T'],
                'no_fire_cells_no_cloud_free_look': w['U'],
            },
            'districts': [{'name': nm, **done(s_d[i])} for i, nm in enumerate(names)],
        })
    dry = [s for s in seasons if s['aug_oct']]
    wet = [s for s in seasons if not s['aug_oct']]
    total, districts = block(dry, names)
    wet_total, wet_districts = block(wet, names)
    all_total, _ = block(seasons, names)
    out = {
        'title': 'Central Kalimantan: district-days with no cloud-free look (cloud) for most of the district',
        'rule': 'A district-day counts when more than half of the no-fire cell-days of the district on that day had '
                'no cloud-free look from Terra or Aqua, because of cloud: U / (T + U) > 0.5.',
        'threshold': THRESHOLD,
        'definition': {
            'cell_day': 'One 0.01 degree cell on one UTC day, classed from the MODIS FireMask of Terra and Aqua. '
                        'T: no fire and at least one cloud-free look at the land. U: no fire and no cloud-free look, '
                        'with cloud in at least one of the two masks. Cells with fire or with no data are in neither.',
            'district_day': 'One of the 14 districts on one day. It counts (district_days_above) when U / (T + U) > '
                            f'{THRESHOLD}: cloud left more than half of its no-fire cells with no cloud-free look.',
            'district_days': 'All counted district-days: the number that the days with no cloud-free look (cloud) are '
                             f'out of. {undefined} district-days had no no-fire cell at all and are in neither number.',
            'days_counted': 'Only days with a FireMask file of both Terra and Aqua for the whole box are counted, so '
                            'each counted day had the same chances of a cloud-free look; a day with no cloud-free look '
                            'for lack of a file is listed under days_left_out and is not counted.',
            'worst_day': 'Per season, the single counted day with the highest share of no-fire cell-days with no '
                         'cloud-free look (cloud), over all 14 districts together: U / (T + U) of that day, with the '
                         'number of fire cells (F) of the same day.',
            'scope': 'total, districts and seasons hold the Aug to Oct seasons only; the Jan to Mar 2023 quarter, with '
                     'far more cloud and so far more days with no cloud-free look, is kept apart under '
                     'wet_season_contrast.',
        },
        'lower_bound_note': 'Thick smoke is not flagged as cloud by the MODIS FireMask, so a day under thick smoke is '
                            'not counted here: the count is a lower bound on days with no cloud-free look.',
        'excluded': {'season': LOCKED,
                     'why': 'The 2019 season is locked by a registered test of a sibling project: no count of days with '
                            'no cloud-free look (cloud) was made for it and its file was not opened.'},
        'seasons_included': [s['season'] for s in seasons],
        'total': total,
        'districts': districts,
        'seasons': dry,
        'wet_season_contrast': {
            'note': 'Wet-season quarter for contrast: cloud is frequent, so district-days with no cloud-free look are '
                    'many. Not part of total, districts or seasons.',
            'total': wet_total, 'districts': wet_districts, 'seasons': wet,
        },
        'all_windows_total': all_total,
        'source': {'built_by': 'kalenderapi-v4-integrated/pipeline/visibility/build_blind_rule.py',
                   'input': 'visibility_kalteng_<season>.json in the same folder: per day and district, the no-fire '
                            'cells with a cloud-free look (T) and with no cloud-free look (U), from the MODIS MOD14A1 '
                            'and MYD14A1 FireMask, Collection 6.1; sha256 of each file under seasons',
                   'generated_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    }
    dst = os.path.join(ka, 'blind_rule_kalteng.json')
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps({'seasons': out['seasons_included'], 'total': total, 'wet': wet_total, 'all': all_total,
                      'undefined': undefined}))
    for s in seasons:
        print(s['season'], s['days_counted'], 'of', s['days'], 'days;', s['district_days_above'], 'of',
              s['district_days'], f"({s['share_pct']}%)", 'worst', s['worst_day']['date'],
              s['worst_day']['share_no_cloud_free_look'], 'F', s['worst_day']['fire_cells'])


if __name__ == '__main__':
    main()
