#!/usr/bin/env node
// Walks previous_league_id chain and writes history.json.
// Each game now includes positional point breakdowns (ap/bp: QB/RB/WR/TE/K/DEF).
// Season auto-detected from /state/nfl — no hardcoded year needed.

const path = require("path");
const L = require("./lib");
const { BASE, get, posPoints, starterList, benchList, writeJson } = L;

const OUT = path.join(__dirname, "../docs/data/history.json");

async function getCurrentSeason() {
  const state = await get(`${BASE}/state/nfl`);
  return state.season; // e.g. "2025"
}

async function findLeague(season) {
  const userId  = await L.getUserId();
  const league  = await L.findLeague(userId, season);
  if (!league) throw new Error(`Plancy league not found for season ${season}`);
  return league;
}

async function fetchAllMatchups(leagueId) {
  const results = [];
  for (let w = 1; w <= 18; w++) {
    try {
      const week = await get(`${BASE}/league/${leagueId}/matchups/${w}`);
      if (!week || week.length === 0) break;
      results.push(week);
    } catch (e) { if (e.notFound) break; throw e; }
  }
  return results;
}

async function fetchSeason(leagueId, posMap) {
  const [league, users, rosters, matchups, bracket] = await Promise.all([
    get(`${BASE}/league/${leagueId}`),
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    fetchAllMatchups(leagueId),
    get(`${BASE}/league/${leagueId}/winners_bracket`),
  ]);

  const userMap = {};
  for (const u of users) {
    userMap[u.user_id] = { name: u.display_name, team: u.metadata?.team_name || u.display_name };
  }

  const rosterOwner = {};
  for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;

  // Standings
  const standingsArr = rosters
    .filter((r) => r.owner_id)
    .map((r) => {
      const uid = r.owner_id;
      const s   = r.settings || {};
      return {
        manager: userMap[uid]?.name || uid,
        team:    userMap[uid]?.team || uid,
        wins:    s.wins    || 0,
        losses:  s.losses  || 0,
        pf:      parseFloat((s.fpts || 0) + "." + String(s.fpts_decimal || 0).padStart(2, "0")),
        pa:      parseFloat((s.fpts_against || 0) + "." + String(s.fpts_against_decimal || 0).padStart(2, "0")),
        high:    0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);

  // High score per manager
  const highMap = {};
  for (const week of matchups) {
    for (const entry of week) {
      const uid = rosterOwner[entry.roster_id];
      if (!uid) continue;
      const pts = entry.points || 0;
      if ((highMap[uid] || 0) < pts) highMap[uid] = pts;
    }
  }
  for (const s of standingsArr) {
    const uid = Object.keys(userMap).find((k) => userMap[k]?.name === s.manager);
    s.high = highMap[uid] || 0;
  }

  // Champion
  let champion = null;
  const champGame = bracket.find(
    (g) => g.r === Math.max(...bracket.map((x) => x.r)) && g.p === 1
  );
  if (champGame?.w) {
    const uid = rosterOwner[champGame.w];
    champion = userMap[uid]?.name || String(champGame.w);
  }

  // Games with positional breakdown
  const games      = [];
  const playoffWk  = L.playoffWeekStart(league);
  for (let wi = 0; wi < matchups.length; wi++) {
    const weekNum = wi + 1;
    const playoff = weekNum >= playoffWk;
    const paired  = {};
    for (const entry of matchups[wi]) {
      const mid = entry.matchup_id;
      if (!mid) continue;
      if (!paired[mid]) paired[mid] = [];
      paired[mid].push(entry);
    }
    for (const pair of Object.values(paired)) {
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const aUid = rosterOwner[x.roster_id];
      const bUid = rosterOwner[y.roster_id];
      games.push({
        week:    weekNum,
        playoff,
        a:       userMap[aUid]?.name || String(x.roster_id),
        b:       userMap[bUid]?.name || String(y.roster_id),
        pa:      x.points || 0,
        pb:      y.points || 0,
        ap:      posPoints(x, posMap),
        bp:      posPoints(y, posMap),
        as:      starterList(x, posMap),
        bs:      starterList(y, posMap),
        ab:      benchList(x, posMap),
        bb:      benchList(y, posMap),
      });
    }
  }

  return { season: league.season, name: league.name, champion, standings: standingsArr, games };
}

async function main() {
  // Auto-detect season; fall back to prior year if new league not created yet
  const currentSeason = await getCurrentSeason();
  let startLeague;
  try {
    startLeague = await findLeague(currentSeason);
    console.log(`Using ${currentSeason} season`);
  } catch {
    const prev = String(parseInt(currentSeason) - 1);
    console.log(`No ${currentSeason} league yet — falling back to ${prev}`);
    startLeague = await findLeague(prev);
  }

  console.log("Fetching /players/nfl for position + name data...");
  const posMap  = L.skillPosMap(await L.getPlayers());
  const seasons = [];
  let leagueId  = startLeague.league_id;

  while (leagueId) {
    console.log(`Fetching season for league ${leagueId}...`);
    const seasonData = await fetchSeason(leagueId, posMap);
    seasons.unshift(seasonData);
    const meta = await get(`${BASE}/league/${leagueId}`);
    leagueId = meta.previous_league_id || null;
    if (leagueId === "0" || leagueId === 0) leagueId = null;
  }

  writeJson(OUT, { seasons });
  console.log(`Wrote ${OUT} — ${seasons.length} season(s): ${seasons.map((s) => s.season).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
