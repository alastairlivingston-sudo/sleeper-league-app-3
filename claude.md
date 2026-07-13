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
No install needed (zero deps). `npm run refresh` runs the whole pipeline; `npm run validate` checks the
contract; `npm run build` rebuilds derived tables + artifact.

## Claude artifact runtime — hard lessons

### Model IDs: use bare aliases with a fallback chain, never date-pinned
`claudeCall` in the template tries `['claude-sonnet-5','claude-sonnet-4-5','claude-haiku-4-5']` in order,
advancing on 404, with retry/backoff on 429/5xx and a 60s timeout. A date-pinned ID
(`claude-sonnet-4-20250514`) previously retired and 404'd every AI feature — do not reintroduce one.

### Use the Anthropic Messages API directly, never window.claude.complete()
In Claude.ai artifacts, `fetch('https://api.anthropic.com/v1/messages', {...})` is proxied automatically —
no API key. This is the ONLY correct way to call the model. `window.claude.complete()` concatenates
system+conversation and has an invisible ~30–35 KB budget that silently truncates.

```js
// CORRECT — direct Messages API, proxied by Claude.ai, no key needed
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages.filter(m => m.role==='user'||m.role==='assistant')
                      .map(m => ({ role: m.role, content: m.content })),
  }),
});
```

### Keep system prompts lean (target < 20 KB)
Put only what the model needs for NARRATION in the prompt; use the deterministic query layer for any numeric
lookup. Do NOT dump raw weekly scores, full H2H-by-season tables, or per-game player lists. A hand-crafted
summary (nemesis, bunny, playoffRecords) beats the entire alltime.json. Working prompt ~5 KB; a broken one
was ~66 KB.

### Template vs built artifact
`commissioner.template.jsx` is the build source; `build-artifact.js` inlines data via `__PLACEHOLDER__`
substitution and writes `commissioner.jsx`. The two files are identical except the inlined-data lines.
NEVER hand-edit `commissioner.jsx` — change the template and rebuild. When making architecture changes,
edit the template so the next refresh doesn't clobber the fix.

### Self-refresh: live-fetch so you paste the artifact only ONCE
`useLeagueData()` fetches JSON from jsDelivr (CDN) first, then GitHub Pages fallback; both send
`access-control-allow-origin: *`. Inlined constants are the OFFLINE FALLBACK (initial useState + silent
catch). A daily cache-buster `?v=YYYY-MM-DD` pulls fresh data each calendar day. Net: DATA changes need no
re-paste; only CODE changes to the template do.

### Where the app runs / multi-device
The artifact lives inside its claude.ai chat — open that chat on any device to use it. It is NOT a
standalone hosted site: the keyless model call only works because claude.ai proxies it. Hosting elsewhere
would require a serverless proxy holding a real ANTHROPIC_API_KEY and would incur per-call cost.
