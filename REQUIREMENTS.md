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
| FR-5  | `claudeCall` uses the `window.claude.complete` bridge when present. | test-artifact |
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
| TR-2  | Every inlined data constant (`HISTORY_DATA`, `STATS_DATA`, `ROSTERS_DATA`, `TRADE_VALUES`, `ALLTIME_DATA`, `TRANSACTIONS_DATA`, `PLAYER_SCORES`) is syntactically valid JSON or `null`. | Truncated/corrupt data is the #1 load failure. | test-artifact |
| TR-3  | Braces `{}`, brackets `[]`, and parens `()` are balanced across the whole file. | An unbalanced pair from a bad substitution breaks parsing. | test-artifact |
| TR-4  | `import React, { … } from "react";` is present (React is imported, not global, in the sandbox). | Bare `React.useState` fails to render under the current runtime. | test-artifact |
| TR-5  | The file transpiles cleanly with `@babel/preset-react` (no JSX/syntax errors). | Direct proof it will parse in the host. | test-render (and test-artifact when Babel is available) |
| TR-6  | `BUILT_AT` is present and is a valid ISO timestamp. | Snapshot/live badge + cache-buster depend on it. | test-artifact |
| TR-7  | File size ≤ 200 KB (warn ≥ 150 KB). | Larger files truncate on paste into an artifact. | test-artifact |
| TR-8  | The model list is bare aliases only — no date-pinned IDs (`claude-*-YYYYMMDD`). | A retired date-pinned ID 404s every AI feature. | test-artifact |
| TR-9  | No `api.anthropic.com` raw-fetch is the *sole* model path (bridge must be primary). | Raw fetch is CSP-blocked in the sandbox. | test-artifact |
| TR-10 | `commissioner.jsx` is byte-identical to the template except on inlined-data / `BUILT_AT` lines. | Guarantees the artifact was built, never hand-edited. | test-artifact |
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
| UR-6 | Legacy runtime (no `window.claude`) → the model fallback chain advances past a 404 to the next model. | test-render |

## Question-engine requirements (QR) — code computes, the model only phrases

| ID | Requirement | Test |
|----|-------------|------|
| QR-1 | Every PLAN seed question, phrased three ways (24 phrasings), returns the right top row via the recipe table (`fastPlan`) with ZERO model calls; the other PLAN recipes (this week's scores, standings, X's record (in YYYY), X vs Y, who won YYYY, streaks, top scorer, best/worst week, loss/win extremes, closest/biggest/combined) never call the planner; follow-ups ("that game", "and in 2024?") resolve against the previous result. | test-questions |
| QR-2 | A planner returning a valid v2 spec yields correct rows; junk, an unknown table/column/handle, a v1 spec, or `none` on a numeric-sounding question yields the can't-answer reply — never free-text numbers. | test-questions |
| QR-3 | Number guard: a narration containing any number not in the result rows (2 dp / 1 dp / integer forms, seasons, weeks, row counts) — or claiming fabrication — is replaced by the JS template sentence. Narration prompt < 4 KB with 25 rows. | test-questions |

## Data-math requirements (DR) — locked by golden file

| ID | Requirement | Test |
|----|-------------|------|
| DR-1 | `build-alltime.js` output for a fixed fixture league byte-matches the committed golden (career/H2H/luck/streaks/positional/player math is stable). | test-alltime |
| DR-2 | Aliases are merged before aggregation (no un-canonicalized handle survives into `careerRankings`). | test-alltime |
| DR-3 | Every game carries `status` (`final`/`live`) and `phase` (`regular`/`playoff`/`consolation`, from the brackets; `playoff` boolean kept = phase ≠ regular). Scheduled (0-0 future) pairings live in the season's `schedule[]`, never `games[]`. An in-progress season validates with: champion may be null, no playoff games required, contiguous FINAL weeks, per-manager FINAL regular-season game count == Sleeper W+L+T, live games only in the week after the last final week. Readers (`build-alltime`, template `flattenGames`/analytics, `fetch-stats`) use final games only; a missing status counts as final. | test-status (fixtures `history-midseason.json`, `sleeper-midseason.json`) + validate |
| DR-5 | The fact table (`docs/data/games.json`, built by the shared `template/15-facts.jsx`) has 2 mirrored rows per game, complementary results, per manager-season game counts == Sleeper W+L+T, and every named record row exists in the table. An independent plain-loop recompute matches every named record on the frozen 2023–25 fixture, plus the PLAN seed answers (Alastair 151.40 L v Josh 168.56 2023 wk13; Saul 86.94 W v Lev 79.32 2025 wk7; Gideon 202.36; Josh 54.84; Dan 131.86–131.84; Saul 189.76–76.00; Dan v Josh 6–0; Lev 2024 0–14). | test-facts (fixture `history-2023-2025.json`) + validate |
| DR-4 | Standings `high` == max FINAL score in that season's games list plus round-1 playoff byes (`byes[]`). Null-matchup entries for eliminated teams / beyond-bracket weeks (wk 18) are not games and never count. | test-status + validate |

---

## How the gate runs
- **Every generation:** `build-artifact.js` writes the file, then runs `test-artifact.js`
  in-process; a failure deletes/rejects the build with a non-zero exit.
- **CI:** `refresh.yml` runs `validate.js --fresh` (data) and `test-artifact.js`
  (artifact) before the commit step; optionally `test-render.js` when dev deps are installed.
- **Local full check:** `npm test` → data contract + artifact structure + render.
