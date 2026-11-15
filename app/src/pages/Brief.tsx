// KalenderApi (new file, not from Fire Harmony): the printable brief (#/brief?aoi=<aoi_id>), one A4 page for a
// district fire officer (BPBD kabupaten), a Manggala Agni patrol planner or a peat restoration team. English by
// default, Bahasa Indonesia with the switch or `&lang=id` (lib/lang.ts).
// It is mounted outside the app shell (no header, no menu), reads the same bundle as the Indonesia record
// (public/ss-data/, with the districts of ss-data/districts/ when they are built) and the ka-data files the app
// already holds. Every number is computed in lib/brief.ts and lib/record.ts from those files; a section whose data
// is not there is left out, and each section names its source.
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  KALTENG, SEASON_YEARS, SENSOR_NAME, getJson, isProvisional, loadDistricts, loadIndex, loadMonthly, sensorRatio, settle, shortVersion,
  type AoiEntry, type DistrictIndex, type Load, type MonthRow, type RecordIndex,
} from '../lib/record';
import {
  LOCKED_YEAR, areaName, blindCount, compact, dateWords, firstKey, hasVisibility, isLockedArea, latestMonth, listWords,
  lockedMonths, monthYear, monthlyMedians, num, num1, peakMonths, readBlindRule, reportedPairs, resolveArea, seasonBlind,
  seasonCount, times, worstYears,
  type BlindRule, type BriefArea, type MonthMedian, type ReportedFile, type SeasonBlind, type VisFile,
} from '../lib/brief';
import { monthName, useLang, useTr, type Lang } from '../lib/lang';
import { LangToggle } from '../components/LangToggle';
import '../styles/brief.css';

const BASE = import.meta.env.BASE_URL;

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
const readHash = () => window.location.hash;
const aoiOf = (hash: string) => new URLSearchParams(hash.split('?')[1] ?? '').get('aoi');

function useLoad<T>(make: (() => Promise<T>) | null, deps: unknown[]): Load<T> | null {
  const [load, setLoad] = useState<Load<T> | null>(make ? { state: 'loading' } : null);
  useEffect(() => {
    if (!make) { setLoad(null); return undefined; }
    let live = true;
    setLoad({ state: 'loading' });
    settle(make(), (l) => { if (live) setLoad(l); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return load;
}

/** An optional file: its content, or null when it is not there or cannot be read (its section is then left out). */
function useOptional<T>(url: string | null, read: (raw: unknown) => T | null): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    setValue(null);
    if (!url) return undefined;
    let live = true;
    getJson<unknown>(url).then((raw) => { if (live) setValue(read(raw)); }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return value;
}

const asVis = (raw: unknown): VisFile | null => {
  const f = raw as Partial<VisFile> | null;
  return f && Array.isArray(f.districts) && Array.isArray(f.days) ? f as VisFile : null;
};
const asReported = (raw: unknown): ReportedFile | null => {
  const f = raw as Partial<ReportedFile> | null;
  return f && Array.isArray(f.years) ? f as ReportedFile : null;
};

/** The visibility files of the built seasons (ka-data/visibility_kalteng_<year>.json): the ones that load. */
function useSeasons(enabled: boolean, years: number[]): VisFile[] {
  const [files, setFiles] = useState<VisFile[]>([]);
  const key = enabled ? years.join(',') : '';
  useEffect(() => {
    if (!key) { setFiles([]); return undefined; }
    let live = true;
    void Promise.all(key.split(',').map((y) => getJson<unknown>(`${BASE}ka-data/visibility_kalteng_${y}.json`).then(asVis).catch(() => null)))
      .then((all) => { if (live) setFiles(all.filter((f): f is VisFile => f !== null)); });
    return () => { live = false; };
  }, [key]);
  return files;
}

/** "1 Aug – 31 Oct" from the first and last day of a season file. */
function seasonDays(s: SeasonBlind, lang: Lang): string {
  const d = (iso: string) => `${Number(iso.slice(8, 10))} ${monthName(Number(iso.slice(5, 7)), lang, 'short')}`;
  return `${d(s.from)} – ${d(s.to)}`;
}

export function Brief() {
  const tr = useTr();
  const lang = useLang();
  const hash = useSyncExternalStore(subscribeHash, readHash);
  const aoiId = aoiOf(hash);

  const index = useLoad<RecordIndex>(loadIndex, []);
  const districts = useLoad<DistrictIndex>(loadDistricts, []);
  const idx = index?.state === 'ok' ? index.data : null;
  const dist = districts?.state === 'ok' ? districts.data : null;
  const area = useMemo(() => (idx ? resolveArea(aoiId, idx, dist) : null), [idx, dist, aoiId]);
  const monthly = useLoad<MonthRow[]>(area ? () => loadMonthly(area.aoi) : null, [area?.aoi.aoi_id]);

  const vis = area ? hasVisibility(area) : false;
  const rule = useOptional<BlindRule>(vis ? `${BASE}ka-data/blind_rule_kalteng.json` : null, readBlindRule);
  // the built seasons: the ones the record page knows, and the ones blind_rule_kalteng.json was counted from
  const seasonYears = useMemo(
    () => [...new Set<number>([...SEASON_YEARS, ...(rule?.bySeason.map((s) => s.year) ?? [])])].sort((a, b) => a - b),
    [rule],
  );
  const seasons = useSeasons(vis, seasonYears);
  const reported = useOptional(area?.aoi.aoi_id === KALTENG ? `${BASE}ka-data/reported_kalteng.json` : null, asReported);

  const name = area ? (lang === 'id' ? area.name : area.nameEn) : null;
  useEffect(() => {
    document.title = name ? tr(`Fire brief: ${name} · KalenderApi`, `Ringkasan kebakaran ${name} · KalenderApi`) : tr('Fire brief · KalenderApi', 'Ringkasan kebakaran · KalenderApi');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, lang]);

  const recordHref = `#/record${area ? `?aoi=${encodeURIComponent(area.aoi.aoi_id)}` : ''}`;
  const tools = (
    <div className="ka-brief-tools">
      <a className="ka-brief-back" href={recordHref}>← {name ? tr(`Record of ${name}`, `Catatan ${name}`) : tr('Indonesia record', 'Rekaman Indonesia')}</a>
      {idx ? <AreaPicker index={idx} districts={dist} value={area?.aoi.aoi_id ?? ''} /> : null}
      <LangToggle />
      <button type="button" className="ka-brief-print" onClick={() => window.print()} disabled={monthly?.state !== 'ok'}>
        {tr('Print / save as PDF', 'Cetak / simpan PDF')}
      </button>
    </div>
  );

  const check = tr('Check the internet connection, then reload the page.', 'Periksa sambungan internet, lalu muat ulang halaman.');
  let body: ReactNode;
  if (!index || index.state === 'loading') body = <Status>{tr('Loading the data…', 'Memuat data…')}</Status>;
  else if (index.state === 'missing') {
    body = <Status>{tr('The record is not built yet. No number is shown until its data is in.', 'Data catatan belum dibangun. Tidak ada angka yang ditampilkan sebelum datanya ada.')}</Status>;
  } else if (index.state === 'error') {
    body = <Status alert>{tr(`The data could not be loaded (${index.message}).`, `Data tidak bisa dimuat (${index.message}).`)} {check}</Status>;
  } else if (!area) {
    body = aoiId && districts?.state === 'loading' ? <Status>{tr('Loading the list of districts…', 'Memuat daftar kabupaten…')}</Status> : (
      <Status alert>
        {tr(`The area “${aoiId}” is not in the data`, `Wilayah “${aoiId}” tidak ada dalam data`)}
        {districts?.state === 'missing' ? tr(' (the district data is not built yet)', ' (data kabupaten belum dibangun)') : ''}.{' '}
        <a href={`#/brief?aoi=${KALTENG}`}>{tr('Open the brief of Central Kalimantan', 'Buka ringkasan Kalimantan Tengah')}</a>.
      </Status>
    );
  } else if (!monthly || monthly.state === 'loading') {
    body = <Status>{tr(`Loading the record of ${name}…`, `Memuat catatan ${name}…`)}</Status>;
  } else if (monthly.state === 'missing') {
    body = <Status>{tr(`The monthly record of ${name} is not built yet.`, `Catatan bulanan ${name} belum dibangun.`)}</Status>;
  } else if (monthly.state === 'error') {
    body = <Status alert>{tr(`The record of ${name} could not be loaded (${monthly.message}).`, `Catatan ${name} tidak bisa dimuat (${monthly.message}).`)} {check}</Status>;
  } else {
    body = (
      <Sheet area={area} idx={idx!} dist={dist} rows={monthly.data} rule={rule} reported={reported}
        seasons={seasons} recordHref={recordHref} />
    );
  }

  return (
    <main className="ka-brief" lang={lang}>
      {tools}
      {body}
    </main>
  );
}

function Status({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <p className="ka-brief-status" role={alert ? 'alert' : 'status'}>{children}</p>;
}

/** The area picker (screen only): the main index, then the districts by province (Central Kalimantan's first). */
function AreaPicker({ index, districts, value }: { index: RecordIndex; districts: DistrictIndex | null; value: string }) {
  const tr = useTr();
  const lang = useLang();
  const groups = useMemo(() => {
    const byName = (a: AoiEntry, b: AoiEntry) => areaName(a, lang).localeCompare(areaName(b, lang));
    const out: { label: string; items: AoiEntry[] }[] = [
      { label: lang === 'id' ? 'Indonesia dan wilayah pulau' : 'Indonesia and island regions', items: index.aois.filter((a) => a.level !== 'province') },
      { label: lang === 'id' ? 'Provinsi' : 'Provinces', items: index.aois.filter((a) => a.level === 'province').sort(byName) },
    ];
    const byProv = new Map<string, AoiEntry[]>();
    for (const d of districts?.districts ?? []) {
      const p = d.province ?? '';
      byProv.set(p, [...(byProv.get(p) ?? []), d]);
    }
    const first = 'Kalimantan Tengah';
    const provs = [...byProv.keys()].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
    for (const p of provs) {
      out.push({ label: `${lang === 'id' ? 'Kabupaten/kota' : 'Districts'}${p ? `: ${p}` : ''}`, items: byProv.get(p)!.sort(byName) });
    }
    return out.filter((g) => g.items.length);
  }, [index, districts, lang]);
  return (
    <label className="ka-brief-picker">
      <span>{tr('Area', 'Wilayah')}</span>
      <select value={value} onChange={(e) => { window.location.hash = `#/brief?aoi=${encodeURIComponent(e.target.value)}`; }}>
        {value === '' ? <option value="">{tr('Pick an area', 'Pilih wilayah')}</option> : null}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((a) => <option key={a.aoi_id} value={a.aoi_id}>{areaName(a, lang)}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

interface SheetProps {
  area: BriefArea; idx: RecordIndex; dist: DistrictIndex | null; rows: MonthRow[];
  seasons: VisFile[]; rule: BlindRule | null; reported: ReportedFile | null; recordHref: string;
}

function Sheet({ area, idx, dist, rows, seasons, rule, reported, recordHref }: SheetProps) {
  const tr = useTr();
  const lang = useLang();
  const n = (x: number) => (Math.abs(x) < 10 && !Number.isInteger(x) ? num1(x, lang) : num(x, lang));
  const name = lang === 'id' ? area.name : area.nameEn;
  const province = lang === 'id' ? area.province : area.provinceEn;
  const month = (m: number) => monthName(m, lang, 'long');

  const locked = isLockedArea(area);
  const lockedList = lockedMonths(area);
  const baseline = (area.isDistrict ? (dist as (DistrictIndex & { baseline_period?: [number, number] }) | null)?.baseline_period : undefined) ?? idx.baseline_period ?? null;
  const medians = useMemo(() => monthlyMedians(rows), [rows]);
  const peaks = useMemo(() => (medians ? peakMonths(medians) : []), [medians]);
  const worst = useMemo(() => worstYears(rows, 3), [rows]);
  const latest = useMemo(() => latestMonth(rows, locked), [rows, locked]);
  const first = useMemo(() => firstKey(rows), [rows]);
  // the VIIRS to MODIS Aqua ratio of the record page (its "jump" tile), for the areas of the main index only: a
  // district has no conversion of its own
  const cal = idx.calibration_window ?? null;
  const ratio = useMemo(() => (!area.isDistrict && cal ? sensorRatio(rows, cal) : null), [rows, area.isDistrict, cal]);

  const districtName = area.isDistrict ? area.name : null;
  // each built season: the share with no cloud-free look (the 2019 share is the one "Blind zeros by district" shows),
  // and the count of district-days above the threshold (blind_rule_kalteng.json), which is never shown for the 2019
  // season: such a count is not a number the app already shows for the locked months
  const blind = hasVisibility(area) ? seasons.flatMap((f) => {
    const own = seasonBlind(f, districtName);
    if (!own) return [];
    const m0 = Number(own.from.slice(5, 7)), m1 = Number(own.to.slice(5, 7));
    return [{
      own,
      days: rule && !(locked && own.year === LOCKED_YEAR) ? seasonCount(rule, own.year, districtName) : null,
      // the record marks the season's months as provisional (near-real-time): so is the season
      provisional: rows.some((r) => r.year === own.year && r.month >= m0 && r.month <= m1 && isProvisional(r)),
    }];
  }).sort((a, b) => a.own.year - b.own.year) : [];
  const anyProvisional = blind.some((b) => b.provisional);
  // the months of the latest month's calendar month that are held back (they are not in its rank)
  const heldSame = latest ? lockedList.filter((k) => k.slice(5, 7) === latest.verdict.key.slice(5, 7)) : [];
  const count = rule && blind.length ? blindCount(rule, districtName, locked ? [LOCKED_YEAR] : []) : null;
  const anyDays = blind.some((b) => b.days);
  const sameSpan = blind.every((b) => b.own.from.slice(5) === blind[0]!.own.from.slice(5) && b.own.to.slice(5) === blind[0]!.own.to.slice(5));
  const halfPct = rule?.threshold != null ? n(rule.threshold * 100) : null;
  const pairs = reported && !area.isDistrict ? reportedPairs(reported, rows) : [];
  const sipongi = reported?.sources?.find((s) => s.id === 'sipongi_luas');
  const read = dateWords(reported?.accessed, lang);

  const version = shortVersion(idx.data_version);
  const built = dateWords(idx.generated_at, lang);
  const builtDistricts = area.isDistrict ? dateWords((dist as (DistrictIndex & { generated_at?: string }) | null)?.generated_at, lang) : null;
  const today = dateWords(new Date(), lang);
  const record = tr(
    `our harmonized record${version ? ` (version ${version})` : ''}`,
    `catatan harmonisasi kami${version ? ` (versi ${version})` : ''}`,
  );
  const unit = tr('fire cell-days', 'sel-hari api');
  const latestM = latest ? Number(latest.verdict.key.slice(5, 7)) : 0;

  // the verdict: the latest month against the usual, and the latest counted season's days with no cloud-free look
  // over most of the district (both from numbers the sections below show; a half without data is left out)
  const lastCount = [...blind].reverse().find((b) => b.days) ?? null;
  const provisionalEn = latest?.verdict.provisional ? ' (provisional)' : '';
  const provisionalId = latest?.verdict.provisional ? ' (angka sementara)' : '';
  const verdictMonth = !latest ? null : latest.verdict.ratio != null
    ? tr(
      `${monthYear(latest.verdict.key, lang)} is ${times(latest.verdict.ratio, lang)} times the usual ${month(latestM)}${provisionalEn}.`,
      `${monthYear(latest.verdict.key, lang)} mencapai ${times(latest.verdict.ratio, lang)} kali ${month(latestM)} biasanya${provisionalId}.`,
    )
    : latest.median != null ? tr(
      `${monthYear(latest.verdict.key, lang)} has ${n(latest.verdict.H)} fire cell-days${provisionalEn}; the usual ${month(latestM)} has ${n(latest.median)}.`,
      `${monthYear(latest.verdict.key, lang)} mencatat ${n(latest.verdict.H)} sel-hari api${provisionalId}; ${month(latestM)} biasanya ${n(latest.median)}.`,
    ) : null;
  const verdictZero = !lastCount?.days ? null : districtName
    ? tr(
      `In the ${lastCount.own.year} season${lastCount.provisional ? ' (provisional)' : ''}, ${n(lastCount.days.above)}${lastCount.days.of != null ? ` of ${n(lastCount.days.of)}` : ''} days had no cloud-free look over most of this district.`,
      `Pada musim ${lastCount.own.year}${lastCount.provisional ? ' (sementara)' : ''}, ${n(lastCount.days.above)}${lastCount.days.of != null ? ` dari ${n(lastCount.days.of)}` : ''} hari tidak punya pengamatan bebas awan atas sebagian besar kabupaten ini.`,
    )
    : tr(
      `In the ${lastCount.own.year} season${lastCount.provisional ? ' (provisional)' : ''}, most of a district had no cloud-free look on ${n(lastCount.days.above)}${lastCount.days.of != null ? ` of ${n(lastCount.days.of)}` : ''} district-days.`,
      `Pada musim ${lastCount.own.year}${lastCount.provisional ? ' (sementara)' : ''}, sebagian besar wilayah sebuah kabupaten tidak punya pengamatan bebas awan pada ${n(lastCount.days.above)}${lastCount.days.of != null ? ` dari ${n(lastCount.days.of)}` : ''} hari-kabupaten.`,
    );
  // the addressee: the disaster agency of the district or the province (its Indonesian name in both languages);
  // none for Indonesia or an island region
  const bpbd = area.isDistrict ? (/^kota\s/i.test(area.name) ? `BPBD ${area.name}` : `BPBD Kabupaten ${area.name}`)
    : area.aoi.level === 'province' ? `BPBD Provinsi ${area.name}` : null;
  // for "Why this number?": the first near-real-time month of the record, and the satellite of the latest month
  const firstNrt = rows.find((r) => r.H != null && isProvisional(r));
  const nrtFrom = firstNrt ? monthYear(`${firstNrt.year}-${String(firstNrt.month).padStart(2, '0')}`, lang) : null;
  const sensor = latest?.sensor ? SENSOR_NAME[latest.sensor] ?? latest.sensor : null;
  const dataDate = tr(
    `version ${version ?? ''}${built ? `, built ${built}` : ''}`,
    `versi ${version ?? ''}${built ? `, dibangun ${built}` : ''}`,
  );

  return (
    <article className="ka-brief-sheet">
      <header className="ka-brief-head">
        <p className="ka-brief-eyebrow">{tr('Fire brief for field officers · KalenderApi', 'Ringkasan kebakaran untuk petugas lapangan · KalenderApi')}</p>
        <h1>{name}</h1>
        {area.isDistrict ? (
          <p className="ka-brief-sub">
            {tr(`District (kabupaten or kota)${province ? ` in ${province}` : ''} · approximate values`, `Kabupaten/kota${province ? ` di ${province}` : ''} · nilai perkiraan`)}
          </p>
        ) : null}
        {bpbd ? (
          <p className="ka-brief-for">
            {tr('For: ', 'Untuk: ')}<strong>{bpbd}</strong>
            {tr(' · copy: Manggala Agni, peat restoration team', ' · tembusan: Manggala Agni, tim restorasi gambut')}
          </p>
        ) : null}
        {verdictMonth || verdictZero ? (
          <p className="ka-brief-verdict">{verdictMonth}{verdictMonth && verdictZero ? ' ' : ''}{verdictZero}</p>
        ) : null}
        <dl className="ka-brief-meta">
          {first && latest ? (
            <div><dt>{tr('Period', 'Periode')}</dt><dd>{monthYear(first, lang)} {tr('to', 'sampai')} {monthYear(latest.verdict.key, lang)}</dd></div>
          ) : null}
          {version ? (
            <div>
              <dt>{tr('Data version', 'Versi data')}</dt>
              <dd>{version}{built ? ` (${built})` : ''}{builtDistricts ? tr(`; districts ${builtDistricts}`, `; kabupaten ${builtDistricts}`) : ''}</dd>
            </div>
          ) : null}
          {today ? <div><dt>{tr('Generated', 'Dibuat')}</dt><dd>{today}</dd></div> : null}
        </dl>
        <p className="ka-brief-unit">
          {tr('Unit: ', 'Satuan: ')}<strong>{unit}</strong>
          {tr(
            `: cells of about 1 km with a hotspot on one day, on one scale for MODIS years and VIIRS years (the MODIS Aqua scale).`,
            `: sel sekitar 1 km yang punya hotspot pada satu hari, pada satu skala untuk tahun MODIS dan tahun VIIRS (setara MODIS Aqua).`,
          )}
        </p>
      </header>

      <div className="ka-brief-body">
        {medians ? (
          <section className="ka-brief-sec">
            <h2>{tr('When it usually burns', 'Kapan biasanya terbakar')}</h2>
            <MedianBars medians={medians} peaks={peaks} />
            {peaks.length ? (
              <p>
                <strong>{tr('Peak months: ', 'Bulan puncak: ')}{listWords(peaks.map(month), lang)}.</strong>{' '}
                {tr('Median: ', 'Median: ')}{peaks.map((m) => `${month(m)} ${n(medians[m - 1]!.median)}`).join(', ')} {unit}.
              </p>
            ) : <p>{tr('The median of every month is zero: no peak month can be named.', 'Median setiap bulan adalah nol: tidak ada bulan puncak yang bisa disebut.')}</p>}
            <p className="ka-brief-src">
              {tr(
                `Bars: median of each calendar month${baseline ? `, ${baseline[0]}–${baseline[1]}` : ''}. Peak: the highest median and every month with at least half of it. Source: ${record}.`,
                `Batang: median tiap bulan kalender${baseline ? `, ${baseline[0]}–${baseline[1]}` : ''}. Puncak: median tertinggi dan bulan dengan paling sedikit separuhnya. Sumber: ${record}.`,
              )}
            </p>
          </section>
        ) : null}

        {worst ? (
          <section className="ka-brief-sec">
            <h2>{tr('Worst years', 'Tahun terparah')}</h2>
            <ol className="ka-brief-years">
              {worst.years.map((y) => (
                <li key={y.year}>
                  <span className="ka-brief-year">{y.year}</span>
                  <span className="ka-brief-num">{n(y.H)} <small>{unit}</small></span>
                  {y.estimate || y.provisional ? (
                    <span className="ka-brief-flag">
                      {y.estimate ? tr(
                        `Estimate: converted from VIIRS${!y.noBand && n(y.hi) !== n(y.lo) ? `, 90% range ${n(y.lo)}–${n(y.hi)}` : ''}. `,
                        `Perkiraan: dikonversi dari VIIRS${!y.noBand && n(y.hi) !== n(y.lo) ? `, rentang 90% ${n(y.lo)}–${n(y.hi)}` : ''}. `,
                      ) : ''}
                      {y.provisional ? tr(
                        `Provisional: uses near-real-time data${y.months < 12 ? `, ${y.months} months so far` : ''}; may change.`,
                        `Sementara: memakai data cepat (NRT)${y.months < 12 ? `, baru ${y.months} bulan` : ''}; bisa berubah.`,
                      ) : ''}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {worst.skipped.length ? (
              <p>
                {tr(`Not ranked: ${listWords(worst.skipped.map(String), lang)}. `, `Tidak diperingkat: ${listWords(worst.skipped.map(String), lang)}. `)}
                {lockedList.length ? tr(
                  `${monthYear(lockedList[0]!, lang)} to ${monthYear(lockedList[lockedList.length - 1]!, lang)} is held back for this area, for a test we registered in advance.`,
                  `${monthYear(lockedList[0]!, lang)} sampai ${monthYear(lockedList[lockedList.length - 1]!, lang)} ditahan untuk wilayah ini, untuk uji yang sudah kami daftarkan sebelumnya.`,
                ) : tr('Some of its months have no value.', 'Ada bulan tanpa nilai.')}
              </p>
            ) : null}
            <p className="ka-brief-src">
              {tr(
                `Yearly totals, ${worst.from}–${worst.to}. A year with no note is MODIS Aqua's own count. Source: ${record}.`,
                `Jumlah setahun, ${worst.from}–${worst.to}. Tahun tanpa catatan adalah hitungan MODIS Aqua sendiri. Sumber: ${record}.`,
              )}
            </p>
          </section>
        ) : null}

        {latest ? (
          <section className="ka-brief-sec">
            <h2>{tr('Latest month against the usual', 'Bulan terakhir dibanding biasanya')}</h2>
            <p className="ka-brief-big">
              <span>{monthYear(latest.verdict.key, lang)}</span>
              <strong>{n(latest.verdict.H)} <small>{unit}</small></strong>
            </p>
            <ul className="ka-brief-list">
              {latest.verdict.ratio != null && latest.median != null ? (
                <li>
                  <strong>{times(latest.verdict.ratio, lang)} {tr('times', 'kali')}</strong>{' '}
                  {tr(`the ${month(latestM)} median (${n(latest.median)}): `, `median ${month(latestM)} (${n(latest.median)}): `)}
                  {latest.verdict.ratio > 1 ? tr('above the usual', 'di atas biasanya') : latest.verdict.ratio < 1 ? tr('below the usual', 'di bawah biasanya') : tr('the same as usual', 'sama dengan biasanya')}.
                </li>
              ) : latest.median != null ? (
                <li>{tr(`The ${month(latestM)} median is ${n(latest.median)}, so there is no ratio to give.`, `Median ${month(latestM)} adalah ${n(latest.median)}, jadi tidak ada perbandingan kali lipat.`)}</li>
              ) : null}
              {latest.verdict.H > 0 ? (
                <li>
                  {tr('Rank ', 'Peringkat ')}<strong>{tr(`${latest.verdict.rank} of ${latest.verdict.of}`, `ke-${latest.verdict.rank} dari ${latest.verdict.of}`)}</strong>{' '}
                  {tr(
                    `among every ${month(latestM)} on record (${latest.firstYear}–${latest.lastYear}); rank 1 is the most fire.`,
                    `di antara semua bulan ${month(latestM)} yang tercatat (${latest.firstYear}–${latest.lastYear}); peringkat 1 berarti paling banyak api.`,
                  )}
                  {heldSame.length ? tr(
                    ` ${listWords(heldSame.map((k) => monthYear(k, lang)), lang)} is left out: held back for a test we registered in advance.`,
                    ` ${listWords(heldSame.map((k) => monthYear(k, lang)), lang)} tidak ikut: ditahan untuk uji yang sudah kami daftarkan sebelumnya.`,
                  ) : ''}
                </li>
              ) : (
                <li>{tr('No fire cell-days this month, so it has no rank: a rank among zeros says nothing.', 'Tidak ada sel-hari api bulan ini, jadi tidak diberi peringkat: peringkat di antara angka nol tidak berarti.')}</li>
              )}
              {latest.estimate && latest.verdict.lo != null && latest.verdict.hi != null && n(latest.verdict.hi) !== n(latest.verdict.lo) ? (
                <li>
                  {tr(
                    `Estimate (converted from VIIRS): 90% range ${n(latest.verdict.lo)}–${n(latest.verdict.hi)}.`,
                    `Perkiraan (dikonversi dari VIIRS): rentang 90% ${n(latest.verdict.lo)}–${n(latest.verdict.hi)}.`,
                  )}
                </li>
              ) : null}
              {latest.verdict.provisional ? (
                <li><strong>{tr('Provisional:', 'Angka sementara:')}</strong> {tr('uses near-real-time data and may change.', 'memakai data cepat (NRT) dan bisa berubah.')}</li>
              ) : null}
            </ul>
            <p className="ka-brief-src">
              {tr(
                `The latest complete month, against the median of the same month${baseline ? ` (${baseline[0]}–${baseline[1]})` : ''}. Source: ${record}.`,
                `Bulan lengkap terakhir, dibanding median bulan yang sama${baseline ? ` (${baseline[0]}–${baseline[1]})` : ''}. Sumber: ${record}.`,
              )}
            </p>
          </section>
        ) : null}

        {blind.length ? (
          <section className="ka-brief-sec ka-brief-zero">
            <h2>{tr('Can a zero be trusted?', 'Bisakah angka nol dipercaya?')}</h2>
            <p>
              <strong>{tr('The decision this supports: when to trust a quiet day.', 'Keputusan yang dibantu: kapan hari yang sepi bisa dipercaya.')}</strong>{' '}
              {tr(
                'A hotspot map alone cannot tell you this: a zero only counts where a satellite had a cloud-free look at the ground.',
                'Peta hotspot saja tidak bisa menjawabnya: angka nol baru berarti jika satelit punya pengamatan bebas awan atas tanahnya.',
              )}
            </p>
            <table className="ka-brief-table">
              <thead>
                <tr>
                  <th scope="col">{tr('Season', 'Musim')}</th>
                  <th scope="col">{tr('No cloud-free look', 'Tanpa pengamatan bebas awan')}</th>
                  {anyDays ? (
                    <th scope="col">
                      {districtName
                        ? tr(`Days above ${halfPct ?? '50'}%`, `Hari di atas ${halfPct ?? '50'}%`)
                        : tr(`District-days above ${halfPct ?? '50'}%`, `Hari-kabupaten di atas ${halfPct ?? '50'}%`)}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {blind.map(({ own, days, provisional }) => (
                  <tr key={own.year}>
                    <th scope="row">{sameSpan ? own.year : `${seasonDays(own, lang)} ${own.year}`}{provisional ? ' *' : ''}</th>
                    <td>{num1(own.pct, lang)}%</td>
                    {anyDays ? (
                      <td>{days ? `${n(days.above)}${days.of != null ? ` ${tr('of', 'dari')} ${n(days.of)}` : ''}` : tr('not counted', 'tidak dihitung')}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ka-brief-src">
              {tr(
                `${sameSpan ? `Season: ${seasonDays(blind[0]!.own, lang)}. ` : ''}Share: no-fire cell-days with no cloud-free look from Terra or Aqua.`,
                `${sameSpan ? `Musim: ${seasonDays(blind[0]!.own, lang)}. ` : ''}Bagian: sel-hari tanpa api yang tidak punya pengamatan bebas awan dari Terra maupun Aqua.`,
              )}
              {anyDays && halfPct ? tr(
                ` Above ${halfPct}%: days when more than ${halfPct}% of a district's no-fire cells had no cloud-free look.`,
                ` Di atas ${halfPct}%: hari ketika lebih dari ${halfPct}% sel tanpa api sebuah kabupaten tidak punya pengamatan bebas awan.`,
              ) : ''}
              {anyDays && locked && blind.some((b) => b.own.year === LOCKED_YEAR && !b.days) ? tr(
                ` ${LOCKED_YEAR} is not counted: held back for a test we registered in advance.`,
                ` ${LOCKED_YEAR} tidak dihitung: ditahan untuk uji yang sudah kami daftarkan.`,
              ) : ''}
              {anyProvisional ? tr(' * Provisional.', ' * Sementara.') : ''}
              {tr(
                ` Source: NASA MODIS daily FireMask (Terra and Aqua); counting rule in ka-data/${count ? 'blind_rule_kalteng.json' : 'visibility_kalteng_(year).json'}.`,
                ` Sumber: NASA MODIS FireMask harian (Terra dan Aqua); aturan hitung di ka-data/${count ? 'blind_rule_kalteng.json' : 'visibility_kalteng_(tahun).json'}.`,
              )}
            </p>
            <p className="ka-brief-rule">
              <strong>{tr('Reporting rule:', 'Aturan lapor:')}</strong>{' '}
              {tr(
                'do not report “no hotspots”, or stand a crew down, on a zero from a day when most of the district had no cloud-free look.',
                'jangan laporkan “tidak ada hotspot”, atau menarik regu, atas angka nol dari hari ketika sebagian besar kabupaten tidak punya pengamatan bebas awan.',
              )}
            </p>
            {count ? (
              <p>
                {tr(
                  `Over the ${count.seasons.length} ${count.seasons.length === 1 ? 'season' : 'seasons'} counted, such a day came up `,
                  `Selama ${count.seasons.length} musim yang dihitung, hari seperti itu muncul `,
                )}
                <strong>{n(count.above)} {tr(count.above === 1 ? 'time' : 'times', 'kali')}</strong>
                {count.of != null
                  ? (districtName ? tr(` in ${n(count.of)} days`, ` dari ${n(count.of)} hari`) : tr(` in ${n(count.of)} district-days`, ` dari ${n(count.of)} hari-kabupaten`))
                  : ''}
                {districtName ? tr(` in ${name}`, ` di ${name}`) : tr(` across ${name}`, ` di seluruh ${name}`)}.
              </p>
            ) : null}
            <ul className="ka-brief-list">
              <li>{tr('Thick smoke is usually not flagged as cloud by the MODIS fire mask, so the true unseen share is higher.', 'Asap tebal biasanya tidak ditandai sebagai awan oleh masker api MODIS, jadi bagian yang sebenarnya tidak terlihat lebih besar.')}</li>
              <li>{tr('This layer looks back at past seasons. It is not an early warning.', 'Lapisan ini melihat ke belakang, ke musim yang sudah lewat. Ini bukan peringatan dini.')}</li>
              <li>{tr('These numbers do not say there was fire under cloud. They say which part had no cloud-free look.', 'Angka ini tidak mengatakan ada api di bawah awan. Angka ini hanya mengatakan bagian mana yang tidak punya pengamatan bebas awan.')}</li>
            </ul>
          </section>
        ) : null}

        {pairs.length ? (
          <section className="ka-brief-sec">
            <h2>{tr('Official figures (SiPongi)', 'Angka resmi (SiPongi)')}</h2>
            <p>
              {tr(
                'Two different measures, side by side. SiPongi: burned area in hectares, from Landsat images and ground checks. This record: fire cell-days, a count of satellite detections. Do not divide one by the other or treat them as the same.',
                'Dua ukuran yang berbeda, berdampingan. SiPongi: luas terbakar dalam hektare, dari citra Landsat dan cek lapangan. Catatan ini: sel-hari api, hitungan deteksi satelit. Jangan dibagi atau disamakan.',
              )}
            </p>
            <table className="ka-brief-table">
              <thead>
                <tr>
                  <th scope="col">{tr('Year', 'Tahun')}</th>
                  <th scope="col">{tr('SiPongi burned area (ha)', 'Luas terbakar SiPongi (ha)')}</th>
                  <th scope="col">{tr('Fire cell-days (this record)', 'Sel-hari api (catatan ini)')}</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr key={p.year}>
                    <th scope="row">{p.year}</th>
                    <td>{n(p.ha)}</td>
                    <td>{p.cellDays == null ? '–' : `${n(p.cellDays)}${p.provisional ? tr(' (provisional)', ' (sementara)') : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ka-brief-src">
              {tr('Source: SIPONGI KEMENHUT, Indikasi Luas Kebakaran', 'Sumber: SIPONGI KEMENHUT, Indikasi Luas Kebakaran')}
              {sipongi?.url ? ` (${sipongi.url.replace(/^https?:\/\//, '').split('/')[0]})` : ''}
              {read ? tr(`, read ${read}`, `, dibaca ${read}`) : ''}
              {tr(
                `; hectares rounded, years with no verified figure not shown. Fire cell-days: ${record}.`,
                `; hektare dibulatkan, tahun tanpa angka terverifikasi tidak ditampilkan. Sel-hari api: ${record}.`,
              )}
            </p>
          </section>
        ) : null}

        <section className="ka-brief-sec">
          <h2>{tr('How to read this, and its limits', 'Cara membaca dan batasan')}</h2>
          <ul className="ka-brief-list">
            <li>
              <strong>{tr('Fire cell-days are not burned area.', 'Sel-hari api bukan luas terbakar.')}</strong>{' '}
              {tr(
                'One fire cell-day is one 0.01° cell (about 1 km) with a hotspot on one date, counted per satellite and per day or night pass.',
                'Satu sel-hari api adalah satu sel 0,01° (sekitar 1 km) yang punya hotspot pada satu tanggal, dihitung per satelit dan per lintasan siang atau malam.',
              )}
            </li>
            <li>
              <strong>{tr('Conversion.', 'Konversi.')}</strong>{' '}
              {ratio ? tr(
                `In the same months (${ratio.from}–${ratio.to}), VIIRS counted ${num1(ratio.ratio, lang)} fire cell-days for each MODIS Aqua one, so VIIRS counts are converted down. `,
                `Pada bulan yang sama (${ratio.from}–${ratio.to}), VIIRS mencatat ${num1(ratio.ratio, lang)} sel-hari api untuk tiap satu milik MODIS Aqua, jadi hitungan VIIRS dikonversi turun. `,
              ) : tr('VIIRS counts are converted to the MODIS Aqua scale. ', 'Hitungan VIIRS dikonversi ke skala MODIS Aqua. ')}
              {tr('A converted number is an estimate; its 90% range is written beside it.', 'Angka hasil konversi adalah perkiraan; rentang 90%-nya ditulis di sampingnya.')}
            </li>
            {area.isDistrict ? (
              <li>
                <strong>{tr('District values are approximate.', 'Nilai kabupaten adalah perkiraan.')}</strong>{' '}
                {tr(
                  'Each district shares its province\'s monthly conversion; it has no harmonization of its own. Values near district borders are less certain.',
                  'Tiap kabupaten memakai konversi bulanan provinsinya, bukan harmonisasi sendiri. Dekat batas kabupaten nilainya kurang pasti.',
                )}
              </li>
            ) : null}
            {area.lowData ? (
              <li>
                <strong>{tr('Little data.', 'Data sedikit.')}</strong>{' '}
                {area.aoi.mean_cell_days_per_year != null ? tr(
                  `This district averages only ${n(area.aoi.mean_cell_days_per_year)} fire cell-days a year. `,
                  `Rata-rata hanya ${n(area.aoi.mean_cell_days_per_year)} sel-hari api setahun di wilayah ini. `,
                ) : ''}
                {tr('Medians, ratios and ranks change easily when the numbers are this small.', 'Median, kali lipat dan peringkat mudah berubah karena angkanya kecil.')}
              </li>
            ) : null}
            <li>
              <strong>{tr('Not an official product.', 'Bukan produk resmi.')}</strong>{' '}
              {tr('For official figures use SiPongi (Ministry of Forestry).', 'Untuk angka resmi, gunakan SiPongi (Kementerian Kehutanan).')}
            </li>
            <li>
              <strong>{tr('No forecast.', 'Tidak ada prakiraan.')}</strong>{' '}
              {tr('This page only holds what is already on record.', 'Halaman ini hanya memuat apa yang sudah tercatat.')}
            </li>
          </ul>
          <p className="ka-brief-src">
            {tr(
              `Source: the unit and the calibration years are in this record's index.json${area.isDistrict ? '; the district share-out is in districts/index.json' : ''}.`,
              `Sumber: satuan dan tahun kalibrasi ada di index.json catatan ini${area.isDistrict ? '; cara pembagian kabupaten ada di districts/index.json' : ''}.`,
            )}
          </p>
        </section>

        <section className="ka-brief-sec ka-brief-why">
          <h2>{tr('Why this number? Sources', 'Mengapa angka ini? Sumber')}</h2>
          <dl className="ka-brief-whys">
            <div>
              <dt>{tr('Fire cell-days', 'Sel-hari api')}</dt>
              <dd>
                <b>{tr('Evidence: ', 'Bukti: ')}</b>
                {tr(
                  `NASA FIRMS hotspots, MODIS C6.1 and VIIRS 375 m${latest && sensor ? `; ${monthYear(latest.verdict.key, lang)} by ${sensor}` : ''}. `,
                  `hotspot NASA FIRMS, MODIS C6.1 dan VIIRS 375 m${latest && sensor ? `; ${monthYear(latest.verdict.key, lang)} oleh ${sensor}` : ''}. `,
                )}
                <b>{tr('Assumption: ', 'Asumsi: ')}</b>
                {tr(
                  `our harmonization: the MODIS Aqua to VIIRS ratio of the same months${cal ? ` (${cal[0]}–${cal[1]})` : ''} puts VIIRS counts on the MODIS Aqua scale, with a 90% range${area.isDistrict ? '; a district shares its province\'s ratio' : ''}. `,
                  `harmonisasi kami: rasio MODIS Aqua terhadap VIIRS pada bulan yang sama${cal ? ` (${cal[0]}–${cal[1]})` : ''} menaruh hitungan VIIRS pada skala MODIS Aqua, dengan rentang 90%${area.isDistrict ? '; kabupaten memakai rasio provinsinya' : ''}. `,
                )}
                <b>{tr('Data: ', 'Data: ')}</b>
                {dataDate}{nrtFrom ? tr(`; near-real-time from ${nrtFrom}`, `; data cepat (NRT) sejak ${nrtFrom}`) : ''}.
              </dd>
            </div>
            {latest && baseline ? (
              <div>
                <dt>{tr('Times the usual, and the rank', 'Kali lipat dari biasanya, dan peringkat')}</dt>
                <dd>
                  <b>{tr('Evidence: ', 'Bukti: ')}</b>
                  {tr(
                    `every ${month(latestM)} of the same record, ${latest.firstYear}–${latest.lastYear}. `,
                    `semua bulan ${month(latestM)} dalam catatan yang sama, ${latest.firstYear}–${latest.lastYear}. `,
                  )}
                  <b>{tr('Assumption: ', 'Asumsi: ')}</b>
                  {tr(
                    `“usual” is the median of that month, ${baseline[0]}–${baseline[1]}. `,
                    `“biasanya” adalah median bulan itu, ${baseline[0]}–${baseline[1]}. `,
                  )}
                  <b>{tr('Data: ', 'Data: ')}</b>{tr('the same version.', 'versi yang sama.')}
                </dd>
              </div>
            ) : null}
            {blind.length ? (
              <div>
                <dt>{tr('No cloud-free look', 'Tanpa pengamatan bebas awan')}</dt>
                <dd>
                  <b>{tr('Evidence: ', 'Bukti: ')}</b>
                  {tr(
                    'NASA MODIS daily FireMask, MOD14A1 (Terra) and MYD14A1 (Aqua) C6.1, 0.01° cells. ',
                    'NASA MODIS FireMask harian, MOD14A1 (Terra) dan MYD14A1 (Aqua) C6.1, sel 0,01°. ',
                  )}
                  <b>{tr('Assumption: ', 'Asumsi: ')}</b>
                  {tr('cloud only; thick smoke is usually not flagged as cloud. ', 'hanya awan; asap tebal biasanya tidak ditandai sebagai awan. ')}
                  <b>{tr('Data: ', 'Data: ')}</b>
                  {tr(
                    `seasons ${blind[0]!.own.year}–${blind[blind.length - 1]!.own.year}${anyProvisional ? ' (the last is provisional)' : ''}.`,
                    `musim ${blind[0]!.own.year}–${blind[blind.length - 1]!.own.year}${anyProvisional ? ' (yang terakhir sementara)' : ''}.`,
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="ka-brief-src ka-brief-url">
            {pairs.length ? tr('Official burned area: SIPONGI KEMENHUT. ', 'Luas terbakar resmi: SIPONGI KEMENHUT. ') : ''}
            {area.isDistrict ? tr('District borders: geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO). ', 'Batas kabupaten: geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO). ') : ''}
            {tr('Full record of this area: ', 'Catatan lengkap wilayah ini: ')}
            <a href={recordHref}>{window.location.origin}{window.location.pathname}{recordHref}</a>
          </p>
        </section>
      </div>

      <p className="ka-brief-foot">
        {tr('KalenderApi · NASA Space Apps Challenge 2026 · not an official product · no forecast', 'KalenderApi · NASA Space Apps Challenge 2026 · bukan produk resmi · tidak memuat prakiraan')}
      </p>
    </article>
  );
}

/** The median of each calendar month as a small bar row; the peak months are drawn solid. */
function MedianBars({ medians, peaks }: { medians: MonthMedian[]; peaks: number[] }) {
  const tr = useTr();
  const lang = useLang();
  const max = Math.max(0, ...medians.map((m) => m.median));
  const all = medians.map((m) => `${monthName(m.month, lang, 'long')} ${num(m.median, lang)}`).join(', ');
  return (
    <div className="ka-brief-bars" role="img" aria-label={tr(`Median fire cell-days of each month: ${all}.`, `Median sel-hari api tiap bulan: ${all}.`)}>
      {medians.map((m) => (
        <div key={m.month} className={`ka-brief-bar${peaks.includes(m.month) ? ' is-peak' : ''}`}>
          <span className="ka-brief-bar-v">{compact(m.median, lang)}</span>
          <span className="ka-brief-bar-t"><i style={{ height: `${max > 0 ? Math.max(1.5, (m.median / max) * 100) : 0}%` }} /></span>
          <span className="ka-brief-bar-m">{monthName(m.month, lang, 'short')}</span>
        </div>
      ))}
    </div>
  );
}
