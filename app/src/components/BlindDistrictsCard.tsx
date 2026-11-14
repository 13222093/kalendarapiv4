// "Blind zeros by district" (KalenderApi addition to Fire Harmony, Apache-2.0): for Central Kalimantan, Aug to Oct 2019,
// the share of each district's no-fire land that Terra and Aqua saw only under cloud, on a map of the 14 districts and
// as a ranked list. The unit is the district (kabupaten), the unit the people who act on fires plan in; the numbers
// come from public/ka-data/visibility_kalteng_2019.json and the borders from kalteng_districts.json (both built by
// kalenderapi/scripts/build_visibility.py from the NASA MODIS daily FireMask and geoBoundaries).
import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui';
import '../styles/reported.css';

interface VisDistrict { name: string; T: number; U: number }
interface VisFile { districts: VisDistrict[]; days: unknown[] }
interface DistFile { districts: { name: string; rings: [number, number][][] }[] }
interface Row { name: string; share: number; label: string; path: string }

const BASE = import.meta.env.BASE_URL;
let loading: Promise<[VisFile, DistFile]> | null = null;
function load(): Promise<[VisFile, DistFile]> {
  if (!loading) {
    const get = <T,>(u: string) => fetch(`${BASE}ka-data/${u}`).then((r) => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json() as Promise<T>; });
    loading = Promise.all([get<VisFile>('visibility_kalteng_2019.json'), get<DistFile>('kalteng_districts.json')]);
    loading.catch(() => { loading = null; });
  }
  return loading;
}

/** A share in %, one decimal, rounded as the Season page rounds it. */
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0);
const W = 300;

export function BlindDistrictsCard() {
  const [files, setFiles] = useState<[VisFile, DistFile] | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    load().then((f) => { if (live) setFiles(f); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const view = useMemo(() => {
    if (!files) return null;
    const [vis, dist] = files;
    const shapes = new Map(dist.districts.map((d) => [d.name, d.rings]));
    const all = dist.districts.flatMap((d) => d.rings.flat());
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = W / (x1 - x0);
    const h = Math.round((y1 - y0) * k);
    const pt = (p: [number, number]) => `${((p[0] - x0) * k).toFixed(1)},${((y1 - p[1]) * k).toFixed(1)}`;
    const rows: Row[] = vis.districts.map((d) => {
      const share = pct(d.U, d.T + d.U);
      const rings = shapes.get(d.name) ?? [];
      return { name: d.name, share, label: `${share.toFixed(1)}%`, path: rings.map((r) => `M${r.map(pt).join('L')}Z`).join('') };
    }).sort((a, b) => b.share - a.share);
    const tot = vis.districts.reduce((s, d) => [s[0] + d.T, s[1] + d.U], [0, 0]);
    const lo = Math.min(...rows.map((r) => r.share)), hi = Math.max(...rows.map((r) => r.share));
    const alpha = (s: number) => (hi > lo ? 0.16 + (0.8 * (s - lo)) / (hi - lo) : 0.6);
    return { rows, h, alpha, hi, total: pct(tot[1], tot[0] + tot[1]), days: vis.days.length };
  }, [files]);

  return (
    <Card title="Blind zeros by district" subtitle="Central Kalimantan, 1 August to 31 October 2019" className="ka-rep ka-bz">
      <p className="ka-rep-lead">
        A <strong>blind zero</strong> is land where no fire was detected and Terra and Aqua never saw the ground that day,
        only cloud. The share is blind zeros out of all no-fire land{view ? `, over ${view.days} days` : ''}: a district
        with a high share has more zeros that are not a measurement.
      </p>
      {error ? <p className="ka-rep-note">The blind-zero files could not be loaded. Check the connection and open the place again.</p> : null}
      {!error && !view ? <div className="ka-rep-loading" aria-busy="true" aria-label="Loading blind zeros by district" /> : null}
      {view ? (
        <>
          <div className="ka-bz-body">
            <svg className="ka-bz-map" viewBox={`0 0 ${W} ${view.h}`} role="img"
              aria-label={`Map of the 14 districts of Central Kalimantan, shaded by their share of blind zeros, ${view.rows[view.rows.length - 1]!.label} to ${view.rows[0]!.label}`}>
              {view.rows.map((r) => (
                <path key={r.name} d={r.path} fillOpacity={view.alpha(r.share)}
                  className={hover === r.name ? 'is-on' : undefined}
                  onPointerEnter={() => setHover(r.name)} onPointerLeave={() => setHover(null)}>
                  <title>{`${r.name}: ${r.label} of no-fire land was a blind zero`}</title>
                </path>
              ))}
            </svg>
            <ol className="ka-bz-list">
              {view.rows.map((r) => (
                <li key={r.name} className={hover === r.name ? 'is-on' : undefined}
                  onPointerEnter={() => setHover(r.name)} onPointerLeave={() => setHover(null)}>
                  <span className="ka-bz-sw" style={{ opacity: view.alpha(r.share) }} aria-hidden="true" />
                  <span className="ka-bz-name">{r.name}</span>
                  <span className="ka-bz-val">{r.label}</span>
                  <span className="ka-bz-bar" aria-hidden="true"><i style={{ width: `${(r.share / view.hi) * 100}%` }} /></span>
                </li>
              ))}
            </ol>
          </div>
          <p className="ka-rep-note">
            All 14 districts together: <strong>{view.total.toFixed(1)}%</strong>. Smoke thin enough to be classed as clear
            land counts as seen, so the share of ground never seen can be higher. A seen zero is not proof that nothing
            burned either: small or smouldering peat fires can stay below the detection limit.
          </p>
          <p className="ka-rep-note">
            <a href="#/season">Play the season</a> to see which zeros were blind on each day, or open{' '}
            <a href="#/record?aoi=prov-kalimantan-tengah">Central Kalimantan in the Indonesia record</a> for the months cloud hid, on one fire scale.
          </p>
          <p className="ka-rep-note ka-bz-src">
            NASA MODIS MOD14A1 (Terra) and MYD14A1 (Aqua) C6.1 daily FireMask, read from Microsoft Planetary Computer, on a
            0.01 degree grid. District borders: geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO). The counting rule is in
            ka-data/visibility_kalteng_2019.json.
          </p>
        </>
      ) : null}
    </Card>
  );
}
