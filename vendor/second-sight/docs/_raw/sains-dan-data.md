# Basis Pengetahuan Sains & Data: Harmonisasi Hotspot MODIS–VIIRS (fokus Indonesia)

Disusun 13 Nov 2026 untuk NASA Space Apps 2026, challenge "Harmonization of MODIS and VIIRS Hot Spots". Isinya riset saja, tanpa kode aplikasi. Kutipan ditulis inline (penulis/lembaga, tahun, URL). Status verifikasi:
- **[V]**: dicek langsung ke dokumen primer (PDF user guide dibaca utuh, file data dicoba diunduh, halaman resmi dibuka).
- **[S]**: diambil dari abstrak, ringkasan mesin pencari, atau media sekunder. Kutip dengan hati-hati.
- Klaim yang belum terverifikasi dikumpulkan di §8.

---

## 0. Ringkasan eksekutif (baca ini dulu)

1. **VIIRS 375 m mendeteksi jauh lebih banyak piksel api daripada MODIS 1 km**, sehingga deret waktu yang hanya disambung naif akan "melompat" pada 2012. Rasio hitungan VIIRS/MODIS bukan konstanta. Nilainya bergantung pada region, siang/malam, rezim api, sudut pandang, dan grid agregasi. Rentang yang dilaporkan literatur antara lain 4,8× (VIIRS vs Terra+Aqua) dan 6,5× (VIIRS vs Aqua) di Punjab (Vadrevu & Lasko 2018), sedangkan contoh satu hari di Mekong menunjukkan ~27× pada siang hari (VIIRS C2 User Guide 2025).
2. **Status misi per 13 Nov 2026:**
   - Produksi FIRMS untuk Suomi‑NPP **berhenti 2 Nov 2026**. Blog FIRMS menyebut pukul 13:00 UTC, sedangkan FAQ FIRMS menyebut 15:40 UTC. Arsip historis tetap tersedia.
   - Terra dan Aqua masih beroperasi, tetapi orbitnya sudah drift. Terra bergeser ke sekitar 09:00 pagi, dan Aqua bergeser dari 13:30 ke sekitar 15:30–15:45. Penghentian keduanya diperkirakan "akhir 2026/awal 2027" (Terra) dan sampai ~Sep 2027 (Aqua).
   - NOAA‑20 dan NOAA‑21 menjadi pengganti orbit siang. Orbit pagi belum punya pengganti di FIRMS.
3. **Implikasi metodologis terpenting:** kalibrasi silang MODIS↔VIIRS sebaiknya memakai periode overlap **2012–2021**, saat Aqua masih dekat 13:30 dan Terra dekat 10:30. Data 2022–2026 sudah terdampak drift orbit dan lebih cocok dipakai sebagai **uji validasi**.
4. **Indonesia 2026 adalah tahun El Niño kuat dengan karhutla besar.** Nusantara Atlas mencatat ~1,92 Mha terbakar sampai akhir September 2026. Ini kasus demo anomali yang ideal.
5. **Rekomendasi metode (detail di §7):**
   - Gunakan "fire cell-days" pada grid umum, bukan hitungan piksel mentah.
   - Filter `type=0` dan confidence nominal+tinggi.
   - Hitung rasio skala per region × bulan × siang/malam dari overlap Aqua–S‑NPP 2012–2021, dengan shrinkage dan validasi leave‑one‑year‑out.
   - Jembatani Terra→Terra+Aqua untuk periode 2000–2002.
   - Hitung anomali berbasis median dan percentile terhadap baseline 2003–2022.

---

## 1. Fakta sensor & produk

### 1.1 MODIS (Terra/Aqua), Collection 6.1 — MOD14/MYD14, MCD14ML, MCD14DL
- **Algoritma:** deteksi kontekstual 4 µm dan 11 µm (Giglio et al. 2003; **Giglio, Schroeder & Justice 2016**, RSE 178:31–41). Collection 6.1 hanya mengubah kalibrasi, bukan algoritma. Dalam sampel satu hari, jumlah piksel api C6 dan C6.1 adalah 404.057 vs 404.052, dan 99,64% file tidak berbeda. Karena itu C6 dan C6.1 "may be freely intermixed". [V] Sumber: *MODIS C6/C6.1 Active Fire Product User's Guide v1.0* (Giglio, Schroeder, Hall 2021), https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf
- **Ukuran piksel:**
  - Nominal 1 km² di nadir, membesar ke arah tepi scan. Rumus S×T ada di Ichoku & Kaufman (2005), dikutip di User Guide §8.4.6. Sudut scan dihitung sebagai θ = 0,0014184397 × (sample − 676,5). [V] (User Guide di atas)
  - Di tepi scan, luas piksel bisa mencapai **~9,67× luas di nadir**, setara ~2,0 km (along‑track) × ~4,8 km (along‑scan). [V] Zheng et al. 2026, *Remote Sensing* 18:1650, https://doi.org/10.3390/rs18101650
  - Ada celah swath MODIS di daerah tropis (sekitar ±30° lintang). Celah ini relevan untuk Indonesia. [V] (Zheng et al. 2026; contoh peta Mekong di VIIRS C2 UG 2025)
- **Batas deteksi:** api ~1.000 m² terdeteksi rutin, baik yang menyala (flaming) maupun membara (smouldering). Dalam kondisi sangat baik, api menyala ~100 m² bisa terdeteksi, dan dalam kondisi "pristine" ~50 m². [V] (User Guide §8.3.2; FIRMS FAQ https://www.earthdata.nasa.gov/data/tools/firms/faq)
- **Confidence 0–100%** dengan tiga kelas: **rendah 0 ≤ C < 30, nominal 30 ≤ C < 80, tinggi 80 ≤ C ≤ 100**. [V] (User Guide Table 11)
  - Saran resmi: jika ingin false alarm lebih sedikit, pakai nominal+tinggi dan perlakukan kelas rendah sebagai non‑api. Jika ingin deteksi maksimum, pakai ketiga kelas. [V] (UG §8.4.2)
- **Field MCD14ML** (Table 10): `YYYYMMDD HHMM sat lat lon T21 T31 sample FRP conf type dn`. [V]
  - **type:** 0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source, 3 = offshore.
  - Tipe 2 mencakup hotspot statis yang terdeteksi ≥16 hari dalam satu tahun kalender, ditambah hotspot di area urban (MCD12Q1). Deteksi di atas air selalu bertipe 3.
  - **Field `type` hanya ada di produk standar (ML), tidak ada di NRT.** [V] (UG; FIRMS FAQ)
- **Flag siang/malam:**
  - Produk standar ML memakai sudut zenit matahari: >85° dihitung malam.
  - NRT memakai arah orbit (ascending = siang). [V] (FIRMS FAQ)
- **Peringatan penting untuk kalender:** "severe temporal and spatial biases may arise in any MODIS fire time series analysis employing time intervals shorter than about eight days". File lokasi titik juga tidak memuat informasi awan atau data hilang. [V] (UG §7.1.1) → **Gunakan bin ≥8 hari, idealnya bulanan, untuk analisis.**
- **Data Terra sebelum Nov 2000** mengalami masalah detektor: striping, serta api kecil dan besar yang tidak terdeteksi. [V] (UG §7.2.1). FIRMS memulai MODIS pada **1 Nov 2000**. [V] (FIRMS download page https://firms2.modaps.eosdis.nasa.gov/download/)
- **Produk CMG** (MOD14CMQ/MYD14CMQ, 0,25°) menyediakan `CorrFirePix` dan **`CloudCorrFirePix`** (hitungan api yang dikoreksi untuk tutupan awan), serta `MeanCloudFraction`, `CloudPix`, dan `TotalPix`. [V] (UG Table 9). Ini contoh resmi normalisasi berdasarkan observasi valid.

### 1.2 VIIRS 375 m (I‑band) — VNP14IMG (S‑NPP), VJ114IMG (NOAA‑20), VJ214IMG (NOAA‑21), Collection 2
- **Algoritma:** Schroeder, Oliva, Giglio & Csiszar 2014, RSE 143:85–96 (https://earthdata.nasa.gov/s3fs-public/imported/Schroeder_et_al_2014b_RSE.pdf). Dibandingkan produk VIIRS 750 m, produk 375 m mendeteksi **~3× piksel api pada siang hari dan ~25× pada malam hari**. [S] (abstrak)
- **User guide C2 v1.2 (Juni 2025)**, https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf [V]:
  - Granul 6 menit, 32 detektor per scan, 6400 sampel per baris, swath ~3060 km. Overlap antar orbit ~15% di ekuator, sehingga cakupan global tercapai tiap 12 jam. Overpass S‑NPP 13:30 dan 01:30.
  - **Confidence kategorikal:**
    - Rendah (kelas 7): siang hari, terkait sun glint atau anomali suhu I4 <15 K.
    - Nominal (kelas 8): bebas glint, anomali >15 K.
    - Tinggi (kelas 9): piksel saturasi atau DN folding.
    - Di CSV FIRMS ditulis `l`/`n`/`h`.
  - Saturasi I4 (367 K) sering terjadi. Karena itu FRP dihitung dari kanal M13 750 m lalu dibagi ke sub‑piksel 375 m, sehingga FRP per piksel bisa berupa pecahan.
  - **Field ML (Vxx14IMGML):** termasuk FRP, Confidence, DNFlag, VZA, **Type (0–3, sama dengan MODIS; tipe 3 mencakup semua deteksi di atas air)**, dan PixArea.
  - **Known issue:** ada bug yang membuat tipe 2 sering salah dilabeli tipe 0 pada versi 1–2. Bug ini diperbaiki Mei 2025, dan semua file ML diproses ulang ke **versi 3**.
  - Statistik global 2021 (375 m vs 750 m): ~3× lebih banyak piksel api siang dan ~17× malam. 53% piksel siang 375 m tidak punya padanan di produk 750 m.
  - **Contoh Mekong, 1 Mar 2016:**
    - Siang: Terra 606, S‑NPP 9.643, Aqua 361 piksel api.
    - Malam: Terra 58, S‑NPP 4.608, Aqua 22.
    - Perbedaan diperbesar oleh celah swath MODIS di tropis dan oleh pembesaran piksel MODIS ke arah tepi.
  - Malam hari, pada scan angle tinggi, produk 375 m dapat ikut mendeteksi plume panas (efek paralaks).
- **Ukuran piksel I4:** ~0,36 × 0,38 km di nadir dan ~0,78 × 0,80 km di tepi scan. Variasinya jauh lebih kecil daripada MODIS. [V] (Zheng et al. 2026)
  - Zona agregasi on‑board: 3 piksel native digabung per sampel dari nadir sampai 31,59°, 2 piksel dari 31,59° sampai 44,68°, dan 1 piksel dari 44,68° sampai 56,06°. [V] (FIRMS FAQ)
- **Batas deteksi:** api menyala yang sangat panas bisa terdeteksi sampai beberapa m². GFW menyebut ~5 m². [S] (Global Forest Watch blog, https://blog.globalforestwatch.org/fires/fighting-fires-with-satellites-viirs-fire-data-now-available-on-global-forest-watch)
- **Produk VIIRS 750 m (VNP14):** adaptasi algoritma MODIS C6 yang performanya lebih mirip MYD14. Produk ini dirancang untuk kontinuitas, tetapi **tidak ada di FIRMS**. FIRMS hanya menyajikan produk 375 m. [V] (VIIRS C2 UG 2025). Untuk perbandingan dengan MODIS, Csiszar et al. 2014 (JGR, doi:10.1002/2013JD020453) melaporkan bahwa VIIRS 750 m mendeteksi ~26% lebih banyak daripada MODIS di zona agregasi tengah. [S]

### 1.3 Overpass, latensi, NRT vs standar
- **Overpass nominal:**
  - Terra: 10:30 dan 22:30 waktu lokal.
  - Aqua: 13:30 dan 01:30.
  - S‑NPP: 13:30 dan 01:30.
  - NOAA‑20 dan NOAA‑21 berada di bidang orbit yang sama dengan S‑NPP, dengan selisih ~50 menit.
  - [V] (FIRMS FAQ; FIRMS blog 27 Okt 2026)
  - Lihat §2 untuk drift orbit Terra dan Aqua.
- **Latensi:**
  - NRT: <3 jam (best effort).
  - RT dan URT: menit, dan deskripsinya di FAQ sendiri tidak konsisten.
  - Produk standar (SP/ML): menggantikan NRT dengan lag ~2–3 bulan menurut FAQ, atau ~5 bulan menurut halaman Archive Download. [V] Kedua angka tertulis di sumber resmi, jadi anggap lag 2–5 bulan.
- **Cakupan arsip FIRMS** [V] (https://firms2.modaps.eosdis.nasa.gov/download/):

| Sensor | Mulai | Selesai |
|---|---|---|
| MODIS C6.1 | 1 Nov 2000 | sekarang |
| VIIRS S‑NPP | 20 Jan 2012 | **2 Nov 2026** |
| VIIRS NOAA‑20 | 1 Apr 2018 | sekarang |
| VIIRS NOAA‑21 | 1 Mar 2023 (FAQ: 17 Jan 2024; inkonsisten) | sekarang |
| Landsat | 20 Jun 2022 | sekarang |

### 1.4 Cara unduh
- **Archive Download** (https://firms2.modaps.eosdis.nasa.gov/download/):
  - Format SHP, CSV, atau JSON.
  - Login memakai kode email. Link unduhan dikirim lewat email.
  - Mencakup data lebih tua dari 7 hari, dan NRT diganti produk standar begitu tersedia. [V]
- **CSV tahunan per negara** (sudah dites, HTTP 200, 13 Nov 2026) [V]:
  - `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{YYYY}/modis_{YYYY}_Indonesia.csv` (tersedia 2000–2025).
  - `.../country/viirs-snpp/{YYYY}/viirs-snpp_{YYYY}_Indonesia.csv` (2012–2025).
  - `.../country/viirs-jpss1/{YYYY}/viirs-jpss1_{YYYY}_Indonesia.csv` (NOAA‑20, 2018–2025).
  - **NOAA‑21: pola `viirs-jpss2` dan `viirs-noaa21` → 404**, jadi nama path belum diketahui.
  - File 2026 belum ada (404).
  - Kolom MODIS: `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`. Versi 6.03, dan **ada kolom `type`**.
  - Kolom VIIRS: `...bright_ti4,...,confidence(l/n/h),version(2),bright_ti5,frp,daynight,type`.
  - Kolom `scan` dan `track` adalah dimensi piksel dalam km, berguna untuk simulasi footprint.
- **API area** (https://firms.modaps.eosdis.nasa.gov/api/area/) [V]:
  - Format: `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]`.
  - **DAY_RANGE hanya 1–5.**
  - SOURCE: `MODIS_NRT, MODIS_SP, VIIRS_SNPP_NRT/SP, VIIRS_NOAA20_NRT/SP, VIIRS_NOAA21_NRT/SP, LANDSAT_NRT`.
  - **Batas: 5000 transaksi per 10 menit.** Request besar dihitung sebagai beberapa transaksi. MAP_KEY gratis.
  - Endpoint lain: `/api/data_availability/` dan `/api/missing_data/`, yaitu daftar tanggal hilang per sensor.
  - Endpoint `country` ditandai "Feature currently not available".
- **Pengguna API S‑NPP** harus mengganti `VIIRS_SNPP_NRT/SP` → `VIIRS_NOAA20_NRT` atau `VIIRS_NOAA21_NRT`. [V] (FIRMS blog 2026, https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know)
- **Tanggal hilang yang diketahui** (Zheng et al. 2026, Table 2) [V]:
  - MYD14: 30 Jul–7 Ags 2002; 1–16 Apr 2022.
  - VNP14IMG: 25 Mar 2012; 27 Jul–10 Ags 2022; 13 Sep 2022; 30 Mei–3 Jun 2024; 10–15 Jul 2024; 25–28 Jul 2024.
  - Perlakukan sebagai "data tidak tersedia", **bukan nol api**.

---

## 2. Status misi (per 13 Nov 2026)

| Item | Fakta | Sumber |
|---|---|---|
| **S‑NPP berhenti di FIRMS** | Produksi dan pengiriman berhenti **2 Nov 2026, 13:00 UTC**. Data VIIRS 375/750 m dan burned area berhenti diperbarui, begitu juga email alert. Arsip historis tetap ada. Pengganti: NOAA‑20/21. | [V] Blog FIRMS terbit 27 Okt 2026, diperbarui 3 Nov 2026: https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know |
| Jam cessation berbeda | FAQ FIRMS: "ceased at **15:40 UTC** on November 2, 2026". Forum LP DAAC sebelumnya menyebut 1 Nov 2026 (dengan catatan "subject to change"). | [V] FAQ; [S] https://forum.earthdata.nasa.gov/viewtopic.php?p=26446 |
| **Orbit pagi** | "Terra is currently the only morning-orbit source"; NASA "investigating alternatives". Setelah Aqua mati, orbit siang ditutup NOAA‑20/21 "without loss of observation capability". | [V] Blog FIRMS 2026 |
| **Terra: drift** | MLT ~10:15 saat Okt 2022 (orbit diturunkan dari 705 km), lalu ~09:00 awal 2026. Perigee‑lowering burns Feb–Mar 2026. Bila diperpanjang maksimal: Phase F ~Des 2026 dan instrument shutdown **Mar–Apr 2027**. | [V] Slide NASA HQ dalam Giglio, *Terra/Aqua Orbit‑Drift Update*, LANCE UWG Mei 2025: https://landweb.modaps.eosdis.nasa.gov/data/filePost/LANCE_UWG_Orbit_Drift_Giglio_202505.pdf |
| **Aqua: drift** | Free drift sejak Jan 2022: MLT ~13:37 → ~14:10 (pertengahan 2024) → ~15:15 (Jan 2026) → ~15:45 (Ags 2026). Rencana lama: shutdown instrumen **Ags 2026** (power‑limited). Final delivery Q1 2029. | [V] slide yang sama |
| Dampak drift ke produk api | Piksel 1 km → ~970 m along‑scan (2025), celah scan melebar, bowtie overlap berubah, sampling siklus diurnal bergeser. Dampak sampling spasial "abruptly increased in magnitude in late 2024". Kajian kuantitatif dampak ke hitungan api masih berlangsung (grup Giglio). | [V] slide yang sama |
| Jadwal akhir resmi | Earthdata: "begin shutting down operations in late 2026/early 2027". CAMS (25 Feb 2026): Terra MODIS berakhir **Jan 2027**, Aqua **~Sep 2027**. RFI NASA Feb 2026: Terra sampai Feb 2027, Aqua sampai Sep 2027. | [V] https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs ; [V] https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system ; [S] RFI via militaryaerospace.com |
| Anomali Terra 2026 | Terra MODIS masuk standby 26 Mar 2026 dan kembali ke science mode 27 Mar 2026. | [S] https://www.earthdata.nasa.gov/data/alerts-outages/terra-modis-placed-standby-mode |
| Kontinuitas operasional lain | CAMS GFAS menambahkan VIIRS sejak **4 Des 2025**, sedang mengadaptasi FRP Sentinel‑3 SLSTR untuk overpass pagi, dan berencana menambah data geostasioner. | [V] CAMS 2026 |

**Implikasi:**
- (a) Mulai ~2022, "MODIS" bukan lagi pengamat 10:30/13:30 yang stabil.
- (b) Pasangan Aqua–VIIRS hanya tepat dianggap "near‑synchronous" pada periode **2012–2021**.
- (c) Rekaman pagi akan putus setelah Terra berhenti. Ini tidak bisa dibuat ulang dari VIIRS, jadi indeks harmonisasi sebaiknya ditambatkan ke **orbit siang**.

---

## 3. Sains harmonisasi

### 3.1 Bukti empiris perbedaan MODIS vs VIIRS

| Studi | Region / periode | Temuan kunci | Status |
|---|---|---|---|
| Vadrevu & Lasko 2018, *Remote Sens.* 10:978, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6108185/ | Punjab (pertanian), 2012–2016 | VIIRS **6,5×** jumlah Aqua dan **4,8×** jumlah Terra+Aqua. ΣFRP VIIRS ~2,5× MODIS dengan r²=0,98 bulanan. Model gabungan dipakai untuk emisi 2003–2016. | [S] |
| Fu et al. 2020, *Remote Sens.* 12:2870, https://www.mdpi.com/2072-4292/12/18/2870 | Asia Timur Laut, 2012–2017 | 65% (hutan) dan 83% (lahan biomassa rendah) piksel VIIRS terlewat oleh MODIS. VIIRS melewatkan 35%/53% deteksi MODIS. Commission error turun seiring naiknya FRP per piksel. | [S] |
| Li, Zhang, Kondragunta & Csiszar 2018, *JGR‑Atmos* 123:4545, doi:10.1029/2017JD027823 | Global, Apr 2016–Mar 2017 | FRP VIIRS ~20% lebih besar di region rawan api. Kapasitas VIIRS seragam sepanjang swath, sedangkan MODIS sangat bergantung pada VZA. Duplikat dari orbit bertetangga perlu dikoreksi. | [S] |
| Li, Zhang & Kondragunta 2020, *Remote Sens.* 12:1561, https://www.mdpi.com/2072-4292/12/10/1561 | Afrika, 2017 | FRP harian MODIS terlalu rendah **≥42,8%** karena api intensitas rendah terlewat. Celah swath menurunkan ΣFRP bulanan 12,5%. Model penyesuaian dibuat untuk grid 0,05°–0,5° sebagai fungsi VZA. | [S] |
| Kaur et al. 2019, *Remote Sens.* 11:1205, doi:10.3390/rs11101205 | Global (GFAS) | **Quantile mapping**: CDF FRP off‑nadir dipetakan ke CDF near‑nadir lalu dicek terhadap VIIRS. | [S] |
| **Zheng et al. 2026**, *Remote Sens.* 18:1650, https://doi.org/10.3390/rs18101650 | Global, MYD14 + VNP14IMG 2012–2024 | Kerangka *correction‑before‑fusion*: koreksi duplikat (Δt<8 s, overlap >30%), lalu **agregasi VIIRS di dalam footprint MODIS** (1–115 piksel VIIRS per piksel MODIS), pasangan |Δt|≤5 menit, koreksi awan berbasis luas, model rasio FRP vs VZA (R²≈98%), dan fusi berbasis prioritas kualitas. Produk fusi memuat **~3,82×** piksel api produk MODIS asli. | [V] PDF dibaca |
| Sofiev & Kouznetsov 2026, *GMD* 19:10123, https://gmd.copernicus.org/articles/19/10123/2026/ | Global | POD untuk api kuat: 78% (MODIS) dan 88% (VIIRS) secara rata‑rata global. Di sebagian wilayah ekuatorial angkanya **<30% (MODIS) / <40% (VIIRS)**. | [S] |
| VIIRS C2 UG 2025 | Mekong, 1 Mar 2016 | Siang: S‑NPP 9.643 vs Aqua 361 (~27×). Malam: 4.608 vs 22. Ini contoh ekstrem satu hari yang dipengaruhi celah swath. | [V] |

**Kesimpulan:** rasio hitungan VIIRS/MODIS berkisar **~2× sampai >25×**. Rasio paling tinggi pada malam hari, di lanskap dengan banyak api kecil atau dingin (pertanian, gambut membara), dan di tropis tempat celah swath MODIS berpengaruh. Rasio makin kecil bila hitungan diagregasi ke grid kasar atau dibinerkan per sel. Karena itu, **rasio tunggal global tidak bisa dipertahankan secara ilmiah**. Rasio harus spesifik region dan musim, dan dihitung terpisah untuk siang dan malam.

### 3.2 Sumber ketidakkonsistenan (yang harus ditangani)
1. **Resolusi dan sensitivitas.** Piksel 375 m vs 1 km, dan batas deteksi ~m² vs ~1000 m². Akibatnya VIIRS melihat api kecil yang tidak terlihat MODIS. Ini *real signal*, bukan artefak.
2. **Geometri scan.** MODIS membesar ~9,7× di tepi scan, VIIRS hanya ~4,5× dan lebih seragam. Ditambah lagi celah swath MODIS di tropis, serta duplikat dari bowtie dan overlap orbit.
3. **Waktu overpass.** Terra pagi vs Aqua/VIIRS siang, padahal siklus diurnal api tropis memuncak sore hari (Giglio, Csiszar & Justice 2006, JGR 111, doi:10.1029/2005JG000142). Ditambah drift Aqua/Terra setelah 2021.
4. **Pergantian platform VIIRS.** S‑NPP 2012–2026, NOAA‑20 2018–, NOAA‑21 2023/24–. Sensornya identik tetapi berselisih ~50 menit, dan jumlah satelit aktif berubah dari waktu ke waktu. Menjumlahkan semua satelit akan menggelembungkan hitungan.
5. **Awan dan asap.** File titik FIRMS tidak memuat informasi awan atau no‑data (MODIS UG §7.1.1). Asap tebal paradoksnya bisa *menurunkan* hitungan saat episode terburuk (Cochrane, dikutip ScienceDaily Sep 2026, https://sciencedaily.com/releases/2026/09/260904000318.htm) [S].
6. **Sumber statis dan bug tipe.** Gas flare, industri, dan gunung api harus dibuang (`type≠0`). Pakai VIIRS ML versi 3 (pasca‑Mei 2025). NRT tidak punya `type`, jadi perlu mask statis buatan sendiri.
7. **Celah data** (§1.4) yang tidak boleh dibaca sebagai "nol api".

### 3.3 Opsi metode harmonisasi: pro/kontra

| Metode | Inti | Pro | Kontra | Cocok 48 jam? |
|---|---|---|---|---|
| **A. Rasio skala per region × bulan (× siang/malam)** dari overlap | k = ΣVIIRS/ΣMODIS di periode overlap, lalu dipakai untuk mengubah satu sensor ke unit sensor lain | Sederhana, transparan, mudah dijelaskan ke juri, dan ketidakpastiannya bisa dihitung (bootstrap per tahun) | Mengasumsikan rasio stasioner. Rasio sendiri bergantung pada intensitas dan ukuran api (tahun El Niño vs normal) | **Ya (inti)** |
| B. Regresi overlap (OLS/log‑log, Poisson/NegBin) | log(V) = a + b·log(M) + musim | Bisa menangkap ketidaklinearan (rasio berubah dengan level aktivitas) | Butuh banyak data per region. Bulan dengan nol api merepotkan | Ya, sebagai varian/validasi |
| C. Quantile mapping (Kaur et al. 2019) | Petakan CDF hitungan bulanan VIIRS ke CDF MODIS | Menjaga distribusi, termasuk ekor ekstrem | Butuh sampel overlap besar. Rawan pada nol dan ekstrem di luar rentang kalibrasi (2026 bisa melebihi semua data overlap) | Opsional |
| **D. Agregasi ke grid umum / "fire cell‑days"** | Binerkan deteksi per sel (misal 0,01°≈1 km atau 0,05°) per hari per sensor, lalu jumlahkan | Mengurangi efek resolusi dan duplikat. Rasio menjadi jauh lebih stabil. Setara dengan unit "hari‑api" yang intuitif | Masih ada beda sensitivitas. Pilihan ukuran sel memengaruhi hasil (Li et al. 2020) | **Ya (pra‑proses wajib)** |
| E. Simulasi footprint MODIS (Zheng et al. 2026) | Agregasi VIIRS di dalam footprint MODIS memakai `scan`×`track` | Paling ketat secara fisik, dan sudah dipublikasikan 2026 | Butuh data L2 dan geolokasi, serta pencocokan ±5 menit. Berat untuk 48 jam | Hanya di AOI kecil, sebagai demo |
| F. Ambang FRP | Buang deteksi VIIRS di bawah FRP minimum MODIS supaya "MODIS‑like" | Sederhana dan berbasis fisik (MODIS melewatkan api FRP rendah: Li 2020, Fu 2020) | FRP VIIRS dari M13 750 m dibagi ke sub‑piksel, dan ambang deteksi MODIS bergantung VZA. Ambang tunggal kasar | Sebagai uji sensitivitas |
| G. Pencocokan overpass Aqua + VIIRS (~13:30) | Kalibrasi hanya pada observasi siang yang nyaris sinkron | Mengontrol siklus diurnal | **Hanya valid 2012–2021.** Setelah itu Aqua drift ke 14:00–15:45 | **Ya: batasi kalibrasi ke 2012–2021** |
| H. Normalisasi observasi valid | Bagi hitungan dengan jumlah observasi bebas awan (CMG `CloudCorrFirePix`, MOD14A1/VNP14A1 QA) | Menangani awan dan asap, dan diakui secara ilmiah (MODIS CMG) | Butuh produk raster tambahan. FIRMS CSV saja tidak cukup | Opsional/fitur lanjutan |
| I. ML (LightGBM dll.) | Prediksi MODIS dari fitur VIIRS dan iklim | Fleksibel | Kotak hitam, risiko overfit, sulit dipertahankan dalam 48 jam | Tidak (atau hanya pembanding) |

---

## 4. Kalender aktivitas pembakaran & metode anomali

- **GWIS/EFFIS "seasonal trend":**
  - Grafik mingguan dan kumulatif (luas terbakar, jumlah kebakaran, anomali termal MODIS/VIIRS) untuk tahun berjalan, dibandingkan dengan **rata‑rata dan rentang min–max tahun‑tahun sebelumnya**. Contoh legenda: "min‑MAX (2012–2022), Average (2012–2022), 2023". [S] https://api2.effis.emergency.copernicus.eu/api/gwis/seasonaltrend/pdf/FRA/2023/CO2 ; https://gwis.jrc.ec.europa.eu/applications
  - GWIS memakai *mean*. Kita memilih **median** karena lebih robust. Ini nilai tambah yang bisa dijelaskan.
- **Klimatologi api:** Giglio, Csiszar & Justice 2006 (doi:10.1029/2005JG000142) memakai hitungan terkoreksi (multi‑overpass dan awan) di grid CMG. Mereka mendapati puncak bulan api dan panjang musim dari Terra vs Aqua umumnya konsisten, **kecuali di hutan hujan tropis**. [S] Ini relevan untuk Indonesia.
- **Statistik anomali yang disarankan:**
  - **Rasio terhadap median** atau log‑rasio: A = log((x+1)/(median+1)). Robust terhadap tahun ekstrem (1997/2015) yang akan menggelembungkan mean.
  - **Robust z‑score:** z = (x − median)/(1,4826·MAD). Rujukan: Leys et al. 2013, *J. Exp. Soc. Psych.* 49:764, doi:10.1016/j.jesp.2013.03.013. [S]
  - **Percentile rank** terhadap distribusi historis bulan yang sama. Ini paling aman untuk data dengan banyak nol dan mudah dikomunikasikan, misalnya "September 2026 = persentil 100, tertinggi sejak 2001".
  - Pertimbangan baseline: gunakan **20 tahun penuh 2003–2022** (Terra+Aqua lengkap, sebelum drift parah), atau baseline WMO 1991–2020 yang dipotong ke 2003–2020. Ekspos baseline sebagai parameter.
- **Warna aksesibel:**
  - Sekuensial untuk intensitas: **viridis/inferno/magma** (van der Walt & Smith 2015, https://bids.github.io/colormap/), **cividis** yang dioptimalkan untuk CVD (Nuñez, Anderton & Renslow 2018, *PLOS ONE*, doi:10.1371/journal.pone.0199239), atau **ColorBrewer YlOrRd** (Harrower & Brewer 2003, *Cartographic J.* 40:27, https://colorbrewer2.org).
  - Divergen untuk anomali: ColorBrewer **PuOr/BrBG/RdBu** (versi colorblind‑safe) atau Crameri *vik/roma*. Hindari rainbow/jet (Crameri, Shephard & Heron 2020, *Nat. Commun.* 11:5444, doi:10.1038/s41467-020-19160-7).
  - Gunakan skala log untuk hitungan, karena distribusinya sangat miring.

---

## 5. Konteks Indonesia

- **Musim:**
  - Pembakaran meningkat Agustus dan memuncak **September–Oktober** (Mongabay, 29 Jul 2026; studi Sentinel‑2 untuk 2019/2023). Sumatra dan Kalimantan berbeda. Field et al. 2009 (*Nat. Geosci.* 2:185, https://shen.sdsu.edu:443/pdf/fiel_natu_2009cp.pdf) mencatat kebakaran besar di Sumatra sejak 1960‑an, sedangkan di Kalimantan baru sejak 1980‑an, terkait penggunaan lahan. [S]
  - Pan, Chin, Ichoku & Field 2018 (*JGR‑Atmos*, doi:10.1029/2018JD028402): api **selalu lebih intens di Kalimantan selatan daripada Sumatra selatan** pada semua kejadian El Niño. [S]
- **Iklim:**
  - Episode besar 1997/98 dan 2006, serta episode kecil 2002 dan 2004. IOD sama pentingnya dengan El Niño (Field et al. 2009).
  - Api paling intens terjadi saat El Niño tipe Pasifik Timur disertai IOD positif, misalnya 2006 (Pan et al. 2018).
  - 2019 dipicu IOD positif ekstrem (ASEAN Haze Portal, https://hazeportal.asean.org/?p=13620).
  - 2023 dipicu El Niño + IOD positif (NASA Earth Observatory, https://science.nasa.gov/earth/earth-observatory/indonesian-fires-return-in-2023-151929/).
  - [S] untuk semua poin di atas.
- **2026 (tahun berjalan, sangat relevan untuk demo):**
  - El Niño kuat. Indeks ENSO BMKG ~2,6 pada September menurut Kompas. [S]
  - FireWatch/Nusantara Atlas mencatat **>96.000 hotspot sampai 27 Jul 2026**, tertinggi untuk tanggal itu dibanding 2019 (~88.000) dan 2023 (~58.000). [S] Mongabay https://news.mongabay.com/2026/07/indonesia-shows-elevated-fire-hotspot-activity-in-2026-as-super-el-nino-threat-looms/
  - SiPongi 21 Sep 2026: **22.293 hotspot dalam 24 jam** (tinggi 1.801, sedang 19.901, rendah 591). Kalteng 12.046, Kalbar 3.631, Kalsel 1.329, Sumsel 1.141. [S] Databoks https://databoks.katadata.co.id/datapublish/2026/09/21/22293-hotspot-terdeteksi-di-indonesia-dalam-24-jam-terakhir-senin-21-september-2026
  - Nusantara Atlas: luas terbakar kumulatif **~1,92 Mha sampai akhir Sep 2026**, naik dari 895.650 ha pada Agustus. Angka ini lebih tinggi dari 1,39 Mha pada titik yang sama di 2019. Angka resmi pemerintah terakhir adalah 202.000 ha untuk Jan–Jul. [S] Jakarta Post 19 Okt 2026; The Star 20 Okt 2026.
- **Gambut:**
  - Pembakaran membara (smouldering) bersuhu rendah, kecil, dan sering di bawah permukaan, sehingga sulit dideteksi dari orbit. Produk satelit tidak membedakan api menyala dan membara.
  - Sofan et al. 2019 (*Remote Sens.*): POD VNP14IMG ~71% terhadap ground truth di Kalimantan Tengah. [S]
  - Sofan et al. 2020 (*Int. J. Digital Earth* 13:1695, doi:10.1080/17538947.2020.1791268): VIIRS malam ~80% sesuai dengan referensi Landsat‑8 (ToPeCAl) untuk api <14 ha. Kombinasi siang+malam dengan buffer klaster 375 m mencapai **POD hingga 90%** untuk api >14 ha. [S]
  - Pada 2015, 53% api di Indonesia terjadi di gambut, padahal gambut hanya 12% luas daratan (Miettinen et al. 2017, dikutip ACP 19:11105, 2019). [S]
  - Implikasi: MODIS sangat mungkin **underestimate** api gambut lebih parah daripada VIIRS, sehingga rasio VIIRS/MODIS di gambut kemungkinan **lebih tinggi** daripada di lahan mineral. Ini justifikasi rasio spesifik region dan landcover (misalnya stratifikasi gambut vs non‑gambut memakai PEATMAP atau peta KHG).
- **Praktik resmi Indonesia:**
  - **SiPongi (Kemenhut):** sumber Terra/Aqua, SNPP, dan NOAA. Kelas kepercayaan **rendah 0–29, sedang 30–79, tinggi 80–100**, identik dengan Table 11 MODIS. Bagaimana VIIRS (l/n/h) dipetakan ke skala ini belum terverifikasi. [S] (Databoks)
  - **Hotspot BRIN (eks‑LAPAN):** VIIRS saja (S‑NPP, NOAA‑20). [S] RRI https://rri.co.id/en/technology/2726680/brin-develops-satellite-based-forest-fire-early-detection-system
  - Peringatan BRIN: hotspot ≠ kejadian kebakaran, dan confidence tinggi pun tidak selalu berarti ada karhutla. [S]
  - **ASMC (ASEAN Specialised Meteorological Centre):** peta hotspot berasal dari **NOAA‑20 sejak 2019**, dan S‑NPP untuk 2017–2018. Teks harian per pass tersedia untuk Sumatra dan Kalimantan (mis. https://asmc.asean.org/files/msscommunity/hotspots/DailyJP1_LATENOAA20.kalimantan.txt). [S] https://asmc.asean.org/asmc-hotspot/
  - Pantau Gambut ikut memakai confidence rendah dan sedang. Karena itu angka hotspot antar‑lembaga tidak bisa langsung dibandingkan.
- **Luas terbakar resmi (SiPongi/KLHK) untuk validasi tahunan** [S] (dikutip Mongabay/Greenpeace/Kontan; cek ulang di https://sipongi.menlhk.go.id):

| Tahun | Luas (ha) | Catatan |
|---|---|---|
| 2015 | **2.611.411** | terbesar dalam dekade terakhir |
| 2017 | 165.484 | terendah |
| 2019 | **1.649.258** | Nusantara Atlas/FireWatch: >2,6 Mha |
| 2023 | **1.161.193** | Greenpeace (indikatif): ~2,13 Mha; FireWatch: 1,7 Mha |
| 2026 | resmi 202.000 (Jan–Jul) | Nusantara Atlas: ~1,92 Mha (Jan–Sep) |

  Seri luas terbakar ini dibuat dengan metode berbeda, jadi gunakan **korelasi rank (Spearman)**, bukan kecocokan absolut.

---

## 6. Catatan penting untuk desain produk
- Unit ditampilkan sebagai **"hari‑sel api" setara Aqua‑MODIS** (atau "indeks aktivitas pembakaran"), bukan "jumlah kebakaran".
- Simpan dan tampilkan **dua kurva**: (i) harmonisasi dan (ii) native per sensor. Juri akan melihat transparansinya.
- Tandai bulan yang punya tanggal hilang (FIRMS `/api/missing_data/`) dan periode drift (2022+).
- Hotspot NRT tidak punya `type`. Untuk bulan berjalan, terapkan **mask statis** dari lokasi tipe 2/3 historis (2012–2025), misalnya sel 0,01° dengan deteksi tipe ≠0 pada ≥N hari.

---

## 7. Rekomendasi metodologi untuk hackathon (48 jam)

### 7.1 Target besaran
**H(region, bulan) = indeks aktivitas pembakaran dalam unit "fire cell‑days Aqua‑MODIS‑equivalent".**

Alasan memilih jangkar orbit siang (Aqua):
- Rekaman pagi akan berakhir bersama Terra (§2).
- Aqua dan VIIRS sama‑sama dirancang untuk overpass 13:30.
- Puncak diurnal api tropis terjadi siang/sore.
- Unit MODIS menjaga baseline 2003–2022 tetap "native" tanpa koreksi, sehingga hanya data VIIRS (2022+) yang ditransformasi.

### 7.2 Pipeline
1. **Ambil data standar (SP) per negara** dari CSV tahunan FIRMS (MODIS 2000–2025, S‑NPP 2012–2025, NOAA‑20 2018–2025). Untuk 2026, pakai Archive Download atau API area `*_NRT`/`*_SP`, dalam potongan maksimal 5 hari per panggilan dan di bawah 5000 transaksi per 10 menit.
2. **Filter:**
   - `type == 0`. Untuk NRT, pakai mask statis.
   - MODIS `confidence ≥ 30`; VIIRS `confidence ∈ {n, h}` (setara "nominal+tinggi" di kedua sensor).
   - Pisahkan `daynight`.
   - Uji sensitivitas: versi "semua confidence" dan versi "≥80/h saja" agar sejalan dengan praktik SiPongi/BRIN.
3. **Fire cell‑days:**
   - Snap tiap deteksi ke grid 0,01° (≈1,1 km, kira‑kira ukuran piksel MODIS di nadir).
   - Hitung sel unik per (tanggal lokal, sensor/satelit, siang/malam).
   - Langkah ini menghapus duplikat orbit dan bowtie, dan menurunkan sebagian efek resolusi (opsi D).
4. **Unit sensor:**
   - MODIS: pisahkan Terra (T) dan Aqua (A).
   - VIIRS: pakai **satu satelit referensi per waktu**: S‑NPP 2012‑01 s.d. 2026‑11‑02, lalu NOAA‑20.
   - Kalibrasi NOAA‑20→S‑NPP dari overlap Apr 2018–Okt 2026 (diharapkan ≈1). Faktor NOAA‑21 serupa bila dipakai.
   - Jangan menjumlahkan satelit.
5. **Kalibrasi VIIRS→Aqua:**
   - Periode 2012‑01 s.d. 2021‑12, saat Aqua masih sekitar 13:30.
   - Per stratum s = (region, bulan‑kalender atau musim, siang/malam), hitung k_s = ΣA / ΣV, yaitu ratio of sums, bukan mean of ratios.
   - Region yang disarankan: Sumatra, Kalimantan, Sulawesi, Papua, Jawa–Nusa Tenggara. Opsional: stratifikasi gambut vs non‑gambut.
   - Bila jumlah sampel kecil, **shrink** k_s ke k stratum induk. Contoh empirical Bayes: k̂ = (n·k_s + n0·k_induk)/(n + n0).
   - Ketidakpastian dihitung dengan **bootstrap per tahun** (resample tahun), lalu dilaporkan sebagai interval 90%.
6. **Bridging Terra‑only (Nov 2000–Jun 2002):** faktor r = A/T per region × bulan dari Jul 2002–Des 2005, atau 2003–2012, untuk mengubah Terra ke unit Aqua.
7. **Susun seri H:**
   - 2000‑11 → 2002‑06: T·r
   - 2002‑07 → 2021‑12: A (native)
   - 2022‑01 → sekarang: V·k (VIIRS ke unit Aqua)
   - A yang sudah drift pada 2022–2026 dipakai hanya untuk validasi.
   - Opsional: tampilkan juga seri "VIIRS‑native" untuk 2012+.
8. **Kalender dan anomali:**
   - Bin bulanan (atau 8‑harian, sesuai peringatan UG MODIS soal <8 hari).
   - Baseline = median per bulan‑kalender 2003–2022.
   - Tampilkan rasio terhadap median, robust z (MAD), dan percentile rank.
   - Heatmap tahun×bulan memakai viridis/YlOrRd (skala log) untuk nilai, dan PuOr/RdBu untuk anomali.
9. **AOI kustom:** hitungan dijumlahkan dari sel 0,01° di dalam poligon. Faktor k diambil dari region induk dengan bobot proporsional terhadap komposisi region dan sel.
10. **Ekspor CSV:** kolom `region, year, month, A_raw, T_raw, V_raw, sensor_used, k, k_lo, k_hi, H, H_lo, H_hi, baseline_median, anomaly_ratio, robust_z, pct_rank, flags (missing_data, drift, nrt)`.

### 7.3 Rencana validasi (wajib ditampilkan ke juri)
1. **Leave‑one‑year‑out CV** pada 2012–2021: prediksi A dari V·k di tahun yang ditahan, lalu laporkan error log‑bulanan (MdAPE), Spearman ρ, dan bias. Periksa khusus **2015 dan 2019** (tahun ekstrem), karena rasio bisa berubah saat asap tebal dan api besar.
2. **Uji sambungan (seam test):** tidak boleh ada lompatan level di 2002‑07 dan 2022‑01. Bandingkan rasio musiman tahun sebelum dan sesudah sambungan, uji change‑point (Pettitt), dan bandingkan dengan seri naif yang menunjukkan lompatan.
3. **Uji drift 2022–2026:** bandingkan A yang sudah drift dengan V·k. Divergensi yang membesar menurut waktu adalah bukti kuantitatif efek drift orbit, sekaligus pembenaran untuk beralih ke VIIRS.
4. **Validasi independen tahunan:** korelasi rank H tahunan (Indonesia dan per provinsi) dengan luas terbakar SiPongi 2015–2025. Jika sempat, tambahkan MCD64A1 bulanan dan GFED.
5. **Sanity check iklim:** bulan Agustus–Oktober pada tahun El Niño/IOD+ (2002, 2004, 2006, 2015, 2019, 2023, 2026) harus muncul sebagai anomali positif. Tahun La Niña (mis. 2010, 2020–2022) harus negatif. Korelasikan dengan ONI/DMI.
6. **Sensitivitas:** variasikan filter confidence, ukuran grid (0,01° vs 0,05°), dan pilihan stratifikasi. Laporkan seberapa besar perubahan anomali 2026.

### 7.4 Pesan "defensible" untuk pitch
- "Kami tidak menyamakan VIIRS dengan MODIS. Kami memetakan VIIRS ke unit MODIS memakai pasangan overpass 13:30 yang masih sinkron (2012–2021), per region, musim, dan siang/malam, lengkap dengan interval ketidakpastian."
- "Kami menolak data 2022+ Aqua sebagai acuan karena drift orbit, berdasarkan dokumentasi NASA dan Giglio 2025, dan justru memakainya untuk membuktikan efek drift itu."
- "Anomali dihitung terhadap median 20 tahun dengan percentile rank, lebih robust daripada mean yang dipakai GWIS."

---

## 8. Klaim yang belum terverifikasi / perlu dicek
1. **Jam pasti cessation S‑NPP:** 13:00 UTC (blog) vs 15:40 UTC (FAQ) pada 2 Nov 2026. Tanggalnya konsisten, jamnya tidak.
2. **Tanggal akhir Terra/Aqua:** sumber yang tersedia saling bertentangan, yaitu Ags 2026 (status Aqua 2025), Jan/Feb 2027 dan Sep 2027 (CAMS dan RFI Feb 2026), serta "akhir 2026/awal 2027" (Earthdata). Belum ditemukan pengumuman final pasca‑Okt 2026. Nilai MLT drift dibaca dari grafik proyeksi "if maximally extended", bukan telemetri aktual.
3. **Awal NOAA‑21 di FIRMS:** 1 Mar 2023 (halaman download) vs 17 Jan 2024 (FAQ). Path CSV negara untuk NOAA‑21 belum ditemukan.
4. **Rasio VIIRS/MODIS khusus Indonesia/gambut:** belum ada angka peer‑reviewed yang ditemukan. Angka 2,2–4,9× sel distinct dan ~6× (5× siang, 30× malam) berasal dari README repo peserta Space Apps 2026 lain (mis. https://github.com/Warren-530/fire-harmony, https://github.com/shahmirkhan106/firelens), **bukan literatur**. Repo yang sama menyebut challenge ditulis oleh CONAE. Teks resmi challenge belum dibaca langsung.
5. **Pemetaan VIIRS l/n/h ke skala 0–100** di SiPongi dan BRIN belum diketahui. Ambang "≥80 = tinggi" terverifikasi untuk MODIS (Table 11) dan sejalan dengan kelas SiPongi.
6. **Luas terbakar SiPongi** diambil dari media/LSM, bukan tabel resmi. Angka 2019 bahkan beragam: 1,65 Mha (KLHK) vs >2,6 Mha (FireWatch) vs 3,1 Mha (studi lain).
7. **Musim kedua Riau (Feb–Mar)** dan perbedaan detail musim Sumatra vs Kalimantan: belum ditemukan sumber primer di riset ini.
8. **Batas deteksi VIIRS "~5 m²"** hanya bersumber dari blog GFW. User guide tidak memberi angka minimum.
9. Ringkasan **Li et al. 2018/2020, Fu 2020, Vadrevu 2018, Sofan 2019/2020, Sofiev 2026** diambil dari abstrak atau ringkasan. Teks penuh tidak bisa diakses (403 dan blokir unduhan).
10. Angka 2026 (96.000 hotspot FireWatch, 22.293 hotspot SiPongi 24 jam, 1,92 Mha) berasal dari media. Sensor FireWatch tidak disebutkan.
11. **Kemungkinan FIRMS menambah sumber orbit pagi** (Sentinel‑3 SLSTR, Himawari) belum dikonfirmasi. Yang terverifikasi hanya CAMS yang memakai Sentinel‑3, dan FIRMS yang "investigating alternatives".

---

## 9. Daftar sumber primer utama (ringkas)
- MODIS C6/C6.1 Active Fire User's Guide v1.0 (2021): https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf
- VIIRS C2 375 m Active Fire User's Guide v1.2 (2025): https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf
- FIRMS FAQ: https://www.earthdata.nasa.gov/data/tools/firms/faq
- FIRMS Archive Download: https://firms2.modaps.eosdis.nasa.gov/download/
- FIRMS API area: https://firms.modaps.eosdis.nasa.gov/api/area/
- FIRMS blog S‑NPP transition (27 Okt 2026): https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know
- Giglio, Terra/Aqua Orbit‑Drift Update (LANCE UWG, Mei 2025): https://landweb.modaps.eosdis.nasa.gov/data/filePost/LANCE_UWG_Orbit_Drift_Giglio_202505.pdf
- CAMS, "Drifting away from MODIS" (25 Feb 2026): https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- Earthdata, Transition from MODIS to VIIRS: https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs
- Zheng et al. 2026, Remote Sens. 18:1650: https://doi.org/10.3390/rs18101650
- Giglio, Schroeder & Justice 2016, RSE 178:31–41; Schroeder et al. 2014, RSE 143:85–96
