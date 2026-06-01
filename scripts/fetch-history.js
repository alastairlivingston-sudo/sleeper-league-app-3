#!/usr/bin/env node
// Walks previous_league_id chain back through every season and writes history.json

const fs = require("fs");
const path = require("path");

const BASE = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const SEASON = "2025";
const OUT = path.join(__dirname, "../public/data/history.json");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function findLeague() {
  const user = await get(`${BASE}/user/${USERNAME}`);
  const userId = user.user_id;
  const leagues = await get(`${BASE}/user/${userId}/leagues/nfl/${SEASON}`);
  const league = leagues.find((l) => /borehamwood|plancy/i.test(l.name));
  if (!league) throw new Error("League not found for season " + SEASON);
  return league;
}

async function fetchSeason(leagueId) {
  const [league, users, rosters, matchups, bracket] = await Promise.all([
    get(`${BASE}/league/${leagueId}`),
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    fetchAllMatchups(leagueId),
    get(`${BASE}/league/${leagueId}/winners_bracket`),
  ]);

  const userMap = {};
  for (const u of users) userMap[u.user_id] = { name: u.display_name, team: u.metadata?.team_name || u.display_name };

  const rosterOwner = {};
  for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;

  // standings
  const standingsArr = rosters
    .filter((r) => r.owner_id)
    .map((r) => {
      const uid = r.owner_id;
      const settings = r.settings || {};
      return {
        manager: userMap[uid]?.name || uid,
        team: userMap[uid]?.team || uid,
        wins: settings.wins || 0,
        losses: settings.losses || 0,
        pf: parseFloat((settings.fpts || 0) + "." + String(settings.fpts_decimal || 0).padStart(2, "0")),
        high: 0, // filled below
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);

  // compute per-manager high score from matchups
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

  // champion from winners bracket (the team that won the championship game)
  let champion = null;
  const champGame = bracket.find(
    (g) => g.r === Math.max(...bracket.map((x) => x.r)) && g.p === 1
  );
  if (champGame && champGame.w) {
    const uid = rosterOwner[champGame.w];
    champion = userMap[uid]?.name || String(champGame.w);
  }

  // games
  const games = [];
  const totalWeeks = matchups.length;
  const playoffWeek = (league.settings?.playoff_week_start) || totalWeeks - 2;
  for (let wi = 0; wi < matchups.length; wi++) {
    const week = matchups[wi];
    const weekNum = wi + 1;
    const playoff = weekNum >= playoffWeek;
    const paired = {};
    for (const entry of week) {
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
        week: weekNum,
        playoff,
        a: userMap[aUid]?.name || String(x.roster_id),
        b: userMap[bUid]?.name || String(y.roster_id),
        pa: x.points || 0,
        pb: y.points || 0,
      });
    }
  }

  return {
    season: league.season,
    name: league.name,
    champion,
    standings: standingsArr,
    games,
  };
}

async function fetchAllMatchups(leagueId) {
  const league = await get(`${BASE}/league/${leagueId}`);
  const totalWeeks = (league.settings?.playoff_round_type !== undefined ? 17 : 14);
  const results = [];
  for (let w = 1; w <= totalWeeks; w++) {
    try {
      const week = await get(`${BASE}/league/${leagueId}/matchups/${w}`);
      if (!week || week.length === 0) break;
      results.push(week);
    } catch {
      break;
    }
  }
  return results;
}

async function main() {
  const startLeague = await findLeague();
  const seasons = [];
  let leagueId = startLeague.league_id;

  while (leagueId) {
    console.log(`Fetching season for league ${leagueId}...`);
    const seasonData = await fetchSeason(leagueId);
    seasons.unshift(seasonData);
    const meta = await get(`${BASE}/league/${leagueId}`);
    leagueId = meta.previous_league_id || null;
    if (leagueId === "0" || leagueId === 0) leagueId = null;
  }

  const out = { seasons };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT} — ${seasons.length} season(s)`);
  console.log("Seasons found:", seasons.map((s) => s.season).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
