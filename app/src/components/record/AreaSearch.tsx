// KalenderApi (new file): the district finder of the Indonesia record page. Shown only when the district index
// (public/ss-data/districts/index.json) is in: a search box for a kabupaten or kota name, the matches grouped under
// their province, and "Enter latitude and longitude", which picks the district whose outline holds the point
// (districts.geojson, a point-in-polygon test in the browser). Without the index nothing is drawn here.
// Texts are in English and Bahasa Indonesia, side by side (lib/lang.ts).
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useLang, useTr } from '../../lib/lang';
import {
  aoiName, districtAt, loadDistrictShapes, searchDistricts, settle, type AoiEntry, type DistrictShapes, type Load,
} from '../../lib/record';

export function AreaSearch({ districts, onPick }: {
  districts: AoiEntry[];          // the districts on offer
  onPick: (aoiId: string) => void;
}) {
  const tr = useTr();
  const lang = useLang();
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const groups = useMemo(() => searchDistricts(districts, q, 30), [districts, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const typed = q.trim().length > 0;

  const pick = (a: AoiEntry) => { onPick(a.aoi_id); setQ(''); setOpen(false); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { const a = flat[active]; if (open && a) { e.preventDefault(); pick(a); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const show = open && typed;

  return (
    <div className="ka-rec-find">
      <div className="ka-rec-find-box" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
        <label htmlFor={`${id}-q`}>{tr(`Find a district (${districts.length} kabupaten and kota)`, `Cari kabupaten/kota (${districts.length} kabupaten dan kota)`)}</label>
        <input id={`${id}-q`} type="search" autoComplete="off" spellCheck={false}
          placeholder={tr('Type a kabupaten or kota name', 'Ketik nama kabupaten atau kota')}
          role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={show && flat[active] ? `${id}-o-${flat[active]!.aoi_id}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {show ? (
          <div className="ka-rec-find-list" id={`${id}-list`} role="listbox" aria-label={tr('Districts, by province', 'Kabupaten/kota, menurut provinsi')}>
            {groups.map((g) => (
              <div key={g.province} role="group" aria-label={g.province}>
                <p className="ka-rec-find-prov" aria-hidden="true">{g.province}</p>
                {g.items.map((a) => (
                  <button key={a.aoi_id} type="button" role="option" id={`${id}-o-${a.aoi_id}`} tabIndex={-1}
                    aria-selected={flat[active]?.aoi_id === a.aoi_id} className="ka-rec-find-opt"
                    onPointerEnter={() => setActive(flat.indexOf(a))} onClick={() => pick(a)}>
                    {aoiName(a, lang)}{a.low_data ? <span className="ka-rec-find-tag">{tr('low data', 'data sedikit')}</span> : null}
                  </button>
                ))}
              </div>
            ))}
            {!flat.length ? (
              <p className="ka-rec-find-none" role="status">
                {tr(`No district matches "${q.trim()}". Try the name without "Kabupaten" or "Kota".`, `Tidak ada kabupaten/kota yang cocok dengan "${q.trim()}". Coba nama tanpa "Kabupaten" atau "Kota".`)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <LatLon onPick={onPick} offered={districts} />
    </div>
  );
}

/** "Enter latitude and longitude": the district that holds the point. */
function LatLon({ onPick, offered }: { onPick: (aoiId: string) => void; offered: AoiEntry[] }) {
  const tr = useTr();
  const lang = useLang();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const find = () => {
    const la = Number(lat), lo = Number(lon);
    if (lat.trim() === '' || lon.trim() === '' || !Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      setMsg({ tone: 'error', text: tr('Enter a latitude from -90 to 90 and a longitude from -180 to 180, in decimal degrees (south is negative).',
        'Masukkan lintang dari -90 sampai 90 dan bujur dari -180 sampai 180, dalam derajat desimal (selatan bernilai negatif).') });
      return;
    }
    setBusy(true);
    setMsg({ tone: 'info', text: tr('Loading the district outlines...', 'Memuat batas kabupaten/kota...') });
    settle(loadDistrictShapes(), (l: Load<DistrictShapes>) => {
      setBusy(false);
      if (l.state === 'missing') {
        setMsg({ tone: 'info', text: tr('Not built yet: the district outlines file is not in this build. Use the search box.', 'Belum dibuat: berkas batas kabupaten/kota belum ada dalam versi ini. Gunakan kotak pencarian.') });
        return;
      }
      if (l.state === 'error') {
        setMsg({ tone: 'error', text: tr(`The district outlines could not be loaded (${l.message}). Try again.`, `Batas kabupaten/kota tidak dapat dimuat (${l.message}). Coba lagi.`) });
        return;
      }
      if (l.state !== 'ok') return;
      const hit = districtAt(lo, la, l.data);
      const entry = hit ? offered.find((d) => d.aoi_id === hit) : null;
      if (entry) {
        const where = `${aoiName(entry, lang)}${entry.province ? `, ${entry.province}` : ''}`;
        setMsg({ tone: 'info', text: tr(`${la}, ${lo} is in ${where}.`, `${la}, ${lo} berada di ${where}.`) });
        onPick(entry.aoi_id);
      } else if (hit) {
        const name = l.data.features.find((f) => f.properties?.aoi_id === hit)?.properties?.name ?? hit;
        setMsg({ tone: 'info', text: tr(`${la}, ${lo} is in ${name}, which has no record in this build.`, `${la}, ${lo} berada di ${name}, yang tidak memiliki rekaman dalam versi ini.`) });
      } else {
        setMsg({ tone: 'info', text: tr(`No district holds ${la}, ${lo}: the point is at sea or outside Indonesia.`, `Tidak ada kabupaten/kota yang memuat ${la}, ${lo}: titik berada di laut atau di luar Indonesia.`) });
      }
    });
  };
  const degrees = tr('decimal degrees', 'derajat desimal');
  return (
    <details className="ka-rec-latlon">
      <summary>{tr('Enter latitude and longitude', 'Masukkan lintang dan bujur')}</summary>
      <form className="ka-rec-latlon-form" onSubmit={(e) => { e.preventDefault(); find(); }}>
        <label>{tr('Latitude', 'Lintang')}<input type="number" inputMode="decimal" step="any" min={-90} max={90} placeholder={degrees} value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label>{tr('Longitude', 'Bujur')}<input type="number" inputMode="decimal" step="any" min={-180} max={180} placeholder={degrees} value={lon} onChange={(e) => setLon(e.target.value)} /></label>
        <button type="submit" className="ui-btn" disabled={busy}>{tr('Find the district', 'Cari kabupaten/kota')}</button>
      </form>
      {msg ? <p className={`ka-rec-note${msg.tone === 'error' ? ' is-error' : ''}`} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</p> : null}
    </details>
  );
}
