// Monthly calendar data contract. The pipeline export (EXP-01) must match this shape.
// File: public/data/<name>.json = { meta: Meta, rows: MonthRow[] }. Schema notes in app/README.md.

export type ObsClass = 'good' | 'partial' | 'unobserved';
export type Sensor = 'MODIS' | 'VIIRS';
export type Agreement = 'A' | 'B' | 'C';

export interface MonthRow {
  aoi_id: string;
  year: number;
  month: number; // 1-12
  H: number | null; // harmonised fire cell-days (MODIS-equivalent); null when unobserved
  H_lo: number | null; // 90% interval lower bound
  H_hi: number | null; // 90% interval upper bound
  A_raw: number | null; // raw Aqua/Terra MODIS count
  V_raw: number | null; // raw VIIRS count (null before 2012)
  sensor_used: Sensor; // sensor the harmonised value is based on
  baseline_median: number | null; // median H of this calendar month, baseline period
  pct_rank: number | null; // 0-1 percentile of H among same calendar month
  obs_class: ObsClass;
  flag_nrt: boolean; // provisional near-real-time
  agreement: Agreement; // triangulation class
}

export interface Meta {
  synthetic?: boolean;
  note?: string;
  unit?: string;
  baseline?: string;
  last_month?: string;
  data_version?: string;
  generated_at?: string;
}

export interface MonthlyDoc {
  meta: Meta;
  rows: MonthRow[];
}

const cache = new Map<string, Promise<MonthlyDoc>>();
const url = (f: string) => `${import.meta.env.BASE_URL}data/${f}`;

export function loadDemo(name = 'demo_monthly'): Promise<MonthlyDoc> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(url(`${name}.json`)).then((r) => {
      if (!r.ok) throw new Error(`data ${name}: HTTP ${r.status}`);
      return r.json() as Promise<MonthlyDoc>;
    });
    cache.set(name, p);
  }
  return p;
}

// Pipeline export (EXP-01): data/index.json lists one monthly_<aoi>.json per AOI.
// Pipeline AOI ids are mapped to app preset ids so presets and URLs stay stable.
export const PIPELINE_TO_PRESET: Record<string, string> = {
  IDN: 'indonesia',
  'region-sumatra': 'sumatera',
  'region-kalimantan': 'kalimantan',
  'region-jnbm': 'jawa-bali-nusa',
  'region-sulawesi': 'sulawesi',
  'region-papua': 'papua-maluku',
};

interface IndexDoc {
  data_version?: string;
  generated_at?: string;
  unit?: string;
  baseline_period?: [number, number];
  harmonized?: boolean;
  aois?: { aoi_id: string; file: string; last?: string }[];
}

type RawRow = Omit<MonthRow, 'sensor_used' | 'obs_class' | 'agreement'> & {
  sensor_used: string | null;
  obs_class: ObsClass | null;
  agreement: Agreement | null;
  T_raw?: number | null;
  N20_raw?: number | null;
};

function normalize(r: RawRow): MonthRow {
  const viirs = r.sensor_used === 'VIIRS' || r.sensor_used === 'SNPP' || r.sensor_used === 'NOAA20';
  return {
    ...r,
    aoi_id: PIPELINE_TO_PRESET[r.aoi_id] ?? r.aoi_id,
    A_raw: r.A_raw ?? r.T_raw ?? null,
    V_raw: r.V_raw ?? r.N20_raw ?? null,
    sensor_used: viirs ? 'VIIRS' : 'MODIS',
    obs_class: r.obs_class ?? (r.H == null ? 'unobserved' : 'good'),
    agreement: r.agreement ?? 'A',
  };
}

export interface LoadedDoc extends MonthlyDoc {
  index?: IndexDoc;
}

let loaded: Promise<LoadedDoc> | null = null;

export function loadMonthly(): Promise<LoadedDoc> {
  loaded ??= (async () => {
    try {
      const r = await fetch(url('index.json'));
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('no index');
      const index = (await r.json()) as IndexDoc;
      if (!index.aois?.length) throw new Error('empty index');
      const parts = await Promise.all(
        index.aois.map(async (a) => {
          const res = await fetch(url(a.file));
          if (!res.ok) return [] as RawRow[];
          const body = (await res.json()) as RawRow[] | { rows: RawRow[] };
          return Array.isArray(body) ? body : body.rows;
        }),
      );
      const rows = parts.flat().map(normalize);
      if (!rows.length) throw new Error('no rows');
      const last = index.aois.map((a) => a.last ?? '').sort().pop();
      const bp = index.baseline_period;
      return {
        index,
        meta: {
          synthetic: false,
          unit: index.unit,
          baseline: bp ? `${bp[0]}-${bp[1]} median per calendar month` : undefined,
          last_month: last || undefined,
          data_version: index.data_version,
          generated_at: index.generated_at,
        },
        rows,
      };
    } catch {
      return loadDemo();
    }
  })();
  return loaded;
}
