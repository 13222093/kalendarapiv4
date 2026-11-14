# AI use in project 4

NASA Space Apps 2026 asks teams to acknowledge AI-made code and data. Second Sight's notes on the 2026 guides
(`vendor/second-sight/docs/02-pola-pemenang.md`) also say AI must not be used to generate the solution idea. The team
should check that rule against the official guide before submitting; this file says what was done here.

## Where the ideas came from (the team)

- **The challenge choice and the core idea** ("how much can you trust a zero?", Indonesia, peat, district by district):
  the team's own plan of 13 November and a teammate's summary (`kalenderapi_rangkuman.pdf`).
- **"Play the season"** (fires appearing and fading day by day): a team member's idea.
- **Second Sight** (the harmonization question, its method and its pre-written validation): the Second Sight team.
  Its own AI statement is `vendor/second-sight/docs/ai_acknowledgement.md`.
- **Building four parallel versions and comparing them:** the team's decision.

## What AI did

- **Code:** an AI coding assistant (Claude, in Claude Code) wrote most of the code in `app/src/` that is new in
  KalenderApi (Story, Season, the blind-zero and district cards, the Indonesia record page) and the scripts in
  `pipeline/visibility/`, under the team's direction. Every change is listed in `app/NOTICE.md`, `docs/APP.md` and
  `docs/DATA.md`.
- **Runs:** AI sessions ran Second Sight's pipeline unchanged (no patches to `vendor/second-sight/`) and the
  visibility scripts, and recorded every command, input checksum and run time in `docs/DATA.md`.
- **Research and writing:** AI helped search and summarize competitor repositories and papers, and drafted
  documents (comparison, integration plan, PRD drafts). The team made the choices.

## What AI did not do

- **No AI-generated numbers.** Every number on screen comes from NASA data (FIRMS, MODIS FireMask, GIBS imagery),
  Second Sight's deterministic pipeline, or the official SiPongi table, through code that can be rerun.
- **No AI-generated images.** The photos are NASA GIBS true-colour imagery.
