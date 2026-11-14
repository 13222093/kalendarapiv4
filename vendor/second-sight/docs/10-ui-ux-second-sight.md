# 10 · UI/UX Second Sight: Dirakit dari Pola Terbukti, Bukan dari Nol

> Dokumen ini menggantikan spesifikasi layar di [08 §7.5](08-blueprint-ide-dan-opsi-konsep.md#75-spesifikasi-layar-produk) untuk aspek tampilan dan interaksi. Isi fungsional (data, sains, validasi) tetap mengikuti [08](08-blueprint-ide-dan-opsi-konsep.md) dan [09](09-second-sight-v2-upgrade-pipeline-dan-posisi.md).
> **Sumber:**
> - [_raw/ui-ux-audit-visual.md](_raw/ui-ux-audit-visual.md): audit visual 11 aplikasi live di browser.
> - [_raw/ui-ux-kode-dan-referensi.md](_raw/ui-ux-kode-dan-referensi.md): bedah kode repo berlisensi permisif, pustaka, sistem desain, dan anti AI-slop.
>
> **Prinsip utama:** setiap pola UI di bawah punya **asal-usul** (dari aplikasi mana) dan **status pakai** (kode diadaptasi dengan atribusi / pola diimplementasi ulang / referensi saja).

---

## 0. Tiga sumber yang digabung

| Sumber | Contoh | Yang diambil | Yang **tidak** diambil |
|---|---|---|---|
| **Aplikasi pesaing yang sudah teruji** | Kiln Watch, Fire Harmony, Burn Calendar, flare-chronos, Parallax Fire, IGNIS | Pola interaksi kalender, era sensor di dalam grid, sel jujur (hatch), kartu kepercayaan, pemilih AOI, unduhan | Tema visual mereka (dark + glow, emoji, globe 3D, landing PROBLEM/SOLUTION) |
| **Platform operasional & editorial** | Climate Reanalyzer, GWIS, Global Nature Watch, Our World in Data, NASA FIRMS | Idiom "tahun ini vs sejarah" (spaghetti + band), kumulatif musim, dialog unduh, sumber di dalam grafik, disclaimer ringkas | Kode (OWID sekarang view-only; GWIS/Climate Reanalyzer tertutup) |
| **Vernakular operasional Indonesia** | Titik Api, karhutla.my.id, SiPongi, BMKG | Strip kesegaran data WIB, format angka Indonesia, toggle "Hanya lahan gambut", lokasi relatif ("12,4 km utara …"), istilah resmi (KHG, Manggala Agni, titik panas) | Tampilan dashboard real-time (bukan fokus kita) |

**Kenapa cara ini tidak terasa "AI slop":** tampilan yang terasa generik berasal dari default (font, warna, kartu identik, hero). Dengan meminjam pola yang dirancang orang untuk masalah nyata yang sama dan memakai bahasa visual operasional Indonesia, setiap elemen punya alasan selain "ini terlihat modern".

---

## 1. Peta asal-usul pola (per layar)

Kolom **Status**:
- **A** = kode diadaptasi dengan atribusi (MIT/Apache).
- **R** = pola diimplementasi ulang (sumber tanpa lisensi atau tertutup), disebut sebagai inspirasi.
- **I** = referensi idiom umum.

| Layar | Pola | Asal | Status | Lisensi sumber |
|---|---|---|---|---|
| **Global** | Strip kesegaran data di header: "Data satelit hingga 13 Nov 2026 20.33 WIB · NOAA-20 · Suomi-NPP berhenti 2 Nov 2026" | Titik Api + footer Kiln Watch | R | Belum dicek / tanpa lisensi |
| Global | Banner status musim satu kalimat (pengganti hero): "Musim kebakaran 2026: 34 kabupaten di atas persentil 90" | Kiln Watch (github.io) | R | Tanpa lisensi |
| Global | State di URL (AOI, bulan, mode, tab, bahasa) | project-shift `lib/url.js`; Fire Harmony; Burn Calendar | **A** | Apache-2.0 |
| Global | Shortcut keyboard | tinykeys + pola ARIA Fire Harmony | A (pustaka) | MIT / Apache-2.0 |
| **Peta & AOI** | Satu panel AOI dengan 5 mode: preset bercerita, cari, gambar (kotak/poligon), bbox desimal, titik + radius | project-shift `AreaPicker` + `lib/area.js`; preset bercerita Fire Harmony ("Central Kalimantan, the 2015 haze") | **A** + R | Apache-2.0 |
| Peta & AOI | Konfirmasi AOI baru: luas km² + estimasi waktu proses | Kiln Watch | R | Tanpa lisensi |
| Peta & AOI | Toggle "Hanya lahan gambut" + lokasi relatif | Titik Api | R | Belum dicek |
| Peta & AOI | Timeline scrubber + Gantt satelit (bar per satelit, akhir S-NPP terlihat) | Fire Harmony scrubber; Kiln Watch Gantt; `timeline.js` firms-catalog | **A** (timeline.js) + R | Apache-2.0 |
| Peta & AOI | Hover sel kalender → pratinjau peta bulan itu; klik → set bulan | Fire Harmony | R (pola) | Apache-2.0 (pola, bukan kode JSX) |
| Peta & AOI | Basemap vektor tanpa tile server (MapLibre + PMTiles + Protomaps) | firms-catalog | **A** | Apache-2.0 (+ © OpenStreetMap) |
| **Kalender** | Grid tahun × bulan dengan **angka di sel**, kolom total tahunan, **baris Median** di bawah | Kiln Watch | R | Tanpa lisensi |
| Kalender | Toggle mode: *Jumlah* / *vs median* / *vs tahun El Niño*, dengan ramp divergen biru-oranye dan label "×1,6" | Kiln Watch, Burn Calendar | R + A (ramp) | MIT (Burn Calendar) |
| Kalender | **Garis era sensor di dalam grid** + label pill ("MODIS, diharmonisasi / VIIRS, terukur") + titik di label tahun saat satelit masuk | Burn Calendar `drawCal`; Kiln Watch | **A** (pola + helper) | MIT |
| Kalender | **Sel tidak teramati = arsir + redup**; kalimat "X dari Y sel-bulan teramati" | flare-chronos, Parallax Fire, Kiln Watch | R | MIT (flare-chronos, pola) |
| Kalender | **Ring/outline** untuk anomali (bukan warna baru) | IGNIS | R | Tanpa lisensi |
| Kalender | Skala warna log adaptif per AOI + 9 kelas rasio vs normal | Fire Harmony `lib/stats.ts` | **A** | Apache-2.0 |
| Kalender | Ramp OKLCH sekuensial/divergen yang sadar tema | flare-chronos `lib/calendar/ramp.ts` | **A** (opsional) | MIT |
| Kalender | Navigasi keyboard + `role=grid` + deskripsi sel untuk pembaca layar | Fire Harmony `Calendar.tsx` | **A** (pola) | Apache-2.0 |
| Kalender | Tooltip 4 baris: nilai (interval), rasio vs median, peringkat, sensor sumber | Kiln Watch ("7 (95%: 1–13), 26th highest of 26"), Burn Calendar | R | — |
| Kalender | Toggle palet aman buta warna / monokrom | IGNIS | R | — |
| **Bulan ini vs sejarah** | **Spaghetti chart**: semua tahun abu-abu tipis, median tebal putus-putus, band p10-p90, tahun El Niño satu warna berlabel langsung, tahun berjalan aksen; tahun bisa di-toggle | Climate Reanalyzer + GWIS band + Global Nature Watch "+ Add year to compare" | I | Tertutup (idiom saja) |
| Bulan ini | Pasangan grafik **bulanan + kumulatif musim** | GWIS seasonal trend | I | Tertutup |
| Bulan ini | Kalimat vonis dinamis dengan angka ditebalkan | Global Nature Watch, Fire Harmony | R | — |
| Bulan ini | Tabel **"Kenapa?"**: hujan 3 bulan, ONI, DMI, Drought Code, masing-masing "vs normal" | Fire Harmony tab "Why" | R | Apache-2.0 (pola) |
| **Lab Sains** | Tabel "perubahan level saat setiap satelit masuk" (raw ×6,7 → harmonisasi ×1,9 → sisa ×0,99) | Kiln Watch | R | Tanpa lisensi |
| Lab Sains | Anotasi El Niño langsung di grafik tahunan/musiman | flare-chronos | R | MIT (pola) |
| **Seberapa Yakin** | Kartu **"Seberapa yakin kami?"**: bar raw vs harmonisasi pada tahun yang ditahan + satu kalimat kelemahan | Burn Calendar | **A** (pola) | MIT |
| Seberapa Yakin | Interval sebagai frekuensi alami ("kemungkinan antara 120 dan 180, 8 dari 10") | Parallax Fire | R | — |
| Seberapa Yakin | Disclaimer 3 poin berikon (akurasi, sumber panas non-api, awan) | NASA FIRMS | I | — |
| **Unduh & Brief** | Menu unduh dengan **deskripsi isi tiap file** | Fire Harmony | R | Apache-2.0 (pola) |
| Unduh & Brief | Dialog "data lengkap (N baris)" vs "data yang ditampilkan (M baris)" + panduan sitasi | Our World in Data | I | **Kode OWID 2026 view-only, jangan salin** |
| Unduh & Brief | CSV harian/bulanan/sel + tautan balik ke FIRMS + ekspor SVG/PNG dengan legenda | project-shift `lib/downloads.js`; Fire Harmony `download.ts`, `exportImages.ts` | **A** | Apache-2.0 |
| Semua grafik | **Sumber + lisensi + tanggal pembaruan di dalam grafik** (ikut terekspor) | OWID, Climate Reanalyzer | I | — |
| Semua grafik | Subjudul kelengkapan data ("data 2026 belum lengkap, diperbarui 13 Nov 2026") | OWID | I | — |
| **Bahasa** | Format angka Indonesia (1.121; 138,2), WIB, definisi istilah inline | karhutla.my.id, Titik Api | R | — |
| **Mobile** | Peta di atas + bottom sheet (ringkasan, scrubber, tab) | Fire Harmony, Kiln Watch | R | — |

---

## 2. Layout global

### 2.1 Desktop (≥1200 px)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Second Sight   Peta · Kalender · Bulan ini · Lab · Seberapa yakin · Unduh · Metode   ID|EN│
│ Data satelit hingga 13 Nov 2026 20.33 WIB · NOAA-20 · Suomi-NPP berhenti 2 Nov 2026   │ ← strip kesegaran
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Musim 2026: 34 kabupaten di atas persentil 90. Kalimantan Tengah tertinggi sejak 2015. │ ← banner status (1 kalimat)
├──────────────────────────┬────────────────────────────────────────────────────────────┤
│ WILAYAH                  │  KHG Sebangau · 6.120 km² · 78% gambut                     │
│ [Cari wilayah…        ]  │  "Sep 2026: 3,1× median 2003–2022, peringkat 1 dari 9      │
│ Preset · Gambar · Koord. │   tahun El Niño sejak 2001."            [Unduh] [Brief]     │
│ ▸ Kalteng, kabut 2015    │ ┌────────────────────────────────────────────────────────┐ │
│ ▸ Riau, Sungai Kampar    │ │  KALENDER tahun × bulan (2001–2026), angka di sel,     │ │
│ ▸ Sumsel, OKI 2019       │ │  garis era sensor, sel arsir "tidak teramati",          │ │
│ ☐ Hanya lahan gambut     │ │  ring anomali, badge A/B/C, kolom total, baris median  │ │
│                          │ └────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────┐ │  Mode: (•) Jumlah  ( ) vs median  ( ) vs tahun El Niño     │
│ │  PETA (MapLibre)     │ │  Strata: Semua · Gambut · Mineral · Siang · Malam          │
│ │  batas, KHG, gambut, │ ├────────────────────────────────────────────────────────────┤
│ │  sel bulan terpilih  │ │  Bulan ini vs sejarah (spaghetti)  │ Kenapa? (hujan, ONI…)  │
│ └──────────────────────┘ │                                     │                        │
│ ── timeline + Gantt ──   │                                     │                        │
│ Terra ████████░░         │                                     │                        │
│ Aqua    ██████████░      │                                     │                        │
│ S-NPP          ████████| │                                     │                        │
│ NOAA-20             ████ │                                     │                        │
└──────────────────────────┴────────────────────────────────────────────────────────────┘
```

**Keputusan layout:**
- **Halaman pertama = kalender sungguhan untuk AOI default** (KHG Sebangau atau Kalimantan Tengah). Tidak ada hero, tidak ada deretan KPI, tidak ada globe. (Anti-pola: landing Kiln Watch, globe Parallax/flare-chronos, KPI IGNIS.)
- **Satu layar menjawab "bagaimana bulan ini dibanding biasanya?"** (aturan C3 dari riset kode).
- Panel kiri (wilayah + peta + timeline) lebar ±360 px; konten kanan fleksibel.
- Navigasi atas maksimal **7 item** (Kiln Watch github.io punya 18; IGNIS 13).
- Tidak ada tur onboarding. Gantinya, petunjuk inline satu baris yang bisa ditutup. (Parallax: tur 11 langkah; IGNIS 6.)

### 2.2 Mobile (<768 px)

```
┌──────────────────────────┐
│ Second Sight        ID|EN │
│ Data hingga 13 Nov 20.33 │
├──────────────────────────┤
│        PETA              │
│  (AOI + sel bulan)       │
├──────────────────────────┤ ← bottom sheet (geser naik)
│ KHG Sebangau             │
│ Sep 2026: 3,1× median    │
│ [Kalender][Bulan ini][↓] │
│ ┌──────────────────────┐ │
│ │ kalender (scroll     │ │ ← satu-satunya scroll horizontal, dengan fade
│ │ horizontal, fade)    │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

Gutter 16 px; tidak ada scroll horizontal halaman. Kalender boleh digeser horizontal di dalam wadahnya sendiri (pola Fire Harmony/Kiln Watch).

---

## 3. Spesifikasi layar (versi gabungan)

### 3.1 Panel Wilayah & Peta

**Isi:**
1. **Kotak cari** (gazetteer: provinsi, kabupaten, KHG, taman nasional; toleran typo).
2. **Tab mode** (port project-shift AreaPicker, 5 mode):
   - *Preset bercerita* (pola Fire Harmony): "Kalimantan Tengah, kabut 2015", "Riau, Sungai Kampar", "Sumatra Selatan, OKI 2019", "Jambi, Berbak", "Kalimantan Barat, Ketapang". Setiap preset punya satu kalimat konteks.
   - *Gambar*: kotak / poligon (terra-draw 1.39 + adapter MapLibre 1.5).
   - *Kotak koordinat*: barat/selatan/timur/utara desimal.
   - *Titik + radius*: lat, lon, radius 1-200 km.
   - *Wilayah saya*: AOI yang pernah dibuat (localStorage, dibungkus try/catch).
3. **Konfirmasi AOI baru** (pola Kiln Watch): "Sekitar 48.400 km², 31% gambut. Perhitungan pertama ±5 detik."
4. **Toggle "Hanya lahan gambut"** (pola Titik Api).
5. **Peta MapLibre:**
   - basemap Protomaps abu-abu terang;
   - batas provinsi/kabupaten (PMTiles);
   - KHG (garis putus-putus) dan gambut (arsir tipis);
   - sel aktivitas bulan terpilih (kotak sesuai ukuran sel, bukan titik; pola burritojustice & Titik Api "piksel sebagai kotak").
6. **Timeline + Gantt satelit** di bawah peta (timeline.js firms-catalog + Gantt ala Kiln Watch):
   - bar Terra, Aqua, S-NPP, NOAA-20, NOAA-21;
   - akhir S-NPP terlihat sebagai ujung bar dengan label "berhenti 2 Nov 2026";
   - era drift Aqua/Terra diarsir tipis;
   - scrubber bulan + tombol putar (1×/2×/4×).

**Interaksi:**
- Hover sel kalender → peta memperlihatkan sel bulan itu (pratinjau).
- Klik sel kalender → bulan dikunci, URL diperbarui.
- Lokasi relatif dalam tooltip peta: "12,4 km utara Sungai Sebangau · lahan gambut" (pola Titik Api).

### 3.2 Kalender (inti)

**Anatomi:**

```
            Jan  Feb  Mar  Apr  Mei  Jun  Jul  Agu  Sep  Okt  Nov  Des │ Total  Peringkat
   2001      3    1    0    2    5   12   40  210  480  320   60    8 │ 1.141     18
   …                                                                   │
   2011 ·   …                                                          │
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │   ← garis era sensor
           [ MODIS, diharmonisasi ▲ | ▼ VIIRS, dikonversi ke skala MODIS ]        (pill label)
   2012 ●   …                                                          │
   2015     …   ◯ ring anomali   ▒ arsir tidak teramati                │
   2026     …                                         ░ provisional NRT│
  ─────────────────────────────────────────────────────────────────────┤
   Median    2    1    0    2    4   10   35  180  390  260   50    6 │
```

**Aturan visual:**
- **Angka di setiap sel** (dapat dimatikan), font body dengan `tabular-nums`.
- **Mode warna** (toggle tiga posisi, pola Kiln Watch):
  - *Jumlah*: ramp sekuensial log, adaptif per AOI (`countScale` Fire Harmony). Kandidat ramp: Crameri `lajolla` atau magma.
  - *vs median*: ramp divergen biru-oranye (Crameri `vik` atau ColorBrewer RdBu dibalik), pusat netral = sama dengan median, label sel "×1,6"; 9 kelas (`ratioClass` Fire Harmony).
  - *vs tahun El Niño*: warna sama dengan *vs median*, tetapi baseline = median tahun sekelas ENSO; baris bawah berganti "Median El Niño".
- **Lima keadaan sel** yang tidak boleh berbagi tampilan (aturan project-shift `tokens.css`):

  | Keadaan | Tampilan |
  |---|---|
  | Ada aktivitas, teramati baik | Warna ramp + angka |
  | Nol aktivitas, teramati baik | Abu-abu sangat muda + "0" |
  | Teramati sebagian (awan/asap) | Warna ramp + arsir tipis + interval melebar di tooltip |
  | Tidak teramati / data hilang | Arsir diagonal tebal, tanpa warna ramp, angka "≥X" atau "–" |
  | Provisional (NRT 2026) | Garis tepi putus-putus |

- **Anomali** (≥ p90): **ring** tipis di sekeliling sel (pola IGNIS), bukan warna baru.
- **Badge triangulasi** A/B/C (09 U3): titik kecil di pojok kanan atas sel. Hanya muncul jika B atau C, supaya grid tidak ramai.
- **Era sensor:** garis horizontal antara 2011 dan 2012 dengan label pill (pola Burn Calendar); titik di label tahun ketika satelit masuk (2002 Aqua, 2012 S-NPP, 2018 NOAA-20, 2023 NOAA-21); label tipis "era drift" di sisi kiri untuk 2022+.
- **Kolom kanan:** total tahunan + peringkat. **Baris bawah:** median (pola Kiln Watch).
- **Kalimat di atas kalender** (judul = temuan): "Sejak koreksi pergantian satelit, 2015 tetap tahun terparah di KHG Sebangau; 2026 kedua." (contoh format; angka dari data).
- **Kalimat di bawah kalender:** "1.825 dari 1.898 sel-bulan teramati baik (96,2%)." (pola flare-chronos).

**Tooltip (pola Kiln Watch + Burn Calendar + Parallax):**

```
September 2015 · KHG Sebangau
1.240 hari-sel api (kemungkinan 1.050–1.430, 9 dari 10)
3,8× median · tertinggi ke-1 dari 25 tahun
Sumber: Aqua MODIS (native) · teramati 64% (asap tebal)
Tiga metode sepakat (A)
```

**Aksesibilitas:** `role="grid"`, panah/PageUp/PageDown/Enter (pola Fire Harmony), setiap sel punya deskripsi lengkap untuk pembaca layar, toggle palet aman buta warna/monokrom (pola IGNIS).

### 3.3 Bulan Ini vs Sejarah

**Grafik utama: spaghetti** (idiom Climate Reanalyzer + band GWIS + "tambah tahun" Global Nature Watch):
- Sumbu x Jan-Des, sumbu y hari-sel api (atau kumulatif).
- Semua tahun 2001-2025 abu-abu tipis.
- Band p10-p90 abu-abu muda.
- Median: garis tebal putus-putus.
- Tahun El Niño (sesuai definisi ONI yang dipakai): **satu warna**, berlabel langsung di ujung garis (2006, 2015, 2019, 2023).
- Tahun berjalan: warna aksen data, garis paling tebal.
- Tombol "+ Tambah tahun pembanding" (pola Global Nature Watch).

**Grafik pendamping:** kumulatif musim (pola GWIS) di samping atau sebagai toggle.

**Kalimat vonis** (pola Global Nature Watch, angka ditebalkan, dibangkitkan dari fact table yang sama dengan brief):
> "**September 2026** di KHG Sebangau: **3,1×** median 2003-2022, **peringkat 1 dari 9** tahun El Niño sejak 2001. Hujan 90 hari **2,1 mm/hari**, di bawah ambang 4 mm/hari."

**Tabel "Kenapa?"** (pola tab "Why" Fire Harmony, versi Indonesia):

| Faktor | Sekarang | Normal | Status |
|---|---|---|---|
| Hujan 90 hari | 2,1 mm/hari | 5,4 mm/hari | Di bawah ambang kekeringan (Field et al. 2016) |
| ONI (El Niño) | +1,8 | 0 | El Niño kuat |
| DMI (IOD) | +0,9 | 0 | IOD positif |
| Drought Code | 610 | 320 | Sangat kering |

Angka di tabel ini contoh format; isi dari data.

### 3.4 Lab Sains

Maksimal tiga panel yang ditonjolkan, masing-masing dengan **judul = temuan** dan satu tombol (i) metode.

| Panel | Visual | Pola asal |
|---|---|---|
| "Di gambut, MODIS lebih buta, terutama malam hari" | Batang berpasangan rasio VIIRS:MODIS gambut vs mineral × siang/malam dengan CI | Baru (09 V9) |
| "Lompatan saat satelit berganti hilang setelah harmonisasi" | **Tabel perubahan level di setiap pergantian satelit** (raw → harmonisasi → sisa) | Kiln Watch |
| "Seam yang tidak terlihat: jam lintas bergeser" | Dua grafik bertumpuk: jam lintas lokal per satelit vs waktu; rasio teramati vs prediksi diurnal | Baru (09 U5) + anotasi ala flare-chronos |

Panel tambahan (di bawah lipatan, P2): kurva FRP floor R(F); κ vs proporsi api besar (09 U1); slider "VIIRS dilihat dengan mata MODIS".

### 3.5 Seberapa Yakin Kami

1. **Kartu utama** (pola Burn Calendar):
   - "Pada tahun yang tidak dipakai kalibrasi, angka mentah meleset rata-rata [hasil]%, Second Sight [hasil]%."
   - Bar raw vs harmonisasi.
   - Satu kalimat kelemahan, contoh: "Paling lemah di bulan berasap tebal 2015."
2. **Tabel uji ringkas:** seam (5 sambungan), MODIS sunset, SiPongi, uji Field, coverage interval. Status lulus/gagal sesuai pra-registrasi; uji gagal tetap tampil.
3. **Disclaimer 3 poin berikon** (pola FIRMS):
   - (1) hotspot ≠ kejadian kebakaran ≠ luas terbakar;
   - (2) sumber panas industri/gunung api sudah dimask, tetapi bisa tersisa;
   - (3) awan dan asap bisa menyembunyikan api.
4. **"Di mana kami masih kurang"**: daftar dari 08 §7.12.

### 3.6 Angka Resmi vs Harmonisasi

- Grafik tahunan tiga garis: luas terbakar SiPongi (sumbu kanan, label langsung), hotspot FIRMS mentah, Second Sight.
- Kartu "Kenapa angkanya berbeda?" dengan 4 alasan + ikon: sensor, filter confidence, unit hitung, jumlah satelit.
- Nada: "melengkapi", dengan sumber dan tanggal setiap angka resmi.

### 3.7 Unduh & Brief

**Menu unduh** (pola Fire Harmony + dialog OWID + downloads project-shift):

| Pilihan | Deskripsi yang ditampilkan |
|---|---|
| Kalender (CSV) | "Satu baris per bulan, 2001-2026: nilai mentah per satelit, nilai harmonisasi + interval, anomali, kelas El Niño, penanda." |
| Titik deteksi (CSV) | "Semua deteksi FIRMS di wilayah dan periode ini, dengan label gambut dan mask sumber statis. [N] baris." |
| Data yang ditampilkan vs data lengkap | Dua tombol dengan jumlah baris masing-masing (pola OWID) |
| Gambar (PNG/SVG) | "Kalender/grafik dengan judul, legenda, sumber, dan tanggal di dalam gambar." |
| Brief siaga (PDF/WhatsApp) | "Satu halaman Bahasa Indonesia. Setiap angka diverifikasi otomatis; ID bukti di catatan kaki." |
| Panduan sitasi | Teks sitasi siap salin + tautan ke FIRMS |

**Brief PDF** (WeasyPrint, pola flare-chronos):
- Kop sederhana (nama aplikasi, AOI, tanggal).
- Kalimat vonis, kalender mini, tabel "Kenapa?", keterbatasan, sumber, ID bukti.
- Tanpa logo NASA.

### 3.8 Metodologi

Tiga lapis: 5 kalimat untuk publik, 1 halaman untuk pengelola, dokumen lengkap untuk peneliti. Setiap angka di aplikasi punya tombol (i) yang membuka bagian metodologi yang relevan dan ID bukti (09 U7).

---

## 4. Design system

### 4.1 Arah visual

**Light-first, operasional, editorial.** Dua kluster tampilan yang paling sering dianggap "AI default" sengaja dihindari:
- **near-black + satu aksen menyala + glow + monospace kecil** (tema Fire Harmony dan flare-chronos);
- **krem + serif display + aksen terakota**.

Tampilan Second Sight mengikuti vernakular **lembaga operasional** (BMKG, BRIN, OWID): latar netral dingin, teks gelap, warna hanya dipakai untuk data.

### 4.2 Token warna

| Token | Hex | Peran |
|---|---|---|
| `--bg` | `#F6F7F8` | Latar halaman (abu dingin, bukan krem) |
| `--surface` | `#FFFFFF` | Panel |
| `--ink` | `#1B1F24` | Teks utama |
| `--ink-2` | `#56606B` | Teks sekunder, anotasi |
| `--hairline` | `#D8DDE3` | Garis pemisah |
| `--accent-ui` | `#1F5F8B` | Tombol, link, fokus. **Biru tinta, sengaja bukan oranye/api**, supaya kontrol tidak terbaca sebagai data |
| `--zero` | `#ECEFF2` | Sel nol aktivitas |
| `--unobserved` | arsir `#9AA4AF` di atas `--bg` | Sel tidak teramati |
| `--el-nino` | `#B4462E` | Garis tahun El Niño di spaghetti (satu warna) |
| `--current-year` | `#111111` atau ramp tertinggi | Tahun berjalan |

**Ramp data:**
- Jumlah: sekuensial (Crameri `lajolla` atau `magma`/`inferno`), skala log, adaptif per AOI.
- vs median: divergen biru-oranye (Crameri `vik`, atau RdBu dibalik), 9 kelas, pusat netral abu.
- Uji: simulasi deuteranopia/protanopia + kontras teks ≥4,5:1.
- Mode gelap tersedia, tetapi bukan default. Di mode gelap: latar `#15181C` (bukan near-black murni), **tanpa glow**.

Hex di atas adalah usulan awal. Validasi kontras dan CVD sebelum dikunci.

### 4.3 Tipografi

| Peran | Font | Alasan |
|---|---|---|
| Judul | **Plus Jakarta Sans** (Tokotype, Indonesia, OFL) | Berakar pada subjek (foundry Indonesia), bukan default |
| Body & UI | **Source Sans 3** (OFL) atau **Public Sans** (OFL) | Sangat terbaca, nuansa institusi |
| Angka | Font body dengan `font-variant-numeric: tabular-nums lining-nums` | Kolom angka rapi tanpa monospace terpisah (monospace kecil adalah tanda "AI template") |

- Skala: 13 / 15 / 18 / 24 / 32 px; body 15-16 px; panjang baris ≤75 karakter.
- Sentence case; **tanpa** eyebrow ALL-CAPS; tanpa panah "→" di tombol.
- Self-host via `@fontsource-variable/*`.

### 4.4 Angka, tanggal, satuan

| Aspek | Bahasa Indonesia | English |
|---|---|---|
| Ribuan/desimal | `12.345` · `3,1×` · `1,2 juta` | `12,345` · `3.1×` · `1.2 million` |
| Bulan | Sep 2026 | Sep 2026 |
| Waktu | 20.33 WIB | 13:33 UTC |
| Interval | "kemungkinan 1.050-1.430 (9 dari 10)" | "likely 1,050-1,430 (9 in 10)" |

- Pakai `Intl.NumberFormat('id-ID' | 'en-GB')`; jangan mencampur format.
- Bulatkan ke 2-3 angka signifikan di teks; nilai eksak di tooltip, tabel, dan CSV.
- Satuan disebut sekali di subjudul: "hari-sel api, skala setara Aqua-MODIS".

### 4.5 Komponen dan hierarki

- Radius dan bayangan **bervariasi menurut hierarki**: peta tanpa radius, panel radius 6, chip radius penuh, dialog radius 10 + bayangan. **Tidak ada kartu di dalam kartu.**
- Ikon: satu set outline (mis. Lucide/Phosphor), **tanpa emoji**, tidak ditempel di atas setiap judul.
- Motion hanya untuk menjelaskan perubahan (bulan berganti, peta terbang ke AOI, transisi raw → harmonisasi); hormati `prefers-reduced-motion`.
- Setiap grafik:
  - judul = temuan;
  - subjudul = satuan + kelengkapan data;
  - label langsung (bukan legenda jauh);
  - sumber + lisensi + tanggal di dalam grafik;
  - tombol tabel + CSV + PNG di dekat grafik.

### 4.6 Microcopy (ID/EN)

| Konteks | Bahasa Indonesia | English |
|---|---|---|
| Satuan | hari-sel api | fire cell-days |
| Sensor | satelit lama (MODIS) · satelit tajam (VIIRS) | older satellite (MODIS) · sharper satellite (VIIRS) |
| Tidak teramati | Tidak teramati: awan atau asap | Not observed: cloud or smoke |
| Provisional | Sementara (data NRT, bisa berubah) | Provisional (near-real-time, may change) |
| Vonis | "{bulan}: {rasio}× median, peringkat {n} dari {N} tahun El Niño" | "{month}: {ratio}× the median, rank {n} of {N} El Niño years" |
| Keyakinan | Tiga metode sepakat · Dua metode sepakat · Metode tidak sepakat | Three methods agree · Two agree · Methods disagree |
| Disclaimer | Titik panas bukan berarti kebakaran pasti | A hotspot is not a confirmed fire |
| Kosakata resmi | titik panas, KHG, Manggala Agni, BPBD, karhutla | hotspot, peat hydrological unit (KHG), … |

Hindari copy startup ("Unlock insights", "Powered by AI", "real-time" padahal tidak). Nada mengikuti BMKG/BRGM: faktual dan singkat.

---

## 5. Komponen dan kode yang dipakai ulang

### 5.1 Daftar adaptasi

| Komponen Second Sight | Diambil dari | File sumber | Lisensi | Bentuk pakai |
|---|---|---|---|---|
| Skala warna log + kelas rasio | Fire Harmony | `app/src/lib/stats.ts` (`countScale`, `countClass`, `ratioLimit`, `ratioClass`) | Apache-2.0 | Salin fungsi + header perubahan |
| Kalender ARIA + keyboard | Fire Harmony | `app/src/components/Calendar.tsx` (`onKey`, `role=grid`, `describe()`) | Apache-2.0 | Adaptasi pola |
| Loader duckdb-wasm (lazy, hanya AOI kustom) | Fire Harmony | `app/src/lib/db.ts` | Apache-2.0 | Salin + ganti URL |
| Simpan file + ekspor PNG | Fire Harmony | `lib/download.ts`, `exportImages.ts` | Apache-2.0 | Salin `download.ts`; `exportImages` sebagai pola |
| Pemilih AOI 5 mode | project-shift | `web/src/components/AreaPicker.jsx`, `web/src/lib/area.js` | Apache-2.0 | Port ke TS + header perubahan |
| State URL | project-shift | `web/src/lib/url.js` | Apache-2.0 | Salin + atribusi |
| Unduhan CSV/SVG/PNG + tautan FIRMS | project-shift | `web/src/lib/downloads.js` | Apache-2.0 | Adaptasi |
| Aturan warna ilmiah + struktur folder ramah desainer | project-shift | `web/src/theme/tokens.css` (komentar), `UI_GUIDE.md` | Apache-2.0 | Ambil aturan; hex sendiri |
| Helper ramp, angka rapi, z → kata | Burn Calendar | `docs/app.js` (`ramp`, `diverge`, `niceMax`, `zWord`) | MIT | Salin + copyright MIT |
| Label pill era sensor di grid | Burn Calendar | `drawCal()` | MIT | Implementasi ulang ringan |
| Ramp OKLCH sadar tema (opsional) | flare-chronos | `apps/workbench/src/lib/calendar/ramp.ts` | MIT | Salin + copyright MIT |
| Timeline/brush | firms-catalog | `apps/firms-explorer/timeline.js` (+ test) | Apache-2.0 | Salin sebagai modul |
| Basemap PMTiles + Protomaps | firms-catalog (pola) | `index.html` | Apache-2.0 + © OpenStreetMap | Pakai `@protomaps/basemaps`; atribusi OSM tampil di peta |

**Jangan diambil:**
- File batas administrasi `web/public/geo/adm2/odbl/` di project-shift (ODbL, wajib berbagi ulang).
- Kode Grapher OWID versi 2026 (view-only).
- Tema NASA Horizon Design System (hanya untuk situs NASA-branded; Space Apps juga melarang kesan endorsement).
- Kode apa pun dari Kiln Watch, Icarus, EG FireTrack (tanpa lisensi).
- Tema visual (warna/tipografi) pesaing mana pun.

### 5.2 Pustaka (set minimal)

| Pustaka | Versi (13 Nov 2026) | Lisensi | Peran |
|---|---|---|---|
| maplibre-gl | **6.17.x** (pin; 6.18.0 baru rilis 11 Nov) | BSD-3 | Peta |
| pmtiles + @protomaps/basemaps | 4.5.0 + 5.7.2 | BSD-3 | Basemap & batas tanpa tile server |
| terra-draw + terra-draw-maplibre-gl-adapter | 1.39.0 + 1.5.0 | MIT | Gambar AOI |
| @observablehq/plot | 0.6.19 | ISC | Spaghetti, kumulatif, lab |
| d3-scale-chromatic / d3-format | 3.1.1 / 3.1.3 | ISC | Palet, format |
| hyparquet | 1.33.0 | MIT | Baca Parquet agregat (ringan, tanpa WASM) |
| @duckdb/duckdb-wasm | 1.33.1-dev57.0 | MIT | **Lazy-load** hanya untuk AOI kustom |
| @turf/area | 7.4.0 | MIT | Luas AOI |
| tinykeys | 4.0.1 | MIT | Shortcut |
| @fontsource-variable/plus-jakarta-sans, source-sans-3 | 5.3.x | OFL-1.1 | Font |
| Kalender | **SVG custom** (~150 baris, pola semua pesaing) | — | cal-heatmap dan maplibre-gl-draw tidak disarankan (tidak dirilis sejak 2023) |

i18n: kamus TypeScript bertipe + `Intl` (cukup untuk 2 bahasa).

### 5.3 Catatan hosting data (dari bedah kode)

- **GitHub Pages mengompresi `.parquet` on-the-fly, sehingga HTTP range request gagal.** Fire Harmony mengakalinya dengan memuat file kecil utuh dan menaruh file besar di Hugging Face.
- Rekomendasi:
  - Precompute agregat per AOI preset sebagai JSON/Parquet kecil (dimuat utuh dengan hyparquet).
  - Untuk AOI kustom, muat grid bulanan sel 0,05° Indonesia (precompute) lalu jumlahkan di klien; duckdb-wasm hanya jika perlu titik mentah.
  - Host file besar di Cloudflare Pages/R2 atau Hugging Face. **Uji range request sebelum demo** (perilaku Cloudflare belum diverifikasi).

### 5.4 Atribusi

- Folder `THIRD_PARTY_LICENSES/` berisi lisensi kelima repo (fire-harmony, project-shift, firms-catalog: Apache-2.0; burn-calendar, flare-chronos: MIT).
- Header file adaptasi Apache: `// Adapted from <repo>/<path> (Apache License 2.0). Changes: <ringkas>. Modified by Second Sight, Nov 2026.`
- File adaptasi MIT: pertahankan baris copyright asli + teks izin MIT.
- README "Credits / third-party code" menyebut semua repo dan pustaka. Project page bagian References juga.
- **Risiko kompetisi:** repo sumber adalah pesaing di challenge yang sama. Ambil utilitas dan pola, bukan halaman atau tema utuh. Atribusi terbuka mencegah tuduhan plagiarisme.

---

## 6. Posisi UI terhadap pesaing

| Aspek | Pesaing (contoh) | Second Sight |
|---|---|---|
| Halaman pertama | Landing slogan + PROBLEM/SOLUTION (Kiln Watch); globe 3D (Parallax, flare-chronos); 6 KPI + ticker (IGNIS) | **Kalender sungguhan untuk AOI default** + satu kalimat vonis |
| Tema | Near-black + glow (Fire Harmony versi dark, flare-chronos); neon cyan (IGNIS) | Light-first netral; warna hanya untuk data |
| Kejujuran sel | Arsir modelled (flare-chronos, Parallax) | Lima keadaan sel terpisah + badge triangulasi |
| Era sensor | Garis 2012 (Burn Calendar); Gantt (Kiln Watch) | Keduanya + era drift + akhir S-NPP |
| "Tahun ini vs sejarah" | Mode "vs recent years" (Kiln Watch) | Spaghetti + band + **tahun El Niño** + kumulatif |
| Kepercayaan | Kartu raw vs harmonized (Burn Calendar), tabel level change (Kiln Watch) | Keduanya + uji SiPongi + pra-registrasi + evidence ID |
| AI | "✦ AI Analyst" sebagai CTA (IGNIS); MCP/n8n di navigasi (Kiln Watch) | Brief terverifikasi di menu Unduh; AI tidak pernah jadi tombol utama |
| Bahasa | Inggris (semua pesaing challenge) | **ID default + EN**, format angka & WIB |
| Navigasi | 13-18 item | ≤7 item |
| Onboarding | Tur 6-11 langkah | Petunjuk inline satu baris |

---

## 7. Checklist anti AI-slop (gabungan audit + skill Anthropic frontend-design + Impeccable)

Jalankan sebelum freeze (H2 18:00), dengan screenshot desktop + mobile + dua tema.

**Struktur**
- [ ] Halaman pertama = kalender data nyata, bukan hero/KPI/globe.
- [ ] Navigasi ≤7 item; tidak ada tur onboarding panjang.
- [ ] Tidak ada panel kosong yang menunggu login/token.
- [ ] Tidak ada status API/kuota developer di UI publik.

**Visual**
- [ ] Tanpa gradien dekoratif, glow, glassmorphism, noise, teks bergradien.
- [ ] Tanpa ungu/indigo; aksen UI ≠ warna data api.
- [ ] Font bukan Inter/IBM Plex/Space Grotesk/JetBrains Mono; tanpa monospace kecil untuk label.
- [ ] Tanpa eyebrow ALL-CAPS, tanpa panah "→" di tombol, tanpa penomoran 01/02/03 dekoratif.
- [ ] Radius/bayangan bervariasi menurut hierarki; tidak ada kartu dalam kartu; tidak semua blok jadi kartu.
- [ ] Ikon satu set outline; tanpa emoji.
- [ ] Animasi hanya untuk menjelaskan perubahan.

**Data**
- [ ] Setiap grafik: judul = temuan, satuan, sumber di dalam grafik, label langsung, tabel + CSV/PNG.
- [ ] Tidak ada pie/donut, dual axis, rainbow/jet.
- [ ] "Nol", "tidak teramati", "provisional", "dimodelkan" tampil berbeda.
- [ ] Angka selalu bersatuan dan berkonteks (vs median, peringkat).
- [ ] Ramp lolos uji buta warna; kontras ≥4,5:1.

**Copy**
- [ ] Tanpa "Unlock insights", "Powered by AI", "real-time" palsu.
- [ ] Jargon diterjemahkan (tidak ada SFAI/HFD/KS di KPI utama).
- [ ] Bahasa Indonesia dan Inggris setara kualitasnya.

**Kepatuhan**
- [ ] Tanpa logo NASA/meatball atau kesan endorsement.
- [ ] Atribusi OSM tampil di peta; `THIRD_PARTY_LICENSES/` lengkap.
- [ ] Gambar/visual buatan AI diberi watermark (aturan SI).

**Proses (dari skill Anthropic frontend-design):** sebelum membangun, tulis rencana desain singkat (4-6 warna bernama, 2 font + perannya, wireframe ASCII). Tanyakan: "apakah ini default yang akan muncul untuk brief serupa?" Revisi bagian yang generik. Setelah jadi, kritik screenshot sendiri dan hapus satu aksesori yang tidak perlu.

---

## 8. Alur demo → layar (untuk video 30 detik dan pitch)

| Detik video (09 §6.2) | Layar & aksi UI |
|---|---|
| 0:02-0:07 | Kalender mode *Jumlah*, posisi **raw**: lompatan 2012 terlihat; Gantt satelit dengan akhir S-NPP |
| 0:07-0:12 | Peta, strata *Malam* + toggle *Hanya lahan gambut*: sel VIIRS terang; kalender memperlihatkan sel berarsir "tidak teramati" di 2015 |
| 0:12-0:20 | Toggle raw → **harmonisasi** (animasi transisi); badge A muncul; label pill era sensor |
| 0:20-0:26 | Mode *vs tahun El Niño* + spaghetti; tabel prioritas KHG dengan peluang; buka brief PDF |
| 0:26-0:30 | Kartu "Seberapa yakin kami?" + peta mini Indonesia + Amazon (uji transfer) |

Rekam dari aplikasi asli (bukan mockup), resolusi 1920×1080, kursor diperbesar, subtitle Inggris.

---

## 9. Rencana build UI dalam 48 jam (R4, dibantu R5)

| Waktu | Pekerjaan | Hasil |
|---|---|---|
| H1 10:00-11:00 | **Rencana desain** (token, font, wireframe ASCII) + uji "apakah ini default?" | `docs/design.md` |
| H1 11:00-13:00 | Scaffold Vite + TS; MapLibre + PMTiles + basemap; font; token CSS; i18n | Peta jalan |
| H1 13:00-17:00 | Kalender SVG custom (grid, angka, total, median, era sensor, keyboard) dengan data dummy **berlabel**; adaptasi `stats.ts` | Kalender statis |
| H1 17:00-21:00 | Sambung data nyata (hyparquet); toggle mode; lima keadaan sel; tooltip | Kalender hidup |
| H1 21:00-24:00 | Panel AOI (port AreaPicker) + URL state + konfirmasi AOI | Alur AOI |
| H2 06:00-10:00 | Spaghetti + kumulatif + tabel "Kenapa?" + kalimat vonis | Layar Bulan Ini |
| H2 10:00-14:00 | Lab (3 panel) + Seberapa Yakin + Angka Resmi | Layar sains |
| H2 14:00-16:00 | Unduh (menu + dialog + PNG/CSV) + brief (dengan R5/R6) | Unduhan |
| H2 16:00-18:00 | Mobile bottom sheet; checklist anti-slop; uji CVD/kontras; deploy | Freeze UI |
| H2 18:00-21:00 | Rekam video; bug fix saja | Video |

**Garis potong UI (urut):** slider "mata MODIS" → panel lab ke-3 → dialog full vs displayed (cukup satu CSV) → mobile bottom sheet (cukup layout bertumpuk) → mode gelap. **Jangan dipotong:** kalender dengan lima keadaan sel, era sensor, toggle raw/harmonisasi, spaghetti, kartu kepercayaan, CSV.

---

## 10. Hal yang belum terverifikasi

1. Perilaku HTTP range request di Cloudflare Pages/R2 untuk Parquet.
2. Ukuran gzip duckdb-wasm.
3. Lisensi Crameri colour maps di Zenodo (paket turunan menyebut MIT).
4. Detail Climate Pulse dan Climate Reanalyzer (hanya pola visual).
5. Lisensi repo karhutla Indonesia (Titik Api, karhutla-watch); polanya diimplementasi ulang, bukan disalin.
6. GWIS hanya diaudit dengan zona Eropa (pemilih zona tidak bisa ke Asia/Indonesia).
7. FIRMS diaudit dari modal disclaimer dan teks halaman, bukan peta penuh.
8. Fire Harmony punya tema terang (terlihat di audit live) dan token gelap di kode; keduanya tidak ditiru.
