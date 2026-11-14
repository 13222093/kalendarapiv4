# AI Acknowledgement

NASA Space Apps 2026 asks teams to disclose how they used AI ("Super Intelligence") tools. This file records where AI was used in Second Sight and where it was not. It is updated during the hackathon and summarized in the "Use of SI" field of the project page.

## Summary

| Area | AI used? | How | Human control |
|---|---|---|---|
| Background research | Yes | AI assistants helped search and summarize literature, NASA data documentation and public GitHub repositories from earlier/competing projects (benchmark of approaches and licenses). | Sources were opened and checked by the team; every reference we rely on is cited directly, not via the AI summary. |
| Ideation and PRD | Yes, with confirmation | AI helped organize the team's research into concept options and a product requirements document. We confirmed with the local Space Apps contact point (CP) before the event that this use is allowed. | Final concept, users, regions and science decisions were chosen by the team (`docs/decisions.md`). Evidence of the CP confirmation is kept in the team folder, not in this repo. |
| Code assistance | Yes, per file | AI coding assistants helped draft parts of the code during the hackathon (14-15 Nov). Each affected file is listed below and carries an `AI-assisted:` header comment. | All AI-assisted code is reviewed, run and tested by a team member before merge. |
| Science results and numbers | No | All numbers come from the deterministic pipeline run on NASA data. AI does not generate, estimate or "fill in" any result. | Numbers are cross-checked across app, slides, video and README (ticket SUB-07). |
| Alert brief text (app feature) | Planned | If enabled, an LLM drafts the Indonesian alert brief from a pipeline fact table; an automatic number verifier rejects any number not present in the fact table, with a template fallback. | Evaluated with an eval set in `eval/`. |
| Images, video, voice | To be filled | | |

## Per-file log (fill in during the hackathon)

| File / folder | Tool | What the AI did | Reviewed by (role) |
|---|---|---|---|
| `docs/` setup files (README, licenses, contributing, decisions) | AI coding assistant | Drafted structure and text from the team PRD | R5 |
| _add rows_ | | | |

## What AI was not used for

- Choosing the project idea from scratch: the idea comes from the team's own research and was confirmed with the CP.
- Producing any data value, calibration factor, validation metric or figure value.
- Writing code before the hackathon start (14 Nov 2026, 09:00 WIB).
