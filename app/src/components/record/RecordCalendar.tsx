// KalenderApi (new file): the years x months calendar of the Indonesia record. Colour = fire cell-days (harmonized H, or
// the raw record stitched as recorded), on one log scale for both, so switching shows the 2012 jump. Hatching = the
// month's cloud view (classes filled from the NASA MODIS FireMask): light for partly cloud-free, heavy for no
// cloud-free look. A small ring marks a month whose cloud view was not computed: it is never drawn as "no look".
// A picked date range (from the page's "Pick a period") keeps its months in full colour and fades the others.
// Patterns from vendor/second-sight/app/src/calendar.ts and kalenderapi-v1.1 src/pages/Calendar.tsx.
// Texts are in English and Bahasa Indonesia, side by side (lib/lang.ts).
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FigureTableView, Segmented } from '../ui';
import { useLang, useTr } from '../../lib/lang';
import {
  SEAM_YEAR, blindShare, cellValue, emberStep, fmtCompact, fmtInt, fmt1, inRange, isProvisional, monthName, monthsIn,
  noInterval, obsState, pct1, rangeLabel, ym, type MonthRange, type MonthRow, type ObsState, type Series,
} from '../../lib/record';

export function RecordCalendar({ rows, area, series, onSeries, selected, onSelect, computed, obsElsewhere, ratio, unit, source, seasonHref, range = null, locked }: {
  rows: MonthRow[]; area: string; series: Series; onSeries: (s: Series) => void;
  selected: string | null; onSelect: (key: string) => void;
  computed: Set<string> | null;
  obsElsewhere: string | null;   // the area whose months have a cloud view, when it is not this one
  ratio: number | null; unit: string; source: string;
  seasonHref: (key: string) => string | null;   // Play the season at the first day of a month, when that season is built
  range?: MonthRange | null;     // the picked date range: its months stay in full colour, the others are faded
  locked?: Set<string>;          // months a registered test covers: when empty here, they were not computed (not "no data")
}) {
  const tr = useTr();
  const lang = useLang();
  const obsWords: Record<ObsState, string> = {
    good: tr('cloud-free look', 'pandangan bebas awan'),
    partial: tr('partly cloud-free', 'sebagian bebas awan'),
    unobserved: tr('no cloud-free look', 'tanpa pandangan bebas awan'),
    'not-computed': tr('cloud view not computed', 'pandangan awan tidak dihitung'),
  };
  const monthsLong = monthsIn(lang, 'long'), monthsShort = monthsIn(lang, 'short');
  const grid = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(rows.map((r) => [ym(r.year, r.month), r])), [rows]);
  const years = useMemo(() => {
    if (!rows.length) return [] as number[];
    const a = rows[0]!.year, b = rows[rows.length - 1]!.year;
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }, [rows]);
  // one scale for Raw and Harmonized: the largest of either
  const max = useMemo(() => Math.max(0, ...rows.map((r) => Math.max(r.H ?? 0, cellValue(r, 'raw') ?? 0))), [rows]);
  const keys = useMemo(() => rows.map((r) => ym(r.year, r.month)), [rows]);
  const obsCount = useMemo(() => rows.filter((r) => obsState(r, computed) !== 'not-computed').length, [rows, computed]);
  const anyObs = obsCount > 0;
  const obsMonths = useMemo(() => rows.filter((r) => obsState(r, computed) !== 'not-computed').map((r) => {
    const key = ym(r.year, r.month);
    return { key, share: blindShare(r), href: seasonHref(key) };
  }), [rows, computed, seasonHref]);
  const focusKey = selected && byKey.has(selected) ? selected : keys[keys.length - 1] ?? null;
  // a locked month with no value here was not computed (the districts): say so, never "no satellite data"
  const isHeld = (key: string, r: MonthRow) => !!locked?.has(key) && r.H == null;
  const anyHeld = useMemo(() => rows.some((r) => !!locked?.has(ym(r.year, r.month)) && r.H == null), [rows, locked]);

  const describe = (key: string): string => {
    const r = byKey.get(key);
    if (!r) return tr(`${monthName(key, lang)}: outside the record`, `${monthName(key, lang)}: di luar rekaman`);
    const v = cellValue(r, series);
    const parts = [monthName(key, lang)];
    if (isHeld(key, r)) parts.push(tr('held for a registered test: not computed, not a zero', 'ditahan untuk sebuah uji terdaftar: tidak dihitung, bukan nol'));
    else if (v == null) {
      parts.push(series === 'harm'
        ? tr('no harmonized value (no satellite data in the archive)', 'tidak ada nilai terharmonisasi (tidak ada data satelit dalam arsip)')
        : tr('no raw value', 'tidak ada nilai mentah'));
    } else {
      parts.push(series === 'harm'
        ? tr(`${fmtInt(v)} fire cell-days on the harmonized scale`, `${fmtInt(v, lang)} sel-hari api pada skala terharmonisasi`)
        : tr(`${fmtInt(v)} fire cell-days, raw as recorded`, `${fmtInt(v, lang)} sel-hari api, mentah sebagaimana tercatat`));
      if (series === 'harm' && r.H_lo != null && r.H_hi != null && Math.round(r.H_lo) !== Math.round(r.H_hi)) {
        parts.push(tr(`likely ${fmtInt(r.H_lo)} to ${fmtInt(r.H_hi)}`, `kemungkinan ${fmtInt(r.H_lo, lang)} sampai ${fmtInt(r.H_hi, lang)}`));
      }
      if (series === 'harm' && noInterval(r)) parts.push(tr('no 90% range (one national ratio)', 'tanpa rentang 90% (satu rasio nasional)'));
    }
    if (!isHeld(key, r)) parts.push(obsWords[obsState(r, computed)]);
    const b = obsState(r, computed) !== 'not-computed' ? blindShare(r) : null;
    if (b != null) parts.push(tr(`${pct1(b)} of no-fire cell-days had no cloud-free look`, `${pct1(b, lang)} sel-hari tanpa api tidak mendapat pandangan bebas awan`));
    if (isProvisional(r)) parts.push(tr('provisional', 'sementara'));
    if (range) parts.push(inRange(key, range) ? tr('in the picked range', 'dalam rentang yang dipilih') : tr('outside the picked range', 'di luar rentang yang dipilih'));
    return parts.join(', ');
  };

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!focusKey) return;
    const i = keys.indexOf(focusKey);
    const y = Number(focusKey.slice(0, 4)), m = Number(focusKey.slice(5, 7));
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowRight': next = keys[i + 1] ?? null; break;
      case 'ArrowLeft': next = keys[i - 1] ?? null; break;
      case 'ArrowDown': next = ym(y + 1, m); break;
      case 'ArrowUp': next = ym(y - 1, m); break;
      case 'Home': next = keys.find((k) => k.startsWith(`${y}-`)) ?? null; break;
      case 'End': next = [...keys].reverse().find((k) => k.startsWith(`${y}-`)) ?? null; break;
      default: return;
    }
    e.preventDefault();
    if (!next || !byKey.has(next)) return;
    onSelect(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-key="${next}"]`)?.focus();
  };

  const shown = hover ?? focusKey;
  const total = (y: number) => {
    let s = 0, any = false, prov = false, held = false;
    for (let m = 1; m <= 12; m++) {
      const r = byKey.get(ym(y, m));
      const v = r ? cellValue(r, series) : null;
      if (v != null) { s += v; any = true; }
      if (r && isProvisional(r)) prov = true;
      if (r && isHeld(ym(y, m), r)) held = true;
    }
    return { s, any, prov, held };
  };
  const table = useMemo(() => ({
    columns: [lang === 'id' ? 'Tahun' : 'Year', ...monthsIn(lang, 'short'), 'Total'],
    rows: years.map((y) => {
      let s = 0;
      const cells = Array.from({ length: 12 }, (_, i) => {
        const r = byKey.get(ym(y, i + 1));
        const v = r ? cellValue(r, series) : null;
        if (v != null) s += v;
        return v == null ? '–' : fmtInt(v, lang);
      });
      return [String(y), ...cells, fmtInt(s, lang)];
    }),
  }), [years, byKey, series, lang]);

  return (
    <figure className="ka-rec-cal ui-figure">
      <figcaption className="ui-figure-head">
        <p className="ui-figure-title">{tr(`${area}: every month, ${years[0]} to ${years[years.length - 1]}`, `${area}: setiap bulan, ${years[0]} sampai ${years[years.length - 1]}`)}</p>
        <p className="ui-figure-subtitle">{unit}</p>
      </figcaption>
      <div className="ka-rec-cal-bar">
        <Segmented<Series> label={tr('Series', 'Seri')} value={series} onChange={onSeries}
          options={[
            { value: 'harm', label: tr('Harmonized', 'Terharmonisasi'), title: tr('VIIRS put on the Aqua MODIS scale, so every year shares one scale', 'VIIRS ditempatkan pada skala Aqua MODIS, sehingga setiap tahun memakai satu skala') },
            { value: 'raw', label: tr('Raw', 'Mentah'), title: tr('As recorded: MODIS to 2011, VIIRS from 2012. The 2012 jump is the change of satellite, not more fire', 'Sebagaimana tercatat: MODIS sampai 2011, VIIRS sejak 2012. Lonjakan 2012 adalah pergantian satelit, bukan api yang bertambah') },
          ]} />
        <p className="ka-rec-cal-read" aria-hidden="true">{shown ? describe(shown) : ''}</p>
      </div>
      <div ref={grid} className="ka-rec-cal-grid" role="grid"
        aria-label={tr(`Fire cell-days by month, ${area}, ${series === 'harm' ? 'harmonized' : 'raw'}`, `Sel-hari api per bulan, ${area}, ${series === 'harm' ? 'terharmonisasi' : 'mentah'}`)}
        data-range={range ? '' : undefined} onKeyDown={move} onPointerLeave={() => setHover(null)}>
        <div role="row" className="ka-rec-cal-row ka-rec-cal-headrow">
          <span role="columnheader" className="ka-rec-cal-y" />
          {monthsShort.map((m, i) => (
            <span key={m} role="columnheader" className="ka-rec-cal-mh" aria-label={monthsLong[i]}>
              <span className="ka-rec-mh-l">{m}</span><span className="ka-rec-mh-s">{m[0]}</span>
            </span>
          ))}
          <span role="columnheader" className="ka-rec-cal-th">Total</span>
        </div>
        {years.map((y) => {
          const t = total(y);
          return (
            <div key={y} role="row" className={`ka-rec-cal-row${y === SEAM_YEAR ? ' is-seam' : ''}`}
              data-seam={y === SEAM_YEAR ? tr('2012: VIIRS joins MODIS', '2012: VIIRS menyusul MODIS') : undefined}>
              <span role="rowheader" className="ka-rec-cal-y">{y}</span>
              {monthsLong.map((_, i) => {
                const key = ym(y, i + 1);
                const r = byKey.get(key);
                if (!r) return <span key={key} role="gridcell" className="ka-rec-cell is-out" aria-label={describe(key)} />;
                const v = cellValue(r, series);
                const obs = obsState(r, computed);
                const blind = obs !== 'not-computed' ? blindShare(r) : null;
                return (
                  <button key={key} type="button" role="gridcell" data-key={key}
                    className="ka-rec-cell" data-step={v == null ? undefined : emberStep(v, max)} data-null={v == null ? '' : undefined}
                    data-obs={isHeld(key, r) ? undefined : obs} data-held={isHeld(key, r) ? '' : undefined}
                    data-prov={isProvisional(r) ? '' : undefined} data-in={range && inRange(key, range) ? '' : undefined}
                    aria-selected={key === selected} tabIndex={key === focusKey ? 0 : -1} aria-label={describe(key)}
                    onClick={() => onSelect(key)} onPointerEnter={() => setHover(key)}>
                    <span className="ka-rec-cell-n">{v == null ? '–' : fmtCompact(v, lang)}</span>
                    {/* the month's share with no cloud-free look: a hatched strip along the foot of the cell */}
                    {blind != null ? (
                      <span className="ka-rec-cell-track" aria-hidden="true">
                        <span className="ka-rec-cell-blind" style={{ width: `${Math.max(4, blind * 100)}%` }} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <span role="gridcell" className="ka-rec-cal-tot">{t.any ? `${fmtCompact(t.s, lang)}${t.prov ? '*' : ''}${t.held ? '†' : ''}` : '–'}</span>
            </div>
          );
        })}
      </div>
      {range ? (
        <p className="ka-rec-cal-range" role="status">
          {tr('Picked range: ', 'Rentang yang dipilih: ')}<strong>{rangeLabel(range, lang)}</strong>
          {tr('. Months outside it are faded; reset it under "Pick a period".', '. Bulan di luar rentang dipudarkan; atur ulang di bagian "Pilih periode".')}
        </p>
      ) : null}
      <ul className="ka-rec-cal-legend" aria-label={tr('Legend', 'Legenda')}>
        <li className="ka-rec-ramp-item">
          <span>{tr('Fewer', 'Lebih sedikit')}</span>
          <span className="ka-rec-ramp" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-step={i + 1} />)}</span>
          <span>{tr('more fire cell-days (log scale, same for Raw and Harmonized)', 'lebih banyak sel-hari api (skala log, sama untuk Mentah dan Terharmonisasi)')}</span>
        </li>
        <li><i className="ka-rec-lg" data-obs="partial" aria-hidden="true" />{tr('Partly cloud-free: some no-fire cell-days had no cloud-free look', 'Sebagian bebas awan: sebagian sel-hari tanpa api tidak mendapat pandangan bebas awan')}</li>
        <li><i className="ka-rec-lg" data-obs="unobserved" aria-hidden="true" />{tr('No cloud-free look: a low count does not tell us whether fire was present', 'Tanpa pandangan bebas awan: hitungan rendah tidak memberi tahu apakah ada api')}</li>
        <li><i className="ka-rec-lg" data-obs="good" aria-hidden="true" />{tr('Cloud-free look', 'Pandangan bebas awan')}</li>
        {anyObs ? <li><i className="ka-rec-lg ka-rec-lg-blind" aria-hidden="true"><i /></i>{tr('Strip: share of no-fire cell-days with no cloud-free look', 'Strip: bagian sel-hari tanpa api yang tidak mendapat pandangan bebas awan')}</li> : null}
        <li><i className="ka-rec-lg" data-obs="not-computed" aria-hidden="true" />{tr('Cloud view not computed', 'Pandangan awan tidak dihitung')}</li>
        <li><i className="ka-rec-lg" data-prov="" aria-hidden="true" />{tr('Provisional (near real time)', 'Sementara (hampir waktu nyata)')}{years.some((y) => total(y).prov) ? tr('; * total so far', '; * total sejauh ini') : ''}</li>
        {anyHeld ? <li><i className="ka-rec-lg" data-held="" aria-hidden="true" />{tr('Held for a registered test (January to October 2019): not computed, not a zero; † total without them', 'Ditahan untuk sebuah uji terdaftar (Januari sampai Oktober 2019): tidak dihitung, bukan nol; † total tanpa bulan-bulan itu')}</li> : null}
        {range ? <li><i className="ka-rec-lg ka-rec-lg-out" aria-hidden="true" />{tr('Faded: outside the picked range', 'Pudar: di luar rentang yang dipilih')}</li> : null}
      </ul>
      <p className="ka-rec-note">
        {anyObs
          ? tr(`The cloud view is computed for ${obsCount} month${obsCount === 1 ? '' : 's'} of ${area} from the NASA MODIS Terra and Aqua daily FireMask (a cloud-free look if observability is at least 0.6, partly if at least 0.3). Every other month is marked "not computed": its cloud cover is unknown; the record does not say.`,
            `Pandangan awan dihitung untuk ${obsCount} bulan di ${area} dari FireMask harian NASA MODIS Terra dan Aqua (pandangan bebas awan bila observabilitas sedikitnya 0,6; sebagian bila sedikitnya 0,3). Setiap bulan lain ditandai "tidak dihitung": tutupan awannya tidak diketahui; rekaman tidak menyebutkannya.`)
          : tr(`The cloud view is not computed for ${area}: no month here has one, so a low count cannot be read as an absence of fire.${obsElsewhere ? ` Months with a cloud view measured from the NASA MODIS FireMask are in ${obsElsewhere}.` : ''}`,
            `Pandangan awan tidak dihitung untuk ${area}: tidak ada bulan di sini yang memilikinya, sehingga hitungan rendah tidak dapat dibaca sebagai tidak adanya api.${obsElsewhere ? ` Bulan dengan pandangan awan yang diukur dari FireMask NASA MODIS ada di ${obsElsewhere}.` : ''}`)}
        {ratio != null ? tr(` Raw from 2012 is VIIRS, which counted ${fmt1(ratio)} fire cell-days for every one MODIS Aqua counted in the same months.`,
          ` Data mentah sejak 2012 adalah VIIRS, yang menghitung ${fmt1(ratio, lang)} sel-hari api untuk setiap satu yang dihitung MODIS Aqua pada bulan yang sama.`) : ''}
      </p>
      {obsMonths.length ? (
        <div className="ka-rec-blindlist">
          <p className="ka-rec-note">
            {tr('Even a month with a cloud-free look has days without one. The share of each month\'s no-fire cell-days with no cloud-free look, and its days in Play the season (each day\'s NASA photo, hotspots and hatched days with no cloud-free look):',
              'Bahkan bulan dengan pandangan bebas awan memiliki hari-hari tanpa pandangan itu. Bagian sel-hari tanpa api setiap bulan yang tidak mendapat pandangan bebas awan, dan hari-harinya di Putar musim (foto NASA setiap hari, titik panas, dan hari berarsir tanpa pandangan bebas awan):')}
          </p>
          <ul>
            {obsMonths.map(({ key, share, href }) => (
              <li key={key}>
                {href ? <a href={href}>{monthName(key, lang)}</a> : <span>{monthName(key, lang)}</span>}
                <span className="ka-rec-num">{share == null ? 'n/a' : pct1(share, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="ui-figure-foot">
        <p className="ui-figure-source">{source}</p>
        <FigureTableView table={table} />
      </div>
    </figure>
  );
}
