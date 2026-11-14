# 03 · Benchmark Repo Pesaing (Challenge yang Sama, 2026)

> Dianalisis 13 Nov 2026 (sehari sebelum hackathon). **43 repo** diperiksa: 28 dari daftar riset awal dan 15 yang baru ditemukan lewat GitHub search.
> Semua angka adalah **klaim self-reported** dari README atau kode masing-masing repo, belum diverifikasi oleh kita.
> Detail per repo: [_raw/repo-pesaing-batch1.md](_raw/repo-pesaing-batch1.md) dan [_raw/repo-pesaing-batch2.md](_raw/repo-pesaing-batch2.md).

## 1. Gambaran besar

- **Challenge ini sudah sangat ramai.** Puluhan tim (dominan Bangladesh dan India, lalu Malaysia, Vietnam, Filipina, Mesir, Ukraina) sudah membangun aplikasi lengkap **sebelum** hackathon dimulai.
- **Pipeline dasar sudah jadi komoditas.** Grid bersama, rasio VIIRS/MODIS dari periode overlap, heatmap tahun × bulan, anomali vs median, CSV, AOI, peta. Fitur-fitur ini tidak lagi membedakan.
- **Dua pesaing sudah masuk wilayah kita (Borneo/gambut)**: EG FireTrack dan Fire Harmony, keduanya terindikasi dari Malaysia. Celah "tidak ada yang fokus Indonesia" **sudah tidak sepenuhnya kosong**, tetapi keduanya dibingkai dari sisi Malaysia (penerima asap, Bomba).
- **Tidak ditemukan entri Space Apps dari tim Indonesia** untuk challenge ini.
- **Risiko pre-build sangat umum.** Sebagian besar repo kuat punya kode, data olahan, bahkan video dan deck sebelum 14 November, padahal beberapa repo sendiri menulis bahwa aturan melarang membangun sebelum event. Ini bisa menjadi faktor diskualifikasi bagi mereka. Bagi kita: **bangun hanya selama 14-15 November, dan biarkan riwayat commit membuktikannya.**

## 2. Peta pesaing per tier

### Tier S: pesaing berbahaya (sains kuat dan/atau wilayah kita)

| Repo | Tim / asal | Inti ide | Metode harmonisasi | Validasi | Kenapa berbahaya | Kelemahan |
|---|---|---|---|---|---|---|
| **Warren-530/fire-harmony** | Kopi and Cosmos (indikasi Malaysia) | Rekor kebakaran global konsisten, ML per sel + driver iklim + haze SE Asia | VIIRS diskalakan ke NOAA-20; bulan MODIS diprediksi **LightGBM per hexagon H3 L5 × bulan** (fitur land cover, **PEATMAP**, populasi, biome); rentang 90% | Seam test 2002 & 2012 vs Fire_cci, placebo seam, **Pettitt & PELT change-point**, outlook Brier skill | Sains terdalam + gambut + Sumatra/Borneo | 640 juta baris, ~60 GB; sulit dijelaskan dalam 30 detik; sudut pandang Malaysia sebagai penerima asap |
| **EdisonShiny/eg-firetrack** | EG Solution 2.0 (indikasi Malaysia) | Harmonisasi hotspot Borneo → rekomendasi operasional pemadaman | Grid 1 km; match ±1 km/±1 jam; **k per provinsi dan musim** | LOYO (angka tidak dipublikasikan) | Wilayah kita: **kedalaman gambut**, aturan respons ke **BPBD, Manggala Agni, BNPB** | Histori hanya 2017-2026 (bukan 2000); live site masih placeholder; banyak sample data |
| **Aalvee-Aarham/kiln-watch** | Off The Binary, Bangladesh | Satu rekor skala Aqua MODIS tanpa lompatan, dengan interval 95% | Rasio per bulan kalender, **siang/malam terpisah, empirical Bayes shrinkage**; rantai Terra→Aqua←S-NPP←NOAA-20←NOAA-21; normalisasi *observing opportunity* per satelit | **MODIS-denial test** (kalibrasi 2012-16, rekonstruksi 2017-20 dari VIIRS saja), placebo, S-NPP withholding, Sen slope | Validasi paling meyakinkan; sudah menangani akhir S-NPP; MCP server 31 tools | Tanpa koreksi awan; tidak distratifikasi tutupan lahan; gagal di Paraná (+27%); scope sangat luas |
| **the-aris-club/flare-chronos** | Indikasi Vietnam (Mekong) | Harmonisasi berbasis fisika footprint | **Rekonstruksi footprint elips dari scan angle**, alokasi fraksional ke H3, quantile mapping FRP 2 tahap, normalisasi upaya observasi Ω | KS distance −69,4%, R² log-FRP 0,78→0,80 | Paling "physics-heavy" | Hanya 2 AOI; sangat kompleks; ada klon (GeoHarmonix) |

### Tier A: kuat secara metode atau validasi

| Repo | Asal | Inti | Angka kunci (self-reported) |
|---|---|---|---|
| mdhabibullah…/Icarus | Bangladesh | Pipeline offline reproducible, 9 eksperimen pra-registrasi | LOYO, MCD64A1 r² 0,34 (sel) / 0,87 (regional); **step sisa ~2,1×** masih ada |
| squadronzero/project-shift | — | Rekor global tahan hilangnya S-NPP, disiplin pra-registrasi aturan | Faktor per tile 10°/2,5° + bootstrap; NOAA-20 diikat ke S-NPP (0,97-1,07) |
| tttamannaanand/burn-calendar | — | Kalender mingguan, **quantile mapping** | Holdout 2019-24: 0,88-1,01× |
| Kolok2008/zakarpattia-orbit | Ukraina | Kalender lokal + verifikasi drone | LOYO MAPE tahunan **9,8% vs 73,8%** tanpa harmonisasi |
| ImtiazIftii/NPC_SpaceApps | — | API kalender per negara | k ≈ 0,41-0,49; r > 0,97 |
| snslighting/ember-atlas | — | Atlas + replay GIBS global | k per AOI, holdout RMSE; histori hanya 3-4 area |
| Shahriar290900 (Parallax Fire) | Dhaka | Live Earth 3D dengan posisi satelit nyata | Holdout miss/bulan Bangladesh 98 vs raw 627 |
| shahmirkhan106/firelens | — | H3 + OLS per wilayah, UX penjelas | R² 0,586-0,952 (in-sample); VIIRS hanya mengisi ≤0,9% sel |

### Tier B: banyak fitur, harmonisasi sederhana

| Repo | Catatan |
|---|---|
| Hisernberg/ignis (Bangladesh) | 11 tab (kalender, Mann-Kendall, Gumbel EVT, Moran's I, LLM SITREP), tetapi harmonisasinya hanya median rasio bulanan. Contoh "feature soup" |
| imTariful/FireSync (BOT Battalion) | Arsip ~392 juta deteksi, Random Forest; dua jalur data tidak tersambung, status validasi sendiri "INSUFFICIENT" |
| Mosharrof8097/EmberSync | Genetic algorithm per biome + quantile mapping FRP; kalender multi-tahun berupa proyeksi model |
| Team SkyBound (Asia Selatan) | Grid 5,5 km; r 0,824→0,850 (perbaikan kecil) |
| jpwxts/VELA (Filipina) | UX "Check my land" untuk pemilik lahan, FWI ASMC; harmonisasi belum selesai |
| zzaemm/ember (India) | Mask sumber statis + cerita berita per event |

### Tier C: lemah, sintetis, atau beda arah

- **Data sintetis:** AIEKYA-APEX, usman2ki (statistik rapi tapi dunia sintetis), Vtheonly (LightGBM + PatchTST di fixture sintetis), Pyro-Harmony (arsip historis dibuat sendiri).
- **Real-time dedup tanpa kalender:** FireHarmonize, sparkgrid (Kairo), FIRE FUSION, parthwandre45/FireSync.
- **Belum ada isi:** Still-Low-Priority, FireAtlas, Chronofire, salmahmed6, Atmolar, Hemolar, modispractice, hotsync-practice, project-stardust.
- **Challenge lain tapi relevan:** tommyquak/SpaceApps (**PeatGuard**, challenge "Dancing with the SARs", tim Singapura-Indonesia, gambut Kalimantan Tengah).

## 3. Katalog metode harmonisasi yang sudah dipakai pesaing

| # | Metode | Dipakai oleh | Status |
|---|---|---|---|
| 1 | Grid bersama + hitung sel berapi per hari (*presence cell-day*) untuk meredam inflasi piksel kecil | Hampir semua (H3 ~0,7 km², 1 km, 0,05°, 0,1°, 0,5°) | **Komoditas** |
| 2 | Satu rasio k = ΣVIIRS/ΣMODIS (atau median rasio) dari overlap | ember-atlas, NPC, IGNIS, hotsync | **Komoditas** |
| 3 | k per bulan / per wilayah / per musim | zakarpattia, EG FireTrack, project-shift, Kiln Watch | Umum |
| 4 | Regresi linear OLS per wilayah | FireLens, S.H.I.F.T | Umum |
| 5 | Shrinkage/empirical Bayes ke rasio pooled | Kiln Watch, Icarus (κ=50) | Jarang, kuat |
| 6 | Siang/malam dipisah | Kiln Watch | Jarang |
| 7 | Quantile mapping (count atau FRP) | burn-calendar, flare-chronos, EmberSync, Cauchy's Comet | Makin umum |
| 8 | Point-to-point matching (1-3 km, 30-180 menit) + DBSCAN | FireHarmonize, FIRE FUSION, FireChronicle, sparkgrid | Umum, **tapi** match rate rendah karena orbit Aqua bergeser 2-3 jam dari VIIRS |
| 9 | ML per sel (LightGBM, Random Forest) | Fire Harmony, BOT Battalion, Pyro-Harmony | Jarang, berat |
| 10 | Rekonstruksi footprint dari scan angle | flare-chronos, Pyro-Harmony (sintetis) | Jarang |
| 11 | Normalisasi *observing opportunity* | Kiln Watch (per satelit), flare-chronos (Ω per tahun-lintang) | Jarang, **belum ada yang per piksel/awan** |
| 12 | Rantai kalibrasi NOAA-20/21 untuk melewati akhir S-NPP (2 Nov 2026) | Kiln Watch, project-shift, Fire Harmony | Makin umum |
| 13 | Mask sumber statis (type 1-3, kiln, flare) | Kiln Watch, Fire Harmony (GIHS), zzaemm/ember | Umum |

## 4. Fitur yang sudah komoditas (jangan dijadikan USP)

- Heatmap tahun × bulan (atau × minggu, × pentad), warna aman buta warna.
- Anomali vs median historis, z-score, label Normal/Elevated/Critical.
- AOI bbox atau gambar sendiri, unduh CSV.
- Peta NRT, globe 3D.
- Toggle raw vs harmonized dengan narasi "step 2012".
- LOYO / holdout tahun.
- Analis LLM / chatbot, alert email/Telegram/n8n.
- Forecast LightGBM jangka pendek.

## 5. Yang **belum** dilakukan siapa pun (dari 43 repo)

| # | Celah | Bukti |
|---|---|---|
| 1 | Kalibrasi **distratifikasi gambut vs mineral** (dan siang/malam untuk gambut membara) | Fire Harmony memakai PEATMAP hanya sebagai fitur ML global; EG FireTrack memakai gambut hanya untuk skor risiko |
| 2 | Koreksi **tutupan awan/asap per piksel** (observing opportunity dari MOD14A1/VNP14A1 fire mask) | Semua mengakui sebagai gap; Kiln Watch hanya per satelit |
| 3 | **Ambang FRP fisik bersama** (hanya hitung deteksi VIIRS yang cukup kuat untuk terlihat MODIS) | Tidak ditemukan |
| 4 | Validasi silang dengan **Himawari-8/9 AHI** (geostasioner, setiap 10 menit, meliputi Indonesia) | Tidak ada repo menyebut Himawari |
| 5 | Validasi terhadap **statistik resmi nasional** (SiPongi/KLHK luas terbakar) | Hanya MCD64A1, Fire_cci, GFED |
| 6 | Rekonsiliasi **dua angka resmi Indonesia**: SiPongi (MODIS+VIIRS) vs BRIN (VIIRS saja) | Tidak disentuh siapa pun |
| 7 | Kalender per **kabupaten / KHG / konsesi**, berbahasa Indonesia | EG FireTrack hanya per provinsi Borneo |
| 8 | Baseline yang **dikondisikan ENSO/IOD** ("normal untuk tahun El Niño") | Fire Harmony punya ONI/DMI sebagai driver, bukan baseline kondisional |
| 9 | **Backtest early-warning** (apakah aturan bisa menandai musim abnormal sebelum puncak) | Kiln Watch mengakui belum |
| 10 | Uji kuantitatif **perubahan koleksi MODIS** dan **bias NRT vs standard** | Tidak ditemukan |
| 11 | Kalibrasi distratifikasi per **tutupan lahan/rezim api** yang diuji | FireLens & Kiln Watch gagal di pembakaran tanaman dan menyebutnya next step |

Analisis lengkap celah dan USP yang bisa dibangun ada di [07-gap-analysis-dan-usp.md](07-gap-analysis-dan-usp.md).

## 6. Pelajaran dari pesaing untuk kita

1. **Uji yang mudah dipahami juri lebih kuat dari metrik abstrak.** "Matikan MODIS lalu lihat apakah VIIRS bisa merekonstruksi yang dilihat Aqua" (Kiln Watch) dan seam/placebo test (Fire Harmony) adalah standar baru. Kita butuh minimal setara, idealnya dengan kasus Indonesia (mis. 2015 dan 2019).
2. **Kejujuran tentang kegagalan sudah dilakukan pesaing terkuat.** Kiln Watch melaporkan Paraná +27%, burn-calendar melaporkan California −12%. Ini menjadi ekspektasi dasar.
3. **Kompleksitas berlebihan adalah kelemahan, bukan kekuatan.** Fire Harmony (60 GB) dan IGNIS (11 tab) sulit diringkas dalam video 30 detik. Ruang untuk tim yang **setara secara sains tetapi jauh lebih fokus** masih terbuka.
4. **Akhir S-NPP (2 Nov 2026) sudah menjadi pengetahuan umum** di kalangan pesaing. Wajib ditangani, tetapi bukan pembeda.
5. **Wilayah Borneo sudah diambil dari sisi Malaysia.** Pembeda kita harus dari sisi Indonesia: pengguna resmi Indonesia, data resmi Indonesia (SiPongi/BRIN), unit pengelolaan Indonesia (KHG, kabupaten), bahasa Indonesia, dan Sumatra (Riau, Jambi, Sumsel) yang belum disentuh siapa pun sebagai fokus utama.
6. **Point matching jangan dijadikan inti.** Orbit Aqua yang bergeser membuat match rate rendah, dan beberapa tim mengakuinya.
