# Second Sight: science methodology (implementation notes)

Code: `pipeline/science/`. Rules and thresholds: `docs/validation_plan.md` (pre-registered). Run everything with `python -m pipeline.science.run` (outputs go to `$SS_DATA_DIR/science/`, never to git).

| Module | Ticket | What it does |
|---|---|---|
| `common.py` | — | constants, `load_monthly_stratum()` adapter for the data layer's parquet (date `month` → year/month, `n_cells` → `cell_days`, `peat` → `is_peat` + `peat_known`, season re-derived from month with the pre-registered 3 seasons) |
| `calibrate.py` | CAL-01/02 | M3: stratified κ = Aqua/S-NPP, gamma-Poisson EB shrinkage (exposure-weighted method of moments per parent, grandparent fallback), year-block bootstrap → `strata_factors.json`; M1/M2 ratio of sums |
| `chain.py` | CAL-03 | r_T→A (2002-07..2005-12), r_N20→SNPP (2018-04..2026-10), ratio of sums on months where both sensors report, bootstrap, `sd_log` for chain closure |
| `series.py` | CAL-04 | H on the Aqua scale per era; H_lo/H_hi from summed bootstrap draws; raw per-sensor columns |
| `baseline.py` | ANO-01 | median/p10/p90/MAD per calendar month 2003-2022 (fold-aware via `exclude_years`), log-ratio, robust z, prior-years percentile, anomaly class |
| `enso.py` | ANO-02 | ONI (NOAA CPC) and DMI (NOAA PSL HadISST) download + cache, year classes, analog rank |
| `validate.py` | VAL-01/02/03 | LOYO, LORO, seam test (Δ_seam, block-bootstrap CI, placebo, Pettitt, PELT), sunset KGE |
| `peat.py` | VAL-09 | H1-H3 with year bootstrap and pre-registered decisions |
| `dynamic.py` | CAL-06 | M4: NB GLM `log E[A] = log V + log κ_M3 + β0 + β1 logit φ + β2 η`, year bootstrap, `m4_method()` for LOYO/sunset |

## Design decisions

- **Stratum effect in M4** comes from the M3 EB factor as an offset, rather than free per-stratum intercepts. This keeps the shrinkage and leaves only 3 free parameters.
- **Era boundaries are monthly.** November 2026 is assigned to NOAA-20, so the two S-NPP days (1-2 Nov) are dropped.
- **Intervals**: κ and chain draws are paired by draw index, which treats the two bootstrap streams as independent. Aqua-era months carry no calibration uncertainty.
- **Unknown peat labels** count as not-peat for stratification. V9 refuses to run while no peat label is known.

## Known limitations

- With an Aqua-only reference R, the seam test is uninformative inside the Aqua era: H = R there, so Δ = 0 by construction at 2012-01 and 2018-04. Those placebo months are degenerate too. The 2002-07 seam has no Aqua before it, and the 2026-11 seam needs NRT data. An independent reference (MCD64A1) is needed for a real test at those seams.
- `log(H+1) − log(R+1)` gives low-count wet-season months a lot of weight.
- In 2012-2021 only 2015 is an El Niño year by the ONI JAS ≥ +0.5 rule (2019 has ONI JAS = 0.20), so H3 rests on a single year.
