# Analisis Repo Pesaing — Batch 1 (14 repo)

Challenge: *Harmonization of MODIS and VIIRS Hot Spots* — NASA Space Apps Challenge 2026
Tanggal analisis: 13 Nov 2026. Sumber: README + dokumen di repo (raw.githubusercontent.com), metadata GitHub REST API (created_at / pushed_at / language / size), dan tree file. Semua angka di bawah adalah **klaim self-reported** dari repo masing-masing, belum diverifikasi oleh kita. Jika suatu hal tidak terlihat di repo, ditulis "not found".

Catatan konteks pre-build: hackathon lokal 14–15 Nov 2026 (beberapa event Bangladesh menyebut 13–14 Nov). Challenge statement lengkap dirilis 28 Okt 2026 (menurut dokumen FireChronicle & Kiln Watch). Dua repo (Kiln Watch, FireChronicle) secara eksplisit menulis bahwa aturan Space Apps melarang membangun kode sebelum event, tetapi keduanya justru punya kode yang substansial sebelum 14 Nov.

---

## 1. Kiln Watch — `Aalvee-Aarham/kiln-watch-2026` (+ repo demo `Aalvee-Aarham/kiln-watch`)

- **Tim/lokasi:** Team "Off The Binary", Bangladesh; event lokal Mymensingh. 6 anggota (Aalvee Aarham, Israt Jahan Arna, Sajid Alam Chowdhury Omee, Nazifa Jahan, Maruf Hasan Tawhid, Muhammad Ahnaf Sarker).
- **Waktu:** repo konsep `kiln-watch-2026` dibuat 2026-10-07, push terakhir 2026-10-07 (hanya docs, ~27 KB). **Repo demo terpisah `kiln-watch`** dibuat 2026-10-05, push terakhir **2026-11-13** (size ~39 MB, bahasa HTML, live demo `kiln-watch-seven.vercel.app` dan GitHub Pages). **RISIKO PRE-BUILD SANGAT TINGGI**: README konsep menulis "Space Apps rules don't allow building before the event", tetapi repo demo sudah berisi aplikasi penuh (FastAPI + React/MapLibre globe + MCP server 31 tools + hasil validasi 9 wilayah, data hingga 2026-11-10).
- **Stack:** Backend Python 3.11 FastAPI + DuckDB membaca GeoParquet remote; frontend React + MapLibre GL (globe 3D), three.js, GSAP, Vite; MCP Python SDK (31 tools, 4 "characters", 5 resources); Gemini sebagai AI analyst; alert via email (smtplib) dan n8n. Biaya $0.
- **Data & produk:** FIRMS MODIS C6.1 + VIIRS 375 m C2 (standard + NRT), dibaca dari **Portolan GeoParquet mirror** (source.coop, CC0, tanpa key). Satelit: Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21. Tambahan: NASA GIBS, Black Marble (VNP46), Blue Marble, NASA EONET, GDACS, GDELT, Google News RSS. Rencana di repo konsep: MOD14A1/MYD14A1/VNP14A1/VJ114A1 (cloud-free area), ECOSTRESS, Landsat LST, Sentinel-1/5P, ESA WorldCover, peta kiln APAD.
- **Metode harmonisasi (konkret):**
  - Unit utama: "hotspots on the Aqua MODIS scale" (Aqua sebagai referensi karena satu-satunya orbit kontinu 2002 → era VIIRS). Terra hanya untuk Nov 2000–Jun 2002.
  - Filter: buang VIIRS `low` dan MODIS confidence < 30; static source (kiln/flare/industri) = sel 0.01° di mana mayoritas `type` 1–3, diterapkan juga ke NRT.
  - "Observing opportunity": proporsi hari tiap satelit mengirim data (dideteksi dari data, termasuk akhir S-NPP 2026-11-02); count dibagi nilai ini.
  - Kalibrasi: **rasio total per bulan kalender, day/night terpisah, di-shrink ke rasio pooled via empirical Bayes**. Rantai: Terra→Aqua (2002–2020), S-NPP→Aqua (2012–2020, sebelum Aqua drift), NOAA-20→S-NPP, NOAA-21→NOAA-20; mismatch chain-closure ditambahkan ke error.
  - Stitching: rata-rata inverse-variance antar satelit; interval 95% dilebarkan ke coverage terukur.
  - Grid: 0.01° untuk mask, 0.1° untuk peta, 0.5° untuk outlook global.
- **Angka yang dilaporkan (self-reported):** raw step 3.5–10.6× vs Aqua; harmonized step 0.93–1.19×; 7.3 juta deteksi diproses; error tanpa kalibrasi +469.7% s.d. +1864.3% vs Kiln Watch −9.7% s.d. +27.5%; coverage interval 96% (diakui "by construction"); Punjab MAE 146 vs 271; Dhaka raw step 10.58.
- **Calendar/visualisasi:** kalender bulan × tahun dengan angka di setiap sel, colour-blind-safe, keyboard navigable, view ISO week, view "vs median", cell inspector (nilai + interval 95%, rank, satelit pemberi data), globe 3D dengan outlook 30 hari untuk setiap sel 0.5°, early-warning page, draw-your-own-area, download CSV/SVG, printable brief, panel berita.
- **Validasi:** **paling kuat di batch ini.** MODIS-denial test (kalibrasi 2012–2016, rebuild 2017–2020 dari VIIRS saja, bandingkan dengan Aqua); placebo test pada tanggal tanpa pergantian satelit; S-NPP-withholding test 2024–Okt 2026; Sen slope trend 2003–2020 vs Aqua-only; pre-registered test plan (Chow test, LOSO coverage 0.90–0.97, M0 rasio vs M1 Poisson regression).
- **Kejujuran limitasi:** sangat tinggi — menyebut Punjab under-correct ~7%, Paraná +27% gagal, belum ada cloud-cover denominator, early-warning belum di-backtest, kiln belum divalidasi ke inventori (label "likely kilns"), MODIS collection 6.03→61.03 belum di-step-test.
- **Fokus wilayah/target user:** global (9 wilayah preset: Dhaka kiln belt, Punjab–Haryana, La Rioja, Rondônia, Fort McMurray, SE Australia, N. California, Paraná Delta, Niger Delta) + "any place on Earth"; lokal Bangladesh (kiln). User: fire manager, ilmuwan, petugas lingkungan, publik Bangladesh (rencana Bangla + "Agun Ponjika" kalender cetak per upazila).
- **Wow feature:** MODIS-denial test + MCP server 31 tools + globe outlook 30 hari + pemisahan brick kiln dari kebakaran vegetasi.
- **Inti ide (1 kalimat):** Satu record kebakaran 2000–sekarang dalam skala Aqua MODIS yang tidak "melompat" saat satelit berganti, dengan interval 95% dan bukti lewat uji "matikan MODIS".
- **USP:** Validasi "masa depan tanpa MODIS" (denial test) + rantai kalibrasi S-NPP→NOAA-20→NOAA-21 yang menangani akhir S-NPP + deteksi kiln/static source.
- **Kelemahan / yang hilang:** tidak ada koreksi tutupan awan; kalibrasi tidak distratifikasi land cover/scan angle/ukuran fire; Terra→Aqua link lemah; NRT tidak dikoreksi (hanya dilabel provisional); scope fitur sangat luas (risiko demo rapuh); pre-build sangat mencolok dan bertentangan dengan pernyataan mereka sendiri.

---

## 2. `Still-Low-Priority/modis-viirs-harmonized`

- **Tim/lokasi:** not found (org "Still-Low-Priority").
- **Waktu:** dibuat 2026-11-05, push 2026-11-05. Isi hanya `.gitignore` (size 2 KB). **Tidak ada risiko pre-build** (repo kosong).
- **Stack / data / metode / kalender / validasi / wilayah / wow:** not found.
- **Inti ide:** dari deskripsi: "Harmonized MODIS + VIIRS active fire hotspots into a single burning activity calendar."
- **USP:** not found.
- **Kelemahan:** repo kosong; belum bisa dinilai. Perlu dipantau ulang setelah event.

---

## 3. FireHarmonize — `harishk2086/FireHarmonize`

- **Tim/lokasi:** Harish K (B.E. Electronics and Communication Engineering), tampak solo. Lokasi tidak disebut; fokus India.
- **Waktu:** dibuat 2026-10-30, push terakhir 2026-11-05. Kode lengkap (backend + frontend + tests + deploy Vercel/Render) → **risiko pre-build tinggi**.
- **Stack:** React + TypeScript + Vite + Tailwind, Leaflet/React-Leaflet, Recharts; backend Python FastAPI, pandas/NumPy in-memory (tanpa DB), scikit-learn BallTree (haversine). Hosting Vercel + Render, basemap Esri.
- **Data & produk:** FIRMS Area API NRT: `MODIS_NRT` + `VIIRS_NOAA21_NRT`, 3 hari terakhir (fallback 10 hari). Tidak ada arsip historis (SP). Demo mode: data sintetis 186 observasi (South India).
- **Metode harmonisasi:** **event matching titik-ke-titik**, bukan time-series harmonization. Normalisasi UTC; mapping confidence VIIRS L/N/H → 25/60/90; duplikat same-sensor ≤0.2 km & 60 detik; kandidat pasangan MODIS–VIIRS via BallTree; skor = 0.5×spatial + 0.3×temporal + 0.2×confidence; greedy one-to-one; klasifikasi MATCHED_EVENT / MODIS_ONLY / VIIRS_ONLY / POSSIBLE_DUPLICATE / LOW_CONFIDENCE. Default live: radius 2 km, jendela 180 menit (demo: 1 km, 30 menit).
- **Angka (self-reported):** Punjab & Haryana 1–3 Nov 2026: 989 MODIS, 1,264 VIIRS, 69 matched pairs (~2% match rate); Aqua lewat ~10:36 UTC vs VIIRS ~08:34 UTC (Aqua ~2 j 38 m setelah NOAA-21 karena orbit drift).
- **Calendar/visualisasi:** peta fire, observation inspector, daily trend MODIS/VIIRS/harmonized, data explorer, data quality. **Tidak ada burning calendar multi-tahun, tidak ada anomali vs median historis.**
- **Validasi:** hanya unit test; tidak ada validasi ilmiah.
- **Kejujuran limitasi:** baik (greedy matching, mapping confidence asumsi, tanpa rekonsiliasi FRP, bukan metodologi NASA, demo sintetis).
- **Fokus/user:** Punjab & Haryana, South India; monitoring wildfire umum.
- **Wow feature:** analisis drift orbit Aqua yang menjelaskan match rate rendah; deploy live.
- **Inti ide:** Dashboard pencocokan deteksi MODIS–VIIRS real-time dengan skor kecocokan yang bisa diatur.
- **USP:** Live deploy + transparansi drift overpass.
- **Kelemahan:** tidak menjawab inti challenge (kalender 2000–sekarang, anomali, AOI bebas); hanya 3–10 hari data NRT; tidak ada koreksi count/ratio.

---

## 4. FireSync (BOT Battalion) — `imTariful/FireSync-A-Harmonized-Burning-Activity-Calendar`

- **Tim/lokasi:** Team "BOT Battalion". Lokasi tidak eksplisit di README; dokumen menyebut audit "live-bangladesh" dan "not a fitted Bangladesh coefficient" → kemungkinan Bangladesh (inferensi, belum pasti).
- **Waktu:** dibuat 2026-10-10, push terakhir **2026-11-13**. Kode sangat besar (Express + Vite TS, pipeline Python, CI, Docker, puluhan laporan audit, raw data commit 2026-11-09). **Risiko pre-build sangat tinggi.**
- **Stack:** Node/Express + Vite + React TypeScript (satu server), MapLibre GL, Tailwind, Lucide; DuckDB/Parquet untuk arsip; pipeline Python (stdlib + duckdb); opsional Groq AI ("AI Investigator"); PostGIS/Redis opsional di docker-compose.
- **Data & produk:** Live `MODIS_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`. Arsip historis lokal (gitignored): MODIS 2000-11→2025 (111,424,405 obs), VIIRS S-NPP 2012-01→2025 (281,144,026 obs). Produk "AgniCalendar" global cell-month 2002-07→2025-12 (30,361,118 baris). Menyebut MODIS C6.1 (MOD14/MYD14), VNP14IMGTDL_NRT, VJ114IMGTDL_NRT. NASA GIBS imagery.
- **Metode harmonisasi (dua jalur, sengaja tidak digabung):**
  1. **BAU (Burning Activity Units)** live: grid equal-area 1 km (cylindrical equal-area, φ0=23.5°), per sel-hari: `BAU = 0.5·N_MODIS + 0.5·(β·N_VIIRS) + γ·ln(1+FRP)` untuk sel concurrent; β = 0.294 (= 1/3.4, **asumsi literatur, tidak di-fit**), γ = 0.005. Dilabel EXPLORATORY.
  2. **AgniCalendar RF-B**: grid EPSG:8857 Equal Earth 10 km, bulanan; **Random Forest** (DAY/NIGHT terpisah) memprediksi count Aqua dari fitur VIIRS S-NPP (count, FRP sum/mean/max, count confidence l/n/h, sin/cos bulan); training tahun 2013/2019; hanya pada populasi "joint-positive" (keduanya mendeteksi), fire type 0.
- **Angka (self-reported):** VIIRS ~3.4× lebih banyak deteksi dari MODIS (dari literatur Schroeder 2014/Giglio 2016); diagnostic fixture: MAE 0.3947, RMSE 0.4502, status INSUFFICIENT; live 2026-11-09: 1,423 training / 611 validation cells dari satu hari (temporal separation gagal).
- **Calendar/visualisasi:** Hotspot Explorer (MODIS crimson / VIIRS kuning, ukuran titik = footprint), daily calendar, Monthly AgniCalendar heatmap bulan×tahun, sensor comparison + diagram footprint, early monitoring (threshold per sensor, alert in-app), export CSV, methodology, AI Investigator.
- **Anomali:** median historis bulan yang sama (eksklusi tahun target, minimal 5 tahun), persentil empiris; ≥95 = unusually high, ≤5 = unusually low.
- **Validasi:** temporal holdout diagnostic dengan kriteria formal (≥30 training, ≥10 validasi, separasi temporal) — **belum lulus**; mereka sendiri menyatakan "not VALIDATED".
- **Kejujuran limitasi:** ekstrem tinggi (hampir berlebihan; banyak disclaimer).
- **Fokus/user:** global, preset regional; demo California/US West.
- **Wow feature:** arsip global 392 juta deteksi + RF per day/night; AI investigator.
- **Inti ide:** Platform monitoring + kalender bulanan global dengan estimasi Aqua-equivalent berbasis Random Forest, dipisahkan tegas dari indeks BAU live.
- **USP:** Skala data (arsip global 2000–2025) + provenance/audit trail yang sangat detail.
- **Kelemahan:** harmonisasi terfragmentasi (BAU live vs RF-B bulanan tidak boleh digabung → tidak ada satu seri kontinu); koefisien 0.294 tidak di-fit; validasi gagal/insufficient; RF tidak memodelkan sel di mana hanya satu sensor mendeteksi (bias); UX kompleks; terlalu banyak disclaimer bisa membingungkan juri.

---

## 5. FireSync (Unified Satellite Fire Intelligence) — `parthwandre45/FireSync`

- **Tim/lokasi:** not found (fokus data India: Punjab, Haryana).
- **Waktu:** dibuat 2026-11-03, push terakhir 2026-11-11. Kode lengkap 3-tier + DB (size ~95 MB). **Risiko pre-build tinggi.**
- **Stack:** React 19 + Vite + Tailwind, React-Leaflet (OSM), Plotly.js; gateway Express.js; Python 3.11 FastAPI "scientific service" (GeoPandas, Shapely, SciPy, DBSCAN); PostgreSQL 16 + PostGIS. Docker.
- **Data & produk:** FIRMS LANCE NRT; 24,395 deteksi (3,381 MODIS Terra/Aqua; 21,014 VIIRS S-NPP/NOAA-20), hanya 26 Okt–3 Nov 2026. Tahun 2020–2025 ditandai `NO_INGESTED_DATA`.
- **Metode harmonisasi:** de-duplikasi spatio-temporal (DBSCAN + bipartite temporal matching, Δt 30/60/90/120 menit, R 1.0/1.5/2.0 km). `N_eff = N_MODIS + N_VIIRS − N_matched`. FRP harmonized: untuk pasangan, simpan FRP VIIRS, buang FRP MODIS. Estimasi burned area via Wooster FRE (0.368 kg/MJ, β_fuel 0.70 kg/m², "1 MW ≈ 0.3179 Ha", ±35%). **Tidak ada kalibrasi rasio/regresi count antar sensor.**
- **Angka (self-reported):** rasio area footprint ~7.14×; 26 Okt 2026: N_MODIS 452, N_VIIRS 2,664, matched 2 → N_eff 3,114; 29 Okt: 0 matched pairs (separasi minimum 113.0 menit); Z-score baseline μ=15,881.83 MW, σ=3,881.48 MW dari N=9 hari; day/night 83.5%/16.5%; Punjab vs Haryana 5,407 vs 1,855 deteksi (2.56× density).
- **Calendar/visualisasi:** heatmap kalender bulanan 7 kolom dengan 5 tier intensitas; toggle metrik (Harmonized FRP, burned area Wooster, N_eff); daily inspector; time series dual-axis; perbandingan regional antar-state India; CSV export RFC 4180.
- **Validasi:** hanya tes software (36 asersi, 46 pytest). Tidak ada validasi ilmiah.
- **Kejujuran limitasi:** cukup baik (baseline N=9, non-fabrication, burned area proxy).
- **Fokus/user:** India (Punjab/Haryana crop residue); incident commander, peneliti, policy planner.
- **Wow feature:** analisis orbital mekanik "kenapa 0 matched pair" + burned-area estimate via FRE.
- **Inti ide:** Menggabungkan deteksi MODIS/VIIRS harian tanpa double-count, plus konversi FRP ke perkiraan burned area.
- **USP:** Metrik burned area (Wooster FRE) dan arsitektur microservice.
- **Kelemahan:** hanya 9 hari data → tidak ada kalender multi-dekade maupun anomali historis sungguhan; menjawab "dedup" bukan "konsistensi lintas era"; Z-score dengan N=9; arsitektur berat untuk nilai ilmiah kecil.

---

## 6. Pyro-Harmony — `itssouradip34/NASA-MODIS-VIIRS-Hotspots-Harmonization`

- **Tim/lokasi:** not found.
- **Waktu:** dibuat 2026-09-28, push terakhir **2026-09-28** — kode lengkap (FastAPI, RF model, tests, poster PDF) sudah ada **sebulan sebelum challenge statement dirilis (28 Okt)**. **Risiko pre-build sangat tinggi.** Repo juga memuat PDF paper pihak ketiga (MODIS_2019.pdf, VIIRS_2017.pdf, dll.).
- **Stack:** Python FastAPI, scikit-learn RandomForest, pandas/NumPy, joblib; frontend statis HTML/JS + Leaflet + Chart.js + Canvas.
- **Data & produk:** FIRMS NRT 24 jam/7 hari (Terra/Aqua MODIS, S-NPP/NOAA-20 VIIRS). **Arsip historis 2002–2024 dibangkitkan secara sintetis** (`historical_archives.py` = "Historical Fire Archives Generator") untuk 5 wilayah preset.
- **Metode harmonisasi:** (1) koreksi footprint view-zenith-angle (VZA) MODIS; (2) clustering DBSCAN spatio-temporal (eps 1.5 km, 1 jam; "STARFM-inspired"); (3) Random Forest atau kalibrasi analitis → `frp_harmonized` dan ESFP (Equivalent Standard Fire Pixels; MODIS 1/√(VZA expansion), VIIRS di-clip 0.15–1.0), faktor biome (mis. agriculture 0.75); (4) HFII = frp_harmonized × esfp. Rujukan ke Gao 2006 (STARFM), Weng 2017, Cheng 2020, dsb.
- **Angka (self-reported):** lonjakan semu +350% s.d. +450% saat VIIRS masuk; "+385% artificial step change"; threshold MODIS ≈7–10 MW vs VIIRS ≈0.5–1 MW.
- **Calendar/visualisasi:** heatmap canvas 23 tahun × 365 hari (DOY × tahun), envelope klimatologi P10/P50/P90/P95, diagnostic "Sensor Transition Illusion", peta Leaflet, briefing generator untuk incident commander (export Markdown).
- **Validasi:** klaim 10-fold CV di `train.py`; tidak ada validasi terhadap data riil (arsip sintetis).
- **Kejujuran limitasi:** rendah — tidak jelas menyebut bahwa data historis sintetis di README.
- **Fokus/user:** global (California, Amazon, SE Australia, Punjab, Mediterranean); incident commander.
- **Wow feature:** "Sensor Transition Illusion" diagnostic + incident briefing generator.
- **Inti ide:** Indeks intensitas kebakaran harmonis (HFII) berbasis RF + koreksi geometri scan, ditampilkan sebagai kalender DOY × tahun.
- **USP:** koreksi VZA/bow-tie per piksel dan stratifikasi biome (di atas kertas).
- **Kelemahan:** data historis sintetis → klaim harmonisasi tidak terbukti; model RF tidak jelas target "ground truth"-nya; overclaim; pre-build sebelum statement keluar.

---

## 7. Project Icarus — `mdhabibullahmahmudncs13/Icarus-Harmonization-of-MODIS-and-VIIRS-Hot-Spots`

- **Tim/lokasi:** nama tim tidak disebut; default pilot region "approximately Bangladesh and nearby areas" → kemungkinan tim Bangladesh (inferensi).
- **Waktu:** dibuat 2026-10-04, commit pertama 2026-10-04, push terakhir **2026-11-13**. Kode sangat lengkap (pipeline, API, web React+Three.js, 20+ test file, golden tests, CI, laporan validasi E1–E9 dari 1,484,296 baris real 2003–2026). **Risiko pre-build sangat tinggi.** Repo juga memuat folder `.agents/skills` (AI agent skills).
- **Stack:** Python 3.11+, FastAPI/Uvicorn, DuckDB + Parquet/PyArrow, Pydantic + JSON Schema contract; React 18 + TypeScript + Vite, D3, Three.js; Vitest + Playwright (termasuk tes offline cold-start, no-third-party); offline-capable/PWA.
- **Data & produk:** FIRMS MODIS (Terra/Aqua, SP) dan VIIRS S-NPP SP + NOAA-20 + NOAA-21 (NRT, karena Area API tidak menyediakan SP untuk NOAA-21); MODIS MCD64A1 v061 burned area untuk validasi eksternal.
- **Metode harmonisasi (dari `config/params.yaml` + VALIDATION.md):** filter MODIS confidence ≥ 50 (c_min; E3 memakai default 30 — tidak konsisten), MODIS type 0, VIIRS n/h; grid ~5.5 km (≈0.05°, lebar bujur dikoreksi cos 23.5°); **presence cell-day** (deteksi berulang di satu sel-hari diringkas jadi 1); bin 8 hari (46 bin/tahun); kalibrasi **multiplikatif per tile 1°** dengan shrinkage pseudo-count κ=50, referensi MODIS Terra+Aqua, primer VIIRS S-NPP, minimal 5 tahun overlap, bootstrap B=200; coverage rule cov_min 0.75 dan "zero detections ⇒ stream unavailable"; anomali z-score pada ln(1+1000·D) dengan smoothing sirkular, z ≥ 2 elevated, ≥ 3 extreme; critical period = massa kumulatif 10%–90%. Hash parameter disimpan di setiap artefak.
- **Angka (self-reported):** E1 step observed raw 3.031 → harmonized 2.122 (sintetis 3.15 → 1.158); E2 LOYO median |log offset| raw 1.609 → kalibrasi 0.3867 (target ≤ 0.25 → "partial"); E5 quantile mapping (0.4055) mengalahkan multiplicative (0.5352) dan log-log (0.6279) — diakui in-sample; E7 rasio MODIS:VIIRS 3.083 (S-NPP) → 4.228 (S-NPP+N20+N21), Pearson 0.8325; E8 vs MCD64A1 0.25°: r² 0.3424 per sel (gagal target 0.5), r² 0.8675 regional bulanan; cache 216.3 MiB, API latency 1.243 s.
- **Calendar/visualisasi:** peta, time series, activity calendar, anomali, critical period, provenance, AOI preset/custom, Three.js (detail UI tidak dibaca).
- **Validasi:** **kuat dan pre-registered** (E1–E9): step test, leave-one-year-out, sensitivitas threshold, static mask, perbandingan metode kalibrasi non-linear, resolusi temporal, inklusi satelit, validasi eksternal burned area, performa offline.
- **Kejujuran limitasi:** tinggi — melaporkan verdict "partial", step yang masih tersisa (2.122) tidak "di-tune away".
- **Fokus/user:** Bangladesh & sekitarnya; analis/ilmuwan; offline-first.
- **Wow feature:** laporan validasi E1–E9 yang reproducible + mode offline penuh.
- **Inti ide:** Pipeline deterministik dan reproducible yang menghitung presence cell-day, mengkalibrasi VIIRS ke skala MODIS per tile dengan shrinkage, dan menyajikan klimatologi/anomali/critical period secara offline.
- **USP:** rigor ilmiah + reproducibility (hash parameter, golden tests, kontrak JSON schema) + validasi eksternal MCD64A1.
- **Kelemahan:** harmonisasi masih menyisakan step ~2.1× (belum benar-benar menghapus lompatan); kalibrasi multiplikatif sederhana kalah dari quantile mapping di eksperimen mereka sendiri; tidak ada day/night split; tidak ada koreksi cloud; pre-build masif.

---

## 8. `salmahmed6/Harmonization-of-MODIS-and-VIIRS-Hot-Spots`

- **Tim/lokasi:** not found (studi area Punjab, India).
- **Waktu:** dibuat 2026-10-14, push terakhir 2026-11-02. Isi: satu skrip downloader (`firms_download.py`) + PROJECT_BOARD.md (rencana fase: build 26 Okt–1 Nov, code freeze 10 Nov, MVP 13 Nov). **Risiko pre-build sedang** (rencana jelas membangun sebelum event, tetapi kode di repo publik hanya downloader).
- **Stack:** Python 3.10+, requests. Rencana workstream Backend/Frontend/Data/AI-Anomaly (detail stack not found).
- **Data & produk:** FIRMS Standard Processing: MODIS SP + VIIRS S-NPP SP, 4 jendela 20 Okt–30 Nov 2025 (Punjab).
- **Metode harmonisasi:** not found (skrip eksplisit "does not merge the sensors").
- **Calendar/visualisasi / validasi:** not found (direncanakan map/calendar/comparison/methods).
- **Fokus/user:** Punjab, India — pembakaran residu padi pasca-monsun.
- **Wow feature:** not found.
- **Inti ide:** belum terlihat; hanya akuisisi data Punjab.
- **USP:** not found.
- **Kelemahan:** hanya 1.5 bulan data (2025) → tidak bisa membuat kalender 2000–sekarang; belum ada metode.

---

## 9. Cauchy's Comet — `Naser-Al-Noman/cauchys-comet-burning-activity-calendar`

- **Tim/lokasi:** Team Cauchy's Comet, Bangladesh. Anggota: Naser-Al-Noman, Zaid Rehman, Sadman Zaman Khan, Muhammad Junayed, Md. Meheraj Hossain, Israt Jahan Lamia.
- **Waktu:** dibuat 2026-10-06, push terakhir 2026-10-30. Pipeline Python + tests + web statis + deploy Vercel. **Risiko pre-build tinggi** (meski README menyebut "concept-stage proposal").
- **Stack:** Python (requests, pandas, numpy, pytest); web statis HTML/JS di Vercel.
- **Data & produk:** FIRMS Area API (contoh `VIIRS_SNPP_NRT`, `VIIRS_SNPP_SP`); rencana MCD64A1, NASA POWER, GIBS. Demo fixture sintetis Bangladesh.
- **Metode harmonisasi:** confidence → skala 0–1 (VIIRS l/n/h → 0.3/0.6/0.9); grid 0.05° (~5.5 km); cell-day dihitung max sekali per minggu ISO; **quantile mapping MODIS → VIIRS** pada cell-week yang overlap, opsional split musim Bangladesh (dry/pre-monsoon/monsoon). Catatan: arah kalibrasi MODIS→VIIRS (berlawanan dengan mayoritas yang VIIRS→MODIS).
- **Angka:** tidak ada metrik (eksplisit "reports no performance metrics").
- **Calendar/visualisasi:** baseline week-of-year p10/p50/p90, skor anomali `(value − p50) / (0.5·(p90 − p10))`, ranking critical weeks, tren peak timing; demo web hanya bulan Maret.
- **Validasi:** belum ada (held-out years, MCD64A1 direncanakan).
- **Kejujuran limitasi:** sangat tinggi (tabel status per modul, menyebut calibration leakage, in-sample baseline, missing vs zero).
- **Fokus/user:** Asia Selatan, demo Bangladesh.
- **Wow feature:** provenance JSON (SHA-256 input, git commit) di setiap ekspor.
- **Inti ide:** Kalender mingguan berbasis quantile mapping untuk menjawab "kapan biasanya terbakar, apakah minggu ini tidak biasa, apakah periode kritis bergeser".
- **USP:** pertanyaan "apakah peak timing bergeser" + provenance.
- **Kelemahan:** kalibrasi belum diterapkan di pipeline default; tidak ada validasi; demo hanya Maret; arah MODIS→VIIRS sulit diterapkan ke era pra-2012 secara jujur (harus "mengarang" fire kecil).

---

## 10. FIRE FUSION — `muhtadialammaaz/FIRE-FUSION-NASA-SPACE-APPS-CHALLENGE-`

- **Tim/lokasi:** Global Synthetic Squad (G.S.S.), Bangladesh. 6 anggota (Muhtadi Alam Maaz, Mutasaddik Alam Muaz, Samsul Alam Mahadi, Asif Alvee, Mashrafi Hasan Biplob, Sumjarah Kamel Chowdhury).
- **Waktu:** dibuat 2026-11-07, push terakhir 2026-11-13. Aplikasi React/TS lengkap (tampaknya digenerate via Google AI Studio — repo template AI Studio, folder `public/assets/aistudio`, file `AI_USAGE_AND_DECLARATION.md.txt`), deploy Vercel. **Risiko pre-build tinggi.**
- **Stack:** React + TypeScript + Vite, Bun, `server.ts`, Leaflet; README menyebut Python/FastAPI tetapi tidak terlihat di tree.
- **Data & produk:** NASA FIRMS (MODIS Terra/Aqua, VIIRS S-NPP/NOAA), menyebut MCD14DL. Ada `firmsData.ts` (data statis) dan `firmsLiveApi.ts`.
- **Metode harmonisasi:** **association score** pasangan observasi (0–100) = spatial (0–40, threshold 3.0 km) + temporal (0–30, threshold 90 menit) + quality/confidence (0–20) + FRP ratio (0–10); clustering "ST-DBSCAN-Adaptive". Tidak ada kalibrasi count lintas era.
- **Calendar/visualisasi:** komponen BurningCalendar, InteractiveMap, SatelliteComparison, BeforeAfter, DataValidationDashboard, LiveHUD, EmergencyCoordinationHub, JudgeDemoModal.
- **Validasi:** not found (ada komponen "DataValidationDashboard" tetapi tidak ada hasil).
- **Kejujuran limitasi:** sedang (disclaimer bahwa hardware konseptual; ada komponen ScientificLimitations).
- **Fokus/user:** umum/global; responder dan monitoring hutan.
- **Wow feature:** konsep **ground sensor node** di hutan (suhu, asap, gas) terintegrasi dengan satelit.
- **Inti ide:** Menggabungkan harmonisasi satelit MODIS/VIIRS dengan prototipe sensor darat untuk "satellite-to-ground intelligence".
- **USP:** integrasi hardware IoT (konsep).
- **Kelemahan:** melebar dari challenge (hardware); harmonisasi hanya event-matching heuristik; kemungkinan banyak UI tanpa data riil; README berisi link Gemini notebook sebagai referensi.

---

## 11. FireChronicle — `bhavishyaone1/FireChronicle`

- **Tim/lokasi:** not found.
- **Waktu:** repo dibuat 2026-10-26 (commit lokal mulai 2026-10-25), push terakhir 2026-11-09. Backend + frontend Next.js + tests + CI + puluhan screenshot. README **kontradiktif**: header "Operating Mode: HACKATHON_BUILD (Activated & Verified)", lalu "Current Status: PRE_HACKATHON_PREPARATION" dan "No project solution code ... may be created prior to the official event start", padahal kode & validation report (dieksekusi 2026-10-25) sudah ada. **Risiko pre-build sangat tinggi.** Juga ada `.agents/skills` dan "Frontend Master Prompt".
- **Stack:** Python FastAPI (services: firms_client, matcher, normalizer, aggregator, pipeline, storage), DuckDB, Parquet; Next.js + TypeScript; GeoPandas/Shapely direncanakan; CI GitHub Actions.
- **Data & produk:** FIRMS Area API / archive CSV: MODIS (Aqua/Terra), VIIRS S-NPP/NOAA-20/NOAA-21, SP & NRT (mis. `MODIS_SP`, `VIIRS_NOAA20_SP`).
- **Metode harmonisasi:** pipeline 11 tahap; normalisasi + provenance hash SHA-256; mapping confidence MODIS <30/30–80/>80; grid equal-area ~1 km (configurable 500 m–5 km; Lambert CEA / EPSG:6933); **candidate matching |Δt| ≤ 60 menit dan jarak ≤ 1.0 km**; klasifikasi Matched/MODIS-only/VIIRS-only; metrik utama `unique_active_cells`; aturan "FRP tidak pernah dijumlahkan". **Tidak ada kalibrasi rasio/regresi lintas era.**
- **Angka (self-reported, AOI LA Basin 10–15 Agu 2024):** 13 MODIS, 21 VIIRS, 18 candidate pairs, MODIS matched 84.6%, VIIRS matched 85.7%, 6 harmonized cells ("82.4% reduction"), Jaccard 0.833; sensitivitas radius 500 m–2000 m; VIIRS 3×–10× lebih banyak titik (klaim umum).
- **Calendar/visualisasi:** tab Calendar, Compare, Anomalies, Audit (ledger), Methodology; peta satelit; HUD koordinat; seasonal baseline.
- **Validasi:** hanya studi kasus 6 hari, 34 titik; 17 pytest.
- **Kejujuran limitasi:** sedang (prinsip ilmiah bagus, tetapi klaim "82.4% reduction in bias" dari sampel kecil adalah overclaim).
- **Fokus/user:** California, Pantanal, NSW Australia (rencana); umum.
- **Wow feature:** audit ledger + UI premium "black/ember/amber".
- **Inti ide:** Menjadikan `unique_active_cells` pada grid equal-area sebagai metrik invarian resolusi, dengan audit penuh per observasi.
- **USP:** tata kelola data/provenance + desain UI.
- **Kelemahan:** tidak menyelesaikan lompatan 2012 (grid 1 km saja tidak menghapus perbedaan sensitivitas); data sangat kecil; tidak ada seri 2000–sekarang; kontradiksi status pre-build.

---

## 12. FireAtlas — `prateekguntupalli/FireAtlas`

- **Tim/lokasi:** not found.
- **Waktu:** dibuat 2026-11-10, push 2026-11-10. Isi hanya README 2 baris + LICENSE. Homepage `fireatlas.vercel.app` mengembalikan 404. **Tidak ada risiko pre-build** (belum ada kode).
- **Stack / data / metode / kalender / validasi / wilayah / wow:** not found.
- **Inti ide:** "Harmonizing MODIS and VIIRS satellite fire detection records into a unified burning-activity calendar."
- **USP / kelemahan:** belum bisa dinilai; pantau setelah event.

---

## 13. Chronofire — `shahedrayhan23/Chronofire`

- **Tim/lokasi:** not found (fokus Asia Selatan).
- **Waktu:** dibuat 2026-10-10, push 2026-10-10. Hanya README, DESIGN.md, FEATURES.md (semua berlabel "Planned/Proposed"). **Risiko pre-build rendah** (tidak ada kode), meski rencana menyebut menyiapkan Parquet multi-tahun "before event".
- **Stack:** rencana Python (`src/compute/harmonize.py`), Parquet; frontend not found.
- **Data & produk:** FIRMS MODIS (1 km) + VIIRS (375 m) termasuk NOAA-20/NOAA-21; arsip CSV → Parquet.
- **Metode harmonisasi:** rencana generik: grid bersama, cluster deteksi same-day yang overlap, "model the detection difference between sensors", validasi pada periode overlap. Tidak ada angka/metode konkret.
- **Calendar/visualisasi:** rencana toggle raw vs harmonised (South Asia 2003–2026) sebagai "killer demo", kalender + peta, baseline musiman + anomali ("Is today unusual for this place at this time of year?"), methods panel, responder brief.
- **Validasi:** rencana sensor-overlap validation.
- **Kejujuran limitasi:** tinggi (eksplisit "No implementation, results, metrics, or screenshots exist yet").
- **Fokus/user:** Asia Selatan; responder.
- **Wow feature:** toggle raw/harmonised (rencana).
- **Inti ide:** Menghapus step change transisi sensor dan menampilkannya dengan satu toggle raw vs harmonised.
- **USP:** not found (sangat generik).
- **Kelemahan:** belum ada apa-apa; metode belum ditentukan; scope reduction plan menunjukkan ekspektasi rendah.

---

## 14. FireLens — `shahmirkhan106/firelens`

- **Tim/lokasi:** Team "scikit" — M. Shahmir Khan, Ahmed Bilal, Abbas Bajwa, Azwar Khan, Sajid Islam. Lokasi tidak disebut.
- **Waktu:** dibuat 2026-10-12, push terakhir 2026-10-28. Pipeline + backend + frontend + data processed 5 wilayah (~39 MB) + video demo mp4 + deck + submission text sudah ada. **Risiko pre-build sangat tinggi** (bahkan deliverable submission sudah dibuat).
- **Stack:** Python (pandas, H3, parquet), FastAPI (cache in-memory, self-invalidating), Vite + React; Playwright untuk screenshot; ffmpeg untuk video.
- **Data & produk:** FIRMS Area API `MODIS_SP` (C6.1 Terra/Aqua, 2001→) dan `VIIRS_SNPP_SP` (375 m, 2012→). Tidak memakai NOAA-20/21 (hanya disebut sebagai pengganti).
- **Metode harmonisasi:** clean (VIIRS buang `low`, MODIS confidence < 25, buang type 2 volcano & 3 static/offshore, buang FRP ≤ 0) → grid **H3 resolusi 8 (~0.7 km²)**, hitung unique fire cells per hari → **OLS per wilayah `MODIS ~ a + b·VIIRS`** di overlap 2012→sekarang → seri harmonized = MODIS terukur jika ada, VIIRS terkalibrasi hanya mengisi hari tanpa MODIS (floor 0). Metrik `unique_cells` (bukan FRP).
- **Angka (self-reported):** VIIRS/MODIS median bulan overlap: North India 4.27×, Australia NSW 2.66×, Amazon 2.30×, East Siberia 2.26×, California 1.98×; tabel lain "VIIRS over-report": California 2.31×, North India 4.90×, Amazon 2.31×, NSW 2.98×, East Siberia 2.41× (dua angka berbeda untuk wilayah sama — inkonsistensi metrik); R² kalibrasi 0.922 / 0.586 / 0.901 / 0.917 / 0.952; FRP ratio VIIRS/MODIS 0.49–0.89 (North India 1.69); gridding H3 menurunkan rasio California dari 4.0× ke 1.52× (satu hari); 28,287,761 deteksi diproses; porsi hari post-2012 yang diisi VIIRS terkalibrasi 1.8%–30.5% (cell-days 0.01%–0.9%).
- **Calendar/visualisasi:** 5 view — "Why harmonize" (MODIS/VIIRS/harmonized satu sumbu), kalender heatmap tahun × hari, typical season (median + band p10–p90 mingguan), season timing (start/peak/end per tahun + drift), unusual weeks (anomali = (value − median)/(p90 − p10)). Explainer "What am I looking at?" di setiap view. **Tidak ada peta** (diakui).
- **Validasi:** R² fit in-sample pada overlap; tidak ada holdout/LOYO; tidak ada pembanding eksternal.
- **Kejujuran limitasi:** tinggi (mengakui North India R² 0.586, harmonized series sebagian besar = MODIS asli, tidak ada map, cloud tidak dimodelkan, insiden data terpotong).
- **Fokus/user:** 5 wilayah global (California, North India, Amazon, Australia NSW, East Siberia); emergency manager.
- **Wow feature:** view "Why harmonize" + season-timing drift.
- **Inti ide:** Grid H3 untuk membunuh inflasi piksel, lalu regresi linear per wilayah di 14 tahun overlap untuk menaruh VIIRS di skala MODIS.
- **USP:** pemakaian H3 + eksplanasi UX yang bagus + data riil 26 tahun.
- **Kelemahan:** "harmonisasi" hampir tidak bekerja (output ≈ MODIS asli; VIIRS hanya mengisi ≤0.9% cell-days) → tidak menyiapkan dunia pasca-MODIS; hanya 5 AOI tetap (tidak ada AOI bebas, tidak ada peta); OLS linear gagal untuk crop burning; tidak ada interval ketidakpastian; tidak ada validasi out-of-sample; tidak memakai NOAA-20/21.

---

## Tabel Perbandingan

| Repo | Inti ide | Metode harmonisasi | Validasi | Fokus wilayah | USP | Kelemahan | Risiko pre-build |
|---|---|---|---|---|---|---|---|
| Kiln Watch (Aalvee-Aarham) | Record Aqua-scale 2000–kini tanpa lompatan + kiln | Rasio total per bulan × day/night, empirical-Bayes shrinkage, chain Terra→Aqua←S-NPP←N20←N21, observing-opportunity, inverse-variance stitching, interval 95% | MODIS-denial test, placebo, S-NPP withholding, Sen slope, pre-registered test plan | Global 9 AOI + any place; Bangladesh (kiln) | Denial test + kontinuitas pasca-S-NPP + MCP 31 tools + kiln | Tanpa koreksi awan; tak distratifikasi land cover/scan; scope sangat luas | **Sangat tinggi** (repo demo push 13 Nov, bertentangan dengan klaim sendiri) |
| Still-Low-Priority | (deskripsi saja) | not found | not found | not found | not found | Repo kosong | Tidak ada |
| FireHarmonize (harishk2086) | Dashboard matching MODIS–VIIRS live | Point matching BallTree, skor 0.5/0.3/0.2, radius 2 km / 180 menit | Unit test saja | Punjab–Haryana, South India | Live deploy + analisis drift Aqua | Tanpa kalender historis/anomali; 3–10 hari NRT | Tinggi |
| FireSync BOT Battalion (imTariful) | Monitoring + AgniCalendar global | BAU (β=0.294 tetap, γ=0.005) live 1 km; Random Forest Aqua-equivalent day/night di grid 10 km bulanan | Holdout diagnostic, status INSUFFICIENT | Global | Arsip 392 jt deteksi + provenance ekstrem | Dua jalur tidak tersambung; β tak di-fit; validasi gagal | **Sangat tinggi** (push 13 Nov) |
| FireSync (parthwandre45) | Dedup harian + burned area | DBSCAN + bipartite matching; N_eff; FRP VIIRS diutamakan; Wooster FRE → hektar | Tes software saja | India (Punjab/Haryana) | Estimasi burned area FRE | Hanya 9 hari data; Z-score N=9 | Tinggi |
| Pyro-Harmony (itssouradip34) | HFII via RF + koreksi VZA | Koreksi VZA, DBSCAN 1.5 km/1 j, RF → FRP_harm & ESFP, faktor biome | 10-fold CV (klaim) pada data sintetis | Global 5 AOI | Koreksi geometri scan + biome | Arsip historis sintetis; overclaim | **Sangat tinggi** (kode 28 Sep, sebelum statement) |
| Icarus (mdhabibullah…) | Pipeline reproducible offline | Presence cell-day ~5.5 km, bin 8 hari, kalibrasi multiplikatif per tile 1° + shrinkage κ=50, bootstrap, coverage rule | E1–E9 pre-registered: LOYO, sensitivitas, MCD64A1 (r² 0.34 sel / 0.87 regional) | Bangladesh & sekitar | Rigor + reproducibility + offline | Step sisa ~2.1×; multiplikatif kalah vs quantile mapping | **Sangat tinggi** (push 13 Nov) |
| salmahmed6 | Downloader Punjab | not found (tidak merge) | not found | Punjab, India | not found | Hanya data Okt–Nov 2025 | Sedang (rencana build pra-event) |
| Cauchy's Comet (Naser-Al-Noman) | Kalender mingguan + critical period shift | Quantile mapping MODIS→VIIRS per musim, grid 0.05°, cell-week | Belum ada (diakui) | Bangladesh / Asia Selatan | Pergeseran peak timing + provenance | Kalibrasi tak dipakai default; demo hanya Maret | Tinggi |
| FIRE FUSION (muhtadialammaaz) | Satelit + sensor darat | Association score 40/30/20/10, 3 km / 90 menit, ST-DBSCAN | not found | Global / Bangladesh | Konsep IoT ground node | Melebar dari challenge; AI-Studio generated | Tinggi |
| FireChronicle (bhavishyaone1) | unique_active_cells equal-area | Matching ≤1 km / ≤60 menit, grid equal-area ~1 km, FRP tidak dijumlah | Studi kasus 6 hari, 34 titik | California dll. | Audit ledger + UI premium | Tak menyelesaikan lompatan 2012; data mini; README kontradiktif | **Sangat tinggi** |
| FireAtlas (prateekguntupalli) | (deskripsi saja) | not found | not found | not found | not found | README saja; domain 404 | Tidak ada |
| Chronofire (shahedrayhan23) | Toggle raw vs harmonised | Rencana generik (grid + cluster + model perbedaan) | Rencana overlap validation | Asia Selatan | not found | Belum ada implementasi | Rendah |
| FireLens (shahmirkhan106) | Grid H3 + OLS per wilayah | H3 res 8 unique cells/hari, OLS MODIS~a+b·VIIRS overlap, MODIS diutamakan, VIIRS isi gap | R² in-sample (0.586–0.952) | 5 AOI global | H3 + UX penjelas | Output ≈ MODIS asli; tanpa AOI bebas/peta/interval/holdout | **Sangat tinggi** (video & deck sudah jadi 28 Okt) |

---

## Pola Penting (ringkas)

1. **Metode yang sudah komoditas:** (a) grid bersama + presence/unique cell-day untuk meredam inflasi piksel (Icarus, FireLens H3, FireChronicle, Cauchy, FireSync BAU, Kiln Watch); (b) satu faktor rasio/regresi VIIRS→MODIS di periode overlap (FireLens OLS, Icarus multiplikatif, FireSync β=0.294, Kiln Watch rasio); (c) point-matching spatio-temporal dengan radius 1–3 km dan jendela 30–180 menit + skor berbobot (FireHarmonize, FIRE FUSION, FireChronicle, parthwandre45); (d) baseline median/p10–p90 + anomali robust; (e) mapping confidence VIIRS l/n/h ke angka; (f) disclaimer "hotspot ≠ fire", "missing ≠ zero".
2. **Paling kuat:** Kiln Watch (validasi denial + placebo + interval + rantai NOAA-20/21 + pasca-S-NPP, 9 AOI, any-place) > Icarus (E1–E9 pre-registered, LOYO, MCD64A1, offline) > FireLens (data riil 26 tahun, UX jelas, tetapi harmonisasi lemah) > FireSync BOT Battalion (skala data besar, RF, tetapi terfragmentasi dan validasi gagal).
3. **Yang TIDAK dilakukan siapa pun di batch ini:**
   - Koreksi **tutupan awan / observing opportunity per-piksel** (MOD14A1/VNP14A1 fire mask, atau cloud fraction) — Kiln Watch hanya per-satelit global; semua mengakui sebagai gap.
   - Kalibrasi berbasis **scan angle / ukuran piksel aktual (kolom scan×track)** per deteksi yang tervalidasi (Pyro-Harmony hanya di atas data sintetis).
   - Kalibrasi berbasis **distribusi FRP** (FRP-thresholded matching: hanya menghitung deteksi VIIRS di atas ambang deteksi MODIS) — tidak ada yang memakai "common detection threshold" fisik.
   - Stratifikasi kalibrasi per **land cover / rezim api** (crop vs hutan vs gambut) yang diuji — FireLens dan Kiln Watch sama-sama gagal di crop burning dan menyebutnya sebagai next step.
   - Fokus **Indonesia / Asia Tenggara / gambut (peat)**, ENSO/El Niño, atau pengguna Indonesia (BNPB, KLHK, BMKG, Manggala Agni) — fokus mayoritas Bangladesh, India Punjab, California, global.
   - **Backtest early-warning** (deteksi musim abnormal sebelum puncak) — Kiln Watch mengakui belum.
   - Validasi terhadap **statistik resmi/independen** selain MCD64A1 (mis. data hotspot nasional, luas kebakaran resmi).
   - Penanganan eksplisit **MODIS collection change** dan **NRT vs SP bias** secara kuantitatif.
