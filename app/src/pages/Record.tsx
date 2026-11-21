// KalenderApi (new file, not from Fire Harmony): "Indonesia record" (#/record), the main page of the integrated build.
// The record is the harmonized fire cell-days of public/ss-data/ (the team's own pipeline and validation); the
// cloud layer is monthly visibility from the NASA MODIS FireMask and the day-by-day season playback.
// Told as INTEGRATION.md's thesis: the jump (2012, MODIS to VIIRS) -> the fix (one scale, 90% range) -> the zero.
// Link: #/record?aoi=<aoi_id>&m=<YYYY-MM>&s=raw|harm&from=<YYYY-MM>&to=<YYYY-MM>&y=<YYYY>&sec=<section id>. Every number
// is computed from the bundle (lib/record.ts); until public/ss-data/index.json exists every section says "not built yet".
// "Every day" (sec=days, y=<year>) reads the days of the same record from public/ka-data/daily/ (lib/everyday.ts).
// The page is in English, with Bahasa Indonesia as a switch (lib/lang.ts): every text is written in both, side by side.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Callout, Card, Page, Section, Skeleton } from '../components/ui';
import { IconPlay } from '../components/icons';
import { BeforeAfterFigure } from '../components/record/BeforeAfter';
import { RecordCalendar } from '../components/record/RecordCalendar';
import { EveryDay } from '../components/record/EveryDay';
import { ThisMonth } from '../components/record/ThisMonth';
import { HowSure } from '../components/record/HowSure';
import { RangePanel } from '../components/record/RangePanel';
import { DownloadPanel } from '../components/record/DownloadPanel';
import { AreaSearch } from '../components/record/AreaSearch';
import { RecordFlow, SatellitePixels } from '../components/home/Drawings';
import { NATIONAL as RECORD_NATIONAL, SEAM_YEAR as RECORD_SEAM } from '../lib/record';
import { summarizeValidation } from './landing-data';
import { BlindDistrictsCard } from '../components/BlindDistrictsCard';
import { fmtNumber, locale, useLang, useTr } from '../lib/lang';
import { EARLY, LATE, headline, yearTotals } from '../lib/robust';
import {
  EXTRA_WINDOWS, FIRST_SEASON_YEAR, KALTENG, SEASON_YEARS, aoiGroups, aoiName, beforeAfter, blindShare, clampRange, dateOnly, fmt1, fmtInt,
  heldRange, isYm, loadBlindRule, loadDistricts, loadFinding, loadIndex, loadMonthly, loadValidation, lockedMonths, lowDataNote, monthName,
  monthsIn, monthVerdict, obsState, pct1, pooledRatio, rangeTotals, sameMonths, seasonFileBuilt, seasonWindow, sensorRatio, settle, shortVersion, ym,
  type AoiEntry, type BlindRule, type DistrictIndex, type Finding, type Load, type MonthRange, type MonthRow, type RecordIndex,
  type SeasonWindow, type Series, type Validation,
} from '../lib/record';
import '../styles/record.css';

// from and to (YYYY-MM) are the picked date range; without them the whole record is shown.
// y is the year of the "Every day" calendar (sec=days); without it the latest year of the record is shown
interface Query { aoi: string | null; m: string | null; s: Series; from: string | null; to: string | null; y: number | null }

function readQuery(): Query {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const m = q.get('m'), from = q.get('from'), to = q.get('to'), y = q.get('y');
  const both = isYm(from) && isYm(to);
  return {
    aoi: q.get('aoi'), m: m && /^\d{4}-\d{2}$/.test(m) ? m : null, s: q.get('s') === 'raw' ? 'raw' : 'harm',
    from: both ? from : null, to: both ? to : null, y: y && /^\d{4}$/.test(y) ? Number(y) : null,
  };
}
const onRecord = () => /^#\/record(\?|$)/.test(window.location.hash);

/** The view in the address (replaceState: no new history entry, no hashchange). Other parameters (lang) are kept.
 *  `sec` names a section to open the page at: when given, it replaces the one in the address. */
function writeQuery(q: { aoi: string; m: string | null; s: Series; from: string | null; to: string | null; y: number | null; sec?: string | null }) {
  if (!onRecord()) return;
  const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  for (const k of ['aoi', 'm', 's', 'from', 'to', 'y']) p.delete(k);
  if (q.sec) p.set('sec', q.sec);
  const out = new URLSearchParams();
  out.set('aoi', q.aoi);
  if (q.m) out.set('m', q.m);
  if (q.s === 'raw') out.set('s', 'raw');
  if (q.from && q.to) { out.set('from', q.from); out.set('to', q.to); }
  if (q.y != null) out.set('y', String(q.y));
  p.forEach((v, k) => out.set(k, v));
  const want = `#/record?${out.toString()}`;
  if (window.location.hash !== want) window.history.replaceState(window.history.state, '', want);
}

function useLoad<T>(make: (() => Promise<T>) | null, deps: unknown[]): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!make) return undefined;
    let live = true;
    setLoad({ state: 'loading' });
    settle(make(), (l) => { if (live) setLoad(l); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);
  return [load, () => setAttempt((a) => a + 1)];
}

/** Holds an element at the height of the window it is at now, while the page above it changes height: `keep` puts it
 *  back (called after a redraw, and by itself whenever `watch` changes size), `end` lets go. The reader lets go too:
 *  by the wheel, a finger, a key that is not typed into a box, or a press outside `within`. Used when an area is picked
 *  inside "Every day": every section above it redraws for the new area. */
function holdInPlace(selector: string, watch: Element | null, within: string): { keep: () => void; end: () => void } | null {
  const find = () => document.querySelector<HTMLElement>(selector);
  const at = find()?.getBoundingClientRect().top;
  if (at == null) return null;
  let done = false;
  const keep = () => {
    const now = done ? null : find()?.getBoundingClientRect().top;
    if (now != null && Math.abs(now - at) >= 1) window.scrollBy({ top: now - at, behavior: 'instant' });
  };
  const watcher = watch && typeof ResizeObserver === 'function' ? new ResizeObserver(keep) : null;
  const onKey = (e: KeyboardEvent) => {
    const box = e.target instanceof HTMLElement && e.target.matches('input, textarea, select');
    if (!box || e.key === 'PageUp' || e.key === 'PageDown') end();
  };
  const onPress = (e: Event) => { if (!(e.target instanceof Element) || !e.target.closest(within)) end(); };
  const end = () => {
    if (done) return;
    done = true;
    watcher?.disconnect();
    window.clearTimeout(timer);
    window.removeEventListener('wheel', end);
    window.removeEventListener('touchmove', end);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', onPress, true);
  };
  const timer = window.setTimeout(end, 20000);   // whatever happens, not for ever
  if (watch) watcher?.observe(watch);
  window.addEventListener('wheel', end, { passive: true });
  window.addEventListener('touchmove', end, { passive: true });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPress, true);
  return { keep, end };
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The state of a section that has no data to draw: loading, not built yet, or failed (with a retry). */
function State({ load, what, height = 200, retry }: { load: Load<unknown>; what: string; height?: number; retry: () => void }) {
  const tr = useTr();
  if (load.state === 'loading') {
    return <div className="ka-rec-state" role="status" aria-label={tr(`Loading ${what}`, `Memuat ${what}`)}><Skeleton height={height} /></div>;
  }
  if (load.state === 'missing') {
    return (
      <div className="ka-rec-state ka-rec-empty" style={{ minHeight: Math.min(height, 160) }}>
        <p className="ka-rec-empty-title">{tr('Not built yet', 'Belum dibuat')}</p>
        <p className="ka-rec-note">{tr(`${cap(what)} will appear here once the data run has written it.`, `${cap(what)} akan muncul di sini setelah datanya selesai dibuat.`)}</p>
      </div>
    );
  }
  if (load.state === 'error') {
    return (
      <div className="ka-rec-state ka-rec-empty" role="alert">
        <p className="ka-rec-empty-title">{tr(`${cap(what)} could not be loaded`, `${cap(what)} tidak dapat dimuat`)}</p>
        <p className="ka-rec-note">{load.message}. {tr('Check the connection, then try again.', 'Periksa koneksi, lalu coba lagi.')}</p>
        <button type="button" className="ui-btn" onClick={retry}>{tr('Try again', 'Coba lagi')}</button>
      </div>
    );
  }
  return null;
}

export function Record() {
  const tr = useTr();
  const lang = useLang();
  const [query, setQuery] = useState<Query>(readQuery);
  useEffect(() => {
    const onHash = () => { if (onRecord()) setQuery(readQuery()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [index, retryIndex] = useLoad<RecordIndex>(loadIndex, []);
  const idx = index.state === 'ok' ? index.data : null;
  // districts (kabupaten and kota): only when the district run has written its index; without it the page is as before
  const [districts] = useLoad<DistrictIndex>(idx ? loadDistricts : null, [idx]);
  const dist = districts.state === 'ok' ? districts.data : null;
  const offered = useMemo(() => dist?.districts ?? [], [dist]);
  // an id that is not one of the bundle's areas may be a district: wait for the district index before falling back
  const waiting = !!idx && !!query.aoi && !idx.aois.some((a) => a.aoi_id === query.aoi) && districts.state === 'loading';
  const aoi: AoiEntry | null = useMemo(() => {
    if (!idx || waiting) return null;
    return idx.aois.find((a) => a.aoi_id === query.aoi) ?? offered.find((a) => a.aoi_id === query.aoi)
      ?? idx.aois.find((a) => a.aoi_id === KALTENG) ?? idx.aois[0] ?? null;
  }, [idx, query.aoi, waiting, offered]);
  const unknownAoi = !!idx && !!query.aoi && !waiting && aoi?.aoi_id !== query.aoi;
  const isDistrict = aoi?.level === 'district';

  const [monthly, retryMonthly] = useLoad<MonthRow[]>(aoi ? () => loadMonthly(aoi) : null, [aoi?.aoi_id]);
  const [national, retryNational] = useLoad<MonthRow[]>(idx ? () => {
    const n = idx.aois.find((a) => a.level === 'national');
    return n ? loadMonthly(n) : Promise.reject(new Error('no national area in index.json'));
  } : null, [idx]);
  const [validation, retryValidation] = useLoad<Validation>(idx ? loadValidation : null, [idx]);
  const [finding] = useLoad<Finding>(idx ? loadFinding : null, [idx]);
  // the built season years are read from the files themselves (a HEAD request each, from the first VIIRS year to
  // this year), so a new season appears without a list to keep; `windows` adds the point files of other quarters
  const [seasons, setSeasons] = useState<number[] | null>(null);
  const [windows, setWindows] = useState<SeasonWindow[] | null>(null);
  useEffect(() => {
    let live = true;
    const to = Math.max(new Date().getUTCFullYear(), ...SEASON_YEARS);
    const years = Array.from({ length: to - FIRST_SEASON_YEAR + 1 }, (_, i) => FIRST_SEASON_YEAR + i);
    Promise.all([
      Promise.all(years.map((y) => seasonFileBuilt(y).then((ok) => (ok ? y : null)))),
      Promise.all(EXTRA_WINDOWS.map((w) => seasonFileBuilt(w.key).then((ok) => (ok ? w : null)))),
    ]).then(([ys, extra]) => {
      if (!live) return;
      const built = ys.filter((y): y is number => y !== null);
      setSeasons(built);
      setWindows([...built.map(seasonWindow), ...extra.filter((w): w is SeasonWindow => w !== null)].sort((a, b) => (a.from < b.from ? -1 : 1)));
    });
    return () => { live = false; };
  }, []);

  // without a bundle every section shows the index's state; with it, each its own file's
  const pending: Load<unknown> = index.state === 'ok' ? { state: 'loading' } : index;
  const rows = monthly.state === 'ok' ? monthly.data : null;
  const rowsLoad: Load<unknown> = index.state !== 'ok' ? pending : monthly;
  const retryRows = index.state === 'error' ? retryIndex : retryMonthly;

  const area = aoi ? aoiName(aoi, lang) : tr('Central Kalimantan', 'Kalimantan Tengah');
  const ba = useMemo(() => (rows ? beforeAfter(rows) : null), [rows]);
  const calFrom = idx?.calibration_window?.[0] ?? 2012, calTo = idx?.calibration_window?.[1] ?? 2021;
  const ratio = useMemo(() => (rows ? sensorRatio(rows, [calFrom, calTo]) : null), [rows, calFrom, calTo]);
  const pooled = useMemo(() => (rows ? pooledRatio(rows) : null), [rows]);
  // Play the season at the first day of a month, for Central Kalimantan's built season years (Aug to Oct)
  const seasonHref = useCallback((key: string) => {
    const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
    if (aoi?.aoi_id !== KALTENG || m < 8 || m > 10 || !seasons?.includes(y)) return null;
    return `#/season?${y === 2019 ? '' : `y=${y}&`}d=${key}-01`;
  }, [aoi, seasons]);
  const computed = useMemo(() => {
    if (!idx || !aoi || !idx.obs_months) return null;
    return new Set(idx.obs_months[aoi.aoi_id] ?? []);
  }, [idx, aoi]);
  const obsElsewhere = useMemo(() => {
    if (!idx?.obs_months || !aoi) return null;
    const other = Object.keys(idx.obs_months).find((k) => k !== aoi.aoi_id && (idx.obs_months?.[k]?.length ?? 0) > 0);
    const e = other ? idx.aois.find((a) => a.aoi_id === other) : null;
    return e ? aoiName(e, lang) : null;
  }, [idx, aoi, lang]);

  const series = query.s;
  // the page opens on the latest month of the record; a month in the address, or picked in the calendar, replaces it
  const selected = useMemo(() => {
    if (!rows) return null;
    if (query.m && rows.some((r) => ym(r.year, r.month) === query.m)) return query.m;
    const last = rows[rows.length - 1];
    return last ? ym(last.year, last.month) : null;
  }, [rows, query.m]);

  // the picked date range, kept inside this area's record; none picked = the whole record
  const first = rows?.length ? ym(rows[0]!.year, rows[0]!.month) : null;
  const last = rows?.length ? ym(rows[rows.length - 1]!.year, rows[rows.length - 1]!.month) : null;
  const range: MonthRange | null = useMemo(
    () => (first && last ? clampRange(query.from, query.to, first, last) : null), [first, last, query.from, query.to]);
  const shown: MonthRange | null = useMemo(() => range ?? (first && last ? { from: first, to: last } : null), [range, first, last]);
  // the months a registered test covers (Central Kalimantan and its districts, January to October 2019): no rank or
  // ratio for a period on them; for the districts they were not computed at all (held: in no total, median or rank)
  const locked = useMemo(() => (aoi ? lockedMonths(aoi) : new Set<string>()), [aoi]);
  const totals = useMemo(() => (rows && shown ? rangeTotals(rows, shown, locked) : null), [rows, shown, locked]);
  const same = useMemo(() => (rows && shown ? sameMonths(rows, shown, locked) : null), [rows, shown, locked]);
  const held = !!aoi && !!shown && heldRange(aoi, shown);

  // keep the address in step with the view (the range as asked until the record is in, then as kept inside it)
  const secWanted = useRef<string | null>(null);
  useEffect(() => {
    if (!aoi) return;
    const r = rows ? range : query.from && query.to ? { from: query.from, to: query.to } : null;
    writeQuery({ aoi: aoi.aoi_id, m: query.m, s: series, from: r?.from ?? null, to: r?.to ?? null, y: query.y, sec: secWanted.current });
    secWanted.current = null;
  }, [aoi, query.m, series, rows, range, query.from, query.to, query.y]);
  const set = (patch: Partial<Query>) => setQuery((q) => ({ ...q, ...patch }));
  const setRange = (r: MonthRange | null) => set({ from: r?.from ?? null, to: r?.to ?? null });
  // a year picked in "Every day": the address then opens the page at that section (sec=days) and that year (y=)
  const setYear = (y: number) => { secWanted.current = 'days'; set({ y }); };
  // an area picked in "Every day" (its own picker): the same change as the picker at the top, with the year on screen
  // kept (y=) and the address opening at that section (sec=days). Every section above redraws for the new area and
  // changes height, so the figure's row of controls is held where the reader left it until the new months are drawn.
  const pageBox = useRef<HTMLDivElement>(null);
  const daysHold = useRef<ReturnType<typeof holdInPlace>>(null);
  const pickInDays = (id: string, y: number | null) => {
    daysHold.current?.end();
    daysHold.current = holdInPlace('#days .ka-days-bar', pageBox.current, '#days');
    secWanted.current = 'days';
    set({ aoi: id, m: null, y });
  };
  useLayoutEffect(() => { daysHold.current?.keep(); });
  useEffect(() => {
    if (monthly.state === 'loading') return undefined;
    const timer = window.setTimeout(() => { daysHold.current?.end(); daysHold.current = null; }, 1500);
    return () => window.clearTimeout(timer);
  }, [monthly.state, aoi?.aoi_id]);
  useEffect(() => () => daysHold.current?.end(), []);

  const built = dateOnly(idx?.generated_at, lang);
  const version = shortVersion(idx?.data_version);
  const districtNote = tr(
    'District values are approximate: each district shares its province\'s monthly conversion.',
    'Nilai kabupaten/kota adalah perkiraan: setiap kabupaten/kota memakai konversi bulanan provinsinya.');
  // a province's values from 2022 are converted with its island region's ratios (docs/DATA.md 9.1)
  const provNote = aoi?.level === 'province'
    ? tr('Province values from 2022 are converted with their island region\'s ratios, with a 90% range.',
      'Nilai provinsi sejak 2022 dikonversi dengan rasio wilayah pulaunya, dengan rentang 90%.')
    : '';
  const stamp = `${version ? tr(` Data version ${version}`, ` Versi data ${version}`) : ''}${built ? tr(`, built ${built}`, `, dibuat ${built}`) : ''}${version || built ? '.' : ''}`;
  const source = `${tr(
    'Source: NASA FIRMS archives (MODIS C6.1 Terra and Aqua, VIIRS 375 m S-NPP and NOAA-20), counted and put on one scale by us.',
    'Sumber: arsip NASA FIRMS (MODIS C6.1 Terra dan Aqua, VIIRS 375 m S-NPP dan NOAA-20), dihitung dan disatukan skalanya oleh kami.')}${stamp}${provNote ? ` ${provNote}` : ''}${isDistrict ? ` ${districtNote}` : ''}`;
  const unit = tr(
    'Fire cell-days a month: 0.01 degree cells (about 1 km) with a hotspot on a local date, counted per satellite and per day or night pass. Harmonized values are on the Aqua MODIS scale.',
    'Sel-hari api per bulan: sel 0,01 derajat (sekitar 1 km) yang memiliki titik panas pada suatu tanggal setempat, dihitung per satelit dan per lintasan siang atau malam. Nilai terharmonisasi memakai skala Aqua MODIS.');
  const calSource = `${source} ${tr('Cloud view: NASA MODIS MOD14A1 and MYD14A1 C6.1 daily FireMask.', 'Pandangan awan: FireMask harian NASA MODIS MOD14A1 dan MYD14A1 C6.1.')}`;
  const lowData = aoi && isDistrict ? lowDataNote(aoi, lang) : null;
  // the lines every downloaded file carries about this area (files stay in English)
  const fileNotes = [
    ...(aoi && isDistrict ? [
      'District values are approximate: each district shares its province\'s monthly conversion.',
      ...(dist?.method ? [`District method: ${dist.method}`] : []),
      ...(lowDataNote(aoi) ? [lowDataNote(aoi)!] : []),
      ...(locked.size ? ['January to October 2019 are not computed for this district (a registered test covers those months): their rows are empty.'] : []),
    ] : []),
    ...(aoi?.level === 'province' ? ['Province values from 2022 are converted with their island region\'s ratios, with a 90% range.'] : []),
  ];
  // the districts of the province on screen, to browse from the area picker
  const provinceId = aoi ? (isDistrict ? aoi.province_aoi : aoi.level === 'province' ? aoi.aoi_id : null) : null;
  const siblings = provinceId ? offered.filter((d) => d.province_aoi === provinceId) : [];
  const provinceEntry = provinceId ? (idx?.aois.find((a) => a.aoi_id === provinceId) ?? null) : null;
  const provinceName = provinceEntry ? aoiName(provinceEntry, lang) : (aoi?.province ?? '');

  const picker = (
    <label className="ka-rec-picker">
      <span>{tr('Area', 'Wilayah')}</span>
      <select value={aoi?.aoi_id ?? KALTENG} disabled={!idx} onChange={(e) => set({ aoi: e.target.value, m: null })}>
        {idx ? aoiGroups(idx.aois, lang).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((a) => <option key={a.aoi_id} value={a.aoi_id}>{aoiName(a, lang)}</option>)}
          </optgroup>
        )) : <option value={KALTENG}>{tr('Central Kalimantan', 'Kalimantan Tengah')}</option>}
        {siblings.length ? (
          <optgroup label={tr(`Districts of ${provinceName} (approximate)`, `Kabupaten/kota di ${provinceName} (perkiraan)`)}>
            {siblings.map((a) => <option key={a.aoi_id} value={a.aoi_id}>{aoiName(a, lang)}</option>)}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
  const toRange = () => document.getElementById('range')?.scrollIntoView({ block: 'start' });
  const selectedLocked = !!selected && locked.has(selected) && isDistrict;
  // districts summed to their province, against the province file (the district run's own check)
  const gridCheck = dist?.grid_check_summary;
  const cardYears = seasons && seasons.length ? seasons : [...SEASON_YEARS];
  const months3 = monthsIn(lang, 'short');

  return (
    <Page>
      <div className="ka-rec-page" ref={pageBox}>
      <header className="ka-rec-head">
        {/* the top: the words on the left; on the right the two satellites and their pixel sizes, the reason the raw record jumps */}
        <div className="ka-rec-hero">
        <div className="ka-rec-hero-text">
        <p className="ka-rec-eyebrow">{tr('Harmonize · MODIS × VIIRS', 'Harmonisasi · MODIS × VIIRS')}</p>
        <h1 className="ka-rec-title">{tr('Indonesia\'s fire record, on one scale', 'Rekaman api Indonesia, pada satu skala')}</h1>
        <p className="ka-rec-lead">
          {tr('VIIRS joined MODIS in 2012 and counts more of the same fires, so the raw record jumps. Here every year is on one scale, for any area.',
            'VIIRS menyusul MODIS pada 2012 dan menghitung lebih banyak dari api yang sama, sehingga rekaman mentah melonjak. Di sini setiap tahun berada pada satu skala, untuk wilayah mana pun.')}
        </p>
        <div className="ka-rec-head-acts">
          {picker}
          <button type="button" className="ui-btn" onClick={toRange}>{tr('Dates and downloads', 'Tanggal dan unduhan')}</button>
          {aoi ? (
            <a className="ka-rec-brief" href={`#/brief?aoi=${encodeURIComponent(aoi.aoi_id)}`}>
              {tr('Printable brief (Bahasa Indonesia)', 'Ringkasan siap cetak (Bahasa Indonesia)')}
            </a>
          ) : null}
          <a className="ka-head-story ui-press" href="#/story"><IconPlay size={13} /><span>{tr('Watch the story', 'Tonton cerita')}</span></a>
        </div>
        <RecordFlow onGo={(id) => document.getElementById(id)?.scrollIntoView({ block: 'start' })} />
        </div>
        <div className="ka-rec-hero-art">
          <SatellitePixels modisSince={Number(idx?.aois.find((a) => a.aoi_id === RECORD_NATIONAL)?.first?.slice(0, 4)) || null} viirsSince={RECORD_SEAM} />
        </div>
        </div>
        <details className="ka-rec-more">
          <summary>{tr('How to read this page', 'Cara membaca halaman ini')}</summary>
          <p>
            {tr(
              'When VIIRS joined MODIS in 2012, the raw fire record jumped: the sharper satellite counts more of the same fires. We put every year on the Aqua MODIS scale, with a 90% range. Where cloud left no cloud-free look, the calendar marks the gap: a zero under cloud is not a measurement.',
              'Ketika VIIRS menyusul MODIS pada 2012, rekaman api mentah melonjak: satelit yang lebih tajam menghitung lebih banyak dari api yang sama. Kami menempatkan setiap tahun pada skala Aqua MODIS, dengan rentang 90%. Bila awan tidak menyisakan pandangan bebas awan, kalender menandai celahnya: angka nol di bawah awan bukanlah pengukuran.')}
          </p>
        </details>
      </header>

      {dist && offered.length ? <AreaSearch districts={offered} onPick={(id) => set({ aoi: id, m: null })} /> : null}
      {districts.state === 'error' && idx ? (
        <p className="ka-rec-note" role="status">
          {tr(`The district list could not be loaded (${districts.message}); the ${idx.aois.length} areas of the record work as usual.`,
            `Daftar kabupaten/kota tidak dapat dimuat (${districts.message}); ${idx.aois.length} wilayah rekaman tetap berfungsi seperti biasa.`)}
        </p>
      ) : null}
      {aoi && isDistrict ? (
        <Callout title={tr(`${area} is a district${aoi.province ? ` of ${provinceName}` : ''}: its values are approximate`,
          `${area} adalah kabupaten/kota${aoi.province ? ` di ${provinceName}` : ''}: nilainya perkiraan`)}>
          <p>{districtNote}{dist?.method && lang === 'en' ? ` ${dist.method}` : ''}</p>
          {gridCheck?.median_abs_total_pct_diff != null ? (
            <p>{tr(`Districts add up to their province only approximately: over ${gridCheck.pairs ?? 'the'} province and satellite pairs, the totals differ by ${fmt1(gridCheck.median_abs_total_pct_diff)}% at the median${gridCheck.max_abs_total_pct_diff != null ? ` and ${fmt1(gridCheck.max_abs_total_pct_diff)}% at most` : ''}.`,
              `Jumlah kabupaten/kota hanya mendekati nilai provinsinya: pada ${gridCheck.pairs ?? ''} pasangan provinsi dan satelit, totalnya berbeda ${fmt1(gridCheck.median_abs_total_pct_diff, 'id')}% pada median${gridCheck.max_abs_total_pct_diff != null ? ` dan paling besar ${fmt1(gridCheck.max_abs_total_pct_diff, 'id')}%` : ''}.`)}</p>
          ) : null}
          {lowData ? <p>{lowData}</p> : null}
          {locked.size ? (
            <p>{tr(
              'January to October 2019 are held for a registered test: they are not computed for this district. They show as held, never as zero, they are in no total, median or rank, and 2019 is incomplete in the charts of this page.',
              'Januari sampai Oktober 2019 ditahan untuk sebuah uji terdaftar: bulan-bulan itu tidak dihitung untuk kabupaten/kota ini. Bulan-bulan itu tampil sebagai ditahan, bukan nol, tidak masuk dalam total, median, maupun peringkat, dan tahun 2019 tidak lengkap pada grafik di halaman ini.')}</p>
          ) : null}
        </Callout>
      ) : null}

      {index.state === 'missing' ? (
        <Callout title={tr('The Indonesia record is not built yet', 'Rekaman Indonesia belum dibuat')}>
          <p>{tr('The record\'s data is still being built. Nothing is shown here until it is in: no sample or placeholder numbers.',
            'Data rekaman masih dibuat. Tidak ada yang ditampilkan di sini sampai datanya tersedia: tidak ada angka contoh atau angka pengganti.')}</p>
          <p>{tr('Meanwhile: ', 'Sementara itu: ')}<a href="#/season">{tr('play the 2019 season', 'putar musim 2019')}</a>
            {tr(' (Central Kalimantan, day by day) or watch the ', ' (Kalimantan Tengah, hari demi hari) atau tonton ')}<a href="#/story">{tr('story', 'ceritanya')}</a>.</p>
        </Callout>
      ) : null}
      {unknownAoi ? (
        <p className="ka-rec-note" role="status">
          {tr(`The area "${query.aoi}" is not in the record; showing ${area}.`, `Wilayah "${query.aoi}" tidak ada dalam rekaman; menampilkan ${area}.`)}
        </p>
      ) : null}

      <Section id="jump" title={tr('Before and after', 'Sebelum dan sesudah')}
        subtitle={tr('The 2012 jump, and the same record on one scale.', 'Lonjakan 2012, dan rekaman yang sama pada satu skala.')}>
        {rows && ba ? (
          <BeforeAfterFigure area={area} ba={ba} source={source} ratio={ratio} pooled={pooled}
            finding={aoi?.level === 'national' && finding.state === 'ok' ? finding.data : null} />
        ) : rows ? <p className="ka-rec-note">{tr(`Too few years in ${area} to compare.`, `Terlalu sedikit tahun di ${area} untuk dibandingkan.`)}</p> : (
          <ChartFrame title={tr(`${area}: the record before and after harmonization`, `${area}: rekaman sebelum dan sesudah harmonisasi`)}
            unit={tr('Fire cell-days a year, each line indexed to its own 2003 to 2011 mean (= 100). Band: the harmonized line\'s 90% range.',
              'Sel-hari api per tahun, setiap garis diindeks terhadap rata-ratanya sendiri pada 2003 sampai 2011 (= 100). Pita: rentang 90% garis terharmonisasi.')}
            source={source}>
            <State load={rowsLoad} what={tr('the before and after chart', 'grafik sebelum dan sesudah')} height={360} retry={retryRows} />
          </ChartFrame>
        )}
        {aoi && aoi.level !== 'national' && national.state === 'ok' ? <NationalLine rows={national.data} window_={[calFrom, calTo]} /> : null}
        {aoi && aoi.level !== 'national' && national.state === 'error' ? (
          <p className="ka-rec-note">
            {tr(`The line for Indonesia as a whole could not be loaded (${national.message}). `, `Baris untuk seluruh Indonesia tidak dapat dimuat (${national.message}). `)}
            <button type="button" className="ka-rec-link" onClick={retryNational}>{tr('Try again', 'Coba lagi')}</button>
          </p>
        ) : null}
      </Section>

      <Section id="calendar" title={tr('Every month', 'Setiap bulan')}
        subtitle={tr('Colour is fire. Hatching marks months with few cloud-free looks.', 'Warna adalah api. Arsiran menandai bulan dengan sedikit pandangan bebas awan.')}>
        {rows ? (
          <RecordCalendar rows={rows} area={area} series={series} onSeries={(s) => set({ s })}
            selected={selected} onSelect={(m) => set({ m })} computed={computed} obsElsewhere={obsElsewhere}
            ratio={ratio?.ratio ?? null} unit={unit} source={calSource} seasonHref={seasonHref} range={range} locked={locked} />
        ) : (
          <ChartFrame title={tr(`${area}: every month`, `${area}: setiap bulan`)} unit={unit} source={calSource}>
            <State load={rowsLoad} what={tr('the calendar', 'kalender')} height={420} retry={retryRows} />
          </ChartFrame>
        )}
      </Section>

      {/* the picked month against the median of the same month (the latest month until one is picked in the calendar) */}
      <div className="ka-rec-top" id="month">
        <div className="ui-section-head"><h2 className="ui-section-title">{tr('This month against the median', 'Bulan ini dibanding median')}</h2></div>
        {rows && selected && aoi ? (
          <>
            <MonthBar rows={rows} selected={selected} />
            <details className="ka-rec-more">
              <summary>{tr('The month in full', 'Bulan ini selengkapnya')}</summary>
              <ThisMonth rows={rows} selected={selected} aoiId={aoi.aoi_id} computed={computed} seasons={seasons ?? []} />
            </details>
          </>
        ) : (
          <Card title={tr('This month', 'Bulan ini')} subtitle={tr('One sentence for the latest month of the record', 'Satu kalimat untuk bulan terbaru dalam rekaman')}>
            <State load={rowsLoad} what={tr('the month\'s sentence', 'kalimat bulan ini')} height={64} retry={retryRows} />
          </Card>
        )}
        {selected && selectedLocked ? (
          <p className="ka-rec-note" role="status">
            {tr(`${monthName(selected, lang)} is held for a registered test: it was not computed for this district. It is not a zero, and the satellites did not miss it.`,
              `${monthName(selected, lang)} ditahan untuk sebuah uji terdaftar: bulan ini tidak dihitung untuk kabupaten/kota ini. Ini bukan nol, dan bukan tidak terekam satelit.`)}
          </p>
        ) : null}
        {rows && selected && last ? (
          <p className="ka-rec-note">
            {selected === last
              ? tr('This is the latest month of the record. Pick any other month in the calendar above.', 'Ini bulan terbaru dalam rekaman. Pilih bulan lain pada kalender di atas.')
              : tr('Picked in the calendar above. ', 'Dipilih pada kalender di atas. ')}
            {selected !== last ? <button type="button" className="ka-rec-link" onClick={() => set({ m: null })}>{tr('Back to the latest month', 'Kembali ke bulan terbaru')}</button> : null}
          </p>
        ) : null}
      </div>

      {/* the same record day by day, one year at a time (public/ka-data/daily/, components/record/EveryDay.tsx) */}
      <Section id="days" title={tr('Every day', 'Setiap hari')}
        subtitle={tr('One year at a time, one square a day. The days of a month add up to the month above.', 'Tampil satu tahun, satu kotak untuk satu hari. Jumlah hari-hari dalam sebulan sama dengan bulan itu pada kalender di atas.')}>
        {aoi ? (
          // no key by area: the figure stays while its area changes (it loads the new days itself), so its own area
          // picker can hand the focus on
          <EveryDay aoi={aoi} area={area} rows={rows} series={series} onSeries={(s) => set({ s })}
            year={query.y} onYear={setYear} seasons={seasons} source={source}
            areas={idx?.aois} districts={offered} onArea={pickInDays}
            meta={{ area: aoiName(aoi), aoiId: aoi.aoi_id, dataVersion: idx?.data_version ?? null, notes: fileNotes }} />
        ) : (
          <ChartFrame title={tr(`${area}: every day`, `${area}: setiap hari`)}
            unit={tr('Fire cell-days a day, on the Aqua MODIS scale.', 'Sel-hari api per hari, pada skala Aqua MODIS.')} source={source}>
            <State load={pending} what={tr('the days', 'hari-harinya')} height={300} retry={retryIndex} />
          </ChartFrame>
        )}
      </Section>

      <Section id="range" title={tr('Pick a period', 'Pilih periode')}
        subtitle={tr('Pick the months, read the totals, download the numbers and the pictures.', 'Pilih bulannya, baca totalnya, unduh angka dan gambarnya.')}>
        {rows && aoi && shown && totals && first && last ? (
          <>
            <RangePanel area={area} first={first} last={last} range={range} onRange={setRange} totals={totals} same={same}
              held={held} selected={selected}
              source={`${source} ${tr('Totals are sums of the monthly record; the 90% range of a total is the sum of the monthly bounds (an approximation).',
                'Total adalah jumlah dari rekaman bulanan; rentang 90% suatu total adalah jumlah batas-batas bulanannya (suatu pendekatan).')}`} />
            <Card title={tr('Download', 'Unduh')}
              subtitle={`${area}, ${range ? tr('the picked range', 'rentang yang dipilih') : tr('the whole record (no range picked)', 'seluruh rekaman (belum ada rentang dipilih)')}`}>
              <DownloadPanel rows={rows} area={area} fileArea={aoiName(aoi)} aoiId={aoi.aoi_id} range={shown} picked={!!range} series={series} computed={computed}
                same={same} held={held} windows={windows} source={source} unit={unit} onRange={setRange}
                meta={{ area: aoiName(aoi), aoiId: aoi.aoi_id, unit: idx?.unit ?? null, dataVersion: idx?.data_version ?? null, notes: fileNotes }} />
            </Card>
          </>
        ) : rows && !rows.length ? (
          <p className="ka-rec-note">{tr(`${area} has no months in the record, so there is no period to pick.`, `${area} tidak memiliki bulan dalam rekaman, sehingga tidak ada periode untuk dipilih.`)}</p>
        ) : (
          <Card title={tr('Pick a period', 'Pilih periode')} subtitle={tr('From month, To month, totals and downloads', 'Bulan Dari, bulan Sampai, total, dan unduhan')}>
            <State load={rowsLoad} what={tr('the date range and the downloads', 'rentang tanggal dan unduhan')} height={160} retry={retryRows} />
          </Card>
        )}
      </Section>

      <Section id="sure" title={tr('How sure', 'Seberapa yakin')}
        subtitle={tr('Every test written in advance, failures included.', 'Setiap uji yang ditulis lebih dulu, termasuk yang gagal.')}>
        {validation.state === 'ok' ? <><SureStrip v={validation.data} /><details className="ka-rec-more"><summary>{tr('All the checks', 'Semua pengujian')}</summary><HowSure v={validation.data} /></details></> : (
          <ChartFrame title={tr('Error on years the fit never saw', 'Galat pada tahun-tahun yang tidak dipakai saat penyesuaian')}
            unit={tr('Absolute percentage error of the yearly total, raw against harmonized.', 'Galat persentase mutlak dari total tahunan, mentah dibandingkan terharmonisasi.')}
            source={tr('Source: our validation run (validation_results.json).', 'Sumber: proses validasi kami (validation_results.json).')}>
            <State load={index.state !== 'ok' ? pending : validation} what={tr('the validation results', 'hasil validasi')} height={230}
              retry={index.state === 'error' ? retryIndex : retryValidation} />
          </ChartFrame>
        )}
      </Section>

      {(aoi?.aoi_id ?? KALTENG) === KALTENG && !waiting ? (
        <Section id="zero" title={tr('The zero, day by day', 'Angka nol, hari demi hari')}
          subtitle={tr('Central Kalimantan, August to October: each day\'s photo, its hotspots, and where there was no cloud-free look.',
            'Kalimantan Tengah, Agustus sampai Oktober: foto tiap hari, titik panasnya, dan tempat tanpa pandangan bebas awan.')}>
          <div className="ka-rec-seasons">
            {cardYears.map((y) => {
              const ok = seasons?.includes(y) ?? false;
              // the season's months: the share of each month's no-fire cell-days with no cloud-free look, and its
              // class when it is not a cloud-free one
              const shares = rows ? [8, 9, 10].flatMap((m) => {
                const r = rows.find((x) => x.year === y && x.month === m);
                const s = r ? obsState(r, computed) : null;
                if (!r || !s || s === 'not-computed') return [];
                const b = blindShare(r);
                const cls = s === 'partial' ? tr(' (partly cloud-free)', ' (sebagian bebas awan)') : s === 'unobserved' ? tr(' (no cloud-free look)', ' (tanpa pandangan bebas awan)') : '';
                return [`${months3[m - 1]}${b != null ? ` ${pct1(b, lang)}` : ''}${cls}`];
              }) : [];
              const words = shares.length ? [`${tr('No cloud-free look: ', 'Tanpa pandangan bebas awan: ')}${shares.join(' · ')}`] : [];
              const body = (
                <>
                  <span className="ka-rec-season-y">{y}</span>
                  <span className="ka-rec-season-t">{seasons === null ? tr('Checking', 'Memeriksa') : ok ? tr('Play the season', 'Putar musim') : tr('Not built yet', 'Belum dibuat')}</span>
                  <span className="ka-rec-season-n">{words.length ? words.join(' · ') : ok
                    ? tr('1 Aug to 31 Oct, one real day per frame', '1 Agu sampai 31 Okt, satu hari nyata per bingkai')
                    : tr('The day-by-day files of this year are still being built.', 'Berkas hari demi hari untuk tahun ini masih dibuat.')}</span>
                </>
              );
              return ok ? (
                <a key={y} className="ka-rec-season ui-press" href={y === 2019 ? '#/season' : `#/season?y=${y}`}>{body}<IconPlay size={16} /></a>
              ) : (
                <div key={y} className="ka-rec-season is-off">{body}</div>
              );
            })}
          </div>
          {rows ? <MonthVsDay rows={rows} computed={computed} /> : null}
          {/* by district: the share of each district's no-fire land seen only under cloud (Aug to Oct 2019) */}
          <BlindDistrictsCard />
          <DistrictDays />
          <Card title={tr('Visibility is not a hidden-fire estimate', 'Visibilitas bukan perkiraan api tersembunyi')}
            subtitle={tr('A gap in observations does not tell us whether a fire was there', 'Celah pengamatan tidak memberi tahu apakah ada api di sana')}>
            <p className="ka-rec-note">
              {tr('This calendar shows where the satellites had no cloud-free look; it does not estimate how many fires were missed. KalenderApi v1.1 registered a separate artificial-cloud test for Pulang Pisau, August to October 2019. This build does not include that test\'s results or a hidden-fire estimate.',
                'Kalender ini menunjukkan tempat satelit tidak mendapat pandangan bebas awan; kalender ini tidak memperkirakan berapa banyak api yang terlewat. KalenderApi v1.1 mendaftarkan uji awan buatan terpisah untuk Pulang Pisau, Agustus sampai Oktober 2019. Versi ini tidak memuat hasil uji itu maupun perkiraan api tersembunyi.')}
            </p>
            <p className="ka-rec-note">
              <a href="https://github.com/13222093/kalendarapiv2/releases/tag/prereg-v1" target="_blank" rel="noreferrer">
                {tr('Read the timestamped preregistration and its pass rules', 'Baca praregistrasi bercap waktu beserta aturan kelulusannya')}
              </a>
            </p>
          </Card>
        </Section>
      ) : null}

      </div>
    </Page>
  );
}

/** The picked month against its usual month: two bars drawn from the month's own numbers (lib/record.ts monthVerdict:
 *  the value on one scale, and the median of the same month), and one sentence. */
function MonthBar({ rows, selected }: { rows: MonthRow[]; selected: string }) {
  const tr = useTr();
  const lang = useLang();
  const v = useMemo(() => monthVerdict(rows, selected), [rows, selected]);
  if (!v) return null;
  // a month that is still filling in is shown, but not compared with its usual month
  const partial = !!rows.find((r) => ym(r.year, r.month) === selected)?.flag_partial;
  const ratio = partial ? null : v.ratio;
  const usual = ratio != null && ratio > 0 ? v.H / ratio : null;
  const top = Math.max(v.H, usual ?? 0, 1);
  const month = monthName(selected, lang);
  const word = monthsIn(lang, 'long')[Number(selected.slice(5, 7)) - 1] ?? '';
  return (
    <div className="ka-rec-mbar">
      <p className="ka-rec-mbar-say">
        <b>{month}</b>: {fmtNumber(v.H, lang)} {tr('fire cell-days on one scale', 'sel-hari api pada satu skala')}
        {ratio != null ? <>, <b className={ratio > 1 ? 'is-up' : 'is-down'}>{fmtNumber(ratio, lang, ratio < 10 ? 1 : 0)} {tr('times', 'kali')}</b> {tr(`the usual ${word}`, `${word} biasanya`)}</> : null}
        {partial ? tr(' so far: the month is still filling in, so it is not compared yet.', ' sejauh ini: bulan ini masih terisi, sehingga belum dibandingkan.') : v.provisional ? tr(' (provisional).', ' (sementara).') : '.'}
      </p>
      <div className="ka-rec-mbar-rows" role="img" aria-label={tr(`${month}: ${fmtNumber(v.H, lang)} fire cell-days${usual != null ? `; the usual ${word}: ${fmtNumber(usual, lang)}` : ''}`,
        `${month}: ${fmtNumber(v.H, lang)} sel-hari api${usual != null ? `; ${word} biasanya: ${fmtNumber(usual, lang)}` : ''}`)}>
        <span>{tr('This month', 'Bulan ini')}</span>
        <i className="is-now" style={{ width: `${Math.max(1, (v.H / top) * 100)}%` }} />
        <em>{fmtNumber(v.H, lang)}</em>
        {usual != null ? (
          <>
            <span>{tr(`Usual ${word}`, `${word} biasanya`)}</span>
            <i style={{ width: `${Math.max(1, (usual / top) * 100)}%` }} />
            <em>{fmtNumber(usual, lang)}</em>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** How sure, at a glance: the tests that pass and fail, and the error on years left out of the fit (the numbers of
 *  pages/landing-data.ts summarizeValidation, as the home page and the method page print them). */
function SureStrip({ v }: { v: Validation }) {
  const tr = useTr();
  const lang = useLang();
  const s = useMemo(() => summarizeValidation(v), [v]);
  const raw = s.raw?.loyo ?? null, ours = s.ours?.loyo ?? null;
  const pct = (x: number) => `${fmtNumber(x, lang, x >= 100 ? 0 : 1)}%`;
  return (
    <ul className="ka-rec-strip">
      <li><b>{fmtNumber(s.counts.pass, lang)}</b><span>{tr("tests pass", "uji lulus")}</span></li>
      <li><b className="is-fail">{fmtNumber(s.counts.fail, lang)}</b><span>{tr('fail, and are shown below', 'gagal, dan ditampilkan di bawah')}</span></li>
      {raw != null && ours != null ? (
        <li><b className="is-one">{pct(ours)}</b><span>{tr(`error on years left out of the fit, against ${pct(raw)} raw joined`, `galat pada tahun di luar penyesuaian, dibanding ${pct(raw)} mentah disambung`)}</span></li>
      ) : null}
      <li className="is-link"><a href="#/method">{tr('Method and checks', 'Metode dan uji')} →</a></li>
    </ul>
  );
}

/** A chart's frame (title, unit line, source line) around a state that has nothing to draw yet. */
function ChartFrame({ title, unit, source, children }: { title: string; unit: string; source: string; children: ReactNode }) {
  return (
    <figure className="ui-figure ka-rec-frame">
      <figcaption className="ui-figure-head">
        <p className="ui-figure-title">{title}</p>
        <p className="ui-figure-subtitle">{unit}</p>
      </figcaption>
      {children}
      <div className="ui-figure-foot"><p className="ui-figure-source">{source}</p></div>
    </figure>
  );
}

/** Why the season plays day by day: a month can have a cloud-free look on average while single days had none. Only the
 *  range of the computed months' O and cloud share, from the bundle. */
function MonthVsDay({ rows, computed }: { rows: MonthRow[]; computed: Set<string> | null }) {
  const tr = useTr();
  const lang = useLang();
  const obs = rows.filter((r) => obsState(r, computed) !== 'not-computed' && r.O != null && r.f_cloud != null);
  if (!obs.length) return null;
  const os = obs.map((r) => r.O!), cs = obs.map((r) => r.f_cloud!);
  const allGood = obs.every((r) => r.obs_class === 'good');
  const anyNone = obs.some((r) => r.obs_class === 'unobserved');
  const o0 = Math.min(...os).toFixed(2), o1 = Math.max(...os).toFixed(2);
  const c0 = pct1(Math.min(...cs), lang), c1 = pct1(Math.max(...cs), lang);
  return (
    <p className="ka-rec-note">
      {allGood
        ? tr(`Month by month, Terra and Aqua mostly had a cloud-free look (observability ${o0} to ${o1}),`, `Bulan demi bulan, Terra dan Aqua umumnya mendapat pandangan bebas awan (observabilitas ${o0.replace('.', ',')} sampai ${o1.replace('.', ',')}),`)
        : anyNone
          ? tr(`Month by month, these months range from a cloud-free look to none (observability ${o0} to ${o1}),`, `Bulan demi bulan, bulan-bulan ini berkisar dari pandangan bebas awan sampai tanpa pandangan (observabilitas ${o0.replace('.', ',')} sampai ${o1.replace('.', ',')}),`)
          : tr(`Month by month, these months range from a cloud-free look to a partly cloud-free one (observability ${o0} to ${o1}),`, `Bulan demi bulan, bulan-bulan ini berkisar dari pandangan bebas awan sampai sebagian bebas awan (observabilitas ${o0.replace('.', ',')} sampai ${o1.replace('.', ',')}),`)}
      {' '}
      {tr(`yet ${c0} to ${c1} of each month's no-fire cell-days had no cloud-free look. A month's average also hides its worst days: on a cloudy day, a large share of the no-fire cell-days can be without a cloud-free look, which is why the season plays one day at a time.`,
        `tetapi ${c0} sampai ${c1} dari sel-hari tanpa api setiap bulan tidak mendapat pandangan bebas awan. Rata-rata sebulan juga menyembunyikan hari-hari terburuknya: pada hari berawan, sebagian besar sel-hari tanpa api bisa tanpa pandangan bebas awan. Karena itu musim diputar satu hari demi satu hari.`)}
    </p>
  );
}

/** Central Kalimantan, season by season: the district-days on which cloud left more than half of a district with no
 *  cloud-free look (ka-data/blind_rule_kalteng.json, counted from the NASA MODIS FireMask; the 2019 season is not in
 *  the file). Every number is the file's own. */
function DistrictDays() {
  const tr = useTr();
  const lang = useLang();
  const [rule, retry] = useLoad<BlindRule>(loadBlindRule, []);
  const title = tr('Days when cloud covered most of a district', 'Hari ketika awan menutupi sebagian besar kabupaten/kota');
  const sub = tr('A district-day counts when more than half of the district\'s no-fire cells had no cloud-free look from Terra or Aqua that day',
    'Satu hari-kabupaten/kota dihitung bila lebih dari separuh sel tanpa api di kabupaten/kota itu tidak mendapat pandangan bebas awan dari Terra atau Aqua pada hari itu');
  if (rule.state !== 'ok') {
    return <Card title={title} subtitle={sub}><State load={rule} what={tr('the count of district-days', 'hitungan hari-kabupaten/kota')} height={120} retry={retry} /></Card>;
  }
  const d = rule.data;
  const seasons = (d.seasons ?? []).filter((x) => x.aug_oct !== false);
  const day = (iso: string) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  return (
    <Card title={title} subtitle={sub}>
      {d.total ? (
        <p className="ka-rec-month">
          {tr(`Over ${d.total.seasons} August to October seasons, cloud left most of a district with no cloud-free look on `, `Selama ${d.total.seasons} musim Agustus sampai Oktober, awan membuat sebagian besar kabupaten/kota tanpa pandangan bebas awan pada `)}
          <span className="ka-rec-num">{fmtInt(d.total.district_days_above, lang)}</span>
          {tr(' of ', ' dari ')}<span className="ka-rec-num">{fmtInt(d.total.district_days, lang)}</span>
          {tr(' district-days (', ' hari-kabupaten/kota (')}<span className="ka-rec-num">{fmt1(d.total.share_pct, lang)}%</span>).
        </p>
      ) : null}
      {seasons.length ? (
        <div className="ui-table-wrap ka-rec-ddays" tabIndex={0} role="group" aria-label={title}>
          <table className="ui-table">
            <thead><tr>
              <th scope="col">{tr('Season', 'Musim')}</th>
              <th scope="col" className="ui-num">{tr('District-days', 'Hari-kabupaten/kota')}</th>
              <th scope="col" className="ui-num">{tr('Share', 'Bagian')}</th>
              <th scope="col">{tr('Cloudiest day', 'Hari paling berawan')}</th>
            </tr></thead>
            <tbody>
              {seasons.map((x) => (
                <tr key={x.season}>
                  <th scope="row">{x.year}</th>
                  <td className="ui-num">{fmtInt(x.district_days_above, lang)} {tr('of', 'dari')} {fmtInt(x.district_days, lang)}</td>
                  <td className="ui-num">{fmt1(x.share_pct, lang)}%</td>
                  <td>{x.worst_day ? `${day(x.worst_day.date)}: ${pct1(x.worst_day.share_no_cloud_free_look, lang)}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="ka-rec-note">
        {tr('Cloudiest day: the day of the season with the largest share of no-fire cells with no cloud-free look, over all districts together.',
          'Hari paling berawan: hari dalam musim dengan bagian terbesar sel tanpa api yang tidak mendapat pandangan bebas awan, untuk semua kabupaten/kota sekaligus.')}
        {d.excluded?.season ? tr(` The ${d.excluded.season} season is not counted: a registered test covers it.`, ` Musim ${d.excluded.season} tidak dihitung: musim itu dicakup oleh sebuah uji terdaftar.`) : ''}
        {tr(' Only days with a FireMask file from both Terra and Aqua are counted.', ' Hanya hari yang memiliki berkas FireMask dari Terra dan Aqua yang dihitung.')}
      </p>
      <p className="ka-rec-note">{tr('Source: NASA MODIS MOD14A1 and MYD14A1 C6.1 daily FireMask, counted by us per district and day.', 'Sumber: FireMask harian NASA MODIS MOD14A1 dan MYD14A1 C6.1, dihitung oleh kami per kabupaten/kota dan hari.')}</p>
    </Card>
  );
}

/** For a region or a province: the same comparison for Indonesia as a whole, in one line. */
function NationalLine({ rows, window_ }: { rows: MonthRow[]; window_: [number, number] }) {
  const tr = useTr();
  const lang = useLang();
  const ba = useMemo(() => beforeAfter(rows), [rows]);
  // the same windows as the chart's headline (lib/windows.ts through lib/robust.ts)
  const h = useMemo(() => (ba ? headline(yearTotals(ba.points)) : null), [ba]);
  const r = useMemo(() => sensorRatio(rows, window_), [rows, window_[0], window_[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!h || h.raw == null || h.harm == null) return null;
  const s = (x: number, one: string, many: string) => `${x >= 0 ? one : many} ${Math.round(Math.abs(x))}%`;
  const ratioText = r ? (lang === 'id' ? r.ratio.toFixed(1).replace('.', ',') : r.ratio.toFixed(1)) : '';
  return (
    <p className="ka-rec-note">
      {tr(`Indonesia as a whole (mean of ${LATE[0]} to ${LATE[1]} against ${EARLY[0]} to ${EARLY[1]}): stitched as recorded, detections ${s(h.raw, 'rise', 'fall')}; on the Aqua MODIS scale they ${s(h.harm, 'rise', 'fall')}.`,
        `Indonesia secara keseluruhan (rata-rata ${LATE[0]} sampai ${LATE[1]} dibandingkan ${EARLY[0]} sampai ${EARLY[1]}): disambung sebagaimana tercatat, deteksi ${s(h.raw, 'naik', 'turun')}; pada skala Aqua MODIS, deteksi ${s(h.harm, 'naik', 'turun')}.`)}
      {r ? tr(` VIIRS counted ${ratioText} fire cell-days for each MODIS Aqua one in the same months of ${r.from} to ${r.to}.`,
        ` VIIRS menghitung ${ratioText} sel-hari api untuk setiap satu sel-hari api MODIS Aqua pada bulan yang sama, ${r.from} sampai ${r.to}.`) : ''}
    </p>
  );
}
