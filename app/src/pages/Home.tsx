// KalenderApi (new file): the home page (#/home). The calendar is the hero: one ribbon of every month of Indonesia's
// fire record, with a switch between the record as the two satellites recorded it (MODIS, then VIIRS) and the record
// on one scale (components/home/FireRibbon.tsx). Under it, three facts read from the data files. Below the first
// screen: find your district, Indonesia this month on a globe, fire that comes back on peat, when zero is not zero,
// MODIS and VIIRS by year, and where the app answers each thing the challenge asks for.
// The globe's MapLibre set-up (globe projection over raster tiles, a drift that stops when touched, flyTo on a click)
// was learned from FireLens (Team Aquila, MIT): see NOTICE. The imagery is NASA GIBS Blue Marble.
// Every number is read at run time from public/ss-data and public/ka-data (lib/record.ts, pages/landing-data.ts,
// lib/home.ts). Styles: styles/home.css.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre finds its worker next to its own module; Vite pre-bundles that module elsewhere (see MapView.tsx).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { LangToggle } from '../components/LangToggle';
import { HubPanel } from '../components/HubPanel';
import { FireRibbon } from '../components/home/FireRibbon';
import { fmtNumber, monthName, useLang, useTr, type Lang } from '../lib/lang';
import {
  NATIONAL, SEAM_YEAR, fmtCompact, getJson, loadDistricts, loadIndex, loadMonthly, sensorRatio,
  type AoiEntry, type MonthRow, type RecordIndex,
} from '../lib/record';
import { loadLandingData, type LandingData } from './landing-data';
import {
  GLOBE_CENTER, HOME_HREF, HOME_MENU, NOW_DISTRICT, STILL_BOX, driftStep, furthestAbove, globeZoom, highest, latestFullMonth, linePath,
  markRadius, niceMax, nowAt, peatFacts, provinceMark, provincePositions, recordAt, sensorYears, stillXY, timesDigits,
  type PeatFacts, type ProvinceMark, type SensorYear,
} from '../lib/home';
import '../styles/home.css';

maplibregl.setWorkerUrl(workerUrl);

// NASA GIBS, Blue Marble with shaded relief and bathymetry: web-mercator tiles for the globe, one still picture of
// Indonesia (plain latitude and longitude) for screens that cannot draw the globe.
const GIBS_LAYER = 'BlueMarble_ShadedRelief_Bathymetry';
const GIBS_TILES = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`;
const GIBS_STILL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0'
  + `&LAYERS=${GIBS_LAYER}&STYLES=&CRS=EPSG:4326&BBOX=${STILL_BOX[1]},${STILL_BOX[0]},${STILL_BOX[3]},${STILL_BOX[2]}&WIDTH=1200&HEIGHT=500&FORMAT=image/jpeg`;
const PEAT_URL = `${import.meta.env.BASE_URL}ka-data/peat_persistence_kalteng.json`;

const signed = (value: number, lang: Lang) => (value >= 0 ? '+' : '−') + fmtNumber(Math.abs(value), lang);
const errPct = (value: number, lang: Lang) => `${fmtNumber(value, lang, value >= 100 ? 0 : 1)}%`;   // as the home panel prints it
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const markName = (m: ProvinceMark, lang: Lang) => (lang === 'id' ? m.nameId : m.nameEn);
const NO_MARKS: ProvinceMark[] = [];

// ------------------------------------------------------------------------------------------------ data

interface HomeData {
  idx: RecordIndex | null;
  districts: AoiEntry[];
  national: MonthRow[];
  marks: ProvinceMark[] | null;      // null: the province files are still loading
  land: LandingData | null;
  peat: PeatFacts | null;
  failed: string | null;
}
const START: HomeData = { idx: null, districts: [], national: [], marks: null, land: null, peat: null, failed: null };

function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>(START);
  useEffect(() => {
    let live = true;
    const put = (patch: Partial<HomeData>) => { if (live) setData((d) => ({ ...d, ...patch })); };
    // the parts that need these files are left out when a file is missing
    void loadLandingData().then((land) => put({ land })).catch(() => undefined);
    void getJson<unknown>(PEAT_URL).then((file) => put({ peat: peatFacts(file) })).catch(() => undefined);
    void (async () => {
      const idx = await loadIndex();
      const dist = await loadDistricts().catch(() => null);
      const nat = idx.aois.find((a) => a.aoi_id === NATIONAL) ?? idx.aois.find((a) => a.level === 'national');
      const national = nat ? await loadMonthly(nat) : [];
      const districts = dist?.districts ?? [];
      put({ idx, districts, national });
      const at = latestFullMonth(national);
      const provinces = idx.aois.filter((a) => a.level === 'province');
      const files = await Promise.allSettled(provinces.map((p) => loadMonthly(p)));
      const pos = provincePositions(districts);
      const marks: ProvinceMark[] = [];
      if (at) {
        files.forEach((f, i) => {
          if (f.status !== 'fulfilled') return;   // a province whose file is missing has no marker
          const m = provinceMark(provinces[i]!, f.value, pos.get(provinces[i]!.aoi_id), at);
          if (m) marks.push(m);
        });
      }
      put({ marks });
    })().catch((e: unknown) => put({ failed: e instanceof Error ? e.message : String(e), marks: [] }));
    return () => { live = false; };
  }, []);
  return data;
}

// ------------------------------------------------------------------------------------------------ the page

/** `embedded`: under the Story's final frame (pages/Story.tsx), which is the app's first screen. The page then has the
 *  Story's own h1 and title, so this one's heading is an h2 and its menu scrolls back to the top. */
export function Home({ embedded = false }: { embedded?: boolean } = {}) {
  const tr = useTr();
  const lang = useLang();
  const data = useHomeData();
  const { idx, districts, national, marks, land, peat } = data;

  useEffect(() => { if (!embedded) document.title = `KalenderApi · ${tr('One fire calendar from MODIS and VIIRS', 'Satu kalender api dari MODIS dan VIIRS')}`; }, [tr, embedded]);
  const Title = embedded ? 'h2' : 'h1';
  const toTop = embedded
    ? (e: { preventDefault: () => void }) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); }
    : undefined;

  const years = useMemo(() => sensorYears(national), [national]);
  const provinces = useMemo(() => idx?.aois.filter((a) => a.level === 'province').length ?? null, [idx]);
  const natAoi = idx?.aois.find((a) => a.aoi_id === NATIONAL) ?? null;
  const firstYear = natAoi?.first ? Number(natAoi.first.slice(0, 4)) : null;
  const lastYear = natAoi?.last ? Number(natAoi.last.slice(0, 4)) : null;
  const at = marks && marks[0] ? { year: marks[0].year, month: marks[0].month } : null;
  const monthLong = at ? `${monthName(at.month, lang, 'long')} ${at.year}` : null;
  const provisional = !!marks?.some((m) => m.provisional);
  const above = useMemo(() => (marks ? furthestAbove(marks, 5) : []), [marks]);
  const ratio = useMemo(() => (idx?.calibration_window ? sensorRatio(national, idx.calibration_window) : null), [idx, national]);
  // the district the first button opens, by its name in the district list
  const nowName = districts.find((d) => d.aoi_id === NOW_DISTRICT)?.name ?? 'Pulang Pisau';
  const toFind = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    document.getElementById('ka-home-find')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    document.querySelector<HTMLInputElement>('#ka-home-find input[type="search"]')?.focus({ preventScroll: true });
  };

  return (
    <div className={'ka-home' + (embedded ? ' is-embedded' : '')}>
      {embedded ? null : (
        <a className="ka-home-skip" href="#ka-home-main" onClick={(e) => { e.preventDefault(); document.getElementById('ka-home-main')?.focus(); }}>
          {tr('Skip to content', 'Lewati ke konten')}
        </a>
      )}
      <header className="ka-home-top">
        <a className="ka-home-brand" href={HOME_HREF} aria-label="KalenderApi" onClick={toTop}>
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path className="ka-home-mark-hex" d="M16 1.5 28.6 8.75v14.5L16 30.5 3.4 23.25V8.75z" />
            <path className="ka-home-mark-flame" d="M16 7c1.5 3.5 5.5 5.8 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.5-5.2.1 1.7.9 2.9 2.1 3.4C14.6 12.8 15 9.8 16 7z" />
          </svg>
          <span>KalenderApi</span>
        </a>
        <nav className="ka-home-nav" aria-label={tr('Main', 'Utama')}>
          <ul>
            {HOME_MENU.map((p) => (
              <li key={p.key}><a href={p.href} aria-current={p.key === 'home' ? 'page' : undefined} onClick={p.key === 'home' ? toTop : undefined}>{tr(p.en, p.id)}</a></li>
            ))}
          </ul>
        </nav>
        <div className="ka-home-tools"><LangToggle /></div>
      </header>

      <main id="ka-home-main" className="ka-home-main" tabIndex={-1}>
        {/* ------------------------------------------------------------ first screen: the calendar */}
        <section className="ka-home-hero" aria-labelledby="ka-home-h1">
          <div className="ka-home-intro">
            <Title id="ka-home-h1" className="ka-home-h1">
              {tr('One fire calendar for Indonesia, across two satellites.', 'Satu kalender api untuk Indonesia, dari dua satelit.')}
            </Title>
            <div className="ka-home-lede">
              <p>
                {tr(
                  `A hotspot is a place where a satellite senses the heat of a fire. NASA’s MODIS has recorded them since ${firstYear ?? 2000}; the sharper VIIRS joined in ${SEAM_YEAR} and counts several times as many, so the two records cannot simply be joined.`,
                  `Titik panas adalah tempat satelit mendeteksi panas api. MODIS milik NASA merekamnya sejak ${firstYear ?? 2000}; VIIRS yang lebih tajam bergabung pada ${SEAM_YEAR} dan mencatat beberapa kali lebih banyak, sehingga kedua rekaman tidak bisa begitu saja disambung.`,
                )}
              </p>
              <p>
                {provinces && districts.length
                  ? tr(`KalenderApi puts MODIS and VIIRS on one scale, as one calendar for ${fmtNumber(provinces, lang)} provinces and ${fmtNumber(districts.length, lang)} districts, and marks the days when cloud hid the ground.`,
                    `KalenderApi menaruh MODIS dan VIIRS pada satu skala, sebagai satu kalender untuk ${fmtNumber(provinces, lang)} provinsi dan ${fmtNumber(districts.length, lang)} kabupaten/kota, serta menandai hari ketika awan menutupi permukaan.`)
                  : tr('KalenderApi puts MODIS and VIIRS on one scale, as one calendar for every province and district, and marks the days when cloud hid the ground.',
                    'KalenderApi menaruh MODIS dan VIIRS pada satu skala, sebagai satu kalender untuk setiap provinsi dan kabupaten/kota, serta menandai hari ketika awan menutupi permukaan.')}
                {' '}{tr('It is made for a district fire officer in Central Kalimantan’s peat districts.',
                  'Dibuat untuk petugas kebakaran di kabupaten gambut Kalimantan Tengah.')}
              </p>
            </div>
            <p className="ka-home-acts">
              <a className="ka-home-btn" href={nowAt(NOW_DISTRICT)}>{tr(`Today in ${nowName}`, `Hari ini di ${nowName}`)}</a>
              {embedded ? null : <a className="ka-home-btn is-quiet" href="#/story">{tr('Watch the story', 'Tonton cerita')}</a>}
              <a className="ka-home-btn is-quiet" href="#ka-home-find" onClick={toFind}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')}</a>
            </p>
          </div>

          <FireRibbon rows={national} monthHref={(key) => `#/record?aoi=${NATIONAL}&m=${key}&sec=month`} />

          <HeroFacts land={land} />
        </section>

        {/* ------------------------------------------------------------ MODIS and VIIRS, yearly */}
        <section className="ka-home-sec" aria-labelledby="ka-home-yearly">
          <p className="ka-home-eyebrow">MODIS · VIIRS</p>
          <h2 id="ka-home-yearly">{tr('MODIS and VIIRS, yearly', 'MODIS dan VIIRS, per tahun')}</h2>
          <div className="ka-home-split is-chart">
            <SensorTrend years={years} />
            <div>
              {ratio ? (
                <p>
                  {tr(`Over the same months of ${ratio.from} to ${ratio.to}, VIIRS recorded `, `Pada bulan-bulan yang sama dari ${ratio.from} sampai ${ratio.to}, VIIRS mencatat `)}
                  <b className="ka-home-em">{fmtNumber(ratio.ratio, lang, 1)} {tr('times', 'kali')}</b>
                  {tr(` as many fire cell-days as MODIS in Indonesia (${fmtNumber(ratio.months, lang)} months; Suomi NPP against Aqua).`,
                    ` lebih banyak sel-hari api daripada MODIS di Indonesia (${fmtNumber(ratio.months, lang)} bulan; Suomi NPP terhadap Aqua).`)}
                </p>
              ) : null}
              <p className="ka-home-note">
                {tr('A fire cell-day is one 1 km cell with a hotspot on one day. The one scale is that of MODIS Aqua. These are counts of detections, not burned area.',
                  'Satu sel-hari api adalah satu sel 1 km dengan titik panas pada satu hari. Satu skala yang dipakai adalah skala MODIS Aqua. Ini hitungan deteksi, bukan luas terbakar.')}
              </p>
              <p className="ka-home-links">
                <a className="ka-home-btn is-quiet" href={recordAt('IDN', 'jump')}>{tr('Before and after', 'Sebelum dan sesudah')}</a>
                <a className="ka-home-btn is-quiet" href="#/method">{tr('How it is made and tested', 'Cara dibuat dan diuji')}</a>
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ the challenge */}
        <section className="ka-home-sec" aria-labelledby="ka-home-answers">
          <p className="ka-home-eyebrow">{tr('The challenge', 'Tantangan')}</p>
          <h2 id="ka-home-answers">{tr('How this answers the challenge', 'Cara aplikasi ini menjawab tantangan')}</h2>
          <p className="ka-home-note">
            {tr('“Harmonization of MODIS and VIIRS Hot Spots”: each thing the challenge asks for, and where it is in this app.',
              '“Harmonization of MODIS and VIIRS Hot Spots”: setiap hal yang diminta tantangan, dan letaknya di aplikasi ini.')}
          </p>
          <Answers firstYear={firstYear} lastYear={lastYear} provinces={provinces} districts={districts.length} toFind={toFind} />
        </section>

        {/* ------------------------------------------------------------ Indonesia this month */}
        <section className="ka-home-sec" aria-labelledby="ka-home-month">
          <p className="ka-home-eyebrow">{monthLong ?? tr('Latest full month', 'Bulan penuh terakhir')}</p>
          <h2 id="ka-home-month">{tr('Indonesia this month', 'Indonesia bulan ini')}</h2>
          <div className="ka-home-split is-map">
            <Globe marks={marks} monthLong={monthLong} provisional={provisional} failed={data.failed} />
            <div className="ka-home-above">
              <p className="ka-home-sub">{tr('Furthest above their own median', 'Paling jauh di atas mediannya sendiri')}</p>
              {marks === null ? <p className="ka-home-note" role="status">{tr('Loading the province records…', 'Memuat rekaman provinsi…')}</p> : null}
              {marks && !above.length ? (
                <p className="ka-home-note">{tr('No province is above its median for this month.', 'Tidak ada provinsi yang berada di atas mediannya untuk bulan ini.')}</p>
              ) : null}
              {above.length && at ? (
                <>
                  <ol className="ka-home-rank">
                    {above.map((m) => (
                      <li key={m.id}>
                        <a href={recordAt(m.id, 'month')}>
                          <span className="ka-home-rank-x">{fmtNumber(m.ratio!, lang, timesDigits(m.ratio!))}×</span>
                          <span className="ka-home-rank-name">{markName(m, lang)}</span>
                          <span className="ka-home-rank-sub">
                            {fmtNumber(m.H, lang)} {tr('fire cell-days', 'sel-hari api')}
                            {m.median != null ? `, ${tr('median', 'median')} ${fmtNumber(m.median, lang)}` : ''}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="ka-home-note">
                    {tr(`Times the median ${monthName(at.month, lang, 'long')} of each province, ${monthLong}.`,
                      `Kelipatan median ${monthName(at.month, lang, 'long')} tiap provinsi, ${monthLong}.`)}
                    {provisional ? ` ${tr('This month is provisional: it comes from near-real-time data and can still change.', 'Bulan ini masih sementara: berasal dari data hampir-waktu-nyata dan masih bisa berubah.')}` : ''}
                    {' '}{tr('Where the median is small, a few detections make a large ratio.', 'Bila mediannya kecil, beberapa deteksi saja sudah menghasilkan rasio besar.')}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ today in your district */}
        <section className="ka-home-sec" id="ka-home-find" aria-labelledby="ka-home-find-h">
          <p className="ka-home-eyebrow">{tr('In practice', 'Dalam praktik')}</p>
          <h2 id="ka-home-find-h">{tr('Today in your district', 'Hari ini di kabupaten/kota Anda')}</h2>
          <div className="ka-home-split">
            {/* the home panel's own "Find your area" card (search, latitude and longitude, quick regions); its other
                cards are hidden here by home.css */}
            <div className="ka-home-findcard"><HubPanel /></div>
            <div className="ka-home-officer">
              <p className="ka-home-sub">{tr('What a district fire officer gets', 'Yang didapat petugas kebakaran kabupaten/kota')}</p>
              <ol className="ka-home-steps">
                <li>{tr('The district’s fire calendar: which months burn, year after year, on one scale.', 'Kalender api kabupaten/kota: bulan mana yang terbakar, dari tahun ke tahun, pada satu skala.')}</li>
                <li>{tr('This month against the median of the same month.', 'Bulan ini dibanding median bulan yang sama.')}</li>
                <li>{tr('The reporting rule: for a day when most of the district was under cloud, report “not observed”, not “no hotspots”, and ask for a ground check.',
                  'Aturan pelaporan: untuk hari ketika sebagian besar wilayah berada di bawah awan, laporkan “tidak teramati”, bukan “nihil titik panas”, lalu minta pengecekan lapangan.')}</li>
              </ol>
              <p className="ka-home-links">
                <a className="ka-home-btn" href={nowAt(NOW_DISTRICT)}>{tr(`Today in ${nowName}`, `Hari ini di ${nowName}`)}</a>
                <a className="ka-home-btn is-quiet" href="#/brief?aoi=prov-kalimantan-tengah">{tr('A printable brief', 'Ringkasan siap cetak')}</a>
                <a className="ka-home-btn is-quiet" href="#/method">{tr('The reporting rule', 'Aturan pelaporan')}</a>
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ on peat, fire comes back */}
        {peat ? (
          <section className="ka-home-sec" aria-labelledby="ka-home-peat">
            <p className="ka-home-eyebrow">{tr('Central Kalimantan · peat', 'Kalimantan Tengah · gambut')}</p>
            <h2 id="ka-home-peat">{tr('On peat, fire comes back', 'Di lahan gambut, api datang kembali')}</h2>
            <dl className="ka-home-nums">
              <div><dt>{fmtNumber(peat.sites, lang)}</dt><dd>{tr(`persistent peat sites over ${fmtNumber(peat.seasons, lang)} August-to-October seasons (a 1 km cell, counted once per season)`, `lokasi gambut persisten selama ${fmtNumber(peat.seasons, lang)} musim Agustus–Oktober (satu sel 1 km, dihitung sekali per musim)`)}</dd></div>
              <div><dt>{fmtNumber(peat.comeBacks, lang)}</dt><dd>{tr('come-backs: fire detected again after two or more days with no detection', 'kemunculan kembali: api terdeteksi lagi setelah dua hari atau lebih tanpa deteksi')}</dd></div>
              <div><dt>{fmtNumber(peat.seenQuiet, lang)}</dt><dd>{tr('of them followed days with a cloud-free look and nothing detected', 'di antaranya terjadi setelah hari dengan pandangan bebas awan dan tanpa deteksi')}</dd></div>
            </dl>
            <p>
              {tr('On peat, a fire that the satellites stop detecting is often detected again in the same place days later. These sites are candidates for a ground re-check after the hotspots vanish. They are not confirmed fire, and this index is exploratory.',
                'Di lahan gambut, api yang tidak lagi terdeteksi satelit sering terdeteksi kembali di tempat yang sama beberapa hari kemudian. Lokasi ini adalah kandidat untuk pengecekan ulang di lapangan setelah titik panas menghilang. Ini bukan kebakaran yang terkonfirmasi, dan indeks ini bersifat eksploratif.')}
            </p>
            <p className="ka-home-links"><a className="ka-home-btn is-quiet" href={nowAt(NOW_DISTRICT)}>{tr(`See the sites in ${nowName}`, `Lihat lokasinya di ${nowName}`)}</a></p>
          </section>
        ) : null}

        {/* ------------------------------------------------------------ when zero is not zero */}
        <section className="ka-home-sec" aria-labelledby="ka-home-zero">
          <p className="ka-home-eyebrow">{tr('Cloud', 'Awan')}</p>
          <h2 id="ka-home-zero">{tr('When zero is not zero', 'Ketika nol belum tentu nol')}</h2>
          <p>
            {tr('A satellite cannot see the ground through cloud. On such a day the count is zero, but the zero only says that nothing was seen. KalenderApi marks those days as under cloud: the satellite could not see. It does not say whether anything burned.',
              'Satelit tidak dapat melihat permukaan menembus awan. Pada hari seperti itu hitungannya nol, tetapi nol itu hanya berarti tidak ada yang terlihat. KalenderApi menandai hari tersebut sebagai di bawah awan: satelit tidak dapat melihat. Tanda itu tidak menyatakan ada atau tidaknya kebakaran.')}
          </p>
          <p className="ka-home-links">
            <a className="ka-home-btn is-quiet" href="#/season?y=2015">{tr('Play the season', 'Putar musim')}</a>
            <a className="ka-home-btn is-quiet" href="#/zero">{tr('Open the zero inspector', 'Buka pemeriksa nol')}</a>
          </p>
        </section>
      </main>

      <footer className="ka-home-foot">
        <p>
          {tr('Fire hotspots: NASA FIRMS (MODIS Collection 6.1 and VIIRS 375 m), counted and put on one scale by us. Globe imagery: NASA Blue Marble, from NASA GIBS. District outlines: geoBoundaries (CC BY 3.0 IGO).',
            'Titik panas: NASA FIRMS (MODIS Collection 6.1 dan VIIRS 375 m), kami hitung dan kami taruh pada satu skala. Citra bola dunia: NASA Blue Marble, dari NASA GIBS. Batas kabupaten/kota: geoBoundaries (CC BY 3.0 IGO).')}
          {idx?.generated_at ? ` ${tr('Data as of', 'Data per')} ${idx.generated_at.slice(0, 10)}.` : ''}
          {' '}{tr('The record is not live.', 'Rekaman ini bukan data langsung.')}
        </p>
        <p>{tr('Made for the NASA Space Apps Challenge 2026.', 'Dibuat untuk NASA Space Apps Challenge 2026.')} <a href="#/method">{tr('Method, data and credits', 'Metode, data, dan kredit')}</a></p>
      </footer>
    </div>
  );
}

export default Home;

// ------------------------------------------------------------------------------------------------ three facts

/** One quiet row under the calendar: three sentences, each read from the files the method page reads. */
function HeroFacts({ land }: { land: LandingData | null }) {
  const tr = useTr();
  const lang = useLang();
  if (!land) return <div className="ka-home-facts is-wait" aria-hidden="true" />;
  const latest = land.latest, change = land.change;
  const raw = land.validation.raw?.loyo ?? null, ours = land.validation.ours?.loyo ?? null;
  const month = latest ? monthName(latest.month, lang, 'long') : '';
  return (
    <ul className="ka-home-facts">
      {latest ? (
        <li>
          <span className="ka-home-fact-k">{tr('Latest month', 'Bulan terakhir')}</span>
          <p>
            {month} {latest.year}: <b>{fmtNumber(latest.H, lang)}</b> {tr('fire cell-days in Indonesia', 'sel-hari api di Indonesia')}
            {latest.ratio != null ? <>, <b>{fmtNumber(latest.ratio, lang, 1)} {tr('times', 'kali')}</b> {tr(`the median ${month}`, `median ${month}`)}{latest.baseline ? ` (${latest.baseline[0]}–${latest.baseline[1]})` : ''}</> : null}
            {latest.provisional ? tr('; provisional.', '; sementara.') : '.'}
          </p>
        </li>
      ) : null}
      {change ? (
        <li>
          <span className="ka-home-fact-k">{tr('Why one scale', 'Mengapa satu skala')}</span>
          <p>
            {tr(`From ${change.early[0]}–${change.early[1]} to ${change.recent[0]}–${change.recent[1]}, the two records joined as recorded show `,
              `Dari ${change.early[0]}–${change.early[1]} ke ${change.recent[0]}–${change.recent[1]}, dua rekaman yang disambung apa adanya menunjukkan `)}
            <b>{signed(change.raw, lang)}%</b>{tr('; on one scale the change is ', '; pada satu skala perubahannya ')}<b className="is-one">{signed(change.harm, lang)}%</b>.
          </p>
        </li>
      ) : null}
      {raw != null && ours != null ? (
        <li>
          <span className="ka-home-fact-k">{tr('Tested', 'Diuji')}</span>
          <p>
            {tr('On years left out of the fit, the yearly total is off by ', 'Pada tahun yang tidak dipakai dalam penyesuaian, total tahunan meleset ')}
            <b>{errPct(raw, lang)}</b>{tr(' joined as recorded and by ', ' bila disambung apa adanya dan ')}<b className="is-one">{errPct(ours, lang)}</b>
            {tr(' on one scale (median error).', ' pada satu skala (galat median).')}
            {' '}<a href="#/method">{tr('Method and checks', 'Metode dan uji')}</a>
          </p>
        </li>
      ) : null}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------------ the globe

function canDrawGlobe(): boolean {
  if (typeof window === 'undefined') return false;
  // a phone: a globe that takes every swipe would trap the page's scroll, and it is heavy there
  if (window.matchMedia('(max-width: 640px)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch { return false; }
}

function globeStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      earth: { type: 'raster', tileSize: 256, maxzoom: 8, attribution: 'Imagery: NASA Blue Marble (NASA GIBS)', tiles: [GIBS_TILES] },
    },
    layers: [
      // transparent ground: the page's own background shows around the globe
      { id: 'bg', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } },
      { id: 'earth', type: 'raster', source: 'earth', paint: { 'raster-saturation': -0.2, 'raster-brightness-max': 0.9 } },
    ],
  };
}

function Globe({ marks, monthLong, provisional, failed }: { marks: ProvinceMark[] | null; monthLong: string | null; provisional: boolean; failed: string | null }) {
  const tr = useTr();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const touched = useRef(false);            // the reader has taken the globe: the drift never starts again
  const seen = useRef(false);               // the globe is on screen (it drifts only then)
  const [mode, setMode] = useState<'globe' | 'still'>(() => (canDrawGlobe() ? 'globe' : 'still'));
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const list = marks ?? NO_MARKS;
  const maxH = useMemo(() => Math.max(0, ...list.map((m) => m.H)), [list]);
  // the five highest counts carry a number on the globe and are named under it
  const top = useMemo(() => highest(list, 5), [list]);
  const rank = useMemo(() => new Map(top.map((m, i) => [m.id, i + 1])), [top]);
  const shown = list.find((m) => m.id === (hover ?? picked)) ?? null;

  // the map
  useEffect(() => {
    const el = box.current;
    if (mode !== 'globe' || !el) return undefined;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el, style: globeStyle(), center: [GLOBE_CENTER[0], GLOBE_CENTER[1]], zoom: globeZoom(el.clientWidth),
        minZoom: 0.4, maxZoom: 7, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, maxPitch: 0,
        cooperativeGestures: true,   // the wheel scrolls the page; Ctrl or Cmd + wheel zooms the globe
      });
    } catch {
      setMode('still');
      return undefined;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      el.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach((n) => n.classList.remove('maplibregl-compact-show'));
      setReady(true);
    });
    const stop = () => { touched.current = true; };
    map.on('dragstart', stop); map.on('touchstart', stop); map.on('wheel', stop); map.on('zoomstart', (e) => { if (e.originalEvent) stop(); });
    // a lost drawing context: the still picture takes over. (Removing the map loses its context on purpose: not then.)
    let live = true;
    map.getCanvas().addEventListener('webglcontextlost', () => { if (live) setMode('still'); }, { once: true });

    // a slow drift across Indonesia while the globe is on screen, until the reader touches it; none under reduced motion
    const watch = new IntersectionObserver((entries) => { seen.current = entries.some((e) => e.isIntersecting); });
    watch.observe(el);
    let raf = 0, last = performance.now(), dir: 1 | -1 = 1;
    const drift = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      if (seen.current && !touched.current && !reducedMotion() && !document.hidden && !map.isMoving()) {
        const c = map.getCenter();
        const next = driftStep(c.lng, dir, dt);
        dir = next.dir;
        map.jumpTo({ center: [next.lng, c.lat] });
      }
      raf = requestAnimationFrame(drift);
    };
    raf = requestAnimationFrame(drift);

    const fit = new ResizeObserver(() => {
      map.resize();
      if (!touched.current) map.jumpTo({ zoom: globeZoom(el.clientWidth) });
    });
    fit.observe(el);
    return () => { live = false; cancelAnimationFrame(raf); fit.disconnect(); watch.disconnect(); mapRef.current = null; setReady(false); map.remove(); };
  }, [mode]);

  // a click on a marker or on a name under the globe: fly to the province and offer its calendar
  const pick = (m: ProvinceMark) => {
    touched.current = true;
    setPicked(m.id);
    const map = mapRef.current;
    if (map) map.flyTo({ center: [m.lon, m.lat], zoom: Math.max(map.getZoom(), 4.4), duration: reducedMotion() ? 0 : 1400, essential: true });
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  // one marker per province (buttons, so they take the keyboard and the design tokens)
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== 'globe' || !ready || !map || !list.length) return undefined;
    const made = list.map((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      const no = rank.get(m.id);
      b.className = `ka-home-mk is-${m.tone}${no ? ' is-named' : ''}`;
      b.style.setProperty('--r', `${markRadius(m.H, maxH)}px`);
      b.setAttribute('aria-label', markText(m, lang, tr));
      const dot = document.createElement('i');
      b.append(dot);
      if (no) { const s = document.createElement('span'); s.textContent = String(no); b.append(s); }
      b.addEventListener('mouseenter', () => setHover(m.id));
      b.addEventListener('mouseleave', () => setHover(null));
      b.addEventListener('focus', () => setHover(m.id));
      b.addEventListener('blur', () => setHover(null));
      b.addEventListener('click', (e) => { e.stopPropagation(); pickRef.current(m); });
      return new maplibregl.Marker({ element: b, anchor: 'center', opacityWhenCovered: '0' }).setLngLat([m.lon, m.lat]).addTo(map);
    });
    return () => { made.forEach((k) => k.remove()); };
  }, [mode, ready, list, rank, maxH, lang, tr]);

  const home = () => {
    setPicked(null);
    const map = mapRef.current, el = box.current;
    if (map && el) map.flyTo({ center: [GLOBE_CENTER[0], GLOBE_CENTER[1]], zoom: globeZoom(el.clientWidth), duration: reducedMotion() ? 0 : 1200, essential: true });
  };

  const hint = marks === null ? tr('Loading the province records…', 'Memuat rekaman provinsi…')
    : failed ? tr(`The province records could not be loaded (${failed}).`, `Rekaman provinsi tidak dapat dimuat (${failed}).`)
    : mode === 'globe' ? tr('Drag to turn · Ctrl + scroll to zoom · click a province', 'Seret untuk memutar · Ctrl + gulir untuk memperbesar · klik provinsi')
    : tr('Tap a province', 'Ketuk provinsi');

  return (
    <div className="ka-home-globe-wrap">
      <div className={`ka-home-globe is-${mode}`}>
        {mode === 'globe' ? (
          <div ref={box} className="ka-home-globe-map" role="application"
            aria-label={tr('Globe of Indonesia with one marker per province', 'Bola dunia Indonesia dengan satu penanda per provinsi')} />
        ) : (
          <div className="ka-home-still">
            <img src={GIBS_STILL} alt={tr('Indonesia from space: NASA Blue Marble', 'Indonesia dari antariksa: NASA Blue Marble')} loading="lazy" decoding="async" />
            {list.map((m) => {
              const p = stillXY(m.lon, m.lat);
              return (
                <button key={m.id} type="button" className={`ka-home-mk is-still is-${m.tone}`} aria-label={markText(m, lang, tr)}
                  style={{ left: `${p.left}%`, top: `${p.top}%`, ['--r' as string]: `${markRadius(m.H, maxH, 3, 9)}px` }}
                  onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} onClick={() => pick(m)}><i /></button>
              );
            })}
          </div>
        )}
        <div className="ka-home-globe-info" aria-live="polite">
          {shown ? (
            <div className="ka-home-globe-card">
              <p className="ka-home-globe-name">{markName(shown, lang)}</p>
              <p><b>{fmtNumber(shown.H, lang)}</b> {tr('fire cell-days', 'sel-hari api')} · {monthLong}</p>
              <p className={`ka-home-globe-x is-${shown.tone}`}>
                {shown.ratio != null
                  ? `${fmtNumber(shown.ratio, lang, timesDigits(shown.ratio))} ${tr(`times the median ${monthName(shown.month, lang, 'long')}`, `kali median ${monthName(shown.month, lang, 'long')}`)}`
                  : tr(`No median above zero for ${monthName(shown.month, lang, 'long')}`, `Tidak ada median di atas nol untuk ${monthName(shown.month, lang, 'long')}`)}
              </p>
              {picked === shown.id ? (
                <p className="ka-home-globe-go">
                  <a href={recordAt(shown.id, 'calendar')}>{tr('Open its fire calendar', 'Buka kalender apinya')} →</a>
                  {mode === 'globe' ? <button type="button" onClick={home}>{tr('Back to Indonesia', 'Kembali ke Indonesia')}</button> : null}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="ka-home-globe-hint">{hint}</span>
          )}
        </div>
      </div>

      {top.length ? (
        <ol className="ka-home-top5" aria-label={tr('The five provinces with the most fire cell-days this month', 'Lima provinsi dengan sel-hari api terbanyak bulan ini')}>
          {top.map((m, i) => (
            <li key={m.id}>
              <button type="button" className={`is-${m.tone}`} aria-pressed={picked === m.id} onClick={() => pick(m)}
                onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(m.id)} onBlur={() => setHover(null)}>
                <b>{i + 1}</b>{markName(m, lang)}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="ka-home-key">
        <span className="ka-home-key-item is-up"><i aria-hidden="true" />{tr('above the median', 'di atas median')}</span>
        <span className="ka-home-key-item is-near"><i aria-hidden="true" />{tr('near normal', 'mendekati normal')}</span>
        <span className="ka-home-key-item is-down"><i aria-hidden="true" />{tr('below the median', 'di bawah median')}</span>
        <span className="ka-home-key-note">
          {monthLong
            ? tr(`Dot size: fire cell-days in ${monthLong}${provisional ? ' (provisional)' : ''}; numbers mark the five highest. Imagery: NASA Blue Marble.`,
              `Ukuran titik: sel-hari api pada ${monthLong}${provisional ? ' (sementara)' : ''}; angka menandai lima tertinggi. Citra: NASA Blue Marble.`)
            : tr('Imagery: NASA Blue Marble.', 'Citra: NASA Blue Marble.')}
        </span>
      </div>

      {mode === 'still' && list.length ? (
        <ul className="ka-home-marklist" aria-label={tr('Provinces by fire cell-days this month', 'Provinsi menurut sel-hari api bulan ini')}>
          {highest(list, 8).map((m) => (
            <li key={m.id}>
              <a href={recordAt(m.id, 'calendar')}>
                <i className={`is-${m.tone}`} aria-hidden="true" />
                <span>{markName(m, lang)}</span>
                <b>{fmtNumber(m.H, lang)}</b>
                <em>{m.ratio != null ? `${fmtNumber(m.ratio, lang, timesDigits(m.ratio))}×` : '–'}</em>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "Riau: 6 fire cell-days in October 2026, 0.1 times the median October." */
function markText(m: ProvinceMark, lang: Lang, tr: (en: string, id: string) => string): string {
  const month = monthName(m.month, lang, 'long');
  const head = `${markName(m, lang)}: ${fmtNumber(m.H, lang)} ${tr('fire cell-days in', 'sel-hari api pada')} ${month} ${m.year}`;
  return m.ratio != null
    ? `${head}, ${fmtNumber(m.ratio, lang, timesDigits(m.ratio))} ${tr(`times the median ${month}`, `kali median ${month}`)}.`
    : `${head}.`;
}

// ------------------------------------------------------------------------------------------------ the three records

const BOX = { width: 520, height: 220, top: 10, right: 10, bottom: 22, left: 44 };

function SensorTrend({ years }: { years: SensorYear[] }) {
  const tr = useTr();
  const lang = useLang();
  const geom = useMemo(() => {
    if (years.length < 2) return null;
    const ys = years.map((p) => p.year);
    const y0 = ys[0]!, y1 = ys[ys.length - 1]!;
    const top = niceMax(Math.max(...years.map((p) => Math.max(p.harm, p.modis ?? 0, p.viirs ?? 0))));
    const w = BOX.width - BOX.left - BOX.right, h = BOX.height - BOX.top - BOX.bottom;
    const x = (year: number) => BOX.left + ((year - y0) / (y1 - y0)) * w;
    const y = (v: number) => BOX.top + (1 - Math.min(1, Math.max(0, v / top))) * h;
    return {
      y0, y1, top, x, y,
      harm: linePath(ys, years.map((p) => p.harm), x, y),
      modis: linePath(ys, years.map((p) => p.modis), x, y),
      viirs: linePath(ys, years.map((p) => p.viirs), x, y),
    };
  }, [years]);
  if (!geom) return null;
  const { y0, y1, top, x, y } = geom;
  const bottom = BOX.height - BOX.bottom;
  const seam = SEAM_YEAR > y0 && SEAM_YEAR < y1 ? SEAM_YEAR : null;
  const lastYear = years[years.length - 1]!;
  const label = tr(
    `Indonesia’s yearly fire cell-days, ${y0} to ${y1}, three lines: on one scale, MODIS as recorded, and VIIRS as recorded. In ${y1}: one scale ${fmtNumber(lastYear.harm, lang)}, MODIS ${lastYear.modis != null ? fmtNumber(lastYear.modis, lang) : '–'}, VIIRS ${lastYear.viirs != null ? fmtNumber(lastYear.viirs, lang) : '–'}.`,
    `Sel-hari api tahunan Indonesia, ${y0} sampai ${y1}, tiga garis: pada satu skala, MODIS apa adanya, dan VIIRS apa adanya. Pada ${y1}: satu skala ${fmtNumber(lastYear.harm, lang)}, MODIS ${lastYear.modis != null ? fmtNumber(lastYear.modis, lang) : '–'}, VIIRS ${lastYear.viirs != null ? fmtNumber(lastYear.viirs, lang) : '–'}.`,
  );
  return (
    <figure className="ka-home-trend">
      <svg className="ka-home-chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="ka-home-grid" x1={BOX.left} x2={BOX.width - BOX.right} y1={y(top * f)} y2={y(top * f)} />
            <text className="ka-home-tick" x={BOX.left - 6} y={y(top * f) + 4} textAnchor="end">{fmtCompact(top * f, lang)}</text>
          </g>
        ))}
        {seam != null ? <line className="ka-home-seam" x1={x(seam)} x2={x(seam)} y1={BOX.top} y2={bottom + 4} /> : null}
        <path className="ka-home-ln is-viirs" d={geom.viirs} />
        <path className="ka-home-ln is-modis" d={geom.modis} />
        <path className="ka-home-ln is-harm" d={geom.harm} />
        <text className="ka-home-tick" x={BOX.left} y={bottom + 16}>{y0}</text>
        {seam != null ? <text className="ka-home-tick is-seam" x={x(seam)} y={bottom + 16} textAnchor="middle">{seam}</text> : null}
        <text className="ka-home-tick" x={BOX.width - BOX.right} y={bottom + 16} textAnchor="end">{y1}</text>
      </svg>
      <figcaption>
        <p className="ka-home-legend">
          <span className="is-harm"><i aria-hidden="true" />{tr('One scale (harmonized)', 'Satu skala (diselaraskan)')}</span>
          <span className="is-modis"><i aria-hidden="true" />{tr('MODIS as recorded', 'MODIS apa adanya')}</span>
          <span className="is-viirs"><i aria-hidden="true" />{tr('VIIRS as recorded', 'VIIRS apa adanya')}</span>
        </p>
        <p className="ka-home-src">
          {tr(`Fire cell-days per year, Indonesia, complete years ${y0} to ${y1}. The one scale is MODIS Aqua’s, so the two lines run together until VIIRS takes over. Source: NASA FIRMS.`,
            `Sel-hari api per tahun, Indonesia, tahun lengkap ${y0} sampai ${y1}. Satu skala yang dipakai adalah skala MODIS Aqua, sehingga kedua garis berimpit sampai VIIRS mengambil alih. Sumber: NASA FIRMS.`)}
        </p>
      </figcaption>
    </figure>
  );
}

// ------------------------------------------------------------------------------------------------ the challenge table

function Answers({ firstYear, lastYear, provinces, districts, toFind }: {
  firstYear: number | null; lastYear: number | null; provinces: number | null; districts: number; toFind: (e: { preventDefault: () => void }) => void;
}) {
  const tr = useTr();
  const lang = useLang();
  const areas = provinces && districts
    ? tr(`${fmtNumber(provinces, lang)} provinces and ${fmtNumber(districts, lang)} districts, by name`, `${fmtNumber(provinces, lang)} provinsi dan ${fmtNumber(districts, lang)} kabupaten/kota, menurut nama`)
    : tr('Provinces and districts, by name', 'Provinsi dan kabupaten/kota, menurut nama');
  const since = firstYear && lastYear ? `${firstYear}–${lastYear}` : '';
  const FIND = '#ka-home-find';
  const rows: { ask: string; how: string; href: string; go: string }[] = [
    { ask: tr('Harmonize MODIS and VIIRS so the sensor of origin no longer matters', 'Menyelaraskan MODIS dan VIIRS sehingga sensor asal tidak lagi berpengaruh'),
      how: tr('One record on the MODIS Aqua scale, shown beside the two records joined as recorded', 'Satu rekaman pada skala MODIS Aqua, ditampilkan di samping dua rekaman yang disambung apa adanya'),
      href: recordAt('IDN', 'jump'), go: tr('Before and after', 'Sebelum dan sesudah') },
    { ask: tr('A burning-activity calendar from the early 2000s to now', 'Kalender aktivitas kebakaran dari awal 2000-an sampai sekarang'),
      how: tr(`Every month ${since}, one cell per month`, `Setiap bulan ${since}, satu kotak per bulan`),
      href: recordAt('IDN', 'calendar'), go: tr('Fire calendar', 'Kalender api') },
    { ask: tr('Pick a region', 'Memilih wilayah'), how: areas, href: FIND, go: tr('Find your area', 'Cari wilayah Anda') },
    { ask: tr('Enter a latitude and longitude', 'Memasukkan lintang dan bujur'),
      how: tr('Finds the district that holds the point', 'Mencari kabupaten/kota yang memuat titik itu'),
      href: FIND, go: tr('Find your area', 'Cari wilayah Anda') },
    { ask: tr('Pick a date range', 'Memilih rentang tanggal'),
      how: tr('Any months of the record; the page and its files follow the range', 'Bulan mana pun dalam rekaman; halaman dan berkasnya mengikuti rentang'),
      href: recordAt('IDN', 'range'), go: tr('Pick a period', 'Pilih periode') },
    { ask: tr('Compare the current month with the historical median', 'Membandingkan bulan berjalan dengan median historis'),
      how: tr('The latest month against the median of the same month, and its rank among the years', 'Bulan terakhir dibanding median bulan yang sama, dan peringkatnya di antara tahun-tahun'),
      href: recordAt('IDN', 'month'), go: tr('This month', 'Bulan ini') },
    { ask: tr('Flag unusual months (anomalies)', 'Menandai bulan yang tidak biasa (anomali)'),
      how: tr('Each province’s month against its own median, on the globe above and in its record', 'Bulan tiap provinsi dibanding mediannya sendiri, pada bola dunia di atas dan di rekamannya'),
      href: recordAt('prov-kalimantan-tengah', 'month'), go: tr('A province’s month', 'Bulan sebuah provinsi') },
    { ask: tr('Download the analytics', 'Mengunduh analitik'),
      how: tr('The monthly record as CSV, and the calendar and the chart as PNG', 'Rekaman bulanan sebagai CSV, serta kalender dan grafik sebagai PNG'),
      href: recordAt('IDN', 'range'), go: tr('Downloads', 'Unduhan') },
    { ask: tr('A CSV of hotspots', 'CSV titik panas'),
      how: tr('VIIRS hotspots of Central Kalimantan’s built seasons; other areas link to the NASA FIRMS archive', 'Titik panas VIIRS untuk musim yang tersedia di Kalimantan Tengah; wilayah lain ditautkan ke arsip NASA FIRMS'),
      href: recordAt('prov-kalimantan-tengah', 'range'), go: tr('Hotspot CSV', 'CSV titik panas') },
    { ask: tr('Accessible colour ramps', 'Rentang warna yang mudah dibaca'),
      how: tr('One ramp whose lightness rises from low to high, with a legend; cloud is drawn as hatching, not as another colour', 'Satu rentang yang makin terang dari rendah ke tinggi, dengan legenda; awan digambar sebagai arsiran, bukan warna lain'),
      href: recordAt('prov-kalimantan-tengah', 'calendar'), go: tr('Calendar legend', 'Legenda kalender') },
    { ask: tr('Detected fire against officially reported fire', 'Api terdeteksi dibanding api yang dilaporkan resmi'),
      how: tr('Our record beside the official burned area (SIPONGI KEMENHUT), in the printable brief', 'Rekaman kami di samping luas terbakar resmi (SIPONGI KEMENHUT), dalam ringkasan siap cetak'),
      href: '#/brief?aoi=prov-kalimantan-tengah', go: tr('District brief', 'Ringkasan kabupaten') },
  ];
  return (
    <div className="ka-home-answers">
      <table>
        <thead>
          <tr><th scope="col">{tr('The challenge asks for', 'Yang diminta tantangan')}</th><th scope="col">{tr('In KalenderApi', 'Di KalenderApi')}</th><th scope="col">{tr('Open', 'Buka')}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ask}>
              <th scope="row">{r.ask}</th>
              <td>{r.how}</td>
              <td><a href={r.href} onClick={r.href === FIND ? toFind : undefined}>{r.go} →</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
