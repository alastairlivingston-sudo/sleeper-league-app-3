#!/usr/bin/env node
// Phase 4 build target: dist/plaincy.html — ONE self-contained page for a
// published claude.ai artifact (stable link, republished with fresh data).
//   - The app (commissioner.template.jsx) bundled by esbuild into one IIFE with
//     React + ReactDOM included: no CDN needed.
//   - All data inlined as <script type="application/json" id="plaincy-data">:
//     history, stats, rosters, trade values, alltime, transactions, player scores
//     and lore. The template's __PLACEHOLDER__ constants read from it.
//   - The fact table is NOT inlined: the page builds it from history with the
//     same template/15-facts.jsx code the pipeline runs (one implementation).
// esbuild is a devDependency; without it this prints SKIP and exits 0 so the
// zero-dep data pipeline is unaffected. Budget: warn at 2 MB, fail at 16 MB.

const fs   = require("fs");
const os   = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "commissioner.template.jsx");
const OUT  = path.join(ROOT, "dist", "plaincy.html");
const WARN_BYTES = 2 * 1024 * 1024;
const FAIL_BYTES = 16 * 1024 * 1024;

function tryReq(name) {
  try { return require(path.join(ROOT, "node_modules", name)); }
  catch { try { return require(name); } catch { return null; } }
}

const readJson = (rel, optional) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { if (optional) return null; throw new Error(`missing ${rel}`); }
  return JSON.parse(fs.readFileSync(p, "utf8"));
};

// placeholder → key in the inlined data object
const KEYS = {
  __HISTORY__: "history", __STATS__: "stats", __ROSTERS__: "rosters", __TRADES__: "trades",
  __ALLTIME__: "alltime", __TRANSACTIONS__: "transactions", __PLAYERS__: "players", __LORE__: "lore",
};

function collectData() {
  return {
    history: readJson("docs/data/history.json"),
    stats: readJson("docs/data/stats.json"),
    rosters: readJson("docs/data/rosters.json"),
    trades: readJson("docs/data/fc-values.json"),
    alltime: readJson("docs/data/alltime.json"),
    transactions: readJson("docs/data/transactions.json", true),
    players: readJson("docs/data/player-scores.json", true),
    lore: {
      master: readJson("docs/lore/master.json", true),
      archive: readJson("docs/lore/archive-index.json", true),
      quotes: readJson("docs/lore/quotes-index.json", true),
    },
  };
}

// JSON safe inside <script>: no "</script", no "<!--".
const safeJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function htmlPage(js, dataJson, builtAt) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>PlAIncy</title>
<style>
:root{--bg:#090d18;--panel:#0f1625;--text:#e8f1ff;--dim:#6e8db0;--accent:#6366f1;color-scheme:dark;}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);overflow-x:hidden;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;}
#root{min-height:100dvh;}
.boot{padding:24px 16px;color:var(--dim);font-size:14px;}
</style>
</head>
<body>
<div id="root"><div class="boot">Loading PlAIncy…</div></div>
<script type="application/json" id="plaincy-data">${dataJson}</script>
<script>/* PlAIncy — built ${builtAt} by scripts/build-html.js */
${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
}

async function build() {
  const esbuild = tryReq("esbuild");
  if (!esbuild) {
    console.log("build-html: SKIP — esbuild not installed (npm install). dist/plaincy.html not rebuilt.");
    return { skipped: true };
  }
  const builtAt = new Date().toISOString();
  let src = fs.readFileSync(SRC, "utf8");
  for (const [ph, key] of Object.entries(KEYS)) {
    if (!src.includes(ph)) throw new Error(`placeholder ${ph} not in template`);
    src = src.replace(ph, `__plaincyData(${JSON.stringify(key)})`);
  }
  src = src.replace("__BUILT_AT__", JSON.stringify(builtAt));
  // Hoisted reader for the inlined data object (parsed once).
  src += `
function __plaincyData(k) {
  if (!__plaincyData.cache) {
    try { __plaincyData.cache = JSON.parse(document.getElementById('plaincy-data').textContent); }
    catch (e) { __plaincyData.cache = {}; }
  }
  const v = __plaincyData.cache[k];
  return v === undefined ? null : v;
}
`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plaincy-html-"));
  fs.writeFileSync(path.join(tmp, "app.jsx"), src);
  fs.writeFileSync(path.join(tmp, "entry.jsx"), `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.jsx";
createRoot(document.getElementById("root")).render(React.createElement(App));
`);
  const result = await esbuild.build({
    entryPoints: [path.join(tmp, "entry.jsx")],
    bundle: true, format: "iife", minify: true, write: false, target: ["es2019"],
    jsx: "transform", loader: { ".jsx": "jsx" },
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(ROOT, "node_modules")],
    logLevel: "silent",
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const js = result.outputFiles[0].text;
  const html = htmlPage(js, safeJson(collectData()), builtAt);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  const bytes = Buffer.byteLength(html);
  const kb = Math.round(bytes / 1024);
  if (bytes > FAIL_BYTES) throw new Error(`dist/plaincy.html is ${kb} KB (> 16 MB artifact limit)`);
  if (bytes > WARN_BYTES) console.warn(`build-html: warn — dist/plaincy.html is ${kb} KB (> 2 MB)`);
  console.log(`build-html: wrote ${OUT} — ${kb} KB (app ${Math.round(js.length / 1024)} KB)`);
  return { bytes };
}

if (require.main === module) {
  build().catch((e) => { console.error("build-html:", e.message || e); process.exit(1); });
}

module.exports = { build };
