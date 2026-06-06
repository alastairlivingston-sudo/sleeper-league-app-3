# Borehamwood Plancy League — Data Pipeline (Project Memory)

## What this repo is
A small, automated data pipeline for a fantasy football league bot. Node scripts pull from public APIs and
write JSON into public/data/. A GitHub Action runs them weekly. A separate shareable Claude artifact (not in
this repo) fetches those JSON files live to power "The Commissioner" — the league's statistician, trade
analyst and resident wind-up merchant.

## Hard rules (do not violate)
1. The Sleeper API has NO CORS headers. It is only ever called from Node scripts here — never from a browser.
2. No API keys anywhere. Sleeper and FantasyCalc are public and keyless. Never commit a secret.
3. Verify, never fabricate. Scripts emit only real fetched data. If something can't be fetched, log it and
   skip — do not invent values.
4. The artifact reads the generated JSON by public raw URL. Keep filenames and JSON shapes stable, because
   changing them breaks the live bot.

## The scripts (all Node 20, no key)
- scripts/fetch-history.js  -> public/data/history.json
    Walks the league's previous_league_id chain back through EVERY season; per season records standings
    (wins, losses, points-for, high score), the champion (from winners_bracket), and the game list.
- scripts/fetch-rosters.js  -> public/data/rosters.json
    Current rosters per team. Shape: { "Team Name (@handle)": [{ id, name }, ...] }  (id = Sleeper player id).
- scripts/fetch-stats.js    -> public/data/stats.json
    Current-season standings, head-to-heads, and extremes (closest game, biggest blowout, highest week).

## Config used by the scripts
- USERNAME = "AlastairL"
- SEASON   = "2025"
- League is found by matching name /borehamwood|plancy/i among the user's leagues.

## Data contract (the artifact depends on these EXACT shapes)
- history.json: { seasons: [ { season, name, champion, standings:[{manager,team,wins,losses,pf,high}], games:[{week,playoff,a,b,pa,pb}] } ] }
- stats.json:   { league, season, standings:[...], headToHead:{...}, extremes:{...} }
- rosters.json: { "Team (@handle)": [{ id, name }, ... ] }

## League facts (for sanity-checking output)
1-QB redraft, WR/RB/TE flex, half-PPR, 8 teams. 2025 champion: Fourth and Golda Meir (@AlastairL), 11-5,
beat @dpol 143.96-118.58 in the final. If fetched data contradicts these known facts, the script/parse is
wrong — investigate, don't "correct" the data to fit.

## Stats engine — deterministic, never LLM arithmetic
The Stats bot must NEVER compute win/loss/points itself (it produced impossible results like
"A beats B" and "B beats A" simultaneously). Two-layer design:
1. Pre-computed tables in build-alltime.js (careerRankings, symmetric allTimeH2H, nemesis/bunny,
   records, seasonRankings) — the narration prompt gets these tables but NOT the raw game list.
2. A query engine in the artifact (flattenGames / runStatQuery / planStatQuery / formatQueryResult):
   the model plans a JSON query spec (headToHead | totals | gameList), JS executes it deterministically,
   and the result is injected as an authoritative "DETERMINISTIC QUERY RESULT" block for narration.
ALIAS map (allyl900→AlastairL) must stay in sync between commissioner.template.jsx canonical() and
build-alltime.js canon().

## Banter bot
- Inject history/stats/alltime into the banter prompt; verify any result/record against it before
  asserting. Pre-2023 events may be cited as unverified lore only.
- NEVER print [FACT]/[MYTH]/[REAL]/[EVENT] tags — internal cues only; also stripped post-hoc in send().

## Automation
.github/workflows/refresh.yml runs all three scripts on a weekly cron (Tuesday 11:00 UTC) + manual
workflow_dispatch, and commits public/data/*.json back to the repo. The artifact picks up changes
automatically because it fetches the raw files live.

## Build/run
npm i papaparse
node scripts/fetch-history.js && node scripts/fetch-rosters.js && node scripts/fetch-stats.js

## Claude artifact runtime — hard lessons

### Use the Anthropic Messages API directly, never window.claude.complete()
In Claude.ai artifacts, `fetch('https://api.anthropic.com/v1/messages', {...})` is proxied
automatically — no API key required. This is the ONLY correct way to call the model from
an artifact. `window.claude.complete()` must never be used because:
1. It concatenates system prompt + conversation into a single string (legacy completion style),
   losing the system/messages boundary the model expects.
2. It has an invisible, undocumented prompt-budget limit (experimentally ~30–35 KB total).
   When exceeded it silently truncates, causing the model to report "all data tables are empty
   or null" — extremely hard to debug because the UI still renders correctly.
3. The direct API gives standard, predictable behaviour with a real 200 K-token context window.

```js
// CORRECT — direct Messages API, proxied by Claude.ai, no key needed
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.filter(m => m.role==='user'||m.role==='assistant')
                      .map(m => ({ role: m.role, content: m.content })),
  }),
});
```

### Keep system prompts lean (target < 20 KB)
Even with the direct API, a bloated system prompt slows every call and risks context pressure.
- Put only what the model needs for NARRATION in the prompt; use the deterministic query layer
  (flattenGames / runStatQuery) for any numeric lookup the model would otherwise hallucinate.
- Do NOT include raw weekly score arrays, full H2H-by-season tables, or per-game player lists —
  these are large and the model doesn't need them to answer typical questions.
- A hand-crafted ALLTIME_SUMMARY (nemesis, bunny, playoffRecords) is far better than dumping
  the entire alltime.json. The working artifact prompt is ~5 KB; the broken one was ~66 KB.

### Keep inlined data minimal
- Strip fields the model never reads: positional breakdowns (ap/bp per game), per-game player
  arrays (as/bs/ab/bb), high-score-per-game from standings. These add tens of KB for zero value.
- history.json games only need: week, playoff, a, b, pa, pb.

### Template vs hand-crafted artifact
commissioner.template.jsx is the build source; build-artifact.js inlines data and writes
commissioner.jsx. The template must use the direct API claudeCall (already updated). When
doing significant architecture changes to commissioner.jsx, mirror them back to the template
so the next daily refresh doesn't clobber the fix.

### Self-refresh: live-fetch so you paste the artifact only ONCE
Inlined data alone means re-pasting the whole artifact into the claude.ai chat after every
data refresh. To avoid that, the artifact fetches the latest JSON on every open:
- useLeagueData() fetches history/rosters/fc-values/alltime from jsDelivr (CDN) first, then
  GitHub Pages as fallback; both send `access-control-allow-origin: *`, so no CORS issue.
- The inlined constants remain the OFFLINE FALLBACK (initial useState value + silent catch),
  so the app still works if both sources are unreachable.
- jsDelivr serves `cache-control: max-age=604800` (7-day browser cache). Append a daily
  cache-buster `?v=YYYY-MM-DD` so a returning user pulls fresh data each calendar day, matching
  the once-daily Action — without hammering origin on every open.
- alltime.json has richer field names ({opponent,wins,losses,appearances}) than the compact
  ALLTIME_SUMMARY the prompt wants ({opp,w,l,apps}); buildAlltimeSummary() maps fetched → compact
  and returns the inlined fallback if the shape is missing.
- Net result: code changes still need a re-paste; DATA changes do not.

### Where the app actually runs / multi-device
The artifact lives inside its claude.ai chat — open that chat on any device (incl. the iPad
claude.ai app) to use it. It is NOT a standalone hosted site: the keyless model call only works
because claude.ai proxies it. Hosting on GitHub Pages/Vercel would require a serverless proxy
holding a real ANTHROPIC_API_KEY (server-side) and would incur per-call cost.
