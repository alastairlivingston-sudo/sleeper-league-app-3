#!/usr/bin/env node
// Builds the fact table → docs/data/games.json (Phase 1).
//   games:   two rows per game (one per manager) + one row per playoff bye
//   seasons: one row per manager per season
//   records: named records, each { regular, all } (ties return every tied row),
//            plus records.current for the latest season
// The builder itself lives in template/15-facts.jsx so the artifact runs the same
// code (see scripts/load-partials.js). Additive: history.json is untouched.
// Zero deps.

const fs   = require("fs");
const path = require("path");
const { loadPartials, ROOT } = require("./load-partials");

const IN  = process.env.FACTS_HISTORY || (fs.existsSync(path.join(ROOT, "docs/data/history-details.json"))
  ? path.join(ROOT, "docs/data/history-details.json") : path.join(ROOT, "docs/data/history.json"));
const OUT = process.env.FACTS_OUT || path.join(ROOT, "docs/data/games.json");

function build(history) {
  const ctx = loadPartials(["15-facts.jsx"]);
  return ctx.buildFactTable(history, ctx.canonical);
}

if (require.main === module) {
  const history = JSON.parse(fs.readFileSync(IN, "utf8"));
  const facts = build(history);
  // One row per line: compact, diff-friendly, and keeps meta.generated on its own
  // line (refresh.yml's change detector ignores only the "generated" line).
  const lines = (arr) => "[\n" + arr.map((r) => JSON.stringify(r)).join(",\n") + "\n]";
  const out = "{\n\"games\": " + lines(facts.games)
    + ",\n\"seasons\": " + lines(facts.seasons)
    + ",\n\"records\": " + JSON.stringify(facts.records)
    + ",\n\"meta\": " + JSON.stringify({ generated: new Date().toISOString(), source: path.basename(IN) }) + "\n}\n";
  fs.writeFileSync(OUT, out);
  console.log(`Wrote ${OUT} — ${facts.games.length} manager-game rows, ${facts.seasons.length} manager-seasons, ${Object.keys(facts.records).length} record groups`);
}

module.exports = { build };
