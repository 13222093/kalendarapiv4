// KalenderApi (new file): "Still burning?" in the command view (pages/CommandConsole.tsx), under the week strip.
// The places where NASA's satellites detected fire again in the last seven days (lib/burnsites.ts againSites), as a
// ledger: one row per place, with a seven-box strip in the same order as the week strip above it, the status in words,
// a few facts and two ways to a map. The heading is a question on purpose. The list says where heat was detected
// again, which is a reason to check on the ground; it never says a fire kept burning between two detections, that two
// detections are one fire, or that a fire is out. Every number is the page's own (m.burn) or a constant of
// lib/burnsites.ts. This file loads nothing.
import { useState } from 'react';
import {
  AGAIN_HOURS, RETURN_GAP_HOURS, SITE_JOIN_KM, SITE_WINDOW_HOURS, againSites, fixedSites, mapsHref, pastSiteNear, type BurnSite, type FixedKind,
} from '../../lib/burnsites.ts';
import { SENSOR_LABEL, wib } from '../../lib/now.ts';
import { reportHref } from '../../lib/todayview.ts';
import type { NowModel } from '../../pages/Now.tsx';

const FIRST_ROWS = 5;                   // rows shown before "Show all"
const RADIUS_FROM_KM = 0.3;             // "within N km" is written from this size up (a VIIRS pixel is 375 m)
const DAYS = SITE_WINDOW_HOURS / 24;    // the boxes of a strip: the page's "last 7 days"

/** The time with no detection, in words: whole days from 48 hours up, else whole hours. Rounded down, so the words
 *  never say more than the data. */
function gapWords(hours: number, lang: 'en' | 'id'): string {
  if (hours >= 48) {
    const d = Math.floor(hours / 24);
    return lang === 'id' ? `${d} hari` : `${d} days`;
  }
  const h = Math.floor(hours);
  return lang === 'id' ? `${h} jam` : `${h} hours`;
}

/** `onShow`: "Map" for a place; null when the map could not start (no WebGL), and the buttons are left out. */
export function StillBurning({ m, onShow }: { m: NowModel; onShow: ((lon: number, lat: number) => void) | null }) {
  const { tr, lang, aoiId, burn, sites, liveState, num } = m;
  const [all, setAll] = useState(false);
  const list = burn ? againSites(burn) : null;   // null: the hotspots are not read (still reading, or it failed)
  const n = list?.length ?? 0;
  const rows = (list ?? []).map((s) => ({ s, past: pastSiteNear(s, sites) }));
  const anyOnPeat = rows.some((r) => r.s.onPeat === true);
  const anyPast = rows.some((r) => r.past);
  const km = num(SITE_JOIN_KM, Number.isInteger(SITE_JOIN_KM) ? 0 : 1);
  // known fixed heat sources (a volcano, industry, a gas flare): againSites leaves them out, and the list says so
  const fixed = fixedSites(burn ?? []);
  // NASA's archive types a flare that stands on the shore (the Balikpapan refinery) as "offshore": inside a district
  // that is industry or a gas flare too, so the two kinds share their words
  const industry = tr('industry or gas flare', 'industri atau suar gas');
  const fixedName: Record<FixedKind, string> = { volcano: tr('volcano', 'gunung api'), static: industry, offshore: industry };

  const status = (s: BurnSite): string => {
    if (s.kind === 'returned') {
      return tr(`Came back after ${gapWords(s.gapHours, 'en')} with no detection`, `Muncul lagi setelah ${gapWords(s.gapHours, 'id')} tanpa deteksi`);
    }
    // the boxes are counted back from the read time, so two detections 18 hours apart can fall in one box
    if (s.daysSeen < 2) {
      const h = num(Math.floor(s.spanHours));
      return tr(`Detected again ${h} hours after the first detection`, `Terdeteksi lagi ${h} jam setelah deteksi pertama`);
    }
    return tr(`Detected on ${num(s.daysSeen)} of the last ${DAYS} days`, `Terdeteksi pada ${num(s.daysSeen)} dari ${DAYS} hari terakhir`);
  };

  return (
    <section className="cmd-again" id="cmd-again" tabIndex={-1} aria-labelledby="cmd-h-again">
      <h2 id="cmd-h-again" className="cmd-again-title">
        {tr('Still burning?', 'Belum padam?')}
        {n ? <span className="cmd-again-count">{tr(`${num(n)} place${n === 1 ? '' : 's'}`, `${num(n)} lokasi`)}</span> : null}
      </h2>
      <p className="cmd-again-what">
        {tr('Places where the satellites detected fire again this week. A reason to check on the ground, not proof that the fire never went out.',
          'Tempat yang terdeteksi lagi oleh satelit minggu ini. Alasan untuk cek lapangan, bukan bukti apinya tidak pernah padam.')}
      </p>

      {n ? (
        <>
          <p className="cmd-again-key">
            <span><i className="has" aria-hidden="true" />{tr('filled: detected in those 24 hours', 'terisi: terdeteksi dalam 24 jam itu')}</span>
            <span><i aria-hidden="true" />{tr('empty: no detection', 'kosong: tanpa deteksi')}</span>
            <span>{tr(`left: ${DAYS} days ago, right: the last 24 hours`, `kiri: ${DAYS} hari lalu, kanan: 24 jam terakhir`)}</span>
          </p>
          <ol className="cmd-again-rows" id="cmd-again-rows">
            {rows.map(({ s, past }, i) => {
              const at = `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`;
              const seen = tr(`detected in ${num(s.daysSeen)} of the last ${DAYS} days`, `terdeteksi pada ${num(s.daysSeen)} dari ${DAYS} hari terakhir`);
              return (
                <li key={s.id} className={`cmd-again-row${!all && i >= FIRST_ROWS ? ' is-more' : ''}`}>
                  <span className="cmd-again-strip" role="img" aria-label={seen} title={seen}>
                    {s.bins.map((b, k) => <i key={k} className={b > 0 ? 'has' : undefined} />)}
                  </span>
                  {/* the parts of a row are laid out by the stylesheet: beside the strip where there is room, and on a
                      narrow panel the tags, the facts and the two links under it, at full width */}
                  <p className="cmd-again-status">{status(s)}</p>
                  {s.fresh || s.night > 0 || past || s.onPeat === true ? (
                    <ul className="cmd-again-tags">
                      {s.fresh ? <li className="is-fresh">{tr('last 24 hours', '24 jam terakhir')}</li> : null}
                      {s.night > 0 ? <li>{tr(`night: ${num(s.night)} of ${num(s.detections)} detections`, `malam: ${num(s.night)} dari ${num(s.detections)} deteksi`)}</li> : null}
                      {past ? <li>{tr('past-season peat site', 'lokasi gambut musim lalu')}</li> : null}
                      {s.onPeat === true ? <li>{tr('on mapped peat', 'di lahan gambut (peta)')}</li> : null}
                    </ul>
                  ) : null}
                  <dl className="cmd-again-facts">
                    <div><dt>{tr('Last detected', 'Terakhir terdeteksi')}</dt><dd>{wib(s.lastMs, lang)}</dd></div>
                    <div>
                      <dt>{tr('Latitude, longitude', 'Lintang, bujur')}</dt>
                      <dd>{at}{s.radiusKm > RADIUS_FROM_KM ? ` · ${tr(`within ${num(s.radiusKm, 1)} km`, `dalam radius ${num(s.radiusKm, 1)} km`)}` : ''}</dd>
                    </div>
                    <div><dt>{tr('Detections', 'Deteksi')}</dt><dd>{num(s.detections)}</dd></div>
                    <div><dt>{tr('Highest fire power', 'Daya api tertinggi')}</dt><dd>{s.frpMax != null ? `${num(s.frpMax, 1)} MW` : '–'}</dd></div>
                    <div><dt>{tr('Satellites', 'Satelit')}</dt><dd>{s.sensors.map((x) => SENSOR_LABEL[x]).join(', ')}</dd></div>
                  </dl>
                  <div className="cmd-again-acts">
                    {onShow ? (
                      <button type="button" className="cmd-link" onClick={() => onShow(s.lon, s.lat)}
                        aria-label={tr(`Map: show ${at}`, `Peta: lihat ${at}`)}>{tr('Map', 'Peta')}</button>
                    ) : null}
                    <a className="cmd-link" href={mapsHref(s.lat, s.lon)} target="_blank" rel="noopener noreferrer"
                      aria-label={tr(`Google Maps: open ${at} in a new tab`, `Google Maps: buka ${at} di tab baru`)}>Google Maps</a>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="cmd-small cmd-again-state" role="status">
          {liveState.state === 'loading' ? tr('Reading the newest NASA hotspot files…', 'Membaca berkas titik panas NASA terbaru…')
            : !list ? tr('Not read: the places of these days are unknown, not zero.', 'Tidak terbaca: lokasi pada hari-hari ini tidak diketahui, bukan nol.')
              : tr('No place was detected again this week. That is not proof that every fire is out: cloud and smoke hide fire, and a fire too small or too cool is not detected.',
                'Tidak ada lokasi yang terdeteksi lagi minggu ini. Itu bukan bukti semua api sudah padam: awan dan asap menutupi api, dan api yang terlalu kecil atau terlalu dingin tidak terdeteksi.')}
        </p>
      )}

      <div className="cmd-again-foot">
        {n > FIRST_ROWS ? (
          <button type="button" className="cmd-link" aria-expanded={all} aria-controls="cmd-again-rows" onClick={() => setAll((v) => !v)}>
            {all ? tr(`Show the first ${FIRST_ROWS}`, `Tampilkan ${FIRST_ROWS} pertama`) : tr(`Show all ${num(n)}`, `Tampilkan semua ${num(n)}`)}
          </button>
        ) : null}
        {aoiId ? (
          <p className="cmd-again-papers">
            <a className="cmd-link" href={reportHref(aoiId, 'plan')}>{tr('Field check plan', 'Rencana cek lapangan')}</a>
            <a className="cmd-link" href={reportHref(aoiId, 'daily')}>{tr('Daily report', 'Laporan harian')}</a>
          </p>
        ) : null}
      </div>

      {fixed.length ? (
        <div className="cmd-again-fixed">
          <p className="cmd-small">
            {tr(`Left out: ${num(fixed.length)} known fixed heat source${fixed.length === 1 ? '' : 's'} (industry, a gas flare or a volcano in NASA's archive), seen day after day and not a land fire.`,
              `Tidak dimasukkan: ${num(fixed.length)} sumber panas tetap yang sudah dikenal (industri, suar gas, atau gunung api dalam arsip NASA), terdeteksi tiap hari dan bukan kebakaran lahan.`)}
          </p>
          <details className="cmd-more">
            <summary>{tr('Where they are', 'Lokasinya')}</summary>
            <ul className="cmd-again-fixed-list">
              {fixed.map((s) => {
                const at = `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`;
                return (
                  <li key={s.id}>
                    <span className="cmd-again-fixed-at">{at}</span>
                    <span>{s.fixed ? fixedName[s.fixed] : ''}</span>
                    {onShow ? (
                      <button type="button" className="cmd-link" onClick={() => onShow(s.lon, s.lat)}
                        aria-label={tr(`Map: show ${at}`, `Peta: lihat ${at}`)}>{tr('Map', 'Peta')}</button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      ) : null}

      <details className="cmd-more cmd-again-how">
        <summary>{tr('How this list is made', 'Cara daftar ini dibuat')}</summary>
        <ul className="cmd-again-rules">
          <li>{tr(`The list reads the hotspots of the last ${DAYS} days inside the district. Detections within ${km} km of each other count as one place.`,
            `Daftar ini membaca titik panas ${DAYS} hari terakhir di dalam kabupaten. Deteksi yang berjarak ${km} km atau kurang satu sama lain dihitung sebagai satu lokasi.`)}</li>
          <li>{tr(`A place is listed when its first and last detection are ${AGAIN_HOURS} hours or more apart: a later day's satellite pass.`,
            `Sebuah lokasi masuk daftar bila deteksi pertama dan terakhirnya berselang ${AGAIN_HOURS} jam atau lebih: lintasan satelit pada hari sesudahnya.`)}</li>
          <li>{tr(`"Came back" means ${RETURN_GAP_HOURS} hours or more with no detection in between.`,
            `"Muncul lagi" berarti ${RETURN_GAP_HOURS} jam atau lebih tanpa deteksi di antaranya.`)}</li>
          <li>{tr('Cloud, smoke, or a fire too small or too cool to detect can be why nothing was detected in between.',
            'Awan, asap, atau api yang terlalu kecil atau terlalu dingin untuk dideteksi bisa menjadi sebab tidak ada deteksi di antaranya.')}</li>
          <li>{tr(`A line of detections, each within ${km} km of the next, is one place, so a place can be wider than that. "Within" gives the distance from the centre of a place to its farthest detection.`,
            `Deretan deteksi yang masing-masing berjarak ${km} km atau kurang dari deteksi berikutnya adalah satu lokasi, sehingga sebuah lokasi bisa lebih lebar dari itu. "Dalam radius" adalah jarak dari titik tengah lokasi ke deteksi terjauhnya.`)}</li>
          <li>{tr('Order: places detected in the last 24 hours first, then the places detected on more days.',
            'Urutan: lokasi yang terdeteksi dalam 24 jam terakhir lebih dulu, lalu lokasi yang terdeteksi pada lebih banyak hari.')}</li>
          <li>{tr('Places that NASA\'s fire archive marks as a volcano or a fixed industrial heat source are left out; a facility newer than the archive is not known and can still appear.',
            'Lokasi yang ditandai arsip api NASA sebagai gunung api atau sumber panas industri tetap tidak dimasukkan; fasilitas yang lebih baru daripada arsip belum dikenal dan masih bisa muncul.')}</li>
          {anyPast ? (
            <li>{tr(`"Past-season peat site": within ${km} km of a place on the peat list of the Evidence tab, where fire came back in a past season.`,
              `"Lokasi gambut musim lalu": berjarak ${km} km atau kurang dari lokasi pada daftar gambut di tab Bukti, tempat api pernah muncul lagi pada musim yang lalu.`)}</li>
          ) : null}
          {anyOnPeat ? (
            <li>{tr('Peat: the national peat map, 1:250,000 (Ministry of Agriculture, 2011). It marks a place on the map, not a detected peat fire.',
              'Gambut: peta lahan gambut nasional skala 1:250.000 (Kementerian Pertanian, 2011). Ini menandai lokasi pada peta, bukan api gambut yang terdeteksi.')}</li>
          ) : null}
          <li>{tr('A hotspot is a detection of heat by a satellite, not a confirmed fire. This list is KalenderApi\'s own rule, not an official status.',
            'Titik panas adalah deteksi panas oleh satelit, bukan kebakaran yang terkonfirmasi. Daftar ini aturan KalenderApi sendiri, bukan status resmi.')}</li>
        </ul>
      </details>
    </section>
  );
}
