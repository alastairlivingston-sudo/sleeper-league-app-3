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

## Logged upcoming changes (not yet implemented)

### Banter bot — fact verification against data
The banter bot is hallucinating league facts (e.g. claiming Alastair beat Saul in 2025 when the data
shows otherwise). Fix: inject the same structured data the Stats tab uses (history.json, stats.json,
alltime.json) into the Banter system prompt, with a hard rule that any factual claim about a result,
score, record, or season outcome MUST be verified against that data first. The bot may still riff on
pre-2023 history (not in our dataset) but should flag it as unverified rather than state it as fact.

### Banter bot — remove canon tag labels from output
The [FACT], [MYTH], [REAL], [EVENT] tags appear verbatim in responses, making them feel robotic.
These are internal tone/sourcing instructions for the model, not meant to be printed. Fix: add an
explicit rule to the system prompt that these tags must NEVER appear in the output — they are for
the model's internal reasoning only. Alternatively post-process the response to strip [ALL_CAPS_TAGS].

### Mobile UI — remove placeholder text from chat inputs
On mobile, the suggested placeholder text inside the chat input wraps onto two lines, breaking the
layout. Fix: remove the `placeholder` attribute entirely from the ChatTab <input> element (or set it
to a single short word like "Message…"). The chip buttons already serve as suggested prompts.

## Automation
.github/workflows/refresh.yml runs all three scripts on a weekly cron (Tuesday 11:00 UTC) + manual
workflow_dispatch, and commits public/data/*.json back to the repo. The artifact picks up changes
automatically because it fetches the raw files live.

## Build/run
npm i papaparse
node scripts/fetch-history.js && node scripts/fetch-rosters.js && node scripts/fetch-stats.js
