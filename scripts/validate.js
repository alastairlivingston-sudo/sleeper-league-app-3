#!/usr/bin/env node
// Validates the generated data contract before it is committed/published.
// Exits non-zero with a named invariant on the first failure. Zero deps.
//
// Usage: node scripts/validate.js [--fresh]
//   --fresh  also assert every object-shaped file's meta.generated is < 48h old
//            (the GitHub Action passes this; local runs usually don't).

const fs   = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "../docs/data");
const ROOT = path.join(__dirname, "..");
const FRESH = process.argv.includes("--fresh");

const errors = [];
function check(cond, invariant, detail) {
  if (!cond) errors.push(`[${invariant}] ${detail}`);
  return cond;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// Canonicalization — MUST match build-alltime.js canon() / template canonical().
const ALIASES = (() => {
  const cfg = path.join(ROOT, "league-config.json");
  if (fs.existsSync(cfg)) { try { return readJson(cfg).aliases || {}; } catch { /* fall through */ } }
  return { allyl900: "AlastairL" };
})();
function canon(h) {
  const c = String(h || "").replace(/^@/, "").trim();
  return ALIASES[c] || c;
}

// ── history.json ──────────────────────────────────────────────────────────────
const history = readJson(path.join(DATA, "history.json"));
check(Array.isArray(history.seasons) && history.seasons.length > 0,
  "history.seasons", "seasons[] is empty or missing");

for (const s of history.seasons || []) {
  const games = s.games || [];
  const standings = s.standings || [];
  if (games.length === 0) continue; // future/unplayed season — skip completeness checks

  // Known handles for THIS season (Sleeper display names vary by season).
  const known = new Set(standings.map((r) => canon(r.manager)));

  check(standings.length === 8, "history.standings.count",
    `season ${s.season} has ${standings.length} standings rows, expected 8`);
  check(s.champion != null, "history.champion",
    `season ${s.season} has games but champion is null`);

  // Contiguous weeks from 1 (catches a mid-season gap).
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  check(weeks[0] === 1, "history.weeks.start",
    `season ${s.season} first game week is ${weeks[0]}, expected 1`);
  for (let i = 0; i < weeks.length; i++) {
    check(weeks[i] === i + 1, "history.weeks.contiguous",
      `season ${s.season} week gap: expected ${i + 1}, got ${weeks[i]}`);
  }

  // Truncation guard: standings W/L come from Sleeper's authoritative roster
  // settings (full season); the games list is fetched week-by-week and can be
  // cut short by a transient error. So each manager's regular-season game count
  // must equal wins+losses+ties. A tail-truncated season fails here even though
  // its remaining weeks are still contiguous from 1.
  const regCount = {};
  for (const g of games) {
    if (g.playoff) continue;
    for (const m of [canon(g.a), canon(g.b)]) regCount[m] = (regCount[m] || 0) + 1;
  }
  for (const r of standings) {
    const m = canon(r.manager);
    const record = (r.wins || 0) + (r.losses || 0) + (r.ties || 0);
    check(record === (regCount[m] || 0), "history.games.complete",
      `season ${s.season} ${r.manager}: standings record ${record} != ${regCount[m] || 0} regular-season games (truncated?)`);
  }
  // A completed season with a champion is a playoff league — at least one playoff
  // game must be present (guards wholesale loss of the playoff weeks). NOTE: a
  // break during the final playoff week is not asserted here (rare, and the
  // champion comes from the winners_bracket fetch, not this games list).
  check(games.some((g) => g.playoff), "history.playoffs.present",
    `season ${s.season} has a champion but no playoff games`);

  // Every participant handle resolves into this season's standings; scores non-negative.
  const champ = canon(s.champion);
  check(known.has(champ), "history.champion.known",
    `season ${s.season} champion ${s.champion} not in standings`);
  for (const g of games) {
    check(known.has(canon(g.a)), "history.game.handle", `season ${s.season} unknown manager ${g.a}`);
    check(known.has(canon(g.b)), "history.game.handle", `season ${s.season} unknown manager ${g.b}`);
    check(g.pa >= 0 && g.pb >= 0, "history.game.score",
      `season ${s.season} wk${g.week} negative score ${g.pa}/${g.pb}`);
  }
}

// history-details.json (full per-game arrays, read by build-alltime) must carry
// exactly the same games as the lean history.json — guards the split.
const detailsPath = path.join(DATA, "history-details.json");
if (fs.existsSync(detailsPath)) {
  const details = readJson(detailsPath);
  const countGames = (h) => (h.seasons || []).reduce((n, s) => n + (s.games || []).length, 0);
  check(countGames(details) === countGames(history), "history.details.count",
    `history-details game count ${countGames(details)} != history ${countGames(history)}`);
  check(details.meta && details.meta.generated, "history.details.meta",
    "history-details.json missing meta.generated");
}

// player-scores.json: per-player starter aggregates for the query engine.
const playersPath = path.join(DATA, "player-scores.json");
if (fs.existsSync(playersPath)) {
  const ps = readJson(playersPath);
  check(Array.isArray(ps) && ps.length > 0, "players.nonempty", "player-scores.json is empty");
  check(ps.some((r) => r.pos === "WR" && r.pts > 0), "players.wr", "no WR scoring rows in player-scores.json");
  check(ps.every((r) => r.player && r.pos && r.manager && r.season && typeof r.pts === "number"), "players.shape",
    "player-scores.json row missing player/pos/manager/season/pts");
}

const playedSeasons = (history.seasons || []).filter((s) => (s.games || []).length > 0);
const latest = playedSeasons[playedSeasons.length - 1];

// ── stats.json ──────────────────────────────────────────────────────────────
const stats = readJson(path.join(DATA, "stats.json"));
if (latest) {
  check(String(stats.season) === String(latest.season), "stats.season",
    `stats season ${stats.season} != latest played history season ${latest.season}`);
  const histMgrs = new Set(latest.standings.map((r) => canon(r.manager)));
  const statMgrs = new Set((stats.standings || []).map((r) => canon(r.manager)));
  check(histMgrs.size === statMgrs.size && [...statMgrs].every((m) => histMgrs.has(m)),
    "stats.reconcile", "stats standings managers do not reconcile with history's latest season");
}

// ── transactions.json ─────────────────────────────────────────────────────────
const txns = readJson(path.join(DATA, "transactions.json"));
const txList = Array.isArray(txns) ? txns : (txns.items || []);
for (const t of txList) {
  check((t.aReceives || []).concat(t.bReceives || []).length > 0, "transactions.receives",
    `trade ${t.season} wk${t.week} ${t.managerA}/${t.managerB} has empty receives`);
}

// ── alltime.json ──────────────────────────────────────────────────────────────
const alltime = readJson(path.join(DATA, "alltime.json"));
check(Array.isArray(alltime.careerRankings) && alltime.careerRankings.length > 0,
  "alltime.careerRankings", "careerRankings is empty or missing");
for (const c of alltime.careerRankings || []) {
  const games = (c.wins || 0) + (c.losses || 0) + (c.ties || 0);
  if (games > 0) {
    check(c.pa !== 0, "alltime.pa", `${c.manager || c.handle} has ${games} games but pa == 0`);
  }
}

// ── meta.generated (fixed-shape object files only) ────────────────────────────
// rosters.json is deliberately excluded: it is a map keyed by team, and the
// artifact iterates every key as a team (Object.keys/values), so a sibling
// `meta` key would be mis-read as a team. It stays unstamped, like the arrays.
const OBJECT_FILES = [
  path.join(DATA, "history.json"),
  path.join(DATA, "stats.json"),
  path.join(DATA, "alltime.json"),
  path.join(ROOT, "docs/lore/master.json"),
];
for (const f of OBJECT_FILES) {
  if (!fs.existsSync(f)) continue;
  const j = readJson(f);
  const gen = j.meta && j.meta.generated;
  check(gen != null, "meta.generated", `${path.basename(f)} missing meta.generated`);
  if (gen != null) {
    const age = Date.now() - Date.parse(gen);
    check(!Number.isNaN(age), "meta.generated.parse", `${path.basename(f)} meta.generated unparseable: ${gen}`);
    if (FRESH) {
      check(age < 48 * 3600 * 1000, "meta.generated.fresh",
        `${path.basename(f)} meta.generated is ${Math.round(age / 3600000)}h old`);
    }
  }
}

// ── commissioner.jsx (built artifact) ─────────────────────────────────────────
const artifact = fs.readFileSync(path.join(ROOT, "commissioner.jsx"), "utf8");
check(!/__[A-Z_]+__/.test(artifact), "artifact.placeholders",
  "commissioner.jsx still contains an unfilled __PLACEHOLDER__");
check(artifact.includes("BUILT_AT"), "artifact.builtAt", "commissioner.jsx missing BUILT_AT");

// ── report ────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`validate.js: ${errors.length} invariant(s) FAILED:`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("validate.js: all invariants passed" + (FRESH ? " (incl. freshness)" : ""));
