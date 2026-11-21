# Out of scope (PlAIncy v3 plan)

Deliberately NOT changed by the v3 work (Phases 0–5). Revisit only with a new plan.

- **Trade grader logic.** The valuation and grading code is unchanged. It only shares the model bridge
  adapter: the Commissioner's verdict uses `claude.use("sample")` when available and hides when no model
  bridge exists.
- **The Live / Scores tab's direct Sleeper calls.** Unchanged; they may stay blocked in the claude.ai
  artifact sandbox (the tab already explains this and the rest of the app works without it).
- **Lore content.** `lore/*.md` and the lore build are untouched. The HTML build inlines the existing lore
  files; the Banter prompt uses a slice of `master.json`.
- **Publishing the artifact and the scheduled republish.** The claude.ai side (publishing
  `dist/plaincy.html` with `capabilities: {sample: {}}` and the Tue/Fri republish task) is the handover,
  not repository code — see claude.md "Publish route".
