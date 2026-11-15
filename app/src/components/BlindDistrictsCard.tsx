// "Zeros with no cloud-free look, by district" (KalenderApi): for Central Kalimantan, Aug to Oct 2019, the share of each
// district's no-fire land where Terra and Aqua MODIS had no cloud-free look, on a map of the 14 districts and as a
// ranked list. The unit is the district (kabupaten/kota), the unit the people who act on fires plan in; the numbers
// come from public/ka-data/visibility_kalteng_2019.json and the borders from kalteng_districts.json (both built by
// kalenderapi/scripts/build_visibility.py from the NASA MODIS daily FireMask and geoBoundaries).
// The card stands on its own: it reads its two files itself, takes no props and no page context, and links only to
// "Play the season", so it can sit on the record page as well as in the explorer. The layer counts cloud only (the
// MODIS fire mask does not flag thick smoke); the lead says so once. English and Bahasa Indonesia (lib/lang.ts).
import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui';
import { fmtNumber, monthName, useLang, useTr } from '../lib/lang';
import '../styles/reported.css';

interface VisDistrict { name: string; T: number; U: number }
interface VisFile { districts: VisDistrict[]; days: unknown[] }
interface DistFile { districts: { name: string; rings: [number, number][][] }[] }
interface Row { name: string; share: number; path: string }

const BASE = import.meta.env.BASE_URL;
const YEAR = 2019;
let loading: Promise<[VisFile, DistFile]> | null = null;
function load(): Promise<[VisFile, DistFile]> {
  if (!loading) {
    const get = <T,>(u: string) => fetch(`${BASE}ka-data/${u}`).then((r) => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json() as Promise<T>; });
    loading = Promise.all([get<VisFile>(`visibility_kalteng_${YEAR}.json`), get<DistFile>('kalteng_districts.json')]);
    loading.catch(() => { loading = null; });
  }
  return loading;
}

/** A share in %, one decimal, rounded as the Season page rounds it. */
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0);
const W = 300;

export function BlindDistrictsCard() {
  const tr = useTr();
  const lang = useLang();
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
      const rings = shapes.get(d.name) ?? [];
      return { name: d.name, share: pct(d.U, d.T + d.U), path: rings.map((r) => `M${r.map(pt).join('L')}Z`).join('') };
    }).sort((a, b) => b.share - a.share);
    const tot = vis.districts.reduce((s, d) => [s[0] + d.T, s[1] + d.U], [0, 0]);
    const lo = Math.min(...rows.map((r) => r.share)), hi = Math.max(...rows.map((r) => r.share));
    const alpha = (s: number) => (hi > lo ? 0.16 + (0.8 * (s - lo)) / (hi - lo) : 0.6);
    return { rows, h, alpha, hi, total: pct(tot[1], tot[0] + tot[1]), days: vis.days.length };
  }, [files]);

  const label = (share: number) => `${fmtNumber(share, lang, 1)}%`;
  const n = view?.rows.length ?? 0;
  const span = `1 ${monthName(8, lang, 'long')} ${tr('to', 'sampai')} 31 ${monthName(10, lang, 'long')} ${YEAR}`;

  return (
    <Card
      title={tr('Zeros with no cloud-free look, by district', 'Nol tanpa pandangan bebas awan, per kabupaten/kota')}
      subtitle={`${tr('Central Kalimantan', 'Kalimantan Tengah')}, ${span}`}
      className="ka-rep ka-bz"
    >
      <p className="ka-rep-lead">
        {tr('A zero with ', 'Nol ')}<strong>{tr('no cloud-free look', 'tanpa pandangan bebas awan')}</strong>
        {tr(
          ` is land where no fire was detected and Terra and Aqua MODIS had only cloud that day. The share is that land out of all land with no fire detected${view ? `, over ${view.days} days` : ''}: the higher it is, the more of a district's zeros are not observations. The layer counts cloud only: the MODIS fire mask does not flag thick smoke, so the true unseen share is higher.`,
          ` adalah lahan tanpa deteksi api yang pada hari itu hanya tertutup awan bagi Terra dan Aqua MODIS. Angkanya adalah bagian lahan itu dari semua lahan tanpa deteksi api${view ? `, selama ${view.days} hari` : ''}: makin tinggi angkanya, makin banyak nol yang bukan hasil pengamatan. Lapisan ini hanya menghitung awan: masker api MODIS tidak menandai asap tebal, sehingga bagian yang sebenarnya tidak terlihat lebih besar.`)}
      </p>
      {error ? (
        <p className="ka-rep-note" role="alert">
          {tr('The files for this card could not be loaded. Check the connection, then reload the page.',
            'Berkas untuk kartu ini gagal dimuat. Periksa koneksi, lalu muat ulang halaman.')}
        </p>
      ) : null}
      {!error && !view ? (
        <div className="ka-rep-loading" aria-busy="true"
          aria-label={tr('Loading the shares by district', 'Memuat angka per kabupaten/kota')} />
      ) : null}
      {view ? (
        <>
          <div className="ka-bz-body">
            <svg className="ka-bz-map" viewBox={`0 0 ${W} ${view.h}`} role="img"
              aria-label={tr(
                `Map of the ${n} districts of Central Kalimantan, shaded by their share of no-fire land with no cloud-free look, ${label(view.rows[n - 1]!.share)} to ${label(view.rows[0]!.share)}`,
                `Peta ${n} kabupaten/kota di Kalimantan Tengah, diarsir menurut bagian lahan tanpa api yang tanpa pandangan bebas awan, ${label(view.rows[n - 1]!.share)} sampai ${label(view.rows[0]!.share)}`)}>
              {view.rows.map((r) => (
                <path key={r.name} d={r.path} fillOpacity={view.alpha(r.share)}
                  className={hover === r.name ? 'is-on' : undefined}
                  onPointerEnter={() => setHover(r.name)} onPointerLeave={() => setHover(null)}>
                  <title>{tr(`${r.name}: ${label(r.share)} of the no-fire land had no cloud-free look`,
                    `${r.name}: ${label(r.share)} lahan tanpa api tanpa pandangan bebas awan`)}</title>
                </path>
              ))}
            </svg>
            <ol className="ka-bz-list">
              {view.rows.map((r) => (
                <li key={r.name} className={hover === r.name ? 'is-on' : undefined}
                  onPointerEnter={() => setHover(r.name)} onPointerLeave={() => setHover(null)}>
                  <span className="ka-bz-sw" style={{ opacity: view.alpha(r.share) }} aria-hidden="true" />
                  <span className="ka-bz-name">{r.name}</span>
                  <span className="ka-bz-val">{label(r.share)}</span>
                  <span className="ka-bz-bar" aria-hidden="true"><i style={{ width: `${view.hi > 0 ? (r.share / view.hi) * 100 : 0}%` }} /></span>
                </li>
              ))}
            </ol>
          </div>
          <p className="ka-rep-note">
            {tr(`All ${n} districts together: `, `Seluruh ${n} kabupaten/kota: `)}<strong>{label(view.total)}</strong>
            {tr(
              '. The share does not estimate fire under cloud. A cloud-free look is not proof that nothing burned either: small or smouldering fires can stay below the detection limit.',
              '. Angka ini bukan perkiraan api di bawah awan. Pandangan bebas awan juga bukan bukti bahwa tidak ada yang terbakar: api kecil atau yang membara bisa berada di bawah batas deteksi.')}
          </p>
          <p className="ka-rep-note">
            <a href="#/season">{tr('Play the season', 'Putar musim')}</a>{' '}
            {tr('to see, day by day, where there was no cloud-free look.', 'untuk melihat, hari demi hari, lahan yang tanpa pandangan bebas awan.')}
          </p>
          <p className="ka-rep-note ka-bz-src">
            {tr(
              `NASA MODIS MOD14A1 (Terra) and MYD14A1 (Aqua) C6.1 daily FireMask, read from Microsoft Planetary Computer, on a 0.01 degree grid. District borders: geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO). Counted with our first rule (Terra and Aqua MODIS only). A separate registered test covers ${YEAR}; these shares are not its result.`,
              `FireMask harian NASA MODIS MOD14A1 (Terra) dan MYD14A1 (Aqua) C6.1, dibaca dari Microsoft Planetary Computer, pada grid 0,01 derajat. Batas kabupaten/kota: geoBoundaries gbOpen IDN ADM2 (CC BY 3.0 IGO). Dihitung dengan aturan pertama kami (hanya Terra dan Aqua MODIS). Ada uji terdaftar tersendiri untuk ${YEAR}; angka ini bukan hasil uji itu.`)}
          </p>
        </>
      ) : null}
    </Card>
  );
}
