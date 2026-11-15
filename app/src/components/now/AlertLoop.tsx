// KalenderApi (new file): a demo of the alert loop we are building next. The disaster office approves an alert, a
// resident's phone receives it, the resident confirms or reports fire, and the office sees the answer.
// Nothing is sent: no network call, no storage. The only made-up thing is the single reply of the one simulated phone,
// which the visitor presses themselves. The message shown is the residents' message the page has already written.
// The phone's header says "Demo": that is the component's only marker that this is not a real send.
// Styles: styles/alertloop.css (tokens of brand.css only).
import { useEffect, useRef, useState } from 'react';
import { useTr } from '../../lib/lang';
import '../../styles/alertloop.css';

type Step = 'drafted' | 'approved' | 'sent' | 'read' | 'confirmed';
type Reply = 'read' | 'fire';
const STEPS: Step[] = ['drafted', 'approved', 'sent', 'read', 'confirmed'];
const SEND_MS = 600;

/** The clock time now in Indonesia's western zone, HH:MM. */
const clock = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date());

export function AlertLoop({ district, levelLabel, message }: { district: string; levelLabel: string | null; message: string }) {
  const tr = useTr();
  const [times, setTimes] = useState<Partial<Record<Step, string>>>(() => ({ drafted: clock() }));
  const [held, setHeld] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  const approved = times.approved != null, sent = times.sent != null;
  const approve = () => {
    if (approved) return;
    setHeld(false);
    setTimes((t) => ({ ...t, approved: clock() }));
    timer.current = window.setTimeout(() => setTimes((t) => ({ ...t, sent: clock() })), SEND_MS);
  };
  const answer = (r: Reply) => {
    if (!sent || reply) return;
    const now = clock();
    setReply(r);
    setTimes((t) => ({ ...t, read: now, confirmed: now }));
  };
  const reset = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    setTimes({ drafted: clock() });
    setHeld(false);
    setReply(null);
  };

  const names: Record<Step, string> = {
    drafted: tr('Drafted', 'Disusun'), approved: tr('Approved', 'Disetujui'), sent: tr('Sent', 'Terkirim'),
    read: tr('Read', 'Dibaca'), confirmed: tr('Confirmed', 'Dikonfirmasi'),
  };
  const preview = message.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join('\n');
  const status = reply === 'read' ? tr('1 resident confirmed', '1 warga mengonfirmasi')
    : reply === 'fire' ? tr('1 report of fire: ask a crew to check the ground', '1 laporan api: minta regu mengecek lapangan')
    : sent ? tr('Sent to the village group. Waiting for a reply.', 'Terkirim ke grup desa. Menunggu balasan.')
    : approved ? tr('Approved. Sending…', 'Disetujui. Mengirim…')
    : held ? tr('On hold: nothing leaves the office.', 'Ditahan: tidak ada yang keluar dari kantor.')
    : tr('Waiting for the office to decide.', 'Menunggu keputusan kantor.');

  return (
    <section className="ka-loop" aria-labelledby="ka-loop-h">
      <p className="ka-loop-eyebrow">{tr('Next: the alert loop', 'Berikutnya: alur peringatan')}</p>
      <h2 id="ka-loop-h" className="ka-loop-title">{tr('From the office to the village, and back', 'Dari kantor ke desa, lalu kembali')}</h2>

      <div className="ka-loop-grid">
        {/* the disaster office */}
        <div className="ka-loop-col">
          <p className="ka-loop-sub">{tr('Disaster office · decision queue', 'Kantor penanggulangan bencana · antrean keputusan')}</p>
          <div className="ka-loop-card">
            <p className="ka-loop-card-head">
              <b>{district}</b>
              {levelLabel ? <span className="ka-loop-badge">{levelLabel}</span> : null}
            </p>
            <p className="ka-loop-preview">{preview}</p>
            <div className="ka-loop-btns">
              <button type="button" className="ka-loop-btn is-primary" onClick={approve} disabled={approved}>{tr('Approve and send', 'Setujui dan kirim')}</button>
              <button type="button" className="ka-loop-btn" onClick={() => setHeld(true)} disabled={approved}>{tr('Hold', 'Tahan')}</button>
            </div>
            <p className={`ka-loop-status${reply === 'fire' ? ' is-fire' : reply === 'read' ? ' is-ok' : ''}`} aria-live="polite">{status}</p>
          </div>
        </div>

        {/* the steps, each with the time it happened */}
        <ol className="ka-loop-steps" aria-label={tr('Steps of the alert', 'Langkah peringatan')}>
          {STEPS.map((s) => (
            <li key={s} className={times[s] ? 'is-on' : undefined}>
              <i aria-hidden="true" />
              <b>{names[s]}</b>
              <span>{times[s] ? `${times[s]} WIB` : '–'}</span>
            </li>
          ))}
        </ol>

        {/* one resident's phone */}
        <div className="ka-loop-col">
          <p className="ka-loop-sub">{tr('A resident’s phone', 'Ponsel seorang warga')}</p>
          <div className="ka-loop-phone">
            <p className="ka-loop-phone-head">{tr('Demo · Village group', 'Demo · Grup desa')}</p>
            <div className="ka-loop-chat">
              {sent ? <p className="ka-loop-bubble">{message}</p> : <p className="ka-loop-empty">{tr('No message yet', 'Belum ada pesan')}</p>}
              {reply ? <p className="ka-loop-bubble is-mine">{reply === 'read' ? tr('I have read it', 'Sudah saya baca') : tr('I see fire', 'Saya melihat api')}</p> : null}
            </div>
            <div className="ka-loop-btns is-phone">
              <button type="button" className="ka-loop-btn" onClick={() => answer('read')} disabled={!sent || !!reply}>{tr('I have read it', 'Sudah saya baca')}</button>
              <button type="button" className="ka-loop-btn is-fire" onClick={() => answer('fire')} disabled={!sent || !!reply}>{tr('I see fire', 'Saya melihat api')}</button>
            </div>
          </div>
        </div>
      </div>

      <p className="ka-loop-foot">
        <button type="button" className="ka-loop-btn" onClick={reset}>{tr('Start again', 'Mulai lagi')}</button>
      </p>
    </section>
  );
}

export default AlertLoop;
