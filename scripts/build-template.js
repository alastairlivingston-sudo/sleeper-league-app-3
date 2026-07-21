#!/usr/bin/env node
// Assembles commissioner.template.jsx from the ordered partials in template/.
// The partials are the SOURCE OF TRUTH; the monolith is a generated, committed
// build input for build-artifact.js (kept committed so tooling and reviewers can
// still read one file). Concatenation is byte-exact — the partials are raw slices
// of the original, joined with nothing.
//
//   node scripts/build-template.js          → write commissioner.template.jsx
//   node scripts/build-template.js --check   → assert monolith === concat(partials); exit 1 on drift
//
// Edit the PARTIALS (template/*.jsx), not the monolith. The --check gate (CI)
// fails if someone hand-edits commissioner.template.jsx directly.

const fs   = require("fs");
const path = require("path");

const ROOT     = path.join(__dirname, "..");
const DIR      = path.join(ROOT, "template");
const MONOLITH = path.join(ROOT, "commissioner.template.jsx");

function partials() {
  if (!fs.existsSync(DIR)) { console.error(`No template/ dir at ${DIR}`); process.exit(1); }
  return fs.readdirSync(DIR).filter((f) => /^\d.*\.jsx$/.test(f)).sort()
    .map((f) => path.join(DIR, f));
}

function assemble() {
  return partials().map((p) => fs.readFileSync(p, "utf8")).join("");
}

function main() {
  const check = process.argv.includes("--check");
  const built = assemble();
  if (check) {
    const cur = fs.existsSync(MONOLITH) ? fs.readFileSync(MONOLITH, "utf8") : "";
    if (built !== cur) {
      console.error("build-template: DRIFT — commissioner.template.jsx does not match template/ partials.");
      console.error("  Edit the partials, then run `node scripts/build-template.js` to regenerate the monolith.");
      process.exit(1);
    }
    console.log("build-template: monolith is in sync with partials ✓");
    return;
  }
  fs.writeFileSync(MONOLITH, built);
  console.log(`build-template: wrote commissioner.template.jsx from ${partials().length} partials (${(built.length / 1024).toFixed(0)} KB)`);
}

main();
