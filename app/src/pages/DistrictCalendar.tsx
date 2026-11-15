// From KalenderApi v1.1 (the team's own build): the district calendar (#/calendar), ported into the main build.
// One row per year, one tile per month: colour = fire cell-days, hatching = share of zero-fire cell-days with no
// cloud-free look from any satellite (U / (T + U), the same cell states as the zero inspector, see pages/Zero.tsx).
// Built from the NASA daily FireMask. Months a registered test covers stay locked: the data file holds no numbers for
// them. Every number on screen comes from the data file (public/ka-data/states), copied as it is.
import { useEffect, useMemo, useState } from 'react';
import { LangToggle } from '../components/LangToggle.tsx';
import { fmtNumber, monthName, useLang, useTr } from '../lib/lang.ts';
import '../styles/calendar.css';

const BASE = `${import.meta.env.BASE_URL}ka-data/states/d/pulang-pisau/`;
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// A registered test covers this district for January to October 2019. The data file writes all of 2019 as locked; this
// page also keeps those months locked if a file ever held numbers for them.
const isHeld = (ym: string) => ym >= '2019-01' && ym <= '2019-10';

interface MonthOk {
  ym: string; locked: false; days: number; F: number; T: number; U: number; N: number; blind_share: number | null;
  sensor_days: Record<string, number>;
}
interface MonthLocked { ym: string; locked: true }
type Month = MonthOk | MonthLocked;
interface CalendarFile {
  district: string; k: number; years: number[]; water_ref: [string, string]; water_cells: number; cells: number;
  fire_unit: string; exploratory: boolean; registered_release: { tag: string; published_at: string } | null; months: Month[];
}
interface IndexFile { months: string[] }

const hatch = (b: number | null) => (b === null || b < 0.1 ? '' : b <= 0.4 ? 'h1' : 'h2');
const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export function DistrictCalendar() {
  const tr = useTr();
  const lang = useLang();
  const [cal, setCal] = useState<CalendarFile | null>(null);
  const [daily, setDaily] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const num = (n: number) => fmtNumber(Math.round(n), lang);
  const pct = (x: number | null) => (x === null ? tr('n/a', 'tidak ada') : `${fmtNumber(100 * x, lang, 1)}%`);
  const longMonth = (ym: string) => `${monthName(Number(ym.slice(5, 7)), lang, 'long')} ${ym.slice(0, 4)}`;

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${BASE}calendar.json`).then((r) => { if (!r.ok) throw new Error(`calendar.json: HTTP ${r.status}`); return r.json() as Promise<CalendarFile>; }),
      fetch(`${BASE}index.json`).then((r) => (r.ok ? (r.json() as Promise<IndexFile>) : { months: [] })),
    ]).then(([file, idx]) => {
      if (!live) return;
      const c: CalendarFile = { ...file, months: file.months.map((m): Month => (isHeld(m.ym) ? { ym: m.ym, locked: true } : m)) };
      setCal(c);
      setDaily(new Set(idx.months.filter((m) => !isHeld(m))));
      const ok = c.months.filter((m): m is MonthOk => !m.locked);
      const top = ok.reduce<MonthOk | null>((a, m) => (!a || m.F > a.F ? m : a), null);
      setSel(top?.ym ?? null);
    }).catch((e: unknown) => { if (live) setError(String(e instanceof Error ? e.message : e)); });
    return () => { live = false; };
  }, []);

  const byYm = useMemo(() => new Map((cal?.months ?? []).map((m) => [m.ym, m])), [cal]);
  const maxF = useMemo(() => Math.max(1, ...(cal?.months ?? []).map((m) => (m.locked ? 0 : m.F))), [cal]);
  const level = (f: number) => (f <= 0 ? 0 : Math.max(1, Math.min(5, Math.ceil((5 * Math.log1p(f)) / Math.log1p(maxF)))));
  const selected = sel ? byYm.get(sel) ?? null : null;
  const anyLocked = cal?.months.some((m) => m.locked) ?? false;
  const lockedYears = cal ? cal.years.filter((y) => MONTH_NUMBERS.every((m) => byYm.get(ymOf(y, m))?.locked)) : [];
  const district = cal?.district ?? 'Pulang Pisau';
  const tileLabel = (m: MonthOk) => tr(
    `${longMonth(m.ym)}: ${num(m.F)} fire cell-days, ${pct(m.blind_share)} of zeros with no cloud-free look`,
    `${longMonth(m.ym)}: ${num(m.F)} sel-hari api, ${pct(m.blind_share)} nol tanpa pandangan bebas awan`);

  return (
    <div className="ka-cal">
      <nav className="ka-cal-top" aria-label={tr('Pages', 'Halaman')}>
        <a className="ka-cal-brand" href="#/home">KalenderApi</a>
        <a href="#/home">{tr('Home', 'Beranda')}</a>
        <a href="#/record">{tr('Indonesia record', 'Rekaman Indonesia')}</a>
        <a href="#/season?y=2015">{tr('Play the season', 'Putar musim')}</a>
        <a href="#/zero">{tr('Zero inspector', 'Pemeriksa nol')}</a>
        <LangToggle className="ka-cal-lang" />
      </nav>
      {cal?.exploratory ? (
        <p className="ka-cal-ribbon" role="note">
          <b>{tr('Development data, not a result.', 'Data pengembangan, bukan hasil.')}</b>{' '}
          {tr('This is an exploratory view, not the result of the test we registered in advance. Fire is counted here in cell-days from the MODIS Terra and Aqua daily fire masks; it is not the harmonized record on the Indonesia record page.',
            'Ini tampilan eksploratif, bukan hasil uji yang kami daftarkan lebih dulu. Api di sini dihitung dalam sel-hari dari masker api harian MODIS Terra dan Aqua; ini bukan catatan terharmonisasi pada halaman Rekaman Indonesia.')}
          {lockedYears.length
            ? tr(` ${lockedYears.join(', ')} stays locked here: a test we registered in advance covers that year, so we do not compute it on this page.`,
              ` ${lockedYears.join(', ')} tetap dikunci di sini: tahun itu dicakup oleh uji yang kami daftarkan lebih dulu, sehingga tidak kami hitung di halaman ini.`)
            : ''}
        </p>
      ) : null}
      <p className="ka-cal-kicker">{tr(`District calendar · ${district} district`, `Kalender kabupaten · Kabupaten ${district}`)}</p>
      <h1 className="ka-cal-title">{tr('When does this district burn, and when can its zeros be trusted?', 'Kapan kabupaten ini terbakar, dan kapan nolnya dapat dipercaya?')}</h1>
      <p className="ka-cal-sub">
        {tr('Each tile is one month. Colour shows fire cell-days: one 1 km cell with a hotspot on one day. Hatching shows the share of zero-fire cell-days with no cloud-free look from any satellite.',
          'Setiap kotak adalah satu bulan. Warna menunjukkan sel-hari api: satu sel 1 km dengan titik panas pada satu hari. Arsiran menunjukkan bagian sel-hari tanpa api yang tidak punya pandangan bebas awan dari satelit mana pun.')}
      </p>
      {error ? <p className="ka-cal-error" role="alert">{tr(`The calendar could not be loaded (${error}).`, `Kalender tidak dapat dimuat (${error}).`)}</p> : null}
      {!cal ? (!error ? <p role="status">{tr('Loading the calendar…', 'Memuat kalender…')}</p> : null) : (
        <div className="ka-cal-body">
          <div>
            <div className="ka-cal-grid" role="grid"
              aria-label={tr(`Fire and trusted zeros by month, ${cal.district} district`, `Api dan nol tepercaya per bulan, Kabupaten ${cal.district}`)}>
              <span className="ka-cal-head" />
              {MONTH_NUMBERS.map((m) => <span key={m} className="ka-cal-head">{monthName(m, lang)}</span>)}
              <span className="ka-cal-head ka-cal-head-total">{tr('Fire cell-days', 'Sel-hari api')}</span>
              {cal.years.map((y) => {
                const row = MONTH_NUMBERS.map((m) => byYm.get(ymOf(y, m)) ?? null);
                const allLocked = row.every((m) => m?.locked);
                const total = row.reduce((s, m) => s + (m && !m.locked ? m.F : 0), 0);
                return (
                  <div key={y} role="row" style={{ display: 'contents' }}>
                    <span className="ka-cal-year" role="rowheader">{y}</span>
                    {allLocked ? (
                      <span className="ka-cal-lockrow ka-cal-tile locked" role="gridcell">
                        {tr(`Locked: a test we registered in advance covers ${y}. We do not compute it here.`,
                          `Dikunci: ${y} dicakup oleh uji yang kami daftarkan lebih dulu. Tidak kami hitung di sini.`)}
                      </span>
                    ) : row.map((m, i) => {
                      const ym = ymOf(y, i + 1);
                      if (!m) return <span key={ym} className="ka-cal-tile missing" role="gridcell" aria-label={tr(`${longMonth(ym)}: not built`, `${longMonth(ym)}: belum dibuat`)} />;
                      if (m.locked) return <span key={ym} className="ka-cal-tile locked" role="gridcell" aria-label={tr(`${longMonth(ym)}: locked`, `${longMonth(ym)}: dikunci`)} />;
                      const cls = `ka-cal-tile f${level(m.F)} ${hatch(m.blind_share)}`;
                      return (
                        <button key={ym} type="button" role="gridcell" className={cls} aria-pressed={sel === ym}
                          aria-label={tileLabel(m)} title={tileLabel(m)} onClick={() => setSel(ym)} />
                      );
                    })}
                    <span className="ka-cal-total">{allLocked ? tr('locked', 'dikunci') : num(total)}</span>
                  </div>
                );
              })}
            </div>
            <div className="ka-cal-legend" aria-label={tr('Legend', 'Legenda')}>
              <span>{tr('Fire cell-days', 'Sel-hari api')}
                <span className="ka-cal-ramp" aria-hidden="true">
                  {['#fbe3a0', '#f4ae55', '#df7230', '#b0401f', '#6a1c17'].map((c) => <i key={c} style={{ background: c }} />)}
                </span>
                {tr('(log scale)', '(skala log)')}
              </span>
              <span><i className="ka-cal-sw" aria-hidden="true" />{tr('no fire', 'tanpa api')}</span>
              <span><i className="ka-cal-sw ka-cal-tile f0 h1" style={{ height: 14 }} aria-hidden="true" />{tr('10 to 40% of zeros with no cloud-free look', '10 sampai 40% nol tanpa pandangan bebas awan')}</span>
              <span><i className="ka-cal-sw ka-cal-tile f0 h2" style={{ height: 14 }} aria-hidden="true" />{tr('over 40%', 'lebih dari 40%')}</span>
              {anyLocked ? <span><i className="ka-cal-sw ka-cal-tile locked" style={{ height: 14 }} aria-hidden="true" />{tr('locked (registered test)', 'dikunci (uji terdaftar)')}</span> : null}
            </div>
          </div>
          <aside className="ka-cal-panel" aria-live="polite">
            {selected && !selected.locked ? (
              <>
                <h2>{longMonth(selected.ym)}</h2>
                <dl>
                  <dt>{tr('Fire cell-days', 'Sel-hari api')}</dt><dd className="big">{num(selected.F)}</dd>
                  <dt>{tr('Zeros with no cloud-free look', 'Nol tanpa pandangan bebas awan')}</dt><dd className="big">{pct(selected.blind_share)}</dd>
                  <dt>{tr('Trusted zero cell-days', 'Sel-hari nol tepercaya')}</dt><dd>{num(selected.T)}</dd>
                  <dt>{tr('Untrusted zero cell-days', 'Sel-hari nol tak tepercaya')}</dt><dd>{num(selected.U)}</dd>
                  <dt>{tr('No-data cell-days', 'Sel-hari tanpa data')}</dt><dd>{num(selected.N)}</dd>
                  <dt>{tr('Days with data: Terra / Aqua / Suomi NPP', 'Hari dengan data: Terra / Aqua / Suomi NPP')}</dt>
                  <dd>{selected.sensor_days.terra_modis ?? 0} / {selected.sensor_days.aqua_modis ?? 0} / {selected.sensor_days.snpp_viirs ?? 0}</dd>
                </dl>
                {daily.has(selected.ym) ? (
                  <a className="ka-cal-open" href={`#/zero?d=${selected.ym}-01`}>{tr('Open this month in the zero inspector', 'Buka bulan ini di pemeriksa nol')}</a>
                ) : (
                  <small>
                    {daily.size
                      ? tr(`We have not built the day-by-day cells for this month; the zero inspector has ${[...daily].map(longMonth).join(', ')}.`,
                        `Sel per hari untuk bulan ini belum kami buat; pemeriksa nol berisi ${[...daily].map(longMonth).join(', ')}.`)
                      : tr('We have not built the day-by-day cells for this month.', 'Sel per hari untuk bulan ini belum kami buat.')}
                  </small>
                )}
                <small>
                  {tr(`${num(cal.cells)} cells of about 1 km; ${num(cal.water_cells)} water cells left out (water mask from ${cal.water_ref[0].slice(0, 4)}). Share with no cloud-free look = untrusted zeros ÷ (trusted + untrusted zeros). `,
                    `${num(cal.cells)} sel berukuran sekitar 1 km; ${num(cal.water_cells)} sel air tidak diikutkan (masker air dari ${cal.water_ref[0].slice(0, 4)}). Bagian tanpa pandangan bebas awan = nol tak tepercaya ÷ (nol tepercaya + nol tak tepercaya). `)}
                  {cal.k === 1
                    ? tr('One satellite with a cloud-free look is enough for a trusted zero.', 'Satu satelit dengan pandangan bebas awan sudah cukup untuk nol tepercaya.')
                    : tr(`A trusted zero needs a cloud-free look from at least ${cal.k} satellites.`, `Nol tepercaya memerlukan pandangan bebas awan dari setidaknya ${cal.k} satelit.`)}
                </small>
              </>
            ) : <p>{tr('Pick a month.', 'Pilih satu bulan.')}</p>}
          </aside>
        </div>
      )}
      <p className="ka-cal-src">
        {tr('How a cell-day is counted: fire when at least one satellite\'s daily fire mask marks a hotspot; trusted zero when there is no hotspot and at least one satellite had a cloud-free look (its mask says clear land); untrusted zero when there is no hotspot, no satellite\'s mask says clear land and at least one says cloud; no data for everything else. Cloud is the cloud class of the fire mask itself; we run no smoke test. Fire cell-days are not added across satellites.',
          'Cara sel-hari dihitung: api bila masker api harian setidaknya satu satelit menandai titik panas; nol tepercaya bila tidak ada titik panas dan setidaknya satu satelit punya pandangan bebas awan (maskernya menyatakan daratan bebas awan); nol tak tepercaya bila tidak ada titik panas, tidak ada masker satelit yang menyatakan daratan bebas awan, dan setidaknya satu menyatakan awan; tanpa data untuk selebihnya. Awan adalah kelas awan pada masker api itu sendiri; kami tidak melakukan uji asap. Sel-hari api tidak dijumlahkan antarsatelit.')}
      </p>
      <p className="ka-cal-src">
        {tr('This page looks at one district on the sensors\' own 1 km grid, satellite by satellite, while the province maps elsewhere in this app use a 0.01-degree grid, so the two shares are not the same number.',
          'Halaman ini melihat satu kabupaten pada grid 1 km milik sensor, satelit demi satelit, sedangkan peta provinsi di bagian lain aplikasi ini memakai grid 0,01 derajat, sehingga kedua persentase itu bukan angka yang sama.')}
      </p>
      <p className="ka-cal-src">
        {tr('Source: NASA MOD14A1 (Terra) and MYD14A1 (Aqua) v6.1 daily FireMask, from the public copy on Microsoft Planetary Computer. A daily mask keeps the highest class of all passes, night included. District boundary: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.',
          'Sumber: FireMask harian NASA MOD14A1 (Terra) dan MYD14A1 (Aqua) v6.1, dari salinan publik di Microsoft Planetary Computer. Masker harian menyimpan kelas tertinggi dari semua lintasan, termasuk malam. Batas kabupaten: geoBoundaries (BPS, WFP, OCHA ROAP), CC BY 3.0 IGO.')}
      </p>
    </div>
  );
}
