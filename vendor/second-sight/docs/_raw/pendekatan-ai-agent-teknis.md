# Pendekatan AI/ML, LLM Agent, dan Stack Teknis: Harmonisasi Hotspot MODIS–VIIRS (Karhutla Indonesia)

Disusun 13 Nov 2026 untuk tim ITB, NASA Space Apps 2026 (14–15 Nov, 48 jam).
Prinsip yang dipakai di seluruh dokumen: **sains (harmonisasi + validasi) adalah inti, AI adalah antarmuka dan alat ukur ketidakpastian.** Kalau sebuah komponen AI tidak membantu keputusan pengguna (BPBD, Manggala Agni, BRGM) atau tidak menaikkan Validity, komponen itu dibuang.

Tanda **[UNVERIFIED]** berarti klaim belum dicek ke sumber primer, atau angka yang saya estimasi sendiri.

---

## 0. Fakta kunci yang mengubah desain (wajib diketahui juri dan tim)

| Fakta | Implikasi | Sumber |
|---|---|---|
| MODIS C6.1 tersedia sejak 11 Nov 2000; VIIRS S-NPP 375 m sejak 20 Jan 2012; NOAA-20 375 m sejak 1 Jan 2020 | Overlap MODIS–VIIRS ~14 tahun (2012–2026) adalah "data latih" harmonisasi | https://forum.earthdata.nasa.gov/viewtopic.php?p=14071 |
| Hanya Terra MODIS sebelum Aqua (Aqua diluncurkan Juli 2002) | Rekaman MODIS sendiri tidak homogen. 2000–2002 = 2 overpass/hari, 2003+ = 4 overpass/hari. Perlu koreksi "Terra-only → Terra+Aqua" | https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system |
| Orbit Terra drift ke waktu lebih pagi sejak 27 Feb 2020; Aqua drift ke lebih sore sejak 18 Mar 2021. Efek ke produk api "under active investigation" | Sisi MODIS sendiri non-stasioner setelah 2020/2021 (sampling siklus diurnal bergeser). Jangan anggap rasio VIIRS/MODIS konstan sepanjang overlap | https://landweb.modaps.eosdis.nasa.gov/displayissue?id=1254 ; https://landweb.modaps.eosdis.nasa.gov/data/filePost/LANCE_UWG_Orbit_Drift_Giglio_202505.pdf |
| **Pengiriman data Suomi NPP berhenti 2 Nov 2026** (NASA LANCE; NOAA sempat menyebut 1 Nov). Pengganti: NOAA-20 (VJ1) dan NOAA-21 (VJ2) | Pipeline "sampai sekarang" wajib pakai NOAA-20/21. Ini argumen kuat bahwa harmonisasi lintas-satelit itu kebutuhan nyata, bukan latihan akademis | https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026 ; https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-noaa-20-noaa-21-what-lance-users-need-know |
| Terra MODIS direncanakan berhenti ~Jan 2027, Aqua ~Sep 2027 (menurut CAMS) | MODIS akan hilang. Masa depan = VIIRS-only, jadi deret 2000-sekarang hanya bisa diteruskan lewat pemetaan VIIRS→"MODIS-equivalent" | https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system |
| Batas deteksi MODIS ~3,7 MW (malam, nadir) sampai ~40 MW (siang, tepi swath); VIIRS ~0,5–0,7 MW malam. Probabilitas deteksi api besar: MODIS 78%, VIIRS 88% global; omisi di ekuator >60% (MODIS) vs ~40% (VIIRS) karena awan | Ada dasar fisik untuk "observation operator": dari deteksi VIIRS + FRP bisa disimulasikan apa yang *akan* terlihat MODIS | Sofiev & Kouznetsov 2026, GMD 19:10123, https://gmd.copernicus.org/articles/19/10123/2026/ |
| VIIRS 375 m: 3× lebih banyak piksel api (siang) dan 25× (malam) dibanding VIIRS 750 m; commission error <1,2% untuk confidence nominal | Rasio siang/malam berbeda drastis, jadi harmonisasi harus dipisah day/night | Schroeder et al. 2014, RSE 143:85–96, https://earthdata.nasa.gov/s3fs-public/imported/Schroeder_et_al_2014b_RSE.pdf |
| VIIRS 375 m vs Landsat-8 di gambut terdegradasi Indonesia: ~80% kesepakatan untuk api kecil (<14 ha), sampai 90% bila day+night digabung | VIIRS valid untuk gambut Indonesia. Ini titik rujukan "kebenaran" | Sofan et al. 2020, IJDE, https://doaj.org/article/8b86910fa5de45e3bd836ec8b331e073 |
| NASA sendiri sedang membangun rekaman harmonisasi MODIS/VIIRS 0,25° selama 25 tahun (tim Boschetti) | Grid 0,25° sejalan dengan praktik komunitas sains | https://modis.gsfc.nasa.gov/sci_team/meetings/202204/presentations/session1/boschetti.pdf |
| FIRMS API `area`: DAY_RANGE 1–5 hari; MAP_KEY dibatasi 5.000 transaksi/10 menit; request besar dihitung beberapa transaksi. Endpoint `country` sedang tidak tersedia | Untuk 25 tahun, API bukan jalur utama. Pakai **Archive Download** (CSV per negara/sensor), API hanya untuk top-up NRT | https://firms.modaps.eosdis.nasa.gov/api/area/ ; https://firms.modaps.eosdis.nasa.gov/api/map_key/ ; https://firms.modaps.eosdis.nasa.gov/download/ |

---

## 1. ML untuk harmonisasi itu sendiri (inti sains)

### 1.1 Mendefinisikan "mata uang bersama" sebelum memilih model

Ada dua arah:

- **A. VIIRS → MODIS-equivalent (DISARANKAN sebagai deret utama).** Targetnya (count MODIS) teramati sepanjang 2000–2027, sehingga model hanya *menurunkan* informasi (VIIRS lebih sensitif). Ini juga satu-satunya cara meneruskan deret setelah MODIS mati 2027.
- **B. MODIS → VIIRS-equivalent / backcast pra-2012 (OPSIONAL, hanya visual dengan interval lebar).** Api kecil yang tidak terlihat MODIS tidak punya jejak di data MODIS. Backcast hanya bisa memberi *ekspektasi statistik*, bukan rekonstruksi. Risiko Validity tinggi bila disajikan seolah observasi.

Unit analisis: **agregat sel×waktu** (mis. 0,25° × hari/pentad/bulan, dipisah day/night), bukan pencocokan piksel-ke-piksel. Pencocokan piksel butuh footprint dan waktu overpass yang berbeda, terlalu mahal untuk 48 jam.

Pra-pemrosesan yang sering dilupakan (dampak Validity besar, effort kecil):
1. Buang `type` = 2 (static land source, mis. flare migas di Sumatra/Kalimantan) dan 3 (offshore). Kolom `type` ada di arsip SP FIRMS [UNVERIFIED: pastikan kolom ada di CSV NOAA-21].
2. Filter confidence yang konsisten: MODIS (0–100) vs VIIRS (l/n/h). Contoh: MODIS ≥30 dan VIIRS n+h. Tampilkan sebagai parameter, jangan hardcode diam-diam.
3. Pisahkan Terra vs Aqua, siang vs malam, S-NPP vs NOAA-20 vs NOAA-21. Hitung rasio per pasangan.
4. Gunakan SP (standard/science) untuk histori dan NRT hanya untuk ekor terbaru, lalu beri flag bahwa NRT bisa direvisi.

### 1.2 Hirarki model (bangun dari bawah, berhenti saat waktu habis)

| Level | Model | Kenapa |
|---|---|---|
| L0 baseline | **Rasio terstratifikasi**: k = Σ MODIS / Σ VIIRS per (strata: gambut/non-gambut × bulan × day/night × satelit) selama overlap; MODIS_eq = k·VIIRS | Bisa dijelaskan dalam 1 slide; juri bisa memeriksa |
| L1 fisik | **Observation operator**: hitung hanya deteksi VIIRS dengan FRP di atas batas deteksi MODIS (fungsi dari scan angle dan day/night, angka dari Sofiev & Kouznetsov 2026), lalu agregasi | Menghubungkan harmonisasi dengan fisika sensor, bukan sekadar korelasi. Nilai "Validity" paling tinggi per jam kerja |
| L2 ML | **LightGBM / GAM** memprediksi log1p(MODIS count) dari fitur VIIRS + kovariat | Menangkap non-linearitas (asap pekat menurunkan deteksi, saturasi saat kluster besar) |
| L3 ketidakpastian | **Conformal** (split/CQR, Mondrian per strata) di atas L2 | Interval jujur dengan jaminan coverage empiris |

Fitur yang masuk akal untuk L2 (semua bisa diturunkan dari FIRMS + 2–3 raster statis):
- dari VIIRS per sel-waktu: count total, count day/night, Σ FRP, median FRP, **fraksi deteksi dengan FRP < batas deteksi MODIS**, rata-rata `scan` (ukuran piksel), jumlah kluster;
- statis: fraksi gambut (peta gambut KementAN/BBSDLP [UNVERIFIED ketersediaan unduhan], atau Global Peatland Map), tutupan lahan (MODIS MCD12Q1 tahunan lebih konsisten temporal daripada ESA WorldCover);
- temporal: bulan, tahun (hati-hati, lihat leakage), indikator era orbit drift (pra/pasca Feb 2020 untuk Terra, Mar 2021 untuk Aqua);
- awan: fraksi awan (ERA5 total cloud cover 0,25° sebagai proxy murah; MOD35/VNP cloud mask terlalu berat untuk 48 jam).

Model GAM (pyGAM / mgcv) layak dipertimbangkan karena kurva parsialnya bisa ditunjukkan ke juri ("efek fraksi gambut"). LightGBM lebih akurat tapi butuh SHAP untuk dijelaskan.

### 1.3 Validasi, leakage, dan domain shift (bagian yang membedakan dari kompetitor)

- **Jangan random K-fold** pada sel-hari. Autokorelasi spasial-temporal membuat skor terlalu optimistis. Pakai **leave-one-fire-season-out** (mis. tahan 2015, 2019, 2023 bergantian) dan **spatial block CV** (tahan satu provinsi/KHG). ProbFire (Nikonovas et al. 2022) dan Mezbahuddin et al. 2023 sama-sama memakai leave-one-year-out. Catatan ProbFire: LOYO tetap melatih dengan tahun "masa depan", jadi untuk klaim operasional pakai forward-chaining.
  - https://nhess.copernicus.org/articles/22/303/2022/
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC9837124/
- **Domain shift yang nyata:** (i) 2015 ekstrem (asap pekat menutupi deteksi), (ii) perubahan kebijakan pasca-2016 (BRG dibentuk, moratorium), (iii) drift orbit Terra/Aqua 2020+, (iv) pergantian S-NPP → NOAA-20/21 (Nov 2026), (v) Terra-only 2000–2002. Masing-masing ditampilkan sebagai garis vertikal/anotasi di kalender.
- **Leakage halus:** fitur "tahun" atau "anomali historis" yang dihitung dari seluruh periode (termasuk tahun uji) membocorkan informasi. Hitung median historis *di dalam* fold.
- **Metrik yang relevan untuk pengguna** (lebih dari RMSE): bias total bulanan per provinsi; Spearman ranking tahunan (apakah 2015 > 2019 > 2023 tetap terjaga); **kesepakatan flag anomali** (bulan yang dinilai "di atas p90" oleh MODIS asli vs MODIS-equivalent dari VIIRS) memakai F1/Cohen's κ.
- **Cek independen murah:** korelasi tahunan dengan burned area MCD64A1 atau GFED5 per provinsi. Kalau harmonisasi merusak korelasi itu, ada yang salah.

### 1.4 Conformal prediction untuk interval jujur

- Split conformal / **Conformalized Quantile Regression (CQR)** dengan kalibrasi pada tahun yang ditahan; **Mondrian conformal** per strata (gambut vs non-gambut) supaya coverage tidak hanya benar rata-rata.
- Asumsi exchangeability dilanggar oleh deret waktu. Opsi: EnbPI / ACI (MAPIE `MapieTimeSeriesRegressor`, metode `"enbpi"` atau `"aci"`).
  - https://mapie.readthedocs.io/en/latest/generated/mapie.regression.MapieTimeSeriesRegressor.html
  - Xu & Xie (EnbPI): https://arxiv.org/abs/2010.09107
  - Benchmark conformal time series 2026: https://arxiv.org/html/2601.18509v1
- Yang ditampilkan: **coverage empiris** (mis. "interval 90% mencakup 88,7% bulan uji") per strata. Itu angka Validity yang kuat dan jarang dimiliki tim lain. MAPIE + LightGBM quantile perlu sedikit kode custom (belum ada resep siap pakai).

### 1.5 Backcasting/"super-resolution" pra-2012 (VIIRS-equivalent)

- Secara fisik tidak bisa merekonstruksi api kecil yang tidak terdeteksi MODIS. Paling jauh: `E[VIIRS | MODIS, kovariat]` dengan interval lebar.
- Kalau ditampilkan: beri warna/tekstur berbeda ("estimasi model") dan interval conformal; jangan dijumlahkan ke statistik resmi.
- Rekomendasi: **opsional, prioritas rendah.** Kalender 2000–sekarang cukup dalam satuan MODIS-equivalent; satuan VIIRS hanya untuk 2012+.

### 1.6 Deteksi anomali kalender

| Metode | Catatan untuk data count karhutla |
|---|---|
| **Median historis + persentil/robust z (MAD) per sel/AOI × bulan atau pentad** | Paling transparan, langsung menjawab permintaan challenge ("anomaly vs historical median"). Untuk AOI kecil yang zero-inflated, pakai persentil empiris atau model Poisson/Negative-Binomial, bukan z-score |
| STL robust (Cleveland et al. 1990) | Baik untuk AOI besar (provinsi), memisahkan musiman dan tren. Pada AOI kecil sinyal terlalu jarang |
| Seasonal-Hybrid ESD (Hochenbaum et al. 2017, arXiv:1704.07706, paket Twitter AnomalyDetection) | Bagus untuk menandai lonjakan harian. Asumsi residu kurang cocok untuk count jarang |
| Isolation Forest | Multivariat, tapi alasan "kenapa anomali" sulit dijelaskan ke BPBD. Hindari sebagai metode utama |

Rekomendasi: anomali = **persentil terhadap baseline 2003–2022 (Terra+Aqua penuh)**, dihitung di dalam satuan yang sudah diharmonisasi, ditambah interval bootstrap. STL opsional untuk panel provinsi. Baseline harus menyebut periode dan sensor secara eksplisit di UI.

### 1.7 Nowcasting / prakiraan subseasonal–musiman

Literatur Indonesia:
- **Field et al. 2016 (PNAS 113:9204)**: sensitivitas non-linear terhadap kekeringan; ambang ~**4 mm/hari** curah hujan rata-rata musim kering, dan di bawahnya api dan polusi naik cepat. Penulis menyarankan early warning yang dikaitkan dengan prakiraan presipitasi. https://pmc.ncbi.nlm.nih.gov/articles/PMC4995960
- **Spessa et al. 2015 (NHESS 15:429)**, catatan: jurnal NHESS, bukan Biogeosciences. Prakiraan musiman ECMWF System 4 memberi skill untuk area terbakar Kalimantan beberapa bulan sebelumnya. https://nhess.copernicus.org/articles/15/429/2015/
- **Shawki et al. 2017 (GRL 44:9996)**: CFSv2 + Drought Code memprediksi 2015. Menurut slide Field, lead Kalimantan ~6 bulan dan Sumatra ~2 bulan; prakiraan 2017 untuk Kalimantan tidak terverifikasi (false alarm). https://repository.library.noaa.gov/view/noaa/28437 ; https://gofcgold.umd.edu/sites/default/files/fireit_meetings/GOFC_Fire_IT_2017/day2/Field.pdf
- **Nikonovas et al. 2022, ProbFire (NHESS 22:303)**: MLP sederhana (1 hidden layer, 15 node), 0,25°, bulanan, target P(MODIS count > 10), input ERA5→SEAS5 (presipitasi 5 bulan sebelumnya, T, RH) + gambut + kehilangan hutan + histori api. Skill di atas klimatologi pada lead 2–4 bulan di Kalimantan selatan, Sumatra selatan, dan Papua selatan; tidak ada skill di Kalimantan barat; Sumatra tengah hanya lead 0. https://nhess.copernicus.org/articles/22/303/2022/
- **Mezbahuddin et al. 2023 (Sci. Rep.)**: ANN 0,05°, 2-mingguan, Riau. Menambah hidrologi simulasi (muka air tanah, kelembapan permukaan) menaikkan R² dari ~0,4 ke ~0,8 untuk count MODIS, baik di gambut maupun non-gambut. https://pmc.ncbi.nlm.nih.gov/articles/PMC9837124/

Data yang realistis dalam 48 jam:
- ENSO (ONI/Niño3.4, NOAA CPC) dan IOD (DMI, NOAA PSL/BoM): CSV kecil, mudah.
- CHIRPS bulanan 0,05° (UCSB CHC atau Google Earth Engine): mudah untuk agregasi per provinsi. GPM IMERG lebih berat.
- **GEFF-ERA5 (CEMS fire historical, CDS/EWDS)**: Drought Code dan FWI. DC dirancang untuk lapisan organik dalam, sehingga menjadi proxy paling masuk akal untuk kekeringan gambut. Unduhan CDS bisa antre lama, jadi mulai unduh di jam pertama atau ambil via GEE community catalog. https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1 ; https://gee-community-catalog.org/projects/cems_fire/
- **TMAT SiPPEG (BRGM/KLH)**: modul TMAT hanya untuk pengguna terdaftar; tidak ditemukan API terbuka. **Jangan diandalkan dalam 48 jam.** Sebut sebagai integrasi masa depan. https://sippeg.kemenlh.go.id/apps/Home/download_panduan

Posisi strategis: kompetitor sudah memakai LightGBM Tweedie. Jangan bersaing di "model prakiraan yang lebih canggih". Bedakan diri lewat (1) target yang sudah diharmonisasi, sehingga prakiraan tidak belajar artefak pergantian sensor; (2) **validasi jujur** (forward-chaining, reliability diagram, Brier skill score vs klimatologi); (3) **panel konteks kekeringan** berbasis ambang Field 2016 (presipitasi 30/90 hari vs 4 mm/hari, status ENSO/IOD, DC) yang langsung bisa dibaca BPBD. Model prakiraan (mis. klasifikasi P(bulan depan > p90) dengan LightGBM) bersifat opsional dan ditampilkan sebagai "outlook" dengan skill-nya.

---

## 2. Geospatial foundation model (Prithvi dkk.): relevan atau berlebihan?

- **Prithvi-EO-2.0-300M-BurnScars** (IBM–NASA): segmentasi burn scar di citra HLS 30 m, dilatih pada ~800 chip HLS Burn Scars **dari AS kontinental**; IoU kelas terbakar 87,52 (test). https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars ; paper https://arxiv.org/abs/2412.02732
- Masalah untuk kasus ini: (i) challenge-nya tentang **hotspot/active fire count**, bukan burned area; (ii) domain shift ke gambut tropis berawan/berasap; tidak ada label Indonesia siap pakai; (iii) butuh unduhan HLS + GPU + fine-tuning, yang terlalu banyak untuk 48 jam; (iv) juri akan bertanya "apa hubungannya dengan harmonisasi?".
- Alternatif murah dengan nilai Validity serupa: memakai **produk burned area yang sudah ada** (MCD64A1, FireCCI51, GFED5) sebagai pembanding independen pada level provinsi-tahun.
- **Rekomendasi: hindari.** Cukup sebut di slide "future work" (validasi di level kejadian dengan Prithvi + Sentinel-2/Landsat).

---

## 3. LLM agent: cara yang benar

### 3.1 Contoh sistem nyata (untuk positioning, bukan untuk ditiru mentah)

| Sistem | Pola | Sumber |
|---|---|---|
| NASA–Microsoft **Earth Copilot** (2024, uji internal NASA, rencana ke VEDA) | Pencarian dan penemuan dataset lewat bahasa alami (Azure OpenAI) | https://blogs.microsoft.com/?p=52562133 ; https://www.maginative.com/article/microsoft-and-nasa-built-earth-copilot-to-democratize-access-to-satellite-data/ |
| **Google Earth AI Geospatial Reasoning agent** (Gemini) | Mengorkestrasi model-model Earth AI sebagai *tools*; laporan internal: akurasi 0,82 vs 0,50 Gemini 2.5 Pro tanpa tools (klaim Google sendiri) | https://research.google/pubs/google-earth-ai-geospatial-reasoning-agent-capabilities-and-a-systematic-evaluation/ ; https://arxiv.org/abs/2510.18318 |
| **GeoLLM-Engine** (Microsoft, arXiv:2404.15500) | Benchmark >500 ribu tugas geospasial multi-langkah dengan API tools + checker korektnes otomatis | https://arxiv.org/abs/2404.15500 |
| **ThinkGeo** (arXiv:2505.23752) | Benchmark agen tool-augmented RS; menemukan disparitas akurasi tools dan konsistensi perencanaan antar model | https://arxiv.org/abs/2505.23752 |
| ESA Φ-lab **IC-EO** | NL → **kode Python yang dapat diaudit** yang memanggil API/model EO; 64,2% vs 51,7% (GPT-4o) untuk komposisi lahan, 50% vs 0% untuk analisis pasca-kebakaran | https://cin.philab.esa.int/databases/projects/ic-eo-interpretable-code-based-assistant-for-earth-observation |
| ESA Φ-lab **EVE** (Earth Virtual Expert) | LLM domain EO 24B; pilot 350 pengguna; versi agentik memakai MCP untuk tools EO | https://aclanthology.org/2026.acl-industry.72.pdf |

Benang merahnya: **sistem serius menempatkan LLM sebagai perencana/penerjemah yang memanggil tools deterministik, dan mengukur akurasinya dengan benchmark.** Pola inilah yang ditiru, dalam skala kecil.

### 3.2 (a) Query bahasa alami → panggilan API deterministik

Contoh: *"tampilkan kalender karhutla KHG Sungai Kampar 2015–2025, bandingkan dengan median"*.

Desain:
1. LLM hanya mengisi **JSON schema** (tool use / structured output): `{aoi: {type: "KHG"|"provinsi"|"kabupaten"|"bbox", name}, start, end, sensor_mode: "harmonized"|"modis"|"viirs", baseline: "2003-2022", metric: "count"|"anomaly_pct"}`.
2. **Resolver deterministik**: nama AOI → ID poligon lewat gazetteer lokal (fuzzy match: rapidfuzz). Sumber batas: admin dari geoBoundaries/GADM/BIG; KHG dari KLHK/BRGM [UNVERIFIED: ketersediaan unduhan shapefile KHG publik; siapkan fallback bbox].
3. UI menampilkan **"chip" hasil parsing** yang bisa diedit pengguna sebelum dieksekusi. LLM tidak pernah menyentuh angka.
4. Fallback tanpa LLM: form dropdown yang sama. Demo tetap jalan bila API LLM gagal.

Nilai: BPBD/Manggala Agni tidak perlu menggambar poligon atau mengenal istilah sensor. Risiko: salah AOI. Mitigasinya adalah konfirmasi chip ditambah eval set (3.5).

### 3.3 (b) Situation brief Bahasa Indonesia yang grounded

Arsitektur "**facts-first, LLM-second, verifier-last**":
1. Kode menghitung **fact table** (JSON): jumlah hotspot harmonisasi AOI periode X, median historis, persentil, rank tahun, presipitasi 30/90 hari vs 4 mm/hari, ONI/DMI terbaru, interval conformal, flag kualitas data.
2. LLM menulis paragraf dengan **placeholder** (`{{hotspot_okt_2025}}`), bukan angka. Angka diisi oleh kode.
3. **Verifier numerik**: ekstrak semua angka di teks final (regex, format Indonesia: titik ribuan, koma desimal, "persen"). Tiap angka harus cocok dengan fact table (toleransi pembulatan) atau output ditolak dan dibuat ulang; setelah 2 kali gagal, jatuh ke **template murni**.
4. Kosakata terkendali: "hotspot/titik panas" bukan "titik api"; "konsisten dengan" bukan "disebabkan oleh"; selalu sertakan kalimat keterbatasan ("hotspot ≠ jumlah kejadian kebakaran", juga diingatkan KLHK).

Dasar literatur: kesalahan numerik umum di data-to-text dan model memperlakukan angka seperti token biasa (survei hallucination Ji et al.: https://arxiv.org/abs/2202.03629 ; survei faithfulness: https://arxiv.org/abs/2203.05227). Praktik yang dianjurkan: angka dihitung kode lalu divalidasi otomatis sebelum tampil.

### 3.4 (c) Agen "jelaskan anomali"

- Input: fact table + kovariat terhitung (anomali CHIRPS, DC GEFF, ONI, DMI, fraksi gambut AOI, flag sensor).
- **Aturan atribusi deterministik** (ditulis tim, berbasis literatur): mis. jika presipitasi 90 hari < 4 mm/hari dan ONI ≥ +0,5, maka "konsisten dengan pola kekeringan El Niño (Field 2016)"; jika lonjakan bertepatan dengan pergantian sensor, maka "kemungkinan artefak sensor, lihat flag".
- LLM hanya memverbalkan aturan yang terpicu dan **mengutip sumber yang sudah ditentukan** (daftar sitasi tetap, tanpa sitasi bebas).
- Nilai tambah nyata: menjaga pengguna dari salah tafsir artefak sensor. Ini sekaligus menjadi cerita Validity.

### 3.5 (d) Evaluasi agen (yang ditunjukkan ke juri)

| Uji | Cara | Target |
|---|---|---|
| Parsing NL→JSON | 40–60 query uji (variasi bahasa: formal, singkatan "Kalteng", typo, campur Inggris) dengan JSON harapan | Exact-match AOI + rentang ≥ 90% |
| Numeric consistency | Verifier pada 100 brief hasil generasi acak | 0 angka tak-terlacak (keras, karena output ditolak bila gagal) |
| Groundedness klaim | Tiap kalimat kausal harus memetakan ke aturan yang terpicu | 100% ter-map |
| Robustness | Query di luar cakupan ("prediksi 2030", AOI di luar Indonesia) | Menolak dengan sopan |

Tampilkan tabel hasil eval di README dan 1 slide. Dengan begitu AI dibingkai sebagai **komponen yang diuji**, bukan chatbot.

### 3.6 Gimmick vs nilai di mata juri

- **Terlihat gimmick:** chatbot sebagai fitur utama, jawaban LLM berisi angka, "AI memprediksi kebakaran" tanpa skill score, multi-agent tanpa alasan, avatar/persona. Bloomee 2025 (ensemble ML + chatbot agentik) berhenti di Global Nominee.
- **Terlihat bernilai:** LLM sebagai *interface* ke pipeline yang bisa diaudit; brief yang langsung bisa ditempel ke laporan BPBD; tabel eval; tombol "lihat query/angka sumber" di setiap kalimat.
- Framing presentasi: *"Sains adalah mesinnya, AI adalah setirnya."* Alokasi waktu demo sekitar 70% kalender + validasi + ketidakpastian, 30% interface NL + brief.

---

## 4. Pipeline agentik / multi-agent untuk reproducibility

- **Multi-agent LLM untuk ingestion: hindari.** Ingestion FIRMS deterministik (unduh arsip → Parquet) lebih andal, lebih cepat, dan bisa diulang. Agen LLM menambah titik gagal tanpa nilai.
- **QA berbasis aturan: pakai.** Ini "agen" dalam arti cron job/skrip, bukan LLM:
  - panggil `/api/data_availability/` dan `/api/missing_data/` FIRMS → tandai hari kosong per sensor;
  - deteksi lompatan struktural count per sensor (CUSUM/Pettitt sederhana) lalu cocokkan dengan tanggal yang diketahui: Aqua mulai 2002, S-NPP 20 Jan 2012, NOAA-20 1 Jan 2020, drift Terra 27 Feb 2020 dan Aqua 18 Mar 2021, berhenti S-NPP 2 Nov 2026, rencana akhir Terra (Jan 2027) dan Aqua (~Sep 2027);
  - tampilkan sebagai **banner "kesehatan data"** dan anotasi di kalender.
- LLM boleh dipakai untuk *merangkum* laporan QA ke kalimat (opsional, dengan verifier yang sama).
- Reproducibility nyata: `make data && make model && make site`, versi data (tanggal unduh + hash) di footer, notebook validasi di repo.

---

## 5. Engineering untuk build 48 jam

### 5.1 Estimasi volume data Indonesia [UNVERIFIED: estimasi, verifikasi dengan menghitung baris CSV hasil unduhan]

- MODIS (Terra+Aqua) Indonesia 2000–2026: ~1–2 juta baris (tahun ekstrem seperti 2015 bisa >100 ribu; GFW mencatat ~130 ribu alert pada musim 2015, campuran sensor: https://www.wri.org/insights/intense-forest-fires-threaten-derail-indonesias-progress-reducing-deforestation).
- VIIRS 375 m: S-NPP 2012–2026 ~3–6 juta; NOAA-20 2020+ ~1–3 juta; NOAA-21 ~0,5–1,5 juta.
- Total ~5–12 juta baris, ~1–2 GB CSV, **~150–400 MB Parquet (zstd)**. Muat nyaman di laptop dengan DuckDB; tidak perlu cluster/Spark.

### 5.2 Akuisisi

- **Utama: FIRMS Archive Download** (pilih negara Indonesia, per sensor, CSV, butuh Earthdata Login/email). Ajukan request **malam ini (13 Nov)** karena pemrosesan arsip bisa memakan waktu [UNVERIFIED: lama antrean]. https://firms.modaps.eosdis.nasa.gov/download/
- **Top-up NRT:** API `area` dengan bbox Indonesia, DAY_RANGE ≤5, sumber `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`. Kuota 5.000 transaksi/10 menit lebih dari cukup untuk top-up.
- Sebagai perbandingan: menarik 25 tahun via API ≈ 26 thn × 73 request/thn × 4 sumber ≈ 7.600 request, mungkin dihitung berlipat untuk bbox besar. Bisa, tapi rawan; jangan jadi jalur utama.
- Cadangan: GEE `FIRMS` (raster MODIS, bukan titik) dan GEE community catalog vektor FIRMS (https://gee-community-catalog.org/projects/firms_vector/).

### 5.3 Penyimpanan & komputasi

- **DuckDB + Parquet / GeoParquet** (ekstensi `spatial` untuk point-in-polygon AOI; ekstensi komunitas `h3`: `INSTALL h3 FROM community; LOAD h3;` lalu `h3_latlng_to_cell(lat, lon, res)`). https://duckdb.org/community_extensions/extensions/h3
- **Grid: 0,25° lat-lon untuk model sains** (selaras dengan ERA5/GEFF 0,25°, ProbFire, dan rekaman harmonisasi NASA Boschetti; join kovariat trivial). **H3 res 6 (~36 km²) / res 5 (~253 km²) opsional untuk tampilan peta** (equal-area-ish, deck.gl `H3HexagonLayer`). Jangan jalankan dua grid di model.
- Precompute tabel (hanya baris non-nol):
  1. `daily_cell` (tanggal, sel 0,25°, sensor, day/night, count, ΣFRP) → sumber harmonisasi;
  2. `daily_aoi` untuk ~34–38 provinsi + ~500 kab/kota + KHG prioritas → kalender instan;
  3. `baseline` (median/persentil per AOI × DOY-pentad/bulan);
  4. `harmonized` + interval conformal.
- AOI bebas (poligon gambar pengguna): query titik mentah via DuckDB di server, **atau duckdb-wasm di browser** membaca Parquet lewat HTTP range request, tanpa backend. https://duckdb.org/docs/api/wasm/overview

### 5.4 Frontend

- **Kalender karhutla**: heatmap tahun (baris 2000–2026) × hari/pentad (kolom), warna = anomali terhadap median. ECharts `calendar`/heatmap (https://echarts.apache.org/en/option.html#calendar) atau Observable Plot `cell` (https://observablehq.com/plot/marks/cell). D3 hanya bila ada waktu kustomisasi.
- **Peta**: MapLibre GL JS + **PMTiles** (vector tiles statis tanpa tile server; https://docs.protomaps.com/pmtiles/) untuk batas AOI; deck.gl untuk hex/titik.
- Toggle sensor (MODIS asli / VIIRS asli / harmonisasi ± interval), anotasi event sensor, tombol "Unduh CSV" (dengan metadata: versi data, filter confidence, baseline).

### 5.5 Hosting dan keandalan demo

- **Offline-first**: semua agregat diprecompute → file statis (Parquet/JSON/PMTiles) di static host (GitHub Pages/Cloudflare Pages/Netlify). Demo jalan walau API FIRMS/LLM lambat.
- Fungsi serverless memiliki batas ukuran bundle dan waktu eksekusi, sehingga DuckDB native + data besar kurang cocok di lambda [UNVERIFIED: angka batas per platform]. Pilihan: duckdb-wasm di klien, atau satu backend kecil (FastAPI) di Render/Fly.io/HF Spaces khusus untuk proxy LLM (menyembunyikan API key) dan query AOI bebas.
- Cache respons LLM untuk query demo + fallback template. **Rekam video demo cadangan.**
- Jangan commit kunci (MAP_KEY, LLM key) ke repo; simpan di env var hosting.

---

## 6. Matriks keputusan

| Pendekatan | Nilai untuk pengguna | Dampak ke Validity | Risiko gimmick | Effort 48 jam | Rekomendasi |
|---|---|---|---|---|---|
| Pra-pemrosesan konsisten (type≠2/3, confidence, day/night, satelit, SP vs NRT) | Tinggi: angka tidak tercemar flare migas/artefak | Sangat tinggi | Nol | Rendah (2–4 jam) | **Pakai** |
| Rasio terstratifikasi VIIRS→MODIS-eq (L0) | Tinggi: deret 2000–sekarang konsisten | Tinggi, transparan | Nol | Rendah | **Pakai** |
| Koreksi Terra-only 2000–2002 → Terra+Aqua-eq | Sedang: awal deret tidak terbaca "rendah palsu" | Tinggi | Nol | Rendah | **Pakai** |
| Observation operator berbasis FRP + batas deteksi MODIS (L1) | Sedang (tak terlihat langsung) | Sangat tinggi, berdasar fisika | Rendah | Sedang (4–6 jam) | **Pakai** (jadi pembeda) |
| LightGBM/GAM harmonisasi + kovariat (L2) | Sedang | Tinggi **jika** validasi block-CV; negatif jika random CV | Sedang | Sedang | **Opsional** (setelah L0/L1 jadi) |
| Conformal interval (CQR/Mondrian) + coverage empiris | Tinggi: "seberapa yakin?" | Sangat tinggi | Rendah | Rendah–sedang (3–4 jam) | **Pakai** |
| Backcast VIIRS-equivalent pra-2012 | Rendah–sedang | Risiko negatif bila disajikan seperti observasi | Tinggi | Sedang | **Opsional/hindari** (hanya dengan interval lebar) |
| Anomali vs median/persentil historis | Sangat tinggi (inti challenge) | Tinggi bila baseline eksplisit | Nol | Rendah | **Pakai** |
| STL / S-H-ESD | Sedang (provinsi) | Sedang | Rendah | Rendah | **Opsional** |
| Isolation Forest untuk anomali | Rendah (sulit dijelaskan) | Rendah | Sedang | Rendah | **Hindari** |
| Panel konteks kekeringan (presipitasi vs 4 mm/hari, ONI/DMI, DC GEFF) | Sangat tinggi untuk BPBD (early warning) | Tinggi (berbasis literatur) | Rendah | Sedang (unduh data) | **Pakai** |
| Outlook ML (P bulan depan > p90) + skill score | Tinggi bila skill jujur | Sedang; negatif tanpa validasi forward | Sedang (kompetitor juga punya) | Sedang–tinggi | **Opsional** |
| TMAT SiPPEG / hidrologi gambut simulasi | Tinggi (Mezbahuddin: R² 0,4→0,8) | Tinggi | Rendah | Sangat tinggi (akses tertutup) | **Hindari** (future work) |
| Prithvi burn-scar / foundation model | Rendah untuk challenge ini | Rendah (domain shift) | Tinggi | Sangat tinggi | **Hindari** |
| Pembanding independen burned area (MCD64A1/GFED5) | Rendah langsung | Tinggi | Nol | Rendah–sedang | **Opsional** (bagus untuk slide validasi) |
| LLM: NL → JSON → API deterministik + chip konfirmasi | Tinggi (aksesibilitas BPBD) | Netral (tidak menyentuh angka) | Rendah–sedang | Sedang (4–6 jam) | **Pakai** |
| LLM: brief Bahasa Indonesia dengan placeholder + verifier numerik | Sangat tinggi (langsung dipakai laporan) | Netral–positif (angka terjamin) | Rendah bila verifier ditunjukkan | Sedang | **Pakai** |
| LLM: penjelas anomali via aturan atribusi | Tinggi (cegah salah tafsir artefak sensor) | Positif | Sedang | Sedang | **Opsional** (versi rule-based dulu) |
| Eval agen (parsing set, numeric consistency) | Tidak langsung | Tinggi (AI yang terukur) | Nol | Rendah (2–3 jam) | **Pakai** |
| Chatbot bebas sebagai fitur utama | Rendah | Negatif (risiko halusinasi angka) | Sangat tinggi | Rendah | **Hindari** |
| Multi-agent LLM untuk ingestion | Rendah | Negatif (non-deterministik) | Tinggi | Sedang | **Hindari** |
| QA data rule-based (missing_data, change-point, event sensor) | Tinggi (kepercayaan) | Tinggi | Nol | Rendah | **Pakai** |
| Precompute statis + duckdb-wasm/static host | Tinggi (cepat, demo andal) | Netral | Nol | Rendah–sedang | **Pakai** |

---

## 7. Arsitektur rekomendasi

```
┌──────────────────────── OFFLINE (laptop, jam 0–20) ────────────────────────┐
│ FIRMS Archive Download (MODIS C6.1, VIIRS S-NPP/NOAA-20/NOAA-21, SP)       │
│   + API area (NRT top-up, ≤5 hari/request)                                  │
│        │                                                                   │
│        ▼                                                                   │
│ ingest.py → DuckDB → Parquet (zstd)                                        │
│   filter: type∉{2,3}, confidence param, day/night, satelit, SP/NRT flag     │
│        │                                                                   │
│        ├─► qa.py (rule-based): missing_data, change-point, event sensor     │
│        │      → data_health.json                                            │
│        ▼                                                                   │
│ grid 0,25° harian/pentad (sel × sensor × day/night)                        │
│        │                                                                   │
│        ▼                                                                   │
│ harmonize.py                                                               │
│   L0 rasio terstratifikasi (gambut × bulan × day/night × satelit)          │
│   L1 observation operator (FRP > batas deteksi MODIS f(scan, D/N))         │
│   L2 (opsional) LightGBM/GAM + kovariat (gambut, MCD12Q1, ERA5 awan)       │
│   L3 conformal CQR/Mondrian → interval + coverage per strata               │
│   Validasi: leave-one-season-out + spatial block; metrik bias/Spearman/κ   │
│        │                                                                   │
│        ▼                                                                   │
│ aggregate.py → daily_aoi (provinsi, kab/kota, KHG) + baseline 2003–2022    │
│   + anomali persentil + konteks (CHIRPS, ONI, DMI, GEFF DC)                 │
│        │                                                                   │
│        ▼                                                                   │
│ Static bundle: Parquet / JSON / PMTiles  (+ notebook validasi, hash data)  │
└────────────────────────────────────────────────────────────────────────────┘
                     │ deploy (static host)
                     ▼
┌──────────────────────────── ONLINE (demo) ─────────────────────────────────┐
│ Frontend: MapLibre + PMTiles + deck.gl │ Kalender ECharts/Observable Plot  │
│   toggle MODIS / VIIRS / Harmonisasi±interval, anotasi event sensor,       │
│   banner kesehatan data, Unduh CSV (+metadata)                             │
│   AOI bebas → duckdb-wasm atas Parquet (HTTP range)                        │
│                                                                            │
│ Backend tipis (FastAPI, 1 instance) — hanya untuk LLM:                     │
│   /parse : NL → JSON schema → resolver gazetteer → chip konfirmasi         │
│   /brief : fact table → LLM (placeholder) → verifier numerik → template    │
│            fallback                                                        │
│   /explain: aturan atribusi terpicu → LLM verbalisasi + sitasi tetap       │
│   cache respons demo; LLM gagal → UI form + template tetap jalan           │
│                                                                            │
│ eval/: 50 query uji + 100 brief → laporan akurasi & numeric consistency    │
└────────────────────────────────────────────────────────────────────────────┘
```

Urutan kerja yang disarankan (48 jam):
1. **Jam 0–8:** unduh arsip (request malam ini), ingest, filter, grid, kalender mentah per sensor. Konteks iklim mulai diunduh paralel (CDS antre).
2. **Jam 8–20:** L0 + koreksi Terra-only + L1 + conformal + validasi blok; anomali vs baseline.
3. **Jam 20–32:** frontend kalender + peta + CSV + banner QA.
4. **Jam 32–40:** LLM parse + brief + verifier + eval set (fallback dulu, LLM belakangan).
5. **Jam 40–48:** slide validasi (tabel coverage, plot sebelum/sesudah harmonisasi di 2012 dan 2020), video cadangan, README.

Pesan inti ke juri: *"Kami tidak menyembunyikan pergantian sensor. Kami memodelkannya, mengukur ketidakpastiannya, dan menandainya. AI kami hanya bicara dengan angka yang sudah diverifikasi."*

---

## Daftar sumber utama

- Field et al. 2016, PNAS: https://pmc.ncbi.nlm.nih.gov/articles/PMC4995960 ; ringkasan NASA: https://www.nasa.gov/centers-and-facilities/goddard/severe-2015-indonesian-fire-season-linked-to-el-ni%c3%b1o-drought/
- Spessa et al. 2015, NHESS: https://nhess.copernicus.org/articles/15/429/2015/
- Shawki et al. 2017, GRL: https://repository.library.noaa.gov/view/noaa/28437
- Nikonovas et al. 2022, ProbFire, NHESS: https://nhess.copernicus.org/articles/22/303/2022/
- Mezbahuddin et al. 2023, Sci. Rep.: https://pmc.ncbi.nlm.nih.gov/articles/PMC9837124/
- Sofiev & Kouznetsov 2026, GMD: https://gmd.copernicus.org/articles/19/10123/2026/
- Schroeder et al. 2014, RSE: https://earthdata.nasa.gov/s3fs-public/imported/Schroeder_et_al_2014b_RSE.pdf
- Sofan et al. 2020, IJDE: https://doaj.org/article/8b86910fa5de45e3bd836ec8b331e073
- Boschetti et al., NASA MODIS/VIIRS harmonization: https://modis.gsfc.nasa.gov/sci_team/meetings/202204/presentations/session1/boschetti.pdf
- Fusi FRP MODIS–VIIRS (Remote Sensing 2026, 18:1650): https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf [UNVERIFIED: isi detail, halaman 403 saat diakses]
- LDOPE orbit drift: https://landweb.modaps.eosdis.nasa.gov/displayissue?id=1254
- CAMS "Drifting away from MODIS": https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- S-NPP berhenti: https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026
- FIRMS API/Download: https://firms.modaps.eosdis.nasa.gov/api/area/ , https://firms.modaps.eosdis.nasa.gov/api/map_key/ , https://firms.modaps.eosdis.nasa.gov/download/
- CEMS GEFF-ERA5: https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1
- SiPPEG panduan: https://sippeg.kemenlh.go.id/apps/Home/download_panduan
- MAPIE time series: https://mapie.readthedocs.io/en/latest/generated/mapie.regression.MapieTimeSeriesRegressor.html
- S-H-ESD: Hochenbaum et al. 2017, https://arxiv.org/abs/1704.07706 [UNVERIFIED: tidak dibuka ulang]
- Prithvi-EO-2.0 BurnScars: https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-300M-BurnScars
- Earth Copilot: https://blogs.microsoft.com/?p=52562133
- Google Earth AI agent: https://research.google/pubs/google-earth-ai-geospatial-reasoning-agent-capabilities-and-a-systematic-evaluation/
- GeoLLM-Engine: https://arxiv.org/abs/2404.15500 ; ThinkGeo: https://arxiv.org/abs/2505.23752
- ESA Φ-lab IC-EO: https://cin.philab.esa.int/databases/projects/ic-eo-interpretable-code-based-assistant-for-earth-observation ; EVE: https://aclanthology.org/2026.acl-industry.72.pdf
- Hallucination numerik: https://arxiv.org/abs/2202.03629 ; https://arxiv.org/abs/2203.05227
- DuckDB H3: https://duckdb.org/community_extensions/extensions/h3
- Space Apps judging (Impact, Creativity, Validity, Relevance, Presentation): https://www.spaceappschallenge.org/resources/judging-awards-guide
