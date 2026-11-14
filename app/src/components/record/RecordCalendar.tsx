// Project 4 (new file): the years x months calendar of the Indonesia record. Colour = fire cell-days (harmonized H, or
// the raw record stitched as recorded), on one log scale for both, so switching shows the 2012 jump. Hatching = the
// month's observability class (Second Sight's TRI-04 rule, filled by project 4 from the NASA MODIS FireMask): light for
// partly seen, heavy for not seen. A small ring marks a month whose observability was not computed: it is never drawn
// as "not seen". Patterns from vendor/second-sight/app/src/calendar.ts and kalenderapi-v1.1 src/pages/Calendar.tsx.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FigureTableView, Segmented } from '../ui';
import {
  MONTHS, MONTHS_SHORT, SEAM_YEAR, cellValue, emberStep, fmtCompact, fmtInt, fmt1, isProvisional, monthName, obsState,
  ym, type MonthRow, type ObsState, type Series,
} from '../../lib/record';

const OBS_WORDS: Record<ObsState, string> = {
  good: 'seen clearly', partial: 'partly seen (cloud)', unobserved: 'not seen (cloud)', 'not-computed': 'observability not computed',
};

export function RecordCalendar({ rows, area, series, onSeries, selected, onSelect, computed, obsElsewhere, ratio, unit, source }: {
  rows: MonthRow[]; area: string; series: Series; onSeries: (s: Series) => void;
  selected: string | null; onSelect: (key: string) => void;
  computed: Set<string> | null;
  obsElsewhere: string | null;   // the area whose months have observability, when it is not this one
  ratio: number | null; unit: string; source: string;
}) {
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
  const focusKey = selected && byKey.has(selected) ? selected : keys[keys.length - 1] ?? null;

  const describe = (key: string): string => {
    const r = byKey.get(key);
    if (!r) return `${monthName(key)}: outside the record`;
    const v = cellValue(r, series);
    const parts = [monthName(key)];
    if (v == null) parts.push(series === 'harm' ? 'no harmonized value (no satellite data in the archive)' : 'no raw value');
    else {
      parts.push(`${fmtInt(v)} fire cell-days${series === 'harm' ? ' on the harmonized scale' : ', raw as recorded'}`);
      if (series === 'harm' && r.H_lo != null && r.H_hi != null && Math.round(r.H_lo) !== Math.round(r.H_hi)) {
        parts.push(`likely ${fmtInt(r.H_lo)} to ${fmtInt(r.H_hi)}`);
      }
    }
    parts.push(OBS_WORDS[obsState(r, computed)]);
    if (isProvisional(r)) parts.push('provisional');
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
    let s = 0, any = false, prov = false;
    for (let m = 1; m <= 12; m++) {
      const r = byKey.get(ym(y, m));
      const v = r ? cellValue(r, series) : null;
      if (v != null) { s += v; any = true; }
      if (r && isProvisional(r)) prov = true;
    }
    return { s, any, prov };
  };
  const table = useMemo(() => ({
    columns: ['Year', ...MONTHS_SHORT, 'Total'],
    rows: years.map((y) => {
      let s = 0;
      const cells = MONTHS.map((_, i) => {
        const r = byKey.get(ym(y, i + 1));
        const v = r ? cellValue(r, series) : null;
        if (v != null) s += v;
        return v == null ? '–' : fmtInt(v);
      });
      return [String(y), ...cells, fmtInt(s)];
    }),
  }), [years, byKey, series]);

  return (
    <figure className="ka-rec-cal ui-figure">
      <figcaption className="ui-figure-head">
        <p className="ui-figure-title">{area}: every month, {years[0]} to {years[years.length - 1]}</p>
        <p className="ui-figure-subtitle">{unit}</p>
      </figcaption>
      <div className="ka-rec-cal-bar">
        <Segmented<Series> label="Series" value={series} onChange={onSeries}
          options={[
            { value: 'harm', label: 'Harmonized', title: 'VIIRS put on the Aqua MODIS scale, so every year shares one scale' },
            { value: 'raw', label: 'Raw', title: 'As recorded: MODIS to 2011, VIIRS from 2012. The 2012 jump is the change of satellite, not more fire' },
          ]} />
        <p className="ka-rec-cal-read" aria-hidden="true">{shown ? describe(shown) : ''}</p>
      </div>
      <div ref={grid} className="ka-rec-cal-grid" role="grid" aria-label={`Fire cell-days by month, ${area}, ${series === 'harm' ? 'harmonized' : 'raw'}`}
        onKeyDown={move} onPointerLeave={() => setHover(null)}>
        <div role="row" className="ka-rec-cal-row ka-rec-cal-headrow">
          <span role="columnheader" className="ka-rec-cal-y" />
          {MONTHS_SHORT.map((m, i) => (
            <span key={m} role="columnheader" className="ka-rec-cal-mh" aria-label={MONTHS[i]}>
              <span className="ka-rec-mh-l">{m}</span><span className="ka-rec-mh-s">{m[0]}</span>
            </span>
          ))}
          <span role="columnheader" className="ka-rec-cal-th">Total</span>
        </div>
        {years.map((y) => {
          const t = total(y);
          return (
            <div key={y} role="row" className={`ka-rec-cal-row${y === SEAM_YEAR ? ' is-seam' : ''}`}>
              <span role="rowheader" className="ka-rec-cal-y">{y}</span>
              {MONTHS.map((_, i) => {
                const key = ym(y, i + 1);
                const r = byKey.get(key);
                if (!r) return <span key={key} role="gridcell" className="ka-rec-cell is-out" aria-label={`${monthName(key)}: outside the record`} />;
                const v = cellValue(r, series);
                const obs = obsState(r, computed);
                return (
                  <button key={key} type="button" role="gridcell" data-key={key}
                    className="ka-rec-cell" data-step={v == null ? undefined : emberStep(v, max)} data-null={v == null ? '' : undefined}
                    data-obs={obs} data-prov={isProvisional(r) ? '' : undefined}
                    aria-selected={key === selected} tabIndex={key === focusKey ? 0 : -1} aria-label={describe(key)}
                    onClick={() => onSelect(key)} onPointerEnter={() => setHover(key)}>
                    <span className="ka-rec-cell-n">{v == null ? '–' : fmtCompact(v)}</span>
                  </button>
                );
              })}
              <span role="gridcell" className="ka-rec-cal-tot">{t.any ? `${fmtCompact(t.s)}${t.prov ? '*' : ''}` : '–'}</span>
            </div>
          );
        })}
      </div>
      <ul className="ka-rec-cal-legend" aria-label="Legend">
        <li className="ka-rec-ramp-item">
          <span>Fewer</span>
          <span className="ka-rec-ramp" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-step={i + 1} />)}</span>
          <span>more fire cell-days (log scale, same for Raw and Harmonized)</span>
        </li>
        <li><i className="ka-rec-lg" data-obs="partial" aria-hidden="true" />Partly seen: cloud hid part of the no-fire land</li>
        <li><i className="ka-rec-lg" data-obs="unobserved" aria-hidden="true" />Not seen: a low count here is not a measurement</li>
        <li><i className="ka-rec-lg" data-obs="good" aria-hidden="true" />Seen clearly</li>
        <li><i className="ka-rec-lg" data-obs="not-computed" aria-hidden="true" />Observability not computed</li>
        <li><i className="ka-rec-lg" data-prov="" aria-hidden="true" />Provisional (near real time){years.some((y) => total(y).prov) ? '; * total so far' : ''}</li>
      </ul>
      <p className="ka-rec-note">
        {anyObs
          ? `Observability is computed for ${obsCount} month${obsCount === 1 ? '' : 's'} of ${area} from the NASA MODIS Terra and Aqua daily FireMask (Second Sight's rule TRI-04: seen clearly if O is at least 0.6, partly if at least 0.3). Every other month is marked "not computed": it may be clear or cloudy, the record does not say.`
          : `Observability is not computed for ${area}: no month here is marked seen or not seen, so a low count can be a cloudy month.${obsElsewhere ? ` Months with cloud measured from the NASA MODIS FireMask are in ${obsElsewhere}.` : ''}`}
        {ratio != null ? ` Raw from 2012 is VIIRS, which counted ${fmt1(ratio)} fire cell-days for every one MODIS Aqua counted in the same months.` : ''}
      </p>
      <div className="ui-figure-foot">
        <p className="ui-figure-source">{source}</p>
        <FigureTableView table={table} />
      </div>
    </figure>
  );
}
