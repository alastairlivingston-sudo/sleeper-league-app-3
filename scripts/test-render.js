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
const jsdomMod = tryReq("jsdom");
// React DOM feature-detects the browser ONCE at module load (e.g. whether the
// `input` event exists). Loaded with no window it falls back to legacy polyfill
// events and typed text never reaches onChange — so give it a window first.
if (jsdomMod && typeof global.window === "undefined") {
  const boot = new jsdomMod.JSDOM("<!doctype html><html><body></body></html>", { url: "https://x.claudeusercontent.com/" });
  global.window = boot.window; global.document = boot.window.document; global.navigator = boot.window.navigator;
}
const React   = tryReq("react");
const ReactDOM = tryReq("react-dom/client") || tryReq("react-dom");

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
// No digits: the number guard (Phase 2) would rightly reject an unknown number.
const REPLY_SENTINEL = "ZZTOP COMMISSIONER REPLY SENTINEL";

// ── Tests ─────────────────────────────────────────────────────────────────────
async function main() {
  let uncaught = null;
  const onErr = (e) => { uncaught = e; };
  process.on("uncaughtException", onErr);
  process.on("unhandledRejection", onErr);

  // UR-1 + UR-3: full online journey with a mocked model bridge.
  console.log("Journey 1 — online, model bridge mocked:");
  let completeCalls = 0, plannerCalls = 0;
  const isPlanner = (p) => p.includes("translate a fantasy-football question into a JSON query spec");
  let banterPromptChars = 0;
  const complete = async (prompt) => {
    completeCalls++;
    if (prompt.includes("wind-up merchant")) banterPromptChars = Math.max(banterPromptChars, prompt.length);
    if (isPlanner(prompt)) { plannerCalls++; return '{"type":"none"}'; }
    if (process.env.MEASURE_PROMPT) console.error(`NARRATION_PROMPT_CHARS=${prompt.length}`);
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
  // A multi-row recipe answer ("Current standings") is narrated by the model.
  const chip = [...doc.querySelectorAll("button.chip")].find((c) => /current standings/i.test(c.textContent || ""));
  ok("UR-3", !!chip, "suggestion chip present in STATS");
  const before = completeCalls;
  if (chip) {
    await act(async () => { chip.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
    ok("UR-3", completeCalls > before, `model bridge invoked on chip send (calls=${completeCalls})`);
    ok("UR-3", text().includes(REPLY_SENTINEL), "the mocked reply bubble rendered on screen");
  }

  // UR-5: the fast-path skips the planner MODEL CALL on common questions. The
  // "All-time standings" chip calls send(text) directly and its text matches the
  // totals intent client-side, so NO planner call should fire — only narration.
  const p0 = plannerCalls, c0 = completeCalls;
  const fastChip = [...doc.querySelectorAll("button.chip")].find((c) => /longest streaks/i.test(c.textContent || ""));
  ok("UR-5", !!fastChip, "fast-path chip ('Longest streaks') present");
  if (fastChip) {
    await act(async () => { fastChip.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
    ok("UR-5", plannerCalls === p0, `fast-path skipped the planner model call (planner unchanged at ${plannerCalls})`);
    ok("UR-5", completeCalls === c0, "single-row record answered by a JS sentence — no model call at all");
    ok("UR-5", /straight wins/.test(text()), "templated streak sentence rendered");
  }

  // FR-14: freshness badge shows the last FINAL week (and the live week).
  const hist = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/history.json"), "utf8"));
  const cur = hist.seasons[hist.seasons.length - 1];
  const badge = (doc.querySelector("[data-testid=freshness]") || {}).textContent || "";
  const wantBadge = cur.complete ? `${cur.season} · season complete` : `${cur.season} · through Week ${cur.lastFinalWeek}` + (cur.liveWeek ? ` · Week ${cur.liveWeek} live` : "");
  ok("FR-14", badge === wantBadge, `badge reads "${badge}" (want "${wantBadge}")`);
  ok("FR-14", !/Live ·|Snapshot ·/.test(badge), "no misleading live/snapshot state in the badge");

  // FR-12: This Week card renders the last completed week.
  const card = doc.querySelector("[data-testid=this-week]");
  ok("FR-12", !!card && (card.textContent || "").includes(`Week ${cur.lastFinalWeek}`), "This Week card shows the last final week");
  ok("FR-12", !!card && card.querySelectorAll(".tw-game").length === 4 && card.querySelectorAll("tbody tr").length === 8, "card lists 4 results and an 8-row mini standings table");

  // FR-13: Record Book renders every named record.
  const rbBtn = [...doc.querySelectorAll("button.tw-rb")].find((b) => /record book/i.test(b.textContent || ""));
  ok("FR-13", !!rbBtn, "Record Book button present");
  if (rbBtn) {
    await act(async () => { rbBtn.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush();
    const items = [...doc.querySelectorAll("[data-testid=record-book] .rb-item")];
    ok("FR-13", items.length === 17, `Record Book lists all 17 named records (got ${items.length})`);
    ok("FR-13", items.filter((i) => i.querySelector(".rb-row") && !/^—$/.test(i.querySelector(".rb-row").textContent)).length >= 16, "named records have rows");
    const mpl = items.find((i) => i.getAttribute("data-record") === "highestScoreInLoss");
    ok("FR-13", !!mpl && /Alastair 151\.40 – 168\.56 Josh/.test(mpl.textContent), "a record row shows both sides of the game");
    const close = [...doc.querySelectorAll("[data-testid=record-book] button")].find((b) => /close/i.test(b.textContent || ""));
    if (close) { await act(async () => { close.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); }
  }

  // Banter prompt diet: < 20 KB (Phase 3).
  const banterBtn = navButtons.find((b) => (b.textContent || "").toUpperCase().includes("BANTER"));
  await act(async () => { banterBtn.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await sleep(20); await flush();
  const bChip = [...doc.querySelectorAll("button.chip")].find((c) => /roast lev/i.test(c.textContent || ""));
  if (bChip) {
    await act(async () => { bChip.dispatchEvent(new window.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
  }
  ok("FR-15", banterPromptChars > 0 && banterPromptChars < 20480, `banter prompt is ${banterPromptChars} chars (< 20 KB)`);

  // UR-4: offline — live fetch fails, app must still render from inlined snapshot.
  console.log("Journey 2 — offline (live fetch fails), snapshot fallback:");
  uncaught = null;
  const { window: w2 } = await mountApp({ fetchImpl: rejectFetch, complete });
  ok("UR-4", /PlAIncy|Plancy|Borehamwood/i.test(w2.document.body.textContent || ""), "renders from inlined snapshot when offline");
  ok("UR-4", !uncaught, "no uncaught error in offline mode" + (uncaught ? `: ${uncaught.message}` : ""));

  // UR-6: model fallback chain — with the window.claude bridge ABSENT, claudeCall
  // uses the legacy Messages-API fetch, which must advance past a 404 model to the
  // next in the chain. Mock: first model id → 404, second → 200 with the sentinel.
  console.log("Journey 3 — legacy runtime, model chain advances past 404:");
  uncaught = null;
  let seenModels = [];
  const modelFetch = async (url, opts) => {
    const u = String(url).split("?")[0];
    if (u.includes("api.anthropic.com")) {
      const body = JSON.parse(opts.body);
      seenModels.push(body.model);
      if (seenModels.length === 1) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: '{"type":"none"}' }] }) };
    }
    return localFetch(DATA_MAP)(url);
  };
  const { window: w3 } = await mountApp({ fetchImpl: modelFetch, complete: null }); // no bridge → legacy path
  const doc3 = w3.document;
  const chip3 = [...doc3.querySelectorAll("button.chip")].find((c) => /playoff record|all-?time|standings/i.test(c.textContent || ""));
  if (chip3) {
    await act(async () => { chip3.dispatchEvent(new w3.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
  }
  ok("UR-6", seenModels.length >= 2, `advanced to a second model after 404 (models tried: ${seenModels.join(", ") || "none"})`);
  ok("UR-6", seenModels[0] !== seenModels[1], "the second attempt used a DIFFERENT model id (chain advanced)");
  ok("UR-6", !uncaught, "no uncaught error on the legacy model-fallback path" + (uncaught ? `: ${uncaught.message}` : ""));

  // UR-7: the screenshot conversation, typed into the real Stats ChatTab. Live
  // data is the frozen 2023–25 fixture so the answer can't drift as 2026 lands.
  console.log("Journey 4 — screenshot replay (UR-7):");
  uncaught = null;
  let ur7Calls = 0;
  const ur7Complete = async (p) => { ur7Calls++; return isPlanner(p) ? '{"table":"none"}' : "Sorry, I fabricated that earlier."; };
  const fixtureMap = { ...DATA_MAP, "history.json": "scripts/fixtures/history-2023-2025.json" };
  // FR-12 with fixture data: the card follows whatever history is loaded.
  const { window: w4 } = await mountApp({ fetchImpl: localFetch(fixtureMap), complete: ur7Complete });
  const d4 = w4.document;
  const bubbles = () => [...d4.querySelectorAll("table.rt")].map((t) => t.closest("div[style]"));
  async function sendText(text) {
    const area = d4.querySelector("textarea");
    const setter = Object.getOwnPropertyDescriptor(w4.HTMLTextAreaElement.prototype, "value").set;
    await act(async () => { setter.call(area, text); area.dispatchEvent(new w4.Event("input", { bubbles: true })); });
    const send = [...d4.querySelectorAll("button.send-btn")][0];
    await act(async () => { send.dispatchEvent(new w4.Event("click", { bubbles: true })); });
    await flush(); await flush(); await sleep(30); await flush(); await flush();
  }
  const lastTable = () => { const ts = [...d4.querySelectorAll("table.rt")]; return ts[ts.length - 1]; };
  const rowsOf = (t) => t ? [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)) : [];
  const assistantText = () => { const b = [...d4.querySelectorAll("table.rt")]; return b.length ? b[b.length - 1].parentElement.parentElement.textContent : ""; };

  const card4 = d4.querySelector("[data-testid=this-week]");
  ok("FR-12", !!card4 && /2025 Week 17/.test(card4.textContent || ""), "This Week card renders from fixture data (2025 Week 17)");
  ok("FR-14", ((d4.querySelector("[data-testid=freshness]") || {}).textContent || "") === "2025 · season complete", "badge on a completed fixture season");
  await sendText("What is the most points anyone has scored in a loss?");
  const r1 = rowsOf(lastTable())[0] || [];
  ok("UR-7", r1.join("|") === "Alastair|151.40|Josh|168.56|L|-17.16|2023|13|regular", `msg 1 table top row is Alastair 151.40 L v Josh 168.56, 2023 wk 13 (got ${r1.join("|")})`);
  await sendText("What was the total game score?");
  ok("UR-7", /319\.96/.test(assistantText()), "msg 2 answer contains 319.96");
  const r2 = rowsOf(lastTable());
  ok("UR-7", r2.length === 2 && r2.some((r) => r[0] === "Josh") && r2.some((r) => r[0] === "Alastair"), `msg 2 shows both rows of that game (${r2.map((r) => r.slice(0, 4).join(" ")).join(" / ")})`);
  await sendText("How could Josh score 168.56 and lose?");
  const t3 = assistantText();
  ok("UR-7", /Josh won 168\.56–151\.40/.test(t3), "msg 3 explains Josh won 168.56–151.40");
  ok("UR-7", !/fabricat/i.test(d4.body.textContent || ""), "no 'fabricat' text anywhere in the conversation");
  ok("UR-7", ur7Calls === 0, `the whole conversation needed zero model calls (made ${ur7Calls})`);
  ok("UR-7", !uncaught, "no uncaught error during the replay" + (uncaught ? `: ${uncaught.message}` : ""));

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
