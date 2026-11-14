"""KalenderApi: build public/ka-data/kalteng_<year>_season.json for the "Play the season" page (#/season).

Reads the public NASA FIRMS country-year archive (VIIRS S-NPP 375 m, standard processing, Indonesia <year>),
keeps 1 Aug to 31 Oct <year> inside a bounding box around Central Kalimantan, and writes one entry per day
(every day of the range, days with no points included). Nothing is interpolated: each day holds only the points
FIRMS reports for that acq_date.

Also marks "re-appeared after a gap" points with the rule in REAPPEAR_RULE (computed here, stored per day as indices
into that day's pts, so the page only counts what is in the file).

Usage (run with an isolated interpreter):
  python -I build_season.py <csv> <out.json> <download_utc> [year]
  year defaults to 2019 (the v1.0 behaviour, output byte-for-byte unchanged); project 4 also builds 2015 and 2023.
"""
import csv
import hashlib
import json
import os
import sys
from datetime import date, timedelta

YEAR = 2019            # default; main() overrides it from the optional 4th argument
BBOX = (110.7, -3.6, 115.9, 0.9)  # w, s, e, n
CONF_KEEP = {'n', 'h', 'nominal', 'high'}
RADIUS = 0.03          # degrees
GAP_MIN = 2            # consecutive empty days right before today
LOOK_MIN, LOOK_MAX = 3, 14


def url_for(year):
    return f'https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/{year}/viirs-snpp_{year}_Indonesia.csv'


def filter_text(year):
    return (
        f'acq_date (UTC) from {year}-08-01 to {year}-10-31 inclusive; longitude 110.7 to 115.9 and latitude -3.6 to 0.9 '
        '(a bounding box around Central Kalimantan, NOT the province polygon: it also takes in edges of West, South and '
        'East Kalimantan); type == 0 (presumed vegetation fire); confidence in {n, h, nominal, high} (low dropped). '
        'lon/lat rounded to 3 decimals, frp (MW) to 1 decimal; isNight = 1 when daynight == "N".'
    )


def reappear_rule(year):
    return (
        'A point on day t is "re-appeared after a gap" when the most recent earlier point within 0.03 degrees '
        '(plain Euclidean distance in lon/lat degrees, about 3.3 km) was seen 3 to 14 days before t. That means '
        '(a) a point within 0.03 degrees existed 3 to 14 days earlier, and (b) on the days in between (at least the '
        '2 consecutive days right before t) no point existed within 0.03 degrees. Only days inside this file are '
        f'looked at (nothing before {year}-08-01), so the first possible re-appearance is on {year}-08-04. '
        "Stored per day in \"re\" as indices into that day's \"pts\". It says the record had a gap there, "
        'not why (smoke, cloud, a missed pass or a fire that went out and restarted are all possible).'
    )


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    src, out, downloaded = sys.argv[1], sys.argv[2], sys.argv[3]
    year = int(sys.argv[4]) if len(sys.argv) > 4 else YEAR
    START, END = date(year, 8, 1), date(year, 10, 31)
    days = {}
    d = START
    while d <= END:
        days[d.isoformat()] = []
        d += timedelta(days=1)

    rows_total = 0
    with open(src, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        has_type = 'type' in (reader.fieldnames or [])
        for row in reader:
            rows_total += 1
            day = row['acq_date']
            if day not in days:
                continue
            lon, lat = float(row['longitude']), float(row['latitude'])
            if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
                continue
            if has_type and row['type'].strip() != '0':
                continue
            if row['confidence'].strip().lower() not in CONF_KEEP:
                continue
            frp = float(row['frp']) if row['frp'] else 0.0
            night = 1 if row['daynight'].strip().upper() == 'N' else 0
            days[day].append([round(lon, 3), round(lat, 3), round(frp, 1), night])

    # stable order inside a day: by longitude, then latitude
    for k in days:
        days[k].sort(key=lambda p: (p[0], p[1]))

    # re-appeared rule
    keys = list(days.keys())
    cell = RADIUS
    grids = []
    for k in keys:
        g = {}
        for p in days[k]:
            g.setdefault((int((p[0] + 180) // cell), int((p[1] + 90) // cell)), []).append(p)
        grids.append(g)

    def near(gi, p):
        g = grids[gi]
        cx, cy = int((p[0] + 180) // cell), int((p[1] + 90) // cell)
        r2 = RADIUS * RADIUS + 1e-12
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for q in g.get((cx + dx, cy + dy), ()):
                    if (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 <= r2:
                        return True
        return False

    out_days = []
    re_total = 0
    for ti, k in enumerate(keys):
        re = []
        for i, p in enumerate(days[k]):
            last = None
            for back in range(1, LOOK_MAX + 1):
                si = ti - back
                if si < 0:
                    break
                if near(si, p):
                    last = back
                    break
            if last is not None and LOOK_MIN <= last <= LOOK_MAX:
                re.append(i)
        re_total += len(re)
        out_days.append({'date': k, 'n': len(days[k]), 'r': len(re), 'pts': days[k], 're': re})

    rows_kept = sum(x['n'] for x in out_days)
    doc = {
        'source': {
            'url': url_for(year),
            'downloaded_utc': downloaded,
            'sha256': sha256_of(src),
            'bytes': os.path.getsize(src),
            'rows_total': rows_total,
            'rows_kept': rows_kept,
            'filter_text': filter_text(year),
            'product': 'VIIRS S-NPP 375 m (NASA FIRMS, standard processing)',
            'day_is': 'FIRMS acq_date in UTC (one frame = one acq_date)',
            'pts_columns': ['lon', 'lat', 'frp_MW', 'isNight'],
            'built_by': ('kalenderapi/scripts/build_season.py' if year == 2019 else
                         'kalenderapi-v4-integrated/pipeline/visibility/build_season.py '
                         '(year-parameterised copy of kalenderapi/scripts/build_season.py)'),
        },
        'bbox': list(BBOX),
        'bbox_note': 'Bounding box around Central Kalimantan (Kalteng), not the province polygon.',
        'reappear_rule': reappear_rule(year),
        'days': out_days,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))

    zero = [x['date'] for x in out_days if x['n'] == 0]
    mx = max(out_days, key=lambda x: x['n'])
    print(json.dumps({
        'rows_total': rows_total, 'rows_kept': rows_kept, 'days': len(out_days), 'days_zero': len(zero),
        'zero_dates': zero, 'max_day': [mx['date'], mx['n']], 're_total': re_total,
        'out_bytes': os.path.getsize(out), 'sha256': doc['source']['sha256'], 'src_bytes': doc['source']['bytes'],
    }, indent=1))


if __name__ == '__main__':
    main()
