#!/usr/bin/env node
// Reads commissioner.template.jsx, inlines the four JSON data files,
// and writes commissioner.jsx — the self-contained shareable artifact.
// Run after every data refresh:  node scripts/build-artifact.js

const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "commissioner.template.jsx");
const OUT  = path.join(ROOT, "commissioner.jsx");

// The inlined data is only an OFFLINE FALLBACK — at runtime the app fetches every
// file live from the CDN and replaces the fallback wholesale (useLeagueData sets
// live:true on first success). alltime.json (~100KB) and player-scores.json (~140KB)
// feed ONLY the chat/query layer (StatsTab prompt + runStatQuery), which itself only
// runs on Claude.ai — i.e. always online, where the live data has already replaced
// the fallback. So we inline `null` for them: the offline fallback keeps working
// standings/trades (history/stats/rosters stay full) and loses nothing that could
// actually function offline, while the artifact shrinks by ~240KB so it round-trips
// reliably when pasted into a Claude artifact.
const dropLargeFallback = () => null;

const DATA = {
  // history.json is already lean (produced without the per-game player arrays);
  // it is the offline fallback verbatim.
  __HISTORY__:      { file: path.join(ROOT, "docs/data/history.json") },
  __STATS__:        { file: path.join(ROOT, "docs/data/stats.json") },
  __ROSTERS__:      { file: path.join(ROOT, "docs/data/rosters.json") },
  __TRADES__:       { file: path.join(ROOT, "docs/data/fc-values.json") },
  __ALLTIME__:      { file: path.join(ROOT, "docs/data/alltime.json"), transform: dropLargeFallback },
  __TRANSACTIONS__: { file: path.join(ROOT, "docs/data/transactions.json"), optional: true },
  __PLAYERS__:      { file: path.join(ROOT, "docs/data/player-scores.json"), optional: true, transform: dropLargeFallback },
};

const SCALARS = {
  __BUILT_AT__: () => JSON.stringify(new Date().toISOString()),
};

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Template not found: ${SRC}`);
    process.exit(1);
  }

  let src = fs.readFileSync(SRC, "utf8");

  // Inline JSON data files (trimmed fallback — full data fetched at runtime)
  for (const [placeholder, { file, transform, optional }] of Object.entries(DATA)) {
    if (!fs.existsSync(file)) {
      if (optional) {
        src = src.replace(placeholder, "null");
        console.warn(`Optional data file not found (using null): ${file}`);
        continue;
      }
      console.error(`Data file not found: ${file}`);
      process.exit(1);
    }
    let raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (transform) raw = transform(raw);
    const json = JSON.stringify(raw);
    if (!src.includes(placeholder)) {
      console.error(`Placeholder "${placeholder}" not found in template`);
      process.exit(1);
    }
    src = src.replace(placeholder, () => json);
  }

  // Inline scalar values
  for (const [placeholder, fn] of Object.entries(SCALARS)) {
    src = src.replace(placeholder, fn);
  }

  fs.writeFileSync(OUT, src);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`Built ${OUT} — ${kb} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
