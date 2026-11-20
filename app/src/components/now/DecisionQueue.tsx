// KalenderApi (new file): the left panel of the command view (pages/CommandConsole.tsx): the disaster office's
// decision queue. The classic page's "What to do now" actions as rows, under the same conditions and with the same
// facts: each row has a number, a title, one fact line, a state, its buttons and a "Why". Above the rows, the five
// steps of the village alert with their times (the steps of components/now/AlertLoop.tsx). A resident's "I see fire"
// in the village thread adds a row at the top. The rows and their states come from lib/nowconsole.ts; this file only
// draws them. These are the app's suggestions from its own rule, not an official procedure.
import { useState } from 'react';
import { SENSOR_LABEL, pointMs, wib } from '../../lib/now.ts';
import {
  ALERT_STEPS, activeStep, alertStatus, clockWib, rowTitle,
  type AlertStatus, type AlertStep, type ConsoleState, type QueueRow, type RowState,
} from '../../lib/nowconsole.ts';
import { copyText, type NowModel } from '../../pages/Now.tsx';

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  );
}

interface QueueProps {
  m: NowModel; state: ConsoleState; rows: QueueRow[];
  accent: string | null;                               // the one row whose lead button takes the accent
  onApprove: () => void; onHold: () => void;
  onDone: (id: string, done: boolean) => void;
  onRestart: () => void; onGuide: (hidden: boolean) => void;
  onShow: ((lon: number, lat: number) => void) | null; // "Show on map"; null when the map could not start (no WebGL)
  onPeat: () => void; onCrew: () => void; onThread: () => void;
}

export function DecisionQueue({ m, state, rows, accent, onApprove, onHold, onDone, onRestart, onGuide, onShow, onPeat, onCrew, onThread }: QueueProps) {
  const { tr, lang, counts, sites, peat, blindRow, result, liveState, whyText, rules, levelName, num, copied, setCopied, setTick } = m;
  // (whyText: the page's own reason sentences; rules: its level rules, in both languages)
  const alert = state.alert;
  const at = activeStep(alert);
  const waiting = rows.filter((r) => r.state === 'waiting').length;
  const [why, setWhy] = useState<string[]>([]);   // the rows whose "Why" is open

  const stepName: Record<AlertStep, string> = {
    drafted: tr('Drafted', 'Disusun'), approved: tr('Approved', 'Disetujui'), sent: tr('Sent', 'Terkirim'),
    read: tr('Read', 'Dibaca'), replied: tr('Replied', 'Dibalas'),
  };
  const statusText: Record<AlertStatus, string> = {
    read: tr('1 resident confirmed', '1 warga mengonfirmasi'),
    fire: tr('1 report of fire: ask a crew to check the ground', '1 laporan api: minta regu mengecek lapangan'),
    sent: tr('Sent to the village group. Waiting for a reply.', 'Terkirim ke grup desa. Menunggu balasan.'),
    sending: tr('Approved. Sending…', 'Disetujui. Mengirim…'),
    held: tr('On hold: nothing leaves the office.', 'Ditahan: tidak ada yang keluar dari kantor.'),
    waiting: tr('Waiting for the office to decide.', 'Menunggu keputusan kantor.'),
  };
  const stateName: Record<RowState, string> = {
    waiting: tr('waiting', 'menunggu'), approved: tr('approved', 'disetujui'), held: tr('held', 'ditahan'), done: tr('done', 'selesai'),
  };
  const calmRule = rules.find((r) => r.level === 'calm')?.text ?? '';
  const season = peat?.season ?? '';

  /** The fact line, the buttons and the "Why" of one row. */
  const body = (row: QueueRow) => {
    const lead = `cmd-btn${accent === row.id ? ' cmd-btn-accent' : ''}`;
    const done = row.state === 'done';
    switch (row.kind) {
      case 'resident': return {
        fact: `${alert.times.replied != null ? clockWib(alert.times.replied) : '–'} WIB · ${tr('reply in the village thread', 'balasan di utas grup desa')}`,
        actions: (
          <>
            <button type="button" className="cmd-btn cmd-btn-strong" aria-pressed={done} onClick={() => onDone(row.id, !done)}>{done ? tr('Reopen', 'Buka lagi') : tr('Mark checked', 'Tandai sudah dicek')}</button>
            <button type="button" className="cmd-btn" onClick={onCrew}>{tr('Crew message', 'Pesan regu')}</button>
          </>
        ),
        why: tr('A resident answered "I see fire" in the village thread on the right. That thread is a demo: the reply was pressed on this page, and nothing was sent or received. A report is a reason to check on the ground; it is not a confirmed fire.',
          'Seorang warga menjawab "Saya melihat api" di utas grup desa di kanan. Utas itu demo: balasannya ditekan di halaman ini, dan tidak ada yang dikirim atau diterima. Laporan adalah alasan untuk mengecek di lapangan; itu bukan kebakaran yang terkonfirmasi.'),
      };
      case 'reread': return {
        // the classic sentence; when the month alone set a level, only its first half is true, so only that is said
        fact: result.level ? tr('Live hotspots could not be read.', 'Titik panas langsung tidak dapat dibaca.')
          : tr('Live hotspots could not be read, so no level is set.', 'Titik panas langsung tidak dapat dibaca, sehingga tingkat belum ditentukan.'),
        actions: <button type="button" className={lead} onClick={() => setTick((t) => t + 1)}>{tr('Read again', 'Baca ulang')}</button>,
        why: `${liveState.state !== 'unavailable' ? ''
          : liveState.why === 'no-function'
            ? tr('This copy of the site runs without the live-data function (/api/live), so it cannot read NASA\'s near-real-time files.', 'Salinan situs ini berjalan tanpa fungsi data langsung (/api/live), sehingga tidak dapat membaca berkas waktu hampir nyata NASA.')
            : tr(`NASA's near-real-time files did not answer (${liveState.detail}).`, `Berkas waktu hampir nyata NASA tidak menjawab (${liveState.detail}).`)} ${
          tr('A level of "Calm" is never set without today\'s hotspots. An empty map does not mean no fire.', 'Tingkat "Tenang" tidak pernah ditetapkan tanpa titik panas hari ini. Peta kosong tidak berarti tidak ada api.')}`,
      };
      case 'newest': {
        const n = counts?.newest;
        if (!n) return null;
        return {
          fact: `${n[1].toFixed(4)}, ${n[0].toFixed(4)} · ${wib(pointMs(n), lang)} · ${SENSOR_LABEL[n[4]]}`,
          actions: (
            <>
              {onShow ? <button type="button" className={lead} onClick={() => onShow(n[0], n[1])}>{tr('Show on map', 'Lihat di peta')}</button> : null}
              <button type="button" className="cmd-btn"
                onClick={() => { void copyText(`${n[1].toFixed(4)}, ${n[0].toFixed(4)}`).then((ok) => setCopied(ok ? 'coord' : 'fail-coord')); }}>
                {copied === 'coord' ? tr('Copied', 'Tersalin') : tr('Copy coordinates', 'Salin koordinat')}
              </button>
              {copied === 'fail-coord' ? <span className="cmd-small" role="status">{tr('Could not copy; select the text instead.', 'Tidak dapat menyalin; pilih teksnya secara manual.')}</span> : null}
            </>
          ),
          why: tr('This is the newest detection of the last 7 days inside the district. A hotspot is a detection of heat: it is not a confirmed fire and not burned area. A satellite coordinate can be off by up to about 1 km, so verify on the ground.',
            'Ini deteksi terbaru dalam 7 hari terakhir di dalam kabupaten. Titik panas adalah deteksi panas: bukan kebakaran yang terkonfirmasi dan bukan luas terbakar. Koordinat satelit bisa meleset hingga sekitar 1 km, jadi verifikasi di lapangan.'),
        };
      }
      case 'peat': {
        const s0 = sites[0];
        if (!s0) return null;
        return {
          fact: `${s0.lat.toFixed(3)}, ${s0.lon.toFixed(3)} · ${tr(`detected on ${num(s0.days)} days, came back ${num(s0.comeBacks)} time${s0.comeBacks === 1 ? '' : 's'}`, `terdeteksi ${num(s0.days)} hari, muncul lagi ${num(s0.comeBacks)} kali`)}`,
          actions: (
            <>
              {onShow ? <button type="button" className={lead} onClick={() => onShow(s0.lon, s0.lat)}>{tr('Show on map', 'Lihat di peta')}</button> : null}
              <button type="button" className="cmd-btn" onClick={onPeat}>{tr('See the peat list', 'Lihat daftar gambut')}</button>
            </>
          ),
          why: `${tr('On peat, fire came back at these places after days when the satellite had a clear look and detected nothing. Places like this are worth a ground re-check.',
            'Di lahan gambut, api muncul lagi di tempat-tempat ini setelah hari-hari ketika satelit mendapat pandangan jelas dan tidak mendeteksi apa pun. Tempat seperti ini layak dicek ulang di lapangan.')} ${
            tr(`This is the first site of the list for the August to October ${season} season: a place where fire came back in a past season, not a place burning now.`,
              `Ini lokasi pertama dalam daftar untuk musim Agustus sampai Oktober ${season}: tempat api pernah muncul lagi pada musim yang lalu, bukan tempat yang sedang terbakar sekarang.`)}`,
        };
      }
      case 'village': return {
        fact: whyText[result.why],
        // the classic row's "Open the alert" scrolled to the loop; here the alert is the thread in the Village tab
        actions: alert.times.approved != null ? (
          <button type="button" className="cmd-btn" onClick={onThread}>{tr('Open the alert', 'Buka peringatan')}</button>
        ) : (
          <>
            <button type="button" className={lead} onClick={onApprove}>{tr('Approve and send', 'Setujui dan kirim')}</button>
            <button type="button" className="cmd-btn" onClick={onHold} disabled={alert.held}>{tr('Hold', 'Tahan')}</button>
            {/* only where the thread is out of sight (the one-screen layout shows it beside the queue) */}
            <button type="button" className="cmd-link cmd-narrow-only" onClick={onThread}>{tr('Open the alert', 'Buka peringatan')}</button>
          </>
        ),
        why: tr('The level asks for it: at Watch or High the residents\' message is ready. Approving marks it as sent in the village thread on the right, which is a demo and sends nothing. To send it for real, use "Open in WhatsApp" under the thread.',
          'Tingkatnya meminta ini: pada Waspada atau Tinggi, pesan untuk warga sudah siap. Menyetujui menandainya terkirim di utas grup desa di kanan, yang merupakan demo dan tidak mengirim apa pun. Untuk benar-benar mengirim, pakai "Buka di WhatsApp" di bawah utas.'),
      };
      case 'calm': return {
        fact: whyText[result.why],
        actions: <button type="button" className={lead} aria-pressed={done} onClick={() => onDone(row.id, !done)}>{done ? tr('Reopen', 'Buka lagi') : tr('Noted', 'Dicatat')}</button>,
        why: `${levelName('calm')}: ${calmRule}`,
      };
      case 'cloud': return {
        fact: blindRow
          ? tr(`${num(blindRow.district_days_above)} of ${num(blindRow.district_days)} district-days (${num(blindRow.share_pct, 1)}%) mostly under cloud, past Aug to Oct`, `${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)} hari-kabupaten (${num(blindRow.share_pct, 1)}%) sebagian besar tertutup awan, Agu sampai Okt yang lalu`)
          : tr('no cloud history for this district', 'belum ada riwayat awan untuk kabupaten ini'),
        actions: <button type="button" className={lead} aria-pressed={done} onClick={() => onDone(row.id, !done)}>{done ? tr('Reopen', 'Buka lagi') : tr('Noted', 'Dicatat')}</button>,
        why: `${blindRow
          ? tr(`Cloud hid most of this district on ${num(blindRow.district_days_above)} of ${num(blindRow.district_days)} district-days (${num(blindRow.share_pct, 1)}%) of past August to October seasons.`, `Awan menutupi sebagian besar kabupaten ini pada ${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)} hari-kabupaten (${num(blindRow.share_pct, 1)}%) pada musim Agustus sampai Oktober yang lalu.`)
          : tr('Under cloud a satellite cannot see the ground.', 'Di bawah awan satelit tidak dapat melihat permukaan tanah.')} ${
          tr('This history counts cloud only. Under cloud, no hotspot means not seen, not no fire.', 'Riwayat ini hanya menghitung awan. Di bawah awan, tidak ada titik panas berarti tidak terlihat, bukan tidak ada api.')}`,
      };
    }
  };

  return (
    <section className="cmd-queue" id="cmd-queue" tabIndex={-1} aria-labelledby="cmd-h-queue">
      {/* the heading keeps the classic page's words: the assistant (public/api/ask.js) sends people to "What to do now" */}
      <header className="cmd-head">
        <p className="cmd-label">{tr('Decision queue', 'Antrean keputusan')} · {tr('disaster office (BPBD)', 'BPBD kabupaten')}</p>
        <div className="cmd-head-line">
          <h2 id="cmd-h-queue">{tr('What to do now', 'Yang dilakukan sekarang')}</h2>
          <p className="cmd-head-count">{waiting ? tr(`${num(waiting)} waiting for a decision`, `${num(waiting)} menunggu keputusan`) : tr('Nothing is waiting', 'Tidak ada yang menunggu')}</p>
        </div>
      </header>

      {/* the village alert: five steps, each with the time it happened */}
      <div className="cmd-steps-block">
        <p className="cmd-label" id="cmd-h-steps">{tr('Village alert · times in WIB', 'Peringatan desa · waktu dalam WIB')}</p>
        <ol className="cmd-steps" aria-labelledby="cmd-h-steps">
          {ALERT_STEPS.map((st, i) => {
            const t = alert.times[st];
            return (
              <li key={st} className={st === at ? 'is-current' : t != null ? 'is-done' : undefined} aria-current={st === at ? 'step' : undefined}>
                <span className="cmd-step-dot" aria-hidden="true">{t != null && st !== at ? <Check /> : i + 1}</span>
                <span className="cmd-step-name">{stepName[st]}</span>
                <span className="cmd-step-time">{t != null ? clockWib(t) : '–'}</span>
              </li>
            );
          })}
        </ol>
        <p className="cmd-steps-status" aria-live="polite">{statusText[alertStatus(alert)]}</p>
      </div>

      <ol className="cmd-rows" aria-labelledby="cmd-h-queue">
        {rows.map((row, i) => {
          const b = body(row);
          if (!b) return null;
          const done = row.state === 'done';
          // the rows the office ticks itself; the village alert and "read again" take their state from what happened
          const ticks = row.kind !== 'village' && row.kind !== 'reread';
          return (
            <li key={row.id} id={`cmd-row-${row.kind}`} tabIndex={-1} className={`cmd-row is-${row.state}${row.kind === 'resident' ? ' is-new' : ''}`}>
              <span className="cmd-row-n" aria-hidden="true">{i + 1}</span>
              <div className="cmd-row-main">
                <div className="cmd-row-top">
                  <h3 className="cmd-row-title">{rowTitle(row.kind, tr)}</h3>
                  {ticks ? (
                    <button type="button" className={`cmd-chip cmd-chip-tick is-${row.state}`} aria-pressed={done}
                      title={done ? tr('Reopen', 'Buka lagi') : tr('Mark done', 'Tandai selesai')}
                      aria-label={done ? tr(`${stateName[row.state]}: reopen this row`, `${stateName[row.state]}: buka lagi baris ini`) : tr(`${stateName[row.state]}: mark this row done`, `${stateName[row.state]}: tandai baris ini selesai`)}
                      onClick={() => onDone(row.id, !done)}>
                      <i aria-hidden="true">{done ? <Check /> : null}</i>{stateName[row.state]}
                    </button>
                  ) : <span className={`cmd-chip is-${row.state}`}>{stateName[row.state]}</span>}
                </div>
                {b.fact ? <p className="cmd-fact">{b.fact}</p> : null}
                {/* the buttons wrap among themselves on the left; "Why" keeps its place on their first line, on the right */}
                <div className="cmd-row-foot">
                  <div className="cmd-row-actions">{b.actions}</div>
                  <button type="button" className="cmd-link cmd-why-btn" aria-expanded={why.includes(row.id)} aria-controls={`cmd-why-${row.kind}`}
                    onClick={() => setWhy((w) => (w.includes(row.id) ? w.filter((x) => x !== row.id) : [...w, row.id]))}>{tr('Why', 'Mengapa')}</button>
                </div>
                <p className="cmd-why" id={`cmd-why-${row.kind}`} hidden={!why.includes(row.id)}>{b.why}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="cmd-queue-foot">
        <p className="cmd-small">{tr('These are KalenderApi\'s suggestions from the rules on this page, not an official procedure.', 'Ini saran KalenderApi dari aturan di halaman ini, bukan prosedur resmi.')}</p>
        <details className="cmd-more">
          <summary>{tr('How the level is set', 'Cara tingkat ditetapkan')}</summary>
          <p className="cmd-small">{tr('KalenderApi\'s own level, not an official government status.', 'Tingkat milik KalenderApi sendiri, bukan status resmi pemerintah.')}</p>
          <p className="cmd-small">
            {tr('These three levels are KalenderApi\'s own, from the rules below. They are not an official government status and not a forecast.',
              'Tiga tingkat ini milik KalenderApi sendiri, dari aturan di bawah. Ini bukan status resmi pemerintah dan bukan prakiraan.')}
          </p>
          <ul className="cmd-rules">
            {rules.map((r) => (
              <li key={r.level} className={r.level === result.level ? 'is-on' : undefined} aria-current={r.level === result.level ? 'true' : undefined}>
                <b>{levelName(r.level)}</b> <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </details>
        {state.guideHidden ? null : (
          <aside className="cmd-guide" aria-labelledby="cmd-h-guide">
            <div className="cmd-guide-head">
              <p className="cmd-label" id="cmd-h-guide">{tr('How to use', 'Cara pakai')}</p>
              <button type="button" className="cmd-link" onClick={() => onGuide(true)}>{tr('Hide', 'Sembunyikan')}</button>
            </div>
            <ol>
              <li>{tr('Work down the queue. Each row has the fact, its buttons, and the reason under "Why". Tick a row\'s state box when it is done.', 'Kerjakan antrean dari atas. Tiap baris memuat fakta, tombolnya, dan alasannya di bawah "Mengapa". Centang kotak status sebuah baris bila sudah selesai.')}</li>
              <li>{tr('Approve the village alert, then answer as a resident in the village thread on the right. "I see fire" comes back here as a new row.', 'Setujui peringatan desa, lalu jawab sebagai warga di utas grup desa di kanan. "Saya melihat api" kembali ke sini sebagai baris baru.')}</li>
              <li>{tr('The thread is a demo and sends nothing. To send for real, press "Open in WhatsApp" under it.', 'Utas itu demo dan tidak mengirim apa pun. Untuk benar-benar mengirim, tekan "Buka di WhatsApp" di bawahnya.')}</li>
            </ol>
          </aside>
        )}
        <p className="cmd-queue-end">
          <button type="button" className="cmd-btn" onClick={onRestart}>{tr('Start again', 'Mulai lagi')}</button>
          {state.guideHidden ? <button type="button" className="cmd-link" onClick={() => onGuide(false)}>{tr('How to use', 'Cara pakai')}</button> : null}
        </p>
      </div>
    </section>
  );
}
