# commissioner.jsx — Requirements & Test Matrix

The artifact (`commissioner.jsx`) is generated from `commissioner.template.jsx` by
`scripts/build-artifact.js`. This document is the **contract the generated file must
satisfy before it ships**. Every requirement has a stable ID and is enforced by an
automated test:

- **`scripts/test-artifact.js`** — zero-dependency structural gate. Runs automatically
  at the end of every `build-artifact.js` run and in CI. A failure aborts the build so a
  broken artifact is never written/committed. Covers `FR-*` (structure) and all `TR-*`.
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
| FR-6  | The deterministic stats engine (`flattenGames`/`runStatQuery`/`parseSpec`/`formatQueryResult`) is present. | test-artifact |
| FR-7  | Lore retrieval (`useLore`/`retrieveLore`) is present for the Banter tab. | test-artifact |
| FR-8  | App renders without throwing; the STATS tab (default) shows content. | test-render |
| FR-9  | Switching to each tab (Banter, Trades, Scores) renders without error. | test-render |
| FR-10 | A chat send in the Stats tab calls the model bridge and renders a reply. | test-render |
| FR-11 | With live fetch failing, the app still renders from the inlined snapshot. | test-render |

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
| UR-6 | Legacy runtime (no `window.claude`) → the model fallback chain advances past a 404 to the next model. | test-render |

## Data-math requirements (DR) — locked by golden file

| ID | Requirement | Test |
|----|-------------|------|
| DR-1 | `build-alltime.js` output for a fixed fixture league byte-matches the committed golden (career/H2H/luck/streaks/positional/player math is stable). | test-alltime |
| DR-2 | Aliases are merged before aggregation (no un-canonicalized handle survives into `careerRankings`). | test-alltime |

---

## How the gate runs
- **Every generation:** `build-artifact.js` writes the file, then runs `test-artifact.js`
  in-process; a failure deletes/rejects the build with a non-zero exit.
- **CI:** `refresh.yml` runs `validate.js --fresh` (data) and `test-artifact.js`
  (artifact) before the commit step; optionally `test-render.js` when dev deps are installed.
- **Local full check:** `npm test` → data contract + artifact structure + render.
