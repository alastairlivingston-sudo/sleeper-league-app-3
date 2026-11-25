# Stats engine v3: more tables, a smarter planner, better answers

## Why the engine still feels weak
v2 is safe: every number is computed in JS. But it can only answer a narrow set of questions.

1. **Few tables.** The engine has `games`, `seasons`, `players` and `record`. It cannot see
   league-wide weekly numbers (averages, the high and low each week), trades, or how a team
   scored against the league average. "Who beats the league average most often?" has no table
   to come from.
2. **The query language is small.** It has no numeric filters (`pf > 150`), only fixed
   aggregates (`pf_sum` and so on), seven fixed groupings, no `having`, and no
   one-row-per-game option. So the AI planner often can't express a question even when it
   understands it, and the answer is "can't answer".
3. **The planner prompt is thin.** It lists no column meanings and no worked examples. It
   doesn't know what "this season" or "last week" mean, and it gets one attempt: a single
   invalid field means "can't answer".
4. **Recipes are brittle.** "match", "pts", "beaten", "high score" and similar words miss
   regexes written for "game", "points", "lost" and "highest score".
5. **Multi-row answers read badly.** Without the AI the reply is "Here is what the data
   shows." With the AI, the number guard throws away good sentences because, for example,
   the gap between #1 and #2 isn't in the rows.
6. **No scope shown.** Answers don't say what was counted: regular season or playoffs,
   which seasons.

## The plan (all phases ship together; zero-dep pipeline; every number from JS)

| # | Change | Requirement |
|---|---|---|
| 1 | **Backup tables**, derived in the browser from data the page already has, so no new fetches. `weeks` has one row per league week: avg, median, high/low and who scored them, spread, highest combined. `trades` has one row per side of each trade. Game rows gain `weekAvg`, `vsAvg` (points above that week's league average) and `oppWeekRank`. `players` can be grouped by manager, position or season. | QR-5 |
| 2 | **Query language v3**, a superset of v2. `filters` take numeric and text comparisons on any column. `select` takes `count` or `<sum\|avg\|max\|min>_<column>`. `groupBy` takes any one or two dimensions of the table. `having` filters on aggregates. `unique` gives one row per game. One **catalog** defines every table, column, dimension and meaning; the validator, the ResultTable labels and the planner prompt all read it, so they can't drift apart. | QR-5 |
| 3 | **Smarter planner.** The prompt is generated from the catalog and includes column meanings. It has 12 worked examples and calendar context (current season, last final week, live week, the seasons that exist). A **repair loop** gives one retry with the validator's error. | QR-6 |
| 4 | **Wider recipes, no AI needed.** A synonym pass runs before matching. New recipes: league weekly high/low and average; "beat the league average" counts; points against; all-play record; "scored over N" counts; trades; top players by position; position points by manager. | QR-6 |
| 5 | **Better answers.** A JS list sentence for multi-row results ("A leads with X; then B (Y), C (Z)"). JS-computed *derived facts* (the gap to #2, the average of the shown rows) go to the narrator and to the guard's allowed numbers. A **scope line** under every table, such as "Regular season · final games · 2023–2026". | QR-7 |
| 6 | **Question bank.** 40+ real-style questions in `test-questions.js`, each checked against an independent recompute. The model is mocked: planner replies are written in the test, which proves the v3 language can express them. | QR-5..7 |

Non-goals: free-form model-written code, new data fetches, play-by-play.
