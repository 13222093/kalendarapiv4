"""Project 4: monthly observability of Central Kalimantan from the FireMask cell-day visibility files.

Takes the daily F / T / U / N cell-day totals in app/public/ka-data/visibility_kalteng_<year>.json (written by
build_visibility.py), sums them per calendar month and applies Second Sight's own TRI-04 rule
(vendor/second-sight/pipeline/physics/observability.py: its `observability` and `obs_class` functions are imported,
nothing is re-implemented):

    f_cloud   = U / (T + U)              share of no-fire cell-days where the ground was hidden by cloud
    f_missing = N / (F + T + U + N)      share of cell-days with no usable look
    O         = (1 - f_cloud) * (1 - f_missing)
    obs_class = good if O >= 0.6, partial if O >= 0.3, else unobserved

The result is written into the bundle's monthly_prov-kalimantan-tengah.json rows (fields f_cloud, f_missing, O,
obs_source = "firemask-terra-aqua"; obs_class filled). Every other month keeps obs_class null and gets no extra
fields. Then index.json is written LAST, with obs_months = {"prov-kalimantan-tengah": [...]} added, so that its
presence means the bundle is complete.

Usage (run from the project 4 root, with the venv python):
  python pipeline/visibility/monthly_observability.py \
      --bundle-src data-raw/ss/bundle --out app/public/ss-data --ka-data app/public/ka-data \
      --years 2015 2023 [--files visibility_kalteng_2023_janmar.json] [--keep-published 2019] \
      [--report data-raw/obs_months.json]

--years            Aug to Oct files, visibility_kalteng_<year>.json (default 2015 2019 2023, the first run).
--files            further visibility files in --ka-data with another window; their months are taken from their days.
--keep-published   years that are NOT recomputed: their rows are copied as they stand in the published
                   monthly_prov-kalimantan-tengah.json and their visibility file is not opened (2019 is locked by a
                   registered test of a sibling project).
A month is filled only when the file holds all of its days and none of them is in the file's "no_file_days" (a day
for which the catalogue had no FireMask file of one sensor); such months are listed as skipped.

Order of writes: monthly file first, index.json last. The rest of the bundle (and validation_results.json,
finding.json) must already be in --out (pipeline/publish_ss_data.py does that and leaves index.json out).
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'vendor' / 'second-sight'))   # Second Sight's own `pipeline` package comes first

import numpy as np                                                          # noqa: E402
from pipeline.physics.observability import obs_class, observability        # noqa: E402

AOI = 'prov-kalimantan-tengah'
OBS_SOURCE = 'firemask-terra-aqua'
OBS_FIELDS = ('obs_class', 'f_cloud', 'f_missing', 'O', 'obs_source')


def month_totals(vis_path):
    """{(year, month): {F, T, U, N, days, no_file_days}} summed over the daily totals of one visibility file."""
    with open(vis_path, encoding='utf-8') as f:
        doc = json.load(f)
    no_file = set(doc.get('no_file_days', {}).get('days', {}))
    out = {}
    for d in doc['days']:
        y, m, _ = (int(x) for x in d['date'].split('-'))
        t = out.setdefault((y, m), {'F': 0, 'T': 0, 'U': 0, 'N': 0, 'days': 0, 'no_file_days': 0})
        for k in 'FTUN':
            t[k] += d[k]
        t['days'] += 1
        t['no_file_days'] += d['date'] in no_file
    for (y, m), t in out.items():
        expect = ((date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)) - date(y, m, 1)).days
        assert t['days'] == expect, f'{y}-{m:02d}: {t["days"]} days in file, expected {expect}'
    for k in 'FTUN':   # the months must add up to the season totals stored in the same file
        assert sum(t[k] for t in out.values()) == doc['season'][k], (str(vis_path), k)
    return out


def compute(ka_dir, years, files=()):
    rows, skipped = [], []
    paths = [Path(ka_dir) / f'visibility_kalteng_{y}.json' for y in years] + [Path(ka_dir) / f for f in files]
    for p in paths:
        for (y, m), t in sorted(month_totals(p).items()):
            if t['no_file_days']:
                skipped.append({'year': y, 'month': m, 'file': p.name, 'no_file_days': t['no_file_days']})
                continue
            fc = t['U'] / (t['T'] + t['U'])
            fm = t['N'] / (t['F'] + t['T'] + t['U'] + t['N'])
            o = float(observability(fc, fm))
            cls = str(obs_class(np.array([o])).iloc[0])
            rows.append({'year': y, 'month': m, 'F': t['F'], 'T': t['T'], 'U': t['U'], 'N': t['N'],
                         'f_cloud': round(fc, 6), 'f_missing': round(fm, 6), 'O': round(o, 6), 'obs_class': cls,
                         'file': p.name})
    rows.sort(key=lambda r: (r['year'], r['month']))
    assert len({(r['year'], r['month']) for r in rows}) == len(rows), 'a month appears in two files'
    return rows, skipped


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--bundle-src', required=True, help='the bundle as Second Sight wrote it (for index.json)')
    ap.add_argument('--out', required=True, help='app/public/ss-data')
    ap.add_argument('--ka-data', required=True, help='app/public/ka-data')
    ap.add_argument('--years', nargs='+', type=int, default=[2015, 2019, 2023])
    ap.add_argument('--files', nargs='*', default=[], help='further visibility files (names inside --ka-data)')
    ap.add_argument('--keep-published', nargs='*', type=int, default=[],
                    help='years whose published rows are copied as they are (not recomputed, file not opened)')
    ap.add_argument('--report', help='also write the per-month inputs and results here (JSON)')
    a = ap.parse_args()
    out, src = Path(a.out), Path(a.bundle_src)
    keep_years = set(a.keep_published)
    assert not keep_years & set(a.years), 'a year cannot be both recomputed and kept'

    rows, skipped = compute(a.ka_data, a.years, a.files)
    by = {(r['year'], r['month']): r for r in rows}

    mpath = out / f'monthly_{AOI}.json'
    kept = {}
    if keep_years:
        with open(mpath, encoding='utf-8') as f:
            for r in json.load(f):
                if r['year'] in keep_years and r.get('obs_source'):
                    kept[(r['year'], r['month'])] = {k: r[k] for k in OBS_FIELDS}
        assert not set(kept) & set(by)
    with open(src / f'monthly_{AOI}.json', encoding='utf-8') as f:
        monthly = json.load(f)               # always start from the file as Second Sight wrote it
    seen = set()
    for r in monthly:
        k = (r['year'], r['month'])
        if k in by:
            v = by[k]
            r['obs_class'] = v['obs_class']
            r['f_cloud'], r['f_missing'], r['O'] = v['f_cloud'], v['f_missing'], v['O']
            r['obs_source'] = OBS_SOURCE
            seen.add(k)
        elif k in kept:
            r.update(kept[k])
            seen.add(k)
    missing = (set(by) | set(kept)) - seen
    assert not missing, f'months not in the bundle series: {sorted(missing)}'
    mpath.write_text(json.dumps(monthly, separators=(',', ':')), encoding='utf-8')

    with open(src / 'index.json', encoding='utf-8') as f:
        index = json.load(f)
    index['obs_months'] = {AOI: [f'{y}-{m:02d}' for y, m in sorted(set(by) | set(kept))]}
    index['obs_source_note'] = (
        'obs_class, f_cloud, f_missing and O are filled only for the months listed in obs_months, for '
        f'{AOI} (NASA MODIS MOD14A1/MYD14A1 FireMask per 0.01 degree cell-day, Terra and Aqua, rule TRI-04 of '
        'Second Sight). Every other month and AOI has obs_class null = not computed, which is not the same as unobserved.')
    (out / 'index.json').write_text(json.dumps(index, indent=1, default=str), encoding='utf-8')   # LAST

    if a.report:
        Path(a.report).write_text(json.dumps({
            'computed': rows, 'skipped_months': skipped,
            'kept_as_published': [f'{y}-{m:02d}' for y, m in sorted(kept)]}, indent=1), encoding='utf-8')
    print(f'{"month":8s} {"F":>7s} {"T":>9s} {"U":>8s} {"N":>7s}  f_cloud f_missing       O  class')
    for r in rows:
        print(f'{r["year"]}-{r["month"]:02d} {r["F"]:7d} {r["T"]:9d} {r["U"]:8d} {r["N"]:7d}  '
              f'{r["f_cloud"]:.4f}  {r["f_missing"]:.4f}  {r["O"]:.4f}  {r["obs_class"]}')
    for s in skipped:
        print(f'{s["year"]}-{s["month"]:02d} skipped: {s["no_file_days"]} days without a file of one sensor ({s["file"]})')
    for y, m in sorted(kept):
        print(f'{y}-{m:02d} kept as published (not recomputed)')
    print(f'wrote {mpath} and (last) {out / "index.json"}')


if __name__ == '__main__':
    main()
