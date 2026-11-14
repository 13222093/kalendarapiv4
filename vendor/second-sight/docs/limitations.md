# Limitations / Keterbatasan

Stub from the PRD (08 §7.12). To be revised with actual results after validation (ticket SUB-03, after VAL-04).

## English

1. **Hotspots are not fire events and not burned area.** Second Sight measures satellite-detected burning activity.
2. **Some fires remain invisible.** Peat fires burning underground or under thick smoke can still be missed by both sensors. Calibration equalizes the sensors; it does not "see" what neither of them detects.
3. **Stationary ratios.** Calibration assumes the VIIRS/MODIS ratio is stationary within each stratum. Extreme years can deviate (checked with leave-one-year-out for 2015 and 2019).
4. **No backcast.** The pre-2012 series on the MODIS scale does not include small fires that only VIIRS can see.
5. **2026 is provisional.** 2026 data come from FIRMS NRT and may be revised.
6. **Official burned area differs in method.** Official (SiPongi) burned-area figures use different methods and are used only for rank correlation.
7. **Diurnal cycle uncertainty.** Diurnal cycle parameters for Indonesia are uncertain; the orbit-drift correction is treated as a diagnostic.
8. **Few El Nino analogues.** There are few El Nino analogue years, so analogue rankings carry large uncertainty.
9. **Map versions.** The KHG boundaries and peat maps used may not be the latest official versions (versions are listed in `docs/data_provenance.md`).

## Bahasa Indonesia

1. **Hotspot bukan kejadian kebakaran dan bukan luas terbakar.** Second Sight mengukur aktivitas pembakaran yang terdeteksi satelit.
2. **Sebagian api tetap tidak terlihat.** Api gambut di bawah permukaan dan di bawah asap tebal tetap bisa luput dari kedua sensor; kalibrasi menyetarakan sensor, tidak "melihat" yang tidak terdeteksi keduanya.
3. **Rasio stasioner.** Kalibrasi mengasumsikan rasio stasioner dalam strata; tahun ekstrem dapat menyimpang (diperiksa di LOYO 2015/2019).
4. **Tanpa backcast.** Seri pra-2012 dalam skala MODIS tidak memuat api kecil yang hanya terlihat VIIRS.
5. **Data 2026 sementara.** Data 2026 berasal dari NRT dan bisa direvisi.
6. **Luas terbakar resmi berbeda metode.** Luas terbakar resmi (SiPongi) memakai metode berbeda; dipakai hanya untuk korelasi peringkat.
7. **Siklus diurnal belum pasti.** Parameter siklus diurnal untuk Indonesia belum pasti; koreksi drift diperlakukan sebagai diagnostik.
8. **Analog El Nino sedikit.** Tahun analog El Nino sedikit; peringkat analog punya ketidakpastian besar.
9. **Versi peta.** Batas KHG dan peta gambut yang dipakai mungkin bukan versi resmi terbaru (versinya dicantumkan di `docs/data_provenance.md`).
