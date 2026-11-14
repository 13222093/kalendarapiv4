// Generates SYNTHETIC demo data for the calendar UI: app/public/data/demo_monthly.json.
// These numbers are invented (seeded random + seasonal shape + El Nino boost) to exercise
// every cell state. They are NOT observations. The data team replaces this file with the
// real export (EXP-01) using the same schema; see app/README.md.
// Run: node scripts/make-demo-data.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'data', 'demo_monthly.json');

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEASON = [0.02, 0.01, 0.03, 0.04, 0.07, 0.14, 0.32, 0.72, 1.0, 0.78, 0.22, 0.04];
const YEAR_FACTOR = { 2002: 2.0, 2004: 1.7, 2006: 2.4, 2009: 1.9, 2014: 1.4, 2015: 3.4, 2019: 2.5, 2023: 1.9, 2026: 1.6,
  2010: 0.3, 2016: 0.4, 2017: 0.5, 2020: 0.45, 2021: 0.35, 2022: 0.4 };
const AOIS = [
  ['khg-sebangau', 120, 1],
  ['kalteng', 900, 2],
  ['riau-kampar', 160, 3],
  ['sumsel-oki', 260, 4],
  ['indonesia', 6000, 5],
];
const LAST = { year: 2026, month: 11 };

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rows = [];
for (const [aoi_id, base, seed] of AOIS) {
  const rnd = mulberry32(seed * 7919);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const aoiRows = [];
  for (let year = 2001; year <= LAST.year; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year === LAST.year && month > LAST.month) continue;
      const yf = YEAR_FACTOR[year] ?? 1;
      const smoky = yf > 1.5 && month >= 8 && month <= 10;
      const u = rnd();
      const obs_class = u < (smoky ? 0.08 : 0.012) ? 'unobserved' : u < (smoky ? 0.45 : 0.07) ? 'partial' : 'good';
      let H = base * SEASON[month - 1] * yf * Math.exp(0.18 * gauss());
      H = H < 0.6 ? 0 : Math.round(H);
      const viirs = year >= 2012;
      const A_raw = Math.round(H * (year >= 2012 ? 0.9 - (year - 2012) * 0.01 : 1));
      const V_raw = viirs ? Math.round(H * 3.1 * (year >= 2022 ? 1.08 : 1)) : null;
      const widen = obs_class === 'partial' ? 0.32 : 0.14;
      const nrt = year === LAST.year && month >= 9;
      aoiRows.push({
        aoi_id, year, month,
        H: obs_class === 'unobserved' ? null : H,
        H_lo: obs_class === 'unobserved' ? null : Math.round(H * (1 - widen)),
        H_hi: obs_class === 'unobserved' ? null : Math.round(H * (1 + widen * (nrt ? 1.5 : 1))),
        A_raw: obs_class === 'unobserved' ? null : A_raw,
        V_raw: obs_class === 'unobserved' ? null : V_raw,
        sensor_used: viirs ? 'VIIRS' : 'MODIS',
        baseline_median: null,
        pct_rank: null,
        obs_class,
        flag_nrt: nrt,
        agreement: rnd() < 0.86 ? 'A' : rnd() < 0.75 ? 'B' : 'C',
      });
    }
  }
  for (let month = 1; month <= 12; month++) {
    const same = aoiRows.filter((r) => r.month === month);
    const base = median(same.filter((r) => r.year >= 2003 && r.year <= 2022).map((r) => r.H));
    const vals = same.map((r) => r.H).filter((v) => v != null);
    for (const r of same) {
      r.baseline_median = base;
      r.pct_rank = r.H == null ? null : Math.round((vals.filter((v) => v <= r.H).length / vals.length) * 1000) / 1000;
    }
  }
  rows.push(...aoiRows);
}

const doc = {
  meta: {
    synthetic: true,
    note: 'SYNTHETIC DEMO DATA. Invented numbers for UI testing only. Not FIRMS observations.',
    unit: 'fire cell-days, Aqua-MODIS equivalent scale',
    baseline: '2003-2022 median per calendar month',
    generated_by: 'app/scripts/make-demo-data.mjs',
    last_month: `${LAST.year}-${String(LAST.month).padStart(2, '0')}`,
  },
  rows,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc));
console.log(`wrote ${rows.length} rows to ${out}`);
