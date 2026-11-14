# AI-06 agent eval report

**Planner evaluated: rule-based planner (no LLM key; deterministic).** No LLM was called unless stated here; numbers come only from
deterministic tools, and the final text is template-rendered and checked by the number verifier.

- Questions: 43 (formal Indonesian, abbreviations, typos, mixed English, hand-off, out-of-scope)
- Plan exact-match accuracy (tool names + aoi_id/year/month/start/end): 100.0% (32 plan cases)
- Refusal correctness: 100.0% (9 out-of-scope cases); false refusals on in-scope questions: 0
- Hand-off correctness (missing period -> ask user): 100.0%
- Untraceable numbers in final answers: 0
- Overall: 100.0%

Caveat: the same author wrote these questions and the rule planner's regexes and aliases, so
this is an in-sample check of the rule planner, not a measure of how it generalises. Use a
held-out set from real BPBD / Manggala Agni questions before quoting accuracy.

Reproduce: `python eval/agent_eval.py` (rule planner, offline). `--llm` evaluates the planner
from `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` instead; the result has not been measured yet.

| # | ok | status | question | got | expected |
|---|---|---|---|---|---|
| 1 | Y | answered | Bandingkan September 2015 di Kalimantan dengan tahun El Nino lain | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} |
| 2 | Y | answered | Berapa jumlah titik panas di Sumatra pada Agustus 2019? | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} |
| 3 | Y | answered | Bagaimana kondisi kebakaran Kalimantan Tengah bulan Oktober 2023 dibanding riwayat? | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} |
| 4 | Y | answered | Buatkan brief siaga untuk Riau September 2019 | make_brief{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9} | make_brief{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9} |
| 5 | Y | answered | Mengapa September 2015 di Sumatera Selatan sangat tinggi? | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9}; explain_anomaly{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9}; explain_anomaly{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9} |
| 6 | Y | answered | Tampilkan tren bulanan Kalimantan sepanjang 2019 | get_calendar{'aoi_id': 'region-kalimantan', 'start': '2019', 'end': '2019'} | get_calendar{'aoi_id': 'region-kalimantan', 'start': '2019', 'end': '2019'} |
| 7 | Y | answered | Bandingkan Oktober 2006 di Kalimantan dengan tahun El Nino lainnya | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2006, 'month': 10} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2006, 'month': 10} |
| 8 | Y | answered | Laporan ringkasan Papua November 2015 | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 11} | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 11} |
| 9 | Y | answered | Apakah Sulawesi pada September 2023 lebih tinggi dari median? | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 9} | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 9} |
| 10 | Y | answered | Jelaskan anomali Kalimantan Agustus 2019 | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 8}; explain_anomaly{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 8} | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 8}; explain_anomaly{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 8} |
| 11 | Y | answered | Titik api nasional Indonesia September 2015 | month_vs_history{'aoi_id': 'IDN', 'year': 2015, 'month': 9} | month_vs_history{'aoi_id': 'IDN', 'year': 2015, 'month': 9} |
| 12 | Y | answered | Kondisi Jawa dan Nusa Tenggara Oktober 2019 | month_vs_history{'aoi_id': 'region-jnbm', 'year': 2019, 'month': 10} | month_vs_history{'aoi_id': 'region-jnbm', 'year': 2019, 'month': 10} |
| 13 | Y | answered | Kalteng Sept 2015 vs tahun El Nino | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} |
| 14 | Y | answered | brief kalbar okt 2023 | make_brief{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} | make_brief{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} |
| 15 | Y | answered | sumsel agt 2019 dibanding median | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} |
| 16 | Y | answered | knp kalsel sep 2019 tinggi? | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 9}; explain_anomaly{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 9} | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 9}; explain_anomaly{'aoi_id': 'region-kalimantan', 'year': 2019, 'month': 9} |
| 17 | Y | answered | OKI 2015-09 analog ENSO | compare_enso_analogs{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9} | compare_enso_analogs{'aoi_id': 'region-sumatra', 'year': 2015, 'month': 9} |
| 18 | Y | answered | NTT des 2019 | month_vs_history{'aoi_id': 'region-jnbm', 'year': 2019, 'month': 12} | month_vs_history{'aoi_id': 'region-jnbm', 'year': 2019, 'month': 12} |
| 19 | Y | answered | sulteng 09/2023 | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 9} | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 9} |
| 20 | Y | answered | RI sept 2023 brief | make_brief{'aoi_id': 'IDN', 'year': 2023, 'month': 9} | make_brief{'aoi_id': 'IDN', 'year': 2023, 'month': 9} |
| 21 | Y | answered | sepetember 2015 kalteng | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} |
| 22 | Y | answered | bandingkan septembr 2015 kalimntan dgn el nino | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} |
| 23 | Y | answered | kebakran sumatra agustsu 2019 | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} |
| 24 | Y | answered | oktobr 2023 sulawsi | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 10} | month_vs_history{'aoi_id': 'region-sulawesi', 'year': 2023, 'month': 10} |
| 25 | Y | answered | ringkasan papau novembr 2015 | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 11} | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 11} |
| 26 | Y | answered | Compare September 2015 in Kalimantan with other El Nino years | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2015, 'month': 9} |
| 27 | Y | answered | How did Sumatra do in August 2019 vs history? | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 8} |
| 28 | Y | answered | Why was Riau so high in September 2019? | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9}; explain_anomaly{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9} | month_vs_history{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9}; explain_anomaly{'aoi_id': 'region-sumatra', 'year': 2019, 'month': 9} |
| 29 | Y | answered | Make a brief for Papua October 2015 | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 10} | make_brief{'aoi_id': 'region-papua', 'year': 2015, 'month': 10} |
| 30 | Y | answered | Monthly trend for Sulawesi 2015 | get_calendar{'aoi_id': 'region-sulawesi', 'start': '2015', 'end': '2015'} | get_calendar{'aoi_id': 'region-sulawesi', 'start': '2015', 'end': '2015'} |
| 31 | Y | answered | tolong compare kalteng Oct 2023 with El Nino years | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} | compare_enso_analogs{'aoi_id': 'region-kalimantan', 'year': 2023, 'month': 10} |
| 32 | Y | answered | Borneo fires September 2006 | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2006, 'month': 9} | month_vs_history{'aoi_id': 'region-kalimantan', 'year': 2006, 'month': 9} |
| 33 | Y | needs_confirmation | Bagaimana kondisi Riau? | - | HANDOFF |
| 34 | Y | needs_confirmation | Brief Kalimantan dong | - | HANDOFF |
| 35 | Y | refused | Prediksi kebakaran Kalimantan tahun 2030 | - | REFUSE |
| 36 | Y | refused | Forecast hotspots in Sumatra next year | - | REFUSE |
| 37 | Y | refused | Berapa titik api di Thailand September 2015? | - | REFUSE |
| 38 | Y | refused | Hotspots in Australia December 2019 | - | REFUSE |
| 39 | Y | refused | Harga saham hari ini? | - | REFUSE |
| 40 | Y | refused | Kalimantan September 1997 | - | REFUSE |
| 41 | Y | refused | Kalimantan September 2027 | - | REFUSE |
| 42 | Y | refused | Ramalkan musim kebakaran Riau berikutnya | - | REFUSE |
| 43 | Y | refused | Bitcoin price September 2015 | - | REFUSE |
