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
