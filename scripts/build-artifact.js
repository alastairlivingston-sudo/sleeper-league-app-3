#!/usr/bin/env node
// Reads commissioner.template.jsx, inlines the four JSON data files,
// and writes commissioner.jsx — the self-contained shareable artifact.
// Run after every data refresh:  node scripts/build-artifact.js

const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "commissioner.template.jsx");
const OUT  = path.join(ROOT, "commissioner.jsx");

// Strip the heavy per-game individual-starter arrays (as/bs) from the
// history that gets INLINED into commissioner.jsx. The app fetches the
// full history.json (with player names) at runtime; this trimmed copy is
// only the offline fallback, keeping the static JSX small.
function trimHistory(raw) {
  if (!raw || !Array.isArray(raw.seasons)) return raw;
  return {
    ...raw,
    seasons: raw.seasons.map(s => ({
      ...s,
      games: (s.games || []).map(({ as, bs, ...rest }) => rest),
    })),
  };
}

const DATA = {
  __HISTORY__: { file: path.join(ROOT, "docs/data/history.json"), transform: trimHistory },
  __STATS__:   { file: path.join(ROOT, "docs/data/stats.json") },
  __ROSTERS__: { file: path.join(ROOT, "docs/data/rosters.json") },
  __TRADES__:  { file: path.join(ROOT, "docs/data/fc-values.json") },
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
  for (const [placeholder, { file, transform }] of Object.entries(DATA)) {
    if (!fs.existsSync(file)) {
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
