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
- **Peat sites where fire comes back:** the team's summary of 13 November (section 8.3, the peat niche).
- **"Today in my district"** (the condition now, a message to residents, the district disaster office and the village,
  advice drafted by AI): a team member's request on 15 November, after looking at FireLens and PeatForge.
- **The look** (which landing to keep, the palette, the home sections under the Story): the team's choices, made by
  looking at each build.

## What AI did

- **Code:** an AI coding assistant (Claude, in Claude Code) wrote most of the code in `app/src/` that is new in
  KalenderApi (Story, Season, the blind-zero and district cards, the Indonesia record page) and the scripts in
  `pipeline/visibility/`, under the team's direction. Every change is listed in `app/NOTICE.md`, `docs/APP.md` and
  `docs/DATA.md`.
- **Runs:** AI sessions ran Second Sight's pipeline and the visibility scripts, and recorded every command, input
  checksum and run time in `docs/DATA.md`. One 7-line patch to Second Sight's export (province kappa strata) was made
  after the team approved it; it is described in `docs/DATA.md` section 9.1.
- **Research and writing:** AI helped search and summarize competitor repositories and papers, and drafted
  documents (comparison, integration plan, PRD drafts). The team made the choices.
- **The submission build (15 November):** the same assistant, with several AI sessions working in parallel, wrote
  the code of that day: "Today in my district", the peat and district scripts, the home sections, the rebuilt Story,
  the interactive season player, the downloads, the brief, both languages, the colour palette and the tests. The
  files are listed in `app/NOTICE.md`.
- **Review:** two AI reviewers were asked to score the project as a science judge and as a local-impact judge
  would. Their findings (for example: say "under cloud: the satellite could not see", never "seen clearly"; lead with
  the 2017 to 2021 window; show the failed tests first) led to changes. They did not write the findings of the
  project.
- **The project page text and the narration script:** drafted by AI from the numbers in the data files, read and
  corrected by the team.

## AI inside the app

Two features call an AI model while the app runs, both on "Today in my district". The button "Draft advice with AI" sends
the numbers already on the page (district, hotspot counts, the level, the cloud history, the peat count) to an OpenAI
model (`gpt-6-luna`) through `app/public/api/advise.js`. Nothing about the visitor is sent. The model is told to use
only those numbers, to add none of its own, to give no forecast and no cause, and never to say there is no fire. The
draft is labelled "Drafted by AI" with the model's name and a line saying it must be checked before it is sent. The
three standard messages on that page are fixed templates filled with the page's numbers; they are not AI.

The panel "Ask about this district" (added on 16 November 2026, after the submission deadline) sends a question typed
by a resident or an officer, the last few turns of that conversation and the same numbers, plus the coordinates of the
newest hotspot and of the peat sites the page lists, to the same model through `app/public/api/ask.js`. The model is
told to answer from those numbers only, to give no forecast and no cause, never to say that a fire is out or that it
is safe, and to send anyone in danger to the village head or the district disaster office. Answers are labelled "AI
assistant". Nothing is stored; the panel asks visitors not to type names, phone numbers or addresses.

## AI in the demo video

The picture is a recording of the app, rendered frame by frame. The narration of the submitted video is a
text-to-speech voice (Microsoft Edge's read-aloud voice "Andrew", made with the `edge-tts` tool) reading the team's script.

## What AI did not do

- **No AI-generated numbers.** Every number on screen comes from NASA data (FIRMS, MODIS FireMask, GIBS imagery),
  Second Sight's deterministic pipeline, or the official SiPongi table, through code that can be rerun.
- **No AI-generated images.** The photos are NASA GIBS true-colour imagery.
- **No numbers from the AI draft or the AI assistant.** Both may only repeat numbers the page computed,
  and it is shown apart from them, marked as AI.
- **No NASA logo or flag** appears in anything AI made.
