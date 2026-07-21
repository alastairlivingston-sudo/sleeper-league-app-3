#!/usr/bin/env node
// Structural gate for the BUILT artifact (commissioner.jsx).
// Zero dependencies — runs in-process at the end of build-artifact.js and in CI,
// so a broken artifact is never written or committed. Enforces the FR-*/TR-*
// requirements in REQUIREMENTS.md. Exits non-zero on the first-class failures.
//
// Usage: node scripts/test-artifact.js [path-to-artifact]
//        (defaults to commissioner.jsx; also callable as a module: run(src) -> [errors])
//
// If @babel/core + @babel/preset-react are installed, TR-5 (real transpile) also
// runs here; otherwise it is left to scripts/test-render.js and noted as skipped.

const fs   = require("fs");
const path = require("path");

const ROOT     = path.join(__dirname, "..");
const ARTIFACT = process.argv[2] || path.join(ROOT, "commissioner.jsx");
const TEMPLATE = path.join(ROOT, "commissioner.template.jsx");

const DATA_CONSTS = [
  "HISTORY_DATA", "STATS_DATA", "ROSTERS_DATA", "TRADE_VALUES",
  "ALLTIME_DATA", "TRANSACTIONS_DATA", "PLAYER_SCORES",
];
const REQUIRED_FUNCS = [
  "App", "StatsTab", "BanterTab", "TradeGrader", "LiveTab", "ChatTab",
  "useLeagueData", "useLore", "retrieveLore", "claudeCall",
  "flattenGames", "runStatQuery", "parseSpec", "formatQueryResult",
];
const SIZE_WARN_KB = 150;
const SIZE_FAIL_KB = 200;

function run(src) {
  const errors  = [];
  const warns   = [];
  const fail = (id, msg) => errors.push(`[${id}] ${msg}`);
  const warn = (id, msg) => warns.push(`[${id}] ${msg}`);

  // ── TR-1: no leftover placeholders ─────────────────────────────────────────
  const leftover = src.match(/__[A-Z][A-Z0-9_]*__/);
  if (leftover) fail("TR-1", `unfilled placeholder ${leftover[0]}`);

  // ── FR-1: default-exported App ─────────────────────────────────────────────
  if (!/export default function App\s*\(/.test(src))
    fail("FR-1", "no `export default function App(`");

  // ── TR-4: React imported (not global) ──────────────────────────────────────
  if (!/import React[^\n]*from ["']react["']/.test(src))
    fail("TR-4", "missing `import React ... from \"react\"`");

  // ── FR-2 / FR-6 / FR-7: required functions/components present ──────────────
  for (const fn of REQUIRED_FUNCS) {
    const re = new RegExp(`function ${fn}\\b|${fn}\\s*=\\s*(?:function|\\()`);
    if (!re.test(src)) fail("FR-2", `missing function/component: ${fn}`);
  }

  // ── FR-3: TABS nav lists exactly the four known tabs ───────────────────────
  const tabIds = [...src.matchAll(/\{\s*id:\s*'([a-z]+)',\s*icon:/g)].map(m => m[1]);
  for (const need of ["stats", "banter", "trade", "live"])
    if (!tabIds.includes(need)) fail("FR-3", `TABS missing id '${need}'`);

  // ── FR-4 / FR-5 / TR-9: data + model wiring ────────────────────────────────
  if (!/setData\(\s*result\s*\)/.test(src) && !/setData\(result\)/.test(src))
    fail("FR-4", "useLeagueData does not appear to set fetched result");
  if (!/window\.claude\s*&&\s*typeof window\.claude\.complete/.test(src) &&
      !/window\.claude\.complete/.test(src))
    fail("FR-5", "no window.claude.complete bridge");

  // ── TR-2: every inlined data constant is valid JSON (or null) ──────────────
  // This is the #1 load-failure catcher: a truncated data blob fails JSON.parse.
  for (const name of DATA_CONSTS) {
    const m = src.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
    if (!m) { fail("TR-2", `data constant ${name} not found`); continue; }
    const literal = m[1].trim();
    try { JSON.parse(literal); }
    catch (e) { fail("TR-2", `${name} is not valid JSON (${String(e.message).slice(0, 60)})`); }
  }

  // ── TR-3: balanced delimiters (fallback only) ──────────────────────────────
  // Babel (TR-5 below) is the authoritative parse check. This hand-rolled scan is
  // a zero-dep smoke test for the case where Babel is not installed; it does not
  // parse regex literals, so it can false-positive — hence advisory (warn), and
  // skipped entirely when Babel is present to supersede it.
  if (!tryRequireBabel()) {
    const bal = balance(src);
    for (const [k, v] of Object.entries(bal))
      if (v !== 0) warn("TR-3", `possible unbalanced ${k}: net ${v > 0 ? "+" : ""}${v} (install @babel/core for an authoritative parse check)`);
  }

  // ── TR-6: BUILT_AT present and ISO-parseable ───────────────────────────────
  const built = src.match(/const BUILT_AT = ("[^"]*"|null);/);
  if (!built) fail("TR-6", "BUILT_AT not found");
  else if (built[1] !== "null") {
    const t = Date.parse(JSON.parse(built[1]));
    if (Number.isNaN(t)) fail("TR-6", `BUILT_AT not a valid ISO date: ${built[1]}`);
  }

  // ── TR-7: size budget ──────────────────────────────────────────────────────
  const kb = Buffer.byteLength(src, "utf8") / 1024;
  if (kb > SIZE_FAIL_KB) fail("TR-7", `artifact is ${kb.toFixed(0)} KB (> ${SIZE_FAIL_KB} KB — will truncate on paste)`);
  else if (kb > SIZE_WARN_KB) warn("TR-7", `artifact is ${kb.toFixed(0)} KB (> ${SIZE_WARN_KB} KB — approaching paste limit)`);

  // ── TR-8: no date-pinned model IDs ─────────────────────────────────────────
  const pinned = src.match(/claude-[a-z0-9.-]*-\d{8}/);
  if (pinned) fail("TR-8", `date-pinned model id ${pinned[0]} (use a bare alias)`);

  // ── TR-10: built-not-hand-edited (diff vs template is data/BUILT_AT lines only)
  if (fs.existsSync(TEMPLATE)) {
    const tpl = fs.readFileSync(TEMPLATE, "utf8").split("\n");
    const out = src.split("\n");
    if (tpl.length !== out.length) {
      fail("TR-10", `line count differs from template (${out.length} vs ${tpl.length}) — hand-edited?`);
    } else {
      for (let i = 0; i < tpl.length; i++) {
        if (tpl[i] === out[i]) continue;
        // The only lines allowed to differ are the placeholder-bearing template lines.
        if (!/__[A-Z][A-Z0-9_]*__/.test(tpl[i]))
          fail("TR-10", `line ${i + 1} differs from template but has no placeholder — hand-edited?`);
      }
    }
  }

  // ── TR-5 (opportunistic): real transpile if Babel is available ─────────────
  const babel = tryRequireBabel();
  if (babel) {
    try {
      babel.transformSync(src, { presets: [babelPresetReact()], filename: "commissioner.jsx", babelrc: false, configFile: false });
    } catch (e) {
      fail("TR-5", `Babel failed to transpile: ${String(e.message).split("\n")[0]}`);
    }
  } else {
    warn("TR-5", "Babel not installed — real transpile deferred to test-render.js");
  }

  return { errors, warns };
}

// String/template/comment-aware delimiter balance.
function balance(src) {
  const net = { "{}": 0, "[]": 0, "()": 0 };
  let i = 0;
  const n = src.length;
  let state = "code"; // code | sq | dq | tpl | line | block | regex
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block"; i += 2; continue; }
      if (c === "'") { state = "sq"; i++; continue; }
      if (c === '"') { state = "dq"; i++; continue; }
      if (c === "`") { state = "tpl"; i++; continue; }
      if (c === "{") net["{}"]++; else if (c === "}") net["{}"]--;
      else if (c === "[") net["[]"]++; else if (c === "]") net["[]"]--;
      else if (c === "(") net["()"]++; else if (c === ")") net["()"]--;
      i++; continue;
    }
    if (state === "line") { if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") { if (c === "*" && c2 === "/") { state = "code"; i += 2; continue; } i++; continue; }
    if (state === "sq") { if (c === "\\") { i += 2; continue; } if (c === "'") state = "code"; i++; continue; }
    if (state === "dq") { if (c === "\\") { i += 2; continue; } if (c === '"') state = "code"; i++; continue; }
    if (state === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { state = "code"; i++; continue; }
      // Note: we intentionally do not recurse into ${...}; template exprs in this
      // codebase are balanced within the literal, so counting them as text is safe.
      i++; continue;
    }
  }
  return net;
}

function tryRequireBabel() {
  try { return require(path.join(ROOT, "node_modules", "@babel", "core")); }
  catch { try { return require("@babel/core"); } catch { return null; } }
}
function babelPresetReact() {
  try { return require(path.join(ROOT, "node_modules", "@babel", "preset-react")); }
  catch { return require("@babel/preset-react"); }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.error(`test-artifact: not found: ${ARTIFACT}`); process.exit(1); }
  const src = fs.readFileSync(ARTIFACT, "utf8");
  const { errors, warns } = run(src);
  for (const w of warns) console.warn("  warn " + w);
  if (errors.length) {
    console.error(`test-artifact: ${errors.length} requirement(s) FAILED:`);
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }
  console.log(`test-artifact: all structural requirements passed${warns.length ? ` (${warns.length} warning(s))` : ""}`);
}

module.exports = { run, balance };
