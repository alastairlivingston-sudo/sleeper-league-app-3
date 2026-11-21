#!/usr/bin/env node
// Stat corrections (Phase 5): Sleeper revises scores days after a week is
// played. A FINAL week's scores changing between runs is ALLOWED — never a
// validation failure — but it is surfaced: the refresh commit message names the
// corrected weeks ("2026 wk 11 stat corrections").
//
// Usage: node scripts/stat-corrections.js [old.json] [new.json]
//   default old = `git show HEAD:docs/data/history.json`, new = the working file.
// Prints one summary line (empty when nothing changed). Zero deps.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

// Map "season|week|a|b" → [pa, pb] for FINAL games (missing status = final).
function finalScores(history) {
  const m = new Map();
  for (const s of (history && history.seasons) || []) {
    for (const g of s.games || []) {
      if ((g.status || "final") !== "final") continue;
      const [x, y] = [g.a, g.b].sort();
      const [px, py] = x === g.a ? [g.pa, g.pb] : [g.pb, g.pa];
      m.set(`${s.season}|${g.week}|${x}|${y}`, [px, py]);
    }
  }
  return m;
}

// → [{ season, week, games }] for weeks final in BOTH files whose scores changed.
function diffFinalScores(oldHist, newHist) {
  const a = finalScores(oldHist), b = finalScores(newHist);
  const weeks = new Map();
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || (Math.abs(w[0] - v[0]) < 0.005 && Math.abs(w[1] - v[1]) < 0.005)) continue;
    const [season, week] = k.split("|");
    const key = season + "|" + week;
    if (!weeks.has(key)) weeks.set(key, { season, week: Number(week), games: 0 });
    weeks.get(key).games++;
  }
  return [...weeks.values()].sort((x, y) => x.season.localeCompare(y.season) || x.week - y.week);
}

function summary(diffs) {
  if (!diffs.length) return "";
  const bySeason = {};
  for (const d of diffs) (bySeason[d.season] = bySeason[d.season] || []).push(d.week);
  return Object.entries(bySeason).map(([s, ws]) => `${s} wk ${ws.join(", ")}`).join("; ") + " stat corrections";
}

if (require.main === module) {
  const [oldPath, newPath] = process.argv.slice(2);
  let oldHist;
  try {
    oldHist = oldPath ? JSON.parse(fs.readFileSync(oldPath, "utf8"))
      : JSON.parse(execFileSync("git", ["show", "HEAD:docs/data/history.json"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch { process.exit(0); } // no previous version → nothing to compare
  const newHist = JSON.parse(fs.readFileSync(newPath || path.join(ROOT, "docs/data/history.json"), "utf8"));
  const line = summary(diffFinalScores(oldHist, newHist));
  if (line) console.log(line);
}

module.exports = { diffFinalScores, summary };
