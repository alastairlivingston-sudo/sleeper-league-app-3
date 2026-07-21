#!/usr/bin/env node
// Golden-file test for build-alltime.js (the aggregation math).
// Runs the REAL build-alltime.js as a subprocess against a fixed, hand-built
// fixture league (via ALLTIME_* env path overrides) and asserts the output byte-
// matches a committed golden file. A refactor that silently changes any computed
// record (career W/L, H2H, luck, streaks, positional, player scoring) fails here.
//
// Regenerate the golden after an INTENTIONAL math change: UPDATE_GOLDEN=1 node scripts/test-alltime.js
//
// Zero-dep. Deterministic (no Date/random — fixed scores).

const fs   = require("fs");
const os   = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT       = path.join(__dirname, "..");
const FIXTURE_DIR = path.join(__dirname, "fixtures");
const GOLDEN_ALLTIME = path.join(FIXTURE_DIR, "alltime.golden.json");
const GOLDEN_PLAYERS = path.join(FIXTURE_DIR, "player-scores.golden.json");

// ── A small but complete fixture league ───────────────────────────────────────
// 4 managers, 2 seasons, double round-robin (each pair meets twice/season → 4
// all-time meetings, so nemesis/bunny min-3 threshold is exercised) + a playoff
// final. Includes positional (ap/bp), starter (as/bs) and bench (ab/bb) arrays so
// every table is populated. alpha_old is an alias of alpha (canonicalization).
function buildFixture() {
  const mgrs = ["alpha", "beta", "gamma", "delta"];
  // Deterministic score: base by manager strength + small week wobble.
  const strength = { alpha: 120, beta: 110, gamma: 100, delta: 95 };
  const wobble = (m, wk) => ((wk * 7 + m.length * 3) % 11) - 5; // ±5, deterministic
  const score = (m, wk) => Math.round((strength[m] + wobble(m, wk)) * 100) / 100;

  const pos = (m, wk) => ({ QB: score(m, wk) * 0.25, RB: score(m, wk) * 0.35, WR: score(m, wk) * 0.30, TE: score(m, wk) * 0.05, K: score(m, wk) * 0.02, DEF: score(m, wk) * 0.03 });
  const starters = (m, wk) => ([
    { n: m + "-QB1", pos: "QB", pts: Math.round(score(m, wk) * 0.25 * 100) / 100 },
    { n: m + "-RB1", pos: "RB", pts: Math.round(score(m, wk) * 0.20 * 100) / 100 },
    { n: m + "-WR1", pos: "WR", pts: Math.round(score(m, wk) * 0.18 * 100) / 100 },
  ]);
  const bench = (m, wk) => ([{ n: m + "-BN1", pos: "WR", pts: Math.round((5 + (wk % 4)) * 100) / 100 }]);

  const pairings = [ // one "matchup slot" per (a,b); double round robin over 6 weeks
    ["alpha", "beta"], ["gamma", "delta"],
    ["alpha", "gamma"], ["beta", "delta"],
    ["alpha", "delta"], ["beta", "gamma"],
  ];

  function makeSeason(season, champ) {
    const games = [];
    // 6 regular weeks: weeks 1-3 first round, 4-6 second round (same pairings).
    for (let wk = 1; wk <= 6; wk++) {
      const [a, b] = pairings[(wk - 1) % pairings.length];
      games.push({
        week: wk, playoff: false, a, b, pa: score(a, wk), pb: score(b, wk),
        ap: pos(a, wk), bp: pos(b, wk), as: starters(a, wk), bs: starters(b, wk), ab: bench(a, wk), bb: bench(b, wk),
      });
    }
    // Playoff final week 7: champ vs runner-up, champ wins.
    const runner = champ === "alpha" ? "beta" : "alpha";
    games.push({ week: 7, playoff: true, a: champ, b: runner, pa: 150, pb: 130,
      ap: pos(champ, 7), bp: pos(runner, 7), as: starters(champ, 7), bs: starters(runner, 7), ab: bench(champ, 7), bb: bench(runner, 7) });

    // Standings: compute W/L from the 6 regular games so validate-style invariants hold.
    const rec = {};
    mgrs.forEach((m) => (rec[m] = { wins: 0, losses: 0, pf: 0, pa: 0 }));
    for (const g of games) {
      if (g.playoff) continue;
      rec[g.a].pf += g.pa; rec[g.a].pa += g.pb;
      rec[g.b].pf += g.pb; rec[g.b].pa += g.pa;
      if (g.pa > g.pb) { rec[g.a].wins++; rec[g.b].losses++; } else { rec[g.b].wins++; rec[g.a].losses++; }
    }
    const standings = mgrs.map((m) => ({
      manager: m === "alpha" ? "alpha_old" : m, // exercise the alias on one row
      wins: rec[m].wins, losses: rec[m].losses, pf: Math.round(rec[m].pf * 100) / 100, pa: Math.round(rec[m].pa * 100) / 100,
    })).sort((x, y) => y.wins - x.wins || y.pf - x.pf);

    return { season, name: "Fixture " + season, champion: champ === "alpha" ? "alpha_old" : champ, standings, games };
  }

  return { seasons: [makeSeason("2001", "alpha"), makeSeason("2002", "beta")], meta: { generated: "FIXED" } };
}

const CONFIG_FIXTURE = { username: "alpha", aliases: { alpha_old: "alpha" }, names: {}, disambig: {} };

// ── Run the real build-alltime.js against the fixture ─────────────────────────
function strip(obj) { const c = JSON.parse(JSON.stringify(obj)); if (c.meta) delete c.meta; return c; }

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alltime-golden-"));
  const histPath = path.join(tmp, "history-details.json");
  const cfgPath  = path.join(tmp, "league-config.json");
  const outPath  = path.join(tmp, "alltime.json");
  const plPath   = path.join(tmp, "player-scores.json");
  fs.writeFileSync(histPath, JSON.stringify(buildFixture()));
  fs.writeFileSync(cfgPath, JSON.stringify(CONFIG_FIXTURE));

  execFileSync("node", [path.join(__dirname, "build-alltime.js")], {
    env: { ...process.env, ALLTIME_HISTORY: histPath, ALLTIME_CONFIG: cfgPath, ALLTIME_OUT: outPath, ALLTIME_OUT_PLAYERS: plPath },
    stdio: "pipe",
  });

  const gotAll = strip(JSON.parse(fs.readFileSync(outPath, "utf8")));
  const gotPl  = JSON.parse(fs.readFileSync(plPath, "utf8"));
  fs.rmSync(tmp, { recursive: true, force: true });

  if (process.env.UPDATE_GOLDEN) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(GOLDEN_ALLTIME, JSON.stringify(gotAll, null, 2));
    fs.writeFileSync(GOLDEN_PLAYERS, JSON.stringify(gotPl, null, 2));
    console.log("test-alltime: golden files regenerated.");
    return;
  }

  if (!fs.existsSync(GOLDEN_ALLTIME) || !fs.existsSync(GOLDEN_PLAYERS)) {
    console.error("test-alltime: golden files missing — run `UPDATE_GOLDEN=1 node scripts/test-alltime.js` once and commit them.");
    process.exit(1);
  }
  const wantAll = JSON.parse(fs.readFileSync(GOLDEN_ALLTIME, "utf8"));
  const wantPl  = JSON.parse(fs.readFileSync(GOLDEN_PLAYERS, "utf8"));

  const errs = [];
  const aJson = JSON.stringify(gotAll), bJson = JSON.stringify(wantAll);
  if (aJson !== bJson) errs.push("alltime.json output diverged from golden (aggregation math changed?)");
  if (JSON.stringify(gotPl) !== JSON.stringify(wantPl)) errs.push("player-scores.json output diverged from golden");

  // A couple of explicit spot-checks so a golden regen can't hide an obvious bug.
  const alpha = (wantAll.careerRankings || []).find((c) => c.manager === "alpha");
  if (!alpha) errs.push("golden careerRankings missing canonical 'alpha' (alias merge broken)");
  else {
    if (alpha.seasons !== 2) errs.push(`alpha should have 2 seasons, golden has ${alpha.seasons}`);
    if (alpha.championships !== 1) errs.push(`alpha should have 1 championship, golden has ${alpha.championships}`);
  }
  if ((wantAll.careerRankings || []).some((c) => c.manager === "alpha_old"))
    errs.push("careerRankings contains un-canonicalized 'alpha_old' (alias not applied)");

  if (errs.length) {
    console.error(`test-alltime: ${errs.length} check(s) FAILED:`);
    for (const e of errs) console.error("  " + e);
    console.error("If the math change was INTENTIONAL: UPDATE_GOLDEN=1 node scripts/test-alltime.js");
    process.exit(1);
  }
  console.log("test-alltime: aggregation output matches golden ✓");
}

main();
