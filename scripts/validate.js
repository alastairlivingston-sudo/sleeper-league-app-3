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
const warnings = [];
function warn(cond, invariant, detail) {
  if (!cond) warnings.push(`[${invariant}] ${detail}`);
  return cond;
}
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

const { checkHistory } = require("./validate-history");

// ── history.json ──────────────────────────────────────────────────────────────
const history = readJson(path.join(DATA, "history.json"));
check(Array.isArray(history.seasons) && history.seasons.length > 0,
  "history.seasons", "seasons[] is empty or missing");

// Season-level invariants (complete + in-progress seasons, DR-3/DR-4) live in
// validate-history.js so test-status.js can run them against fixtures.
checkHistory(history, { check, warn, canon });

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

// ── games.json (fact table, Phase 1) ─────────────────────────────────────────
const factsPath = path.join(DATA, "games.json");
if (fs.existsSync(factsPath)) {
  const facts = readJson(factsPath);
  const rows = facts.games || [];
  check(rows.length > 0, "facts.nonempty", "games.json has no rows");
  const byGame = {};
  for (const r of rows) (byGame[r.gameId] = byGame[r.gameId] || []).push(r);
  const ids = new Set(rows.map((r) => r.id));
  check(ids.size === rows.length, "facts.id.unique", "games.json row ids are not unique");
  const comp = { W: "L", L: "W", T: "T" };
  for (const [gid, pair] of Object.entries(byGame)) {
    if (pair[0].bye) { check(pair.length === 1 && pair[0].opponent == null, "facts.bye", `${gid} bye row malformed`); continue; }
    if (!check(pair.length === 2, "facts.pair", `${gid} has ${pair.length} rows, expected 2`)) continue;
    const [x, y] = pair;
    check(x.manager === y.opponent && y.manager === x.opponent, "facts.mirror.managers", `${gid} manager/opponent do not mirror`);
    check(x.pf === y.pa && x.pa === y.pf, "facts.mirror.points", `${gid} pf/pa do not mirror`);
    if (x.status === "final") check(comp[x.result] === y.result, "facts.result", `${gid} results ${x.result}/${y.result} not complementary`);
    else check(x.result == null && y.result == null, "facts.result.live", `${gid} live game has a result`);
  }
  // Per manager-season: game count from rows == Sleeper W+L+T (hard); exact W/L
  // is a warning (Sleeper W/L vs stored scores drift — the 2023 stat-correction quirk).
  for (const sr of facts.seasons || []) {
    const s = (history.seasons || []).find((x) => String(x.season) === sr.season);
    const st = s && (s.standings || []).find((r) => canon(r.manager) === sr.manager);
    if (!st) { check(false, "facts.seasons.standings", `${sr.season} ${sr.manager} not in history standings`); continue; }
    const sleeperGames = (st.wins || 0) + (st.losses || 0) + (st.ties || 0);
    check(sr.games === sleeperGames, "facts.seasons.games",
      `${sr.season} ${sr.manager}: ${sr.games} final regular rows != Sleeper record ${sleeperGames}`);
    warn(sr.wins === (st.wins || 0) && sr.losses === (st.losses || 0), "facts.seasons.wl",
      `${sr.season} ${sr.manager}: rows ${sr.wins}-${sr.losses} vs Sleeper ${st.wins}-${st.losses}`);
  }
  // Every record row must exist in the table (records are derived, never invented).
  const recs = facts.records || {};
  const checkRec = (label, list) => {
    for (const r of list || []) {
      if (r && r.id && r.gameId) check(ids.has(r.id), "facts.records.exist", `${label} row ${r.id} not in games table`);
    }
  };
  for (const [name, scoped] of Object.entries(recs)) {
    if (name === "current") continue;
    checkRec(name + ".regular", scoped.regular);
    checkRec(name + ".all", scoped.all);
  }
  check(recs.highestScoreInLoss && recs.highestScoreInLoss.regular.every((r) => r.result === "L"),
    "facts.records.loss", "highestScoreInLoss contains a non-loss row");
}

// ── stats.json ──────────────────────────────────────────────────────────────
const stats = readJson(path.join(DATA, "stats.json"));
if (latest) {
  check(String(stats.season) === String(latest.season), "stats.season",
    `stats season ${stats.season} != latest played history season ${latest.season}`);
  const histMgrs = new Set(latest.standings.map((r) => canon(r.manager)));
  const statMgrs = new Set((stats.standings || []).map((r) => canon(r.manager)));
  check(histMgrs.size === statMgrs.size && [...statMgrs].every((m) => histMgrs.has(m)),
    "stats.reconcile", "stats standings managers do not reconcile with history's latest season");

  // Reconcile stats.json with history.json on FINAL games only: each manager's
  // head-to-head W/L summed over opponents == history's standings W/L.
  const h2h = stats.headToHead || {};
  for (const r of latest.standings) {
    const m = canon(r.manager);
    let w = 0, l = 0;
    for (const [a, opps] of Object.entries(h2h)) {
      if (canon(a) !== m) continue;
      for (const rec of Object.values(opps)) { w += rec.wins || 0; l += rec.losses || 0; }
    }
    check(w === (r.wins || 0) && l === (r.losses || 0), "stats.h2h.reconcile",
      `stats headToHead for ${r.manager} sums to ${w}-${l}, history standings ${r.wins}-${r.losses}`);
  }
  if (stats.throughWeek != null && latest.lastFinalWeek != null) {
    check(stats.throughWeek === latest.lastFinalWeek, "stats.throughWeek",
      `stats throughWeek ${stats.throughWeek} != history lastFinalWeek ${latest.lastFinalWeek}`);
  }
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
if (warnings.length) {
  console.warn(`validate.js: ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn("  " + w);
}
if (errors.length) {
  console.error(`validate.js: ${errors.length} invariant(s) FAILED:`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("validate.js: all invariants passed" + (FRESH ? " (incl. freshness)" : ""));
