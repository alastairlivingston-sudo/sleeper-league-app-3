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

// Code-rendered answer table (Phase 2): labels + number formatting come from
// COLUMNS, never from model-written markdown.
function fmtCell(col, v) {
  const t = (COLUMNS[col] || {}).type;
  if (v == null || v === '') return '—';
  if (t === 'mgr') return distinctName(v);
  if (t === 'pts') return fmt2(v);
  if (t === 'pct') return (Number(v) * 100).toFixed(1) + '%';
  return String(v);
}
function ResultTable(props) {
  const result = props.result;
  if (!result || !result.rows || !result.rows.length) return null;
  const cols = result.columns || [];
  return (
    <div className="rt-wrap">
      <table className="md-table rt">
        <thead><tr>{cols.map(function(c) { return <th key={c}>{(COLUMNS[c] || {}).label || c}</th>; })}</tr></thead>
        <tbody>
          {result.rows.map(function(r, i) {
            return <tr key={r.id || (r.gameId ? r.gameId + i : i)}>{cols.map(function(c) {
              if (c === 'result') return <td key={c}><span className={'res res-' + (r.result || 'x')}>{r.result || '·'}</span></td>;
              return <td key={c}>{fmtCell(c, r[c])}</td>;
            })}</tr>;
          })}
        </tbody>
      </table>
      {result.total > result.rows.length ? <div className="rt-more">{'Top ' + result.rows.length + ' of ' + result.total}</div> : null}
    </div>
  );
}

function ChatTab(props) {
  const { systemPrompt, chips, placeholder, errorMsg, intro, buildContext, answer, header, postProcess } = props;
  const [messages, setMessages] = useState([]);
  // Conversation context per tab (cause D): the previous question, spec and
  // result, so follow-ups ("that game", "and in 2024?") have a referent.
  const ctxRef = useRef(null);
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
      if (answer) {
        const out = await answer(t, next, ctxRef.current);
        if (out && out.content != null) {
          ctxRef.current = out.ctx || ctxRef.current;
          setMessages(function(p) { return p.concat([{ role: 'assistant', content: out.content, table: out.table || null }]); });
          return;
        }
      }
      const extra = buildContext ? await buildContext(t, next) : '';
      const fullPrompt = extra ? systemPrompt + '\n\n' + extra : systemPrompt;
      const raw = await claudeCall(next.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; }), fullPrompt);
      let reply = raw.replace(/\[(FACT|MYTH|REAL|EVENT)\]/g, '').replace(/  +/g, ' ').trim();
      if (postProcess) reply = postProcess(reply, fullPrompt);
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
        {typeof header === 'function' ? header(messages.length) : (header || null)}
        {messages.length === 0 && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: T.faint, fontSize: 14, maxWidth: 300, lineHeight: 1.7, padding: '20px 8px' }}>{intro}</div>
        )}
        {messages.map(function(m, i) {
          if (m.role === 'assistant') return <div key={i} style={bubAsst}><MarkdownMessage text={m.content} />{m.table ? <ResultTable result={m.table} /> : null}</div>;
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

// ── Compact prompt encoders (token-lean: no repeated JSON keys) ───────────────
function tsv(cols, rows) {
  return [cols.join('|')].concat((rows || []).map(function(r) {
    return cols.map(function(c) { const v = r[c]; return v == null ? '' : v; }).join('|');
  })).join('\n');
}
// alltime.json tables the fact-table recap does NOT carry: playoff records,
// nemesis/bunny, season trend, positional strengths, consistency, bench waste.
// (W/L, PF, records and streaks come from the recap — one source.)
function alltimeSummary(d) {
  if (!d) return '';
  const out = [];
  const pr = d.playoffRecords || {};
  const prRows = Object.keys(pr).map(function(h) { const r = pr[h]; return { name: distinctName(h), rec: r.wins + '-' + r.losses, apps: r.appearances, pf: r.pf, pa: r.pa }; });
  if (prRows.length) out.push('PLAYOFFS (W-L, apps=appearances):\n' + tsv(['name', 'rec', 'apps', 'pf', 'pa'], prRows));
  if (d.nemesis) out.push('NEMESIS (worst matchup, min 3 mtgs): ' + Object.keys(d.nemesis).map(function(h) { const n = d.nemesis[h]; return distinctName(h) + '→' + distinctName(n.opponent) + '(' + n.wins + '-' + n.losses + ')'; }).join('; '));
  if (d.bunny)   out.push('BUNNY (best matchup, min 3 mtgs): '   + Object.keys(d.bunny).map(function(h)   { const b = d.bunny[h];   return distinctName(h) + '→' + distinctName(b.opponent) + '(' + b.wins + '-' + b.losses + ')'; }).join('; '));
  if (d.consistencyStats) out.push('CONSISTENCY (SD of weekly scores, lower=steadier; avg):\n' + Object.keys(d.consistencyStats).map(function(h) { const c = d.consistencyStats[h].allTime; return distinctName(h) + ' SD ' + c.stdDev + ' avg ' + c.avg; }).join('\n'));
  if (d.benchStats && d.benchStats.perManager) out.push('BENCH (avg pts left on bench per game): ' + d.benchStats.perManager.map(function(b) { return distinctName(b.manager) + ' ' + b.avgBenchPts; }).join(', '));
  if (d.seasonalTrends) {
    const tl = Object.keys(d.seasonalTrends).map(function(h) {
      return distinctName(h) + ': ' + (d.seasonalTrends[h] || []).map(function(t) { return t.season + ' r' + t.rank + ' ' + t.ppg + 'ppg'; }).join(', ');
    });
    if (tl.length) out.push('SEASON TREND (r=finish rank, ppg=points/game):\n' + tl.join('\n'));
  }
  if (d.positionalStrengths) {
    const rows = [];
    Object.keys(d.positionalStrengths).forEach(function(h) {
      const seasonsObj = d.positionalStrengths[h] || {};
      const last = Object.keys(seasonsObj).sort().pop();
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

// ── This Week card (Phase 3) — last completed week, straight from the facts ───
function ThisWeekCard(props) {
  const tw = useMemo(function() { return thisWeekFacts(props.facts); }, [props.facts]);
  const [open, setOpen] = useState(true);
  // Collapse once the conversation starts so answers stay in view on a phone.
  useEffect(function() { if (props.started) setOpen(false); }, [props.started]);
  if (!tw) return null;
  const line = function(label, r, extra) { return r ? <div className="tw-line"><span className="tw-k">{label}</span> {nm(r.manager) + ' ' + fmt2(r.pf) + (extra ? extra(r) : '')}</div> : null; };
  return (
    <div className="tw-card" data-testid="this-week">
      <div className="tw-head">
        <button className="tw-toggle" onClick={function() { setOpen(!open); }}>{(open ? '▾ ' : '▸ ') + 'This week · ' + tw.season + ' Week ' + tw.week}</button>
        <button className="tw-rb" onClick={props.onRecordBook}>Record Book</button>
      </div>
      {open && (
        <div className="tw-body">
          <div className="tw-games">
            {tw.games.map(function(g) {
              return <div key={g.w.gameId} className="tw-game"><b>{nm(g.w.manager)}</b> {fmt2(g.w.pf)} <span className="tw-dim">{g.tie ? 'tied' : 'beat'}</span> {nm(g.l.manager)} {fmt2(g.l.pf)}</div>;
            })}
          </div>
          {line('High', tw.high)}
          {line('Low', tw.low)}
          {tw.closest ? <div className="tw-line"><span className="tw-k">Closest</span> {nm(tw.closest.manager) + ' over ' + nm(tw.closest.opponent) + ' by ' + fmt2(tw.closest.margin)}</div> : null}
          {line('Upset', tw.upset, function(r) { return ' beat ' + nm(r.opponent) + (r.weekRank ? ' (rank ' + r.weekRank + ' that week)' : ''); })}
          <table className="md-table tw-table">
            <thead><tr><th>#</th><th>Manager</th><th>W-L</th><th>PF</th><th>Streak</th></tr></thead>
            <tbody>{tw.standings.map(function(r) {
              return <tr key={r.manager}><td>{r.rank}</td><td>{nm(r.manager)}</td><td>{r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '')}</td><td>{fmt2(r.pf)}</td><td>{r.streak}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Record Book panel (Phase 3) — every named record, no model ────────────────
function RecordBook(props) {
  const facts = props.facts;
  const [scope, setScope] = useState('regular');
  const [season, setSeason] = useState('all');
  const seasons = useMemo(function() { const s = []; facts.seasons.forEach(function(r) { if (s.indexOf(r.season) === -1) s.push(r.season); }); return s; }, [facts]);
  const books = useMemo(function() {
    return RECORD_NAMES.map(function(name) {
      const v = validateSpec({ v: 2, table: 'record', record: name, where: { phase: scope, seasons: season === 'all' ? undefined : [season] } }, facts);
      return { name: name, res: v.ok ? runQuery(v.spec, facts, []) : { rows: [] } };
    });
  }, [facts, scope, season]);
  function side(r) {
    if (r.type) return nm(r.manager) + ' · ' + r.length + r.type + ' · ' + r.from + ' → ' + r.to;
    if (r.count != null) return nm(r.manager) + ' · ' + r.count;
    if (r.opponent === undefined) return nm(r.manager) + ' · ' + fmt2(r.pf) + ' · ' + r.season;
    return nm(r.manager) + ' ' + fmt2(r.pf) + ' – ' + fmt2(r.pa) + ' ' + nm(r.opponent) + ' · ' + r.season + ' wk' + r.week;
  }
  return (
    <div className="rb-panel" data-testid="record-book">
      <div className="rb-head">
        <b>Record Book</b>
        <select value={scope} onChange={function(e) { setScope(e.target.value); }}><option value="regular">Regular season</option><option value="all">All games</option></select>
        <select value={season} onChange={function(e) { setSeason(e.target.value); }}><option value="all">All seasons</option>{seasons.map(function(s) { return <option key={s} value={s}>{s}</option>; })}</select>
        <button className="tw-rb" onClick={props.onClose}>Close</button>
      </div>
      <div className="rb-list">
        {books.map(function(b) {
          return (
            <div key={b.name} className="rb-item" data-record={b.name}>
              <div className="rb-label">{RECORD_LABELS[b.name]}</div>
              {b.res.rows.length ? b.res.rows.slice(0, 8).map(function(r, i) { return <div key={i} className="rb-row">{side(r)}</div>; }) : <div className="rb-row tw-dim">—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsTab(props) {
  const { historyData, facts, alltimeData, transactionsData, playersData, loreMaster } = props;
  const [book, setBook] = useState(false);
  const ai = useAIState();
  const loreCtx = loreMaster
    ? '\n\nLEAGUE CONTEXT (names, champions, glossary — for resolving names only, NOT for inventing stats):\n' + loreMaster.slice(0, 2500)
    : '';
  // Chat-fallback prompt (non-data questions only): the fact-table recap plus the
  // alltime-only tables. Numeric questions never reach it — they go through the
  // query engine — and any number in a chat reply must appear in this prompt.
  const sp = useMemo(function() {
    return 'You are the statistician for the Borehamwood Plancy League. Answer ONLY from the data below — NEVER compute or invent numbers. If a number is not given to you, say you do not have it. Use names, never Sleeper handles; two Benjys: Lev and Sanford. Be brief.'
      + loreCtx
      + '\n\n' + leagueRecap(facts, historyData)
      + '\n\n' + alltimeSummary(alltimeData)
      + '\n\nTRADES:\n' + tradesLines(transactionsData);
  }, [facts, historyData, alltimeData, transactionsData, loreCtx]);

  // Query engine v2: code answers, the model only phrases (answerStatQuestion).
  async function answer(query, conversation, ctx) {
    const aiOn = ai !== 'off';
    const out = await answerStatQuestion(query, ctx, {
      facts: facts, players: playersData,
      plan: aiOn ? function(prompt) { return claudeCall([{ role: 'user', content: prompt }], 'Output only JSON.', { json: true }); } : null,
      narrate: aiOn ? function(prompt) { return claudeCall([{ role: 'user', content: prompt }], 'Reply in one or two plain sentences.'); } : null,
      log: function() { if (DEBUG) console.log.apply(console, ['[stats]'].concat([].slice.call(arguments))); },
    });
    if (out.content != null) return out;
    if (!aiOn) return { content: CANT_ANSWER, table: null, ctx: ctx };
    const reply = await claudeCall(conversation.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; }), sp);
    const g = numberGuard(reply, [], [sp]);
    if (!g.ok) { if (DEBUG) console.log('[stats] chat reply rejected by number guard', g.bad); return { content: CANT_ANSWER, table: null, ctx: ctx }; }
    return { content: reply, table: null, ctx: ctx };
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {book && <RecordBook facts={facts} onClose={function() { setBook(false); }} />}
      <ChatTab systemPrompt={sp} answer={answer}
        header={function(n) { return <ThisWeekCard facts={facts} started={n > 0} onRecordBook={function() { setBook(true); }} />; }}
        chips={['Most points in a loss?', "This week's upset?", 'Current standings', 'Longest streaks']}
        placeholder="Message…" errorMsg="Something went wrong — try again."
        intro="Ask about records, standings, head-to-heads or any week. Numbers come straight from the league data." />
    </div>
  );
}

function BanterTab(props) {
  const { historyData, facts, alltimeData, lore } = props;
  const ai = useAIState();

  const banterPrompt = useMemo(function() {
    const rule = [
      '══ PRIME DIRECTIVE ══',
      'You are the resident wind-up merchant of the Borehamwood Plancy League.',
      'STYLE: ESPN mock-grandeur, bone-dry British wit, mock gravity. Punchy 3-5 sentences. Lean on Jewish/Borehamwood texture. Sign off big beats with "a hearty hearty mazel tov."',
      'Never be cruel — mockery is the love language. Never invent statistics: every score, record or number you use must appear in the RECAP below (pre-2023 lore is unverified and may be referenced as lore only).',
      'NEVER print tag labels like [FACT], [MYTH], [REAL], or [EVENT].',
      '',
      '══ LORE MASTER ══',
    ].join('\n');
    // Compact recap from the fact table (Phase 3 diet) — no raw JSON dumps.
    const recap = '\n\n══ RECAP (verified data — the only source of numbers) ══\n' + leagueRecap(facts, historyData)
      + (alltimeData && alltimeData.nemesis ? '\n\nNEMESIS: ' + Object.keys(alltimeData.nemesis).map(function(h) { const n = alltimeData.nemesis[h]; return distinctName(h) + '→' + distinctName(n.opponent) + '(' + n.wins + '-' + n.losses + ')'; }).join('; ') : '');
    if (lore.master) return rule + '\n' + lore.master.slice(0, 12000) + recap;
    return rule + '\nThe Miriam = wooden spoon. Sanford = king of the Miriam. Lev = autodraft legend ("Does it auto-draft automatically?"). Dan = Commissioner/narrator. Gideon lives in Israel (4am watches). The Plancey = championship belt named after Rabbi Alan Plancey.'
      + '\nTWO BENJYS: benjlev=Lev, sanfbe=Sanford. allyl900=Alastair.'
      + '\nNAME MAP: ' + JSON.stringify(NAMES)
      + recap;
  }, [lore.master, historyData, facts, alltimeData]);

  function buildContext(query) {
    if (!lore.ready) return '';
    const lore_ctx = retrieveLore(query, lore.archive, lore.quotes);
    return lore_ctx ? '--- RETRIEVED LORE ---\n' + lore_ctx : '';
  }
  // Number guard for roasts: drop any sentence whose numbers are not in the prompt.
  function postProcess(reply, fullPrompt) {
    const g = guardSentences(reply, fullPrompt);
    if (DEBUG && g.dropped) console.log('[banter] number guard dropped', g.dropped, 'sentence(s)');
    return g.text || "I'll keep the numbers out of this one — ask the Stats tab for the receipts.";
  }

  if (ai === 'off') {
    return <div data-testid="ai-off" style={{ margin: 'auto', padding: '24px 16px', textAlign: 'center', color: T.dim, fontSize: 14, lineHeight: 1.7, maxWidth: 320 }}>Banter needs Claude, which isn't available in this view. The Stats tab still answers every record and standings question from the league data.</div>;
  }
  return <ChatTab
    systemPrompt={banterPrompt}
    buildContext={buildContext}
    postProcess={postProcess}
    chips={['Roast the 2025 champion', 'Most cursed manager?', "This week's smack bulletin", 'Roast Lev']}
    placeholder="Message…"
    errorMsg="Blimey — give it another go."
    intro="Pull up a chair. Ask for a roast, a smack-talk bulletin, or just stir the pot."
  />;
}

function normalizeName(str) { return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }

function TradeGrader(props) {
  const { rostersData, tradeValues } = props;
  const ai = useAIState();
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

            {ai !== 'off' && <button onClick={getVerdict} disabled={vLoading} style={{ width: '100%', background: T.panel, border: '1px solid ' + T.amber, color: T.amber, borderRadius: 11, padding: '13px 20px', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: vLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: vLoading ? 0.7 : 1 }}>
              {vLoading ? <span style={spin} /> : "🎙"} The Commissioner's Verdict
            </button>}

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

