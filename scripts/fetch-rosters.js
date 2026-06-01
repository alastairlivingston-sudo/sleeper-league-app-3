#!/usr/bin/env node
// Fetches current rosters per team and writes rosters.json

const fs = require("fs");
const path = require("path");

const BASE = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const SEASON = "2025";
const OUT = path.join(__dirname, "../public/data/rosters.json");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function findLeague() {
  const user = await get(`${BASE}/user/${USERNAME}`);
  const leagues = await get(`${BASE}/user/${user.user_id}/leagues/nfl/${SEASON}`);
  const league = leagues.find((l) => /borehamwood|plancy/i.test(l.name));
  if (!league) throw new Error("League not found for season " + SEASON);
  return league;
}

async function main() {
  const league = await findLeague();
  const leagueId = league.league_id;

  const [users, rosters, players] = await Promise.all([
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    get(`${BASE}/players/nfl`),
  ]);

  const userMap = {};
  for (const u of users) {
    const handle = u.display_name;
    const team = u.metadata?.team_name || handle;
    userMap[u.user_id] = { handle, team };
  }

  const result = {};
  for (const roster of rosters) {
    const uid = roster.owner_id;
    if (!uid) continue;
    const info = userMap[uid] || { handle: uid, team: uid };
    const key = `${info.team} (@${info.handle})`;
    const playerList = (roster.players || []).map((pid) => ({
      id: pid,
      name: players[pid]
        ? `${players[pid].first_name || ""} ${players[pid].last_name || ""}`.trim()
        : pid,
    }));
    result[key] = playerList;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`Wrote ${OUT} — ${Object.keys(result).length} team(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
