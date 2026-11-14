// Project 4 (new file): "This month", one sentence for the month picked in the record's calendar, with Second Sight's
// numbers (vendor/second-sight/app/src/bulan.ts: the harmonized count, its ratio to the median of the same calendar
// month, its rank) and, for months whose observability was computed, how much of the ground cloud hid (the blind zero
// at the scale of a month). For Central Kalimantan, Aug to Oct of a built season year links to Play the season.
import { Card } from '../ui';
import {
  KALTENG, MONTHS, fmtInt, fmt1, isProvisional, monthVerdict, noInterval, obsState, pct1, rawSpliced, ym, type MonthRow,
} from '../../lib/record';

export function ThisMonth({ rows, selected, aoiId, computed, seasons }: {
  rows: MonthRow[]; selected: string; aoiId: string; computed: Set<string> | null;
  seasons: number[];   // the season years built for Play the season
}) {
  const v = monthVerdict(rows, selected);
  const y = Number(selected.slice(0, 4)), m = Number(selected.slice(5, 7));
  const row = rows.find((r) => r.year === y && r.month === m) ?? null;
  const name = `${MONTHS[m - 1]} ${y}`;
  const obs = row ? obsState(row, computed) : null;
  const seasonLink = aoiId === KALTENG && m >= 8 && m <= 10 && seasons.includes(y)
    ? `#/season?${y === 2019 ? '' : `y=${y}&`}d=${ym(y, m)}-01` : null;

  return (
    <Card title="This month" subtitle="Click a month in the calendar, or use the arrow keys">
      {!row ? (
        <p className="ka-rec-month">{name} is outside the record.</p>
      ) : !v ? (
        <p className="ka-rec-month">
          <strong>{name}</strong> has no harmonized value: the satellite of that era has no data in the archive for this
          month{rawSpliced(row) != null ? `, though ${fmtInt(rawSpliced(row)!)} raw fire cell-days were recorded` : ''}.
        </p>
      ) : (
        <p className="ka-rec-month">
          <strong>{name}</strong>: <strong className="ka-rec-num">{fmtInt(v.H)}</strong> fire cell-days on the harmonized scale
          {v.lo != null && v.hi != null && Math.round(v.lo) !== Math.round(v.hi)
            ? <> (likely {fmtInt(v.lo)} to {fmtInt(v.hi)}, 9 in 10)</>
            : noInterval(row) ? <> (no 90% range: converted with one national ratio)</> : null}
          {v.ratio != null ? <>, <strong className="ka-rec-num">{fmt1(v.ratio)}×</strong> the median {MONTHS[m - 1]}</> : null}
          , rank <strong className="ka-rec-num">{fmtInt(v.rank)}</strong> of {fmtInt(v.of)} years.
          {v.raw != null ? <> Raw as recorded: {fmtInt(v.raw)}.</> : null}
        </p>
      )}
      {row && obs ? (
        obs === 'not-computed' ? (
          <p className="ka-rec-note">Observability for this month is not computed: the record does not say whether cloud hid the ground.</p>
        ) : (
          <p className="ka-rec-note" data-obs={obs}>
            <span className="ka-rec-obs-word">{obs === 'good' ? 'Seen clearly' : obs === 'partial' ? 'Partly seen' : 'Not seen'}</span>
            {row.O != null ? <> (O = {row.O.toFixed(2)})</> : null}.
            {row.f_cloud != null ? <>{obs === 'good' ? ' Still, ' : ' '}<strong className="ka-rec-num">{pct1(row.f_cloud)}</strong> of the no-fire cell-days were blind zeros: Terra and Aqua saw only cloud there</> : null}
            {row.f_missing != null ? <>{row.f_cloud != null ? ', and' : ''} {pct1(row.f_missing)} of land cell-days had no usable look</> : null}
            {row.f_cloud != null || row.f_missing != null ? ' (NASA MODIS Terra and Aqua daily FireMask).' : ''}
          </p>
        )
      ) : null}
      {row && isProvisional(row) ? <p className="ka-rec-note">Provisional: near-real-time data, which may change.</p> : null}
      {seasonLink ? <p className="ka-rec-note"><a href={seasonLink}>Play this month day by day</a> (that day's NASA photo, its hotspots and its blind zeros).</p> : null}
    </Card>
  );
}
