# Rencana desain UI Second Sight (SET-06)

Dokumen pendek ini mengunci keputusan visual sebelum coding UI. Sumber: `docs/10-ui-ux-second-sight.md` §2, §3.2, §4, §7.

## 1. Arah

Light-first, operasional, editorial. Vernakular lembaga (BMKG, BRIN, OWID): latar netral dingin, teks gelap, warna hanya untuk data. Halaman pertama adalah kalender data untuk AOI default, tanpa hero, tanpa deretan KPI, tanpa globe.

## 2. Token warna (dikonfirmasi dari 10 §4.2)

| Token | Hex | Peran |
|---|---|---|
| `--bg` | `#F6F7F8` | Latar halaman |
| `--surface` | `#FFFFFF` | Panel |
| `--ink` | `#1B1F24` | Teks utama |
| `--ink-2` | `#56606B` | Teks sekunder, anotasi |
| `--hairline` | `#D8DDE3` | Garis pemisah |
| `--accent-ui` | `#1F5F8B` | Tombol, link, fokus (biru tinta, bukan warna api) |
| `--zero` | `#ECEFF2` | Sel nol aktivitas |
| `--unobserved` | `#9AA4AF` (arsir di atas `--bg`) | Sel tidak teramati |
| `--el-nino` | `#B4462E` | Garis tahun El Niño (spaghetti) |
| `--current-year` | `#111111` | Tahun berjalan |

Ramp data:
- Mode *Jumlah*: sekuensial `interpolateInferno` (d3-scale-chromatic) dipotong 0,15-0,92 supaya ujung terang tidak hilang di latar dan ujung gelap tidak hitam pekat; skala log, adaptif per AOI.
- Mode *vs median*: divergen RdBu dibalik, 9 kelas, pusat netral abu `#E6E8EB`.

### Kontras (WCAG, dihitung)

| Teks | Latar | Rasio |
|---|---|---|
| `--ink` | `--bg` | 15,44:1 |
| `--ink` | `--surface` | 16,56:1 |
| `--ink-2` | `--surface` | 6,40:1 |
| `--ink-2` | `--bg` | 5,97:1 |
| `--ink-2` | `--zero` | 5,55:1 |
| `--accent-ui` | `--surface` | 6,84:1 |
| putih | `--accent-ui` | 6,84:1 |

Semua ≥4,5:1. Angka di dalam sel ramp memakai teks gelap atau putih yang dipilih otomatis per sel dari luminans warna latar.

## 3. Tipografi

| Peran | Font | Catatan |
|---|---|---|
| Judul | Plus Jakarta Sans (variable, OFL, foundry Indonesia) | 18 / 24 / 32 px, berat 600-700 |
| Body, UI, angka | Source Sans 3 (variable, OFL) | 13 / 15 / 16 px; angka `font-variant-numeric: tabular-nums lining-nums` |

Self-host via `@fontsource-variable/plus-jakarta-sans` dan `@fontsource-variable/source-sans-3`. Sentence case, tanpa eyebrow ALL-CAPS, tanpa monospace untuk label.

## 4. Wireframe layar utama (desktop ≥1200 px)

```
+------------------------------------------------------------------------------+
| Second Sight  Peta Kalender Bulan-ini Lab Seberapa-yakin Unduh Metode  ID|EN |
| Data satelit hingga ... · NOAA-20 · Suomi-NPP berhenti 2 Nov 2026            |
+--------------------------+---------------------------------------------------+
| Wilayah                  | KHG Sebangau · [DATA CONTOH]                      |
| [Cari wilayah...      ]  | Judul = temuan (1 kalimat)                        |
| > Kalteng, kabut 2015    | Mode: (o) Jumlah ( ) vs median                    |
| > Riau, Sungai Kampar    | +-----------------------------------------------+ |
|                          | |      Jan Feb ... Des | Total  Peringkat       | |
| +----------------------+ | | 2001  3   1  ...  8  | 1.141   18             | |
| | Peta MapLibre        | | | 2011                                         | |
| | abu-abu terang       | | | -- MODIS diharmonisasi | VIIRS ke skala MODIS | |
| | (c) OpenStreetMap    | | | 2012 o                                       | |
| +----------------------+ | | Median 2  1 ...  6                            | |
|                          | +-----------------------------------------------+ |
|                          | 1.825 dari 1.898 sel-bulan teramati baik          |
+--------------------------+---------------------------------------------------+
```

Mobile (<768 px): header + peta di atas, kalender di bawah dengan scroll horizontal di dalam wadahnya sendiri; gutter 16 px; halaman tidak pernah scroll horizontal.

## 5. Hierarki komponen

- Peta: tanpa radius. Panel: radius 6, garis `--hairline`, tanpa bayangan. Chip/pill: radius penuh. Dialog/tooltip: radius 10 + bayangan tipis.
- Tidak ada kartu di dalam kartu.
- Motion hanya untuk perubahan data (transisi raw ke harmonisasi), mati bila `prefers-reduced-motion`.

## 6. Lima keadaan sel kalender

| Keadaan | Tampilan |
|---|---|
| Ada aktivitas | Warna ramp + angka |
| Nol | `--zero` + "0" |
| Sebagian teramati | Warna ramp + arsir tipis |
| Tidak teramati | Arsir diagonal tebal `--unobserved`, tanpa ramp, "–" |
| Provisional (NRT) | Tepi putus-putus |
| Anomali ≥p90 (tambahan) | Ring tipis `--ink` di sekeliling sel |

Setiap keadaan dibedakan oleh pola atau garis, bukan hanya warna, sehingga tetap terbaca dalam mode monokrom dan simulasi buta warna.

## 7. Pemeriksaan "apakah ini default yang akan muncul untuk brief serupa?"

| Bagian | Default yang biasa muncul | Keputusan Second Sight |
|---|---|---|
| Tema | near-black + aksen oranye menyala + glow | Latar abu dingin terang, tanpa glow |
| Font | Inter / Space Grotesk / JetBrains Mono | Plus Jakarta Sans (berakar di Indonesia) + Source Sans 3 |
| Aksen | oranye/merah api untuk tombol | Biru tinta `#1F5F8B`; warna api hanya untuk data |
| Halaman pertama | hero + 4 KPI tile + globe | Kalender sungguhan untuk AOI default |
| Label | eyebrow ALL-CAPS, angka 01/02/03 | Sentence case, judul = temuan |
| Ikon | emoji di setiap judul | Tanpa ikon dekoratif |
| Kalender | heatmap tanpa angka, legenda jauh | Angka di sel, garis era sensor, label langsung |

Bagian yang masih berisiko generik: tab bar atas. Dibuat sebagai teks dengan garis bawah aksen (bukan pill bergradien atau segmented glass), dan maksimal 7 item.

Larangan tetap: gradien dekoratif, glassmorphism, teks bergradien, ungu/indigo, emoji, logo NASA atau kesan endorsement.
