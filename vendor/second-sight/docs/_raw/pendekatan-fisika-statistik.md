# Pendekatan Fisika & Statistik Lanjut: Harmonisasi Hotspot MODIS–VIIRS

> Dokumen riset untuk tim ITB, NASA Space Apps 2026, challenge "Harmonization of MODIS and VIIRS Hot Spots".
> Tujuan: mencari metode yang **berbasis fisika dan statistik yang ketat** untuk kategori "Best Use of Science", tetapi tetap realistis dikerjakan dalam 48 jam.
> Tanggal riset: 13 Nov 2026. Klaim yang belum saya verifikasi langsung dari sumber primer ditandai **[UNVERIFIED]**.
> Angka hasil hitungan saya sendiri (Planck, blackbody, tanpa atmosfer) ditandai **[hitungan sendiri]**.

---

## 0. TL;DR (inti dalam 10 baris)

1. Selisih jumlah hotspot VIIRS:MODIS **bukan konstanta**. Ia fungsi dari (FRP fire, luas pixel atau scan angle, siang atau malam, tutupan awan dan asap, jam lintas satelit). Jadi rasio global tunggal akan bias secara sistematis, terutama di gambut Indonesia.
2. Sudah ada model deteksi yang **terpublikasi dan siap pakai**: *observation operator* Sofiev & Kouznetsov (2026, GMD), dengan batas deteksi `D_p = α·A_pix + β` (logistic sigmoid) per sensor, siang dan malam. Kodenya open source (`github.com/fmidev/FRP_OOp`). Ini fondasi paling defensible untuk "MODIS-equivalent VIIRS".
3. Satuan yang paling tahan terhadap perbedaan sensor adalah **energi (FRP/FRE)**, bukan jumlah pixel. Fire besar mendominasi total FRP, dan fire besar terdeteksi oleh kedua sensor.
4. Koreksi **observation opportunity** (overpass dan awan) sudah punya formula resmi dari produk MODIS CMG (Giglio et al. 2006): `N'' = N' / (1 − f_cloud)`. Layer `CloudPix`/`TotalPix` tersedia.
5. **Seam tersembunyi yang belum dikerjakan kompetitor:** orbit Terra *drift* ke jam lebih pagi sejak 2020 dan Aqua drift ke sore. Akibatnya muncul tren palsu karena fire punya siklus diurnal (Giglio 2007 sudah memperingatkan efek ini pada AVHRR). Koreksi diurnal adalah wow factor sains yang kuat.
6. Gambut: smouldering bersuhu rendah (<~650 K) membuat (a) deteksi MIR lemah, (b) metode FRP MIR *underestimate* (Wooster 2005), dan (c) VIIRS, terutama malam, jauh lebih sensitif. Hipotesis yang bisa diuji tim: **rasio VIIRS:MODIS di gambut > di tanah mineral, dan paling besar pada malam hari.** Ini bisa jadi temuan orisinal.
7. Bukti bahwa harmonisasi berhasil: (i) uji change-point (Pettitt/PELT) di seam 2002, 2012, dan 2020+, dengan *placebo seam*; (ii) LOYO + LORO; (iii) **"simulated MODIS sunset" backtest**; (iv) peringkat tahun ENSO tetap terjaga; (v) korelasi dengan referensi independen (MCD64A1, GFED5, SiPongi). Semua disajikan sebagai tabel ablation M0–M5.

---

## 1. Fisika deteksi active fire

### 1.1 Planck: kenapa 4 µm, bukan 11 µm

Radiansi spektral blackbody:

```
B_λ(T) = c1 / ( λ^5 · (exp(c2/(λT)) − 1) )
c1 = 1.191×10^8 W µm^4 m^-2 sr^-1 ,  c2 = 14 388 µm·K
```

Hukum Wien `λ_max = 2898/T µm`. Fire 800–1200 K memuncak di ~2.4–3.6 µm, sedangkan permukaan 300 K memuncak di ~9.7 µm. Di 4 µm, radiansi naik sangat curam terhadap T (rezim Wien), sedangkan di 11 µm hampir linier (rezim Rayleigh-Jeans).

Rasio radiansi fire terhadap background 300 K **[hitungan sendiri]**:

| T fire | B(3.96 µm,T)/B(3.96 µm,300K) | B(11 µm,T)/B(11 µm,300K) |
|---|---|---|
| 500 K (smouldering dingin) | ~127× | ~6× |
| 600 K | ~427× | ~10× |
| 800 K | ~1 960× | ~19× |
| 1000 K (flaming) | ~4 940× | ~29× |

Konsekuensinya: fire yang hanya menutupi 0.1% pixel sudah menaikkan brightness temperature (BT) 4 µm puluhan kelvin, sementara BT 11 µm hampir tidak berubah. Contoh dari Wooster et al. (2005): fire 800 K dengan fraksi 0.001 di atas background 300 K menaikkan BT MIR >30 K tetapi BT TIR <1.5 K. Karena itu `ΔT = T4 − T11` adalah detektor yang sangat sensitif, dan ini dasar semua algoritma contextual (MODIS MOD14/MYD14, VIIRS VNP14IMG).

### 1.2 Sub-pixel fire: fraksi × temperatur → sinyal

Model campuran dua komponen:

```
L4  = p·B4(Tf)  + (1−p)·B4(Tb)
L11 = p·B11(Tf) + (1−p)·B11(Tb)
p = A_fire / A_pix
```

Inilah inti perbedaan MODIS dan VIIRS: untuk fire yang sama, `p` di VIIRS (375 m, A_pix ≈ 0.14 km² di nadir) **~7× lebih besar** daripada di MODIS (1 km² di nadir).

Kenaikan BT akibat fire sub-pixel, background 300 K **[hitungan sendiri, blackbody, tanpa atmosfer]**:

| Sensor / posisi | A_pix (km²) | Fire | FRP (MW) | ΔBT4 (K) | ΔBT11 (K) |
|---|---|---|---|---|---|
| MODIS nadir | 1.00 | 100 m², 1000 K | 5.7 | +10.3 | +0.19 |
| MODIS edge (55°) | 9.66 | 100 m², 1000 K | 5.7 | +1.2 | +0.02 |
| VIIRS nadir | 0.14 | 100 m², 1000 K | 5.7 | +42.6 | +1.33 |
| VIIRS edge (56°) | 0.62 | 100 m², 1000 K | 5.7 | +15.2 | +0.30 |
| MODIS nadir | 1.00 | 1000 m², 600 K (gambut) | 7.3 | +9.1 | +0.60 |
| VIIRS nadir | 0.14 | 1000 m², 600 K (gambut) | 7.3 | +39.0 | +4.2 |
| MODIS nadir | 1.00 | 100 m², 600 K | 0.7 | +1.0 | +0.06 |
| VIIRS nadir | 0.14 | 100 m², 600 K | 0.7 | +6.7 | +0.43 |

Pelajaran: fire dengan FRP yang **sama** bisa jelas terdeteksi oleh VIIRS nadir tetapi tidak terlihat oleh MODIS di tepi swath. Perbedaannya hampir dua orde besaran ΔBT4. Inilah dasar fisika untuk menyatakan bahwa harmonisasi harus bergantung pada `A_pix` (scan angle), bukan hanya pada sensor.

### 1.3 Metode bi-spektral Dozier (1981)

Dua persamaan di atas (L4 dan L11) dengan dua unknown (`p`, `Tf`) bisa diselesaikan secara numerik (Dozier 1981). Masalahnya, sinyal di 11 µm sangat kecil, sehingga hasilnya sangat sensitif terhadap noise dan variasi background. Giglio & Kendall (2001) menunjukkan metode ini baru layak jika fraksi fire `p > 0.005` (dikutip di Wooster et al. 2005). Implikasi untuk tim: **jangan** mencoba me-retrieve suhu fire per pixel dari FIRMS. Gunakan FRP metode MIR (yang sudah tersedia di CSV).

### 1.4 FRP: metode MIR radiance (Wooster 2003), dipakai MODIS C6 dan VIIRS

Giglio et al. (2016) Eq. 16, dipakai sejak MODIS Collection 6:

```
FRP = (A_pix · σ / (τ4 · a)) · (L4 − L̄4_background)
σ = 5.6704×10^-8 W m^-2 K^-4
a = 3.0×10^-9 W m^-2 sr^-1 µm^-1 K^-4 (MODIS; Wooster et al. 2003)
τ4 = 1 di produk Level-2 (tanpa koreksi atmosfer)
```

Catatan penting (terverifikasi):
- Dibanding C5 (rumus empiris Kaufman 1998), FRP C6 **rata-rata ~16% lebih rendah** (mean 56.9 → 47.7 MW untuk pixel yang sama). Jangan mencampur koleksi (Giglio et al. 2016).
- Pendekatan MIR akurat ±12% hanya untuk suhu emitter **665–1365 K**. Di bawah ~650 K (smouldering) FRP **makin underestimate** (Wooster et al. 2005, Fig. 2). Ini langsung relevan untuk gambut, lihat §3. **[hitungan sendiri]**: pada 600 K, FRP MIR ≈ 0.54 MW vs FRP sebenarnya 0.73 MW, sekitar −26%.
- Ketidakpastian FRP MODIS per pixel ≈ 26.6% (1σ), turun ke <~5% untuk agregat >~50 pixel. Sumbernya posisi fire dalam point spread function, bukan scan angle (Freeborn et al. 2014). Jadi FRP harus dianalisis dalam bentuk **agregat**, bukan per pixel.
- **VIIRS 375 m:** FRP dihitung dari kanal **M13 (750 m, dual-gain)** karena I4 sering saturasi. Jika satu pixel M13 berisi dua pixel fire 375 m, FRP dibagi rata (`FRP_i = FRP/2`) (VIIRS C2 AF 375m User Guide v1.2). Akibatnya FRP per pixel VIIRS adalah *fractional*. Jangan membandingkan histogram FRP per pixel VIIRS vs MODIS secara mentah. Bandingkan **jumlah FRP per sel grid atau per cluster**.

### 1.5 Algoritma contextual dan threshold (terverifikasi dari ATBD/paper)

**MODIS C6 (Giglio et al. 2016):**
- Potential fire: `T4 > T4*` dan `ΔT > ΔT*`, dengan threshold **dinamis**. `T4* = mean(T4)_large-window + 5 K`, dibatasi 300–330 K. `ΔT* = mean(ΔT) + 5 K`, dibatasi 10–35 K. Pada C5 nilainya tetap: 310 K (305 K malam) dan 10 K.
- Fire absolut: `T4 > 360 K` (320 K malam).
- Tes contextual terhadap background (mean ± MAD) di jendela adaptif, ditambah tes penolak sun glint, batas gurun, dan forest clearing. Tes forest clearing baru di C6 penting untuk tropis: pixel ditolak jika `T11 > T̄11 + 3.7δ11`, `ρ0.86 > 0.28`, dan `T4 < 325 K`.
- C6 memperbaiki omisi fire besar yang tertutup asap tebal (C5 kadang salah mengklasifikasikan asap sebagai awan). Ini relevan untuk 2015.
- Saturasi: kanal 21 (low gain) saturasi di ~500 K, kanal 22 (high gain) jauh lebih rendah. Wooster et al. (2005) menyebut kanal 21 ~500 K. Nilai kanal 22 yang sering dikutip ~331 K **[UNVERIFIED]**.
- Data Terra sebelum **Nov 2000** bermasalah dan sebaiknya dibuang dari analisis time series (Giglio et al. 2016).

**VIIRS 375 m VNP14IMG (Schroeder et al. 2014):**
- I4 (3.74 µm) **saturasi di 367 K**, I5 (11.45 µm) saturasi di 380 K, M13 dual-gain dengan saturasi tinggi (~634 K).
- Malam, fire tak ambigu: `BT4 > 320 K` dengan QF4 = 0.
- Kandidat: siang `BT4 > BT4s` (325–330 K) atau `ΔBT45 > 25 K`. Malam `BT4 > 295 K` dan `ΔBT45 > 10 K`.
- Contextual siang: `ΔBT45 > ΔBT45b + 2δ`, `ΔBT45 > ΔBT45b + 10 K`, `BT4 > BT4b + 3.5δ4b`, `BT5 > BT5b + δ5b − 4` atau `δ'4 > 5`. Malam: `+3δ`, `+9 K`, dan `BT4 > BT4b + 3δ4b`.
- Saturasi dan *folding* (BT4 = 208 K) ditangani dengan tes khusus. Di produk akhir, pixel saturasi menjadi kelas *high confidence* (9).
- Kurva 50% detection probability teoretis (Schroeder 2014, Fig. 4): malam, fire ~1000 K cukup beberapa puluh m², dan bonfire berjari-jari 1.25 m (~5 m²) terdeteksi pada scan 32.7°. Siang, perlu ~50–100 m² pada 800–1000 K (dibaca dari grafik, perkiraan).
- Rasio deteksi vs VIIRS 750 m: **3× siang, 25× malam** (Schroeder 2014). Ini analog dengan kesenjangan vs MODIS 1 km.

**MODIS (User Guide C6/6.1):** "routinely" mendeteksi fire flaming maupun smouldering seluas ~1000 m². Pada kondisi sangat baik (nadir, sedikit asap) bisa ~100 m², dan pada kondisi ideal (langka) ~50 m² (MOD14 User Guide V61, §8.3.2).

### 1.6 Geometri pixel: scan angle, bow-tie, aggregation

**MODIS** (rumus Ichoku & Kaufman 2005, dari MOD14 User Guide):

```
S (along-scan) = Re·s·( cosθ / sqrt((Re/r)² − sin²θ) − 1 )
T (along-track) = r·s·( cosθ − sqrt((Re/r)² − sin²θ) )
Re = 6378.137 km, h = 705 km, r = Re+h, s = 0.0014184397
θ = s · (sample − 676.5)          [sample dari MCD14ML]
```

Luas pixel MODIS 1 km² di nadir naik ke **9.66 km² di tepi (55°)**. Sekitar 40% swath punya A_pix < 2 km², dan hanya ~20% yang > 6 km² (Sofiev & Kouznetsov 2026).

**VIIRS I-band**: aggregation on-board 3:1 (0–31.7°), 2:1 (31.7–44.9°), 1:1 (>44.9°), plus bow-tie deletion. Pixel tumbuh dari 383×360 m di nadir ke **795×784 m di 56.28°**, kira-kira ×4.5 luasnya, jauh lebih stabil daripada MODIS yang ×9.7 (Schroeder 2014). Bow-tie residual ditandai di QA bit 22 VNP14IMG (User Guide C2). Di CSV FIRMS, kolom `scan` dan `track` (km) memberikan dimensi pixel, sehingga **`A_pix ≈ scan × track`** bisa dihitung langsung per deteksi. Fitur ini gratis dan jarang dimanfaatkan.

### 1.7 Batas deteksi & probabilitas deteksi kuantitatif (sumber utama)

**Sofiev & Kouznetsov (2026), GMD 19:10123–10142.** Paper ini paling penting untuk tim karena dibangun dari ~90 juta deteksi MODIS dan VIIRS:
- Distribusi FRP per luas pixel memotong di sisi kiri mengikuti **logistic sigmoid**. Titik tengah sigmoid `D_p` (FRP yang ~50% terlewat) adalah **fungsi linier luas pixel**: `D_p = α_lst·A_p + β_lst`, dengan r > 0.999. Kemiringan sigmoid `r_p` adalah fungsi hiperbolik dari `A_p`.
- Observation operator per pixel:
  `P_obs = P · max(0, 1/(1+exp(−r_p(P − D_p))) − c0) / (1 − c0)`
  dengan koefisien terpisah untuk MODIS/VIIRS × siang/malam (Table 1–2 paper).
  Ekstraksi teks PDF saya menghasilkan: MODIS siang α=4.44, β=0.52; malam α=4.43, β=1.01. VIIRS siang α=6.17, β=1.44; malam α=1.38, β=0.35; c0 ≈ 0.045–0.05. **[UNVERIFIED: tata letak tabel rusak saat ekstraksi. Ambil koefisien langsung dari Table 1–2 atau repo `fmidev/FRP_OOp`.]**
- Angka ringkasan (Conclusions): batas deteksi MODIS C6.1 **5.7 MW (siang) / 3.7 MW (malam)** untuk pixel terkecil (tengah swath), naik ke **~42/39 MW** di tepi swath. VIIRS C2: **3.7 MW (siang) / ~0.5–0.7 MW (malam)**.
- Per luas pixel yang setara (~1 km²), VIIRS ~3× lebih sensitif dari MODIS pada malam hari tetapi ~25% *kurang* sensitif pada siang hari. Keunggulan VIIRS di siang hari datang dari **pixel yang lebih kecil**. VIIRS mendeteksi "hampir empat kali lebih banyak fire kecil" daripada MODIS.
- **Probability of detection global untuk fire kuat: MODIS 78%, VIIRS 88%.** Di sebagian kawasan ekuatorial (awan), nilainya <30% (MODIS) dan <40% (VIIRS). Omisi bisa >60% untuk MODIS di sebagian kawasan ekuatorial. Indonesia hampir pasti masuk kategori ini **[UNVERIFIED: cek peta global PoD di paper]**.
- Paper ini juga menyediakan prosedur **cross-mapping simetris MODIS↔VIIRS** (Sec. 3.5): proyeksikan setiap fire VIIRS ke granule MODIS dan terapkan operator MODIS, lalu sebaliknya. Ini persis "MODIS-equivalent simulation" yang kita butuhkan, **dengan referensi peer-reviewed**.
- Pengaruh asap dan awan tipis: `P_mdl* = P_mdl · exp(−τ4)`, dengan τ4 = AOD di 4 µm.

**Pembanding lama:** Maier et al. (2013, Australia, C5): fire <3.6 MW tidak pernah terdeteksi. FREEVAL/Schultz et al. (2008): ambang C4 ~7–10 MW per km². Keduanya dikutip di Sofiev 2026.

**Li et al. (2018, JGR):** VIIRS 750 m vs Aqua MODIS. Di skala benua, FRP sebanding dan berkorelasi kuat. Di grid 1°, beda rata-rata ~20% di wilayah rawan api. Di level **cluster**, nilainya sangat sebanding (kecuali boreal, di mana VIIRS ~47% lebih kecil).
**Li, Zhang & Kondragunta (2020, Remote Sensing):** dengan VIIRS 375 m sebagai acuan di Afrika, MODIS melewatkan banyak fire intensitas rendah, sehingga FRP harian MODIS *underestimate* ≥42.8%. Aqua dan S-NPP melintas dengan selisih <50 menit.

### 1.8 Siang vs malam

- Malam: background homogen dan tanpa komponen pantulan matahari di 4 µm, sehingga ambang deteksi jauh lebih rendah (VIIRS malam ~0.5–0.7 MW).
- Siang: pantulan matahari di 4 µm (lebih besar di I4 3.74 µm daripada di M13/MODIS ~3.96 µm, sekitar 3× menurut Schroeder 2014) membuat background lebih bising.
- Implikasi: **rasio VIIRS:MODIS harus dimodelkan terpisah untuk siang dan malam.** Kolom `daynight` di FIRMS wajib dipakai.

---

## 2. Ide harmonisasi berbasis fisika dan statistik

Format per ide: **Rasional fisik → Formula/sketsa → Data → Feasibility 48 jam → Demo → Sitasi.**

### (a) "MODIS-equivalent VIIRS": degradasi VIIRS ke detektabilitas MODIS ★★★

- **Rasional:** kita tidak bisa menciptakan fire kecil yang tidak pernah dilihat MODIS (2000–2011). Yang bisa dilakukan adalah **menurunkan** VIIRS (2012+) ke "apa yang akan dilihat MODIS". Hasilnya adalah satu seri 2000–sekarang dalam "mata uang MODIS" yang konsisten untuk analisis tren dan anomali.
- **Sketsa algoritma (per hari, per overpass siang dan malam terpisah):**
  1. Agregasikan FRP VIIRS ke sel ~1 km (grid tetap, atau "pseudo-MODIS footprint"): `F_cell = Σ FRP_i`. Ingat FRP VIIRS bersifat fractional (§1.4), jadi menjumlahkannya aman.
  2. Ambil luas pixel MODIS `A` dari distribusi geometri swath Aqua (Sofiev Fig. 1). Jika memakai pairing hari yang sama, ambil `A` dari scan/track deteksi MODIS terdekat.
  3. Probabilitas deteksi: `P_det(F_cell, A) = σ(r(A)·(F_cell − D_p(A)))`, dengan `D_p = α·A + β`.
  4. Count MODIS-equivalent: `E[N] = Σ_cells ∫ P_det(F_cell, A) p(A) dA`. Integral bisa dihitung dengan Monte Carlo 100 sampel `A`. Variansnya `Σ P(1−P)` memberi **interval ketidakpastian fisik**, bukan sekadar statistik.
  5. Koreksi awan: kalikan dengan `(1 − f_cloud,Aqua)/(1 − f_cloud,VIIRS)`, atau asumsikan sama karena overpass berselisih <50 menit (Li 2020).
- **Validasi intrinsik:** pada periode overlap 2012–2025, `E[N_MODIS-eq]` harus cocok dengan count Aqua MODIS aktual. Ini memberi angka r, bias, dan KGE tanpa fitting, karena operatornya dikalibrasi *global* oleh pihak lain (Sofiev) dan diuji *lokal* oleh kita. Ini argumen "out-of-sample" yang sangat kuat di depan juri.
- **Data:** FIRMS archive VIIRS (SNPP/NOAA-20) + MODIS C6.1 dengan kolom `frp, scan, track, daynight, acq_time`, ditambah koefisien Sofiev.
- **Feasibility:** **Medium.** Inti kodenya ~150 baris Python (numpy/pandas). Yang memakan waktu adalah memastikan koefisien benar dan mengatasi FRP=0 (saturasi M13).
- **Demo:** slider "lihat VIIRS dengan mata MODIS". Peta titik VIIRS dengan opacity = `P_det`, plus kurva sigmoid interaktif per scan angle.
- **Sitasi:** Sofiev & Kouznetsov 2026; Schroeder et al. 2014; Giglio et al. 2016.

### (b) Harmonisasi dengan ambang FRP bersama (common FRP floor) ★★★

- **Rasional:** di atas FRP tertentu, kedua sensor mendeteksi dengan probabilitas mendekati 1. Jika hanya fire di atas ambang itu yang dihitung, artefak resolusi hilang. Ini analog dengan "magnitude of completeness" dalam katalog gempa.
- **Formula:** pilih `F* ≥ max_A D_p^MODIS(A) + k/r` untuk rentang scan yang dipakai. Contoh: batasi `|θ| ≤ 30–40°` (Giglio et al. 2006 membuang pixel >40° saat menghitung FRP CMG). Hitung `N(F ≥ F*)` untuk MODIS per pixel, dan untuk VIIRS **setelah agregasi ke sel ~1 km** (wajib, karena 1 pixel MODIS ≈ 7 pixel VIIRS dan FRP VIIRS fractional).
- **Pemilihan F* berbasis data:** plot rasio `N_VIIRS(≥F)/N_MODIS(≥F)` sebagai fungsi F di periode overlap. Rasio akan turun dan mendatar mendekati ~1 di atas F*. Titik datarnya adalah ambang yang dipilih. Grafik ini sangat mudah dibaca juri.
- **Trade-off:** fire kecil dan gambut smouldering terbuang, sehingga seri bagian ini *bukan* total aktivitas. Sajikan sebagai indeks "large-fire activity" yang paling homogen.
- **Data:** FIRMS saja. **Feasibility: tinggi (beberapa jam).**
- **Sitasi:** Sofiev & Kouznetsov 2026; Giglio et al. 2006; Maier et al. 2013.

### (c) FRP → FRE → konsumsi bahan bakar (kuantitas sensor-agnostik) ★★

- **Rasional:** energi yang dipancarkan adalah besaran fisik, bukan artefak resolusi. Total FRP didominasi fire besar yang terdeteksi kedua sensor, sehingga selisih sensor jauh lebih kecil daripada untuk count. Di level cluster FRP MODIS≈VIIRS (Li et al. 2018).
- **Formula:**
  `FRE = ∫ FRP(t) dt`. Dari 2–4 sampel per hari, FRE didapat dengan model diurnal (lihat e): `FRE_day ≈ FRP_obs(t_obs) · ∫f(t)dt / f(t_obs)`.
  `Fuel consumed (kg) = 0.368 (±0.015) kg/MJ × FRE (MJ)` (Wooster et al. 2005, Eq. 14. Rentang literatur 0.368–0.453 kg/MJ: Freeborn 2008, Kremens 2012).
- **Peringatan gambut:** FRP MIR *underestimate* <650 K, dan sebagian besar energi gambut smouldering tak terlihat. Konversi FRE→bahan bakar untuk gambut perlu faktor jauh lebih besar. GFAS memakai faktor khusus untuk gambut, tetapi nilainya belum saya cek **[UNVERIFIED: cek Kaiser et al. 2012, Biogeosciences 9:527]**. Untuk 2015, Wooster et al. (2018) memakai FRP geostasioner (Himawari) dan emission factor lapangan: 358 Tg bahan bakar, 23–34% di bawah GFED4.1s/GFAS. Jadi label yang aman di UI adalah **"radiated fire energy"**, bukan "carbon emitted".
- **Feasibility:** **tinggi** untuk ΣFRP harian; **medium** untuk FRE dengan model diurnal.
- **Demo:** kalender "energi api" (GJ per hari) berdampingan dengan kalender count. Tunjukkan bahwa seam 2012 pada ΣFRP jauh lebih kecil daripada pada count.
- **Sitasi:** Wooster et al. 2003, 2005; Freeborn et al. 2014; Li et al. 2018, 2020; Vermote et al. 2009; Ellicott et al. 2009.

### (d) Normalisasi per luas area teramati ★★

- **Rasional:** satu deteksi MODIS di tepi swath mewakili area ~10× lebih luas daripada di nadir. Count mentah mencampur "jumlah fire" dengan "luas yang disampling".
- **Formula:** fire pixel density `ρ = N_fire / Σ A_pix,observed` (per km² yang benar-benar teramati, clear-sky). Alternatif yang lebih sederhana: **burned-pixel-area equivalent** `Σ A_pix` dari pixel fire (scan×track). Perlu dicatat: `Σ A_pix` justru makin dipengaruhi resolusi. Yang tepat adalah membagi count dengan area teramati, bukan menjumlah luas pixel fire.
- **Data:** area teramati butuh fire mask L2/L3 (lihat e). Jika hanya FIRMS, hanya bisa membuat koreksi parsial (bobot scan angle).
- **Feasibility: medium.**
- **Sitasi:** Giglio et al. 2006 (normalisasi luas sel dan ekspektasi cakupan ekuatorial).

### (e) Normalisasi observation opportunity + koreksi siklus diurnal ★★★ (wow factor utama)

**(e1) Overpass dan awan, dengan formula resmi produk MODIS CMG (Giglio, Csiszar & Justice 2006, JGR):**

```
N'_fire(i,j,t)  = N_fire · [ N_eq · N_days(t) · A(i)/A_eq ] / N_total(i,j,t)     (overpass-corrected)
f_cloud(i,j,t)  = N_cloud / N_total
N''_fire(i,j,t) = N'_fire / (1 − f_cloud)                                     (cloud-and-overpass corrected)
```

- Layer **`CorrFirePix`, `CloudCorrFirePix`, `MeanCloudFraction`, `RawFirePix`, `CloudPix`, `TotalPix`, `MeanFRP`** tersedia di MOD14CMQ/MYD14CMQ (0.25°, bulanan, juga 8-harian; MOD14 User Guide V61 Table 9). Sumbernya SFTP Univ. Maryland. Kredensial publik yang umum dipakai `fire`/`burnt` **[UNVERIFIED]**.
- Asumsi koreksi awan: densitas fire di bawah awan = di area cerah. Asumsi ini **tidak realistis di bawah awan hujan** sehingga koreksi bisa *overestimate*. Giglio 2006 menemukan koreksi menaikkan count ~20% tetapi tidak mengubah musiman. Untuk Indonesia, sebaiknya kembangkan dengan pembobotan "awan tidak hujan" memakai presipitasi (CHIRPS/IMERG). Ini peningkatan yang memang disarankan Giglio 2006 sendiri.
- Untuk VIIRS: ada VNP14A1 (daily 1 km L3, dari kanal 750 m) dengan FireMask yang memuat kelas awan. Keberadaan produk CMG VIIRS 375 m **[UNVERIFIED]**. Pendekatan praktis: pakai `f_cloud` dari Aqua MYD14CMQ sebagai proxy awan VIIRS (overpass berselisih <50 menit).
- **Satuan baru yang lebih jujur:** "deteksi per *valid clear-sky overpass*". Satuan ini juga otomatis menangani penambahan satelit (SNPP → +NOAA-20 2018 → +NOAA-21 2023 → SNPP berhenti). Catalog VNP14 menyebut produk SNPP berhenti dikirim **2 Nov 2026**, dan status ini perlu dicek ke agent "mission status".

**(e2) Siklus diurnal dan jam lintas:**
- Terra lintas ~10:30, Aqua dan VIIRS ~13:30 (nominal). Di tropis ~90% fire pixel MODIS terdeteksi pada overpass siang, dan selisih Terra vs Aqua terutama mencerminkan siklus diurnal (Giglio 2006).
- Giglio (2007, RSE 108:407): puncak pembakaran di semua region tropis jatuh antara **13:00–18:30** waktu lokal, lebih awal untuk region berhutan lebat. Paper ini secara eksplisit memperingatkan bahwa **perubahan jam sampling bisa menghasilkan tren palsu yang sangat besar** (kasus AVHRR).
- **Seam tersembunyi yang belum ditangani kompetitor:** Terra *drifting* ke jam lebih pagi sejak 2020 (diturunkan ~5 km pada Okt 2022). Halaman Terra menampilkan MLT 8:32 (diupdate Nov 2026) sekaligus angka 9:59 di grafik, jadi nilai persisnya **[UNVERIFIED]**. Aqua drifting ke sore (~15:30 pada pertengahan 2026, diproyeksikan; passivation dijadwalkan 4 Nov 2026 **[UNVERIFIED final]**). LAADS menyebut pengumpulan data sains Aqua MODIS dihentikan ~Agt 2026 dan Terra ~Jan 2027 **[UNVERIFIED; konfirmasi ke agent mission-status]**. Implikasinya: count Terra pasca-2020 turun bukan karena fire berkurang tetapi karena Terra melihat pada jam yang lebih "sepi api". Ini **artefak yang bisa dibuktikan secara kuantitatif**.
- **Model diurnal (Vermote et al. 2009; Ellicott et al. 2009):** fungsi Gaussian + baseline, `f(t) = b + exp(−(t − h)²/(2s²))`. Parameternya dikalibrasi dari rasio Terra/Aqua jangka panjang, atau lebih baik dari **Himawari-8/9 AHI** (10 menit, sejak Jul 2015, cakupan Indonesia; Xu et al. 2017. AHI kurang sensitif terhadap fire kecil sehingga lebih cocok untuk *bentuk* siklus daripada count absolut). Andela et al. (2015, ACP) menunjukkan bahwa mengabaikan siklus diurnal membuat FRE overestimate, dan merekomendasikan siklus diurnal yang bervariasi per region.
- **Koreksi:** `N_corr = N_obs(t_obs) · f(t_ref)/f(t_obs)`, dengan `t_ref = 13:30` (standar Aqua/VIIRS). `t_obs` diambil per deteksi dari `acq_time` UTC dikonversi ke local solar time (`LST = UTC + lon/15`). Ini juga menyelesaikan seam **Terra-only (Nov 2000–Jun 2002) → Terra+Aqua**, yang di repo kompetitor ditangani dengan rasio empiris.
- **Feasibility:** **tinggi** untuk e1 dengan CMG bulanan (unduh ~300 file kecil 0.25°, subset Indonesia). **Medium** untuk e2 dengan parameter diurnal dari rasio Terra/Aqua 2003–2019. **Medium-tinggi** jika memakai Himawari (data besar, sebaiknya dihindari dalam 48 jam kecuali ada produk FRP Himawari siap pakai).
- **Demo:** grafik "jam lintas Terra vs waktu" ditumpuk dengan "count Terra/Aqua". Juri akan melihat penurunan Terra mengikuti drift orbit, bukan iklim. Lalu tampilkan versi terkoreksi yang menghapus tren palsu tersebut.
- **Sitasi:** Giglio et al. 2006; Giglio 2007; Vermote et al. 2009; Ellicott et al. 2009; Andela et al. 2015; Xu et al. 2017; NASA Terra & LAADS MODIS-to-VIIRS transition pages.

### (f) Bayesian hierarchical / partial pooling untuk rasio kalibrasi ★★★

- **Rasional:** rasio per region×bulan yang diestimasi sendiri-sendiri sangat bising di sel dengan sedikit fire (dan akan meledak pada sel "MODIS = 0"). Partial pooling meminjam kekuatan dari region atau bulan lain dan menghasilkan **credible interval** yang jujur.
- **Versi cepat (closed-form, gamma–Poisson empirical Bayes, ±1 jam kerja):**
  `V_rm | M_rm ~ Poisson(θ_r · M_rm)`, prior `θ_r ~ Gamma(a, b)`. Hyperparameter (a, b) diestimasi dengan method of moments atau MLE marginal (negative binomial) lintas region.
  Posterior: `θ_r | data ~ Gamma(a + Σ_m V_rm , b + Σ_m M_rm)`. CI 90% didapat langsung dari kuantil Gamma. Region dengan data sedikit akan "ditarik" ke rata-rata global, ini yang disebut shrinkage.
- **Versi penuh (PyMC/bambi, ±setengah hari):**
  `log E[V_rmd] = log E[M_rmd] + μ + u_region + v_month + w_daynight + γ·peat + δ·log(f_clear) + …`
  dengan likelihood NegBin (overdispersi), `u ~ N(0, σ_u)`, dan seterusnya. Koefisien `γ` (efek gambut) dan `w` (siang/malam) **bisa diinterpretasi secara fisik**, misalnya "rasio di gambut 1.8× [CI 1.5–2.2] lebih tinggi dari mineral", angka yang ilustratif dan **belum dihitung**.
- **Feasibility:** cepat = **tinggi**; penuh = **medium**.
- **Demo:** forest plot rasio per provinsi dengan CI, menunjukkan provinsi sedikit data menyusut ke rata-rata.
- **Sitasi:** Gelman et al., *Bayesian Data Analysis* 3rd ed. (2013); untuk precedent kalibrasi regional active-fire→BA lihat Giglio et al. 2010 (Biogeosciences 7:1171).

### (g) Change-point / break detection untuk MEMBUKTIKAN seam hilang ★★★

- **Rasional:** klaim "seam 2012 hilang" harus diuji secara statistik, bukan sekadar "terlihat mulus".
- **Metode:**
  - **Pettitt (1979)**, uji non-parametrik satu break: `U_t = Σ_{i≤t} Σ_{j>t} sgn(x_j − x_i)`, `K = max|U_t|`, `p ≈ 2·exp(−6K²/(n³+n²))`.
  - **PELT (Killick et al. 2012, JASA)**, banyak break dengan penalti (BIC/MBIC). Paket `ruptures` (Python) atau `changepoint` (R).
  - **BFAST (Verbesselt et al. 2010, RSE)**, dekomposisi tren + musim + break. Ada versi Python `bfast` **[UNVERIFIED maturity]**, jadi lebih aman pakai R.
  - **SNHT relatif (Alexandersson 1986)**, standar homogenisasi iklim yang **memakai seri referensi**.
- **Kunci desain:** jangan menguji seri harmonized secara langsung, karena El Niño 2015 adalah *break nyata*. Uji **seri rasio terhadap referensi**:
  `z_t = log(H_t) − log(R_t)`, dengan `R_t` sebagai referensi kontinu: (i) seri **Aqua MODIS saja** (kontinu melewati 2012), (ii) MCD64A1 burned area, atau (iii) prediksi model iklim (presipitasi/ENSO). Break di `z_t` tepat di 2012 berarti artefak sensor. Ini analog dengan homogenisasi stasiun iklim terhadap stasiun tetangga.
  - **Placebo seams:** uji tanggal tanpa event satelit untuk mendapat distribusi nol (fire-harmony sudah melakukan ini, jadi kita harus melampauinya dengan seri rasio referensi dan semua seam nyata).
  - **Daftar seam nyata yang diuji:** Nov 2000 (Terra mulai), Jul 2002 (Aqua masuk), Jan 2012 (SNPP VIIRS), 2018 (NOAA-20), 16 Agt–2 Sep 2020 (outage FMU Aqua, MOD14 User Guide §7.2.4), 2020+ (drift Terra), 2022+ (drift Aqua), 2023 (NOAA-21), akhir 2026 (SNPP/Aqua berhenti).
- **Metrik "seam magnitude":** `Δ_seam = mean(z)_{12 bln sesudah} − mean(z)_{12 bln sebelum}`, dengan CI dari bootstrap blok.
- **Feasibility: tinggi** (Pettitt + PELT ±2 jam).
- **Sitasi:** Pettitt 1979 (Appl. Stat. 28:126, doi:10.2307/2346729); Killick et al. 2012 (doi:10.1080/01621459.2012.737745); Verbesselt et al. 2010 (doi:10.1016/j.rse.2009.08.014); Alexandersson 1986 (doi:10.1002/joc.3370060607).

### (h) Uji tren: Theil–Sen + Mann–Kendall (modified) ★★

- **Rasional:** tren pada seri tak-harmonized didominasi seam 2012 (lonjakan palsu). Setelah harmonisasi, tren harus mencerminkan perubahan nyata (misal penurunan global burned area, Andela et al. 2017).
- **Metode:** Theil–Sen slope `β = median((x_j − x_i)/(t_j − t_i))` (Sen 1968), Mann–Kendall dengan koreksi autokorelasi (Hamed & Rao 1998), dihitung pada **anomali tahunan** atau total musim kebakaran (Jul–Nov).
- **Demo kuat:** tabel slope dan p-value untuk M0 (raw) vs M5 (physics). Raw kemungkinan memberi "tren naik signifikan" yang ternyata artefak, sementara harmonized tidak. Hasil aktualnya **belum dihitung** dan harus diuji, jangan diasumsikan.
- **Catatan:** seri Indonesia didominasi ENSO (2015, 2019, 2023), sehingga tren lemah dan noise besar. Laporkan juga tren *setelah* meregresikan Niño3.4/DMI.
- **Feasibility: tinggi** (`pymannkendall`, `scipy.stats.theilslopes`).
- **Sitasi:** Sen 1968 (doi:10.1080/01621459.1968.10480934); Hamed & Rao 1998 (doi:10.1016/S0022-1694(97)00125-X); Andela et al. 2017 (Science, doi:10.1126/science.aal4108).

### (i) Event-based counting (cluster spasio-temporal) ★★

- **Rasional:** satu fire besar = 1 pixel MODIS tetapi bisa 5–10 pixel VIIRS. Dengan menghitung **event** (cluster), ketergantungan pada resolusi sangat berkurang. Schroeder (2014, Fig. 7) menunjukkan cluster VIIRS 375 m vs 750 m: banyak cluster 375 m berpasangan dengan 1–2 pixel 750 m. Li et al. (2018): FRP level cluster MODIS≈VIIRS.
- **Metode:** DBSCAN/ST-DBSCAN (eps ruang ~1.5–2 km agar konsisten dengan MODIS, eps waktu 1–2 hari), atau connected components pada grid 1 km harian. Untuk MODIS dan VIIRS-yang-sudah-diagregasi, **gunakan eps yang sama dalam km**, bukan dalam pixel.
- **Precedent:** Global Fire Atlas (Andela et al. 2019, ESSD 11:529) membagi burned area (MCD64A1) menjadi fire individual (13.3 juta fire 2003–2016). FEDS/fire event tracking berbasis VIIRS (Chen et al. 2022, Sci. Data) **[UNVERIFIED detail]**. Pada gambut, event bertahan berminggu-minggu, sehingga eps waktu menentukan hasil. Lakukan uji sensitivitas.
- **Feasibility: medium** (`sklearn` DBSCAN dengan haversine; jumlah titik Indonesia 2015 besar, jadi lakukan tiling per bulan).
- **Demo:** rasio VIIRS:MODIS per *pixel* (misal ~4–6×) vs per *event* (diharapkan mendekati 1–2×). Angka ini ilustratif dan harus dihitung.

### (j) Metode kontinuitas yang sudah terpublikasi (bukan dari nol)

| Pekerjaan | Inti | Relevansi |
|---|---|---|
| VIIRS 750 m VNP14 (Csiszar et al. 2014, JGR 119:803) | Algoritma "MODIS-heritage" khusus untuk kontinuitas data MODIS; deteksi konsisten dengan MODIS koinsiden | Opsi "VIIRS 750 m" sebagai jembatan resolusi menengah (lebih mirip MODIS daripada 375 m) |
| Csiszar (2012, AMS) | Kontinuitas mungkin hanya tercapai di level *statistik agregat* atau *pola dan tren*, bukan peta harian | Kutipan bagus untuk membingkai ekspektasi |
| Giglio et al. 2006 (CMG) | Koreksi overpass + awan | Ide (e1) |
| Giglio et al. 2010 (Biogeosciences) | Merging produk fire multi-sensor dengan kalibrasi regional (regression tree) active fire→BA | Precedent ilmiah untuk kalibrasi per region × vegetasi |
| Randerson et al. 2012 (JGR-Biogeosci) | "Small fire" burned area dari active fire di luar BA | Precedent untuk *menambah* fire kecil yang tidak terlihat |
| Andela et al. 2019 Global Fire Atlas | Event-based | Ide (i) |
| FireCCI51 / MCD64A1 / VNP64A1 | Burned area | Referensi independen |
| GFED5 (Chen et al. 2023 ESSD; van der Werf et al. 2025) | BA multi-sensor 1997–2020 (93% di atas MCD64A1) dengan koreksi fire kecil; BA gambut dan deforestasi diestimasi dari **active fire MODIS** | Referensi BA terbaik, tetapi *tidak independen penuh* dari MODIS active fire untuk gambut. Sebutkan ini ke juri! |
| Sofiev & Kouznetsov 2026 | Observation operator MODIS↔VIIRS | Ide (a), fondasi utama |
| NASA LAADS MODIS→VIIRS transition | NASA mendorong pengguna Aqua MODIS pindah ke VIIRS; tidak ada pengganti orbit pagi Terra | Konteks: harmonisasi bukan latihan akademis, ini kebutuhan nyata pasca-MODIS |

---

## 3. Fisika khusus gambut (karhutla)

### 3.1 Smouldering vs flaming
- Flaming: emitter ~1000–1400 K. Riggan et al. (2004, dikutip Wooster 2005): 90% energi radiatif savana dan hutan Brasil berasal dari emitter 830–1440 K.
- Smouldering gambut: suhu puncak ~600 °C (~870 K) di dalam lapisan (presentasi G. Rein, yang merujuk Rein 2009). Rentang 450–700 °C sering dikutip **[UNVERIFIED rentang tepat]**. Permukaan yang teramati satelit lebih dingin karena tertutup arang, abu, dan asap. Studi Sentinel-2 di Borneo menyebut fase smouldering <500 K **[UNVERIFIED, sumber sekunder]**. Propagasi lambat (~mm/menit) tetapi persisten berminggu-minggu, dan **tidak padam di malam hari**.
- Laju energi per luas rendah, sehingga **FRP per pixel kecil**. Di bawah ~650 K, metode MIR makin *underestimate* FRP (Wooster 2005). Akibatnya FRP gambut ter-underestimate dua kali: deteksi hilang dan FRP terdeteksi pun bias rendah.

### 3.2 Omisi deteksi di Indonesia
- **Atwood et al. (2016, PLoS ONE 11:e0159410):** sensor FireBird/TET-1 (160 m, MIR saturasi 900 K) mendeteksi front api gambut intensitas rendah di Sebangau, Kalteng (2015) yang **dilewatkan MODIS di bawah asap tebal**. Propagasi >500 m/hari.
- **Sofan et al. (2020, Int. J. Digital Earth 13:1695):** VNP14IMG vs referensi Landsat-8 (algoritma ToPeCAl). Kesesuaian ~80% untuk fire kecil (<14 ha). Dengan *cluster buffer* 375 m + gabungan siang-malam, probability of detection naik hingga ~90%. Ringkasan sekunder menyebut PoD dasar ~71% dan porsi smouldering yang terdeteksi ~50% **[UNVERIFIED angka sekunder]**. Penyebab omisi siang: awan, kelas lahan, sun glint, air.
- **Vetrita et al. (2021, ERL 16:035015):** empat produk burned area MODIS di Indonesia. Produk yang kurang akurat hanya menangkap 38–48% BA (45–57% jika burn <100 ha dibuang). MCD64A1 C6 terbaik, FireCCI51 (250 m) justru lebih buruk. Awan dan asap tebal membatasi semua produk, sehingga **referensi BA untuk gambut sendiri tidak pasti**.
- **Sofiev & Kouznetsov 2026:** PoD fire kuat <30% (MODIS) dan <40% (VIIRS) di sebagian kawasan ekuatorial berawan.
- **Huijnen et al. (2016, Sci. Rep. 6:26886):** inversi CO memakai FRP MODIS (GFAS). Di lokasi lapangan Kalimantan tercatat terutama smouldering gambut dan sedikit flaming.
- **Nechita-Banda et al. (2018, Phil. Trans. R. Soc. B, doi:10.1098/rstb.2017.0307):** inversi CO IASI/MOPITT (TM5-4DVAR). Total karbon 2015 sebesar 0.35–0.60 Pg C, dan per sub-region berbeda jauh dari inventori bottom-up.
- **Kiely et al. (2019, ACP 19:11105):** gambut menyumbang ~71% PM2.5 primer dari kebakaran Sep–Okt 2015. Total 7.33 Tg PM2.5, 3.5× FINNv1.5 yang tidak memasukkan gambut.
- **Wooster et al. (2018, Remote Sensing 10:495):** emission factor lapangan gambut 2015 + FRP geostasioner (Himawari) per jam. Bahan bakar 358 Tg, 23–34% di bawah GFED4.1s/GFAS, dan CH4 ~3× lebih kecil.
- **Field et al. (2016, PNAS 113:9204):** kebakaran Indonesia sangat nonlinier terhadap kekeringan El Niño. Lonjakan terjadi saat curah hujan musim kering **<4 mm/hari**, dengan sensitivitas yang meningkat di Kalimantan. Ini berguna sebagai uji fisik (§4).

### 3.3 Implikasi untuk rasio VIIRS:MODIS (hipotesis yang bisa diuji tim)
1. **H1:** rasio count VIIRS:MODIS **lebih tinggi di gambut** daripada di tanah mineral, karena porsi fire yang dekat ambang deteksi lebih besar.
2. **H2:** rasio **malam** >> rasio siang, terutama di gambut. Ambang malam VIIRS ~0.5–0.7 MW vs MODIS 3.7 MW, dan smouldering aktif di malam hari.
3. **H3:** rasio **naik pada tahun asap berat** (2015, 2019) karena asap menurunkan sinyal (`exp(−τ4)`) sehingga lebih banyak fire jatuh di bawah ambang MODIS daripada VIIRS. Arah efek ini **[UNVERIFIED]**, karena asap juga bisa menekan VIIRS.
4. Akibatnya, rasio global atau per-provinsi tanpa strata gambut **bias**. Model (f) harus punya kovariat `peat` dan `daynight`.

**Cara uji (≤3 jam):** overlay titik FIRMS dengan peta gambut, hitung rasio per strata {gambut, mineral} × {siang, malam} × {tahun El Niño, normal} pada pasangan hari overlap. Sajikan dengan CI bootstrap. Jika H1/H2 terbukti, ini **temuan ilmiah orisinal** yang dapat dipresentasikan.

Data gambut: peta gambut Indonesia Kementan/BBSDLP (Anda et al. 2021, Geoderma 402:115235, ~13.4 Mha) **[UNVERIFIED akses dan format]**. Tersedia juga sebagai layer di Global Forest Watch **[UNVERIFIED]**. Alternatif global: PEATMAP (Xu et al. 2018, Catena).

---

## 4. Desain benchmarking & evaluasi

### 4.1 Prinsip
1. **Setiap metrik punya baseline.** Tunjukkan M0 (raw) agar juri melihat seberapa besar perbaikannya.
2. **Validasi out-of-sample:** LOYO (leave-one-year-out), LORO (leave-one-region-out), dan **"simulated MODIS sunset"**: latih kalibrasi pada overlap 2012–2018, lalu prediksi seri MODIS-equivalent 2019–2025 dari VIIRS saja dan bandingkan dengan MODIS aktual. Ini meniru skenario nyata 2027+ ketika MODIS mati, sehingga jawabannya langsung menjawab pertanyaan "apakah aplikasi ini tetap valid setelah MODIS berhenti?".
3. **Referensi independen** untuk periode pra-2012, di mana tidak ada VIIRS. Jujurlah soal ketergantungan: GFED5 memakai active fire MODIS untuk BA gambut, dan SiPongi kemungkinan memakai hotspot dalam metodenya **[UNVERIFIED]**.
4. **Uji fisik:** seri harmonized harus mereproduksi hubungan nonlinier dengan curah hujan (<4 mm/hari, Field et al. 2016) secara konsisten **sebelum dan sesudah 2012**. Jika slope respons terhadap hujan berubah tepat di 2012, harmonisasi gagal.

### 4.2 Metrik
- Kesesuaian overlap: Pearson r (pada log(1+x)), Spearman ρ, bias (%) = `Σ(sim−obs)/Σobs`, RMSE (log), **KGE** = `1 − sqrt((r−1)² + (α−1)² + (β−1)²)`, dengan `α = σ_sim/σ_obs` dan `β = μ_sim/μ_obs` (Gupta et al. 2009, doi:10.1016/j.jhydrol.2009.08.003).
- Kalibrasi ketidakpastian: coverage interval 90% (target ~0.9), CRPS, atau PIT histogram.
- Seam: p-value Pettitt dan `Δ_seam` ± CI pada seri `z_t` (vs referensi), dihitung di setiap seam nyata dan dibandingkan dengan distribusi placebo.
- Variabilitas antar-tahun: Spearman ρ peringkat total tahunan (2001–2025) vs referensi. **Top-k overlap** tahun ekstrem (2002, 2004, 2006, 2009, 2014, 2015, 2019, 2023) **[UNVERIFIED daftar tahun ekstrem Indonesia; cek data]**. Korelasi dengan Niño3.4/DMI dan curah hujan musim kering.
- Musiman: korelasi silang klimatologi bulanan, beda bulan puncak (Giglio 2006 memakai cross-correlation Terra vs Aqua sebagai metrik konsistensi musiman).
- Tren: Theil–Sen slope ± CI, M0 vs harmonized.

### 4.3 Referensi independen

| Referensi | Periode | Sifat | Catatan |
|---|---|---|---|
| MCD64A1 C6.1 burned area (500 m) | 2000–2026 | Bulanan, BA | Berakhir bersama MODIS; VNP64A1 sebagai lanjutan. Omisi tinggi di gambut (Vetrita 2021) |
| FireCCI51 | 2001–2020 | BA 250 m | Lebih buruk dari MCD64A1 di Indonesia (Vetrita 2021) |
| GFED5 BA + emisi | 1997–2020 (+NRT) | Multi-sensor, koreksi fire kecil | Tidak independen untuk gambut (memakai MODIS AF) |
| SiPongi KLHK (sipongi.menlhk.go.id) | ~2015/2016–kini **[UNVERIFIED]** | Luas terbakar tahunan per provinsi | Referensi resmi Indonesia, cocok untuk juri lokal; metodologi perlu dicek |
| ASMC (ASEAN Specialised Meteorological Centre) | — | Hotspot harian dan haze | Berbasis VIIRS **[UNVERIFIED]**, jadi bukan independen untuk era VIIRS |
| GFAS (CAMS) | 2003– | FRP→emisi | Konsistensi energi |
| CO/AOD satelit (MOPITT, IASI, MODIS/VIIRS AOD) | 2000– | Atmosfer | Proxy independen intensitas musim kebakaran (Nechita-Banda 2018) |
| CHIRPS/IMERG + Niño3.4/DMI | 1981– | Iklim | Uji fisik respons kekeringan |

### 4.4 Tabel benchmark suite (template untuk ditampilkan ke juri)

Isi dengan angka hasil hitungan. **Jangan memasukkan angka karangan.**

| ID | Metode | Overlap KGE ↑ | Bias % → 0 | LOYO r ↑ | LORO r ↑ | "Sunset" 2019–25 KGE ↑ | Pettitt p @2012 (vs ref) ↑ | Δ_seam 2012 (log) → 0 | Drift-Terra artefak dihapus? | Coverage 90% ≈0.9 | ρ ranking tahunan vs MCD64A1 ↑ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | Raw concat (MODIS→VIIRS 2012) | | | | | | | | ✗ | n/a | |
| M1 | Rasio global konstan | | | | | | | | ✗ | | |
| M2 | Rasio per region×bulan (empiris) | | | | | | | | ✗ | | |
| M3 | EB/Bayesian hierarchical (+peat, day/night) | | | | | | | | ✗ | | |
| M4 | M3 + overpass/awan + diurnal (e1+e2) | | | | | | | | ✓ | | |
| M5 | Physics: FRP-floor (b) & detection operator MODIS-equivalent (a) | | | | | | | | ✓ | | |
| M5-E | Event-based (i) di atas M5 | | | | | | | | ✓ | | |

Tambahan opsional: kolom "jumlah parameter yang di-fit". M5 memakai operator yang dikalibrasi eksternal sehingga parameter lokalnya sedikit, dan ini argumen anti-overfitting.

### 4.5 Ablation yang paling meyakinkan untuk ditampilkan (3 grafik)
1. **Seam plot:** `z_t = log(H/R)` 2008–2016 untuk M0, M2, M5, dengan pita placebo. M0 diperkirakan melompat di 2012 (perlu dicek dengan data).
2. **FRP-floor plot:** rasio `N_V(≥F)/N_M(≥F)` vs F, siang dan malam, gambut vs mineral.
3. **Drift plot:** MLT Terra vs waktu + rasio Terra/Aqua mentah vs terkoreksi diurnal.

---

## 5. Rekomendasi akhir (diperingkat)

### 5.1 Paket metode yang paling defensible + feasible dalam 48 jam

Urutan prioritas pengerjaan:

1. **Strata + observation normalization (e1) + day/night split.** Semua analisis dipisah siang/malam dan dinormalisasi per overpass clear-sky. Untuk MODIS pakai MOD14CMQ/MYD14CMQ, sedangkan untuk VIIRS pakai `f_cloud` Aqua sebagai proxy. *Feasibility tinggi; ±4–6 jam.* Alasannya: formula resmi produk NASA dan mudah dipertahankan saat tanya-jawab.
2. **Common FRP floor (b)**, VIIRS diagregasi ke sel 1 km, scan angle MODIS dibatasi ≤ ~40°. Menghasilkan indeks "large-fire activity" yang hampir bebas seam. *Tinggi; ±3–4 jam.*
3. **MODIS-equivalent VIIRS via observation operator Sofiev & Kouznetsov 2026 (a)**, divalidasi terhadap Aqua MODIS di overlap. Ini menjadi seri utama 2000–sekarang dalam "mata uang MODIS", dengan pita ketidakpastian `Σ P(1−P)`. *Medium; ±8–10 jam.*
4. **Empirical-Bayes gamma–Poisson rasio per provinsi × {peat, mineral} × {day, night}** dengan CI (f-cepat). Dipakai untuk sisa ketidaksesuaian dan untuk sel yang tidak tercakup operator. *Tinggi; ±2–3 jam.*
5. **Bukti statistik:** Pettitt + PELT pada `z_t` vs referensi (Aqua-only dan MCD64A1) di semua seam nyata + placebo; LOYO/LORO; **simulated MODIS sunset**; KGE; ranking ENSO. *Tinggi; ±4–6 jam.*
6. **ΣFRP (energi) sebagai seri pendamping** (c), tanpa klaim karbon untuk gambut. *Tinggi; ±2 jam.*

Narasi satu kalimat untuk juri: *"Kami tidak menebak rasio. Kami memodelkan **mengapa** MODIS melihat lebih sedikit (ukuran pixel, FRP, siang/malam, awan, jam lintas), memakai operator deteksi yang sudah dipublikasi, lalu membuktikan secara statistik bahwa seam hilang dan tetap hilang ketika MODIS mati."*

### 5.2 Fitur sains yang bisa menjadi wow factor (diperingkat)

1. **"Hidden seam" orbit drift Terra/Aqua + koreksi diurnal.** Belum ada kompetitor yang menyentuhnya (dari pengecekan cepat README firelens dan fire-harmony). Fenomenanya didukung literatur (Giglio 2007 tentang tren palsu akibat jam sampling) dan sangat relevan dengan berakhirnya misi MODIS.
2. **"Lihat VIIRS dengan mata MODIS"**, sigmoid deteksi interaktif per scan angle dan siang/malam. Fisikanya bisa dilihat langsung di UI dan memakai paper GMD 2026 (sangat baru, menunjukkan riset yang mutakhir).
3. **Temuan gambut:** rasio VIIRS:MODIS gambut vs mineral × siang/malam dengan CI. Ini temuan lokal Indonesia yang orisinal dan dapat menjadi cerita utama karhutla. Ditambah peringatan ilmiah bahwa FRP *underestimate* smouldering (<650 K).
4. **Simulated MODIS sunset backtest**, yang menunjukkan aplikasi tetap valid setelah 2027.
5. **Kalkulator Planck sub-pixel** (widget kecil): masukkan luas, suhu, dan scan angle, lalu lihat ΔBT4/ΔBT11 MODIS vs VIIRS dan apakah lolos ambang. Edukatif, murah, dan menarik.
6. **Uji fisik respons kekeringan:** kurva fire vs curah hujan musim kering (<4 mm/hari, Field 2016) sebelum vs sesudah 2012 harus berimpit setelah harmonisasi.

### 5.3 Yang sebaiknya DIHINDARI dalam 48 jam
- Retrieval Dozier suhu dan luas fire per pixel (tidak stabil; Giglio & Kendall 2001).
- Pemrosesan Himawari mentah (data besar). Pakai literatur (Xu 2017, Wooster 2018) hanya untuk bentuk siklus diurnal.
- Klaim emisi karbon gambut dari FRP (bias rendah yang sudah diketahui).
- Mencampur MODIS C5/C6/C6.1 atau VIIRS C1/C2 (FRP C6 ≈ −16% vs C5).

---

## 6. Daftar pustaka (dengan URL)

- Alexandersson, H. (1986). A homogeneity test applied to precipitation data. *J. Climatol.* 6:661–675. https://doi.org/10.1002/joc.3370060607
- Anda, M. et al. (2021). Revisiting tropical peatlands in Indonesia. *Geoderma* 402:115235. **[UNVERIFIED detail]**
- Andela, N., Kaiser, J.W., van der Werf, G.R., Wooster, M.J. (2015). New fire diurnal cycle characterizations to improve FRE assessments made from MODIS observations. *ACP* 15:8831–8846. https://acp.copernicus.org/articles/15/8831/2015/
- Andela, N. et al. (2017). A human-driven decline in global burned area. *Science* 356:1356. https://doi.org/10.1126/science.aal4108
- Andela, N. et al. (2019). The Global Fire Atlas of individual fire size, duration, speed and direction. *ESSD* 11:529–552. https://essd.copernicus.org/articles/11/529/2019/
- Atwood, E.C. et al. (2016). Detection and characterization of low temperature peat fires during the 2015 fire catastrophe in Indonesia using FireBird. *PLoS ONE* 11:e0159410. https://doi.org/10.1371/journal.pone.0159410
- Chen, Y. et al. (2023). Multi-decadal trends and variability in burned area from the fifth version of GFED (GFED5). *ESSD* 15:5227. https://essd.copernicus.org/articles/15/5227/2023/
- Csiszar, I. (2012). Establishing active fire data continuity between Aqua MODIS and Suomi NPP VIIRS (AMS talk). https://www.star.nesdis.noaa.gov/JPSS/documents/meetings/2012/AMS_NewOrleans_2012/Oral/2012_AMS_Csiszar_Fire_V1.pdf
- Csiszar, I. et al. (2014). Active fires from the Suomi NPP VIIRS: product status and first evaluation results. *JGR Atmos.* 119:803–816. https://directreadout.sci.gsfc.nasa.gov/publications_documents/Csiszar_et_al_2014_JGR.pdf
- Dozier, J. (1981). A method for satellite identification of surface temperature fields of subpixel resolution. *RSE* 11:221–229. **[UNVERIFIED halaman]**
- Ellicott, E. et al. (2009). Estimating biomass consumed from fire using MODIS FRE. *GRL* 36:L13401. https://doi.org/10.1029/2009GL038581
- Field, R.D. et al. (2016). Indonesian fire activity and smoke pollution in 2015 show persistent nonlinear sensitivity to El Niño-induced drought. *PNAS* 113:9204–9209. https://pmc.ncbi.nlm.nih.gov/articles/PMC4995960
- Freeborn, P.H., Wooster, M.J., Roy, D.P., Cochrane, M.A. (2014). Quantification of MODIS FRP measurement uncertainty. *GRL* 41:1988–1994. https://doi.org/10.1002/2013GL059086
- Giglio, L., Csiszar, I., Justice, C.O. (2006). Global distribution and seasonality of active fires as observed with the Terra and Aqua MODIS sensors. *JGR* 111:G02016. https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/material3os/2006_Giglio_etal_GlobalDistribuiton_JGR_DE3os.pdf
- Giglio, L. (2007). Characterization of the tropical diurnal fire cycle using VIRS and MODIS observations. *RSE* 108:407–421. https://doi.org/10.1016/j.rse.2006.11.018
- Giglio, L. et al. (2010). Assessing variability and long-term trends in burned area by merging multiple satellite fire products. *Biogeosciences* 7:1171–1186. https://doi.org/10.5194/bg-7-1171-2010
- Giglio, L., Schroeder, W., Justice, C.O. (2016). The Collection 6 MODIS active fire detection algorithm and fire products. *RSE* 178:31–41. https://www.earthdata.nasa.gov/s3fs-public/imported/Giglio2016_C6_Fire.pdf
- Giglio, L., Schroeder, W., Hall, J.V., Justice, C.O. — MODIS C6/6.1 Active Fire Product User's Guide (MOD14 V61). https://lpdaac.usgs.gov/documents/1005/MOD14_User_Guide_V61.pdf
- Gupta, H.V. et al. (2009). Decomposition of the mean squared error and NSE performance criteria (KGE). *J. Hydrol.* 377:80–91. https://doi.org/10.1016/j.jhydrol.2009.08.003
- Hamed, K.H., Rao, A.R. (1998). A modified Mann-Kendall trend test for autocorrelated data. *J. Hydrol.* 204:182–196. https://doi.org/10.1016/S0022-1694(97)00125-X
- Huijnen, V. et al. (2016). Fire carbon emissions over maritime southeast Asia in 2015 largest since 1997. *Sci. Rep.* 6:26886. https://doi.org/10.1038/srep26886
- Kaiser, J.W. et al. (2012). Biomass burning emissions estimated with a global fire assimilation system based on observed FRP. *Biogeosciences* 9:527–554. https://doi.org/10.5194/bg-9-527-2012
- Kiely, L. et al. (2019). New estimate of particulate emissions from Indonesian peat fires in 2015. *ACP* 19:11105–11121. https://acp.copernicus.org/articles/19/11105/2019/
- Killick, R., Fearnhead, P., Eckley, I.A. (2012). Optimal detection of changepoints with a linear computational cost (PELT). *JASA* 107:1590–1598. https://doi.org/10.1080/01621459.2012.737745
- Li, F., Zhang, X., Kondragunta, S., Csiszar, I. (2018). Comparison of FRP estimates from VIIRS and MODIS observations. *JGR Atmos.* https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2017jd027823
- Li, F., Zhang, X., Kondragunta, S. (2020). Biomass burning in Africa: an investigation of fire radiative power missed by MODIS using the 375 m VIIRS active fire product. *Remote Sens.* 12:1561. https://doi.org/10.3390/rs12101561 **[UNVERIFIED judul persis]**
- Maier, S.W. et al. (2013). Sensitivity of the MODIS fire detection algorithm (MOD14) in the savanna region of the Northern Territory, Australia. *ISPRS J.* 76:11–16.
- NASA LAADS DAAC — MODIS to VIIRS Transition. https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition
- NASA Terra mission page (MLT/drift status). https://terra.nasa.gov/
- Nechita-Banda, N. et al. (2018). Monitoring emissions from the 2015 Indonesian fires using CO satellite data. *Phil. Trans. R. Soc. B* 373:20170307. https://pmc.ncbi.nlm.nih.gov/articles/PMC6178426/
- Pettitt, A.N. (1979). A non-parametric approach to the change-point problem. *Appl. Stat.* 28:126–135. https://doi.org/10.2307/2346729
- Randerson, J.T. et al. (2012). Global burned area and biomass burning emissions from small fires. *JGR-Biogeosci.* 117:G04012. https://doi.org/10.1029/2012JG002128
- Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. (2014). The new VIIRS 375 m active fire detection data product: algorithm description and initial assessment. *RSE* 143:85–96. https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf
- Schroeder, W., Giglio, L. — Collection 2 VIIRS 375 m Active Fire Product User's Guide v1.2 (2025). https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf
- Sen, P.K. (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA* 63:1379–1389. https://doi.org/10.1080/01621459.1968.10480934
- Sofan, P., Bruce, D., Schroeder, W., Jones, E., Marsden, J. (2020). Assessment of VIIRS 375 m active fire using tropical peatland combustion algorithm applied to Landsat-8 over Indonesia's peatlands. *Int. J. Digital Earth* 13:1695–1716. https://doi.org/10.1080/17538947.2020.1791268
- Sofiev, M., Kouznetsov, R. (2026). Observation operator and detection limits for MODIS and VIIRS Fire Radiative Power products. *GMD* 19:10123–10142. https://gmd.copernicus.org/articles/19/10123/2026/ (kode: https://github.com/fmidev/FRP_OOp, Zenodo doi:10.5281/zenodo.18339604)
- van der Werf, G.R. et al. (2025). GFED5 emissions. **[UNVERIFIED judul/DOI]**
- Verbesselt, J. et al. (2010). Detecting trend and seasonal changes in satellite image time series (BFAST). *RSE* 114:106–115. https://doi.org/10.1016/j.rse.2009.08.014
- Vermote, E. et al. (2009). An approach to estimate global biomass burning emissions of organic and black carbon from MODIS FRP. *JGR* 114:D18205. https://bsosdev1.umd.edu/sites/geog.umd.edu/files/pubs/Vermote%20et%20al%202009%20-%20JGR%20-%20An%20approach%20to%20estimate%20global%20biomass%20burning%20emissions%20of%20organic%20and%20black%20carbon%20from%20MODIS%20fire%20radiative%20power.pdf
- Vetrita, Y., Cochrane, M.A. et al. (2021). Evaluating accuracy of four MODIS-derived burned area products for tropical peatland and non-peatland fires. *ERL* 16:035015. https://doi.org/10.1088/1748-9326/abd3d1
- Wooster, M.J., Zhukov, B., Oertel, D. (2003). Fire radiative energy for quantitative study of biomass burning: derivation from BIRD and comparison to MODIS. *RSE* 86:83–107.
- Wooster, M.J., Roberts, G., Perry, G.L.W., Kaufman, Y.J. (2005). Retrieval of biomass combustion rates and totals from FRP observations. *JGR* 110:D24311. https://doi.org/10.1029/2005JD006318 (PDF: https://gaftp.epa.gov/Air/aqmg/baker/info/Journal%20of%20Geophysical%20Research%20%20Atmospheres%20-%202005%20-%20Wooster.pdf)
- Wooster, M.J. et al. (2018). New tropical peatland gas and particulate emissions factors indicate 2015 Indonesian fires released far more particulate matter (but less methane) than current inventories imply. *Remote Sens.* 10:495. https://www.mdpi.com/2072-4292/10/4/495
- Xu, W. et al. (2017). Major advances in geostationary FRP retrieval over Asia and Australia stemming from use of Himawari-8 AHI. *RSE* 193:138–149.

### Repo kompetitor yang dicek sekilas (untuk diferensiasi)
- fire-harmony (Warren-530): sudah memakai detection probability empiris (FRP, day/night, awan, dari 10 tile 2019), Pettitt + PELT di 2002/2012 + placebo seams, FireCCI, held-out years/regions, interval 90%, LightGBM. **Belum ada:** operator fisik terpublikasi, koreksi diurnal/orbit drift, normalisasi CMG, strata gambut. https://github.com/Warren-530/fire-harmony
- firelens (shahmirkhan106): OLS per region + grid H3 ~1 km. Secara eksplisit menyatakan "cloud/edge artifacts are not modelled". https://github.com/shahmirkhan106/firelens
