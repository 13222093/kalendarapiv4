// Typed i18n dictionary (ID default, EN). Numbers always go through Intl.NumberFormat
// for the active locale; never mix formats on one screen.

export type Lang = 'id' | 'en';

export const TABS = ['awal', 'peta', 'kalender', 'bulan', 'lab', 'yakin', 'unduh', 'metode'] as const;
export type Tab = (typeof TABS)[number];

const id = {
  appName: 'Second Sight',
  tabs: {
    awal: 'Sebelum vs sesudah',
    peta: 'Peta',
    kalender: 'Kalender',
    bulan: 'Bulan ini',
    lab: 'Lab',
    yakin: 'Seberapa yakin',
    unduh: 'Unduh',
    metode: 'Metode',
  } satisfies Record<Tab, string>,
  freshness: 'Belum ada data satelit dimuat. Kalender memakai data contoh sintetis.',
  snpp: 'Suomi-NPP berhenti 2 Nov 2026',
  region: 'Wilayah',
  demoBadge: 'Data contoh',
  demoNote: 'Angka sintetis untuk menguji tampilan, bukan hasil pengamatan.',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  monthsLong: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  total: 'Total',
  rank: 'Peringkat',
  median: 'Median',
  unit: 'hari-sel api, skala setara Aqua-MODIS',
  unitShort: 'hari-sel api',
  modeLabel: 'Warna',
  modeCount: 'Jumlah',
  modeRatio: 'vs median',
  seriesLabel: 'Seri',
  seriesRaw: 'Mentah',
  seriesSensor: 'Per sensor',
  seriesHarm: 'Harmonisasi',
  seriesNote: {
    raw: 'Mentah: angka asli tiap satelit. Lompatan di 2012 adalah artefak pergantian ke VIIRS, bukan kebakaran yang bertambah.',
    sensor: 'Per sensor: tiap era diwarnai dengan skalanya sendiri, sehingga pola musiman terlihat tetapi era tidak bisa dibandingkan langsung.',
    harm: 'Harmonisasi: VIIRS dikonversi ke skala MODIS, sehingga 2001-2026 bisa dibandingkan dalam satu skala.',
  },
  agreeBadge: 'Titik di pojok sel: metode tidak sepenuhnya sepakat (putih = B, hitam = C)',
  eraPill: 'MODIS, diharmonisasi | VIIRS, dikonversi ke skala MODIS',
  eraDrift: 'era drift',
  arrivals: 'Titik di tahun: satelit baru masuk (2002 Aqua, 2012 S-NPP, 2018 NOAA-20, 2023 NOAA-21)',
  stateActive: 'Ada aktivitas',
  stateZero: 'Nol',
  statePartial: 'Teramati sebagian',
  stateUnobserved: 'Tidak teramati: awan atau asap',
  stateProvisional: 'Sementara (data NRT, bisa berubah)',
  stateAnomaly: 'Di atas persentil 90',
  stateFuture: 'Belum terjadi',
  observedSentence: (ok: string, all: string, pct: string) => `${ok} dari ${all} sel-bulan teramati baik (${pct}).`,
  headline: (year: string, aoi: string) => `Dalam data contoh ini, ${year} adalah tahun terparah di ${aoi}.`,
  likely: (lo: string, hi: string) => `kemungkinan ${lo}-${hi} (9 dari 10)`,
  ratioMedian: (r: string) => `${r}× median`,
  rankOf: (n: string, total: string) => `peringkat ${n} dari ${total} tahun untuk bulan ini`,
  source: (s: string) => `Sumber: ${s}`,
  agreement: { A: 'Tiga metode sepakat (A)', B: 'Dua metode sepakat (B)', C: 'Metode tidak sepakat (C)' },
  obs: { good: 'teramati baik', partial: 'teramati sebagian', unobserved: 'tidak teramati' },
  sensorNames: { MODIS: 'MODIS (satelit lama)', VIIRS: 'VIIRS (satelit tajam)' },
  comingSoon: 'Layar ini sedang dibangun.',
  disclaimer: 'Titik panas bukan berarti kebakaran pasti.',
  mapNote: 'Peta dasar abu-abu terang. Lapisan batas, KHG, dan gambut menyusul.',
  shortcuts: 'Pintasan: 1-7 tab, L bahasa, M warna, R seri.',
  presets: 'Preset',
  calendarAria: 'Kalender titik panas per tahun dan bulan',
};

type Dict = typeof id;

const en: Dict = {
  appName: 'Second Sight',
  tabs: {
    awal: 'Before vs after',
    peta: 'Map',
    kalender: 'Calendar',
    bulan: 'This month',
    lab: 'Lab',
    yakin: 'How sure',
    unduh: 'Download',
    metode: 'Method',
  },
  freshness: 'No satellite data loaded yet. The calendar shows synthetic sample data.',
  snpp: 'Suomi-NPP stopped 2 Nov 2026',
  region: 'Area',
  demoBadge: 'Sample data',
  demoNote: 'Synthetic numbers to test the layout, not observations.',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  total: 'Total',
  rank: 'Rank',
  median: 'Median',
  unit: 'fire cell-days, Aqua-MODIS equivalent scale',
  unitShort: 'fire cell-days',
  modeLabel: 'Colour',
  modeCount: 'Count',
  modeRatio: 'vs median',
  seriesLabel: 'Series',
  seriesRaw: 'Raw',
  seriesSensor: 'Per sensor',
  seriesHarm: 'Harmonised',
  seriesNote: {
    raw: 'Raw: each satellite as recorded. The jump in 2012 is an artefact of the switch to VIIRS, not more fire.',
    sensor: 'Per sensor: each era has its own colour scale, so seasons show but eras cannot be compared directly.',
    harm: 'Harmonised: VIIRS converted to the MODIS scale, so 2001-2026 share one scale.',
  },
  agreeBadge: 'Dot in cell corner: methods do not fully agree (white = B, black = C)',
  eraPill: 'MODIS, harmonised | VIIRS, converted to MODIS scale',
  eraDrift: 'drift era',
  arrivals: 'Dot on year: new satellite arrives (2002 Aqua, 2012 S-NPP, 2018 NOAA-20, 2023 NOAA-21)',
  stateActive: 'Activity',
  stateZero: 'Zero',
  statePartial: 'Partly observed',
  stateUnobserved: 'Not observed: cloud or smoke',
  stateProvisional: 'Provisional (near-real-time, may change)',
  stateAnomaly: 'Above 90th percentile',
  stateFuture: 'Not yet happened',
  observedSentence: (ok, all, pct) => `${ok} of ${all} cell-months well observed (${pct}).`,
  headline: (year, aoi) => `In this sample data, ${year} is the worst year in ${aoi}.`,
  likely: (lo, hi) => `likely ${lo}-${hi} (9 in 10)`,
  ratioMedian: (r) => `${r}× the median`,
  rankOf: (n, total) => `rank ${n} of ${total} years for this month`,
  source: (s) => `Source: ${s}`,
  agreement: { A: 'Three methods agree (A)', B: 'Two methods agree (B)', C: 'Methods disagree (C)' },
  obs: { good: 'well observed', partial: 'partly observed', unobserved: 'not observed' },
  sensorNames: { MODIS: 'MODIS (older satellite)', VIIRS: 'VIIRS (sharper satellite)' },
  comingSoon: 'This screen is being built.',
  disclaimer: 'A hotspot is not a confirmed fire.',
  mapNote: 'Light grey basemap. Boundary, KHG and peat layers to follow.',
  shortcuts: 'Shortcuts: 1-7 tabs, L language, M colour, R series.',
  presets: 'Presets',
  calendarAria: 'Hotspot calendar by year and month',
};

const DICTS: Record<Lang, Dict> = { id, en };
const LOCALES: Record<Lang, string> = { id: 'id-ID', en: 'en-GB' };

let current: Lang = 'id';
let intFmt = new Intl.NumberFormat(LOCALES.id, { maximumFractionDigits: 0 });
let dec1Fmt = new Intl.NumberFormat(LOCALES.id, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let pctFmt = new Intl.NumberFormat(LOCALES.id, { style: 'percent', maximumFractionDigits: 1 });

export function setLang(lang: Lang): void {
  current = lang;
  const loc = LOCALES[lang];
  intFmt = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  dec1Fmt = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  pctFmt = new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1 });
  document.documentElement.lang = lang;
}

export const getLang = (): Lang => current;
export const t = (): Dict => DICTS[current];
export const fmtInt = (n: number): string => intFmt.format(n);
export const fmtDec1 = (n: number): string => dec1Fmt.format(n);
export const fmtPct = (n: number): string => pctFmt.format(n);
export const isLang = (v: unknown): v is Lang => v === 'id' || v === 'en';
