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
