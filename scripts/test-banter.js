#!/usr/bin/env node
// Tests the banter bot by running real Claude API calls with the full lore system.
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/test-banter.js

const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const LORE_DIR = path.join(__dirname, '..', 'docs', 'lore');

// ── Lore retrieval (mirrors retrieveLore() in commissioner.template.jsx) ─────

const STOP_WORDS = new Set(['the','a','an','is','it','its','was','are','were',
  'this','that','they','them','their','have','had','has','been','being',
  'what','who','how','when','where','why','which','with','for','from',
  'about','into','over','after','will','can','do','be','to','of','and',
  'or','but','in','on','at','by','as','up','out','not','so','if','he',
  'she','we','you','my','your','his','her','our']);

// Person name map (token → canonical name)
const PMAP = {
  daniel:  'Daniel Polak',   polak:  'Daniel Polak',
  david:   'David Livingston',livingston:'David Livingston',alastair:'Alastair Livingston',
  ali:     'Alastair Livingston',
  lev:     'Lev Kerzhentmants',kerzhentmants:'Lev Kerzhentmants',
  mike:    'Mike Parisi',    parisi: 'Mike Parisi',
  rob:     'Rob Levy',       levy:   'Rob Levy',
  jake:    'Jake Spence',    spence: 'Jake Spence',
  ben:     'Ben Murphy',     murphy: 'Ben Murphy',
  nick:    'Nick Andrews',   andrews:'Nick Andrews',
  theo:    'Theo Ford',      ford:   'Theo Ford',
};

function retrieveLore(query, archive, quotes) {
  const tokens = query.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
  if (!tokens.length) return '';

  const mentioned = new Set();
  tokens.forEach(t => { if (PMAP[t]) mentioned.add(PMAP[t]); });

  function score(text) {
    const lower = text.toLowerCase();
    return tokens.reduce((s, t) => {
      const count = (lower.match(new RegExp(t, 'g')) || []).length;
      return s + (count > 0 ? 1 + Math.log(count) : 0);
    }, 0);
  }

  // Score archive chunks
  const archiveScored = archive
    .map(c => ({ ...c, score: score(c.title + ' ' + c.text) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Quote chunks: boost for mentioned people
  const quoteScored = quotes
    .map(c => {
      const personBoost = mentioned.has(c.person) ? 5 : 0;
      return { ...c, score: score(c.lines.join(' ')) + personBoost };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const parts = [];
  archiveScored.forEach(c => parts.push(`[ARCHIVE ${c.year}: ${c.title}]\n${c.text.slice(0, 1500)}`));
  quoteScored.forEach(c => parts.push(`[QUOTES — ${c.person}]\n` + c.lines.map(l => `- "${l}"`).join('\n')));

  return parts.join('\n\n');
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(master) {
  return `PRIME DIRECTIVE: You are The Commissioner — the all-seeing, lore-drenched, bone-dry British voice of the Borehamwood PlAIncy Fantasy Football League. You have perfect recall of every season's drama, every humiliation, every unlikely triumph. Your tone: mock gravity, dry wit, zero sentimentality, maximum specificity. Drop names, years, stats when relevant. Always be funny, never be generic.

--- LORE MASTER ---
${master}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const master  = JSON.parse(fs.readFileSync(path.join(LORE_DIR, 'master.json'), 'utf8')).text;
  const archive = JSON.parse(fs.readFileSync(path.join(LORE_DIR, 'archive-index.json'), 'utf8'));
  const quotes  = JSON.parse(fs.readFileSync(path.join(LORE_DIR, 'quotes-index.json'), 'utf8'));

  const systemPrompt = buildSystemPrompt(master);

  const testQuestions = [
    'Roast the 2025 champion',
    'Who is the most cursed manager?',
    "Give me this week's smack bulletin",
    'Roast Lev',
    'What happened in the most dramatic final?',
  ];

  for (const question of testQuestions) {
    console.log('\n' + '═'.repeat(70));
    console.log(`Q: ${question}`);
    console.log('─'.repeat(70));

    const retrieved = retrieveLore(question, archive, quotes);
    const fullSystem = retrieved
      ? systemPrompt + '\n\n--- RETRIEVED LORE ---\n' + retrieved
      : systemPrompt;

    if (retrieved) {
      console.log(`[Retrieved ${retrieved.length} chars of lore context]`);
    } else {
      console.log('[No lore retrieved]');
    }

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 600,
        thinking: { type: 'adaptive' },
        system: fullSystem,
        messages: [{ role: 'user', content: question }],
      });

      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      console.log('\nA:', text);
    } catch (err) {
      console.error('API error:', err.message);
    }
  }
}

main();
