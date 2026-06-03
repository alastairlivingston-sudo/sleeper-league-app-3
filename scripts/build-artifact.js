#!/usr/bin/env node
// Reads commissioner.template.jsx, inlines the four JSON data files,
// and writes commissioner.jsx — the self-contained shareable artifact.
// Run after every data refresh:  node scripts/build-artifact.js

const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "commissioner.template.jsx");
const OUT  = path.join(ROOT, "commissioner.jsx");

const DATA = {
  __HISTORY__: path.join(ROOT, "docs/data/history.json"),
  __STATS__:   path.join(ROOT, "docs/data/stats.json"),
  __ROSTERS__: path.join(ROOT, "docs/data/rosters.json"),
  __TRADES__:  path.join(ROOT, "docs/data/fc-values.json"),
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

  // Inline JSON data files
  for (const [placeholder, filePath] of Object.entries(DATA)) {
    if (!fs.existsSync(filePath)) {
      console.error(`Data file not found: ${filePath}`);
      process.exit(1);
    }
    const raw  = JSON.parse(fs.readFileSync(filePath, "utf8"));
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
