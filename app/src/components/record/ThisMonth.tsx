// KalenderApi: "This month", the tile at the top of the record page. It opens on the latest month of the record and
// follows the month picked in the calendar. In reading order: the month and whether it is provisional; its count on
// the harmonized (Aqua MODIS) scale against the median of the same calendar month; then the range, the rank and the
// raw count; then, for months that have it, what the cloud layer measured.
// Fourth round (after the science review): the cloud layer is described by what it measures (cloud flags of the MODIS
// daily fire mask; thick smoke is not flagged), never as the ground having been seen. No statistic is added here: the
// numbers are the ones this card has always shown (lib/record.ts monthVerdict and the month's own row).
import { Badge, Card } from '../ui';
import {
  HELD, KALTENG, inRange, isProvisional, monthVerdict, noInterval, obsState, rawSpliced, ym, type MonthRow,
} from '../../lib/record';
import { MIN_EARLIER_YEARS, STATUS_CUTS, monthStatus } from '../../lib/robust';
import { fmtNumber, monthName, useLang, useTr } from '../../lib/lang';
import '../../styles/robust.css';

export function ThisMonth({ rows, selected, aoiId, computed, seasons }: {
  rows: MonthRow[]; selected: string; aoiId: string; computed: Set<string> | null;
  seasons: number[];   // the season years built for Play the season
}) {
  const tr = useTr();
  const lang = useLang();
  const n0 = (x: number) => fmtNumber(Math.round(x), lang);
  const n1 = (x: number) => fmtNumber(x, lang, 1);
  const share = (x: number) => `${fmtNumber(Math.round(x * 1000) / 10, lang, 1)}%`;
  const v = monthVerdict(rows, selected);
  const y = Number(selected.slice(0, 4)), m = Number(selected.slice(5, 7));
  const row = rows.find((r) => r.year === y && r.month === m) ?? null;
  const month = monthName(m, lang, 'long');
  const name = `${month} ${y}`;
  const obs = row ? obsState(row, computed) : null;
  const provisional = row ? isProvisional(row) : false;
  const seasonLink = aoiId === KALTENG && m >= 8 && m <= 10 && seasons.includes(y)
    ? `#/season?${y === 2019 ? '' : `y=${y}&`}d=${ym(y, m)}-01` : null;
  const raw = row ? rawSpliced(row) : null;
  // The status label: only from the record's own rank of this month among the same month of earlier years (pct_rank).
  // No label without a rank, with fewer than MIN_EARLIER_YEARS earlier years, or for the months of Central Kalimantan
  // that a registered test covers (January to October 2019: no new statistic there, lib/record.ts HELD).
  const held = aoiId === KALTENG && inRange(selected, HELD);
  const earlier = rows.filter((r) => r.month === m && r.year < y && r.H != null).length;
  const rank = row?.pct_rank ?? null;
  const status = !held && earlier >= MIN_EARLIER_YEARS ? monthStatus(rank) : null;
  const statusWord = status === 'below' ? tr('Below normal', 'Di bawah normal')
    : status === 'near' ? tr('Near normal', 'Mendekati normal')
      : status === 'above' ? tr('Above normal', 'Di atas normal')
        : status === 'far-above' ? tr('Far above normal', 'Jauh di atas normal') : '';
  const statusTone = status === 'far-above' ? 'serious' : status === 'above' ? 'warning' : 'neutral';
  const cut = (i: 0 | 1 | 2) => `${fmtNumber(STATUS_CUTS[i] * 100, lang)}%`;
  const heldSpan = `${monthName(Number(HELD.from.slice(5, 7)), lang, 'long')} ${tr('to', 'sampai')} ${monthName(Number(HELD.to.slice(5, 7)), lang, 'long')} ${HELD.to.slice(0, 4)}`;
  const obsWord = obs === 'good' ? tr('No cloud flag on most cell-days', 'Tanpa penanda awan pada sebagian besar sel-hari')
    : obs === 'partial' ? tr('Cloud flag or missing data on a large share of cell-days', 'Penanda awan atau data kosong pada sebagian besar sel-hari')
      : tr('No cloud-free look on most cell-days', 'Tanpa pengamatan bebas awan pada sebagian besar sel-hari');

  return (
    <Card
      title={<span className="ka-month-title">{name}{provisional ? <Badge tone="warning">{tr('Provisional', 'Sementara')}</Badge> : null}</span>}
      subtitle={tr('Fire cell-days this month, against the median of the same month', 'Sel-hari api bulan ini, dibanding median bulan yang sama')}
    >
      {provisional && row ? (
        <p className="ka-rec-note ka-month-prov">
          {row.flag_partial
            ? tr('Provisional: the month is not over and the data are near-real-time, so this count will change.', 'Sementara: bulan ini belum selesai dan datanya masih hampir waktu nyata, sehingga hitungan ini akan berubah.')
            : tr('Provisional: near-real-time data, which may change.', 'Sementara: data hampir waktu nyata, yang masih dapat berubah.')}
        </p>
      ) : null}
      {!row ? (
        <p className="ka-rec-month">{tr(`${name} is outside the record.`, `${name} berada di luar rekaman.`)}</p>
      ) : !v ? (
        <p className="ka-rec-month">
          {tr(`${name} has no harmonized value in the record`, `${name} tidak punya nilai terharmonisasi dalam rekaman`)}
          {raw != null ? tr(`; the raw record has ${n0(raw)} fire cell-days`, `; rekaman mentah mencatat ${n0(raw)} sel-hari api`) : ''}.
        </p>
      ) : (
        <>
          <div className="ka-month-lead">
            <p className="ka-month-stat">
              <strong className="ka-rec-num">{n0(v.H)}</strong>
              <span>{tr('fire cell-days, harmonized (Aqua MODIS scale)', 'sel-hari api, terharmonisasi (skala Aqua MODIS)')}</span>
              {status ? <Badge tone={statusTone}>{statusWord}{provisional ? tr(', provisional', ', sementara') : ''}</Badge> : null}
            </p>
            {v.ratio != null ? (
              <p className="ka-month-stat">
                <strong className="ka-rec-num">{n1(v.ratio)}×</strong>
                <span>{tr(`the median ${month}`, `median bulan ${month}`)}</span>
              </p>
            ) : (
              <p className="ka-month-stat"><span>{tr(`No median ${month} to compare with.`, `Tidak ada median bulan ${month} untuk pembanding.`)}</span></p>
            )}
          </div>
          {status && rank != null ? (
            <p className="ka-rob-how">
              {tr(
                `${statusWord}: ${name} ranks above ${share(rank)} of the same month in the ${earlier} earlier years of this record. Under ${cut(0)} reads "below normal", ${cut(0)} to under ${cut(1)} "near normal", ${cut(1)} to under ${cut(2)} "above normal", ${cut(2)} or more "far above normal".`,
                `${statusWord}: ${name} berada di atas ${share(rank)} dari bulan yang sama pada ${earlier} tahun sebelumnya dalam rekaman ini. Di bawah ${cut(0)} disebut "di bawah normal", ${cut(0)} sampai kurang dari ${cut(1)} "mendekati normal", ${cut(1)} sampai kurang dari ${cut(2)} "di atas normal", ${cut(2)} atau lebih "jauh di atas normal".`)}
              {provisional ? tr(
                ` The month is provisional${row.flag_partial ? ' and not over' : ''}, so the label may change.`,
                ` Bulan ini masih sementara${row.flag_partial ? ' dan belum selesai' : ''}, sehingga label dapat berubah.`) : ''}
            </p>
          ) : held ? (
            <p className="ka-rob-how">
              {tr(`No status label for this month: a registered test covers Central Kalimantan for ${heldSpan}, and we add no new statistic for those months until it is run.`,
                `Tidak ada label status untuk bulan ini: sebuah uji terdaftar mencakup Kalimantan Tengah untuk ${heldSpan}, dan kami tidak menambah statistik baru untuk bulan-bulan itu sampai uji tersebut dijalankan.`)}
            </p>
          ) : rank != null && earlier < MIN_EARLIER_YEARS ? (
            <p className="ka-rob-how">
              {tr(`No status label: the record has fewer than ${MIN_EARLIER_YEARS} earlier years for this month.`,
                `Tidak ada label status: rekaman ini punya kurang dari ${MIN_EARLIER_YEARS} tahun sebelumnya untuk bulan ini.`)}
            </p>
          ) : null}
          <p className="ka-rec-note">
            {v.lo != null && v.hi != null && Math.round(v.lo) !== Math.round(v.hi)
              ? tr(`Likely ${n0(v.lo)} to ${n0(v.hi)} (9 in 10). `, `Kemungkinan ${n0(v.lo)} sampai ${n0(v.hi)} (9 dari 10). `)
              : noInterval(row) ? tr('No 90% range: converted with one national ratio. ', 'Tanpa rentang 90%: dikonversi dengan satu rasio nasional. ') : ''}
            {tr(`Rank ${n0(v.rank)} of ${n0(v.of)} years for ${month}.`, `Peringkat ${n0(v.rank)} dari ${n0(v.of)} tahun untuk bulan ${month}.`)}
            {v.raw != null ? tr(` Raw as recorded: ${n0(v.raw)}.`, ` Mentah apa adanya: ${n0(v.raw)}.`) : ''}
          </p>
        </>
      )}
      {row && obs ? (
        obs === 'not-computed' ? (
          <p className="ka-rec-note">
            {tr('Cloud cover was not computed for this month: the record does not say how much of the ground had a cloud-free look.',
              'Tutupan awan tidak dihitung untuk bulan ini: rekaman tidak menyatakan seberapa banyak permukaan yang mendapat pengamatan bebas awan.')}
          </p>
        ) : (
          <p className="ka-rec-note" data-obs={obs}>
            <span className="ka-rec-obs-word">{obsWord}</span>
            {row.O != null ? tr(` (score ${fmtNumber(row.O, lang, 2)} of 1)`, ` (skor ${fmtNumber(row.O, lang, 2)} dari 1)`) : ''}.
            {row.f_cloud != null ? <>{' '}<strong className="ka-rec-num">{share(row.f_cloud)}</strong>{tr(' of the no-fire cell-days had no cloud-free look', ' dari sel-hari tanpa api tidak mendapat pengamatan bebas awan')}</> : null}
            {row.f_missing != null ? tr(`${row.f_cloud != null ? ', and' : ''} ${share(row.f_missing)} of land cell-days had no usable data`, `${row.f_cloud != null ? ', dan' : ''} ${share(row.f_missing)} dari sel-hari daratan tidak punya data yang dapat dipakai`) : ''}
            {row.f_cloud != null || row.f_missing != null ? tr(' (NASA MODIS Terra and Aqua daily fire mask).', ' (masker api harian NASA MODIS Terra dan Aqua).') : ''}
            {tr(' Thick smoke is not flagged as cloud, so a cell-day without a cloud flag is not proof that the ground was visible.',
              ' Asap tebal tidak ditandai sebagai awan, sehingga sel-hari tanpa penanda awan bukan bukti bahwa permukaan terlihat.')}
          </p>
        )
      ) : null}
      {seasonLink ? (
        <p className="ka-rec-note">
          <a href={seasonLink}>{tr('Play this month day by day', 'Putar bulan ini hari demi hari')}</a>
          {tr(' (each day\'s NASA image, its hotspots and the cells with no cloud-free look).', ' (citra NASA tiap hari, titik panasnya, dan sel tanpa pengamatan bebas awan).')}
        </p>
      ) : null}
    </Card>
  );
}
