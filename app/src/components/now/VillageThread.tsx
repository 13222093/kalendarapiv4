// KalenderApi (new file): the "Village" tab of the command view (pages/CommandConsole.tsx).
// First the thread with the village: the drafted alert (the residents' template message the page has written) waiting
// for the office, marked sent once the queue approves it, then the resident's one reply and the office's answer, each
// line with its time in WIB and who wrote it. The thread is a demo and sends nothing: its header says so ("Demo ·
// Village group"), and the lines live in the browser only (lib/nowconsole.ts). Under it, the real way to send: the
// same message opened in WhatsApp or copied, by the reader's own hand; then the two other template messages, the
// optional AI draft, and a resident's own report. All texts and numbers are the classic page's.
import { useEffect, useRef } from 'react';
import { districtTitle, waLink } from '../../lib/now.ts';
import { alertStatus, clockWib, threadOf, type ConsoleState, type Reply, type ThreadLine } from '../../lib/nowconsole.ts';
import { aoiName } from '../../lib/record.ts';
import { AiDraft, ReportBack, copyText, type NowModel } from '../../pages/Now.tsx';

interface ThreadProps {
  m: NowModel; state: ConsoleState;
  hasVillageRow: boolean;                      // the queue holds "Tell the village" (the level is Watch or High)
  othersOpen: boolean; onOthers: (open: boolean) => void;
  primarySend: boolean;                        // the alert is approved: "Open in WhatsApp" is now the one accented action
  onApprove: () => void; onHold: () => void; onReply: (r: Reply) => void;
  onQueue: () => void;                         // go to the queue row that approves the alert
}

export function VillageThread({ m, state, hasVillageRow, othersOpen, onOthers, primarySend, onApprove, onHold, onReply, onQueue }: ThreadProps) {
  const { tr, lang, aoi, aoiId, liveData, result, levelName, msgLang, setMsgLang, phones, setPhones, copied, setCopied, message, cards, aiFacts } = m;
  const alert = state.alert;
  const status = alertStatus(alert);
  const sent = alert.times.sent != null, approved = alert.times.approved != null;
  // When the alert has just been sent, the two answers are what comes next: on the one-screen layout the panel scrolls
  // just enough to show them above the send row that stays at its bottom. Not on load, and not where the page scrolls.
  const wasSent = useRef(sent);
  useEffect(() => {
    if (sent && !wasSent.current && window.matchMedia('(min-width: 1100px)').matches) {
      document.getElementById('cmd-replies')?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    wasSent.current = sent;
  }, [sent]);
  if (!aoi) return null;
  const lines = threadOf(alert);
  const residents = message('residents');

  const who = { office: tr('Office', 'Kantor'), resident: tr('Resident', 'Warga') };
  const mark: Record<NonNullable<ThreadLine['mark']>, string> = {
    waiting: tr('waiting for approval', 'menunggu persetujuan'), held: tr('held', 'ditahan'),
    sending: tr('sending…', 'mengirim…'), sent: tr('sent', 'terkirim'),
  };
  const words = (l: ThreadLine): string => {
    switch (l.kind) {
      case 'alert': return residents;
      case 'reply-read': return tr('I have read it', 'Sudah saya baca');
      case 'reply-fire': return tr('I see fire', 'Saya melihat api');
      case 'ack-read': return tr('Received. Thank you.', 'Diterima. Terima kasih.');
      case 'ack-fire': return tr('Received. The office will ask a crew to check the ground. Keep away from fire and smoke.', 'Diterima. Kantor akan meminta regu mengecek lapangan. Jauhi api dan asap.');
    }
  };
  const copyNote = (kind: string) => (
    <span className="cmd-small" role="status">{copied === kind ? tr('Copied.', 'Tersalin.') : copied === `fail-${kind}` ? tr('Could not copy; select the text instead.', 'Tidak dapat menyalin; pilih teksnya secara manual.') : ''}</span>
  );
  const phoneField = (kind: 'residents' | 'bpbd' | 'crew') => (
    <>
      <label htmlFor={`cmd-p-${kind}`}>{tr('Local post phone number (optional, added to the text)', 'Nomor telepon posko setempat (opsional, ditambahkan ke teks)')}</label>
      <input id={`cmd-p-${kind}`} type="tel" inputMode="tel" autoComplete="off" value={phones[kind]} maxLength={24}
        onChange={(ev) => setPhones((p) => ({ ...p, [kind]: ev.target.value }))} />
    </>
  );

  return (
    <div className="cmd-village">
      {/* what this tab holds, in one line (the classic page's "What to do, and who to tell") */}
      <p className="cmd-small cmd-village-what">
        {tr('Who to tell: the alert to the village, three messages ready to send, and a resident\'s report.',
          'Siapa yang dikabari: peringatan untuk desa, tiga pesan siap dikirim, dan laporan warga.')}
      </p>

      {/* ---- the thread */}
      <section className="cmd-thread" id="cmd-thread" tabIndex={-1} aria-labelledby="cmd-h-thread">
        <header className="cmd-thread-head">
          <h2 id="cmd-h-thread" className="cmd-thread-name">{tr('Demo · Village group', 'Demo · Grup desa')}</h2>
          <p className="cmd-thread-sub">
            {districtTitle(aoiName(aoi, msgLang), msgLang)}
            {result.level ? <span className="cmd-chip">{levelName(result.level)}</span> : null}
          </p>
        </header>
        <ol className="cmd-lines" aria-live="polite" aria-label={tr('Messages, oldest first', 'Pesan, terlama lebih dulu')}>
          {lines.map((l) => (
            <li key={l.key} className={`cmd-line is-${l.who}${l.mark && l.mark !== 'sent' ? ' is-draft' : ''}`}>
              <time className="cmd-line-time" dateTime={new Date(l.at).toISOString()}>{clockWib(l.at)}<small>WIB</small></time>
              <div className="cmd-line-body">
                <p className="cmd-line-who">{who[l.who]}{l.mark ? <span className={`cmd-chip is-${l.mark === 'sent' ? 'approved' : l.mark === 'held' ? 'held' : 'waiting'}`}>{mark[l.mark]}</span> : null}</p>
                <p className="cmd-line-text" lang={l.kind === 'alert' ? msgLang : lang}>{words(l)}</p>
              </div>
            </li>
          ))}
        </ol>

        {!approved ? (
          hasVillageRow ? (
            <p className="cmd-thread-note">
              {status === 'held' ? tr('On hold: nothing leaves the office.', 'Ditahan: tidak ada yang keluar dari kantor.') : tr('Waiting for the office to decide.', 'Menunggu keputusan kantor.')}
              {' '}<button type="button" className="cmd-link" onClick={onQueue}>{tr('Go to the queue row', 'Ke baris antrean')}</button>
            </p>
          ) : (
            <div className="cmd-thread-note">
              <p>{status === 'held' ? tr('On hold: nothing leaves the office.', 'Ditahan: tidak ada yang keluar dari kantor.')
                : result.level
                  ? tr('The queue does not ask for this alert today. The office can still approve it here.', 'Antrean tidak meminta peringatan ini hari ini. Kantor tetap dapat menyetujuinya di sini.')
                  // no level (today's hotspots could not be read): that, not a quiet day, is why no row asks for it
                  : tr('No level is set, because today\'s hotspots could not be read, so the queue has no row for this alert. The office can still approve it here.',
                    'Tingkat belum ditentukan karena titik panas hari ini tidak dapat dibaca, sehingga antrean tidak memuat baris untuk peringatan ini. Kantor tetap dapat menyetujuinya di sini.')}</p>
              <div className="cmd-row-actions">
                <button type="button" className="cmd-btn" onClick={onApprove}>{tr('Approve and send', 'Setujui dan kirim')}</button>
                <button type="button" className="cmd-btn" onClick={onHold} disabled={alert.held}>{tr('Hold', 'Tahan')}</button>
              </div>
            </div>
          )
        ) : null}

        <div className="cmd-replies" id="cmd-replies" role="group" aria-labelledby="cmd-h-replies">
          <p className="cmd-label" id="cmd-h-replies">{tr('Answer as a resident', 'Jawab sebagai warga')}</p>
          <div className="cmd-row-actions">
            <button type="button" className="cmd-btn" onClick={() => onReply('read')} disabled={!sent || !!alert.reply}>{tr('I have read it', 'Sudah saya baca')}</button>
            <button type="button" className="cmd-btn" onClick={() => onReply('fire')} disabled={!sent || !!alert.reply}>{tr('I see fire', 'Saya melihat api')}</button>
          </div>
        </div>
      </section>

      {/* ---- the real way to send the same message */}
      <section className="cmd-send" aria-labelledby="cmd-h-send">
        <div className="cmd-sec-head">
          <h3 id="cmd-h-send" className="cmd-label">{tr('Three messages, ready to send', 'Tiga pesan, siap dikirim')}</h3>
          <div className="cmd-seg" role="group" aria-label={tr('Message language', 'Bahasa pesan')}>
            <button type="button" aria-pressed={msgLang === 'id'} onClick={() => setMsgLang('id')}>Bahasa Indonesia</button>
            <button type="button" aria-pressed={msgLang === 'en'} onClick={() => setMsgLang('en')}>English</button>
          </div>
        </div>
        <p className="cmd-small">{tr('Each text is a fixed template filled with the numbers on this page. Nothing is sent until you send it yourself.', 'Setiap teks adalah templat tetap yang diisi angka dari halaman ini. Tidak ada yang terkirim sampai Anda sendiri mengirimnya.')}</p>
      </section>
      {/* The send row of the residents' message (the text is the thread's first line). On the one-screen layout it stays
          at the bottom of the panel while the thread is read (styles/nowconsole.css); once the alert is approved its
          WhatsApp button is the one accented action. */}
      <div className="cmd-sendbar" role="group" aria-labelledby="cmd-h-sendbar">
        <p className="cmd-label" id="cmd-h-sendbar">{cards.find((c) => c.kind === 'residents')?.title}</p>
        <div className="cmd-row-actions">
          <a className={`cmd-btn ${primarySend ? 'cmd-btn-accent' : 'cmd-btn-strong'}`} href={waLink(residents)} target="_blank" rel="noopener noreferrer">{tr('Open in WhatsApp', 'Buka di WhatsApp')}</a>
          <button type="button" className="cmd-btn" onClick={() => { void copyText(residents).then((ok) => setCopied(ok ? 'residents' : 'fail-residents')); }}>{tr('Copy', 'Salin')}</button>
          {copyNote('residents')}
        </div>
      </div>
      <div className="cmd-sendphone">{phoneField('residents')}</div>

      {/* ---- the two other template messages */}
      <details className="cmd-more cmd-others" open={othersOpen} onToggle={(ev) => onOthers(ev.currentTarget.open)}>
        <summary>{tr('The other two: for the disaster office and the fire crew', 'Dua lainnya: untuk BPBD dan regu pemadam')}</summary>
        {cards.filter((c) => c.kind !== 'residents').map(({ kind, title }) => {
          const text = message(kind);
          return (
            <article className="cmd-msg" key={kind} id={`cmd-m-${kind}`} tabIndex={-1} aria-labelledby={`cmd-mh-${kind}`}>
              <h4 id={`cmd-mh-${kind}`} className="cmd-msg-title">{title}</h4>
              <p className="cmd-msg-text" lang={msgLang}>{text}</p>
              {phoneField(kind)}
              <div className="cmd-row-actions">
                <a className="cmd-btn cmd-btn-strong" href={waLink(text)} target="_blank" rel="noopener noreferrer">{tr('Share on WhatsApp', 'Bagikan ke WhatsApp')}</a>
                <button type="button" className="cmd-btn" onClick={() => { void copyText(text).then((ok) => setCopied(ok ? kind : `fail-${kind}`)); }}>{tr('Copy', 'Salin')}</button>
                {copyNote(kind)}
              </div>
            </article>
          );
        })}
      </details>

      {/* ---- the optional AI draft, in a fold of its own that says what it is. When the site has no AI key the draft
           removes itself on the first press, and the fold goes with it (styles/nowconsole.css). */}
      {aiFacts ? (
        <details className="cmd-more cmd-ai">
          <summary>{tr('Draft advice with AI', 'Susun saran dengan AI')}</summary>
          <AiDraft key={`${aoiId}:${lang}:${liveData?.fetched_at ?? ''}`} facts={aiFacts} lang={lang} />
        </details>
      ) : null}

      {/* ---- the way back: a resident's own report, written for WhatsApp */}
      <ReportBack variant="console" place={districtTitle(aoiName(aoi, msgLang), msgLang)} msgLang={msgLang} phone={phones.residents || phones.bpbd || phones.crew} />
    </div>
  );
}
