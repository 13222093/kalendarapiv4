// "Detected and reported" (KalenderApi addition to Fire Harmony, Apache-2.0): for Central Kalimantan, the hotspots the
// harmonized satellite record counts each year, next to the burned area the Ministry of Forestry reports (SiPongi+).
// The two measure different things (a count of thermal detections; an area on the ground after checks), so each row
// has its own scale and nothing divides or ranks one by the other. Official numbers come from
// public/ka-data/reported_kalteng.json (every value with its source; a year without a verified value is null).
import { useEffect, useMemo, useState } from 'react';
import { seriesFile, type SeriesFile } from '../lib/web';
import { formatNumber, useI18n } from '../lib/i18n';
import { Card } from './ui';
import '../styles/reported.css';

interface ReportedSource { id: string; title: string; url: string; publisher: string; type: 'official' | 'secondary' }
interface ReportedYear {
  year: number;
  burned_area_ha: number | null;
  official_hotspots: number | null;
  source_ids: string[];
  short_note?: string;
}
interface ReportedFile { area: string; accessed: string; sources: ReportedSource[]; years: ReportedYear[] }

const FIRST = 2015;
const LAST = 2025;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const DATA_PATH = `${import.meta.env.BASE_URL}ka-data/reported_kalteng.json`;

let reportedPromise: Promise<ReportedFile> | null = null;
function loadReported(): Promise<ReportedFile> {
  if (!reportedPromise) {
    reportedPromise = fetch(DATA_PATH).then(async (r) => {
      if (!r.ok) throw new Error(`reported_kalteng.json: HTTP ${r.status}`);
      return (await r.json()) as ReportedFile;
    });
    reportedPromise.catch(() => { reportedPromise = null; });
  }
  return reportedPromise;
}

/** Harmonized hotspots per calendar year from a place's monthly series (field h). A year with an unknown month
 *  (h null) has no total; a month without a row had no fire (as lib/data.ts fill() reads it). */
function yearlyDetected(f: SeriesFile | null): Map<number, number | null> {
  const out = new Map<number, number | null>(YEARS.map((y) => [y, 0]));
  if (!f) return out;
  f.ym.forEach((v, i) => {
    const y = Math.floor(v / 100);
    if (!out.has(y)) return;
    const h = f.h[i];
    const cur = out.get(y);
    out.set(y, h === null || cur === null || cur === undefined ? null : cur + h);
  });
  return out;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 2 });
const accessedLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

type Row = { year: number; detected: number | null; reported: number | null; note?: string };

function Bars({ rows, pick, tone, unit }: {
  rows: Row[]; pick: (r: Row) => number | null; tone: 'detected' | 'reported'; unit: string;
}) {
  const max = Math.max(0, ...rows.map((r) => pick(r) ?? 0));
  return (
    <div className="ka-rep-bars">
      {rows.map((r) => {
        const v = pick(r);
        const pct = v === null || max <= 0 ? 0 : (v / max) * 100;
        const tip = v === null ? `${r.year}: no verified figure` : `${r.year}: ${formatNumber(v, 'en')} ${unit}`;
        return (
          <div key={r.year} className="ka-rep-col" title={tip}>
            <span className={`ka-rep-val${v === null ? ' is-none' : ''}`}>{v === null ? 'n/a' : compact.format(v)}</span>
            {v === null
              ? <span className="ka-rep-bar is-none" />
              : <span className={`ka-rep-bar is-${tone}`} style={{ height: `max(2px, calc(var(--ka-rep-bar-h) * ${(pct / 100).toFixed(4)}))` }} />}
          </div>
        );
      })}
    </div>
  );
}

export function ReportedCard() {
  const { lang } = useI18n();
  const [reported, setReported] = useState<ReportedFile | null>(null);
  const [series, setSeries] = useState<SeriesFile | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadReported(), seriesFile('state', 'IDN-1931')])
      .then(([r, s]) => { if (live) { setReported(r); setSeries(s); } })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const rows = useMemo<Row[] | null>(() => {
    if (!reported || series === undefined) return null;
    const detected = yearlyDetected(series);
    const byYear = new Map(reported.years.map((y) => [y.year, y]));
    return YEARS.map((year) => {
      const d = detected.get(year);
      const o = byYear.get(year);
      return { year, detected: d === null || d === undefined ? null : Math.round(d), reported: o?.burned_area_ha ?? null, note: o?.short_note };
    });
  }, [reported, series]);

  const sources = reported?.sources ?? [];
  const primary = sources.find((s) => s.id === 'sipongi_luas');
  const missing = rows?.filter((r) => r.reported === null) ?? [];
  const anyOfficialHotspots = reported?.years.some((y) => y.official_hotspots !== null) ?? false;

  return (
    <Card title="Detected and reported" subtitle="Central Kalimantan (Kalimantan Tengah), 2015 to 2025" className="ka-rep">
      <p className="ka-rep-lead">
        Satellites count <strong>hotspots</strong>: spots that looked hotter than their surroundings when a satellite
        passed. The government reports <strong>burned area</strong> in hectares, mapped from Landsat images with the
        hotspots as a guide and then checked on the ground. They measure different things, so they are shown side by
        side, not compared as if equal.
      </p>

      {error ? <p className="ka-rep-note">The figures could not be loaded. Check the connection and open the place again.</p> : null}
      {!error && !rows ? <div className="ka-rep-loading" aria-busy="true" aria-label="Loading detected and reported figures" /> : null}

      {rows ? (
        <>
          <div className="ka-rep-chart" aria-hidden="true">
            <p className="ka-rep-label"><span className="ka-rep-key is-detected" />Detected <span className="ka-rep-unit">hotspots per year, harmonized MODIS and VIIRS (this app)</span></p>
            <Bars rows={rows} pick={(r) => r.detected} tone="detected" unit="hotspots" />
            <p className="ka-rep-label"><span className="ka-rep-key is-reported" />Reported <span className="ka-rep-unit">burned area per year, hectares (SiPongi, Ministry of Forestry)</span></p>
            <Bars rows={rows} pick={(r) => r.reported} tone="reported" unit="ha" />
            <div className="ka-rep-years">
              {rows.map((r) => <span key={r.year}>{`'${String(r.year).slice(2)}`}</span>)}
            </div>
          </div>
          <p className="ka-rep-note">
            Each row has its own scale: read the pattern of the years, not the heights across rows.
            A dashed box marks a year with no verified figure.
          </p>

          {/* a div holds the hidden table: a table box ignores the 1 px size and overflow of .sr-only */}
          <div className="sr-only">
            <table>
              <caption>Detected hotspots and reported burned area, Central Kalimantan, 2015 to 2025</caption>
              <thead>
                <tr><th scope="col">Year</th><th scope="col">Detected hotspots (harmonized, this app)</th><th scope="col">Reported burned area, hectares (SiPongi)</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year}>
                    <th scope="row">{r.year}</th>
                    <td>{r.detected === null ? 'Not available' : formatNumber(r.detected, lang)}</td>
                    <td>{r.reported === null ? 'No verified figure' : formatNumber(r.reported, lang, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {missing.length ? (
            <ul className="ka-rep-missing">
              {missing.map((r) => <li key={r.year}><strong>{r.year}: no verified figure.</strong> {r.note ?? ''}</li>)}
            </ul>
          ) : null}
          {!anyOfficialHotspots ? (
            <p className="ka-rep-note">
              Official hotspot counts are not shown: SiPongi publishes hotspot lists for short periods (12 to 48 hours
              or one date), not a yearly total per province, and it filters hotspots by its own confidence classes.
            </p>
          ) : null}
        </>
      ) : null}

      {reported ? (
        <div className="ka-rep-sources">
          {primary ? (
            <p className="ka-rep-note">
              Reported figures: <a href={primary.url} target="_blank" rel="noreferrer">SIPONGI KEMENHUT, Indikasi Luas Kebakaran</a>,
              read on {accessedLabel(reported.accessed)}.
            </p>
          ) : null}
          <details className="ka-rep-more">
            <summary>All sources and checks ({sources.length + 1})</summary>
            <ul>
              {sources.map((s) => (
                <li key={s.id}>
                  <span className={`ka-rep-tag is-${s.type}`}>{s.type === 'official' ? 'Official' : 'Secondary'}</span>
                  <span className="ka-rep-src-pub">{s.publisher.split(' (')[0]}</span>
                  <a className="ka-rep-src-title" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                </li>
              ))}
              <li>
                <span className="ka-rep-tag is-app">This app</span>
                <span className="ka-rep-src-pub">Fire Harmony dataset v1.0 (CC BY 4.0)</span>
                <a className="ka-rep-src-title" href="https://huggingface.co/datasets/warrensaw530/fire-harmony" target="_blank" rel="noreferrer">
                  Harmonized monthly hotspots of Central Kalimantan (NASA FIRMS MODIS and VIIRS on one NOAA-20 scale), summed per year
                </a>
              </li>
            </ul>
            <p className="ka-rep-note">Secondary sources are news reports that quote SiPongi; they are used only to cross-check the
              official table, never as values. Every value and its source is in ka-data/reported_kalteng.json.</p>
          </details>
        </div>
      ) : null}
    </Card>
  );
}
