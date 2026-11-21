
// ── Fact table (Phase 1) ─────────────────────────────────────────────────────
// ONE table behind every record, standing, streak and H2H: two rows per game, one
// per manager. This partial is PLAIN JS (no JSX, no imports) on purpose:
// scripts/build-facts.js and the zero-dep tests load this exact file with `vm`,
// so the browser and the pipeline run identical code (non-negotiable 2).
//
// buildFactTable(history, canon) → { games, seasons, records }
//   history: lean history.json or history-details.json ({ seasons: [...] })
//   canon:   handle → canonical handle (aliases merged)
function factRound(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function factPhase(g) {
  if (g.phase) return g.phase;
  return g.playoff ? 'playoff' : 'regular';
}

function buildFactRows(history, canon) {
  const seasons = (history && history.seasons) ? history.seasons : [];
  const rows = [];
  for (let si = 0; si < seasons.length; si++) {
    const s = seasons[si];
    const season = String(s.season);
    const games = s.games || [];
    const perWeek = {};
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      const status = g.status || 'final';
      if (status !== 'final' && status !== 'live') continue;
      perWeek[g.week] = (perWeek[g.week] || 0) + 1;
      const gameId = season + '-' + g.week + '-m' + perWeek[g.week];
      const phase = factPhase(g);
      const sides = [
        { m: g.a, o: g.b, pf: g.pa, pa: g.pb, pos: g.ap, bench: g.ab },
        { m: g.b, o: g.a, pf: g.pb, pa: g.pa, pos: g.bp, bench: g.bb },
      ];
      for (let k = 0; k < 2; k++) {
        const x = sides[k];
        const pf = factRound(x.pf), pa = factRound(x.pa);
        const manager = canon(x.m), opponent = canon(x.o);
        const result = status !== 'final' ? null : (pf > pa ? 'W' : (pf < pa ? 'L' : 'T'));
        rows.push({
          id: season + '-' + g.week + '-' + manager,
          gameId: gameId, season: season, week: g.week, phase: phase, status: status,
          manager: manager, opponent: opponent, pf: pf, pa: pa, result: result,
          margin: factRound(pf - pa), combined: factRound(pf + pa),
          bye: false, weekRank: null, allPlayW: null, allPlayL: null,
          benchPts: Array.isArray(x.bench) ? factRound(x.bench.reduce(function(t, p) { return t + (p.pts || 0); }, 0)) : null,
          pos: (x.pos && typeof x.pos === 'object') ? x.pos : null,
        });
      }
    }
    const byes = s.byes || [];
    for (let bi = 0; bi < byes.length; bi++) {
      const y = byes[bi];
      const manager = canon(y.manager);
      rows.push({
        id: season + '-' + y.week + '-' + manager, gameId: season + '-' + y.week + '-bye-' + manager,
        season: season, week: y.week, phase: 'playoff', status: 'final',
        manager: manager, opponent: null, pf: factRound(y.pts), pa: null, result: null,
        margin: null, combined: null, bye: true, weekRank: null, allPlayW: null, allPlayL: null,
        benchPts: null, pos: null,
      });
    }
  }
  // weekRank + all-play: final regular-season rows, vs every other score that week.
  const byWeek = {};
  rows.forEach(function(r) {
    if (r.status !== 'final' || r.phase !== 'regular' || r.bye) return;
    const k = r.season + '|' + r.week;
    (byWeek[k] = byWeek[k] || []).push(r);
  });
  Object.keys(byWeek).forEach(function(k) {
    const wk = byWeek[k];
    wk.forEach(function(r) {
      let higher = 0, w = 0, l = 0;
      wk.forEach(function(o) {
        if (o === r) return;
        if (o.pf > r.pf) { higher++; l++; } else if (o.pf < r.pf) { w++; }
      });
      r.weekRank = higher + 1;
      r.allPlayW = w; r.allPlayL = l;
    });
  });
  rows.sort(function(x, y) {
    return x.season.localeCompare(y.season) || x.week - y.week || x.gameId.localeCompare(y.gameId) || x.manager.localeCompare(y.manager);
  });
  return rows;
}

// A row is a scored, played game side (not a bye, not live).
function factPlayed(r) { return r.status === 'final' && !r.bye; }
function factInScope(r, scope) { return scope === 'all' ? true : r.phase === 'regular'; }

// One row per manager per season.
function buildSeasonRows(history, rows, canon) {
  const seasons = (history && history.seasons) ? history.seasons : [];
  const latest = seasons.length ? String(seasons[seasons.length - 1].season) : null;
  const out = [];
  seasons.forEach(function(s) {
    const season = String(s.season);
    const complete = s.complete != null ? !!s.complete : s.champion != null;
    const champ = s.champion ? canon(s.champion) : null;
    const sRows = rows.filter(function(r) { return r.season === season; });
    const playoffRows = sRows.filter(function(r) { return r.phase === 'playoff' && r.status === 'final'; });
    const lastPlayoffWeek = playoffRows.reduce(function(m, r) { return Math.max(m, r.week); }, 0);
    // Runner-up = champion's opponent in their last playoff game.
    let runnerUp = null;
    if (champ) {
      const cg = playoffRows.filter(function(r) { return r.manager === champ && !r.bye; }).sort(function(a, b) { return b.week - a.week; })[0];
      if (cg) runnerUp = cg.opponent;
    }
    const field = {};
    playoffRows.forEach(function(r) { field[r.manager] = true; });
    (s.standings || []).forEach(function(st, idx) {
      const m = canon(st.manager);
      const reg = sRows.filter(function(r) { return r.manager === m && r.phase === 'regular' && factPlayed(r); });
      let w = 0, l = 0, t = 0, pf = 0, pa = 0, apW = 0, apL = 0, xw = 0;
      reg.forEach(function(r) {
        if (r.result === 'W') w++; else if (r.result === 'L') l++; else if (r.result === 'T') t++;
        pf += r.pf; pa += r.pa; apW += r.allPlayW || 0; apL += r.allPlayL || 0;
        const n = (r.allPlayW || 0) + (r.allPlayL || 0);
        if (n) xw += (r.allPlayW || 0) / n;
      });
      let finish = 'missed';
      if (!complete) finish = null;
      else if (m === champ) finish = 'champion';
      else if (m === runnerUp) finish = 'runner-up';
      else if (field[m]) {
        // Semi-finalist = last playoff game was in the final or the round before it
        // (the 3rd-place game is not always played — Sleeper re-filled the 2024 slot).
        const lastWk = playoffRows.filter(function(r) { return r.manager === m && !r.bye; }).reduce(function(x, r) { return Math.max(x, r.week); }, 0);
        finish = lastWk >= lastPlayoffWeek - 1 ? 'semi' : 'consolation';
      }
      out.push({
        id: season + '-' + m, season: season, manager: m,
        wins: w, losses: l, ties: t, games: reg.length,
        pf: factRound(pf), pa: factRound(pa), pfAvg: reg.length ? factRound(pf / reg.length) : 0,
        rank: idx + 1, allPlayW: apW, allPlayL: apL,
        expectedWins: factRound(xw), luck: factRound(w - xw),
        playoffFinish: finish, complete: complete, current: season === latest && !complete,
        sleeperWins: st.wins || 0, sleeperLosses: st.losses || 0,
      });
    });
  });
  return out;
}

// Rows equal to the best value (ties return every tied row).
function factBest(list, key, dir) {
  if (!list.length) return [];
  let best = null;
  list.forEach(function(r) {
    const v = key(r);
    if (v == null) return;
    if (best == null || (dir === 'max' ? v > best : v < best)) best = v;
  });
  if (best == null) return [];
  return list.filter(function(r) { return key(r) === best; });
}

// Streaks over chronological played rows per manager (ties break a streak).
function factStreaks(rows) {
  const by = {};
  rows.forEach(function(r) { (by[r.manager] = by[r.manager] || []).push(r); });
  const runs = [];
  Object.keys(by).forEach(function(m) {
    const list = by[m];
    let cur = null;
    list.forEach(function(r) {
      if (cur && cur.type === r.result) { cur.length++; cur.to = { season: r.season, week: r.week }; }
      else {
        if (cur) runs.push(cur);
        cur = { manager: m, type: r.result, length: 1, from: { season: r.season, week: r.week }, to: { season: r.season, week: r.week }, current: false };
      }
    });
    if (cur) { cur.current = true; runs.push(cur); }
  });
  return runs;
}

function factCountBy(list, pred) {
  const c = {};
  list.forEach(function(r) { if (pred(r)) c[r.manager] = (c[r.manager] || 0) + 1; });
  return Object.keys(c).map(function(m) { return { manager: m, count: c[m] }; });
}

// Game-level records over one scope of rows.
function factGameRecords(rows, scope) {
  const played = rows.filter(function(r) { return factPlayed(r) && factInScope(r, scope); });
  const W = played.filter(function(r) { return r.result === 'W'; });
  const L = played.filter(function(r) { return r.result === 'L'; });
  const oneSide = played.filter(function(r) { return r.result === 'W' || (r.result === 'T' && r.manager < r.opponent); });
  const ranked = played.filter(function(r) { return r.weekRank != null; });
  const weekSize = {};
  ranked.forEach(function(r) { const k = r.season + '|' + r.week; weekSize[k] = (weekSize[k] || 0) + 1; });
  const streakRows = played.slice();
  const runs = factStreaks(streakRows);
  const lossRanked = ranked.filter(function(r) { return r.result === 'L'; });
  const winRanked = ranked.filter(function(r) { return r.result === 'W'; });
  const bestRank = lossRanked.length ? Math.min.apply(null, lossRanked.map(function(r) { return r.weekRank; })) : null;
  const worstRank = winRanked.length ? Math.max.apply(null, winRanked.map(function(r) { return r.weekRank; })) : null;
  return {
    highestScore: factBest(played, function(r) { return r.pf; }, 'max'),
    lowestScore: factBest(played, function(r) { return r.pf; }, 'min'),
    highestScoreInLoss: factBest(L, function(r) { return r.pf; }, 'max'),
    lowestScoreInWin: factBest(W, function(r) { return r.pf; }, 'min'),
    biggestMargin: factBest(W, function(r) { return r.margin; }, 'max'),
    closestGame: factBest(oneSide, function(r) { return Math.abs(r.margin); }, 'min'),
    highestCombined: factBest(oneSide, function(r) { return r.combined; }, 'max'),
    lowestCombined: factBest(oneSide, function(r) { return r.combined; }, 'min'),
    longestWinStreak: factBest(runs.filter(function(x) { return x.type === 'W'; }), function(x) { return x.length; }, 'max'),
    longestLossStreak: factBest(runs.filter(function(x) { return x.type === 'L'; }), function(x) { return x.length; }, 'max'),
    currentStreaks: runs.filter(function(x) { return x.current; }).sort(function(a, b) { return b.length - a.length || a.manager.localeCompare(b.manager); }),
    mostTopScoreWeeks: factBest(factCountBy(ranked, function(r) { return r.weekRank === 1; }), function(x) { return x.count; }, 'max'),
    mostBottomScoreWeeks: factBest(factCountBy(ranked, function(r) { return r.weekRank === weekSize[r.season + '|' + r.week]; }), function(x) { return x.count; }, 'max'),
    unluckiestLoss: bestRank == null ? [] : factBest(lossRanked.filter(function(r) { return r.weekRank === bestRank; }), function(r) { return r.pf; }, 'max'),
    luckiestWin: worstRank == null ? [] : factBest(winRanked.filter(function(r) { return r.weekRank === worstRank; }), function(r) { return r.pf; }, 'min'),
  };
}

const RECORD_NAMES = ['highestScore', 'lowestScore', 'highestScoreInLoss', 'lowestScoreInWin', 'biggestMargin',
  'closestGame', 'highestCombined', 'lowestCombined', 'bestSeasonPF', 'worstSeasonPF', 'longestWinStreak',
  'longestLossStreak', 'currentStreaks', 'mostTopScoreWeeks', 'mostBottomScoreWeeks', 'unluckiestLoss', 'luckiestWin'];

function buildRecords(rows, seasonRows) {
  const complete = seasonRows.filter(function(r) { return r.complete; });
  const reg = factGameRecords(rows, 'regular');
  const all = factGameRecords(rows, 'all');
  const records = {};
  RECORD_NAMES.forEach(function(name) {
    if (name === 'bestSeasonPF' || name === 'worstSeasonPF') {
      const v = factBest(complete, function(r) { return r.pf; }, name === 'bestSeasonPF' ? 'max' : 'min');
      records[name] = { regular: v, all: v };
    } else {
      records[name] = { regular: reg[name], all: all[name] };
    }
  });
  // Per-season variants for the current (in-progress or latest) season.
  const seasonsList = [];
  rows.forEach(function(r) { if (seasonsList.indexOf(r.season) === -1) seasonsList.push(r.season); });
  const cur = seasonsList[seasonsList.length - 1];
  if (cur) {
    const curRows = rows.filter(function(r) { return r.season === cur; });
    records.current = { season: cur, regular: factGameRecords(curRows, 'regular'), all: factGameRecords(curRows, 'all') };
  }
  return records;
}

// Where the league is right now: latest season, last FINAL week, live week.
function factCurrent(history, rows) {
  const seasons = (history && history.seasons) ? history.seasons : [];
  const s = seasons[seasons.length - 1];
  if (!s) return null;
  const season = String(s.season);
  const finals = rows.filter(function(r) { return r.season === season && r.status === 'final' && !r.bye; });
  const lastFinalWeek = s.lastFinalWeek != null ? s.lastFinalWeek : finals.reduce(function(m, r) { return Math.max(m, r.week); }, 0);
  const live = rows.filter(function(r) { return r.season === season && r.status === 'live'; });
  return {
    season: season, complete: s.complete != null ? !!s.complete : s.champion != null,
    lastFinalWeek: lastFinalWeek, liveWeek: s.liveWeek != null ? s.liveWeek : (live.length ? live[0].week : null),
    champion: s.champion || null, schedule: s.schedule || [],
  };
}

function buildFactTable(history, canon) {
  const c = canon || function(h) { return String(h || '').replace(/^@/, '').trim(); };
  const rows = buildFactRows(history, c);
  const seasonRows = buildSeasonRows(history, rows, c);
  return { games: rows, seasons: seasonRows, records: buildRecords(rows, seasonRows), current: factCurrent(history, rows) };
}
