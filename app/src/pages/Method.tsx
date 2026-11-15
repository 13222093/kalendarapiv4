// KalenderApi: "About and method" (#/method). Who the tool is for and the reporting rule, three facts, then how the
// record is made, what was checked (failures included), the cloud-visibility layer, district values, sources, credits,
// AI use and limits. Every number is computed in landing-data.ts from the versioned data files at run time; a number
// the files do not give is left out, never filled in.
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import {
  AI_USE_URL, FIRE_HARMONY_URL, LANDING_ROUTES, METHOD_NAMES, NOTICE_URL, REGION_NAMES, REPO_URL,
  loadBlindRule, loadDistrictCount, loadFrame, loadLandingData,
  type BlindRule, type DistrictCount, type FrameData, type LandingCheck, type LandingData, type MethodError,
} from './landing-data.ts';
import { fmtNumber, locale, monthName, useLang, useTr, type Lang, type Tr } from '../lib/lang.ts';
import '../styles/method.css';

const TOC = [
  { id: 'who', en: 'Who it is for', idn: 'Untuk siapa' },
  { id: 'facts', en: 'Three facts', idn: 'Tiga fakta' },
  { id: 'count', en: 'What we count', idn: 'Yang kami hitung' },
  { id: 'scale', en: 'One scale', idn: 'Satu skala' },
  { id: 'checks', en: 'What we checked', idn: 'Yang kami uji' },
  { id: 'cloud', en: 'Cloud layer', idn: 'Lapisan awan' },
  { id: 'districts', en: 'Districts', idn: 'Kabupaten/kota' },
  { id: 'data', en: 'Data and credits', idn: 'Data dan kredit' },
  { id: 'ai', en: 'AI use', idn: 'Penggunaan AI' },
  { id: 'limits', en: 'Limits', idn: 'Batasan' },
] as const;

/** The page lives under a hash route, so a section link scrolls by hand instead of changing the address. */
function jumpTo(id: string, event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const target = document.getElementById('ka-method-' + id);
  target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  target?.focus({ preventScroll: true });
}

// ------------------------------------------------------------------------------------------------ numbers as text

const signed = (value: number, lang: Lang, digits = 0) => (value >= 0 ? '+' : '−') + fmtNumber(Math.abs(value), lang, digits);
/** An error in %: whole numbers from 100, one decimal below. */
const errPct = (value: number | null, lang: Lang) => (value == null ? '–' : fmtNumber(value, lang, value >= 100 ? 0 : 1) + '%');
const longDate = (iso: string, lang: Lang) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(iso.slice(0, 10) + 'T00:00:00Z'));
const monthYear = (key: string, lang: Lang) => `${monthName(Number(key.slice(5, 7)), lang, 'long')} ${key.slice(0, 4)}`;

/** "2014–2018, 2020–2024 and 2026": a list of years with each unbroken run written as a range. */
function yearRuns(ys: number[], lang: Lang): string {
  const runs: string[] = [];
  let from: number | null = null, prev: number | null = null;
  const close = () => { if (from != null && prev != null) runs.push(from === prev ? String(from) : `${from}–${prev}`); };
  for (const y of ys) {
    if (prev != null && y === prev + 1) { prev = y; continue; }
    close();
    from = y;
    prev = y;
  }
  close();
  return new Intl.ListFormat(locale(lang), { style: 'long', type: 'conjunction' }).format(runs);
}

function seamText(check: LandingCheck | null, lang: Lang, tr: Tr): string {
  if (!check || check.value == null) return '';
  const v = signed(check.value, lang, 3);
  return check.ci
    ? tr(`level change ${v} on a log scale, 90% interval ${signed(check.ci[0], lang, 3)} to ${signed(check.ci[1], lang, 3)}`,
      `perubahan tingkat ${v} pada skala log, interval 90% ${signed(check.ci[0], lang, 3)} sampai ${signed(check.ci[1], lang, 3)}`)
    : tr(`level change ${v} on a log scale`, `perubahan tingkat ${v} pada skala log`);
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="ka-method-section" id={'ka-method-' + id} tabIndex={-1} aria-labelledby={'ka-method-' + id + '-title'}>
      <p className="ka-method-eyebrow">{eyebrow}</p>
      <h2 id={'ka-method-' + id + '-title'}>{title}</h2>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the page

export function Method() {
  const tr = useTr();
  const lang = useLang();
  const [data, setData] = useState<LandingData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [rule, setRule] = useState<BlindRule | null>(null);
  const [districts, setDistricts] = useState<DistrictCount | null>(null);

  useEffect(() => {
    let live = true;
    loadLandingData()
      .then((next) => { if (live) { setData(next); setState(next ? 'ready' : 'unavailable'); } })
      .catch(() => { if (live) setState('unavailable'); });
    // extras: without one of them its sentences are left out
    loadFrame().then((next) => { if (live) setFrame(next); }).catch(() => undefined);
    loadBlindRule().then((next) => { if (live) setRule(next); }).catch(() => undefined);
    loadDistrictCount().then((next) => { if (live) setDistricts(next); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const v = data?.validation ?? null;
  const name = (map: Record<string, [string, string]>, key: string, fallback: [string, string]) => tr(...(map[key] ?? fallback));
  const methodName = (m: MethodError) => (v && m.method === v.chosen ? tr('our harmonization', 'harmonisasi kami')
    : name(METHOD_NAMES, m.method, ['another method', 'metode lain']));
  const seasonsText = rule && rule.years.length ? yearRuns(rule.years, lang) : data && data.visYears.length ? yearRuns(data.visYears, lang) : null;
  const regionFails = v ? v.regions.filter((r) => r.status === 'fail') : [];
  const better = v?.simplerBetter ?? [];
  const forwardRival = v ? v.others.find((m) => m.forwardKge != null && v.ours?.forwardKge != null && m.forwardKge > v.ours.forwardKge) ?? null : null;
  const methods = v ? [v.raw, ...v.others, v.ours].filter((m): m is MethodError => !!m) : [];
  const latest = data?.latest ?? null;
  const change = data?.change ?? null;
  const month = latest ? monthName(latest.month, lang, 'long') : '';
  const waiting = state === 'loading'
    ? tr('Loading the data files…', 'Memuat berkas data…')
    : tr('The data files could not be loaded here, so the numbers are left out.', 'Berkas data tidak dapat dimuat di sini, sehingga angkanya tidak ditampilkan.');

  return (
    <div className="ka-method">
      <header className="ka-method-hero">
        <div className="ka-method-inner">
          <p className="ka-method-eyebrow">KalenderApi · {tr('About and method', 'Tentang dan metode')}</p>
          <h1>{tr('A zero is not always a zero.', 'Nol belum tentu nol.')}</h1>
          <p className="ka-method-lead">
            {data?.spanYears
              ? tr(
                `KalenderApi puts ${data.spanYears} years of MODIS and VIIRS fire detections for Indonesia on one scale, then marks the days MODIS had no cloud-free look at the ground. This page says who it is for, what the numbers are, how they are made and where they fail.`,
                `KalenderApi menyatukan ${data.spanYears} tahun deteksi api MODIS dan VIIRS di Indonesia pada satu skala, lalu menandai hari ketika MODIS tidak mendapat pandangan bebas awan ke permukaan. Halaman ini menjelaskan untuk siapa alat ini, apa angkanya, bagaimana angka itu dibuat, dan di mana angka itu gagal.`,
              )
              : tr(
                'KalenderApi puts Indonesia’s MODIS and VIIRS fire detections on one scale, then marks the days MODIS had no cloud-free look at the ground. This page says who it is for, what the numbers are, how they are made and where they fail.',
                'KalenderApi menyatukan deteksi api MODIS dan VIIRS di Indonesia pada satu skala, lalu menandai hari ketika MODIS tidak mendapat pandangan bebas awan ke permukaan. Halaman ini menjelaskan untuk siapa alat ini, apa angkanya, bagaimana angka itu dibuat, dan di mana angka itu gagal.',
              )}
          </p>
          <div className="ka-method-cta">
            <a className="ka-method-btn ka-method-btn--primary" href={LANDING_ROUTES.season}>{tr('Play the season', 'Putar musim')} <span aria-hidden="true">▶</span></a>
            <a className="ka-method-btn" href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')}</a>
            <a className="ka-method-btn" href={LANDING_ROUTES.zero}>{tr('Zero inspector', 'Pemeriksa nol')}</a>
            <a className="ka-method-btn ka-method-btn--quiet" href={LANDING_ROUTES.brief}>{tr('District brief', 'Ringkasan kabupaten/kota')}</a>
          </div>
          <nav className="ka-method-toc" aria-label={tr('On this page', 'Di halaman ini')}>
            {TOC.map((item) => <a key={item.id} href={'#ka-method-' + item.id} onClick={(event) => jumpTo(item.id, event)}>{tr(item.en, item.idn)}</a>)}
          </nav>
        </div>
      </header>

      <div className="ka-method-inner ka-method-body">
        {/* ---------------------------------------------------------------- who it is for, and the rule */}
        <Section id="who" eyebrow={'01 · ' + tr('Who it is for', 'Untuk siapa')} title={tr('Three people, three questions, one rule.', 'Tiga pihak, tiga pertanyaan, satu aturan.')}>
          <ul className="ka-method-users">
            <li><b>{tr('A BPBD district officer', 'Petugas BPBD kabupaten/kota')}</b><span>{tr('writes the day’s hotspot report.', 'menyusun laporan titik panas harian.')}</span></li>
            <li><b>{tr('A Manggala Agni patrol planner', 'Perencana patroli Manggala Agni')}</b><span>{tr('decides where the next patrol goes.', 'menentukan tujuan patroli berikutnya.')}</span></li>
            <li><b>{tr('A peat restoration team', 'Tim restorasi gambut')}</b><span>{tr('follows fire around its sites from season to season.', 'mengikuti api di sekitar lokasinya dari musim ke musim.')}</span></li>
          </ul>
          <p className="ka-method-small">{tr('We have not yet tested the tool with these agencies.', 'Kami belum menguji alat ini bersama instansi-instansi tersebut.')}</p>
          <div className="ka-method-cards">
            <article className="ka-method-card">
              <span className="ka-method-n">1</span>
              <h3>{tr('When does my area usually burn?', 'Kapan wilayah saya biasanya terbakar?')}</h3>
              <p>
                {data?.firstMonth
                  ? tr(`A calendar of every month since ${monthYear(data.firstMonth, lang)}, on one scale, for Indonesia, its provinces and ${districts ? `${fmtNumber(districts.total, lang)} districts (kabupaten/kota, approximate values)` : 'its districts (kabupaten/kota)'}.`,
                    `Kalender setiap bulan sejak ${monthYear(data.firstMonth, lang)}, pada satu skala, untuk Indonesia, provinsi, dan ${districts ? `${fmtNumber(districts.total, lang)} kabupaten/kota (nilai perkiraan)` : 'kabupaten/kota'}.`)
                  : tr('A calendar of every month, on one scale, for Indonesia, its provinces and its districts (kabupaten/kota).',
                    'Kalender setiap bulan, pada satu skala, untuk Indonesia, provinsi, dan kabupaten/kota.')}
              </p>
              <a href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')} <span aria-hidden="true">→</span></a>
            </article>
            <article className="ka-method-card">
              <span className="ka-method-n">2</span>
              <h3>{tr('Is this month unusual?', 'Apakah bulan ini tidak biasa?')}</h3>
              <p>{tr('The latest month against the median of the same month, with its rank among the years of the record, on one printable page.',
                'Bulan terbaru dibanding median bulan yang sama, beserta peringkatnya di antara tahun-tahun dalam catatan, dalam satu halaman siap cetak.')}</p>
              <a href={LANDING_ROUTES.brief}>{tr('Open the district brief', 'Buka ringkasan kabupaten/kota')} <span aria-hidden="true">→</span></a>
            </article>
            <article className="ka-method-card">
              <span className="ka-method-n">3</span>
              <h3>{tr('Can today’s zero be taken at face value?', 'Bisakah nol hari ini diterima begitu saja?')}</h3>
              <p>
                {seasonsText
                  ? tr(`For Central Kalimantan, August to October of ${seasonsText}: day by day and district by district, the share of no-fire land with no cloud-free MODIS look.`,
                    `Untuk Kalimantan Tengah, Agustus sampai Oktober ${seasonsText}: hari demi hari dan per kabupaten/kota, porsi daratan tanpa api yang tidak mendapat pandangan bebas awan dari MODIS.`)
                  : tr('For Central Kalimantan: day by day and district by district, the share of no-fire land with no cloud-free MODIS look.',
                    'Untuk Kalimantan Tengah: hari demi hari dan per kabupaten/kota, porsi daratan tanpa api yang tidak mendapat pandangan bebas awan dari MODIS.')}
              </p>
              <a href={LANDING_ROUTES.season}>{tr('Play the season', 'Putar musim')} <span aria-hidden="true">→</span></a>
            </article>
          </div>

          <div className="ka-method-rule">
            <p className="ka-method-eyebrow">{tr('The reporting rule', 'Aturan pelaporan')}</p>
            <p className="ka-method-rule-text">
              {tr(
                'Do not report “no hotspots” for a day on which most of the district had no cloud-free look. Report “not observed”, and ask for a ground check or a second source.',
                'Jangan melaporkan “nihil titik panas” untuk hari ketika sebagian besar wilayah kabupaten/kota tidak mendapat pandangan bebas awan. Laporkan “tidak teramati”, lalu minta pengecekan lapangan atau sumber kedua.',
              )}
            </p>
            {rule ? (
              <p>
                {tr(
                  `How often it applies: in Central Kalimantan, over ${fmtNumber(rule.seasons, lang)} August-to-October seasons (${yearRuns(rule.years, lang)}), more than half of a district’s no-fire cell-days had no cloud-free look on ${fmtNumber(rule.above, lang)} of ${fmtNumber(rule.districtDays, lang)} district-days (${fmtNumber(rule.sharePct, lang, 1)}%).`,
                  `Seberapa sering berlaku: di Kalimantan Tengah, selama ${fmtNumber(rule.seasons, lang)} musim Agustus–Oktober (${yearRuns(rule.years, lang)}), lebih dari separuh sel-hari tanpa api di suatu kabupaten/kota tidak mendapat pandangan bebas awan pada ${fmtNumber(rule.above, lang)} dari ${fmtNumber(rule.districtDays, lang)} hari-kabupaten/kota (${fmtNumber(rule.sharePct, lang, 1)}%).`,
                )}
                {rule.wet ? ' ' + tr(
                  `In the wet-season quarter of January to March ${rule.wet.year}, for contrast, it was ${fmtNumber(rule.wet.above, lang)} of ${fmtNumber(rule.wet.districtDays, lang)} (${fmtNumber(rule.wet.sharePct, lang, 1)}%).`,
                  `Sebagai pembanding, pada kuartal musim hujan Januari–Maret ${rule.wet.year} angkanya ${fmtNumber(rule.wet.above, lang)} dari ${fmtNumber(rule.wet.districtDays, lang)} (${fmtNumber(rule.wet.sharePct, lang, 1)}%).`,
                ) : ''}
              </p>
            ) : null}
            {frame && frame.districts > 0 ? (
              <p>
                {tr(
                  `One day as an example, ${longDate(frame.date, lang)}: ${fmtNumber(frame.share, lang, 1)}% of the province’s no-fire cell-days had no cloud-free look and ${fmtNumber(frame.fireCells, lang)} cells had fire; the rule applied in ${fmtNumber(frame.districtsMostly, lang)} of ${fmtNumber(frame.districts, lang)} districts.`,
                  `Satu hari sebagai contoh, ${longDate(frame.date, lang)}: ${fmtNumber(frame.share, lang, 1)}% sel-hari tanpa api di provinsi itu tidak mendapat pandangan bebas awan dan ${fmtNumber(frame.fireCells, lang)} sel berapi; aturan ini berlaku di ${fmtNumber(frame.districtsMostly, lang)} dari ${fmtNumber(frame.districts, lang)} kabupaten/kota.`,
                )}
              </p>
            ) : null}
            <p className="ka-method-small">
              {tr(
                'The layer measures cloud only, from MODIS Terra and Aqua, for past seasons; it is not a live service. Thick smoke is usually not flagged as cloud by the MODIS fire mask, so the true unseen share is higher. Source: MODIS MOD14A1 and MYD14A1 FireMask.',
                'Lapisan ini hanya mengukur awan, dari MODIS Terra dan Aqua, untuk musim-musim yang sudah lewat; ini bukan layanan langsung. Asap tebal biasanya tidak ditandai sebagai awan oleh masker api MODIS, sehingga porsi yang sebenarnya tidak teramati lebih besar. Sumber: FireMask MODIS MOD14A1 dan MYD14A1.',
              )}
            </p>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- three facts */}
        <Section id="facts" eyebrow={'02 · ' + tr('Three facts', 'Tiga fakta')} title={tr('Three numbers, each computed from the data files.', 'Tiga angka, masing-masing dihitung dari berkas data.')}>
          {data ? (
            <div className="ka-method-facts">
              {latest && latest.ratio != null ? (
                <article className="ka-method-fact">
                  <p className="ka-method-fact-label">
                    Indonesia · {month} {latest.year}
                    {latest.provisional ? <span className="ka-method-flag">{tr('provisional', 'sementara')}</span> : null}
                  </p>
                  <p className="ka-method-fact-value">{fmtNumber(latest.ratio, lang, 1)}× {tr(`the median ${month}`, `median ${month}`)}</p>
                  <p>
                    {tr(
                      `${fmtNumber(latest.H, lang)} fire cell-days on the Aqua MODIS scale${latest.median != null ? `, against a median of ${fmtNumber(latest.median, lang)} for ${month}${latest.baseline ? ` ${latest.baseline[0]}–${latest.baseline[1]}` : ''}` : ''}.${latest.provisional ? ' The month uses near-real-time data and may change.' : ''}`,
                      `${fmtNumber(latest.H, lang)} sel-hari api pada skala Aqua MODIS${latest.median != null ? `, dibanding median ${fmtNumber(latest.median, lang)} untuk ${month}${latest.baseline ? ` ${latest.baseline[0]}–${latest.baseline[1]}` : ''}` : ''}.${latest.provisional ? ' Bulan ini memakai data hampir waktu nyata dan dapat berubah.' : ''}`,
                    )}
                  </p>
                  <p className="ka-method-source">{tr('Source: our national record, from NASA FIRMS.', 'Sumber: catatan nasional kami, dari NASA FIRMS.')}</p>
                </article>
              ) : null}
              {change ? (
                <article className="ka-method-fact">
                  <p className="ka-method-fact-label">Indonesia · {change.recent[0]}–{change.recent[1]} vs {change.early[0]}–{change.early[1]}</p>
                  <p className="ka-method-fact-value"><span>{signed(change.raw, lang)}% {tr('raw', 'mentah')} ·</span> <span>{signed(change.harm, lang)}% {tr('on one scale', 'pada satu skala')}</span></p>
                  <p>
                    {tr(
                      'Change in mean yearly fire cell-days. Raw: MODIS to 2011 joined to VIIRS from 2012, as recorded. One scale: Aqua MODIS’s own count in both periods, so no conversion is involved.',
                      'Perubahan rata-rata sel-hari api per tahun. Mentah: MODIS sampai 2011 disambung VIIRS sejak 2012, apa adanya. Satu skala: hitungan Aqua MODIS sendiri di kedua periode, jadi tanpa konversi.',
                    )}
                  </p>
                  <p className="ka-method-source">{tr('Source: NASA FIRMS archives.', 'Sumber: arsip NASA FIRMS.')}</p>
                </article>
              ) : null}
              {v?.raw?.loyo != null && v.ours?.loyo != null ? (
                <article className="ka-method-fact">
                  <p className="ka-method-fact-label">{tr('Error on years left out of the fit', 'Galat pada tahun di luar penyesuaian')}</p>
                  <p className="ka-method-fact-value"><span>{errPct(v.ours.loyo, lang)} {tr('harmonized', 'terharmonisasi')} ·</span> <span>{errPct(v.raw.loyo, lang)} {tr('raw', 'mentah')}</span></p>
                  <p>
                    {tr(
                      'Median absolute error of the national yearly total, in percent, when each year in turn is left out of the fit.',
                      'Median galat absolut total nasional tahunan, dalam persen, ketika setiap tahun bergantian tidak dipakai dalam penyesuaian.',
                    )}
                  </p>
                  <p className="ka-method-source">{tr('Source: our validation file.', 'Sumber: berkas validasi kami.')}</p>
                </article>
              ) : null}
            </div>
          ) : <p className="ka-method-wait" role="status">{waiting}</p>}
          <p className="ka-method-small">
            {tr('These describe detections. They say nothing about why detections changed, and they are not burned area.',
              'Angka-angka ini menggambarkan deteksi. Angka ini tidak menjelaskan mengapa deteksi berubah, dan bukan luas terbakar.')}
          </p>
        </Section>

        {/* ---------------------------------------------------------------- what we count */}
        <Section id="count" eyebrow={'03 · ' + tr('Method', 'Metode')} title={tr('What we count.', 'Yang kami hitung.')}>
          <p>
            {tr(
              'The unit is the fire cell-day: one 0.01° grid cell (about 1.1 km) with at least one active-fire detection on one local date, counted per satellite and per day or night pass. A cell that burns day and night, or is seen by two satellites, counts more than once. A fire cell-day is not a fire event, not burned area and not emissions.',
              'Satuannya adalah sel-hari api: satu sel grid 0,01° (sekitar 1,1 km) dengan sedikitnya satu deteksi api aktif pada satu tanggal setempat, dihitung per satelit dan per lintasan siang atau malam. Sel yang terbakar siang dan malam, atau terlihat oleh dua satelit, dihitung lebih dari sekali. Satu sel-hari api bukan peristiwa kebakaran, bukan luas terbakar, dan bukan emisi.',
            )}
          </p>
          <p>
            {tr(
              'Which detections are kept: NASA FIRMS archive detections from MODIS (Terra and Aqua, Collection 6.1) and VIIRS 375 m (S-NPP and NOAA-20) that FIRMS types as presumed vegetation fire, with nominal or high confidence. Low-confidence detections and the other types (volcanoes, other static sources, offshore) are dropped. The most recent months come from near-real-time files and are marked provisional.',
              'Deteksi yang dipakai: deteksi arsip NASA FIRMS dari MODIS (Terra dan Aqua, Collection 6.1) dan VIIRS 375 m (S-NPP dan NOAA-20) yang oleh FIRMS digolongkan sebagai dugaan kebakaran vegetasi, dengan tingkat keyakinan nominal atau tinggi. Deteksi berkeyakinan rendah dan jenis lain (gunung api, sumber statis lain, lepas pantai) dibuang. Bulan-bulan terbaru berasal dari berkas hampir waktu nyata dan ditandai sementara.',
            )}
          </p>
          {data ? (
            <p>
              {tr(
                `The record holds ${fmtNumber(data.areas, lang)} areas (Indonesia, its island regions and provinces)${data.firstMonth && data.lastMonth ? `, monthly from ${monthYear(data.firstMonth, lang)} to ${monthYear(data.lastMonth, lang)}` : ''}${districts ? `, and approximate records for ${fmtNumber(districts.total, lang)} districts` : ''}.`,
                `Catatan ini memuat ${fmtNumber(data.areas, lang)} wilayah (Indonesia, wilayah pulau, dan provinsi)${data.firstMonth && data.lastMonth ? `, bulanan dari ${monthYear(data.firstMonth, lang)} sampai ${monthYear(data.lastMonth, lang)}` : ''}${districts ? `, serta catatan perkiraan untuk ${fmtNumber(districts.total, lang)} kabupaten/kota` : ''}.`,
              )}
            </p>
          ) : null}
        </Section>

        {/* ---------------------------------------------------------------- one scale */}
        <Section id="scale" eyebrow={'04 · ' + tr('Method', 'Metode')} title={tr('How the one scale is made.', 'Cara satu skala dibuat.')}>
          <p>
            {tr(
              'VIIRS detects smaller fires than MODIS, so joining the two records as they come makes the count jump in 2012. We keep the Aqua MODIS scale throughout, so no year before VIIRS has to be modelled.',
              'VIIRS mendeteksi api yang lebih kecil daripada MODIS, sehingga menyambung kedua catatan apa adanya membuat hitungan melonjak pada 2012. Kami memakai skala Aqua MODIS sepanjang catatan, sehingga tidak ada tahun sebelum VIIRS yang perlu dimodelkan.',
            )}
          </p>
          <ol className="ka-method-steps">
            <li>
              <b>{tr('Before Aqua.', 'Sebelum Aqua.')}</b>{' '}
              {tr('Terra MODIS, converted to the Aqua scale with a ratio fitted on the years both flew.', 'Terra MODIS, dikonversi ke skala Aqua dengan rasio yang disesuaikan pada tahun-tahun ketika keduanya beroperasi.')}
            </li>
            <li>
              <b>{data?.convertedFrom != null ? tr(`Up to ${data.convertedFrom - 1}.`, `Sampai ${data.convertedFrom - 1}.`) : tr('The Aqua years.', 'Tahun-tahun Aqua.')}</b>{' '}
              {tr('Aqua MODIS’s own count. Nothing is converted, so in these years the one-scale line is simply Aqua.', 'Hitungan Aqua MODIS sendiri. Tidak ada yang dikonversi, jadi pada tahun-tahun ini garis satu skala adalah Aqua itu sendiri.')}
            </li>
            <li>
              <b>{data?.convertedFrom != null ? tr(`From ${data.convertedFrom}.`, `Sejak ${data.convertedFrom}.`) : tr('After Aqua.', 'Setelah Aqua.')}</b>{' '}
              {tr(
                `VIIRS S-NPP counts multiplied by a VIIRS-to-Aqua ratio${data?.calibration ? ` fitted on ${data.calibration[0]}–${data.calibration[1]}` : ''}. The ratio is estimated per island region, season and day or night pass; where a group has little data its estimate is pulled toward its region’s (an empirical-Bayes gamma-Poisson model). NOAA-20 is chained to S-NPP for months S-NPP does not cover.`,
                `Hitungan VIIRS S-NPP dikalikan rasio VIIRS-ke-Aqua${data?.calibration ? ` yang disesuaikan pada ${data.calibration[0]}–${data.calibration[1]}` : ''}. Rasio ditaksir per wilayah pulau, musim, dan lintasan siang atau malam; kelompok dengan data sedikit ditarik ke nilai wilayahnya (model gamma-Poisson empirical Bayes). NOAA-20 dirantai ke S-NPP untuk bulan yang tidak tercakup S-NPP.`,
              )}
            </li>
          </ol>
          <p>
            {tr(
              `Each converted month carries a 90% range${v?.nBoot ? ` from ${fmtNumber(v.nBoot, lang)} bootstrap draws of the ratio` : ''}. The range covers the fit of the ratio only, not every source of error.`,
              `Setiap bulan hasil konversi memiliki rentang 90%${v?.nBoot ? ` dari ${fmtNumber(v.nBoot, lang)} cuplikan bootstrap rasio` : ''}. Rentang itu hanya mencakup penyesuaian rasio, bukan semua sumber galat.`,
            )}
          </p>
          {data && v?.seam2022 && v.seam2022.passed === false && data.convertedFrom != null ? (
            <p className="ka-method-warn">
              <b>{tr(`The ${data.convertedFrom} seam test fails`, `Uji sambungan ${data.convertedFrom} gagal`)}</b>
              {seamText(v.seam2022, lang, tr) ? ` (${seamText(v.seam2022, lang, tr)})` : ''}.{' '}
              {tr('Values from that year on are less certain than their range shows.', 'Nilai sejak tahun itu kurang pasti dibanding yang ditunjukkan rentangnya.')}
              {data.seamYears.length ? ' ' + tr(
                `Against Aqua MODIS’s own count of the same year, our converted value was ${data.seamYears.map((s) => `${fmtNumber(s.ratio, lang, 2)}× (${s.year})`).join(', ')}.`,
                `Dibanding hitungan Aqua MODIS sendiri pada tahun yang sama, nilai konversi kami adalah ${data.seamYears.map((s) => `${fmtNumber(s.ratio, lang, 2)}× (${s.year})`).join(', ')}.`,
              ) : ''}
            </p>
          ) : null}
          <p className="ka-method-small">
            {tr('The raw record we compare against is MODIS to 2011 joined to VIIRS from 2012, as recorded.', 'Catatan mentah yang kami bandingkan adalah MODIS sampai 2011 yang disambung VIIRS sejak 2012, apa adanya.')}
          </p>
        </Section>

        {/* ---------------------------------------------------------------- what we checked */}
        <Section id="checks" eyebrow={'05 · ' + tr('Checks', 'Pengujian')} title={tr('What we checked, and what failed.', 'Yang kami uji, dan yang gagal.')}>
          <p>
            {tr('The checks and their pass rules were written down before the run.', 'Pengujian dan aturan lolosnya ditulis sebelum dijalankan.')}
            {v?.runUtc ? ' ' + tr(`The results below are read from the validation file of ${longDate(v.runUtc, lang)}.`, `Hasil di bawah dibaca dari berkas validasi tanggal ${longDate(v.runUtc, lang)}.`) : ''}
          </p>
          {v ? (
            <>
              {methods.length ? (
                <div className="ka-method-tablewrap" role="region" tabIndex={0} aria-label={tr('Held-out error by method (scrolls sideways on a narrow screen)', 'Galat tahun yang tidak dipakai menurut metode (dapat digulir ke samping di layar sempit)')}>
                  <table className="ka-method-table">
                    <caption>{tr('Error of the national yearly total on a year left out of the fit, in percent, and the forward-in-time score (Kling-Gupta efficiency, 1 is perfect).',
                      'Galat total nasional tahunan pada tahun yang tidak dipakai dalam penyesuaian, dalam persen, dan skor uji maju dalam waktu (efisiensi Kling-Gupta, 1 berarti sempurna).')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{tr('Method', 'Metode')}</th>
                        <th scope="col">{tr('Each year in turn (median)', 'Setiap tahun bergantian (median)')}</th>
                        <th scope="col">2015</th>
                        <th scope="col">2019</th>
                        <th scope="col">{tr('Forward test', 'Uji maju')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methods.map((m) => (
                        <tr key={m.method} data-ours={m.method === v.chosen ? 'true' : undefined}>
                          <th scope="row">{methodName(m).replace(/^./, (c) => c.toUpperCase())}</th>
                          <td>{errPct(m.loyo, lang)}</td>
                          <td>{errPct(m.y2015, lang)}</td>
                          <td>{errPct(m.y2019, lang)}</td>
                          <td>{m.forwardKge != null ? (m.forwardKge < 0 ? '−' : '') + fmtNumber(Math.abs(m.forwardKge), lang, 3) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <h3>{tr('What failed', 'Yang gagal')}</h3>
              <ul className="ka-method-list ka-method-list--fail">
                {v.seam2022 && v.seam2022.passed === false ? (
                  <li>
                    <b>{tr('The 2022 seam.', 'Sambungan 2022.')}</b>{' '}
                    {tr(`Where the record changes from Aqua MODIS’s own count to converted VIIRS, the level shifts more than chance seams do (${seamText(v.seam2022, lang, tr)}).`,
                      `Di titik catatan beralih dari hitungan Aqua MODIS sendiri ke VIIRS yang dikonversi, tingkatnya bergeser lebih besar daripada sambungan acak (${seamText(v.seam2022, lang, tr)}).`)}
                  </li>
                ) : null}
                {regionFails.length ? (
                  <li>
                    <b>{tr(`Transfer to a region left out: ${regionFails.length} of ${v.regions.length} regions fail.`, `Penerapan ke wilayah yang tidak dipakai: ${regionFails.length} dari ${v.regions.length} wilayah gagal.`)}</b>{' '}
                    {tr('Median error by region', 'Median galat per wilayah')}: {v.regions.map((r) => `${name(REGION_NAMES, r.name, [r.name, r.name])} ${errPct(r.value, lang)}${r.status === 'fail' ? tr(' (fails)', ' (gagal)') : ''}`).join('; ')}.{' '}
                    {tr('The national fit is not equally reliable everywhere.', 'Penyesuaian nasional tidak sama andalnya di semua tempat.')}
                  </li>
                ) : null}
                {better.length && v.ours?.loyo != null ? (
                  <li>
                    <b>{tr('A simpler method does better on held-out years.', 'Metode yang lebih sederhana lebih baik pada tahun yang tidak dipakai.')}</b>{' '}
                    {better.map((m) => tr(
                      `With ${methodName(m)}, the median error is ${errPct(m.loyo, lang)}, against ${errPct(v.ours!.loyo, lang)} for ours.`,
                      `Dengan ${methodName(m)}, median galatnya ${errPct(m.loyo, lang)}, dibanding ${errPct(v.ours!.loyo, lang)} untuk metode kami.`,
                    )).join(' ')}{' '}
                    {tr('We kept the method named before the run rather than switch after seeing the results.', 'Kami mempertahankan metode yang disebut sebelum dijalankan, bukan menggantinya setelah melihat hasil.')}
                  </li>
                ) : null}
                {v.forward && v.forward.passed === false && v.ours?.forwardKge != null ? (
                  <li>
                    <b>{tr('The forward-in-time test.', 'Uji maju dalam waktu.')}</b>{' '}
                    {tr(
                      `Fitted on the earlier overlap years and predicting the later ones, our method scores ${fmtNumber(v.ours.forwardKge, lang, 3)}${forwardRival?.forwardKge != null ? `, below ${fmtNumber(forwardRival.forwardKge, lang, 3)} for ${methodName(forwardRival)}` : ''}; our rule asked it to beat that method.`,
                      `Disesuaikan pada tahun-tahun tumpang-tindih awal untuk memprediksi tahun berikutnya, metode kami mendapat skor ${fmtNumber(v.ours.forwardKge, lang, 3)}${forwardRival?.forwardKge != null ? `, di bawah ${fmtNumber(forwardRival.forwardKge, lang, 3)} untuk ${methodName(forwardRival)}` : ''}; aturan kami mensyaratkan metode kami lebih baik.`,
                    )}
                  </li>
                ) : null}
                {v.counts.not_run ? (
                  <li>
                    <b>{tr(`${v.counts.not_run} planned checks were not run.`, `${v.counts.not_run} pengujian yang direncanakan tidak dijalankan.`)}</b>{' '}
                    {v.peatNotRun
                      ? tr('Their inputs were not ready. The peat checks are among them, so no checked result here is specific to peat.',
                        'Masukannya belum siap. Uji gambut termasuk di dalamnya, sehingga tidak ada hasil teruji di sini yang khusus untuk gambut.')
                      : tr('Their inputs were not ready.', 'Masukannya belum siap.')}
                  </li>
                ) : null}
              </ul>
              <h3>{tr('What passed', 'Yang lolos')}</h3>
              <ul className="ka-method-list ka-method-list--pass">
                {v.seam2012 && v.seam2012.passed === true ? (
                  <li>
                    <b>{tr('The 2012 seam.', 'Sambungan 2012.')}</b>{' '}
                    {tr(`Switching from MODIS to converted VIIRS in 2012 leaves no step beyond chance (${seamText(v.seam2012, lang, tr)}).`,
                      `Beralih dari MODIS ke VIIRS yang dikonversi pada 2012 tidak meninggalkan lonjakan di luar kebetulan (${seamText(v.seam2012, lang, tr)}).`)}
                    {data?.calibration ? ' ' + tr(`The ratio was fitted on ${data.calibration[0]}–${data.calibration[1]}, so this is not an independent test.`,
                      `Rasio disesuaikan pada ${data.calibration[0]}–${data.calibration[1]}, jadi ini bukan uji yang independen.`) : ''}
                  </li>
                ) : null}
                {v.ours?.loyo != null && v.raw?.loyo != null ? (
                  <li>
                    <b>{tr('Years left out of the fit.', 'Tahun yang tidak dipakai dalam penyesuaian.')}</b>{' '}
                    {tr(`Median error ${errPct(v.ours.loyo, lang)}, against ${errPct(v.raw.loyo, lang)} for the raw splice. This is the only evidence from years the fit never saw, and it is on national yearly totals.`,
                      `Median galat ${errPct(v.ours.loyo, lang)}, dibanding ${errPct(v.raw.loyo, lang)} untuk sambungan mentah. Ini satu-satunya bukti dari tahun yang tidak pernah dilihat penyesuaian, dan berlaku untuk total nasional tahunan.`)}
                  </li>
                ) : null}
              </ul>
              <p className="ka-method-small">
                {tr(
                  `The validation file has ${v.total} rows: ${v.counts.pass} pass, ${v.counts.fail} fail, ${v.counts.not_run} not run, ${v.counts.na} not applicable and ${v.counts.info} descriptive rows with no pass rule. The count is not a score: several rows test the raw splice or other methods. In every check the reference is Aqua MODIS itself; no independent burned-area product was used.`,
                  `Berkas validasi berisi ${v.total} baris: ${v.counts.pass} lolos, ${v.counts.fail} gagal, ${v.counts.not_run} tidak dijalankan, ${v.counts.na} tidak berlaku, dan ${v.counts.info} baris deskriptif tanpa aturan lolos. Jumlah ini bukan skor: beberapa baris menguji sambungan mentah atau metode lain. Dalam setiap pengujian acuannya adalah Aqua MODIS itu sendiri; tidak ada produk luas terbakar independen yang dipakai.`,
                )}{' '}
                <a href={import.meta.env.BASE_URL + 'ss-data/validation_results.json'} download>{tr('Download the validation file (JSON)', 'Unduh berkas validasi (JSON)')}</a>
              </p>
            </>
          ) : <p className="ka-method-wait" role="status">{waiting}</p>}
        </Section>

        {/* ---------------------------------------------------------------- the cloud-visibility layer */}
        <Section id="cloud" eyebrow={'06 · ' + tr('Cloud layer', 'Lapisan awan')} title={tr('The cloud-visibility layer.', 'Lapisan keterlihatan awan.')}>
          <p>
            {tr(
              'For Central Kalimantan we read the daily MODIS fire mask (MOD14A1 from Terra, MYD14A1 from Aqua) on the same 0.01° grid. For each land cell with no fire detected on a day, we ask one thing: did Terra or Aqua have at least one cloud-free look that day? If neither did, that cell-day has “no cloud-free look”.',
              'Untuk Kalimantan Tengah kami membaca masker api harian MODIS (MOD14A1 dari Terra, MYD14A1 dari Aqua) pada grid 0,01° yang sama. Untuk setiap sel daratan tanpa deteksi api pada suatu hari, kami menanyakan satu hal: apakah Terra atau Aqua mendapat sedikitnya satu pandangan bebas awan pada hari itu? Jika tidak keduanya, sel-hari itu “tanpa pandangan bebas awan”.',
            )}
          </p>
          <h3>{tr('What it must not be read as', 'Yang tidak boleh disimpulkan darinya')}</h3>
          <ul className="ka-method-list">
            <li>{tr('It is cloud only, and from MODIS only. The share it gives is a lower bound on what went unobserved (see the note under the reporting rule).',
              'Ini hanya awan, dan hanya dari MODIS. Porsi yang diberikannya adalah batas bawah dari yang tidak teramati (lihat catatan di bawah aturan pelaporan).')}</li>
            <li>{tr('A cloud-free look means at least one pass, by day or by night. It is not proof that nothing burned: small or smouldering fires can stay below detection.',
              'Pandangan bebas awan berarti sedikitnya satu lintasan, siang atau malam. Itu bukan bukti bahwa tidak ada yang terbakar: api kecil atau membara bisa berada di bawah batas deteksi.')}</li>
            <li>{tr('It says nothing about what VIIRS could observe; the mask is from MODIS.', 'Lapisan ini tidak menyatakan apa pun tentang yang dapat diamati VIIRS; maskernya berasal dari MODIS.')}</li>
            <li>{tr('It is not a count, an estimate or a likelihood of fire under cloud.', 'Ini bukan jumlah, taksiran, atau peluang api di bawah awan.')}</li>
            <li>
              {seasonsText
                ? tr(`It covers Central Kalimantan only, for August to October of ${seasonsText}${rule?.wet ? `, plus January to March ${rule.wet.year} as a wet-season contrast` : ''}. It looks back at past seasons; it is not a live service.`,
                  `Lapisan ini hanya mencakup Kalimantan Tengah, untuk Agustus sampai Oktober ${seasonsText}${rule?.wet ? `, ditambah Januari–Maret ${rule.wet.year} sebagai pembanding musim hujan` : ''}. Lapisan ini melihat musim yang sudah lewat; bukan layanan langsung.`)
                : tr('It covers a few past seasons of Central Kalimantan only; it is not a live service.', 'Lapisan ini hanya mencakup beberapa musim lampau di Kalimantan Tengah; bukan layanan langsung.')}
            </li>
            <li>{tr('The 2019 season is left out of every count here: we registered a separate test on that season and will not look at it before the test is run.',
              'Musim 2019 tidak dimasukkan dalam hitungan apa pun di sini: kami mendaftarkan uji terpisah untuk musim itu dan tidak akan melihatnya sebelum uji tersebut dijalankan.')}</li>
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- district values */}
        <Section id="districts" eyebrow={'07 · ' + tr('Districts', 'Kabupaten/kota')} title={tr('District values are approximate.', 'Nilai kabupaten/kota bersifat perkiraan.')}>
          <p>
            {tr(
              `${districts ? `${fmtNumber(districts.total, lang)} districts (kabupaten/kota) have` : 'Each district (kabupaten/kota) has'} a record of their own, made by sharing out the province record: each 0.05° grid cell goes to the district that contains its centre, and the district’s monthly count is multiplied by its province’s conversion for that month. It is not a separate harmonization.`,
              `${districts ? `${fmtNumber(districts.total, lang)} kabupaten/kota memiliki` : 'Setiap kabupaten/kota memiliki'} catatan sendiri, yang dibuat dengan membagi catatan provinsi: setiap sel grid 0,05° diberikan ke kabupaten/kota yang memuat titik tengahnya, lalu hitungan bulanan kabupaten/kota dikalikan konversi provinsinya pada bulan itu. Ini bukan harmonisasi tersendiri.`,
            )}
          </p>
          <ul className="ka-method-list">
            <li>{tr('Values are weakest near district borders and for small kota.', 'Nilainya paling lemah di dekat batas kabupaten/kota dan untuk kota yang kecil.')}</li>
            {districts && districts.lowData ? (
              <li>{tr(`${fmtNumber(districts.lowData, lang)} of the ${fmtNumber(districts.total, lang)} districts are flagged low data: too few fire cell-days for a single month or a rank to say much.`,
                `${fmtNumber(districts.lowData, lang)} dari ${fmtNumber(districts.total, lang)} kabupaten/kota ditandai berdata sedikit: sel-hari apinya terlalu sedikit sehingga satu bulan atau satu peringkat tidak banyak berarti.`)}</li>
            ) : null}
            <li>{tr('No check has been run at district level.', 'Belum ada pengujian pada tingkat kabupaten/kota.')}</li>
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- data, licences, credits */}
        <Section id="data" eyebrow={'08 · ' + tr('Data and credits', 'Data dan kredit')} title={tr('Data sources, licences and credits.', 'Sumber data, lisensi, dan kredit.')}>
          <ul className="ka-method-sources">
            <li><b>NASA FIRMS</b>{tr(': active-fire detections, MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20). Open NASA data. We acknowledge the use of data from NASA’s Fire Information for Resource Management System (FIRMS), part of NASA’s Earth Science Data and Information System (ESDIS).',
              ': deteksi api aktif, MODIS Collection 6.1 (Terra, Aqua) dan VIIRS 375 m (S-NPP, NOAA-20). Data terbuka NASA. Kami mengakui penggunaan data dari Fire Information for Resource Management System (FIRMS) NASA, bagian dari Earth Science Data and Information System (ESDIS) NASA.')}</li>
            <li><b>MODIS MOD14A1 / MYD14A1 FireMask</b>{tr(' (Collection 6.1, NASA LP DAAC): the daily fire mask behind the cloud layer, read through Microsoft Planetary Computer.',
              ' (Collection 6.1, NASA LP DAAC): masker api harian di balik lapisan awan, dibaca melalui Microsoft Planetary Computer.')}</li>
            <li><b>{tr('NASA FIRMS, near real time', 'NASA FIRMS, hampir waktu nyata')}</b>{tr(': the detections of the last 24 hours and 7 days from VIIRS (NOAA-20, NOAA-21) and MODIS, read when “Today in my district” opens.',
              ': deteksi 24 jam dan 7 hari terakhir dari VIIRS (NOAA-20, NOAA-21) dan MODIS, dibaca saat halaman “Hari ini di daerah saya” dibuka.')}</li>
            <li><b>NASA GIBS</b>{tr(': the daily true-colour imagery in the Story, in Play the season and on “Today in my district”, and the Blue Marble image on the globe.',
              ': citra warna asli harian di Cerita, Putar musim, dan halaman “Hari ini di daerah saya”, serta citra Blue Marble pada bola dunia.')}</li>
            <li><b>{tr('Indonesia peat lands', 'Lahan gambut Indonesia')}</b>{tr(' (Global Forest Watch open data; original map: Ministry of Agriculture, BBSDLP): which cells are peat, for the peat sites to re-check. We could not verify its licence.',
              ' (data terbuka Global Forest Watch; peta asli: Kementerian Pertanian, BBSDLP): sel mana yang gambut, untuk lokasi gambut yang perlu dicek ulang. Lisensinya belum dapat kami verifikasi.')}</li>
            <li><b>geoBoundaries</b>{tr(' (gbOpen, Indonesia ADM2; from BPS, WFP and OCHA ROAP): district borders, licence ', ' (gbOpen, Indonesia ADM2; dari BPS, WFP, dan OCHA ROAP): batas kabupaten/kota, lisensi ')}{districts?.licence ?? frame?.boundaryLicence ?? 'CC BY 3.0 IGO'}.</li>
            <li><b>SiPongi</b>{tr(' (Kementerian Kehutanan): officially reported burned area, shown beside detections for comparison. It is not used to validate the record.',
              ' (Kementerian Kehutanan): luas terbakar yang dilaporkan resmi, ditampilkan di samping deteksi sebagai pembanding. Tidak dipakai untuk memvalidasi catatan.')}</li>
          </ul>
          <h3>{tr('Credits', 'Kredit')}</h3>
          <p>
            {tr('The web app is built on ', 'Aplikasi web ini dibangun di atas ')}
            <a href={FIRE_HARMONY_URL} target="_blank" rel="noopener">Fire Harmony</a>
            {tr(', an open-source project (Apache-2.0). Every change we made is listed in the ', ', sebuah proyek sumber terbuka (Apache-2.0). Setiap perubahan yang kami buat tercantum di ')}
            <a href={NOTICE_URL} target="_blank" rel="noopener">NOTICE</a>
            {tr('. The Indonesia record, its harmonization, the checks and the cloud layer are ours; the code is in ', '. Rekaman Indonesia, harmonisasinya, pengujiannya, dan lapisan awan adalah karya kami; kodenya ada di ')}
            <a href={REPO_URL} target="_blank" rel="noopener">{tr('our repository', 'repositori kami')}</a>.
          </p>
          <p>
            {tr('The globe on the home page adapts a few lines from FireLens (MIT License, Team Aquila), and FireLens’s view of the condition right now was the model for “Today in my district”. The idea of a message for residents, the district disaster office and the village came from looking at another team’s project, PeatForge; none of its code is used.',
              'Bola dunia di beranda mengadaptasi beberapa baris dari FireLens (Lisensi MIT, Team Aquila), dan tampilan kondisi terkini di FireLens menjadi contoh untuk halaman “Hari ini di daerah saya”. Gagasan pesan untuk warga, BPBD, dan desa muncul setelah melihat proyek tim lain, PeatForge; tidak ada kodenya yang dipakai.')}
          </p>
        </Section>

        {/* ---------------------------------------------------------------- AI use */}
        <Section id="ai" eyebrow={'09 · ' + tr('AI use', 'Penggunaan AI')} title={tr('What AI did, and what it did not.', 'Yang dikerjakan AI, dan yang tidak.')}>
          <ul className="ka-method-list">
            <li><b>{tr('Ideas: the team.', 'Gagasan: tim.')}</b>{' '}{tr('The challenge choice, the question of how far a zero can be relied on, Play the season, and the harmonization question with its checks written in advance all came from team members.',
              'Pilihan tantangan, pertanyaan seberapa jauh angka nol bisa diandalkan, Putar musim, serta pertanyaan harmonisasi beserta pengujian yang ditulis lebih dulu, semuanya berasal dari anggota tim.')}</li>
            <li><b>{tr('Code: mostly AI, under our direction.', 'Kode: sebagian besar AI, di bawah arahan kami.')}</b>{' '}{tr('An AI coding assistant (Claude, in Claude Code) wrote most of the new app code and the visibility, district and peat scripts.',
              'Asisten pemrograman AI (Claude, di Claude Code) menulis sebagian besar kode aplikasi yang baru serta skrip keterlihatan, kabupaten/kota, dan gambut.')}</li>
            <li><b>{tr('Runs: AI sessions, logged.', 'Eksekusi: sesi AI, tercatat.')}</b>{' '}{tr('AI sessions ran the pipelines and recorded every command, input checksum and run time.',
              'Sesi AI menjalankan pipeline dan mencatat setiap perintah, checksum masukan, dan waktu eksekusi.')}</li>
            <li><b>{tr('Research and drafts: AI helped.', 'Riset dan draf: dibantu AI.')}</b>{' '}{tr('It searched and summarized repositories and papers and drafted documents. The team made the choices.',
              'AI mencari dan merangkum repositori serta makalah dan menyusun draf dokumen. Keputusan diambil oleh tim.')}</li>
            <li><b>{tr('No AI-generated numbers or images.', 'Tidak ada angka atau gambar buatan AI.')}</b>{' '}{tr('Every number comes from NASA data or the official SiPongi table through code that can be rerun. The photos are NASA GIBS imagery.',
              'Setiap angka berasal dari data NASA atau tabel resmi SiPongi melalui kode yang dapat dijalankan ulang. Fotonya adalah citra NASA GIBS.')}</li>
            <li><b>{tr('One AI feature in the app.', 'Satu fitur AI di dalam aplikasi.')}</b>{' '}{tr('On “Today in my district”, a button asks an OpenAI model to draft advice from the numbers already on the page. The draft is marked as written by AI, adds no numbers of its own, and must be checked before it is sent. The three standard messages there are fixed templates, not AI.',
              'Di halaman “Hari ini di daerah saya”, satu tombol meminta model OpenAI menyusun saran dari angka yang sudah ada di halaman. Draf itu ditandai sebagai tulisan AI, tidak menambah angka sendiri, dan harus diperiksa sebelum dikirim. Tiga pesan standar di sana adalah templat tetap, bukan AI.')}</li>
            <li><b>{tr('The demo video.', 'Video demo.')}</b>{' '}{tr('The picture is a recording of this app. If it has a narration, the voice is an AI voice (ElevenLabs) reading a script the team wrote.',
              'Gambarnya adalah rekaman aplikasi ini. Jika ada narasi, suaranya adalah suara AI (ElevenLabs) yang membacakan naskah tulisan tim.')}</li>
          </ul>
          <p><a href={AI_USE_URL} target="_blank" rel="noopener">{tr('Read the full AI use statement on GitHub', 'Baca pernyataan penggunaan AI selengkapnya di GitHub')}</a></p>
        </Section>

        {/* ---------------------------------------------------------------- limits */}
        <Section id="limits" eyebrow={'10 · ' + tr('Limits', 'Batasan')} title={tr('Limits.', 'Batasan.')}>
          <ul className="ka-method-list">
            <li>{tr('These are detections. A fire cell-day is not a fire event, burned area or emissions.', 'Ini adalah deteksi. Satu sel-hari api bukan peristiwa kebakaran, luas terbakar, atau emisi.')}</li>
            <li>{tr('We claim no cause for any change, and nothing here is a forecast or an early warning.', 'Kami tidak menyatakan penyebab perubahan apa pun, dan tidak ada prakiraan atau peringatan dini di sini.')}</li>
            {data?.convertedFrom != null ? (
              <li>{tr(`From ${data.convertedFrom} the record is converted VIIRS, and the seam test there fails. The 90% range covers the ratio’s fit only.`,
                `Sejak ${data.convertedFrom} catatan ini adalah VIIRS hasil konversi, dan uji sambungan di titik itu gagal. Rentang 90% hanya mencakup penyesuaian rasio.`)}</li>
            ) : null}
            <li>{tr('Every check uses Aqua MODIS as its reference. There is no independent check against burned area, and none at province or district level.',
              'Setiap pengujian memakai Aqua MODIS sebagai acuan. Tidak ada pengujian independen terhadap luas terbakar, dan tidak ada pengujian pada tingkat provinsi atau kabupaten/kota.')}</li>
            <li>{tr('The peat checks written in advance were not run. The peat sites on “Today in my district” come from a separate count, made after looking at the data: they are places to re-check, not proof that fire kept burning.',
              'Pengujian gambut yang ditulis lebih dulu tidak dijalankan. Lokasi gambut di halaman “Hari ini di daerah saya” berasal dari hitungan terpisah yang dibuat setelah melihat data: itu tempat untuk dicek ulang, bukan bukti bahwa api terus menyala.')}</li>
            <li>{tr('The level on “Today in my district” is our own rule, not an official status.', 'Tingkat di halaman “Hari ini di daerah saya” adalah aturan kami sendiri, bukan status resmi.')}</li>
            <li>{tr('The cloud layer is cloud only, MODIS only, Central Kalimantan only, and retrospective. We do not estimate fire under cloud.',
              'Lapisan awan hanya tentang awan, hanya dari MODIS, hanya Kalimantan Tengah, dan bersifat retrospektif. Kami tidak menaksir api di bawah awan.')}</li>
            <li>{tr('District values are approximate and untested.', 'Nilai kabupaten/kota bersifat perkiraan dan belum diuji.')}</li>
            <li>{tr('Months marked provisional use near-real-time data and may change.', 'Bulan bertanda sementara memakai data hampir waktu nyata dan dapat berubah.')}</li>
            <li>{tr('The tool has not been tested in the field with any agency.', 'Alat ini belum diuji di lapangan bersama instansi mana pun.')}</li>
          </ul>
          <div className="ka-method-cta">
            <a className="ka-method-btn ka-method-btn--primary" href={LANDING_ROUTES.season}>{tr('Play the season', 'Putar musim')} <span aria-hidden="true">▶</span></a>
            <a className="ka-method-btn" href={LANDING_ROUTES.record}>{tr('Open your area’s calendar', 'Buka kalender wilayah Anda')}</a>
            <a className="ka-method-btn" href={LANDING_ROUTES.story}>{tr('Back to the story', 'Kembali ke cerita')}</a>
          </div>
        </Section>
      </div>
    </div>
  );
}

export default Method;
