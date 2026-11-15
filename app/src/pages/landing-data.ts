import { beforeAfter, loadFinding, loadIndex, loadMonthly, loadValidation, NATIONAL, type TestRow } from '../lib/record.ts';

export const LANDING_BRAND = 'KalenderApi';
export const LANDING_ROUTES = {
  home: '#/home',
  record: '#/record',
  methods: '#/methods',
  data: '#/data',
  story: '#/story',
  season: '#/season',
};
export interface LandingPoint {
  year: number;
  raw: number;
  fair: number;
  low: number;
  high: number;
}

export interface LandingCheck {
  value: number | null;
  ci: [number, number] | null;
  passed: boolean | null;
  status: string;
  rule: string | null;
}

export interface LandingData {
  status: string;
  points: LandingPoint[];
  version: string | null;
  checks: { seam2012: LandingCheck | null; seam2022: LandingCheck | null };
}

function toCheck(row: TestRow | undefined): LandingCheck | null {
  if (!row) return null;
  const ci = Array.isArray(row.ci)
    && row.ci.length >= 2
    && typeof row.ci[0] === 'number'
    && typeof row.ci[1] === 'number'
    ? [row.ci[0], row.ci[1]] as [number, number]
    : null;
  return {
    value: typeof row.value === 'number' ? row.value : null,
    ci,
    passed: row.passed,
    status: row.status ?? 'run',
    rule: row.rule ?? null,
  };
}

function seamRow(rows: TestRow[], year: number, method: string): TestRow | undefined {
  const variant = year === 2012 ? 'switch2012' : 'main';
  return rows.find((row) => row.test_id === 'V3'
    && row.metric.includes('seam ' + year + '-01')
    && row.metric.includes(method + '/' + variant));
}

/** Build the landing view from exactly the same versioned bundle as the record page. */
export async function loadLandingData(): Promise<LandingData | null> {
  const [index, finding, validation] = await Promise.all([loadIndex(), loadFinding(), loadValidation()]);
  const national = index.aois.find((area) => area.aoi_id === NATIONAL)
    ?? index.aois.find((area) => area.level === 'national');
  if (!national) return null;

  const record = beforeAfter(await loadMonthly(national));
  if (!record) return null;
  const points = record.points
    .filter((point) => point.year >= 2003 && point.year <= 2025 && !point.provisional)
    .map((point) => ({
      year: point.year,
      raw: point.naive,
      fair: point.H,
      low: Math.min(point.lo, point.hi),
      high: Math.max(point.lo, point.hi),
    }));

  const method = validation.meta?.chosen_method ?? 'M3';
  return {
    status: finding.meta?.status ?? 'PRELIMINARY',
    points,
    version: index.data_version ? index.data_version.slice(0, 8) : null,
    checks: {
      seam2012: toCheck(seamRow(validation.results, 2012, method)),
      seam2022: toCheck(seamRow(validation.results, 2022, method)),
    },
  };
}
