// KalenderApi (new file): the home panel. The Story's final frame mounts it in its right-hand column (below its
// buttons on a narrow screen), inside the Story's own <aside>, so the root here is a labelled group, not a landmark. It is a plain block that fills its container's width (420 px at most) and scrolls
// with it: find an area, the latest month of the national record with three checks, the yearly record as a small
// chart, and which satellites the record is made of.
// Every number comes at run time from the loaders of pages/landing-data.ts (the ones #/method reads) and the index
// files of lib/record.ts. A card whose file is missing is left out; nothing is filled in. Styles: styles/hub.css.
import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { fmtNumber, locale, monthName, useLang, useTr, type Lang } from '../lib/lang';
import {
  SEAM_YEAR, aoiName, districtAt, loadDistrictShapes, loadDistricts, loadIndex, searchDistricts, settle, ymIndex,
  type AoiEntry, type DistrictIndex, type DistrictShapes, type Load, type RecordIndex,
} from '../lib/record';
import { loadBlindRule, loadLandingData, type BlindRule, type LandingData } from '../pages/landing-data';
import { HUB_CHIP_IDS, chipAreas, matchAreas, recordHref, trendGeom } from '../lib/hub';
import '../styles/hub.css';

const NONE: AoiEntry[] = [];
// the same formats as #/method, so the two pages print the same digits
const signed = (value: number, lang: Lang, digits = 0) => (value >= 0 ? '+' : '−') + fmtNumber(Math.abs(value), lang, digits);
const errPct = (value: number, lang: Lang) => `${fmtNumber(value, lang, value >= 100 ? 0 : 1)}%`;
const shortDate = (iso: string, lang: Lang) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** One file as a Load; `attempt` asks again after a failure. */
function useLoad<T>(make: () => Promise<T>, attempt: number): Load<T> {
  const [got, setGot] = useState<{ attempt: number; load: Load<T> } | null>(null);
  useEffect(() => {
    let live = true;
    settle(make(), (load) => { if (live) setGot({ attempt, load }); });
    return () => { live = false; };
  }, [make, attempt]);
  return got && got.attempt === attempt ? got.load : { state: 'loading' };
}

export function HubPanel() {
  const tr = useTr();
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);
  const idx = useLoad(loadIndex, attempt);
  const dist = useLoad(loadDistricts, attempt);
  const land = useLoad(loadLandingData, attempt);
  const rule = useLoad(loadBlindRule, attempt);
  const data = land.state === 'ok' ? land.data : null;

  return (
    <div className="ka-hub" role="group" aria-label={tr('Find your area, and the record at a glance', 'Cari wilayah Anda, dan ringkasan rekaman')}>
      <FindCard idx={idx} dist={dist} retry={retry} />
      {land.state === 'loading' ? (
        <section className="ka-hub-card ka-hub-wait" role="status">{tr('Loading the national record…', 'Memuat rekaman nasional…')}</section>
      ) : null}
      {land.state === 'error' ? (
        <section className="ka-hub-card ka-hub-fail" role="alert">
          <p>{tr(`The national record could not be loaded (${land.message}).`, `Rekaman nasional tidak dapat dimuat (${land.message}).`)}</p>
          <button type="button" className="ka-hub-link" onClick={retry}>{tr('Try again', 'Coba lagi')}</button>
        </section>
      ) : null}
      {data ? <StatCard data={data} rule={rule} /> : null}
      {data ? <TrendCard data={data} /> : null}
      {data ? <TimeCard data={data} /> : null}
    </div>
  );
}

export default HubPanel;

// ------------------------------------------------------------------------------------------------ find your area

function FindCard({ idx, dist, retry }: { idx: Load<RecordIndex>; dist: Load<DistrictIndex>; retry: () => void }) {
  const tr = useTr();
  const lang = useLang();
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState(false);
  const areas = idx.state === 'ok' ? idx.data.aois : NONE;
  const districts = dist.state === 'ok' ? dist.data.districts : NONE;
  const top = useMemo(() => matchAreas(areas, q, 5), [areas, q]);
  const groups = useMemo(() => searchDistricts(districts, q, 24), [districts, q]);
  const flat = useMemo(() => [...top, ...groups.flatMap((g) => g.items)], [top, groups]);
  const chips = useMemo(() => chipAreas(HUB_CHIP_IDS, [...areas, ...districts]), [areas, districts]);
  const provinces = useMemo(() => areas.filter((a) => a.level === 'province').length, [areas]);

  if (idx.state === 'missing') return null;   // no bundle in this build: nothing to search
  const title = <h2 className="ka-hub-title">{tr('Find your area', 'Cari wilayah Anda')}</h2>;
  if (idx.state === 'loading') {
    return <section className="ka-hub-card ka-hub-find">{title}<p className="ka-hub-wait" role="status">{tr('Loading the list of areas…', 'Memuat daftar wilayah…')}</p></section>;
  }
  if (idx.state === 'error') {
    return (
      <section className="ka-hub-card ka-hub-find">
        {title}
        <div className="ka-hub-fail" role="alert">
          <p>{tr(`The list of areas could not be loaded (${idx.message}).`, `Daftar wilayah tidak dapat dimuat (${idx.message}).`)}</p>
          <button type="button" className="ka-hub-link" onClick={retry}>{tr('Try again', 'Coba lagi')}</button>
        </div>
      </section>
    );
  }

  const go = (aoiId: string) => { window.location.hash = recordHref(aoiId).slice(1); };
  const typed = q.trim().length > 0;
  const show = open && typed;
  const current = flat[active];
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pick = (show ? current : null) ?? flat[0];
    if (pick) go(pick.aoi_id);
    else setOpen(true);   // shows "no match" when something was typed
  };
  const option = (a: AoiEntry) => (
    <button key={a.aoi_id} type="button" role="option" id={`${id}-o-${a.aoi_id}`} tabIndex={-1}
      aria-selected={current?.aoi_id === a.aoi_id} className="ka-hub-opt"
      onPointerEnter={() => setActive(flat.indexOf(a))} onClick={() => go(a.aoi_id)}>
      {aoiName(a, lang)}{a.low_data ? <span className="ka-hub-tag">{tr('low data', 'data sedikit')}</span> : null}
    </button>
  );
  const what = districts.length
    ? tr('Search a province or district…', 'Cari provinsi atau kabupaten/kota…')
    : tr('Search a province…', 'Cari provinsi…');

  return (
    <section className="ka-hub-card ka-hub-find">
      {title}
      <form className="ka-hub-search" role="search" onSubmit={submit}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
        <label className="ka-hub-vh" htmlFor={`${id}-q`}>{what}</label>
        <input id={`${id}-q`} type="search" autoComplete="off" spellCheck={false} placeholder={what}
          role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={show && current ? `${id}-o-${current.aoi_id}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        <button type="submit" className="ka-hub-go" aria-label={tr('Open the record of the first match', 'Buka rekaman hasil pertama')}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {show ? (
          <div className="ka-hub-list" id={`${id}-list`} role="listbox" aria-label={tr('Matching areas', 'Wilayah yang cocok')}>
            {top.length ? (
              <div role="group" aria-label={tr('Country and provinces', 'Negara dan provinsi')}>
                <p className="ka-hub-list-head" aria-hidden="true">{tr('Country and provinces', 'Negara dan provinsi')}</p>
                {top.map(option)}
              </div>
            ) : null}
            {groups.map((g) => (
              <div key={g.province} role="group" aria-label={g.province}>
                <p className="ka-hub-list-head" aria-hidden="true">{g.province}</p>
                {g.items.map(option)}
              </div>
            ))}
            {!flat.length ? (
              <p className="ka-hub-list-none" role="status">
                {tr(`No province or district matches "${q.trim()}".`, `Tidak ada provinsi atau kabupaten/kota yang cocok dengan "${q.trim()}".`)}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
      {districts.length ? (
        <>
          <button type="button" className="ka-hub-link" aria-expanded={coords} aria-controls={`${id}-ll`} onClick={() => setCoords((v) => !v)}>
            {tr('Enter latitude / longitude', 'Masukkan lintang / bujur')}
          </button>
          {coords ? <LatLon id={`${id}-ll`} offered={districts} onPick={go} /> : null}
        </>
      ) : null}
      {chips.length ? (
        <>
          <p className="ka-hub-sub">{tr('Quick regions', 'Wilayah cepat')}</p>
          <div className="ka-hub-chips">
            {chips.map((a) => <a key={a.aoi_id} className="ka-hub-chip" href={recordHref(a.aoi_id)}>{aoiName(a, lang)}</a>)}
          </div>
        </>
      ) : null}
      <p className="ka-hub-src">
        {districts.length
          ? tr(`Opens the area’s record: ${fmtNumber(provinces, lang)} provinces, ${fmtNumber(districts.length, lang)} districts (a district’s record is approximate).`,
            `Membuka rekaman wilayah: ${fmtNumber(provinces, lang)} provinsi, ${fmtNumber(districts.length, lang)} kabupaten/kota (rekaman kabupaten/kota bersifat perkiraan).`)
          : tr(`Opens the area’s record: ${fmtNumber(provinces, lang)} provinces.`, `Membuka rekaman wilayah: ${fmtNumber(provinces, lang)} provinsi.`)}
      </p>
    </section>
  );
}

/** The district whose outline holds a point (districts.geojson, tested in the browser), as the record page does. */
function LatLon({ id, offered, onPick }: { id: string; offered: AoiEntry[]; onPick: (aoiId: string) => void }) {
  const tr = useTr();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const find = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat), lo = Number(lon);
    if (lat.trim() === '' || lon.trim() === '' || !Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      setMsg({ tone: 'error', text: tr('Enter a latitude from -90 to 90 and a longitude from -180 to 180, in decimal degrees (south is negative).',
        'Masukkan lintang dari -90 sampai 90 dan bujur dari -180 sampai 180, dalam derajat desimal (selatan bernilai negatif).') });
      return;
    }
    setBusy(true);
    setMsg({ tone: 'info', text: tr('Loading the district outlines…', 'Memuat batas kabupaten/kota…') });
    settle(loadDistrictShapes(), (l: Load<DistrictShapes>) => {
      setBusy(false);
      if (l.state === 'missing') {
        setMsg({ tone: 'info', text: tr('The district outlines file is not in this build. Use the search box.', 'Berkas batas kabupaten/kota belum ada dalam versi ini. Gunakan kotak pencarian.') });
      } else if (l.state === 'error') {
        setMsg({ tone: 'error', text: tr(`The district outlines could not be loaded (${l.message}). Try again.`, `Batas kabupaten/kota tidak dapat dimuat (${l.message}). Coba lagi.`) });
      } else if (l.state === 'ok') {
        const hit = districtAt(lo, la, l.data);
        if (hit && offered.some((d) => d.aoi_id === hit)) { onPick(hit); return; }
        setMsg({ tone: 'info', text: hit
          ? tr(`${la}, ${lo} is in a district that has no record in this build.`, `${la}, ${lo} berada di kabupaten/kota yang tidak memiliki rekaman dalam versi ini.`)
          : tr(`No district holds ${la}, ${lo}: the point is at sea or outside Indonesia.`, `Tidak ada kabupaten/kota yang memuat ${la}, ${lo}: titik berada di laut atau di luar Indonesia.`) });
      }
    });
  };
  const degrees = tr('decimal degrees', 'derajat desimal');
  return (
    <form className="ka-hub-latlon" id={id} onSubmit={find}>
      <label>{tr('Latitude', 'Lintang')}<input type="number" inputMode="decimal" step="any" min={-90} max={90} placeholder={degrees} value={lat} onChange={(e) => setLat(e.target.value)} /></label>
      <label>{tr('Longitude', 'Bujur')}<input type="number" inputMode="decimal" step="any" min={-180} max={180} placeholder={degrees} value={lon} onChange={(e) => setLon(e.target.value)} /></label>
      <button type="submit" className="ka-hub-find-btn" disabled={busy}>{tr('Find the district', 'Cari kabupaten/kota')}</button>
      {msg ? <p className={`ka-hub-msg${msg.tone === 'error' ? ' is-error' : ''}`} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
    </form>
  );
}

// ------------------------------------------------------------------------------------------------ the latest month

function StatCard({ data, rule }: { data: LandingData; rule: Load<BlindRule | null> }) {
  const tr = useTr();
  const lang = useLang();
  const latest = data.latest;
  if (!latest) return null;
  const month = monthName(latest.month, lang, 'long');
  const change = data.change;
  const raw = data.validation.raw?.loyo ?? null, ours = data.validation.ours?.loyo ?? null;
  const blind = rule.state === 'ok' ? rule.data : null;
  const rawTag = tr('raw joined', 'mentah disambung'), oneTag = tr('one scale', 'satu skala');

  return (
    <section className="ka-hub-card ka-hub-stat">
      <header className="ka-hub-head">
        <h2 className="ka-hub-label">Indonesia · {oneTag}</h2>
        {data.generatedAt ? <p className="ka-hub-date">{tr('data as of', 'data per')} {shortDate(data.generatedAt, lang)}</p> : null}
      </header>
      <p className="ka-hub-big">{fmtNumber(latest.H, lang)}</p>
      <p className="ka-hub-unit">
        {tr('fire cell-days', 'sel-hari api')} · {month} {latest.year}
        {latest.provisional ? <span className="ka-hub-tag is-warn">{tr('provisional', 'sementara')}</span> : null}
      </p>
      {latest.ratio != null ? (
        <p className={`ka-hub-accent${latest.ratio > 1 ? ' is-above' : ''}`}>
          {fmtNumber(latest.ratio, lang, 1)}× {tr(`the median ${month}`, `median ${month}`)}
          {latest.baseline ? <span> ({latest.baseline[0]}–{latest.baseline[1]})</span> : null}
        </p>
      ) : null}
      <div className="ka-hub-tiles">
        {change ? (
          <div className="ka-hub-tile" title={tr('Change in mean yearly fire cell-days. Raw joined: MODIS to 2011, VIIRS from 2012, as recorded. One scale: Aqua MODIS’s own count in both periods.',
            'Perubahan rata-rata sel-hari api per tahun. Mentah disambung: MODIS sampai 2011, VIIRS sejak 2012, apa adanya. Satu skala: hitungan Aqua MODIS sendiri di kedua periode.')}>
            <p className="ka-hub-tile-label">{tr('Change', 'Perubahan')} {change.early[0]}–{change.early[1]} → {change.recent[0]}–{change.recent[1]}</p>
            <p className="ka-hub-tile-row is-raw"><b>{signed(change.raw, lang)}%</b> {rawTag}</p>
            <p className="ka-hub-tile-row is-one"><b>{signed(change.harm, lang)}%</b> {oneTag}</p>
          </div>
        ) : null}
        {raw != null && ours != null ? (
          <div className="ka-hub-tile" title={tr('Median absolute error of the national yearly total, in percent, when each year in turn is left out of the fit.',
            'Median galat absolut total nasional tahunan, dalam persen, ketika setiap tahun bergantian tidak dipakai dalam penyesuaian.')}>
            <p className="ka-hub-tile-label">{tr('Error on years left out of the fit', 'Galat pada tahun di luar penyesuaian')}</p>
            <p className="ka-hub-tile-row is-raw"><b>{errPct(raw, lang)}</b> {rawTag}</p>
            <p className="ka-hub-tile-row is-one"><b>{errPct(ours, lang)}</b> {oneTag}</p>
          </div>
        ) : null}
        {rule.state === 'loading' ? <div className="ka-hub-tile ka-hub-wait" role="status">{tr('Loading…', 'Memuat…')}</div> : null}
        {blind ? (
          <div className="ka-hub-tile" title={tr(`District-days on which more than half of a district’s no-fire cells had no cloud-free look, over ${fmtNumber(blind.seasons, lang)} August-to-October seasons in Central Kalimantan.`,
            `Hari-kabupaten/kota ketika lebih dari separuh sel tanpa api di suatu kabupaten/kota tidak mendapat pandangan bebas awan, selama ${fmtNumber(blind.seasons, lang)} musim Agustus–Oktober di Kalimantan Tengah.`)}>
            <p className="ka-hub-tile-label">{tr('No cloud-free look', 'Tanpa pandangan bebas awan')}</p>
            <p className="ka-hub-tile-row"><b>{fmtNumber(blind.above, lang)}</b></p>
            <p className="ka-hub-tile-note">
              {tr(`of ${fmtNumber(blind.districtDays, lang)} district-days, Central Kalimantan`, `dari ${fmtNumber(blind.districtDays, lang)} hari-kabupaten/kota, Kalimantan Tengah`)}
            </p>
          </div>
        ) : null}
      </div>
      <p className="ka-hub-src">
        {tr('Unit: fire cell-days, Aqua MODIS scale.', 'Satuan: sel-hari api, skala Aqua MODIS.')}
        {blind ? ` ${tr(`Cloud tile: district-days when over half of a district’s no-fire cells had no cloud-free look, ${fmtNumber(blind.seasons, lang)} Aug–Oct seasons.`,
          `Kotak awan: hari-kabupaten/kota ketika lebih dari separuh sel tanpa api tidak mendapat pandangan bebas awan, ${fmtNumber(blind.seasons, lang)} musim Agu–Okt.`)}` : ''}
        {' '}{blind ? tr('Source: NASA FIRMS; MODIS fire masks.', 'Sumber: NASA FIRMS; masker api MODIS.') : tr('Source: NASA FIRMS.', 'Sumber: NASA FIRMS.')}
        {' '}<a href="#/method">{tr('Method and checks', 'Metode dan uji')}</a>
      </p>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the yearly record

const BOX = { width: 360, height: 142, top: 10, right: 34, bottom: 34, left: 30 };

function TrendCard({ data }: { data: LandingData }) {
  const tr = useTr();
  const lang = useLang();
  const geom = useMemo(() => trendGeom(data.points.map((p) => ({ year: p.year, raw: p.raw, fair: p.fair })), BOX), [data.points]);
  if (!geom) return null;
  const { x, y, yMax, firstYear, lastYear, last } = geom;
  const inside = (year: number | null): year is number => year != null && year > firstYear && year <= lastYear;
  const joins = inside(SEAM_YEAR) ? SEAM_YEAR : null;
  const converts = inside(data.convertedFrom) ? data.convertedFrom : null;
  // years of the record the chart does not draw (a year with a provisional month is left out by the loader)
  const have = new Set(data.points.map((p) => p.year));
  const recordEnd = data.lastMonth ? Number(data.lastMonth.slice(0, 4)) : lastYear;
  const leftOut: number[] = [];
  for (let yr = firstYear; yr <= recordEnd; yr += 1) if (!have.has(yr)) leftOut.push(yr);
  const bottom = BOX.height - BOX.bottom;
  const rawEnd = fmtNumber(last.raw, lang), oneEnd = fmtNumber(last.fair, lang);
  const oneTag = tr('One scale', 'Satu skala'), rawTag = tr('Raw joined', 'Mentah disambung');
  const label = tr(
    `Indonesia’s yearly fire record, ${firstYear} to ${lastYear}, each line indexed to its own 2003 to 2011 mean of 100. In ${lastYear} the raw joined line is at ${rawEnd} and the one-scale line at ${oneEnd}.`,
    `Rekaman api tahunan Indonesia, ${firstYear} sampai ${lastYear}, tiap garis diindeks terhadap rata-rata 2003 sampai 2011 miliknya sendiri sebesar 100. Pada ${lastYear} garis mentah disambung berada di ${rawEnd} dan garis satu skala di ${oneEnd}.`,
  );

  return (
    <section className="ka-hub-card ka-hub-trend">
      <header className="ka-hub-head">
        <h2 className="ka-hub-label">{tr('Fire record · yearly', 'Rekaman api · tahunan')}</h2>
        <p className="ka-hub-legend">
          <span className="is-one"><i aria-hidden="true" />{oneTag}</span>
          <span className="is-raw"><i aria-hidden="true" />{rawTag}</span>
        </p>
      </header>
      <svg className="ka-hub-chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={label}>
        <line className="ka-hub-grid" x1={BOX.left} x2={BOX.width - BOX.right} y1={y(yMax)} y2={y(yMax)} />
        <line className="ka-hub-grid is-base" x1={BOX.left} x2={BOX.width - BOX.right} y1={y(100)} y2={y(100)} />
        <line className="ka-hub-grid" x1={BOX.left} x2={BOX.width - BOX.right} y1={bottom} y2={bottom} />
        <text className="ka-hub-tick" x={BOX.left - 5} y={y(yMax) + 4} textAnchor="end">{fmtNumber(yMax, lang)}</text>
        <text className="ka-hub-tick" x={BOX.left - 5} y={y(100) + 4} textAnchor="end">100</text>
        {joins != null ? <line className="ka-hub-mark" x1={x(joins)} x2={x(joins)} y1={BOX.top} y2={bottom + 4} /> : null}
        {converts != null ? <line className="ka-hub-mark" x1={x(converts)} x2={x(converts)} y1={BOX.top} y2={bottom + 4} /> : null}
        <path className="ka-hub-line is-raw" d={geom.rawPath} />
        <path className="ka-hub-line is-one" d={geom.fairPath} />
        <text className="ka-hub-end is-raw" x={x(lastYear) + 5} y={y(last.raw) + 4}>{rawEnd}</text>
        <text className="ka-hub-end is-one" x={x(lastYear) + 5} y={y(last.fair) + 4}>{oneEnd}</text>
        <text className="ka-hub-tick" x={BOX.left} y={bottom + 16}>{firstYear}</text>
        <text className="ka-hub-tick" x={x(lastYear)} y={bottom + 16} textAnchor="middle">{lastYear}</text>
        {joins != null ? <text className="ka-hub-marktext" x={x(joins)} y={bottom + 16} textAnchor="middle">{joins}</text> : null}
        {joins != null ? <text className="ka-hub-marktext" x={x(joins)} y={bottom + 28} textAnchor="middle">{tr('VIIRS joins', 'VIIRS masuk')}</text> : null}
        {converts != null ? <text className="ka-hub-marktext" x={x(converts)} y={bottom + 16} textAnchor="middle">{converts}</text> : null}
        {converts != null ? <text className="ka-hub-marktext" x={x(converts)} y={bottom + 28} textAnchor="middle">{tr('conversion starts', 'konversi mulai')}</text> : null}
      </svg>
      <p className="ka-hub-src">
        {tr('Index of yearly fire cell-days: each line’s own 2003–2011 mean = 100. Raw joined: MODIS to 2011, VIIRS from 2012.',
          'Indeks sel-hari api tahunan: rata-rata 2003–2011 tiap garis = 100. Mentah disambung: MODIS sampai 2011, VIIRS sejak 2012.')}
        {leftOut.length ? ` ${tr(`Left out as provisional: ${leftOut.join(', ')}.`, `Tidak digambar karena masih sementara: ${leftOut.join(', ')}.`)}` : ''}
        {' '}{tr('Source: NASA FIRMS.', 'Sumber: NASA FIRMS.')}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the satellites

function TimeCard({ data }: { data: LandingData }) {
  const tr = useTr();
  if (!data.firstMonth || !data.lastMonth) return null;
  const first = ymIndex(data.firstMonth), last = ymIndex(data.lastMonth), seam = SEAM_YEAR * 12;
  if (!(last > first) || seam <= first || seam >= last) return null;
  const split = Math.round(((seam - first) / (last - first)) * 1000) / 10;
  const y0 = data.firstMonth.slice(0, 4), y1 = data.lastMonth.slice(0, 4);
  return (
    <section className="ka-hub-card ka-hub-time">
      <h2 className="ka-hub-label">{tr('Satellites in the record', 'Satelit dalam rekaman')}</h2>
      <div className="ka-hub-tl" role="img"
        aria-label={tr(`MODIS from ${y0} to ${y1}; VIIRS from ${SEAM_YEAR} to ${y1}; both satellites from ${SEAM_YEAR}.`,
          `MODIS dari ${y0} sampai ${y1}; VIIRS dari ${SEAM_YEAR} sampai ${y1}; kedua satelit sejak ${SEAM_YEAR}.`)}>
        <div className="ka-hub-tl-bar is-modis"><span>MODIS</span></div>
        <div className="ka-hub-tl-bar is-viirs" style={{ marginLeft: `${split}%` }}><span>VIIRS</span></div>
        <div className="ka-hub-tl-axis" aria-hidden="true">
          <span>{y0}</span>
          <span className="is-mid" style={{ left: `${split}%` }}>{SEAM_YEAR} · {tr('both satellites', 'kedua satelit')}</span>
          <span className="is-end">{y1}</span>
        </div>
      </div>
      <p className="ka-hub-src">
        {tr('Years of fire detections in our record. Source: NASA FIRMS (MODIS: Terra, Aqua; VIIRS: Suomi NPP, NOAA-20).',
          'Tahun deteksi api dalam rekaman kami. Sumber: NASA FIRMS (MODIS: Terra, Aqua; VIIRS: Suomi NPP, NOAA-20).')}
      </p>
    </section>
  );
}
