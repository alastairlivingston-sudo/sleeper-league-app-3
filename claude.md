# Borehamwood Plancy League — Data Pipeline (Project Memory)

## What this repo is
A small, automated data pipeline for a fantasy football league bot. Node scripts (zero dependencies) pull
from public APIs and write JSON into `docs/data/` and `docs/lore/`. A GitHub Action runs them daily and
commits the results, plus two builds of the app "PlAIncy / The Commissioner" — the league's statistician,
trade analyst and resident wind-up merchant:
- **`dist/plaincy.html`** (primary): one self-contained page — app + React bundled by esbuild, every data
  file and the lore inlined — published as a claude.ai artifact at a stable link (see "Publish route").
- **`commissioner.jsx`** (legacy paste-in target, 200 KB budget): the same app as a single JSX file.

## Hard rules (do not violate)
1. The Sleeper API sends `access-control-allow-origin: *`, so it CAN be called from a browser. The daily
   DATA PIPELINE (history/stats/rosters JSON) runs in the Node scripts here. The artifact's live "SCORES"
   tab additionally calls Sleeper directly at runtime (state/nfl, user, leagues, league users/rosters/
   matchups) for spoiler-safe live scores.
2. No API keys anywhere. Sleeper and FantasyCalc are public and keyless. Never commit a secret.
3. Verify, never fabricate. Scripts emit only real fetched data. If something can't be fetched, the
   retrying `get()` in `scripts/lib.js` surfaces the error and the script exits non-zero (the Action fails)
   rather than committing partial data. Empty week arrays (HTTP 200 `[]`) are the legitimate end-of-season
   signal; only a 404 or empty array ends a week loop — any other error aborts.
4. Shape-change policy: older builds may still read generated JSON by public raw URL, so JSON shapes are a
   contract. They may change ONLY additively or with a coordinated template update, sequenced
   tolerant-reader-first: update the template to accept the new shape, rebuild, THEN change the producer.
5. Code computes, the model only phrases. No number reaches the screen unless JS computed it; every record,
   standing, streak and H2H derives from the ONE fact table (`template/15-facts.jsx`); records use FINAL
   games only; unanswerable beats wrong (the can't-answer reply, never free-text numbers).

## Single source of truth
`league-config.json` (repo root) holds `username`, `leagueNameRegex`, `aliases`, `names`, `disambig`,
`teams`. The scripts read it via `scripts/lib.js`; `build-artifact.js` inlines it into the template so the
artifact's `canonical()`/name maps stay in sync. Add a manager or alias in ONE place here.

## The scripts (all Node 20, zero deps, share `scripts/lib.js`)
`scripts/lib.js` — shared `get()` (retry 429/5xx/network, flag 404 via `err.notFound`), `getPlayers()`
  (multi-MB `/players/nfl`, cached to tmpdir so it downloads once per run), `skillPosMap`, scoring helpers
  (`playerPos`/`posPoints`/`starterList`/`benchList`), league discovery (`findLeague`/`findActiveLeague`),
  `playoffWeekStart`, and `writeJson` (stamps `meta.generated` on fixed-shape object files).
- `fetch-history.js`  -> `docs/data/history.json`
    Walks `previous_league_id` back through EVERY season; per season: standings (wins/losses/pf/pa/high),
    champion (from winners_bracket), and the game list with positional breakdowns.
- `fetch-rosters.js`  -> `docs/data/rosters.json`
    Current rosters. Shape: `{ "Team Name (@handle)": [{ id, name, pos }, ...] }`. Team-keyed map — it is
    NOT stamped with `meta` (a sibling key would be mis-read as a team by the artifact).
- `fetch-stats.js`    -> `docs/data/stats.json`
    Current-season standings, head-to-heads, per-game breakdowns, extremes.
- `fetch-fc-values.js` -> `docs/data/fc-values.json`  (FantasyCalc redraft VALUES, half-PPR/1QB/8-team.)
- `fetch-trades.js`    -> `docs/data/transactions.json`  (actual Sleeper TRADES across all seasons.)
    NB: file names vs output names are intentionally crossed for backward compatibility —
    `fetch-fc-values.js` writes `fc-values.json`, `fetch-trades.js` writes `transactions.json`. Do not
    rename the OUTPUT files; already-pasted artifacts fetch them by URL.
- `build-lore.js`     -> `docs/lore/{master,archive-index,quotes-index}.json`  (parses `lore/*.md`).
- `build-facts.js`    -> `docs/data/games.json`  (the FACT TABLE — see below; one row per line so the
    refresh change detector works). Runs the template partial `15-facts.jsx` via `load-partials.js`.
- `build-alltime.js`  -> `docs/data/alltime.json`  (career/H2H/records/streaks come FROM the fact table;
    consistency, positional, bench, playoff records from history-details; shape unchanged).
- `build-artifact.js` -> `commissioner.jsx`  (inlines data into the template — history/stats lean: default
    `status`/`phase`/`playoff:false` and unused H2H/player arrays dropped to fit the 200 KB budget).
- `build-html.js`     -> `dist/plaincy.html`  (esbuild devDependency; SKIPs without it).
- `stat-corrections.js` — diffs FINAL scores vs `HEAD:docs/data/history.json`; the refresh commit message
    names corrected weeks ("2026 wk 11 stat corrections"). Corrections are allowed, never a failure.
- `load-partials.js`  — loads plain-JS template partials into a Node `vm` (pipeline + tests share code).
- `validate.js`       -> data-contract gate (run before commit). Season invariants live in
    `validate-history.js` (shared with `test-status.js`). Complete season (bracket final has a winner):
    8 standings rows + champion, all games final, playoff games present. In-progress season: champion may
    be null, live games only in the current week, no scheduled games in `games[]`. Both: contiguous FINAL
    weeks; per-manager FINAL regular-season game count == standings W/L (the real truncation detector);
    standings `high` == games max (DR-4); stats↔history reconciliation (h2h W/L sums, `throughWeek`); every
    trade non-empty; careerRankings pa != 0; no leftover `__PLACEHOLDER__`; `meta.generated` (`--fresh`).
    Warnings (non-fatal) are printed for known Sleeper quirks — see "Game status" below.

## Game status, phase, byes (DR-3/DR-4) — empirical findings (2026-11-21)
- **Sleeper pre-creates every week's matchups** (weeks 1–18) with 0 points once the season starts, so a
  non-empty week does NOT mean played. This broke every refresh from 2026-09-10 (validate saw 14
  "regular-season games" vs W+L of 0…10) and no data was committed after 2026-09-06.
- **Status rule** (`lib.weekStatus`): league `complete` → final; `pre_draft`/`drafting` → scheduled;
  `in_season`: week ≤ `league.settings.last_scored_leg` → `final`, ≤ `state.week` → `live`, else
  `scheduled`. Verified: `state.week`=11, `last_scored_leg`=10, every roster W+L = 10, week 11 had partial
  scores, weeks 12–18 all zeros. `last_scored_leg` is used for `final` because it is what roster W/L track
  (the plan's `week < state.week` rule agreed on the day checked; if Sleeper advances `state.week` before
  scoring, `last_scored_leg` stays correct).
- History season gains (additive): `complete`, `lastFinalWeek`, `liveWeek`, `byes[]`, `schedule[]`
  (regular-season `{week,a,b}` only — future playoff pairings are placeholders); games gain `status`,
  `phase`. stats.json gains `throughWeek`.
- **Phase** (`lib.gamePhase`): winners-bracket match between two teams in the playoff field → `playoff`
  (incl. 3rd place); 5th-place (p=5), losers bracket, or any other playoff-week pairing → `consolation`.
  Needed because Sleeper re-filled the 2024 week-17 3rd-place slot (`t1_original` 1 / `t2_original` 3) with
  the toilet-bowl teams 2 v 8.
- **`high` (cause F)**: the old max over every matchup entry included `matchup_id: null` entries —
  eliminated teams in weeks 16–17 and the whole of week 18 (beyond the 3-round bracket). Those are not
  games. Decision: a round-1 sit-out by a playoff-field team is a **bye** (`byes[]`, counts toward `high`);
  every other null entry is ignored. Fixed: drjkay 2024 213.46→192.72, benjlev 2024 142.9→131.44, GSac 2023
  146.14→135.02.
- **Known quirk (warning only):** in 2023, Sleeper's roster W/L disagree with the stored scores on three
  close games (6 managers off by one result), most likely post-lock stat corrections. Game counts still
  reconcile. We never "correct" either side; `validate.js` prints `history.games.wl` warnings.

## League facts (for sanity-checking output)
1-QB redraft, WR/RB/TE flex, half-PPR, 8 teams. Structured data runs 2023→present (Sleeper era); lore goes
back to 2017. 2025 champion: Fourth and Golda Meir (@AlastairL / handle `AlastairL`), beat @dpol in the
final. If fetched data contradicts known facts, the parse is wrong — investigate, don't "correct" the data.

## Fact table (Phase 1) — one table behind everything
`template/15-facts.jsx` (PLAIN JS, no JSX) builds, from history: `games` — two rows per game, one per
manager (`id`, `gameId`, season, week, phase, status, manager, opponent, pf, pa, result W/L/T, margin,
combined, weekRank, allPlayW/L, benchPts, pos) plus one `bye: true` row per playoff bye; `seasons` — one row
per manager per season (W-L-T, PF/PA, rank, all-play, expectedWins, luck, playoffFinish, complete/current);
`records` — 17 named records, each `{regular, all}`, ties return every tied row, plus `records.current`;
`current` — latest season, lastFinalWeek, liveWeek. The SAME code runs in the browser (StatsTab, badge,
This Week, Record Book, recaps) and in Node (`build-facts.js`, `build-alltime.js`, tests). Season W/L in
the table come from the scores; Sleeper's roster W/L differ in 2023 (see quirk above) — counts reconcile.

## Query engine v2 (Phase 2) — code answers, the model only phrases
`template/20-query-v2.jsx` (PLAIN JS): spec `{v:2, table: games|seasons|players|record, record, where
{managers, opponents, seasons, weeks, phase (default regular), result, status (default final), gameIds,
positions, player, playoffFinish}, groupBy, select, orderBy, limit (default 10, max 25)}`.
- `validateSpec` whitelists tables/columns/handles/records/seasons — anything unknown is rejected.
- `fastPlan` = a regex RECIPE table (every PLAN seed question + standings, this week, H2H, records,
  streaks, best/worst week...) → spec with NO model call. `followUpSpec` resolves "that game / total score /
  who won it" (gameIds of the previous top row) and "and in 2024?" against `{lastQ, lastSpec, lastResult}`
  that `ChatTab` keeps per tab. `disputeReply` re-shows both rows of the game ("Josh won 168.56–151.40")
  and never claims fabrication. Otherwise the model planner (`plannerPrompt`) proposes a spec.
- A rejected/`none` spec on a numeric-sounding question → `CANT_ANSWER` with suggestions. Never free text.
- `runQuery` executes over the fact table; `ResultTable` renders rows from `COLUMNS` (labels, 2 dp, W/L
  chips). Single-row/record answers get a JS `templateSentence` (no model call); multi-row answers get ONE
  or TWO model sentences (`narrationPrompt`, < 4 KB) that must pass `numberGuard`: every number must be in
  the rows (2 dp / 1 dp / integer forms, seasons, weeks, counts) or the sentence is replaced by the
  template. Non-data chat falls back to a recap prompt and the same guard against that prompt.
- Banter + Stats chat get `leagueRecap()` (this week, standings, champions, career, records) — never raw
  JSON; Banter < 20 KB; `guardSentences` drops any roast sentence with an unverified number.

## Automation
`.github/workflows/refresh.yml` runs the pipeline daily (cron `0 8 * * *`, 08:00 UTC) + manual
`workflow_dispatch`. Order: fetch → build-template (+`--check`) → build-lore → build-facts → build-alltime →
build-artifact → install dev tools (`--no-save`) → build-html → validate `--fresh` → test-status →
test-facts → test-questions → test-alltime → test-artifact → test-render → commit. It **only commits when
real data changed** — every run rewrites `meta.generated`/`BUILT_AT`, so the "Detect real data changes"
step ignores those lines. The commit carries `docs/`, `commissioner.jsx` and `dist/plaincy.html`, and its
message names stat-corrected weeks. Permissions are `contents: write` only. NB: GitHub disables scheduled
workflows on a public repo after 60 days without repo activity — the daily bot commits keep it alive
in-season; check `refresh.yml` is enabled after a long off-season.

## Build/run
No install needed for the data pipeline (zero deps). `npm run refresh` runs the whole pipeline; `npm run
validate` checks the data contract; `npm run build` rebuilds derived tables + both artifacts (`build-html`
needs `npm install` for esbuild). `npm test` runs the full quality gate (needs dev deps for render + HTML).

## Testing & quality gates (why the artifact stops failing to load)
`REQUIREMENTS.md` is the testable contract — every requirement has an ID (`FR-*` functional, `TR-*`
technical, `UR-*` user-journey, `QR-*` question engine, `DR-*` data math) mapped to a test:
- `test-status.js` (DR-3/4/6: status, phase, byes, in-progress validator, stat corrections),
  `test-facts.js` (DR-5: independent plain-loop recompute of every named record + PLAN seed answers on the
  frozen `fixtures/history-2023-2025.json`), `test-questions.js` (QR-1..3 + UR-7 at engine level: 24 seed
  phrasings with zero model calls, junk planner → can't-answer, number guard), `test-alltime.js` (DR-1/2
  golden, compared with sorted keys). All zero-dep.
- `scripts/test-artifact.js` — ZERO-DEP structural gate. **Runs automatically at the end of
  `build-artifact.js`**, so a broken file is never written/committed (build exits non-zero). Catches the real
  load-failure causes: a data constant that is not valid JSON (truncation — TR-2), a leftover
  `__PLACEHOLDER__` (TR-1), missing `import React` (TR-4), a missing component (FR-2), oversize file that
  truncates on paste (TR-7), a date-pinned model id (TR-8), hand-editing of the built file (TR-10). When
  `@babel/core` is present it also does a real transpile (TR-5) — the authoritative parse check.
- `scripts/test-artifact.js` also checks `dist/plaincy.html` (TR-12: page basics, inline bundle, inlined
  JSON with every data key, ≤ 16 MB, warn > 2 MB).
- `scripts/test-render.js` — the general USER TEST (`UR-*`, FR-8..15). Transpiles the artifact, mounts
  `<App/>` in jsdom with the model bridge + fetch mocked, switches every tab, drives chat sends, replays the
  screenshot conversation typed into the real ChatTab (UR-7, frozen fixture), checks the badge/This
  Week/Record Book/banter size, the offline fallback, the legacy model chain, and runs the REAL
  `dist/plaincy.html` in jsdom with `claude.use("sample")` stubbed and with `use()` → null (UR-8). It
  creates a jsdom window BEFORE requiring react-dom (React feature-detects `input` events at load). Needs
  dev deps; prints SKIP if absent. CI installs them with `--no-save`.
- **The data-pipeline scripts stay zero-dependency; test + bundling tooling lives only in
  `devDependencies`.**
- GROWTH RULE: when you add a feature or hit a new failure mode, add a requirement to `REQUIREMENTS.md`
  AND an assertion to the matching test. The harness is meant to accrete.

## Claude artifact runtime — hard lessons

### Model IDs: use bare aliases with a fallback chain, never date-pinned
`claudeCall` in the template tries `['claude-sonnet-5','claude-sonnet-4-5','claude-haiku-4-5']` in order,
advancing on 404, with retry/backoff on 429/5xx and a 60s timeout. A date-pinned ID
(`claude-sonnet-4-20250514`) previously retired and 404'd every AI feature — do not reintroduce one.

### Calling the model: the bridge adapter (2026-11)
`claudeCall` (`00-header.jsx`) tries, in order: **`await window.claude.use("sample")`** — published claude.ai
artifacts declare `capabilities: {sample: {}}`; planner → `sample.json(turns, {modelTier: "quick"})`,
narration/chat → `sample(turns, {modelTier: "quick", cache: false})`, where `turns` is a user/assistant list
starting with an instructions user turn and ending on a user turn — then `window.claude.complete` (legacy
paste-in runtime), then the proxied Messages API. `use()` resolves asynchronously (up to ~10 s, or null):
the UI renders immediately; `useAIState()` settles `on`/`off`; when `off`, Banter shows a notice, the
trade verdict hides, and Stats keeps every deterministic answer. `not_granted`/`sampling_disabled` turn AI
off for the view.

### Legacy: window.claude.complete() (2026-07 paste-in runtime)
The current Claude.ai artifact runtime is a **sandboxed iframe** (`*.claudeusercontent.com`) under a
**strict CSP**. Two consequences that reversed earlier guidance:
1. **React is imported, not global.** Use `import React, { useState, ... } from "react";` at the top.
   A bare `const { useState } = React;` fails to render (no global `React`).
2. **A raw `fetch('https://api.anthropic.com/v1/messages')` is BLOCKED by the CSP** — this is why the
   bots went silent after the runtime update. The sanctioned bridge is **`window.claude.complete(promptString)`**,
   which the host injects; it takes ONE string and returns a string (no system/messages split, no memory —
   flatten the exchange yourself), and is billed to the *viewer's* account.

```js
// CORRECT (current runtime) — host-provided bridge, no key, no external fetch
const out = await window.claude.complete(systemPrompt + '\n\n' + conversationAsText + '\n\nAssistant:');
```

`claudeCall` uses `window.claude.complete` when present and falls back to the old proxied Messages-API
fetch otherwise, so the artifact works in both the new and legacy runtimes. NOTE: `window.claude.complete`
historically had a prompt-size budget (~30–35 KB, undocumented); keep prompts lean (Phase-4 slimming already
did most of this) and watch for a bot that renders but claims "no data" — that is the truncation signature.
The sandbox also blocks the jsDelivr/Pages data fetch, so the app runs on its **inlined data** — which is
why the published HTML (republished with fresh data) replaced "paste once and live-fetch".

### Keep system prompts lean (target < 20 KB)
Put only what the model needs for NARRATION in the prompt; use the deterministic query layer for any numeric
lookup. Do NOT dump raw weekly scores, full H2H-by-season tables, or per-game player lists. A hand-crafted
summary (nemesis, bunny, playoffRecords) beats the entire alltime.json. Working prompt ~5 KB; a broken one
was ~66 KB.

### Template vs built artifact — and the partials
Source of truth is `template/*.jsx` (ordered partials: 00-header, 15-facts, 20-query-v2, 22-hooks,
30-chat-components, 40-live-and-app). `15-facts` and `20-query-v2` must stay PLAIN JS (no JSX, no imports,
no regex lookbehind) — Node loads them with `vm`. `build-template.js` concatenates them BYTE-EXACTLY into
`commissioner.template.jsx` (committed, generated); `build-artifact.js` then inlines data via
`__PLACEHOLDER__` substitution into `commissioner.jsx`, and `build-html.js` replaces the same placeholders
with reads from the page's `plaincy-data` JSON and bundles it. So: `template/*.jsx` →
`commissioner.template.jsx` → `commissioner.jsx` + `dist/plaincy.html`.
- EDIT THE PARTIALS, not the monolith. `build-template.js --check` (run in CI) fails if the committed
  monolith drifts from the partials — i.e. if someone hand-edited `commissioner.template.jsx` directly.
  After editing a partial, run `node scripts/build-template.js` to regenerate the monolith and commit both.
- NEVER hand-edit `commissioner.jsx`. When making architecture changes, edit the partial so the next
  refresh doesn't clobber the fix.

### Prompts are token-lean by construction
Numeric questions never reach a big prompt: the query engine answers them and narration gets ≤ 25 result
rows (< 4 KB). The chat-fallback/Banter prompts use `leagueRecap()` + compact pipe tables
(`alltimeSummary`, `tradesLines`), never `JSON.stringify` dumps. New numeric facts go through the fact
table + query engine, never a raw JSON dump.

### Data: inlined is primary, live fetch optional
`useLeagueData()` starts from the inlined data and still tries jsDelivr then GitHub Pages (daily `?v=`
buster), but only takes a fetched copy whose `history.meta.generated` is at least as new as the inlined one
(jsDelivr can serve a stale cache). The header badge shows "SEASON · through Week N" from the fact table —
never a live/snapshot state.

### Publish route (retires "paste once")
`dist/plaincy.html` is published as a claude.ai artifact with `capabilities: {sample: {}}` — one stable
link. A scheduled task (Tuesdays + Fridays ~10:00 UK, after MNF and the 08:00 UTC Action; Friday catches
stat corrections) pulls the repo, checks the Action committed fresh data that week, and republishes
`dist/plaincy.html` to the same link, flagging if the data has not advanced. The artifact lives at that
link on any device; the keyless model call works because claude.ai serves `sample` to the viewer.
`commissioner.jsx` remains buildable for the legacy paste-in runtime.
