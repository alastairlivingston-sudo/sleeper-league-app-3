#!/usr/bin/env node
// Computes all-time cross-season aggregates from history.json.
// Writes docs/data/alltime.json
// Includes: career records, all-time H2H, season rankings, records/extremes,
// consistency stats, positional strengths, playoff records, personal records,
// weekly scores, bench waste, seasonal trends, H2H by season.

const fs   = require("fs");
const path = require("path");

// Read the FULL detail file (per-game positional/bench arrays) — the served
// history.json is lean and lacks them. Falls back to history.json if details
// are absent (e.g. a partial local run).
// I/O paths default to the repo layout but are overridable via env so the golden
// test (scripts/test-alltime.js) can run this exact code against a fixture.
const HISTORY = process.env.ALLTIME_HISTORY || (
  fs.existsSync(path.join(__dirname, "../docs/data/history-details.json"))
    ? path.join(__dirname, "../docs/data/history-details.json")
    : path.join(__dirname, "../docs/data/history.json"));
const OUT     = process.env.ALLTIME_OUT || path.join(__dirname, "../docs/data/alltime.json");
const CONFIG  = process.env.ALLTIME_CONFIG || path.join(__dirname, "../league-config.json");

// Merge alternate Sleeper handles for the same person (Alastair's old account).
// Aliases come from league-config.json, the single source of truth shared with
// the artifact (injected into the template's canonical() at build time).
const ALIAS = JSON.parse(fs.readFileSync(CONFIG, "utf8")).aliases || {};
function canon(h) { const c = String(h || "").replace(/^@/, "").trim(); return ALIAS[c] || c; }

const { seasons } = JSON.parse(fs.readFileSync(HISTORY, "utf8"));
// Canonicalise every manager handle up-front so all derived stats merge accounts.
for (const s of seasons) {
  // DR-3: aggregates use FINAL games only. Live (in-progress week) rows are
  // dropped here; a missing status (older data / fixtures) counts as final.
  s.games = (s.games || []).filter((g) => !g.status || g.status === "final");
  if (s.champion) s.champion = canon(s.champion);
  for (const row of (s.standings || [])) row.manager = canon(row.manager);
  for (const g of (s.games || [])) { g.a = canon(g.a); g.b = canon(g.b); }
}

// ── Fact table (Phase 1) ──────────────────────────────────────────────────────
// Records, streaks, H2H and career W/L/PF/PA derive from the ONE manager-game
// table (template/15-facts.jsx, shared with the artifact), so alltime.json and
// the query engine cannot disagree. Shapes below are unchanged.
const FACTS = require("./build-facts").build({ seasons });
const factPlayedReg = FACTS.games.filter((r) => r.status === "final" && !r.bye && r.phase === "regular");
const factSeason = {};
for (const r of FACTS.seasons) factSeason[r.season + "|" + r.manager] = r;
// Map a fact row back to the original game object (alltime.json record shape).
function gameOf(row) {
  if (!row) return null;
  const s = seasons.find((x) => String(x.season) === row.season);
  const g = s && s.games.find((x) => x.week === row.week && ((x.a === row.manager && x.b === row.opponent) || (x.b === row.manager && x.a === row.opponent)));
  return g ? { ...g, season: s.season } : null;
}

// ── Career standings ──────────────────────────────────────────────────────────
const career = {};

for (const s of seasons) {
  for (const row of s.standings) {
    const m = row.manager;
    if (!career[m]) career[m] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, seasons: 0, championships: 0, playoffAppearances: 0 };
    const f = factSeason[String(s.season) + "|" + m] || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
    career[m].wins   += f.wins;
    career[m].losses += f.losses;
    career[m].ties   += f.ties;
    career[m].pf     += f.pf;
    career[m].pa     += f.pa;
    career[m].seasons++;
    if (s.champion === m) career[m].championships++;
  }

  const playoffManagers = new Set(
    s.games.filter(g => g.playoff).flatMap(g => [g.a, g.b])
  );
  for (const m of playoffManagers) {
    if (career[m]) career[m].playoffAppearances++;
  }
}

for (const c of Object.values(career)) {
  c.pf = Math.round(c.pf * 100) / 100;
  c.pa = Math.round(c.pa * 100) / 100;
  c.winPct = c.wins + c.losses + c.ties > 0
    ? Math.round(c.wins / (c.wins + c.losses + c.ties) * 1000) / 1000
    : 0;
}

const careerRankings = Object.entries(career)
  .map(([manager, stats]) => ({ manager, ...stats }))
  .sort((a, b) => b.winPct - a.winPct || b.pf - a.pf);

// ── All-time H2H ──────────────────────────────────────────────────────────────
const h2h = {};
const h2hBySeason = {};
for (const s of seasons) h2hBySeason[s.season] = {};
function h2hAdd(tbl, r) {
  if (!tbl[r.manager]) tbl[r.manager] = {};
  if (!tbl[r.manager][r.opponent]) tbl[r.manager][r.opponent] = { wins: 0, losses: 0, pf: 0, pa: 0 };
  const c = tbl[r.manager][r.opponent];
  c.pf += r.pf; c.pa += r.pa;
  if (r.result === "W") c.wins++; else if (r.result === "L") c.losses++;
}
for (const r of factPlayedReg) {
  h2hAdd(h2h, r);
  h2hAdd(h2hBySeason[seasons.find((x) => String(x.season) === r.season).season], r);
}
for (const tbl of [h2h, ...Object.values(h2hBySeason)])
  for (const a of Object.values(tbl))
    for (const b of Object.values(a)) {
      b.pf = Math.round(b.pf * 100) / 100;
      b.pa = Math.round(b.pa * 100) / 100;
    }

// ── Nemesis & bunny ───────────────────────────────────────────────────────────
const MIN_MEETINGS = 3;
const nemesis = {};
const bunny   = {};
for (const [manager, opps] of Object.entries(h2h)) {
  const rows = Object.entries(opps)
    .map(([opponent, r]) => {
      const games = r.wins + r.losses;
      return { opponent, wins: r.wins, losses: r.losses, games, winPct: games ? Math.round(r.wins / games * 1000) / 1000 : 0, pf: r.pf, pa: r.pa };
    })
    .filter(r => r.games >= MIN_MEETINGS);
  if (!rows.length) continue;
  nemesis[manager] = rows.slice().sort((x, y) => x.winPct - y.winPct || y.losses - x.losses || x.pf - y.pf)[0];
  bunny[manager]   = rows.slice().sort((x, y) => y.winPct - x.winPct || y.wins - x.wins || y.pf - x.pf)[0];
}

// ── Season-by-season rankings ─────────────────────────────────────────────────
const seasonRankings = seasons.map(s => ({
  season: s.season,
  champion: s.champion,
  standings: s.standings.map((row, i) => ({ rank: i + 1, manager: row.manager, wins: row.wins, losses: row.losses, pf: row.pf })),
}));

// ── All-time records ──────────────────────────────────────────────────────────
const allGames = seasons.flatMap(s => s.games.map(g => ({ ...g, season: s.season })));
const regGames = allGames.filter(g => !g.playoff && g.pa > 0 && g.pb > 0);

const FR = FACTS.records;
const first = (k) => (FR[k].regular || [])[0];
const records = {
  highestScore:  gameOf(first("highestScore")),
  lowestScore:   gameOf(first("lowestScore")),
  biggestWin:    gameOf(first("biggestMargin")),
  closestGame:   gameOf(first("closestGame")),
  highestSeason: null,
  lowestSeason:  null,
};
const seasonRec = (r) => r ? { manager: r.manager, season: seasons.find((x) => String(x.season) === r.season).season, pf: r.pf } : null;
records.highestSeason = seasonRec(first("bestSeasonPF"));
records.lowestSeason  = seasonRec(first("worstSeasonPF"));
const streakRec = (r) => r ? { manager: r.manager, streak: r.length } : null;
records.longestWinStreak  = streakRec(first("longestWinStreak"));
records.longestLossStreak = streakRec(first("longestLossStreak"));

// ── Bench stats ───────────────────────────────────────────────────────────────
const benchWasted = {};
let benchGamesCount = 0;
for (const g of allGames) {
  const process = (manager, bench) => {
    if (!bench || bench.length === 0) return;
    const benchTotal = bench.reduce((s, p) => s + p.pts, 0);
    if (!benchWasted[manager]) benchWasted[manager] = { total: 0, games: 0 };
    benchWasted[manager].total += Math.round(benchTotal * 100) / 100;
    benchWasted[manager].games++;
  };
  process(g.a, g.ab);
  process(g.b, g.bb);
  if (g.ab || g.bb) benchGamesCount++;
}

const benchAvg = Object.entries(benchWasted).map(([manager, d]) => ({
  manager,
  totalBenchPts: Math.round(d.total * 100) / 100,
  games: d.games,
  avgBenchPts: Math.round(d.total / d.games * 100) / 100,
})).sort((a, b) => b.avgBenchPts - a.avgBenchPts);

// ── Weekly scores per manager per season ──────────────────────────────────────
// weeklyScores[manager][season] = [{ week, score }]
const weeklyScores = {};
for (const s of seasons) {
  for (const g of s.games) {
    if (g.playoff) continue;
    const addScore = (manager, score) => {
      if (!weeklyScores[manager]) weeklyScores[manager] = {};
      if (!weeklyScores[manager][s.season]) weeklyScores[manager][s.season] = [];
      weeklyScores[manager][s.season].push({ week: g.week, score: Math.round(score * 100) / 100 });
    };
    addScore(g.a, g.pa);
    addScore(g.b, g.pb);
  }
}

// ── Consistency stats per manager (all-time + per season) ────────────────────
// stdDev of weekly scores
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

const consistencyStats = {};
for (const [manager, bySeasonObj] of Object.entries(weeklyScores)) {
  const perSeason = {};
  const allScores = [];
  for (const [season, weeks] of Object.entries(bySeasonObj)) {
    const scores = weeks.map(w => w.score);
    allScores.push(...scores);
    const avg = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length * 100) / 100;
    perSeason[season] = {
      avg,
      stdDev: stdDev(scores),
      high: Math.max(...scores),
      low: Math.min(...scores),
      games: scores.length,
    };
  }
  const avg = Math.round(allScores.reduce((s, x) => s + x, 0) / allScores.length * 100) / 100;
  consistencyStats[manager] = {
    allTime: { avg, stdDev: stdDev(allScores), high: Math.max(...allScores), low: Math.min(...allScores), games: allScores.length },
    perSeason,
  };
}

// ── Personal records per manager ──────────────────────────────────────────────
// allTimeHigh, allTimeLow, biggestWin, biggestLoss (regular season only)
const personalRecords = {};
for (const g of regGames) {
  const update = (manager, scored, allowed) => {
    if (!personalRecords[manager]) personalRecords[manager] = {
      highWeek: { score: 0, opp: null, season: null, week: null },
      lowWeek:  { score: Infinity, opp: null, season: null, week: null },
      biggestWin:  { margin: 0, score: 0, opp: null, season: null, week: null },
      biggestLoss: { margin: 0, score: 0, opp: null, season: null, week: null },
    };
    const r = personalRecords[manager];
    if (scored > r.highWeek.score) r.highWeek = { score: Math.round(scored*100)/100, opp: scored === g.pa ? g.b : g.a, season: g.season, week: g.week };
    if (scored < r.lowWeek.score)  r.lowWeek  = { score: Math.round(scored*100)/100, opp: scored === g.pa ? g.b : g.a, season: g.season, week: g.week };
    const margin = Math.round((scored - allowed) * 100) / 100;
    if (scored > allowed && margin > r.biggestWin.margin)  r.biggestWin  = { margin, score: Math.round(scored*100)/100, opp: scored === g.pa ? g.b : g.a, season: g.season, week: g.week };
    if (scored < allowed && -margin > r.biggestLoss.margin) r.biggestLoss = { margin: Math.round(-margin*100)/100, score: Math.round(scored*100)/100, opp: scored === g.pa ? g.b : g.a, season: g.season, week: g.week };
  };
  update(g.a, g.pa, g.pb);
  update(g.b, g.pb, g.pa);
}
// Clean up Infinity
for (const r of Object.values(personalRecords)) {
  if (r.lowWeek.score === Infinity) r.lowWeek.score = 0;
}

// ── Playoff records per manager ───────────────────────────────────────────────
const playoffRecords = {};
for (const s of seasons) {
  for (const g of s.games.filter(g => g.playoff && g.pa > 0 && g.pb > 0)) {
    const addPO = (manager, scored, allowed) => {
      if (!playoffRecords[manager]) playoffRecords[manager] = { wins: 0, losses: 0, pf: 0, pa: 0, appearances: 0 };
      const r = playoffRecords[manager];
      r.pf += scored; r.pa += allowed;
      if (scored > allowed) r.wins++; else r.losses++;
    };
    addPO(g.a, g.pa, g.pb);
    addPO(g.b, g.pb, g.pa);
  }
  // Count appearances (any playoff game)
  const playoffMgrs = new Set(s.games.filter(g => g.playoff).flatMap(g => [g.a, g.b]));
  for (const m of playoffMgrs) {
    if (!playoffRecords[m]) playoffRecords[m] = { wins: 0, losses: 0, pf: 0, pa: 0, appearances: 0 };
    playoffRecords[m].appearances++;
  }
}
for (const r of Object.values(playoffRecords)) {
  r.pf = Math.round(r.pf * 100) / 100;
  r.pa = Math.round(r.pa * 100) / 100;
}

// ── Seasonal scoring trends per manager ──────────────────────────────────────
// Points-per-game by season to track improvement/decline
const seasonalTrends = {};
for (const s of seasons) {
  for (const row of s.standings) {
    const m = row.manager;
    const regCount = s.games.filter(g => !g.playoff && (g.a === m || g.b === m)).length;
    if (!seasonalTrends[m]) seasonalTrends[m] = [];
    seasonalTrends[m].push({
      season: s.season,
      pf: row.pf,
      wins: row.wins,
      losses: row.losses,
      ppg: regCount > 0 ? Math.round(row.pf / regCount * 100) / 100 : 0,
      rank: s.standings.findIndex(r => r.manager === m) + 1,
    });
  }
}

// ── Expected wins vs actual wins (luck score) per manager per season ──────────
// Expected wins = sum over weeks of (your score / (sum of all scores that week))
// interpreted as fraction of possible opponents you'd beat each week
const luckScores = {};
for (const s of seasons) {
  const regGamesS = s.games.filter(g => !g.playoff && g.pa > 0 && g.pb > 0);
  // Gather all scores per week
  const weekScores = {};
  for (const g of regGamesS) {
    if (!weekScores[g.week]) weekScores[g.week] = [];
    weekScores[g.week].push({ manager: g.a, score: g.pa });
    weekScores[g.week].push({ manager: g.b, score: g.pb });
  }
  const expectedWins = {};
  for (const [, scores] of Object.entries(weekScores)) {
    for (const { manager, score } of scores) {
      const others = scores.filter(x => x.manager !== manager);
      if (!others.length) continue;
      const exp = others.filter(x => score > x.score).length / others.length;
      if (!expectedWins[manager]) expectedWins[manager] = 0;
      expectedWins[manager] += exp;
    }
  }
  for (const row of s.standings) {
    const m = row.manager;
    const exp = Math.round((expectedWins[m] || 0) * 100) / 100;
    const luck = Math.round((row.wins - exp) * 100) / 100;
    if (!luckScores[m]) luckScores[m] = [];
    luckScores[m].push({ season: s.season, actualWins: row.wins, expectedWins: exp, luckScore: luck });
  }
}

// ── Positional strengths per manager per season ───────────────────────────────
// Average points from each roster position (QB/RB/WR/TE/K/DEF) per game
// Uses ap/bp (positional points) objects when present
const positionalStrengths = {};
for (const s of seasons) {
  for (const g of s.games) {
    if (g.playoff) continue;
    const processPos = (manager, posObj) => {
      if (!posObj || typeof posObj !== 'object') return;
      if (!positionalStrengths[manager]) positionalStrengths[manager] = {};
      if (!positionalStrengths[manager][s.season]) positionalStrengths[manager][s.season] = { games: 0 };
      const entry = positionalStrengths[manager][s.season];
      entry.games++;
      for (const [pos, pts] of Object.entries(posObj)) {
        if (!entry[pos]) entry[pos] = 0;
        entry[pos] += pts;
      }
    };
    processPos(g.a, g.ap);
    processPos(g.b, g.bp);
  }
}
// Convert totals to averages
for (const mgr of Object.values(positionalStrengths)) {
  for (const season of Object.values(mgr)) {
    const { games, ...positions } = season;
    if (games > 0) {
      for (const pos of Object.keys(positions)) {
        season[pos] = Math.round(season[pos] / games * 100) / 100;
      }
    }
  }
}

// ── Top bench waste games (most pts left on bench in a single game) ───────────
const benchWasteTop = [];
for (const g of allGames) {
  const addBench = (manager, bench) => {
    if (!bench || !bench.length) return;
    const total = Math.round(bench.reduce((s, p) => s + p.pts, 0) * 100) / 100;
    benchWasteTop.push({ manager, season: g.season, week: g.week, benchPts: total });
  };
  addBench(g.a, g.ab);
  addBench(g.b, g.bb);
}
benchWasteTop.sort((a, b) => b.benchPts - a.benchPts);
const benchWasteTopN = benchWasteTop.slice(0, 20);

// ── Per-player scoring (starters) → player-scores.json ────────────────────────
// Compact per-(player, pos, manager, season) aggregate so the artifact's query
// engine can answer player-level questions ("best WR", "top scorers", "how did X
// do") WITHOUT loading the 857KB detail file. Only STARTER points count (what the
// manager actually banked); DEF/K included as scoring units.
const playerAgg = {};
for (const s of seasons) {
  for (const g of (s.games || [])) {
    for (const [mgr, starters] of [[g.a, g.as], [g.b, g.bs]]) {
      for (const p of (starters || [])) {
        if (!p || !p.n) continue;
        const key = p.n + '|' + p.pos + '|' + mgr + '|' + s.season;
        if (!playerAgg[key]) playerAgg[key] = { player: p.n, pos: p.pos, manager: mgr, season: s.season, games: 0, pts: 0, best: 0 };
        const a = playerAgg[key];
        a.games++;
        a.pts = Math.round((a.pts + (p.pts || 0)) * 100) / 100;
        if ((p.pts || 0) > a.best) a.best = p.pts || 0;
      }
    }
  }
}
const playerScores = Object.values(playerAgg)
  .map((a) => { a.avg = a.games ? Math.round(a.pts / a.games * 100) / 100 : 0; return a; })
  .sort((a, b) => b.pts - a.pts);
const OUT_PLAYERS = process.env.ALLTIME_OUT_PLAYERS || path.join(__dirname, "../docs/data/player-scores.json");
fs.writeFileSync(OUT_PLAYERS, JSON.stringify(playerScores, null, 2));
console.log(`Wrote ${OUT_PLAYERS} — ${playerScores.length} player-season rows`);

// ── Write output ──────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  careerRankings,
  allTimeH2H: h2h,
  h2hBySeason,
  nemesis,
  bunny,
  seasonRankings,
  records,
  benchStats: { gamesWithData: benchGamesCount, perManager: benchAvg },
  weeklyScores,
  consistencyStats,
  personalRecords,
  playoffRecords,
  seasonalTrends,
  luckScores,
  positionalStrengths,
  benchWasteTop: benchWasteTopN,
  meta: { generated: new Date().toISOString() },
}, null, 2));

console.log(`Wrote ${OUT}`);
console.log(`  ${careerRankings.length} managers, ${seasons.length} seasons, ${allGames.length} total games`);
console.log(`  Bench data available for ${benchGamesCount} game-sides`);
const newTables = ['h2hBySeason','consistencyStats','personalRecords','playoffRecords','seasonalTrends','luckScores','positionalStrengths','benchWasteTop'];
console.log(`  New tables: ${newTables.join(', ')}`);
