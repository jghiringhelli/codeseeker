#!/usr/bin/env node
/**
 * Graph quality — how much of the knowledge graph is real?
 *
 * `corpus-bench.js` asks whether the graph *covers* the corpus. This asks whether what it
 * covers is worth having. A graph full of local variables typed as functions still scores
 * 100% coverage while making `sym` return noise, `graph` expand into nothing, and
 * `dead_code` report variables as unused code.
 *
 * Observed on this repository before any fix: a traversal from mcp-server.ts returned
 * `randomEmbedding`, `found`, `projectList`, `results`, `formatted`, `startNodes`,
 * `uniqueEdges`, `filteredDocs` and `maxScore` as `type: "function"`. None is a function;
 * all are `const` bindings inside methods.
 *
 * Usage: node scripts/graph-quality.js [projectName ...]
 */

process.env.CODESEEKER_STORAGE_MODE = process.env.CODESEEKER_STORAGE_MODE || 'embedded';

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { getStorageManager } = require(path.join(ROOT, 'dist/storage/storage-manager.js'));

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

/**
 * Names that are almost certainly not a declared function or class.
 *
 * Deliberately conservative: these are signals for a *report*, not a filter applied to
 * data. Over-flagging here would overstate the problem, which is the opposite of useful.
 */
const SINGLE_WORD_VERBS = new Set(['is', 'of', 'in', 'to', 'as', 'at', 'by', 'on', 'or', 'if', 'do', 'for', 'the', 'and', 'not', 'new', 'get', 'set', 'has']);

function suspicious(name, type) {
  if (type !== 'function' && type !== 'method') return null;
  if (!name) return 'empty name';
  if (SINGLE_WORD_VERBS.has(name.toLowerCase())) return 'language keyword or preposition';
  if (name.length <= 2) return 'name too short to be a declaration';
  if (/^[a-z]+$/.test(name) && name.length <= 6 && !/^(main|init|run|parse|build|load|save|read|write|fetch|apply|merge|split|start|close|open|send)$/.test(name)) {
    return 'short lowercase noun — likely a local binding';
  }
  return null;
}

(async () => {
  const sm = await getStorageManager();
  const ps = sm.getProjectStore();
  const gs = sm.getGraphStore();

  const wanted = process.argv.slice(2);
  const all = await ps.list();
  const seen = new Set();
  const projects = all.filter(p => {
    if (wanted.length && !wanted.includes(p.name)) return false;
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  const report = [];
  console.log(`\n${c.bold}${c.cyan}━━━ graph quality ━━━${c.reset}\n`);

  for (const p of projects) {
    const nodes = await gs.findNodes(p.id);
    if (!nodes.length) continue;

    const byType = {};
    for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;

    const callables = nodes.filter(n => n.type === 'function' || n.type === 'method');
    const flagged = [];
    for (const n of callables) {
      const why = suspicious(n.name, n.type);
      if (why) flagged.push({ name: n.name, why, file: (n.properties && n.properties.relativePath) || '' });
    }

    // A declaration should be unique-ish per file. The same short name appearing in many
    // files is the signature of a local binding harvested as a symbol.
    const nameCounts = {};
    for (const n of callables) nameCounts[n.name] = (nameCounts[n.name] || 0) + 1;
    const repeated = Object.entries(nameCounts).filter(([, k]) => k >= 8).sort((a, b) => b[1] - a[1]);

    const pct = callables.length ? (flagged.length / callables.length * 100) : 0;
    const colour = pct > 20 ? c.red : pct > 8 ? c.yellow : c.green;

    console.log(`  ${c.bold}${p.name}${c.reset} ${c.dim}(${nodes.length} nodes)${c.reset}`);
    console.log(`    types: ${Object.entries(byType).map(([t, k]) => `${t}=${k}`).join('  ')}`);
    console.log(`    callable nodes: ${callables.length}   flagged: ${colour}${flagged.length} (${pct.toFixed(1)}%)${c.reset}`);
    if (flagged.length) {
      const sample = flagged.slice(0, 6).map(f => `${f.name}`).join(', ');
      console.log(`      e.g. ${sample}`);
    }
    if (repeated.length) {
      console.log(`    names repeated across 8+ files: ${repeated.slice(0, 6).map(([n, k]) => `${n}(${k})`).join(', ')}`);
    }
    console.log('');

    report.push({
      project: p.name,
      nodes: nodes.length,
      byType,
      callables: callables.length,
      flagged: flagged.length,
      flaggedPct: Number(pct.toFixed(2)),
      topRepeated: repeated.slice(0, 15).map(([name, count]) => ({ name, count })),
      sample: flagged.slice(0, 25),
    });
  }

  const out = path.join(ROOT, 'reports', 'graph-quality.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), projects: report }, null, 2));
  console.log(`${c.dim}report: reports/graph-quality.json${c.reset}`);
  process.exit(0);
})().catch(e => { console.error('fatal:', e.message); process.exit(1); });
