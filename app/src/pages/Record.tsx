// Project 4 (new file, not from Fire Harmony): "Indonesia record" (#/record), the main page of the integrated build.
// The record is Second Sight's harmonized fire cell-days (public/ss-data/, their own pipeline and validation); the
// blind zero is KalenderApi's (observability per month from the NASA MODIS FireMask, and Play the season day by day).
// Told as INTEGRATION.md's thesis: the jump (2012, MODIS to VIIRS) -> the fix (one scale, 90% range) -> the zero.
// Link: #/record?aoi=<aoi_id>&m=<YYYY-MM>&s=raw|harm. Every number is computed from the bundle (lib/record.ts); until
// public/ss-data/index.json exists every section says "not built yet".
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Callout, Card, Page, PageHeader, Section, Skeleton } from '../components/ui';
import { IconPlay } from '../components/icons';
import { BeforeAfterFigure } from '../components/record/BeforeAfter';
import { RecordCalendar } from '../components/record/RecordCalendar';
import { ThisMonth } from '../components/record/ThisMonth';
import { HowSure } from '../components/record/HowSure';
import {
  KALTENG, MONTHS_SHORT, SEASON_YEARS, aoiGroups, aoiName, beforeAfter, blindShare, dateOnly, loadFinding, loadIndex, loadMonthly,
  loadValidation, obsState, pct1, peakMonth, pooledRatio, seasonBuilt, sensorRatio, settle, shortVersion, ym,
  type AoiEntry, type Finding, type Load, type MonthRow, type RecordIndex, type Series, type Validation,
} from '../lib/record';
import '../styles/record.css';

interface Query { aoi: string | null; m: string | null; s: Series }

function readQuery(): Query {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const m = q.get('m');
  return { aoi: q.get('aoi'), m: m && /^\d{4}-\d{2}$/.test(m) ? m : null, s: q.get('s') === 'raw' ? 'raw' : 'harm' };
}
const onRecord = () => /^#\/record(\?|$)/.test(window.location.hash);

/** The view in the address (replaceState: no new history entry, no hashchange). */
function writeQuery(q: { aoi: string; m: string | null; s: Series }) {
  if (!onRecord()) return;
  const p = new URLSearchParams();
  p.set('aoi', q.aoi);
  if (q.m) p.set('m', q.m);
  if (q.s === 'raw') p.set('s', 'raw');
  const want = `#/record?${p.toString()}`;
  if (window.location.hash !== want) window.history.replaceState(window.history.state, '', want);
}

function useLoad<T>(make: (() => Promise<T>) | null, deps: unknown[]): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!make) return undefined;
    let live = true;
    setLoad({ state: 'loading' });
    settle(make(), (l) => { if (live) setLoad(l); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);
  return [load, () => setAttempt((a) => a + 1)];
}

const NOT_BUILT = 'The Second Sight bundle (public/ss-data/) is still being built by the data run. Nothing is shown here until it is in: no sample or placeholder numbers.';
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The state of a section that has no data to draw: loading, not built yet, or failed (with a retry). */
function State({ load, what, height = 200, retry }: { load: Load<unknown>; what: string; height?: number; retry: () => void }) {
  if (load.state === 'loading') {
    return <div className="ka-rec-state" role="status" aria-label={`Loading ${what}`}><Skeleton height={height} /></div>;
  }
  if (load.state === 'missing') {
    return (
      <div className="ka-rec-state ka-rec-empty" style={{ minHeight: Math.min(height, 160) }}>
        <p className="ka-rec-empty-title">Not built yet</p>
        <p className="ka-rec-note">{cap(what)} will appear here once the data run has written it.</p>
      </div>
    );
  }
  if (load.state === 'error') {
    return (
      <div className="ka-rec-state ka-rec-empty" role="alert">
        <p className="ka-rec-empty-title">{cap(what)} could not be loaded</p>
        <p className="ka-rec-note">{load.message}. Check the connection, then try again.</p>
        <button type="button" className="ui-btn" onClick={retry}>Try again</button>
      </div>
    );
  }
  return null;
}

export function Record() {
  const [query, setQuery] = useState<Query>(readQuery);
  useEffect(() => {
    const onHash = () => { if (onRecord()) setQuery(readQuery()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [index, retryIndex] = useLoad<RecordIndex>(loadIndex, []);
  const idx = index.state === 'ok' ? index.data : null;
  const aoi: AoiEntry | null = useMemo(() => {
    if (!idx) return null;
    return idx.aois.find((a) => a.aoi_id === query.aoi) ?? idx.aois.find((a) => a.aoi_id === KALTENG) ?? idx.aois[0] ?? null;
  }, [idx, query.aoi]);
  const unknownAoi = !!idx && !!query.aoi && aoi?.aoi_id !== query.aoi;

  const [monthly, retryMonthly] = useLoad<MonthRow[]>(aoi ? () => loadMonthly(aoi) : null, [aoi?.aoi_id]);
  const [national, retryNational] = useLoad<MonthRow[]>(idx ? () => {
    const n = idx.aois.find((a) => a.level === 'national');
    return n ? loadMonthly(n) : Promise.reject(new Error('no national area in index.json'));
  } : null, [idx]);
  const [validation, retryValidation] = useLoad<Validation>(idx ? loadValidation : null, [idx]);
  const [finding] = useLoad<Finding>(idx ? loadFinding : null, [idx]);
  const [seasons, setSeasons] = useState<number[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(SEASON_YEARS.map((y): Promise<number | null> => seasonBuilt(y).then((ok) => (ok ? y : null))))
      .then((ys) => { if (live) setSeasons(ys.filter((y): y is number => y !== null)); });
    return () => { live = false; };
  }, []);

  // without a bundle every section shows the index's state; with it, each its own file's
  const pending: Load<unknown> = index.state === 'ok' ? { state: 'loading' } : index;
  const rows = monthly.state === 'ok' ? monthly.data : null;
  const rowsLoad: Load<unknown> = index.state !== 'ok' ? pending : monthly;
  const retryRows = index.state === 'error' ? retryIndex : retryMonthly;

  const area = aoi ? aoiName(aoi) : 'Central Kalimantan';
  const ba = useMemo(() => (rows ? beforeAfter(rows) : null), [rows]);
  const calFrom = idx?.calibration_window?.[0] ?? 2012, calTo = idx?.calibration_window?.[1] ?? 2021;
  const ratio = useMemo(() => (rows ? sensorRatio(rows, [calFrom, calTo]) : null), [rows, calFrom, calTo]);
  const pooled = useMemo(() => (rows ? pooledRatio(rows) : null), [rows]);
  // Play the season at the first day of a month, for Central Kalimantan's built season years (Aug to Oct)
  const seasonHref = useCallback((key: string) => {
    const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
    if (aoi?.aoi_id !== KALTENG || m < 8 || m > 10 || !seasons?.includes(y)) return null;
    return `#/season?${y === 2019 ? '' : `y=${y}&`}d=${key}-01`;
  }, [aoi, seasons]);
  const computed = useMemo(() => {
    if (!idx || !aoi || !idx.obs_months) return null;
    return new Set(idx.obs_months[aoi.aoi_id] ?? []);
  }, [idx, aoi]);
  const obsElsewhere = useMemo(() => {
    if (!idx?.obs_months || !aoi) return null;
    const other = Object.keys(idx.obs_months).find((k) => k !== aoi.aoi_id && (idx.obs_months?.[k]?.length ?? 0) > 0);
    const e = other ? idx.aois.find((a) => a.aoi_id === other) : null;
    return e ? aoiName(e) : null;
  }, [idx, aoi]);

  const series = query.s;
  const selected = useMemo(() => {
    if (!rows) return null;
    if (query.m && rows.some((r) => ym(r.year, r.month) === query.m)) return query.m;
    const last = rows[rows.length - 1];
    return peakMonth(rows) ?? (last ? ym(last.year, last.month) : null);
  }, [rows, query.m]);

  // keep the address in step with the view
  useEffect(() => {
    if (aoi) writeQuery({ aoi: aoi.aoi_id, m: query.m, s: series });
  }, [aoi, query.m, series]);
  const set = (patch: Partial<Query>) => setQuery((q) => ({ ...q, ...patch }));

  const built = dateOnly(idx?.generated_at);
  const version = shortVersion(idx?.data_version);
  // a province's values from 2022 come from project 4's re-export with a fix to the province ratios (docs/DATA.md 9.1):
  // they are not the numbers Second Sight's own export gives for those months
  const provNote = aoi?.level === 'province'
    ? ' Province values from 2022 use the island-region ratios with a 90% range, from project 4\'s fix to the export; Second Sight\'s own export gives other numbers for those months (one national ratio, no range).'
    : '';
  const source = `Source: NASA FIRMS archives (MODIS C6.1 Terra and Aqua, VIIRS 375 m S-NPP and NOAA-20), counted and harmonized by Second Sight (MIT).${version ? ` Bundle ${version}` : ''}${built ? `, built ${built}` : ''}${version || built ? '.' : ''}${provNote}`;
  const unit = 'Fire cell-days a month: 0.01 degree cells (about 1 km) with a hotspot on a local date, counted per satellite and per day or night pass. Harmonized values are on the Aqua MODIS scale.';
  const calSource = `${source} Observability: NASA MODIS MOD14A1 and MYD14A1 C6.1 daily FireMask, classed with Second Sight's rule TRI-04.`;

  const picker = (
    <label className="ka-rec-picker">
      <span>Area</span>
      <select value={aoi?.aoi_id ?? KALTENG} disabled={!idx} onChange={(e) => set({ aoi: e.target.value, m: null })}>
        {idx ? aoiGroups(idx.aois).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((a) => <option key={a.aoi_id} value={a.aoi_id}>{aoiName(a)}</option>)}
          </optgroup>
        )) : <option value={KALTENG}>Central Kalimantan</option>}
      </select>
    </label>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Indonesia record"
        title="Indonesia's fire record, on one scale"
        lead={<>When VIIRS joined MODIS in 2012, the raw fire record jumped: the sharper satellite counts more of the same
          fires. Second Sight's harmonization puts every year on the Aqua MODIS scale, with a 90% range. Where cloud hid
          the ground, the calendar marks the month: a zero there is a blind zero, not a measurement.</>}
        actions={<>{picker}<a className="ka-head-story ui-press" href="#/story"><IconPlay size={13} /><span>Watch the story</span></a></>}
      />

      {index.state === 'missing' ? (
        <Callout title="The Indonesia record is not built yet">
          <p>{NOT_BUILT}</p>
          <p>Meanwhile: <a href="#/season">play the 2019 season</a> (Central Kalimantan, the blind zeros day by day),
            watch the <a href="#/story">story</a>, or open Fire Harmony's <a href="#/">global context</a>.</p>
        </Callout>
      ) : null}
      {unknownAoi ? <p className="ka-rec-note" role="status">The area "{query.aoi}" is not in the bundle; showing {area}.</p> : null}

      <Section id="jump" title="Before and after" subtitle="The jump in 2012, and the fix: the same record stitched as recorded, added together, and harmonized">
        {rows && ba ? (
          <BeforeAfterFigure area={area} ba={ba} source={source} ratio={ratio} pooled={pooled}
            finding={aoi?.level === 'national' && finding.state === 'ok' ? finding.data : null} />
        ) : rows ? <p className="ka-rec-note">Too few years in {area} to compare.</p> : (
          <ChartFrame title={`${area}: the record before and after harmonization`} unit="Fire cell-days a year, each line indexed to its own 2003 to 2011 mean (= 100). Band: the harmonized line's 90% range." source={source}>
            <State load={rowsLoad} what="the before and after chart" height={360} retry={retryRows} />
          </ChartFrame>
        )}
        {aoi && aoi.level !== 'national' && national.state === 'ok' ? <NationalLine rows={national.data} window_={[calFrom, calTo]} /> : null}
        {aoi && aoi.level !== 'national' && national.state === 'error' ? (
          <p className="ka-rec-note">The line for Indonesia as a whole could not be loaded ({national.message}). <button type="button" className="ka-rec-link" onClick={retryNational}>Try again</button></p>
        ) : null}
      </Section>

      <Section id="calendar" title="Every month" subtitle="Colour is fire. Hatching is cloud: the months the satellites could not see the ground">
        {rows ? (
          <RecordCalendar rows={rows} area={area} series={series} onSeries={(s) => set({ s })}
            selected={selected} onSelect={(m) => set({ m })} computed={computed} obsElsewhere={obsElsewhere}
            ratio={ratio?.ratio ?? null} unit={unit} source={calSource} seasonHref={seasonHref} />
        ) : (
          <ChartFrame title={`${area}: every month`} unit={unit} source={calSource}>
            <State load={rowsLoad} what="the calendar" height={420} retry={retryRows} />
          </ChartFrame>
        )}
        {rows && selected && aoi ? (
          <ThisMonth rows={rows} selected={selected} aoiId={aoi.aoi_id} computed={computed} seasons={seasons ?? []} />
        ) : (
          <Card title="This month" subtitle="One sentence for the month picked in the calendar">
            <State load={rowsLoad} what="the month's sentence" height={64} retry={retryRows} />
          </Card>
        )}
      </Section>

      {(aoi?.aoi_id ?? KALTENG) === KALTENG ? (
        <Section id="zero" title="The zero, day by day" subtitle="Central Kalimantan, 1 August to 31 October: each day's NASA photo, its VIIRS hotspots, and the zeros Terra and Aqua could not see">
          <div className="ka-rec-seasons">
            {SEASON_YEARS.map((y) => {
              const ok = seasons?.includes(y) ?? false;
              // the season's months as the record classes them: seen clearly, partly or not, and how much cloud
              const words = rows ? [8, 9, 10].flatMap((m) => {
                const r = rows.find((x) => x.year === y && x.month === m);
                const s = r ? obsState(r, computed) : null;
                if (!r || !s || s === 'not-computed') return [];
                const b = blindShare(r);
                return [`${MONTHS_SHORT[m - 1]} ${s === 'good' ? 'seen clearly' : s === 'partial' ? 'partly seen' : 'not seen'}${b != null ? `, ${pct1(b)} blind` : ''}`];
              }) : [];
              const body = (
                <>
                  <span className="ka-rec-season-y">{y}</span>
                  <span className="ka-rec-season-t">{seasons === null ? 'Checking' : ok ? 'Play the season' : 'Not built yet'}</span>
                  <span className="ka-rec-season-n">{words.length ? words.join(' · ') : ok ? '1 Aug to 31 Oct, one real day per frame' : 'The day-by-day files of this year are still being built.'}</span>
                </>
              );
              return ok ? (
                <a key={y} className="ka-rec-season ui-press" href={y === 2019 ? '#/season' : `#/season?y=${y}`}>{body}<IconPlay size={16} /></a>
              ) : (
                <div key={y} className="ka-rec-season is-off">{body}</div>
              );
            })}
          </div>
          {rows ? <MonthVsDay rows={rows} computed={computed} /> : null}
        </Section>
      ) : null}

      <Section id="sure" title="How sure" subtitle="Second Sight's validation: errors on years the fit never saw, and every pre-written test, failures included">
        {validation.state === 'ok' ? <HowSure v={validation.data} /> : (
          <ChartFrame title="Error on years the fit never saw" unit="Absolute percentage error of the yearly total, raw against harmonized." source="Source: Second Sight's validation run (validation_results.json).">
            <State load={index.state !== 'ok' ? pending : validation} what="the validation results" height={230} retry={index.state === 'error' ? retryIndex : retryValidation} />
          </ChartFrame>
        )}
      </Section>
    </Page>
  );
}

/** A chart's frame (title, unit line, source line) around a state that has nothing to draw yet. */
function ChartFrame({ title, unit, source, children }: { title: string; unit: string; source: string; children: ReactNode }) {
  return (
    <figure className="ui-figure ka-rec-frame">
      <figcaption className="ui-figure-head">
        <p className="ui-figure-title">{title}</p>
        <p className="ui-figure-subtitle">{unit}</p>
      </figcaption>
      {children}
      <div className="ui-figure-foot"><p className="ui-figure-source">{source}</p></div>
    </figure>
  );
}

/** Why the season plays day by day: a month can be "seen clearly" on average while single days were blind. Only the
 *  range of the computed months' O and cloud share, from the bundle. */
function MonthVsDay({ rows, computed }: { rows: MonthRow[]; computed: Set<string> | null }) {
  const obs = rows.filter((r) => obsState(r, computed) !== 'not-computed' && r.O != null && r.f_cloud != null);
  if (!obs.length) return null;
  const os = obs.map((r) => r.O!), cs = obs.map((r) => r.f_cloud!);
  const allGood = obs.every((r) => r.obs_class === 'good');
  return (
    <p className="ka-rec-note">
      {allGood ? 'Month by month, Terra and Aqua saw these seasons clearly' : 'Month by month, these seasons range from seen clearly to not seen'}
      {' '}(O from {Math.min(...os).toFixed(2)} to {Math.max(...os).toFixed(2)}), yet {pct1(Math.min(...cs))} to {pct1(Math.max(...cs))} of
      each month's no-fire cell-days were blind zeros, seen only under cloud. A month's average also hides its worst days:
      on a single cloudy day a large share of the zeros can be blind, which is why the season plays one day at a time.
    </p>
  );
}

/** For a region or a province: the same comparison for Indonesia as a whole, in one line. */
function NationalLine({ rows, window_ }: { rows: MonthRow[]; window_: [number, number] }) {
  const ba = useMemo(() => beforeAfter(rows), [rows]);
  const r = useMemo(() => sensorRatio(rows, window_), [rows, window_[0], window_[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ba || ba.changeNaive == null || ba.changeH == null) return null;
  const s = (x: number) => `${x >= 0 ? 'rises' : 'falls'} ${Math.round(Math.abs(x))}%`;
  return (
    <p className="ka-rec-note">
      Indonesia as a whole (mean of 2019 to 2023 against 2003 to 2007): stitched as recorded, fire {s(ba.changeNaive)}; on one scale it {s(ba.changeH)}.
      {r ? ` VIIRS counted ${r.ratio.toFixed(1)} fire cell-days for each MODIS Aqua one in the same months of ${r.from} to ${r.to}.` : ''}
    </p>
  );
}
