# 05 · Sains dan Data: Fondasi Harmonisasi MODIS-VIIRS (Fokus Indonesia)

> Ringkasan terkurasi. Detail lengkap, kutipan, dan daftar sumber ada di [_raw/sains-dan-data.md](_raw/sains-dan-data.md).
> Penanda sumber: **[V]** = dicek ke dokumen primer, **[S]** = dari abstrak, ringkasan, atau media.
> Pendekatan fisika dan statistik tingkat lanjut dibahas terpisah di [06-pendekatan-teknis-lanjutan.md](06-pendekatan-teknis-lanjutan.md).

## 1. Fakta sensor yang harus dikuasai tim

| Aspek | MODIS C6.1 (Terra/Aqua) | VIIRS 375 m C2 (S-NPP / NOAA-20 / NOAA-21) |
|---|---|---|
| Produk | MOD14/MYD14, MCD14ML (standar), MCD14DL (NRT) | VNP14IMG, VJ114IMG, VJ214IMG |
| Piksel nadir | ~1 km | ~0,36 × 0,38 km |
| Piksel tepi scan | ~2,0 × 4,8 km (**~9,7× luas nadir**) | ~0,78 × 0,80 km (lebih seragam) |
| Celah swath di tropis | **Ada** (memengaruhi Indonesia) | Praktis tidak ada |
| Deteksi minimum | Rutin ~1.000 m², ideal ~50 m² [V] | Jauh lebih kecil; angka "~5 m²" hanya dari blog GFW [belum terverifikasi] |
| Confidence | 0-100: rendah 0-29, nominal 30-79, tinggi 80-100 [V] | low / nominal / high [V] |
| Field `type` | 0 vegetasi, 1 gunung api, 2 sumber statis darat, 3 offshore. **Hanya di produk standar, tidak di NRT** [V] | Sama. Bug label type diperbaiki Mei 2025, jadi pakai file reprocess v3 [V] |
| Overpass desain | Terra ~10:30 & 22:30; Aqua ~13:30 & 01:30 | ~13:30 & 01:30 (NOAA-20 berselisih ~50 menit dari S-NPP) |

Contoh ekstrem satu hari (Mekong, 1 Mar 2016) dari user guide VIIRS: siang S-NPP 9.643 piksel api vs Aqua 361 (~27×); malam 4.608 vs 22 [V].

**Peringatan dari user guide MODIS:** deret waktu dengan bin lebih pendek dari ~8 hari bias. Gunakan bin **bulanan atau 8-harian** untuk kalender [V].

## 2. Status misi per 13 November 2026 (konteks penting untuk pitch)

| Satelit | Status | Sumber |
|---|---|---|
| **Suomi-NPP** | Produksi FIRMS **berhenti 2 Nov 2026** (13:00 UTC menurut blog, 15:40 UTC menurut FAQ). Arsip 20 Jan 2012 sampai 2 Nov 2026 tetap tersedia. Ganti sumber API ke `VIIRS_NOAA20_NRT` / `VIIRS_NOAA21_NRT` | FIRMS blog & FAQ [V] |
| **Aqua** | Orbit **drift**: 13:37 (Jan 2022) → ~15:45 (Agu 2026) | Grafik NASA HQ di presentasi Giglio Mei 2025, proyeksi "maximally extended" [S] |
| **Terra** | Drift ~10:15 (2022) → ~09:00 (awal 2026); shutdown sekitar Mar-Apr 2027 | Sama; tanggal akhir saling bertentangan antar sumber |
| NOAA-20, NOAA-21 | Beroperasi, menjadi tumpuan masa depan | — |
| Orbit pagi | Terra satu-satunya sumber pagi; NASA "investigating alternatives". CAMS beralih ke Sentinel-3 | FIRMS [V], CAMS [S] |

**Implikasi metodologis terpenting:** karena Aqua sudah bergeser dari 13:30 sejak 2022, **kalibrasi MODIS↔VIIRS sebaiknya hanya memakai 2012-2021**, saat kedua sensor masih lewat di jam yang sama. Data Aqua 2022-2026 justru bisa dipakai untuk **membuktikan efek drift**. Ini poin "defensible" yang belum banyak dipakai pesaing.

## 3. Kenapa angka VIIRS dan MODIS berbeda: tujuh sumber ketidakkonsistenan

1. **Resolusi dan sensitivitas.** VIIRS melihat api kecil dan dingin yang tidak terlihat MODIS. Ini sinyal nyata, bukan artefak.
2. **Geometri scan.** Piksel MODIS membesar ~9,7× di tepi scan, VIIRS hanya ~4,5×. Ditambah celah swath MODIS di tropis dan duplikat dari bow-tie serta overlap orbit.
3. **Waktu lintas.** Siklus harian api tropis memuncak sore hari, sementara Terra lewat pagi, ditambah drift orbit setelah 2021.
4. **Pergantian platform VIIRS.** Jumlah satelit VIIRS aktif berubah (1 → 2 → 3 → 2). Menjumlahkan semua satelit menggelembungkan hitungan.
5. **Awan dan asap.** File titik FIRMS tidak memuat informasi awan atau no-data. Asap tebal paradoksnya bisa **menurunkan** hitungan justru saat kebakaran paling parah [S].
6. **Sumber statis.** Flare gas, industri, dan gunung api harus dibuang (`type≠0`). NRT tidak punya `type`, sehingga perlu mask statis buatan sendiri.
7. **Celah data.** Hari tanpa data tidak boleh dibaca sebagai "nol api" (cek `/api/missing_data/`).

## 4. Bukti empiris rasio VIIRS/MODIS dari literatur

| Studi | Wilayah | Temuan |
|---|---|---|
| Vadrevu & Lasko 2018 | Punjab (pertanian) | VIIRS **6,5×** Aqua; 4,8× Terra+Aqua; ΣFRP VIIRS ~2,5× MODIS |
| Fu et al. 2020 | Asia Timur Laut | MODIS melewatkan 65% (hutan) sampai 83% (biomassa rendah) piksel VIIRS |
| Li et al. 2018 | Global | FRP VIIRS ~20% lebih besar; MODIS sangat bergantung pada sudut pandang (VZA) |
| Li et al. 2020 | Afrika | FRP harian MODIS terlalu rendah **≥42,8%** |
| Kaur et al. 2019 | Global (GFAS) | Quantile mapping FRP |
| **Zheng et al. 2026** [V] | Global, 2012-2024 | Agregasi VIIRS di dalam footprint MODIS, pasangan ≤5 menit, model rasio FRP vs VZA (R²≈98%); produk fusi ~3,82× piksel MODIS |
| Sofiev & Kouznetsov 2026 | Global | POD api kuat 78% (MODIS) / 88% (VIIRS); di sebagian wilayah ekuatorial **<30% / <40%** |

**Kesimpulan:** rasio berkisar **~2× sampai >25×**. Paling tinggi malam hari, di lanskap api kecil/membara (pertanian, gambut), dan di tropis. **Rasio tunggal global tidak dapat dipertahankan secara ilmiah.** Rasio harus spesifik wilayah, musim, dan siang/malam. Belum ditemukan rasio peer-reviewed khusus Indonesia atau gambut. Ini sekaligus celah riset yang bisa kita isi.

## 5. Konteks Indonesia

### Musim dan iklim
- Pembakaran naik Agustus, **puncak September-Oktober**.
- Tahun besar terkait **El Niño + IOD positif**: 1997, 2006, 2015, 2019, 2023 (Field et al. 2009; Pan et al. 2018). Episode lebih kecil: 2002, 2004.
- Pan et al. 2018: api selalu lebih intens di **Kalimantan selatan** daripada Sumatra selatan pada semua kejadian El Niño.

### 2026: tahun El Niño kuat, studi kasus demo yang sangat kuat
- >96.000 hotspot sampai 27 Jul 2026, tertinggi untuk tanggal itu (2019 ~88.000, 2023 ~58.000) [S, Mongabay].
- SiPongi 21 Sep 2026: **22.293 hotspot dalam 24 jam**; Kalteng 12.046 [S, Databoks].
- Nusantara Atlas: ~**1,92 Mha** terbakar sampai akhir Sep 2026, sementara angka resmi pemerintah 202.000 ha untuk Jan-Jul [S]. Selisih ini sendiri menarik untuk narasi.
- Asap gambut Indonesia menyelimuti Malaysia (Sep 2026) [S, NST].

### Kebakaran gambut
- Membara (*smouldering*), bersuhu rendah, kecil, sering di bawah permukaan, sehingga sulit dideteksi dari orbit.
- Sofan et al. 2019: POD VIIRS ~**71%** terhadap ground truth di Kalteng. Sofan et al. 2020: VIIRS malam ~80% untuk api <14 ha; siang+malam dengan buffer klaster 375 m mencapai **POD ~90%**.
- Tahun 2015: **53% api di gambut**, padahal gambut hanya 12% luas daratan (Miettinen et al. 2017).
- **Implikasi:** MODIS kemungkinan meng-underestimate api gambut lebih parah daripada VIIRS, sehingga **rasio VIIRS/MODIS di gambut kemungkinan lebih tinggi** daripada di tanah mineral. Ini justifikasi ilmiah untuk **kalibrasi terpisah gambut vs non-gambut**, celah yang belum diisi pesaing.

### Praktik resmi Indonesia (sumber angka berbeda-beda)

| Sistem | Sensor | Catatan |
|---|---|---|
| **SiPongi** (Kemenhut) | Terra/Aqua + S-NPP + NOAA | Kelas confidence 0-29 / 30-79 / 80-100 (identik MODIS). Pemetaan VIIRS l/n/h ke skala ini belum diketahui |
| **BRIN** (eks-LAPAN) | **VIIRS saja** (S-NPP, NOAA-20) | Menegaskan hotspot ≠ kejadian kebakaran |
| **ASMC** (ASEAN) | NOAA-20 sejak 2019 | Teks harian per pass untuk Sumatra & Kalimantan |
| Pantau Gambut | Ikut memakai confidence rendah & sedang | — |

**Angka hotspot antar-lembaga tidak bisa langsung dibandingkan.** Ini masalah harmonisasi nyata di Indonesia yang langsung relevan dengan challenge.

### Luas terbakar resmi untuk validasi tahunan [S]

| Tahun | Luas (ha) | Catatan |
|---|---|---|
| 2015 | 2.611.411 | Terbesar dekade terakhir |
| 2017 | 165.484 | Terendah |
| 2019 | 1.649.258 | FireWatch: >2,6 Mha |
| 2023 | 1.161.193 | FireWatch: 1,7 Mha |
| 2026 | 202.000 (Jan-Jul, resmi) | Nusantara Atlas ~1,92 Mha (Jan-Sep) |

Karena metodenya berbeda, gunakan **korelasi rank (Spearman)**, bukan kecocokan absolut.

## 6. Akses data

| Jalur | Detail |
|---|---|
| **CSV tahunan per negara** (teruji) | `firms.modaps.eosdis.nasa.gov/data/country/{modis\|viirs-snpp\|viirs-jpss1}/YYYY/..._YYYY_Indonesia.csv` tersedia **2000-2025**. Path NOAA-21 belum ditemukan; file 2026 masih 404 |
| FIRMS API | MAP_KEY gratis; **5.000 transaksi per 10 menit**; `DAY_RANGE` 1-5 hari per panggilan. Untuk 2026 pakai area API `*_NRT`/`*_SP` atau Archive Download |
| Celah data | `/api/missing_data/` |
| Raster pendukung | MOD14A1/MYD14A1/VNP14A1 (fire mask harian, termasuk info awan), MODIS CMG (`CloudCorrFirePix`), MCD64A1 (burned area) |

## 7. Metode yang direkomendasikan untuk 48 jam

### Target besaran

**H(wilayah, bulan) = indeks aktivitas pembakaran dalam unit "fire cell-days setara Aqua-MODIS".**

Alasan memilih jangkar Aqua: Aqua dan VIIRS sama-sama dirancang lewat ~13:30, rekaman pagi akan berakhir bersama Terra, dan baseline 2003-2021 tetap "native" tanpa koreksi.

### Pipeline

1. **Data:** CSV standar per negara (MODIS 2000-2025, S-NPP 2012-2025, NOAA-20 2018-2025) + API untuk 2026.
2. **Filter:** `type == 0` (mask statis untuk NRT); MODIS confidence ≥30, VIIRS n/h; siang dan malam dipisah.
3. **Fire cell-days:** snap ke grid 0,01° (~1,1 km), hitung sel unik per (tanggal lokal, satelit, siang/malam). Ini menghapus duplikat dan meredam efek resolusi.
4. **Satu satelit VIIRS per waktu:** S-NPP sampai 2 Nov 2026, lalu NOAA-20 yang dikalibrasi ke S-NPP pada overlap 2018-2026. **Jangan menjumlahkan satelit.**
5. **Kalibrasi VIIRS→Aqua (2012-2021 saja):** k_s = ΣAqua / ΣVIIRS (*ratio of sums*) per stratum s = (wilayah × bulan/musim × siang/malam). Wilayah: Sumatra, Kalimantan, Sulawesi, Papua, Jawa-Nusa Tenggara. **Opsional tetapi diferensiator: gambut vs non-gambut.** Shrink ke stratum induk bila sampel sedikit: k̂ = (n·k_s + n₀·k_induk)/(n + n₀). Interval 90% dari **bootstrap per tahun**.
6. **Jembatan Terra (Nov 2000-Jun 2002):** faktor Aqua/Terra dari 2002-2005.
7. **Susun seri:**

   | Periode | Sumber |
   |---|---|
   | 2000-11 → 2002-06 | Terra × r |
   | 2002-07 → 2021-12 | Aqua native |
   | 2022-01 → sekarang | VIIRS × k |

   Aqua yang sudah drift (2022-2026) hanya dipakai untuk validasi.
8. **Kalender & anomali:** bin bulanan; baseline median per bulan-kalender 2003-2022; tampilkan **rasio terhadap median, robust z-score (MAD), dan percentile rank** (mis. "September 2026 = tertinggi sejak 2001").
9. **AOI kustom:** jumlahkan sel di dalam poligon, k diambil dari wilayah induk berbobot komposisi.
10. **CSV:** `region, year, month, A_raw, T_raw, V_raw, sensor_used, k, k_lo, k_hi, H, H_lo, H_hi, baseline_median, anomaly_ratio, robust_z, pct_rank, flags`.

### Warna yang aksesibel
- Intensitas: viridis / cividis / ColorBrewer YlOrRd, **skala log** (distribusi sangat miring).
- Anomali: divergen PuOr / RdBu / BrBG (versi colorblind-safe). Hindari rainbow/jet (Crameri et al. 2020).

### Validasi yang wajib ditampilkan

| # | Uji | Yang dibuktikan |
|---|---|---|
| 1 | Leave-one-year-out 2012-2021 (MdAPE, Spearman, bias), sorot **2015 & 2019** | Faktor k stabil dan bisa memprediksi tahun yang tidak dilihat |
| 2 | **Seam test** di 2002-07 dan 2022-01 + change-point (Pettitt) vs seri naif | Lompatan palsu hilang |
| 3 | **Uji drift 2022-2026** (Aqua drift vs V·k) | Efek drift orbit terukur, pembenaran beralih ke VIIRS |
| 4 | Korelasi rank vs **luas terbakar SiPongi** 2015-2025 (+ MCD64A1/GFED bila sempat) | Konsisten dengan data resmi independen |
| 5 | Sanity check iklim: Ags-Okt tahun El Niño/IOD+ harus positif, La Niña negatif | Masuk akal secara fisik |
| 6 | Sensitivitas confidence, ukuran grid, stratifikasi | Hasil tidak rapuh |

### Kalimat "defensible" untuk pitch
- "Kami tidak menyamakan VIIRS dengan MODIS. Kami memetakan VIIRS ke unit MODIS memakai pasangan overpass 13:30 yang masih sinkron (2012-2021), per wilayah, musim, dan siang/malam, lengkap dengan interval ketidakpastian."
- "Kami menolak Aqua 2022+ sebagai acuan karena drift orbit, dan justru memakainya untuk membuktikan efek drift itu."
- "Anomali dihitung terhadap median 20 tahun dengan percentile rank, lebih robust daripada rata-rata yang dipakai GWIS."

## 8. Hal yang belum terverifikasi (cek sebelum diklaim)

1. Jam pasti berhentinya S-NPP (13:00 vs 15:40 UTC).
2. Tanggal akhir Terra/Aqua (sumber bertentangan); nilai drift berasal dari grafik proyeksi, bukan telemetri.
3. Awal NOAA-21 di FIRMS (1 Mar 2023 vs 17 Jan 2024).
4. **Rasio VIIRS/MODIS khusus Indonesia/gambut** belum ada di literatur. Angka yang ada hanya dari README pesaing.
5. Pemetaan VIIRS l/n/h ke skala 0-100 di SiPongi dan BRIN.
6. Luas terbakar SiPongi dikutip dari media/LSM, bukan tabel resmi. Angka 2019 beragam (1,65 vs >2,6 vs 3,1 Mha).
7. Ringkasan beberapa paper (Li, Fu, Vadrevu, Sofan, Sofiev) hanya dari abstrak.
8. Angka 2026 berasal dari media.
