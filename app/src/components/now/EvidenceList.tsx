// KalenderApi (new file): the "Evidence" tab of the command view (pages/CommandConsole.tsx).
// Everything the classic page shows as evidence, as one dense list instead of tiles and cards: the hotspots of the
// last 24 hours and 7 days by sensor, the newest detection, when NASA's files were last updated, this month on the
// one scale against the usual month, whether a zero can be trusted here (the cloud history), the peat sites with all
// their numbers, and the links to the district's other pages. Every number and sentence is the classic page's; this
// file loads nothing. The cloud history counts cloud only; peat sites are places where fire came back in a past
// season, not places burning now.
import { saveText } from '../../lib/download.ts';
import { SENSORS, SENSOR_LABEL, STATUS_NAME, peatCsv, pointMs, wib } from '../../lib/now.ts';
import { dateOnly } from '../../lib/record.ts';
import { MIN_EARLIER_YEARS } from '../../lib/robust.ts';
import { SITE_ROWS, type NowModel } from '../../pages/Now.tsx';

/** `onShow`: "Show on map" for a peat site; null when the map could not start (no WebGL), and the buttons are left out. */
export function EvidenceList({ m, onShow }: { m: NowModel; onShow: ((lon: number, lat: number) => void) | null }) {
  const {
    tr, lang, aoi, aoiId, rows, setTick, liveState, liveData, nowMs, counts, updatedMs, byBox, photoDay,
    monthRow, earlierYears, mf, recordDate, baseline, blindRow, blindSeasons, peat, num, place, cut, liveSource,
  } = m;
  if (!aoi) return null;

  return (
    <div className="cmd-evidence">
      {/* ---- hotspots, near real time */}
      <section className="cmd-ev" aria-labelledby="cmd-h-ev">
        <div className="cmd-sec-head">
          <h2 id="cmd-h-ev" className="cmd-label">{tr('The evidence', 'Buktinya')} · {tr('Hotspots', 'Titik panas')}</h2>
          <button type="button" className="cmd-btn cmd-btn-small" onClick={() => setTick((t) => t + 1)} disabled={liveState.state === 'loading'}>
            {liveState.state === 'loading' ? tr('Reading…', 'Membaca…') : tr('Read again', 'Baca ulang')}
          </button>
        </div>
        {liveState.state === 'loading' ? <p className="cmd-small" role="status">{tr('Reading the newest NASA hotspot files…', 'Membaca berkas titik panas NASA terbaru…')}</p> : null}
        {liveState.state === 'unavailable' ? (
          <div className="cmd-alert" role="alert">
            <p><b>{tr('Live hotspots could not be read.', 'Titik panas langsung tidak dapat dibaca.')}</b>{' '}
              {liveState.why === 'no-function'
                ? tr('This copy of the site runs without the live-data function (/api/live), so it cannot read NASA\'s near-real-time files.', 'Salinan situs ini berjalan tanpa fungsi data langsung (/api/live), sehingga tidak dapat membaca berkas waktu hampir nyata NASA.')
                : tr(`NASA's near-real-time files did not answer (${liveState.detail}).`, `Berkas waktu hampir nyata NASA tidak menjawab (${liveState.detail}).`)}
              {' '}{tr('The map has no hotspots because the data did not load, not because there is no fire.', 'Peta tidak memuat titik panas karena datanya tidak termuat, bukan karena tidak ada api.')}
            </p>
            {mf ? (
              <p>{tr(`Shown instead, the newest month of our own record: ${mf.label}${mf.partial ? ' (still running)' : ''}, ${num(mf.H, 1)} fire cell-days in ${place} on the one MODIS and VIIRS scale${recordDate ? `; record built ${recordDate}` : ''}.`,
                `Sebagai gantinya, bulan terbaru dari catatan kami sendiri: ${mf.label}${mf.partial ? ' (masih berjalan)' : ''}, ${num(mf.H, 1)} sel-hari api di ${place} pada satu skala MODIS dan VIIRS${recordDate ? `; catatan dibuat ${recordDate}` : ''}.`)}</p>
            ) : null}
          </div>
        ) : null}
        {counts && liveData ? (
          <>
            <dl className="cmd-facts">
              {([['24', counts.total24, counts.by24], ['7', counts.total7, counts.by7]] as const).map(([k, total, by]) => (
                <div key={k}>
                  <dt>{k === '24' ? tr('Hotspots, last 24 hours', 'Titik panas, 24 jam terakhir') : tr('Hotspots, last 7 days', 'Titik panas, 7 hari terakhir')}</dt>
                  <dd className="cmd-num">{num(total)}</dd>
                  <dd className="cmd-facts-sub">
                    {SENSORS.map((sn) => (
                      <span key={sn}><i className={`now-dot ${sn === 'MODIS' ? 'now-dot-modis' : 'now-dot-viirs'}`} aria-hidden="true" />{SENSOR_LABEL[sn]}: <b>{num(by[sn])}</b>
                        {liveData.failed.includes(sn) ? <em> {tr('(file not read)', '(berkas tidak terbaca)')}</em> : null}</span>
                    ))}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{tr('Newest detection in the district', 'Deteksi terbaru di kabupaten')}</dt>
                <dd className="cmd-val">{counts.newest ? wib(pointMs(counts.newest), lang) : tr('none in 7 days', 'tidak ada dalam 7 hari')}</dd>
                {counts.newest ? <dd className="cmd-facts-sub">{SENSOR_LABEL[counts.newest[4]]}{counts.newest[2] != null ? `, ${num(counts.newest[2], 1)} MW` : ''}</dd> : null}
              </div>
              <div>
                <dt>{tr('NASA files last updated', 'Berkas NASA terakhir diperbarui')}</dt>
                <dd className="cmd-val">{updatedMs != null ? wib(updatedMs, lang) : tr('not stated', 'tidak disebutkan')}</dd>
              </div>
            </dl>
            <p className="cmd-small">
              {tr(`NASA FIRMS, read ${wib(nowMs, lang)}.`, `NASA FIRMS, dibaca ${wib(nowMs, lang)}.`)}
              {liveData.failed.length ? ' ' + tr(`Not read this time: ${liveData.failed.join(', ')}; its count is unknown, not zero.`, `Tidak terbaca kali ini: ${liveData.failed.join(', ')}; jumlahnya tidak diketahui, bukan nol.`) : ''}
            </p>
            <details className="cmd-more">
              <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
              <p className="cmd-small">
                {tr(`Unit: hotspots (one satellite detection of heat; not a fire count and not burned area). Source: ${liveSource}; VIIRS confidence nominal or high, MODIS confidence 30 or more. Read ${wib(nowMs, lang)}; counted by detection time in the 24 hours and the 7 days before that, inside the ${byBox ? 'bounding box of the district (the outline did not load)' : 'district outline'}.`,
                  `Satuan: titik panas (satu deteksi panas oleh satelit; bukan jumlah kebakaran dan bukan luas terbakar). Sumber: ${liveSource}; keyakinan VIIRS nominal atau tinggi, keyakinan MODIS 30 atau lebih. Dibaca ${wib(nowMs, lang)}; dihitung menurut waktu deteksi dalam 24 jam dan 7 hari sebelumnya, di dalam ${byBox ? 'kotak batas kabupaten (garis batas tidak termuat)' : 'garis batas kabupaten'}.`)}
              </p>
            </details>
          </>
        ) : null}
      </section>

      {/* ---- is this normal? this month on the one-scale record */}
      <section className="cmd-ev" aria-labelledby="cmd-h-normal">
        <h2 id="cmd-h-normal" className="cmd-label">{tr('Is this normal?', 'Apakah ini normal?')}</h2>
        {rows.state === 'loading' ? <p className="cmd-small" role="status">{tr('Loading the district record…', 'Memuat catatan kabupaten…')}</p> : null}
        {rows.state === 'error' || rows.state === 'missing' ? <p className="cmd-small" role="note">{tr('The district\'s monthly record could not be loaded.', 'Catatan bulanan kabupaten tidak dapat dimuat.')}</p> : null}
        {mf ? (
          <>
            <dl className="cmd-facts">
              <div>
                <dt>{tr('This month on one scale (MODIS + VIIRS)', 'Bulan ini pada satu skala (MODIS + VIIRS)')}</dt>
                <dd className="cmd-num">{num(mf.H, 1)} {mf.status ? <span className={`cmd-chip cmd-chip-${mf.status}`}>{STATUS_NAME[mf.status][lang]}</span> : <span className="cmd-chip">{tr('no label', 'tanpa label')}</span>}</dd>
                <dd className="cmd-facts-sub">{tr(`fire cell-days, ${mf.label}${mf.partial ? ' so far' : ''}`, `sel-hari api, ${mf.label}${mf.partial ? ' sejauh ini' : ''}`)}{mf.median != null ? tr(`; the usual ${mf.monthOnly}: ${num(mf.median, mf.median % 1 ? 1 : 0)}`, `; ${mf.monthOnly} biasanya: ${num(mf.median, mf.median % 1 ? 1 : 0)}`) : ''}</dd>
              </div>
            </dl>
            <p className="cmd-text">
              {tr(`${mf.label}${mf.partial ? ' so far' : ''}: ${num(mf.H, 1)} fire cell-days in ${place} on the one-scale record.`,
                `${mf.label}${mf.partial ? ' sejauh ini' : ''}: ${num(mf.H, 1)} sel-hari api di ${place} pada catatan satu skala.`)}
            </p>
            <details className="cmd-more">
              <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
              <p className="cmd-small">
                {mf.median != null ? tr(`The median ${mf.monthOnly}${baseline ? ` (${baseline[0]} to ${baseline[1]})` : ''} has ${num(mf.median, mf.median % 1 ? 1 : 0)}. `, `Median ${mf.monthOnly}${baseline ? ` (${baseline[0]} sampai ${baseline[1]})` : ''} adalah ${num(mf.median, mf.median % 1 ? 1 : 0)}. `) : ''}
                {mf.higherPct != null ? tr(`This month is higher than ${num(mf.higherPct)}% of the ${earlierYears} earlier ${mf.monthOnly}s on record (ties count half). `, `Bulan ini lebih tinggi dari ${num(mf.higherPct)}% dari ${earlierYears} ${mf.monthOnly} sebelumnya dalam catatan (nilai sama dihitung setengah). `)
                  : tr(`There are fewer than ${MIN_EARLIER_YEARS} earlier years of this month, so no label is given. `, `Tahun sebelumnya untuk bulan ini kurang dari ${MIN_EARLIER_YEARS}, sehingga tidak diberi label. `)}
                {tr(`Labels: below normal under ${cut(0)}%, near normal under ${cut(1)}%, above normal under ${cut(2)}%, far above normal from ${cut(2)}%.`, `Label: di bawah normal bila kurang dari ${cut(0)}%, mendekati normal bila kurang dari ${cut(1)}%, di atas normal bila kurang dari ${cut(2)}%, jauh di atas normal mulai ${cut(2)}%.`)}
                {mf.partial ? ' ' + tr('The month is still running, so its count can still rise.', 'Bulan ini masih berjalan, sehingga angkanya masih bisa naik.') : ''}
              </p>
              <p className="cmd-small">
                {tr('Why one scale: MODIS and VIIRS count fire differently (VIIRS sees smaller fires), so a raw count from today\'s satellites cannot be set beside a count from 2005. Only a single harmonized scale lets this month be compared with 25 years.',
                  'Mengapa satu skala: MODIS dan VIIRS menghitung api secara berbeda (VIIRS melihat api yang lebih kecil), sehingga hitungan mentah dari satelit hari ini tidak dapat disandingkan dengan hitungan tahun 2005. Hanya satu skala terharmonisasi yang memungkinkan bulan ini dibandingkan dengan 25 tahun.')}
              </p>
              <p className="cmd-small">
                {tr(`Unit: fire cell-days (a 0.01 degree cell with a hotspot on one day), MODIS and VIIRS harmonized to one scale. District values are an approximate share-out of the province record. Source: NASA FIRMS archives, KalenderApi record${recordDate ? ` built ${recordDate}` : ''}${monthRow?.flag_nrt ? '; this month is near-real-time data, provisional' : ''}.`,
                  `Satuan: sel-hari api (sel 0,01 derajat dengan titik panas pada satu hari), MODIS dan VIIRS diharmonisasi ke satu skala. Nilai kabupaten adalah pembagian perkiraan dari catatan provinsi. Sumber: arsip NASA FIRMS, catatan KalenderApi${recordDate ? ` dibuat ${recordDate}` : ''}${monthRow?.flag_nrt ? '; bulan ini data waktu hampir nyata, sementara' : ''}.`)}
              </p>
            </details>
          </>
        ) : rows.state === 'ok' ? <p className="cmd-small" role="note">{tr('The record has no value for this district yet.', 'Catatan belum memuat nilai untuk kabupaten ini.')}</p> : null}
      </section>

      {/* ---- can a zero be trusted here? the cloud history, and how to read today's zero */}
      <section className="cmd-ev" aria-labelledby="cmd-h-zero">
        <h2 id="cmd-h-zero" className="cmd-label">{tr('Can a zero be trusted here?', 'Apakah nol bisa dipercaya di sini?')}</h2>
        {blindRow ? (
          <dl className="cmd-facts">
            <div>
              <dt>{tr('Days mostly under cloud', 'Hari yang sebagian besar tertutup awan')}</dt>
              <dd className="cmd-num">{num(blindRow.share_pct, 1)}%</dd>
              <dd className="cmd-facts-sub">{tr(`of past Aug to Oct district-days were mostly under cloud (${num(blindRow.district_days_above)} of ${num(blindRow.district_days)})`, `hari-kabupaten Agu sampai Okt yang lalu sebagian besar tertutup awan (${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)})`)}</dd>
            </div>
          </dl>
        ) : <p className="cmd-small">{tr('No cloud history layer for this district. Judge cloud from the photo on the map.', 'Belum ada lapisan riwayat awan untuk kabupaten ini. Nilai awan dari foto pada peta.')}</p>}
        <p className="cmd-text">
          {counts
            ? counts.total24 === 0
              ? tr('The satellites recorded zero hotspots in this district in the last 24 hours.', 'Satelit mencatat nol titik panas di kabupaten ini dalam 24 jam terakhir.')
              : tr(`The satellites recorded ${num(counts.total24)} hotspot${counts.total24 === 1 ? '' : 's'} in this district in the last 24 hours; everywhere else in it they recorded none.`, `Satelit mencatat ${num(counts.total24)} titik panas di kabupaten ini dalam 24 jam terakhir; di bagian lain kabupaten tidak ada yang tercatat.`)
            : tr('Today\'s hotspots could not be read here.', 'Titik panas hari ini tidak dapat dibaca di sini.')}
          {' '}<b>{tr('Under cloud, no hotspot means not seen, not no fire.', 'Di bawah awan, tidak ada titik panas berarti tidak terlihat, bukan tidak ada api.')}</b>
        </p>
        <details className="cmd-more">
          <summary>{tr('How to read a zero', 'Cara membaca angka nol')}</summary>
          <p className="cmd-small">
            {photoDay
              ? tr(`Look at the photo of ${photoDay} on the map. Where the district is white with cloud, a satellite could not see the ground, so no hotspot there does not mean no fire: it means not seen. Where the ground is clear in the photo, a zero is more believable, though small or smouldering peat fires can still be missed.`,
                `Lihat foto tanggal ${photoDay} pada peta. Di bagian kabupaten yang putih tertutup awan, satelit tidak dapat melihat permukaan tanah, sehingga tidak adanya titik panas di sana tidak berarti tidak ada api: artinya tidak terlihat. Di bagian yang permukaannya tampak jelas pada foto, nol lebih dapat dipercaya, meskipun api kecil atau bara gambut masih bisa terlewat.`)
              : tr('Under cloud a satellite cannot see the ground, so no hotspot there does not mean no fire: it means not seen. Without a photo, cloud cannot be judged on this page.',
                'Di bawah awan satelit tidak dapat melihat permukaan tanah, sehingga tidak adanya titik panas di sana tidak berarti tidak ada api: artinya tidak terlihat. Tanpa foto, awan tidak dapat dinilai di halaman ini.')}
          </p>
          {blindRow && blindSeasons.length ? (
            <p className="cmd-small">
              {tr(`History of this district: in ${num(blindRow.district_days_above)} of ${num(blindRow.district_days)} district-days (${num(blindRow.share_pct, 1)}%) of ${blindSeasons.length} past August to October seasons (${Math.min(...blindSeasons)} to ${Math.max(...blindSeasons)}), cloud left more than half of the district's no-fire cells with no cloud-free look from MODIS on Terra or Aqua.`,
                `Riwayat kabupaten ini: pada ${num(blindRow.district_days_above)} dari ${num(blindRow.district_days)} hari-kabupaten (${num(blindRow.share_pct, 1)}%) dalam ${blindSeasons.length} musim Agustus sampai Oktober yang lalu (${Math.min(...blindSeasons)} sampai ${Math.max(...blindSeasons)}), awan membuat lebih dari separuh sel tanpa api di kabupaten ini tidak mendapat pandangan bebas awan dari MODIS pada Terra atau Aqua.`)}
              {' '}{tr('Thick smoke is not flagged as cloud, so this is a lower bound. The 2019 season is not in this count: a test registered in advance covers it.', 'Asap tebal tidak ditandai sebagai awan, sehingga angka ini adalah batas bawah. Musim 2019 tidak masuk hitungan ini: musim itu dicakup oleh uji yang didaftarkan lebih dulu.')}
              {' '}{tr('Source: NASA MOD14A1 and MYD14A1 daily FireMask.', 'Sumber: FireMask harian NASA MOD14A1 dan MYD14A1.')}
            </p>
          ) : null}
        </details>
      </section>

      {/* ---- peat: the count, then every listed site with its numbers */}
      {peat ? (
        <section className="cmd-ev" id="cmd-peat" tabIndex={-1} aria-labelledby="cmd-h-peat">
          <div className="cmd-sec-head">
            <h2 id="cmd-h-peat" className="cmd-label">{tr('Peat', 'Gambut')} · {tr('Peat sites to re-check', 'Lokasi gambut untuk dicek ulang')}</h2>
            <button type="button" className="cmd-btn cmd-btn-small"
              onClick={() => saveText(peatCsv(peat, aoi.name ?? aoiId, aoiId, new Date().toISOString().slice(0, 10)), `kalenderapi_peat_sites_${aoiId}_${peat.season ?? 'season'}.csv`)}>
              {tr(`Download CSV (${peat.sites.length} sites)`, `Unduh CSV (${peat.sites.length} lokasi)`)}
            </button>
          </div>
          <dl className="cmd-facts">
            <div>
              <dt>{tr('Peat', 'Gambut')}</dt>
              <dd className="cmd-num">{peat.persistentSites != null ? num(peat.persistentSites) : num(peat.sites.length)}</dd>
              <dd className="cmd-facts-sub">
                {tr(`persistent peat sites, Aug to Oct ${peat.season ?? ''}${peat.provisional ? ' (provisional)' : ''}`, `lokasi gambut persisten, Agu sampai Okt ${peat.season ?? ''}${peat.provisional ? ' (sementara)' : ''}`)}
                {peat.comeBacks ? tr(`; fire detected again after a gap ${num(peat.comeBacks.total)} times`, `; api terdeteksi lagi setelah jeda ${num(peat.comeBacks.total)} kali`) : ''}
              </dd>
            </div>
          </dl>
          <p className="cmd-text">
            {tr('On peat, fire came back at these places after days when the satellite had a clear look and detected nothing. Places like this are worth a ground re-check.',
              'Di lahan gambut, api muncul lagi di tempat-tempat ini setelah hari-hari ketika satelit mendapat pandangan jelas dan tidak mendeteksi apa pun. Tempat seperti ini layak dicek ulang di lapangan.')}
          </p>
          <details className="cmd-more">
            <summary>{tr('How this is counted', 'Cara menghitungnya')}</summary>
            <p className="cmd-small">
              {tr(`${place}, August to October ${peat.season ?? ''} season${peat.provisional ? ' (near-real-time data, provisional)' : ''}.`,
                `${place}, musim Agustus sampai Oktober ${peat.season ?? ''}${peat.provisional ? ' (data waktu hampir nyata, sementara)' : ''}.`)}
              {peat.persistentSites != null ? ' ' + tr(`${num(peat.persistentSites)} peat cells of about 1.1 km had fire detected on three or more days, or again after a gap of two or more days.`, `${num(peat.persistentSites)} sel gambut berukuran sekitar 1,1 km mencatat api pada tiga hari atau lebih, atau lagi setelah jeda dua hari atau lebih.`) : ''}
              {peat.comeBacks ? ' ' + tr(`Fire was detected again after a gap ${num(peat.comeBacks.total)} times: ${num(peat.comeBacks.seenQuiet)} after days with a clear look and nothing detected, ${num(peat.comeBacks.underCloud)} after days under cloud only, and ${num(peat.comeBacks.modisFire)} where MODIS did detect fire during the gap${peat.comeBacks.noData ? `; ${num(peat.comeBacks.noData)} had no usable look` : ''}.`,
                `Api terdeteksi lagi setelah jeda sebanyak ${num(peat.comeBacks.total)} kali: ${num(peat.comeBacks.seenQuiet)} setelah hari-hari dengan pandangan jelas tanpa deteksi, ${num(peat.comeBacks.underCloud)} setelah hari-hari yang seluruhnya berawan, dan ${num(peat.comeBacks.modisFire)} ketika MODIS mendeteksi api selama jeda${peat.comeBacks.noData ? `; ${num(peat.comeBacks.noData)} tanpa pandangan yang dapat dipakai` : ''}.`) : ''}
              {' '}{tr(`The ${Math.min(SITE_ROWS, peat.sites.length)} sites with the most days are listed; the CSV has ${peat.sites.length}.`, `${Math.min(SITE_ROWS, peat.sites.length)} lokasi dengan hari terbanyak ditampilkan; berkas CSV memuat ${peat.sites.length}.`)}
            </p>
          </details>
          <ol className="cmd-sites" aria-label={tr('Peat sites to re-check', 'Lokasi gambut untuk dicek ulang')}>
            {peat.sites.slice(0, SITE_ROWS).map((x, i) => (
              <li key={`${x.lon},${x.lat}`}>
                <span className="cmd-sites-n" aria-hidden="true">{i + 1}</span>
                <div>
                  <p className="cmd-sites-at">{x.lat.toFixed(3)}, {x.lon.toFixed(3)}</p>
                  <p className="cmd-sites-facts">
                    {tr(`${num(x.days)} days detected`, `${num(x.days)} hari terdeteksi`)}
                    {' · '}{tr(`first ${x.first ?? '–'}`, `pertama ${x.first ?? '–'}`)}
                    {' · '}{tr(`last ${x.last ?? '–'}`, `terakhir ${x.last ?? '–'}`)}
                    {' · '}{tr(`came back ${num(x.comeBacks)} time${x.comeBacks === 1 ? '' : 's'}`, `muncul lagi ${num(x.comeBacks)} kali`)}
                    {' · '}{tr(`at night ${x.nightShare != null ? `${num(x.nightShare * 100)}%` : '–'}`, `malam hari ${x.nightShare != null ? `${num(x.nightShare * 100)}%` : '–'}`)}
                  </p>
                </div>
                {onShow ? (
                  <button type="button" className="cmd-link" onClick={() => onShow(x.lon, x.lat)}
                    aria-label={tr(`Show peat site ${i + 1} on the map`, `Lihat lokasi gambut ${i + 1} di peta`)}>{tr('Show on map', 'Lihat di peta')}</button>
                ) : null}
              </li>
            ))}
          </ol>
          {/* the limits stay in view under the list, as on the classic page */}
            <p className="cmd-small cmd-limits">
              {tr('Limits: a clear look by MODIS can still miss a small or smouldering fire, and thick smoke is usually not flagged as cloud. This is a list of candidates for a ground check, not confirmed fire. It is exploratory (written after looking at the data), it does not say fire was present during a gap, and it is not a forecast. Coordinates are the centre of a 0.01 degree cell; a gap is two or more days in a row with no VIIRS detection; "detected at night" is the share of the cell\'s detections made at night. Source: NASA FIRMS VIIRS S-NPP 375 m, NASA MODIS FireMask (Terra and Aqua), Global Forest Watch Indonesia peat lands.',
                'Batasan: pandangan jelas oleh MODIS masih bisa melewatkan api kecil atau bara, dan asap tebal biasanya tidak ditandai sebagai awan. Ini daftar kandidat untuk dicek di lapangan, bukan kebakaran yang terkonfirmasi. Sifatnya eksploratif (ditulis setelah melihat data), tidak menyatakan ada api selama jeda, dan bukan prakiraan. Koordinat adalah titik tengah sel 0,01 derajat; jeda adalah dua hari berturut-turut atau lebih tanpa deteksi VIIRS; "terdeteksi malam hari" adalah bagian deteksi sel itu yang terjadi pada malam hari. Sumber: NASA FIRMS VIIRS S-NPP 375 m, NASA MODIS FireMask (Terra dan Aqua), lahan gambut Indonesia dari Global Forest Watch.')}
              {peat.generated ? ' ' + tr(`File built ${dateOnly(peat.generated, lang) ?? peat.generated}.`, `Berkas dibuat ${dateOnly(peat.generated, lang) ?? peat.generated}.`) : ''}
            </p>
        </section>
      ) : null}

      {/* ---- the district's other pages */}
      <nav className="cmd-ev cmd-links" aria-label={tr('More about this district', 'Lebih lanjut tentang kabupaten ini')}>
        <p className="cmd-label">{tr('More about this district', 'Lebih lanjut tentang kabupaten ini')}</p>
        <a href={`#/record?aoi=${encodeURIComponent(aoiId)}`}>{tr('Open the district\'s fire calendar', 'Buka kalender api kabupaten')}</a>
        <a href={`#/brief?aoi=${encodeURIComponent(aoiId)}`}>{tr('Print the one-page brief', 'Cetak ringkasan satu halaman')}</a>
        <a href="#/season?y=2026">{tr('Play the season', 'Putar musim')}</a>
      </nav>
    </div>
  );
}
