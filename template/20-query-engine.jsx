// ── Deterministic stats query engine ─────────────────────────────────────────
// Flattens every game (canonicalised handles) into one list the query engine
// reads from. Never lets the model do arithmetic — JS computes, model narrates.
function flattenGames(history) {
  const seasons = (history && history.seasons) ? history.seasons : [];
  const rows = [];
  for (const s of seasons) {
    for (const g of (s.games || [])) {
      if (!(g.pa > 0 || g.pb > 0)) continue; // skip unplayed
      rows.push({ season: s.season, week: g.week, playoff: !!g.playoff, a: canonical(g.a), b: canonical(g.b), pa: g.pa, pb: g.pb });
    }
  }
  return rows;
}

// Executes a constrained query spec against flattened games. Pure + deterministic.
function runStatQuery(spec, games, players) {
  if (!spec || spec.type === 'none') return null;
  const regOnly = spec.regularSeasonOnly !== false; // default true
  const seasonSet = Array.isArray(spec.seasons) && spec.seasons.length ? new Set(spec.seasons.map(String)) : null;
  const mgrSet = Array.isArray(spec.managers) && spec.managers.length ? new Set(spec.managers.map(canonical)) : null;

  let pool = games.filter(function(g) {
    if (regOnly && g.playoff) return false;
    if (seasonSet && !seasonSet.has(String(g.season))) return false;
    return true;
  });

  if (spec.type === 'headToHead') {
    // Build record between every ordered pair, then filter to requested managers.
    const rec = {};
    function cell(x, y) { const k = x + '|' + y; if (!rec[k]) rec[k] = { manager: x, opponent: y, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, games: 0 }; return rec[k]; }
    for (const g of pool) {
      const A = cell(g.a, g.b), B = cell(g.b, g.a);
      A.pf += g.pa; A.pa += g.pb; A.games++;
      B.pf += g.pb; B.pa += g.pa; B.games++;
      if (g.pa > g.pb) { A.wins++; B.losses++; }
      else if (g.pb > g.pa) { B.wins++; A.losses++; }
      else { A.ties++; B.ties++; }
    }
    let rows = Object.values(rec);
    if (mgrSet) {
      if (mgrSet.size === 2) {
        const [m1, m2] = Array.from(mgrSet);
        rows = rows.filter(function(r) { return (r.manager === m1 && r.opponent === m2) || (r.manager === m2 && r.opponent === m1); });
      } else {
        rows = rows.filter(function(r) { return mgrSet.has(r.manager); });
      }
    }
    rows.forEach(function(r) { r.pf = Math.round(r.pf * 100) / 100; r.pa = Math.round(r.pa * 100) / 100; r.winPct = r.games ? Math.round(r.wins / r.games * 1000) / 1000 : 0; });
    rows.sort(function(x, y) { return x.manager.localeCompare(y.manager) || y.games - x.games; });
    return { type: 'headToHead', rows: rows.slice(0, 25) };
  }

  if (spec.type === 'totals') {
    const acc = {};
    function row(m) { if (!acc[m]) acc[m] = { manager: m, games: 0, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, high: 0, low: Infinity }; return acc[m]; }
    for (const g of pool) {
      if (mgrSet && !mgrSet.has(g.a) && !mgrSet.has(g.b)) continue;
      const A = row(g.a), B = row(g.b);
      A.games++; B.games++;
      A.pf += g.pa; A.pa += g.pb; B.pf += g.pb; B.pa += g.pa;
      A.high = Math.max(A.high, g.pa); A.low = Math.min(A.low, g.pa);
      B.high = Math.max(B.high, g.pb); B.low = Math.min(B.low, g.pb);
      if (g.pa > g.pb) { A.wins++; B.losses++; } else if (g.pb > g.pa) { B.wins++; A.losses++; } else { A.ties++; B.ties++; }
    }
    let rows = Object.values(acc);
    if (mgrSet) rows = rows.filter(function(r) { return mgrSet.has(r.manager); });
    rows.forEach(function(r) {
      r.pf = Math.round(r.pf * 100) / 100; r.pa = Math.round(r.pa * 100) / 100;
      r.avg = r.games ? Math.round(r.pf / r.games * 100) / 100 : 0;
      if (r.low === Infinity) r.low = 0;
      r.winPct = r.games ? Math.round(r.wins / r.games * 1000) / 1000 : 0;
    });
    rows.sort(function(x, y) { return y.wins - x.wins || y.pf - x.pf; });
    return { type: 'totals', rows: rows.slice(0, 25) };
  }

  if (spec.type === 'gameList') {
    let rows = pool.slice();
    if (mgrSet) rows = rows.filter(function(g) { return mgrSet.has(g.a) || mgrSet.has(g.b); });
    const by = spec.sortBy || 'combined';
    function metric(g) {
      if (by === 'margin') return Math.abs(g.pa - g.pb);
      if (by === 'high') return Math.max(g.pa, g.pb);
      if (by === 'low') return Math.min(g.pa, g.pb);
      return g.pa + g.pb; // combined
    }
    const order = spec.order === 'asc' ? 1 : -1;
    rows.sort(function(x, y) { return (metric(x) - metric(y)) * order; });
    const limit = Math.min(spec.limit || 10, 25);
    return { type: 'gameList', rows: rows.slice(0, limit) };
  }

  if (spec.type === 'player') {
    // Per-player, per-season starter scoring (name / pos / manager / season /
    // games / total pts / avg / single-game best). Queried in JS; only matching
    // rows are handed to the narrator.
    const nameNeedle = spec.player ? String(spec.player).toLowerCase() : null;
    const posSet = Array.isArray(spec.positions) && spec.positions.length ? new Set(spec.positions.map(function(p) { return String(p).toUpperCase(); })) : null;
    const by = spec.sortBy === 'avg' ? 'avg' : (spec.sortBy === 'best' ? 'best' : (spec.sortBy === 'games' ? 'games' : 'pts'));
    // avg is misleading on tiny samples, so require a floor unless the query set one.
    const minGames = spec.minGames != null ? spec.minGames : (by === 'avg' ? 4 : 1);
    let rows = (players || []).filter(function(r) {
      if (nameNeedle && String(r.player).toLowerCase().indexOf(nameNeedle) === -1) return false;
      if (posSet && !posSet.has(r.pos)) return false;
      if (mgrSet && !mgrSet.has(canonical(r.manager))) return false;
      if (seasonSet && !seasonSet.has(String(r.season))) return false;
      if (r.games < minGames) return false;
      return true;
    });
    const order = spec.order === 'asc' ? 1 : -1;
    rows = rows.slice().sort(function(x, y) { return (x[by] - y[by]) * order; });
    const limit = Math.min(spec.limit || 10, 25);
    return { type: 'player', rows: rows.slice(0, limit) };
  }

  return null;
}

// Session cache: identical questions cost the model nothing the second time.
const SPEC_CACHE = {};
function cacheKey(q) { return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// Which known managers does this query name? Matches distinct display names and
// first names (case-insensitive, word-boundary) → canonical handles, de-duped.
function matchManagers(query) {
  const q = ' ' + String(query || '').toLowerCase() + ' ';
  const hits = [];
  Object.keys(NAMES).forEach(function(h) {
    const names = [distinctName(h), displayName(h)];
    for (let i = 0; i < names.length; i++) {
      const full = String(names[i] || '').toLowerCase();
      if (!full) continue;
      const candidates = [full].concat(full.split(' ')); // full name + each token (first name)
      for (let j = 0; j < candidates.length; j++) {
        const w = candidates[j];
        if (w.length < 3) continue;
        if (new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(q)) {
          if (hits.indexOf(h) === -1) hits.push(h);
          return; // this handle counted once
        }
      }
    }
  });
  return hits;
}

// Deterministic intent detection for the two common, unambiguous shapes, so the
// planner MODEL CALL is skipped on the majority path. Returns a spec or null
// (null → fall through to the model planner). Conservative by design: anything
// player/position-flavoured or ambiguous is left to the model.
const PLAYER_HINT = /\b(wr|rb|qb|te|def|kicker|\bk\b|player|players|scorer|scorers|scored|touchdown|position|positions)\b/i;
const H2H_HINT    = /\b(vs\.?|versus|against|head[\s-]?to[\s-]?head|h2h|beat|beaten|record against)\b/i;
const TOTALS_HINT = /\b(standings|all[\s-]?time (table|standings|record)|win totals?|most wins|best (record|team)|career (record|wins)|rankings?|league table)\b/i;
function fastPlan(query) {
  if (PLAYER_HINT.test(query)) return null;      // player scoring → model
  const mgrs = matchManagers(query);
  if (H2H_HINT.test(query) && mgrs.length >= 2) {
    return { type: 'headToHead', managers: mgrs };
  }
  if (TOTALS_HINT.test(query) && mgrs.length <= 1) {
    return { type: 'totals', managers: mgrs.length === 1 ? mgrs : undefined };
  }
  return null;
}

// Asks the model to translate a question into a query spec (JSON only).
// Fast-path (no model call) for common H2H/totals questions, then a session
// cache, then the model planner as the general fallback.
async function planStatQuery(query, messages) {
  const key = cacheKey(query);
  if (SPEC_CACHE[key]) return SPEC_CACHE[key];
  const fast = fastPlan(query);
  if (fast) { SPEC_CACHE[key] = fast; return fast; }

  const handles = Object.keys(NAMES);
  const nameLines = handles.map(function(h) { return h + '=' + distinctName(h); }).join(', ');
  const planner = [
    'You translate a fantasy-football question into a JSON query spec. Output ONLY valid JSON, nothing else.',
    'Manager handles (use these exact strings in "managers"): ' + nameLines + '. Note benjlev=Lev, sanfbe=Sanford, allyl900 maps to AlastairL.',
    'Schema:',
    '{ "type": "headToHead" | "totals" | "gameList" | "player" | "none",',
    '  "managers": [handle, ...]   // optional; for headToHead between two, list both',
    '  "seasons": ["2023", ...]    // optional; omit for all-time',
    '  "regularSeasonOnly": true,  // default true; set false to include playoffs',
    '  "sortBy": "margin"|"high"|"low"|"combined",  // gameList: margin/high/low/combined; player: "pts"|"avg"|"best"|"games"',
    '  "order": "desc"|"asc",      // gameList & player',
    '  "limit": 10,                // gameList & player',
    '  "player": "chase",          // player only: substring of the player name',
    '  "positions": ["WR"] }       // player only: filter by QB/RB/WR/TE/K/DEF',
    'headToHead with exactly two managers = the record between that pair. With three or more managers = each listed manager\'s record against ALL opponents. Omit "managers" for the whole league.',
    'Rules: head-to-head / nemesis / "who beats whom" -> headToHead. Manager records/standings/win totals/points -> totals. "biggest/closest/highest GAME" -> gameList. Individual NFL PLAYERS ("best WR", "top scorers", "most points by a QB", "how did Ja\'Marr Chase do", "who scored most for Lev") -> player (set "player" for a named player, "positions" for a position, "managers" for whose roster, "sortBy":"avg" for per-game rate vs "pts" for totals). If the question is not a numeric data lookup (opinion, definition, lore) -> {"type":"none"}.',
  ].join('\n');
  try {
    const raw = await claudeCall(messages.slice(-6), planner);
    const spec = parseSpec(raw);
    SPEC_CACHE[key] = spec;
    return spec;
  } catch (e) {
    return { type: 'none' };
  }
}

// Tolerant JSON extraction: whole reply → outermost braces → first {...} match.
function parseSpec(raw) {
  if (!raw) return { type: 'none' };
  try { return JSON.parse(raw.trim()); } catch (e) { /* not bare JSON */ }
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch (e) { /* fall through */ }
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { /* fall through */ } }
  return { type: 'none' };
}

// Renders a query result into a deterministic context block the narrator reads.
function formatQueryResult(spec, result) {
  if (!result || !result.rows || !result.rows.length) return '';
  function nm(h) { return distinctName(h); }
  const lines = [];
  if (result.type === 'headToHead') {
    lines.push('Head-to-head records (regular season unless stated):');
    result.rows.forEach(function(r) { lines.push('- ' + nm(r.manager) + ' vs ' + nm(r.opponent) + ': ' + r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '') + ', PF ' + r.pf + ' / PA ' + r.pa + ' (' + r.games + ' games)'); });
  } else if (result.type === 'totals') {
    lines.push('Aggregate records:');
    result.rows.forEach(function(r) { lines.push('- ' + nm(r.manager) + ': ' + r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '') + ', PF ' + r.pf + ', avg ' + r.avg + ', high ' + r.high + ', low ' + r.low + ' (' + r.games + ' games)'); });
  } else if (result.type === 'gameList') {
    lines.push('Matching games:');
    result.rows.forEach(function(g) { lines.push('- ' + g.season + ' wk' + g.week + (g.playoff ? ' (playoff)' : '') + ': ' + nm(g.a) + ' ' + g.pa + ' – ' + g.pb + ' ' + nm(g.b)); });
  } else if (result.type === 'player') {
    lines.push('Player scoring (starter points, per player · season · manager):');
    result.rows.forEach(function(p) { lines.push('- ' + p.player + ' (' + p.pos + ', ' + nm(p.manager) + ' ' + p.season + '): ' + p.pts + ' pts over ' + p.games + ' games, ' + p.avg + '/game, best ' + p.best); });
  }
  return '══ DETERMINISTIC QUERY RESULT (authoritative — narrate ONLY these numbers, do not recompute) ══\n' + lines.join('\n');
}

function useLeagueData() {
  const [data, setData] = useState({ history: HISTORY_DATA, stats: STATS_DATA, rosters: ROSTERS_DATA, trades: TRADE_VALUES, alltime: ALLTIME_DATA, transactions: TRANSACTIONS_DATA, players: PLAYER_SCORES, live: false });
  useEffect(function() {
    let cancelled = false;
    (async function() {
      for (let i = 0; i < DATA_SOURCES.length; i++) {
        try {
          const urls = DATA_SOURCES[i];
          const keys = Object.keys(urls);
          const fetched = await Promise.all(keys.map(function(k) {
            return fetch(urls[k] + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
          }));
          const result = { live: true };
          keys.forEach(function(k, idx) { result[k] = fetched[idx]; });
          if (!cancelled) setData(result);
          return;
        } catch (e) { /* try next */ }
      }
    })();
    return function() { cancelled = true; };
  }, []);
  return data;
}

function useLore(active) {
  const [lore, setLore] = useState({ master: '', archive: [], quotes: [], ready: false });
  const fetchedRef = useRef(false);
  useEffect(function() {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async function() {
      for (let i = 0; i < LORE_SOURCES.length; i++) {
        try {
          const urls = LORE_SOURCES[i];
          const [mData, aData, qData] = await Promise.all([
            fetch(urls.master + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
            fetch(urls.archive + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
            fetch(urls.quotes + BUST).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
          ]);
          if (!cancelled) setLore({ master: mData.text || '', archive: aData || [], quotes: qData || [], ready: true });
          return;
        } catch(e) { /* try next source */ }
      }
    })();
    return function() { cancelled = true; };
  }, [active]);
  return lore;
}

function retrieveLore(query, archive, quotes) {
  const MAX = 3500;
  if (!query || (!archive.length && !quotes.length)) return '';
  const STOP = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','and','but','or','not','so','yet','no','only','than','too','very','just','now','for','with','about','from','into','before','after','out','over','under','then','once','in','on','at','by','of','to','up','down','off','me','my','we','our','you','your','he','his','she','her','it','its','they','them','their','what','which','who','this','that','these','those','some','any','all','when','where','how','why']);
  const tokens = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function(t) { return t.length > 2 && !STOP.has(t); });
  if (!tokens.length) return '';

  const PMAP = {
    dan:'Daniel Polak', daniel:'Daniel Polak', polak:'Daniel Polak', commissioner:'Daniel Polak',
    saul:'Saul Freedman', freedman:'Saul Freedman', goat:'Saul Freedman',
    alastair:'Alastair Livingston', ally:'Alastair Livingston', livingston:'Alastair Livingston',
    gideon:'Gideon Sakofsky', sac:'Gideon Sakofsky', sakofsky:'Gideon Sakofsky',
    josh:'Josh Gaon', gaon:'Josh Gaon', trader:'Josh Gaon',
    jamie:'Jamie Kay', kay:'Jamie Kay', doctor:'Jamie Kay',
    lev:'Benjy Levey', levey:'Benjy Levey', autodraft:'Benjy Levey',
    sanford:'Benjy Sanford', snaff:'Benjy Sanford', darkwa:'Benjy Sanford',
  };
  const mentioned = new Set();
  tokens.forEach(function(t) { if (PMAP[t]) mentioned.add(PMAP[t]); });

  const parts = [];

  // Matching quote lines for mentioned people
  if (quotes.length && mentioned.size) {
    quotes.forEach(function(chunk) {
      if (mentioned.has(chunk.person)) {
        const sample = (chunk.lines || []).slice(0, 10).join('\n');
        if (sample) parts.push('QUOTES — ' + chunk.person + ':\n' + sample);
      }
    });
  }

  // Score archive chunks
  if (archive.length) {
    const yearMatch = query.match(/\b(201[7-9]|202[0-6])\b/);
    const scored = archive.map(function(chunk) {
      const haystack = (chunk.title + ' ' + chunk.text).toLowerCase();
      let score = tokens.reduce(function(s, t) { return s + (haystack.split(t).length - 1); }, 0);
      if (yearMatch && String(chunk.year) === yearMatch[1]) score += 8;
      mentioned.forEach(function(nm) {
        score += (haystack.split(nm.split(' ')[0].toLowerCase()).length - 1) * 2;
      });
      return { chunk: chunk, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    scored.slice(0, 2).forEach(function(x) {
      if (x.score > 1) parts.push('ARCHIVE — ' + x.chunk.title + ':\n' + x.chunk.text.slice(0, 1800));
    });
  }

  return parts.join('\n\n---\n\n').slice(0, MAX);
}

function useViewport() {
  const [keyboardOpen, setKb] = useState(false);
  useEffect(function() {
    const vv = window.visualViewport;
    function apply() {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-h', h + 'px');
      setKb((window.innerHeight - h) > 120);
    }
    apply();
    if (vv) { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply); }
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return function() {
      if (vv) { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); }
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
  return { keyboardOpen: keyboardOpen };
}

function renderInline(str, kb) {
  return str.split(/(\*\*[^*]+\*\*)/g).map(function(p, i) {
    if (/^\*\*[^*]+\*\*$/.test(p)) return React.createElement('strong', { key: kb + '-' + i }, p.slice(2, -2));
    return React.createElement('span', { key: kb + '-' + i }, p);
  });
}
function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function(c) { return c.trim(); });
}
