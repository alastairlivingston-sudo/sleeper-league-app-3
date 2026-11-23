# commissioner.jsx — Requirements & Test Matrix

The artifact (`commissioner.jsx`) is generated from `commissioner.template.jsx` by
`scripts/build-artifact.js`. This document is the **contract the generated file must
satisfy before it ships**. Every requirement has a stable ID and is enforced by an
automated test:

- **`scripts/test-artifact.js`** — zero-dependency structural gate. Runs automatically
  at the end of every `build-artifact.js` run and in CI. A failure aborts the build so a
  broken artifact is never written/committed. Covers `FR-*` (structure) and all `TR-*`.
- **`scripts/test-status.js`** — zero-dependency data-rule gate for `DR-3`/`DR-4`
  (status tagging, bracket phase and bye rules, in-progress-season validator) on
  frozen mid-season fixtures. Runs in `npm test` and CI.
- **`scripts/test-render.js`** — real headless render (Babel + jsdom + React). Mounts
  `<App/>`, exercises every tab and a chat send, asserts zero uncaught errors. Covers
  `UR-*` (user journey). Requires dev dependencies; skips cleanly if absent.

`claude.md` remains the authoritative architecture; this file is the testable projection
of it. **When you add a feature or learn a new failure mode, add a requirement here and a
matching assertion in the test — that is how the harness grows.**

---

## Why this exists
The artifact repeatedly "failed to load" when pasted into a Claude.ai artifact. Root
causes were always one of: truncated or corrupt inlined JSON, an unbalanced delimiter from a
bad substitution, a leftover `__PLACEHOLDER__`, a missing `import React`, or an oversized
file that the paste truncated. `validate.js` gates the *data*; this harness gates the
*artifact* — the two together mean a green build is a loadable build.

---

## Functional requirements (FR)

| ID | Requirement | Test |
|----|-------------|------|
| FR-1  | The artifact declares a default-exported `App` component. | test-artifact |
| FR-2  | All four tabs are present and wired: `StatsTab`, `BanterTab`, `TradeGrader`, `LiveTab`. | test-artifact |
| FR-3  | The `TABS` nav array lists exactly: stats, banter, trade, live. | test-artifact |
| FR-4  | `useLeagueData` fetches live JSON and falls back to inlined snapshot on failure. | test-artifact |
| FR-5  | `claudeCall` is a bridge adapter, tried in order: `claude.use("sample")` (planner → `sample.json`, narration/chat → `sample`, both `modelTier: "quick"`, narration `cache: false`), then `window.claude.complete` (legacy paste-in runtime), then the proxied Messages API. The UI renders before `use()` resolves; when no bridge is available AI features hide and deterministic answers keep working. | test-artifact, test-render (UR-8) |
| FR-6  | Query engine v2 is present: fact table (`buildFactTable`), spec whitelist (`validateSpec`), executor (`runQuery`), recipe table (`fastPlan`), orchestrator (`answerStatQuestion`), `numberGuard`, and the code-rendered `ResultTable`. | test-artifact |
| FR-7  | Lore retrieval (`useLore`/`retrieveLore`) is present for the Banter tab. | test-artifact |
| FR-8  | App renders without throwing; the STATS tab (default) shows content. | test-render |
| FR-9  | Switching to each tab (Banter, Trades, Scores) renders without error. | test-render |
| FR-10 | A chat send in the Stats tab calls the model bridge and renders a reply. | test-render |
| FR-11 | With live fetch failing, the app still renders from the inlined snapshot. | test-render |
| FR-12 | The Stats tab opens with a collapsible **This Week** card for the last completed week, from the fact table: every result, week high/low, closest game, the upset (winner with the worst week rank) and a mini standings table (rank, W-L, PF, streak). Renders from fixture data too. | test-render, test-questions |
| FR-13 | The **Record Book** panel (no model) lists every named record with regular/all and season filters; each game row shows both sides. | test-render |
| FR-14 | The header badge reads "SEASON · through Week N" (last FINAL week), plus "· Week N+1 live" when live rows exist, or "· season complete"; the tooltip shows the build time. No live/snapshot dot. | test-render, test-questions |
| FR-15 | Banter and the Stats chat fallback get a compact fact-table recap (this week, standings, champions, career, named records) instead of raw JSON; Banter prompt < 20 KB; any roast sentence carrying a number not in the prompt is dropped. | test-render, test-questions |

## Technical requirements (TR)

| ID | Requirement | Rationale | Test |
|----|-------------|-----------|------|
| TR-1  | No unfilled `__PLACEHOLDER__` tokens remain. | A leftover token is a syntax error. | test-artifact |
| TR-2  | Every inlined data constant (`HISTORY_DATA`, `ROSTERS_DATA`, `TRADE_VALUES`, `ALLTIME_DATA`, `TRANSACTIONS_DATA`, `PLAYER_SCORES`, `LORE_DATA`) is syntactically valid JSON or `null`. | Truncated/corrupt data is the #1 load failure. | test-artifact |
| TR-3  | Braces `{}`, brackets `[]`, and parens `()` are balanced across the whole file. | An unbalanced pair from a bad substitution breaks parsing. | test-artifact |
| TR-4  | `import React, { … } from "react";` is present (React is imported, not global, in the sandbox). | Bare `React.useState` fails to render under the current runtime. | test-artifact |
| TR-5  | The file transpiles cleanly with `@babel/preset-react` (no JSX/syntax errors). | Direct proof it will parse in the host. | test-render (and test-artifact when Babel is available) |
| TR-6  | `BUILT_AT` is present and is a valid ISO timestamp. | Snapshot/live badge + cache-buster depend on it. | test-artifact |
| TR-7  | File size ≤ 200 KB (warn ≥ 150 KB). | Larger files truncate on paste into an artifact. | test-artifact |
| TR-8  | The model list is bare aliases only — no date-pinned IDs (`claude-*-YYYYMMDD`). | A retired date-pinned ID 404s every AI feature. | test-artifact |
| TR-9  | No `api.anthropic.com` raw-fetch is the *sole* model path (bridge must be primary). | Raw fetch is CSP-blocked in the sandbox. | test-artifact |
| TR-10 | `commissioner.jsx` is byte-identical to the template except on inlined-data / `BUILT_AT` lines. | Guarantees the artifact was built, never hand-edited. | test-artifact |
| TR-12 | `dist/plaincy.html` (built by `scripts/build-html.js`, esbuild IIFE with React inside — no external scripts) exists, has `<title>PlAIncy</title>`, a viewport meta, `:root` colour tokens and an explicit body background; its `plaincy-data` JSON parses and carries history/rosters/trades/alltime/transactions/players/lore; size warns > 2 MB, fails > 16 MB. | test-artifact |
| TR-11 | `commissioner.template.jsx` equals the byte-exact concatenation of `template/*.jsx` (partials are source of truth). | Prevents a hand-edit to the generated monolith from being silently lost on the next assemble. | build-template --check (CI) |

## User-journey requirements (UR) — the "general user test"

| ID | Journey | Test |
|----|---------|------|
| UR-1 | Open the app → default STATS tab is visible, no console error. | test-render |
| UR-2 | Tap through BANTER, TRADES, SCORES → each shows its content, no error thrown. | test-render |
| UR-3 | Type a question in STATS and send → a reply bubble appears (model bridge mocked). | test-render |
| UR-4 | Live data source unreachable → app still loads from the inlined snapshot (offline resilience). | test-render |
| UR-5 | A common question (H2H / totals) is answered WITHOUT a planner model call (client-side fast-path), saving tokens. | test-render |
| UR-7 | Screenshot replay through the Stats `ChatTab`: "most points scored in a loss?" → top row Alastair 151.40 L v Josh 168.56 (2023 wk 13); "total game score?" → 319.96 with both rows of that game; "How could Josh score 168.56 and lose?" → explains Josh won 168.56–151.40, no "fabricat" text, zero model calls. | test-render (+ engine-level in test-questions) |
| UR-8 | `dist/plaincy.html` run in jsdom like a browser. With `window.claude.use("sample")` mocked: shell renders, every tab switches, the UR-7 conversation is correct against the current data with zero sample calls, multi-row narration calls `sample()` (quick, `cache:false`) with a turn list starting and ending on a user turn, the planner calls `sample.json` (quick). With `use()` → null: recipe questions still answer, Banter shows an "AI not available" notice, the trade verdict hides, no script errors. | test-render |
| UR-6 | Legacy runtime (no `window.claude`) → the model fallback chain advances past a 404 to the next model. | test-render |

## Question-engine requirements (QR) — code computes, the model only phrases

| ID | Requirement | Test |
|----|-------------|------|
| QR-1 | Every PLAN seed question, phrased three ways (24 phrasings), returns the right top row via the recipe table (`fastPlan`) with ZERO model calls; the other PLAN recipes (this week's scores, standings, X's record (in YYYY), X vs Y, who won YYYY, streaks, top scorer, best/worst week, loss/win extremes, closest/biggest/combined) never call the planner; follow-ups ("that game", "and in 2024?") resolve against the previous result. | test-questions |
| QR-2 | A planner returning a valid v2 spec yields correct rows; junk, an unknown table/column/handle, a v1 spec, or `none` on a numeric-sounding question yields the can't-answer reply — never free-text numbers. | test-questions |
| QR-3 | Number guard: a narration containing any number not in the result rows (2 dp / 1 dp / integer forms, seasons, weeks, row counts) — or claiming fabrication — is replaced by the JS template sentence. Narration prompt < 4 KB with 25 rows. | test-questions |
| QR-4 | Rankings and pushback: a fresh ranking question ("biggest combined score") is never read as a follow-up about the previous answer's game; "top N" / "N highest" / "show more" / "top 10 of this" return a ranked list (≤ 25) whose row 1 is the record holder; combined-score answers show the Total column; a counter-claim ("Dan and I had a bigger game last week") is checked against the data and answered "You're right", "Yes — that's the record" or "Checked: ranks #k"; a disputed follow-up answer is re-run and corrected; a one- or two-word prompt with no stat asks which stat instead of guessing. | test-questions |
| QR-5 | Stats v3 tables + language: `weeks` (league week: avg, median, high/low + who, spread), `trades` (one row per side), game rows with `weekAvg`/`vsAvg`/`oppWeekRank`, `players` groupable — all derived in the browser, no new fetches. Spec v3 (superset of v2): `filters`, `count` / `<col>_<sum\|avg\|max\|min>`, any 1–2 catalog dimensions in `groupBy`, `having`, `unique` (one row per game). One CATALOG drives the validator, table labels and planner prompt; anything off-catalog is rejected with a reason. Every planner example validates and returns rows. | test-questions |
| QR-6 | Wider recipes with zero model calls (synonym pass; thresholds "over 150" / "150+" / "combined over 300" / "won by more than 50"; beat the league average; points against / against a manager; all-play; titles; playoff appearances; weeks a manager top-scored; trades; league weeks; top players by position; position points by manager / by position; "this/last season"). Planner prompt generated from the catalog with calendar context and worked examples; a rejected spec gets ONE repair retry carrying the validator's error, then can't-answer. | test-questions |
| QR-7 | Answers: every result carries a scope line (phase · status · seasons · filters) shown under the table; multi-row, grouped and filtered results get a specific JS sentence (never "Here is what the data shows") whose numbers all pass the guard; JS-derived facts (gap #1→#2, average of shown rows, match count) go to the narrator and are allowed by the guard. | test-questions |

## Data-math requirements (DR) — locked by golden file

| ID | Requirement | Test |
|----|-------------|------|
| DR-1 | `build-alltime.js` output for a fixed fixture league byte-matches the committed golden (career/H2H/luck/streaks/positional/player math is stable). | test-alltime |
| DR-2 | Aliases are merged before aggregation (no un-canonicalized handle survives into `careerRankings`). | test-alltime |
| DR-3 | Every game carries `status` (`final`/`live`) and `phase` (`regular`/`playoff`/`consolation`, from the brackets; `playoff` boolean kept = phase ≠ regular). Scheduled (0-0 future) pairings live in the season's `schedule[]`, never `games[]`. An in-progress season validates with: champion may be null, no playoff games required, contiguous FINAL weeks, per-manager FINAL regular-season game count == Sleeper W+L+T, live games only in the week after the last final week. Readers (`build-alltime`, template `flattenGames`/analytics, `fetch-stats`) use final games only; a missing status counts as final. | test-status (fixtures `history-midseason.json`, `sleeper-midseason.json`) + validate |
| DR-5 | The fact table (`docs/data/games.json`, built by the shared `template/15-facts.jsx`) has 2 mirrored rows per game, complementary results, per manager-season game counts == Sleeper W+L+T, and every named record row exists in the table. An independent plain-loop recompute matches every named record on the frozen 2023–25 fixture, plus the PLAN seed answers (Alastair 151.40 L v Josh 168.56 2023 wk13; Saul 86.94 W v Lev 79.32 2025 wk7; Gideon 202.36; Josh 54.84; Dan 131.86–131.84; Saul 189.76–76.00; Dan v Josh 6–0; Lev 2024 0–14). | test-facts (fixture `history-2023-2025.json`) + validate |
| DR-6 | Stat corrections: a FINAL week's scores changing between runs is allowed (never a validation failure) and reported — `stat-corrections.js` names the corrected weeks in the refresh commit message; live-week movement is not a correction. | test-status |
| DR-4 | Standings `high` == max FINAL score in that season's games list plus round-1 playoff byes (`byes[]`). Null-matchup entries for eliminated teams / beyond-bracket weeks (wk 18) are not games and never count. | test-status + validate |

---

## How the gate runs
- **Every generation:** `build-artifact.js` writes the file, then runs `test-artifact.js`
  in-process; a failure deletes/rejects the build with a non-zero exit.
- **CI (`refresh.yml`, daily):** fetch → build-facts → build-alltime → build-artifact → build-html →
  validate `--fresh` → test-status → test-facts → test-questions → test-alltime → test-artifact →
  test-render → commit. **`test.yml`** runs the same gates on every code change / PR.
- **Local full check:** `npm test` → validate → test-status → test-facts → test-questions → test-alltime →
  test-artifact → test-render (dev deps: `npm install`).
