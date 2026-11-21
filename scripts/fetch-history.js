#!/usr/bin/env node
// Walks previous_league_id chain and writes history.json.
// Each game now includes positional point breakdowns (ap/bp: QB/RB/WR/TE/K/DEF).
// Season auto-detected from /state/nfl — no hardcoded year needed.

const path = require("path");
const L = require("./lib");
const { BASE, get, posPoints, starterList, benchList, writeJson } = L;

const OUT         = path.join(__dirname, "../docs/data/history.json");
const OUT_DETAILS = path.join(__dirname, "../docs/data/history-details.json");

async function getState() {
  return get(`${BASE}/state/nfl`); // { season, season_type, week, ... }
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

async function fetchSeason(leagueId, posMap, state) {
  const [league, users, rosters, matchups, bracket, losers] = await Promise.all([
    get(`${BASE}/league/${leagueId}`),
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    fetchAllMatchups(leagueId),
    get(`${BASE}/league/${leagueId}/winners_bracket`),
    get(`${BASE}/league/${leagueId}/losers_bracket`),
  ]);
  const wb = bracket || [];
  const lb = losers || [];

  const userMap = {};
  for (const u of users) {
    userMap[u.user_id] = { name: u.display_name, team: u.metadata?.team_name || u.display_name };
  }

  const rosterOwner = {};
  for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;
  const rosterName = (rid) => userMap[rosterOwner[rid]]?.name || String(rid);

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
        ties:    s.ties    || 0,
        pf:      parseFloat((s.fpts || 0) + "." + String(s.fpts_decimal || 0).padStart(2, "0")),
        pa:      parseFloat((s.fpts_against || 0) + "." + String(s.fpts_against_decimal || 0).padStart(2, "0")),
        high:    0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);

  // Champion + completeness: a season is complete when its winners-bracket final has a winner.
  let champion = null;
  const champGame = L.bracketFinal(wb);
  if (champGame?.w) champion = rosterName(champGame.w);
  const complete = !!(champGame && champGame.w);

  // Games with positional breakdown, tagged with status (final/live) and phase
  // (regular/playoff/consolation). Scheduled (future) pairings go to schedule[],
  // never games[]. Playoff byes go to byes[] (DR-4).
  const games    = [];
  const schedule = [];
  const byes     = [];
  const pws      = L.playoffWeekStart(league);
  let lastFinalWeek = 0;
  let liveWeek      = null;
  for (let wi = 0; wi < matchups.length; wi++) {
    const weekNum = wi + 1;
    const status  = L.weekStatus(league, weekNum, state);
    const paired  = {};
    for (const entry of matchups[wi]) {
      const mid = entry.matchup_id;
      if (!mid) {
        if (status === "final" && L.isBye(weekNum, pws, entry.roster_id, wb)) {
          byes.push({ week: weekNum, manager: rosterName(entry.roster_id), pts: entry.points || 0 });
        }
        continue;
      }
      if (!paired[mid]) paired[mid] = [];
      paired[mid].push(entry);
    }
    for (const pair of Object.values(paired)) {
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const a = rosterName(x.roster_id);
      const b = rosterName(y.roster_id);
      if (status === "scheduled") {
        // Future playoff pairings are placeholders until the bracket is set — keep regular weeks only.
        if (weekNum < pws) schedule.push({ week: weekNum, a, b });
        continue;
      }
      const phase = L.gamePhase(weekNum, pws, x.roster_id, y.roster_id, wb, lb);
      if (status === "final") lastFinalWeek = Math.max(lastFinalWeek, weekNum);
      if (status === "live") liveWeek = weekNum;
      games.push({
        week:    weekNum,
        status,
        phase,
        playoff: phase !== "regular",
        a,
        b,
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

  // High score per manager (DR-4): max over FINAL paired games + playoff byes —
  // the same rows the games list carries. The old code took the max of every
  // matchup entry, including eliminated teams' and beyond-bracket (week 18)
  // scores that are not games, so standings.high disagreed with the games list.
  const highMap = {};
  const bump = (m, pts) => { if ((highMap[m] || 0) < pts) highMap[m] = pts; };
  for (const g of games) {
    if (g.status !== "final") continue;
    bump(g.a, g.pa); bump(g.b, g.pb);
  }
  for (const y of byes) bump(y.manager, y.pts);
  for (const s of standingsArr) s.high = highMap[s.manager] || 0;

  return {
    season: league.season, name: league.name, champion, complete,
    lastFinalWeek, liveWeek, standings: standingsArr, games, byes, schedule,
  };
}

async function main() {
  // Auto-detect season; fall back to prior year if new league not created yet
  const state = await getState();
  const currentSeason = state.season;
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
    const seasonData = await fetchSeason(leagueId, posMap, state);
    seasons.unshift(seasonData);
    const meta = await get(`${BASE}/league/${leagueId}`);
    leagueId = meta.previous_league_id || null;
    if (leagueId === "0" || leagueId === 0) leagueId = null;
  }

  // Full detail (per-game positional/starter/bench arrays) → history-details.json,
  // read only by build-alltime.js. The artifact fetches the lean history.json.
  writeJson(OUT_DETAILS, { seasons });

  // Lean history.json: everything the artifact's query engine needs
  // (week/status/phase/playoff/a/b/pa/pb) plus standings, champion, byes and the
// unplayed schedule. Drops the bulky per-game
  // ap/bp/as/bs/ab/bb arrays — the artifact never reads them (bench/positional
  // answers arrive precomputed via alltime.json).
  const lean = {
    seasons: seasons.map((s) => ({
      season: s.season,
      name: s.name,
      champion: s.champion,
      complete: s.complete,
      lastFinalWeek: s.lastFinalWeek,
      liveWeek: s.liveWeek,
      standings: s.standings,
      games: (s.games || []).map((g) => ({ week: g.week, status: g.status, phase: g.phase, playoff: g.playoff, a: g.a, b: g.b, pa: g.pa, pb: g.pb })),
      byes: s.byes,
      schedule: s.schedule,
    })),
  };
  writeJson(OUT, lean);
  console.log(`Wrote ${OUT} + ${OUT_DETAILS} — ${seasons.length} season(s): ${seasons.map((s) => s.season).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
