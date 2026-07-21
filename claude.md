# Borehamwood Plancy League — Data Pipeline (Project Memory)

## What this repo is
A small, automated data pipeline for a fantasy football league bot. Node scripts (zero dependencies) pull
from public APIs and write JSON into `docs/data/` and `docs/lore/`. A GitHub Action runs them daily and
commits the results. A separate shareable Claude artifact (`commissioner.jsx`, built from
`commissioner.template.jsx`) fetches those JSON files live to power "The Commissioner" — the league's
statistician, trade analyst and resident wind-up merchant.

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
4. Shape-change policy: the artifact reads generated JSON by public raw URL, so JSON shapes are a contract.
   They may change ONLY with a coordinated template update, sequenced tolerant-reader-first: update the
   template to accept the new shape, rebuild, re-paste the artifact once, THEN change the producer scripts.

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
- `build-alltime.js`  -> `docs/data/alltime.json`  (career/H2H/records aggregates; `canon()` reads
    aliases from `league-config.json`).
- `build-artifact.js` -> `commissioner.jsx`  (inlines data into the template — see below).
- `validate.js`       -> data-contract gate (run before commit). Invariants: 8 standings rows + champion
    per completed season; contiguous weeks; per-manager regular-season game count == standings W/L (the
    real truncation detector); stats↔history reconciliation; every trade non-empty; careerRankings pa != 0;
    no leftover `__PLACEHOLDER__` in the built artifact; `meta.generated` present/fresh (`--fresh`).

## League facts (for sanity-checking output)
1-QB redraft, WR/RB/TE flex, half-PPR, 8 teams. Structured data runs 2023→present (Sleeper era); lore goes
back to 2017. 2025 champion: Fourth and Golda Meir (@AlastairL / handle `AlastairL`), beat @dpol in the
final. If fetched data contradicts known facts, the parse is wrong — investigate, don't "correct" the data.

## Stats engine — deterministic, never LLM arithmetic
The Stats bot must NEVER compute win/loss/points itself. Two layers:
1. Pre-computed tables in `build-alltime.js` (careerRankings, symmetric allTimeH2H, nemesis/bunny, records,
   seasonRankings) — the narration prompt gets these tables, not the raw game list.
2. A query engine in the artifact (`flattenGames`/`runStatQuery`/`planStatQuery`/`formatQueryResult`): the
   model plans a JSON query spec, JS executes it deterministically, the result is injected as an
   authoritative "DETERMINISTIC QUERY RESULT" block for narration.

## Automation
`.github/workflows/refresh.yml` runs the pipeline daily (cron `0 8 * * *`, 08:00 UTC) + manual
`workflow_dispatch`. It validates before committing and **only commits when real data changed** — every run
rewrites `meta.generated`/`BUILT_AT` timestamps, so the "Detect real data changes" step ignores those lines
to avoid daily off-season no-op commits. Permissions are `contents: write` only.

## Build/run
No install needed for the pipeline (zero deps). `npm run refresh` runs the whole pipeline; `npm run validate`
checks the data contract; `npm run build` rebuilds derived tables + artifact. `npm test` runs the full
quality gate (data + artifact structure + render — the render test needs dev deps, `npm install`).

## Testing & quality gates (why the artifact stops failing to load)
`REQUIREMENTS.md` is the testable contract for `commissioner.jsx` — every requirement has an ID
(`FR-*` functional, `TR-*` technical, `UR-*` user-journey) mapped to a test. Two gates enforce it:
- `scripts/test-artifact.js` — ZERO-DEP structural gate. **Runs automatically at the end of
  `build-artifact.js`**, so a broken file is never written/committed (build exits non-zero). Catches the real
  load-failure causes: a data constant that is not valid JSON (truncation — TR-2), a leftover
  `__PLACEHOLDER__` (TR-1), missing `import React` (TR-4), a missing component (FR-2), oversize file that
  truncates on paste (TR-7), a date-pinned model id (TR-8), hand-editing of the built file (TR-10). When
  `@babel/core` is present it also does a real transpile (TR-5) — the authoritative parse check.
- `scripts/test-render.js` — the general USER TEST (`UR-*`). Transpiles the artifact, mounts `<App/>` in
  jsdom with the model bridge + fetch mocked, switches every tab, drives a chat send, and confirms the
  offline snapshot fallback. Needs dev deps (`@babel/*`, `react`, `react-dom`, `jsdom`); prints SKIP if
  absent so zero-install runs are unaffected. CI installs them with `--no-save`.
- CI (`refresh.yml`) runs `validate.js --fresh` → `test-artifact.js` → `test-render.js` before the commit
  step. **The pipeline scripts stay zero-dependency; test tooling lives only in `devDependencies`.**
- GROWTH RULE: when you add a feature or hit a new failure mode, add a requirement to `REQUIREMENTS.md`
  AND an assertion to the matching test. The harness is meant to accrete.

## Claude artifact runtime — hard lessons

### Model IDs: use bare aliases with a fallback chain, never date-pinned
`claudeCall` in the template tries `['claude-sonnet-5','claude-sonnet-4-5','claude-haiku-4-5']` in order,
advancing on 404, with retry/backoff on 429/5xx and a 60s timeout. A date-pinned ID
(`claude-sonnet-4-20250514`) previously retired and 404'd every AI feature — do not reintroduce one.

### Calling the model: window.claude.complete() — the runtime changed (2026-07)
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
Because the CSP may also block the jsDelivr/Pages data fetch, the app can fall back to the **inlined
snapshot** — so a data refresh may again require a rebuild + re-paste in the new runtime.

### Keep system prompts lean (target < 20 KB)
Put only what the model needs for NARRATION in the prompt; use the deterministic query layer for any numeric
lookup. Do NOT dump raw weekly scores, full H2H-by-season tables, or per-game player lists. A hand-crafted
summary (nemesis, bunny, playoffRecords) beats the entire alltime.json. Working prompt ~5 KB; a broken one
was ~66 KB.

### Template vs built artifact — and the partials
Source of truth is `template/*.jsx` (ordered partials: 00-header, 10-analytics, 20-query-engine,
30-chat-components, 40-live-and-app). `build-template.js` concatenates them BYTE-EXACTLY into
`commissioner.template.jsx` (committed, generated); `build-artifact.js` then inlines data via
`__PLACEHOLDER__` substitution into `commissioner.jsx`. So the chain is: `template/*.jsx`
→ `commissioner.template.jsx` → `commissioner.jsx`.
- EDIT THE PARTIALS, not the monolith. `build-template.js --check` (run in CI) fails if the committed
  monolith drifts from the partials — i.e. if someone hand-edited `commissioner.template.jsx` directly.
  After editing a partial, run `node scripts/build-template.js` to regenerate the monolith and commit both.
- NEVER hand-edit `commissioner.jsx`. When making architecture changes, edit the partial so the next
  refresh doesn't clobber the fix.

### Stats prompt is token-lean by construction
The Stats narration prompt uses compact pipe-delimited tables (`careerTable`/`alltimeSummary`/
`tradesLines`/`currentSeasonBlock`), NOT `JSON.stringify` of the aggregates — a field name is paid for
once, not once per manager (~73% fewer chars: 51K→14K). The big matrices (allTimeH2H, weeklyScores,
per-season boards) are NOT in the prompt; the deterministic query engine answers those exactly on demand.
`planStatQuery` also has a client-side fast-path (`fastPlan`/`matchManagers`) that answers common
H2H/totals questions WITHOUT a planner model call, plus a session `SPEC_CACHE`. Keep this discipline:
new numeric facts go through the query engine or a compact encoder, never a raw JSON dump.

### Self-refresh: live-fetch so you paste the artifact only ONCE
`useLeagueData()` fetches JSON from jsDelivr (CDN) first, then GitHub Pages fallback; both send
`access-control-allow-origin: *`. Inlined constants are the OFFLINE FALLBACK (initial useState + silent
catch). A daily cache-buster `?v=YYYY-MM-DD` pulls fresh data each calendar day. Net: DATA changes need no
re-paste; only CODE changes to the template do.

### Where the app runs / multi-device
The artifact lives inside its claude.ai chat — open that chat on any device to use it. It is NOT a
standalone hosted site: the keyless model call only works because claude.ai proxies it. Hosting elsewhere
would require a serverless proxy holding a real ANTHROPIC_API_KEY and would incur per-call cost.
