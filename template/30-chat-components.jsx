function MarkdownMessage(props) {
  const lines = String(props.text || '').split('\n');
  const out = [];
  let i = 0, key = 0;
  function isRow(l) { return /^\s*\|.*\|\s*$/.test(l); }
  function isSep(l) { return /^\s*\|[\s:|-]+\|\s*$/.test(l); }
  while (i < lines.length) {
    const line = lines[i];
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      const tbl = React.createElement('div', { key: key++, style: { overflowX: 'auto', margin: '8px 0' } },
        React.createElement('table', { className: 'md-table' },
          React.createElement('thead', null, React.createElement('tr', null, header.map(function(h, j) { return React.createElement('th', { key: j }, renderInline(h, 'h' + j)); }))),
          React.createElement('tbody', null, rows.map(function(r, ri) { return React.createElement('tr', { key: ri }, r.map(function(c, ci) { return React.createElement('td', { key: ci }, renderInline(c, ri + '-' + ci)); })); }))
        )
      );
      out.push(tbl);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !(isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))) { para.push(lines[i]); i++; }
    const children = [];
    for (let li = 0; li < para.length; li++) {
      const inlined = renderInline(para[li], key + '-' + li);
      inlined.forEach(function(el) { children.push(el); });
      if (li < para.length - 1) children.push(React.createElement('br', { key: 'br-' + li }));
    }
    out.push(React.createElement('p', { key: key++, style: { margin: '0 0 7px', lineHeight: 1.55 } }, children));
  }
  return React.createElement(React.Fragment, null, out);
}

function ChatTab(props) {
  const { systemPrompt, chips, placeholder, errorMsg, intro, buildContext } = props;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(function() { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  function autoResize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }

  async function send(text) {
    const t = (text || input).trim();
    if (!t || loading) return;
    const next = messages.concat([{ role: 'user', content: t }]);
    setMessages(next); setInput(''); setLoading(true);
    if (taRef.current) taRef.current.style.height = 'auto';
    try {
      const extra = buildContext ? await buildContext(t, next) : '';
      const fullPrompt = extra ? systemPrompt + '\n\n' + extra : systemPrompt;
      const raw = await claudeCall(next.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; }), fullPrompt);
      const reply = raw.replace(/\[(FACT|MYTH|REAL|EVENT)\]/g, '').replace(/  +/g, ' ').trim();
      setMessages(function(p) { return p.concat([{ role: 'assistant', content: reply }]); });
    } catch (e) {
      const txt = (e && e.message === 'MODEL_ERROR') ? 'Model hiccup — try again.' : errorMsg;
      setMessages(function(p) { return p.concat([{ role: 'error', content: txt }]); });
    } finally { setLoading(false); }
  }

  const bubUser = { alignSelf: 'flex-end', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '11px 15px', maxWidth: '82%', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', boxShadow: '0 3px 14px rgba(99,102,241,0.3)' };
  const bubAsst = { alignSelf: 'flex-start', background: '#141e32', color: '#e8f1ff', border: '1px solid #24344e', borderLeft: '3px solid #6366f1', borderRadius: '4px 18px 18px 18px', padding: '12px 15px', maxWidth: '88%', fontSize: 15, lineHeight: 1.6 };
  const bubErr  = { alignSelf: 'flex-start', background: '#141e32', color: '#f59e0b', border: '1px solid #24344e', borderLeft: '3px solid #f59e0b', borderRadius: '4px 18px 18px 18px', padding: '12px 15px', maxWidth: '88%', fontSize: 15, whiteSpace: 'pre-wrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid ' + T.border, overflowX: 'auto', flexShrink: 0, background: T.panel }}>
        {chips.map(function(c, i) {
          return <button key={i} className="chip" onClick={function() { send(c); }} disabled={loading}>{c}</button>;
        })}
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: T.faint, fontSize: 14, maxWidth: 300, lineHeight: 1.7, padding: '20px 8px' }}>{intro}</div>
        )}
        {messages.map(function(m, i) {
          if (m.role === 'assistant') return <div key={i} style={bubAsst}><MarkdownMessage text={m.content} /></div>;
          if (m.role === 'error') return <div key={i} style={bubErr}>{m.content}</div>;
          return <div key={i} style={bubUser}>{m.content}</div>;
        })}
        {loading && (
          <div style={bubAsst}>
            <span className="ld" /><span className="ld" /><span className="ld" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid ' + T.border, background: T.panel, flexShrink: 0 }}>
        <textarea ref={taRef} rows={1} value={input}
          onChange={function(e) { setInput(e.target.value); }}
          onInput={autoResize}
          onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          style={{ flex: 1, background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 11, padding: '12px 13px', fontSize: 16, resize: 'none', outline: 'none', lineHeight: 1.4 }}
        />
        <button onClick={function() { send(); }} disabled={loading || !input.trim()} className="send-btn" style={{ opacity: (loading || !input.trim()) ? 0.4 : 1 }}>SEND</button>
      </div>
    </div>
  );
}

function slimAlltime(d) {
  if (!d) return d;
  // weeklyScores (raw per-game scores) and h2hBySeason (covered by deterministic query layer)
  // are excluded to keep the system prompt within the artifact runtime's prompt budget.
  // records games have player-name arrays stripped — scores and teams are sufficient for narration.
  function stripGame(g) {
    if (!g || typeof g !== 'object') return g;
    const { as, bs, ab, bb, ...rest } = g;
    return rest;
  }
  const records = {};
  for (const [k, v] of Object.entries(d.records || {})) {
    records[k] = Array.isArray(v) ? v.map(stripGame) : stripGame(v);
  }
  const { weeklyScores, h2hBySeason, records: _r, ...rest } = d;
  return { ...rest, records };
}

// ── Compact prompt encoders (token-lean: no repeated JSON keys) ───────────────
// Pipe-delimited tables beat JSON for tabular data — one header line, then rows,
// so a field name is paid for once instead of once per manager. The big matrices
// (allTimeH2H, weeklyScores, per-season boards) are dropped from the prompt
// entirely — the deterministic query engine answers those exactly on demand.
function tsv(cols, rows) {
  return [cols.join('|')].concat((rows || []).map(function(r) {
    return cols.map(function(c) { const v = r[c]; return v == null ? '' : v; }).join('|');
  })).join('\n');
}
// Career table from computeAnalytics().allTime — carries record, pf/pa, avg, the
// consistency SD, all-time high/low, all-play and the luck (actual−expected wins).
function careerTable(allTime) {
  return tsv(['name', 'rec', 'pf', 'pa', 'avg', 'SD', 'hi', 'lo', 'allPlay', 'apW%', 'xW', 'luck'],
    (allTime || []).map(function(m) {
      return { name: m.alias || m.name, rec: m.record, pf: m.pf, pa: m.pa, avg: m.avgScore,
        SD: m.consistencySD, hi: m.high, lo: m.low, allPlay: m.allPlay, 'apW%': m.allPlayWinPct,
        xW: m.expectedWins, luck: m.luck };
    }));
}
// Everything from alltime.json that the career table does NOT already cover,
// encoded compactly: playoff records, nemesis/bunny, all-time record games,
// per-season finish trend, and positional strengths.
function alltimeSummary(d) {
  if (!d) return '';
  const out = [];
  const g = function(x) { return x ? (distinctName(x.a) + ' ' + x.pa + '-' + x.pb + ' ' + distinctName(x.b) + ' [' + x.season + ' wk' + x.week + ']') : ''; };

  const pr = d.playoffRecords || {};
  const prRows = Object.keys(pr).map(function(h) { const r = pr[h]; return { name: distinctName(h), rec: r.wins + '-' + r.losses, apps: r.appearances, pf: r.pf, pa: r.pa }; });
  if (prRows.length) out.push('PLAYOFFS (W-L, apps=appearances):\n' + tsv(['name', 'rec', 'apps', 'pf', 'pa'], prRows));

  if (d.nemesis) out.push('NEMESIS (worst matchup, min 3 mtgs): ' + Object.keys(d.nemesis).map(function(h) { const n = d.nemesis[h]; return distinctName(h) + '→' + distinctName(n.opponent) + '(' + n.wins + '-' + n.losses + ')'; }).join('; '));
  if (d.bunny)   out.push('BUNNY (best matchup, min 3 mtgs): '   + Object.keys(d.bunny).map(function(h)   { const b = d.bunny[h];   return distinctName(h) + '→' + distinctName(b.opponent) + '(' + b.wins + '-' + b.losses + ')'; }).join('; '));

  const rec = d.records || {};
  const rl = [];
  if (rec.highestScore)  rl.push('highest game: ' + g(rec.highestScore));
  if (rec.lowestScore)   rl.push('lowest game: ' + g(rec.lowestScore));
  if (rec.biggestWin)    rl.push('biggest blowout: ' + g(rec.biggestWin));
  if (rec.closestGame)   rl.push('closest game: ' + g(rec.closestGame));
  if (rec.highestSeason) rl.push('highest season PF: ' + distinctName(rec.highestSeason.manager) + ' ' + rec.highestSeason.pf + ' (' + rec.highestSeason.season + ')');
  if (rec.lowestSeason)  rl.push('lowest season PF: ' + distinctName(rec.lowestSeason.manager) + ' ' + rec.lowestSeason.pf + ' (' + rec.lowestSeason.season + ')');
  if (rec.longestWinStreak)  rl.push('longest W streak: ' + distinctName(rec.longestWinStreak.manager) + ' ' + rec.longestWinStreak.streak);
  if (rec.longestLossStreak) rl.push('longest L streak: ' + distinctName(rec.longestLossStreak.manager) + ' ' + rec.longestLossStreak.streak);
  if (rl.length) out.push('RECORDS:\n' + rl.join('\n'));

  // Per-season finish trend: "name: 2023 r3 108ppg, 2024 r1 121ppg, ..."
  if (d.seasonalTrends) {
    const tl = Object.keys(d.seasonalTrends).map(function(h) {
      const arr = d.seasonalTrends[h] || [];
      return distinctName(h) + ': ' + arr.map(function(t) { return t.season + ' r' + t.rank + ' ' + t.ppg + 'ppg'; }).join(', ');
    });
    if (tl.length) out.push('SEASON TREND (r=finish rank, ppg=points/game):\n' + tl.join('\n'));
  }

  // Positional strengths: latest season only, avg pts/game by position.
  if (d.positionalStrengths) {
    const rows = [];
    Object.keys(d.positionalStrengths).forEach(function(h) {
      const seasonsObj = d.positionalStrengths[h] || {};
      const yrs = Object.keys(seasonsObj).sort();
      const last = yrs[yrs.length - 1];
      if (!last) return;
      const p = seasonsObj[last];
      rows.push({ name: distinctName(h), yr: last, QB: p.QB, RB: p.RB, WR: p.WR, TE: p.TE, K: p.K, DEF: p.DEF });
    });
    if (rows.length) out.push('POSITIONAL avg pts/game (latest season):\n' + tsv(['name', 'yr', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'], rows));
  }
  return out.join('\n\n');
}
// One line per completed trade — compact vs JSON's repeated keys.
function tradesLines(txns) {
  const list = Array.isArray(txns) ? txns : ((txns && txns.items) || []);
  if (!list.length) return '(none on record)';
  return list.map(function(t) {
    const a = (t.aReceives || []).join(', '), b = (t.bReceives || []).join(', ');
    return t.season + ' wk' + t.week + ': ' + distinctName(t.managerA) + ' gets [' + a + '] ↔ ' + distinctName(t.managerB) + ' gets [' + b + ']';
  }).join('\n');
}
// Current-season standings + extremes, compact.
function currentSeasonBlock(statsData) {
  if (!statsData) return '(no current-season data)';
  const st = (statsData.standings || []).map(function(r, i) {
    return { rk: i + 1, name: distinctName(r.manager), rec: (r.wins || 0) + '-' + (r.losses || 0), pf: r.pf, pa: r.pa };
  });
  let s = 'season ' + statsData.season + '\n' + tsv(['rk', 'name', 'rec', 'pf', 'pa'], st);
  if (statsData.extremes) s += '\nextremes: ' + JSON.stringify(statsData.extremes);
  return s;
}

// Per-season champion + condensed standings (no games) — for the banter prompt.
function slimHistory(d) {
  const seasons = (d && d.seasons) ? d.seasons : [];
  return seasons.map(function(s) {
    return {
      season: s.season,
      champion: s.champion ? distinctName(s.champion) : null,
      standings: (s.standings || []).map(function(r) { return { manager: distinctName(r.manager), wins: r.wins, losses: r.losses, pf: r.pf }; }),
    };
  });
}

function StatsTab(props) {
  const { historyData, statsData, alltimeData, transactionsData, playersData, loreMaster } = props;
  const analytics = useMemo(function() { return computeAnalytics(historyData); }, [historyData]);
  const games = useMemo(function() { return flattenGames(historyData); }, [historyData]);
  const loreCtx = loreMaster
    ? '\n\nLEAGUE CONTEXT (names, champions, glossary — for resolving names only, NOT for inventing stats):\n' + loreMaster.slice(0, 2500)
    : '';
  // Narration prompt: deterministic pre-computed tables ONLY — no raw game dump,
  // so the model cannot do its own (error-prone) win/loss arithmetic. Anything
  // not in the tables arrives via the DETERMINISTIC QUERY RESULT block (buildContext).
  const sp = 'You are the statistician for the Borehamwood Plancy League. Answer ONLY from the data below — NEVER compute or invent numbers yourself.\n\n'
    + 'CRITICAL: All win/loss/points figures must be read verbatim from the tables below or the DETERMINISTIC QUERY RESULT block. Do NOT add up games or derive records yourself — if a number is not given to you, say you do not have it rather than estimate.\n\n'
    + 'NAMES: always use the real NAME shown in the tables, never a Sleeper handle. Two Benjys: Lev and Sanford.\n\n'
    + 'ANSWER FORMAT: 1) ONE short sentence on method. 2) GitHub Markdown table for any ranking. 3) At most ONE closing sentence. No preamble.\n\n'
    + 'TABLES BELOW are pipe-delimited (header row, then one row per manager). Column key — '
    + 'rec=record W-L; pf/pa=points for/against; avg=avg score; SD=consistency (lower=steadier); hi/lo=best/worst single game; '
    + 'allPlay=record vs the whole league each week; apW%=all-play win%; xW=expected wins; luck=actual−expected wins (+lucky, −unlucky).\n\n'
    + 'ANYTHING NOT IN THESE TABLES — a specific head-to-head, a per-season H2H, a game list, individual NFL player scoring — arrives via the DETERMINISTIC QUERY RESULT block appended below when relevant. Do not guess it from the tables.'
    + loreCtx
    + '\n\nCAREER (all-time, regular season):\n' + careerTable(analytics.allTime)
    + '\n\n' + alltimeSummary(slimAlltime(alltimeData))
    + '\n\nTRADES:\n' + tradesLines(transactionsData)
    + '\n\nCURRENT SEASON:\n' + currentSeasonBlock(statsData);

  // buildContext: deterministic query layer. Plan → execute in JS → inject result.
  // Plans from the running conversation (not just the latest line) so follow-ups
  // like "and in 2024?" resolve their referents.
  async function buildContext(query, conversation) {
    try {
      const convo = (conversation && conversation.length) ? conversation : [{ role: 'user', content: query }];
      const spec = await planStatQuery(query, convo);
      const result = runStatQuery(spec, games, playersData);
      return formatQueryResult(spec, result);
    } catch (e) { return ''; }
  }

  return <ChatTab systemPrompt={sp} buildContext={buildContext} chips={['All-time standings', 'Unluckiest manager?', 'Most consistent scorer?', 'Biggest bench disasters?']} placeholder="Message…" errorMsg="Something went wrong — try again." intro="The record book — career records, luck ratings, playoff history, consistency. Ask about personal bests, positional strengths, or any head-to-head." />;
}

function BanterTab(props) {
  const { historyData, statsData, alltimeData, lore } = props;

  const banterPrompt = useMemo(function() {
    const rule = [
      '══ PRIME DIRECTIVE ══',
      'You are the resident wind-up merchant of the Borehamwood Plancy League.',
      'STYLE: ESPN mock-grandeur, bone-dry British wit, mock gravity. Punchy 3-5 sentences. Lean on Jewish/Borehamwood texture. Sign off big beats with "a hearty hearty mazel tov."',
      'Never be cruel — mockery is the love language. Never invent statistics.',
      '',
      'CRITICAL OUTPUT RULE: NEVER print tag labels like [FACT], [MYTH], [REAL], or [EVENT] in your response. These are internal reasoning cues only — your output must read as natural chat, no square-bracket annotations of any kind.',
      '',
      'VERIFICATION RULE: Before stating any league result, score, record, or season outcome, verify it against RAW HISTORY and CURRENT SEASON below. If the event predates our data (pre-2023), you may reference it but must treat it as unverified lore rather than confirmed fact. Never contradict the data.',
      '',
      '══ LORE MASTER ══',
    ].join('\n');

    // Slim summaries only — raw JSON dumps blew the prompt budget (the repo's
    // own <20 KB rule). Champions + standings, all-time records, current-season
    // standings/extremes are enough to verify any claim the bot makes.
    const statsSummary = statsData ? { league: statsData.league, season: statsData.season, standings: statsData.standings, extremes: statsData.extremes } : null;
    const dataSection = '\n\n══ VERIFIED DATA (check all facts here first) ══'
      + '\n\nSEASON HISTORY (champions + standings):\n' + JSON.stringify(slimHistory(historyData))
      + '\n\nCURRENT SEASON:\n' + JSON.stringify(statsSummary)
      + '\n\nALL-TIME RECORDS:\n' + JSON.stringify(slimAlltime(alltimeData));
    if (DEBUG) console.log('banter prompt bytes:', (rule + (lore.master || '') + dataSection).length);

    if (lore.master) return rule + '\n' + lore.master + dataSection;

    // Fallback when lore files haven't loaded yet
    return rule + '\nChampions (most recent first): Alastair Livingston 2025 (first legit Plancey — beat Polak in final), Saul Freedman 2024+2023+2021+2017 (4 belts, the GOAT), Benjy Levey 2022, Jamie Kay 2020, Josh Gaon 2019, Gideon Sakofsky 2018, Alastair Livingston inaugural (asterisked).'
      + '\nThe Miriam = wooden spoon. Sanford = king of the Miriam. Lev = autodraft legend ("Does it auto-draft automatically?"). Dan = Commissioner/narrator. Gideon lives in Israel (4am watches). The Plancey = championship belt named after Rabbi Alan Plancey.'
      + '\nTWO BENJYS: benjlev=Lev, sanfbe=Sanford. allyl900=Alastair.'
      + '\nNAME MAP: ' + JSON.stringify(NAMES)
      + dataSection;
  }, [lore.master, historyData, statsData, alltimeData]);

  function buildContext(query) {
    if (!lore.ready) return '';
    const lore_ctx = retrieveLore(query, lore.archive, lore.quotes);
    return lore_ctx ? '--- RETRIEVED LORE ---\n' + lore_ctx : '';
  }

  return <ChatTab
    systemPrompt={banterPrompt}
    buildContext={buildContext}
    chips={['Roast the 2025 champion', 'Most cursed manager?', "This week's smack bulletin", 'Roast Lev']}
    placeholder="Message…"
    errorMsg="Blimey — give it another go."
    intro="Pull up a chair. Ask for a roast, a smack-talk bulletin, or just stir the pot."
  />;
}

function normalizeName(str) { return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }

function TradeGrader(props) {
  const { rostersData, tradeValues } = props;
  const teamKeys = useMemo(function() { return Object.keys(rostersData || {}); }, [rostersData]);
  const [teamA, setTeamA] = useState(teamKeys[0] || '');
  const [teamB, setTeamB] = useState(teamKeys[1] || '');
  const [sideAText, setSideAText] = useState('');
  const [sideBText, setSideBText] = useState('');
  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [vLoading, setVL] = useState(false);
  const [vError, setVE] = useState(false);
  const [showWaiver, setShowWaiver] = useState(true);

  useEffect(function() {
    if (document.getElementById('tg-spin')) return;
    const s = document.createElement('style');
    s.id = 'tg-spin';
    s.textContent = '@keyframes tg-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }, []);

  const { idMap, nameMap } = useMemo(function() {
    const id = new Map(), nm = new Map();
    (tradeValues || []).forEach(function(item) {
      const p = item.player, val = item.redraftValue || 0;
      if (p.sleeperId) id.set(p.sleeperId, { value: val, officialName: p.name, position: p.position });
      nm.set(normalizeName(p.name), { value: val, sleeperId: p.sleeperId, officialName: p.name, position: p.position });
    });
    return { idMap: id, nameMap: nm };
  }, [tradeValues]);

  const waiverByPos = useMemo(function() {
    const rostered = new Set(Object.values(rostersData || {}).reduce(function(acc, team) { return acc.concat(team.map(function(p) { return p.id; })); }, []));
    const avail = (tradeValues || []).filter(function(x) { return x.player.sleeperId && !rostered.has(x.player.sleeperId); });
    const byPos = {};
    avail.forEach(function(p) {
      const pos = p.player.position;
      if (!byPos[pos]) byPos[pos] = [];
      if (byPos[pos].length < 5) byPos[pos].push(p);
    });
    return byPos;
  }, [rostersData, tradeValues]);

  function lookupPlayer(txt) {
    const n = normalizeName(txt);
    const hit = function(e) { return { found: true, value: e.value, officialName: e.officialName, position: e.position }; };
    // 1) exact
    if (nameMap.has(n)) return hit(nameMap.get(n));
    if (n.length < 2) return { found: false, value: 0, officialName: txt, position: null };
    // 2) prefix match (only for reasonably specific input) — "josh alle" -> "josh allen"
    if (n.length >= 4) { for (const [k, e] of nameMap) { if (k.startsWith(n)) return hit(e); } }
    // 3) all input tokens present in the name — "allen josh" -> "josh allen"
    const toks = n.split(' ').filter(Boolean);
    for (const [k, e] of nameMap) {
      if (toks.every(function(t) { return k.indexOf(t) !== -1; })) return hit(e);
    }
    return { found: false, value: 0, officialName: txt, position: null };
  }

  function gradeTrade() {
    function parse(txt) { return txt.split('\n').map(function(l) { return l.trim(); }).filter(Boolean).map(function(line) { return Object.assign({ input: line }, lookupPlayer(line)); }); }
    const sA = parse(sideAText), sB = parse(sideBText);
    const tA = sA.reduce(function(s, p) { return s + p.value; }, 0);
    const tB = sB.reduce(function(s, p) { return s + p.value; }, 0);
    const gap = Math.abs(tA - tB), gapPct = (gap / Math.max(tA, tB, 1)) * 100;
    const winner = gapPct < 5 ? 'even' : tA > tB ? 'A' : 'B';
    const tier = gapPct < 5 ? 'DEAD EVEN' : gapPct < 12 ? 'SLIGHT EDGE' : gapPct < 25 ? 'CLEAR WINNER' : 'LOPSIDED';
    const icon = gapPct < 5 ? '⚖️' : gapPct < 12 ? '📊' : gapPct < 25 ? '🏆' : '🚨';
    let addOns = [];
    if (winner !== 'even') {
      const wTeam = winner === 'A' ? teamA : teamB;
      const wSide = winner === 'A' ? sA : sB;
      const exclude = new Set(wSide.map(function(p) { return p.officialName; }));
      addOns = ((rostersData || {})[wTeam] || [])
        .map(function(rp) { return { name: idMap.has(rp.id) ? idMap.get(rp.id).officialName : rp.name, value: idMap.has(rp.id) ? idMap.get(rp.id).value : 0 }; })
        .filter(function(rp) { return !exclude.has(rp.name) && rp.value > 0; })
        .sort(function(a, b) { return Math.abs(a.value - gap) - Math.abs(b.value - gap); })
        .slice(0, 3);
    }
    const positions = new Set(sA.concat(sB).map(function(p) { return p.position; }).filter(Boolean));
    const waiverContext = {};
    positions.forEach(function(pos) { waiverContext[pos] = (waiverByPos[pos] || []).slice(0, 3); });
    setResult({ sA: sA, sB: sB, tA: tA, tB: tB, winner: winner, tier: tier, icon: icon, gap: gap, gapPct: gapPct, addOns: addOns, waiverContext: waiverContext });
    setVerdict(null); setVE(false);
  }

  async function getVerdict() {
    if (!result) return;
    setVL(true); setVE(false); setVerdict(null);
    const sys = "You are the wind-up merchant of the Borehamwood Plancy League. Quick funny verdict in 2-4 sentences. Bone-dry British banter. Use real names not team names. Numbers are computed — do NOT recalculate.";
    const margin = result.winner === 'even' ? 'Even.' : ('Side ' + result.winner + ' wins by ' + result.gap.toFixed(0) + ' (' + result.gapPct.toFixed(0) + '%)');
    const addOnStr = result.addOns.length ? ' Suggested add-on: ' + result.addOns.map(function(a) { return a.name; }).join(' or ') + '.' : '';
    const sAStr = result.sA.map(function(p) { return p.officialName + '(' + p.value + ')'; }).join(', ');
    const sBStr = result.sB.map(function(p) { return p.officialName + '(' + p.value + ')'; }).join(', ');
    const msg = 'Trade:\nSide A (' + teamLabel(teamA) + ') gives: ' + sAStr + ' — Total ' + result.tA + '\nSide B (' + teamLabel(teamB) + ') gives: ' + sBStr + ' — Total ' + result.tB + '\nVerdict: ' + result.tier + '. ' + margin + addOnStr;
    try {
      const r = await claudeCall([{ role: 'user', content: msg }], sys);
      setVerdict(r);
    } catch (e) { setVE(true); }
    finally { setVL(false); }
  }

  const teamOpts = teamKeys.map(function(k) { return <option key={k} value={k}>{teamLabel(k)}</option>; });
  const winA = result && result.winner === 'A';
  const winB = result && result.winner === 'B';
  const spin = { width: 14, height: 14, border: '2px solid ' + T.amber, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'tg-spin 0.8s linear infinite' };

  return (
    <div style={{ background: T.bg, color: T.text, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ borderBottom: '1px solid ' + T.border, background: T.panel }}>
        <button onClick={function() { setShowWaiver(function(v) { return !v; }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          <span>Waiver Wire <span style={{ color: T.faint, fontSize: 11, fontWeight: 400 }}>(top available by position)</span></span>
          <span style={{ fontSize: 10, color: T.faint }}>{showWaiver ? '▲ hide' : '▼ show'}</span>
        </button>
        {showWaiver && (
          <div style={{ padding: '0 13px 13px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['QB', 'RB', 'WR', 'TE'].map(function(pos) {
              const players = waiverByPos[pos] || [];
              if (!players.length) return null;
              return (
                <div key={pos} style={{ background: T.raised, border: '1px solid ' + T.border, borderTop: '2px solid ' + (POS_COLORS[pos] || T.border), borderRadius: '3px 3px 9px 9px', padding: '9px 11px', minWidth: 120, flex: '1 1 120px', maxWidth: 170 }}>
                  <div style={{ color: POS_COLORS[pos] || T.dim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{pos}</div>
                  {players.map(function(p, i) {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderBottom: i < players.length - 1 ? '1px solid ' + T.border : 'none' }}>
                        <span style={{ color: T.text }}>{p.player.name}</span>
                        <span style={{ color: T.dim, fontSize: 11.5 }}>{p.redraftValue.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: 15 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
          {[{ side: 'A', team: teamA, setTeam: setTeamA, text: sideAText, setText: setSideAText, accent: T.blue },
            { side: 'B', team: teamB, setTeam: setTeamB, text: sideBText, setText: setSideBText, accent: T.indigo }].map(function(cfg) {
            return (
              <div key={cfg.side} style={{ background: T.panel, border: '1px solid ' + T.border, borderTop: '3px solid ' + cfg.accent, borderRadius: '4px 4px 12px 12px', padding: 13, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                  <span style={{ background: cfg.accent, color: '#fff', fontWeight: 700, fontSize: 12, width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cfg.side}</span>
                  <span style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{'Side ' + cfg.side + ' gives up'}</span>
                </div>
                <select value={cfg.team} onChange={function(e) { cfg.setTeam(e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: 10, width: '100%', marginBottom: 8, fontSize: 16 }}>
                  {teamOpts}
                </select>
                <textarea value={cfg.text} onChange={function(e) { cfg.setText(e.target.value); }} placeholder={"One player per line\ne.g. Ja'Marr Chase"} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: 11, width: '100%', minHeight: 92, fontSize: 16, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
              </div>
            );
          })}
        </div>

        <button onClick={gradeTrade} disabled={!sideAText.trim() && !sideBText.trim()} style={{ width: '100%', background: (!sideAText.trim() && !sideBText.trim()) ? T.raised : 'linear-gradient(135deg,' + T.indigo + ',' + T.indigoDk + ')', color: (!sideAText.trim() && !sideBText.trim()) ? T.faint : '#fff', border: 'none', borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', marginTop: 12 }}>
          Grade This Trade
        </button>

        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, padding: '15px 10px', textAlign: 'center', background: winA ? 'rgba(16,185,129,0.08)' : 'transparent', borderRight: '1px solid ' + T.border }}>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>SIDE A</div>
                  <div style={{ fontWeight: 700, fontSize: 32, color: winA ? T.green : T.text, lineHeight: 1 }}>{result.tA.toLocaleString()}</div>
                  {winA && <div style={{ fontSize: 10, color: T.green, fontWeight: 700, marginTop: 3, textTransform: 'uppercase' }}>▲ WINS</div>}
                </div>
                <div style={{ flex: 1, padding: '15px 10px', textAlign: 'center', background: winB ? 'rgba(16,185,129,0.08)' : 'transparent', borderLeft: '1px solid ' + T.border }}>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>SIDE B</div>
                  <div style={{ fontWeight: 700, fontSize: 32, color: winB ? T.green : T.text, lineHeight: 1 }}>{result.tB.toLocaleString()}</div>
                  {winB && <div style={{ fontSize: 10, color: T.green, fontWeight: 700, marginTop: 3, textTransform: 'uppercase' }}>▲ WINS</div>}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px solid ' + T.border, background: T.panel2 }}>
                <span style={{ fontSize: 20 }}>{result.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 12.5, color: T.amber, letterSpacing: '0.04em', marginLeft: 8 }}>{result.tier}</span>
                {result.winner !== 'even' && <span style={{ fontSize: 10.5, color: T.dim, marginLeft: 8 }}>{'by ' + result.gap.toLocaleString() + ' (' + result.gapPct.toFixed(0) + '%)'}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginBottom: 12 }}>
              {[{ side: 'A', players: result.sA, team: teamA, accent: T.blue }, { side: 'B', players: result.sB, team: teamB, accent: T.indigo }].map(function(cfg) {
                return (
                  <div key={cfg.side} style={{ flex: 1, minWidth: 140, background: T.panel, border: '1px solid ' + T.border, borderRadius: 11, padding: '11px 13px' }}>
                    <div style={{ color: cfg.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{teamLabel(cfg.team) + ' gives'}</div>
                    {cfg.players.length ? cfg.players.map(function(p, i) {
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid ' + T.border, fontSize: 13.5 }}>
                          <span style={{ color: p.found ? T.text : T.amber }}>{p.found ? p.officialName : p.input + ' ⚠'}</span>
                          <span style={{ color: p.found ? T.dim : T.amber, fontSize: 12.5, marginLeft: 8, fontWeight: 700 }}>{p.found ? p.value.toLocaleString() : 'no match'}</span>
                        </div>
                      );
                    }) : <div style={{ color: T.faint, fontSize: 12 }}>—</div>}
                  </div>
                );
              })}
            </div>

            {result.winner !== 'even' && result.addOns.length > 0 && (
              <div style={{ background: T.panel, border: '1px solid ' + T.border, borderLeft: '3px solid ' + T.amber, borderRadius: '4px 11px 11px 4px', padding: '11px 13px', marginBottom: 12 }}>
                <div style={{ color: T.amber, fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'To balance, ' + teamLabel(result.winner === 'A' ? teamA : teamB) + ' could add'}</div>
                {result.addOns.map(function(a, i) {
                  return <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}><span>{a.name}</span><span style={{ color: T.dim }}>{a.value.toLocaleString()}</span></div>;
                })}
              </div>
            )}

            {Object.keys(result.waiverContext).length > 0 && (
              <div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
                <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Waiver alternatives for traded positions</div>
                {Object.keys(result.waiverContext).map(function(pos) {
                  const players = result.waiverContext[pos];
                  return (
                    <div key={pos} style={{ marginBottom: 8 }}>
                      <span style={{ color: POS_COLORS[pos] || T.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{pos + ': '}</span>
                      {players.map(function(p, i) {
                        return <span key={i} style={{ fontSize: 13, color: T.text }}>{p.player.name + ' '}<span style={{ color: T.dim, fontSize: 12 }}>{'(' + p.redraftValue.toLocaleString() + ')'}</span>{i < players.length - 1 ? <span style={{ color: T.faint }}> · </span> : ''}</span>;
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={getVerdict} disabled={vLoading} style={{ width: '100%', background: T.panel, border: '1px solid ' + T.amber, color: T.amber, borderRadius: 11, padding: '13px 20px', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: vLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: vLoading ? 0.7 : 1 }}>
              {vLoading ? <span style={spin} /> : "🎙"} The Commissioner's Verdict
            </button>

            {(verdict || vError) && (
              <div style={{ background: T.panel2, border: '1px solid ' + (vError ? T.amber : T.border), borderLeft: '3px solid ' + (vError ? T.amber : T.indigo), borderRadius: '4px 12px 12px 4px', padding: 14, color: vError ? T.amber : T.text, marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
                {vError ? 'The Commissioner is unavailable — give it another go.' : <MarkdownMessage text={verdict} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

