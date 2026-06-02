#!/usr/bin/env node
// Fetches current FantasyCalc half-PPR 1QB 8-team redraft values and writes fc-values.json

const fs   = require("fs");
const path = require("path");

const URL = "https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=8&ppr=0.5";
const OUT  = path.join(__dirname, "../public/data/fc-values.json");

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`Wrote ${OUT} — ${data.length} players`);
}

main().catch(e => { console.error(e); process.exit(1); });
