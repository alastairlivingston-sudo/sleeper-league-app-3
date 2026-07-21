function r1(n) { return Math.round(n * 10) / 10; }
function r2(n) { return Math.round(n * 100) / 100; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
  return Math.sqrt(arr.reduce(function(a, b) { return a + (b - m) * (b - m); }, 0) / arr.length);
}
function blankRow(h) { return { handle: h, w: 0, l: 0, t: 0, pf: 0, pa: 0, scores: [], apW: 0, apL: 0, apT: 0 }; }
function finalizeRow(m) {
  const games = m.w + m.l + m.t;
  const apG = m.apW + m.apL + m.apT;
  const apPct = apG ? m.apW / apG : 0;
  const expW = apPct * games;
  const avg = m.scores.length ? m.scores.reduce(function(a,b){return a+b;},0) / m.scores.length : 0;
  return {
    name: displayName(m.handle), alias: distinctName(m.handle), handle: m.handle,
    record: m.w + '-' + m.l + (m.t ? '-' + m.t : ''),
    wins: m.w, losses: m.l, pf: r2(m.pf), pa: r2(m.pa),
    avgScore: r1(avg), consistencySD: r1(stdev(m.scores)),
    high: m.scores.length ? r2(Math.max.apply(null, m.scores)) : 0,
    low: m.scores.length ? r2(Math.min.apply(null, m.scores)) : 0,
    allPlay: m.apW + '-' + m.apL + (m.apT ? '-' + m.apT : ''),
    allPlayWinPct: r1(apPct * 100), expectedWins: r1(expW), luck: r1(m.w - expW),
  };
}
function computeAnalytics(history) {
  const seasons = (history && history.seasons) ? history.seasons : [];
  const perSeason = [];
  const allAcc = {};
  for (let si = 0; si < seasons.length; si++) {
    const s = seasons[si];
    const acc = {};
    const weeks = {};
    const games = s.games || [];
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      if (g.playoff || !(g.pa > 0 || g.pb > 0)) continue;
      if (!weeks[g.week]) weeks[g.week] = [];
      weeks[g.week].push(g);
    }
    const weekKeys = Object.keys(weeks);
    for (let wi = 0; wi < weekKeys.length; wi++) {
      const wgames = weeks[weekKeys[wi]];
      const board = [];
      for (let gi = 0; gi < wgames.length; gi++) {
        const g = wgames[gi];
        const ha = canonical(g.a), hb = canonical(g.b);
        if (!acc[ha]) acc[ha] = blankRow(ha);
        if (!acc[hb]) acc[hb] = blankRow(hb);
        const A = acc[ha], B = acc[hb];
        A.pf += g.pa; A.pa += g.pb; A.scores.push(g.pa);
        B.pf += g.pb; B.pa += g.pa; B.scores.push(g.pb);
        if (g.pa > g.pb) { A.w++; B.l++; } else if (g.pb > g.pa) { B.w++; A.l++; } else { A.t++; B.t++; }
        board.push([ha, g.pa], [hb, g.pb]);
      }
      for (let ai = 0; ai < board.length; ai++) {
        const h = board[ai][0], sc = board[ai][1];
        const a = acc[h];
        for (let bi = 0; bi < board.length; bi++) {
          const h2 = board[bi][0], sc2 = board[bi][1];
          if (h2 === h) continue;
          if (sc > sc2) a.apW++; else if (sc < sc2) a.apL++; else a.apT++;
        }
      }
    }
    const rows = Object.values(acc);
    if (rows.length) {
      perSeason.push({
        season: s.season,
        champion: s.champion ? displayName(s.champion) : null,
        managers: rows.map(finalizeRow).sort(function(a,b){ return b.wins - a.wins || b.pf - a.pf; }),
      });
    }
    for (let ri = 0; ri < rows.length; ri++) {
      const m = rows[ri];
      if (!allAcc[m.handle]) allAcc[m.handle] = blankRow(m.handle);
      const t = allAcc[m.handle];
      t.w += m.w; t.l += m.l; t.t += m.t; t.pf += m.pf; t.pa += m.pa;
      t.apW += m.apW; t.apL += m.apL; t.apT += m.apT;
      for (let si2 = 0; si2 < m.scores.length; si2++) t.scores.push(m.scores[si2]);
    }
  }
  const allTime = Object.values(allAcc).map(finalizeRow).sort(function(a,b){ return b.wins - a.wins || b.pf - a.pf; });
  return { perSeason: perSeason, allTime: allTime };
}

