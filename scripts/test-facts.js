#!/usr/bin/env node
// DR-5: the fact table's named records, recomputed INDEPENDENTLY with plain loops
// over the raw history fixture (no shared code with template/15-facts.jsx), must
// match buildFactTable() on the frozen 2023–25 fixture. Also asserts the seed
// answers from PLAN.md. Zero deps.

const fs = require("fs");
const path = require("path");
const { build } = require("./build-facts");
const { nameHelpers } = require("./load-partials");

const FIX = path.join(__dirname, "fixtures", "history-2023-2025.json");
const history = JSON.parse(fs.readFileSync(FIX, "utf8"));
const { canonical } = nameHelpers();
const facts = build(history);

let failures = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(actual)}`); }
}
const r2 = (n) => Math.round(n * 100) / 100;

// ── Independent recompute: plain loops over history.seasons[].games ──────────
// Flatten to manager-perspective sides by hand.
const sides = [];
for (const s of history.seasons) {
  for (const g of s.games) {
    if ((g.status || "final") !== "final") continue;
    const reg = g.phase ? g.phase === "regular" : !g.playoff;
    const A = canonical(g.a), B = canonical(g.b);
    sides.push({ season: s.season, week: g.week, reg, m: A, o: B, pf: r2(g.pa), pa: r2(g.pb) });
    sides.push({ season: s.season, week: g.week, reg, m: B, o: A, pf: r2(g.pb), pa: r2(g.pa) });
  }
}
const regSides = [];
for (const x of sides) if (x.reg) regSides.push(x);

function key(x) { return [x.m, x.pf, x.o, x.pa, x.season, x.week].join("|"); }
function factKey(r) { return [r.manager, r.pf, r.opponent, r.pa, r.season, r.week].join("|"); }

function maxBy(list, f) { let best = null, out = []; for (const x of list) { const v = f(x); if (best === null || v > best) { best = v; out = [x]; } else if (v === best) out.push(x); } return out; }
function minBy(list, f) { return maxBy(list, (x) => -f(x)); }

const expectGames = {
  highestScore: maxBy(regSides, (x) => x.pf),
  lowestScore: minBy(regSides, (x) => x.pf),
  highestScoreInLoss: maxBy(regSides.filter((x) => x.pf < x.pa), (x) => x.pf),
  lowestScoreInWin: minBy(regSides.filter((x) => x.pf > x.pa), (x) => x.pf),
  biggestMargin: maxBy(regSides.filter((x) => x.pf > x.pa), (x) => r2(x.pf - x.pa)),
  closestGame: minBy(regSides.filter((x) => x.pf > x.pa || (x.pf === x.pa && x.m < x.o)), (x) => Math.abs(r2(x.pf - x.pa))),
  highestCombined: maxBy(regSides.filter((x) => x.pf > x.pa || (x.pf === x.pa && x.m < x.o)), (x) => r2(x.pf + x.pa)),
  lowestCombined: minBy(regSides.filter((x) => x.pf > x.pa || (x.pf === x.pa && x.m < x.o)), (x) => r2(x.pf + x.pa)),
};
for (const [name, want] of Object.entries(expectGames)) {
  eq(facts.records[name].regular.map(factKey).sort(), want.map(key).sort(), `DR-5 ${name} (regular)`);
}

// Streaks: walk each manager's regular games in date order.
const byMgr = {};
for (const x of regSides) (byMgr[x.m] = byMgr[x.m] || []).push(x);
let bestW = 0, bestL = 0; const wHold = [], lHold = [];
for (const [m, list] of Object.entries(byMgr)) {
  list.sort((p, q) => (p.season === q.season ? p.week - q.week : p.season < q.season ? -1 : 1));
  let run = 0, type = null, mW = 0, mL = 0;
  for (const x of list) {
    const t = x.pf > x.pa ? "W" : x.pf < x.pa ? "L" : "T";
    if (t === type) run++; else { run = 1; type = t; }
    if (t === "W") mW = Math.max(mW, run);
    if (t === "L") mL = Math.max(mL, run);
  }
  if (mW > bestW) { bestW = mW; wHold.length = 0; }
  if (mW === bestW) wHold.push(m);
  if (mL > bestL) { bestL = mL; lHold.length = 0; }
  if (mL === bestL) lHold.push(m);
}
eq([...new Set(facts.records.longestWinStreak.regular.map((r) => r.manager + ":" + r.length))].sort(), wHold.map((m) => m + ":" + bestW).sort(), "DR-5 longestWinStreak");
eq([...new Set(facts.records.longestLossStreak.regular.map((r) => r.manager + ":" + r.length))].sort(), lHold.map((m) => m + ":" + bestL).sort(), "DR-5 longestLossStreak");

// Top / bottom score weeks.
const weeks = {};
for (const x of regSides) (weeks[x.season + "|" + x.week] = weeks[x.season + "|" + x.week] || []).push(x);
const top = {}, bottom = {};
for (const list of Object.values(weeks)) {
  let hi = -1, lo = Infinity;
  for (const x of list) { if (x.pf > hi) hi = x.pf; if (x.pf < lo) lo = x.pf; }
  for (const x of list) { if (x.pf === hi) top[x.m] = (top[x.m] || 0) + 1; if (x.pf === lo) bottom[x.m] = (bottom[x.m] || 0) + 1; }
}
const best = (c) => { const v = Math.max(...Object.values(c)); return Object.keys(c).filter((m) => c[m] === v).sort().map((m) => m + ":" + v); };
eq(facts.records.mostTopScoreWeeks.regular.map((r) => r.manager + ":" + r.count).sort(), best(top), "DR-5 mostTopScoreWeeks");
eq(facts.records.mostBottomScoreWeeks.regular.map((r) => r.manager + ":" + r.count).sort(), best(bottom), "DR-5 mostBottomScoreWeeks");

// Season PF (complete seasons, regular season).
const seasonPF = {};
for (const x of regSides) seasonPF[x.season + "|" + x.m] = r2((seasonPF[x.season + "|" + x.m] || 0) + x.pf);
const spf = Object.entries(seasonPF);
const hiPF = Math.max(...spf.map(([, v]) => v)), loPF = Math.min(...spf.map(([, v]) => v));
eq(facts.records.bestSeasonPF.regular.map((r) => r.season + "|" + r.manager).sort(), spf.filter(([, v]) => v === hiPF).map(([k]) => k).sort(), "DR-5 bestSeasonPF");
eq(facts.records.worstSeasonPF.regular.map((r) => r.season + "|" + r.manager).sort(), spf.filter(([, v]) => v === loPF).map(([k]) => k).sort(), "DR-5 worstSeasonPF");

// Unluckiest loss: lost while ranking highest that week (ties → highest score).
const rankOf = (x) => 1 + weeks[x.season + "|" + x.week].filter((o) => o.pf > x.pf).length;
const losses = regSides.filter((x) => x.pf < x.pa);
const bestLossRank = Math.min(...losses.map(rankOf));
eq(facts.records.unluckiestLoss.regular.map(factKey).sort(), maxBy(losses.filter((x) => rankOf(x) === bestLossRank), (x) => x.pf).map(key).sort(), "DR-5 unluckiestLoss");
const wins = regSides.filter((x) => x.pf > x.pa);
const worstWinRank = Math.max(...wins.map(rankOf));
eq(facts.records.luckiestWin.regular.map(factKey).sort(), minBy(wins.filter((x) => rankOf(x) === worstWinRank), (x) => x.pf).map(key).sort(), "DR-5 luckiestWin");

// ── Seed answers (PLAN.md Phase 1, regular season, 2023–25) ─────────────────
const top1 = (name) => { const r = facts.records[name].regular[0]; return [r.manager, r.pf, r.opponent, r.pa, r.season, r.week]; };
eq(top1("highestScoreInLoss"), ["AlastairL", 151.4, "joshjr11", 168.56, "2023", 13], "seed: highest score in a loss");
eq(top1("lowestScoreInWin"), ["saulgoat", 86.94, "benjlev", 79.32, "2025", 7], "seed: lowest score in a win");
eq(top1("highestScore"), ["GSac", 202.36, "AlastairL", 133.56, "2025", 12], "seed: highest score");
eq(top1("lowestScore"), ["joshjr11", 54.84, "dpol", 159.32, "2023", 5], "seed: lowest score");
eq(top1("closestGame"), ["dpol", 131.86, "AlastairL", 131.84, "2025", 3], "seed: closest game");
eq(top1("biggestMargin"), ["saulgoat", 189.76, "drjkay", 76, "2023", 5], "seed: biggest margin");
eq(facts.records.biggestMargin.regular[0].margin, 113.76, "seed: biggest margin = 113.76");
eq(Math.abs(facts.records.closestGame.regular[0].margin), 0.02, "seed: closest margin = 0.02");
const danJosh = facts.games.filter((r) => r.manager === "dpol" && r.opponent === "joshjr11" && r.phase === "regular" && r.status === "final");
eq([danJosh.filter((r) => r.result === "W").length, danJosh.filter((r) => r.result === "L").length], [6, 0], "seed: Dan v Josh 6–0");
const lev24 = facts.seasons.find((r) => r.season === "2024" && r.manager === "benjlev");
eq([lev24.wins, lev24.losses], [0, 14], "seed: Lev 2024 0–14");

// Structural: two rows per non-bye game, mirrored.
const pairs = {};
for (const r of facts.games) (pairs[r.gameId] = pairs[r.gameId] || []).push(r);
const badPairs = Object.values(pairs).filter((p) => !p[0].bye && (p.length !== 2 || p[0].pf !== p[1].pa));
eq(badPairs.length, 0, "every game has two mirrored rows");
eq(facts.games.filter((r) => !r.bye).length, sides.length, "fact rows == hand-flattened sides");

if (failures) { console.error(`test-facts.js: ${failures} check(s) FAILED`); process.exit(1); }
console.log("test-facts.js: DR-5 independent recompute + seed answers match the fact table ✓");
