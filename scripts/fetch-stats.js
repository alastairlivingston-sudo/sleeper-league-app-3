#!/usr/bin/env node
// Fetches current-season standings, head-to-heads, extremes, and per-game
// positional breakdowns (ap/bp: QB/RB/WR/TE/K/DEF) + starter lists (as/bs).

const fs = require("fs");
const path = require("path");

const BASE = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const OUT = path.join(__dirname, "../docs/data/stats.json");

async function get(url) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000)); // 2s, 4s, 8s
    try {
      const res = await fetch(url);
      if (res.status === 404) { const err = new Error(`HTTP 404 ${url}`); err.notFound = true; throw err; }
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`HTTP ${res.status} ${url}`); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (e.notFound) throw e;                                 // definitive — surface to caller
      if (e.message && e.message.startsWith("HTTP ")) throw e; // non-retryable 4xx
      lastErr = e;                                             // network error — retry
    }
  }
  throw lastErr;
}

// Build sleeperId → {pos, name} map
async function buildPosMap() {
  console.log("Fetching /players/nfl for position data...");
  const players = await get(`${BASE}/players/nfl`);
  const pos = {};
  for (const [id, p] of Object.entries(players)) {
    const fp = p.fantasy_positions?.[0] || p.position;
    let posStr = null;
    if (fp === "QB") posStr = "QB";
    else if (fp === "RB" || fp === "FB") posStr = "RB";
    else if (fp === "WR") posStr = "WR";
    else if (fp === "TE") posStr = "TE";
    else if (fp === "K")  posStr = "K";
    if (posStr) pos[id] = { pos: posStr, name: p.full_name || null };
  }
  return pos;
}

function posPoints(entry, posMap) {
  const totals = {};
  const starters = entry.starters || [];
  const pts = entry.players_points || {};
  for (const pid of starters) {
    const pos = posMap[pid]?.pos || (/^[A-Z]{2,3}$/.test(pid) ? "DEF" : null);
    if (!pos) continue;
    totals[pos] = Math.round(((totals[pos] || 0) + (pts[pid] || 0)) * 100) / 100;
  }
  return totals;
}

function starterList(entry, posMap) {
  const starters = entry.starters || [];
  const pts = entry.players_points || {};
  return starters.map((pid) => {
    let n, pos;
    if (/^[A-Z]{2,3}$/.test(pid)) { n = pid; pos = "DEF"; }
    else { const m = posMap[pid]; if (!m) return null; n = m.name || pid; pos = m.pos; }
    return { n, pos, pts: Math.round((pts[pid] || 0) * 100) / 100 };
  }).filter(Boolean);
}

function benchList(entry, posMap) {
  const starters = new Set(entry.starters || []);
  const all = entry.players || [];
  const pts = entry.players_points || {};
  return all
    .filter(pid => !starters.has(pid) && !/^[A-Z]{2,3}$/.test(pid))
    .map(pid => {
      const m = posMap[pid];
      if (!m) return null;
      return { n: m.name || pid, pos: m.pos, pts: Math.round((pts[pid] || 0) * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.pts - a.pts);
}

async function findActiveLeague() {
  const state  = await get(`${BASE}/state/nfl`);
  const season = state.season;
  const user   = await get(`${BASE}/user/${USERNAME}`);

  for (const yr of [season, String(parseInt(season) - 1)]) {
    const leagues = await get(`${BASE}/user/${user.user_id}/leagues/nfl/${yr}`);
    const league  = leagues.find((l) => /borehamwood|plancy/i.test(l.name));
    if (!league) continue;

    // Skip leagues that haven't played any games yet
    const rosters = await get(`${BASE}/league/${league.league_id}/rosters`);
    const hasGames = rosters.some((r) => (r.settings?.wins || 0) + (r.settings?.losses || 0) > 0);
    if (hasGames) { console.log(`Using ${yr} season for stats`); return league; }
    console.log(`${yr} season exists but no games played yet — trying previous year`);
  }
  throw new Error("No Plancy league with played games found");
}

async function fetchAllMatchups(leagueId, playoffWeekStart) {
  const all = [];
  for (let w = 1; w <= 18; w++) {
    try {
      const week = await get(`${BASE}/league/${leagueId}/matchups/${w}`);
      if (!week || week.length === 0) break;
      all.push({ week: w, entries: week, playoff: w >= playoffWeekStart });
    } catch (e) { if (e.notFound) break; throw e; }
  }
  return all;
}

async function main() {
  const league = await findActiveLeague();
  const leagueId = league.league_id;
  const playoffWeekStart = league.settings?.playoff_week_start || 15;

  const [users, rosters, posMap] = await Promise.all([
    get(`${BASE}/league/${leagueId}/users`),
    get(`${BASE}/league/${leagueId}/rosters`),
    buildPosMap(),
  ]);

  const userMap = {};
  for (const u of users) {
    userMap[u.user_id] = { name: u.display_name, team: u.metadata?.team_name || u.display_name };
  }

  const rosterOwner = {};
  for (const r of rosters) rosterOwner[r.roster_id] = r.owner_id;

  const standingsArr = rosters
    .filter((r) => r.owner_id)
    .map((r) => {
      const uid = r.owner_id;
      const s = r.settings || {};
      return {
        manager: userMap[uid]?.name || uid,
        team: userMap[uid]?.team || uid,
        wins: s.wins || 0,
        losses: s.losses || 0,
        ties: s.ties || 0,
        pf: parseFloat((s.fpts || 0) + "." + String(s.fpts_decimal || 0).padStart(2, "0")),
        pa: parseFloat((s.fpts_against || 0) + "." + String(s.fpts_against_decimal || 0).padStart(2, "0")),
        streak: s.streak || 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);

  const matchupWeeks = await fetchAllMatchups(leagueId, playoffWeekStart);

  // head-to-head matrix: h2h[managerA][managerB] = { wins, losses, pf, pa }
  const h2h = {};
  const games = [];

  for (const { week, entries, playoff } of matchupWeeks) {
    const paired = {};
    for (const e of entries) {
      if (!e.matchup_id) continue;
      if (!paired[e.matchup_id]) paired[e.matchup_id] = [];
      paired[e.matchup_id].push(e);
    }
    for (const pair of Object.values(paired)) {
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const aUid = rosterOwner[x.roster_id];
      const bUid = rosterOwner[y.roster_id];
      const aName = userMap[aUid]?.name || String(x.roster_id);
      const bName = userMap[bUid]?.name || String(y.roster_id);
      games.push({
        week, playoff,
        a: aName, b: bName,
        pa: x.points || 0, pb: y.points || 0,
        ap: posPoints(x, posMap), bp: posPoints(y, posMap),
        as: starterList(x, posMap), bs: starterList(y, posMap),
        ab: benchList(x, posMap), bb: benchList(y, posMap),
      });

      if (!playoff) {
        if (!h2h[aName]) h2h[aName] = {};
        if (!h2h[bName]) h2h[bName] = {};
        if (!h2h[aName][bName]) h2h[aName][bName] = { wins: 0, losses: 0, pf: 0, pa: 0 };
        if (!h2h[bName][aName]) h2h[bName][aName] = { wins: 0, losses: 0, pf: 0, pa: 0 };

        const pa = x.points || 0;
        const pb = y.points || 0;
        h2h[aName][bName].pf += pa;
        h2h[aName][bName].pa += pb;
        h2h[bName][aName].pf += pb;
        h2h[bName][aName].pa += pa;
        if (pa > pb) {
          h2h[aName][bName].wins++;
          h2h[bName][aName].losses++;
        } else if (pb > pa) {
          h2h[bName][aName].wins++;
          h2h[aName][bName].losses++;
        }
      }
    }
  }

  // round pf/pa in h2h to 2 decimals
  for (const a of Object.values(h2h)) {
    for (const b of Object.values(a)) {
      b.pf = Math.round(b.pf * 100) / 100;
      b.pa = Math.round(b.pa * 100) / 100;
    }
  }

  // extremes (regular season only)
  const regGames = games.filter((g) => !g.playoff && g.pa > 0 && g.pb > 0);
  let closest = null, blowout = null, highWeek = null;

  for (const g of regGames) {
    const diff = Math.abs(g.pa - g.pb);
    const high = Math.max(g.pa, g.pb);
    if (!closest || diff < Math.abs(closest.pa - closest.pb)) closest = g;
    if (!blowout || diff > Math.abs(blowout.pa - blowout.pb)) blowout = g;
    if (!highWeek || high > Math.max(highWeek.pa, highWeek.pb)) highWeek = g;
  }

  const out = {
    league: league.name,
    season: league.season,
    standings: standingsArr,
    headToHead: h2h,
    games,
    extremes: {
      closestGame: closest,
      biggestBlowout: blowout,
      highestScoringGame: highWeek,
    },
    meta: { generated: new Date().toISOString() },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Standings: ${standingsArr.length} teams, ${games.length} games processed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
