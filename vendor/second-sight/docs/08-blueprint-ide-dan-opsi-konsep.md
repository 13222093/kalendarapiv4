# 08 · Blueprint Ide: Menggabungkan Riset menjadi Proyek yang Kuat

> **Versi lanjutan tersedia:** [09-second-sight-v2-upgrade-pipeline-dan-posisi.md](09-second-sight-v2-upgrade-pipeline-dan-posisi.md) menambah 11 upgrade sains/produk, pipeline 16 stage dengan quality gate, dan posisi terhadap repo terkuat. Bagian sains, pipeline, dan validasi di 09 menggantikan §7.6 di sini; bagian lain (persona, layar, skema data, demo, 48 jam, Q&A) tetap berlaku.

> **Status dokumen:** berisi pustaka opsi (§1-§6) **dan** satu rekomendasi ide final lengkap setingkat PRD (§7 dst.).
> **Catatan aturan AI:** CP lokal Bandung mengonfirmasi ke tim (13 Nov 2026) bahwa AI boleh dipakai langsung untuk ide dan PRD. Simpan bukti tertulisnya. Penggunaan AI tetap **diakui** di submission (field "Use of SI", teks deskripsi, metadata), karena penjurian global memakai aturan resmi global.
> **Dasar:** semua riset di [01](01-masalah-challenge.md)-[07](07-gap-analysis-dan-usp.md) dan `_raw/`.
> **Isi:** pustaka blok bangunan (data, fisika, statistik, validasi, AI, UX, engineering), pemetaan blok ke celah pesaing, empat konsep alternatif lengkap dengan penilaian, blueprint demo, rencana 48 jam, register risiko, dan persiapan tanya-jawab juri.

---

## 0. Cara memakai dokumen ini (baca dulu)

### 0.1 Bentuk dokumen

Awalnya dokumen ini disusun sebagai "opsi saja", karena Submission Guide resmi 2026 melarang AI untuk menghasilkan ide solusi. Setelah CP lokal mengonfirmasi bahwa AI boleh dipakai untuk ide dan PRD, dokumen dilengkapi dengan **rekomendasi ide final** ([§7](#7-rekomendasi-ide-final-prd)). Isinya sekarang:

1. **§1-§6:** pustaka blok bangunan, empat konsep alternatif, dan alat bantu keputusan. Tetap berguna sebagai cadangan dan untuk menjawab "kenapa tidak memilih X?".
2. **§7 dan seterusnya:** satu konsep final setingkat PRD (masalah, pengguna, fitur, sains, data, arsitektur, demo, rencana 48 jam, risiko, Q&A juri).
3. **Pengakuan penggunaan AI tetap wajib** di submission.

Batas antara "riset" dan "mulai mengerjakan challenge" tidak didefinisikan secara resmi. Dokumen ini hanya berisi rumus dari literatur, desain, dan perencanaan, **tanpa kode**. Agar aman, implementasi apa pun (repo, notebook, unduhan yang diolah) baru dimulai **14 Nov 2026 09:00 WIB**.

### 0.2 Struktur dokumen

| Bagian | Isi | Dipakai untuk |
|---|---|---|
| §1 | Prinsip desain yang diturunkan dari riset | Saringan semua keputusan |
| §2 | Pohon masalah: masalah apa saja yang sebenarnya ada | Memilih framing |
| §3 | **Pustaka blok bangunan** (±70 blok): data, fisika, statistik, validasi, AI, UX, engineering | Bahan rakitan |
| §3H | **Teknologi dari repo tim lain** yang bisa dipinjam (dengan status lisensi) | Mempercepat tanpa melanggar |
| §4 | Pemetaan blok → celah → pesaing yang dikalahkan | Memastikan setiap blok punya alasan |
| §5 | **Empat konsep alternatif**, masing-masing lengkap (masalah, pengguna, blok, sains, demo, risiko, skor) | Pilihan arah |
| §6 | Panduan keputusan tim | Menguji/menyesuaikan rekomendasi |
| **§7** | **Rekomendasi ide final (PRD)**: masalah, pengguna, fitur, sains, data, pipeline, arsitektur, uji transfer global | Yang dibangun |
| §8 | Rekayasa demo: pitch lokal 21 Nov, video 30 detik, 7 slide, project page | Presentation |
| §9 | Rencana 48 jam, peran, dan garis potong | Eksekusi |
| §10 | Register risiko dan fallback | Ketahanan |
| §11 | Bank pertanyaan juri + jawaban | Persiapan pitch |
| §12 | Checklist kepatuhan submission | Eligibility |
| §13 | Lampiran: kartu rumus, tabel ablation, daftar pustaka | Referensi cepat |

### 0.3 Konvensi penanda

- **[V]** dicek ke dokumen primer · **[S]** dari abstrak/ringkasan/media · **[UNVERIFIED]** belum terkonfirmasi.
- **Effort** dalam jam-orang untuk tim yang sudah terbiasa Python dan web.
- **★** = nilai pembeda terhadap pesaing (★★★ tertinggi).

---

## 1. Prinsip desain yang diturunkan dari riset

Riset menghasilkan tiga "juri" dengan kebutuhan berbeda, ditambah satu kenyataan pasar.

### 1.1 Tiga lapis juri

| Juri | Kapan | Apa yang mereka lihat | Yang membuat skor tinggi | Sumber |
|---|---|---|---|---|
| **Juri lokal Bandung (mitra BRIN)** | Pitch live 21 Nov (hybrid) | Pitch, demo langsung, tanya-jawab | Produk yang jalan dan dipoles, pitch yang tajam, **jawaban teknis yang benar** soal hotspot, confidence, dan validasi (BRIN mengoperasikan sistem hotspot nasional berbasis VIIRS) | [02](02-pola-pemenang.md), `_raw/aturan-pemenang-platform.md` |
| **Juri global (pakar NASA & space agency)** | Des 2026 | **Project page, video 30 detik / 7 slide, link proyek**. Tanpa pitch live | Validity yang terdokumentasi, data NASA sebagai inti, dampak spesifik yang bisa dipahami dalam 30 detik | Judging Guide 2026 |
| **Executive committee** | Jan 2027 | Finalis | Kecocokan dengan kategori award (Local Impact, Best Use of Science, Best Use of Data) | Judging Guide 2026 |

### 1.2 Kenyataan pasar (dari 43 repo pesaing)

- Fitur dasar sudah **komoditas**: kalender tahun × bulan, median, CSV, AOI, rasio overlap, peta, globe, chatbot.
- Pesaing kuat sudah punya uji "matikan MODIS" (Kiln Watch), change-point + placebo (Fire Harmony), fisika footprint (flare-chronos), dan playbook BPBD Borneo (EG FireTrack).
- Belum ada tim Indonesia. Belum ada yang menyentuh: **gambut sebagai strata kalibrasi, drift orbit, ambang FRP fisik, koreksi awan per piksel, validasi SiPongi, rekonsiliasi angka resmi, baseline kondisional ENSO, unit KHG**.

### 1.3 Sepuluh prinsip desain

| # | Prinsip | Asal riset | Konsekuensi praktis |
|---|---|---|---|
| P1 | **Mulai dari keputusan pengguna, bukan dari data** | Pola GaamaRamma/NVS-knot/QUEÑARIS | Setiap layar menjawab satu pertanyaan yang diucapkan pengguna nyata |
| P2 | **Sempit secara wilayah, dalam secara dampak** | QUEÑARIS vs Bloomee | Fokus Indonesia/gambut; AOI global tetap tersedia tetapi bukan cerita utama |
| P3 | **Harmonisasi adalah alat; tren palsu adalah masalahnya** | Riset challenge | Pitch dibuka dengan bahaya salah baca, bukan dengan nama sensor |
| P4 | **Fisika menjelaskan "mengapa", statistik membuktikan "seberapa yakin"** | `_raw/pendekatan-fisika-statistik.md` | Setiap koreksi punya rasional fisik + uji statistik |
| P5 | **Validasi adalah fitur yang terlihat** | Kriteria Validity + pola Kiln Watch | Panel "Seberapa yakin kami" di aplikasi, bukan hanya PDF |
| P6 | **Jujur soal kegagalan** | Kiln Watch, burn-calendar, Thermoscope | Bagian "di mana kami masih kurang" di app dan project page |
| P7 | **AI adalah setir, sains adalah mesin** | `_raw/pendekatan-ai-agent-teknis.md` | LLM tidak pernah menghasilkan angka; setiap angka diverifikasi |
| P8 | **Maksimal 2-3 "momen sains" yang divisualkan** | Fire Harmony (60 GB), IGNIS (11 tab) | Sisanya masuk dokumen metodologi |
| P9 | **Demo harus tahan gagal** | Pitch live + juri global hanya membaca | Static bundle offline, video cadangan, fallback tanpa LLM |
| P10 | **Patuh aturan secara mencolok** | Risiko pre-build pesaing | Riwayat commit dimulai 14 Nov; pengakuan AI jelas; demo ≤7 slide/30 detik |
| P11 | **Lokal dalam cerita, global dalam metode** ("local-first, globally scalable") | Arahan tim + kriteria Impact ("could change the world") + pola Local Impact | Cerita, pengguna, dan validasi berfokus Indonesia (gambut, KHG, SiPongi). Tetapi **setiap blok sains harus bebas-wilayah**: strata didefinisikan sebagai "rezim api" (gambut, hutan, pertanian, savana), bukan "Indonesia"; parameter dari peta global (PEATMAP, MCD12Q1); operator fisika dari paper global. Skalabilitas **dibuktikan** dengan uji transfer ke 1-2 wilayah non-Indonesia (lihat §7.8) |

### 1.4 "Rumus juara" sebagai checklist

Proyek yang ideal menurut riset ini lolos semua pertanyaan berikut dalam **satu kalimat masing-masing**:

1. **Untuk siapa?** (pengguna bernama, sebaiknya lembaga Indonesia nyata)
2. **Keputusan apa yang dipercepat?** (kata kerja konkret: menetapkan siaga, menempatkan patroli, memprioritaskan pembasahan gambut)
3. **Kenapa data yang ada tidak cukup?** (step palsu, angka antar-lembaga berbeda, gambut kurang terdeteksi)
4. **Apa yang kami lakukan berbeda secara ilmiah?** (satu kalimat fisika)
5. **Seberapa yakin?** (satu angka validasi)
6. **Apa yang terjadi setelah MODIS mati?** (kontinuitas)
7. **Apa yang bisa dibawa pulang pengguna hari ini?** (CSV, brief, kartu)
8. **Bagaimana ini bekerja di luar Indonesia?** (satu kalimat tentang metode bebas-wilayah + satu bukti transfer)

Dua pertanyaan terakhir adalah jembatan dari Local Impact ke juri global. Juri lokal (BRIN) menilai ketepatan untuk Indonesia. Juri global menilai apakah pendekatannya bisa "mengubah dunia" setelah MODIS berakhir di seluruh planet, bukan hanya di Kalimantan.

---

## 2. Pohon masalah: masalah apa saja yang sebenarnya ada

Challenge menyebut satu masalah (MODIS dan VIIRS tidak bisa dibandingkan). Riset menemukan bahwa di Indonesia masalahnya berlapis. Setiap lapis bisa menjadi "pintu masuk" framing.

```
MASALAH INTI: Pengelola karhutla tidak punya gambaran sejarah kebakaran yang konsisten
│
├── M1. Sambungan sensor menciptakan tren palsu
│     ├── 2002: Terra-only → Terra+Aqua
│     ├── 2012: masuknya VIIRS (rasio 2× sampai >25×)
│     ├── 2018/2023: NOAA-20, NOAA-21 (jumlah satelit berubah)
│     ├── 2020-2022+: DRIFT ORBIT Terra (pagi) dan Aqua (sore)   ← "seam tersembunyi"
│     └── 2 Nov 2026: S-NPP berhenti; 2026-2027: MODIS berakhir   ← "why now"
│
├── M2. Angka resmi saling berbeda
│     ├── SiPongi: MODIS + VIIRS dicampur tanpa koreksi
│     ├── BRIN: VIIRS saja
│     ├── Global Nature Watch: VIIRS sejak 2012, MODIS tidak dipakai statistik
│     ├── Nusantara Atlas: MODIS + VIIRS dijumlahkan
│     └── Luas terbakar resmi vs independen: 202 rb ha vs ~1,9-4,2 juta ha (2026, belum final)
│
├── M3. Gambut "menyembunyikan" api
│     ├── Membara, suhu rendah (<~650 K), FRP MIR underestimate
│     ├── Aktif malam hari; MODIS malam jauh kurang sensitif (3,7 MW vs 0,5-0,7 MW)
│     ├── Tertutup asap tebal saat puncak (deteksi bisa TURUN saat paling parah)
│     └── 53% api 2015 di gambut yang hanya 12% lahan
│
├── M4. "Normal" itu relatif terhadap iklim
│     ├── Musim besar mengikuti El Niño + IOD positif (1997, 2006, 2015, 2019, 2023, 2026)
│     ├── Membandingkan 2026 dengan median semua tahun mencampur tahun basah dan kering
│     └── BPBD perlu tahu: "lebih buruk dari El Niño biasanya?"
│
└── M5. Data ada, tetapi tidak sampai ke keputusan
      ├── Platform kuat di real-time, kosong di sejarah
      ├── SPARTAN BMKG = bahaya cuaca, bukan aktivitas aktual
      ├── Unit pengelolaan (KHG, kabupaten) tidak tersedia sebagai seri sejarah
      └── Laporan siaga ditulis manual
```

| Lapis | Siapa yang merasakan | Bukti riset | Sudah disentuh pesaing? |
|---|---|---|---|
| M1 | Semua pengguna data jangka panjang | Literatur rasio, status misi | Ya (2012), **tidak** (drift) |
| M2 | Publik, media, pemda, juri BRIN | Platform benchmark | **Tidak** |
| M3 | Manggala Agni, BRGM, peneliti | Sofan, Atwood, Vetrita, Sofiev | **Tidak** (hanya fitur ML/risk score) |
| M4 | BPBD, BNPB | Field 2009/2016, Pan 2018 | **Tidak** (hanya driver) |
| M5 | BPBD, kepala desa, MPA | Repo karhutla Indonesia | Sebagian (operasional NRT), **tidak** untuk sejarah |

---

## 3. Pustaka blok bangunan

Setiap blok ditulis dengan format: **Apa · Rumus/mekanisme · Input · Output · Effort · Nilai · Risiko · Dipakai di konsep**.
Kode konsep: K1, K2, K3, K4 (dijelaskan di §5). "Inti" = dibutuhkan semua konsep.

### 3A. Blok DATA

#### D1. Arsip FIRMS standar (SP) MODIS C6.1 + VIIRS 375 m C2 — **Inti**
- **Apa:** sumber utama semua deteksi hotspot 2000-2025 (standard/science quality, ada kolom `type`).
- **Jalur unduh (urut prioritas):**
  1. CSV tahunan per negara: `firms.modaps.eosdis.nasa.gov/data/country/{modis|viirs-snpp|viirs-jpss1}/YYYY/..._YYYY_Indonesia.csv` (teruji tersedia 2000-2025) [V].
  2. FIRMS Archive Download (butuh Earthdata Login; antrean bisa lama).
  3. Mirror GeoParquet `portolan-mirrors/firms-catalog` (query bbox via DuckDB; pihak ketiga, cek lisensi/uptime).
- **Kolom kunci:** `latitude, longitude, brightness/bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_t31/bright_ti5, frp, daynight, type`.
- **Volume:** estimasi 5-12 juta baris Indonesia, ~150-400 MB Parquet [UNVERIFIED].
- **Catatan penting:**
  - NOAA-21 belum ditemukan di jalur CSV negara; cek Archive Download.
  - VIIRS: pakai file reprocess v3 (bug label `type` diperbaiki Mei 2025) [V].
  - Arsip per negara memotong deteksi offshore (tidak masalah karena kita membuang `type=3`).
  - Data Terra sebelum Nov 2000 bermasalah, dibuang (Giglio 2016) [V].
- **Effort:** 2-4 jam (unduh + konversi ke Parquet).
- **Risiko:** antrean archive; jaringan. **Fallback:** CSV per negara.

#### D2. FIRMS NRT 2026 (ekor terbaru) — **Inti**
- **Apa:** data Jan-Nov 2026 yang belum tersedia sebagai SP (file 2026 per negara masih 404).
- **Jalur:** API area, `MAP_KEY`, sumber `MODIS_NRT`, `VIIRS_SNPP_NRT` (hingga 2 Nov 2026), `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`; `DAY_RANGE` 1-5; kuota 5.000 transaksi/10 menit [V].
- **Catatan:** NRT **tidak punya kolom `type`**, sehingga perlu mask sumber statis buatan sendiri (blok S11). Tandai semua nilai NRT sebagai "provisional".
- **Effort:** 2 jam. **Risiko:** CORS di browser (pakai saat pra-proses, bukan dari frontend).

#### D3. FIRMS `missing_data` dan `data_availability` — **Inti**
- **Apa:** daftar tanggal tanpa data per sensor. Dipakai agar "tidak ada data" tidak dibaca sebagai "nol api".
- **Output:** tabel `data_health` (tanggal × sensor × status).
- **Effort:** 1 jam. **Nilai:** ★★ (jarang dipakai pesaing secara eksplisit).

#### D4. MODIS Climate Modeling Grid (MOD14CMQ / MYD14CMQ) — K3, opsional K1
- **Apa:** grid 0,25° bulanan (juga 8-harian) dengan layer `RawFirePix`, `CorrFirePix`, `CloudCorrFirePix`, `CloudPix`, `TotalPix`, `MeanCloudFraction`, `MeanFRP` (MOD14 User Guide V61 Table 9) [V].
- **Fungsi:** fraksi awan per sel-bulan untuk koreksi observation opportunity (blok P7).
- **Jalur:** SFTP University of Maryland (kredensial publik yang umum dipakai `fire`/`burnt`) [UNVERIFIED].
- **Effort:** 3-4 jam (unduh ~300 file kecil, subset Indonesia).
- **Risiko:** akses SFTP. **Fallback:** ERA5 total cloud cover 0,25° sebagai proxy.

#### D5. Peta gambut — K1, K3, K4 (★★★)
- **Pilihan:**
  1. Peta gambut Indonesia Kementan/BBSDLP (Anda et al. 2021, *Geoderma* 402:115235, ~13,4 Mha) [akses UNVERIFIED].
  2. PEATMAP global (Xu et al. 2018, *Catena*) sebagai fallback.
  3. Layer gambut di Global Nature Watch/GFW [UNVERIFIED].
- **Fungsi:** label setiap sel grid sebagai gambut / mineral (atau fraksi gambut) untuk stratifikasi kalibrasi (blok S5) dan uji hipotesis (V9).
- **Effort:** 2-3 jam. **Risiko:** format/akses. Selalu siapkan PEATMAP.

#### D6. Batas Kesatuan Hidrologis Gambut (KHG) — K1, K4 (★★★)
- **Apa:** unit pengelolaan ekosistem gambut nasional (penetapan KLHK; jumlah KHG sering disebut ~865) [UNVERIFIED].
- **Fungsi:** AOI siap pakai yang bermakna kebijakan; kalender per KHG.
- **Risiko:** shapefile publik belum dipastikan. **Fallback:** kabupaten + overlay peta gambut; atau digitasi kasar 3-5 KHG prioritas (Sebangau, Kahayan-Sebangau, Sungai Kampar, dll.) untuk demo, dengan label "batas indikatif".

#### D7. Batas administrasi (provinsi, kabupaten/kota) — **Inti**
- **Sumber:** geoBoundaries ADM1/ADM2 (514 kab/kota), GADM, atau BIG.
- **Fungsi:** preset AOI, agregat precompute, rapor provinsi.
- **Effort:** 1 jam.

#### D8. Indeks iklim ONI (ENSO) dan DMI (IOD) — K1, K4 (★★)
- **Sumber:** NOAA CPC (ONI/Niño3.4), NOAA PSL atau BoM (DMI). CSV kecil.
- **Fungsi:** baseline kondisional (S9), overlay kalender, aturan atribusi (A3).
- **Effort:** 30 menit.

#### D9. Curah hujan CHIRPS bulanan 0,05° (atau GPM IMERG) — K1, K4
- **Fungsi:** uji fisik Field 2016 (ambang ~4 mm/hari musim kering, blok V8), panel konteks kekeringan.
- **Jalur:** UCSB CHC atau Google Earth Engine (agregasi per provinsi/KHG).
- **Effort:** 2-3 jam.

#### D10. Drought Code GEFF-ERA5 (CEMS fire historical) — K4, opsional K1
- **Apa:** Drought Code (DC) dari Canadian FWI System, dirancang untuk lapisan organik dalam, sehingga paling masuk akal sebagai proxy kekeringan gambut.
- **Jalur:** CDS/EWDS (antrean bisa lama, mulai unduh di jam pertama) atau GEE community catalog.
- **Effort:** 2-4 jam (termasuk menunggu).

#### D11. Luas terbakar resmi SiPongi per provinsi per tahun — K1, K2 (★★★)
- **Apa:** angka resmi KLHK/Kemenhut. Angka nasional yang dikutip media: 2015 2.611.411 ha; 2017 165.484 ha; 2019 1.649.258 ha; 2023 1.161.193 ha [S].
- **Fungsi:** validasi independen (V6) dan panel "angka resmi vs harmonisasi" (X8).
- **Catatan:** metode berbeda, jadi gunakan **korelasi rank (Spearman)**, bukan kecocokan absolut. Cek apakah SiPongi sendiri memakai hotspot dalam metodenya (independensi) [UNVERIFIED].
- **Effort:** 1-3 jam (manual dari rekap atau endpoint).

#### D12. Hitungan hotspot harian resmi (SiPongi, BRIN) — K2 (★★★)
- **Apa:** angka yang dilaporkan lembaga, mis. SiPongi 21 Sep 2026: 22.293 hotspot/24 jam [S]; BRIN Agustus 2026: 9.587 hotspot confidence tinggi [S].
- **Jalur:** endpoint JSON SiPongi opsroom (`.../api/opsroom/indoHotspot`, ditemukan di repo `sipongi-pt-sls-monitor`) [izin pakai UNVERIFIED]; atau kutipan publikasi resmi/media dengan tanggal.
- **Fungsi:** rekonsiliasi angka antar-lembaga (konsep K2).
- **Risiko:** etika/izin pemakaian endpoint; sensitivitas lembaga. Bingkai sebagai **komplemen**.

#### D13. Burned area MCD64A1 C6.1 (dan VNP64A1) — K3, opsional K1
- **Fungsi:** referensi independen bulanan (V6), dengan catatan omisi tinggi di gambut (Vetrita 2021: produk kurang akurat hanya menangkap 38-48% BA).
- **Effort:** 3-4 jam (raster bulanan, agregasi).

#### D14. Data pendukung lain (opsional)
| Data | Fungsi | Effort |
|---|---|---|
| GFED5 | Referensi BA multi-sensor (tidak independen untuk gambut) | Sedang |
| MCD12Q1 (tutupan lahan tahunan) | Strata/kovariat L2 | Sedang |
| ERA5 total cloud cover | Proxy awan murah | Rendah-sedang |
| CAMS PM2.5 / ISPU | Konteks asap (bukan inti) | Sedang |
| Hansen/GFW tree cover loss | Konteks (bukan inti) | Sedang |
| Himawari-8/9 AHI | Bentuk siklus diurnal / cross-check | **Tinggi, hindari dalam 48 jam** |

### 3B. Blok FISIKA

#### P1. Model sub-piksel Planck (edukasi + intuisi) — K3 (widget), semua (narasi)
- **Rumus:**
  - Radiansi blackbody: `B_λ(T) = c1 / (λ⁵ · (exp(c2/(λT)) − 1))`, dengan `c1 = 1,191×10⁸ W µm⁴ m⁻² sr⁻¹`, `c2 = 14.388 µm·K`.
  - Campuran dua komponen: `L4 = p·B4(Tf) + (1−p)·B4(Tb)`, `L11 = p·B11(Tf) + (1−p)·B11(Tb)`, `p = A_fire / A_pix`.
  - Brightness temperature dari radiansi = invers Planck.
- **Contoh hasil (hitungan agen riset, blackbody, tanpa atmosfer):**

  | Sensor/posisi | A_pix (km²) | Api | ΔBT4 | ΔBT11 |
  |---|---|---|---|---|
  | MODIS nadir | 1,00 | 100 m², 1000 K | +10,3 K | +0,19 K |
  | MODIS tepi (55°) | 9,66 | 100 m², 1000 K | +1,2 K | +0,02 K |
  | VIIRS nadir | 0,14 | 100 m², 1000 K | +42,6 K | +1,33 K |
  | MODIS nadir | 1,00 | 1000 m², 600 K (gambut) | +9,1 K | +0,60 K |
  | VIIRS nadir | 0,14 | 1000 m², 600 K (gambut) | +39,0 K | +4,2 K |

- **Pesan:** api yang **sama** bisa jelas bagi VIIRS di nadir tetapi tak terlihat oleh MODIS di tepi swath (beda hampir dua orde besaran ΔBT4).
- **Output demo:** "kalkulator api sub-piksel": slider luas api, suhu, posisi scan → ΔBT4 MODIS vs VIIRS dan apakah melewati ambang (T4 > 360 K siang / 320 K malam untuk MODIS; I4 jenuh 367 K untuk VIIRS).
- **Effort:** 2-3 jam (widget frontend murni).
- **Nilai:** ★★ edukasi, sangat membantu menjawab juri BRIN ("kenapa VIIRS lebih banyak?").
- **Peringatan:** jangan melakukan retrieval suhu per piksel (Dozier) dari FIRMS; tidak stabil (Giglio & Kendall 2001).

#### P2. Geometri piksel per deteksi — **Inti**
- **Rumus luas piksel:** `A_pix ≈ scan × track` (km², langsung dari kolom FIRMS) [V].
- **MODIS (Ichoku & Kaufman 2005):** `S = Re·s·(cosθ/√((Re/r)² − sin²θ) − 1)`, `T = r·s·(cosθ − √((Re/r)² − sin²θ))`, `Re = 6378,137 km`, `h = 705 km`, `r = Re + h`, `s = 0,0014184397`. Luas 1 km² (nadir) → 9,66 km² (tepi 55°).
- **VIIRS I-band:** agregasi on-board 3:1 / 2:1 / 1:1; luas naik hanya ~4,5× (383×360 m → 795×784 m) [V].
- **Fungsi:** input untuk operator deteksi (P4), filter scan (P5), normalisasi luas (P8).
- **Effort:** 30 menit. **Nilai:** ★★ (jarang dimanfaatkan pesaing).

#### P3. FRP dan agregasinya — **Inti**
- **Rumus (Giglio 2016 Eq. 16, metode MIR Wooster 2003):** `FRP = (A_pix·σ / (τ4·a)) · (L4 − L̄4_bg)`, `σ = 5,6704×10⁻⁸`, `a = 3,0×10⁻⁹` (MODIS) [V].
- **Fakta yang mengubah cara pakai:**
  - FRP C6 ≈ 16% lebih rendah dari C5 → **jangan campur koleksi** [V].
  - Ketidakpastian FRP MODIS per piksel ≈ 26,6% (1σ), turun ke <~5% untuk agregat >~50 piksel (Freeborn 2014) → **analisis FRP selalu dalam agregat**.
  - **FRP VIIRS 375 m dihitung dari M13 (750 m) dan dibagi rata ke piksel 375 m yang berbagi M13** [V] → bandingkan **ΣFRP per sel/klaster**, bukan histogram per piksel.
  - Akurat ±12% hanya untuk emitter 665-1365 K; **underestimate di bawah ~650 K** (gambut membara; hitungan agen: −26% pada 600 K) [V untuk rentang, hitungan sendiri untuk angka].
- **Output:** ΣFRP per sel-hari-overpass, per sensor.

#### P4. Operator deteksi Sofiev & Kouznetsov 2026 ("VIIRS dilihat dengan mata MODIS") — K3, opsional K1 (★★★)
- **Sumber:** Sofiev & Kouznetsov 2026, *Geosci. Model Dev.* 19:10123-10142; kode terbuka `github.com/fmidev/FRP_OOp` [V untuk paper; koefisien UNVERIFIED].
- **Model:**
  - Probabilitas deteksi piksel dengan FRP `P` dan luas piksel `A`:
    `P_det(P, A) = max(0, σ(r(A)·(P − D_p(A))) − c0) / (1 − c0)`, dengan `σ(x) = 1/(1+e^(−x))`.
  - Titik tengah sigmoid **naik linear terhadap luas piksel**: `D_p(A) = α·A + β` (r > 0,999), koefisien terpisah sensor × siang/malam.
  - Kemiringan `r(A)` fungsi hiperbolik dari A.
  - Efek asap/awan tipis: `P* = P · exp(−τ4)`.
  - Koefisien hasil ekstraksi teks (**harus dicek ulang ke Tabel 1-2 / repo**): MODIS siang α≈4,44, β≈0,52; malam α≈4,43, β≈1,01; VIIRS siang α≈6,17, β≈1,44; malam α≈1,38, β≈0,35; c0 ≈ 0,045-0,05 [UNVERIFIED].
- **Angka ringkasan (Conclusions paper) [V]:** batas deteksi MODIS 5,7 MW (siang) / 3,7 MW (malam) di tengah swath, ~42/39 MW di tepi; VIIRS 3,7 MW (siang) / ~0,5-0,7 MW (malam). POD api kuat global: MODIS 78%, VIIRS 88%; di sebagian ekuator <30% / <40%.
- **Cara pakai untuk harmonisasi ("MODIS-equivalent VIIRS"):**
  1. Agregasi deteksi VIIRS ke sel ~1 km per overpass: `F_cell = Σ FRP_i` (aman karena FRP VIIRS fraksional).
  2. Ambil distribusi luas piksel MODIS `p(A)` dari deteksi Aqua di AOI yang sama (empiris dari `scan×track`).
  3. Hitung `E[N_MODIS-eq] = Σ_cells ∫ P_det^MODIS(F_cell, A) p(A) dA` (Monte Carlo ~100 sampel A).
  4. Ketidakpastian fisik: `Var = Σ P(1−P)`.
  5. Pisahkan siang/malam memakai koefisien masing-masing.
- **Kenapa sangat kuat di depan juri:** operator dikalibrasi **global oleh peneliti lain**, lalu kita uji **lokal** di Indonesia pada 2012-2021 terhadap hitungan Aqua aktual, **tanpa fitting**. Ini argumen out-of-sample yang bersih, dan paper-nya terbit 2026 (riset mutakhir).
- **Effort:** 8-10 jam (inti ~150 baris; waktu habis untuk verifikasi koefisien, kasus FRP=0/saturasi).
- **Risiko:** koefisien salah → hasil meleset. **Mitigasi:** validasi pada overlap; jika gagal, laporkan dan pakai P5 + S5 sebagai seri utama.

#### P5. Ambang FRP bersama ("common FRP floor") — K3, K1 (★★★)
- **Rasional:** di atas FRP tertentu, kedua sensor mendeteksi dengan probabilitas mendekati 1. Hitung hanya api di atas ambang itu, maka artefak resolusi hilang. Analog "magnitude of completeness" di katalog gempa.
- **Cara memilih F\*:** di periode overlap, plot `R(F) = N_VIIRS(≥F) / N_MODIS(≥F)` terhadap F (siang dan malam terpisah; VIIRS diagregasi ke sel 1 km; MODIS dibatasi scan ≤ ~40°, seperti Giglio 2006 membuang piksel >40° untuk FRP CMG). Titik di mana R mendatar mendekati 1 adalah F\*.
- **Output:** indeks "aktivitas api besar" yang hampir bebas seam.
- **Trade-off:** api kecil dan gambut membara terbuang. Sajikan sebagai **indeks pendamping**, bukan total aktivitas.
- **Effort:** 3-4 jam. **Demo:** satu grafik kurva R(F) yang turun lalu mendatar, sangat mudah dibaca juri.

#### P6. Model siklus harian (diurnal) dan koreksi drift orbit — K3, opsional K1 (★★★, belum dilakukan pesaing mana pun)
- **Fakta [V/S]:**
  - Puncak pembakaran tropis jatuh antara **13:00-18:30** waktu lokal (Giglio 2007, *RSE* 108:407), lebih awal di wilayah berhutan lebat.
  - Giglio 2007 memperingatkan bahwa **perubahan jam sampling menghasilkan tren palsu besar** (kasus AVHRR).
  - Terra bergeser ke pagi sejak ~2020; Aqua bergeser ke sore sejak ~2021-2022 (proyeksi ~15:30-15:45 pada 2026) [S].
- **Kunci praktis:** jam lintas aktual **bisa diukur langsung dari data FIRMS**: waktu matahari lokal `LST = UTC(acq_time) + lon/15`. Tidak perlu mengandalkan grafik NASA.
- **Model diurnal (Vermote 2009; Ellicott 2009):** `f(t) = b + exp(−(t − h)² / (2s²))`, dinormalisasi. Parameter `h` (jam puncak), `s` (lebar), `b` (dasar malam).
- **Kalibrasi parameter (pilih salah satu, urut kelayakan):**
  1. Nilai literatur untuk hutan tropis/Asia Tenggara (Giglio 2007; Vermote 2009) [cek nilai].
  2. Fit dari rasio Terra/Aqua jangka panjang 2003-2019 (dua titik siang + dua titik malam; underdetermined, perlu prior dari literatur).
  3. Himawari (hindari dalam 48 jam).
- **Koreksi:** `N_corr = N_obs(t_obs) · f(t_ref) / f(t_obs)`, `t_ref = 13:30`.
- **Uji prediksi drift (momen sains):** bandingkan rasio **teramati** Aqua/VIIRS 2022-2026 dengan rasio **prediksi** `f(t_Aqua(t)) / f(13:30)`. Jika kurva prediksi mengikuti penurunan/kenaikan rasio teramati, fisika diurnal terbukti dengan data independen.
- **Juga menyelesaikan:** seam Terra-only 2000-2002 (Terra 10:30 → setara 13:30).
- **Effort:** 5-8 jam. **Risiko:** parameter diurnal Indonesia tidak pasti; pakai sebagai **diagnostik + justifikasi kalibrasi 2012-2021**, bukan koreksi utama, jika hasilnya tidak stabil.

#### P7. Koreksi observation opportunity (overpass + awan) — K3, opsional K1/K4 (★★★)
- **Rumus resmi produk MODIS CMG (Giglio, Csiszar & Justice 2006, *JGR*) [V]:**
  - Koreksi overpass: `N' = N_fire · [N_eq · N_days(t) · A(i)/A_eq] / N_total(i,j,t)`.
  - Fraksi awan: `f_cloud = N_cloud / N_total`.
  - Koreksi awan + overpass: `N'' = N' / (1 − f_cloud)`.
- **Asumsi:** densitas api di bawah awan sama dengan di area cerah. Tidak realistis di bawah awan hujan → bisa overestimate. Giglio 2006 menemukan koreksi menaikkan hitungan ~20% tanpa mengubah musiman.
- **Peningkatan untuk Indonesia (disarankan Giglio 2006 sendiri):** bobot "awan tidak hujan" memakai CHIRPS/IMERG.
- **Untuk VIIRS:** pakai `f_cloud` Aqua sebagai proxy (selisih lintas <50 menit), atau VNP14A1 fire mask (kelas awan) jika sempat.
- **Satuan baru yang lebih jujur:** "deteksi per overpass bebas awan yang valid". Satuan ini otomatis menangani perubahan jumlah satelit.
- **Nilai khusus Indonesia:** asap tebal saat puncak bisa **menurunkan** hitungan (paradoks). Panel "bulan dengan observasi terbatas" mencegah salah baca.
- **Effort:** 4-6 jam. **Fallback minimal:** tidak mengoreksi, tetapi menandai sel-bulan dengan `f_cloud` tinggi sebagai "ketidakpastian tinggi".

#### P8. Normalisasi luas teramati — opsional K3
- **Rumus:** `ρ = N_fire / Σ A_observed` (deteksi per km² yang benar-benar teramati bebas awan).
- **Catatan:** `Σ A_pix` dari piksel api **bukan** normalisasi yang benar (makin dipengaruhi resolusi). Butuh fire mask L2/L3, jadi realistis hanya sebagai koreksi parsial bobot scan angle.
- **Effort:** sedang. **Prioritas:** rendah.

#### P9. Energi radiatif (ΣFRP / FRE) sebagai seri pendamping — K3, opsional semua (★★)
- **Rumus:** `FRE = ∫ FRP(t) dt`; dari 2-4 sampel/hari dengan model diurnal: `FRE_day ≈ FRP_obs(t_obs) · ∫f(t)dt / f(t_obs)`.
- **Konversi bahan bakar:** `0,368 ± 0,015 kg/MJ` (Wooster 2005) [V]. **Jangan** mengklaim karbon/emisi untuk gambut (FRP MIR bias rendah; Wooster 2018 untuk 2015 memakai FRP Himawari + emission factor lapangan: 358 Tg bahan bakar, 23-34% di bawah GFED4.1s/GFAS).
- **Label aman di UI:** "energi radiatif api (GJ)".
- **Nilai:** seam 2012 pada ΣFRP jauh lebih kecil daripada pada count (karena api besar mendominasi energi dan terlihat kedua sensor). Ini bukti visual harmonisasi yang murah.
- **Effort:** 2 jam (ΣFRP); 5 jam (FRE dengan diurnal).

#### P10. Fisika gambut sebagai hipotesis yang diuji — K1, K3 (★★★)
- **Dasar:**
  - Membara puncak ~600 °C di dalam lapisan; permukaan teramati lebih dingin [S].
  - Tidak padam malam hari; propagasi lambat tetapi persisten berminggu-minggu.
  - Atwood 2016: MODIS melewatkan front api gambut intensitas rendah di bawah asap tebal (Sebangau 2015).
  - Sofan 2020: VIIRS ~80% sesuai Landsat untuk api kecil, ~90% dengan buffer klaster + siang/malam.
  - Ambang malam VIIRS (~0,5-0,7 MW) jauh di bawah MODIS (3,7 MW).
- **Hipotesis:**
  - **H1:** rasio VIIRS:MODIS di gambut > di tanah mineral.
  - **H2:** rasio malam ≫ siang, paling besar di gambut.
  - **H3:** rasio berubah pada tahun asap berat (2015, 2019). Arah belum pasti.
- **Uji:** blok V9. **Jika terbukti:** temuan orisinal (belum ada rasio peer-reviewed khusus gambut). **Jika tidak:** laporkan hasil null; tetap bernilai Validity.

### 3C. Blok STATISTIK

#### S1. Fire cell-days (unit dasar) — **Inti**
- **Definisi:** snap setiap deteksi ke grid 0,01° (≈1,1 km, kira-kira piksel MODIS nadir); hitung **sel unik** per (tanggal lokal, satelit, siang/malam).
- **Fungsi:** menghapus duplikat (bow-tie, overlap orbit) dan meredam inflasi piksel kecil VIIRS.
- **Satuan tampil:** "fire cell-days setara Aqua-MODIS" atau "indeks aktivitas pembakaran". **Bukan** "jumlah kebakaran".
- **Catatan:** ukuran sel memengaruhi rasio (Li 2020). Uji sensitivitas 0,01° vs 0,05° (V7).

#### S2. Pemilihan satelit referensi dan rantai kalibrasi — **Inti**
- **Prinsip:** **satu satelit per peran per waktu; jangan menjumlahkan satelit** (jumlah satelit VIIRS berubah 1 → 2 → 3 → 2).
- **Jangkar:** Aqua MODIS (orbit 13:30 yang kontinu sejak Jul 2002; sama dengan desain VIIRS).
- **Rantai:**
  - Terra → Aqua: faktor dari Jul 2002-Des 2005 (untuk jembatan Nov 2000-Jun 2002).
  - S-NPP → Aqua: **kalibrasi hanya 2012-2021** (sebelum drift Aqua).
  - NOAA-20 → S-NPP: overlap Apr 2018-Okt 2026 (diharapkan ≈1; repo pesaing melaporkan 0,93-1,07).
  - NOAA-21 → NOAA-20 (bila dipakai).
- **Seri akhir:**

  | Periode | Sumber |
  |---|---|
  | Nov 2000 - Jun 2002 | Terra × r_T→A |
  | Jul 2002 - Des 2021 | Aqua native |
  | Jan 2022 - 2 Nov 2026 | S-NPP × k |
  | setelah 2 Nov 2026 | NOAA-20 × k × r_N20→SNPP |

  Aqua 2022-2026 (sudah drift) dipakai **hanya untuk validasi** (V4).

#### S3. Rasio jumlah (ratio of sums) per strata — **Inti**
- **Rumus:** `k_s = Σ Aqua_s / Σ VIIRS_s` untuk stratum `s = (wilayah, bulan atau musim, siang/malam [, gambut/mineral])` pada 2012-2021.
- **Kenapa ratio of sums, bukan mean of ratios:** stabil terhadap bulan dengan nilai kecil/nol.
- **Wilayah:** Sumatra, Kalimantan, Sulawesi, Papua, Jawa-Nusa Tenggara (opsional: provinsi).

#### S4. Shrinkage empiris Bayes gamma-Poisson (bentuk tertutup) — **Inti** (★★)
- **Model:** `Aqua_s ~ Poisson(κ_s · VIIRS_s)`, prior `κ_s ~ Gamma(a, b)`.
- **Posterior:** `κ_s | data ~ Gamma(a + ΣAqua_s, b + ΣVIIRS_s)`.
- **Mean posterior:** `κ̂_s = (a + ΣA_s) / (b + ΣV_s)`. Ini identik dengan rumus shrinkage `k̂ = (n·k_s + n0·k_parent)/(n + n0)` dengan `n = ΣV_s`, `n0 = b`, `k_parent = a/b`. Strata dengan data sedikit otomatis "ditarik" ke rasio induk.
- **Hyperparameter (a, b):** method of moments atau MLE marginal negative binomial lintas strata induk.
- **Interval:** kuantil Gamma memberi credible interval, **tetapi** Poisson mengabaikan overdispersi dan autokorelasi antar-tahun → interval terlalu sempit. **Laporkan interval dari bootstrap per tahun (S6)** sebagai interval utama.
- **Effort:** 1-2 jam. **Demo:** forest plot κ per provinsi dengan CI; provinsi dengan data sedikit menyusut ke rata-rata.

#### S5. Model hierarkis NegBin dengan efek fisik yang bisa ditafsir — K1, K3 (★★★)
- **Model (PyMC/bambi atau GLM sederhana):**
  `log E[A_rmdy] = log E[V_rmdy] + μ + u_region + v_month + w_daynight + γ·peat + δ·log(f_clear) + …`
  dengan likelihood Negative Binomial (overdispersi), efek acak `u ~ N(0, σ_u)`.
- **Koefisien yang bisa diceritakan:** `γ` = efek gambut terhadap rasio, `w` = efek siang/malam. Contoh format kalimat (angka **belum dihitung**): "rasio di gambut X kali lebih tinggi daripada mineral [CI …]".
- **Alternatif cepat tanpa PyMC:** GLM NegBin dengan offset `log V` (statsmodels) + bootstrap per tahun.
- **Effort:** 3-6 jam.

#### S6. Bootstrap per tahun (block bootstrap) — **Inti**
- **Cara:** resample **tahun** (bukan sel-hari) dengan pengembalian dari 2012-2021, hitung ulang k, ulangi 1.000×. Interval 90% dari persentil 5-95.
- **Kenapa per tahun:** autokorelasi dalam tahun dan antar-musim; bootstrap sel-hari akan terlalu optimistis.

#### S7. Conformal prediction untuk interval dengan jaminan coverage — K3, opsional K1 (★★)
- **Metode:** split conformal / Conformalized Quantile Regression (CQR); **Mondrian** per strata gambut/mineral agar coverage benar di tiap strata; untuk deret waktu: EnbPI/ACI (MAPIE `MapieTimeSeriesRegressor`).
- **Yang ditampilkan:** coverage empiris per strata, mis. "interval 90% mencakup X% bulan uji" (angka dari data).
- **Effort:** 3-4 jam (perlu sedikit kode custom).

#### S8. Statistik anomali — **Inti**
- **Baseline:** median per bulan-kalender, periode eksplisit (usulan: 2003-2022, era Terra+Aqua penuh, sebelum drift parah; tampilkan sebagai parameter).
- **Metrik (tampilkan tiga, pilih satu sebagai utama):**
  - **Percentile rank** terhadap distribusi historis bulan yang sama. Paling aman untuk data banyak nol, paling mudah dikomunikasikan ("tertinggi sejak 2001").
  - Rasio log: `A = log((x + 1) / (median + 1))`.
  - Robust z: `z = (x − median) / (1,4826 · MAD)` (Leys et al. 2013). Jangan dipakai untuk AOI kecil yang banyak nol.
- **Hitung baseline di dalam fold** saat validasi (hindari leakage).
- **Kenapa median, bukan mean:** robust terhadap 1997/2015; GWIS dan EFFIS memakai mean, jadi ini pembeda kecil yang bisa dijelaskan.

#### S9. Baseline kondisional ENSO/IOD ("normal untuk tahun El Niño") — K1, K4 (★★★)
- **Rasional:** musim besar Indonesia mengikuti El Niño + IOD positif (Field 2009; Pan 2018). Membandingkan 2026 dengan median semua tahun mencampur tahun basah dan kering. Pertanyaan operasional yang lebih tajam: **"Apakah musim ini lebih buruk dari tahun-tahun El Niño sebelumnya?"**
- **Definisi fase (usulan, cek ulang ke data resmi):**
  - El Niño: ONI rata-rata Jul-Sep (atau Agu-Okt) ≥ +0,5.
  - IOD positif: DMI rata-rata Sep-Nov ≥ +0,4.
  - Kelas: "El Niño + IOD+", "El Niño saja", "IOD+ saja", "netral", "La Niña".
- **Baseline analog:** `B_E(m) = median { H(y, m) : y ∈ Y_E }`, dengan `Y_E` = tahun dalam kelas yang sama sebelum tahun berjalan.
- **Tampilan:** **peringkat di antara tahun analog**, mis. "Sep 2026: peringkat 1 dari N tahun El Niño sejak 2001" (N kecil, jadi pakai peringkat, bukan persentil halus).
- **Daftar tahun kandidat** (wajib diverifikasi dengan ONI/DMI resmi): El Niño sekitar 2002, 2004, 2006, 2009, 2015, 2018-19 (lemah), 2023, 2026; IOD+ kuat sekitar 2006, 2015, 2019, 2023 [UNVERIFIED].
- **Risiko:** sampel kecil → interval lebar. Tampilkan jujur.
- **Effort:** 2-3 jam. **Demo:** satu kalimat yang langsung dipahami BPBD.

#### S10. Uji tren Theil-Sen + Mann-Kendall termodifikasi — K3, opsional
- **Rumus:** `β = median((x_j − x_i)/(t_j − t_i))` (Sen 1968); Mann-Kendall dengan koreksi autokorelasi (Hamed & Rao 1998).
- **Pada:** total musim (Jul-Nov) atau anomali tahunan; juga **setelah meregresikan Niño3.4/DMI** (seri Indonesia didominasi ENSO).
- **Pesan:** slope raw (M0) vs harmonized. Hasil aktual harus dihitung; jangan diasumsikan.

#### S11. Mask sumber statis untuk NRT — **Inti**
- **Masalah:** NRT tidak punya `type`. Tanpa mask, smelter nikel (Sulawesi/Maluku Utara), flare migas (Riau/Kaltim), PLTU, dan gunung api muncul sebagai "api sepanjang tahun".
- **Cara:** dari arsip SP 2012-2025, tandai sel 0,01° di mana deteksi `type ∈ {1,2,3}` muncul pada ≥ N hari (atau mayoritas deteksi bertipe ≠0); terapkan ke NRT. Tambahan opsional: klaster persisten (Franklin et al. 2025).
- **Effort:** 1-2 jam.

#### S12. Event-based counting (klaster ruang-waktu) — opsional K3
- **Cara:** ST-DBSCAN dengan eps ruang ~1,5-2 km (sama dalam km untuk kedua sensor) dan eps waktu 1-2 hari, atau connected components grid 1 km harian.
- **Demo:** rasio VIIRS:MODIS per piksel vs per event (diharapkan jauh lebih dekat ke 1 pada level event; harus dihitung).
- **Catatan gambut:** event bertahan berminggu-minggu; uji sensitivitas eps waktu.

### 3D. Blok VALIDASI

| ID | Uji | Cara | Yang dibuktikan | Effort | Status pesaing |
|---|---|---|---|---|---|
| **V1** | **LOYO / leave-one-fire-season-out** | Kalibrasi tanpa tahun y, prediksi Aqua tahun y dari VIIRS·k, 2012-2021. Sorot 2015 dan 2019 | k stabil untuk tahun yang tidak dilihat | 2 jam | Umum |
| **V2** | **LORO (leave-one-region-out)** | Tahan satu wilayah/provinsi | Transfer antar wilayah | 1-2 jam | Jarang |
| **V3** | **Seam test pada seri rasio vs referensi** | `z_t = log(H_t) − log(R_t)` dengan R = Aqua-only atau MCD64A1; Pettitt (`p ≈ 2·exp(−6K²/(n³+n²))`) + PELT (`ruptures`) di semua seam nyata (2002, 2012, 2018, 2020-22, 2023, 2026) + **placebo seams**. Metrik: `Δ_seam = mean(z)_12bln sesudah − mean(z)_12bln sebelum` ± CI block bootstrap | Seam hilang secara statistik, bukan hanya "terlihat mulus" | 2-3 jam | Fire Harmony punya placebo; **seri rasio vs referensi + daftar seam lengkap** belum |
| **V4** | **Uji drift 2022-2026** | Aqua drift vs S-NPP·k; dan prediksi diurnal (P6) vs rasio teramati | Efek drift terukur dan dijelaskan fisika | 2 jam (+P6) | **Belum ada** |
| **V5** | **"Simulated MODIS sunset" backtest** | Kalibrasi 2012-2016 (atau 2012-2018), rekonstruksi 2017-2021 dari VIIRS saja, bandingkan dengan Aqua aktual | Valid setelah MODIS mati | 1-2 jam | Kiln Watch (denial test) |
| **V6** | **Validasi independen Indonesia** | Spearman ρ antara H tahunan (nasional + provinsi) dan **luas terbakar SiPongi** 2015-2025; opsional MCD64A1/GFED5 | Konsisten dengan data resmi | 2-3 jam | **Belum ada** |
| **V7** | **Sensitivitas** | Variasi filter confidence (semua / n+h / h), ukuran grid (0,01° vs 0,05°), strata, baseline | Hasil tidak rapuh | 2 jam | Sebagian |
| **V8** | **Uji fisik respons kekeringan (Field 2016)** | Kurva aktivitas api vs curah hujan musim kering (Ags-Okt) untuk 2003-2011 vs 2012-2025; fit eksponensial/piecewise masing-masing; parameter harus berimpit setelah harmonisasi, tidak berimpit untuk raw | Harmonisasi menjaga hubungan fisik | 2-3 jam | **Belum ada** |
| **V9** | **Uji hipotesis gambut (H1-H3)** | Rasio per {gambut, mineral} × {siang, malam} × {El Niño, normal} pada 2012-2021, CI bootstrap per tahun | Temuan lokal orisinal (atau hasil null yang jujur) | 2-3 jam | **Belum ada** |
| **V10** | **Kesepakatan flag anomali** | Bulan "di atas p90" menurut Aqua asli vs menurut VIIRS·k (2012-2021); F1 dan Cohen's κ | Harmonisasi menjaga **keputusan** pengguna, bukan hanya angka | 1 jam | **Belum ada** |
| **V11** | **Backtest early warning** | Aturan sederhana (mis. "anomali persentil ≥90 di Juli + hujan 90 hari <4 mm/hari") diuji apakah menandai musim besar sebelum puncak September, 2003-2025 | Kegunaan operasional | 2-3 jam | Kiln Watch mengakui belum |
| **V12** | **Ranking tahun ekstrem terjaga** | Spearman peringkat total tahunan; top-k overlap tahun ekstrem; korelasi Niño3.4/DMI | Variabilitas antar-tahun tidak rusak | 1 jam | Sebagian |

**Metrik standar (semua uji overlap):** Pearson r (log1p), Spearman ρ, bias % `Σ(sim−obs)/Σobs`, RMSE log, **KGE** `1 − √((r−1)² + (α−1)² + (β−1)²)` dengan `α = σ_sim/σ_obs`, `β = μ_sim/μ_obs` (Gupta 2009), coverage interval.

**Aturan anti-kebocoran:** jangan random K-fold sel-hari; hitung median/baseline di dalam fold; jangan pakai fitur "tahun" yang membocorkan masa depan.

### 3E. Blok AI (setir, bukan mesin)

#### A1. Query bahasa alami → JSON → pipeline deterministik — K1, K4
- **Alur:** pengguna mengetik "kalender karhutla KHG Sungai Kampar 2015-2025 dibanding median" → LLM hanya mengisi skema JSON `{aoi:{type,name}, start, end, sensor_mode, baseline, metric}` → resolver gazetteer lokal (fuzzy match) → **chip hasil parsing yang bisa diedit** → eksekusi oleh pipeline biasa.
- **Fallback:** form dropdown yang sama (demo tetap jalan tanpa LLM).
- **Effort:** 4-5 jam.

#### A2. Brief siaga Bahasa Indonesia dengan verifier angka — K4, opsional K1/K2 (★★)
- **Pola "facts-first, LLM-second, verifier-last":**
  1. Kode menghitung fact table JSON (nilai AOI, median, persentil, peringkat analog El Niño, hujan 90 hari vs 4 mm/hari, ONI/DMI, interval, flag kualitas data).
  2. LLM menulis paragraf dengan **placeholder** (`{{nilai_sep_2026}}`), bukan angka.
  3. Kode mengisi angka.
  4. **Verifier:** ekstrak semua angka di teks final (format Indonesia: titik ribuan, koma desimal, "persen"); setiap angka harus ada di fact table (toleransi pembulatan); jika gagal 2×, pakai **template murni**.
  5. Kosakata terkendali: "titik panas/hotspot" (bukan "titik api"), "konsisten dengan" (bukan "disebabkan oleh"), selalu ada kalimat keterbatasan.
- **Output:** teks siap tempel ke laporan BPBD, PDF satu halaman, atau pesan WhatsApp.
- **Effort:** 5-6 jam.

#### A3. Penjelas anomali berbasis aturan — K1, K4
- **Aturan deterministik berbasis literatur**, contoh:
  - hujan 90 hari < 4 mm/hari **dan** ONI ≥ +0,5 → "konsisten dengan pola kekeringan El Niño (Field et al. 2016)";
  - lonjakan bertepatan dengan tanggal pergantian/drift sensor → "kemungkinan artefak sensor; lihat penanda";
  - `f_cloud` tinggi → "observasi terbatas; nilai mungkin terlalu rendah".
- LLM hanya memverbalkan aturan yang terpicu, dengan **daftar sitasi tetap**.
- **Effort:** 3 jam (versi aturan dulu, verbalisasi LLM belakangan).

#### A4. Suite evaluasi AI — wajib jika memakai A1/A2/A3
| Uji | Cara | Target |
|---|---|---|
| Parsing NL → JSON | 40-60 query (formal, singkatan "Kalteng", typo, campur Inggris) | Exact-match AOI + rentang ≥ 90% |
| Konsistensi angka | Verifier pada 100 brief | 0 angka tak terlacak |
| Groundedness | Setiap kalimat kausal → aturan yang terpicu | 100% |
| Robustness | Query di luar cakupan | Menolak dengan sopan |
- **Effort:** 2-3 jam. **Nilai:** mengubah AI dari gimmick menjadi komponen yang diuji (tidak ada pesaing yang melaporkan eval AI).

#### A5. QA data berbasis aturan (bukan LLM) — **Inti**
- `/api/missing_data/` dan `/api/data_availability/` → hari kosong per sensor.
- Change-point per sensor (CUSUM/Pettitt sederhana) dicocokkan dengan tanggal event sensor yang diketahui.
- Output: **banner "kesehatan data"** dan anotasi di kalender.
- **Effort:** 2 jam.

#### A6. Yang dihindari
Chatbot bebas sebagai fitur utama · LLM yang menulis angka · multi-agent LLM untuk ingestion · "AI memprediksi kebakaran" tanpa skill score · persona/avatar · foundation model burn-scar (Prithvi) · backcast VIIRS-equivalent pra-2012 yang disajikan seperti observasi.

**Pengakuan AI (wajib):** setiap kode/data yang dibuat dengan bantuan AI diakui di teks deskripsi dan metadata; gambar/video buatan AI diberi watermark; branding NASA tidak dipakai di konten buatan AI.

### 3F. Blok PRODUK / UX

| ID | Komponen | Deskripsi | Pertanyaan pengguna yang dijawab | Effort | Konsep |
|---|---|---|---|---|---|
| **X1** | **Kalender tahun × bulan** | Baris 2001-2026, kolom Jan-Des; warna = nilai (viridis/cividis, skala log) atau anomali (PuOr/RdBu colorblind-safe); angka di sel; **glyph ketidakpastian** (titik/garis tipis untuk interval lebar); tooltip nilai + interval + sensor sumber | "Bulan apa paling rawan? Tahun apa paling parah?" | 4-6 jam | Inti |
| **X2** | **Anotasi seam** | Garis vertikal/penanda di kalender pada 2002, 2012, 2018, 2020-22, 2023, 2 Nov 2026; klik → penjelasan | "Apakah lompatan ini nyata?" | 1-2 jam | Inti |
| **X3** | **Toggle raw ↔ harmonized dengan animasi** | Transisi sel dari nilai mentah ke harmonisasi; lompatan 2012 "hilang di depan mata" | Momen wow lokal | 2-3 jam | Inti |
| **X4** | **Panel "Seberapa yakin kami"** | Tabel ringkas V1/V3/V5/V6 + coverage + daftar keterbatasan | Validity yang terlihat | 2-3 jam | Inti |
| **X5** | **AOI** | Preset provinsi/kabupaten/**KHG**/taman nasional; gambar poligon; input lat/lon + radius | Challenge mewajibkan | 3-4 jam | Inti |
| **X6** | **Kartu "bulan ini vs sejarah"** | Nilai bulan berjalan, median, persentil, peringkat; plus peringkat di antara tahun analog El Niño (S9) | "Apakah ini lebih buruk dari biasanya?" | 2 jam | Inti + K1/K4 |
| **X7** | **Pembanding tahun analog** | Garis musiman 2026 vs 2015, 2019, 2023 (atau tahun analog lain) dalam skala yang sama | "Lebih buruk dari 2015?" | 2 jam | K1, K4 |
| **X8** | **Panel "angka resmi vs harmonisasi"** | SiPongi BA/hotspot dan BRIN berdampingan dengan seri harmonisasi; tombol (i) menjelaskan perbedaan sensor/filter/unit | "Kenapa angkanya beda-beda?" | 3-4 jam | K2, opsional K1 |
| **X9** | **Slider "VIIRS dilihat dengan mata MODIS"** | Peta titik VIIRS dengan opacity = P_det (P4); kurva sigmoid interaktif per scan angle, siang/malam | Fisika yang terlihat | 3-4 jam | K3 |
| **X10** | **Kalkulator api sub-piksel** | Widget P1 | Edukasi juri/pengguna | 2-3 jam | K3, opsional |
| **X11** | **Grafik drift orbit** | Jam lintas Terra/Aqua (dari `acq_time`) vs waktu, ditumpuk dengan rasio teramati vs prediksi diurnal | "Seam tersembunyi" | 2-3 jam | K3 |
| **X12** | **Panel konteks kekeringan** | Hujan 30/90 hari vs garis 4 mm/hari, ONI, DMI, Drought Code | "Apakah kondisi mendukung musim besar?" | 3-4 jam | K4, opsional K1 |
| **X13** | **Unduh CSV terdokumentasi** | Kolom: `region, year, month, A_raw, T_raw, V_raw, sensor_used, k, k_lo, k_hi, H, H_lo, H_hi, baseline_median, anomaly_ratio, robust_z, pct_rank, enso_class, analog_rank, flags`; header metadata (versi data, filter, baseline, tanggal unduh, hash) | Challenge meminta CSV | 1-2 jam | Inti |
| **X14** | **Ekspor format operator** | Mis. format groundcheck SiPongi+ (pola repo Titik Api) atau ringkasan per kabupaten | Langsung dipakai lapangan | 2 jam | K2, K4 |
| **X15** | **Brief siaga** | Output A2 sebagai PDF 1 halaman / teks WhatsApp | "Apa yang harus saya laporkan besok?" | (A2) | K4 |
| **X16** | **Kartu shareable** | "Kalender karhutla kabupatenmu 2001-2026" + OG image | Jangkauan publik, People's Choice | 2-3 jam | Opsional |
| **X17** | **Banner kesehatan data** | Output A5 | Kepercayaan | 1 jam | Inti |
| **X18** | **Bilingual ID/EN** | Default Bahasa Indonesia, toggle EN (juri global wajib EN) | Aksesibilitas | 2 jam | Inti |
| **X19** | **Halaman metodologi** | Rumus, keputusan, sumber, keterbatasan, pengakuan AI | Juri global | 3 jam | Inti |
| **X20** | **Mode lapisan "lihat per sensor"** | Kalender MODIS asli / VIIRS asli / harmonisasi berdampingan | Transparansi | 1 jam | Inti |

**Aksesibilitas wajib:** colormap colorblind-safe (viridis/cividis/YlOrRd; divergen PuOr/RdBu/BrBG), hindari rainbow/jet (Crameri 2020), angka di sel (tidak hanya warna), navigasi keyboard, kontras cukup.

### 3G. Blok ENGINEERING

| ID | Komponen | Pilihan | Alasan | Effort |
|---|---|---|---|---|
| E1 | Penyimpanan & komputasi | **DuckDB + Parquet/GeoParquet** (ekstensi `spatial`, komunitas `h3`) | Jutaan baris di laptop, SQL cepat | Rendah |
| E2 | Grid | 0,01° untuk cell-days; **0,25°** untuk model/kovariat (selaras ERA5/GEFF/CMG); H3 hanya untuk tampilan | Join kovariat trivial | Rendah |
| E3 | Precompute | `daily_cell`, `monthly_aoi` (provinsi, kab/kota, KHG), `baseline`, `harmonized` + interval, `validation_results`, `data_health` | Kalender instan | Sedang |
| E4 | Frontend | Kalender: **ECharts** atau **Observable Plot**; peta: **MapLibre GL JS + PMTiles** + deck.gl | Statis, cepat | Sedang |
| E5 | AOI bebas | **duckdb-wasm** membaca Parquet via HTTP range request | Tanpa backend berat | Sedang |
| E6 | Hosting | Static host (GitHub Pages/Cloudflare Pages/Netlify) + satu backend tipis (FastAPI di Render/Fly/HF Spaces) **hanya untuk LLM** | Offline-first, demo andal | Rendah |
| E7 | Keandalan | Cache respons LLM demo, fallback template, **video cadangan**, snapshot data di repo | Pitch live 21 Nov | Rendah |
| E8 | Reproducibility | Perintah build bertahap (data → model → site), versi data + hash di footer, notebook validasi | Validity + juri global | Rendah |
| E9 | Keamanan | MAP_KEY dan kunci LLM di env var hosting, tidak di repo (pesaing tercatat membocorkan token) | Higiene | Rendah |
| E10 | CORS | Proxy kecil untuk NRT di browser (CSV FIRMS tidak kirim header CORS) | Lapisan live | Rendah |

### 3H. Teknologi dan teknik dari repo tim lain yang bisa dipinjam

Repo pesaing bersifat publik, jadi teknologi dan tekniknya bisa dipelajari dan sebagian dipakai ulang. Ada tiga aturan main:

1. **Lisensi menentukan apa yang boleh disalin.** Repo tanpa lisensi berarti *all rights reserved*: kodenya tidak boleh disalin, tetapi tekniknya (ide, metode, desain uji) boleh dipelajari dan diimplementasikan ulang dengan sitasi. Repo MIT/Apache boleh dipakai ulang dengan atribusi (Apache-2.0 juga mewajibkan menyertakan NOTICE/LICENSE). GPL-3.0 menular: memakai kodenya berarti repo kita juga GPL.
2. **Deklarasi submission mewajibkan semua resource eksternal (kode, teks, gambar, termasuk open source) dicantumkan di References.** Setiap teknik yang dipinjam masuk daftar referensi.
3. **Jangan meminjam inti sains pesaing.** Menyalin harmonisasi tim lain di challenge yang sama menurunkan skor Creativity, dan kode mereka banyak yang dibuat sebelum event. Pinjam **infrastruktur, pola UX, dan desain uji**, lalu bangun inti sains sendiri.

Status lisensi dicek via GitHub API pada 13 Nov 2026. "Tidak ada" berarti field lisensi kosong.

| Sumber | Lisensi | Yang layak dipinjam | Cara pakai yang aman | Dipakai di |
|---|---|---|---|---|
| **portolan-mirrors/firms-catalog** | Apache-2.0 | Mirror GeoParquet seluruh arsip FIRMS 2000-sekarang; query bbox remote dengan DuckDB | **Pakai langsung sebagai sumber data cadangan/utama**, dengan atribusi. Verifikasi silang beberapa bulan terhadap CSV FIRMS resmi | D1 |
| **fmidev/FRP_OOp** (kode paper Sofiev & Kouznetsov 2026) | **GPL-3.0** | Operator deteksi MODIS/VIIRS (P4) | Pilihan A (disarankan): **implementasi ulang dari persamaan paper** (rumus tidak dilindungi hak cipta) dan sitasi paper. Pilihan B: pakai kodenya dan lisensikan repo kita GPL-3.0. Repo tetap boleh dibaca untuk memverifikasi koefisien | P4 |
| **Warren-530/fire-harmony** | Apache-2.0 | Pola stack **DuckDB-WASM membaca Parquet via HTTP + MapLibre + deck.gl + Observable Plot**; desain uji seam/placebo/Pettitt/PELT; mask statis (GIHS); pemakaian PEATMAP | Pakai pola arsitektur frontend (boleh mengadaptasi kode infrastruktur dengan atribusi + NOTICE). **Jangan** menyalin model LightGBM per hexagon | E4, E5, V3 |
| **the-aris-club/flare-chronos** | MIT | Rekonstruksi footprint dari scan angle; penentuan siang/malam via sudut zenit matahari (<85°); normalisasi upaya observasi Ω(tahun, lintang); PDF brief dengan WeasyPrint; alokasi fraksional ke H3 | Teknik footprint dan Ω sebagai referensi implementasi P2/P8; WeasyPrint untuk PDF brief (X15). Atribusi MIT | P2, P8, X15 |
| **tttamannaanand/burn-calendar** | MIT | Quantile mapping mingguan; definisi "musim kebakaran" (minggu ≥50% puncak); state URL yang bisa dibagikan; navigasi keyboard; tema gelap/terang | Pola UX kalender (URL state, keyboard, tema). Quantile mapping sebagai **pembanding ablation** (M2b) | X1, X16, §13.3 |
| **squadronzero/project-shift** | Apache-2.0 | Ikatan NOAA-20→S-NPP (rasio tahunan 0,97-1,07); no-data mask; "aturan ditetapkan sebelum run" (pra-registrasi); faktor per tile + bootstrap | Desain pra-registrasi uji (tulis aturan uji sebelum melihat hasil) dan pola no-data mask. Atribusi | S2, V-semua, D3 |
| Aalvee-Aarham/kiln-watch | **Tidak ada** | Desain **MODIS-denial test**; rasio per bulan × siang/malam dengan empirical Bayes; rantai kalibrasi dengan error chain-closure; stitching inverse-variance; observing opportunity per satelit | **Teknik saja**, implementasi ulang sendiri, sitasi sebagai inspirasi. Jangan salin kode | V5, S2, S4 |
| EdisonShiny/eg-firetrack | **Tidak ada** | Pemetaan aturan respons ke yurisdiksi (BPBD, Manggala Agni, BNPB); modifier tindakan gambut (sekat kanal, injeksi air) | Ide saja; susun sendiri dari dokumen resmi Indonesia | A2, X15 |
| mdhabibullah.../Icarus | **Tidak ada** | Eksperimen pra-registrasi E1-E9; shrinkage κ; aturan coverage | Desain uji saja | V-semua |
| Repo karhutla Indonesia (pantau-karhutla, titik-api, karhutla-watch, visualize-karhutla) | Belum dicek | Panel "angka resmi vs kita" + tombol (i) metodologi; format ekspor groundcheck SiPongi+; snapshot data di repo sebagai fallback demo; kartu "Wrapped" per kabupaten | Pola UX/ide saja kecuali lisensi dicek dan mengizinkan | X8, X14, E7, X16 |

**Pustaka open source yang dipakai langsung** (lisensi permisif, cantumkan di References; verifikasi lisensi saat instalasi):
DuckDB (MIT) · duckdb-wasm (MIT) · MapLibre GL JS (BSD-3) · PMTiles (BSD-3) · deck.gl (MIT) · Apache ECharts (Apache-2.0) atau Observable Plot (ISC) · pandas/numpy/scipy (BSD) · statsmodels (BSD-3) · ruptures (BSD-2) · pymannkendall (MIT) · MAPIE (BSD-3) · PyMC/bambi (Apache-2.0/MIT) · rapidfuzz (MIT) · WeasyPrint (BSD-3) · FastAPI (MIT).

**Kombinasi "terbaik dari semua" yang dirakit di konsep final (§7):**

| Dari | Yang diambil | Yang kita tambahkan di atasnya |
|---|---|---|
| Kiln Watch | Uji denial (MODIS dimatikan) + rasio siang/malam + shrinkage | Kalibrasi **dibatasi 2012-2021** (sebelum drift) + strata **gambut** + validasi SiPongi |
| Fire Harmony | Stack DuckDB-WASM/MapLibre/deck.gl/Plot + seam/placebo | Uji seam pada **seri rasio vs referensi** di **semua** seam, termasuk drift |
| flare-chronos | Geometri scan/footprint, Ω, PDF brief | **Operator deteksi Sofiev** (bukan rekonstruksi footprint) + koreksi **diurnal/drift** |
| burn-calendar | UX kalender (URL state, keyboard, tema) + quantile mapping | Baseline **kondisional ENSO** + glyph ketidakpastian |
| project-shift | Pra-registrasi aturan uji + rantai NOAA-20 | **Uji fisik Field 2016** + uji transfer global |
| EG FireTrack | Gagasan playbook respons ke lembaga | Brief Bahasa Indonesia dengan **verifier angka** + sumber aturan resmi |
| Pantau Karhutla | Angka resmi vs angka kita | Penjelasan selisih berbasis sensor/filter, dibingkai sebagai komplemen |
| firms-catalog | Akses arsip cloud-native | Snapshot offline Indonesia untuk demo |

---

## 4. Pemetaan blok → celah → pesaing yang dilampaui

Celah G1-G12 berasal dari [07](07-gap-analysis-dan-usp.md). Kolom terakhir menunjukkan pesaing terkuat yang **belum** punya kemampuan tersebut (berdasarkan README mereka).

| Celah | Blok yang menutupnya | Bukti yang ditampilkan | Pesaing kuat yang belum punya |
|---|---|---|---|
| G1 Indonesia dari sisi Indonesia | D6, D7, D11, D12, X5, X18, A2 | Kalender per KHG/kabupaten, Bahasa Indonesia, pengguna BPBD/Manggala Agni | Kiln Watch, Fire Harmony, flare-chronos. EG FireTrack punya playbook Borneo, tetapi historinya baru dari 2017 dan tanpa validasi publik |
| G2 Kalibrasi gambut vs mineral | D5, S3-S5, P10, V9 | Forest plot rasio gambut vs mineral × siang/malam dengan CI | **Semua** (Fire Harmony memakai gambut hanya sebagai fitur ML) |
| G3 Validasi vs SiPongi | D11, V6, X4 | Spearman tahunan nasional + provinsi | **Semua** |
| G4 Rekonsiliasi angka resmi | D12, X8, P2, S1 | Penjelasan kuantitatif selisih SiPongi/BRIN/FIRMS | **Semua** |
| G5 Drift orbit + diurnal | P6, V4, X11 | Rasio teramati vs prediksi diurnal 2022-2026 | **Semua** |
| G6 Unit KHG + Bahasa Indonesia | D6, X5, X18 | Preset KHG | **Semua** |
| G7 Baseline kondisional ENSO | D8, S9, X6, X7 | "Peringkat ke-n dari N tahun El Niño" | **Semua** (Fire Harmony hanya memakainya sebagai driver) |
| G8 Koreksi awan per piksel | D4, P7 | Hitungan terkoreksi + flag observasi terbatas | Semua (Kiln Watch hanya per satelit) |
| G9 Ambang FRP / operator fisika | P4, P5, X9 | Kurva R(F); validasi operator tanpa fitting | Semua (flare-chronos memakai footprint, bukan operator deteksi) |
| G10 AI terukur | A1-A4 | Tabel eval (exact-match, 0 angka tak terlacak) | Semua (MCP Kiln Watch dan SITREP IGNIS tanpa eval) |
| G11 Backtest early warning | V11, X12 | Hit rate aturan peringatan 2003-2025 | Semua (Kiln Watch mengakui belum) |
| G12 Himawari | (future work) | — | — |
| **Skalabilitas global (P11)** | §7.8 uji transfer, strata berbasis rezim api, data global | Hasil pipeline yang sama di 1-2 wilayah non-Indonesia | Pesaing global (Kiln Watch, Fire Harmony) sudah global. **Pembeda kita: global *dan* tervalidasi lokal secara mendalam** |

**Cek cepat:** blok yang tidak menutup celah apa pun (globe 3D, chatbot bebas, forecast LightGBM) **sengaja tidak dimasukkan** ke pustaka, karena hanya menyamai pesaing.

---

## 5. Empat konsep alternatif (contoh rakitan; rekomendasi final di §7)

Keempat konsep memakai **inti bersama** yang sama (§7): D1-D3, D7, P2-P3, S1-S4, S6, S8, S11, V1, V3, V5, A5, X1-X5, X13, X17-X20, E1-E10. Perbedaannya ada di **lapisan pembeda** dan **cerita**.

Nama konsep di bawah adalah **label kerja deskriptif**, bukan nama proyek. Nama, tagline, dan kalimat masalah final dirumuskan tim.

### 5.1 Konsep K1 — "Kalender Karhutla yang Adil": sejarah lintas sensor yang sadar gambut dan El Niño

**Pertanyaan pengguna:** *"Apakah musim karhutla tahun ini di KHG/kabupaten saya lebih buruk dari tahun-tahun El Niño sebelumnya, kalau perbedaan satelit sudah dikoreksi dan gambut diperhitungkan?"*

**Pengguna utama:**
- BPBD provinsi/kabupaten, untuk keputusan status siaga.
- BRGM/pengelola KHG, untuk prioritas pembasahan.
- Manggala Agni, untuk penempatan regu.

**Masalah dari pohon §2:** M1 + M3 + M4 (+ M5).

**Blok pembeda:**

| Lapisan | Blok |
|---|---|
| Data | D5 peta gambut, D6 KHG, D8 ONI/DMI, D9 CHIRPS, D11 SiPongi BA |
| Sains | S5 model hierarkis dengan efek gambut dan siang/malam, S9 baseline kondisional ENSO, P10 hipotesis gambut, opsional P5 FRP floor |
| Validasi | V6 SiPongi, V8 uji fisik Field 2016, V9 hipotesis gambut, V10 kesepakatan flag, V12 ranking ENSO |
| UX | X6 kartu bulan ini, X7 pembanding analog (2026 vs 2015/2019/2023), X12 konteks kekeringan (versi ringan), A3 penjelas anomali berbasis aturan |
| AI (opsional) | A2 brief siaga dengan verifier |

**Momen sains (maksimal 3):**
1. **Grafik gambut vs mineral × siang/malam** (rasio VIIRS:MODIS dengan CI). Pesannya: "di gambut MODIS lebih buta, terutama malam hari", jika H1/H2 terbukti.
2. **Kalender sebelum/sesudah**: lompatan 2012 hilang, dibuktikan dengan seam test.
3. **Kurva Field 2016** (api vs hujan musim kering) yang berimpit sebelum dan sesudah 2012 setelah harmonisasi.

**Momen wow demo (lokal), berurutan:**
1. Pilih "KHG Sebangau".
2. Tampilkan kalender 2001-2026.
3. Toggle raw ↔ harmonized: lompatan 2012 hilang.
4. Kartu: "September 2026: peringkat 1 dari N tahun El Niño sejak 2001".
5. Pembanding garis 2026 vs 2015 vs 2019.
6. Unduh CSV/brief.

**Skalabilitas global (P11):**
- Strata "gambut" diambil dari PEATMAP global. Gambut juga ada di Siberia, Kanada, Cekungan Kongo, dan Amazon Peru.
- Baseline kondisional bisa memakai indeks iklim regional lain: ENSO untuk Australia dan Amazon, IOD untuk Afrika Timur.
- **Uji transfer:** jalankan pipeline yang sama tanpa mengubah kode di satu wilayah non-Indonesia, misalnya Amazon Peru/Brasil (gambut tropis + sinyal ENSO).

**Risiko:**
- Hipotesis gambut bisa tidak terbukti. Laporkan hasil null; cerita tetap jalan lewat baseline ENSO.
- Batas KHG bisa tidak tersedia. Fallback: kabupaten + overlay gambut.
- Tahun analog El Niño sedikit. Pakai peringkat dan tampilkan interval.

**Pesaing terdekat:** Fire Harmony (PEATMAP + driver ONI/DMI) dan EG FireTrack (Borneo + gambut). Pembeda K1:
- gambut sebagai strata kalibrasi yang diuji, bukan fitur ML;
- baseline kondisional ENSO, bukan sekadar driver;
- validasi terhadap SiPongi;
- unit KHG dan Bahasa Indonesia;
- cakupan Sumatra + Kalimantan.

### 5.2 Konsep K2 — "Satu Skala untuk Angka Hotspot Indonesia": rekonsiliasi lintas lembaga

**Pertanyaan pengguna:** *"Kenapa SiPongi, BRIN, dan FIRMS memberi angka hotspot yang berbeda, dan berapa angka yang konsisten dari tahun ke tahun?"*

**Pengguna utama:** pemda/BPBD yang membaca beberapa sumber, jurnalis data, publik, peneliti. Secara tidak langsung juga lembaga resmi itu sendiri.

**Masalah dari pohon §2:** M2 + M1.

**Blok pembeda:**

| Lapisan | Blok |
|---|---|
| Data | D11 SiPongi BA, D12 hitungan hotspot resmi (SiPongi, BRIN), D3 missing data |
| Sains | **Dekomposisi selisih** (lihat di bawah) |
| Validasi | V6, V7 (sensitivitas confidence), V10 |
| UX | X8 panel angka resmi vs harmonisasi (fitur utama), X14 ekspor format operator, A2 brief (opsional) |

Dekomposisi selisih menghitung seberapa besar bagian selisih yang dijelaskan oleh masing-masing faktor:
- (a) pilihan sensor;
- (b) filter confidence;
- (c) unit hitung (deteksi vs sel unik);
- (d) mask sumber statis;
- (e) jumlah satelit aktif.

Caranya: mulai dari FIRMS mentah, lalu nyalakan faktor-faktor itu satu per satu.

**Momen sains:** **diagram air terjun (waterfall)** untuk satu hari tertentu (mis. 21 Sep 2026). Urutannya: FIRMS mentah → +filter confidence → +mask statis → +sel unik → +satu satelit → harmonisasi. Juri bisa melihat setiap langkah.

**Momen wow demo:**
1. "Tiga lembaga, tiga angka, satu hari yang sama."
2. Waterfall yang menjelaskan selisihnya.
3. Kalender 2001-2026 dalam satu skala: "inilah yang bisa dibandingkan dari tahun ke tahun".

**Skalabilitas global:** masalah "angka resmi berbeda karena sensor/filter berbeda" ada di banyak negara. Contoh dari riset: GWIS vs FIRMS, dan ASMC yang berpindah dari S-NPP ke NOAA-20 di tengah seri. Metode dekomposisinya bebas-wilayah.

**Risiko:**
- **Sensitivitas institusional tinggi**, karena juri lokal bermitra dengan BRIN. Bingkai sebagai *"membantu menjelaskan dan menyambungkan"*, bukan "mengoreksi" lembaga.
- Akses dan izin data harian resmi (endpoint SiPongi) belum jelas.
- Validity bergantung pada filter persis yang dipakai lembaga. Sebagian belum terverifikasi, misalnya pemetaan VIIRS l/n/h di SiPongi.
- Sains harmonisasinya lebih tipis dari K1/K3, sehingga Best Use of Science lebih sulit.

**Pesaing terdekat:** tidak ada. Pantau Karhutla (bukan Space Apps) menampilkan angka resmi berdampingan, tetapi tanpa dekomposisi sensor.

### 5.3 Konsep K3 — "Harmonisasi yang Dimulai dari Fisika Sensor"

**Pertanyaan pengguna:** *"Bagaimana kita tahu catatan api 2000-sekarang benar-benar konsisten, termasuk setelah MODIS mati, dan bukan sekadar dikalikan rasio?"*

**Pengguna utama:** ilmuwan, lembaga data (BRIN, BMKG), pengelola data jangka panjang. Indonesia menjadi studi kasus utama.

**Masalah dari pohon §2:** M1 (semua seam, termasuk drift) + M3.

**Blok pembeda:**

| Lapisan | Blok |
|---|---|
| Data | D4 MODIS CMG (awan), D5 peta gambut, D13 MCD64A1 |
| Fisika | **P4 operator deteksi Sofiev 2026**, **P5 FRP floor**, **P6 diurnal + drift**, **P7 koreksi awan/overpass**, P9 energi radiatif, P10 gambut, P1 kalkulator sub-piksel |
| Statistik | S5 hierarkis, S7 conformal, S10 tren, opsional S12 event-based |
| Validasi | **Tabel ablation M0-M5** (§13.3) dengan V1-V5, V8, V12 |
| UX | X9 slider "VIIRS dilihat dengan mata MODIS", X10 kalkulator, X11 grafik drift, X4 panel validasi lengkap |

**Momen sains (pilih 3 dari 5):**
1. **Operator Sofiev divalidasi tanpa fitting** terhadap Aqua 2012-2021 di Indonesia.
2. **Kurva FRP floor** R(F) yang mendatar.
3. **Drift orbit:** rasio teramati vs prediksi diurnal 2022-2026.
4. **Tabel ablation M0-M5:** raw → rasio → Bayesian → +awan/diurnal → fisika.
5. **Kalkulator sub-piksel** sebagai jembatan untuk juri non-fisika.

**Momen wow demo:**
1. Geser slider "lihat VIIRS dengan mata MODIS": titik VIIRS memudar sesuai probabilitas deteksi MODIS.
2. Hitungan ekuivalen muncul dan cocok dengan Aqua.
3. Kalender tanpa seam.
4. Grafik drift: "seam yang tidak dilihat orang lain".

**Skalabilitas global:** paling tinggi di antara keempat konsep. Operator deteksi dan model diurnal sudah global, dan seluruh pipeline bebas-wilayah. Indonesia adalah kasus uji tersulit (awan, asap, gambut), sehingga argumennya: "kalau berhasil di sini, berhasil di mana saja".

**Risiko:**
- **Paling berat**, dengan risiko scope creep seperti Fire Harmony.
- Sulit dijelaskan dalam 30 detik, dan cerita lokalnya lebih lemah, sehingga peluang Local Impact turun.
- Koefisien operator harus diverifikasi, dan parameter diurnal untuk Indonesia belum pasti.
- Bersaing langsung dengan Fire Harmony dan flare-chronos di arena sains.

### 5.4 Konsep K4 — "Dari Kalender ke Kesiagaan": sejarah harmonisasi sebagai peringatan dini musiman

**Pertanyaan pengguna:** *"Berdasarkan sejarah 25 tahun dan kondisi kekeringan sekarang, perlukah kesiagaan dinaikkan bulan depan di wilayah ini, dan apa yang harus dilaporkan?"*

**Pengguna utama:** BPBD, Manggala Agni, BNPB, kepala daerah.

**Masalah dari pohon §2:** M5 + M4 (+ M1 sebagai fondasi).

**Blok pembeda:**

| Lapisan | Blok |
|---|---|
| Data | D8 ONI/DMI, D9 CHIRPS, D10 Drought Code, D6/D7 AOI |
| Sains | S9 baseline kondisional, aturan peringatan berbasis literatur (ambang 4 mm/hari Field 2016), opsional outlook klimatologis |
| Validasi | **V11 backtest early warning** (fitur utama), V8, V10 |
| UX | X12 panel kekeringan, X6/X7, **X15 brief siaga**, X14 ekspor, A1 query bahasa alami, A2 brief dengan verifier, A3 penjelas anomali, A4 eval |

**Momen sains:** backtest aturan peringatan 2003-2025, dalam format "aturan ini akan menandai X dari Y musim besar sebelum September, dengan Z alarm palsu" (angka dari data).

**Momen wow demo:**
1. Ketik "Kalteng Agustus 2026".
2. Kalender + panel kekeringan muncul.
3. Status: "di atas persentil 90 + hujan di bawah 4 mm/hari + El Niño".
4. Klik "Buat brief siaga": PDF/WhatsApp Bahasa Indonesia yang setiap angkanya bertanda "terverifikasi".

**Skalabilitas global:** aturan berbasis hubungan hujan-api berlaku di banyak wilayah tropis (dengan ambang berbeda per wilayah), dan indeks iklim regional bisa ditukar.

**Risiko:**
- Bergeser dari inti challenge (kalender harmonisasi) ke peringatan dini. **Juri bisa menurunkan nilai Relevance** jika harmonisasi tidak tetap terlihat sebagai fondasi.
- Pesaing sudah membawa forecast (LightGBM, EG FireTrack 72 jam, IGNIS). Hindari bersaing di model.
- Backtest dengan sampel musim yang kecil menghasilkan interval lebar.
- Jika eval tidak ditampilkan, AI yang dominan berisiko dianggap gimmick (pola Bloomee).

### 5.5 Penilaian konsep

Skor 1-5 adalah **penilaian kualitatif berdasarkan riset**, bukan prediksi hasil lomba. Tim sebaiknya menilai ulang sendiri.

| Kriteria | Bobot usulan | K1 Adil (gambut + ENSO) | K2 Satu Skala (rekonsiliasi) | K3 Fisika Sensor | K4 Kesiagaan |
|---|---|---|---|---|---|
| Impact (resmi) | 1 | 5 | 4 | 4 | 5 |
| Creativity (resmi) | 1 | 4 | 5 | 4 | 3 |
| Validity (resmi, termasuk usability) | 1 | 4 | 3 | 5 | 3 |
| Relevance (resmi, data NASA inti) | 1 | 5 | 4 | 5 | 3 |
| Presentation (resmi, 30 detik) | 1 | 5 | 4 | 3 | 5 |
| Keunikan vs 43 pesaing | 0,5 | 5 | 5 | 3 | 3 |
| Kelayakan 48 jam | 0,5 | 4 | 3 | 2 | 3 |
| Skalabilitas global (P11) | 0,5 | 4 | 3 | 5 | 4 |
| Risiko institusional (5 = rendah) | 0,5 | 5 | 2 | 5 | 4 |
| Kecocokan dengan juri lokal BRIN | 0,5 | 5 | 3 | 4 | 4 |
| **Skor tertimbang (maks 37,5)** | | **34,5** | **28,0** | **30,5** | **28,0** |

Cara membaca:
- **K1** paling seimbang dan paling mirip pola pemenang Local Impact (QUEÑARIS, G.R.O.W.), dengan inti ilmiah yang baru.
- **K3** terkuat secara sains dan skalabilitas, tetapi paling berat dan paling sulit dipitch.
- **K2** paling orisinal, tetapi berisiko secara institusional di depan juri BRIN.
- **K4** paling mudah dipahami pengguna, tetapi berisiko bergeser dari inti challenge.

Karena tim menargetkan juara global dengan prinsip "lokal dalam cerita, global dalam metode", kombinasi yang menggabungkan cerita K1 dengan lapisan fisika K3 (pola H1/H2 di bawah) patut dipertimbangkan dengan serius. Keputusan tetap di tangan tim.

### 5.6 Pola hibrida

Konsep-konsep di atas tidak saling meniadakan. Proyek yang kuat umumnya punya **satu cerita utama + satu lapisan sains pembeda + satu output operasional**:

| Pola | Cerita utama | Lapisan sains | Output operasional | Catatan |
|---|---|---|---|---|
| H1 | K1 (adil, gambut, ENSO) | 2 momen dari K3 (FRP floor + drift) | Brief K4 (dengan verifier) | Sains kuat tanpa membebani cerita |
| H2 | K1 | Operator Sofiev K3 sebagai validasi silang (bukan seri utama) | Kartu "bulan ini vs El Niño" | Risikonya paling seimbang |
| H3 | K3 | Gambut K1 sebagai studi kasus | Panel validasi | Target Best Use of Science |
| H4 | K4 | Baseline K1 | Brief + ekspor | Target Local Impact operasional |
| H5 | K1 | Panel kecil "kenapa angka berbeda" dari K2 (tanpa dekomposisi penuh) | CSV + brief | Menyentuh M2 tanpa risiko besar |

**Aturan praktis:** apa pun pilihannya, video 30 detik hanya boleh memuat **satu** pertanyaan pengguna dan **satu** momen sains. Sisanya ditaruh di project page dan dokumen metodologi.

---

## 6. Panduan keputusan tim

Rekomendasi final ada di §7. Pertanyaan berikut tetap berguna untuk **menguji atau menyesuaikan** rekomendasi itu bersama tim pada kickoff 14 Nov. Urutannya disusun supaya keputusan awal mengunci keputusan berikutnya. Jawaban yang dipakai §7 ditandai di kolom terakhir.

### 6.1 Tujuh pertanyaan keputusan

| # | Pertanyaan | Pilihan yang tersedia dari riset | Dampak | Dipakai di §7 |
|---|---|---|---|---|
| Q1 | **Siapa pengguna utama?** | BPBD · Manggala Agni · BRGM/pengelola KHG · peneliti/lembaga data · publik/jurnalis | Menentukan konsep dan bahasa UI | BPBD + pengelola KHG + Manggala Agni |
| Q2 | **Keputusan apa yang dibantu?** | Status siaga · penempatan regu · prioritas pembasahan · evaluasi kebijakan jangka panjang · transparansi publik | Menentukan layar utama | Status siaga (utama), pembasahan, patroli |
| Q3 | **Lapis masalah mana yang membuka pitch?** | M1 seam · M2 angka berbeda · M3 gambut · M4 El Niño · M5 data tak sampai | Menentukan kalimat pembuka | M1 + M3 ("five hidden seams" + gambut) |
| Q4 | **Wilayah fokus demo?** | Kalteng (Sebangau) · Riau (Kampar) · Sumsel · Jambi · Kalbar · nasional | Menentukan data yang perlu disiapkan. Sumatra belum disentuh pesaing | Kalteng + Riau (Kalimantan & Sumatra) |
| Q5 | **Satu momen sains di video 30 detik?** | Lompatan 2012 hilang · gambut vs mineral · drift orbit · VIIRS dilihat dengan mata MODIS · analog El Niño | Inti presentasi | Lompatan 2012 hilang + gambut malam |
| Q6 | **Seberapa ambisius sainsnya?** | Paket minimum · pembeda · maksimal ([06 §8](06-pendekatan-teknis-lanjutan.md)) | Rencana 48 jam | Pembeda (P0+P1), maksimal sebagai P2 |
| Q7 | **Apa peran AI?** | Tidak ada · query bahasa alami · brief terverifikasi · penjelas anomali | Effort + pengakuan SI | Brief terverifikasi + penjelas berbasis aturan |
| Q8 | **Wilayah mana untuk uji transfer global?** | Amazon (gambut tropis + ENSO) · Punjab (pertanian, banyak pesaing) · Australia utara (savana) · Siberia/Kanada (gambut boreal) | Bukti skalabilitas (P11) | Amazon barat |

### 6.2 Pohon keputusan sederhana

```
Q1 pengguna utama?
├── BPBD / Manggala Agni ──► Q2 = status siaga / penempatan
│       ├── ingin sains kuat? ── ya ──► K1 (+ brief K4)            [pola H1/H2]
│       └──────────────────────── tidak ─► K4 (+ baseline K1)       [pola H4]
├── BRGM / pengelola KHG ──► K1 dengan KHG sebagai unit utama        [pola H1]
├── Peneliti / lembaga data ──► K3 (+ gambut K1 sebagai kasus)       [pola H3]
└── Publik / jurnalis ──► K2 (atau K1 + panel kecil K2)               [pola H5]
```

### 6.3 Tes 30 detik (lakukan sebelum mulai coding)

Setiap anggota tim menulis tiga kalimat, tanpa melihat jawaban yang lain:
1. Masalahnya.
2. Pengguna dan keputusannya.
3. Apa yang kami lakukan berbeda.

Jika jawaban antar anggota tidak saling mirip, konsepnya belum cukup tajam. Ulangi diskusi.

### 6.4 Tes "juri BRIN"

Untuk konsep yang dipilih, tim harus bisa menjawab pertanyaan berikut tanpa ragu:
- "Kenapa tidak cukup VIIRS saja?"
- "Confidence berapa yang dipakai, dan kenapa?"
- "Bagaimana dengan awan dan asap?"
- "Bagaimana kalian tahu hasilnya benar?"
- "Apakah ini bisa dipakai di luar Indonesia?"

Jika ada yang belum bisa dijawab, blok validasi terkait (§3D) atau uji transfer (§7.8) wajib masuk scope.

---

## 7. Rekomendasi ide final (PRD)

> ### Amandemen PRD pasca-audit (14 Nov 2026, 09:35 WIB)
> Sumber: [13-audit-produk.md](13-audit-produk.md) (audit produk vs pola pemenang 2025) dan hasil nyata di [validation_report.md](validation_report.md), [physics_results.md](physics_results.md), [peat_results.md](peat_results.md). Bila bertentangan dengan isi §7 di bawah, **amandemen ini yang berlaku**.
>
> **A1. Positioning: dari "platform" ke "satu temuan".**
> - Kategori utama: **Best Use of Science** (pola SpaceGenes+: satu temuan spesifik dari data NASA).
> - Cadangan: Best Use of Data (drift orbit terukur), lalu Local Impact (butuh bukti praktisi).
> - Kalimat pertama di semua materi = **masalah + tempat + pengguna + pertanyaan**. Contoh: *"Indonesia's fire record spans five satellites; when they change, the record lies, and agencies in Riau and Central Kalimantan compare El Niño seasons on the wrong scale."*
> - Kata yang dihindari di headline: *platform, monitoring, predict*.
>
> **A2. Temuan utama (dihitung resmi oleh FND-01, lihat [finding.md](finding.md); masih PRELIMINARY sampai SUB-07).**
> - **Koreksi:** kandidat F1 dari audit ("2023 tampak 1,7× lebih besar dari 2015 di data mentah") **tidak didukung**. Di catatan mentah, 2015 dan 2023 sama-sama berasal dari era S-NPP, jadi rasionya sama di kedua skala (mentah 0,31×, harmonisasi 0,33× [0,31-0,35]). F1 tidak dipakai.
> - **Temuan headline (F2):** menyambung langsung MODIS (s.d. 2011) dengan VIIRS S-NPP (sejak 2012) menghasilkan tren **naik** aktivitas titik panas Indonesia 2001-2025 (Theil-Sen +1.740 sel-hari/tahun). Pada skala adil setara Aqua-MODIS trennya **turun** (−1.614 sel-hari/tahun). Kenaikan yang tampak sepenuhnya artefak sensor. Arahnya juga terbalik di Kalimantan (+420 → −688). Di Sumatra tren mentah datar (+34) dan harmonisasi turun (−699). Dukungan independen: seam test 2012-01, raw Δ = 1,519 (gagal) vs harmonisasi Δ = −0,057 (lulus). Interval slope belum dihitung (FND-04). Tidak ada klaim penyebab.
> - **Pendukung:** 2026 s.d. Oktober (NRT, provisional) ≈ 0,71× musim 2015 pada skala adil, dan Kalimantan Ags-Okt 0,79×. Tetapi 2023 dan 2026 bergantung pada era S-NPP·κ yang seam test 2022-01-nya **gagal**, jadi wajib diberi catatan.
> - **F3 (metode):** orbit Aqua lewat ~69 menit lebih sore pada 2025 dan Terra ~73 menit lebih pagi (diukur dari data), jadi kalibrasi dihentikan di 2021.
> - **F4 (gambut, hasil nyata VAL-09):** H1 ditolak. Di malam hari keunggulan VIIRS atas MODIS justru lebih kecil di gambut (ρ 7,9 vs 13,7 di mineral). H2 diterima (ρ malam ≈ 2× siang di gambut). Dilaporkan apa adanya sebagai temuan pendukung.
> - **F5 (2026):** hanya ditampilkan di aplikasi dengan label *provisional (NRT)*. Tidak menjadi headline.
>
> **A3. Struktur produk yang ditonjolkan (urutan layar).**
> 1. **Before vs after** (baru, FND-03): seri naif vs dijumlahkan vs adil 2003-2026 + kalimat temuan + satu angka validasi. Ini layar pembuka aplikasi dan inti video.
> 2. **Kalender** (sudah dibangun): bukti pendukung, dengan AOI provinsi bernama (FND-02).
> 3. **Seberapa yakin kami** (disederhanakan): tabel validasi pra-registrasi **termasuk yang gagal**: LORO gagal di 3 wilayah, seam 2022-01 gagal, sunset kalah dari κ global, dan baseline sederhana M1/M2 yang menang di beberapa uji.
> 4. Unduh CSV + metodologi.
>
> Layar lain (Bulan ini/spaghetti, Kenapa?, prioritas KHG, kalender kesiagaan, agen analis, brief PDF/WhatsApp) **tetap boleh ada tetapi tidak ditonjolkan** di video maupun project page.
>
> **A4. Scope cut.** Dibekukan: operator Sofiev (PHY-04/05), slider "mata MODIS", mode gelap, uji transfer Amazon (EXT), AOI bebas penuh (diganti provinsi tetap), analisis konsesi/putusan pengadilan (sensitif hukum). Istilah "kalender kesiagaan" diganti "frekuensi historis pada kondisi ENSO serupa" (backtest hit rate 0,39, tidak boleh diklaim sebagai prediksi).
>
> **A5. Wajib untuk juri yang hanya membaca page.**
> - Dataset persis dan versinya.
> - Diagram metode.
> - Tabel validasi M0-M3 dengan tautan ke commit pra-registrasi.
> - Gambar before/after.
> - Keterbatasan.
> - Pernyataan AI.
> - Sitasi.
> - Demo publik yang hidup sampai Jan 2027 (PG-02).
> - Tag rilis `submission-2026-11-15` (PG-03).
>
> **A6. Perubahan metrik keberhasilan (§7.13).** Tambahkan: "F1 dihitung ulang oleh pipeline dengan interval dan konsisten di ≥4 dari 6 wilayah" dan "semua uji yang gagal tampil di app dan page". Hapus target yang bergantung pada fitur yang dibekukan.

> Konsep ini adalah rakitan **pola H1/H2** dari §5.6: cerita K1 (adil, gambut, El Niño) + lapisan fisika K3 (FRP floor, drift orbit, operator deteksi sebagai validasi silang) + output operasional K4 (brief siaga terverifikasi) + panel kecil K2 (kenapa angka berbeda).
> Prinsipnya **lokal dalam cerita, global dalam metode** (P11).
> Semua angka hasil ditulis sebagai `[hasil]` dan baru diisi dari data selama hackathon. **Jangan memakai angka ilustratif di pitch.**

### 7.1 Ringkasan satu halaman

| Elemen | Isi |
|---|---|
| **Nama** | **Second Sight** (ditulis dua kata; slug repo/URL: `second-sight`) |
| **Makna nama** | "Second sight" dalam bahasa Inggris berarti kemampuan melihat yang tersembunyi. Ada tiga lapis makna yang sengaja dipilih: (1) **mata kedua**: VIIRS sebagai penglihatan kedua setelah MODIS, dan aplikasi ini menyatukan keduanya; (2) **melihat yang luput**: api gambut membara, api malam, dan api di bawah asap yang tidak terlihat MODIS; (3) **melihat ulang sejarah**: 25 tahun catatan api dibaca ulang dengan skala yang jujur |
| **Pola nama** | Mengikuti pola nama pemenang global sebelumnya: dua kata Inggris yang langsung membangun gambaran (Storm Prophet 2023, SkySense 2025, WaterWise 2024). Sengaja menghindari kata yang sudah jenuh di challenge ini (Fire, Ember, Flare, Pyro, Chrono, Sync, Harmony, Lens, Atlas) |
| **Tagline utama (EN)** | *"Seeing the fires MODIS missed."* |
| **Tagline alternatif (EN)** | *"25 years of fire history, one honest scale."* · *"Fire history, seen twice, told once."* |
| **Tagline (ID)** | *"Melihat api yang luput dari satelit."* · *"Sejarah karhutla 25 tahun dalam satu skala yang jujur."* |
| **Masalah** | Pengelola karhutla Indonesia tidak punya sejarah kebakaran yang konsisten. Setiap pergantian satelit (2002, 2012, 2018, drift orbit 2020-an, berhentinya S-NPP 2 Nov 2026, berakhirnya MODIS 2026-27) menciptakan lompatan palsu. Gambut, yang menyumbang mayoritas api di tahun-tahun terburuk, paling sering luput dari MODIS. Angka resmi antar-lembaga pun berbeda |
| **Solusi** | Web app yang mengubah 25 tahun deteksi MODIS dan VIIRS menjadi **satu kalender aktivitas pembakaran 2001-sekarang dalam skala setara Aqua-MODIS**, dikalibrasi **terpisah untuk gambut vs tanah mineral dan siang vs malam**, dengan **interval ketidakpastian** di setiap sel, perbandingan terhadap **median historis dan terhadap tahun-tahun El Niño sebelumnya**, dan **brief siaga Bahasa Indonesia yang setiap angkanya terverifikasi otomatis** |
| **Pengguna utama** | BPBD provinsi/kabupaten (keputusan status siaga), pengelola KHG/BRGM (prioritas pembasahan gambut), Manggala Agni (penempatan regu) |
| **Pengguna sekunder** | Peneliti/lembaga data (BRIN, BMKG, universitas), jurnalis data, pengguna global (pipeline bebas-wilayah) |
| **Data NASA inti** | FIRMS MODIS C6.1 (Terra, Aqua) dan VIIRS 375 m C2 (S-NPP, NOAA-20, NOAA-21), MODIS CMG (awan), MCD64A1 (validasi) |
| **Why now** | S-NPP berhenti di FIRMS **2 Nov 2026**; MODIS berakhir **akhir 2026-2027**; orbit Terra/Aqua sudah drift; Indonesia mengalami musim karhutla 2026 yang sangat besar saat El Niño kuat |
| **Kebaruan** | (1) kalibrasi **berstrata gambut** dan siang/malam yang diuji sebagai hipotesis; (2) **kalibrasi dibatasi 2012-2021** karena drift orbit, dan drift dibuktikan dengan model diurnal; (3) **ambang FRP fisik bersama** dan **operator deteksi Sofiev 2026** sebagai validasi silang tanpa fitting; (4) **baseline kondisional El Niño**; (5) validasi terhadap **angka resmi SiPongi**; (6) **brief dengan verifier angka** dan eval set |
| **Bukti** | Seam test (Pettitt/PELT + placebo) di semua sambungan, LOYO/LORO, "MODIS sunset" backtest, uji fisik Field 2016, korelasi SiPongi, uji transfer ke wilayah non-Indonesia |
| **Output yang dibawa pulang** | CSV terdokumentasi, kalender PNG/SVG, brief siaga PDF/WhatsApp, kartu kabupaten |

### 7.2 Pernyataan masalah dan bukti

**Satu kalimat (pitch):**
> *"When satellites change, fire history lies. Indonesia's fire record has five hidden seams, and its worst fires, the smouldering peat that MODIS barely sees, are exactly where the lie is biggest."*

**Versi Indonesia:**
> *"Setiap kali satelit berganti, sejarah kebakaran ikut 'berbohong'. Catatan karhutla Indonesia punya lima sambungan tersembunyi, dan kebohongan terbesarnya justru ada di gambut yang membara, tempat MODIS hampir buta."*

**Bukti pendukung (dari riset, dengan status):**

| Klaim | Bukti | Status |
|---|---|---|
| Rasio VIIRS:MODIS ~2× sampai >25× dan tidak konstan | Vadrevu & Lasko 2018; Fu 2020; user guide VIIRS (Mekong 27×) | [V]/[S] |
| Batas deteksi MODIS 5,7/3,7 MW vs VIIRS 3,7/0,5-0,7 MW | Sofiev & Kouznetsov 2026 | [V] |
| Orbit Terra/Aqua drift sejak ~2020-2022 | Giglio 2025 (grafik NASA HQ), halaman misi | [S] |
| Perubahan jam sampling menciptakan tren palsu | Giglio 2007 | [S] |
| S-NPP berhenti di FIRMS 2 Nov 2026 | Blog & FAQ FIRMS | [V] |
| 53% api 2015 di gambut yang 12% lahan | Miettinen 2017 via Kiely 2019 | [S] |
| MODIS melewatkan front api gambut di bawah asap | Atwood 2016 | [S] |
| SiPongi campur sensor; BRIN VIIRS saja; GNW VIIRS sejak 2012 | Benchmark platform | [V]/[S] |
| Musim besar mengikuti El Niño + IOD+ | Field 2009; Pan 2018 | [S] |
| Musim 2026 sangat besar (>96.000 hotspot sampai 27 Jul; 22.293 dalam 24 jam pada 21 Sep) | Mongabay, Databoks | [S] media |

**Lima sambungan (seam) yang ditangani** (dipakai di narasi "five hidden seams"):

| # | Seam | Tanggal | Penanganan di Second Sight |
|---|---|---|---|
| 1 | Terra-only → Terra+Aqua | Jul 2002 | Jembatan Terra→Aqua (faktor 2002-2005) |
| 2 | Masuknya VIIRS S-NPP | Jan 2012 | Kalibrasi VIIRS→Aqua berstrata |
| 3 | Bertambahnya satelit VIIRS | 2018 (NOAA-20), 2023 (NOAA-21) | Satu satelit per waktu; rantai NOAA-20→S-NPP |
| 4 | **Drift orbit Terra/Aqua** | ~2020-2022+ | **Kalibrasi hanya 2012-2021**; drift dibuktikan dengan model diurnal; Aqua 2022+ hanya untuk validasi |
| 5 | Berhentinya S-NPP + akhir MODIS | 2 Nov 2026; 2026-27 | NOAA-20 sebagai penerus; "MODIS sunset" backtest |

### 7.3 Persona dan kebutuhan

Persona adalah **peran gabungan**, bukan orang nyata. Validasi dengan wawancara singkat selama hackathon jika memungkinkan.

#### Persona 1 — Kepala Pelaksana BPBD Provinsi (Kalteng/Riau)
- **Tugas:** mengusulkan penetapan status siaga darurat karhutla ke gubernur; mengalokasikan posko dan anggaran.
- **Sumber info saat ini:** SiPongi harian, BMKG (SPARTAN/FDRS), rapat koordinasi, laporan lapangan.
- **Rasa sakit:** angka hotspot berbeda antar sumber; tidak ada pembanding sejarah yang adil; laporan ditulis manual.
- **Pertanyaan kunci:** "Apakah bulan ini lebih buruk dari biasanya, dan lebih buruk dari El Niño sebelumnya?"
- **Keberhasilan:** dalam <2 menit mendapat jawaban + brief yang bisa diteruskan.

#### Persona 2 — Pengelola KHG / staf restorasi gambut
- **Tugas:** memprioritaskan pembasahan (sekat kanal, sumur bor) sebelum musim kering.
- **Pertanyaan kunci:** "KHG mana yang paling sering terbakar di tahun kering, dan kapan biasanya mulai?"
- **Keberhasilan:** peringkat KHG berdasarkan aktivitas tahun El Niño + bulan mulai musim.

#### Persona 3 — Komandan regu Manggala Agni Daops
- **Tugas:** penempatan patroli per bulan.
- **Pertanyaan kunci:** "Minggu/bulan mana di wilayah saya yang secara historis paling aktif, termasuk malam hari?"
- **Keberhasilan:** kalender wilayah + pola siang/malam + CSV.

#### Persona 4 — Peneliti (BRIN/universitas) dan pengguna global
- **Tugas:** analisis tren jangka panjang tanpa bias sensor.
- **Pertanyaan kunci:** "Bagaimana kalian mengharmonisasi, seberapa yakin, dan bisakah saya pakai di wilayah lain?"
- **Keberhasilan:** metodologi terbuka, CSV dengan interval, notebook validasi, uji transfer.

#### User stories (format: sebagai … saya ingin … agar …)

| ID | Persona | Cerita | Prioritas |
|---|---|---|---|
| US1 | BPBD | Sebagai Kalak BPBD, saya ingin memilih provinsi/kabupaten/KHG dan langsung melihat kalender 2001-sekarang, agar tahu bulan apa yang paling rawan | P0 |
| US2 | BPBD | …ingin melihat bulan berjalan dibandingkan median historis dan tahun-tahun El Niño, agar bisa menilai apakah status siaga perlu dinaikkan | P0 |
| US3 | BPBD | …ingin mengunduh brief 1 halaman Bahasa Indonesia yang angkanya terverifikasi, agar bisa langsung diteruskan ke rapat | P1 |
| US4 | KHG | …ingin membandingkan KHG berdasarkan aktivitas di tahun El Niño, agar bisa memprioritaskan pembasahan | P1 |
| US5 | Manggala Agni | …ingin melihat pola siang vs malam, agar penjadwalan patroli malam tepat | P1 |
| US6 | Semua | …ingin tahu apakah sebuah lonjakan nyata atau artefak satelit, agar tidak salah ambil keputusan | P0 |
| US7 | Peneliti | …ingin mengunduh CSV dengan nilai mentah per sensor, nilai harmonisasi, dan interval, agar bisa analisis ulang | P0 |
| US8 | Peneliti | …ingin melihat bukti validasi (seam test, LOYO, backtest), agar percaya pada hasil | P0 |
| US9 | Global | …ingin menggambar AOI di mana saja di dunia, agar bisa memakai metode yang sama di wilayah saya | P0 (challenge) |
| US10 | Semua | …ingin tahu kenapa angka Second Sight berbeda dari SiPongi/BRIN, agar tidak bingung | P1 |
| US11 | Publik | …ingin membagikan kartu "kalender karhutla kabupatenku", agar warga sadar pola risiko | P2 |
| US12 | Semua | …ingin menanyakan dengan bahasa sehari-hari ("Kalteng September 2026 dibanding 2015"), agar tidak perlu memahami istilah sensor | P2 |

### 7.4 Scope dan prioritas

| Prioritas | Arti | Isi |
|---|---|---|
| **P0 (wajib demo)** | Tanpa ini proyek tidak memenuhi challenge atau tidak bisa dipertahankan | Pipeline harmonisasi inti (§7.6 langkah 1-9), kalender, AOI preset + gambar + lat/lon, bulan ini vs median, toggle raw/harmonized, anotasi seam, panel "Seberapa yakin", CSV, bilingual, metodologi, **uji gambut V9** (hasil apa pun dilaporkan), seam test V3, LOYO V1, sunset V5 |
| **P1 (pembeda utama)** | Yang membuat Second Sight berbeda dari 43 pesaing | Baseline kondisional El Niño + pembanding analog, validasi SiPongi V6, **FRP floor P5**, **grafik drift orbit P6/V4**, brief siaga terverifikasi A2 + eval A4, panel "kenapa angka berbeda" (versi ringan), preset KHG, uji fisik Field V8 |
| **P2 (jika waktu cukup)** | Penguat | Operator Sofiev P4 sebagai validasi silang, koreksi awan CMG P7, query bahasa alami A1, kartu shareable X16, kalkulator sub-piksel P1, uji transfer global ke wilayah ke-2, conformal S7, panel kekeringan X12 penuh |
| **Di luar scope** | Sengaja tidak dibuat | Forecast ML harian, chatbot bebas, globe 3D, segmentasi burn scar, klaim emisi karbon gambut, analisis per perusahaan konsesi, sistem pelaporan warga |

### 7.5 Spesifikasi layar (produk)

Navigasi utama: **Peta & Pilih Wilayah → Kalender → Bulan Ini → Lab Sains → Seberapa Yakin → Unduh & Brief → Metodologi**. Semua layar bilingual (ID default, EN toggle). Satu AOI aktif dibagikan ke semua layar (disimpan di URL agar bisa dibagikan, pola burn-calendar).

> **Spesifikasi tampilan terbaru:** [10-ui-ux-second-sight.md](10-ui-ux-second-sight.md) menggantikan detail visual layar-layar di bawah. Isinya pola dari aplikasi pesaing dan platform yang sudah teruji, kode berlisensi permisif yang diadaptasi, design system, dan checklist anti AI-slop. Fungsi tiap layar di bawah tetap berlaku.

#### Layar 1 — Peta & Pilih Wilayah
- **Tujuan:** memilih AOI dalam <10 detik.
- **Komponen:**
  - Peta MapLibre (basemap ringan) dengan lapisan: batas provinsi/kabupaten, KHG (jika tersedia), gambut (arsir), hotspot 7 hari terakhir (NRT, opsional).
  - Panel kiri: tab **Preset** (dropdown provinsi → kabupaten; daftar KHG; taman nasional prioritas: Sebangau, Tesso Nilo, Berbak) · **Gambar** (poligon/persegi) · **Koordinat** (lat, lon, radius km).
  - Kartu ringkas AOI: luas, % gambut, jumlah tahun data, sensor tersedia.
- **Interaksi:** memilih AOI → semua layar lain diperbarui; AOI di URL.
- **Data:** PMTiles batas; tabel `monthly_aoi` untuk preset (precompute); duckdb-wasm untuk AOI gambar.
- **Kriteria penerimaan:** preset terbuka <1 detik; AOI gambar (provinsi-ukuran) <5 detik; lat/lon divalidasi (dalam rentang, radius 1-200 km).
- **Global:** AOI gambar/lat-lon berfungsi di seluruh dunia (data global dari mirror GeoParquet atau API); preset hanya Indonesia + wilayah uji transfer.

#### Layar 2 — Kalender (inti challenge)
- **Tujuan:** menjawab "bulan apa rawan, tahun apa parah, apakah lompatan itu nyata".
- **Komponen:**
  - **Heatmap tahun (baris 2001-2026) × bulan (kolom Jan-Des).** Opsi tampilan: **nilai** (viridis/cividis, skala log) atau **anomali** (PuOr/RdBu colorblind-safe, terhadap median).
  - Angka di setiap sel (dapat dimatikan).
  - **Glyph ketidakpastian:** titik kecil di pojok sel jika interval relatif lebar (> ambang, mis. ±50%); sel dengan observasi terbatas (awan/data hilang) diberi arsir diagonal.
  - **Anotasi seam:** penanda di sisi kiri pada tahun 2002, 2012, 2018, 2020-22, 2023, 2026; klik → penjelasan singkat.
  - **Toggle tiga posisi:** *Mentah (MODIS lalu VIIRS)* · *Per sensor* (tiga kalender kecil berdampingan) · *Harmonisasi Second Sight*. Transisi dianimasikan (warna sel berubah selama ~1 detik) sehingga lompatan 2012 terlihat hilang.
  - Selektor strata: *Semua* · *Gambut saja* · *Mineral saja* · *Siang* · *Malam*.
  - Kolom ringkas kanan: total tahunan + peringkat; baris bawah: median per bulan (klimatologi) + "musim" (bulan ≥50% puncak).
  - Overlay opsional: strip ONI/DMI per tahun (warna merah = El Niño, biru = La Niña).
- **Tooltip sel:** nilai harmonisasi + interval 90%, nilai mentah per sensor, sensor sumber, peringkat bulan tersebut sepanjang sejarah, flag (NRT/provisional, awan tinggi, data hilang, era drift).
- **Kriteria penerimaan:** render <500 ms untuk preset; semua sel punya tooltip; colormap lolos simulasi buta warna (deuteranopia/protanopia); navigasi keyboard antar sel.

#### Layar 3 — Bulan Ini vs Sejarah
- **Tujuan:** satu jawaban untuk BPBD.
- **Komponen:**
  - **Kartu utama:** "Agustus 2026 di [AOI]: **[hasil]** fire cell-days (interval [hasil]); **persentil [hasil]** dari 2001-2025; **peringkat [n] dari [N] tahun El Niño**."
  - **Pembanding analog:** garis kumulatif musim (Jan-Des) untuk tahun berjalan vs 2-3 tahun analog terdekat (otomatis dipilih dari kelas ENSO/IOD yang sama) vs median semua tahun, dengan pita p10-p90.
  - **Status iklim:** ONI terbaru, DMI terbaru, kelas tahun (El Niño + IOD+ / El Niño / netral / La Niña).
  - **Konteks hujan (P1/P2):** hujan 90 hari di AOI vs garis 4 mm/hari (Field 2016).
  - **Penjelas otomatis berbasis aturan (A3):** 1-3 kalimat, mis. "Konsisten dengan pola kekeringan El Niño (Field et al. 2016)" atau "Bulan ini memakai data NRT provisional; nilai bisa berubah."
- **Kriteria penerimaan:** kartu memuat sumber setiap angka (hover); bila bulan berjalan belum lengkap, perbandingan memakai periode yang sama (mis. 1-20 Agustus vs 1-20 Agustus historis).

#### Layar 4 — Lab Sains (momen sains, maksimal 3 panel yang ditonjolkan)
- **Panel A — "Gambut membuat MODIS lebih buta" (P0, V9):** grafik batang rasio VIIRS:MODIS (kalibrasi 2012-2021) untuk {gambut, mineral} × {siang, malam}, dengan CI bootstrap per tahun; teks hasil uji H1/H2 (terbukti/tidak, dengan angka).
- **Panel B — "Ambang api besar" (P1, P5):** kurva R(F) = N_VIIRS(≥F)/N_MODIS(≥F) vs F (log), siang dan malam; garis F\* terpilih; kalender indeks api besar sebagai pembanding.
- **Panel C — "Seam yang tidak terlihat: drift orbit" (P1, P6/V4):** atas: jam lintas lokal Terra dan Aqua (median per bulan dari `acq_time` + bujur) 2003-2026; bawah: rasio teramati Aqua/VIIRS·k vs prediksi model diurnal 2022-2026.
- **Panel D (P2) — "VIIRS dilihat dengan mata MODIS":** slider/peta opacity P_det + kurva sigmoid; hasil validasi operator tanpa fitting (r, bias, KGE).
- **Panel E (P2) — Kalkulator api sub-piksel.**
- **Kriteria penerimaan:** setiap panel punya kalimat kesimpulan 1 baris + tombol (i) metodologi + sitasi.

#### Layar 5 — Seberapa Yakin Kami
- **Tujuan:** Validity yang terlihat.
- **Komponen:**
  - **Tabel ringkas validasi** (diisi dari `validation_results`): LOYO (MdAPE, Spearman, bias), LORO, seam test per sambungan (Δ_seam ± CI, p Pettitt, posisi dalam distribusi placebo), MODIS sunset (KGE), SiPongi (Spearman nasional/provinsi), uji Field 2016 (parameter sebelum vs sesudah 2012), kesepakatan flag anomali (κ), coverage interval.
  - **Tabel ablation M0-M5** (§13.3).
  - **"Di mana kami masih kurang":** daftar keterbatasan jujur (lihat §7.12).
  - Banner kesehatan data (missing days, NRT, drift).
- **Kriteria penerimaan:** semua angka dihasilkan pipeline (bukan diketik manual); tautan ke notebook validasi di repo.

#### Layar 6 — Angka Resmi vs Harmonisasi (P1, versi ringan K2)
- **Komponen:** tabel/grafik tahunan: luas terbakar SiPongi, hitungan hotspot FIRMS mentah (MODIS, VIIRS), Second Sight harmonisasi; korelasi rank; kartu "kenapa angka berbeda" dengan 4 alasan (sensor, filter confidence, unit hitung, jumlah satelit) dan contoh angka satu hari jika data tersedia.
- **Nada:** "melengkapi", bukan "mengoreksi". Sumber dan tanggal setiap angka resmi dicantumkan.

#### Layar 7 — Unduh & Brief
- **CSV** (skema §7.9.3), **PNG/SVG kalender**, **brief siaga** (PDF 1 halaman + teks WhatsApp) dengan penanda "setiap angka diverifikasi otomatis terhadap data", **kartu kabupaten** (P2).
- Brief memuat: wilayah, periode, nilai bulan ini + interval, persentil, peringkat El Niño, konteks iklim, penjelas berbasis aturan, keterbatasan, sumber data, tanggal pembuatan, versi data.

#### Layar 8 — Metodologi
- Penjelasan bertingkat: (1) 5 kalimat untuk publik; (2) 1 halaman untuk pengelola; (3) dokumen lengkap untuk peneliti (rumus, keputusan, sumber, pengakuan AI, lisensi, referensi).

### 7.6 Metodologi sains final

#### 7.6.1 Keputusan desain (decision log)

| # | Keputusan | Pilihan | Alasan | Alternatif yang ditolak |
|---|---|---|---|---|
| D-1 | Satuan | **Fire cell-days** pada grid 0,01° per (tanggal lokal, satelit, siang/malam) | Menghapus duplikat dan meredam inflasi piksel | Hitungan deteksi mentah (paling bias resolusi) |
| D-2 | Skala referensi | **Setara Aqua-MODIS** | Aqua satu-satunya orbit 13:30 kontinu 2002-2021; baseline 2003-2021 tetap native | Skala VIIRS (memaksa backcast pra-2012 yang tidak bisa diobservasi) |
| D-3 | Periode kalibrasi | **2012-2021** | Sebelum drift Aqua; overpass masih sinkron | 2012-2025 (tercemar drift) |
| D-4 | Strata kalibrasi | **Wilayah (5 pulau besar) × musim (3) × siang/malam (2) × gambut/mineral (2)** = 60 strata, dengan shrinkage | Rasio bergantung semua faktor ini; shrinkage menjaga strata kecil stabil | Rasio tunggal (tidak defensible); per bulan × per provinsi (terlalu banyak strata) |
| D-5 | Estimator | Ratio of sums + **empirical Bayes gamma-Poisson** | Bentuk tertutup, transparan, setara rumus shrinkage | ML per sel (kotak hitam, berat) |
| D-6 | Interval | **Bootstrap per tahun** (90%) | Menghormati autokorelasi | Interval Poisson (terlalu sempit) |
| D-7 | Filter | `type = 0`; MODIS conf ≥30; VIIRS n/h; mask statis untuk NRT | Selaras praktik nominal+tinggi; uji sensitivitas untuk ≥80/h | Semua confidence (lebih banyak noise) |
| D-8 | Satelit VIIRS | Satu per waktu: S-NPP s.d. 2 Nov 2026, lalu NOAA-20·r | Menghindari inflasi jumlah satelit | Menjumlahkan semua satelit |
| D-9 | Bin waktu | **Bulanan** untuk kalender; harian untuk precompute | User guide MODIS: bin <8 hari bias | Mingguan sebagai tampilan utama |
| D-10 | Baseline | Median per bulan-kalender **2003-2022**; plus baseline kondisional ENSO | Era Terra+Aqua penuh; median robust | Mean (GWIS/EFFIS) |
| D-11 | Anomali utama | **Persentil + peringkat analog** | Aman untuk data banyak nol; mudah dikomunikasikan | Z-score sebagai utama |
| D-12 | Peran fisika | FRP floor dan operator Sofiev sebagai **indeks pendamping dan validasi silang** | Defensible tanpa membuat seri utama bergantung pada koefisien yang belum diverifikasi | Operator sebagai seri utama (risiko tinggi dalam 48 jam) |
| D-13 | Drift | Bukti diagnostik + justifikasi D-3; koreksi diurnal hanya bila stabil | Parameter diurnal Indonesia tidak pasti | Mengoreksi semua data dengan diurnal |
| D-14 | Awan | Flag observasi terbatas (P0); koreksi CMG (P2) | Kejujuran lebih penting daripada koreksi yang bisa overestimate | Mengabaikan awan |

#### 7.6.2 Pipeline langkah demi langkah

**Langkah 1 — Ingest.**
- Ambil arsip SP 2000-2025 (MODIS Terra/Aqua, VIIRS S-NPP, NOAA-20; NOAA-21 jika ada) untuk bbox Indonesia + bbox wilayah uji transfer; NRT 2026.
- Simpan sebagai Parquet berpartisi `sensor/satellite/year`.
- Catat tanggal unduh, URL, dan hash di `data_manifest`.

**Langkah 2 — Bersihkan dan beri atribut.**
- Buang Terra sebelum Nov 2000 (Giglio 2016).
- Filter `type = 0`; untuk NRT terapkan mask statis (Langkah 3).
- Filter confidence sesuai D-7; simpan juga kolom `conf_class` untuk uji sensitivitas.
- Hitung: `local_date` (UTC + bujur/15 jam, lalu tanggal), `local_solar_time = UTC_jam + lon/15`, `A_pix = scan × track`, `satellite`, `daynight`.
- Gabungkan label spasial: `is_peat` (peta gambut), `province`, `regency`, `khg_id` (jika ada), `island_region` (Sumatra, Kalimantan, Sulawesi, Papua, Jawa-Nusa Tenggara-Bali-Maluku).

**Langkah 3 — Mask sumber statis.**
- Dari SP 2012-2025: sel 0,01° dengan deteksi `type ∈ {1,2,3}` pada ≥ N hari (usulan N = 10, uji sensitivitas) atau persisten di ≥ 4 tahun pada bulan basah (pola zzaemm/ember) → `static_mask`.
- Terapkan ke NRT dan juga sebagai pemeriksaan silang SP.

**Langkah 4 — Fire cell-days.**
- `cell_id = (floor(lat/0,01), floor(lon/0,01))`.
- Tabel `daily_cell`: (local_date, cell_id, satellite, daynight) → `n_det`, `sum_frp`, `max_frp`, `mean_A_pix`, `is_peat`, label wilayah.
- Fire cell-day = baris unik dalam tabel ini.

**Langkah 5 — Agregasi bulanan per strata dan per AOI.**
- `monthly_stratum`: (year, month, island_region, season, daynight, is_peat, satellite) → jumlah fire cell-days.
- `monthly_aoi`: sama, per provinsi/kabupaten/KHG (precompute) + jalur on-the-fly untuk AOI gambar.

**Langkah 6 — Kalibrasi VIIRS→Aqua (2012-2021).**
- Untuk setiap strata `s`: `ΣA_s` (Aqua) dan `ΣV_s` (S-NPP) pada 2012-2021.
- Strata induk: (island_region, daynight); kakek: (daynight).
- Hyperparameter `(a, b)` per induk: method of moments dari rasio strata anak (atau MLE marginal NegBin).
- `κ̂_s = (a + ΣA_s) / (b + ΣV_s)`.
- Interval: **bootstrap per tahun** (1.000 resample tahun 2012-2021) → `κ_lo`, `κ_hi` (persentil 5 dan 95).
- Musim: usulan 3 musim (Des-Mar basah, Apr-Jul transisi, Ags-Nov kering) agar strata tidak terlalu kecil; uji alternatif per bulan pada wilayah dengan data banyak.

**Langkah 7 — Rantai satelit.**
- `r_N20→SNPP` per (island_region, daynight) dari overlap Apr 2018-Okt 2026 (ratio of sums + bootstrap).
- `r_T→A` per (island_region, daynight, season) dari Jul 2002-Des 2005.
- (Opsional) `r_N21→N20` dari overlap.
- **Chain closure:** error rantai digabung ke interval (perkalian faktor → jumlah varians log).

**Langkah 8 — Susun seri harmonisasi H.**
- Untuk setiap (AOI, year, month, daynight, is_peat):
  - Nov 2000-Jun 2002: `H = T · r_T→A`
  - Jul 2002-Des 2021: `H = A`
  - Jan 2022-2 Nov 2026: `H = V_SNPP · κ̂`
  - setelah 2 Nov 2026: `H = V_N20 · r_N20→SNPP · κ̂`
- Jumlahkan lintas strata untuk total AOI; interval dari bootstrap gabungan (resample tahun yang sama untuk semua strata, agar korelasi terjaga).
- Simpan juga `A_raw`, `T_raw`, `V_raw` per sensor untuk transparansi.

**Langkah 9 — Baseline dan anomali.**
- Median per bulan-kalender 2003-2022 (per AOI; untuk validasi dihitung di dalam fold).
- Persentil (empirical CDF bulan yang sama 2001-tahun lalu), rasio log, robust z (hanya ditampilkan jika median > ambang).
- **Baseline kondisional:** kelas tahun dari ONI (rata-rata Jul-Sep ≥ +0,5 = El Niño) dan DMI (rata-rata Sep-Nov ≥ +0,4 = IOD+); peringkat bulan berjalan di antara tahun sekelas.
- "Musim" = bulan dengan median ≥ 50% median bulan puncak.

**Langkah 10 — Indeks pendamping fisika (P1).**
- **FRP floor:** pada 2012-2021, untuk F dari 1 sampai 200 MW (log), hitung `R(F)` (VIIRS diagregasi `sum_frp` per sel-overpass; MODIS dengan `A_pix ≤` ambang setara scan ≤ ~40°). Pilih F\* = F terkecil di mana `|R(F) − 1| < 0,15` dan stabil (siang dan malam terpisah). Seri "indeks api besar" = cell-days dengan FRP ≥ F\*, untuk semua sensor tanpa kalibrasi.
- **Drift:** median `local_solar_time` per bulan untuk Terra, Aqua, S-NPP; model diurnal `f(t) = b + exp(−(t − h)²/(2s²))` dengan parameter literatur hutan tropis (atau fit dari rasio Terra/Aqua 2003-2019 dengan prior); prediksi rasio `f(t_Aqua)/f(13:30)` untuk 2022-2026 vs rasio teramati `A / (V·κ̂)`.
- **Operator Sofiev (P2):** lihat P4; output `E[N_MODIS-eq]` ± `√ΣP(1−P)` 2012-2021 dibandingkan Aqua aktual.

**Langkah 11 — Validasi** (semua aturan uji ditulis di `validation_plan.md` **sebelum** dijalankan, pola pra-registrasi project-shift/Icarus):
- V1 LOYO, V2 LORO, V3 seam test, V4 drift, V5 sunset, V6 SiPongi, V7 sensitivitas, V8 Field 2016, V9 gambut, V10 κ flag, V12 ranking ENSO. Output ke `validation_results.json`.

**Langkah 12 — Ekspor.**
- Static bundle: `monthly_aoi.parquet`, `daily_cell` terpartisi (untuk duckdb-wasm), `baseline.parquet`, `validation_results.json`, `data_health.json`, `strata_factors.json`, PMTiles batas.

#### 7.6.3 Rumus inti (ringkas)

```
Fire cell-day:      c(d, g, sat, dn) = 1 jika ada ≥1 deteksi valid di sel g pada tanggal lokal d
Kalibrasi:          κ̂_s = (a + Σ_{2012-21} A_s) / (b + Σ_{2012-21} V_s)
Seri:               H(y,m) = A(y,m)                         2002-07 … 2021-12
                           = Σ_s κ̂_s · V_s(y,m)             2022-01 … 2026-11-02
                           = Σ_s κ̂_s · r_N20 · N20_s(y,m)   sesudahnya
Interval:           bootstrap tahun → persentil 5 dan 95 dari H*
Persentil:          P(y,m) = rank(H(y,m) di antara {H(y',m) : y' < y}) / jumlah
Robust z:           z = (H − median) / (1,4826 · MAD)
Analog ENSO:        rank(H(y,m) di antara {H(y',m) : kelas(y') = kelas(y)})
Seam:               z_t = log(H_t + 1) − log(R_t + 1);  Δ = mean(z)_sesudah − mean(z)_sebelum
Pettitt:            K = max_t |Σ_{i≤t} Σ_{j>t} sgn(z_j − z_i)|,  p ≈ 2·exp(−6K²/(n³+n²))
KGE:                1 − √((r−1)² + (σ_s/σ_o − 1)² + (μ_s/μ_o − 1)²)
FRP floor:          R(F) = N_V(FRP ≥ F) / N_M(FRP ≥ F);  F* = min F dengan |R(F) − 1| < 0,15
Diurnal:            f(t) = b + exp(−(t − h)² / (2s²));  rasio_prediksi(t) = f(t_obs)/f(13:30)
Operator Sofiev:    P_det(P, A) = max(0, σ(r(A)(P − (αA + β))) − c0) / (1 − c0)
```

### 7.7 Bagian unggulan: uji hipotesis gambut (V9) secara rinci

Ini kemungkinan **temuan orisinal** Second Sight, jadi rancangannya ditulis lengkap.

- **Pertanyaan:** apakah rasio deteksi VIIRS:Aqua (fire cell-days) berbeda antara gambut dan tanah mineral, dan antara siang dan malam?
- **Data:** 2012-2021, Sumatra + Kalimantan (tempat gambut dominan), label gambut dari peta BBSDLP (fallback PEATMAP).
- **Unit:** jumlah cell-days per (tahun, bulan, island_region, daynight, is_peat) untuk Aqua dan S-NPP.
- **Statistik:** rasio `ρ = ΣV/ΣA` per strata (kebalikan dari κ, lebih intuitif: "VIIRS melihat ρ kali lebih banyak"); CI 90% bootstrap per tahun; selisih log-rasio gambut − mineral dengan CI.
- **Uji formal (opsional):** GLM NegBin `V ~ offset(log A) + is_peat * daynight + island_region + season`; laporkan exp(koefisien) dengan CI.
- **Kontrol perancu:**
  - Musim (gambut lebih banyak terbakar di musim kering) → stratifikasi musim.
  - Ukuran api (gambut di tahun El Niño bisa sangat besar) → laporkan terpisah tahun El Niño vs normal (H3).
  - Tutupan awan → (P2) bandingkan pada bulan dengan `f_cloud` rendah saja.
- **Aturan keputusan (ditulis sebelum dijalankan):** H1 diterima jika CI 90% selisih log-rasio gambut − mineral > 0 di siang **dan** malam; H2 diterima jika rasio malam > siang dengan CI tidak tumpang tindih, pada gambut.
- **Pelaporan:** apa pun hasilnya ditampilkan di Lab Sains Panel A. Jika H1 ditolak: "Kami tidak menemukan perbedaan rasio gambut vs mineral yang signifikan; kalibrasi berstrata tetap dipakai karena tidak merugikan dan transparan."
- **Kenapa penting bagi pengguna:** jika rasio gambut lebih tinggi, maka **kalibrasi tunggal akan meremehkan aktivitas gambut pada era VIIRS (atau melebihkannya pada era MODIS)**, tepat di wilayah prioritas BRGM/KHG.

### 7.8 Bukti skalabilitas global: uji transfer

- **Tujuan:** membuktikan prinsip P11 ("global dalam metode") dengan data, bukan klaim.
- **Desain:** jalankan pipeline yang sama **tanpa mengubah kode**, hanya mengganti bbox, peta gambut global (PEATMAP), dan indeks iklim, pada 1-2 wilayah:
  - **Pilihan utama: Amazon barat (Peru/Brasil)** — gambut tropis + sinyal ENSO, kontras ekologi, relevan dengan CONAE (Amerika Selatan, mitra challenge ini).
  - Pilihan kedua: **Australia utara** (savana, musim kering jelas) atau **Punjab** (pertanian; banyak pesaing, sehingga perbandingan langsung mungkin).
- **Yang dilaporkan:** LOYO, seam test, sunset KGE di wilayah transfer; apakah rasio gambut/mineral dan siang/malam berperilaku serupa.
- **Pesan pitch global:** "Built for Indonesia's peatlands, the hardest case on Earth for fire satellites; validated again in [region] without changing a line of code."
- **Effort:** 3-4 jam jika pipeline sudah bersih (P2, tetapi sangat berharga untuk juri global).

### 7.9 Spesifikasi data

#### 7.9.1 Sumber data

| ID | Data | Penyedia | Periode | Format | Peran | Prioritas |
|---|---|---|---|---|---|---|
| D1 | FIRMS MODIS C6.1 SP (Terra, Aqua) | NASA LANCE/FIRMS | 2000-2025 | CSV/Parquet | Inti | P0 |
| D1 | FIRMS VIIRS 375 m C2 SP (S-NPP, NOAA-20, NOAA-21) | NASA LANCE/FIRMS | 2012-2025 | CSV/Parquet | Inti | P0 |
| D2 | FIRMS NRT 2026 | NASA LANCE/FIRMS | 2026 | API CSV | Ekor terbaru | P0 |
| D3 | FIRMS missing_data / data_availability | NASA FIRMS | — | API | Kesehatan data | P0 |
| D5 | Peta gambut Indonesia | BBSDLP/Kementan; fallback PEATMAP | statis | SHP/GeoJSON/raster | Strata | P0 |
| D7 | Batas provinsi/kabupaten | geoBoundaries/BIG | statis | GeoJSON → PMTiles | AOI | P0 |
| D8 | ONI, DMI | NOAA CPC, NOAA PSL/BoM | 1950-2026 | CSV | Kelas ENSO/IOD | P1 |
| D11 | Luas terbakar resmi | SiPongi/KLHK | ~2015-2025 | Tabel | Validasi | P1 |
| D6 | KHG | KLHK | statis | SHP | AOI | P1 |
| D9 | CHIRPS bulanan | UCSB CHC/GEE | 1981-2026 | Raster | Uji Field, konteks | P1 |
| D13 | MCD64A1 | NASA LP DAAC | 2000-2026 | Raster | Referensi seam/validasi | P2 |
| D4 | MOD14CMQ/MYD14CMQ | UMD | 2000-2026 | HDF | Awan | P2 |
| D12 | Hitungan hotspot harian resmi | SiPongi/BRIN | 2026 | Kutipan/JSON | Panel angka berbeda | P1 |

#### 7.9.2 Tabel internal

| Tabel | Kunci | Kolom utama |
|---|---|---|
| `detections` | id | lat, lon, acq_date, acq_time, local_date, local_solar_time, satellite, instrument, daynight, confidence, conf_class, frp, scan, track, A_pix, type, version, quality (SP/NRT), cell_id, is_peat, province, regency, khg_id, island_region, static_masked |
| `daily_cell` | local_date, cell_id, satellite, daynight | n_det, sum_frp, max_frp, mean_A_pix, is_peat, labels |
| `monthly_stratum` | year, month, island_region, season, daynight, is_peat, satellite | cell_days, sum_frp |
| `strata_factors` | stratum | kappa_hat, kappa_lo, kappa_hi, n_A, n_V, parent, shrink_weight |
| `chain_factors` | pair, island_region, daynight[, season] | r_hat, r_lo, r_hi |
| `monthly_aoi` | aoi_id, year, month | A_raw, T_raw, V_raw, N20_raw, sensor_used, H, H_lo, H_hi, H_peat, H_mineral, H_day, H_night, large_fire_index, flags |
| `baseline` | aoi_id, month | median_2003_2022, p10, p90, mad |
| `enso_class` | year | oni_jas, dmi_son, class |
| `validation_results` | test_id | metric, value, ci_lo, ci_hi, decision_rule, passed, notes |
| `data_health` | date, satellite | status (ok/missing/partial/nrt), source |
| `data_manifest` | file | url, download_date, sha256, rows |

#### 7.9.3 Skema CSV unduhan

Header komentar (baris `#`): nama aplikasi, versi data, tanggal unduh, filter (confidence, type), baseline, periode kalibrasi, sitasi, lisensi data, pengakuan AI.

| Kolom | Arti |
|---|---|
| `aoi_id`, `aoi_name` | Identitas wilayah |
| `year`, `month` | Waktu |
| `terra_raw`, `aqua_raw`, `snpp_raw`, `noaa20_raw` | Fire cell-days mentah per satelit |
| `sensor_used` | Sumber seri harmonisasi bulan tersebut |
| `kappa`, `kappa_lo`, `kappa_hi` | Faktor kalibrasi efektif (rata-rata tertimbang strata) |
| `H`, `H_lo`, `H_hi` | Nilai harmonisasi + interval 90% |
| `H_peat`, `H_mineral`, `H_day`, `H_night` | Dekomposisi |
| `large_fire_index` | Indeks api besar (FRP ≥ F\*) |
| `baseline_median`, `pct_rank`, `anomaly_logratio`, `robust_z` | Anomali |
| `enso_class`, `analog_rank`, `analog_n` | Konteks El Niño |
| `flag_nrt`, `flag_missing_days`, `flag_drift_era`, `flag_high_cloud` | Penanda |

Unduhan titik deteksi mentah (challenge: "downloadable CSV of hot spots detected during a search") juga tersedia untuk AOI dan rentang yang dipilih, dengan kolom asli FIRMS + `is_peat`, `static_masked`, `cell_id`.

### 7.10 Arsitektur dan stack

```
┌─────────────────────── OFFLINE (laptop tim, 14-15 Nov) ───────────────────────┐
│ ingest  → FIRMS SP (CSV negara / firms-catalog GeoParquet) + NRT API 2026     │
│ clean   → filter, mask statis, waktu lokal, A_pix, label gambut/wilayah/KHG   │
│ cells   → daily_cell (0,01°)                                                  │
│ calib   → strata 2012-2021, EB gamma-Poisson, bootstrap tahun, rantai satelit │
│ series  → monthly_aoi (H, interval, dekomposisi), baseline, kelas ENSO        │
│ physics → FRP floor R(F), drift (jam lintas + diurnal), [operator Sofiev]     │
│ validate→ validation_plan.md (ditulis dulu) → validation_results.json         │
│ export  → static bundle (Parquet/JSON/PMTiles) + notebook validasi            │
└───────────────────────────────────────────────────────────────────────────────┘
                 │ build & deploy (static host)
                 ▼
┌─────────────────────────────── ONLINE ────────────────────────────────────────┐
│ Frontend statis (Vite + TypeScript, atau framework pilihan tim)               │
│   MapLibre GL + PMTiles + deck.gl │ Kalender ECharts/Observable Plot           │
│   duckdb-wasm untuk AOI gambar (Parquet via HTTP range)                       │
│   i18n ID/EN │ URL state │ banner kesehatan data │ unduh CSV/PNG/SVG          │
│                                                                               │
│ Backend tipis FastAPI (opsional, hanya untuk LLM dan PDF):                    │
│   /brief   fact table → LLM (placeholder) → verifier angka → template fallback│
│   /parse   NL → JSON schema → gazetteer → chip (P2)                           │
│   /pdf     WeasyPrint dari template HTML brief                                │
│   cache respons demo │ kunci di env var                                       │
│                                                                               │
│ eval/  50 query + 100 brief → laporan akurasi (A4)                            │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Struktur repo yang disarankan:**

```
second-sight/
  README.md                 (satu kalimat, demo, video, badge, data NASA, cara menjalankan, pengakuan AI)
  LICENSE                   (MIT/Apache-2.0; atau GPL-3.0 jika memakai kode FRP_OOp)
  NOTICE                    (atribusi Apache-2.0 bila meminjam kode)
  docs/
    methodology.md          (rumus, keputusan D-1…D-14)
    validation_plan.md      (aturan uji, ditulis sebelum dijalankan)
    validation_report.md    (hasil + ablation M0-M5)
    data_provenance.md      (sumber, versi, tanggal, hash, lisensi)
    limitations.md
    ai_acknowledgement.md
  pipeline/
    01_ingest  02_clean  03_static_mask  04_cells  05_aggregate
    06_calibrate  07_chain  08_series  09_baseline  10_physics
    11_validate  12_export
  app/                      (frontend)
  api/                      (backend tipis)
  eval/                     (eval AI)
  data/sample/              (subset kecil untuk reproduksi cepat)
  notebooks/                (validasi & figur)
```

**Prinsip engineering:**
- Pipeline deterministik dan bisa diulang dari nol dengan satu perintah per tahap.
- Semua angka di UI berasal dari file hasil pipeline (tidak ada angka yang diketik manual).
- Static bundle di-commit sebagai snapshot demo (pola karhutla-watch) agar demo tidak bergantung jaringan.

### 7.11 Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Kinerja | Kalender preset <500 ms; AOI gambar setingkat provinsi <5 detik; halaman awal <3 detik di 4G |
| Ketersediaan demo | Berjalan penuh tanpa jaringan dari bundle lokal; backend LLM opsional |
| Aksesibilitas | Colormap colorblind-safe, angka di sel, kontras WCAG AA, navigasi keyboard, alt text grafik |
| Bahasa | ID default, EN lengkap (wajib untuk juri global) |
| Keamanan | Tidak ada kunci di repo; tidak ada data pribadi; tidak menyebut nama perusahaan konsesi |
| Reproducibility | Versi data + hash di footer dan CSV; notebook validasi |
| Kejujuran | Setiap angka punya sumber; nilai NRT bertanda provisional; keterbatasan tertulis |
| Lisensi | Lisensi repo jelas; atribusi semua pustaka dan teknik pinjaman |

### 7.12 Keterbatasan yang dinyatakan terbuka

1. Hotspot ≠ kejadian kebakaran ≠ luas terbakar. Second Sight mengukur **aktivitas pembakaran yang terdeteksi satelit**.
2. Api gambut di bawah permukaan dan di bawah asap tebal tetap bisa luput dari kedua sensor; kalibrasi menyetarakan sensor, tidak "melihat" yang tidak terdeteksi keduanya.
3. Kalibrasi mengasumsikan rasio stasioner dalam strata; tahun ekstrem dapat menyimpang (diperiksa di LOYO 2015/2019).
4. Seri pra-2012 dalam skala MODIS tidak memuat api kecil yang hanya terlihat VIIRS (tidak ada backcast).
5. Data 2026 berasal dari NRT dan bisa direvisi.
6. Luas terbakar resmi memakai metode berbeda; dipakai hanya untuk korelasi peringkat.
7. Parameter siklus diurnal untuk Indonesia belum pasti; koreksi drift diperlakukan sebagai diagnostik.
8. Tahun analog El Niño sedikit; peringkat analog punya ketidakpastian besar.
9. Batas KHG dan peta gambut yang dipakai mungkin bukan versi resmi terbaru (dicantumkan versinya).

### 7.13 Ukuran keberhasilan

| Jenis | Ukuran | Target |
|---|---|---|
| Sains | Δ_seam 2012 pada seri harmonisasi | CI mencakup 0; berada di dalam distribusi placebo |
| Sains | LOYO 2012-2021 | Bias tahunan |bias| < [ditetapkan di validation_plan] |
| Sains | Sunset backtest KGE | Lebih tinggi dari M0 dan M1 |
| Sains | Spearman vs SiPongi (nasional, tahunan) | Positif dan lebih tinggi dari M0 |
| Sains | Uji Field 2016 | Parameter sebelum/sesudah 2012 tidak berbeda signifikan (harmonisasi) vs berbeda (raw) |
| Produk | Waktu menjawab "bulan ini vs sejarah" | <60 detik dari layar awal |
| Produk | Brief | 0 angka tak terlacak pada eval 100 brief |
| Demo | Video | ≤30 detik, bahasa Inggris |
| Demo | Slide | ≤7, termasuk judul |

---

## 8. Rekayasa demo

Ada **empat artefak presentasi** dengan juri yang berbeda. Semua bahan wajib berbahasa Inggris, kecuali pitch lokal yang boleh bilingual (cek aturan lokal di technical meeting).

| Artefak | Juri | Batas | Fokus |
|---|---|---|---|
| Video demo | Lokal + global | **≤30 detik** (melebihi = tidak eligible global) | Satu pertanyaan pengguna + satu momen sains |
| Slide demo | Lokal + global | **≤7 slide termasuk judul** | Struktur lima kriteria |
| Project page | Global (utama) | Teks bebas | Validity, Relevance, Impact terdokumentasi |
| Pitch live 21 Nov | Lokal (mitra BRIN) | Format belum diumumkan | Demo langsung + tanya-jawab teknis |

**Pilih salah satu sebagai "Link to Project Demo"**: video 30 detik **atau** 7 slide. Saran: **video** untuk link demo resmi (lebih kuat secara visual), slide dipakai sebagai lampiran di project page dan bahan pitch live. Konfirmasi apakah keduanya boleh dicantumkan.

### 8.1 Storyboard video 30 detik (bahasa Inggris, dengan subtitle)

Template resmi guide: 0:00 nama/tim → 0:02 challenge & inspirasi → 0:05 nama + tagline → 0:10 cara kerja + data NASA → 0:20-0:30 visi.

| Waktu | Visual | Narasi/teks layar (EN) |
|---|---|---|
| 0:00-0:02 | Judul teks "Second Sight" (bukan logo NASA) + nama tim + "Bandung, Indonesia" | "Second Sight, by [team], Bandung." |
| 0:02-0:06 | Kalender **mentah**: lompatan warna tajam di 2012; teks "+[hasil]× overnight?" | "When satellites change, fire history lies. Indonesia's record jumps [hasil]× in 2012, and MODIS is about to switch off." |
| 0:06-0:10 | Peta gambut Kalimantan, titik VIIRS malam berpendar, MODIS kosong | "Worst of all in smouldering peat, where MODIS sees [hasil]× less at night." |
| 0:10-0:18 | Toggle ke **harmonisasi**: lompatan hilang; overlay "Calibrated 2012-2021, peat-aware, day/night, NASA FIRMS MODIS + VIIRS" | "Second Sight rebuilds 25 years of NASA FIRMS data on one honest scale, with uncertainty in every cell." |
| 0:18-0:24 | Kartu "Sep 2026: rank 1 of [N] El Niño years" + brief PDF Bahasa Indonesia | "So a disaster agency can ask: is this season worse than past El Niños? And get a verified brief in seconds." |
| 0:24-0:30 | Panel validasi singkat (satu angka) + peta dunia dengan wilayah uji transfer | "Validated against Indonesia's official records, ready for a world without MODIS." |

Aturan produksi:
- Rekam layar aplikasi asli; tidak ada mockup.
- Gambar atau suara buatan AI harus diberi watermark/pengakuan.
- Tidak memakai logo/branding NASA di konten buatan AI.
- Subtitle Inggris dibakar ke video.
- Uji durasi: ekspor final ≤ 30,0 detik.

### 8.2 Tujuh slide (EN)

| # | Judul | Isi | Kriteria |
|---|---|---|---|
| 1 | **Second Sight — Seeing the fires MODIS missed** | Nama tim, anggota, challenge, Bandung, satu screenshot kalender | Presentation |
| 2 | **The problem: five hidden seams** | Kalender mentah dengan 5 penanda seam; "S-NPP stopped 2 Nov 2026; MODIS ends 2026-27"; angka 2026 Indonesia; "3 agencies, 3 different numbers" | Impact, Relevance |
| 3 | **Who needs it** | 3 persona (BPBD, pengelola KHG, Manggala Agni) + pertanyaan mereka; kutipan wawancara jika ada | Impact |
| 4 | **How it works (NASA data at the core)** | Diagram pipeline: FIRMS MODIS C6.1 + VIIRS 375 m → fire cell-days → calibration 2012-2021 by region × season × day/night × **peat** → one Aqua-equivalent series + uncertainty → El Niño-aware baseline | Relevance, Validity |
| 5 | **What we found** | Grafik gambut vs mineral × siang/malam; grafik drift orbit; FRP floor (pilih 2) | Creativity, Validity |
| 6 | **How sure are we** | Tabel ringkas: seam test, LOYO, MODIS-sunset KGE, Spearman vs SiPongi, uji transfer global | Validity |
| 7 | **Try it / what's next** | Screenshot kalender + brief; link app, repo, video; roadmap (Himawari diurnal, integrasi muka air gambut, adopsi BPBD); pengakuan AI | Impact, Presentation |

### 8.3 Struktur project page (field resmi)

| Field | Isi yang disarankan |
|---|---|
| **Project Name** | Second Sight |
| **High-Level Summary** (±150-200 kata) | Masalah (seams + gambut + angka berbeda) → solusi (satu skala Aqua-equivalent, peat-aware, El Niño-aware, uncertainty) → pengguna (BPBD, KHG, Manggala Agni) → bukti (satu-dua angka validasi) → why now (S-NPP, MODIS) → skalabilitas global |
| **Link to Project Demo** | Video 30 detik (YouTube unlisted/publik) |
| **Link to Final Project** | URL aplikasi (static host) + repo GitHub publik |
| **Detailed Description** | Subbagian: What it does · How it works (pipeline + rumus inti) · Science decisions (D-1…D-14 ringkas) · Validation (tabel) · Peat finding · Orbit-drift finding · Limitations · Benefits for users · Global scalability (uji transfer) · Tools & languages |
| **Use of SI** | Jujur dan spesifik: riset literatur dan benchmark, perumusan ide/PRD (dengan konfirmasi CP), bantuan kode bagian X/Y, penulisan brief (LLM dengan verifier). Kode/data yang dibantu AI ditandai di repo (`docs/ai_acknowledgement.md`, komentar header file) |
| **NASA Data** | FIRMS MODIS C6.1 (MCD14ML SP + NRT), VIIRS 375 m C2 (VNP14IMG, VJ114IMG, VJ214IMG SP + NRT), MODIS CMG MOD14CMQ/MYD14CMQ, MCD64A1, FIRMS missing_data API. Untuk setiap data: apa, bagaimana dipakai, mengapa penting |
| **Space Agency Partner Data & Other References** | Bila memakai: data JAXA (Himawari, future work), CONAE (konteks challenge). Referensi: paper (§13.4), repo yang tekniknya dipinjam (§3H) dengan lisensi, pustaka open source, data non-NASA (PEATMAP/BBSDLP, geoBoundaries, NOAA CPC, BoM, CHIRPS, SiPongi) |

Gambar yang diunggah (JPG/PNG/GIF ≤10 MB): kalender sebelum/sesudah, grafik gambut, grafik drift, tabel validasi, screenshot brief.

### 8.4 Pitch live 21 November (lokal, mitra BRIN)

Format belum diumumkan; siapkan versi **5 menit + 5 menit tanya-jawab**, dan versi 3 menit.

**Struktur 5 menit:**

| Menit | Isi | Catatan |
|---|---|---|
| 0:00-0:40 | Hook: "Tiga lembaga, tiga angka, satu hari yang sama" atau kalender mentah yang melompat di 2012 | Pilih satu |
| 0:40-1:30 | Masalah: lima seam + gambut + MODIS berakhir | Angka nyata, sumber disebut |
| 1:30-3:30 | **Demo langsung:** pilih KHG/kabupaten → kalender mentah → toggle harmonisasi → bulan ini vs El Niño → Lab Sains (gambut, drift) → unduh brief | Latih minimal 5 kali; siapkan video cadangan jika demo gagal |
| 3:30-4:20 | Validasi: satu slide tabel; satu kalimat tentang uji transfer global | Fokus angka, bukan jargon |
| 4:20-5:00 | Dampak + rencana adopsi (mis. pilot dengan BPBD/BRGM) + ajakan | Tutup dengan tagline |

**Kebiasaan yang membantu di depan juri BRIN:**
- Sebut istilah dengan tepat: "titik panas/hotspot", "confidence", "fire cell-days", "setara Aqua-MODIS".
- Akui keterbatasan sebelum ditanya.
- Hormati sistem nasional: posisikan Second Sight sebagai pelengkap sejarah untuk SiPongi/BRIN, bukan pengganti.

### 8.5 Momen wow (urut prioritas untuk demo live)

1. **Toggle raw → harmonized** dengan animasi (lompatan 2012 hilang).
2. **"Peringkat ke-n dari N tahun El Niño"** untuk bulan berjalan.
3. **Grafik gambut malam vs siang** (jika H1/H2 terbukti).
4. **Grafik drift orbit** (rasio teramati mengikuti prediksi fisika).
5. **Brief siaga** yang angkanya bertanda terverifikasi.

---

## 9. Rencana 48 jam

**Waktu:** 14 Nov 09:00 WIB - 15 Nov 23:59 WIB (online). Setelah itu project page terkunci (hanya submission terakhir sebelum deadline yang dinilai). Persiapan pitch 21 Nov dilakukan 16-20 Nov **tanpa mengubah submission**. Tanyakan ke CP apakah aplikasi boleh diperbaiki setelah deadline untuk pitch lokal.

### 9.1 Peran (asumsi 5 orang; maks 6)

| Peran | Tanggung jawab | Blok |
|---|---|---|
| **R1 Data engineer** | Ingest, clean, mask, cells, agregasi, export bundle | D1-D7, S1, S11, E1-E3 |
| **R2 Scientist (harmonisasi)** | Kalibrasi, rantai, seri, baseline, ENSO, uji gambut | S2-S9, P10, V9 |
| **R3 Scientist (fisika & validasi)** | Validation plan, LOYO/LORO/seam/sunset/SiPongi/Field, FRP floor, drift, (operator) | V1-V12, P5, P6, (P4) |
| **R4 Frontend engineer** | Peta, kalender, layar 1-8, i18n, CSV, deploy | X1-X20, E4-E7 |
| **R5 Product & story** | PRD, wawancara pengguna, brief + verifier (dengan R4), video, slide, project page, Q&A, kepatuhan | A2-A4, §8, §11, §12 |
| (R6 opsional) | Backend LLM + eval, uji transfer global | A1-A4, §7.8 |

### 9.2 Jadwal

| Blok waktu | R1 Data | R2 Harmonisasi | R3 Fisika/Validasi | R4 Frontend | R5 Produk/Story |
|---|---|---|---|---|---|
| **H1 09:00-10:00** | Kickoff (semua): kunci konsep, nama, pertanyaan pengguna, wilayah fokus, Q1-Q8 (§6); buat repo (commit pertama) | ← | ← | ← | Fasilitasi; catat keputusan di `docs/` |
| **H1 10:00-13:00** | Unduh SP + NRT (atau firms-catalog), konversi Parquet, manifest | Unduh peta gambut, ONI/DMI, SiPongi BA | **Tulis `validation_plan.md`** (aturan uji sebelum melihat hasil) | Scaffold app, peta, PMTiles batas | Hubungi 1-2 praktisi untuk wawancara; draft README |
| **H1 13:00-17:00** | Clean, waktu lokal, A_pix, label, mask statis, `daily_cell` | Agregasi strata; κ 2012-2021 + shrinkage | Hitung jam lintas (drift) dari data; kurva R(F) awal | Komponen kalender (data dummy berlabel) | Persona & user story final; struktur project page |
| **H1 17:00-21:00** | `monthly_aoi` preset (provinsi, kabupaten, KHG) | Bootstrap tahun; rantai T→A, N20→SNPP; seri H | **V9 uji gambut** (hasil pertama), V1 LOYO | Kalender tersambung data nyata; toggle raw/harmonized | Template brief + fact table spec |
| **H1 21:00-24:00** | Export bundle v1; duckdb-wasm jalur AOI gambar | Baseline median + persentil + kelas ENSO + peringkat analog | V3 seam test + placebo, V5 sunset | Layar Bulan Ini; anotasi seam; tooltip | Verifier angka (dengan R4/R6) |
| **Checkpoint 24:00** | **Demo P0 harus jalan end-to-end** (kalender harmonisasi nyata untuk 1 AOI). Jika belum, potong P1 (§9.3) | | | | |
| **H2 00:00-06:00** | Istirahat bergilir (minimal 4 jam per orang) | | | | |
| **H2 06:00-10:00** | NRT 2026 top-up + data_health | Dekomposisi gambut/mineral, siang/malam di seri | V6 SiPongi, V8 Field, V4 drift (diurnal) | Lab Sains panel A-C | Draft high-level summary + detailed description |
| **H2 10:00-14:00** | Uji transfer global (bbox kedua) | Sensitivitas V7 | Tabel ablation M0-M5 | Panel Seberapa Yakin; Angka Resmi vs Harmonisasi | Brief end-to-end + eval 100 brief |
| **H2 14:00-18:00** | Freeze data v2; hash | Review angka bersama R3 | Validation report final | Polish UI, i18n EN, aksesibilitas, deploy | Rekam video (draft 1), slide 1-7 |
| **H2 18:00-21:00** | Bantu QA | QA angka di UI vs file hasil | QA klaim di teks vs hasil | Bug fix, performa, fallback offline | Video final ≤30 detik; project page lengkap |
| **H2 21:00-23:00** | **Submit lengkap pertama (target 21:30)**, lalu perbaikan kecil | | | | |
| **H2 23:00-23:59** | Buffer; resubmit terakhir sebelum 23:30 (jangan mepet) | | | | |

### 9.3 Garis potong (jika tertinggal)

| Jika terlambat di… | Potong (urut) | Pertahankan |
|---|---|---|
| Checkpoint 24:00 H1 | Operator Sofiev, koreksi awan CMG, query bahasa alami, kartu shareable | Kalender harmonisasi, toggle, bulan ini vs median, CSV, V9, V3 |
| 10:00 H2 | Uji transfer global → cukup 1 wilayah kecil atau jadikan "future work"; FRP floor → hanya grafik R(F) tanpa indeks | Drift (grafik jam lintas saja sudah kuat), SiPongi |
| 14:00 H2 | Brief LLM → **template murni** (tetap terverifikasi, tanpa LLM); Layar 6 → tabel sederhana | Panel Seberapa Yakin |
| 18:00 H2 | Semua polish visual | Video, project page, link publik yang jalan |

**Aturan:** tidak ada fitur baru setelah H2 18:00. Fokus ke kebenaran angka, video, dan project page.

### 9.4 Definition of done (untuk submit)

- [ ] Aplikasi publik tanpa login; kalender harmonisasi berjalan untuk preset dan AOI gambar/lat-lon.
- [ ] CSV agregat + CSV titik deteksi bisa diunduh.
- [ ] Panel Seberapa Yakin terisi dari `validation_results.json`.
- [ ] Video ≤30 detik, EN, subtitle, link publik.
- [ ] Project page: semua field wajib terisi, data NASA dijelaskan, referensi lengkap, pengakuan AI.
- [ ] Repo publik dengan README, LICENSE, docs, riwayat commit mulai 14 Nov.
- [ ] Tidak ada kunci/rahasia di repo.

---

## 10. Register risiko dan fallback

| # | Risiko | Kemungkinan | Dampak | Mitigasi | Fallback |
|---|---|---|---|---|---|
| R1 | Unduh arsip FIRMS lambat/gagal | Sedang | Tinggi | Request archive malam 13 Nov; paralel CSV negara | Mirror firms-catalog; atau subset Kalteng+Riau saja |
| R2 | Peta gambut BBSDLP tidak bisa diakses | Sedang | Sedang | Cek 14 Nov pagi | PEATMAP global |
| R3 | Batas KHG tidak tersedia | Tinggi | Rendah-sedang | Cari sumber resmi | Kabupaten + overlay gambut; 3-5 KHG digitasi indikatif berlabel |
| R4 | Hipotesis gambut tidak terbukti | Sedang | Sedang | Aturan keputusan ditulis dulu | Laporkan null; cerita bertumpu pada baseline El Niño + seam |
| R5 | Strata terlalu kecil → κ tidak stabil | Sedang | Sedang | Shrinkage; musim 3 kelas | Gabungkan strata (hapus musim) |
| R6 | Koefisien operator Sofiev salah | Sedang | Rendah (P2) | Cek repo/paper | Hilangkan panel D |
| R7 | Model diurnal tidak cocok data | Sedang | Rendah | Diperlakukan sebagai diagnostik | Tampilkan hanya grafik jam lintas + rasio teramati |
| R8 | Angka di UI tidak cocok dengan hasil pipeline | Rendah | **Sangat tinggi** (kredibilitas) | Semua angka dari file; QA R2/R3 | Hapus angka yang tidak bisa diverifikasi |
| R9 | LLM gagal/lambat saat demo | Sedang | Rendah | Cache + template | Template murni |
| R10 | Demo gagal saat pitch live | Rendah-sedang | Tinggi | Bundle offline, laptop cadangan | Video demo 2-3 menit (pitch) + video 30 detik |
| R11 | Video >30 detik / slide >7 | Rendah | **Fatal (global)** | Checklist + ukur | — |
| R12 | Sensitivitas institusional (SiPongi/BRIN) | Sedang | Sedang | Nada "melengkapi"; sumber jelas | Panel 6 versi tabel netral |
| R13 | Tuduhan pre-build atau penyalinan | Rendah | Tinggi | Commit mulai 14 Nov; §3H lisensi; referensi lengkap | — |
| R14 | Klaim angka 2026 dari media salah | Sedang | Sedang | Pakai angka dari data FIRMS sendiri | Tandai sumber media secara eksplisit |
| R15 | Scope creep | **Tinggi** | Tinggi | Garis potong §9.3; maks 3 momen sains | — |
| R16 | Kelelahan tim | Tinggi | Sedang | Istirahat bergilir H2 00:00-06:00 | — |

---

## 11. Bank pertanyaan juri dan jawaban

Jawaban berikut adalah kerangka. Angka `[hasil]` diisi dari validasi.

### 11.1 Sains dan data

1. **"Kenapa tidak pakai VIIRS saja seperti BRIN?"**
   VIIRS baru ada sejak 2012. Tanpa harmonisasi, 12 tahun riwayat MODIS (2000-2011), termasuk 2002, 2004, 2006, dan 2009, tidak bisa dipakai sebagai pembanding. Tahun-tahun itu justru tahun El Niño yang menjadi analog musim 2026. Ke depan Second Sight memang bertumpu pada VIIRS (NOAA-20/21), tetapi dengan sejarah 25 tahun yang tersambung.

2. **"Kenapa skala MODIS, bukan VIIRS?"**
   Kita tidak bisa merekonstruksi api kecil yang tidak pernah dilihat MODIS sebelum 2012. Menurunkan VIIRS ke skala MODIS hanya membuang informasi yang tidak tersedia di era lama. Menaikkan MODIS ke skala VIIRS berarti mengarang data. Seri VIIRS-native tetap tersedia untuk 2012+.

3. **"Kenapa kalibrasi hanya 2012-2021?"**
   Orbit Aqua mulai bergeser dari 13:30 sekitar 2021-2022. Api tropis punya siklus harian yang memuncak siang-sore, sehingga pergeseran jam lintas mengubah hitungan MODIS. Panel drift menunjukkan [hasil].

4. **"Confidence berapa yang dipakai?"**
   MODIS ≥30 (nominal + tinggi) dan VIIRS nominal/tinggi, setara antar sensor. Uji sensitivitas dengan "tinggi saja" (≥80/h, sejalan dengan praktik "confidence tinggi" lembaga nasional) mengubah anomali 2026 sebesar [hasil].

5. **"Bagaimana dengan sumber panas industri dan gunung api?"**
   Data SP: `type ≠ 0` dibuang. Data NRT: mask sel yang secara historis berstatus sumber statis/industri/gunung api.

6. **"Bagaimana dengan awan dan asap?"**
   File titik FIRMS tidak memuat informasi awan. Sel-bulan dengan observasi terbatas ditandai di kalender. [P2: koreksi CMG `N'' = N'/(1 − f_cloud)` sesuai produk resmi MODIS, dengan catatan bahwa koreksi ini bisa overestimate di bawah awan hujan.]

7. **"Apakah rasio konstan dari tahun ke tahun?"**
   Tidak sepenuhnya. LOYO menunjukkan [hasil]; tahun ekstrem 2015/2019 menyimpang [hasil]. Karena itu interval ketidakpastian ditampilkan di setiap sel.

8. **"Apa bukti harmonisasinya berhasil?"**
   (a) Seam test pada seri rasio terhadap referensi: Δ_seam 2012 = [hasil], di dalam distribusi placebo. (b) LOYO. (c) "MODIS sunset": kalibrasi 2012-2016, rekonstruksi 2017-2021, KGE [hasil]. (d) Spearman vs luas terbakar SiPongi [hasil]. (e) Hubungan api-hujan (Field 2016) tetap sama sebelum dan sesudah 2012 [hasil].

9. **"Temuan gambut itu signifikan?"**
   Jawab sesuai hasil V9 dan aturan keputusan yang ditulis sebelum uji.

10. **"Kenapa tidak memakai machine learning?"**
    Rasio berstrata dengan shrinkage bisa dijelaskan, diaudit, dan cukup untuk menghilangkan seam (terbukti di V3). ML dipertimbangkan hanya jika menambah akurasi pada validasi blok, dan banyak tim sudah membawa ML tanpa validasi terhadap data resmi.

11. **"Hotspot itu bukan kebakaran."**
    Setuju. Second Sight mengukur aktivitas pembakaran yang terdeteksi satelit, dalam satuan fire cell-days. Luas terbakar resmi hanya dipakai sebagai pembanding peringkat.

12. **"Kenapa median, bukan rata-rata?"**
    Tahun ekstrem seperti 2015 menggelembungkan rata-rata. Median lebih mewakili "tahun biasa", sedangkan perbandingan dengan tahun ekstrem ditangani terpisah lewat baseline El Niño.

13. **"Bagaimana setelah S-NPP dan MODIS mati?"**
    NOAA-20 diikat ke S-NPP (overlap 2018-2026, faktor [hasil]), dan backtest "MODIS sunset" menunjukkan seri tetap konsisten tanpa MODIS.

### 11.2 Produk dan dampak

14. **"Siapa yang akan memakai, dan apa yang berubah?"** Persona BPBD/KHG/Manggala Agni + kutipan wawancara jika ada + contoh keputusan.
15. **"Kenapa angka kalian beda dengan SiPongi?"** Perbedaan sensor, filter confidence, unit hitung (sel unik vs deteksi), dan jumlah satelit. Second Sight melengkapi SiPongi dengan sejarah yang konsisten.
16. **"Bagaimana adopsinya?"** Static app murah dioperasikan; pipeline bisa dijalankan bulanan; rencana pilot dengan satu BPBD/KHG; data terbuka.
17. **"Apakah bisa dipakai di luar Indonesia?"** Ya: uji transfer di [wilayah] tanpa mengubah kode, hasil [hasil].
18. **"Apa peran AI?"** AI dipakai untuk riset, perumusan ide/PRD (dikonfirmasi CP), bantuan kode tertentu, dan penulisan brief. Angka selalu dari pipeline dan diverifikasi otomatis; eval: [hasil].

### 11.3 Teknis

19. **"Bagaimana AOI gambar dihitung cepat?"** duckdb-wasm membaca Parquet terpartisi via HTTP range, tanpa server berat.
20. **"Bagaimana reproducibility-nya?"** Pipeline bertahap deterministik, manifest data + hash, notebook validasi, data sampel.
21. **"Apa bedanya dengan tim X (Kiln Watch/Fire Harmony)?"** Kalibrasi berstrata gambut yang diuji, pembatasan kalibrasi pra-drift + bukti drift, baseline El Niño, validasi terhadap data resmi Indonesia, unit KHG, brief terverifikasi Bahasa Indonesia. Hargai pekerjaan mereka; jangan merendahkan.

---

## 12. Checklist kepatuhan submission

### 12.1 Sebelum mulai (14 Nov 09:00)
- [ ] Semua anggota terdaftar di Local Event Bandung yang sama (tidak waitlisted), maks 6.
- [ ] Repo baru dibuat **setelah** 09:00; tidak ada kode sebelum itu.
- [ ] Bukti tertulis konfirmasi CP soal penggunaan AI untuk ide/PRD disimpan.

### 12.2 Isi submission
- [ ] Menjawab challenge resmi "Harmonization of MODIS and VIIRS Hot Spots".
- [ ] Semua field wajib terisi: Project Name, High-Level Summary, Link to Project Demo, Link to Final Project, Detailed Description, Use of SI, NASA Data, Space Agency Partner Data & Other References.
- [ ] Demo: **video ≤30 detik ATAU ≤7 slide termasuk judul**.
- [ ] Semua dalam bahasa Inggris (subtitle Inggris untuk video).
- [ ] Link publik tanpa login/izin (cek dari browser incognito).
- [ ] Minimal satu data NASA dipakai sebagai **inti** (FIRMS MODIS/VIIRS) dan dijelaskan.
- [ ] Semua resource eksternal (kode, teks, gambar, open source, teknik pinjaman dari repo lain) tercantum di References, beserta lisensinya.
- [ ] Pengakuan SI: teks deskripsi + metadata kode/data; watermark pada gambar/video buatan AI; tidak ada branding NASA di konten buatan AI.
- [ ] Tidak ada gambar/video/suara anak di bawah 18 tahun.
- [ ] Centang deklarasi T&C dan "original work".
- [ ] Submit lengkap pertama ≥2 jam sebelum deadline; resubmit terakhir sebelum 23:30 WIB 15 Nov.

### 12.3 Setelah submit
- [ ] Cek ulang semua link dari perangkat lain.
- [ ] Siapkan pitch 21 Nov (tanpa mengubah submission kecuali diizinkan).
- [ ] Pantau pengumuman: Global Nominee 3 Des, Finalist 17 Des, Winner 26 Jan 2027.

---

## 13. Lampiran

### 13.1 Kartu rumus (satu halaman)

| Nama | Rumus | Sumber |
|---|---|---|
| Planck | `B_λ(T) = c1 / (λ⁵ (e^(c2/λT) − 1))`, c1 = 1,191×10⁸, c2 = 14.388 µm·K | Fisika dasar |
| Piksel campuran | `L = p·B(Tf) + (1−p)·B(Tb)`, `p = A_fire/A_pix` | Dozier 1981 |
| FRP (MIR) | `FRP = (A_pix σ / (τ4 a)) (L4 − L̄4)`, a = 3,0×10⁻⁹ | Wooster 2003; Giglio 2016 |
| Luas piksel | `A_pix ≈ scan × track` | FIRMS |
| Geometri MODIS | `S = Re·s·(cosθ/√((Re/r)² − sin²θ) − 1)`, `T = r·s·(cosθ − √((Re/r)² − sin²θ))` | Ichoku & Kaufman 2005 |
| Bahan bakar | `M = 0,368 kg/MJ × FRE` | Wooster 2005 |
| Operator deteksi | `P_det = max(0, σ(r(A)(P − (αA+β))) − c0)/(1 − c0)` | Sofiev & Kouznetsov 2026 |
| Koreksi awan | `N'' = N'/(1 − f_cloud)` | Giglio, Csiszar & Justice 2006 |
| Diurnal | `f(t) = b + exp(−(t − h)²/(2s²))` | Vermote 2009; Ellicott 2009 |
| Kalibrasi EB | `κ̂ = (a + ΣA)/(b + ΣV)` | Gamma-Poisson (Gelman et al.) |
| Robust z | `z = (x − median)/(1,4826·MAD)` | Leys et al. 2013 |
| Pettitt | `K = max|U_t|`, `p ≈ 2 exp(−6K²/(n³+n²))` | Pettitt 1979 |
| Theil-Sen | `β = median((x_j − x_i)/(t_j − t_i))` | Sen 1968 |
| KGE | `1 − √((r−1)² + (α−1)² + (β−1)²)` | Gupta et al. 2009 |
| Ambang Field | Api naik nonlinier saat hujan musim kering < ~4 mm/hari | Field et al. 2016 |

### 13.2 Daftar periksa angka sebelum dipakai di pitch

Setiap angka di video, slide, project page, atau pitch harus:
1. berasal dari file hasil pipeline atau sumber resmi yang dikutip dengan tanggal;
2. sama persis di semua artefak;
3. punya interval atau catatan ketidakpastian bila relevan;
4. diperiksa oleh dua anggota tim.

### 13.3 Template tabel ablation (diisi dari data)

| ID | Metode | KGE overlap | Bias % | LOYO MdAPE | Sunset KGE | Δ_seam 2012 | Pettitt p | Spearman SiPongi | Coverage 90% | Parameter di-fit |
|---|---|---|---|---|---|---|---|---|---|---|
| M0 | Raw concat (MODIS → VIIRS) | | | | | | | | n/a | 0 |
| M1 | Rasio global tunggal | | | | | | | | | 1 |
| M2 | Rasio per wilayah × musim | | | | | | | | | |
| M2b | Quantile mapping (pola burn-calendar) | | | | | | | | | |
| **M3** | **Second Sight: strata + gambut + siang/malam + EB, kalibrasi 2012-2021** | | | | | | | | | |
| M3x | M3 tetapi kalibrasi 2012-2025 (uji efek drift) | | | | | | | | | |
| M4 | M3 + koreksi awan (P2) | | | | | | | | | |
| M5 | Indeks api besar (FRP floor) | | | | | | | | n/a | 1 (F\*) |
| M6 | Operator Sofiev (tanpa fitting lokal) (P2) | | | | | | | | | 0 lokal |

Baris **M3x** sangat penting: jika kalibrasi yang memasukkan 2022-2025 lebih buruk di sunset/seam test, itu bukti kuantitatif bahwa keputusan D-3 benar.

### 13.4 Daftar pustaka inti

**Sensor dan produk**
- Giglio, L., Schroeder, W., Justice, C.O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. *Remote Sensing of Environment* 178:31-41.
- Giglio, L., Schroeder, W., Hall, J.V. (2021). MODIS Collection 6/6.1 Active Fire Product User's Guide.
- Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. (2014). The New VIIRS 375 m active fire detection data product. *RSE* 143:85-96.
- VIIRS 375 m Active Fire Collection 2 User Guide v1.2 (2025).
- Csiszar, I. et al. (2014). Active fires from the Suomi NPP VIIRS: product status and first evaluation results. *JGR-Atmospheres* 119:803.
- Ichoku, C., Kaufman, Y.J. (2005). A method to derive smoke emission rates from MODIS fire radiative energy measurements. *IEEE TGRS*.

**Fisika deteksi dan FRP**
- Sofiev, M., Kouznetsov, R. (2026). *Geosci. Model Dev.* 19:10123-10142 (observation operator MODIS/VIIRS). Kode: github.com/fmidev/FRP_OOp.
- Wooster, M.J. et al. (2003; 2005). FRP/FRE dan konsumsi bahan bakar (0,368 kg/MJ). *RSE*, *JGR*.
- Freeborn, P.H. et al. (2014). Ketidakpastian FRP MODIS.
- Dozier, J. (1981); Giglio, L., Kendall, J.D. (2001).

**Harmonisasi dan perbandingan sensor**
- Vadrevu, K., Lasko, K. (2018). *Remote Sensing* 10:978.
- Fu, Y. et al. (2020). *Remote Sensing* 12:2870.
- Li, F., Zhang, X., Kondragunta, S., Csiszar, I. (2018). *JGR-Atmospheres* 123:4545.
- Li, F., Zhang, X., Kondragunta, S. (2020). *Remote Sensing* 12:1561.
- Kaur, I. et al. (2019). *Remote Sensing* 11:1205.
- Zheng et al. (2026). *Remote Sensing* 18:1650.

**Siklus harian dan observation opportunity**
- Giglio, L., Csiszar, I., Justice, C.O. (2006). Global distribution and seasonality of active fires as observed with Terra and Aqua MODIS. *JGR-Biogeosciences* 111.
- Giglio, L. (2007). Characterization of the tropical diurnal fire cycle using VIRS and MODIS observations. *RSE* 108:407.
- Vermote, E. et al. (2009); Ellicott, E. et al. (2009); Andela, N. et al. (2015). Model diurnal FRP.

**Indonesia, gambut, iklim**
- Field, R.D., van der Werf, G.R., Shen, S.S.P. (2009). *Nature Geoscience* 2:185.
- Field, R.D. et al. (2016). *PNAS* 113:9204 (ambang ~4 mm/hari).
- Pan, X., Chin, M., Ichoku, C., Field, R.D. (2018). *JGR-Atmospheres*.
- Atwood, E.C. et al. (2016). *PLoS ONE* 11:e0159410.
- Sofan, P. et al. (2019, 2020). *Remote Sensing*; *Int. J. Digital Earth* 13:1695.
- Vetrita, Y. et al. (2021). *Environ. Res. Lett.* 16:035015.
- Kiely, L. et al. (2019). *ACP* 19:11105.
- Wooster, M.J. et al. (2018). *Remote Sensing* 10:495.
- Huijnen, V. et al. (2016). *Sci. Rep.* 6:26886.
- Nechita-Banda, N. et al. (2018). *Phil. Trans. R. Soc. B*.
- Anda, M. et al. (2021). *Geoderma* 402:115235 (peta gambut Indonesia).
- Xu, J. et al. (2018). PEATMAP. *Catena*.
- Nikonovas, T. et al. (2022). ProbFire. *NHESS* 22:303.
- Mezbahuddin, S. et al. (2023). *Sci. Rep.*

**Statistik**
- Pettitt, A.N. (1979). *Applied Statistics* 28:126.
- Killick, R. et al. (2012). PELT. *JASA*.
- Sen, P.K. (1968); Hamed, K.H., Rao, A.R. (1998).
- Leys, C. et al. (2013). Robust z (MAD).
- Gupta, H.V. et al. (2009). KGE. *J. Hydrology*.
- Gelman, A. et al. (2013). *Bayesian Data Analysis*, 3rd ed.

**Visualisasi**
- van der Walt & Smith (2015) viridis; Nuñez et al. (2018) cividis; Harrower & Brewer (2003) ColorBrewer; Crameri et al. (2020) *Nat. Commun.* 11:5444.

**Repo dan data yang tekniknya dipinjam:** lihat §3H (dengan lisensi).

### 13.5 Ringkasan satu paragraf (untuk dibagikan ke anggota tim)

Second Sight mengubah 25 tahun data hotspot NASA FIRMS (MODIS dan VIIRS) menjadi satu kalender aktivitas pembakaran 2001-sekarang dalam skala setara Aqua-MODIS. Kalibrasinya terpisah untuk wilayah, musim, siang/malam, dan gambut vs mineral; memakai periode 2012-2021 sebelum orbit Aqua bergeser; dan menyertakan interval ketidakpastian di setiap sel. Pengguna BPBD, pengelola KHG, dan Manggala Agni bisa melihat apakah bulan ini lebih buruk dari median dan dari tahun-tahun El Niño sebelumnya, lalu mengunduh CSV dan brief Bahasa Indonesia yang angkanya terverifikasi. Hasilnya dibuktikan dengan seam test di semua sambungan satelit, backtest "MODIS mati", korelasi dengan luas terbakar resmi SiPongi, uji fisik hubungan api-hujan, dan uji transfer ke wilayah lain di dunia. Ceritanya lokal (gambut Indonesia), metodenya global.
