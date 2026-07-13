#!/usr/bin/env node
// Walks previous_league_id chain and writes history.json.
// Each game now includes positional point breakdowns (ap/bp: QB/RB/WR/TE/K/DEF).
// Season auto-detected from /state/nfl — no hardcoded year needed.

const fs = require("fs");
const path = require("path");

const BASE     = "https://api.sleeper.app/v1";
const USERNAME = "AlastairL";
const OUT      = path.join(__dirname, "../docs/data/history.json");

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

async function getCurrentSeason() {
  const state = await get(`${BASE}/state/nfl`);
  return state.season; // e.g. "2025"
}

async function findLeague(season) {
  const user    = await get(`${BASE}/user/${USERNAME}`);
  const leagues = await get(`${BASE}/user/${user.user_id}/leagues/nfl/${season}`);
  const league  = leagues.find((l) => /borehamwood|plancy/i.test(l.name));
  if (!league) throw new Error(`Plancy league not found for season ${season}`);
  return league;
}

// Build sleeperId → {pos, name} map (fetched once for all seasons)
async function buildPosMap() {
  console.log("Fetching /players/nfl for position + name data...");
  const players = await get(`${BASE}/players/nfl`);
  const pos = {};
  for (const [id, p] of Object.entries(players)) {
    if (!p) continue;
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

function playerPos(pid, posMap) {
  if (/^[A-Z]{2,3}$/.test(pid)) return "DEF"; // team defenses e.g. "NE", "LAR"
  return posMap[pid]?.pos || null;
}

function posPoints(entry, posMap) {
  const result  = {};
  const starters = entry.starters || [];
  const pts      = entry.players_points || {};
  for (const pid of starters) {
    const pos   = playerPos(pid, posMap);
    if (!pos) continue;
    const score = pts[pid] || 0;
    result[pos] = Math.round(((result[pos] || 0) + score) * 100) / 100;
  }
  return result; // only non-zero positions present
}

// Individual starter performances: [{n, pos, pts}] sorted by pts desc
function starterList(entry, posMap) {
  const starters = entry.starters || [];
  const pts      = entry.players_points || {};
  const result   = [];
  for (const pid of starters) {
    let n, pos;
    if (/^[A-Z]{2,3}$/.test(pid)) { n = pid; pos = "DEF"; }
    else { const m = posMap[pid]; if (!m) continue; n = m.name || pid; pos = m.pos; }
    const score = pts[pid] || 0;
    result.push({ n, pos, pts: Math.round(score * 100) / 100 });
  }
  return result.sort((a, b) => b.pts - a.pts);
}

// Bench player performances: [{n, pos, pts}] — rostered but not started
function benchList(entry, posMap) {
  const starters = new Set(entry.starters || []);
  const all      = entry.players || [];
  const pts      = entry.players_points || {};
  const result   = [];
  for (const pid of all) {
    if (starters.has(pid)) continue;
    if (/^[A-Z]{2,3}$/.test(pid)) continue; // skip DEF on bench
    const m = posMap[pid];
    if (!m) continue;
    result.push({ n: m.name || pid, pos: m.pos, pts: Math.round((pts[pid] || 0) * 100) / 100 });
  }
  return result.sort((a, b) => b.pts - a.pts);
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
  const playoffWk  = league.settings?.playoff_week_start || matchups.length - 2;
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

  const posMap  = await buildPosMap();
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

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ seasons, meta: { generated: new Date().toISOString() } }, null, 2));
  console.log(`Wrote ${OUT} — ${seasons.length} season(s): ${seasons.map((s) => s.season).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
