#!/usr/bin/env node
// Fetches current rosters per team and writes rosters.json

const path = require("path");
const L = require("./lib");
const { BASE, get, writeJson } = L;

const OUT = path.join(__dirname, "../docs/data/rosters.json");

async function main() {
  const league = await L.findActiveLeague("players");
  const leagueId = league.league_id;

  const [users, rosters, players] = await Promise.all([
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    L.getPlayers(),
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

  writeJson(OUT, result, { stampMeta: false }); // team-keyed map — no meta sibling key
  console.log(`Wrote ${OUT} — ${Object.keys(result).length} team(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
