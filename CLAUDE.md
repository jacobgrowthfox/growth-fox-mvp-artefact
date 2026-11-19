# GrowthFox MVP artifact

The source of the **GrowthFox MVP** artifact: https://claude.ai/artifact/VDhgzv4ymCcsxvCYLgbM4U

It's a single-page dashboard (Executive, Paid Media, Data and Engineer foxes, All actions, Ledger) published
as a multi-file artifact. Sample clients (Nordlys Coffee, Flamehouse Burgers) are generated in code; the real
client (Hue Therapy) loads its Google Ads data from the artifact's shared store, exported from BigQuery.

## Workflow

Standing instruction from the owner: after every change, without asking first:

1. Run `node tools/smoke.js` (and look at a screenshot for visual changes). Fix anything it reports.
2. Commit with a clear message and push straight to `main`.
3. Publish only the changed files to the artifact (see Publishing below), so `main` and the live page stay in step.

If the owner says they edited files themselves, pull `main` first, then publish what changed.

## Layout

Everything that gets published lives in `app/`. Paths in `app/` are the published paths.

- `app/index.html`: the page itself: sidebar markup plus the ordered list of stylesheets and scripts. No
  `<!doctype>`/`<head>`/`<body>`: claude.ai wraps the page in its own document skeleton at publish time.
- `app/css/*.css`: styles, linked in a fixed order (the cascade depends on it). Design tokens are in `base.css`.
  - `base.css`: tokens, shell and sidebar, page header, sections, buttons, tables
  - `actions.css`: recommendation cards, the "Mark as done" dialog
  - `foxes.css`: Data Fox endpoints, Paid Media areas and channels, Engineer Fox, connection map
  - `overview-ledger.css`: fox cards, "what you changed", ledger, tracking checks, fox pages, charts
  - `executive.css`: Executive page sections, revenue formula, brief preview, volume discrepancy, data quality hero
  - `datepicker-motion.css`: date range picker, fox animation, toast, footnote
- `app/data/*.js`: sample data: client configs (`clients.js`), endpoints and parameters (`endpoints.js`),
  Engineer Fox links, streams and pairs (`engineer.js`).
- `app/engine/*.js`: the rule engine (no AI; every number comes from code).
  - `core.js` (DAY, END, rng), `engineer.js` (coverage, volume and gap health), `real-data.js` (shared-store
    data for real clients), `generate.js` (daily data, PULSE scoring, aggregation, data quality),
    `rules.js` (`build()`: every recommendation, ranking and gates), `rubric.js` (Paid Media rubric),
    `scans.js` (period scans and settings checks for real clients), `period-findings.js`,
    `format.js` (money/short helpers and **the `GF` export object**).
- `app/ui/*.js`: the interface. `core.js` (`$`, `esc`, `store`, icons, fox artwork), `state.js` (state and
  the shared ledger), `model.js` (`ctx()`, periods), `charts.js`, `cards.js` (recommendation card, evidence,
  done dialog), `date-picker.js`, `changes.js`, `executive.js`, `brief.js` (brief + PDF), `pages/*.js` (one
  per page), `render.js` (`render()`, fox motion, toast), `events.js` (click/submit/change handlers, `route()`),
  `boot.js` (start-up: shared store connection and first route). **`boot.js` must stay last.**

### How the scripts fit together

All scripts are classic `<script src>` files loaded in the order listed in `index.html`, sharing one global
scope. That means:

- A top-level `const`/`let`/`function` in one file is visible in every other file. **Names must be unique
  across all files**: a duplicate top-level `const` or `let` is a SyntaxError that stops the page loading.
- The UI reaches the engine through `GF.*`. A new engine function the UI needs must be added to the
  `GF` object at the bottom of `engine/format.js`.
- Code that runs at load time (not inside a function) must only use things defined in earlier files.
  Start-up work belongs in `ui/boot.js`.
- A new file must be added to `index.html` in the right place (and published, see below).

## Checking a change

```bash
node tools/smoke.js
```

Opens every page for each client in headless Chromium and fails on any error. Run it before publishing.

## Publishing

Publish with the Artifact tool to the existing URL. **Only send the files that changed**: files left out stay
as they are on the artifact, which is what keeps edits cheap (you only need to read the files you change).

- Changed only `app/ui/pages/ledger.js`:
  `Artifact publish` with `url` = the artifact URL above, `file_path` = `app/index.html`, `root` = `app`,
  `files` = `{"ui/pages/ledger.js": "ui/pages/ledger.js"}`.
- Changed `index.html` itself: same call, `files` can be omitted or list the other changed files.
- Removed a file: pass `null` for its path in `files`, and remove it from `index.html`.
- Don't pass `capabilities` (omitting it keeps the page's `db` and `user` capabilities) or `contract`.
- If the artifact has a newer version than the last one published from the repo (someone edited it outside
  the repo), read it first and merge; all changes should go through this repo.

## Real client data (BigQuery)

Hue Therapy's numbers are not in this repo. They load at view time from the shared store at
`clients/hue-therapy/gads/*` (docs `meta`, `terms`, `daily-<year>`, `segments-<year>`, `ads-<year>`,
`settings-now`), exported from BigQuery (`growthfox_marts`). The shapes are parsed in `engine/real-data.js`
(`setReal`). The shared ledger, decisions, revenue model choice and logged changes live under
`clients/<client>/ledger`, `/decisions`, `/settings/revenue` and `/changes`.
