"""DAT-01: acquire FIRMS SP yearly country archives for Indonesia.

Downloads ``{source}_{year}_Indonesia.csv`` from the FIRMS country archive
(MODIS C6.1 2000-2025, VIIRS S-NPP 2012-2025, VIIRS NOAA-20 2018-2025, NOAA-21
best effort) into ``$SS_DATA_DIR/raw_csv/{source}/`` and converts each file to
Parquet partitioned as ``$SS_DATA_DIR/raw/source={source}/year={year}/part.parquet``.

Row counts per source-year are merged into ``$SS_DATA_DIR/raw_row_counts.csv``.

Usage::

    python -m pipeline.data.ingest                       # everything
    python -m pipeline.data.ingest --sources modis --years 2015 2019
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from pipeline.data import config


def url_for(source: str, year: int) -> str:
    return config.FIRMS_COUNTRY_URL.format(source=source, year=year, country=config.COUNTRY)


def download(url: str, dest: Path, retries: int = 3) -> bool:
    """Download ``url`` to ``dest`` atomically. Returns False on HTTP 404."""
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "second-sight-pipeline/0.1"})
            with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(dest)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            print(f"  HTTP {e.code} on {url} (attempt {attempt})", file=sys.stderr)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f"  {e} on {url} (attempt {attempt})", file=sys.stderr)
        time.sleep(5 * attempt)
    raise RuntimeError(f"failed to download {url}")


def to_parquet(csv_path: Path, source: str, year: int) -> int:
    """Convert one CSV to partitioned Parquet; return row count."""
    import duckdb

    out = config.raw_parquet_dir() / f"source={source}" / f"year={year}" / "part.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    # acq_time is HHMM (leading zeros may be dropped) -> integer.
    # confidence is numeric for MODIS and l/n/h for VIIRS -> keep as text.
    # source/year are NOT stored as columns: they come from the hive partition path.
    con.execute(
        f"""
        COPY (
            SELECT * FROM read_csv('{csv_path.as_posix()}', header=true,
                          types={{'acq_time': 'INTEGER', 'confidence': 'VARCHAR',
                                  'satellite': 'VARCHAR', 'version': 'VARCHAR'}})
        ) TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """
    )
    n = con.execute(f"SELECT count(*) FROM '{out.as_posix()}'").fetchone()[0]
    con.close()
    return int(n)


def run(sources: dict[str, tuple[int, int]], optional: bool) -> list[dict]:
    rows: list[dict] = []
    plan = list(sources.items()) + (list(config.OPTIONAL_SOURCES.items()) if optional else [])
    for source, (y0, y1) in plan:
        for year in range(y0, y1 + 1):
            url = url_for(source, year)
            dest = config.raw_csv_dir() / source / Path(url).name
            t0 = time.time()
            if not download(url, dest):
                print(f"[missing] {source} {year} -> 404", flush=True)
                rows.append({"source": source, "year": year, "rows": 0, "status": "404", "url": url})
                continue
            n = to_parquet(dest, source, year)
            print(f"[ok] {source} {year}: {n:,} rows ({time.time() - t0:.1f}s)", flush=True)
            rows.append({"source": source, "year": year, "rows": n, "status": "ok", "url": url})
    return rows


def write_counts(rows: list[dict]) -> Path:
    """Merge with any existing counts file (keyed on source, year)."""
    path = config.data_dir() / "raw_row_counts.csv"
    existing: dict[tuple[str, int], dict] = {}
    if path.exists():
        with open(path, newline="") as f:
            for r in csv.DictReader(f):
                existing[(r["source"], int(r["year"]))] = r
    for r in rows:
        existing[(r["source"], int(r["year"]))] = r
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["source", "year", "rows", "status", "url"])
        w.writeheader()
        for k in sorted(existing):
            w.writerow(existing[k])
    return path


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sources", nargs="*", default=list(config.SOURCES))
    ap.add_argument("--years", nargs=2, type=int, metavar=("FIRST", "LAST"),
                    help="restrict to a year range (intersected with each source's range)")
    ap.add_argument("--no-optional", action="store_true", help="skip NOAA-21 (viirs-jpss2)")
    a = ap.parse_args(argv)
    srcs = {s: config.SOURCES[s] for s in a.sources if s in config.SOURCES}
    if a.years:
        srcs = {s: (max(y0, a.years[0]), min(y1, a.years[1])) for s, (y0, y1) in srcs.items()}
    rows = run(srcs, optional=not a.no_optional and not a.years)
    print(f"row counts -> {write_counts(rows)}")


if __name__ == "__main__":
    main()
