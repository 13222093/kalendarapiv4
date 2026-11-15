"""Project 4: turn the 2026 FIRMS near-real-time parquet of the data folder into a CSV that build_season.py reads.

The 2026 VIIRS S-NPP points are not in the FIRMS country-year archive yet. Second Sight fetched them from the CC0 FIRMS
mirror (data.source.coop/portolan-mirrors/firms-catalog) into <ss_data>/raw_nrt/source=viirs-snpp/year=<year>/part.parquet.
This script copies the columns build_season.py needs into a CSV, unchanged, and writes <csv>.source.json beside it so
that build_season.py records where the points come from and keeps near-real-time rows (which have no "type").

Usage (project venv; needs pyarrow):
  python nrt_parquet_to_csv.py <ss_data_dir> <out.csv> [year]
"""
import csv
import hashlib
import json
import os
import sys

import pyarrow.parquet as pq

COLS = ['latitude', 'longitude', 'acq_date', 'acq_time', 'satellite', 'confidence', 'frp', 'daynight', 'type', 'quality']


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    ss, out = sys.argv[1], sys.argv[2]
    year = int(sys.argv[3]) if len(sys.argv) > 3 else 2026
    rel = f'raw_nrt/source=viirs-snpp/year={year}/part.parquet'
    src = os.path.join(ss, rel)
    with open(os.path.join(ss, 'data_manifest.json'), encoding='utf-8') as f:
        entry = [x for x in json.load(f)['nrt_files'] if x['file'] == rel][0]
    sha = sha256_of(src)
    assert sha == entry['sha256'], 'the parquet differs from the one in data_manifest.json'
    t = pq.read_table(src, columns=COLS).to_pydict()
    n = len(t['latitude'])
    quality = {}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(COLS)
        for i in range(n):
            typ = t['type'][i]
            quality[t['quality'][i]] = quality.get(t['quality'][i], 0) + 1
            w.writerow([repr(t['latitude'][i]), repr(t['longitude'][i]), t['acq_date'][i].isoformat(), t['acq_time'][i],
                        t['satellite'][i], t['confidence'][i], repr(t['frp'][i]), t['daynight'][i],
                        '' if typ is None else int(typ), t['quality'][i]])
    dates = sorted(set(t['acq_date']))
    side = {
        'url': entry['url'],
        'product': 'VIIRS S-NPP 375 m (NASA FIRMS; standard processing where available, otherwise near-real-time, '
                   'provisional), read from the CC0 FIRMS mirror on Source Cooperative',
        'converted_from': {'file': 'data-raw/ss/' + rel, 'sha256': sha, 'bytes': os.path.getsize(src), 'rows': n,
                           'rows_by_quality': quality, 'date_range': [dates[0].isoformat(), dates[-1].isoformat()],
                           'downloaded_utc': entry['downloaded_utc'], 'license': entry['license'],
                           'converted_by': 'kalenderapi-v4-integrated/pipeline/visibility/nrt_parquet_to_csv.py'},
    }
    with open(out + '.source.json', 'w', encoding='utf-8') as f:
        json.dump(side, f, indent=1)
    print(json.dumps({'rows': n, 'rows_by_quality': quality, 'dates': side['converted_from']['date_range'],
                      'csv_bytes': os.path.getsize(out)}))


if __name__ == '__main__':
    main()
