// ── Live Scores (spoiler-safe) ───────────────────────────────────────────────
// Calls the Sleeper API live from the browser. Sleeper now returns
// access-control-allow-origin:* so there is no CORS problem (the old claude.md
// rule against browser calls is stale). Pick an NFL week; NOTHING is revealed
// by default — you tap each player whose real-life game you've already watched,
// and only then does that player's fantasy score appear. The matchup totals are
// running sums of what YOU have revealed, never the true team total, so the
// games you haven't watched yet are never spoiled.
const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const LIVE_USERNAME = 'AlastairL';
const NFL_WEEKS = Array.from({ length: 18 }, function(_, i) { return i + 1; });

// Flatten rosters.json ("Team (@handle)" -> [{id,name,pos}]) into id -> {name,pos}.
function buildPlayerIndex(rostersData) {
  const idx = {};
  Object.values(rostersData || {}).forEach(function(arr) {
    (arr || []).forEach(function(p) { if (p && p.id != null) idx[String(p.id)] = { name: p.name, pos: p.pos }; });
  });
  return idx;
}

async function sget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Sleeper ' + r.status);
  return r.json();
}

function fmtPts(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2); }


function LiveTab(props) {
  const { rostersData } = props;
  const playerIdx = useMemo(function() { return buildPlayerIndex(rostersData); }, [rostersData]);

  const [base, setBase] = useState(null);     // { leagueId, leagueName, season, slots, teamByRoster, myRosterId, liveWeek }
  const [baseErr, setBaseErr] = useState(false);
  const [week, setWeek] = useState(null);
  const [pairs, setPairs] = useState(null);   // [{ mid, entries:[entry,...] }]
  const [loadingM, setLoadingM] = useState(false);
  const [matchErr, setMatchErr] = useState(false);
  const [viewMid, setViewMid] = useState(null);
  const [revealed, setRevealed] = useState({}); // `${rosterId}:${slotIdx}` -> true

  useEffect(function() {
    if (document.getElementById('live-spin')) return;
    const s = document.createElement('style');
    s.id = 'live-spin';
    s.textContent = '@keyframes live-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }, []);

  // 1) one-time: NFL state + active Plancy league + users + rosters
  useEffect(function() {
    let cancelled = false;
    (async function() {
      try {
        const state = await sget(SLEEPER_BASE + '/state/nfl');
        const user = await sget(SLEEPER_BASE + '/user/' + LIVE_USERNAME);
        let league = null, usedSeason = null;
        const years = [String(state.season), String(+state.season - 1), String(+state.season - 2)];
        for (let i = 0; i < years.length; i++) {
          const leagues = await sget(SLEEPER_BASE + '/user/' + user.user_id + '/leagues/nfl/' + years[i]);
          const lg = (leagues || []).find(function(l) { return /borehamwood|plancy/i.test(l.name); });
          if (lg) { league = lg; usedSeason = years[i]; break; }
        }
        if (!league) throw new Error('No Plancy league found');
        const [users, rosters] = await Promise.all([
          sget(SLEEPER_BASE + '/league/' + league.league_id + '/users'),
          sget(SLEEPER_BASE + '/league/' + league.league_id + '/rosters'),
        ]);
        const userByUid = {};
        users.forEach(function(u) { userByUid[u.user_id] = { handle: u.display_name, team: (u.metadata && u.metadata.team_name) || u.display_name }; });
        const teamByRoster = {};
        let myRosterId = null;
        rosters.forEach(function(r) {
          const u = userByUid[r.owner_id] || {};
          teamByRoster[r.roster_id] = {
            handle: u.handle || null,
            name: u.handle ? displayName(u.handle) : ('Roster ' + r.roster_id),
            team: u.team || '',
            isMe: r.owner_id === user.user_id,
          };
          if (r.owner_id === user.user_id) myRosterId = r.roster_id;
        });
        const slots = (league.roster_positions || []).filter(function(p) { return p !== 'BN'; });
        const isLive = String(state.season) === String(usedSeason) && state.week > 0;
        if (cancelled) return;
        setBase({ leagueId: league.league_id, leagueName: league.name, season: usedSeason, slots: slots, teamByRoster: teamByRoster, myRosterId: myRosterId, liveWeek: isLive ? state.week : null });
        setWeek(isLive ? state.week : 1);
      } catch (e) { if (!cancelled) setBaseErr(true); }
    })();
    return function() { cancelled = true; };
  }, []);

  // 2) (re)load matchups for the selected week — resets reveals so a new week starts hidden
  function loadMatchups(b, wk) {
    if (!b || !wk) return;
    setLoadingM(true); setMatchErr(false);
    sget(SLEEPER_BASE + '/league/' + b.leagueId + '/matchups/' + wk).then(function(raw) {
      const byMid = {};
      (raw || []).forEach(function(e) { if (e.matchup_id == null) return; (byMid[e.matchup_id] = byMid[e.matchup_id] || []).push(e); });
      const list = Object.keys(byMid).map(function(mid) { return { mid: mid, entries: byMid[mid] }; });
      let mine = null;
      list.forEach(function(p) { if (p.entries.some(function(e) { return e.roster_id === b.myRosterId; })) mine = p.mid; });
      setPairs(list);
      setViewMid(mine || (list[0] && list[0].mid) || null);
      setRevealed({});
      setLoadingM(false);
    }).catch(function() { setMatchErr(true); setLoadingM(false); });
  }

  useEffect(function() { if (base && week) loadMatchups(base, week); }, [base, week]);

  function startersOf(entry, b) {
    return b.slots.map(function(slot, i) {
      const pid = entry.starters && entry.starters[i];
      const empty = !pid || pid === '0';
      const info = !empty ? playerIdx[String(pid)] : null;
      const pts = (entry.starters_points && entry.starters_points[i] != null)
        ? entry.starters_points[i]
        : (entry.players_points && entry.players_points[pid]) || 0;
      return { slot: slot, i: i, pid: pid, empty: empty, name: info ? info.name : (empty ? null : 'Player ' + pid), pos: info ? info.pos : null, pts: pts };
    });
  }

  function revealedTotal(entry, rows) {
    return rows.reduce(function(s, row) { return revealed[entry.roster_id + ':' + row.i] && !row.empty ? s + row.pts : s; }, 0);
  }
  function revealedCount(entry, rows) {
    return rows.reduce(function(n, row) { return revealed[entry.roster_id + ':' + row.i] && !row.empty ? n + 1 : n; }, 0);
  }

  function toggle(key) {
    setRevealed(function(r) { const n = Object.assign({}, r); if (n[key]) delete n[key]; else n[key] = true; return n; });
  }
  function setAll(entry, rows, on) {
    setRevealed(function(r) {
      const n = Object.assign({}, r);
      rows.forEach(function(row) { if (row.empty) return; const k = entry.roster_id + ':' + row.i; if (on) n[k] = true; else delete n[k]; });
      return n;
    });
  }

  const spin = { width: 16, height: 16, border: '2px solid ' + T.amber, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'live-spin 0.8s linear infinite' };

  // ── error / loading shells ──
  if (baseErr) {
    return (
      <div style={{ background: T.bg, color: T.text, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📡</div>
          <div style={{ color: T.amber, fontWeight: 700, marginBottom: 6 }}>Live scores unavailable here</div>
          <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 340 }}>This artifact runs in a sandbox that blocks live calls to the Sleeper API, so real-time scores can't load. Stats, Banter and Trades still work — they use the built-in league data.</div>
        </div>
      </div>
    );
  }
  if (!base) {
    return (
      <div style={{ background: T.bg, color: T.text, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11 }}>
        <span style={spin} /><span style={{ color: T.dim, fontSize: 14 }}>Connecting to Sleeper…</span>
      </div>
    );
  }

  const pair = (pairs || []).find(function(p) { return p.mid === viewMid; });
  let entries = pair ? pair.entries.slice() : [];
  entries.sort(function(a, b) { return (a.roster_id === base.myRosterId ? -1 : 0) - (b.roster_id === base.myRosterId ? -1 : 0); });

  function teamLabelOf(rid) { const t = base.teamByRoster[rid] || {}; return t.team ? (t.name + ' · ' + t.team) : t.name; }

  return (
    <div style={{ background: T.bg, color: T.text, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* controls */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: T.panel, borderBottom: '1px solid ' + T.border, padding: '11px 14px' }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 9.5, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 700 }}>Week</div>
            <select value={week} onChange={function(e) { setWeek(+e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: '8px 10px', fontSize: 15 }}>
              {NFL_WEEKS.map(function(w) { return <option key={w} value={w}>{'Week ' + w + (w === base.liveWeek ? ' • now' : '')}</option>; })}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 700 }}>Matchup</div>
            <select value={viewMid || ''} onChange={function(e) { setViewMid(e.target.value); }} style={{ background: T.raised, color: T.text, border: '1px solid ' + T.borderHi, borderRadius: 8, padding: '8px 10px', fontSize: 15, width: '100%' }}>
              {(pairs || []).map(function(p) {
                const nm = p.entries.map(function(e) { const t = base.teamByRoster[e.roster_id] || {}; return t.name + (t.isMe ? ' (you)' : ''); }).join('  vs  ');
                return <option key={p.mid} value={p.mid}>{nm}</option>;
              })}
            </select>
          </div>
          <button onClick={function() { loadMatchups(base, week); }} title="Refresh live points" style={{ flex: '0 0 auto', alignSelf: 'flex-end', background: T.raised, border: '1px solid ' + T.borderHi, color: T.dim, borderRadius: 8, padding: '8px 11px', fontSize: 14, cursor: 'pointer' }}>↻</button>
        </div>
        <div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.45 }}>
          Tap a player whose game you've <em>already watched</em> to reveal their score. Nothing is shown otherwise — unwatched games stay unspoiled.
        </div>
      </div>

      {loadingM && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, padding: 40 }}>
          <span style={spin} /><span style={{ color: T.dim, fontSize: 14 }}>{'Loading week ' + week + '…'}</span>
        </div>
      )}

      {!loadingM && matchErr && (
        <div style={{ padding: 30, textAlign: 'center', color: T.amber, fontSize: 14 }}>Couldn't load this week's matchups — try ↻.</div>
      )}

      {!loadingM && !matchErr && (!pairs || !pairs.length) && (
        <div style={{ padding: 30, textAlign: 'center', color: T.dim, fontSize: 14 }}>{'No matchups posted for week ' + week + ' yet.'}</div>
      )}

      {!loadingM && !matchErr && pair && (
        <div style={{ padding: 14 }}>
          {/* running scoreboard — revealed totals only */}
          <div style={{ display: 'flex', background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            {entries.map(function(entry, idx) {
              const rows = startersOf(entry, base);
              const tot = revealedTotal(entry, rows);
              const cnt = revealedCount(entry, rows);
              const playable = rows.filter(function(r) { return !r.empty; }).length;
              const t = base.teamByRoster[entry.roster_id] || {};
              return (
                <div key={entry.roster_id} style={{ flex: 1, padding: '13px 10px', textAlign: 'center', borderRight: idx === 0 ? '1px solid ' + T.border : 'none', background: t.isMe ? 'rgba(99,102,241,0.07)' : 'transparent' }}>
                  <div style={{ fontSize: 10.5, color: t.isMe ? T.indigo : T.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}{t.isMe ? ' (you)' : ''}</div>
                  <div style={{ fontWeight: 800, fontSize: 30, color: cnt ? T.text : T.faint, lineHeight: 1 }}>{fmtPts(tot)}</div>
                  <div style={{ fontSize: 10.5, color: T.dim, marginTop: 4 }}>{cnt + '/' + playable + ' revealed'}</div>
                </div>
              );
            })}
          </div>

          {/* per-team starter lists */}
          {entries.map(function(entry) {
            const rows = startersOf(entry, base);
            const t = base.teamByRoster[entry.roster_id] || {};
            const cnt = revealedCount(entry, rows);
            const playable = rows.filter(function(r) { return !r.empty; }).length;
            const allOn = cnt === playable && playable > 0;
            return (
              <div key={entry.roster_id} style={{ background: T.panel, border: '1px solid ' + T.border, borderTop: '3px solid ' + (t.isMe ? T.indigo : T.border), borderRadius: '4px 4px 12px 12px', padding: '12px 13px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamLabelOf(entry.roster_id)}{t.isMe ? <span style={{ color: T.indigo, fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}>YOU</span> : null}</div>
                  </div>
                  <button onClick={function() { setAll(entry, rows, !allOn); }} style={{ flex: '0 0 auto', background: 'none', border: '1px solid ' + T.borderHi, color: T.dim, borderRadius: 7, padding: '5px 9px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>{allOn ? 'Hide all' : 'Reveal all'}</button>
                </div>
                {rows.map(function(row) {
                  const key = entry.roster_id + ':' + row.i;
                  const isOpen = !!revealed[key];
                  const tint = POS_COLORS[row.slot] || T.dim;
                  if (row.empty) {
                    return (
                      <div key={row.i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid ' + T.border }}>
                        <span style={{ flex: '0 0 38px', fontSize: 10, fontWeight: 800, color: T.faint, textTransform: 'uppercase' }}>{row.slot}</span>
                        <span style={{ flex: 1, color: T.faint, fontSize: 13, fontStyle: 'italic' }}>Empty</span>
                      </div>
                    );
                  }
                  return (
                    <div key={row.i} onClick={function() { toggle(key); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid ' + T.border, cursor: 'pointer' }}>
                      <span style={{ flex: '0 0 38px', fontSize: 10, fontWeight: 800, color: tint, textTransform: 'uppercase' }}>{row.slot}</span>
                      <span style={{ flex: 1, minWidth: 0, color: isOpen ? T.text : T.dim, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name}{row.pos ? <span style={{ color: T.faint, fontSize: 11, marginLeft: 6 }}>{row.pos}</span> : null}
                      </span>
                      {isOpen
                        ? <span style={{ flex: '0 0 auto', fontWeight: 800, fontSize: 14.5, color: row.pts > 0 ? T.green : T.faint, minWidth: 48, textAlign: 'right' }}>{fmtPts(row.pts)}</span>
                        : <span style={{ flex: '0 0 auto', fontSize: 10.5, fontWeight: 700, color: T.indigo, border: '1px solid ' + T.borderHi, borderRadius: 20, padding: '4px 11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reveal</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:#090d18;-webkit-font-smoothing:antialiased;overflow:hidden;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-thumb{background:#24344e;border-radius:3px;}
  @keyframes ld-pulse{0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
  .ld{display:inline-block;width:7px;height:7px;background:#6366f1;border-radius:50%;margin:0 2px;animation:ld-pulse 1.4s infinite ease-in-out both;}
  .ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}
  .md-table{border-collapse:collapse;width:100%;font-size:13px;background:#0f1625;border-radius:10px;overflow:hidden;}
  .md-table th{text-align:left;padding:9px 12px;background:#090d18;color:#f59e0b;font-weight:800;text-transform:uppercase;font-size:10.5px;letter-spacing:0.07em;border-bottom:1px solid #24344e;white-space:nowrap;}
  .md-table td{padding:8px 12px;border-bottom:1px solid #1a2640;color:#e8f1ff;}
  .md-table td:first-child{font-weight:600;}
  .md-table tr:last-child td{border-bottom:none;}
  .md-table tbody tr:nth-child(even) td{background:rgba(99,102,241,0.04);}
  .chip{background:#1a2640;border:1px solid #304260;color:#e8f1ff;border-radius:20px;padding:8px 15px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:border-color .15s,background .15s;}
  .chip:hover:not(:disabled){border-color:#6366f1;background:#232e50;}
  .chip:disabled{opacity:0.4;cursor:default;}
  .send-btn{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:12px;padding:0 18px;font-weight:700;font-size:12.5px;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;align-self:stretch;flex-shrink:0;}
  .send-btn:disabled{background:#1a2640;color:#3d5470;cursor:default;}
  .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;background:transparent;border:none;cursor:pointer;position:relative;}
  .nav-btn .nav-ico{font-size:20px;}
  .nav-btn:not(.active) .nav-ico{filter:grayscale(0.7) opacity(0.5);}
  .nav-lab{font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}
  .plaincy-app{display:flex;flex-direction:column;height:var(--app-h,100dvh);width:100%;max-width:560px;margin:0 auto;background:#090d18;overflow:hidden;}
  @media(min-width:640px){.plaincy-app{max-width:780px;}}
  button{font-family:inherit;}
  textarea,select{font-family:inherit;font-size:16px;}
  textarea:focus,select:focus{outline:none;}
  select option{background:#141e32;color:#e8f1ff;}
`;

const TABS = [
  { id: 'stats', icon: '📊', label: 'STATS' },
  { id: 'banter', icon: '🎙', label: 'BANTER' },
  { id: 'trade', icon: '⚖️', label: 'TRADES' },
  { id: 'live', icon: '🏈', label: 'SCORES' },
];

export default function App() {
  const [tab, setTab] = useState('stats');
  const { history, stats, rosters, trades, alltime, transactions, players, live } = useLeagueData();
  const { keyboardOpen } = useViewport();
  const lore = useLore(tab === 'banter');

  useEffect(function() {
    if (document.getElementById('plaincy-css')) return;
    const el = document.createElement('style');
    el.id = 'plaincy-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  return (
    <div className="plaincy-app">
      <div style={{ height: 3, background: 'linear-gradient(90deg,#6366f1 0%,#f59e0b 60%,#6366f1 100%)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', background: T.panel, borderBottom: '1px solid ' + T.border, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0 }}>P</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: T.text, letterSpacing: '-0.5px', lineHeight: 1 }}>Pl<span style={{ color: T.indigo }}>AI</span>ncy</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Borehamwood Plancy League</div>
        </div>
        <div title={live ? 'Fetched the latest published data' : 'Running on the data baked into this artifact — re-paste to update'} style={{ fontSize: 10.5, color: T.dim, border: '1px solid ' + T.border, borderRadius: 6, padding: '4px 9px', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? T.green : T.amber, display: 'inline-block' }} />
          {(live ? 'Live · ' : 'Snapshot · ') + fmtBuiltAt(BUILT_AT)}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Stats / Banter / Trade stay MOUNTED (toggle display) so chat history and
            trade inputs survive tab switches — storage APIs throw in the artifact
            sandbox, so keep-alive is the only option. Live mounts on demand: it
            fetches Sleeper on mount and is spoiler-safe, so a fresh mount is correct. */}
        <div style={{ display: tab === 'stats' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <StatsTab historyData={history} statsData={stats} alltimeData={alltime} transactionsData={transactions} playersData={players} loreMaster={lore.master} />
        </div>
        <div style={{ display: tab === 'banter' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <BanterTab historyData={history} statsData={stats} alltimeData={alltime} lore={lore} />
        </div>
        <div style={{ display: tab === 'trade' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <TradeGrader rostersData={rosters} tradeValues={trades} />
        </div>
        {tab === 'live' && <LiveTab rostersData={rosters} />}
      </div>

      {!keyboardOpen && (
        <nav style={{ display: 'flex', background: T.panel, borderTop: '1px solid ' + T.border, flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map(function(t) {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={function() { setTab(t.id); }} className={'nav-btn' + (active ? ' active' : '')} style={{ color: active ? T.text : T.faint }}>
                {active && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 36, height: 3, borderRadius: '0 0 4px 4px', background: T.indigo }} />}
                <span className="nav-ico">{t.icon}</span>
                <span className="nav-lab">{t.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
