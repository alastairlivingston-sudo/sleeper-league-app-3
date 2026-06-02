#!/usr/bin/env node
// Fetches current rosters per team and writes rosters.json

const fs = require("fs");
const path = require("path");

const BASE = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const OUT = path.join(__dirname, "../docs/data/rosters.json");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function findActiveLeague() {
  const state  = await get(`${BASE}/state/nfl`);
  const season = state.season;
  const user   = await get(`${BASE}/user/${USERNAME}`);

  for (const yr of [season, String(parseInt(season) - 1)]) {
    const leagues = await get(`${BASE}/user/${user.user_id}/leagues/nfl/${yr}`);
    const league  = leagues.find((l) => /borehamwood|plancy/i.test(l.name));
    if (!league) continue;

    // Check if this league has rostered players yet (skip empty pre-draft leagues)
    const rosters = await get(`${BASE}/league/${league.league_id}/rosters`);
    const hasPlayers = rosters.some((r) => (r.players || []).length > 0);
    if (hasPlayers) { console.log(`Using ${yr} season for rosters`); return league; }
    console.log(`${yr} season exists but no players rostered yet — trying previous year`);
  }
  throw new Error("No Plancy league with rostered players found");
}

async function main() {
  const league = await findActiveLeague();
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
    const playerList = (roster.players || []).map((pid) => {
      const p   = players[pid];
      const fp  = p?.fantasy_positions?.[0] || p?.position;
      let   pos = null;
      if (fp === "QB") pos = "QB";
      else if (fp === "RB" || fp === "FB") pos = "RB";
      else if (fp === "WR") pos = "WR";
      else if (fp === "TE") pos = "TE";
      else if (fp === "K")  pos = "K";
      else if (/^[A-Z]{2,3}$/.test(pid)) pos = "DEF";
      return {
        id:   pid,
        name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : pid,
        pos,
      };
    });
    result[key] = playerList;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`Wrote ${OUT} — ${Object.keys(result).length} team(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
