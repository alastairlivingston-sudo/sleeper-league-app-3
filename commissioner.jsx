// ╔══════════════════════════════════════════════════════════════╗
// ║           THE COMMISSIONER — Borehamwood Plancy League        ║
// ╚══════════════════════════════════════════════════════════════╝

const { useState, useEffect, useRef, useMemo } = React;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LORE ← FILL THIS IN BEFORE SHARING
// Everything here is fed directly to the Banter tab.
// Add nicknames, running jokes, feuds, draft disasters, etc.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LORE = `
(Replace this block with your league lore before publishing.)

Suggestions:
- AlastairL won the 2025 title despite being AlastairL's bogey team sanfbe beating him twice in the regular season.
- dpol won a game in Week 3 by 0.02 points and never lets anyone forget it. Also lost the final by 25 points and hasn't recovered.
- GSac put up 202.36 in Week 12 2025 — the highest score in league history — and still didn't make the final. Cosmically unjust.
- benjlev went 0-14 in 2024. A perfect record of futility. The Borehamwood Spiral.
- Add your own: nicknames, draft regrets, waiver crimes, feuds, superstitions...
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA SOURCES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const URLS = {
  history:     'https://raw.githubusercontent.com/alastairlivingston-sudo/sleeper-league-app-3/main/public/data/history.json',
  stats:       'https://raw.githubusercontent.com/alastairlivingston-sudo/sleeper-league-app-3/main/public/data/stats.json',
  rosters:     'https://raw.githubusercontent.com/alastairlivingston-sudo/sleeper-league-app-3/main/public/data/rosters.json',
  tradeValues: 'https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=8&ppr=0.5',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLAUDE CALL UTILITY
// Uses the Claude.ai artifact runtime — no API key in the code.
// Each viewer's usage bills to their own Claude account automatically.
// Trims to last 20 messages. Friendly error on model failure.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function claudeCall(messages, systemPrompt) {
  const trimmed = messages.slice(-20);

  // The artifact runtime exposes `claude` — uses the viewer's session, no key needed.
  // Model is determined by the runtime (not hardcoded here).
  const runtime = window.claude;
  if (!runtime) throw new Error('Please view this artifact on Claude.ai to use AI features.');

  try {
    // claude.complete is the artifact-runtime API; it passes through to the
    // current Sonnet model automatically — we never hardcode a version string.
    const r = await runtime.complete({ system: systemPrompt, messages: trimmed, max_tokens: 1000 });
    return r.content[0].text;
  } catch (e) {
    const msg = String(e?.message || e);
    if (/model/i.test(msg) || /404/.test(msg) || e?.status === 404) throw new Error('MODEL_ERROR');
    throw e;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA HOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function useLeagueData() {
  const [data, setData] = useState({ history: null, stats: null, rosters: null, tradeValues: null, loadErrors: [], loading: true });
  useEffect(() => {
    const errors = [];
    const fetches = Object.entries(URLS).map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return [key, await res.json()];
      } catch (e) {
        errors.push(`${key}: ${e.message}`);
        return [key, null];
      }
    });
    Promise.all(fetches).then(results => {
      const next = { loadErrors: errors, loading: false };
      for (const [k, v] of results) next[k] = v;
      setData(prev => ({ ...prev, ...next }));
    });
  }, []);
  return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED CHAT COMPONENT (used by both Stats and Banter tabs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ChatTab({ systemPrompt, chips, placeholder, errorMsg, notReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const autoResize = () => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
  };

  const send = async (text) => {
    const t = (text || input).trim();
    if (!t || loading) return;
    const next = [...messages, { role: 'user', content: t }];
    setMessages(next); setInput(''); setLoading(true);
    if (taRef.current) taRef.current.style.height = 'auto';
    try {
      const apiMsgs = next.slice(-20).filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));
      const reply = await claudeCall(apiMsgs, systemPrompt);
      setMessages(p => [...p, { role: 'assistant', content: reply }]);
    } catch (e) {
      const txt = e?.message === 'MODEL_ERROR'
        ? 'Model hiccup — please try again.'
        : errorMsg;
      setMessages(p => [...p, { role: 'error', content: txt }]);
    } finally { setLoading(false); }
  };

  const bubbleUser  = { alignSelf:'flex-end', background:'#d4af37', color:'#0f0f0f', borderRadius:'16px 16px 4px 16px', padding:'10px 14px', maxWidth:'80%', fontSize:14, lineHeight:1.5 };
  const bubbleBot   = { alignSelf:'flex-start', background:'#1e1e1e', color:'#f0f0f0', border:'1px solid #2a2a2a', borderRadius:'16px 16px 16px 4px', padding:'10px 14px', maxWidth:'80%', fontSize:14, lineHeight:1.5, whiteSpace:'pre-wrap' };
  const bubbleErr   = { ...bubbleBot, border:'1px solid #e05252', color:'#e05252' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0f0f0f' }}>
      {notReady && (
        <div style={{ padding:'5px 12px', fontSize:12, color:'#666', background:'#111', borderBottom:'1px solid #1a1a1a', textAlign:'center' }}>
          League data loading — answers may be limited
        </div>
      )}
      {/* Chips */}
      <div style={{ display:'flex', gap:8, padding:'8px 12px', borderBottom:'1px solid #1a1a1a', overflowX:'auto', flexShrink:0 }}>
        {chips.map((c, i) => (
          <button key={i} onClick={() => send(c)} disabled={loading} style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#d4af37', borderRadius:20, padding:'6px 12px', fontSize:13, cursor: loading ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: loading ? 0.5 : 1, flexShrink:0 }}>
            {c}
          </button>
        ))}
      </div>
      {/* Messages */}
      <div style={{ flexGrow:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:10 }}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? bubbleUser : m.role === 'error' ? bubbleErr : bubbleBot}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={bubbleBot}>
            <span className="ld" /><span className="ld" /><span className="ld" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div style={{ display:'flex', gap:8, padding:'10px 12px', borderTop:'1px solid #1a1a1a', background:'#0f0f0f', flexShrink:0 }}>
        <textarea
          ref={taRef} rows={1} value={input}
          onChange={e => setInput(e.target.value)}
          onInput={autoResize}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          style={{ flex:1, background:'#1a1a1a', color:'#f0f0f0', border:'1px solid #2a2a2a', borderRadius:10, padding:10, fontSize:15, resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.4 }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ background:'#d4af37', color:'#0f0f0f', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:'bold', cursor: loading || !input.trim() ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1, alignSelf:'flex-end', flexShrink:0 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StatsTab({ historyData, statsData }) {
  const systemPrompt = `You are the league statistician for the Borehamwood Plancy League. Answer ONLY from the loaded history and stats data provided — all-time and per-season records, head-to-heads, champions by season, highest/lowest weeks, points trends across 2023-2025. Cite exact figures. NEVER invent or estimate a number; if it isn't in the provided data, say so plainly. Minimal banter — this is the record book.

LEAGUE DATA:
${JSON.stringify(historyData)}

STATS DATA:
${JSON.stringify(statsData)}`;

  return (
    <ChatTab
      systemPrompt={systemPrompt}
      chips={['Most titles 2023-2025?', 'AlastairL vs dpol all-time H2H', 'Highest score ever?', 'Who improved most year on year?']}
      placeholder="Ask about league stats…"
      errorMsg="Something went wrong — please try again."
      notReady={!historyData && !statsData}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BANTER TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LEAGUE_FACTS = `Borehamwood Plancy League. 1-QB redraft, WR/RB/TE flex, half-PPR, 8 teams. History covers 2023-2025.
2025 champion: Fourth and Golda Meir (@AlastairL), 11-5, first-round bye Wk15, beat @dpol 143.96-118.58 in the final.
@dpol (Plancey Neutral) won Wk3 2025 by just 0.02 points, then lost the final by 25.
@GSac (This One Really Hurts) posted a monstrous 202.36 in Wk12 2025 and still didn't make the final.
@sanfbe (J'Allen Plancey z'l) is AlastairL's bogey team — beat him twice in 2025 regular season.
Managers: AlastairL/Fourth and Golda Meir; dpol/Plancey Neutral; GSac/This One Really Hurts; sanfbe/J'Allen Plancey z'l; saulgoat/Love Thy Naber; drjkay/A Rookie Error; benjlev/Team Benjlev; joshjr11/Denver Brochos.`;

function BanterTab({ historyData }) {
  const systemPrompt = `You are the resident wind-up merchant of the Borehamwood Plancy League. Voice: bone-dry British banter, treating this low-stakes hobby with the utmost mock-gravity. Roast everyone, the champion most of all. Never cruel, always funny. Use the LORE and history for material. Be loose and playful, but do not fabricate hard stats — if you cite a number, it must be real.

${LEAGUE_FACTS}

LEAGUE LORE (nicknames, running jokes, personal history):
${LORE}

FULL HISTORY:
${JSON.stringify(historyData)}`;

  return (
    <ChatTab
      systemPrompt={systemPrompt}
      chips={['Roast the 2025 champion', 'Who was the unluckiest manager ever?', "Write this week's smack talk bulletin"]}
      placeholder="Start some trouble…"
      errorMsg="Blimey, something went wrong — give it another go."
      notReady={!historyData}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRADE GRADER — module-level helpers (hoisted to prevent remount)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TG_C = { bg:'#0f0f0f', text:'#f0f0f0', surface:'#1a1a1a', border:'#2a2a2a', gold:'#d4af37', red:'#e05252', muted:'#888' };

function TradePanel({ label, team, setTeam, text, setText, teamOpts }) {
  return (
    <div style={{ background:TG_C.surface, borderRadius:12, padding:12, flex:1, minWidth:0 }}>
      <div style={{ color:TG_C.gold, fontSize:12, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</div>
      <select value={team} onChange={e => setTeam(e.target.value)} style={{ background:TG_C.bg, color:TG_C.text, border:`1px solid ${TG_C.border}`, borderRadius:8, padding:8, width:'100%', marginBottom:8, fontSize:14 }}>
        {teamOpts}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={"One player per line\ne.g. Ja'Marr Chase"} style={{ background:TG_C.bg, color:TG_C.text, border:`1px solid ${TG_C.border}`, borderRadius:8, padding:10, width:'100%', minHeight:100, fontSize:14, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
    </div>
  );
}

function PlayerRow({ p }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:14 }}>
      <span style={{ color: p.found ? TG_C.text : TG_C.red }}>{p.found ? p.officialName : p.input}</span>
      <span style={{ color: p.found ? TG_C.muted : TG_C.red, fontSize:13, marginLeft:8 }}>{p.found ? p.value : 'Unmatched (0)'}</span>
    </div>
  );
}

function TradeGrader({ rostersData, tradeValues }) {

  const teamKeys = rostersData ? Object.keys(rostersData) : [];
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [sideAText, setSideAText] = useState('');
  const [sideBText, setSideBText] = useState('');
  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [verdictError, setVerdictError] = useState(false);

  useEffect(() => {
    if (rostersData) {
      const keys = Object.keys(rostersData);
      if (!teamA && keys[0]) setTeamA(keys[0]);
      if (!teamB && keys[1]) setTeamB(keys[1]);
    }
  }, [rostersData]);

  // Inject spin keyframe once
  useEffect(() => {
    if (document.getElementById('tg-spin')) return;
    const s = document.createElement('style');
    s.id = 'tg-spin';
    s.textContent = '@keyframes tg-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }, []);

  function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  const { idMap, nameMap } = useMemo(() => {
    if (!tradeValues) return { idMap: new Map(), nameMap: new Map() };
    const id = new Map(), nm = new Map();
    for (const { player, redraftValue } of tradeValues) {
      const val = redraftValue || 0;
      if (player.sleeperId) id.set(player.sleeperId, { value: val, officialName: player.name });
      nm.set(normalize(player.name), { value: val, sleeperId: player.sleeperId, officialName: player.name });
    }
    return { idMap: id, nameMap: nm };
  }, [tradeValues]);

  function lookupPlayer(inputText) {
    const n = normalize(inputText);
    if (nameMap.has(n)) { const e = nameMap.get(n); return { found:true, value:e.value, officialName:e.officialName, sleeperId:e.sleeperId }; }
    for (const [key, e] of nameMap) { if (key.includes(n) || n.includes(key)) return { found:true, value:e.value, officialName:e.officialName, sleeperId:e.sleeperId }; }
    return { found:false, value:0, officialName:inputText };
  }

  function gradeTrade() {
    const parse = txt => txt.split('\n').map(l => l.trim()).filter(Boolean).map(line => ({ input:line, ...lookupPlayer(line) }));
    const sA = parse(sideAText), sB = parse(sideBText);
    const tA = sA.reduce((s,p) => s+p.value, 0), tB = sB.reduce((s,p) => s+p.value, 0);
    const gap = Math.abs(tA - tB), gapPct = (gap / Math.max(tA, tB, 1)) * 100;
    const winner = gapPct < 5 ? 'even' : tA > tB ? 'A' : 'B';
    const tier = gapPct < 5 ? 'Dead Even ⚖️' : gapPct < 12 ? 'Slight Edge 📊' : gapPct < 25 ? 'Clear Winner 🏆' : 'Lopsided 🚨';
    let addOns = [];
    if (winner !== 'even' && rostersData) {
      const wTeam = winner === 'A' ? teamA : teamB;
      const wSide = winner === 'A' ? sA : sB;
      const exclude = new Set(wSide.map(p => p.officialName));
      addOns = (rostersData[wTeam] || [])
        .map(rp => ({ name: idMap.get(rp.id)?.officialName || rp.name, value: idMap.get(rp.id)?.value || 0, id: rp.id }))
        .filter(rp => !exclude.has(rp.name))
        .sort((a,b) => Math.abs(a.value - gap) - Math.abs(b.value - gap))
        .slice(0, 3);
    }
    setResult({ sA, sB, tA, tB, winner, tier, gap, gapPct, addOns });
    setVerdict(null); setVerdictError(false);
  }

  async function getVerdict() {
    if (!result) return;
    setVerdictLoading(true); setVerdictError(false); setVerdict(null);
    const { sA, sB, tA, tB, winner, tier, gap, gapPct, addOns } = result;
    const sys = "You are the wind-up merchant of the Borehamwood Plancy League. Give a quick, funny verdict on this trade in the Commissioner's voice — bone-dry British football banter, mock gravity. The numbers are computed for you — do NOT recalculate. Just react with wit.";
    const msg = `Trade grade:
Side A (${teamA}) gives up: ${sA.map(p=>`${p.officialName} (${p.value})`).join(', ')} — Total: ${tA}
Side B (${teamB}) gives up: ${sB.map(p=>`${p.officialName} (${p.value})`).join(', ')} — Total: ${tB}
Verdict: ${tier}. ${winner==='even'?'Dead even.':`Side ${winner} wins by ${gap.toFixed(0)} pts (${gapPct.toFixed(1)}%).`}${addOns.length?`\nSuggested add-on: ${addOns.map(a=>`${a.name} (${a.value})`).join(' or ')}`:''}
Give your verdict.`;
    try {
      const r = await claudeCall([{ role:'user', content:msg }], sys);
      setVerdict(r);
    } catch(e) { setVerdictError(true); }
    finally { setVerdictLoading(false); }
  }

  if (!tradeValues) return (
    <div style={{ background:TG_C.bg, display:'flex', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:TG_C.gold, fontSize:14 }}>
      <span style={{ width:16, height:16, border:`2px solid ${TG_C.gold}`, borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'tg-spin 0.8s linear infinite' }} />
      Loading trade values…
    </div>
  );

  const teamOpts = teamKeys.map(k => <option key={k} value={k}>{k}</option>);

  return (
    <div style={{ background:TG_C.bg, color:TG_C.text, padding:16, overflowY:'auto', height:'100%', boxSizing:'border-box' }}>
      <div style={{ color:TG_C.gold, fontSize:18, fontWeight:'bold', marginBottom:14 }}>Trade Grader</div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <TradePanel label="Side A gives up" team={teamA} setTeam={setTeamA} text={sideAText} setText={setSideAText} teamOpts={teamOpts} />
        <TradePanel label="Side B gives up" team={teamB} setTeam={setTeamB} text={sideBText} setText={setSideBText} teamOpts={teamOpts} />
      </div>

      <button onClick={gradeTrade} disabled={!sideAText.trim() && !sideBText.trim()}
        style={{ width:'100%', background:TG_C.gold, color:TG_C.bg, border:'none', borderRadius:10, padding:14, fontSize:16, fontWeight:'bold', cursor:'pointer', marginTop:12, opacity:(!sideAText.trim()&&!sideBText.trim()) ? 0.5 : 1 }}>
        Grade This Trade
      </button>

      {result && (
        <div style={{ marginTop:16 }}>
          {/* Score banner */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:TG_C.surface, borderRadius:12, padding:'14px 16px', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontWeight:'bold', fontSize:15, color: result.winner==='A' ? TG_C.gold : result.winner==='B' ? TG_C.muted : TG_C.text }}>Side A: {result.tA}</div>
            <div style={{ color:TG_C.gold, fontSize:18, fontWeight:'bold', textAlign:'center' }}>{result.tier}</div>
            <div style={{ fontWeight:'bold', fontSize:15, color: result.winner==='B' ? TG_C.gold : result.winner==='A' ? TG_C.muted : TG_C.text }}>Side B: {result.tB}</div>
          </div>

          {/* Player breakdown */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:12 }}>
            <div style={{ flex:1, minWidth:140, background:TG_C.surface, borderRadius:10, padding:12 }}>
              <div style={{ color:TG_C.gold, fontSize:12, fontWeight:'bold', textTransform:'uppercase', marginBottom:8 }}>{teamA || 'Side A'} gives</div>
              {result.sA.map((p,i) => <PlayerRow key={i} p={p} />)}
            </div>
            <div style={{ flex:1, minWidth:140, background:TG_C.surface, borderRadius:10, padding:12 }}>
              <div style={{ color:TG_C.gold, fontSize:12, fontWeight:'bold', textTransform:'uppercase', marginBottom:8 }}>{teamB || 'Side B'} gives</div>
              {result.sB.map((p,i) => <PlayerRow key={i} p={p} />)}
            </div>
          </div>

          {/* Add-ons */}
          {result.winner !== 'even' && result.addOns.length > 0 && (
            <div style={{ background:TG_C.surface, border:`1px solid ${TG_C.border}`, borderRadius:10, padding:12, marginBottom:12 }}>
              <div style={{ color:TG_C.muted, fontSize:13, marginBottom:8 }}>To balance, {result.winner==='A' ? teamA : teamB} could add:</div>
              {result.addOns.map((a,i) => <div key={i} style={{ fontSize:14, marginBottom:2 }}>• {a.name} ({a.value})</div>)}
            </div>
          )}

          {/* Verdict button */}
          <button onClick={getVerdict} disabled={verdictLoading}
            style={{ background:TG_C.surface, border:`1px solid ${TG_C.gold}`, color:TG_C.gold, borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:'bold', cursor: verdictLoading ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:8, opacity: verdictLoading ? 0.7 : 1 }}>
            {verdictLoading && <span style={{ width:14, height:14, border:`2px solid ${TG_C.gold}`, borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'tg-spin 0.8s linear infinite' }} />}
            Get the Commissioner's Verdict
          </button>

          {/* Verdict / error */}
          {(verdict || verdictError) && (
            <div style={{ background:TG_C.surface, border:`1px solid ${verdictError ? TG_C.red : TG_C.gold}`, borderRadius:12, padding:14, color: verdictError ? TG_C.red : TG_C.text, whiteSpace:'pre-wrap', marginTop:8, fontSize:14, lineHeight:1.6 }}>
              {verdictError ? 'The Commissioner is unavailable — give it another go.' : verdict}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APP SHELL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  @keyframes ld-pulse { 0%,80%,100%{opacity:.15;transform:scale(.7)} 40%{opacity:1;transform:scale(1)} }
  .ld { display:inline-block; width:7px; height:7px; background:#888; border-radius:50%; margin:0 2px; animation:ld-pulse 1.4s infinite ease-in-out both; }
  .ld:nth-child(2){animation-delay:.2s} .ld:nth-child(3){animation-delay:.4s}
  button { font-family: inherit; }
  textarea, select, input { font-family: inherit; }
  select option { background: #1a1a1a; color: #f0f0f0; }
`;

const TABS = [
  { id:'stats',  label:'📊  Stats'  },
  { id:'banter', label:'🎙️  Banter' },
  { id:'trade',  label:'⚖️  Trades'  },
];

export default function App() {
  const [tab, setTab] = useState('stats');
  const { history, stats, rosters, tradeValues, loadErrors, loading } = useLeagueData();

  // Inject global CSS once
  useEffect(() => {
    if (document.getElementById('commissioner-css')) return;
    const el = document.createElement('style');
    el.id = 'commissioner-css';
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }, []);

  const appStyle = {
    display:'flex', flexDirection:'column',
    height:'100dvh', maxWidth:480, margin:'0 auto',
    background:'#0a0a0a',
    fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow:'hidden',
  };

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      flex:1, padding:'12px 4px', background:'none', border:'none',
      borderBottom: tab===id ? '2px solid #d4af37' : '2px solid transparent',
      color: tab===id ? '#d4af37' : '#555',
      fontSize:13, fontWeight: tab===id ? 700 : 400,
      cursor:'pointer', letterSpacing:'0.1px',
      transition:'color 0.15s',
    }}>
      {label}
    </button>
  );

  return (
    <div style={appStyle}>
      {/* Header */}
      <div style={{ padding:'13px 16px 8px', background:'#060606', borderBottom:'1px solid #1a1a1a', flexShrink:0 }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#d4af37', letterSpacing:'-0.3px', lineHeight:1.1 }}>
          The Commissioner
        </div>
        <div style={{ fontSize:11, color:'#444', marginTop:3, letterSpacing:'0.6px', textTransform:'uppercase' }}>
          Borehamwood Plancy League
        </div>
      </div>

      {/* Data error bar (non-blocking) */}
      {loadErrors.length > 0 && (
        <div style={{ padding:'4px 12px', fontSize:11, color:'#c0392b', background:'#1a0a0a', borderBottom:'1px solid #2a1a1a', flexShrink:0 }}>
          ⚠ Some data failed to load: {loadErrors.join(' · ')}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', background:'#060606', borderBottom:'1px solid #1a1a1a', flexShrink:0 }}>
        {TABS.map(t => <Tab key={t.id} id={t.id} label={t.label} />)}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'stats'  && <StatsTab historyData={history} statsData={stats} />}
        {tab === 'banter' && <BanterTab historyData={history} />}
        {tab === 'trade'  && <TradeGrader rostersData={rosters} tradeValues={tradeValues} />}
      </div>
    </div>
  );
}
