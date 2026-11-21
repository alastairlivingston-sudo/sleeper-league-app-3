// Season invariants for history.json — shared by validate.js (live data) and
// test-status.js (fixtures). Zero deps. `check(cond, id, msg)` records a
// failure; `warn(cond, id, msg)` records a non-fatal finding.
//
// Complete season (winners-bracket final has a winner): champion set, every
// game final, at least one playoff game, contiguous weeks, W/L == games.
// In-progress season (DR-3): champion may be null, no playoff games required,
// contiguity on FINAL weeks only, W/L == count of FINAL regular games, zero
// scheduled games in games[], live games only in the current week.
// Both (DR-4): standings high == max final score in the games list (+ byes).

function checkHistory(history, { check, warn, canon }) {
  const playedList = (history.seasons || []).filter((s) => (s.games || []).length > 0);
  const latestPlayed = playedList[playedList.length - 1];

  for (const s of history.seasons || []) {
    const games = s.games || [];
    const standings = s.standings || [];
    if (games.length === 0) continue; // future/unplayed season — skip completeness checks

    // Known handles for THIS season (Sleeper display names vary by season).
    const known = new Set(standings.map((r) => canon(r.manager)));
    // A season is complete when its winners-bracket final has a winner (fetch-history
    // sets `complete`). Older files without the flag: champion present == complete.
    const complete = s.complete != null ? !!s.complete : s.champion != null;
    const statusOf = (g) => g.status || "final";
    const finalGames = games.filter((g) => statusOf(g) === "final");

    check(standings.length === 8, "history.standings.count",
      `season ${s.season} has ${standings.length} standings rows, expected 8`);
    // Only the latest season may be in progress — an older incomplete season means
    // the bracket/champion fetch broke.
    check(complete || s === latestPlayed, "history.complete.past",
      `season ${s.season} is not complete but is not the latest season`);

    // DR-3: status tagging. Scheduled (0-0 future) games never sit in games[].
    for (const g of games) {
      check(["final", "live"].includes(statusOf(g)), "history.game.status",
        `season ${s.season} wk${g.week} has status ${g.status} in games[] (scheduled games belong in schedule[])`);
      if (g.phase != null) {
        check(["regular", "playoff", "consolation"].includes(g.phase), "history.game.phase",
          `season ${s.season} wk${g.week} unknown phase ${g.phase}`);
        check(g.playoff === (g.phase !== "regular"), "history.game.playoffFlag",
          `season ${s.season} wk${g.week} playoff flag ${g.playoff} disagrees with phase ${g.phase}`);
      }
    }
    if (complete) {
      check(s.champion != null, "history.champion", `season ${s.season} is complete but champion is null`);
      check(finalGames.length === games.length, "history.complete.allFinal",
        `season ${s.season} is complete but has non-final games`);
    } else {
      const live = games.filter((g) => statusOf(g) === "live");
      const lastFinal = finalGames.reduce((m, g) => Math.max(m, g.week), 0);
      for (const g of live) {
        check(s.liveWeek != null && g.week === s.liveWeek, "history.live.week",
          `season ${s.season} live game in wk${g.week}, expected only the current week ${s.liveWeek}`);
        check(g.week === lastFinal + 1, "history.live.next",
          `season ${s.season} live game in wk${g.week} but last final week is ${lastFinal}`);
      }
      if (s.lastFinalWeek != null) {
        check(s.lastFinalWeek === lastFinal, "history.lastFinalWeek",
          `season ${s.season} lastFinalWeek ${s.lastFinalWeek} != max final game week ${lastFinal}`);
      }
    }

    // Contiguous FINAL weeks from 1 (catches a mid-season gap).
    const weeks = [...new Set(finalGames.map((g) => g.week))].sort((a, b) => a - b);
    if (weeks.length) {
      check(weeks[0] === 1, "history.weeks.start",
        `season ${s.season} first final game week is ${weeks[0]}, expected 1`);
      for (let i = 0; i < weeks.length; i++) {
        check(weeks[i] === i + 1, "history.weeks.contiguous",
          `season ${s.season} week gap: expected ${i + 1}, got ${weeks[i]}`);
      }
    }

    // Truncation guard: standings W/L come from Sleeper's authoritative roster
    // settings; the games list is fetched week-by-week and can be cut short by a
    // transient error. So each manager's FINAL regular-season game count must
    // equal wins+losses+ties. A tail-truncated season fails here even though its
    // remaining weeks are still contiguous from 1.
    const regCount = {};
    const regWL = {};
    for (const g of finalGames) {
      if (g.playoff) continue;
      const A = canon(g.a), B = canon(g.b);
      for (const m of [A, B]) {
        regCount[m] = (regCount[m] || 0) + 1;
        regWL[m] = regWL[m] || { w: 0, l: 0, t: 0 };
      }
      if (g.pa > g.pb) { regWL[A].w++; regWL[B].l++; }
      else if (g.pb > g.pa) { regWL[B].w++; regWL[A].l++; }
      else { regWL[A].t++; regWL[B].t++; }
    }
    for (const r of standings) {
      const m = canon(r.manager);
      const record = (r.wins || 0) + (r.losses || 0) + (r.ties || 0);
      check(record === (regCount[m] || 0), "history.games.complete",
        `season ${s.season} ${r.manager}: standings record ${record} != ${regCount[m] || 0} final regular-season games (truncated?)`);
      const wl = regWL[m] || { w: 0, l: 0, t: 0 };
      // WARN only: Sleeper locks W/L when a week is scored, but later stat
      // corrections can flip a close game's points (seen in 2023: 3 games). We
      // never "correct" either side — log it so a new occurrence is visible.
      warn(wl.w === (r.wins || 0) && wl.l === (r.losses || 0), "history.games.wl",
        `season ${s.season} ${r.manager}: standings ${r.wins}-${r.losses} != ${wl.w}-${wl.l} from final games`);
    }

    // DR-4: standings high == max final score in the games list (plus playoff byes).
    const maxScore = {};
    const bump = (m, p) => { if ((maxScore[m] || 0) < p) maxScore[m] = p; };
    for (const g of finalGames) { bump(canon(g.a), g.pa); bump(canon(g.b), g.pb); }
    for (const y of s.byes || []) bump(canon(y.manager), y.pts);
    for (const r of standings) {
      if (r.high == null) continue;
      const m = canon(r.manager);
      check(Math.abs((r.high || 0) - (maxScore[m] || 0)) < 0.005, "history.standings.high",
        `season ${s.season} ${r.manager}: standings high ${r.high} != max final game score ${maxScore[m] || 0}`);
    }

    if (complete) {
      // A completed season is a playoff league — at least one playoff game must be
      // present (guards wholesale loss of the playoff weeks).
      check(games.some((g) => g.playoff), "history.playoffs.present",
        `season ${s.season} has a champion but no playoff games`);
      const champ = canon(s.champion);
      check(known.has(champ), "history.champion.known",
        `season ${s.season} champion ${s.champion} not in standings`);
    }

    // Every participant handle resolves into this season's standings; scores non-negative.
    for (const g of games) {
      check(known.has(canon(g.a)), "history.game.handle", `season ${s.season} unknown manager ${g.a}`);
      check(known.has(canon(g.b)), "history.game.handle", `season ${s.season} unknown manager ${g.b}`);
      check(g.pa >= 0 && g.pb >= 0, "history.game.score",
        `season ${s.season} wk${g.week} negative score ${g.pa}/${g.pb}`);
    }
    for (const y of s.schedule || []) {
      check(known.has(canon(y.a)) && known.has(canon(y.b)), "history.schedule.handle",
        `season ${s.season} wk${y.week} schedule has unknown manager ${y.a}/${y.b}`);
    }
  }
}

module.exports = { checkHistory };
