#!/usr/bin/env node
// Computes all-time cross-season aggregates from history.json.
// Writes docs/data/alltime.json
// Includes: career records, all-time H2H, season rankings, records/extremes.

const fs   = require("fs");
const path = require("path");

const HISTORY = path.join(__dirname, "../docs/data/history.json");
const OUT     = path.join(__dirname, "../docs/data/alltime.json");

const { seasons } = JSON.parse(fs.readFileSync(HISTORY, "utf8"));

// ── Career standings ──────────────────────────────────────────────────────────
const career = {}; // manager → { wins, losses, ties, pf, pa, seasons, championships, appearances }

for (const s of seasons) {
  for (const row of s.standings) {
    const m = row.manager;
    if (!career[m]) career[m] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, seasons: 0, championships: 0, playoffAppearances: 0 };
    career[m].wins   += row.wins;
    career[m].losses += row.losses;
    career[m].ties   += (row.ties || 0);
    career[m].pf     += row.pf;
    career[m].pa     += (row.pa || 0);
    career[m].seasons++;
    if (s.champion === m) career[m].championships++;
  }

  // Playoff appearances: managers who appear in playoff games
  const playoffManagers = new Set(
    s.games.filter(g => g.playoff).flatMap(g => [g.a, g.b])
  );
  for (const m of playoffManagers) {
    if (career[m]) career[m].playoffAppearances++;
  }
}

// Round pf/pa
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
const h2h = {}; // h2h[a][b] = { wins, losses, pf, pa }

for (const s of seasons) {
  for (const g of s.games) {
    if (g.playoff) continue;
    const { a, b, pa, pb } = g;
    if (!h2h[a]) h2h[a] = {};
    if (!h2h[b]) h2h[b] = {};
    if (!h2h[a][b]) h2h[a][b] = { wins: 0, losses: 0, pf: 0, pa: 0 };
    if (!h2h[b][a]) h2h[b][a] = { wins: 0, losses: 0, pf: 0, pa: 0 };
    h2h[a][b].pf += pa; h2h[a][b].pa += pb;
    h2h[b][a].pf += pb; h2h[b][a].pa += pa;
    if (pa > pb)      { h2h[a][b].wins++; h2h[b][a].losses++; }
    else if (pb > pa) { h2h[b][a].wins++; h2h[a][b].losses++; }
  }
}
for (const a of Object.values(h2h))
  for (const b of Object.values(a)) {
    b.pf = Math.round(b.pf * 100) / 100;
    b.pa = Math.round(b.pa * 100) / 100;
  }

// ── Season-by-season rankings (position each manager finished) ────────────────
const seasonRankings = seasons.map(s => ({
  season: s.season,
  champion: s.champion,
  standings: s.standings.map((row, i) => ({ rank: i + 1, manager: row.manager, wins: row.wins, losses: row.losses, pf: row.pf })),
}));

// ── All-time records ──────────────────────────────────────────────────────────
const allGames = seasons.flatMap(s => s.games.map(g => ({ ...g, season: s.season })));
const regGames = allGames.filter(g => !g.playoff && g.pa > 0 && g.pb > 0);

function pickRecord(games, compareFn) {
  return games.reduce((best, g) => compareFn(g, best) ? g : best, games[0]);
}

const records = {
  highestScore:  pickRecord(regGames, (g, b) => Math.max(g.pa, g.pb) > Math.max(b.pa, b.pb)),
  lowestScore:   pickRecord(regGames, (g, b) => Math.min(g.pa, g.pb) < Math.min(b.pa, b.pb)),
  biggestWin:    pickRecord(regGames, (g, b) => Math.abs(g.pa - g.pb) > Math.abs(b.pa - b.pb)),
  closestGame:   pickRecord(regGames, (g, b) => Math.abs(g.pa - g.pb) < Math.abs(b.pa - b.pb)),
  highestSeason: null,
  lowestSeason:  null,
};

// Highest/lowest single-season PF
const seasonPFs = seasons.flatMap(s => s.standings.map(r => ({ manager: r.manager, season: s.season, pf: r.pf })));
records.highestSeason = seasonPFs.reduce((b, x) => x.pf > b.pf ? x : b);
records.lowestSeason  = seasonPFs.reduce((b, x) => x.pf < b.pf ? x : b);

// Longest winning/losing streaks across all-time
const streaks = {};
for (const s of seasons) {
  for (const g of s.games.filter(g => !g.playoff)) {
    const update = (m, won) => {
      if (!streaks[m]) streaks[m] = { cur: 0, dir: null, maxWin: 0, maxLoss: 0 };
      const e = streaks[m];
      if (e.dir === (won ? 'W' : 'L')) { e.cur++; }
      else { e.cur = 1; e.dir = won ? 'W' : 'L'; }
      if (won)  e.maxWin  = Math.max(e.maxWin,  e.cur);
      else      e.maxLoss = Math.max(e.maxLoss, e.cur);
    };
    update(g.a, g.pa > g.pb);
    update(g.b, g.pb > g.pa);
  }
}
records.longestWinStreak  = Object.entries(streaks).map(([m, s]) => ({ manager: m, streak: s.maxWin  })).sort((a,b) => b.streak - a.streak)[0];
records.longestLossStreak = Object.entries(streaks).map(([m, s]) => ({ manager: m, streak: s.maxLoss })).sort((a,b) => b.streak - a.streak)[0];

// ── Bench left-on-field (per season) ─────────────────────────────────────────
// For each game with bench data, compute max bench scorer and "left on bench" pts
const benchWasted = {}; // manager → total bench pts left (sum across games with bench data)
let benchGamesCount = 0;
for (const g of allGames) {
  const process = (manager, bench, starters) => {
    if (!bench || bench.length === 0) return;
    const benchTotal = bench.reduce((s, p) => s + p.pts, 0);
    if (!benchWasted[manager]) benchWasted[manager] = { total: 0, games: 0 };
    benchWasted[manager].total += Math.round(benchTotal * 100) / 100;
    benchWasted[manager].games++;
  };
  process(g.a, g.ab, g.as);
  process(g.b, g.bb, g.bs);
  if (g.ab || g.bb) benchGamesCount++;
}

const benchAvg = Object.entries(benchWasted).map(([manager, d]) => ({
  manager,
  totalBenchPts: Math.round(d.total * 100) / 100,
  games: d.games,
  avgBenchPts: Math.round(d.total / d.games * 100) / 100,
})).sort((a, b) => b.avgBenchPts - a.avgBenchPts);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  careerRankings,
  allTimeH2H: h2h,
  seasonRankings,
  records,
  benchStats: { gamesWithData: benchGamesCount, perManager: benchAvg },
}, null, 2));

console.log(`Wrote ${OUT}`);
console.log(`  ${careerRankings.length} managers, ${seasons.length} seasons, ${allGames.length} total games`);
console.log(`  Bench data available for ${benchGamesCount} game-sides`);
