
// ── Stats v3: backup tables + the one catalog ────────────────────────────────
// PLAIN JS (no JSX): scripts/test-questions.js loads this exact file with `vm`.
// Every table the Stats engine can query, derived in the browser from data the
// page already has (no new fetches). CATALOG is the single definition of each
// table's columns, dimensions and meanings: validateSpec, the ResultTable labels
// and the planner prompt all read it, so they cannot drift apart.

// Columns added to game rows + the league-week table. Computed once per fact
// table and cached on it (non-enumerable, so games.json output is unchanged).
function ensureDerived(facts) {
  if (facts._derived) return facts._derived;
  const byWeek = {}, byGame = {};
  facts.games.forEach(function(r) {
    if (r.status !== 'final' || r.bye) return;
    const k = r.season + '|' + r.week;
    (byWeek[k] = byWeek[k] || []).push(r);
    (byGame[r.gameId] = byGame[r.gameId] || []).push(r);
  });
  const weeks = [];
  Object.keys(byWeek).forEach(function(k) {
    const rs = byWeek[k];
    const pfs = rs.map(function(r) { return r.pf; }).sort(function(a, b) { return a - b; });
    const n = pfs.length;
    const avg = factRound(pfs.reduce(function(t, v) { return t + v; }, 0) / n);
    const median = factRound(n % 2 ? pfs[(n - 1) / 2] : (pfs[n / 2 - 1] + pfs[n / 2]) / 2);
    const hi = rs.reduce(function(b, r) { return !b || r.pf > b.pf ? r : b; }, null);
    const lo = rs.reduce(function(b, r) { return !b || r.pf < b.pf ? r : b; }, null);
    rs.forEach(function(r) { r.weekAvg = avg; r.vsAvg = factRound(r.pf - avg); });
    weeks.push({
      season: rs[0].season, week: rs[0].week,
      phase: rs.every(function(r) { return r.phase === 'regular'; }) ? 'regular' : 'playoff',
      teams: n, avg: avg, median: median, high: hi.pf, highManager: hi.manager, low: lo.pf, lowManager: lo.manager,
      spread: factRound(hi.pf - lo.pf), combinedHigh: Math.max.apply(null, rs.map(function(r) { return r.combined; })),
    });
  });
  Object.keys(byGame).forEach(function(g) {
    const pair = byGame[g];
    pair.forEach(function(r) { const o = pair.find(function(x) { return x !== r; }); r.oppWeekRank = o ? o.weekRank : null; });
  });
  weeks.sort(function(a, b) { return a.season.localeCompare(b.season) || a.week - b.week; });
  Object.defineProperty(facts, '_derived', { value: { weeks: weeks }, enumerable: false });
  return facts._derived;
}

// One row per side of each trade (transactions.json: managerA/B, aReceives/bReceives).
function buildTradeRows(transactions) {
  const out = [];
  (Array.isArray(transactions) ? transactions : []).forEach(function(t, i) {
    const names = function(l) { return (l || []).map(function(p) { return p.name + (p.pos ? ' (' + p.pos + ')' : ''); }).join(', '); };
    const sides = [[t.managerA, t.managerB, t.aReceives, t.bReceives], [t.managerB, t.managerA, t.bReceives, t.aReceives]];
    sides.forEach(function(s) {
      out.push({ tradeId: 't' + i, season: String(t.season), week: t.week, manager: canonical(s[0]), partner: canonical(s[1]),
        received: names(s[2]), gave: names(s[3]), receivedCount: (s[2] || []).length, gaveCount: (s[3] || []).length });
    });
  });
  return out;
}

// col → [type, meaning]. type: mgr | num | int | cat | text
const CATALOG = {
  games: {
    about: 'one row per manager per game (two rows per game). unique:true keeps one row per game (the winner side).',
    cols: {
      manager: ['mgr', 'the manager'], opponent: ['mgr', 'their opponent'], pf: ['num', 'points scored'], pa: ['num', 'points conceded'],
      result: ['cat', 'W, L or T for the manager'], margin: ['num', 'pf minus pa'], combined: ['num', 'pf plus pa (the game total)'],
      season: ['cat', 'season year as a string, e.g. "2024"'], week: ['int', 'week number'], phase: ['cat', 'regular, playoff or consolation'],
      weekRank: ['int', '1 = top score of that regular-season week'], oppWeekRank: ['int', "the opponent's weekRank"],
      weekAvg: ['num', 'league average score that week'], vsAvg: ['num', 'pf minus weekAvg (above/below the league average)'],
      allPlayW: ['int', 'other scores beaten that week'], allPlayL: ['int', 'other scores lost to that week'], benchPts: ['num', 'points left on the bench'],
    },
    dims: ['manager', 'opponent', 'season', 'week', 'phase', 'result'],
    show: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'],
  },
  seasons: {
    about: 'one row per manager per season (final standings; the current season is in progress).',
    cols: {
      manager: ['mgr', 'the manager'], season: ['cat', 'season year'], rank: ['int', 'final standings rank'], wins: ['int', 'wins'], losses: ['int', 'losses'], ties: ['int', 'ties'],
      pf: ['num', 'regular-season points for'], pa: ['num', 'regular-season points against'], pfAvg: ['num', 'points per game'],
      expectedWins: ['num', 'all-play expected wins'], luck: ['num', 'wins minus expectedWins'], playoffFinish: ['cat', 'champion, runner-up, semi, consolation or missed'],
    },
    dims: ['manager', 'season', 'playoffFinish'],
    show: ['manager', 'season', 'rank', 'wins', 'losses', 'pf', 'pa', 'playoffFinish'],
  },
  weeks: {
    about: 'one row per league week: the whole league\'s scoring that week.',
    cols: {
      season: ['cat', 'season year'], week: ['int', 'week number'], phase: ['cat', 'regular or playoff'], teams: ['int', 'teams that scored'],
      avg: ['num', 'league average score'], median: ['num', 'median score'], high: ['num', 'top score'], highManager: ['mgr', 'who scored it'],
      low: ['num', 'lowest score'], lowManager: ['mgr', 'who scored it'], spread: ['num', 'high minus low'], combinedHigh: ['num', 'highest game total that week'],
    },
    dims: ['season', 'phase', 'highManager', 'lowManager'],
    show: ['season', 'week', 'avg', 'high', 'highManager', 'low', 'lowManager'],
  },
  players: {
    about: 'one row per player per manager per season (points while on that roster).',
    cols: {
      player: ['text', 'player name'], pos: ['cat', 'QB, RB, WR, TE, K or DEF'], manager: ['mgr', 'the manager'], season: ['cat', 'season year'],
      games: ['int', 'games started'], pts: ['num', 'points scored'], avg: ['num', 'points per game'], best: ['num', 'best single game'],
    },
    dims: ['manager', 'pos', 'season', 'player'],
    show: ['player', 'pos', 'manager', 'season', 'games', 'pts', 'avg', 'best'],
  },
  trades: {
    about: 'one row per side of each trade.',
    cols: {
      season: ['cat', 'season year'], week: ['int', 'week'], manager: ['mgr', 'the manager'], partner: ['mgr', 'who they traded with'],
      received: ['text', 'players received'], gave: ['text', 'players sent'], receivedCount: ['int', 'players received'], gaveCount: ['int', 'players sent'],
    },
    dims: ['manager', 'partner', 'season'],
    show: ['season', 'week', 'manager', 'partner', 'received', 'gave'],
  },
};

const AGGS = ['sum', 'avg', 'max', 'min'];
const AGG_LABEL = { sum: 'total', avg: 'avg', max: 'max', min: 'min' };
const FILTER_OPS = ['=', '!=', '>', '>=', '<', '<='];

// Label + display type for any column, including generic aggregates (pf_sum…).
function colMeta(c) {
  if (COLUMNS[c]) return COLUMNS[c];
  const m = /^([A-Za-z]+)_(sum|avg|max|min)$/.exec(String(c));
  if (m) {
    const base = COLUMNS[m[1]] || { label: m[1], type: 'pts' };
    const t = base.type === 'int' && m[2] !== 'avg' ? 'int' : 'pts';
    return { label: base.label + ' ' + AGG_LABEL[m[2]], type: t };
  }
  return { label: c, type: 'text' };
}

function numericCol(table, c) { const d = CATALOG[table] && CATALOG[table].cols[c]; return !!d && (d[0] === 'num' || d[0] === 'int'); }

// Plain-English scope of a spec, shown under every result table.
function describeScope(spec) {
  const w = spec.where || {};
  const parts = [];
  if (spec.table === 'games' || spec.table === 'weeks' || spec.table === 'record') {
    parts.push({ regular: 'Regular season', playoff: 'Playoffs', consolation: 'Consolation', all: 'All games' }[w.phase] || 'Regular season');
    if (spec.table !== 'weeks') parts.push(w.status === 'any' ? 'final + live' : w.status === 'live' ? 'live games' : 'final games');
  }
  if (spec.table === 'players' && w.positions) parts.push(w.positions.join('/'));
  parts.push(w.seasons ? w.seasons.join(', ') : 'all seasons');
  if (w.weeks) parts.push('week ' + w.weeks.join(', '));
  if (w.managers) parts.push(w.managers.map(function(h) { return distinctName(h); }).join(', '));
  if (w.opponents) parts.push('v ' + w.opponents.map(function(h) { return distinctName(h); }).join(', '));
  if (w.result) parts.push({ W: 'wins', L: 'losses', T: 'ties' }[w.result]);
  (w.filters || []).forEach(function(f) {
    parts.push(colMeta(f.col).label + ' ' + f.op + ' ' + (colMeta(f.col).type === 'mgr' ? distinctName(f.value) : f.value));
  });
  if (spec.unique) parts.push('one row per game');
  return parts.join(' · ');
}
