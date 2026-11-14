# Contributing to Second Sight

Short rules for the team during NASA Space Apps 2026 (14-15 Nov). Read once before your first commit.

## 1. Commits and branches

- Commit message format: `<TICKET-ID>: <short message in imperative mood>`
  - Examples: `SET-02: add license and third-party attributions`, `DAT-04: build daily fire cells at 0.01 deg`, `FE-06: render calendar from monthly_aoi.json`
  - Ticket IDs come from `docs/11-tiket-implementasi.md`.
- One ticket per commit where possible. Push to your own branch, merge to `main` via pull request.
- Never force-push to `main`.

## 2. What must never be committed

- **Secrets:** API keys (FIRMS MAP_KEY, LLM keys), tokens, passwords, `.env` files. Keys live only in a local `.env` or in the hosting provider's environment settings.
- **Large or raw data:** FIRMS CSV/Parquet archives, rasters, downloaded shapefiles. Only small reproducible subsets go in `data/sample/`, plus the static demo bundle produced by the pipeline export step.
- **Personal data** and names of concession companies.
- **Team-internal evidence** (for example the screenshot of the Space Apps CP confirmation about AI use). Keep it in the team folder, not in this public repo.

If you committed a secret by mistake: tell the team immediately and rotate the key. Deleting the file in a later commit is not enough.

## 3. Numbers in the UI come only from pipeline outputs

- Every number shown in the app, slides, video, project page and README must be read from a file produced by the pipeline (`pipeline/` export step, `validation_results.json`, etc.).
- No hand-typed numbers in components, copy or captions. If a number is needed for text, template it from the pipeline output.
- Before submission, numbers are cross-checked across all artifacts (ticket SUB-07).

## 4. Dummy data must be labelled

- Any placeholder, mock or synthetic data used while the pipeline is not ready must be visibly labelled **DATA CONTOH** (sample data) in the UI and named clearly in code (for example `sample_*.json`, `MOCK_*`).
- Dummy data must never reach the final demo, video or screenshots.

## 5. Borrowed code and attribution

License texts of third-party repos live in `THIRD_PARTY_LICENSES/`. Credits are listed in `docs/credits.md`. Borrow infrastructure, UX patterns and test designs; do not copy another team's harmonization science.

Repos **without** a license (all rights reserved) may only inspire techniques that we re-implement ourselves and cite. Do not copy their code.

### Header for files adapted from an Apache-2.0 repo

Put this at the top of the adapted file (use the comment syntax of the language):

```ts
// Adapted from <owner>/<repo>/<path> (Apache License 2.0).
// Original: https://github.com/<owner>/<repo>
// Changes: <short summary of what was changed>.
// Modified by Second Sight, Nov 2026.
// License text: THIRD_PARTY_LICENSES/<repo>-LICENSE
```

If the source repo has a `NOTICE` file, its content must be carried into our root `NOTICE`.

### Header for files adapted from an MIT repo

Keep the original copyright line and the MIT permission notice:

```py
# Adapted from <owner>/<repo>/<path> (MIT License).
# Original: https://github.com/<owner>/<repo>
# Copyright (c) <year> <original copyright holder>
# Changes: <short summary of what was changed>. Modified by Second Sight, Nov 2026.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# (Full text: THIRD_PARTY_LICENSES/<repo>-LICENSE)
```

### Header for files written with AI assistance

```py
# AI-assisted: <tool> helped draft <what>; reviewed and tested by <role>.
```

Also add a row to the per-file table in `docs/ai_acknowledgement.md`.
