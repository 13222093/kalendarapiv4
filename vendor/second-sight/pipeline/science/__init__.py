"""Second Sight science modules: calibration, harmonized series, anomalies, ENSO, validation.

All functions are pure and operate on pandas DataFrames with the ``monthly_stratum``
schema (year, month, island_region, season, daynight, is_peat, satellite, cell_days,
sum_frp) produced by ``pipeline/data``.
"""
