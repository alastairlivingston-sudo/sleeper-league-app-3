---
name: sleeper-api
description: >-
  Reference and recipes for calling the Sleeper fantasy-football API in this
  repo (the Borehamwood Plancy league). Use whenever fetching league data,
  rosters, matchups, scores, or building a feature — in a Node script OR in the
  browser artifact — that talks to Sleeper. Covers endpoints, this league's IDs,
  the league-discovery pattern, data shapes, the CORS situation, and the gotchas.
---

# Sleeper API — Borehamwood Plancy League

Sleeper's API is **public, keyless, read-only**. Base URL: `https://api.sleeper.app/v1`.
Be polite: stay well under ~1000 calls/min, and cache the big `players/nfl` blob (call it at most once/day).

## Two execution contexts (this matters)

| Context | Where | Notes |
| --- | --- | --- |
| **Node scripts** (`scripts/*.js`) | the weekly data pipeline | Writes `docs/data/*.json`. The DATA CONTRACT (filenames + JSON shapes) is fixed — don't change shapes without updating the artifact too. |
| **Browser** (the artifact's live tabs) | `commissioner.jsx` runtime | Sleeper now sends `access-control-allow-origin: *`, so it CAN be called directly from a browser (the old claude.md "never from a browser" rule is stale). The live **Scores** tab does exactly this. |

> CORS note: verified that `state/nfl`, `user`, `leagues`, `league/.../rosters`,
> and `league/.../matchups` all return `access-control-allow-origin: *`.
> ESPN's keyless scoreboard (`site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`)
> is also CORS-enabled if you ever need the NFL schedule / game pairings.

## This league's known identifiers

- **Username:** `AlastairL` → **user_id** `735249111976112128`
- **League name match:** `/borehamwood|plancy/i`
- **2025 league_id:** `1181898177582030848` (name "Borehamwood")
- **Settings:** 1-QB, half-PPR, 8 teams, `playoff_week_start = 15`
- **Roster slots (`roster_positions`):** `QB, RB, RB, WR, WR, WR, TE, FLEX, K, DEF` + 6×`BN`
- **Handle → name map** (from the artifact): `AlastairL=Alastair, dpol=Dan, saulgoat=Saul,
  sanfbe=Benjy(Sanford), joshjr11=Josh, drjkay=Jamie, GSac=Gideon, benjlev=Benjy(Lev)`.
  Alias: `allyl900 → AlastairL`.

**Prefer discovering the league dynamically** (below) over hardcoding the id, so it rolls
over each season.

## Core endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /state/nfl` | `{ season, week, leg, season_type }`. Offseason ⇒ `week: 0`, `season_type: "off"`. |
| `GET /user/{username}` | user object incl. `user_id`. |
| `GET /user/{user_id}/leagues/nfl/{year}` | all the user's leagues that season. |
| `GET /league/{league_id}` | league object incl. `roster_positions`, `settings.playoff_week_start`. |
| `GET /league/{league_id}/users` | `[{ user_id, display_name, metadata.team_name }]`. |
| `GET /league/{league_id}/rosters` | `[{ roster_id, owner_id, settings.{wins,losses,fpts,...} }]`. |
| `GET /league/{league_id}/matchups/{week}` | per-roster scoring (see shape below). |
| `GET /players/nfl` | **~14.6 MB** id→player map. Avoid in the browser — use `rosters.json` for names. |

### Matchups shape (the important one)

Each week returns one entry **per roster**:

```jsonc
{
  "roster_id": 6,
  "matchup_id": 3,              // two entries share a matchup_id = one head-to-head
  "points": 91.32,             // FULL team total — DON'T show this in spoiler-safe UIs
  "starters": ["6770","9226"], // player ids, in roster_positions slot order
  "starters_points": [10.82, 15.0], // PARALLEL to starters[]
  "players_points": { "6770": 10.82, "...": 0.0 }, // all rostered players
  "players": ["6770", "..."]
}
```

Pair entries by `matchup_id` (2 each). `starters[i]` lines up with the i-th non-`BN`
slot in `roster_positions` and with `starters_points[i]`.

## Mapping recipes

- **roster → manager:** `rosters[].owner_id` → `users[].user_id` → `display_name` / `metadata.team_name`.
- **player id → name/pos WITHOUT the 14.6 MB file:** flatten `docs/data/rosters.json`
  (`"Team (@handle)" → [{id,name,pos}]`) into `id → {name,pos}`. Covers all currently
  rostered players. (Limitation: a player dropped since a past week won't be found — fall
  back to the id, or fetch `players/nfl` only if you truly need full historical names.)
- **DEF players:** their id is the team abbreviation (e.g. `"KC"`, `"BUF"`).

## League discovery (dynamic, season-rolling)

```js
async function findPlancyLeague(get, username = "AlastairL") {
  const state = await get(`/state/nfl`);
  const user  = await get(`/user/${username}`);
  for (const yr of [state.season, String(+state.season - 1), String(+state.season - 2)]) {
    const leagues = await get(`/user/${user.user_id}/leagues/nfl/${yr}`);
    const lg = (leagues || []).find(l => /borehamwood|plancy/i.test(l.name));
    if (lg) return { league: lg, season: yr, user };
  }
  throw new Error("No Plancy league found");
}
```
(In the Node pipeline, `fetch-stats.js` additionally skips a season with no games played;
for live/current-season work you usually want the first match regardless.)

## Minimal fetch helpers

```js
// Node OR browser
const BASE = "https://api.sleeper.app/v1";
async function sget(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`Sleeper ${r.status} ${path}`);
  return r.json();
}
```

## Gotchas

- **Offseason:** `state.week === 0`; current-season league/matchups may not exist yet — fall back to last season.
- **Don't recompute scores** the league cares about in an LLM prompt — read Sleeper's numbers verbatim (see claude.md's deterministic-query rule).
- **Spoiler-safe UIs:** never render `points` or `starters_points` until the user opts in; the Scores tab in `commissioner.jsx` is the reference implementation.
- **Big player file:** `players/nfl` is huge and rate-limited — never fetch it on every browser open.
- **Where the artifact lives:** model calls only work inside a claude.ai *chat* artifact (proxied). Sleeper/ESPN calls are keyless so they also work on a real host, but the AI tabs would need a server-side `ANTHROPIC_API_KEY` proxy.
