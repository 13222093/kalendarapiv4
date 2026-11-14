# Repo Pesaing Batch 2 — Harmonization of MODIS and VIIRS Hot Spots (NASA Space Apps 2026)

Disusun: 13 Nov 2026 (H-1 hackathon 14–15 Nov 2026). Riset saja, tanpa kode.
Sumber: README/raw file di GitHub, GitHub REST API tanpa autentikasi (created_at/pushed_at/size/language), WebSearch.
Semua angka adalah **klaim sendiri (self-reported)** dari README/kode repo, belum diverifikasi ulang. "Tidak ditemukan" = tidak terlihat di README/file yang dibaca.
Ukuran repo (size) dari API dalam KB.

Penilaian **risiko pre-build**: TINGGI = kode/data substansial sudah ada sebelum 14 Nov 2026; SEDANG = kerangka/prototipe signifikan; RENDAH = README/konsep saja atau dinyatakan akan ditulis ulang.

Konteks penting yang muncul berulang di repo pesaing:
- **NASA FIRMS berhenti memproduksi data Suomi-NPP pada 2 Nov 2026 13:00 UTC** (dikutip squadronzero/project-shift dari FIRMS FAQ; kiln-watch dan zakarpattia-orbit juga menyebutnya; IGNIS menyebut "S-NPP sunset note"). Banyak tim memakai NOAA-20 sebagai penerus (rasio NOAA-20/S-NPP ≈0.93–1.07).
- MODIS Terra/Aqua mendekati akhir misi; beberapa tim membingkai harmonisasi sebagai "record continuity after MODIS".

---

## BAGIAN A — 14 repo yang ditugaskan

### A1. snslighting/ember-atlas — "Ember Atlas — NASA MODIS × VIIRS"
- **Tim/lokasi:** tidak ditemukan. README memuat path lokal Windows (`C:\Codex\NASA Space Apps\ember atlas`) dan menyebut "Work's MODIS/VIIRS harmonization" (frasa internal, kemungkinan hasil agen coding).
- **Created / last push:** 2026-10-01 / 2026-10-04. Ukuran ~162 MB. **Risiko pre-build: TINGGI** (situs GitHub Pages sudah live, arsip 731 file NASA sudah diproses).
- **Stack:** Node.js 22, JavaScript vanilla + Web Worker, canvas map, OpenFreeMap/EOX/Blue Marble basemap, GitHub Actions (refresh NRT tiap 15 menit), GitHub Pages.
- **Data:** FIRMS MODIS C6.1, VIIRS S-NPP, NOAA-20 (SP + NRT), file tahunan per negara, Area API, data_availability API, NASA GIBS vector tiles (arsip harian global sejak 2000-11-01). NOAA-21 hanya skema, tanpa seri historis.
- **Metode harmonisasi (konkret):** grid ~1 km per hari UTC, hitung occupied-cell per produk. Filter kualitas: MODIS confidence ≥40, VIIRS nominal/high. Per AOI dan per produk VIIRS: `k = Σ(MODIS cells) / Σ(VIIRS cells)` dari hari berpasangan SP s.d. 2020 (min 30 hari berpasangan, 3 tahun latih). Harian `H = (M + kV)/2` jika keduanya ada, kalau tidak M atau kV. Prioritas referensi VIIRS: S-NPP > NOAA-20 > NOAA-21. Skala akhir = proxy occupied-cell skala MODIS. SP setelah 2020 = holdout.
- **Angka dilaporkan:** 1.225.406 baris input, 1.007.542 diterima. Uzbekistan: k S-NPP 0.1688 (3.269 hari latih, 2.007 hari holdout, RMSE 7.72 cell/hari, bias −2.33); NOAA-20 0.1975. California utara: k 0.561 (RMSE 17.76). Rondônia: k 0.456 (RMSE 89.51).
- **Kalender/visual:** kalender bulanan (bulan kosong tetap kosong, bukan nol), playback, live map NRT, mode Monitor (early warning), replay historis dunia via GIBS, AOI yang disimpan lokal, gambar area, drill-down negara/region.
- **Anomali:** persentil midrank vs tahun SP lain pada tanggal kalender yang sama; median musiman, rasio H/median, z-score; Normal <p80, Elevated ≥p80, Unusual ≥p95, Critical ≥p99 (butuh ≥20 tahun pembanding).
- **Validasi & kejujuran keterbatasan:** sangat jujur — menyebut tidak ada masker awan/overpass, k hanya rasio agregat, bukan validasi event, NRT provisional, belum ada interval ketidakpastian. Tes otomatis + "historical replay validation".
- **Fokus wilayah / user:** Uzbekistan (arsip 2000–2026 lengkap), plus studi kasus California dan Rondônia. User: decision-support/pemantau.
- **Wow feature:** replay harian global dari GIBS vector tiles + monitor NRT 15 menit + early warning berbasis persentil.
- **Inti ide (1 kalimat):** Atlas kebakaran Uzbekistan-sentris dengan kalibrasi rasio occupied-cell per AOI dan monitor live.
- **USP:** provenance/checksum sangat ketat; pemisahan tegas "missing vs zero".
- **Kelemahan:** histori baseline hanya untuk 3–4 area yang disiapkan (global "explicitly unavailable"); README berantakan/internal; upgrade monitoring "belum di-deploy"; push terakhir 4 Okt (mungkin ditinggal).

### A2. Thay32-Heng/pyfire-watch — "PyFire Watch"
- **Tim/lokasi:** tidak ditemukan. AOI default: Kamboja.
- **Created / last push:** 2026-10-29 / 2026-10-29. Ukuran 42 KB. Live: pyfire-watch.vercel.app. **Risiko pre-build: SEDANG-RENDAH** (prototipe v0.1 kecil).
- **Stack:** Python (pandas) pipeline + HTML/JS statis, Vercel, GitHub Actions.
- **Data:** FIRMS MODIS C6.1 + VIIRS C2, hanya file global 7 hari. Status: **8 hari data Kamboja (MODIS 28 + VIIRS 133 deteksi, Okt 2026)**.
- **Metode:** normalisasi confidence (VIIRS low/nominal/high → 20/60/90); filter MODIS ≥80, VIIRS nominal/high; grid 0.1°; densitas per km² (bukan count mentah); bin mingguan ISO; faktor kalibrasi `c_m` = median rasio VIIRS/MODIS per bulan pada periode overlap.
- **Kalender/visual:** heatmap tahun × minggu dengan band klimatologi, label normal/unusual/critical per minggu, toggle sensor (MODIS/VIIRS/harmonized) untuk "menghilangkan step 2012", ekspor CSV/PNG.
- **Validasi:** unit test saja; tidak ada validasi kuantitatif.
- **Inti ide:** kalender mingguan terkalibrasi untuk Kamboja.
- **USP:** toggle sensor sederhana yang memperlihatkan step 2012.
- **Kelemahan:** data hanya 8 hari; filter MODIS ≥80 sangat ketat; belum ada histori 25 tahun.

### A3. nasifnaser06-cyber/Project_S.H.I.F.T — "Fire Harmonization | Florida" (SHIFT v1)
- **Tim/lokasi:** Team Squadron Zero (dikonfirmasi oleh repo squadronzero/project-shift yang menyebut repo ini sebagai "SHIFT v1 Florida prototype"). Lokasi tim tidak ditemukan.
- **Created / last push:** 2026-09-27 / 2026-10-14. Ukuran ~1,5 MB (CSV hasil ~15 MB). Live Streamlit app. **Risiko pre-build: TINGGI** (bersama penerusnya B5).
- **Stack:** Python, Streamlit, Altair, pydeck (kolom 3D).
- **Data:** MODIS C6.1 + VIIRS S-NPP 375 m, Florida, 2002–2026.
- **Metode:** grid 0.05°, agregasi cell-day. Kalibrasi **FRP** dengan OLS: `VIIRS = 0.316162 × MODIS + 24.701681` (latih 2012–2021, 19.689 observasi). Timeline: 2002–2011 = MODIS terkalibrasi, 2012–2026 = VIIRS asli.
- **Catatan dari data mereka sendiri:** di `florida_annual_harmonized_summary.csv`, median FRP turun dari ~31,9 MW (2011) ke 6,45 MW (2012) dan cell_days naik 4.582 → 5.304 — step 2012 tidak hilang. (Penerusnya B5 menyebut "v1 intercept problem".)
- **Kalender/visual:** peta grid, kolom 3D FRP, grafik tahunan, scatter kalibrasi, unduh CSV. Kalender khusus tidak terlihat.
- **Validasi:** scatter kalibrasi; tidak ada metrik holdout di app.
- **Inti ide:** kalibrasi FRP MODIS→VIIRS linear untuk Florida.
- **USP:** visual 3D, deploy cepat.
- **Kelemahan:** harmonisasi FRP (bukan count) dengan intercept besar; step 2012 masih kelihatan di data sendiri; hanya Florida.

### A4. NIKAIZ-AI/AIEKYA-APEX — "HarmoniSat: MODIS & VIIRS Harmonization Studio"
- **Tim/lokasi:** tidak ditemukan.
- **Created / last push:** 2026-11-06 / 2026-11-06 (sekali push). Ukuran ~10,5 MB. **Risiko pre-build: SEDANG** (UI banyak, tetapi datanya sintetis).
- **Stack:** TypeScript, React, Vite, Bun; ekspor Google AI Studio (folder `.aistudio`, kapabilitas Gemini server-side).
- **Data:** **sintetis/prosedural.** `generateFireCalendarData()` membangkitkan count 2000–2026 dari `baselineMonthlyMean` hardcoded + noise sinus; bukan FIRMS.
- **Metode:** `harmonized = α · V^β · frpWeight` dengan α, β hardcoded per biome (mis. α=0.32, β=0.96); masa overlap 2012–2019 = 0.45·MODIS + 0.55·harmonized VIIRS.
- **Visual:** globe 3D, model orbit & swath, panel BRDF, Spectral SBAF, bow-tie footprint, matriks kalender, median historis, ekspor CSV/JSON.
- **Region preset:** Amazon, California, Australia, Afrika sub-Sahara, Pantanal, Siberia, Mediterania. **Tidak ada Indonesia.**
- **Validasi:** unit test fungsi saja.
- **Inti ide:** studio visual "physics-flavoured" harmonisasi sensor.
- **USP:** visual orbit/BRDF/SBAF yang mencolok.
- **Kelemahan:** angka palsu; formula tidak diturunkan dari data.

### A5. Vtheonly/NasaSpaceApp2026 — "Harmonization of MODIS and VIIRS Hot Spots"
- **Tim/lokasi:** tidak ditemukan.
- **Created / last push:** 2026-10-21 / 2026-10-25. Ukuran ~516 KB. **Risiko pre-build: TINGGI** (pipeline + ~320 tes + CI sudah ada).
- **Stack:** Python, LightGBM, PyTorch (PatchTST), opsional Prithvi-EO 2.0, lingkungan Kaggle offline; viewer HTML statis.
- **Data:** FIRMS CSV (skema NRT terverifikasi), tetapi **semua bukti dijalankan pada fixture sintetis**.
- **Metode:** LightGBM Tweedie memetakan MODIS → FRP setara VIIRS dari pasangan overlap, dibandingkan baseline identity & kalibrasi, evaluasi kronologis; kalender 52 minggu × tahun; anomali musiman; forecast 14 hari PatchTST dengan backtest rolling-origin.
- **Visual:** peta hotspot, kalender 52 minggu, tabel anomali, fan chart forecast, provenance. Gambar AOI di browser belum ada.
- **Validasi:** "five-pass data gate" fail-closed, tes UI/aksesibilitas; validasi data nyata multi-tahun "masih direncanakan".
- **Inti ide:** pipeline ML ber-governance tinggi (charter, risk register, ADR).
- **USP:** rekayasa/proses yang sangat rapi.
- **Kelemahan:** belum ada hasil data nyata; tidak ada AOI drawing; berat infrastruktur.

### A6. Mosharrof8097/nasa_space_app_challange_2026 — "EmberSync"
- **Tim/lokasi:** Team ASL NOVA, Mymensingh Engineering College, **Bangladesh** (6 anggota).
- **Created / last push:** 2026-10-07 / 2026-11-13. Ukuran ~28 MB. **Risiko pre-build: TINGGI.**
- **Stack:** Python (pandas, numpy), dashboard HTML/JS tanpa build.
- **Data:** FIRMS MODIS C6.1 NRT + VIIRS S-NPP NRT, **jendela 8 hari (19–26 Sep 2026)**; punya 2.843 file VIIRS 2012–2024 (~20 GB) belum diproses; arsip MODIS 2000–2011 belum diunduh.
- **Metode:** (1) clustering spatio-temporal: grid jarak-sama (koreksi cos lat) + union Haversine → 83.226 deteksi jadi 34.869 event; (2) **algoritma genetika** multi-objektif (populasi 50, 30 generasi) mencari radius per biome + kurva kalibrasi FRP (quantile mapping p10–p90), bobot 0.6 energi / 0.4 parity count; radius diumpan balik ke clustering (closed loop).
- **Angka:** rasio VIIRS:MODIS 4.26:1; deteksi per fire terkonfirmasi 4.73 vs 1.55 (3.05×); 3.891 fire terdeteksi kedua sensor; "inflasi 58.1% dihapus"; radius per biome 0.80–1.50 km; fit distribusi holdout 92.3% (Dense Rainforest, 1.098 pasangan) s.d. 73.9% (Savanna, 30 pasangan); korelasi FRP per-fire r = 0.19–0.78 (diakui tidak bisa diprediksi).
- **Kalender:** sel per hari per biome, Z-score NORMAL / ELEVATED_RISK (Z≥1) / CRITICAL_ANOMALY (Z≥2). Toggle raw vs harmonized (+270% di 2012 pada raw).
- **Kejujuran:** tinggi — mengakui seri 2000–2026 di dashboard adalah **"modelled baseline projection"**, bukan data terukur; label biome dari bounding box.
- **Inti ide:** GA per-biome yang menyetel radius dedup dan kalibrasi FRP sekaligus.
- **USP:** "satelit saling memvalidasi" tanpa ground truth eksternal; narasi kuat.
- **Kelemahan:** hanya 8 hari data nyata; kalender multi-tahun belum terukur; biome tidak berbasis land-cover.

### A7. ImtiazIftii/NPC_SpaceApps — "FireCalendar: Operational Wildfire Intelligence Platform"
- **Tim/lokasi:** tidak ditemukan.
- **Created / last push:** 2026-10-06 / 2026-10-09. Ukuran ~139 MB. Live: firecalendar.onrender.com. **Risiko pre-build: TINGGI.**
- **Stack:** Python, FastAPI, Jupyter, frontend React (endpoint untuk React), Render.
- **Data:** FIRMS MODIS Terra/Aqua 2000–2026 + VIIRS S-NPP 2012–2026 (zip tahunan).
- **Metode:** MODIS conf ≥30, VIIRS n/h; dedup footprint 0.01° (~1 km) per hari; agregasi grid 0.25°; `k = ΣMODIS bulanan / ΣVIIRS bulanan` (Feb 2012–Dec 2025) per negara, **k ≈ 0.41–0.49, korelasi bulanan r > 0.97**; sebelum Feb 2012 = MODIS, sesudahnya = VIIRS × k.
- **Kalender/anomali:** heatmap 23×366 (rolling 7 hari), baseline DOY mean/std 2003–2025 (rolling 15 hari), unusual jika z > 2; awal/puncak/akhir musim (10%/90% kumulatif), "critical period" = ≥5 hari berturut-turut ≥p75; tren hari per dekade; endpoint `/api/trust` (r, median error harian/mingguan/bulanan).
- **Fokus wilayah:** ARG, AUS, BRA, CHL, PRY, URY (Amerika Selatan + Australia).
- **Inti ide:** API kalender iklimatologis per negara dengan endpoint "trust".
- **USP:** metrik musim (start/peak/end, tren dekadal) + panel kepercayaan.
- **Kelemahan:** k tunggal per negara; tidak ada NOAA-20/21; bbox negara kasar.

### A8. tommyquak/SpaceApps — "PeatGuard NISAR" (BEDA CHALLENGE)
- **Challenge:** "Dancing with the SARs", **bukan** challenge harmonisasi. Tetap relevan karena fokus **Kalimantan Tengah/gambut**.
- **Tim/lokasi:** tim Singapura–Indonesia (Tommy Quak – NUS; Delfina Poernomo – Indonesia; Louise Goh; Chia Jia Yuun). Juara 3 Adaptation & Resilience, Global Sustainability Challenge 2026.
- **Created / last push:** 2026-11-05 / 2026-11-12. Ukuran ~64 MB, 330 tes. **Risiko pre-build: TINGGI.**
- **Stack:** Python, ISCE2, MintPy, FastAPI + TiTiler + Leaflet, COG, Slurm.
- **Data:** NISAR L2 GUNW, Tay et al. 2025 ALOS-2, **FIRMS MODIS+VIIRS + MCD64A1** (sejarah api), Landsat NBR 1990–2026, peta kanal Dadap 2021.
- **Relevansi bagi kita:** memakai fire history MODIS/VIIRS hanya sebagai satu layer prioritas restorasi (60 lokasi sekat kanal), plus animasi "fire keeps returning to the same drained peat" 2001–2026. Tidak melakukan harmonisasi sensor.
- **Kelemahan (dari sisi challenge kita):** tidak relevan langsung; tetapi menunjukkan juri global bisa melihat narasi gambut Kalimantan dari tim lain.

### A9. usman2ki/SpaceAppChallenge — "Ember Atlas" (berbeda dari A1)
- **Tim/lokasi:** tidak ditemukan.
- **Created / last push:** 2026-11-02 23:57 / 2026-11-03 00:39 UTC. Ukuran ~3,3 MB. **Risiko pre-build: SEDANG-TINGGI** (backend+frontend+tes lengkap, tetapi tanpa data nyata).
- **Stack:** Python 3.11+ backend (CLI `ember`), SQLite/PostGIS, Node 20 frontend, Docker Compose, Playwright.
- **Data:** **dunia sintetis deterministik** (berlabel SYNTHETIC di mana-mana); prosedur impor FIRMS nyata ada; preset `pilot-cerrado`.
- **Metode:** VIIRS dinyatakan di skala MODIS Aqua via "paired conditional rate-ratio model" + block-bootstrap uncertainty; perbandingan dengan naive splicing; validasi blocked temporal & spatial hold-out; eksperimen recovery bias sintetis; analisis sensitivitas grid/jendela/filter/coverage.
- **Kalender/anomali:** kalender mingguan/harian, baseline musiman, periode unusual dengan kontrol FDR.
- **AOI:** preset, gambar poligon, unggah GeoJSON, ketik bbox. Ekspor CSV/GeoJSON dengan provenance + versi metode + kolom ketidakpastian.
- **Inti ide:** framework statistik rigor (FDR, bootstrap) yang jujur soal data sintetis.
- **Kelemahan:** "Nothing here is scientifically validated on real data yet."

### A10. Kolok2008/zakarpattia-orbit — "Zakarpattia Orbit v2"
- **Tim/lokasi:** Serhii Medulych, Zakarpattia, **Ukraina**; partisipasi online (event Kyiv KAI, 14–15 Nov).
- **Created / last push:** 2026-11-07 / 2026-11-07. Ukuran ~587 KB. **Risiko pre-build: TINGGI** (v2, kalender 26 tahun sudah jadi).
- **Stack:** Python (pandas, matplotlib), server lokal, firmware ESP32-CAM (Arduino), MAVLink/ArduPilot SITL, OSRM.
- **Data:** FIRMS Area API (2.843 request): MODIS_SP 2001–2026 (6.942 titik), VIIRS_SNPP_SP (13.635), NOAA-20 SP 2023–2026, NRT NOAA-20/21.
- **Metode:** filter `type=0`, buang sumber statis; pasangan Aqua–S-NPP (≤1.5 km, ≤60 menit): 56% MODIS punya pasangan, 2.2 titik VIIRS per titik MODIS, offset median 550 m, `log10(ΣFRP_VIIRS) = 0.47 + 0.55·log10(FRP_MODIS)`. **Rasio per bulan kalender `r = ΣVIIRS/ΣMODIS`** (2.75 Maret s.d. 7.0 Juli; global 3.37 [3.12–3.67]), interval 80% bootstrap per tahun; MODIS-era diskalakan ke setara VIIRS; pasca S-NPP: NOAA-20 × 0.93 [0.86–1.02].
- **Validasi:** leave-one-year-out — **MAPE tahunan 9.8% vs 73.8% tanpa harmonisasi**, R² tahunan 0.95; WAPE bulanan 27.5% vs 70.4%; MAPE bulanan 68.5% (diakui tinggi untuk bulan sepi).
- **Kalender/anomali:** klimatologi mean/p10/p90 per bulan, jendela kritis (rata-rata 15 hari >1.5× mean selama ≥7 hari → 02.03–28.04, bakar rumput musim semi), z-score bulan 2026; peta rekurensi 0.02° (893 sel terbakar ≥5 tahun).
- **Wow feature:** stasiun darat yang mengirim **drone terdekat** ke hotspot baru, sensor CO/suhu/kamera, rute pemadam via OSRM, "copy untuk DSNS".
- **Inti ide:** kalender harmonisasi lokal + verifikasi hotspot dengan drone.
- **USP:** hardware + rekurensi sebagai prior (sering terbakar → kemungkinan bakar ladang).
- **Kelemahan:** firmware & SITL belum diuji; wilayah kecil → bulan berisik; "AI" masih rule-based.

### A11. neilrxthod/Atmolar
- **Status:** README 1 kalimat, tanpa kode. Created/push 2026-09-28. **Risiko: RENDAH.**
- **Konsep:** harmonisasi MODIS+VIIRS + visibilitas darat & kualitas udara untuk penilaian risiko asap pra-terbang **general aviation di Kanada Barat**. Ide menarik (user spesifik: pilot), belum ada implementasi.

### A12. neilrxthod/Hemolar
- **Status:** kosong (hanya judul "Harmonization of MODIS and VIIRS Hot Spots"). Created 2026-09-28. **Risiko: RENDAH.** Tidak ada yang bisa dianalisis.

### A13. CatherineMarkowska/modispractice
- **Status:** README konsep latihan, tanpa kode. Created 2026-11-06. **Risiko: RENDAH.**
- **Konsep:** web app pencatat aktivitas bakar (wildfire & bakar pertanian) untuk ilmuwan, dengan bagian opini ilmuwan. Tim masih bertanya cara mengakses data satelit.

### A14. Husanxon4407/hotsync-practice — "HotSync practice app"
- **Tim/lokasi:** Team Capella; data Uzbekistan Juli 2025 (lokasi tim tidak dinyatakan eksplisit).
- **Created / last push:** 2026-11-06 / 2026-11-06. Ukuran ~249 KB. Live GitHub Pages. **Risiko pre-build: RENDAH-SEDANG** — README menyatakan eksplisit "the real project is written again at the hackathon".
- **Metode:** filter `type==0`, buang confidence rendah, buang 2 pabrik (sumber panas tetap); "exchange rate" **VIIRS ÷ MODIS ≈ 4.07** dari hari ketika keduanya melihat api; MODIS dikonversi ke "setara VIIRS".
- **Visual:** peta, grafik harian, kalender bakar, tabel, unduh CSV.
- **Kelemahan:** satu bulan data; latihan.

---

## BAGIAN B — Repo baru yang ditemukan (tidak ada di daftar mana pun)

Pencarian: GitHub search API `created:>2026-08-01` untuk "MODIS VIIRS harmonization", "burning activity calendar", "MODIS VIIRS hotspots", "fire calendar FIRMS", "hotspot harmonization", "MODIS VIIRS fire calendar", "space apps 2026 MODIS", "karhutla", "peat fire MODIS VIIRS" (0 hasil), "harmonization MODIS VIIRS indonesia" (0 hasil). Total ~56 repo untuk query utama; ini yang paling relevan/substansial.

Catatan dedup: "FireChronicle" (ada dua: arifinrupom22 & bhavishyaone1) dan "firelens" (abubokkor-cse, shahmirkhan106, smri29/FireLens-AI, nourreeldin) **dilewati** karena dianggap sudah dicakup agen lain.

### B1. EdisonShiny/eg-firetrack — "EG FireTrack" ⚠ PESAING LANGSUNG WILAYAH KITA
- **Tim/lokasi:** "EG Solution 2.0 Team"; pipeline berjalan 06:00 **MYT** → indikasi kuat Malaysia (tidak dinyatakan eksplisit).
- **Created / last push:** 2026-11-09 / 2026-11-13. Ukuran ~35,6 MB. **Risiko pre-build: TINGGI.** Link live masih `REPLACE-ME.vercel.app`.
- **Stack:** Python pipeline (Parquet, DuckDB/PostGIS), LightGBM + SHAP, React/Vite di Vercel, GitHub Action harian, notifikasi Telegram.
- **Data:** FIRMS MODIS C6.1 + VIIRS 375 m **Borneo 2017–2026**, Open-Meteo, NASA GFWED (FWI), GADM, WorldPop, OSM, peta gambut, NOAA ENSO.
- **Metode:** snap ke grid 1 km (satu sel api per hari); MODIS & VIIRS dalam ±1 km/±1 jam dianggap fire yang sama; simpan semua sel VIIRS + sel MODIS-only; `k = VIIRS cells ÷ MODIS cells` (median rasio bulanan) **per provinsi dan musim**; hari tanpa VIIRS diisi MODIS×k; validasi leave-one-year-out (R² & error; angka tidak dicantumkan di README).
- **Fitur:** Map, Calendar, Analysis (perbandingan Jan–Sep tiap tahun agar 2026 adil), Alerts; forecast 72 jam (LightGBM, harus mengalahkan baseline "kemarin terbakar → besok terbakar"), forecast 3 bulan per provinsi; risk score dengan **kedalaman gambut** (none/shallow/deep); aturan respon per yurisdiksi (Bomba Sarawak/Sabah, **BPBD, Manggala Agni, BNPB** untuk provinsi Kalimantan); modifier "peat injection lance", "block drainage canals", "assess cloud seeding".
- **Inti ide:** dari harmonisasi hotspot Borneo langsung ke rekomendasi operasional pemadaman lintas Malaysia–Indonesia.
- **USP:** gambut + playbook respons + rantai komando nyata (termasuk Indonesia).
- **Kelemahan:** histori hanya 10 tahun (2017–2026), bukan ~2000; angka validasi tidak dipublikasikan; banyak "sample data" ilustratif; live site belum ada.

### B2. Warren-530/fire-harmony — "Fire Harmony" ⚠ PESAING TERKUAT SECARA SAINS + SE ASIA
- **Tim/lokasi:** Team **Kopi and Cosmos** (Saw Yong Quan, Yap Yong Son). Modul haze untuk "delapan kota di Malaysia dan tetangganya" → indikasi Malaysia (lokasi tidak dinyatakan eksplisit).
- **Created / last push:** 2026-11-08 / 2026-11-13. Ukuran ~89 MB. Live GitHub Pages + dataset Hugging Face. **Risiko pre-build: TINGGI** (640 juta baris sudah diproses, report Quarto, poster A1).
- **Stack:** Python 3.12 (uv), LightGBM, H3; web React+Vite+TS, **DuckDB-WASM** membaca Parquet via HTTP, MapLibre + deck.gl, Observable Plot.
- **Data:** FIRMS MODIS Terra/Aqua + VIIRS S-NPP/NOAA-20/NOAA-21 (640.601.590 baris), MCD12C1, MOD14A1/VNP14A1, MCD64A1/VNP64A1, MERRA-2, GPM IMERG, GFWED, GPWv4, Global Fire Atlas, ESA Fire_cci, **PEATMAP**, GIHS (static mask), ONI/DMI.
- **Metode:** VIIRS satelit-satelit diskalakan ke **NOAA-20** lalu dirata-rata; bulan MODIS diprediksi **LightGBM per hexagon H3 L5 × bulan** dengan fitur land cover, gambut, populasi, biome (latih 2012–2019, skor pada tahun & region holdout); jembatan Terra-only (sebelum Juli 2002) dengan rasio regional Jul 2002–Jun 2005; rentang 90% terkalibrasi untuk tiap nilai.
- **Angka:** VIIRS melihat ~6× lebih banyak (5× siang, 30× malam); naive splicing = lompatan palsu **8.4×** pada 2012; static mask menangkap 96% deteksi statis VIIRS, membuang 1.4% api nyata.
- **Validasi:** seam test di 2002 dan 2012 terhadap satelit yang terbang di kedua sisi dan Fire_cci; placebo seam; Pettitt & PELT change-point; fisika deteksi pada 10 tile; outlook 1–3 bulan dengan Brier skill.
- **Fitur:** Explorer (area apa pun, kalender, drivers, outlook, unduhan), Dashboard, **Haze** (asap dari Sumatra & Borneo ke kota Malaysia), Methods; unduhan hotspot per region.
- **Inti ide:** rekor kebakaran global konsisten berbasis ML per sel dengan ketidakpastian + driver iklim + haze SE Asia.
- **USP:** kedalaman validasi (seam/placebo/change-point) + PEATMAP + haze.
- **Kelemahan:** sangat berat (60 GB); kompleks untuk dijelaskan dalam 30 detik; fokus Malaysia sebagai penerima asap, bukan sisi Indonesia/operasional.

### B3. Hisernberg/ignis-spaceapps2026 (+ ignis-public, ignis-data) — "IGNIS · Fire Calendar"
- **Tim/lokasi:** Team IGNIS, **Bangladesh**.
- **Created / last push:** 2026-09-20 / 2026-11-04 (ignis-public push 2026-10-29). Ukuran ~20 MB. Live Vercel. **Risiko pre-build: TINGGI.** README menyatakan semua repo IGNIS "private during judging".
- **Stack:** Next.js 16, TypeScript, MapLibre, Hugging Face (Llama-3.1-8B, MiniLM via transformers.js), n8n.
- **Data:** FIRMS area API (5 sensor) + fallback GIBS WMTS vector tiles, EONET, Open-Meteo/CAMS, GDACS, ReliefWeb, MOD11 LST.
- **Metode:** "continuity coefficient" per bulan `r(m) = median(VIIRS-SNPP/MODIS)` pada overlap 2012+; pra-2012 = MODIS × r̄; CV rasio ditampilkan sebagai ketidakpastian; baris MODIS-era diberi `scaled: true`.
- **Fitur:** 11 tab — Burning Calendar 26 thn × 12 bln (cincin |z|≥2, **KPI bulan ini vs median historis**), Impact (FRP → CO₂e), Watchlist, Cluster Lab (DBSCAN + convex hull), Time-Series Lab (Theil-Sen, CUSUM), Statistics Lab (Mann-Kendall, Gumbel EVT, Bland-Altman, Moran's I/LISA), Seasonal Outlook, Burn Regime, LLM SITREP.
- **Angka model:** event detector AUC 0.740 / PR-AUC 0.606 (holdout 2022–26); footprint forecaster IoU 0.58/0.55/0.42 vs persistence 0.36/0.39/0.38.
- **Inti ide:** kalender harmonisasi + "mission control" early warning dengan AI.
- **USP:** kelengkapan fitur ekstrem + model HF yang dipublikasi.
- **Kelemahan:** harmonisasi sederhana (median rasio bulanan tunggal); hanya 9 region + Bangladesh; berisiko "feature soup"; README memuat detail token Earthdata (nama akun, tanggal kedaluwarsa).

### B4. the-aris-club/flare-chronos — "Flare-Chronos" (+ klon rosdebbu/GeoHarmonix)
- **Tim/lokasi:** tidak dinyatakan; indikasi **Vietnam** (domain `flare-chronos.resonance.io.vn`, kosakata EN/VI di DESIGN.md, AOI Mekong).
- **Created / last push:** 2026-10-20 / 2026-11-12. Ukuran ~119 MB. **Risiko pre-build: TINGGI.**
- **Catatan:** `rosdebbu/GeoHarmonix` (created 2026-11-12, ~65 MB) adalah **rebrand hampir identik** (README hanya beda nama, masih menautkan domain flare-chronos) — indikasi salinan.
- **Stack:** Python (uv workspace), H3, LangGraph, FastAPI, Next.js 16 + Three.js globe, d3-geo, WeasyPrint PDF.
- **Data:** 1.609.182 deteksi FIRMS nyata (134 slice CSV, Amazon & Mekong 2000–2026), ERA5 cloud.
- **Metode:** rekonstruksi footprint elips dari scan angle (bow-tie MODIS, agregasi 3 zona VIIRS); alokasi fraksional ke H3 res 7/8; day/night via solar zenith (<85°); filter SAA & sumber statis → P(fire); kalibrasi FRP dua tahap (operator scan-angle + quantile mapping Aqua→SNPP terstratifikasi); episode multi-satelit (τ=60 menit); normalisasi upaya observasi Ω(tahun, lintang).
- **Angka:** step palsu +1.311,2% (Mekong) dan +714,3% (Amazon) dihilangkan; KS distance turun 69,4% (0.1153→0.0353), R² log-FRP 0.7839→0.8048 (N=20.786 pasangan); dedup Amazon 2024 5.75× (112.405 → 19.542 episode).
- **Kalender:** Tahun × **73 pentad** dengan HFD (density), HRF (radiative flux), SFAI (anomaly index); contoh Mekong 2007 +3.7σ.
- **Inti ide:** harmonisasi berbasis fisika footprint + AI harness yang "grounded".
- **USP:** fisika footprint/scan-angle & effort normalization — paling "physics-heavy".
- **Kelemahan:** hanya 2 AOI; sangat kompleks; AI harness bisa mengalihkan perhatian dari kalender.

### B5. squadronzero/project-shift — "SHIFT (Satellite Harmonization & Integrated Fire Tracking)"
- **Tim/lokasi:** Team Squadron Zero (penerus A3). Lokasi tidak ditemukan; ada "Bangladesh spotlight".
- **Created / last push:** 2026-10-02 / 2026-11-13. Ukuran ~9,6 MB. **Risiko pre-build: TINGGI.**
- **Stack:** Python (pandas, PyArrow, Shapely), Google Colab/Drive, React + MapLibre statis di GitHub Pages.
- **Data:** file tahunan dunia FIRMS MODIS 2002+, VIIRS S-NPP 2012+, NOAA-20 2018+; GFED4 & MERRA-2 cloud untuk pengecekan.
- **Metode:** cell-day 0.05° → rekor L3 0.25° harian di **skala S-NPP**; harmonisasi count (MODIS diskalakan ke VIIRS per region & bulan); faktor per tile 10° dan 2.5° dengan bootstrap; NOAA-20 diikat ke S-NPP (rasio tahunan 0.97–1.07) untuk lanjut pasca 2 Nov 2026; no-data mask; pemilihan sumber MODIS (Aqua/Terra/gabungan) dengan 6 tes "aturan ditetapkan sebelum run". Quickstart Florida: slope 0.317, intercept 24.8.
- **Validasi:** leave-one-year-out, bootstrap, known events, burned area, cloud; audit ilmiah 8 Nov 2026.
- **Inti ide:** rekor global yang tahan terhadap hilangnya S-NPP, dengan disiplin pra-registrasi aturan.
- **USP:** kesadaran "S-NPP sudah mati" + disiplin metodologis.
- **Kelemahan:** web/API masih fase berikut; dokumentasi sangat teknis.

### B6. freefirenoobs/sparkgrid — "SparkGrid" (NASA Space Apps Cairo 2026)
- **Tim/lokasi:** **Kairo, Mesir** (6 peran).
- **Created / last push:** 2026-11-13 / 2026-11-13. Ukuran ~179 MB. **Risiko pre-build: TINGGI** (live app, API, dan "AI Coding Hub" sudah online sehari sebelum event).
- **Stack:** FastAPI, React 18 + Vite + Leaflet, DBSCAN, Open WebUI, Cloudflare tunnel.
- **Metode:** DBSCAN spatio-temporal Haversine (1.5 km, 120 menit), centroid berbobot FRP, GeoJSON.
- **Angka:** Afrika utara & tengah 24 jam: 26.137 deteksi (3.773 MODIS + 22.364 VIIRS) → 11.660 cluster (kompresi 2.24×); 72 fire tervalidasi dua sensor.
- **Kalender:** tidak ditemukan (fokus deduplikasi real-time, bukan kalender historis).
- **Kelemahan:** tidak menjawab inti "kalender 2000–kini"; README mencantumkan token webhook deploy di URL (higiene keamanan buruk).

### B7. tttamannaanand/burn-calendar — "Burn Calendar"
- **Tim/lokasi:** tidak ditemukan.
- **Created / last push:** 2026-11-11 / 2026-11-11. Ukuran ~2,5 MB. Live GitHub Pages. **Risiko pre-build: TINGGI** (data nyata + validasi selesai).
- **Metode:** **quantile mapping** distribusi count sel mingguan MODIS → setara VIIRS S-NPP, 2003–2024, grid 0.5°; type 0, nominal/high.
- **Angka (holdout 2019–2024 vs VIIRS nyata):** total MODIS mentah 0.22–0.27× → harmonized California 0.88×, Amazon 1.01×, Australia utara 0.99×; error mingguan California 1298→381, Amazon 4645→811, Australia 3483→484.
- **Kalender:** tahun × minggu (raw atau vs normal), musim kebakaran (minggu ≥50% puncak), puncak tipikal, tahun tersibuk, URL bisa dibagikan, tema gelap/terang, keyboard.
- **Kelemahan:** hanya 3 region, FRP belum diharmonisasi; jujur soal California −12%.

### B8. Aalvee-Aarham/kiln-watch — "Kiln Watch" (kemungkinan overlap dengan kiln-watch-2026 milik agen lain)
- **Tim/lokasi:** Team Off The Binary, **Bangladesh** (Mymensingh). Ada mirror submission `Aalvee-Aarham/nasaspaceappschallenge-2026-team-off-the-binary` (created 2026-11-13).
- **Created / last push:** 2026-10-05 / 2026-11-13. Ukuran ~39 MB. Live Vercel. **Risiko pre-build: TINGGI.**
- **Metode:** **Aqua MODIS sebagai skala referensi**; rantai NOAA-21→NOAA-20→S-NPP→Aqua (S-NPP dikalibrasi 2012–2020 sebelum orbit Aqua drift), Terra sebagai jembatan 2000–2002; rasio total per bulan kalender, **siang & malam terpisah, di-shrink dengan empirical Bayes**; interval 95% tiap nilai; akhir S-NPP 2 Nov 2026 "terdeteksi dari data".
- **Validasi:** **MODIS-denial test** (kalibrasi 2012–2016, rekonstruksi 2017–2020 dari VIIRS saja): step mentah 3.5–10.6× → harmonized 0.93–1.19×, coverage interval 96%; jujur bahwa Punjab under-correct ~7% dan Paraná Delta +27%.
- **Fitur:** kalender bulan × tahun, globe + outlook 30 hari, early warning (aturan tercetak, bukan forecast), **MCP server 31 tools**, analis Gemini, alert email/n8n, deteksi "likely kilns" di sabuk bata Dhaka.
- **USP:** framing "uji dengan mengambil satelit" + kiln vs vegetation fire.

### B9. jpwxts/VELA — "Vela — Check my land"
- **Tim/lokasi:** tidak dinyatakan; fokus **Filipina** (label barangay → kota → provinsi, zona waktu Asia/Manila, peta FWI ASMC ASEAN).
- **Created / last push:** 2026-11-10 / 2026-11-13. Ukuran ~262 KB. **Risiko pre-build: SEDANG.**
- **Metode:** grid 5 km; estimasi aktivitas mingguan = persentase sel 5 km yang aktif pada hari dengan estimasi valid; NOAA-20/21 harmonized berstatus "calibration pending".
- **Fitur:** gambar/cari lahan → "Check my land"; tab Where is this / Weather outlook (Open-Meteo + GWIS FWI) / Weekly trends / Research; penanda 1 satelit vs 2+ satelit.
- **Inti ide:** UX pemilik lahan yang sangat sederhana untuk SE Asia.
- **Kelemahan:** harmonisasi belum selesai; histori panjang tidak jelas.

### B10. Afiyat-Anjum/NASA-Space-App-Challenge-2026--Team-SkyBound (= AnisSwe/NasaSpaceAppsChallenge2026)
- **Tim/lokasi:** Team SkyBound; fokus **Asia Selatan** (8 negara). README identik di dua repo → mirror.
- **Created / last push:** AnisSwe 2026-10-10 / 2026-11-13; SkyBound 2026-11-12 / 2026-11-13. Ukuran ~21 MB. **Risiko pre-build: TINGGI.**
- **Metode:** grid umum **5.5 km**; MODIS C6.1 + VIIRS S-NPP/NOAA-20/NOAA-21; 11.617.834 deteksi conf ≥50; validasi 5.355 hari overlap: **Pearson r 0.8244 (raw) → 0.8503 (harmonised)** (perbaikan kecil).
- **Stack:** FastAPI + web statis + Streamlit; ada lapisan agen (CLAUDE.md, AGENTS.md).

### B11. Shahriar290900/Harmonisation-MODIS-VIIRS — "Parallax Fire"
- **Tim/lokasi:** Team Lumos, **Dhaka, Bangladesh**.
- **Created / last push:** 2026-10-10 / 2026-11-13. Ukuran ~74 MB. Live Netlify + manual PDF. **Risiko pre-build: TINGGI.**
- **Fitur:** Live Earth three.js dengan posisi nyata Terra/Aqua/S-NPP/NOAA-20/NOAA-21 (CelesTrak) dan matahari nyata; kalender 2001–2025 (Bangladesh + divisi, California, New South Wales); peta 5 km/distrik; "Story" Maret 2024 Bangladesh.
- **Angka (holdout 2023–2024):** rata-rata miss per bulan Bangladesh 98 (raw 627, aturan bulanan sederhana 109); California 794 (raw 2.219); NSW 375 (range terlalu lebar).

### B12. zzaemm/ember — "Ember" (India, Space Apps Kerala)
- **Created / last push:** 2026-11-07 / 2026-11-07. ~5,8 MB. **Risiko: TINGGI.**
- **Metode:** type 0, MODIS conf ≥30, VIIRS n/h; buang spot ~2 km yang aktif Jul–Sep di ≥4 tahun (4% deteksi; sumber statis); koreksi dipelajari & divalidasi; `events.json` berisi alasan/berita yang dicek manual. Statis, offline-friendly.

### B13. ehasanulhaque152/EarthFire
- **Created / last push:** 2026-09-27 / 2026-11-12. ~9,6 MB. Live Render. **Risiko: TINGGI.**
- FastAPI/SQLite + React/Three.js globe; grid harian 0.5°; sinyal statistik + LSTM opsional next-day occupied-cell; ekspor CSV/SVG; alert browser. Penulis mengakui pernyataan challenge "tidak tersedia saat proyek dibuat".

### B14. rid-coder-70/firedna — "FireDNA"
- **Created / last push:** 2026-11-10 / 2026-11-13. ~1,1 MB.
- Asia Selatan (5–40°N, 54–102°E); grid 0.1° harian UTC; 54.070 deteksi nyata (7.532 MODIS + 24.795 NOAA-20 + 21.743 NOAA-21), 19.903 sel, Z-score, 447 event EONET; klaim "0 data sintetis". Orientasi edukasi. Tidak memakai S-NPP.

### B15. ImLWChuen/project-stardust-firewatch — "Project Stardust"
- **Created / last push:** 2026-10-01 / 2026-10-25. ~189 KB. README kerangka (science/pipeline/backend FastAPI/frontend Next.js). Menyebut "agricultural burning calendar". Angka/metode konkret tidak ditemukan.

### Repo Indonesia terkait karhutla (BUKAN entri Space Apps, tetapi pembanding lokal)
- **najnaj20/kalimantan-karhutla** (created 2026-08-21, push 2026-09-16): portofolio analis data; FIRMS VIIRS+MODIS via mirror HDX (tanpa API key), CAMS PM2.5/AQI 34 ibu kota dengan kategori **ISPU**, ENSO ONI, Streamlit + panduan Tableau, bilingual EN/ID. Temuan: Kalteng 17.368 hotspot (56,6%) pada 5–12 Sep 2026, puncak 8.914 deteksi 11 Sep. **Menggabungkan** MODIS+VIIRS tanpa harmonisasi; hanya jendela NRT 7 hari.
- Banyak dashboard karhutla Indonesia lain dibuat Agu–Nov 2026 (mis. `ramaikn/karhutla-watch` — peringkat provinsi, CAMS, berita, prakiraan BMKG; `rizqiadisurya/pantau-karhutla` — hotspot + **perusahaan pemegang konsesi**; `fzrilsh/cegah-karhutla` — arah asap; `rickthor7/peatland-dashboard` — hidrologi gambut + IoT; `RoufielHadi/Analisis-Kebakaran-Hutan-Pulang-Pisau` — tugas besar POLBAN, rekurensi & konsistensi Landsat vs MODIS di Pulang Pisau). Tidak ada yang menyebut Space Apps atau harmonisasi MODIS–VIIRS jangka panjang.

### Pencarian event/tim Indonesia
- WebSearch "NASA Space Apps Challenge 2026 Bandung" dan "Space Apps 2026 Indonesia karhutla": **tidak ditemukan** listing event lokal Bandung 2026 maupun tim Indonesia yang terang-terangan mengerjakan challenge ini. Ditemukan berita 2025: mahasiswa STEI ITB menang 3 kategori Space Apps 2025 (detik.com, stei.itb.ac.id).
- Konteks 2026 dari pencarian: hotspot Indonesia 2026 tinggi lebih awal menjelang "Super El Niño" (Mongabay Jul 2026, Eco-Business); **SiPongi (Kemenhut) memakai MODIS+VIIRS** (946 hotspot 31 Ags 2026) sementara **sistem BRIN hanya VIIRS** (9.587 hotspot confidence tinggi Agustus 2026); asap gambut Indonesia ke Malaysia Sep 2026 (NST); NASA mencatat deteksi MODIS/VIIRS bisa *turun* saat asap tebal/api bawah permukaan gambut.

---

## Tabel perbandingan

| Repo | Inti ide | Metode harmonisasi | Validasi | Fokus wilayah | USP | Kelemahan | Risiko pre-build |
|---|---|---|---|---|---|---|---|
| snslighting/ember-atlas | Atlas + monitor live dengan kalender | k = ΣMODIS cells/ΣVIIRS cells per AOI, H=(M+kV)/2, skala MODIS | Holdout SP >2020 (RMSE, bias) + replay | Uzbekistan, California, Rondônia | Provenance ketat, replay GIBS global | Histori hanya 3–4 area, README internal | TINGGI |
| Thay32-Heng/pyfire-watch | Kalender mingguan terkalibrasi | Median rasio VIIRS/MODIS per bulan, densitas grid 0.1° | Unit test | Kamboja | Toggle sensor 2012 | Data 8 hari | SEDANG-RENDAH |
| nasifnaser06-cyber/Project_S.H.I.F.T | Kalibrasi FRP Florida | OLS FRP: V=0.316·M+24.7 | Scatter saja | Florida | Visual 3D Streamlit | Step 2012 masih ada di data sendiri | TINGGI |
| NIKAIZ-AI/AIEKYA-APEX | Studio visual harmonisasi | α·V^β hardcoded per biome | Unit test | 7 region global (tanpa Indonesia) | Visual orbit/BRDF/SBAF | Data sintetis | SEDANG |
| Vtheonly/NasaSpaceApp2026 | Pipeline ML ber-governance | LightGBM Tweedie MODIS→FRP VIIRS + PatchTST | Kronologis, tapi sintetis | AOI CLI (contoh California) | Rekayasa rapi, 320 tes | Tanpa data nyata, tanpa AOI drawing | TINGGI |
| Mosharrof8097 (EmberSync) | GA per-biome | Clustering + GA radius + quantile mapping FRP | Holdout 30% pasangan | Global 4 biome (8 hari) | Self-calibrating antar satelit | Kalender multi-tahun = proyeksi model | TINGGI |
| ImtiazIftii/NPC_SpaceApps | API kalender per negara | k=ΣM/ΣV bulanan (0.41–0.49), dedup 0.01° | r>0.97, /api/trust | Amerika Selatan, Australia | Metrik musim & tren | k tunggal per negara, tanpa NOAA-20/21 | TINGGI |
| tommyquak/SpaceApps (PeatGuard) | Prioritas sekat kanal gambut (challenge lain) | Tidak ada (fire history sebagai layer) | Benchmark ALOS-2 | Kalimantan Tengah | Narasi gambut Indonesia | Bukan challenge ini | TINGGI |
| usman2ki/SpaceAppChallenge | Framework statistik rigor | Rate-ratio kondisional + bootstrap, skala Aqua | Blocked temporal/spatial holdout, FDR | Sintetis (preset Cerrado) | Kejujuran & ketidakpastian | Belum ada data nyata | SEDANG-TINGGI |
| Kolok2008/zakarpattia-orbit | Kalender lokal + drone | Rasio ΣV/ΣM per bulan kalender + bootstrap; NOAA-20×0.93 | LOYO: MAPE tahunan 9.8% vs 73.8% | Zakarpattia, Ukraina | Drone/ESP32 verifikasi hotspot | Hardware belum diuji, wilayah kecil | TINGGI |
| neilrxthod/Atmolar | Risiko asap untuk pilot | Tidak ada | Tidak ada | Kanada Barat | User niche (aviasi) | Hanya README | RENDAH |
| neilrxthod/Hemolar | — | — | — | — | — | Kosong | RENDAH |
| CatherineMarkowska/modispractice | Pencatat aktivitas bakar | Tidak ada | Tidak ada | Global | Opini ilmuwan | Konsep | RENDAH |
| Husanxon4407/hotsync-practice | Latihan | Exchange rate V/M ≈4.07 | Tidak ada | Uzbekistan | Hapus pabrik | Latihan, ditulis ulang | RENDAH-SEDANG |
| EdisonShiny/eg-firetrack | Borneo → respons operasional | Match ±1 km/±1 h; k per provinsi & musim | LOYO R² (angka tak dipublikasi) | **Borneo (Malaysia + Kalimantan)** | Gambut + BPBD/Manggala Agni playbook | Histori hanya 2017–2026 | TINGGI |
| Warren-530/fire-harmony | Rekor global ML + haze | LightGBM per hexagon-bulan, skala NOAA-20, rentang 90% | Seam/placebo/Pettitt/PELT, Fire_cci | Global + haze Malaysia (Sumatra/Borneo) | PEATMAP, drivers, outlook | Sangat berat | TINGGI |
| Hisernberg/ignis-spaceapps2026 | Mission control + AI | Median rasio bulanan r(m), MODIS×r̄ | Model AUC 0.740 | 9 region + Bangladesh | 11 tab, model HF | Harmonisasi sederhana, feature soup | TINGGI |
| the-aris-club/flare-chronos (+GeoHarmonix) | Harmonisasi berbasis fisika footprint | Scan-angle footprint, H3, QM FRP 2 tahap, effort Ω | KS −69.4%, R² 0.78→0.80 | Mekong, Amazon | Paling "physics-heavy" | Hanya 2 AOI, klon ada | TINGGI |
| squadronzero/project-shift | Rekor global tahan hilangnya S-NPP | Faktor per tile, skala S-NPP, NOAA-20 tie | LOYO, bootstrap, GFED4, cloud | Global, Florida, Bangladesh | Disiplin pra-registrasi | Web belum selesai | TINGGI |
| freefirenoobs/sparkgrid | Dedup real-time | DBSCAN 1.5 km/120 menit | 72 fire dua sensor | Afrika utara/tengah | Live HUD + LLM | Tanpa kalender historis | TINGGI |
| tttamannaanand/burn-calendar | Kalender minggu terkalibrasi | Quantile mapping sel mingguan | Holdout 2019–24 (0.88–1.01×) | California, Amazon, Australia | Sederhana & tervalidasi | 3 region, tanpa FRP | TINGGI |
| Aalvee-Aarham/kiln-watch | Rekor tahan perubahan satelit | Rasio per bulan, siang/malam, empirical Bayes, skala Aqua | MODIS-denial test, CI 96% | 9 region + kiln Dhaka | MCP 31 tools, denial test | Belum koreksi awan | TINGGI |
| jpwxts/VELA | "Check my land" | Persentase sel 5 km aktif; kalibrasi pending | Tidak ditemukan | Filipina | UX pemilik lahan, FWI ASMC | Harmonisasi belum selesai | SEDANG |
| Team-SkyBound / AnisSwe | Kontinuitas Asia Selatan | Grid 5.5 km semua sensor | r 0.824→0.850 | 8 negara Asia Selatan | Cakupan multi-negara | Perbaikan kecil | TINGGI |
| Shahriar290900 (Parallax Fire) | Satu skala jujur + live Earth | Estimasi model (detail di manual) | Holdout 2023–24 | Bangladesh, California, NSW | Satelit real-time 3D | 3 wilayah | TINGGI |
| zzaemm/ember | Kalender India | Koreksi dipelajari + mask statis | validation.json | India | Story/berita per event | Hanya India | TINGGI |
| ehasanulhaque152/EarthFire | Explorer + LSTM | Grid 0.5° | Tidak ditemukan | Region preset | Globe + alert | Challenge statement tidak dibaca | TINGGI |
| rid-coder-70/firedna | Edukasi | Grid 0.1° | Z-score | Asia Selatan | 0 data sintetis | Tanpa S-NPP/arsip panjang | SEDANG |
| ImLWChuen/project-stardust | Kalender bakar pertanian | Tidak ditemukan | Tidak ditemukan | Global | — | Kerangka saja | RENDAH-SEDANG |

---

## Sintesis untuk tim ITB

**Fitur yang sudah jadi komoditas (hampir semua punya):**
- Rasio tunggal k (ΣMODIS/ΣVIIRS atau median rasio bulanan), kadang per bulan/region; quantile mapping semakin umum.
- Grid seragam (0.01°–0.5°), filter `type=0`, MODIS confidence ≥30/40/50, VIIRS nominal/high.
- Heatmap tahun × bulan atau tahun × minggu, z-score/persentil dengan label Normal/Elevated/Critical, "vs median historis".
- AOI bbox/gambar, unduh CSV, peta live NRT, globe 3D, analis LLM/chat, alert email/Telegram/n8n.
- Validasi leave-one-year-out / holdout tahun; narasi "step 2012"; banyak yang sudah menyebut S-NPP berhenti 2 Nov 2026 dan meneruskan dengan NOAA-20.

**Fokus Indonesia/SE Asia/gambut:**
- EG FireTrack (Borneo, Malaysia-sentris tetapi memasukkan BPBD/Manggala Agni/BNPB dan kedalaman gambut) — pesaing paling langsung.
- Fire Harmony (PEATMAP sebagai fitur, haze Sumatra/Borneo → Malaysia) — pesaing sains terkuat.
- PeatGuard (Kalimantan Tengah, challenge lain). VELA (Filipina). pyfire-watch (Kamboja, lemah). flare-chronos (Mekong).
- Tidak ditemukan entri Space Apps dari tim Indonesia untuk challenge ini.

**Yang belum dilakukan siapa pun (peluang):**
1. Kalibrasi k yang **distratifikasi gambut vs mineral** (dan siang vs malam untuk smoldering gambut berenergi rendah). Fire Harmony memakai gambut hanya sebagai fitur ML global, EG FireTrack hanya untuk skor risiko.
2. Koreksi **asap/awan (haze-aware)** pada musim karhutla; NASA sendiri menyatakan count bisa turun saat api memburuk. Belum ada yang memodelkannya untuk SE Asia.
3. Validasi silang dengan **Himawari-8/9 AHI (geostasioner, JAXA)** atau burned area KLHK/MCD64A1 di Kalimantan/Sumatra: tidak ada yang menyebut Himawari.
4. Rekonsiliasi dengan **sistem resmi Indonesia** (SiPongi MODIS+VIIRS vs BRIN VIIRS-only): dua angka resmi yang berbeda adalah persoalan harmonisasi nyata yang belum disentuh siapa pun.
5. Kalender per **kabupaten/desa/KHG (Kesatuan Hidrologis Gambut)** atau konsesi, berbahasa Indonesia, dengan baseline yang dikondisikan ENSO/IOD (El Niño 2015/2019/2023/2026). Fire Harmony punya drivers ONI/DMI, tetapi tidak di tingkat administrasi Indonesia.
