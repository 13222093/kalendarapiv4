# Second Sight build targets (data pipeline, role R1).
# Windows without GNU make: use `bash scripts/pipeline.sh <target>` (same targets).
# Data is written to $(SS_DATA_DIR) (default D:/Lomba/Hackathon/nasa/second-sight-data).

ifeq ($(OS),Windows_NT)
PY ?= .venv/Scripts/python
else
PY ?= .venv/bin/python
endif

.PHONY: help venv data clean-data mask cells aggregate test

help:
	@echo "venv       create .venv and install requirements.txt"
	@echo "data       DAT-01 download FIRMS SP archive + DAT-04 manifest"
	@echo "clean-data DAT-06 clean detections -> detections.parquet"
	@echo "mask       DAT-07 static source mask"
	@echo "cells      DAT-08 fire cell-days (runs clean-data + mask first)"
	@echo "aggregate  DAT-09 monthly strata + 0.05 deg grid"
	@echo "test       run pytest"

venv:
	python -m venv .venv
	$(PY) -m pip install -r requirements.txt

data:
	$(PY) -m pipeline.data.ingest
	$(PY) -m pipeline.data.manifest

clean-data:
	$(PY) -m pipeline.data.clean

mask: clean-data
	$(PY) -m pipeline.data.static_mask

cells: mask
	$(PY) -m pipeline.data.cells

aggregate:
	$(PY) -m pipeline.data.aggregate

test:
	$(PY) -m pytest -q tests
