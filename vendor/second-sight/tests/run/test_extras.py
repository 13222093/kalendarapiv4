import numpy as np
import pandas as pd

from pipeline.run.extras import _f1_kappa, expand_fit
from pipeline.science.calibrate import fit_simple_ratio


def test_f1_kappa_perfect_and_known():
    a = np.array([1, 1, 0, 0, 0, 0], bool)
    f1, ck, tp, fp, fn, n = _f1_kappa(a, a)
    assert f1 == 1.0 and ck == 1.0 and tp == 2 and n == 6
    f1, ck, *_ = _f1_kappa(a, np.array([1, 0, 1, 0, 0, 0], bool))
    assert abs(f1 - 0.5) < 1e-9 and abs(ck - 0.25) < 1e-9


def test_expand_fit_broadcasts_to_strata():
    rows = []
    for reg in ("A", "B"):
        for sat, v in (("Aqua", 2.0), ("SNPP", 10.0)):
            rows.append(dict(year=2012, month=8, island_region=reg, season="dry", daynight="D",
                             is_peat=False, satellite=sat, cell_days=v))
    ms = pd.DataFrame(rows)
    f = expand_fit(fit_simple_ratio(ms, years=(2012,), keys=[]), ms)
    assert {"island_region", "season", "daynight", "is_peat"} <= set(f.table.columns)
    assert np.allclose(f.table["kappa"], 0.2)
