# Audit Visual UI/UX — aplikasi live (13 Nov 2026)

Metode: dibuka satu per satu di built-in browser (viewport desktop 1366×850 + cek mobile 375×812 untuk 2 situs), screenshot + baca teks halaman. Tidak login, tidak submit form. Cookie banner OWID ditolak (reject optional). Modal disclaimer FIRMS **tidak** di-klik "OK, I Understand" (dianggap persetujuan), jadi peta FIRMS hanya terbaca lewat teks/struktur.

Status jangkauan:

| # | Situs | Status |
|---|---|---|
| 1 | Kiln Watch (vercel + github.io) | OK, dua versi berbeda |
| 2 | Fire Harmony | OK |
| 3 | Burn Calendar | OK |
| 4 | Parallax Fire | OK |
| 5 | IGNIS | OK |
| 6 | Flare Chronos | OK (panel Briefing butuh bearer token) |
| 7 | FireLens | **Tidak ada demo hosted** (README hanya 127.0.0.1 + video mp4 di repo) |
| 8 | VELA | **Tidak ada demo hosted** (README hanya 127.0.0.1:8000) |
| 9a | karhutla.my.id | OK |
| 9b | Pantau Karhutla | **Tidak ada demo hosted** (README hanya localhost:5173) |
| 9c | Titik Api (titik-api.mrramdn.com) | OK |
| 10 | GWIS seasonal trend | OK (pemilih zona sulit diarahkan ke Asia/IDN; diaudit dengan Europe) |
| 11 | Global Nature Watch (ex-GFW) fires | OK (dashboard Indonesia) |
| 12 | NASA FIRMS map | Sebagian (terhalang modal disclaimer) |
| 13 | Climate Reanalyzer | OK |
| 14 | Our World in Data grapher | OK |

---

## 1. Kiln Watch — https://kiln-watch-seven.vercel.app (+ https://aalvee-aarham.github.io/kiln-watch/)

**Layout.** Landing = hero gelap full-screen "EVERY FIRE. ONE RECORD." + scroll-story (PROBLEM → CHALLENGE → SOLUTION → IMPACT → OLD CAMERA → NEW CAMERA → THE JUMP → THE FIX → THE PROOF), tombol biru terang "OPEN EXPLORER". Explorer: top-bar nav (Home, Explorer, Early warning•, News, Download, Create, Method, Claude MCP, n8n) + date picker "12/11/2026" dengan panah ‹ ›, tombol "DRAW AN AREA" dan "ANALYST". Peta ~62% kiri (basemap hitam + NASA Black Marble lampu kota), panel kanan ~38% yang bisa di-scroll. Di bawah layar: **strip timeline 2002–2026 penuh lebar** berisi histogram bulanan + **bar Gantt per satelit** (Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21, warna berbeda) + tombol play. Footer status: "Latest data: NOAA-20 2026-11-10 · NOAA-21 2026-11-09 · Suomi-NPP **ended 2026-11-02** · Aqua …".

**Kalender.** Tab "Calendar | Season | Continuity". Toggle "Vegetation fires / Kilns & static heat", "Month / Week", mode "Hotspots | vs. median | vs. recent years", dropdown "Hotspots, Aqua scale / VIIRS scale / Fire cell-days / Raw detections", rentang tahun "2000 to 2026". Grid tahun (baris) × bulan (kolom) **dengan angka di dalam sel** (51, 1.5k, 9.5k) + kolom "Year" total + **baris "Median" di bawah**. Ramp magma (ungu tua → oranye → kuning), skala log, legenda "0 … 2,907+" + status "in progress", "provisional (near-real-time data)", "no satellite observing". Titik kecil di kiri label tahun 2002 dan 2012 = tahun kedatangan satelit. Mode "vs. median" berubah jadi diverging biru–oranye dengan teks "×0.7", "×1.6". Readout hover: "June 2011 7 (95%: 1–13), 26th highest of 26, ×0.2 the median, 0th percentile vs. recent years". Di atas grid: 4 bullet ringkasan otomatis ("Burning peaks in August–October: 49% of a typical year's hotspots…", "November 2026 so far (10 days): lower than 24 of the previous 26 Novembers over the same days.").

**AOI.** Daftar preset dengan deskripsi 1 kalimat (mis. "Dhaka brick-kiln belt — Thousands of brick kilns fire every dry season…"), "Your areas" (riwayat AOI yang dibangun), draw box di peta, atau input "West/South/East/North" desimal → "CHECK THIS AREA". AOI baru memunculkan konfirmasi "Analyse this area? … About 48,400 km². The first build takes a few minutes. BUILD RECORD / REDRAW / CANCEL".

**Ketidakpastian/metodologi.** Tab "Continuity" sangat kuat: grafik "Raw counts rise with every satellite; the harmonized record does not" (raw putus-putus vs Aqua-only vs harmonized, garis vertikal per satelit), panel "Suomi-NPP ended on 2026-11-02" dengan pita 95%, "Rehearsal: the record without Suomi-NPP", tabel "Level change at each satellite arrival" (Raw ×6.70 vs Harmonized ×1.92 vs "Left over ×0.99"), tabel Mann-Kendall, grafik "Orbit drift signature". Setiap grafik punya link "Download chart (SVG)". Disclaimer footer: "Detections are not fires and not burned area. The early warning is a climatological outlook, not a forecast."

**Download.** Per-grafik SVG; halaman Download terpisah (tidak sempat dibuka via hash).

**Tipografi & warna.** Hitam pekat (#000-ish), sans-serif tebal uppercase untuk nav & tombol, aksen biru elektrik untuk CTA, ramp magma untuk data, badge pill "Quiet". Versi github.io: headline sans condensed besar "NASA satellites have watched Bangladesh burn for 23 years. We made their records agree.", banner atas "Today is Day **136** of the 2026-27 burning season. **34** districts have had unusual fire activity.", kalender harian hero dengan toggle "Raw / Harmonized" + "Replay", sumbu musim lokal Bengali (Basanta, Grishma, Barsha…, "Aman harvest", "Boro harvest"), garis horizontal penanda 2012 "when VIIRS arrived", sel abu-biru = "not observed (cloud)". Nav 18 item (How, Area, Warnings, News, Ask, Farmers, World, Space, Sensors…).

**Mobile.** Peta di atas, bottom sheet panel area, timeline sensor tetap di bawah. Nav jadi scroll horizontal. Peta sempat kosong hitam saat load.

**Pola kuat untuk dipinjam**
1. Kalender dengan **angka di sel + kolom total tahun + baris Median** — langsung terbaca tanpa hover, dan baris median = jawaban "vs normal".
2. **Strip Gantt satelit di bawah timeline** + titik penanda tahun kedatangan sensor di label baris.
3. Tab **Continuity** dengan tabel "level change at each satellite arrival" — bukti harmonisasi dalam satu tabel.
4. Banner status "Today is Day X of the burning season; N districts unusual" (versi github.io) dan sumbu musim lokal.

**Kelemahan**
- Landing hero scroll-story bertele-tele sebelum ke data; nav terlalu banyak (Claude MCP, n8n di nav publik).
- Panel kanan sangat panjang; kalender ada di bawah lipatan.
- Hitam total + biru neon = rasa "space startup".

**Kesan AI-generic?** Explorer-nya tidak (padat, spesifik, angka nyata). Landing hero "EVERY FIRE. ONE RECORD." + section PROBLEM/SOLUTION/IMPACT terasa template pitch-deck.

---

## 2. Fire Harmony — https://warren-530.github.io/fire-harmony/

**Layout.** Light theme hangat (putih krem, aksen oranye-bata). Top nav: logo, "Explorer | Dashboard | Rankings | Haze | Methods | Data", command palette "Go to… Ctrl K", chip "Data to Oct 2026", toggle dark. Panel kiri mengambang (~30%) di atas peta full-bleed; peta = **hexagon** berwarna (makin halus saat zoom: "Loading finer hexagons…"). Kanan atas: dropdown legenda "Hotspots a month" dan "Fire count". **Bawah: timeline scrubber** play ▶ / ◀◀ ▶▶ / 1x 2x 4x, label besar monospace "SEP 2015 · 79,000", sparkline bulanan 2001–2026 dengan brush.

**Kalender.** Tab "Overview | Calendar | Period | Why | Outlook". Judul berbentuk kalimat temuan: "The fire season is August to October, peaking in September". Grid kecil tahun × bulan (J F M A M J J A S O N D), ramp krem → oranye → merah tua → maroon, sel terpilih bergaris; hover = preview di peta, klik = tampilkan. Legenda log "20 · 100 · 1,000 · 10K · 60K", "No fire", "No data yet". Kartu detail: "September 2015 — 78,985 hotspots — **6.5 times normal** — Highest September in 26 years. Normal for September: 12,059." Ada tabel aksesibel penuh untuk screen reader.

**AOI.** Search "Find a place or city", tombol "World", alat gambar "Rectangle | Polygon | Circle", "START HERE" contoh kurasi ("Central Kalimantan, the 2015 haze", "Corrientes, Argentina, the Iberá fires of 2022", "Kuala Lumpur and the haze"). Header AOI: "STATE · 153,000 KM² — Central Kalimantan, Indonesia". Onboarding 3 langkah bernomor: "1 Pick or draw a place · 2 Read its burning calendar · 3 Download the CSV".

**KPI.** 3 tile monospace: "Sep 2015 79,000 ▲6.5×", "Jan to Sep 108,000 ▲6.5×", "Trend −76% ▼Falling", label skala "Hotspots on the NOAA-20 VIIRS scale".

**Why tab (El Niño!).** "Why was September 2015 unusual?" tabel 2 kolom: Fire 6.5× normal; Rain (this month and the 2 before) 70% below normal; Air temperature +0.6 °C; **El Niño index (ONI) +2 (strong El Niño)**; Fire weather index 4.6×. Lalu "What the weather points to" dalam bahasa awam + "On years the model never saw, these drivers explained 66% of the ups and downs of fire here."

**Download.** Dropdown "Download": "Monthly record (CSV) — Every month with its 90% range and each satellite", "Hotspots of a period (CSV)", "Chart (PNG) — Ready for a report", "Calendar (PNG)". Plus "Compare" dan tombol copy link. URL menyimpan state (`?area=state:IDN-1931&month=201509&tab=why`).

**Mobile.** Peta di atas, **bottom sheet** dengan KPI, scrubber, Download/Compare, tab. Rapi.

**Pola kuat**
1. Judul kalender = **kalimat temuan** ("The fire season is August to October, peaking in September").
2. Tab **"Why"**: tabel driver (hujan, ONI El Niño, FWI) masing-masing "vs normal" — persis kebutuhan "vs El Niño years".
3. Dropdown download dengan **deskripsi isi tiap file** ("with its 90% range and each satellite", "Ready for a report").
4. Timeline scrubber bawah + sparkline + angka monospace besar; hover sel kalender → preview peta.

**Kelemahan**
- Hexagon besar di zoom provinsi menutupi garis pantai/konteks gambut.
- Panel kiri cukup sempit; kalender kecil (sel ~10 px) di desktop.
- Tidak ada pita ketidakpastian di kalender (hanya di CSV).

**Kesan AI-generic?** Tidak. Warna hangat konsisten, copy spesifik, tidak ada gradient/emoji. Paling "produk jadi" di antara pesaing. **Pesaing paling langsung** (punya Central Kalimantan + El Niño).

---

## 3. Burn Calendar — https://tttamannaanand.github.io/burn-calendar/

**Layout.** Satu halaman scroll, dark navy, max-width ~1100 px. Header "Burn Calendar | How it works | GitHub | ☀". Hero teks (bukan gambar): "Twenty-two years of fire, on one consistent scale". 3 **kartu region** sebagai tab (California aktif dengan border oranye, Amazon arc, Northern Australia). Grid 2 kolom: kiri = "Area of interest" (peta Leaflet kecil dengan grid sel oranye, "Draw an area", "Whole region", preset chip "North Coast and Klamath / Sierra Nevada / Los Angeles basin") + kartu "How far can you trust this?"; kanan = "What this area looks like" (4 stat: Fire season "Jul 30 – Sep 16", Typical peak week, Busiest year, Area covered "~980,000 km² — A box around the region, 399 cells") + chip "Most extreme weeks (select one to find it on the calendar)" + kalender + "A typical year" + "The full record".

**Kalender.** Tahun × **minggu** (52 kolom), sel tipis tanpa gap, ramp hitam → oranye → krem ("No fire … 48,422 hot spots in the busiest week"). Toggle "Activity | Compared with normal" → diverging **biru (below normal) – oranye (above normal)**. **Garis pemisah horizontal antara 2011 dan 2012 dengan label "MODIS, harmonized" / "VIIRS, measured"** langsung di dalam grid. Tooltip: "Sep 3–9, 2018 · 3,873 hot spots (0.8× a typical week) · About normal (z = −0.1) · VIIRS, measured". Navigasi panah keyboard.

**Ketidakpastian.** Kartu "How far can you trust this?": "We scored the method on 2019–2024, years it was not fitted on" + 2 progress bar "Raw MODIS 23%" vs "Harmonized 88%" dengan garis 100%, "Typical weekly error 1,299 → 381 (3.4× lower)", callout cokelat "Reads about 12% low over the held-out years. California reads low mainly in the extreme 2020 and 2021 seasons…", link "How was this checked?".

**Download.** Tidak terlihat tombol download menonjol (URL shareable via hash).

**Pola kuat**
1. **Garis era sensor di dalam heatmap** dengan label "MODIS, harmonized / VIIRS, measured" — provenance terlihat tanpa legenda.
2. Kartu **"How far can you trust this?"** — 2 bar sebelum/sesudah + 1 kalimat kelemahan jujur.
3. Chip "Most extreme weeks" yang melompat ke sel kalender.
4. Tooltip 4 baris: nilai, rasio vs tipikal, kategori + z, sumber sensor.

**Kelemahan**
- Kartu-kartu rounded dengan border tipis = grid kartu generik.
- Hanya 3 region, AOI hanya box.
- Tanpa ekspor CSV yang jelas.

**Kesan AI-generic?** Sedang. Copy-nya bagus dan jujur, tapi struktur "hero heading + kartu rounded di navy" mirip template dashboard shadcn.

---

## 4. Parallax Fire — https://parallaxfire.netlify.app

**Layout.** Landing: globe 3D biru wireframe garis pantai cyan di langit hitam, teks vertikal kecil monospace di tepi ("OVERVIEW FOCUS 23.70°N 90.11°E", "SCROLL"), nav "Two satellites | Regions | Index | ☀ | Manual | Open app →". App: **sidebar kiri** ikon+label (Home, Story, Calendar, Map, Two satellites, Live, Results, Data & sources), konten kanan. Badge hijau di header: "● BANGLADESH: CHECKED ON UNSEEN YEARS ⓘ". Onboarding tour "STEP 1 OF 11".

**Kalender.** "Burning calendar — Fire detections by month. Click a month for its summary." Filter "PLACE [Bangladesh ▾]  YEARS [2001] to [2025]", tombol "▶ Replay" + slider. Grid besar tahun × bulan, sel berangka ("4k", "6.4k", "340"), ramp merah tua → merah → oranye → kuning (saturasi tinggi). **Glyph di dalam sel**: titik kecil = estimate, segitiga sudut = unusual high/low, stripe warna di tepi kiri baris = era satelit. Legenda panjang: "measured by the sharper satellite / estimate / part of the month only / no data / no trustworthy estimate / could not load / unusually high for the season / unusually low for the season / sharper satellite flies from 2012", skala "detections per month, sharper-satellite scale (squeezed scale)". Klik sel → kartu "March 2025 · Bangladesh — OBSERVED (VIIRS) … older satellite 1,022 · sharper satellite 3,799 · estimate about 4,244, **likely between 2,220 and 5,937 (8 in 10)**." + "WHAT NEXT?" tautan ke Map / Two satellites / Results.

**Pola kuat**
1. **Bahasa awam untuk sensor**: "older satellite" / "sharper satellite" alih-alih MODIS/VIIRS.
2. Interval disajikan sebagai **frekuensi natural "8 in 10"**.
3. Badge status validasi permanen di header ("CHECKED ON UNSEEN YEARS").
4. Status per-sel yang lengkap (estimate / partial month / no trustworthy estimate / could not load).

**Kelemahan**
- Ramp merah jenuh di semua sel → kalender "berteriak", sulit melihat anomali; legenda 10 item terlalu banyak.
- Tour 11 langkah = beban.
- Badge "Powered by Netlify" mengambang menutupi kalender.

**Kesan AI-generic?** Landing globe + teks HUD monospace di tepi = estetika "sci-fi HUD" yang sering muncul di generator AI. App-nya lebih fungsional.

---

## 5. IGNIS — https://ignis-spaceapps2026.vercel.app

**Layout.** Satu halaman dashboard "mission control" super padat: header logo + "One 26-year burning-activity record…", jam UTC, chip-chip ("FIRMS · GIBS · EONET · GDACS · ReliefWeb · HF"), "EXPERT", "Tour", tombol oranye "✦ AI Analyst". Banner merah "EARLY ALERT · RED  Significant fire activity — 5,978 detections, 75,741 MW FRP, 20 conflagration-grade (≥250 MW)", banner biru "Today in brief", **ticker berjalan** berita kebakaran. 6 tile KPI dengan glow cyan (LIVE DETECTIONS 5,978; TOTAL FRP 75.7k MW; CLIMATOLOGICAL PEAK Sep; THIS MONTH VS HISTORICAL MEDIAN 29,485 "×0.1 median", "z −1.69"; FORECAST PEAK Sep 2027; BURN REGIME Amazon Basin 92% match). Chip region (Amazon Basin, California, Boreal Canada, … "Bangladesh", "Pick AOI", search). Lalu 13 tab berikon emoji ("🔥 Burning Calendar", "🌍 Impact · Air & Carbon", "🔔 My Fire Alerts", "📈 Seasonal Outlook", "🧪 Methodology & Data", …). Footer status rail API (FIRMS API "MAP_KEY active · 0/5000 txns", api.nasa.gov, GIBS, EONET, Hugging Face, Open-Meteo, Earthdata Login).

**Kalender.** "BURNING ACTIVITY CALENDAR — AMAZON BASIN", chip "continuity ×11.0 over 173 overlap months", toggle "Harmonized | Per Sensor | Frp", palet "Inferno | Colorblind-safe | Mono". Grid tahun × bulan lebar penuh, ramp inferno, **sel anomali diberi outline/ring** ("ring = unusual month (|z| ≥ 2 vs 2000–2023 climatology)"). Catatan: "ratio variability CV 1.031 → ±103% uncertainty on scaled months".

**Download.** Di blok "DATE-RANGE SEARCH": "Download detections (CSV) | Daily counts (CSV) | GeoJSON (GIS)".

**Pola kuat**
1. Toggle **palet colorblind-safe/mono** di kalender.
2. **Ring outline** untuk sel anomali (tidak mengubah warna isi).
3. KPI "THIS MONTH VS HISTORICAL MEDIAN" dengan rasio + z — mirip kebutuhan "this month vs median".

**Kelemahan / anti-pola**
- Overload: banner merah + ticker + 6 tile glow + 13 tab emoji di satu layar.
- Status rail API/kuota (MAP_KEY, txns) = info developer di UI publik.
- "AI Analyst" sebagai tombol utama; glow cyan + oranye neon.

**Kesan AI-generic?** **Ya, paling kuat** di antara semua: emoji di judul tab, neon glow border, ticker, "AI Analyst ✦", label ALL-CAPS di mana-mana.

---

## 6. Flare Chronos — https://flare-chronos.resonance.io.vn

**Layout.** Landing: globe fotorealistik (Blue Marble) di kanan dengan orbit satelit putus-putus, kiri: kicker monospace "NASA FIRMS ACTIVE FIRE · 2001–2026", headline yang adalah **temuan**: "Raw fire counts rose up to 14×. The fires did not." Kartu region dengan **bar segmen 26 kotak** ("25 of 26 · measured epochs", legenda "■ Measured epoch □ Interpolated year"). Label kecil "Satellite orbits ILLUSTRATION, NOT A MEASUREMENT". Toggle bahasa EN/VI.

Workbench: top-bar (region select "Mekong & Vietnam", "PERIOD 2001–2026", "Walkthrough", "Evidence", "Briefing", "Globe", "Review", "Not connected", EN/VI). **Baris RESULT monospace** di bawah header: "RESULT Raw detections 2005→2024: +1,311% · harmonized trend −2.9%/yr · KS distance 0.1153 → 0.0353 · 25 of 26 years measured". Peta proyeksi equal-area (Lambert) gelap dengan relief, chip tahun 2012…2025, toggle "Footprints | H3 hexes". Baris KPI berbentuk **alur**: "RAW DETECTIONS 55,235 → filters → FIRE EPISODES 24,902 after physics filters + de-dup → vs norm → SFAI −0.3σ (below +2.2σ)". Grafik "Annual detections" (Both/Raw/Harmonized): raw = step merah naik tajam, harmonized = teal datar, **anotasi garis vertikal "El Niño 2010", "El Niño 2016"**, di bawahnya Gantt satelit. "Phenology clock" (radial pentad) dengan pita IQR 2001–2025 + overlay "El Niño 2016" putus-putus + "Selected 2024". Kalender pentad (5-hari, 73 kolom), ramp cokelat–ochre, "1825 of 1898 cells are observed windows (96.2%). The rest are modelled… **dimmed, hatched, and never scored**." Strip "SELECTED 2007 · P15 · Mar 12–Mar 16 · Observed · 4.61 events/100 km²/day · [≥ +2.5σ crisis]". Panel kanan "Briefing & Sign-off" minta "Bearer token" (kosong bagi publik).

**Pola kuat**
1. **Headline = temuan berangka** ("Raw fire counts rose up to 14×. The fires did not.").
2. **Anotasi El Niño langsung di grafik tahunan dan radial** — template untuk "vs past El Niño years".
3. Sel **modelled = dimmed + hatched**, dengan kalimat persentase sel observed.
4. KPI sebagai **pipeline panah** (raw → filtered → anomaly) — menjelaskan metode lewat layout.

**Kelemahan**
- Panel kanan 1/3 layar kosong menunggu token.
- Istilah teknis (SFAI, HFD, KS distance, P15) tanpa terjemahan awam.
- Scroll di atas peta membajak scroll halaman (zoom peta).

**Kesan AI-generic?** Tidak. Terasa "instrument/terminal" yang disengaja: monospace, warna earthy, proyeksi equal-area. Risiko: terlalu teknis.

---

## 7. FireLens — tidak ada demo hosted
README: hanya `http://127.0.0.1:4173` + `docs/firelens_demo.mp4`. Dari README: 5 view ("Why harmonize", "Calendar" baris tahun × kotak hari, "Typical season" median + band P10–P90, "Season timing" bar start/peak/end, "Unusual weeks" ranking), masing-masing dengan explainer **"What am I looking at?"**. Pola yang layak: tombol explainer per panel dengan judul pertanyaan.

## 8. VELA — tidak ada demo hosted
README: hanya `http://127.0.0.1:8000`. Ide UI dari README: kalender minggu dengan status **complete / partial / unavailable**, empty state yang menjelaskan alasan data kosong, "Why this day?", tiap nilai cuaca menyebut sumber & waktu, contoh tersimpan agar bisa dicoba tanpa API key.

---

## 9a. Karhutla Watch — https://karhutla.my.id

**Layout.** Peta Leaflet/OSM penuh (basemap terang standar), top-bar gelap: "Karhutla Watch | Filter" … "Peringkat | Deteksi | Cuaca | Sumber | Berita | About". Chip kiri atas: "**1.121** deteksi | Titik | Heatmap | Dunia". Panel kiri "Peringkat wilayah" (tabel 38 provinsi: Deteksi, Tinggi, "FRP maks. MW"), panel kanan "Berita terbaru" (search + daftar artikel dengan domain + "13 Nov 2026, 22.55 WIB"). Toolbar vertikal kanan: mode gelap, peta, awan, mata (visibility). Heatmap merah-kuning blob.

**Pola kuat**
1. **Lokalisasi format angka Indonesia** (1.121; 138,2) dan **WIB** di setiap timestamp.
2. Baris sumber di bawah tabel: "NASA FIRMS · 24 jam · Indonesia · 13 Nov 2026, 23.17 WIB".
3. Definisi istilah inline di atas tabel ("FRP: daya panas terdeteksi, dalam megawatt (MW)").

**Kelemahan**
- Saat load awal peta kosong biru muda (tile belum muncul).
- Heatmap blob tanpa legenda kuantitatif.
- Dua panel samping + peta = peta tertekan ke tengah; tidak ada konteks historis.

**Kesan AI-generic?** Tidak; terasa utilitarian/"admin panel". Tidak indah, tapi jujur.

## 9b. Pantau Karhutla — tidak ada demo hosted
README (localhost saja). Ide yang layak dicatat: ikon **(i) di samping setiap angka** yang menjelaskan perhitungan/data/uji/batasan dalam Bahasa Indonesia & Inggris; label "partikel api = ilustrasi"; bottom sheet di mobile.

## 9c. Titik Api — https://titik-api.mrramdn.com

**Layout.** Light theme (off-white #f5f4f0-ish), top-bar hitam: logo pin oranye "Titik Api", **strip kesegaran data**: "● Data satelit 20.33 WIB (Terra) · Diperiksa 23.14, tiap 30 menit · Lintasan berikutnya ±23.44–02.24 WIB, masuk dalam ±4 jam", "Peta | Tentang | Lihat sebagai [Publik ▾] | ID EN". Landing: H1 hitam tebal "Peringatan titik panas tingkat desa", subjudul 1 paragraf, baris kecil "Demo dengan data satelit asli · diperbarui tiap 30 menit · bukan sistem peringatan resmi", tombol oranye "Buka peta" + "Putar ulang hari tersibuk · 23 Okt 2026" + "Coba sebagai BPBD" + "Coba sebagai relawan MPA".

Peta: sidebar kiri gelap (~27%) — kotak penjelasan, "Lihat sebagai: Relawan MPA / Kepala desa / BPBD/Daops", search "Cari desa, kecamatan, atau kabupaten", filter chip "● Tinggi ● Sedang ● Rendah", **"Hanya lahan gambut"**, "Terkini | Arsip", "24 jam | 3 hari | 7 hari", 3 angka besar (51 Kejadian · **2** Tinggi, belum dicek (merah) · 70 Titik panas), callout "Sedikit titik panas dalam 24 jam terakhir. Lihat hari tersibuk di arsip, 23 Okt 2026", daftar kejadian dengan bar prioritas merah di kiri + skor (73) + lokasi relatif "12,4 km utara Sungai Perlu, lahan gambut, 6 titik panas · Belum dicek · 10 jam lalu". Basemap abu-abu muda (CARTO Positron-like), lingkaran kabupaten abu-abu dengan badge merah angka. Footer: "Demo portofolio dengan data satelit asli, bukan sistem peringatan resmi. Darurat 112."

**Pola kuat**
1. **Strip kesegaran data + lintasan satelit berikutnya** di header.
2. **Empty state yang mengarahkan** ("Sedikit titik panas… Lihat hari tersibuk di arsip").
3. **Lokasi relatif dalam bahasa manusia** + label "lahan gambut" per item; toggle "Hanya lahan gambut".
4. Disclaimer jujur yang singkat + nomor darurat.

**Kelemahan**
- Fokus operasional harian, tidak ada sejarah/kalender multi-tahun.
- Lingkaran abu-abu di peta kurang informatif sebelum zoom.

**Kesan AI-generic?** Tidak. Copy Indonesia natural, palet terbatas (hitam/off-white/oranye/merah), hierarki tegas. **Referensi gaya terbaik untuk audiens Indonesia.**

---

## 10. GWIS Seasonal Trend — https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/seasonaltrend

**Layout.** Portal institusional: header logo Copernicus/NASA/GEO, nav (About, Publications, Apps…), rail ikon kiri, sidebar pilih "year" & "zone" + daftar negara dengan bendera, konten grid 2×N grafik ("GWIS Weekly Burnt Areas", "GWIS Weekly Cumulative Burnt Areas", "Weekly Emissions – [CO2]", "Weekly Cumulative Emissions"). Toggle grid/list, "Copy URL".

**Grafik.** **Pita abu-abu "Min-max (2012-2025)"**, garis biru "Average (2012-2025)", garis merah "Year 2026". Versi kumulatif sama. Ikon (i) per grafik, ikon download per kartu.

**Pola kuat**
1. **Pita min–max + garis rata-rata + tahun berjalan** — idiom standar "tahun ini vs klimatologi".
2. Pasangan **mingguan + kumulatif** berdampingan (kumulatif menjawab "sudah seberapa parah musim ini").
3. "Copy URL" untuk state.

**Kelemahan**
- UI Material lama, label sumbu x diputar 45°, skala angka "3,000,000" tanpa satuan ringkas.
- Pemilih zona combobox susah (mengetik "Asia" memilih Africa).
- "No data" kosong untuk Africa 2026 tanpa penjelasan.

**Kesan AI-generic?** Tidak — justru "birokrat-institusional". Kredibel, tidak menarik.

## 11. Global Nature Watch (eks Global Forest Watch) — dashboard fires Indonesia

URL: https://www.globalnaturewatch.org/dashboards/country/IDN/?category=fires

**Layout.** Banner rebrand hijau muda, header putih + logo hijau. Kiri (~65%) kolom widget scroll; kanan (~35%) peta sticky (Mapbox, titik VIIRS oranye) dengan legenda "Fire Alerts (VIIRS) *a maximum of 3 months of fires data can be shown on the map". Hero gelap "Indonesia ▾ Select a region", tab kategori "SUMMARY | LAND COVER | FOREST CHANGE | FIRES | CLIMATE", tombol "SHARE DASHBOARD" "DOWNLOAD".

**Widget "WEEKLY FIRE ALERTS IN INDONESIA".** **Kalimat dinamis** di atas grafik dengan nilai ditebalkan/berwarna: "In **Indonesia** the peak fire season typically begins in **early August** and lasts around **14** weeks. There were **21,215** VIIRS fire alerts reported between **10th of November 2025** and **9th of November 2026** considering **high confidence alerts** only. This is **high** compared to previous years going back to **2012**." Grafik: garis oranye tahun berjalan, **pita abu "Normal Range"** dan "Above/Below Normal Range", tombol "+ ADD YEAR TO COMPARE", brush/mini-map rentang tanggal di bawah. Tooltip "Fire alerts in the week of: Sep 14 2026 · 2,763 VIIRS alerts". Toolbar widget: settings, download, info (i), share.

**Pola kuat**
1. **Kalimat ringkasan yang di-generate dengan nilai ditebalkan** — sekaligus menjadi teks untuk brief.
2. "**+ Add year to compare**" (cocok untuk overlay tahun El Niño 1997/2015/2019/2023).
3. Toolbar per widget yang konsisten (settings/download/info/share).
4. Peta sticky di samping kolom widget.

**Kelemahan**
- Banner rebrand + feedback tab + header = chrome berlebih; title halaman masih "Deforestation Rates".
- Peta default menampilkan Afrika/Eropa saat dashboard Indonesia (peta tidak sinkron dengan AOI di viewport awal).

**Kesan AI-generic?** Tidak; gaya NGO data-journalism.

## 12. NASA FIRMS — https://firms.modaps.eosdis.nasa.gov/map/

**Akses.** Modal merah "ACTIVE FIRES / THERMAL ANOMALIES" harus dikonfirmasi ("OK, I Understand") — **tidak saya klik**. Isi modal: "Do not use for the preservation of life or property… limited accuracy", "Active fire/thermal anomalies may be from fire, hot smoke, agriculture or other sources.", "Cloud cover may obscure active fire detections.", link "What does a fire detection mean on the ground?". Notifikasi di belakang: Suomi NPP berhenti 2 Nov 2026.

**Struktur (dari teks).** Basemap gelap, panel kanan "BASIC MODE": TODAY / 24HRS / 7DAYS, "From [Yesterday 00:00:00 UTC] to present", layer "Landsat [30m] / VIIRS (NOAA-20 & NOAA-21) [375m] / MODIS (Aqua & Terra) [1km]" — **resolusi ditulis di nama layer**; Dynamic Imagery dengan catatan "DATA ONLY AVAILABLE – 2015-11-24 TO 2026-11-02" untuk S-NPP. Toolbar bawah: MEASURE, LOCATION, LAYERS, TIMELINE, CAPTURE, SHARE, HELP, VIEW MODE. **Timeline bawah berupa deret tanggal** (OCTOBER/NOVEMBER 2026) + pilihan durasi "1 day … 4 WEEKS".

**Pola kuat**
1. Disclaimer 3 poin ikon (akurasi, sumber panas non-api, awan) — cocok untuk panel "How sure are we".
2. Resolusi sensor di label layer ("[375m]", "[1km]").
3. Rentang ketersediaan data per sensor ditampilkan di layer.

**Kelemahan.** Modal blocking di awal, UI padat ALL-CAPS kecil, banyak chrome. Tidak ada konteks historis.

**Kesan AI-generic?** Tidak; legacy operasional.

## 13. Climate Reanalyzer — https://climatereanalyzer.org/clim/t2_daily/

**Layout.** Header logo + nav biru tua, judul "Daily Surface Air Temperature", select "Area Selection [World]", paragraf penjelasan miring ("latest data values update with a 6-day lag"). Satu grafik besar Highcharts.

**Grafik "spaghetti".** Semua tahun 1940-an–2024 garis **abu-abu tipis**, **2026 merah tua tebal**, **2025 oranye**, garis putus-putus hitam untuk klimatologi "1991-2020", "1981-2010", "1979-2000". Legenda kanan = daftar tahun yang bisa diklik untuk menyalakan/mematikan. "Export Chart": View in full screen, Print chart, Download PNG / JPEG / PDF / SVG / **JSON data**. Subjudul sumber: "Dataset: ECMWF Reanalysis v5 (ERA5) … Image Credit: ClimateReanalyzer.org…".

**Pola kuat**
1. **Spaghetti: semua tahun abu-abu, tahun ini merah, tahun lalu oranye, klimatologi putus-putus** — cara tercepat menjawab "tahun ini vs sejarah" dan bisa diganti "tahun El Niño" sebagai garis berwarna.
2. Legenda tahun yang bisa di-toggle.
3. Credit/sumber tercetak di dalam grafik (ikut terbawa saat diekspor).

**Kelemahan.** Desain web 2010-an, satu grafik per halaman, label kecil.

**Kesan AI-generic?** Tidak sama sekali; ini referensi ilmiah klasik.

## 14. Our World in Data — https://ourworldindata.org/grapher/annual-area-burnt-by-wildfires

**Layout.** Header navy, judul serif (Playfair-like) "Annual area burnt by wildfires **2012 to 2026**", subjudul "Area burnt by wildfires in hectares. **The 2026 data is incomplete and was last updated 11 November 2026.**" Tab "Table | Map | Column", "Settings". Small multiples kolom biru-abu per negara. Sidebar kanan "ADD/REMOVE COUNTRIES AND REGIONS" (search, sort, checkbox + nilai). Slider waktu ▶ 2012 — 2026. Footer grafik: "Data source: Global Wildfire Information System (2026) · OurWorldinData.org/wildfires | CC BY", tombol "Download | Share | Enter full-screen".

**Download dialog.** Tab "Visualization" (Image PNG "Suitable for most uses", Vector SVG "For high quality prints…", checkbox "Include terminology definitions at bottom of chart") dan tab "Data": "Source and citation" + "Citation guidance", "Quick download": "**Download full data** — Includes all entities and time points (3,900 rows)" / "**Download displayed data** — Includes only the entities and time points currently visible in the chart (60 rows)", "Data API" URL CSV.

**Pola kuat**
1. Download dialog dua tab dengan **jumlah baris** dan pilihan "full vs displayed".
2. **Kelengkapan data di subjudul** ("2026 data is incomplete and was last updated…").
3. Tab Table/Map/Chart untuk data yang sama; sumber + lisensi di footer grafik.
4. Tipografi serif untuk judul + sans untuk UI = rasa editorial, bukan "app".

**Kelemahan.** Cookie banner kuning besar; untuk AOI kustom tidak berlaku (hanya entitas tetap).

**Kesan AI-generic?** Tidak; standar emas chart publik.

---

## Sintesis — pola yang dipinjam

| Pattern | Dari mana | Kenapa bagus | Cocok untuk layar Second Sight |
|---|---|---|---|
| Kalender tahun×bulan dengan **angka di sel**, kolom total tahun, **baris Median** di bawah | Kiln Watch | Terbaca tanpa hover; baris median = baseline visual | Kalender utama (heatmap 2001–2026) |
| Toggle mode kalender "Hotspots / vs median / vs El Niño years" → ramp diverging biru–oranye dengan teks "×1.6" | Kiln Watch, Burn Calendar | Satu grid menjawab 3 pertanyaan | Kalender utama |
| **Garis era sensor di dalam heatmap** (label "MODIS, harmonized / VIIRS, measured") + titik di label tahun kedatangan satelit | Burn Calendar, Kiln Watch | Provenance terlihat tanpa legenda | Kalender + Science lab |
| Sel **modelled/estimate = dimmed + hatched**, kalimat "X dari Y sel teramati" | Flare Chronos, Parallax, Kiln Watch ("no satellite observing") | Jujur soal data yang tidak diukur | Kalender + Validation |
| **Ring/outline untuk sel anomali** (bukan warna baru) | IGNIS | Anomali menonjol tanpa merusak ramp | Kalender |
| Tooltip 4 baris: nilai (interval), rasio vs normal, peringkat/z, sumber sensor | Burn Calendar, Kiln Watch ("95%: 1–13, 26th highest of 26") | Konteks lengkap per sel | Kalender |
| Judul panel = **kalimat temuan** + kalimat dinamis dengan nilai ditebalkan | Fire Harmony, GNW, Flare Chronos | Langsung menjawab "so what", bisa dipakai ulang di brief | Ringkasan AOI, brief download |
| Tabel **"Why"**: driver (hujan 3 bulan, ONI El Niño, FWI) masing-masing "vs normal" | Fire Harmony | Persis "vs past El Niño years" | Panel "Bulan ini vs median & El Niño" |
| **Anotasi El Niño** (garis vertikal / garis putus-putus) di grafik tahunan dan musiman | Flare Chronos | Konteks iklim di grafik yang sama | Science lab / grafik tahunan |
| **Spaghetti chart**: semua tahun abu-abu, tahun ini merah, tahun El Niño (1997/2015/2019/2023) berwarna, median putus-putus; legenda tahun toggle | Climate Reanalyzer + GNW "+ Add year to compare" + GWIS min-max band | Idiom paling dikenal untuk "tahun ini vs sejarah" | Panel "Bulan ini vs historis" |
| Pasangan grafik **mingguan + kumulatif** | GWIS | Kumulatif menjawab "seberapa parah musim ini sejauh ini" | Panel musim berjalan |
| Kartu **"How far can you trust this?"**: bar raw vs harmonized pada tahun held-out + 1 kalimat kelemahan | Burn Calendar | Validasi dalam 5 detik | Panel "Seberapa yakin kami" |
| Tabel **"Level change at each satellite arrival"** (raw ×6.7 vs harmonized ×1.92 vs left over ×0.99) | Kiln Watch | Bukti harmonisasi kuantitatif | Science lab |
| Interval sebagai **frekuensi natural "8 dari 10"**; sensor disebut "satelit lama / satelit tajam" | Parallax Fire | Ramah awam | Tooltip & brief |
| **Strip kesegaran data** di header ("Data satelit 20.33 WIB (Terra) · lintasan berikutnya…") + footer "Latest data: NOAA-20 …, Suomi-NPP ended 2026-11-02" | Titik Api, Kiln Watch | Kepercayaan + konteks berakhirnya S-NPP | Header global |
| Banner musim: "Hari ke-136 musim kebakaran 2026; 34 kabupaten tidak biasa" | Kiln Watch (github.io) | Status nasional 1 kalimat | Landing/header (ganti hero) |
| AOI: search + preset kurasi bercerita ("Central Kalimantan, the 2015 haze") + Rectangle/Polygon/Circle + input bbox desimal + "Your areas" | Fire Harmony, Kiln Watch | Semua cara masuk AOI dalam satu panel | Panel AOI |
| Konfirmasi AOI baru dengan luas km² dan estimasi waktu ("About 48,400 km². The first build takes a few minutes.") | Kiln Watch | Ekspektasi jelas | Draw polygon |
| Toggle **"Hanya lahan gambut"** + lokasi relatif ("12,4 km utara Sungai Perlu, lahan gambut") | Titik Api | Konteks gambut eksplisit | Filter peta / KHG preset |
| **Timeline scrubber** bawah: play, 1x/2x/4x, sparkline + **Gantt satelit** | Fire Harmony, Kiln Watch | Navigasi waktu + era sensor sekaligus | Layar peta |
| Hover sel kalender → preview peta; klik → set bulan | Fire Harmony | Kalender & peta terhubung | Peta + kalender |
| Dropdown download dengan **deskripsi isi file** + dialog "full vs displayed (N rows)" + citation guidance | Fire Harmony, OWID | User tahu apa yang diunduh | Download CSV & brief |
| Sumber + lisensi + tanggal update **di dalam grafik** (ikut terekspor) | Climate Reanalyzer, OWID | Grafik ekspor tetap bisa dikutip | Semua grafik |
| Subjudul kelengkapan data ("data 2026 belum lengkap, diperbarui 11 Nov 2026") | OWID | Mencegah salah tafsir tahun berjalan | Kalender & grafik tahunan |
| Format angka Indonesia (1.121; 138,2), WIB, definisi istilah inline | karhutla.my.id, Titik Api | Natural untuk audiens lokal | Seluruh UI (mode ID) |
| Disclaimer 3 poin berikon (akurasi, sumber panas non-api, awan) | NASA FIRMS | Ringkas, otoritatif | Panel "Seberapa yakin" |
| Toggle palet colorblind-safe / mono | IGNIS | Aksesibilitas + cetak | Kalender |
| URL menyimpan state (area, bulan, tab) | Fire Harmony, Burn Calendar, GWIS "Copy URL" | Shareable, demo-friendly | Global |
| Mobile: peta atas + bottom sheet (KPI, scrubber, tab) | Fire Harmony, Kiln Watch, Pantau Karhutla | Pola terbukti | Mobile |

### Gaya visual yang direkomendasikan dari audit
- Ikuti arah **Fire Harmony (light, krem/oranye-bata) atau Titik Api (off-white + hitam + satu aksen oranye)**, plus monospace untuk angka (Fire Harmony "79,000", Flare Chronos). Judul editorial serif ala OWID opsional.
- Ramp kalender: sequential magma/inferno untuk hitungan (log), diverging biru–oranye untuk "vs median"; jangan ramp merah jenuh penuh (Parallax).
- Basemap netral abu-abu muda (Titik Api/Positron) atau gelap dengan relief (Flare Chronos), bukan hitam pekat + neon.

---

## Anti-pola "AI slop" yang terlihat

1. **Emoji di judul tab/section** — IGNIS ("🔥 Burning Calendar", "🌍 Impact", "🧪 Methodology & Data").
2. **Neon glow border cyan pada tile KPI**, label ALL-CAPS di semua tempat, ticker berita berjalan — IGNIS.
3. **Tombol "✦ AI Analyst" sebagai CTA utama** — IGNIS; Kiln Watch menaruh "Claude MCP", "n8n" di nav publik.
4. **Hero slogan generik + scroll-story PROBLEM / CHALLENGE / SOLUTION / IMPACT** — landing Kiln Watch ("EVERY FIRE. ONE RECORD."). Bandingkan Flare Chronos yang headline-nya temuan berangka.
5. **Globe 3D / satelit orbit / teks HUD vertikal monospace di tepi** sebagai pembuka — Parallax Fire, Flare Chronos (Flare Chronos setidaknya memberi label "ILLUSTRATION, NOT A MEASUREMENT").
6. **Status rail API & kuota developer** (MAP_KEY, "0/5000 txns", Hugging Face) di UI publik — IGNIS.
7. **Banner peringatan merah + banner biru + ticker + 6 KPI** sekaligus di atas lipatan — IGNIS (alert fatigue).
8. **Grid kartu rounded seragam dengan border tipis di navy** — Burn Calendar (moderat).
9. **Onboarding tour panjang** (Parallax 11 langkah, IGNIS 6 langkah) yang menutupi data di load pertama.
10. **Legenda status 10 item** dan ramp merah jenuh di semua sel — Parallax Fire.
11. **Panel kosong yang menunggu token/login** mengambil 1/3 layar — Flare Chronos "Briefing & Sign-off".
12. **Jargon tanpa terjemahan awam** (SFAI, HFD, KS distance, P15) di KPI utama — Flare Chronos.
13. **Navigasi berlebih** (18 item di Kiln Watch github.io; 13 tab di IGNIS).
