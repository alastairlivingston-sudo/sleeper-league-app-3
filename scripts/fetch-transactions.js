#!/usr/bin/env node
// Fetches actual league trade history from Sleeper API across all seasons.
// Writes docs/data/transactions.json
// Each trade entry: { season, week, managerA, managerB, aGave[], bGave[] }
// where each item is { name, pos } for players or { season, round } for picks.

const fs   = require("fs");
const path = require("path");

const BASE     = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const OUT      = path.join(__dirname, "../docs/data/transactions.json");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function buildPosMap() {
  const players = await get(`${BASE}/players/nfl`);
  const map = {};
  for (const [id, p] of Object.entries(players)) {
    if (!p) continue;
    map[id] = { name: p.full_name || p.first_name + " " + p.last_name || id, pos: p.fantasy_positions?.[0] || p.position || "?" };
  }
  return map;
}

async function findLeague(userId, season) {
  const leagues = await get(`${BASE}/user/${userId}/leagues/nfl/${season}`);
  return leagues.find((l) => /borehamwood|plancy/i.test(l.name)) || null;
}

async function fetchSeasonTrades(leagueId, season, userMap, rosterOwner, posMap) {
  const trades = [];
  for (let w = 1; w <= 18; w++) {
    let txns;
    try {
      txns = await get(`${BASE}/league/${leagueId}/transactions/${w}`);
    } catch { break; }
    if (!txns || txns.length === 0) continue;

    for (const tx of txns) {
      if (tx.type !== "trade" || tx.status !== "complete") continue;

      // roster_ids involved — always exactly 2 for a trade
      const [ridA, ridB] = tx.roster_ids || [];
      if (!ridA || !ridB) continue;
      const managerA = userMap[rosterOwner[ridA]] || String(ridA);
      const managerB = userMap[rosterOwner[ridB]] || String(ridB);

      // Players traded: adds[rosterIdString] = [playerIds]
      const adds = tx.adds || {};
      const aReceives = Object.entries(adds).filter(([rid]) => Number(rid) === ridA).flatMap(([, ids]) => ids);
      const bReceives = Object.entries(adds).filter(([rid]) => Number(rid) === ridB).flatMap(([, ids]) => ids);

      // Draft picks: draft_picks array with {owner_id, previous_owner_id, ...}
      const picks = tx.draft_picks || [];
      const aPicksReceived = picks.filter(p => p.owner_id === ridA).map(p => ({ pick: true, season: p.season, round: p.round }));
      const bPicksReceived = picks.filter(p => p.owner_id === ridB).map(p => ({ pick: true, season: p.season, round: p.round }));

      function resolvePlayer(id) {
        const p = posMap[id];
        return p ? { name: p.name, pos: p.pos } : { name: id, pos: "?" };
      }

      trades.push({
        season,
        week:     w,
        managerA,
        managerB,
        // what A receives (i.e. what B gave)
        aReceives: [...aReceives.map(resolvePlayer), ...aPicksReceived],
        // what B receives (i.e. what A gave)
        bReceives: [...bReceives.map(resolvePlayer), ...bPicksReceived],
      });
    }
  }
  return trades;
}

async function main() {
  const state  = await get(`${BASE}/state/nfl`);
  const user   = await get(`${BASE}/user/${USERNAME}`);
  const userId = user.user_id;

  console.log("Fetching player map...");
  const posMap = await buildPosMap();

  const allTrades = [];
  const currentYear = parseInt(state.season);

  // Walk seasons from 2017 (Sleeper's earliest) up to current
  for (let yr = 2017; yr <= currentYear; yr++) {
    const season = String(yr);
    const league = await findLeague(userId, season);
    if (!league) continue;

    console.log(`Season ${season}: league ${league.league_id}`);

    const [users, rosters] = await Promise.all([
      get(`${BASE}/league/${league.league_id}/users`),
      get(`${BASE}/league/${league.league_id}/rosters`),
    ]);

    const userMap = {};
    for (const u of users) userMap[u.user_id] = u.display_name;

    const rosterOwner = {};
    for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;

    const trades = await fetchSeasonTrades(league.league_id, season, userMap, rosterOwner, posMap);
    console.log(`  ${trades.length} trades`);
    allTrades.push(...trades);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(allTrades, null, 2));
  console.log(`\nWrote ${OUT} — ${allTrades.length} total trades`);
}

main().catch(e => { console.error(e); process.exit(1); });
