// Shared helpers for the Sleeper data pipeline. CommonJS, zero dependencies.
// Consolidates what were four near-identical copies across the fetch scripts.

const fs   = require("fs");
const os   = require("os");
const path = require("path");

const BASE = "https://api.sleeper.app/v1";

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "../league-config.json"), "utf8"));
const USERNAME     = CONFIG.username;
const LEAGUE_REGEX = new RegExp(CONFIG.leagueNameRegex, "i");

// ── HTTP with retry ───────────────────────────────────────────────────────────
// Retries transient 429/5xx/network errors (2s/4s/8s); throws immediately on
// other 4xx; flags 404 via err.notFound so callers can treat "no such week" as
// end-of-season rather than a failure. A non-404 error surfaces so the script
// exits non-zero instead of silently publishing partial data.
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

// ── /players/nfl (multi-MB) — fetched once per run, cached to tmpdir ───────────
async function getPlayers() {
  const cache = path.join(os.tmpdir(), "sleeper-players-nfl.json");
  try {
    const st = fs.statSync(cache);
    if (Date.now() - st.mtimeMs < 6 * 3600 * 1000) {
      return JSON.parse(fs.readFileSync(cache, "utf8"));
    }
  } catch { /* no cache yet */ }
  const players = await get(`${BASE}/players/nfl`);
  try { fs.writeFileSync(cache, JSON.stringify(players)); } catch { /* tmpdir not writable — fine */ }
  return players;
}

// sleeperId → { pos, name } for skill positions only (QB/RB/WR/TE/K).
// DEF is handled positionally via playerPos()'s regex, not this map.
function skillPosMap(players) {
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

// ── position + scoring helpers (shared by fetch-history / fetch-stats) ─────────
const DEF_RE = /^[A-Z]{2,3}$/; // team defenses, e.g. "NE", "LAR"

function playerPos(pid, posMap) {
  if (DEF_RE.test(pid)) return "DEF";
  return posMap[pid]?.pos || null;
}

function posPoints(entry, posMap) {
  const result = {};
  const starters = entry.starters || [];
  const pts = entry.players_points || {};
  for (const pid of starters) {
    const pos = playerPos(pid, posMap);
    if (!pos) continue;
    result[pos] = Math.round(((result[pos] || 0) + (pts[pid] || 0)) * 100) / 100;
  }
  return result; // only non-zero positions present
}

// sort=true  → by points desc (history's presentation)
// sort=false → preserve lineup order from entry.starters (stats' presentation)
function starterList(entry, posMap, sort = true) {
  const starters = entry.starters || [];
  const pts = entry.players_points || {};
  const result = [];
  for (const pid of starters) {
    let n, pos;
    if (DEF_RE.test(pid)) { n = pid; pos = "DEF"; }
    else { const m = posMap[pid]; if (!m) continue; n = m.name || pid; pos = m.pos; }
    result.push({ n, pos, pts: Math.round((pts[pid] || 0) * 100) / 100 });
  }
  return sort ? result.sort((a, b) => b.pts - a.pts) : result;
}

function benchList(entry, posMap) {
  const starters = new Set(entry.starters || []);
  const all = entry.players || [];
  const pts = entry.players_points || {};
  const result = [];
  for (const pid of all) {
    if (starters.has(pid)) continue;
    if (DEF_RE.test(pid)) continue; // skip DEF on bench
    const m = posMap[pid];
    if (!m) continue;
    result.push({ n: m.name || pid, pos: m.pos, pts: Math.round((pts[pid] || 0) * 100) / 100 });
  }
  return result.sort((a, b) => b.pts - a.pts);
}

// ── league discovery ──────────────────────────────────────────────────────────
async function getUserId() {
  const user = await get(`${BASE}/user/${USERNAME}`);
  return user.user_id;
}

async function findLeague(userId, season) {
  const leagues = await get(`${BASE}/user/${userId}/leagues/nfl/${season}`);
  return leagues.find((l) => LEAGUE_REGEX.test(l.name)) || null;
}

// Most recent season whose league is "ready". readiness:
//   'players' — has any rostered players (rosters use this)
//   'games'   — has any played games (stats use this)
async function findActiveLeague(readiness) {
  const state  = await get(`${BASE}/state/nfl`);
  const season = state.season;
  const userId = await getUserId();
  const label  = readiness === "players" ? "rosters" : "stats";

  for (const yr of [season, String(parseInt(season) - 1)]) {
    const league = await findLeague(userId, yr);
    if (!league) continue;
    const rosters = await get(`${BASE}/league/${league.league_id}/rosters`);
    const ready = readiness === "players"
      ? rosters.some((r) => (r.players || []).length > 0)
      : rosters.some((r) => (r.settings?.wins || 0) + (r.settings?.losses || 0) > 0);
    if (ready) { console.log(`Using ${yr} season for ${label}`); return league; }
    const missing = readiness === "players" ? "players rostered" : "games played";
    console.log(`${yr} season exists but no ${missing} yet — trying previous year`);
  }
  throw new Error(`No Plancy league ready (${readiness}) found`);
}

function playoffWeekStart(league) {
  return league.settings?.playoff_week_start || 15;
}

// ── JSON output with meta stamp ───────────────────────────────────────────────
// Stamps meta.generated on fixed-shape object outputs. NOT for bare arrays, and
// NOT for rosters.json (a team-keyed map the artifact iterates key-by-key) —
// pass stampMeta:false for those.
function writeJson(outPath, data, { stampMeta = true } = {}) {
  const payload = stampMeta && !Array.isArray(data)
    ? { ...data, meta: { generated: new Date().toISOString() } }
    : data;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
}

module.exports = {
  BASE, USERNAME, LEAGUE_REGEX, CONFIG,
  get, getPlayers, skillPosMap,
  playerPos, posPoints, starterList, benchList, DEF_RE,
  getUserId, findLeague, findActiveLeague, playoffWeekStart,
  writeJson,
};
