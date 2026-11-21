#!/usr/bin/env node
// DR-3 / DR-4 gate: game status tagging, bracket phase/bye rules, and the
// in-progress-season validator, run against frozen fixtures (no network).
// Zero deps. Exits non-zero on the first failing assertion group.

const path = require("path");
const fs = require("fs");
const L = require("./lib");
const { checkHistory } = require("./validate-history");

const FIX = path.join(__dirname, "fixtures");
const raw = JSON.parse(fs.readFileSync(path.join(FIX, "sleeper-midseason.json"), "utf8"));
const histFixture = () => JSON.parse(fs.readFileSync(path.join(FIX, "history-midseason.json"), "utf8"));

let failures = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`  FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// Run checkHistory and return the invariant IDs that failed.
function runChecks(history) {
  const errs = [];
  const check = (c, id) => { if (!c) errs.push(id); return c; };
  const warn = () => true;
  const canon = (h) => String(h || "").replace(/^@/, "").trim();
  checkHistory(history, { check, warn, canon });
  return [...new Set(errs)];
}

// ── DR-3: weekStatus ──────────────────────────────────────────────────────────
{
  const { state, leagueInSeason, leagueComplete, leaguePreDraft } = raw;
  eq([1, 10, 11, 12, 18].map((w) => L.weekStatus(leagueInSeason, w, state)),
    ["final", "final", "live", "scheduled", "scheduled"], "DR-3 in-season status by week");
  eq([1, 17, 18].map((w) => L.weekStatus(leagueComplete, w, state)),
    ["final", "final", "final"], "DR-3 complete league → all final");
  eq(L.weekStatus(leaguePreDraft, 1, state), "scheduled", "DR-3 pre-draft league → scheduled");
  // No last_scored_leg → fall back to state.week - 1.
  const noLeg = { status: "in_season", settings: { playoff_week_start: 15 } };
  eq([10, 11, 12].map((w) => L.weekStatus(noLeg, w, state)), ["final", "live", "scheduled"],
    "DR-3 fallback to state.week when last_scored_leg missing");
}

// ── DR-3: phase + byes from the brackets ─────────────────────────────────────
{
  const wb = raw.wb2024; // 2024: rosters 4,6 had round-1 byes; wk17 3rd-place slot re-filled with 2 v 8
  eq([...L.playoffField(wb)].sort(), [1, 3, 4, 5, 6, 7], "DR-3 playoff field (2024)");
  eq(L.gamePhase(14, 15, 1, 7, wb), "regular", "DR-3 regular week");
  eq(L.gamePhase(15, 15, 1, 7, wb), "playoff", "DR-3 round-1 playoff game");
  eq(L.gamePhase(17, 15, 4, 6, wb), "playoff", "DR-3 championship game");
  eq(L.gamePhase(16, 15, 7, 5, wb), "consolation", "DR-3 5th-place game is consolation");
  eq(L.gamePhase(17, 15, 2, 8, wb), "consolation", "DR-3 re-filled 3rd-place slot (non-playoff teams) is consolation");
  eq(L.gamePhase(15, 15, 2, 8, wb), "consolation", "DR-3 toilet-bowl game is consolation");
  eq([4, 6, 1, 2].map((r) => L.isBye(15, 15, r, wb)), [true, true, false, false], "DR-4 round-1 byes only for top seeds");
  eq(L.isBye(16, 15, 2, wb), false, "DR-4 a team sitting out round 2 is not a bye");
  eq(L.isBye(18, 15, 4, wb), false, "DR-4 week beyond the bracket is not a bye");
  eq(!!L.bracketFinal(wb).w, true, "complete season has a bracket final with a winner");
  eq(!!(L.bracketFinal(raw.wb2026) || {}).w, false, "in-progress season has no bracket winner");
}

// ── DR-3/DR-4: validator on a real mid-season league ─────────────────────────
{
  eq(runChecks(histFixture()), [], "DR-3 mid-season fixture passes every invariant");

  const h1 = histFixture();
  const s26 = h1.seasons.find((s) => s.season === "2026");
  s26.games.push({ week: 12, status: "scheduled", phase: "regular", playoff: false, a: s26.schedule[0].a, b: s26.schedule[0].b, pa: 0, pb: 0 });
  eq(runChecks(h1).includes("history.game.status"), true, "DR-3 a scheduled game in games[] is rejected");

  const h2 = histFixture();
  const s26b = h2.seasons.find((s) => s.season === "2026");
  s26b.games = s26b.games.filter((g) => g.week !== 10);
  eq(runChecks(h2).includes("history.games.complete"), true, "DR-3 a dropped final week fails W/L reconciliation");

  const h3 = histFixture();
  const s26c = h3.seasons.find((s) => s.season === "2026");
  const live = s26c.games.find((g) => g.status === "live");
  live.week = 9;
  eq(runChecks(h3).includes("history.live.next"), true, "DR-3 a live game outside the current week is rejected");

  const h4 = histFixture();
  h4.seasons.find((s) => s.season === "2025").standings[0].high += 10;
  eq(runChecks(h4).includes("history.standings.high"), true, "DR-4 standings high != games max is rejected");

  const h5 = histFixture();
  const s25 = h5.seasons.find((s) => s.season === "2025");
  s25.champion = null;
  eq(runChecks(h5).includes("history.champion"), true, "complete season without champion is rejected");

  const h6 = histFixture();
  h6.seasons.find((s) => s.season === "2025").complete = false;
  eq(runChecks(h6).includes("history.complete.past"), true, "an older season may not be in progress");
}

// ── DR-6: stat corrections are allowed and reported, never a failure ─────────
{
  const { diffFinalScores, summary } = require("./stat-corrections");
  const before = histFixture();
  const after = histFixture();
  const g = after.seasons.find((x) => x.season === "2026").games.find((x) => x.week === 9);
  g.pa = Math.round((g.pa + 1.3) * 100) / 100;               // a final week's score revised
  const liveG = after.seasons.find((x) => x.season === "2026").games.find((x) => x.status === "live");
  liveG.pb += 5;                                               // live scores moving is not a correction
  const d = diffFinalScores(before, after);
  eq(d.map((x) => x.season + ":" + x.week + ":" + x.games), ["2026:9:1"], "DR-6 only the corrected FINAL week is reported");
  eq(summary(d), "2026 wk 9 stat corrections", "DR-6 commit-message summary");
  eq(summary(diffFinalScores(before, histFixture())), "", "DR-6 no change → empty summary");
  eq(runChecks(after).filter((id) => id !== "history.standings.high"), [], "DR-6 a corrected final score does not fail validation");
}

if (failures) {
  console.error(`test-status.js: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("test-status.js: DR-3/DR-4 status, phase, bye and in-progress-season checks passed");
