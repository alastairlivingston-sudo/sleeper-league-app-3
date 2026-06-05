#!/usr/bin/env node
// Converts lore/*.md source files into JSON indexes served from docs/lore/.
// Run: node scripts/build-lore.js
// Outputs:
//   docs/lore/master.json        — { text } full lore-master text
//   docs/lore/archive-index.json — [ { id, title, year, text }, … ] one per essay
//   docs/lore/quotes-index.json  — [ { person, lines[] }, … ] one per person

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const LORE    = path.join(ROOT, 'lore');
const OUT_DIR = path.join(ROOT, 'docs', 'lore');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 1. master.json ────────────────────────────────────────────────────────────
const masterText = fs.readFileSync(path.join(LORE, 'lore-master.md'), 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'master.json'), JSON.stringify({ text: masterText }));
console.log('master.json —', Math.round(Buffer.byteLength(masterText) / 1024), 'KB text');

// ── 2. archive-index.json ─────────────────────────────────────────────────────
// Split on top-level numbered headings: ## N. YEAR · ...
const archiveRaw = fs.readFileSync(path.join(LORE, 'history-archive.md'), 'utf8');
const archiveChunks = [];
const ARCHIVE_SPLIT = /^## (\d+)\.\s+((\d{4})[^\n]*)/m;

const archiveSections = archiveRaw.split(/(?=^## \d+\.)/m).filter(s => s.trim());
archiveSections.forEach(function(section) {
  const m = section.match(/^## (\d+)\.\s+((\d{4})[^\n]*)/);
  if (!m) return;
  const id    = parseInt(m[1], 10);
  const title = m[2].trim();
  const year  = m[3];
  const text  = section.replace(/^## [^\n]+\n/, '').trim();
  archiveChunks.push({ id, title, year, text });
});

fs.writeFileSync(path.join(OUT_DIR, 'archive-index.json'), JSON.stringify(archiveChunks));
console.log('archive-index.json —', archiveChunks.length, 'chunks');

// ── 3. quotes-index.json ──────────────────────────────────────────────────────
// Split on ## PERSON NAME headings; extract quoted lines (starting with - ")
const quotesRaw = fs.readFileSync(path.join(LORE, 'quote-bank.md'), 'utf8');
const quotesChunks = [];

const personSections = quotesRaw.split(/(?=^## [A-Z])/m).filter(s => s.trim());
personSections.forEach(function(section) {
  const headerMatch = section.match(/^## ([^\n]+)/);
  if (!headerMatch) return;
  const headerLine = headerMatch[1].trim();
  // Skip the title line "THE PLANCEY — PER-PERSON QUOTE BANK" etc.
  if (headerLine.startsWith('THE ')) return;

  // Extract the canonical person name (before the em-dash), title-cased
  const rawPerson = headerLine.split('—')[0].trim().split('/')[0].trim();
  const person = rawPerson.replace(/\b\w/g, c => c.toUpperCase()).replace(/\b(\w+)\b/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  // Extract verbatim quote lines: lines starting with - "
  const lines = [];
  section.split('\n').forEach(function(line) {
    const m = line.match(/^-\s+"(.+?)"\s*(?:\*\[[\d/]+\]\*)?$/);
    if (m) lines.push(m[1]);
  });

  if (lines.length) quotesChunks.push({ person, lines });
});

fs.writeFileSync(path.join(OUT_DIR, 'quotes-index.json'), JSON.stringify(quotesChunks));
console.log('quotes-index.json —', quotesChunks.length, 'people,', quotesChunks.reduce((s, c) => s + c.lines.length, 0), 'lines');
