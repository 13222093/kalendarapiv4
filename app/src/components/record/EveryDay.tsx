// KalenderApi (new file): "Every day", the year-by-day calendar of the Harmonize page, beside the year-by-month one
// (RecordCalendar.tsx). One year at a time: twelve month blocks, one square a day, tinted on the monthly calendar's
// own log scale (lib/record.ts emberStep) so the two read alike. The days come from public/ka-data/daily/ (lib/
// everyday.ts); the month's total beside each month's name is the monthly record's own number.
// A day with no value (outside the record, the sensor silent, withheld) is drawn hollow, never as a zero.
// Texts are in English and Bahasa Indonesia, side by side (lib/lang.ts); the CSV file stays in English.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Segmented, Skeleton } from '../ui';
import { IconChevronLeft, IconChevronRight, IconClose, IconDownload, IconPlay } from '../icons';
import { useLang, useTr } from '../../lib/lang';
import { fileSlug, saveText } from '../../lib/download';
import {
  cellValue, fmtCompact, fmtInt, isProvisional, monthsIn, settle, ym,
  type AoiEntry, type Load, type MonthRow, type Series,
} from '../../lib/record';
import {
  countsList, dayInfo, dayLabel, dayStep, daysCsv, fmtDay, lastValueDay, loadAreaDays, longDate, monthSum, moveDay, noValueWords,
  provisionalWords, scaleWords, seasonDayHref, seriesDay, weekdays, yearGrid,
  type AreaDays, type DayInfo, type DaysCsvMeta,
} from '../../lib/everyday';
import '../../styles/everyday.css';

/** The area's days: loading until the answer for this area (and this try) is in. */
function useAreaDays(aoiId: string): [Load<AreaDays>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const want = `${aoiId}#${attempt}`;
  const [got, setGot] = useState<{ key: string; load: Load<AreaDays> } | null>(null);
  useEffect(() => {
    let live = true;
    settle(loadAreaDays(aoiId), (load) => { if (live) setGot({ key: want, load }); });
    return () => { live = false; };
  }, [aoiId, want]);
  return [got?.key === want ? got.load : { state: 'loading' }, () => setAttempt((a) => a + 1)];
}

export interface EveryDayProps {
  aoi: AoiEntry;
  area: string;                         // the area's name in the page's language
  rows: MonthRow[] | null;              // the monthly record of the area (the months' totals), when it is in
  series: Series; onSeries: (s: Series) => void;   // shared with the monthly calendar
  year: number | null;                  // the year in the address (y=), or null for the latest
  onYear: (y: number) => void;
  seasons: number[] | null;             // the season years Play the season holds
  source: string;
  meta: Omit<DaysCsvMeta, 'generated'>;
}

/** The section's figure: the area's daily file while it loads, when it is missing, when it failed, and when it is in. */
export function EveryDay(p: EveryDayProps) {
  const tr = useTr();
  const [load, retry] = useAreaDays(p.aoi.aoi_id);
  if (load.state === 'ok') return <DaysFigure {...p} days={load.data} />;
  const title = tr(`${p.area}: every day`, `${p.area}: setiap hari`);
  return (
    <figure className="ka-days ui-figure">
      <figcaption className="ui-figure-head"><p className="ui-figure-title">{title}</p></figcaption>
      {load.state === 'loading' ? (
        <div className="ka-rec-state" role="status">
          <p className="ka-rec-note">{tr(`Loading the days of ${p.area}…`, `Memuat data harian ${p.area}…`)}</p>
          <Skeleton height={300} />
        </div>
      ) : load.state === 'missing' ? (
        <div className="ka-rec-state ka-rec-empty">
          <p className="ka-rec-empty-title">{tr(`The days of ${p.area} are not built yet`, `Data harian ${p.area} belum dibuat`)}</p>
          <p className="ka-rec-note">{tr('The daily file for this area is not there. The rest of the page works as usual: the monthly calendar above has every month.',
            'Berkas harian untuk wilayah ini belum ada. Bagian lain halaman tetap berfungsi: kalender bulanan di atas memuat setiap bulan.')}</p>
        </div>
      ) : (
        <div className="ka-rec-state ka-rec-empty" role="alert">
          <p className="ka-rec-empty-title">{tr(`The days of ${p.area} could not be loaded`, `Data harian ${p.area} tidak dapat dimuat`)}</p>
          <p className="ka-rec-note">{load.message}. {tr('Check the connection, then try again. The rest of the page works as usual.', 'Periksa koneksi, lalu coba lagi. Bagian lain halaman tetap berfungsi.')}</p>
          <button type="button" className="ui-btn" onClick={retry}>{tr('Try again', 'Coba lagi')}</button>
        </div>
      )}
    </figure>
  );
}

interface Pos { left: number; top?: number; bottom?: number }
const GAP = 6;            // between a day and its readout
const HEADER_ROOM = 72;   // the page's fixed header: the readout does not go under it

function DaysFigure({ aoi, area, rows, series, onSeries, year, onYear, seasons, source, meta, days }: EveryDayProps & { days: AreaDays }) {
  const tr = useTr();
  const lang = useLang();
  const first = days.firstYear, last = days.lastYear;
  const shown = year != null && year >= first && year <= last ? year : last;
  const years = useMemo(() => Array.from({ length: last - first + 1 }, (_, i) => last - i), [first, last]);
  const grid = useMemo(() => yearGrid(shown), [shown]);
  const info = useMemo(() => {
    const m = new Map<string, DayInfo>();
    for (const g of grid) for (const w of g.weeks) for (const d of w) if (d) m.set(d, dayInfo(days, d));
    return m;
  }, [grid, days]);
  const byMonth = useMemo(() => new Map((rows ?? []).map((r) => [ym(r.year, r.month), r])), [rows]);
  const monthsLong = monthsIn(lang, 'long'), monthsShort = monthsIn(lang, 'short');
  const wd = useMemo(() => weekdays(lang), [lang]);

  const wrap = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // a day picked or pointed at in another year does not count in this one
  const sel = selected && info.has(selected) ? selected : null;
  // the one day in the tab order: the picked day, else the latest day of the year with a value
  const focusDate = useMemo(() => sel ?? lastValueDay(days, shown, series) ?? `${shown}-01-01`, [sel, days, shown, series]);
  const active = (hover && info.has(hover) ? hover : null) ?? sel;

  // the readout sits under the day it describes, or above it when it would run past the foot of the window; it is
  // drawn first (hidden), measured, then placed, and kept inside the figure
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useLayoutEffect(() => {
    const box = wrap.current, card = pop.current;
    const el = active ? box?.querySelector<HTMLElement>(`[data-date="${active}"]`) : null;
    if (!box || !el || !card) { setPos(null); return; }
    const w = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    const width = card.offsetWidth, height = card.offsetHeight;
    const left = Math.max(0, Math.min(w.width - width, r.left - w.left + r.width / 2 - width / 2));
    const above = r.bottom + GAP + height > window.innerHeight - 8 && r.top - GAP - height > HEADER_ROOM;
    const next: Pos = above ? { left, bottom: w.bottom - r.top + GAP } : { left, top: r.bottom - w.top + GAP };
    setPos((p) => (p && p.left === next.left && p.top === next.top && p.bottom === next.bottom ? p : next));
  }, [active, shown, series, tick, lang]);

  const focusDay = (date: string) => wrap.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
  // closing the readout hands the focus back to its day without opening it again
  const quiet = useRef(false);
  const close = (date: string) => { quiet.current = true; setSelected(null); setHover(null); focusDay(date); quiet.current = false; };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && sel) { e.preventDefault(); close(sel); return; }
    if (!(e.target instanceof HTMLElement) || !e.target.dataset.date) return;
    const next = moveDay(e.target.dataset.date, e.key);
    if (!next) return;
    e.preventDefault();
    setSelected(next);
    focusDay(next);
  };

  // a month's total: the monthly record's own number (the monthly calendar's); the days' sum only until it is in
  const total = (key: string, month: number): { text: string; say: string; prov: boolean; held: boolean } => {
    const r = byMonth.get(key);
    const s = monthSum(days, shown, month, series);
    const v = r ? cellValue(r, series) : s.any ? s.sum : null;
    const prov = (r ? isProvisional(r) : days.provisional.has(key) || days.partial.has(key)) && v != null;
    const say = [
      v == null ? tr('no value', 'tanpa nilai') : tr(`${fmtInt(v)} fire cell-days`, `${fmtInt(v, lang)} sel-hari api`),
      ...(prov ? [tr('provisional', 'sementara')] : []),
      ...(s.withheld ? [tr('its days are withheld', 'hari-harinya ditahan')] : []),
    ].join(', ');
    return { text: v == null ? '–' : fmtCompact(v, lang), say, prov, held: s.withheld };
  };
  const anyHeld = grid.some((g) => monthSum(days, shown, g.month, series).withheld);
  const anyProv = grid.some((g) => days.provisional.has(g.key) || days.partial.has(g.key));
  const inKalteng = seasonDayHref(`${shown}-08-01`, aoi, [shown]) !== null;
  const playable = inKalteng && !!seasons?.includes(shown);

  const save = () => {
    const file = `kalenderapi_${fileSlug(meta.area)}_${shown}_days.csv`;
    try {
      saveText(daysCsv(days, shown, { ...meta, generated: new Date().toISOString().slice(0, 10) }), file);
      setSaved(tr(`Saved ${file}`, `Tersimpan: ${file}`));
    } catch (e) {
      setSaved(tr(`The file could not be made: ${e instanceof Error ? e.message : String(e)}. Try again.`, `Berkas tidak dapat dibuat: ${e instanceof Error ? e.message : String(e)}. Coba lagi.`));
    }
  };

  const act = active ? info.get(active) ?? null : null;
  const href = act ? seasonDayHref(act.date, aoi, seasons) : null;
  const seriesWord = series === 'harm' ? tr('on one scale', 'pada satu skala') : tr('as recorded', 'sebagaimana tercatat');

  return (
    <figure className="ka-days ui-figure">
      <figcaption className="ui-figure-head">
        <p className="ui-figure-title">{tr(`${area}: every day of ${shown}`, `${area}: setiap hari pada ${shown}`)}</p>
        <p className="ui-figure-subtitle">
          {series === 'harm'
            ? tr(`One square is one day: the fire cell-days in ${area} that day, on the Aqua MODIS scale.`,
              `Satu kotak adalah satu hari: sel-hari api di ${area} pada hari itu, pada skala Aqua MODIS.`)
            : tr(`One square is one day: the fire cell-days in ${area} that day, as the satellites recorded them (MODIS to 2011, VIIRS from 2012).`,
              `Satu kotak adalah satu hari: sel-hari api di ${area} pada hari itu, sebagaimana dicatat satelit (MODIS sampai 2011, VIIRS sejak 2012).`)}
        </p>
        <p className="ui-figure-subtitle">
          {tr('A zero means nothing was detected, not that nothing burned: cloud and smoke hide fires. From 2022 the days are approximate: VIIRS converted with one factor for the whole month.',
            'Nol berarti tidak ada yang terdeteksi, bukan berarti tidak ada yang terbakar: awan dan asap menyembunyikan api. Sejak 2022 nilai harian adalah perkiraan: VIIRS dikonversi dengan satu faktor untuk sebulan penuh.')}
          {shown <= 2002 ? tr(' Before July 2002 they are converted from Terra in the same way.', ' Sebelum Juli 2002 nilainya dikonversi dari Terra dengan cara yang sama.') : ''}
          {aoi.level === 'district' ? tr(' District values share their province\'s conversion.', ' Nilai kabupaten/kota memakai konversi provinsinya.') : ''}
        </p>
      </figcaption>

      <div className="ka-days-bar">
        <div className="ka-days-year" role="group" aria-label={tr('Year', 'Tahun')}>
          <button type="button" className="ui-btn ui-btn-icon" disabled={shown <= first} onClick={() => onYear(shown - 1)}
            aria-label={tr(`Previous year, ${shown - 1}`, `Tahun sebelumnya, ${shown - 1}`)}><IconChevronLeft size={16} /></button>
          <label className="ka-rec-picker">
            <span>{tr('Year', 'Tahun')}</span>
            <select value={shown} onChange={(e) => onYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" className="ui-btn ui-btn-icon" disabled={shown >= last} onClick={() => onYear(shown + 1)}
            aria-label={tr(`Next year, ${shown + 1}`, `Tahun berikutnya, ${shown + 1}`)}><IconChevronRight size={16} /></button>
        </div>
        <Segmented<Series> label={tr('Series', 'Seri')} value={series} onChange={onSeries}
          options={[
            { value: 'harm', label: tr('On one scale', 'Pada satu skala'), title: tr('Harmonized: VIIRS put on the Aqua MODIS scale, so every year shares one scale', 'Terharmonisasi: VIIRS ditempatkan pada skala Aqua MODIS, sehingga setiap tahun memakai satu skala') },
            { value: 'raw', label: tr('As recorded', 'Sebagaimana tercatat'), title: tr('Raw: MODIS to 2011, VIIRS from 2012. The 2012 jump is the change of satellite, not more fire', 'Mentah: MODIS sampai 2011, VIIRS sejak 2012. Lonjakan 2012 adalah pergantian satelit, bukan api yang bertambah') },
          ]} />
        <button type="button" className="ui-btn ka-days-csv" onClick={save}><IconDownload size={15} />{tr('Download the days (CSV)', 'Unduh data harian (CSV)')}</button>
      </div>

      <div ref={wrap} className="ka-days-wrap" onPointerLeave={() => setHover(null)} onKeyDown={onKey}>
        <div className="ka-days-grid" role="grid"
          aria-label={tr(`Fire cell-days by day, ${shown}, ${area}, ${seriesWord}. Arrow keys move between days.`,
            `Sel-hari api per hari, ${shown}, ${area}, ${seriesWord}. Tombol panah berpindah antarhari.`)}>
          {grid.map((g) => {
            const t = total(g.key, g.month);
            const name = monthsLong[g.month - 1]!;
            return (
              <div key={g.key} role="rowgroup" className="ka-days-month">
                <div role="row" className="ka-days-mrow">
                  <span role="columnheader" aria-colspan={7} className="ka-days-mhead" aria-label={`${name} ${shown}: ${t.say}`}>
                    <span className="ka-days-mname"><span className="ka-days-ml">{name}</span><span className="ka-days-ms">{monthsShort[g.month - 1]}</span></span>
                    <span className="ka-days-mtot">{t.text}{t.prov ? '*' : ''}{t.held ? '†' : ''}</span>
                  </span>
                </div>
                <div role="row" className="ka-days-row ka-days-wdrow">
                  {wd.map((d, i) => <span key={i} role="columnheader" className="ka-days-wd" aria-label={d.long}>{d.short}</span>)}
                </div>
                {g.weeks.map((week, wi) => (
                  <div key={wi} role="row" className="ka-days-row">
                    {week.map((date, di) => {
                      if (!date) return <span key={di} role="gridcell" className="ka-days-blank" />;
                      const i = info.get(date)!;
                      const d = seriesDay(i, series);
                      const step = dayStep(i, series, days.max);
                      const link = seasonDayHref(date, aoi, seasons);
                      return (
                        <button key={date} type="button" role="gridcell" className="ka-day" data-date={date}
                          data-step={step ?? undefined} data-none={step == null && d.status !== 'withheld' ? '' : undefined}
                          data-held={d.status === 'withheld' ? '' : undefined}
                          aria-selected={date === sel} tabIndex={date === focusDate ? 0 : -1}
                          aria-label={`${dayLabel(i, series, lang)}${link ? tr('. Opens in Play the season from the readout', '. Dapat dibuka di Putar musim dari keterangan') : ''}`}
                          onClick={() => setSelected(date)} onFocus={() => { if (!quiet.current) setSelected(date); }}
                          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(date); }} />
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {act ? (
          <div ref={pop} className="ka-days-pop" data-live={active === sel ? '' : undefined} role="group" aria-label={tr('The day in numbers', 'Angka hari ini')}
            style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom } : { left: 0, top: 0, visibility: 'hidden' }}>
            <p className="ka-days-pop-date">{longDate(act.date, lang)}</p>
            <Readout i={act} series={series} />
            {href ? <a className="ka-days-pop-link" href={href}><IconPlay size={12} />{tr('Open this day in Play the season', 'Buka hari ini di Putar musim')}</a> : null}
            {active === sel ? (
              <button type="button" className="ka-days-pop-close" onClick={() => close(act.date)} aria-label={tr('Close the readout', 'Tutup keterangan')}><IconClose size={13} /></button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="ka-rec-cal-legend ka-days-legend" aria-label={tr('Legend', 'Legenda')}>
        <li className="ka-rec-ramp-item">
          <span>{tr('Fewer', 'Lebih sedikit')}</span>
          <span className="ka-rec-ramp" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-step={i + 1} />)}</span>
          <span>{tr('more fire cell-days a day (log scale, the same for both series and for every year of this area)', 'lebih banyak sel-hari api per hari (skala log, sama untuk kedua seri dan untuk setiap tahun wilayah ini)')}</span>
        </li>
        <li><i className="ka-days-lg" data-step="0" aria-hidden="true" />{tr('Zero: nothing detected that day', 'Nol: tidak ada yang terdeteksi pada hari itu')}</li>
        <li><i className="ka-days-lg" data-none="" aria-hidden="true" />{tr('No value: outside the record, or the satellite recorded nothing anywhere in Indonesia that day', 'Tanpa nilai: di luar rekaman, atau satelit tidak mencatat apa pun di seluruh Indonesia pada hari itu')}</li>
        {anyHeld ? <li><i className="ka-days-lg" data-held="" aria-hidden="true" />{tr('Withheld for a registered test (1 January to 31 October 2019): not computed, not a zero; † days withheld', 'Ditahan untuk sebuah uji terdaftar (1 Januari sampai 31 Oktober 2019): tidak dihitung, bukan nol; † hari-harinya ditahan')}</li> : null}
        {anyProv ? <li>{tr('* provisional: near-real-time data, may change', '* sementara: data hampir waktu nyata, dapat berubah')}</li> : null}
      </ul>
      <p className="ka-rec-note">
        {tr('The number beside each month is that month of the calendar above; its days add up to it.', 'Angka di samping setiap bulan adalah bulan itu pada kalender di atas; jumlah hari-harinya sama dengan angka itu.')}
        {playable ? tr(` Pick a day from 1 August to 31 October ${shown} to open it in Play the season.`, ` Pilih satu hari dari 1 Agustus sampai 31 Oktober ${shown} untuk membukanya di Putar musim.`) : ''}
      </p>
      <div className="ui-figure-foot">
        <p className="ui-figure-source">{source}</p>
        <p className="ka-rec-dl-status" role="status">{saved ?? ''}</p>
      </div>
    </figure>
  );
}

/** The readout of one day: the value of the series shown, where it comes from, the other series, the raw counts. */
function Readout({ i, series }: { i: DayInfo; series: Series }) {
  const tr = useTr();
  const lang = useLang();
  const d = seriesDay(i, series);
  const counts = countsList(i, lang);
  const from = scaleWords(i, lang);
  const prov = d.value != null ? provisionalWords(i, lang) : '';
  return (
    <>
      {d.value == null ? <p className="ka-days-pop-main">{noValueWords(d, lang)}</p> : (
        <p className="ka-days-pop-main">
          <b>{fmtDay(d.value, lang)}</b> {series === 'harm'
            ? tr('fire cell-days on the Aqua MODIS scale', 'sel-hari api pada skala Aqua MODIS')
            : tr(`fire cell-days as recorded by ${counts.find((c) => c.sat === d.sensor)?.name ?? ''}`, `sel-hari api sebagaimana tercatat oleh ${counts.find((c) => c.sat === d.sensor)?.name ?? ''}`)}
        </p>
      )}
      {series === 'harm' && from ? <p className="ka-days-pop-note">{from}</p> : null}
      {series === 'raw' && i.harm.status !== 'withheld' ? (
        <p className="ka-days-pop-note">
          {tr('On one scale: ', 'Pada satu skala: ')}{i.harm.value == null ? noValueWords(i.harm, lang) : `${fmtDay(i.harm.value, lang)}${from ? ` (${from})` : ''}`}
        </p>
      ) : null}
      {counts.length ? (
        <dl className="ka-days-pop-raw">
          <dt>{tr('As recorded', 'Sebagaimana tercatat')}</dt>
          {counts.map((c) => <dd key={c.sat}><span>{c.name}</span><b>{c.text}</b></dd>)}
        </dl>
      ) : null}
      {prov ? <p className="ka-days-pop-note">{prov}</p> : null}
    </>
  );
}
