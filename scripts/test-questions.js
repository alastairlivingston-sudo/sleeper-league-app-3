#!/usr/bin/env node
// QR-1..QR-3 (+ the UR-7 conversation at engine level): drives the REAL query
// engine (template/15-facts.jsx + template/20-query-v2.jsx, loaded with vm) over
// the frozen 2023–25 fixture with every model call mocked and counted.
// Zero deps.

const fs = require("fs");
const path = require("path");
const { loadPartials } = require("./load-partials");

const ctx = loadPartials(["15-facts.jsx", "18-tables.jsx", "20-query-v2.jsx"]);
const history = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "history-2023-2025.json"), "utf8"));
const facts = ctx.buildFactTable(history, ctx.canonical);
const vmGet = (name) => require("vm").runInContext(name, ctx); // top-level consts are not context properties
const CANT = vmGet("CANT_ANSWER");
const PLAYERS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "players-2025.json"), "utf8"));
const TRADES = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "trades-2023-2025.json"), "utf8"));

let failures = 0, passes = 0;
function ok(id, cond, msg) {
  if (cond) passes++;
  else { failures++; console.error(`  ✗ ${id} ${msg}`); }
}

// A model stub that fails the test if it is ever called.
const noModel = { calls: 0, fn: async () => { noModel.calls++; return '{"table":"none"}'; } };
async function ask(q, conv, extra) {
  return ctx.answerStatQuestion(q, conv || null, Object.assign({ facts, players: PLAYERS, transactions: TRADES, plan: noModel.fn, narrate: noModel.fn }, extra || {}));
}
const top = (res) => (res.table && res.table.rows && res.table.rows[0]) || {};

// ── QR-1: seed questions × 3 phrasings, answered by recipes with ZERO model calls ─
const SEEDS = [
  { name: "highest score in a loss", qs: ["What is the most points anyone has scored in a loss?", "Highest score in a losing effort", "Who scored the most points and still lost?"],
    check: (r) => r.manager === "AlastairL" && r.pf === 151.4 && r.opponent === "joshjr11" && r.pa === 168.56 && r.season === "2023" && r.week === 13 && r.result === "L" },
  { name: "lowest score in a win", qs: ["What's the lowest score to win a game?", "Fewest points in a win", "Who won with the lowest score?"],
    check: (r) => r.manager === "saulgoat" && r.pf === 86.94 && r.opponent === "benjlev" && r.pa === 79.32 && r.season === "2025" && r.week === 7 },
  { name: "highest score", qs: ["What's the highest score ever?", "Most points in a single game", "Who has the highest weekly score?"],
    check: (r) => r.manager === "GSac" && r.pf === 202.36 && r.opponent === "AlastairL" && r.pa === 133.56 && r.season === "2025" && r.week === 12 },
  { name: "lowest score", qs: ["What's the lowest score ever?", "Fewest points scored in a game", "Worst weekly score of all time"],
    check: (r) => r.manager === "joshjr11" && r.pf === 54.84 && r.opponent === "dpol" && r.pa === 159.32 && r.season === "2023" && r.week === 5 },
  { name: "closest game", qs: ["Closest game ever?", "Smallest margin of victory", "What was the narrowest win?"],
    check: (r) => r.manager === "dpol" && r.pf === 131.86 && r.opponent === "AlastairL" && r.pa === 131.84 && r.season === "2025" && r.week === 3 },
  { name: "biggest margin", qs: ["Biggest blowout?", "Largest margin of victory", "What's the biggest win ever?"],
    check: (r) => r.manager === "saulgoat" && r.pf === 189.76 && r.opponent === "drjkay" && r.pa === 76 && r.margin === 113.76 && r.season === "2023" && r.week === 5 },
  { name: "Dan v Josh", qs: ["Dan vs Josh", "What's Dan's record against Josh?", "Head to head Dan Josh"],
    check: (r) => r.manager === "dpol" && r.opponent === "joshjr11" && r.wins === 6 && r.losses === 0 },
  { name: "Lev 2024", qs: ["Lev's record in 2024", "How did Lev do in 2024?", "What was Lev's 2024 record?"],
    check: (r) => r.manager === "benjlev" && r.season === "2024" && r.wins === 0 && r.losses === 14 },
];

(async function main() {
  for (const seed of SEEDS) {
    for (const q of seed.qs) {
      noModel.calls = 0;
      const res = await ask(q);
      ok("QR-1", res.source === "recipe", `"${q}" answered by a recipe (got ${res.source})`);
      ok("QR-1", noModel.calls === 0, `"${q}" made zero model calls (made ${noModel.calls})`);
      ok("QR-1", seed.check(top(res)), `"${q}" → ${seed.name}: top row ${JSON.stringify(top(res)).slice(0, 160)}`);
    }
  }

  // Extra recipe coverage (PLAN Phase 2.3): each answered without the model.
  const EXTRA = ["This week's scores", "Current standings", "Saul's record", "Saul's record in 2023", "Alastair vs Gideon",
    "Who won 2024?", "Current streaks", "Top scorer this week", "Jamie's best week", "Josh's worst week",
    "Fewest points in a loss", "Most points in a win", "Highest combined score", "Longest win streak", "Longest streaks",
    "This week's upset?", "All-time standings", "Unluckiest loss", "Most top-score weeks", "Best season"];
  // Multi-row answers may still call the narrator; the PLANNER must never run.
  for (const q of EXTRA) {
    let planCalls = 0;
    const res = await ask(q, null, { plan: async () => { planCalls++; return '{"table":"none"}'; }, narrate: async () => "Here you go." });
    ok("QR-1", res.source === "recipe" && planCalls === 0 && res.table && res.table.rows.length > 0,
      `extra recipe "${q}" (source ${res.source}, planner calls ${planCalls}, rows ${res.table ? res.table.rows.length : 0})`);
  }
  const champ = await ask("Who won 2024?");
  ok("QR-1", top(champ).manager === "saulgoat", "who won 2024 → Saul");
  const streak = await ask("Longest losing streak");
  ok("QR-1", top(streak).manager === "benjlev" && top(streak).type === "L", "longest losing streak → Lev");

  // ── QR-2: model planner for an uncaught question ──────────────────────────────
  let planCalls = 0;
  const goodPlan = async () => { planCalls++; return JSON.stringify({ v: 2, table: "games", where: { managers: ["GSac"], seasons: ["2025"] }, groupBy: ["manager"], select: ["games", "wins", "losses", "pf_sum"] }); };
  const res2 = await ask("How did Gideon get on in twenty twenty five overall?", null, { plan: goodPlan, narrate: async () => "Gideon went 5–9." });
  ok("QR-2", planCalls === 1, "uncaught question calls the planner once");
  ok("QR-2", top(res2).manager === "GSac" && top(res2).wins === 5 && top(res2).losses === 9 && top(res2).games === 14, `valid v2 spec → correct rows ${JSON.stringify(top(res2))}`);
  for (const junk of ["not json at all", JSON.stringify({ v: 2, table: "games", where: { managers: ["nobody"] } }), JSON.stringify({ v: 2, table: "secrets" }), JSON.stringify({ type: "totals" }), JSON.stringify({ v: 2, table: "games", orderBy: [{ col: "password" }] })]) {
    const r = await ask("What is the average number of points in heartbreak games?", null, { plan: async () => junk });
    ok("QR-2", r.source === "cant" && r.content === CANT && !r.table, `junk plan ${junk.slice(0, 50)} → can't-answer`);
  }
  const none = await ask("How many points did someone score in 1999?", null, { plan: async () => '{"table":"none"}' });
  ok("QR-2", none.source === "cant", "numeric-sounding question + none spec → can't-answer, never free text");

  // ── QR-3: number guard ─────────────────────────────────────────────────────────
  const multiPlan = async () => JSON.stringify({ v: 2, table: "games", where: { managers: ["dpol"] }, groupBy: ["season"], select: ["games", "wins", "losses", "pf_sum"] });
  const lying = await ask("Dan by season please, a summary", null, { plan: multiPlan, narrate: async () => "Dan scored 9999.99 points in 2024 and went 13–1." });
  ok("QR-3", !/9999/.test(lying.content), "narration with a number not in the rows is replaced");
  ok("QR-3", lying.content === ctx.templateSentence(lying.table.spec, lying.table), "…by the JS template sentence");
  const honest = await ask("Dan by season please, a summary", null, { plan: multiPlan, narrate: async () => "Dan has been steady every season since 2023." });
  ok("QR-3", honest.content === "Dan has been steady every season since 2023.", "narration whose numbers are all in the rows is kept");
  ok("QR-3", ctx.numberGuard("Alastair scored 151.4 in week 13", [{ pf: 151.4, week: 13, season: "2023" }]).ok, "1 dp form of a 2 dp value is allowed");
  ok("QR-3", !ctx.numberGuard("Alastair scored 152 in week 13", [{ pf: 151.4, week: 13 }]).ok, "a rounded-up integer not in the rows is rejected");
  ok("QR-3", ctx.numberGuard("joshjr11 won 1,968.96 total", [{ pf: 1968.96 }]).ok, "thousands separators and handles with digits are handled");
  const fab = await ask("Dan by season please, a summary", null, { plan: multiPlan, narrate: async () => "Sorry, I fabricated that earlier." });
  ok("QR-3", !/fabricat/i.test(fab.content), "a narration that claims fabrication is discarded");

  // ── UR-7 (engine level): the screenshot conversation ──────────────────────────
  const m1 = await ask("What is the most points anyone has scored in a loss?");
  const r1 = top(m1);
  ok("UR-7", r1.manager === "AlastairL" && r1.pf === 151.4 && r1.result === "L" && r1.opponent === "joshjr11" && r1.pa === 168.56 && r1.season === "2023" && r1.week === 13, "msg 1 top row: Alastair 151.40 L v Josh 168.56, 2023 wk 13");
  ok("UR-7", /Alastair scored 151\.40 and still lost/.test(m1.content), `msg 1 sentence: ${m1.content}`);
  const m2 = await ask("What was the total game score?", m1.ctx);
  ok("UR-7", /319\.96/.test(m2.content), `msg 2 contains 319.96: ${m2.content}`);
  ok("UR-7", m2.table && m2.table.rows.length === 2 && m2.table.rows.some((r) => r.manager === "joshjr11") && m2.table.rows.some((r) => r.manager === "AlastairL"), "msg 2 shows both rows of the game");
  const m3 = await ask("How could Josh score 168.56 and lose?", m2.ctx);
  ok("UR-7", /Josh won 168\.56–151\.40/.test(m3.content), `msg 3 explains Josh won: ${m3.content}`);
  ok("UR-7", !/fabricat/i.test(m3.content), "msg 3 contains no 'fabricat'");

  // Narration prompt budget (< 4 KB with a full 25-row result).
  const bigSpec = ctx.validateSpec({ v: 2, table: "games", where: { phase: "all" }, orderBy: [{ col: "pf", dir: "desc" }], limit: 25 }, facts).spec;
  const bigRes = ctx.runQuery(bigSpec, facts, []);
  const np = ctx.narrationPrompt("Top 25 scores ever, including playoffs?", m1.ctx, bigRes);
  ok("QR-3", np.length < 4096, `narration prompt with 25 rows is ${np.length} chars (< 4096)`);

  // Phase 3: recap + banter sentence guard.
  const recap = ctx.leagueRecap(facts, history);
  ok("FR-15", /Most points in a loss: Alastair 151\.40 v Josh 168\.56/.test(recap), "recap carries the named records from the fact table");
  ok("FR-15", /CHAMPIONS: 2023 Saul, 2024 Saul, 2025 Alastair/.test(recap), "recap carries champions");
  const roast = ctx.guardSentences("Lev is a legend of losing. He once scored 999.99 in a week. A hearty hearty mazel tov!", recap);
  ok("FR-15", roast.dropped === 1 && !/999/.test(roast.text) && /mazel tov/.test(roast.text), `banter guard drops only the sentence with an unknown number (${roast.text})`);
  const tw = ctx.thisWeekFacts(facts);
  ok("FR-12", tw && tw.season === "2025" && tw.week === 17 && tw.standings.length === 8, "thisWeekFacts on the fixture: 2025 week 17, 8 standings rows");
  ok("FR-14", ctx.badgeText(facts) === "2025 · season complete", "badgeText on a completed season");

  // Follow-up season swap.
  const f1 = await ask("Saul's record in 2023");
  const f2 = await ask("and in 2024?", f1.ctx);
  ok("QR-1", top(f2).manager === "saulgoat" && top(f2).season === "2024", "follow-up 'and in 2024?' swaps the season");

  // ── QR-4: the "combined score" conversation (rankings, top N, pushback) ──────
  // A fresh ranking question must not be read as a follow-up about the previous
  // answer's game; "top N" widens any record; a counter-claim is checked.
  const allCombined = facts.games.filter((r) => r.status === "final" && !r.bye && r.phase === "regular" && r.result === "W").map((r) => r.combined).sort((a, b) => b - a);
  const c1 = await ask("what's the best score a team has made in a game and still lost?");
  const c2 = await ask("what's the biggest combined score in a given match between two teams", c1.ctx);
  ok("QR-4", top(c2).combined === allCombined[0] && c2.table.rows.length === 1, `fresh "biggest combined" after a record → the real record ${allCombined[0]} (got ${top(c2).combined})`);
  ok("QR-4", c2.table.columns.includes("combined"), "combined-score answers show the Total column");
  const c3 = await ask("give me the top 10 in history of this", c2.ctx);
  ok("QR-4", c3.table && c3.table.rows.length === 10 && c3.table.rows.every((r, i) => r.combined === allCombined[i]), "'top 10 of this' → ten games, ordered, one row per game");
  const c4 = await ask("no i want to see the top 10 in history of combined match scores", c3.ctx);
  ok("QR-4", c4.table && c4.table.rows.length === 10 && top(c4).combined === allCombined[0], "'top 10 combined match scores' → ranked list, not the previous game");
  const c5 = await ask("show more", c4.ctx);
  ok("QR-4", c5.table && c5.table.rows.length === 20, `'show more' widens to 20 (got ${c5.table && c5.table.rows.length})`);
  for (const [q, rec] of [["top 5 blowouts", "biggestMargin"], ["10 highest scores ever", "highestScore"], ["top 10 scores in a loss", "highestScoreInLoss"], ["top 3 longest win streaks", "longestWinStreak"]]) {
    const r = await ask(q);
    const holder = ctx.runQuery(ctx.validateSpec({ v: 2, table: "record", record: rec }, facts).spec, facts, []).rows[0];
    ok("QR-4", r.source === "recipe" && r.table.record === rec && r.table.top && r.table.rows.length > 1 && JSON.stringify(top(r)) === JSON.stringify(holder), `"${q}" → ranked ${rec}, row 1 = the record holder`);
  }
  // Pushback: a wrong answer is corrected; a right one is confirmed.
  const scoped = await ask("highest combined score in 2023");
  const best25 = facts.games.filter((r) => r.season === "2025" && r.status === "final" && r.phase === "regular" && r.result === "W").sort((a, b) => b.combined - a.combined)[0];
  const p1 = await ask(`are you sure? ${ctx.distinctName(best25.manager)} had a bigger game in 2025`, scoped.ctx);
  ok("QR-4", p1.source === "dispute" && /from 2025/.test(p1.content) && p1.table.rows.some((r) => r.gameId === best25.gameId), `claim about another season is checked, not repeated: ${p1.content}`);
  const p2 = await ask(`are you sure? ${ctx.distinctName(top(c2).manager)} had a bigger one in week ${top(c2).week} of ${top(c2).season}`, c2.ctx);
  ok("QR-4", /^Yes — /.test(p2.content), `claim about the record game itself → confirmed: ${p2.content}`);
  const m0 = await ask("most points in a loss");
  const wrong = await ask("what was the total game score?", m0.ctx);
  const p3 = await ask("are you sure, the highest combined score is bigger than that", Object.assign({}, wrong.ctx, { lastQ: "highest combined score", lastSpec: Object.assign({}, wrong.ctx.lastSpec, { _recipe: "follow-game" }) }));
  ok("QR-4", p3.source === "dispute" && /I got that wrong/.test(p3.content) && top(p3).combined === allCombined[0], `a follow-up answer that misread the question is re-run and corrected: ${p3.content}`);
  // Vague one-word prompts ask instead of guessing.
  let vaguePlan = 0;
  const v1 = await ask("stat", c4.ctx, { plan: async () => { vaguePlan++; return '{"table":"none"}'; } });
  ok("QR-4", v1.source === "clarify" && vaguePlan === 0 && !v1.table, "'stat' → a clarifying question, no planner call");
  // UR-7 follow-up still works when it IS about the previous game.
  ok("QR-4", /319\.96/.test((await ask("what was the total game score?", c1.ctx)).content), "'what was the total game score?' still follows up on the previous game");


  // ── QR-5: backup tables + query language v3 (independent recomputes) ─────────
  const played = facts.games.filter((r) => r.status === "final" && !r.bye);
  const run = (raw) => { const v = ctx.validateSpec(raw, facts); if (!v.ok) throw new Error("spec rejected: " + v.error + " " + JSON.stringify(raw)); return ctx.runQuery(v.spec, facts, PLAYERS, TRADES); };
  const r2 = (n) => Math.round(n * 100) / 100;
  {
    const weeks = run({ v: 3, table: "weeks", where: { phase: "all" }, limit: 25, orderBy: [{ col: "avg", dir: "desc" }] });
    const byWk = {};
    played.forEach((r) => { const k = r.season + "|" + r.week; (byWk[k] = byWk[k] || []).push(r.pf); });
    const best = Object.entries(byWk).map(([k, v]) => [k, r2(v.reduce((a, b) => a + b, 0) / v.length)]).sort((a, b) => b[1] - a[1])[0];
    ok("QR-5", weeks.total === Object.keys(byWk).length, `weeks table has one row per league week (${weeks.total} vs ${Object.keys(byWk).length})`);
    ok("QR-5", top(weeks.rows ? { table: weeks } : {}).avg === best[1] && weeks.rows[0].season + "|" + weeks.rows[0].week === best[0], `highest league-average week = ${best[0]} ${best[1]}`);
    const g = played.find((r) => r.season === "2024" && r.week === 5);
    ok("QR-5", g.vsAvg === r2(g.pf - r2(byWk["2024|5"].reduce((a, b) => a + b, 0) / byWk["2024|5"].length)), "game rows carry vsAvg = pf − league week average");
    ok("QR-5", !("_derived" in JSON.parse(JSON.stringify(facts))) && !Object.keys(facts.games[0]).includes("_derived"), "derived cache stays out of games.json");

    const dan150 = run({ v: 3, table: "games", where: { managers: ["dpol"], filters: [{ col: "pf", op: ">", value: 150 }] }, groupBy: ["manager"], select: ["count"] });
    const exp150 = played.filter((r) => r.phase === "regular" && r.manager === "dpol" && r.pf > 150).length;
    ok("QR-5", dan150.rows[0].count === exp150 && exp150 > 0, `filters: Dan regular-season games over 150 = ${exp150} (got ${dan150.rows[0].count})`);
    const both = run({ v: 3, table: "games", where: { filters: [{ col: "pf", op: ">=", value: 140 }, { col: "pa", op: ">=", value: 140 }] }, unique: true, orderBy: [{ col: "combined", dir: "desc" }], limit: 25 });
    const expBoth = played.filter((r) => r.phase === "regular" && r.pf >= 140 && r.pa >= 140).length / 2;
    ok("QR-5", both.total === expBoth && new Set(both.rows.map((r) => r.gameId)).size === both.rows.length, `unique: games where both scored 140+ = ${expBoth} (got ${both.total})`);
    ok("QR-5", both.columns.includes("combined"), "the sorted-on column is shown in ungrouped results");
    const titles = run({ v: 3, table: "seasons", where: { playoffFinish: "champion" }, groupBy: ["manager"], select: ["count"] });
    ok("QR-5", titles.rows[0].manager === "saulgoat" && titles.rows[0].count === 2 && titles.total === 2, "seasons groupBy: Saul 2 titles, Alastair 1");
    const tr = run({ v: 3, table: "trades", groupBy: ["manager"], select: ["count"], orderBy: [{ col: "count", dir: "desc" }] });
    const trCount = {};
    TRADES.forEach((t) => { [t.managerA, t.managerB].forEach((m) => { const c = ctx.canonical(m); trCount[c] = (trCount[c] || 0) + 1; }); });
    ok("QR-5", tr.rows[0].count === Math.max(...Object.values(trCount)) && tr.rows.reduce((a, r) => a + r.count, 0) === TRADES.length * 2, "trades table: per-manager counts match transactions");
    const rb = run({ v: 3, table: "players", where: { positions: ["RB"], seasons: ["2025"] }, groupBy: ["manager"], select: ["pts_sum"], orderBy: [{ col: "pts_sum", dir: "desc" }] });
    const rbSum = {};
    PLAYERS.filter((r) => r.pos === "RB").forEach((r) => { const c = ctx.canonical(r.manager); rbSum[c] = (rbSum[c] || 0) + r.pts; });
    const rbTop = Object.entries(rbSum).sort((a, b) => b[1] - a[1])[0];
    ok("QR-5", rb.rows[0].manager === rbTop[0] && rb.rows[0].pts_sum === r2(rbTop[1]), `players groupBy: most RB points 2025 = ${rbTop[0]} ${r2(rbTop[1])}`);
    const hv = run({ v: 3, table: "games", where: { result: "W" }, groupBy: ["manager"], select: ["count"], having: [{ col: "count", op: ">=", value: 20 }] });
    ok("QR-5", hv.rows.every((r) => r.count >= 20) && hv.total === Object.values(played.filter((r) => r.phase === "regular" && r.result === "W").reduce((m, r) => (m[r.manager] = (m[r.manager] || 0) + 1, m), {})).filter((n) => n >= 20).length, "having filters aggregated rows");
    // Every worked example in the planner prompt is a valid spec that returns rows.
    for (const [q, spec] of vmGet("PLANNER_EXAMPLES")) {
      const v = ctx.validateSpec(spec, facts);
      ok("QR-5", v.ok && ctx.runQuery(v.spec, facts, PLAYERS, TRADES).rows.length > 0, `planner example "${q}" validates and returns rows (${v.error || "ok"})`);
    }
    // The validator still rejects anything off-catalog — with a reason the repair loop can use.
    for (const [bad, why] of [
      [{ v: 3, table: "games", where: { filters: [{ col: "password", op: "=", value: 1 }] } }, "filter column"],
      [{ v: 3, table: "games", where: { filters: [{ col: "manager", op: ">", value: "dpol" }] } }, "text filter"],
      [{ v: 3, table: "games", where: { filters: [{ col: "opponent", op: "=", value: "nobody" }] } }, "unknown manager"],
      [{ v: 3, table: "games", where: { filters: [{ col: "pf", op: ">", value: "lots" }] } }, "needs a number"],
      [{ v: 3, table: "games", groupBy: ["player"] }, "groupBy"],
      [{ v: 3, table: "games", groupBy: ["manager"], select: ["secret_sum"] }, "select"],
      [{ v: 3, table: "games", groupBy: ["manager"], select: ["count"], having: [{ col: "wins", op: ">", value: 1 }] }, "having"],
      [{ v: 3, table: "seasons", unique: true }, "unique"],
      [{ v: 3, table: "weeks", orderBy: [{ col: "manager" }] }, "orderBy"],
    ]) {
      const v = ctx.validateSpec(bad, facts);
      ok("QR-5", !v.ok && v.error.includes(why), `rejects ${JSON.stringify(bad).slice(0, 70)} → "${v.error}"`);
    }
  }

  // ── QR-6: wider recipes (no model) + a planner with a repair loop ─────────────
  {
    const expect = [
      ["How many times has Dan scored over 150?", (r) => r.table.table === "games" && top(r).manager === "dpol" && top(r).count === played.filter((x) => x.phase === "regular" && x.manager === "dpol" && x.pf > 150).length],
      ["Who has the most 150+ games?", (r) => top(r).count === Math.max(...Object.values(played.filter((x) => x.phase === "regular" && x.pf >= 150).reduce((m, x) => (m[x.manager] = (m[x.manager] || 0) + 1, m), {})))],
      ["Games with a combined score over 300", (r) => r.table.total === played.filter((x) => x.phase === "regular" && x.combined > 300).length / 2 && /match/.test(r.content)],
      ["Who beats the league average most often?", (r) => r.table.spec.where.filters[0].col === "vsAvg" && top(r).count > 0],
      ["Who scored the most points against Josh?", (r) => r.table.spec.where.opponents[0] === "joshjr11" && r.table.rows.every((x) => x.manager !== "joshjr11")],
      ["Who has conceded the most points?", (r) => r.table.columns.includes("pa_sum")],
      ["All-play records", (r) => r.table.columns.includes("allPlayW_sum")],
      ["How many titles has each manager won?", (r) => top(r).manager === "saulgoat" && top(r).count === 2],
      ["Most playoff appearances", (r) => r.table.table === "seasons" && top(r).count >= 1],
      ["Which weeks did Saul top-score?", (r) => r.table.rows.length > 0 && r.table.rows.every((x) => x.manager === "saulgoat" && x.weekRank === 1)],
      ["Who has made the most trades?", (r) => r.table.table === "trades" && top(r).count >= 1],
      ["Trades between Jamie and Sanford", (r) => r.table.rows.length > 0 && r.table.rows.every((x) => x.manager === "drjkay" && x.partner === "sanfbe")],
      ["Highest scoring week for the whole league", (r) => r.table.table === "weeks" && r.table.spec.orderBy[0].col === "avg"],
      ["League average by season", (r) => r.table.table === "weeks" && r.table.spec.groupBy[0] === "season"],
      ["Best RBs in 2025", (r) => r.table.table === "players" && r.table.rows.every((x) => x.pos === "RB") && top(r).pts === Math.max(...PLAYERS.filter((x) => x.pos === "RB").map((x) => x.pts))],
      ["Which manager got the most WR points in 2025?", (r) => r.table.spec.groupBy[0] === "manager" && r.table.columns.includes("pts_sum")],
      ["Saul's points by position", (r) => r.table.spec.groupBy[0] === "pos" && r.table.rows.length > 1],
      ["Highest scoring matchup ever", (r) => r.table.record === "highestCombined"],
      ["What's the high score of all time?", (r) => r.table.record === "highestScore"],
      ["Biggest win margin", (r) => r.table.record === "biggestMargin"],
    ];
    for (const [q, check] of expect) {
      let planCalls = 0;
      const r = await ask(q, null, { plan: async () => { planCalls++; return '{"table":"none"}'; }, narrate: async () => { throw new Error("no narration in this test"); } });
      let good = false;
      try { good = r.source === "recipe" && planCalls === 0 && r.table && check(r); } catch (e) { good = false; }
      ok("QR-6", good, `"${q}" → recipe answer (source ${r.source}, planner ${planCalls}, ${r.table ? r.table.table + "/" + (r.table.record || r.table.columns.join(",")) : "no table"}): ${r.content}`);
      ok("QR-7", r.content && !/Here is what the data shows/.test(r.content) && ctx.numberGuard(r.content, r.table ? r.table.rows : [], [r.table && r.table.total, ...(r.table ? [r.table.scope] : [])]).ok, `"${q}" JS sentence is specific and every number is from the rows: ${r.content}`);
    }
    // Repair loop: a rejected spec gets ONE retry carrying the validator's reason.
    const seen = [];
    const fixing = async (prompt) => { seen.push(prompt); return seen.length === 1 ? JSON.stringify({ v: 3, table: "games", groupBy: ["manager"], select: ["points_total"] }) : JSON.stringify({ v: 3, table: "games", groupBy: ["manager"], select: ["pf_sum"], orderBy: [{ col: "pf_sum", dir: "desc" }] }); };
    const rp = await ask("Rank everyone by their aggregate tally, please", null, { plan: fixing, narrate: async () => "Ranked." });
    ok("QR-6", seen.length === 2 && /REJECTED: bad select points_total/.test(seen[1]) && rp.table && rp.table.columns.includes("pf_sum") && rp.modelCalls === 3, `repair loop: second planner call sees the error and its answer is used (calls ${rp.modelCalls})`);
    let twice = 0;
    const rp2 = await ask("Rank everyone by their aggregate tally, please", null, { plan: async () => { twice++; return JSON.stringify({ v: 3, table: "nope" }); } });
    ok("QR-6", twice === 2 && rp2.source === "cant" && rp2.content === CANT, "repair loop gives up after one retry → can't-answer");
    const pp = ctx.plannerPrompt("anything", null, facts);
    ok("QR-6", /vsAvg \(pf minus weekAvg/.test(pp) && /last completed week 17/.test(pp) && /EXAMPLES:/.test(pp) && /"table":"weeks"/.test(pp), "planner prompt carries the catalog, calendar and worked examples");
    ok("QR-6", ctx.normalizeQ("biggest matchup pts") === "biggest game points", "synonym pass");
  }

  // ── QR-7: answers — scope line, list sentences, derived facts for narration ──
  {
    const r = await ask("All-time standings");
    ok("QR-7", r.table.scope === "Regular season · final games · all seasons", `scope line: ${r.table.scope}`);
    const sc = await ask("How many times has Dan scored over 150 in 2024?");
    ok("QR-7", /PF > 150/.test(sc.table.scope) && /2024/.test(sc.table.scope) && /Dan/.test(sc.table.scope), `scope names the filters: ${sc.table.scope}`);
    // A narration quoting the JS-derived gap between #1 and #2 passes the guard.
    const ls = await ask("Who has the most 150+ games?");
    const gap = Math.abs(ls.table.rows[0].count - ls.table.rows[1].count);
    const nar = await ask("Who has the most 150+ games?", null, { narrate: async () => `${ctx.distinctName(ls.table.rows[0].manager)} leads by ${gap}.` });
    ok("QR-7", nar.content === `${ctx.distinctName(ls.table.rows[0].manager)} leads by ${gap}.`, `narration using a derived gap is kept: ${nar.content}`);
    const np2 = ctx.narrationPrompt("q", null, ls.table);
    ok("QR-7", /COMPUTED \(you may use these\): gap between #1 and #2/.test(np2) && /SCOPE: /.test(np2), "narration prompt carries scope + computed facts");
  }

  if (failures) { console.error(`test-questions.js: ${failures} check(s) FAILED (${passes} passed)`); process.exit(1); }
  console.log(`test-questions.js: QR-1/QR-2/QR-3 + UR-7 (engine) — ${passes} checks passed ✓`);
})().catch((e) => { console.error("test-questions.js: harness error", e); process.exit(1); });
