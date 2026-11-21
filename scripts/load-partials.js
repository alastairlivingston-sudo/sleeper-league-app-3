// Loads plain-JS template partials (template/15-facts.jsx, template/20-query-engine.jsx)
// into a Node vm context, so the pipeline and the zero-dep tests run the EXACT code
// the artifact ships — one implementation, never a re-implementation.
// Zero deps.

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "league-config.json"), "utf8"));

// The name/alias helpers the partials expect (canonical/displayName/distinctName),
// built from league-config.json — the same source build-artifact inlines.
function nameHelpers(cfg = CONFIG) {
  const ALIAS = cfg.aliases || {};
  const NAMES = cfg.names || {};
  const DISAMBIG = cfg.disambig || {};
  const canonical = (h) => { const c = String(h || "").replace(/^@/, "").trim(); return ALIAS[c] || c; };
  return {
    ALIAS, NAMES, DISAMBIG, canonical,
    displayName: (h) => { const c = canonical(h); return NAMES[c] || c; },
    distinctName: (h) => { const c = canonical(h); return DISAMBIG[c] || NAMES[c] || c; },
  };
}

// files: partial basenames in load order. extra: globals to inject (e.g. a mocked claudeCall).
function loadPartials(files, extra = {}) {
  const ctx = vm.createContext({ console, Math, JSON, Date, Object, Array, String, Number, RegExp, Set, Map, Promise, Error, ...nameHelpers(), ...extra });
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, "template", f), "utf8");
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}

module.exports = { loadPartials, nameHelpers, CONFIG, ROOT };
