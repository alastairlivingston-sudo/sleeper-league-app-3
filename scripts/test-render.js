#!/usr/bin/env node
// General USER TEST — the "does it actually work" gate (UR-1..UR-4 in REQUIREMENTS.md).
// Transpiles commissioner.jsx with Babel, mounts <App/> in jsdom with the model
// bridge + fetch mocked, then drives the real user journey: default tab renders,
// every tab switches without error, a chat send returns a reply, and the app still
// renders when live fetch fails (offline snapshot fallback).
//
// Needs devDependencies: @babel/core @babel/preset-env @babel/preset-react
//                        react react-dom jsdom
// If they are absent it prints SKIP and exits 0, so zero-install CI is unaffected.
//
// Usage: node scripts/test-render.js [path-to-artifact]

const fs   = require("fs");
const path = require("path");

const ROOT     = path.join(__dirname, "..");
const ARTIFACT = process.argv[2] || path.join(ROOT, "commissioner.jsx");

function tryReq(name) {
  try { return require(path.join(ROOT, "node_modules", name)); }
  catch { try { return require(name); } catch { return null; } }
}

const babel   = tryReq("@babel/core");
const presetEnv   = tryReq("@babel/preset-env");
const presetReact = tryReq("@babel/preset-react");
const React   = tryReq("react");
const ReactDOM = tryReq("react-dom/client") || tryReq("react-dom");
const jsdomMod = tryReq("jsdom");

if (!babel || !presetEnv || !presetReact || !React || !ReactDOM || !jsdomMod) {
  console.log("test-render: SKIP — dev deps not installed (@babel/*, react, react-dom, jsdom).");
  console.log("             Install them to run the user-journey gate: npm install");
  process.exit(0);
}

const { JSDOM } = jsdomMod;
const { act } = React;

// ── Assertion helpers ───────────────────────────────────────────────────────
const failures = [];
function ok(id, cond, msg) {
  if (cond) console.log(`  ✓ ${id} ${msg}`);
  else { failures.push(`[${id}] ${msg}`); console.error(`  ✗ ${id} ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flush() { await act(async () => { await sleep(0); await sleep(0); }); }

// ── Load a fresh <App/> module in a fresh jsdom, with configurable mocks ──────
function loadApp({ fetchImpl, complete }) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "https://x.claudeusercontent.com/", pretendToBeVisual: true,
  });
  const { window } = dom;

  // jsdom doesn't implement layout APIs the component calls in effects — stub as
  // no-ops (these are cosmetic in a real browser, irrelevant to correctness here).
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
  if (!window.visualViewport) window.visualViewport = null;

  // Globals the transpiled bundle + React expect.
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.HTMLElement = window.HTMLElement;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  window.fetch = fetchImpl;
  global.fetch = fetchImpl;
  window.claude = complete ? { complete } : undefined;

  // Transpile JSX + ESM → CJS, then execute with a require shim.
  const src = fs.readFileSync(ARTIFACT, "utf8");
  const { code } = babel.transformSync(src, {
    presets: [
      [presetEnv, { modules: "commonjs", targets: { node: "current" } }],
      presetReact,
    ],
    filename: "commissioner.jsx", babelrc: false, configFile: false, sourceType: "module",
  });
  const shimRequire = (name) => {
    if (name === "react") return React;
    if (name === "react-dom") return tryReq("react-dom");
    if (name === "react-dom/client") return ReactDOM;
    return require(name);
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", "document", "global", code)
    (shimRequire, module, module.exports, window, window.document, global);
  const App = module.exports.default || module.exports;
  return { dom, window, App };
}

async function mountApp(opts) {
  const { window, App } = loadApp(opts);
  const root = ReactDOM.createRoot(window.document.getElementById("root"));
  await act(async () => { root.render(React.createElement(App)); });
  await flush();
  return { window, root };
}

// ── Mocks ───────────────────────────────────────────────────────────────────
// Serve the local docs/data + docs/lore JSON for any matching URL; Sleeper live
// endpoints get benign empty responses; unknown → reject (offline test uses this).
function localFetch(urlToFile) {
  return async (url) => {
    const u = String(url).split("?")[0];
    for (const [frag, file] of Object.entries(urlToFile)) {
      if (u.includes(frag)) {
        const p = path.join(ROOT, file);
        if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
      }
    }
    if (u.includes("api.sleeper.app")) return { ok: true, status: 200, json: async () => ([]) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
}
const DATA_MAP = {
  "history.json": "docs/data/history.json",
  "stats.json": "docs/data/stats.json",
  "rosters.json": "docs/data/rosters.json",
  "fc-values.json": "docs/data/fc-values.json",
  "alltime.json": "docs/data/alltime.json",
  "transactions.json": "docs/data/transactions.json",
  "player-scores.json": "docs/data/player-scores.json",
  "master.json": "docs/lore/master.json",
  "archive-index.json": "docs/lore/archive-index.json",
  "quotes-index.json": "docs/lore/quotes-index.json",
};
const rejectFetch = async () => { throw new Error("offline"); };

// A reply string that cannot already exist anywhere on the page, so matching it
// proves it came from the mocked model bridge (not pre-existing data/intro text).
const REPLY_SENTINEL = "ZZTOP_COMMISSIONER_REPLY_4242";

// ── Tests ─────────────────────────────────────────────────────────────────────
async function main() {
  let uncaught = null;
  const onErr = (e) => { uncaught = e; };
  process.on("uncaughtException", onErr);
  process.on("unhandledRejection", onErr);

  // UR-1 + UR-3: full online journey with a mocked model bridge.
  console.log("Journey 1 — online, model bridge mocked:");
  let completeCalls = 0;
  const complete = async (prompt) => {
    completeCalls++;
    // The stats planner call is uniquely identified by its opening instruction.
    // Return a no-op spec for it (runStatQuery becomes a clean pass-through); the
    // narration call then returns the sentinel we assert on screen.
    if (prompt.includes("translate a fantasy-football question into a JSON query spec")) return '{"type":"none"}';
    return REPLY_SENTINEL;
  };
  const { window } = await mountApp({ fetchImpl: localFetch(DATA_MAP), complete });
  const doc = window.document;
  const text = () => doc.body.textContent || "";

  ok("UR-1", /PlAIncy|Plancy|Borehamwood/i.test(text()), "app shell renders (header present)");
  ok("UR-1", !uncaught, "no uncaught error on initial render" + (uncaught ? `: ${uncaught.message}` : ""));

  // UR-2: switch through every tab via the real nav buttons.
  const navButtons = [...doc.querySelectorAll("button.nav-btn")];
  ok("UR-2", navButtons.length === 4, `4 nav buttons rendered (got ${navButtons.length})`);
  for (const label of ["BANTER", "TRADES", "SCORES", "STATS"]) {
    const btn = navButtons.find((b) => (b.textContent || "").toUpperCase().includes(label));
    if (!btn) { ok("UR-2", false, `nav button ${label} found`); continue; }
    await act(async () => { btn.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush();
    ok("UR-2", !uncaught, `switch to ${label} without error` + (uncaught ? `: ${uncaught.message}` : ""));
  }

  // UR-3: send a question in STATS by tapping a suggestion chip (a primary user
  // affordance that calls send(text) directly). The reply must come from OUR
  // mocked bridge, so use a sentinel string that cannot pre-exist on the page.
  const statsBtn = navButtons.find((b) => (b.textContent || "").toUpperCase().includes("STATS"));
  await act(async () => { statsBtn.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush();
  const ta = doc.querySelector("textarea");
  ok("UR-3", !!ta, "chat input (textarea) present in STATS");
  const chip = [...doc.querySelectorAll("button.chip")][0];
  ok("UR-3", !!chip, "suggestion chip present in STATS");
  const before = completeCalls;
  if (chip) {
    await act(async () => { chip.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
    ok("UR-3", completeCalls > before, `model bridge invoked on chip send (calls=${completeCalls})`);
    ok("UR-3", text().includes(REPLY_SENTINEL), "the mocked reply bubble rendered on screen");
  }

  // UR-4: offline — live fetch fails, app must still render from inlined snapshot.
  console.log("Journey 2 — offline (live fetch fails), snapshot fallback:");
  uncaught = null;
  const { window: w2 } = await mountApp({ fetchImpl: rejectFetch, complete });
  ok("UR-4", /PlAIncy|Plancy|Borehamwood/i.test(w2.document.body.textContent || ""), "renders from inlined snapshot when offline");
  ok("UR-4", !uncaught, "no uncaught error in offline mode" + (uncaught ? `: ${uncaught.message}` : ""));

  process.off("uncaughtException", onErr);
  process.off("unhandledRejection", onErr);

  if (failures.length) {
    console.error(`\ntest-render: ${failures.length} user-journey check(s) FAILED:`);
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log("\ntest-render: all user-journey checks passed ✓");
}

main().catch((e) => { console.error("test-render: harness error:", e); process.exit(1); });
