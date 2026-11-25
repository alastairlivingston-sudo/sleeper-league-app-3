
// ── Query engine v2 (Phase 2): code answers, the model only phrases ──────────
// PLAIN JS (no JSX): scripts/test-questions.js loads this exact file with `vm`.
// Flow for every Stats question (answerStatQuestion):
//   follow-up / dispute recipes → fastPlan recipe table → model planner (spec v3,
//   one repair retry; tables + columns from CATALOG in 18-tables.jsx)
//   → validateSpec (whitelist) → runQuery over the fact table → result table
//   (rendered by code) + ONE or TWO sentences: a JS template for single-row
//   results (no model call), else model narration passed through numberGuard.
// Non-negotiable: no number reaches the screen unless JS computed it.

// Which known managers does this query name? Matches distinct display names and
// first names (case-insensitive, word-boundary) → canonical handles, in the order
// they appear in the question.
function matchManagers(query) {
  const q = ' ' + String(query || '').toLowerCase() + ' ';
  const hits = [];
  Object.keys(NAMES).forEach(function(h) {
    const names = [distinctName(h), displayName(h), h];
    let at = -1;
    for (let i = 0; i < names.length && at === -1; i++) {
      const full = String(names[i] || '').toLowerCase();
      if (!full) continue;
      const candidates = [full].concat(full.split(' '));
      for (let j = 0; j < candidates.length; j++) {
        const w = candidates[j];
        if (w.length < 3) continue;
        // A bare first name shared by two managers (Benjy) is ambiguous — skip it.
        if (i === 1 && Object.keys(NAMES).filter(function(o) { return displayName(o).toLowerCase() === w; }).length > 1) continue;
        const m = new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "('s)?([^a-z]|$)").exec(q);
        if (m) { at = m.index; break; }
      }
    }
    if (at !== -1 && !hits.some(function(x) { return x.h === h; })) hits.push({ h: h, at: at });
  });
  hits.sort(function(a, b) { return a.at - b.at; });
  return hits.map(function(x) { return x.h; });
}

// Column metadata — drives the ResultTable (labels + number formatting) and the
// spec whitelist. type: mgr | pts | int | text | result | pct
const COLUMNS = {
  manager: { label: 'Manager', type: 'mgr' }, opponent: { label: 'Opponent', type: 'mgr' },
  pf: { label: 'PF', type: 'pts' }, pa: { label: 'PA', type: 'pts' }, result: { label: 'W/L', type: 'result' },
  margin: { label: 'Margin', type: 'pts' }, combined: { label: 'Total', type: 'pts' },
  season: { label: 'Season', type: 'int' }, week: { label: 'Wk', type: 'int' }, phase: { label: 'Phase', type: 'text' },
  weekRank: { label: 'Wk rank', type: 'int' }, benchPts: { label: 'Bench', type: 'pts' },
  wins: { label: 'W', type: 'int' }, losses: { label: 'L', type: 'int' }, ties: { label: 'T', type: 'int' },
  games: { label: 'GP', type: 'int' }, winPct: { label: 'Win%', type: 'pct' },
  pf_sum: { label: 'PF', type: 'pts' }, pf_avg: { label: 'Avg', type: 'pts' }, pf_max: { label: 'High', type: 'pts' },
  pf_min: { label: 'Low', type: 'pts' }, pa_sum: { label: 'PA', type: 'pts' }, pa_avg: { label: 'PA avg', type: 'pts' },
  margin_avg: { label: 'Avg margin', type: 'pts' }, topScoreWeeks: { label: 'Top wks', type: 'int' },
  rank: { label: 'Rank', type: 'int' }, pfAvg: { label: 'Avg', type: 'pts' }, expectedWins: { label: 'xW', type: 'pts' },
  luck: { label: 'Luck', type: 'pts' }, playoffFinish: { label: 'Finish', type: 'text' },
  player: { label: 'Player', type: 'text' }, pos: { label: 'Pos', type: 'text' }, pts: { label: 'Pts', type: 'pts' },
  avg: { label: 'Avg', type: 'pts' }, best: { label: 'Best', type: 'pts' },
  type: { label: 'Streak', type: 'text' }, length: { label: 'Len', type: 'int' }, count: { label: 'Count', type: 'int' },
  from: { label: 'From', type: 'text' }, to: { label: 'To', type: 'text' },
  weekAvg: { label: 'Wk avg', type: 'pts' }, vsAvg: { label: '+/− avg', type: 'pts' }, oppWeekRank: { label: 'Opp rank', type: 'int' },
  allPlayW: { label: 'AP W', type: 'int' }, allPlayL: { label: 'AP L', type: 'int' }, teams: { label: 'Teams', type: 'int' },
  median: { label: 'Median', type: 'pts' }, high: { label: 'High', type: 'pts' }, highManager: { label: 'Top scorer', type: 'mgr' },
  low: { label: 'Low', type: 'pts' }, lowManager: { label: 'Low scorer', type: 'mgr' }, spread: { label: 'Spread', type: 'pts' },
  combinedHigh: { label: 'Top total', type: 'pts' }, partner: { label: 'With', type: 'mgr' }, received: { label: 'Got', type: 'text' },
  gave: { label: 'Gave', type: 'text' }, receivedCount: { label: 'Got #', type: 'int' }, gaveCount: { label: 'Gave #', type: 'int' },
};

const SPEC_TABLES = ['games', 'seasons', 'players', 'record', 'weeks', 'trades'];
const SPEC_GROUPS = ['', 'manager', 'opponent', 'season', 'manager,season', 'week', 'manager,opponent'];
const SPEC_SELECT = ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg', 'pf_max', 'pf_min', 'pa_sum', 'pa_avg', 'margin_avg', 'topScoreWeeks'];
const GAME_COLS = ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'combined', 'season', 'week', 'phase', 'weekRank', 'benchPts'];
const SEASON_COLS = ['manager', 'season', 'rank', 'wins', 'losses', 'ties', 'pf', 'pa', 'pfAvg', 'expectedWins', 'luck', 'playoffFinish'];
const PLAYER_COLS = ['player', 'pos', 'manager', 'season', 'games', 'pts', 'avg', 'best'];

// Strict validation against whitelists. Returns { ok, spec } (normalised, with
// defaults) or { ok:false, error }. Unknown table/column/handle/record → rejected.
function validateSpec(raw, facts) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not an object' };
  if (raw.table === 'none' || raw.type === 'none') return { ok: false, error: 'none' };
  if (raw.v !== 2 && raw.v !== 3) return { ok: false, error: 'not a v2/v3 spec' };
  if (SPEC_TABLES.indexOf(raw.table) === -1) return { ok: false, error: 'unknown table ' + raw.table };
  const handles = Object.keys(NAMES);
  const seasonsKnown = {};
  ((facts && facts.seasons) || []).forEach(function(r) { seasonsKnown[r.season] = true; });
  const w = raw.where || {};
  const where = {};
  function handleList(key) {
    if (w[key] == null) return true;
    if (!Array.isArray(w[key])) return false;
    const out = [];
    for (let i = 0; i < w[key].length; i++) {
      const c = canonical(w[key][i]);
      if (handles.indexOf(c) === -1) return false;
      out.push(c);
    }
    if (out.length) where[key] = out;
    return true;
  }
  if (!handleList('managers')) return { ok: false, error: 'unknown manager' };
  if (!handleList('opponents')) return { ok: false, error: 'unknown opponent' };
  if (w.seasons != null) {
    if (!Array.isArray(w.seasons)) return { ok: false, error: 'seasons must be a list' };
    const ss = w.seasons.map(String);
    for (let i = 0; i < ss.length; i++) if (!seasonsKnown[ss[i]]) return { ok: false, error: 'unknown season ' + ss[i] };
    if (ss.length) where.seasons = ss;
  }
  if (w.weeks != null) {
    if (!Array.isArray(w.weeks) || w.weeks.some(function(x) { return !(Number(x) >= 1 && Number(x) <= 18); })) return { ok: false, error: 'bad weeks' };
    if (w.weeks.length) where.weeks = w.weeks.map(Number);
  }
  if (w.gameIds != null) {
    if (!Array.isArray(w.gameIds) || w.gameIds.some(function(g) { return !/^\d{4}-\d{1,2}-(m\d+|bye-[A-Za-z0-9_]+)$/.test(String(g)); })) return { ok: false, error: 'bad gameIds' };
    if (w.gameIds.length) where.gameIds = w.gameIds.map(String);
  }
  // Seasons may arrive as numbers from the planner ("2024" or 2024).
  where.phase = w.phase == null ? 'regular' : w.phase;
  if (['regular', 'playoff', 'consolation', 'all'].indexOf(where.phase) === -1) return { ok: false, error: 'bad phase' };
  if (w.result != null) { if (['W', 'L', 'T'].indexOf(w.result) === -1) return { ok: false, error: 'bad result' }; where.result = w.result; }
  where.status = w.status == null ? 'final' : w.status;
  if (['final', 'live', 'any'].indexOf(where.status) === -1) return { ok: false, error: 'bad status' };
  if (w.playoffFinish != null) {
    if (['champion', 'runner-up', 'semi', 'consolation', 'missed'].indexOf(w.playoffFinish) === -1) return { ok: false, error: 'bad finish' };
    where.playoffFinish = w.playoffFinish;
  }
  if (w.positions != null) {
    if (!Array.isArray(w.positions) || w.positions.some(function(p) { return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].indexOf(String(p).toUpperCase()) === -1; })) return { ok: false, error: 'bad positions' };
    if (w.positions.length) where.positions = w.positions.map(function(p) { return String(p).toUpperCase(); });
  }
  if (w.player != null) { if (typeof w.player !== 'string' || w.player.length > 40) return { ok: false, error: 'bad player' }; where.player = w.player; }

  const spec = { v: 2, table: raw.table, where: where };
  if (typeof raw._recipe === 'string' && /^[a-z-]+$/.test(raw._recipe)) spec.recipe = raw._recipe;
  if (raw.table === 'record') {
    if (RECORD_NAMES.indexOf(raw.record) === -1) return { ok: false, error: 'unknown record ' + raw.record };
    spec.record = raw.record;
    if (raw.top === true) spec.top = true; // ranked list ("top 10") instead of the record holder(s)
  }
  // v3: numeric/text filters on any catalog column of the table.
  const cat = CATALOG[raw.table];
  if (w.filters != null) {
    if (!cat || !Array.isArray(w.filters) || w.filters.length > 6) return { ok: false, error: 'bad filters' };
    const fs = [];
    for (let i = 0; i < w.filters.length; i++) {
      const f = w.filters[i] || {};
      const d = cat.cols[f.col];
      if (!d) return { ok: false, error: 'bad filter column ' + f.col };
      if (FILTER_OPS.indexOf(f.op) === -1) return { ok: false, error: 'bad filter op ' + f.op };
      let v = f.value;
      if (d[0] === 'num' || d[0] === 'int') { v = Number(v); if (!isFinite(v)) return { ok: false, error: 'filter on ' + f.col + ' needs a number' }; }
      else {
        if (f.op !== '=' && f.op !== '!=') return { ok: false, error: 'text filter ' + f.col + ' takes = or !=' };
        v = String(v);
        if (d[0] === 'mgr') { v = canonical(v); if (handles.indexOf(v) === -1) return { ok: false, error: 'unknown manager ' + f.value }; }
      }
      fs.push({ col: f.col, op: f.op, value: v });
    }
    if (fs.length) where.filters = fs;
  }
  if (raw.unique === true) { if (raw.table !== 'games') return { ok: false, error: 'unique only on games' }; spec.unique = true; }
  // groupBy: v2's fixed games groupings, or any 1–2 catalog dimensions of the table.
  const gbList = Array.isArray(raw.groupBy) ? raw.groupBy.map(String) : [];
  const gb = gbList.join(',');
  if (gbList.length) {
    if (raw.table === 'record') return { ok: false, error: 'no groupBy on records' };
    if (gbList.length > 2 || !cat || gbList.some(function(g) { return cat.dims.indexOf(g) === -1; })) {
      if (raw.table !== 'games' || SPEC_GROUPS.indexOf(gb) === -1) return { ok: false, error: 'bad groupBy ' + gb };
    }
  }
  spec.groupBy = gbList;
  // select: v2 names (games), "count", or <column>_<sum|avg|max|min> on a numeric column.
  const okSelect = function(c) {
    if (c === 'count') return true;
    if (raw.table === 'games' && SPEC_SELECT.indexOf(c) !== -1) return true;
    const m = /^([A-Za-z]+)_(sum|avg|max|min)$/.exec(String(c));
    return !!m && numericCol(raw.table, m[1]);
  };
  if (raw.select != null) {
    if (!Array.isArray(raw.select) || raw.select.length > 8 || raw.select.some(function(c) { return !okSelect(c); })) {
      const bad = Array.isArray(raw.select) ? raw.select.filter(function(c) { return !okSelect(c); }).join(', ') : 'not a list';
      return { ok: false, error: 'bad select ' + bad };
    }
  }
  spec.select = spec.groupBy.length ? ((raw.select && raw.select.length) ? raw.select.slice() : (raw.table === 'games' ? ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pf_avg'] : ['count'])) : [];
  if (raw.having != null) {
    if (!spec.groupBy.length || !Array.isArray(raw.having) || raw.having.length > 4) return { ok: false, error: 'bad having' };
    spec.having = [];
    for (let i = 0; i < raw.having.length; i++) {
      const h = raw.having[i] || {};
      if (spec.select.indexOf(h.col) === -1 || FILTER_OPS.indexOf(h.op) === -1 || !isFinite(Number(h.value))) return { ok: false, error: 'bad having ' + h.col };
      spec.having.push({ col: h.col, op: h.op, value: Number(h.value) });
    }
  }
  const allowedOrder = spec.groupBy.length ? spec.groupBy.concat(spec.select).concat(raw.table === 'games' ? SPEC_SELECT : [])
    : (cat ? Object.keys(cat.cols) : []);
  spec.orderBy = [];
  if (raw.orderBy != null) {
    if (!Array.isArray(raw.orderBy)) return { ok: false, error: 'orderBy must be a list' };
    for (let i = 0; i < raw.orderBy.length; i++) {
      const o = raw.orderBy[i] || {};
      if (allowedOrder.indexOf(o.col) === -1) return { ok: false, error: 'bad orderBy ' + o.col };
      if (o.dir != null && o.dir !== 'asc' && o.dir !== 'desc') return { ok: false, error: 'bad dir' };
      spec.orderBy.push({ col: o.col, dir: o.dir || 'desc' });
    }
  }
  const lim = raw.limit == null ? 10 : Number(raw.limit);
  if (!(lim >= 1 && lim <= 25)) return { ok: false, error: 'bad limit (1 to 25)' };
  spec.limit = Math.floor(lim);
  return { ok: true, spec: spec };
}

function qRound(n) { return Math.round(n * 100) / 100; }

function qSort(rows, orderBy) {
  if (!orderBy || !orderBy.length) return rows;
  return rows.slice().sort(function(x, y) {
    for (let i = 0; i < orderBy.length; i++) {
      const o = orderBy[i];
      const a = x[o.col], b = y[o.col];
      if (a === b) continue;
      if (a == null) return 1;
      if (b == null) return -1;
      const c = (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b));
      if (c !== 0) return o.dir === 'asc' ? c : -c;
    }
    return 0;
  });
}

function qGameFilter(spec, facts) {
  const w = spec.where;
  const ids = w.gameIds ? w.gameIds : null;
  return facts.games.filter(function(r) {
    if (ids) return ids.indexOf(r.gameId) !== -1;
    if (r.bye) return false;
    if (w.status !== 'any' && r.status !== w.status) return false;
    if (w.phase !== 'all' && r.phase !== w.phase) return false;
    if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
    if (w.opponents && w.opponents.indexOf(r.opponent) === -1) return false;
    if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
    if (w.weeks && w.weeks.indexOf(r.week) === -1) return false;
    if (w.result && r.result !== w.result) return false;
    return true;
  });
}

function qCmp(a, op, b) {
  switch (op) {
    case '=': return a === b; case '!=': return a !== b; case '>': return a > b;
    case '>=': return a >= b; case '<': return a < b; case '<=': return a <= b;
  }
  return false;
}
function qApplyFilters(rows, filters) {
  if (!filters || !filters.length) return rows;
  return rows.filter(function(r) {
    return filters.every(function(f) { const v = r[f.col]; return v != null && qCmp(typeof f.value === 'number' ? Number(v) : String(v), f.op, f.value); });
  });
}
// One row per game: the winner side (or the alphabetically first side of a tie).
function qUnique(rows) {
  return rows.filter(function(r) { return r.result === 'W' || (r.result !== 'L' && (!r.opponent || r.manager < r.opponent)); });
}

function qAggregate(rows, groupBy, select) {
  const groups = {};
  const order = [];
  rows.forEach(function(r) {
    const k = groupBy.map(function(g) { return r[g]; }).join('|');
    if (!groups[k]) { groups[k] = { key: {}, rows: [] }; groupBy.forEach(function(g) { groups[k].key[g] = r[g]; }); order.push(k); }
    groups[k].rows.push(r);
  });
  return order.map(function(k) {
    const g = groups[k];
    const rs = g.rows;
    const out = Object.assign({}, g.key);
    const pfs = rs.map(function(r) { return r.pf; });
    const w = rs.filter(function(r) { return r.result === 'W'; }).length;
    const l = rs.filter(function(r) { return r.result === 'L'; }).length;
    const t = rs.filter(function(r) { return r.result === 'T'; }).length;
    const sum = function(f) { return rs.reduce(function(s, r) { return s + (r[f] || 0); }, 0); };
    const all = {
      games: rs.length, wins: w, losses: l, ties: t,
      winPct: rs.length ? Math.round(w / rs.length * 1000) / 1000 : 0,
      pf_sum: qRound(sum('pf')), pf_avg: rs.length ? qRound(sum('pf') / rs.length) : 0,
      pf_max: pfs.length ? Math.max.apply(null, pfs) : 0, pf_min: pfs.length ? Math.min.apply(null, pfs) : 0,
      pa_sum: qRound(sum('pa')), pa_avg: rs.length ? qRound(sum('pa') / rs.length) : 0,
      margin_avg: rs.length ? qRound(sum('margin') / rs.length) : 0,
      topScoreWeeks: rs.filter(function(r) { return r.weekRank === 1; }).length,
      count: rs.length,
    };
    select.forEach(function(c) {
      if (c in all) { out[c] = all[c]; return; }
      const m = /^([A-Za-z]+)_(sum|avg|max|min)$/.exec(c);
      const vals = m ? rs.map(function(r) { return r[m[1]]; }).filter(function(v) { return typeof v === 'number' && isFinite(v); }) : [];
      if (!vals.length) { out[c] = null; return; }
      const tot = vals.reduce(function(t, v) { return t + v; }, 0);
      out[c] = m[2] === 'sum' ? qRound(tot) : m[2] === 'avg' ? qRound(tot / vals.length) : m[2] === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    });
    return out;
  });
}

// Executes a validated spec. Pure + deterministic.
// → { table, columns, rows, spec, total }
function runQuery(spec, facts, players, transactions) {
  const out = runQueryRaw(spec, facts, players, transactions);
  out.scope = describeScope(spec);
  return out;
}

// Columns for an ungrouped result: the table's display columns plus any column
// the spec filtered or sorted on, so the number that decided the answer is shown.
function qShowCols(table, spec, base) {
  const cols = (base || CATALOG[table].show).slice();
  const extra = [];
  (spec.orderBy || []).forEach(function(o) { extra.push(o.col); });
  ((spec.where && spec.where.filters) || []).forEach(function(f) { extra.push(f.col); });
  extra.forEach(function(c) {
    if (cols.indexOf(c) !== -1 || !CATALOG[table].cols[c]) return;
    const at = cols.indexOf('season');
    if (at === -1) cols.push(c); else cols.splice(at, 0, c);
  });
  return cols;
}

function qBaseRows(spec, facts, players, transactions) {
  const w = spec.where;
  if (spec.table === 'games') {
    ensureDerived(facts);
    let rows = qApplyFilters(qGameFilter(spec, facts), w.filters);
    return spec.unique ? qUnique(rows) : rows;
  }
  if (spec.table === 'seasons') {
    return qApplyFilters(facts.seasons.filter(function(r) {
      if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
      if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
      if (w.playoffFinish && r.playoffFinish !== w.playoffFinish) return false;
      return true;
    }), w.filters);
  }
  if (spec.table === 'weeks') {
    return qApplyFilters(ensureDerived(facts).weeks.filter(function(r) {
      if (w.phase !== 'all' && r.phase !== (w.phase === 'consolation' ? 'playoff' : w.phase)) return false;
      if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
      if (w.weeks && w.weeks.indexOf(r.week) === -1) return false;
      if (w.managers && w.managers.indexOf(r.highManager) === -1 && w.managers.indexOf(r.lowManager) === -1) return false;
      return true;
    }), w.filters);
  }
  if (spec.table === 'trades') {
    const oneSide = !w.managers && !w.opponents && !spec.groupBy.length;
    const seen = {};
    return qApplyFilters(buildTradeRows(transactions).filter(function(r) {
      if (oneSide) { if (seen[r.tradeId]) return false; seen[r.tradeId] = true; }
      if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
      if (w.opponents && w.opponents.indexOf(r.partner) === -1) return false;
      if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
      return true;
    }), w.filters);
  }
  if (spec.table === 'players') {
    const needle = w.player ? w.player.toLowerCase() : null;
    const by = (spec.orderBy[0] && spec.orderBy[0].col) || 'pts';
    const minGames = by === 'avg' && !spec.groupBy.length ? 4 : 1;
    return qApplyFilters((players || []).filter(function(r) {
      if (needle && String(r.player).toLowerCase().indexOf(needle) === -1) return false;
      if (w.positions && w.positions.indexOf(r.pos) === -1) return false;
      if (w.managers && w.managers.indexOf(canonical(r.manager)) === -1) return false;
      if (w.seasons && w.seasons.indexOf(String(r.season)) === -1) return false;
      return r.games >= minGames;
    }).map(function(r) { return Object.assign({}, r, { manager: canonical(r.manager), season: String(r.season) }); }), w.filters);
  }
  return [];
}

const DEFAULT_ORDER = {
  games: [{ col: 'season', dir: 'desc' }, { col: 'week', dir: 'desc' }, { col: 'pf', dir: 'desc' }],
  seasons: [{ col: 'season', dir: 'desc' }, { col: 'rank', dir: 'asc' }],
  weeks: [{ col: 'season', dir: 'desc' }, { col: 'week', dir: 'desc' }],
  players: [{ col: 'pts', dir: 'desc' }],
  trades: [{ col: 'season', dir: 'desc' }, { col: 'week', dir: 'desc' }],
};

// Executes a validated spec. Pure + deterministic.
// → { table, columns, rows, spec, total, scope }
function runQueryRaw(spec, facts, players, transactions) {
  const w = spec.where;
  if (spec.table !== 'record') {
    let rows = qBaseRows(spec, facts, players, transactions);
    if (spec.groupBy.length) {
      rows = qAggregate(rows, spec.groupBy, spec.select);
      (spec.having || []).forEach(function(h) { rows = rows.filter(function(r) { return r[h.col] != null && qCmp(r[h.col], h.op, h.value); }); });
      const legacy = spec.table === 'games' && spec.select.indexOf('wins') !== -1 && spec.select.indexOf('pf_sum') !== -1;
      const dflt = legacy ? [{ col: 'wins', dir: 'desc' }, { col: 'pf_sum', dir: 'desc' }] : [{ col: spec.select[0], dir: 'desc' }];
      rows = qSort(rows, spec.orderBy.length ? spec.orderBy : dflt);
      return { table: spec.table, columns: spec.groupBy.concat(spec.select), rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
    }
    rows = qSort(rows, spec.orderBy.length ? spec.orderBy : DEFAULT_ORDER[spec.table]);
    const cols = spec.table === 'players' ? qShowCols('players', spec, PLAYER_COLS) : qShowCols(spec.table, spec);
    return { table: spec.table, columns: cols, rows: rows.slice(0, spec.limit), total: rows.length, spec: spec };
  }
  if (spec.table === 'record') {
    const scope = w.phase === 'all' ? 'all' : 'regular';
    const name = spec.record;
    if (name === 'bestSeasonPF' || name === 'worstSeasonPF') {
      const pool = facts.seasons.filter(function(r) {
        if (!r.complete && !(w.seasons && w.seasons.indexOf(r.season) !== -1)) return false;
        if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
        if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
        return true;
      });
      const rows = factBest(pool, function(r) { return r.pf; }, name === 'bestSeasonPF' ? 'max' : 'min');
      return { table: 'record', record: name, columns: ['manager', 'season', 'pf', 'wins', 'losses'], rows: rows, total: rows.length, spec: spec };
    }
    // Game records recompute over the filtered rows with the SAME code that built
    // facts.records, so "X's best week" or "the 2024 closest game" stay one path.
    const sub = facts.games.filter(function(r) {
      if (w.managers && w.managers.indexOf(r.manager) === -1) return false;
      if (w.seasons && w.seasons.indexOf(r.season) === -1) return false;
      return true;
    });
    const rec = spec.top ? factGameRanked(sub, scope, name).slice(0, spec.limit) : (factGameRecords(sub, scope)[name] || []);
    const recTotal = spec.top ? factGameRanked(sub, scope, name).length : rec.length;
    if (name === 'longestWinStreak' || name === 'longestLossStreak' || name === 'currentStreaks') {
      const rows = rec.map(function(x) { return { manager: x.manager, type: x.type, length: x.length, from: x.from.season + ' wk' + x.from.week, to: x.to.season + ' wk' + x.to.week }; });
      return { table: 'record', record: name, top: !!spec.top, columns: ['manager', 'type', 'length', 'from', 'to'], rows: rows.slice(0, name === 'currentStreaks' ? 25 : spec.limit), total: recTotal, spec: spec };
    }
    if (name === 'mostTopScoreWeeks' || name === 'mostBottomScoreWeeks') {
      return { table: 'record', record: name, top: !!spec.top, columns: ['manager', 'count'], rows: rec, total: recTotal, spec: spec };
    }
    const cols = (name === 'highestCombined' || name === 'lowestCombined')
      ? ['manager', 'pf', 'opponent', 'pa', 'combined', 'result', 'season', 'week', 'phase']
      : ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'];
    return { table: 'record', record: name, top: !!spec.top, columns: cols, rows: rec, total: recTotal, spec: spec };
  }
  return { table: spec.table, columns: [], rows: [], total: 0, spec: spec };
}

// ── Formatting helpers (shared by templates, ResultTable and the guard) ──────
function fmt2(n) { return n == null ? '' : (Math.round(Number(n) * 100) / 100).toFixed(2); }
function nm(h) { return h ? distinctName(h) : '—'; }
function wkLabel(r) { return r.season + ' week ' + r.week; }

const RECORD_LABELS = {
  highestScore: 'Highest score', lowestScore: 'Lowest score', highestScoreInLoss: 'Most points in a loss',
  lowestScoreInWin: 'Fewest points in a win', biggestMargin: 'Biggest margin', closestGame: 'Closest game',
  highestCombined: 'Highest combined score', lowestCombined: 'Lowest combined score', bestSeasonPF: 'Best season PF',
  worstSeasonPF: 'Worst season PF', longestWinStreak: 'Longest win streak', longestLossStreak: 'Longest losing streak',
  currentStreaks: 'Current streaks', mostTopScoreWeeks: 'Most top-score weeks', mostBottomScoreWeeks: 'Most bottom-score weeks',
  unluckiestLoss: 'Unluckiest loss', luckiestWin: 'Luckiest win',
};

// JS-written sentence for a result — used directly for single-row recipe answers
// (no model call) and as the fallback whenever the number guard rejects narration.
function templateSentence(spec, result, ctx) {
  const rows = (result && result.rows) || [];
  if (!rows.length) return 'Nothing in the data matches that.';
  const r = rows[0];
  const tie = rows.length > 1 ? ' (tied — ' + rows.length + ' share it)' : '';
  if (result.table === 'record' && result.top && rows.length > 1) {
    const label = RECORD_LABELS[result.record] || 'Record';
    const lead = (function() {
      switch (result.record) {
        case 'highestCombined': case 'lowestCombined': return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' (' + wkLabel(r) + ', ' + fmt2(r.combined) + ' combined)';
        case 'biggestMargin': case 'closestGame': return nm(r.manager) + ' over ' + nm(r.opponent) + ' by ' + fmt2(Math.abs(r.margin)) + ' (' + wkLabel(r) + ')';
        case 'longestWinStreak': case 'longestLossStreak': return nm(r.manager) + ' with ' + r.length + ' (' + r.from + ' to ' + r.to + ')';
        case 'currentStreaks': return nm(r.manager) + ' with ' + r.length;
        case 'mostTopScoreWeeks': case 'mostBottomScoreWeeks': return nm(r.manager) + ' with ' + r.count;
        default: return nm(r.manager) + ' with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + wkLabel(r) + ')';
      }
    })();
    return 'Top ' + rows.length + ' — ' + label.toLowerCase() + (spec.where.seasons ? ' (' + spec.where.seasons.join(', ') + ')' : '') + (spec.where.phase === 'all' ? ', all games' : ', regular season') + '. ' + lead + ' leads.';
  }
  if (result.table === 'record') {
    switch (result.record) {
      case 'highestScoreInLoss': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' and still lost — ' + nm(r.opponent) + ' put up ' + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
      case 'lowestScoreInWin': return nm(r.manager) + ' won with just ' + fmt2(r.pf) + ', beating ' + nm(r.opponent) + "'s " + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
      case 'highestScore': return nm(r.manager) + ' holds it with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
      case 'lowestScore': return nm(r.manager) + "'s " + fmt2(r.pf) + ' against ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + ' is the low mark.' + tie;
      case 'biggestMargin': return nm(r.manager) + ' beat ' + nm(r.opponent) + ' by ' + fmt2(r.margin) + ' (' + fmt2(r.pf) + '–' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
      case 'closestGame': return nm(r.manager) + ' edged ' + nm(r.opponent) + ' ' + fmt2(r.pf) + '–' + fmt2(r.pa) + ', a ' + fmt2(Math.abs(r.margin)) + ' margin, in ' + wkLabel(r) + '.' + tie;
      case 'highestCombined':
      case 'lowestCombined': return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' in ' + wkLabel(r) + ': ' + fmt2(r.pf + r.pa) + ' combined.' + tie;
      case 'unluckiestLoss': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' — rank ' + r.weekRank + ' that week — and still lost to ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ') in ' + wkLabel(r) + '.' + tie;
      case 'luckiestWin': return nm(r.manager) + ' won with ' + fmt2(r.pf) + ' — rank ' + r.weekRank + ' that week — because ' + nm(r.opponent) + ' managed ' + fmt2(r.pa) + ' in ' + wkLabel(r) + '.' + tie;
      case 'bestSeasonPF':
      case 'worstSeasonPF': return nm(r.manager) + ' scored ' + fmt2(r.pf) + ' over the ' + r.season + ' regular season.' + tie;
      case 'longestWinStreak':
      case 'longestLossStreak': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ': ' + r.length + ' straight ' + (r.type === 'W' ? 'wins' : 'losses') + ' (' + r.from + ' to ' + r.to + ').';
      case 'currentStreaks': return nm(r.manager) + ' has the longest current run: ' + r.length + ' ' + (r.type === 'W' ? 'straight wins' : r.type === 'L' ? 'straight losses' : 'ties') + '.';
      case 'mostTopScoreWeeks': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ' topped the weekly scoring ' + r.count + ' times.';
      case 'mostBottomScoreWeeks': return rows.map(function(x) { return nm(x.manager); }).join(' and ') + ' finished bottom of the weekly scoring ' + r.count + ' times.';
    }
  }
  const w = spec.where || {};
  if (result.table === 'games' && w.gameIds && rows.length === 2 && !r.bye) {
    const win = rows[0].result === 'W' ? rows[0] : rows[1].result === 'W' ? rows[1] : null;
    const lose = win === rows[0] ? rows[1] : rows[0];
    const total = fmt2(rows[0].pf + rows[1].pf);
    if (!win) return nm(rows[0].manager) + ' and ' + nm(rows[1].manager) + ' tied ' + fmt2(rows[0].pf) + '–' + fmt2(rows[1].pf) + ' in ' + wkLabel(r) + ' (' + total + ' total).';
    return nm(win.manager) + ' ' + fmt2(win.pf) + ' – ' + fmt2(lose.pf) + ' ' + nm(lose.manager) + ' in ' + wkLabel(r) + ': ' + total + ' total points. ' + nm(win.manager) + ' won.';
  }
  if (result.table === 'games' && spec.groupBy.join(',') === 'manager,opponent' && rows.length === 1 && r.wins != null) {
    return nm(r.manager) + ' is ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + ' against ' + nm(r.opponent) + (w.phase === 'all' ? ' (all games)' : ' in the regular season') + (w.seasons ? ' (' + w.seasons.join(', ') + ')' : '') + '.';
  }
  if (result.table === 'games' && spec.groupBy.join(',') === 'manager' && rows.length === 1 && r.wins != null && r.pf_sum != null) {
    return nm(r.manager) + ' is ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + (w.seasons ? ' in ' + w.seasons.join(', ') : ' all-time') + (w.phase === 'all' ? ' (all games)' : ' in the regular season') + ', ' + fmt2(r.pf_sum) + ' points for.';
  }
  if (result.table === 'seasons' && rows.length === 1) {
    if (w.playoffFinish === 'champion') return nm(r.manager) + ' won the ' + r.season + ' title.';
    return nm(r.manager) + ' went ' + r.wins + '–' + r.losses + (r.ties ? '–' + r.ties : '') + ' in ' + r.season + ', finishing rank ' + r.rank + ' with ' + fmt2(r.pf) + ' points' + (r.playoffFinish ? ' (' + r.playoffFinish + ')' : '') + '.';
  }
  if (result.table === 'seasons' && w.playoffFinish === 'champion' && !rows.length) return 'That season has no champion yet.';
  if (spec.recipe === 'upset' && rows.length === 1) {
    return nm(r.manager) + ' pulled the upset of ' + wkLabel(r) + ': ' + fmt2(r.pf) + (r.weekRank ? ' (rank ' + r.weekRank + ' that week)' : '') + ' was enough to beat ' + nm(r.opponent) + ' (' + fmt2(r.pa) + ').';
  }
  if (spec.recipe === 'week-top' && rows.length === 1) {
    return nm(r.manager) + ' topped ' + wkLabel(r) + ' with ' + fmt2(r.pf) + ' against ' + nm(r.opponent) + '.';
  }
  if (result.table === 'games' && !spec.groupBy.length && rows.length === 1) {
    return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' in ' + wkLabel(r) + ' (' + (r.result === 'W' ? 'won' : r.result === 'L' ? 'lost' : r.result === 'T' ? 'tied' : 'in progress') + ').';
  }
  const ls = listSentence(spec, result);
  if (ls) return ls;
  if (ctx && ctx.title) return ctx.title + '.';
  return 'Here is what the data shows.';
}

// ── v3 answers: a JS sentence for any multi-row / grouped / filtered result ──
function fmtVal(c, v) {
  if (v == null) return '—';
  const t = colMeta(c).type;
  if (t === 'mgr') return nm(v);
  if (t === 'pts') return fmt2(v);
  return String(v);
}
// The headline column of a result: what it was sorted on (else the first metric).
function metricCol(spec, result) {
  const o = spec.orderBy && spec.orderBy[0] && spec.orderBy[0].col;
  if (o && spec.groupBy.indexOf(o) === -1) return o;
  if (spec.groupBy.length) return spec.select[0];
  return o || { games: 'pf', weeks: 'avg', players: 'pts', seasons: 'pf', trades: null }[result.table];
}
function rowLabel(spec, result, r) {
  if (spec.groupBy.length) return spec.groupBy.map(function(g) { return fmtVal(g, r[g]); }).join(' ');
  switch (result.table) {
    case 'games': return nm(r.manager) + ' ' + fmt2(r.pf) + ' v ' + nm(r.opponent) + ' ' + fmt2(r.pa) + ' (' + r.season + ' wk ' + r.week + ')';
    case 'weeks': return r.season + ' week ' + r.week;
    case 'players': return r.player + ' (' + r.pos + ', ' + nm(r.manager) + ', ' + r.season + ')';
    case 'seasons': return nm(r.manager) + ' ' + r.season;
    case 'trades': return nm(r.manager) + ' got ' + (r.received || 'nothing') + ' from ' + nm(r.partner) + ' (' + r.season + ' wk ' + r.week + ')';
  }
  return '';
}
function listSentence(spec, result) {
  const rows = result.rows || [];
  if (!rows.length || result.table === 'record') return null;
  const m = metricCol(spec, result);
  const label = m ? colMeta(m).label : '';
  const chrono = m === 'season' || m === 'week' || (!m && result.table === 'trades');
  const val = function(r) {
    if (!m || chrono) return '';
    if (!spec.groupBy.length && result.table === 'games' && (m === 'pf' || m === 'pa')) return '';
    return (spec.groupBy.length ? '' : label + ' ') + fmtVal(m, r[m]);
  };
  const filtered = (spec.where.filters && spec.where.filters.length) || spec.unique;
  const noun = { games: spec.unique ? ['game', 'games'] : ['result', 'results'], weeks: ['week', 'weeks'], players: ['player', 'players'], seasons: ['season', 'seasons'], trades: ['trade side', 'trade sides'] }[result.table] || ['row', 'rows'];
  const lead = filtered && !spec.groupBy.length ? result.total + ' ' + noun[result.total === 1 ? 0 : 1] + ' match (' + result.scope + '). ' : '';
  const countOnly = spec.groupBy.length && m === 'count';
  const countNoun = { games: 'games', seasons: 'seasons', weeks: 'weeks', players: 'players', trades: 'trades' }[result.table];
  if (rows.length === 1) {
    const v = val(rows[0]);
    if (countOnly && spec.select.length === 1) return rowLabel(spec, result, rows[0]) + ': ' + rows[0].count + ' ' + (rows[0].count === 1 ? countNoun.replace(/s$/, '') : countNoun) + ' (' + result.scope + ').';
    if (spec.groupBy.length) return lead + rowLabel(spec, result, rows[0]) + ': ' + spec.select.map(function(c) { return colMeta(c).label + ' ' + fmtVal(c, rows[0][c]); }).join(', ') + ' (' + result.scope + ').';
    return lead + rowLabel(spec, result, rows[0]) + (v ? ' — ' + v : '') + '.';
  }
  const first = rows[0];
  const rest = rows.slice(1, 3).map(function(r) { const v = val(r); return rowLabel(spec, result, r) + (v ? ' (' + v.replace(label + ' ', '') + ')' : ''); });
  if (spec.groupBy.length) {
    return lead + rowLabel(spec, result, first) + ' leads' + (countOnly ? '' : ' on ' + label) + ' with ' + fmtVal(m, first[m]) + (countOnly ? ' ' + countNoun : '') + '; then ' + rest.join(' and ') + '.';
  }
  if (chrono) return lead + 'Most recent: ' + rowLabel(spec, result, first) + '.';
  const v = val(first);
  return lead + rowLabel(spec, result, first) + (v ? ' — ' + v : '') + ' tops the list; then ' + rest.join(' and ') + '.';
}

// Numbers JS derives for the narrator (and lets through the guard): the gap
// between #1 and #2 and the average of the shown rows, on the headline column.
function derivedFacts(spec, result) {
  const rows = (result && result.rows) || [];
  const m = metricCol(spec, result);
  const out = [];
  if (!m || rows.length < 2 || typeof rows[0][m] !== 'number') return out;
  const vals = rows.map(function(r) { return r[m]; }).filter(function(v) { return typeof v === 'number'; });
  out.push({ label: 'gap between #1 and #2 on ' + colMeta(m).label, value: qRound(Math.abs(vals[0] - vals[1])) });
  out.push({ label: 'average ' + colMeta(m).label + ' of the shown rows', value: qRound(vals.reduce(function(t, v) { return t + v; }, 0) / vals.length) });
  out.push({ label: 'rows matching', value: result.total });
  return out;
}

// ── Number guard (cause E) ────────────────────────────────────────────────────
// Every number in a model sentence must be in the result rows (2 dp, or its 1 dp /
// integer form), a season or week in the rows, or an integer ≤ 20 that appears in
// the rows as a count/rank. Anything else → the sentence is rejected.
function guardAllowed(rows, extra) {
  const nums = [];
  function add(v) {
    if (typeof v === 'number' && isFinite(v)) nums.push(v);
    else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) nums.push(Number(v));
    else if (typeof v === 'string') { const m = v.match(/\d+(\.\d+)?/g); if (m) m.forEach(function(x) { nums.push(Number(x)); }); }
    else if (v && typeof v === 'object') Object.keys(v).forEach(function(k) { add(v[k]); });
  }
  (rows || []).forEach(add);
  (extra || []).forEach(add);
  // Derived pair figures the narrator may legitimately state (game total, gap).
  (rows || []).forEach(function(r) { if (typeof r.pf === 'number' && typeof r.pa === 'number') { nums.push(qRound(r.pf + r.pa)); nums.push(qRound(Math.abs(r.pf - r.pa))); } });
  return nums;
}
function numberGuard(sentence, rows, extra) {
  const allowed = guardAllowed(rows, extra);
  // Drop thousands separators, then take standalone numbers (not parts of handles
  // like "joshjr11" or ordinals like "3rd"). No lookbehind: older Safari lacks it.
  const text = String(sentence || '').replace(/(\d),(?=\d{3}\b)/g, '$1');
  const found = [];
  const re = /(^|[^A-Za-z0-9.])(\d+(?:\.\d+)?)(?![A-Za-z0-9])/g;
  let mm;
  while ((mm = re.exec(text)) !== null) found.push(mm[2]);
  const bad = [];
  found.forEach(function(tok) {
    const n = Number(tok);
    const dp = (tok.split('.')[1] || '').length;
    const okNum = allowed.some(function(v) {
      const a = Math.abs(v);
      if (dp >= 2) return Math.abs(Math.round(a * 100) / 100 - n) < 1e-9;
      if (dp === 1) return Math.abs(Math.round(a * 10) / 10 - n) < 1e-9;
      return a === n || (Number.isInteger(a) && a === n);
    });
    if (!okNum) bad.push(tok);
  });
  return { ok: bad.length === 0, bad: bad };
}

// ── Recipes: regex → spec, no model call ─────────────────────────────────────
const NUMERIC_HINT = /\b(most|highest|lowest|fewest|least|record|how many|points?|pts|average|avg|score[ds]?|scoring|wins?|won|loss(es)?|lost|streaks?|best|worst|margin|blowout|closest|standings|rank(ed|ing)?|total|biggest|largest|smallest)\b|\d/i;
const PLAYOFF_HINT = /\b(playoffs?|post-?season|including playoffs|all games)\b/i;
const DISPUTE_HINT = /\b(how could|how can|how did .* (lose|win)|that'?s wrong|that is wrong|are you sure|that can'?t be|not true|incorrect|wrong|fabricat\w*|made (that|it) up|really\?|\b(had|has|have|got|scored|put up) (a |an |one )?(bigger|higher|better|lower|closer|larger|tighter|more)\b|^\W*no[,.!\s]+\w+ (had|has|got|scored|was))/i;
// A fresh ranking question ("biggest combined score") must not be read as a
// follow-up about the previous answer's game just because it says "combined".
const RANKING_HINT = /\b(highest|lowest|biggest|largest|smallest|most|fewest|least|best|worst|top|record|ever|all[- ]time|in history|of all time|any(one|body)?)\b/i;
// "top 10", "top ten", "10 highest", "the 5 biggest" → N (1..25).
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25 };
function topN(query) {
  const q = String(query || '').toLowerCase();
  let m = q.match(/\btop[- ]?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\b/) ||
    q.match(/\b(\d{1,2}|three|four|five|six|seven|eight|nine|ten|fifteen|twenty) (highest|lowest|biggest|largest|best|worst|most|closest|longest|smallest)\b/);
  if (!m) return /\b(list|rank(ed|ing)?|leaderboard|show (me )?(more|all|the rest))\b/.test(q) ? 10 : null;
  const n = NUM_WORDS[m[1]] || Number(m[1]);
  return n >= 1 ? Math.min(25, n) : null;
}
const FOLLOW_GAME_HINT = /\b(total (game )?score|game total|combined( score)?|that game|the game|final score|who won (it|that|the game)|what was the score|full score|both scores)\b/i;

function recipeSpec(table, where, extra) {
  return Object.assign({ v: 2, table: table, where: Object.assign({}, where || {}) }, extra || {});
}

// Each recipe: test(q, info) → spec | null. First hit wins. `info` carries the
// managers named, years named, and the current season.
// Threshold counts: "scored over 150", "150+ games", "combined over 300", "won by more than 50".
function thresholdRecipe(i, q) {
  const m = q.match(/\b(over|above|more than|at least|under|below|less than|fewer than)\s+(\d{2,3}(?:\.\d+)?)\b/i) || q.match(/\b(\d{2,3})\s?\+/);
  if (!m) return null;
  const n = Number(m.length > 2 ? m[2] : m[1]);
  const word = m.length > 2 ? m[1].toLowerCase() : 'at least';
  const op = { over: '>', above: '>', 'more than': '>', 'at least': '>=', under: '<', below: '<', 'less than': '<', 'fewer than': '<' }[word];
  const col = /\b(combined|game total|both teams|total (points|score) in a game)\b/i.test(q) ? 'combined' : /\b(margin|win(s|ning)? by|won by|lost by|beat \w+ by|by more than|by over)\b/i.test(q) ? 'margin' : 'pf';
  if (col === 'pf' && n < 50) return null;
  const where = Object.assign({}, i.where, { filters: [{ col: col, op: op, value: n }] });
  if (col === 'margin') where.result = 'W';
  else if (/\b(lost|loss|losses|losing)\b/i.test(q)) where.result = 'L';
  else if (/\b(won|wins?|winning)\b/i.test(q)) where.result = 'W';
  if (col === 'combined') return recipeSpec('games', where, { unique: true, orderBy: [{ col: 'combined', dir: op[0] === '<' ? 'asc' : 'desc' }], limit: 10 });
  return recipeSpec('games', where, { groupBy: ['manager'], select: ['count'], orderBy: [{ col: 'count', dir: 'desc' }], limit: 10 });
}
// "points against Josh" (opponent) vs "most points against" (conceded).
function againstRecipe(i, q) {
  const tail = q.split(/\bagainst\b/i)[1] || '';
  const opp = matchManagers(tail);
  if (opp.length === 1) {
    const where = Object.assign({}, i.where, { opponents: opp });
    if (where.managers && where.managers[0] === opp[0]) delete where.managers;
    return recipeSpec('games', where, { groupBy: ['manager'], select: ['games', 'pf_sum', 'pf_avg', 'wins', 'losses'], orderBy: [{ col: 'pf_sum', dir: 'desc' }], limit: 10 });
  }
  return recipeSpec('games', i.where, { groupBy: ['manager'], select: ['games', 'pa_sum', 'pa_avg'], orderBy: [{ col: 'pa_sum', dir: /\b(fewest|least|lowest|easiest)\b/i.test(q) ? 'asc' : 'desc' }], limit: 10 });
}
function weeksRecipe(i, q) {
  const where = Object.assign({}, i.where);
  delete where.managers;
  if (/\b(this|last) week\b/i.test(q)) { where.seasons = [i.cur.season]; where.weeks = [i.cur.lastFinalWeek]; }
  if (/\b(by|per|each|every) (season|year)\b/i.test(q)) {
    return recipeSpec('weeks', where, { groupBy: ['season'], select: ['avg_avg', 'high_max', 'low_min'], orderBy: [{ col: 'avg_avg', dir: 'desc' }] });
  }
  const low = /\b(lowest|worst|fewest|least|low)\b/i.test(q);
  const col = /\b(spread|gap|range)\b/i.test(q) ? 'spread' : /\b(top|high) scor(e|er)\b/i.test(q) ? 'high' : 'avg';
  return recipeSpec('weeks', where, { orderBy: [{ col: col, dir: low ? 'asc' : 'desc' }], limit: 5 });
}

const RECIPES = [
  { id: 'threshold', re: /\b(over|above|more than|at least|under|below|less than|fewer than)\s+\d{2,3}\b|\b\d{2,3}\s?\+/i, not: /\b(average|avg)\b/i, make: thresholdRecipe },
  { id: 'vs-avg-points', re: /\b(points|pts) (above|over|better than) (the )?(league |weekly )?(average|avg)\b|\bbest (relative to|against|vs\.?) (the )?average\b/i, make: function(i) { return recipeSpec('games', i.where, { groupBy: ['manager'], select: ['vsAvg_sum', 'vsAvg_avg', 'games'], orderBy: [{ col: 'vsAvg_sum', dir: 'desc' }] }); } },
  { id: 'vs-avg', re: /\b(above|beat(s|en|ing)?|over|better than|higher than|outscor\w*|below|under|worse than) (the )?(league |weekly |week'?s )?(average|avg)\b/i, make: function(i, q) {
    const below = /\b(below|under|worse than)\b/i.test(q);
    return recipeSpec('games', Object.assign({}, i.where, { filters: [{ col: 'vsAvg', op: below ? '<' : '>', value: 0 }] }), { groupBy: ['manager'], select: ['count', 'vsAvg_avg'], orderBy: [{ col: 'count', dir: 'desc' }] });
  } },
  { id: 'league-weeks', need: 'noMgr', re: /\b(league|weekly)[- ](average|avg|high|low|scoring)\b|\b(highest|lowest|best|worst)[- ]scoring weeks?\b|\b(whole|entire) league\b|\bleague[- ]wide\b|\baverage (score|points) (per|each|a) week\b/i, make: weeksRecipe },
  { id: 'points-against', re: /\bpoints (scored )?against\b|\bmost pa\b|\b(toughest|hardest|easiest|unluckiest) schedule\b|\bconceded\b/i, make: againstRecipe },
  { id: 'all-play', re: /\ball[- ]play\b/i, make: function(i) { return recipeSpec('games', i.where, { groupBy: ['manager'], select: ['allPlayW_sum', 'allPlayL_sum', 'wins', 'losses'], orderBy: [{ col: 'allPlayW_sum', dir: 'desc' }] }); } },
  { id: 'titles', re: /\b(how many|most) (titles|championships|chips|rings|trophies)\b|\btitles? (count|tally)\b|\bchampionships? (by|per) manager\b/i, make: function(i) { return recipeSpec('seasons', { managers: i.where.managers, playoffFinish: 'champion' }, { groupBy: ['manager'], select: ['count'], orderBy: [{ col: 'count', dir: 'desc' }] }); } },
  { id: 'playoff-apps', re: /\bplayoff (appearances|berths|trips)\b|\b(made|reached) the playoffs\b|\bmost playoffs\b/i, make: function(i) {
    return recipeSpec('seasons', { managers: i.where.managers, filters: [{ col: 'playoffFinish', op: '!=', value: 'missed' }] }, { groupBy: ['manager'], select: ['count'], orderBy: [{ col: 'count', dir: 'desc' }] });
  } },
  { id: 'top-score-list', need: 'oneMgr', re: /\b(which|what) weeks?\b.*\b(top[- ]scor\w*|highest score|top of the week)\b|\btop[- ]scor(ed|er) weeks?\b/i, make: function(i) {
    return recipeSpec('games', Object.assign({}, i.where, { filters: [{ col: 'weekRank', op: '=', value: 1 }] }), { orderBy: [{ col: 'season', dir: 'desc' }, { col: 'week', dir: 'desc' }], limit: 25 });
  } },
  { id: 'trades', need: 'any', re: /\btrades?\b|\btraded\b|\btrade (history|partners?)\b/i, not: /\btrade (value|verdict|calculator)\b|\bshould i\b/i, make: function(i, q) {
    const where = { seasons: i.where.seasons };
    if (i.mgrs.length) where.managers = [i.mgrs[0]];
    if (i.mgrs.length > 1) where.opponents = [i.mgrs[1]];
    if (/\b(most|how many|count|number of)\b/i.test(q)) return recipeSpec('trades', where, { groupBy: /\bwith|partner/i.test(q) && i.mgrs.length === 1 ? ['partner'] : ['manager'], select: ['count', 'receivedCount_sum'], orderBy: [{ col: 'count', dir: 'desc' }] });
    return recipeSpec('trades', where, { limit: 10 });
  } },
  { id: 'inLoss-high', re: /\b(most|highest|biggest|max(imum)?|best)\b.*\b(loss|losing|lost|defeat)\b|\b(scored|score) .*\b(still|and) (lost|lose)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestScoreInLoss' }); } },
  { id: 'inLoss-low', re: /\b(lowest|fewest|least|worst)\b.*\b(loss|losing|lost|defeat)\b/i, make: function(i) { return recipeSpec('games', Object.assign({ result: 'L' }, i.where), { orderBy: [{ col: 'pf', dir: 'asc' }], limit: 5 }); } },
  { id: 'inWin-low', re: /\b(lowest|fewest|least|worst)\b.*\b(win|won|winning|victory)\b|\b(won|win) with (the )?(lowest|fewest|least)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScoreInWin' }); } },
  { id: 'inWin-high', re: /\b(most|highest)\b.*\b(in a win|winning (score|effort)|in victory)\b/i, make: function(i) { return recipeSpec('games', Object.assign({ result: 'W' }, i.where), { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 5 }); } },
  { id: 'unlucky', re: /\bunluck(y|iest)\b.*\b(loss|defeat)\b|\bunluckiest\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'unluckiestLoss' }); } },
  { id: 'lucky', re: /\bluck(y|iest)\b.*\b(win|victory)\b|\bluckiest\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'luckiestWin' }); } },
  { id: 'closest', re: /\b(closest|narrowest|tightest)\b|\bsmallest (margin|win|victory)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'closestGame' }); } },
  { id: 'blowout', re: /\b(blowouts?|thrashing|hammering|drubbing)\b|\b(biggest|largest|widest) (margin|win|victory|beating)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'biggestMargin' }); } },
  { id: 'combined-high', re: /\b(highest|most|biggest)\b.*\b(combined|total)\b.*\b(game|score|points|matchup)\b|\bhighest[- ]scoring (game|matchup)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestCombined' }); } },
  { id: 'combined-low', re: /\b(lowest|fewest)\b.*\b(combined|total)\b|\blowest[- ]scoring (game|matchup)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestCombined' }); } },
  { id: 'season-best', re: /\b(most|highest|best)\b.*\b(points|pf|scoring)\b.*\b(season|year)\b|\bbest season\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'bestSeasonPF' }); } },
  { id: 'season-worst', re: /\b(fewest|lowest|worst)\b.*\b(points|pf|scoring)\b.*\b(season|year)\b|\bworst season\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'worstSeasonPF' }); } },
  { id: 'streak-current', re: /\b(current|active|right now)\b.*\bstreaks?\b|\bstreaks? (right now|currently)\b|\bon a (win(ning)?|los(ing|s)) streak\b|^\s*streaks\??\s*$/i, make: function(i) { return recipeSpec('record', i.where, { record: 'currentStreaks' }); } },
  { id: 'streak-loss', re: /\b(longest|worst)\b.*\b(los(ing|s)|skid)\b.*\bstreak|\blongest (losing|loss) (run|streak)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'longestLossStreak' }); } },
  { id: 'streak-win', re: /\blongest\b.*\b(win(ning)?)?\s*streaks?\b|\blongest win(ning)? run\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'longestWinStreak' }); } },
  { id: 'top-weeks', re: /\b(most|how many)\b.*\b(top|highest)[- ]scor\w* weeks?\b|\btopped the (weekly )?scoring\b|\bmost weekly (high|top) scores?\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'mostTopScoreWeeks' }); } },
  { id: 'bottom-weeks', re: /\b(most|how many)\b.*\b(bottom|lowest)[- ]scor\w* weeks?\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'mostBottomScoreWeeks' }); } },
  { id: 'upset', re: /\bupsets?\b/i, make: function(i) { return recipeSpec('games', { seasons: [i.cur.season], weeks: [i.cur.lastFinalWeek], result: 'W', phase: 'all' }, { orderBy: [{ col: 'weekRank', dir: 'desc' }, { col: 'pf', dir: 'asc' }], limit: 1 }); } },
  { id: 'points-total', re: /\b(most|total|career|all[- ]time) points\b|\bpoints (all[- ]time|overall|in total)\b/i, not: /\b(game|week|single|matchup|in a|loss|lost|win|won|season|year)\b/i, make: function(i) { return recipeSpec('games', { managers: i.where.managers, seasons: i.where.seasons, phase: i.where.phase }, { groupBy: ['manager'], select: ['games', 'pf_sum', 'pf_avg', 'wins', 'losses'], orderBy: [{ col: 'pf_sum', dir: 'desc' }], limit: 10 }); } },
  { id: 'week-top', re: /\b(top|highest|best) (scorer|score)\b.*\bthis week\b|\bthis week'?s? (top|high(est)?) (scorer|score)\b|\bwho (scored|had) (the )?most (points )?this week\b/i, make: function(i) { return recipeSpec('games', { seasons: [i.cur.season], weeks: [i.cur.lastFinalWeek], phase: 'all' }, { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 1 }); } },
  { id: 'week-scores', re: /\b(this|last) week'?s? (scores?|results|games?|matchups?)\b|\b(scores?|results) (from )?(this|last) week\b|\bweek (\d{1,2}) (scores?|results)\b/i, make: function(i, q) {
    const m = q.match(/\bweek (\d{1,2})\b/i);
    return recipeSpec('games', { seasons: [i.cur.season], weeks: [m ? Number(m[1]) : i.cur.lastFinalWeek], result: 'W', phase: 'all' }, { orderBy: [{ col: 'pf', dir: 'desc' }], limit: 8 });
  } },
  { id: 'champion', re: /\bwho won (the )?(20\d\d|title|league|championship|plancey)\b|\b(20\d\d) (champion|winner|title)\b|\bchampion (in|of) 20\d\d\b/i, make: function(i) { return recipeSpec('seasons', { seasons: i.years.length ? i.years : [i.cur.season], playoffFinish: 'champion' }); } },
  { id: 'best-week', re: /\b(best|highest|biggest)\b.*\b(week|game|score)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('record', i.where, { record: 'highestScore' }); } },
  { id: 'worst-week', re: /\b(worst|lowest)\b.*\b(week|game|score)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScore' }); } },
  { id: 'highest-score', re: /\b(highest|most points|biggest|best|max(imum)?|record)\b.*\b(score|points|total|week|game)\b|\bmost points\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'highestScore' }); } },
  { id: 'lowest-score', re: /\b(lowest|fewest|worst|least)\b.*\b(score|points|total|week|game)\b/i, make: function(i) { return recipeSpec('record', i.where, { record: 'lowestScore' }); } },
  { id: 'h2h', re: /\b(vs\.?|versus|v|against|head[\s-]?to[\s-]?head|h2h|beat|record against)\b/i, need: 'twoMgr', make: function(i) {
    return recipeSpec('games', { managers: [i.mgrs[0]], opponents: [i.mgrs[1]], seasons: i.where.seasons, phase: i.where.phase }, { groupBy: ['manager', 'opponent'], select: ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pa_sum', 'pf_avg'] });
  } },
  { id: 'h2h-bare', re: /^\W*\w+\W+(and|&|\/)?\W*\w+\W*\??$/i, need: 'twoMgr', make: function(i) {
    return recipeSpec('games', { managers: [i.mgrs[0]], opponents: [i.mgrs[1]], phase: i.where.phase }, { groupBy: ['manager', 'opponent'], select: ['games', 'wins', 'losses', 'ties', 'pf_sum', 'pa_sum', 'pf_avg'] });
  } },
  { id: 'season-record', re: /\b(record|do|did|go|went|finish(ed)?|fare|season)\b/i, need: 'oneMgrYear', make: function(i) { return recipeSpec('seasons', { managers: i.mgrs, seasons: i.years }); } },
  { id: 'alltime-standings', re: /\ball[\s-]?time (standings|table|record|rankings?)\b|\bcareer (records?|standings|wins)\b|\bmost wins\b/i, make: function(i) { return recipeSpec('games', { phase: i.where.phase }, { groupBy: ['manager'], select: ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg'], limit: 10 }); } },
  { id: 'standings', re: /\b(standings|league table|table|rankings|who'?s top|who is top|leading the league)\b/i, make: function(i) { return recipeSpec('seasons', { seasons: i.years.length ? i.years : [i.cur.season] }, { orderBy: [{ col: 'rank', dir: 'asc' }], limit: 10 }); } },
  { id: 'mgr-record', re: /\b(record|wins|losses|how many (wins|games)|how good)\b/i, need: 'oneMgr', make: function(i) { return recipeSpec('games', i.where, { groupBy: ['manager'], select: ['games', 'wins', 'losses', 'ties', 'winPct', 'pf_sum', 'pf_avg'] }); } },
];

function recipeInfo(query, facts) {
  const mgrs = matchManagers(query);
  const years = (String(query).match(/\b20\d\d\b/g) || []).filter(function(y, i, a) { return a.indexOf(y) === i; });
  const cur = (facts && facts.current) || { season: years[0] || '', lastFinalWeek: 1 };
  if (!years.length && cur.season && /\b(this|current) (season|year)\b|\bso far this\b/i.test(query)) years.push(String(cur.season));
  if (!years.length && cur.season && /\blast (season|year)\b/i.test(query)) years.push(String(Number(cur.season) - 1));
  const where = {};
  if (mgrs.length === 1) where.managers = mgrs;
  if (years.length) where.seasons = years;
  if (PLAYOFF_HINT.test(query)) where.phase = /\bplayoffs? only\b|\bin the playoffs\b/i.test(query) ? 'playoff' : 'all';
  return { mgrs: mgrs, years: years, cur: cur, where: where };
}

// fastPlan: recipe table → v2 spec (or null to fall through to the model planner).
// Words people use → the words the recipes are written for.
const SYNONYMS = [
  [/\bmatch[- ]?ups?\b|\bmatch(es)?\b|\bfixtures?\b/gi, 'game'], [/\bpts\b/gi, 'points'], [/\bhigh[- ]?score\b/gi, 'highest score'],
  [/\blow[- ]?score\b/gi, 'lowest score'], [/\b(beaten|defeated)\b/gi, 'lost'], [/\bvictor(y|ies)\b/gi, 'win'],
  [/\b(greatest|largest)\b/gi, 'biggest'], [/\bpoorest\b/gi, 'worst'], [/\bbiggest score\b/gi, 'highest score'],
  [/\bscored the most\b/gi, 'most points'], [/\b(year|campaign)\b/gi, 'season'],
];
function normalizeQ(q) { let t = String(q || ''); SYNONYMS.forEach(function(p) { t = t.replace(p[0], p[1]); }); return t; }

const POS_WORDS = [[/\b(qbs?|quarterbacks?)\b/i, 'QB'], [/\b(rbs?|running ?backs?)\b/i, 'RB'], [/\b(wrs?|wide receivers?|receivers?)\b/i, 'WR'],
  [/\b(tes?|tight ends?)\b/i, 'TE'], [/\b(kickers?|ks)\b/i, 'K'], [/\b(def|dst|defen[cs]es?)\b/i, 'DEF']];
// Player-table recipes (run before the planner fallback for player questions).
function playerPlan(q, info, n) {
  const pos = POS_WORDS.filter(function(p) { return p[0].test(q); }).map(function(p) { return p[1]; });
  const where = { seasons: info.where.seasons, managers: info.where.managers };
  if (pos.length) where.positions = pos;
  const avg = /\b(average|avg|per game|ppg)\b/i.test(q);
  if (/\bby position\b|\bpositional\b|\bpoints (from|by) each position\b/i.test(q)) {
    return recipeSpec('players', where, { groupBy: info.mgrs.length === 1 ? ['pos'] : ['manager', 'pos'], select: ['pts_sum', 'count'], orderBy: [{ col: 'pts_sum', dir: 'desc' }], limit: 25 });
  }
  if (!pos.length) return null;
  if (/\b(which|what) manager\b|\bby manager\b|\bmanagers?\b.*\bmost\b|\bmost\b.*\bpoints from\b/i.test(q) || (info.mgrs.length === 1 && /\b(total|points from|by season)\b/i.test(q))) {
    return recipeSpec('players', where, { groupBy: info.mgrs.length === 1 ? ['season'] : ['manager'], select: ['pts_sum', 'count'], orderBy: [{ col: 'pts_sum', dir: 'desc' }], limit: 10 });
  }
  if (/\b(best|top|highest|most|leading|elite)\b/i.test(q) || n) {
    return recipeSpec('players', where, { orderBy: [{ col: avg ? 'avg' : 'pts', dir: 'desc' }], limit: n || 10 });
  }
  return null;
}

function fastPlan(query, facts) {
  const q = normalizeQ(query);
  const n = topN(q);
  if (/\b(wr|rb|qb|te|kicker|player|players|touchdowns?|position|positional|quarterbacks?|running ?backs?|receivers?|tight ends?|defen[cs]es?)s?\b/i.test(q)) {
    const ps = playerPlan(q, recipeInfo(q, facts), n);
    if (ps) ps._recipe = 'players';
    return ps; // else player scoring → planner
  }
  // "top 10 combined scores" → match the recipes as "highest combined scores".
  let qm = n && !/\b(highest|lowest|biggest|largest|smallest|most|fewest|least|best|worst|closest|longest|narrowest)\b/i.test(q)
    ? q.replace(/\btop[- ]?(\d{1,2}|[a-z]+)\b/i, 'highest') : q;
  qm = qm.replace(/\b(score|game|matchup)s\b/gi, '$1'); // "highest scores" reads as "highest score"
  const info = recipeInfo(qm, facts);
  for (let k = 0; k < RECIPES.length; k++) {
    const r = RECIPES[k];
    if (r.need === 'oneMgr' && info.mgrs.length !== 1) continue;
    if (r.need === 'twoMgr' && info.mgrs.length < 2) continue;
    if (r.need === 'oneMgrYear' && !(info.mgrs.length === 1 && info.years.length)) continue;
    if (r.need === 'noMgr' && info.mgrs.length) continue;
    if (!r.need && info.mgrs.length >= 2) continue; // two names → only the H2H recipes
    if (!r.re.test(qm)) continue;
    if (r.not && r.not.test(qm)) continue;
    const spec = r.make(info, qm);
    if (spec) { spec._recipe = r.id; return n ? widen(spec, n) : spec; }
  }
  return null;
}

// A spec turned into a ranked list of n rows: a record → its top n, a list → n rows.
function widen(spec, n) {
  const s = JSON.parse(JSON.stringify(spec));
  if (s.table === 'record') { s.top = true; s.limit = n; }
  else if (!(s.groupBy && s.groupBy.length && s.groupBy.join(',') === 'manager,opponent')) s.limit = n;
  return s;
}

// Follow-ups resolve against the previous result (cause D).
function followUpSpec(query, ctx, facts) {
  if (!ctx || !ctx.lastResult) return null;
  const rows = ctx.lastResult.rows || [];
  const q = String(query || '');
  // "give me the top 10 of this" / "show more" → the previous metric, widened.
  const n = topN(q);
  const base = ctx.metricSpec || ctx.lastSpec;
  if (n && base && !(base.where && base.where.gameIds) && !(facts && fastPlan(q, facts)) && /\b(this|that|these|those|them|it|same|more|the rest|of (this|that)|in history|ever|all[- ]time|of all time)\b|^\W*(top[- ]?\w+|show (me )?more|list( them)?)\W*$/i.test(q)) {
    const prevN = (ctx.lastResult.rows || []).length;
    const spec = widen(base, /\b(more|the rest)\b/i.test(q) && !/\d/.test(q) ? Math.min(25, Math.max(n, prevN + 10)) : n);
    delete spec._recipe;
    if (/\b(in history|ever|all[- ]time|of all time)\b/i.test(q) && spec.where) delete spec.where.seasons;
    spec._recipe = 'follow-top';
    return spec;
  }
  if (FOLLOW_GAME_HINT.test(q) && !RANKING_HINT.test(q) && rows.length && rows[0].gameId) {
    return { v: 2, table: 'games', where: { gameIds: [rows[0].gameId], status: 'any', phase: 'all' }, orderBy: [{ col: 'pf', dir: 'desc' }], _recipe: 'follow-game' };
  }
  // "and in 2024?" / "what about Dan?" → previous spec with seasons / managers swapped.
  const m = q.match(/^\s*(and|what about|how about|same for|now)\b/i);
  if (m && ctx.lastSpec) {
    const years = (q.match(/\b20\d\d\b/g) || []);
    const mgrs = matchManagers(q);
    if (!years.length && !mgrs.length) return null;
    const spec = JSON.parse(JSON.stringify(ctx.lastSpec));
    delete spec._recipe;
    if (years.length) spec.where.seasons = years;
    if (mgrs.length && spec.where.managers) spec.where.managers = mgrs.slice(0, Math.max(1, spec.where.managers.length));
    else if (mgrs.length) spec.where.managers = mgrs.slice(0, 1);
    spec._recipe = 'follow-swap';
    return spec;
  }
  return null;
}

// "Last week Dan and I had a bigger game" → find the game they mean and check it
// against the record the previous answer was about. Returns a reply or null.
function counterClaim(query, ctx, facts) {
  const spec = ctx.metricSpec || ctx.lastSpec;
  if (!spec || spec.table !== 'record' || !RECORD_DIR[spec.record]) return null;
  const q = String(query || '');
  if (!/\b(bigger|higher|better|more|lower|smaller|closer|tighter|larger|beat (it|that))\b/i.test(q)) return null;
  const named = matchManagers(q);
  const cur = facts.current || {};
  let season = null, week = null;
  if (/\blast week\b|\bthis week\b/i.test(q)) { season = cur.season; week = cur.lastFinalWeek; }
  const wm = q.match(/\bweek (\d{1,2})\b/i); if (wm) week = Number(wm[1]);
  const ym = q.match(/\b20\d\d\b/); if (ym) season = ym[0];
  if (week != null && season == null) season = (spec.where && spec.where.seasons && spec.where.seasons.length === 1) ? spec.where.seasons[0] : cur.season;
  if (!named.length && week == null && season == null) return null;
  const otherSeason = season != null && !!(spec.where && spec.where.seasons) && spec.where.seasons.indexOf(season) === -1;
  const name = spec.record;
  const scope = spec.where && spec.where.phase === 'all' ? 'all' : 'regular';
  const pool = facts.games.filter(function(r) {
    // A claim about another season/week is checked against every season.
    if (!otherSeason && spec.where && spec.where.seasons && spec.where.seasons.indexOf(r.season) === -1) return false;
    if (spec.where && spec.where.managers && spec.where.managers.indexOf(r.manager) === -1) return false;
    return true;
  });
  const ranked = factGameRanked(pool, 'all', name);
  const inScope = factGameRanked(pool, scope, name);
  const cands = ranked.filter(function(r) {
    if (season != null && r.season !== season) return false;
    if (week != null && r.week !== week) return false;
    return named.every(function(h) { return r.manager === h || r.opponent === h; });
  });
  if (!cands.length) return null;
  const claim = cands[0];
  const v = factRecordValue(name, claim);
  const best = inScope[0];
  const shown = (ctx.lastResult && ctx.lastResult.rows && ctx.lastResult.rows[0]) || null;
  const shownV = shown ? factRecordValue(name, shown) : null;
  const label = (RECORD_LABELS[name] || 'record').toLowerCase();
  const desc = nm(claim.manager) + ' ' + fmt2(claim.pf) + ' – ' + fmt2(claim.pa) + ' ' + nm(claim.opponent) + ' in ' + wkLabel(claim) + ' (' + fmt2(v) + ')';
  const rank = inScope.indexOf(claim) + 1;
  const better = function(a, b) { return RECORD_DIR[name] === 'max' ? a > b + 1e-9 : a < b - 1e-9; };
  let content;
  const isRecord = best && factRecordValue(name, best) === v && rank > 0;
  if (otherSeason) {
    content = 'That one is from ' + season + ', and the answer above was for ' + spec.where.seasons.join(', ') + '. ' + desc + (rank === 1 ? ' is the ' + label + ' across all seasons.' : ' ranks #' + rank + ' across all seasons; the ' + label + ' is ' + fmt2(factRecordValue(name, best)) + '.');
  } else if (isRecord && shown && shown.gameId === claim.gameId) {
    content = 'Yes — ' + desc + ' is the ' + label + ' on record, the answer above.';
  } else if (shownV != null && better(v, shownV)) {
    content = "You're right — " + desc + ' beats the ' + fmt2(shownV) + ' I gave. ' +
      (best === claim || (best && factRecordValue(name, best) === v) ? 'It is the ' + label + ' on record.' : 'It ranks #' + rank + '; the ' + label + ' is ' + fmt2(factRecordValue(name, best)) + '.');
  } else if (rank > 0) {
    content = 'Checked: ' + desc + ' ranks #' + rank + ' for ' + label + ' — behind ' + fmt2(factRecordValue(name, best)) + '.';
  } else {
    content = desc + ' is a ' + claim.phase + ' game, outside the regular-season record. Add "including playoffs" to rank it.';
  }
  const top = inScope.slice(0, 5);
  if (rank > 5) top.push(claim);
  const rspec = Object.assign({}, spec, { top: true, limit: top.length });
  const cols = (name === 'highestCombined' || name === 'lowestCombined')
    ? ['manager', 'pf', 'opponent', 'pa', 'combined', 'result', 'season', 'week', 'phase']
    : ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'];
  return { content: content, table: { table: 'record', record: name, top: true, columns: cols, rows: top, total: inScope.length, spec: rspec } };
}

// "How could Josh score 168.56 and lose?" → re-show the source rows, templated.
function disputeReply(query, ctx, facts) {
  if (!ctx || !ctx.lastResult || !DISPUTE_HINT.test(String(query || ''))) return null;
  const claim = counterClaim(query, ctx, facts);
  if (claim) return claim;
  // Re-run the question the user is disputing from scratch; if the fresh answer
  // differs from what was shown, say so and show the corrected rows.
  if (ctx.lastQ && ctx.lastSpec && ctx.lastSpec._recipe && /^follow-/.test(ctx.lastSpec._recipe)) {
    const fresh = fastPlan(ctx.lastQ, facts);
    const v = fresh && validateSpec(fresh, facts);
    if (v && v.ok) {
      const res = runQuery(v.spec, facts);
      const a = res.rows[0], b = (ctx.lastResult.rows || [])[0];
      if (a && (!b || a.gameId !== b.gameId)) {
        return { content: 'I got that wrong — I answered about the previous game instead of the question. ' + templateSentence(v.spec, res), table: res };
      }
    }
  }
  const rows = ctx.lastResult.rows || [];
  const gid = rows.length && rows[0].gameId;
  if (!gid) {
    return { content: 'The table above is computed directly from the league data — those are the source rows. Ask about a specific game and I can show both sides of it.', table: ctx.lastResult };
  }
  const both = facts.games.filter(function(r) { return r.gameId === gid; });
  const win = both.find(function(r) { return r.result === 'W'; });
  const lose = both.find(function(r) { return r.result === 'L'; });
  const result = { table: 'games', columns: ['manager', 'pf', 'opponent', 'pa', 'result', 'margin', 'season', 'week', 'phase'], rows: both, total: both.length, spec: { v: 2, table: 'games', where: { gameIds: [gid] }, groupBy: [] } };
  if (!win || !lose) return { content: 'Here are both sides of that game, straight from the data.', table: result };
  const named = matchManagers(query);
  let lead = '';
  if (named.indexOf(win.manager) !== -1 && /\blos(e|t|ing)\b/i.test(query)) lead = nm(win.manager) + " didn't lose. ";
  else if (named.indexOf(lose.manager) !== -1 && /\bw(in|on)\b/i.test(query)) lead = nm(lose.manager) + " didn't win. ";
  const label = ctx.lastResult.record ? ' That is the ' + RECORD_LABELS[ctx.lastResult.record].toLowerCase() + ' answer: ' + nm(lose.manager) + ' is the side that scored ' + fmt2(lose.pf) + ' and lost.' : '';
  return {
    content: lead + nm(win.manager) + ' won ' + fmt2(win.pf) + '–' + fmt2(lose.pf) + ' against ' + nm(lose.manager) + ' in ' + wkLabel(win) + '.' + label + ' The rows below are the league data itself.',
    table: result,
  };
}

const CLARIFY = "Which stat do you mean? For example: “Top 10 combined scores”, “Who beats the league average most?”, “How many times has Dan scored over 150?”, “Dan vs Josh” or “Best RBs this season”.";
const CANT_ANSWER = "I can't answer that one from the league data, and I won't guess a number. Try: “Most points in a loss?”, “Dan vs Josh”, “Lev's record in 2024”, “Current standings”, “This week's scores” or “Longest win streak”.";

// Compact pipe table of result rows for prompts (≤ 25 rows, names not handles).
function rowsPipe(result, max) {
  const cols = (result && result.columns) || [];
  const rows = ((result && result.rows) || []).slice(0, max || 25);
  return [cols.join('|')].concat(rows.map(function(r) {
    return cols.map(function(c) {
      const v = r[c];
      if (v == null) return '';
      if (colMeta(c).type === 'mgr') return nm(v);
      if (colMeta(c).type === 'pts') return fmt2(v);
      return String(v);
    }).join('|');
  })).join('\n');
}

// Worked examples: question → spec. Each one is executed by test-questions.js.
const PLANNER_EXAMPLES = [
  ['How many times has Dan scored over 150?', { v: 3, table: 'games', where: { managers: ['dpol'], filters: [{ col: 'pf', op: '>', value: 150 }] }, groupBy: ['manager'], select: ['count'] }],
  ['Who beats the league average most often in 2025?', { v: 3, table: 'games', where: { seasons: ['2025'], filters: [{ col: 'vsAvg', op: '>', value: 0 }] }, groupBy: ['manager'], select: ['count'], orderBy: [{ col: 'count', dir: 'desc' }] }],
  ['Games where both teams scored 140+', { v: 3, table: 'games', where: { filters: [{ col: 'pf', op: '>=', value: 140 }, { col: 'pa', op: '>=', value: 140 }] }, unique: true, orderBy: [{ col: 'combined', dir: 'desc' }] }],
  ['Which week had the highest league average?', { v: 3, table: 'weeks', orderBy: [{ col: 'avg', dir: 'desc' }], limit: 5 }],
  ['Who has scored the most points against Josh?', { v: 3, table: 'games', where: { opponents: ['joshjr11'] }, groupBy: ['manager'], select: ['pf_sum', 'games'], orderBy: [{ col: 'pf_sum', dir: 'desc' }] }],
  ['Which manager got the most RB points in 2025?', { v: 3, table: 'players', where: { positions: ['RB'], seasons: ['2025'] }, groupBy: ['manager'], select: ['pts_sum'], orderBy: [{ col: 'pts_sum', dir: 'desc' }] }],
  ['How many titles has each manager won?', { v: 3, table: 'seasons', where: { playoffFinish: 'champion' }, groupBy: ['manager'], select: ['count'] }],
  ['Average winning margin by season', { v: 3, table: 'games', where: { result: 'W' }, groupBy: ['season'], select: ['margin_avg', 'count'], orderBy: [{ col: 'season', dir: 'asc' }] }],
  ['Top 10 combined scores including playoffs', { v: 3, table: 'record', record: 'highestCombined', top: true, limit: 10, where: { phase: 'all' } }],
  ['Who has made the most trades?', { v: 3, table: 'trades', groupBy: ['manager'], select: ['count'], orderBy: [{ col: 'count', dir: 'desc' }] }],
  ["Dan's record when he scores under 120", { v: 3, table: 'games', where: { managers: ['dpol'], filters: [{ col: 'pf', op: '<', value: 120 }] }, groupBy: ['manager'], select: ['games', 'wins', 'losses'] }],
  ['Who has won at least 5 games while scoring below the league average?', { v: 3, table: 'games', where: { result: 'W', filters: [{ col: 'vsAvg', op: '<', value: 0 }] }, groupBy: ['manager'], select: ['count'], having: [{ col: 'count', op: '>=', value: 5 }], orderBy: [{ col: 'count', dir: 'desc' }] }],
];

function catalogText() {
  return Object.keys(CATALOG).map(function(t) {
    const c = CATALOG[t];
    return t + ' — ' + c.about + '\n  columns: ' + Object.keys(c.cols).map(function(k) { return k + ' (' + c.cols[k][1] + ')'; }).join('; ') +
      '\n  groupBy dimensions: ' + c.dims.join(', ');
  }).join('\n');
}

function calendarText(facts) {
  const cur = (facts && facts.current) || {};
  const seasons = ((facts && facts.seasons) || []).map(function(r) { return r.season; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
  return 'NOW: current season ' + cur.season + ', last completed week ' + cur.lastFinalWeek + (cur.liveWeek ? ', week ' + cur.liveWeek + ' in progress' : '') +
    '. Seasons in the data: ' + seasons.join(', ') + '. "this season" = ' + cur.season + '; "last week" = week ' + cur.lastFinalWeek + ' of ' + cur.season +
    '; "ever", "all-time", "in history" = no season filter.';
}

function plannerPrompt(query, ctx, facts, repair) {
  const handles = Object.keys(NAMES).map(function(h) { return h + '=' + distinctName(h); }).join(', ');
  const lines = [
    'You translate a fantasy-football league question into a JSON query spec. Output ONLY valid JSON, nothing else.',
    'Manager handles (use these exact strings): ' + handles + '. benjlev=Lev, sanfbe=Sanford, allyl900 maps to AlastairL.',
    calendarText(facts),
    'TABLES:\n' + catalogText(),
    'SPEC: { "v": 3, "table": "games"|"seasons"|"weeks"|"players"|"trades"|"record",',
    '  "where": { "managers": [], "opponents": [] (games: opponent; trades: partner), "seasons": ["2024"], "weeks": [1], "phase": "regular"|"playoff"|"consolation"|"all" (games/weeks; default regular), "status": "final"|"live"|"any" (default final), "result": "W"|"L"|"T", "positions": ["WR"], "player": "name substring", "playoffFinish": "champion"|"runner-up"|"semi"|"consolation"|"missed",',
    '    "filters": [{ "col": "<column of the table>", "op": "="|"!="|">"|">="|"<"|"<=", "value": number or string }] },',
    '  "unique": true (games only: one row per game instead of one per manager),',
    '  "groupBy": up to 2 groupBy dimensions of the table,',
    '  "select": (with groupBy) "count", "<numeric column>_<sum|avg|max|min>" e.g. "pf_sum", "vsAvg_avg", "pts_sum"; games also: "games","wins","losses","ties","winPct","topScoreWeeks",',
    '  "having": [{ "col": "<a select column>", "op": ">=", "value": 5 }],',
    '  "orderBy": [{ "col": "<column, or select column when grouped>", "dir": "desc"|"asc" }], "limit": 1..25 (default 10) }',
    'record table: "record": one of ' + RECORD_NAMES.join(', ') + '; returns only the holder(s) unless "top": true with "limit": N (ranked list). Records honour where.managers, where.seasons and where.phase.',
    'Prefer the simplest spec. A question about one game score uses games; a league-wide week question uses weeks. If the question is not a data lookup (opinion, lore, definitions, trade advice) output {"table":"none"}.',
    'EXAMPLES:',
  ].concat(PLANNER_EXAMPLES.map(function(e) { return 'Q: ' + e[0] + '\n' + JSON.stringify(e[1]); }));
  if (ctx && ctx.lastQ) {
    lines.push('PREVIOUS QUESTION: ' + ctx.lastQ);
    if (ctx.lastSpec) lines.push('PREVIOUS SPEC: ' + JSON.stringify(ctx.lastSpec));
    if (ctx.lastResult) lines.push('PREVIOUS TOP ROWS:\n' + rowsPipe(ctx.lastResult, 3));
  }
  lines.push('QUESTION: ' + query);
  if (repair) lines.push('YOUR PREVIOUS SPEC WAS REJECTED: ' + repair.error + '\nPREVIOUS SPEC: ' + JSON.stringify(repair.raw) + '\nOutput a corrected spec (or {"table":"none"}).');
  return lines.join('\n');
}

function narrationPrompt(query, ctx, result) {
  const names = Object.keys(NAMES).map(function(h) { return h + '=' + distinctName(h); }).join(', ');
  const parts = [
    'You are the statistician for the Borehamwood Plancy League.',
    'Write ONE or TWO short sentences that answer the question using ONLY the rows below. The table is shown to the user under your sentences, so do not repeat it.',
    'The rows are ground truth computed from the league data. Never claim you fabricated, invented or made up anything, and never apologise for the data. Do not compute new numbers (no sums, averages or differences that are not in the rows). Use names, not handles.',
    'NAMES: ' + names,
  ];
  if (ctx && ctx.lastQ) parts.push('PREVIOUS QUESTION: ' + ctx.lastQ + (ctx.lastResult ? '\nPREVIOUS TOP ROWS:\n' + rowsPipe(ctx.lastResult, 3) : ''));
  parts.push('QUESTION: ' + query);
  if (result && result.scope) parts.push('SCOPE: ' + result.scope);
  parts.push('ROWS (' + ((result && result.total) || 0) + ' total, top ' + Math.min(25, ((result && result.rows) || []).length) + ' shown):\n' + rowsPipe(result, 25));
  const df = result && result.spec ? derivedFacts(result.spec, result) : [];
  if (df.length) parts.push('COMPUTED (you may use these): ' + df.map(function(d) { return d.label + ' = ' + (Number.isInteger(d.value) ? d.value : fmt2(d.value)); }).join('; '));
  parts.push('Answer:');
  return parts.join('\n\n');
}

// Tolerant JSON extraction: whole reply → outermost braces.
function parseSpecJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw).trim()); } catch (e) { /* not bare JSON */ }
  const s = String(raw), first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first !== -1 && last > first) { try { return JSON.parse(s.slice(first, last + 1)); } catch (e) { /* fall through */ } }
  return null;
}

// The whole Stats answer. deps: { facts, players, plan(prompt)→string|object,
// narrate(prompt)→string, log }. Returns { content, table, ctx, source, modelCalls }.
async function answerStatQuestion(query, ctx, deps) {
  const facts = deps.facts;
  let modelCalls = 0;
  const log = deps.log || function() {};
  const next = function(spec, result) {
    const metric = spec && !(spec.where && spec.where.gameIds) ? spec : (ctx && ctx.metricSpec) || null;
    return { lastQ: query, lastSpec: spec, lastResult: result, metricSpec: metric };
  };

  const dispute = disputeReply(query, ctx, facts);
  if (dispute) return { content: dispute.content, table: dispute.table, ctx: Object.assign(next(dispute.table.spec, dispute.table), { lastQ: (ctx && ctx.lastQ) || query }), source: 'dispute', modelCalls: 0 };

  let raw = followUpSpec(query, ctx, facts) || fastPlan(query, facts);
  let source = raw ? 'recipe' : 'planner';
  // One or two words with no recognised stat ("stat", "hmm") → ask, don't guess.
  if (!raw && String(query || '').trim().split(/\s+/).length <= 2 && !matchManagers(query).length && !/\b20\d\d\b/.test(query)) {
    return { content: CLARIFY, table: null, ctx: ctx, source: 'clarify', modelCalls: 0 };
  }
  let v = raw ? validateSpec(raw, facts) : { ok: false, error: 'no spec' };
  if (!raw && deps.plan) {
    try { modelCalls++; raw = parseSpecJson(await deps.plan(plannerPrompt(query, ctx, facts))); } catch (e) { raw = null; }
    v = validateSpec(raw, facts);
    // Repair loop: one retry with the validator's reason.
    if (!v.ok && v.error !== 'none' && raw) {
      log('planner spec rejected', v.error, raw);
      let fixed = null;
      try { modelCalls++; fixed = parseSpecJson(await deps.plan(plannerPrompt(query, ctx, facts, { error: v.error, raw: raw }))); } catch (e) { fixed = null; }
      if (fixed) { const v2 = validateSpec(fixed, facts); if (v2.ok || v2.error === 'none') { v = v2; raw = fixed; } }
    }
  }
  if (!v.ok) {
    if (v.error !== 'none' || NUMERIC_HINT.test(query)) return { content: CANT_ANSWER, table: null, ctx: ctx, source: 'cant', modelCalls: modelCalls };
    return { content: null, table: null, ctx: ctx, source: 'chat', modelCalls: modelCalls };
  }
  const spec = v.spec;
  const result = runQuery(spec, facts, deps.players, deps.transactions);
  const tmpl = templateSentence(spec, result);
  if (!result.rows.length) return { content: tmpl, table: null, ctx: next(spec, result), source: source, modelCalls: modelCalls };
  const single = result.table === 'record' || result.rows.length === 1 || (spec.where.gameIds && result.rows.length <= 2);
  if (single || !deps.narrate) return { content: tmpl, table: result, ctx: next(spec, result), source: source, modelCalls: modelCalls };
  let sentence = null;
  try { modelCalls++; sentence = String(await deps.narrate(narrationPrompt(query, ctx, result)) || '').trim(); } catch (e) { sentence = null; }
  const g = sentence ? numberGuard(sentence, result.rows, derivedFacts(spec, result).map(function(d) { return d.value; })) : { ok: false, bad: [] };
  if (!sentence || !g.ok || /fabricat|made (that|it) up|invented/i.test(sentence)) {
    log('number guard rejected narration', g.bad, sentence);
    sentence = tmpl;
  }
  return { content: sentence, table: result, ctx: next(spec, result), source: source, modelCalls: modelCalls };
}

// ── Current-season summaries (Phase 3) — pure, built from the fact table ──────
// The last completed week: results, high/low, closest game, upset, mini standings.
function thisWeekFacts(facts) {
  const cur = facts && facts.current;
  if (!cur || !cur.lastFinalWeek) return null;
  const rows = facts.games.filter(function(r) { return r.season === cur.season && r.week === cur.lastFinalWeek && r.status === 'final' && !r.bye; });
  if (!rows.length) return null;
  const byGame = {};
  rows.forEach(function(r) { (byGame[r.gameId] = byGame[r.gameId] || []).push(r); });
  const games = Object.keys(byGame).map(function(k) {
    const p = byGame[k];
    const w = p.find(function(r) { return r.result === 'W'; }) || p[0];
    const l = p.find(function(r) { return r !== w; }) || p[0];
    return { w: w, l: l, tie: w.result === 'T' };
  }).sort(function(a, b) { return b.w.pf - a.w.pf; });
  const high = factBest(rows, function(r) { return r.pf; }, 'max')[0];
  const low = factBest(rows, function(r) { return r.pf; }, 'min')[0];
  const winners = rows.filter(function(r) { return r.result === 'W'; });
  const closest = factBest(winners, function(r) { return r.margin; }, 'min')[0] || null;
  const ranked = winners.filter(function(r) { return r.weekRank != null; });
  const upset = ranked.length ? factBest(ranked, function(r) { return r.weekRank; }, 'max')[0] : (factBest(winners, function(r) { return r.pf; }, 'min')[0] || null);
  const streaks = {};
  (((facts.records.current || {}).regular || {}).currentStreaks || []).forEach(function(s) { streaks[s.manager] = s.type + s.length; });
  const standings = facts.seasons.filter(function(r) { return r.season === cur.season; })
    .sort(function(a, b) { return a.rank - b.rank; })
    .map(function(r) { return { rank: r.rank, manager: r.manager, wins: r.wins, losses: r.losses, ties: r.ties, pf: r.pf, streak: streaks[r.manager] || '' }; });
  return { season: cur.season, week: cur.lastFinalWeek, liveWeek: cur.liveWeek, complete: cur.complete, games: games, high: high, low: low, closest: closest, upset: upset, standings: standings };
}

// Freshness badge: "2026 · through Week 10 · Week 11 live" (last FINAL week).
function badgeText(facts) {
  const cur = facts && facts.current;
  if (!cur) return '';
  if (cur.complete) return cur.season + ' · season complete';
  if (!cur.lastFinalWeek) return cur.season + ' · season starting';
  return cur.season + ' · through Week ' + cur.lastFinalWeek + (cur.liveWeek ? ' · Week ' + cur.liveWeek + ' live' : '');
}

function recordLine(name, res) {
  const r = res.rows[0];
  if (!r) return null;
  const label = RECORD_LABELS[name];
  if (r.type) return label + ': ' + res.rows.map(function(x) { return nm(x.manager); }).join(', ') + ' ' + r.length + r.type + ' (' + r.from + ' to ' + r.to + ')';
  if (r.count != null) return label + ': ' + res.rows.map(function(x) { return nm(x.manager); }).join(', ') + ' ' + r.count;
  if (r.opponent === undefined) return label + ': ' + nm(r.manager) + ' ' + fmt2(r.pf) + ' (' + r.season + ')';
  return label + ': ' + nm(r.manager) + ' ' + fmt2(r.pf) + ' v ' + nm(r.opponent) + ' ' + fmt2(r.pa) + ' (' + r.result + ', ' + r.season + ' wk' + r.week + ')';
}

// Compact, number-safe recap for the Banter and Stats-chat prompts (Phase 3):
// this week, standings, champions, career lines, named records. Every number a
// roast may use is in here — the number guard checks replies against it.
function leagueRecap(facts, history) {
  if (!facts) return '';
  const out = [];
  const tw = thisWeekFacts(facts);
  if (tw) {
    out.push('THIS WEEK (' + tw.season + ' week ' + tw.week + '): ' + tw.games.map(function(g) {
      return nm(g.w.manager) + ' ' + fmt2(g.w.pf) + (g.tie ? ' tied ' : ' beat ') + nm(g.l.manager) + ' ' + fmt2(g.l.pf);
    }).join('; '));
    out.push('Week high: ' + nm(tw.high.manager) + ' ' + fmt2(tw.high.pf) + '. Week low: ' + nm(tw.low.manager) + ' ' + fmt2(tw.low.pf) + '.'
      + (tw.closest ? ' Closest: ' + nm(tw.closest.manager) + ' over ' + nm(tw.closest.opponent) + ' by ' + fmt2(tw.closest.margin) + '.' : '')
      + (tw.upset ? ' Upset: ' + nm(tw.upset.manager) + ' won with ' + fmt2(tw.upset.pf) + (tw.upset.weekRank ? ' (rank ' + tw.upset.weekRank + ' that week)' : '') + '.' : ''));
    out.push('STANDINGS ' + tw.season + ' (rank name W-L PF streak):\n' + tw.standings.map(function(r) {
      return r.rank + ' ' + nm(r.manager) + ' ' + r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '') + ' ' + fmt2(r.pf) + ' ' + r.streak;
    }).join('\n'));
  }
  const seasons = (history && history.seasons) || [];
  const champs = seasons.filter(function(s) { return s.champion; }).map(function(s) { return s.season + ' ' + nm(s.champion); });
  if (champs.length) out.push('CHAMPIONS: ' + champs.join(', '));
  const career = {};
  facts.seasons.forEach(function(r) {
    const c = career[r.manager] = career[r.manager] || { w: 0, l: 0, t: 0, pf: 0, titles: 0, xw: 0 };
    c.w += r.wins; c.l += r.losses; c.t += r.ties; c.pf += r.pf; c.xw += r.expectedWins;
    if (r.playoffFinish === 'champion') c.titles++;
  });
  out.push('CAREER regular season (name W-L PF titles luck=W-expected):\n' + Object.keys(career).sort(function(a, b) { return career[b].w - career[a].w; }).map(function(m) {
    const c = career[m];
    return nm(m) + ' ' + c.w + '-' + c.l + (c.t ? '-' + c.t : '') + ' ' + fmt2(c.pf) + ' ' + c.titles + ' ' + fmt2(c.w - c.xw);
  }).join('\n'));
  const lines = [];
  RECORD_NAMES.forEach(function(name) {
    if (name === 'currentStreaks') return;
    const v = validateSpec({ v: 2, table: 'record', record: name }, facts);
    if (!v.ok) return;
    const line = recordLine(name, runQuery(v.spec, facts, []));
    if (line) lines.push(line);
  });
  if (lines.length) out.push('RECORDS (regular season):\n' + lines.join('\n'));
  return out.join('\n\n');
}

// Banter guard: drop any sentence carrying a number that is not in `allowedText`.
function guardSentences(text, allowedText) {
  // Shield decimal points (151.40) so the sentence split only breaks on real stops.
  const DOT = '\u2024';
  const shielded = String(text || '').replace(/(\d)\.(\d)/g, '$1' + DOT + '$2');
  const parts = shielded.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [];
  const unshield = function(p) { return p.split(DOT).join('.'); };
  const kept = parts.map(unshield).filter(function(p) { return numberGuard(p, [], [allowedText]).ok; });
  const out = kept.join('').trim();
  return { text: out, dropped: parts.length - kept.length };
}
