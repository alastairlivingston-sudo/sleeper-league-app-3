#!/usr/bin/env node
// Fetches FantasyCalc half-PPR 1QB 8-team redraft values.
// Saves a trimmed version (name/sleeperId/position/redraftValue only)
// so the live JSON fetch from the artifact is <20KB, not 138KB.

const fs   = require("fs");
const path = require("path");

const URL = "https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=8&ppr=0.5";
const OUT  = path.join(__dirname, "../docs/data/fc-values.json");

async function main() {
  const res  = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw  = await res.json();
  const trimmed = raw.map(x => ({
    player:       { name: x.player.name, sleeperId: x.player.sleeperId, position: x.player.position },
    redraftValue: x.redraftValue,
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(trimmed));
  console.log(`Wrote ${OUT} — ${trimmed.length} players (trimmed)`);
}

main().catch(e => { console.error(e); process.exit(1); });

