// KalenderApi landing page (#/home). The first screen leads with the one thing only this project measures: on one
// real day in Central Kalimantan, how much of the land with no fire detected had no cloud-free look. Every number on
// the page is computed in landing-data.ts from the versioned data files; a number that is not there is left out.
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  AI_USE_URL, FIRE_HARMONY_URL, LANDING_BRAND, LANDING_ROUTES, METHOD_NAMES, NOTICE_URL, REGION_NAMES,
  loadFrame, loadFrameSpots, loadLandingData,
  type FrameData, type FrameSpots, type LandingCheck, type LandingData,
} from './landing-data.ts';
import { LangToggle } from '../components/LangToggle.tsx';
import { fmtNumber, locale, monthName, useLang, useTr, type Lang, type Tr } from '../lib/lang.ts';
import '../styles/landing.css';

const SECTIONS = [
  { id: 'decision', en: 'The decision', idn: 'Keputusan' },
  { id: 'record', en: 'One scale', idn: 'Satu skala' },
  { id: 'checks', en: 'The checks', idn: 'Pengujian' },
  { id: 'move', en: 'See it move', idn: 'Lihat bergerak' },
  { id: 'limits', en: 'Limits and credits', idn: 'Batasan dan kredit' },
] as const;

function jumpTo(id: string, event: MouseEvent<HTMLAnchorElement>, close?: () => void) {
  event.preventDefault();
  close?.();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  target?.focus({ preventScroll: true });
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={'ka-home-reveal ' + (visible ? 'is-visible ' : '') + className}>{children}</div>;
}

// ------------------------------------------------------------------------------------------------ numbers as text

const signed = (value: number, lang: Lang, digits = 0) => (value >= 0 ? '+' : '−') + fmtNumber(Math.abs(value), lang, digits);
/** An error in %: whole numbers from 100, one decimal below. */
const errPct = (value: number, lang: Lang) => fmtNumber(value, lang, value >= 100 ? 0 : 1) + '%';
const longDate = (iso: string, lang: Lang) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(iso + 'T00:00:00Z'));
const monthYear = (key: string, lang: Lang) => `${monthName(Number(key.slice(5, 7)), lang, 'long')} ${key.slice(0, 4)}`;
const years = (ys: number[], lang: Lang) => new Intl.ListFormat(locale(lang), { style: 'long', type: 'conjunction' }).format(ys.map(String));

// ------------------------------------------------------------------------------------------------ the frame

type FrameState = { state: 'loading' } | { state: 'failed' } | { state: 'ok'; frame: FrameData };

function DayFrame({ load, spots }: { load: FrameState; spots: FrameSpots | null }) {
  const tr = useTr();
  const lang = useLang();
  // each photo: not listed while loading, then true (in) or false (did not come)
  const [photoIn, setPhotoIn] = useState<Record<string, boolean>>({});
  const frame = load.state === 'ok' ? load.frame : null;

  const geo = useMemo(() => {
    if (!frame) return null;
    const [w, s, e, n] = frame.bbox;
    const x = (lon: number) => ((lon - w) / (e - w)) * frame.width;
    const y = (lat: number) => ((n - lat) / (n - s)) * frame.height;
    const borders = frame.rings
      .map((ring) => 'M' + ring.map(([lon, lat]) => x(lon).toFixed(1) + ' ' + y(lat).toFixed(1)).join('L') + 'Z').join('');
    return { x, y, borders };
  }, [frame]);

  if (!frame || !geo) {
    return (
      <figure className="ka-home-frame">
        <div className="ka-home-frame-stage ka-home-frame-stage--empty" role="status">
          {load.state === 'loading'
            ? tr('Loading the frame of 29 October 2015…', 'Memuat bingkai 29 Oktober 2015…')
            : tr('The data of this frame could not be loaded here. No sample picture is shown in its place.',
              'Data bingkai ini tidak dapat dimuat di sini. Tidak ada gambar contoh sebagai penggantinya.')}
        </div>
      </figure>
    );
  }

  const day = longDate(frame.date, lang);
  const share = fmtNumber(frame.share, lang, 1);
  const photoFailed = frame.photos.every((p) => photoIn[p.name] === false);
  const photoNames = frame.photos.map((p) => p.name).reverse().join(tr(' over ', ' di atas '));
  const alt = tr(
    `NASA true-colour photo (${photoNames}) of Central Kalimantan on ${day}. Hatching marks the land with no fire detected and no cloud-free MODIS look that day (${share}% of it). Dots mark that day's VIIRS hotspots; thin lines are the district borders.`,
    `Foto warna asli NASA (${photoNames}) atas Kalimantan Tengah pada ${day}. Arsiran menandai daratan tanpa deteksi api yang tidak mendapat pandangan bebas awan dari MODIS pada hari itu (${share}%). Titik menandai titik panas VIIRS hari itu; garis tipis adalah batas kabupaten/kota.`,
  );

  return (
    <figure className="ka-home-frame">
      <div className="ka-home-frame-stage" style={{ aspectRatio: `${frame.width} / ${frame.height}` }} role="img" aria-label={alt}>
        <div className="ka-home-frame-photos">
          {frame.photos.map((p) => (photoIn[p.name] === false ? null : (
            <img key={p.name} className="ka-home-frame-photo" src={p.url} alt="" decoding="async" data-ready={photoIn[p.name] ? 'true' : undefined}
              onLoad={() => setPhotoIn((v) => ({ ...v, [p.name]: true }))} onError={() => setPhotoIn((v) => ({ ...v, [p.name]: false }))} />
          )))}
        </div>
        <img className="ka-home-frame-hatch" src={frame.hatchUrl} alt="" decoding="async" />
        <svg className="ka-home-frame-lines" viewBox={`0 0 ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false">
          <path d={geo.borders} className="ka-home-frame-borders ka-home-frame-borders--case" />
          <path d={geo.borders} className="ka-home-frame-borders" />
          {spots?.outside.map((p, i) => <circle key={'o' + i} cx={geo.x(p[0])} cy={geo.y(p[1])} r="1.6" className="ka-home-frame-spot ka-home-frame-spot--out" />)}
          {spots?.inside.map((p, i) => <circle key={'i' + i} cx={geo.x(p[0])} cy={geo.y(p[1])} r="2.6" className="ka-home-frame-spot" />)}
        </svg>
        <span className="ka-home-frame-stamp" aria-hidden="true">{day} · {tr('one real day', 'satu hari nyata')}</span>
        {photoFailed ? (
          <span className="ka-home-frame-nophoto" aria-hidden="true">
            {tr('The NASA photo of this day did not load; the hatch, borders and hotspots are that day’s data.',
              'Foto NASA hari ini tidak termuat; arsiran, batas, dan titik panas adalah data hari itu.')}
          </span>
        ) : null}
      </div>
      <figcaption>
        <p className="ka-home-frame-caption">
          <strong>{day}, {tr('Central Kalimantan', 'Kalimantan Tengah')}.</strong>{' '}
          {tr(
            `${share}% of the no-fire cell-days had no cloud-free look from MODIS that day (hatched). ${fmtNumber(frame.fireCells, lang)} cells had fire.`,
            `${share}% sel-hari tanpa api tidak mendapat pandangan bebas awan dari MODIS pada hari itu (diarsir). ${fmtNumber(frame.fireCells, lang)} sel berapi.`,
          )}
        </p>
        <ul className="ka-home-frame-key">
          <li><i className="ka-home-key-hatch" aria-hidden="true" />{tr('No cloud-free look (MODIS Terra and Aqua)', 'Tanpa pandangan bebas awan (MODIS Terra dan Aqua)')}</li>
          <li><i className="ka-home-key-spot" aria-hidden="true" />{spots
            ? tr(`VIIRS hotspots that day: ${fmtNumber(spots.inside.length, lang)} inside the districts, ${fmtNumber(spots.outside.length, lang)} outside (faint)`,
              `Titik panas VIIRS hari itu: ${fmtNumber(spots.inside.length, lang)} di dalam kabupaten/kota, ${fmtNumber(spots.outside.length, lang)} di luar (samar)`)
            : tr('VIIRS hotspots that day (loading)', 'Titik panas VIIRS hari itu (memuat)')}</li>
          <li><i className="ka-home-key-border" aria-hidden="true" />{tr('District borders', 'Batas kabupaten/kota')}</li>
        </ul>
        <p className="ka-home-frame-credit">
          {tr('Photo', 'Foto')}: NASA GIBS, {photoNames} {tr('true colour of that day (each fills the other’s orbit gap)', 'warna asli hari itu (saling mengisi celah orbit)')}.{' '}
          {tr('Cloud mask', 'Masker awan')}: {frame.firemaskProduct ?? 'MODIS MOD14A1 / MYD14A1 FireMask'}.{' '}
          {tr('Hotspots', 'Titik panas')}: {spots?.product ?? 'NASA FIRMS VIIRS S-NPP 375 m'}.{' '}
          {tr('Borders', 'Batas')}: geoBoundaries{frame.boundaryLicence ? ` (${frame.boundaryLicence})` : ''}.
        </p>
      </figcaption>
    </figure>
  );
}

// ------------------------------------------------------------------------------------------------ the three facts

function Facts({ data, state }: { data: LandingData | null; state: 'loading' | 'ready' | 'unavailable' }) {
  const tr = useTr();
  const lang = useLang();
  if (!data) {
    return (
      <p className="ka-home-facts-state" role="status">
        {state === 'loading'
          ? tr('Loading the record…', 'Memuat catatan…')
          : tr('The record could not be loaded here, so no numbers are shown.', 'Catatan tidak dapat dimuat di sini, sehingga tidak ada angka yang ditampilkan.')}
      </p>
    );
  }
  const { latest, change } = data;
  const v = data.validation;
  const month = latest ? monthName(latest.month, lang, 'long') : '';
  return (
    <dl className="ka-home-facts">
      {latest && latest.ratio != null ? (
        <div className="ka-home-fact">
          <dt>
            {tr('Indonesia', 'Indonesia')} · {month} {latest.year}
            {latest.provisional ? <span className="ka-home-fact-flag">{tr('provisional', 'sementara')}</span> : null}
          </dt>
          <dd>
            <b>{fmtNumber(latest.ratio, lang, 1)}× {tr(`the median ${month}`, `median ${month}`)}</b>
            <span>
              {tr(
                `${fmtNumber(latest.H, lang)} fire cell-days on the Aqua MODIS scale${latest.median != null ? `; median ${month}${latest.baseline ? ` ${latest.baseline[0]}–${latest.baseline[1]}` : ''}: ${fmtNumber(latest.median, lang)}` : ''}.${latest.provisional ? ' Near-real-time data, may change.' : ''}`,
                `${fmtNumber(latest.H, lang)} sel-hari api pada skala Aqua MODIS${latest.median != null ? `; median ${month}${latest.baseline ? ` ${latest.baseline[0]}–${latest.baseline[1]}` : ''}: ${fmtNumber(latest.median, lang)}` : ''}.${latest.provisional ? ' Data hampir waktu nyata, dapat berubah.' : ''}`,
              )}{' '}
              <em>{tr('Source: our national record, from NASA FIRMS.', 'Sumber: catatan nasional kami, dari NASA FIRMS.')}</em>
            </span>
          </dd>
        </div>
      ) : null}
      {change ? (
        <div className="ka-home-fact">
          <dt>{tr('Indonesia', 'Indonesia')} · {change.recent[0]}–{change.recent[1]} {tr('against', 'dibanding')} {change.early[0]}–{change.early[1]}</dt>
          <dd>
            <b>{signed(change.raw, lang)}% {tr('raw', 'mentah')} · {signed(change.harm, lang)}% {tr('on one scale', 'pada satu skala')}</b>
            <span>
              {tr(
                'Mean yearly fire cell-days. Raw: MODIS to 2011 joined to VIIRS from 2012. One scale: Aqua MODIS’s own count in both periods.',
                'Rata-rata sel-hari api per tahun. Mentah: MODIS sampai 2011 disambung VIIRS sejak 2012. Satu skala: hitungan Aqua MODIS sendiri di kedua periode.',
              )}{' '}
              <em>{tr('Source: NASA FIRMS archives.', 'Sumber: arsip NASA FIRMS.')}</em>
            </span>
          </dd>
        </div>
      ) : null}
      {v.raw?.loyo != null && v.ours?.loyo != null ? (
        <div className="ka-home-fact">
          <dt>{tr('Error on years left out of the fit', 'Galat pada tahun yang tidak dipakai dalam penyesuaian')}</dt>
          <dd>
            <b>{errPct(v.ours.loyo, lang)} {tr('harmonized', 'terharmonisasi')} · {errPct(v.raw.loyo, lang)} {tr('raw', 'mentah')}</b>
            <span>
              {tr(
                'Median absolute error of the national yearly total, each year left out in turn.',
                'Median galat absolut total nasional tahunan, setiap tahun bergantian tidak dipakai.',
              )}{' '}
              <em>{tr('Source: our validation file.', 'Sumber: berkas validasi kami.')}</em>
            </span>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

// ------------------------------------------------------------------------------------------------ the chart

function LandingChart({ data }: { data: LandingData }) {
  const tr = useTr();
  const width = 860;
  const height = 360;
  const pad = { left: 54, right: 24, top: 24, bottom: 42 };
  const points = data.points;
  const first = points[0]?.year ?? 2003;
  const last = points[points.length - 1]?.year ?? first + 1;
  const conv = data.convertedFrom;
  const yMax = Math.max(120, ...points.map((p) => Math.max(p.raw, p.fair, p.low, p.high))) * 1.08;
  const x = (year: number) => pad.left + ((year - first) / Math.max(1, last - first)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - value / yMax) * (height - pad.top - pad.bottom);
  const line = (pts: typeof points, key: 'raw' | 'fair') => pts.map((p, i) => (i ? 'L' : 'M') + x(p.year).toFixed(1) + ',' + y(p[key]).toFixed(1)).join('');
  // the one-scale line in two parts: Aqua MODIS's own count, then (from the last Aqua year on) converted VIIRS
  const own = conv == null ? points : points.filter((p) => p.year < conv);
  const converted = conv == null ? [] : points.filter((p) => p.year >= conv - 1);
  const band = points.map((p, i) => (i ? 'L' : 'M') + x(p.year).toFixed(1) + ',' + y(p.high).toFixed(1)).join('')
    + [...points].reverse().map((p) => 'L' + x(p.year).toFixed(1) + ',' + y(p.low).toFixed(1)).join('') + 'Z';
  const ticks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);
  const ownTo = conv != null ? conv - 1 : last;

  return (
    <figure className="ka-home-chart" aria-labelledby="ka-home-chart-caption">
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-labelledby="ka-home-svg-title ka-home-svg-desc">
        <title id="ka-home-svg-title">{tr('Indonesia, yearly fire cell-days, joined two ways', 'Indonesia, sel-hari api per tahun, digabung dengan dua cara')}</title>
        <desc id="ka-home-svg-desc">
          {tr(
            `Two yearly series, each indexed to its own 2003 to 2011 mean. The raw splice jumps when VIIRS replaces MODIS in 2012. The one-scale line is Aqua MODIS's own count to ${ownTo}${conv != null ? ` and VIIRS converted to the Aqua scale from ${conv}` : ''}.`,
            `Dua deret tahunan, masing-masing diindeks terhadap rata-rata 2003 sampai 2011 miliknya. Sambungan mentah melonjak ketika VIIRS menggantikan MODIS pada 2012. Garis satu skala adalah hitungan Aqua MODIS sendiri sampai ${ownTo}${conv != null ? ` dan VIIRS yang dikonversi ke skala Aqua sejak ${conv}` : ''}.`,
          )}
        </desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="ka-home-gridline" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="ka-home-axis-label">{Math.round(tick)}</text>
          </g>
        ))}
        {[first, 2012, conv ?? last, last].filter((yr, i, xs) => yr >= first && yr <= last && xs.indexOf(yr) === i).map((yr) => (
          <text key={yr} x={x(yr)} y={height - 12} textAnchor="middle" className="ka-home-axis-label">{yr}</text>
        ))}
        {first <= 2012 && last >= 2012 ? (
          <g>
            <line x1={x(2012)} x2={x(2012)} y1={pad.top} y2={height - pad.bottom} className="ka-home-seam" />
            <text x={x(2012) + 6} y={pad.top + 12} className="ka-home-seam-label">{tr('2012 · raw splice switches to VIIRS', '2012 · sambungan mentah beralih ke VIIRS')}</text>
          </g>
        ) : null}
        {conv != null && conv <= last ? (
          <g>
            <line x1={x(conv)} x2={x(conv)} y1={pad.top} y2={height - pad.bottom} className="ka-home-seam ka-home-seam--fail" />
            <text x={x(conv) - 6} y={pad.top + 30} textAnchor="end" className="ka-home-seam-label ka-home-seam-label--fail">{tr(`${conv} · converted VIIRS · seam test fails`, `${conv} · VIIRS dikonversi · uji sambungan gagal`)}</text>
          </g>
        ) : null}
        <path d={band} className="ka-home-band" />
        <path d={line(points, 'raw')} pathLength={1} className="ka-home-line ka-home-line--raw" />
        <path d={line(own, 'fair')} pathLength={1} className="ka-home-line ka-home-line--fair" />
        {converted.length > 1 ? <path d={line(converted, 'fair')} className="ka-home-line-converted" /> : null}
      </svg>
      <figcaption id="ka-home-chart-caption">
        {tr(
          'Yearly fire cell-days in Indonesia, each series indexed to its own 2003–2011 mean (= 100). Complete years only.',
          'Sel-hari api per tahun di Indonesia, tiap deret diindeks terhadap rata-rata 2003–2011 miliknya (= 100). Hanya tahun yang lengkap.',
        )}
      </figcaption>
      <ul className="ka-home-chart-legend" aria-label={tr('Chart legend', 'Keterangan grafik')}>
        <li><i className="ka-home-legend-raw" />{tr('Raw splice: MODIS to 2011, VIIRS from 2012', 'Sambungan mentah: MODIS sampai 2011, VIIRS sejak 2012')}</li>
        <li><i className="ka-home-legend-fair" />{tr(`One scale: Aqua MODIS’s own count to ${ownTo}`, `Satu skala: hitungan Aqua MODIS sendiri sampai ${ownTo}`)}</li>
        {conv != null ? <li><i className="ka-home-legend-conv" />{tr(`One scale: VIIRS converted to the Aqua scale from ${conv}`, `Satu skala: VIIRS dikonversi ke skala Aqua sejak ${conv}`)}</li> : null}
        {conv != null ? <li><i className="ka-home-legend-band" />{tr('90% range of the conversion', 'Rentang 90% konversi')}</li> : null}
      </ul>
    </figure>
  );
}

function seamText(check: LandingCheck | null, lang: Lang, tr: Tr): string {
  if (!check || check.value == null) return '';
  const v = signed(check.value, lang, 3);
  return check.ci
    ? tr(`level change ${v} on a log scale, 90% interval ${signed(check.ci[0], lang, 3)} to ${signed(check.ci[1], lang, 3)}`,
      `perubahan tingkat ${v} pada skala log, interval 90% ${signed(check.ci[0], lang, 3)} sampai ${signed(check.ci[1], lang, 3)}`)
    : tr(`level change ${v} on a log scale`, `perubahan tingkat ${v} pada skala log`);
}

// ------------------------------------------------------------------------------------------------ the page

export function Landing() {
  const tr = useTr();
  const lang = useLang();
  const [data, setData] = useState<LandingData | null>(null);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [frame, setFrame] = useState<FrameState>({ state: 'loading' });
  const [spots, setSpots] = useState<FrameSpots | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = LANDING_BRAND + ' · ' + (lang === 'id' ? 'Nol titik api belum tentu nol api' : 'Zero hotspots is not always zero fire');
  }, [lang]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let live = true;
    loadLandingData()
      .then((next) => {
        if (!live) return;
        setData(next);
        setDataState(next ? 'ready' : 'unavailable');
      })
      .catch(() => { if (live) setDataState('unavailable'); });
    loadFrame()
      .then((next) => {
        if (!live) return;
        setFrame(next ? { state: 'ok', frame: next } : { state: 'failed' });
        // the day's hotspots come from the season file Play the season draws (large): after the frame is up
        if (next) loadFrameSpots(next.rings).then((s) => { if (live) setSpots(s); }).catch(() => undefined);
      })
      .catch(() => { if (live) setFrame({ state: 'failed' }); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 10);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navJump = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => jumpTo(id, event, () => setMenuOpen(false));
  const f = frame.state === 'ok' ? frame.frame : null;
  const v = data?.validation ?? null;
  const visYears = data && data.visYears.length ? years(data.visYears, lang) : null;
  const regionFails = v ? v.regions.filter((r) => r.status === 'fail') : [];
  const better = v?.simplerBetter[0] ?? null;
  const forwardRival = v ? v.others.find((m) => m.forwardKge != null && v.ours?.forwardKge != null && m.forwardKge > v.ours.forwardKge) ?? null : null;
  const name = (map: Record<string, [string, string]>, key: string, fallback: [string, string]) => tr(...(map[key] ?? fallback));

  return (
    <div className="ka-home">
      <a className="ka-home-skip" href="#home-main" onClick={(event) => jumpTo('home-main', event)}>{tr('Skip to content', 'Lompat ke isi')}</a>

      <header className="ka-home-header" data-scrolled={scrolled ? 'true' : undefined}>
        <div className="ka-home-header-inner">
          <a className="ka-home-brand" href={LANDING_ROUTES.home} aria-label={LANDING_BRAND + ' · ' + tr('home', 'beranda')}>
            <span className="ka-home-brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>{LANDING_BRAND}</span>
          </a>
          <nav className={'ka-home-nav' + (menuOpen ? ' is-open' : '')} id="ka-home-navigation" aria-label={tr('Main navigation', 'Navigasi utama')}>
            {SECTIONS.map((item) => <a key={item.id} href={'#' + item.id} onClick={navJump(item.id)}>{tr(item.en, item.idn)}</a>)}
            <a href={LANDING_ROUTES.method} onClick={() => setMenuOpen(false)}>{tr('Method', 'Metode')}</a>
            <a className="ka-home-nav-mobile-cta" href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')} <span aria-hidden="true">↗</span></a>
          </nav>
          <div className="ka-home-header-tools">
            <LangToggle />
            <a className="ka-home-header-cta" href={LANDING_ROUTES.record}>{tr('Open the calendar', 'Buka kalender')} <span aria-hidden="true">↗</span></a>
            <button
              className="ka-home-menu-button"
              type="button"
              aria-label={menuOpen ? tr('Close navigation menu', 'Tutup menu navigasi') : tr('Open navigation menu', 'Buka menu navigasi')}
              aria-expanded={menuOpen}
              aria-controls="ka-home-navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <main id="home-main" tabIndex={-1}>
        <section className="ka-home-hero" aria-labelledby="ka-home-title">
          <div className="ka-home-hero-noise" aria-hidden="true" />
          <div className="ka-home-hero-inner">
            <div className="ka-home-hero-copy">
              <p className="ka-home-eyebrow"><span className="ka-home-live-dot" aria-hidden="true" /> {tr('For district fire officers · Central Kalimantan, Indonesia', 'Untuk petugas kebakaran kabupaten/kota · Kalimantan Tengah')}</p>
              <h1 id="ka-home-title">
                {lang === 'id' ? <>Nol titik api<br /><em>belum tentu nol api.</em></> : <>Zero hotspots is<br /><em>not always zero fire.</em></>}
              </h1>
              <p className="ka-home-hero-lead">
                {data?.spanYears
                  ? tr(
                    `KalenderApi puts ${data.spanYears} years of MODIS and VIIRS fire detections for Indonesia on one scale, then marks the days MODIS had no cloud-free look at the ground.`,
                    `KalenderApi menyatukan ${data.spanYears} tahun deteksi api MODIS dan VIIRS di Indonesia pada satu skala, lalu menandai hari ketika MODIS tidak mendapat pandangan bebas awan ke permukaan.`,
                  )
                  : tr(
                    'KalenderApi puts Indonesia’s MODIS and VIIRS fire detections on one scale, then marks the days MODIS had no cloud-free look at the ground.',
                    'KalenderApi menyatukan deteksi api MODIS dan VIIRS di Indonesia pada satu skala, lalu menandai hari ketika MODIS tidak mendapat pandangan bebas awan ke permukaan.',
                  )}
              </p>
              <div className="ka-home-hero-actions">
                <a className="ka-home-button ka-home-button--primary" href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')} <span aria-hidden="true">↗</span></a>
                <a className="ka-home-button ka-home-button--quiet" href={LANDING_ROUTES.season}>{tr('Play the 2015 season', 'Putar musim 2015')} <span aria-hidden="true">▶</span></a>
                <a className="ka-home-hero-third" href={LANDING_ROUTES.brief}>{tr('District brief', 'Ringkasan kabupaten/kota')} <span aria-hidden="true">→</span></a>
              </div>
            </div>
            <div className="ka-home-hero-figure">
              <DayFrame load={frame} spots={spots} />
            </div>
            <div className="ka-home-hero-facts">
              <Facts data={data} state={dataState} />
              <p className="ka-home-hero-note">
                {tr(
                  'A fire cell-day is one 0.01° cell with a detection on one local date, counted per satellite and per day or night pass. It is not a count of fires or burned area.',
                  'Satu sel-hari api adalah satu sel 0,01° dengan deteksi pada satu tanggal setempat, dihitung per satelit dan per lintasan siang atau malam. Ini bukan jumlah kebakaran atau luas terbakar.',
                )}
              </p>
            </div>
          </div>
        </section>

        {/* 1. The decision */}
        <section className="ka-home-section ka-home-decision" id="decision" tabIndex={-1} aria-labelledby="ka-home-decision-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">01 · {tr('The decision', 'Keputusan')}</p>
              <h2 id="ka-home-decision-title">{tr('Before you report zero, check whether there was a look.', 'Sebelum melaporkan nol, periksa apakah ada pandangan.')}</h2>
              <p>
                {tr(
                  'KalenderApi is made for three people who plan around fire in one district (kabupaten/kota). We have not yet tested it with their agencies.',
                  'KalenderApi dibuat untuk tiga pihak yang merencanakan penanganan api di satu kabupaten/kota. Kami belum mengujinya bersama instansi mereka.',
                )}
              </p>
            </Reveal>
            <Reveal>
              <ul className="ka-home-users">
                <li><b>{tr('A BPBD district officer', 'Petugas BPBD kabupaten/kota')}</b><span>{tr('writes the day’s hotspot report.', 'menyusun laporan titik panas harian.')}</span></li>
                <li><b>{tr('A Manggala Agni patrol planner', 'Perencana patroli Manggala Agni')}</b><span>{tr('decides where the next patrol goes.', 'menentukan tujuan patroli berikutnya.')}</span></li>
                <li><b>{tr('A peat restoration team', 'Tim restorasi gambut')}</b><span>{tr('follows fire around its sites from season to season.', 'mengikuti api di sekitar lokasinya dari musim ke musim.')}</span></li>
              </ul>
            </Reveal>
            <div className="ka-home-questions">
              <Reveal className="ka-home-question">
                <span className="ka-home-question-n">1</span>
                <h3>{tr('When does my area usually burn?', 'Kapan wilayah saya biasanya terbakar?')}</h3>
                <p>
                  {data?.firstMonth
                    ? tr(`A calendar of every month since ${monthYear(data.firstMonth, lang)}, on one scale, for Indonesia, its provinces and each kabupaten/kota.`,
                      `Kalender setiap bulan sejak ${monthYear(data.firstMonth, lang)}, pada satu skala, untuk Indonesia, provinsi, dan setiap kabupaten/kota.`)
                    : tr('A calendar of every month, on one scale, for Indonesia, its provinces and each kabupaten/kota.',
                      'Kalender setiap bulan, pada satu skala, untuk Indonesia, provinsi, dan setiap kabupaten/kota.')}
                </p>
                <a className="ka-home-text-link" href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')} <span aria-hidden="true">↗</span></a>
              </Reveal>
              <Reveal className="ka-home-question">
                <span className="ka-home-question-n">2</span>
                <h3>{tr('Is this month unusual?', 'Apakah bulan ini tidak biasa?')}</h3>
                <p>{tr('The latest month against the median of the same month, with its rank among the years of the record, on one printable page.',
                  'Bulan terbaru dibanding median bulan yang sama, beserta peringkatnya di antara tahun-tahun dalam catatan, dalam satu halaman siap cetak.')}</p>
                <a className="ka-home-text-link" href={LANDING_ROUTES.brief}>{tr('Open the district brief', 'Buka ringkasan kabupaten/kota')} <span aria-hidden="true">↗</span></a>
              </Reveal>
              <Reveal className="ka-home-question">
                <span className="ka-home-question-n">3</span>
                <h3>{tr('Can today’s zero be taken at face value?', 'Bisakah nol hari ini diterima begitu saja?')}</h3>
                <p>
                  {visYears
                    ? tr(`For Central Kalimantan, August to October of ${visYears}: day by day and district by district, the share of no-fire land with no cloud-free MODIS look.`,
                      `Untuk Kalimantan Tengah, Agustus sampai Oktober ${visYears}: hari demi hari dan per kabupaten/kota, porsi daratan tanpa api yang tidak mendapat pandangan bebas awan dari MODIS.`)
                    : tr('For Central Kalimantan: day by day and district by district, the share of no-fire land with no cloud-free MODIS look.',
                      'Untuk Kalimantan Tengah: hari demi hari dan per kabupaten/kota, porsi daratan tanpa api yang tidak mendapat pandangan bebas awan dari MODIS.')}
                </p>
                <a className="ka-home-text-link" href={LANDING_ROUTES.season}>{tr('Play the 2015 season', 'Putar musim 2015')} <span aria-hidden="true">↗</span></a>
              </Reveal>
            </div>
            <Reveal className="ka-home-rule">
              <p className="ka-home-rule-label">{tr('The rule', 'Aturannya')}</p>
              <p className="ka-home-rule-text">
                {tr(
                  'Do not report “no hotspots” for a day on which most of the district had no cloud-free look. Report “not observed”, and ask for a ground check or a second source.',
                  'Jangan melaporkan “nihil titik panas” untuk hari ketika sebagian besar wilayah kabupaten/kota tidak mendapat pandangan bebas awan. Laporkan “tidak teramati”, lalu minta pengecekan lapangan atau sumber kedua.',
                )}
              </p>
              {f && f.districts > 0 ? (
                <p className="ka-home-rule-evidence">
                  {tr(
                    `On ${longDate(f.date, lang)}, more than half of the no-fire land had no cloud-free look in ${fmtNumber(f.districtsMostly, lang)} of ${fmtNumber(f.districts, lang)} districts of Central Kalimantan. From ${longDate(f.seasonFrom, lang)} to ${longDate(f.seasonTo, lang)} that happened on ${fmtNumber(f.seasonMostly, lang)} of ${fmtNumber(f.seasonDistrictDays, lang)} district-days.`,
                    `Pada ${longDate(f.date, lang)}, lebih dari separuh daratan tanpa api tidak mendapat pandangan bebas awan di ${fmtNumber(f.districtsMostly, lang)} dari ${fmtNumber(f.districts, lang)} kabupaten/kota di Kalimantan Tengah. Dari ${longDate(f.seasonFrom, lang)} sampai ${longDate(f.seasonTo, lang)}, hal itu terjadi pada ${fmtNumber(f.seasonMostly, lang)} dari ${fmtNumber(f.seasonDistrictDays, lang)} hari-kabupaten/kota.`,
                  )}
                </p>
              ) : null}
              <p className="ka-home-rule-bounds">
                {tr(
                  'What the layer measures: cloud only, from MODIS Terra and Aqua, for past seasons. It is not a live service. Thick smoke is mostly not flagged as cloud, so the true share of land not observed is higher. A cloud-free look is not proof that nothing burned, and we do not estimate fire under cloud.',
                  'Yang diukur lapisan ini: hanya awan, dari MODIS Terra dan Aqua, untuk musim-musim yang sudah lewat. Ini bukan layanan langsung. Asap tebal umumnya tidak ditandai sebagai awan, sehingga porsi daratan yang sebenarnya tidak teramati lebih besar. Pandangan bebas awan bukan bukti bahwa tidak ada yang terbakar, dan kami tidak menaksir api di bawah awan.',
                )}
              </p>
            </Reveal>
          </div>
        </section>

        {/* 2. The record on one scale */}
        <section className="ka-home-section ka-home-evidence" id="record" tabIndex={-1} aria-labelledby="ka-home-record-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">02 · {tr('The record on one scale', 'Catatan pada satu skala')}</p>
              <h2 id="ka-home-record-title">{tr('One scale, and what the line is made of.', 'Satu skala, dan dari apa garisnya dibuat.')}</h2>
              <p>
                {tr(
                  'VIIRS detects smaller fires than MODIS, so joining the two records as they come makes the count jump in 2012. We keep one scale throughout: the Aqua MODIS scale.',
                  'VIIRS mendeteksi api yang lebih kecil daripada MODIS, sehingga menyambung kedua catatan apa adanya membuat hitungan melonjak pada 2012. Kami memakai satu skala sepanjang catatan: skala Aqua MODIS.',
                )}
              </p>
            </Reveal>
            <Reveal className="ka-home-chart-wrap">
              <div className="ka-home-chart-head">
                <div>
                  <p className="ka-home-chart-label">{tr('Indonesia · yearly record', 'Indonesia · catatan tahunan')}</p>
                  <h3>{tr('The same years, joined two ways.', 'Tahun yang sama, digabung dengan dua cara.')}</h3>
                </div>
              </div>
              {dataState === 'ready' && data ? (
                <LandingChart data={data} />
              ) : dataState === 'loading' ? (
                <div className="ka-home-loading-chart" role="status"><span />{tr('Loading the record…', 'Memuat catatan…')}</div>
              ) : (
                <div className="ka-home-unavailable" role="status">
                  <p>{tr('The record could not be loaded here. No sample values are shown in its place.', 'Catatan tidak dapat dimuat di sini. Tidak ada nilai contoh sebagai penggantinya.')}</p>
                  <a href={LANDING_ROUTES.record}>{tr('Open the Indonesia record', 'Buka catatan Indonesia')} <span aria-hidden="true">↗</span></a>
                </div>
              )}
              {data ? (
                <p className="ka-home-source-note">
                  {data.convertedFrom != null
                    ? tr(
                      `What the one-scale line is: Aqua MODIS’s own count to ${data.convertedFrom - 1}; from ${data.convertedFrom}, VIIRS S-NPP converted to the Aqua scale by our harmonization${data.calibration ? `, fitted on ${data.calibration[0]}–${data.calibration[1]}` : ''}.`,
                      `Isi garis satu skala: hitungan Aqua MODIS sendiri sampai ${data.convertedFrom - 1}; sejak ${data.convertedFrom}, VIIRS S-NPP yang dikonversi ke skala Aqua oleh harmonisasi kami${data.calibration ? `, disesuaikan pada ${data.calibration[0]}–${data.calibration[1]}` : ''}.`,
                    ) : null}{' '}
                  {v?.seam2022 && v.seam2022.passed === false && data.convertedFrom != null ? (
                    <strong>
                      {tr(`The ${data.convertedFrom} seam test fails`, `Uji sambungan ${data.convertedFrom} gagal`)}
                      {seamText(v.seam2022, lang, tr) ? ` (${seamText(v.seam2022, lang, tr)})` : ''}.
                    </strong>
                  ) : null}{' '}
                  {data.seamYears.length
                    ? tr(
                      `Against Aqua MODIS’s own count of the same year, our converted value was ${data.seamYears.map((s) => `${fmtNumber(s.ratio, lang, 2)}× (${s.year})`).join(', ')}.`,
                      `Dibanding hitungan Aqua MODIS sendiri pada tahun yang sama, nilai konversi kami adalah ${data.seamYears.map((s) => `${fmtNumber(s.ratio, lang, 2)}× (${s.year})`).join(', ')}.`,
                    ) : null}{' '}
                  {tr('Source: NASA FIRMS archives (MODIS Collection 6.1, VIIRS 375 m).', 'Sumber: arsip NASA FIRMS (MODIS Collection 6.1, VIIRS 375 m).')}
                </p>
              ) : null}
            </Reveal>
            <Reveal className="ka-home-question-note">
              <span className="ka-home-note-mark" aria-hidden="true">↗</span>
              <p>
                <strong>{tr('This is a statement about detections.', 'Ini pernyataan tentang deteksi.')}</strong>{' '}
                {tr('It does not say why they changed, and it is not burned area.', 'Ini tidak menjelaskan mengapa deteksi berubah, dan bukan luas terbakar.')}
              </p>
            </Reveal>
          </div>
        </section>

        {/* 3. The checks */}
        <section className="ka-home-section ka-home-validation" id="checks" tabIndex={-1} aria-labelledby="ka-home-checks-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">03 · {tr('The checks', 'Pengujian')}</p>
              <h2 id="ka-home-checks-title">{tr('What held up, and what did not.', 'Yang bertahan, dan yang tidak.')}</h2>
              <p>{tr('The checks were written down before the run. We lead with the error on years the fit never saw, then the failures.',
                'Pengujian ditulis sebelum dijalankan. Kami mulai dari galat pada tahun yang tidak pernah dilihat penyesuaian, lalu kegagalannya.')}</p>
            </Reveal>
            {v ? (
              <>
                {v.ours && v.raw ? (
                  <Reveal>
                    <div className="ka-home-held" role="table" aria-label={tr('Error on years left out of the fit', 'Galat pada tahun yang tidak dipakai dalam penyesuaian')}>
                      <div className="ka-home-held-row ka-home-held-head" role="row">
                        <span role="columnheader">{tr('Year left out', 'Tahun yang tidak dipakai')}</span>
                        <span role="columnheader">{tr('Our harmonization', 'Harmonisasi kami')}</span>
                        <span role="columnheader">{tr('Raw splice', 'Sambungan mentah')}</span>
                      </div>
                      {([
                        [tr('Each year in turn (median)', 'Setiap tahun bergantian (median)'), v.ours.loyo, v.raw.loyo],
                        ['2015', v.ours.y2015, v.raw.y2015],
                        ['2019', v.ours.y2019, v.raw.y2019],
                      ] as [string, number | null, number | null][]).filter((row) => row[1] != null && row[2] != null).map((row) => (
                        <div className="ka-home-held-row" role="row" key={row[0]}>
                          <span role="rowheader">{row[0]}</span>
                          <span role="cell" className="ka-home-held-ours">{errPct(row[1]!, lang)}</span>
                          <span role="cell" className="ka-home-held-raw">{errPct(row[2]!, lang)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="ka-home-held-note">
                      {tr('Absolute error of the yearly national total, in percent, for a year left out of the fit.',
                        'Galat absolut total nasional tahunan, dalam persen, untuk tahun yang tidak dipakai dalam penyesuaian.')}
                    </p>
                  </Reveal>
                ) : null}
                <Reveal>
                  <h3 className="ka-home-fail-title">{tr('What failed', 'Yang gagal')}</h3>
                  <ul className="ka-home-fails">
                    {v.seam2022 && v.seam2022.passed === false ? (
                      <li>
                        <b>{tr('The 2022 seam.', 'Sambungan 2022.')}</b>{' '}
                        {tr(`Where the record changes from Aqua MODIS’s own count to converted VIIRS, the level shifts more than chance seams do (${seamText(v.seam2022, lang, tr)}).`,
                          `Di titik catatan beralih dari hitungan Aqua MODIS sendiri ke VIIRS yang dikonversi, tingkatnya bergeser lebih besar daripada sambungan acak (${seamText(v.seam2022, lang, tr)}).`)}
                      </li>
                    ) : null}
                    {regionFails.length ? (
                      <li>
                        <b>{tr(`Transfer to a region left out: ${regionFails.length} of ${v.regions.length} regions.`, `Penerapan ke wilayah yang tidak dipakai: ${regionFails.length} dari ${v.regions.length} wilayah.`)}</b>{' '}
                        {tr('Median error', 'Median galat')}: {regionFails.map((r) => `${name(REGION_NAMES, r.name, [r.name, r.name])} ${r.value != null ? errPct(r.value, lang) : ''}`).join('; ')}.
                      </li>
                    ) : null}
                    {better && v.ours?.loyo != null && better.loyo != null ? (
                      <li>
                        <b>{tr('A simpler method does better on held-out years.', 'Metode yang lebih sederhana lebih baik pada tahun yang tidak dipakai.')}</b>{' '}
                        {tr(
                          `With ${name(METHOD_NAMES, better.method, ['a simpler method', 'metode yang lebih sederhana'])}, the median error is ${errPct(better.loyo, lang)}, against ${errPct(v.ours.loyo, lang)} for ours. We kept the method named before the run rather than switch after seeing the results.`,
                          `Dengan ${name(METHOD_NAMES, better.method, ['a simpler method', 'metode yang lebih sederhana'])}, median galatnya ${errPct(better.loyo, lang)}, dibanding ${errPct(v.ours.loyo, lang)} untuk metode kami. Kami mempertahankan metode yang disebut sebelum dijalankan, bukan menggantinya setelah melihat hasil.`,
                        )}
                      </li>
                    ) : null}
                    {v.forward && v.forward.passed === false && v.ours?.forwardKge != null ? (
                      <li>
                        <b>{tr('The forward-in-time test.', 'Uji maju dalam waktu.')}</b>{' '}
                        {tr(
                          `Fitted on the earlier overlap years and predicting the later ones, our method scores ${fmtNumber(v.ours.forwardKge, lang, 3)}${forwardRival?.forwardKge != null ? `, below ${fmtNumber(forwardRival.forwardKge, lang, 3)} for ${name(METHOD_NAMES, forwardRival.method, ['a simpler method', 'metode yang lebih sederhana'])}` : ''} (Kling-Gupta efficiency, 1 is perfect).`,
                          `Disesuaikan pada tahun-tahun tumpang-tindih awal untuk memprediksi tahun berikutnya, metode kami mendapat skor ${fmtNumber(v.ours.forwardKge, lang, 3)}${forwardRival?.forwardKge != null ? `, di bawah ${fmtNumber(forwardRival.forwardKge, lang, 3)} untuk ${name(METHOD_NAMES, forwardRival.method, ['a simpler method', 'metode yang lebih sederhana'])}` : ''} (efisiensi Kling-Gupta, 1 berarti sempurna).`,
                        )}
                      </li>
                    ) : null}
                    {v.counts.not_run ? (
                      <li>
                        <b>{tr(`${v.counts.not_run} planned checks were not run.`, `${v.counts.not_run} pengujian yang direncanakan tidak dijalankan.`)}</b>{' '}
                        {v.peatNotRun
                          ? tr('Their inputs were not ready. The peat checks are among them, so nothing here is specific to peat.',
                            'Masukannya belum siap. Uji gambut termasuk di dalamnya, sehingga tidak ada hasil di sini yang khusus untuk gambut.')
                          : tr('Their inputs were not ready.', 'Masukannya belum siap.')}
                      </li>
                    ) : null}
                  </ul>
                </Reveal>
                <Reveal>
                  <h3 className="ka-home-fail-title ka-home-pass-title">{tr('What passed', 'Yang lolos')}</h3>
                  <ul className="ka-home-fails ka-home-passes">
                    {v.seam2012 && v.seam2012.passed === true ? (
                      <li>
                        <b>{tr('The 2012 seam.', 'Sambungan 2012.')}</b>{' '}
                        {tr(`Switching from MODIS to converted VIIRS in 2012 leaves no step beyond chance (${seamText(v.seam2012, lang, tr)}).`,
                          `Beralih dari MODIS ke VIIRS yang dikonversi pada 2012 tidak meninggalkan lonjakan di luar kebetulan (${seamText(v.seam2012, lang, tr)}).`)}
                        {data?.calibration ? ' ' + tr(`The conversion was fitted on ${data.calibration[0]}–${data.calibration[1]}, so this is not an independent test.`,
                          `Konversi disesuaikan pada ${data.calibration[0]}–${data.calibration[1]}, jadi ini bukan uji yang independen.`) : ''}
                      </li>
                    ) : null}
                    {v.ours?.loyo != null && v.raw?.loyo != null ? (
                      <li>
                        <b>{tr('Years left out of the fit.', 'Tahun yang tidak dipakai dalam penyesuaian.')}</b>{' '}
                        {tr(`Median error ${errPct(v.ours.loyo, lang)}, against ${errPct(v.raw.loyo, lang)} for the raw splice (the table above).`,
                          `Median galat ${errPct(v.ours.loyo, lang)}, dibanding ${errPct(v.raw.loyo, lang)} untuk sambungan mentah (tabel di atas).`)}
                      </li>
                    ) : null}
                  </ul>
                  <p className="ka-home-validation-foot">
                    {tr(
                      `The validation file has ${v.total} rows: ${v.counts.pass} pass, ${v.counts.fail} fail, ${v.counts.not_run} not run, ${v.counts.na} not applicable and ${v.counts.info} descriptive rows with no pass rule. The count is not a score: several rows test the raw splice or other methods.`,
                      `Berkas validasi berisi ${v.total} baris: ${v.counts.pass} lolos, ${v.counts.fail} gagal, ${v.counts.not_run} tidak dijalankan, ${v.counts.na} tidak berlaku, dan ${v.counts.info} baris deskriptif tanpa aturan lolos. Jumlah ini bukan skor: beberapa baris menguji sambungan mentah atau metode lain.`,
                    )}{' '}
                    <a className="ka-home-text-link" href={LANDING_ROUTES.method}>{tr('Every check, on the method page', 'Semua pengujian, di halaman metode')} <span aria-hidden="true">↗</span></a>
                  </p>
                </Reveal>
              </>
            ) : (
              <p className="ka-home-facts-state" role="status">
                {dataState === 'loading' ? tr('Loading the validation file…', 'Memuat berkas validasi…')
                  : tr('The validation file could not be loaded here, so no results are shown.', 'Berkas validasi tidak dapat dimuat di sini, sehingga tidak ada hasil yang ditampilkan.')}
              </p>
            )}
          </div>
        </section>

        {/* 4. See it move */}
        <section className="ka-home-section ka-home-observe" id="move" tabIndex={-1} aria-labelledby="ka-home-move-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">04 · {tr('See it move', 'Lihat bergerak')}</p>
              <h2 id="ka-home-move-title">{tr('One season, one real day at a time.', 'Satu musim, satu hari nyata setiap kali.')}</h2>
            </Reveal>
            <div className="ka-home-move-grid">
              <Reveal className="ka-home-move-card">
                <h3>{tr('The story', 'Cerita')}</h3>
                <p>{tr('A short guided sequence, from the national record down to single days in Central Kalimantan.',
                  'Rangkaian singkat berpemandu, dari catatan nasional sampai hari demi hari di Kalimantan Tengah.')}</p>
                <a className="ka-home-button ka-home-button--light" href={LANDING_ROUTES.story}>{tr('Follow the story', 'Ikuti ceritanya')} <span aria-hidden="true">↗</span></a>
              </Reveal>
              <Reveal className="ka-home-move-card">
                <h3>{tr('Play the season', 'Putar musim')}</h3>
                <p>{tr('Central Kalimantan, August to October 2015. Each frame is one day: that day’s NASA photo, its hotspots and the land with no cloud-free look. Nothing is drawn between days.',
                  'Kalimantan Tengah, Agustus sampai Oktober 2015. Setiap bingkai adalah satu hari: foto NASA hari itu, titik panasnya, dan daratan tanpa pandangan bebas awan. Tidak ada yang digambar di antara hari.')}</p>
                <a className="ka-home-button ka-home-button--primary" href={LANDING_ROUTES.season}>{tr('Play the 2015 season', 'Putar musim 2015')} <span aria-hidden="true">▶</span></a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 5. Limits, credits and AI use */}
        <section className="ka-home-section ka-home-limits" id="limits" tabIndex={-1} aria-labelledby="ka-home-limits-title">
          <div className="ka-home-section-inner">
            <Reveal className="ka-home-section-heading">
              <p className="ka-home-kicker">05 · {tr('Limits, credits and AI use', 'Batasan, kredit, dan penggunaan AI')}</p>
              <h2 id="ka-home-limits-title">{tr('What this is not.', 'Yang tidak termasuk di sini.')}</h2>
            </Reveal>
            <div className="ka-home-limits-grid">
              <Reveal className="ka-home-limits-col">
                <h3>{tr('Limits', 'Batasan')}</h3>
                <ul>
                  <li>{tr('Detections, not fires: a fire cell-day is not a fire event, burned area or emissions.', 'Deteksi, bukan kebakaran: satu sel-hari api bukan peristiwa kebakaran, luas terbakar, atau emisi.')}</li>
                  <li>{tr('We claim no cause for any change, and nothing here is a forecast.', 'Kami tidak menyatakan penyebab perubahan apa pun, dan tidak ada prakiraan di sini.')}</li>
                  <li>
                    {visYears
                      ? tr(`The cloud layer covers Central Kalimantan, August to October of ${visYears}, from MODIS only. Elsewhere it is not computed.`,
                        `Lapisan awan mencakup Kalimantan Tengah, Agustus sampai Oktober ${visYears}, hanya dari MODIS. Di tempat lain belum dihitung.`)
                      : tr('The cloud layer covers a few seasons of Central Kalimantan, from MODIS only. Elsewhere it is not computed.',
                        'Lapisan awan mencakup beberapa musim di Kalimantan Tengah, hanya dari MODIS. Di tempat lain belum dihitung.')}
                  </li>
                  <li>{tr('District values are approximate: each kabupaten/kota shares its province’s monthly conversion.', 'Nilai kabupaten/kota bersifat perkiraan: setiap kabupaten/kota memakai konversi bulanan provinsinya.')}</li>
                  <li>{tr('Months marked provisional use near-real-time data and may change.', 'Bulan bertanda sementara memakai data hampir waktu nyata dan dapat berubah.')}</li>
                </ul>
              </Reveal>
              <Reveal className="ka-home-limits-col">
                <h3>{tr('Data and credits', 'Data dan kredit')}</h3>
                <p>
                  {tr(
                    'NASA FIRMS active-fire archives (MODIS Collection 6.1, VIIRS 375 m). MODIS MOD14A1 and MYD14A1 FireMask, read through Microsoft Planetary Computer. NASA GIBS imagery. District borders from geoBoundaries. Reported burned area from SiPongi (Kementerian Kehutanan).',
                    'Arsip api aktif NASA FIRMS (MODIS Collection 6.1, VIIRS 375 m). FireMask MODIS MOD14A1 dan MYD14A1, dibaca melalui Microsoft Planetary Computer. Citra NASA GIBS. Batas kabupaten/kota dari geoBoundaries. Luas terbakar yang dilaporkan dari SiPongi (Kementerian Kehutanan).',
                  )}
                </p>
                <p>
                  {tr('The app is built on ', 'Aplikasi ini dibangun di atas ')}
                  <a href={FIRE_HARMONY_URL} target="_blank" rel="noopener">Fire Harmony</a>
                  {tr(' (Apache-2.0). See the ', ' (Apache-2.0). Lihat ')}
                  <a href={NOTICE_URL} target="_blank" rel="noopener">NOTICE</a>.
                </p>
              </Reveal>
              <Reveal className="ka-home-limits-col">
                <h3>{tr('AI use', 'Penggunaan AI')}</h3>
                <p>
                  {tr(
                    'An AI coding assistant wrote most of the new code and ran the pipelines under the team’s direction. No number and no image on this site is AI-generated.',
                    'Asisten pemrograman AI menulis sebagian besar kode baru dan menjalankan pipeline di bawah arahan tim. Tidak ada angka dan tidak ada gambar di situs ini yang dihasilkan AI.',
                  )}{' '}
                  <a href={AI_USE_URL} target="_blank" rel="noopener">{tr('AI use statement', 'Pernyataan penggunaan AI')}</a>.
                </p>
                <a className="ka-home-button ka-home-button--dark" href={LANDING_ROUTES.method}>{tr('Read the full method', 'Baca metode selengkapnya')} <span aria-hidden="true">↗</span></a>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className="ka-home-footer">
        <div className="ka-home-footer-main">
          <a className="ka-home-brand" href={LANDING_ROUTES.home}><span className="ka-home-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{LANDING_BRAND}</span></a>
          <p>{tr('Indonesia’s fire record on one scale, with the days MODIS had no cloud-free look.', 'Catatan api Indonesia pada satu skala, beserta hari ketika MODIS tidak mendapat pandangan bebas awan.')}</p>
        </div>
        <div className="ka-home-footer-meta">
          <nav aria-label={tr('Footer', 'Kaki halaman')}>
            <a href={LANDING_ROUTES.record}>{tr('Calendar', 'Kalender')}</a>
            <a href={LANDING_ROUTES.season}>{tr('Play the season', 'Putar musim')}</a>
            <a href={LANDING_ROUTES.story}>{tr('Story', 'Cerita')}</a>
            <a href={LANDING_ROUTES.brief}>{tr('District brief', 'Ringkasan kabupaten/kota')}</a>
            <a href={LANDING_ROUTES.method}>{tr('Method', 'Metode')}</a>
          </nav>
          <small>{tr('Built for the NASA Space Apps Challenge 2026, Bandung.', 'Dibuat untuk NASA Space Apps Challenge 2026, Bandung.')}</small>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
