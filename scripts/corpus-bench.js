#!/usr/bin/env node
/**
 * Corpus benchmark — run CodeSeeker against a real project and measure what it did.
 *
 * `scripts/real-bench.js` measures retrieval *quality* against hand-labelled queries.
 * This measures retrieval *integrity*: whether the index, the graph and the search corpus
 * agree with each other and with the filesystem. Those are the failures users actually
 * reported (issues #2, #3, #5), and no labelled query set is needed to detect them.
 *
 * Checks, each mapped to a specification requirement:
 *
 *   COVERAGE   R14  graph file-nodes vs. distinct files in the vector store
 *   DELETION   R13  delete a file through sync, assert it becomes unreachable
 *   RESOLUTION R3   sym/graph resolve without an explicit project argument
 *   PATHS      R10  every returned path is project-relative and exists on disk
 *   STANDARDS  R18  every file cited as evidence is a source file
 *   SEARCH     R9   queries return ranked summaries, not content
 *
 * Usage:
 *   node scripts/corpus-bench.js <path-to-project> [--name <label>] [--keep]
 *   node scripts/corpus-bench.js --all            # every project in corpus.json
 */

process.env.CODESEEKER_STORAGE_MODE = process.env.CODESEEKER_STORAGE_MODE || 'embedded';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const { CodeSeekerMcpServer } = require(path.join(ROOT, 'dist/mcp/mcp-server.js'));
const { getStorageManager } = require(path.join(ROOT, 'dist/storage/storage-manager.js'));

const txt = (r) => (r && r.content && r.content[0] && r.content[0].text) || '';
const jsonOf = (r) => { try { return JSON.parse(txt(r)); } catch { return null; } };
const norm = (s) => String(s || '').split('\\').join('/');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const results = [];
function record(check, requirement, status, detail) {
  results.push({ check, requirement, status, detail });
  const mark = status === 'PASS' ? `${c.green}PASS${c.reset}`
    : status === 'FAIL' ? `${c.red}FAIL${c.reset}`
      : `${c.yellow}${status}${c.reset}`;
  console.log(`  [${mark}] ${c.bold}${check}${c.reset} (${requirement}) — ${detail}`);
}

async function waitForIndexing(server, name, timeoutMs = 30 * 60 * 1000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = jsonOf(await server.handleProjects());
    const proj = status && (status.projects || []).find((p) => p.name === name);
    if (!proj) continue;
    last = proj;
    if (proj.indexing_status === 'completed') return proj;
    if (proj.indexing_status === 'failed') throw new Error(`indexing failed: ${proj.indexing_error || 'unknown'}`);
    const p = proj.indexing_progress;
    if (p) process.stdout.write(`\r    indexing… ${p.filesProcessed}/${p.filesTotal} files, ${p.chunksCreated} chunks   `);
  }
  throw new Error(`indexing did not complete within ${timeoutMs}ms (last: ${JSON.stringify(last)})`);
}

async function benchOne(projectPath, label) {
  const name = label || `bench-${path.basename(projectPath)}`;
  console.log(`\n${c.bold}${c.cyan}━━━ ${name} ━━━${c.reset}`);
  console.log(`${c.dim}${projectPath}${c.reset}`);

  const server = new CodeSeekerMcpServer();
  const t0 = Date.now();
  const init = jsonOf(await server.handleIndexInit({ path: projectPath, name }));
  if (!init || init.status !== 'indexing_started') {
    record('INDEX', 'S1', 'FAIL', `init did not start: ${txt(await server.handleIndexInit({ path: projectPath, name })).slice(0, 160)}`);
    return;
  }
  const proj = await waitForIndexing(server, name);
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const r = proj.indexing_result || {};
  record('INDEX', 'S1/A4', 'PASS',
    `${r.filesIndexed} files, ${r.chunksCreated} chunks, ${r.nodesCreated} nodes, ${r.edgesCreated} edges in ${secs}s`);

  const sm = await getStorageManager();
  const projectRecord = (await sm.getProjectStore().list()).find((p) => p.name === name);
  const graphStore = sm.getGraphStore();
  const vectorStore = sm.getVectorStore();

  // ── COVERAGE (R14) ────────────────────────────────────────────────────────
  const nodes = await graphStore.findNodes(projectRecord.id);
  const graphFiles = new Set(
    nodes
      .filter((n) => n.type === 'file' && !(n.properties && n.properties.isProjectRoot))
      .map((n) => norm((n.properties && n.properties.relativePath) || path.relative(projectRecord.path, n.filePath || '')))
      .filter(Boolean)
  );
  const probe = Array.from({ length: 384 }, () => Math.random() - 0.5);
  const docs = await vectorStore.searchByVector(probe, projectRecord.id, 100000);
  const corpusFiles = new Set(
    docs
      .map((d) => norm(d.document.filePath))
      .filter((f) => f && !f.includes('__raptor__'))
  );
  const missing = [...corpusFiles].filter((f) => !graphFiles.has(f));
  const ratio = corpusFiles.size ? (graphFiles.size / corpusFiles.size) : 0;
  record('COVERAGE', 'R14', missing.length === 0 ? 'PASS' : 'FAIL',
    `graph ${graphFiles.size} / corpus ${corpusFiles.size} files (${(ratio * 100).toFixed(1)}%)` +
    (missing.length ? ` — ${missing.length} searchable but not in graph, e.g. ${missing.slice(0, 3).join(', ')}` : ''));

  // ── DELETION (R13) ────────────────────────────────────────────────────────
  const victim = [...graphFiles].find((f) => /\.(ts|js|py|cs|go|java)$/i.test(f));
  if (!victim) {
    record('DELETION', 'R13', 'SKIP', 'no source file in graph to test with');
  } else {
    await server.handleSync({ project: name, changes: [{ type: 'deleted', path: victim }] });
    const after = await graphStore.findNodes(projectRecord.id);
    const stillThere = after.filter((n) => {
      const rel = norm((n.properties && n.properties.relativePath) || path.relative(projectRecord.path, n.filePath || ''));
      return rel === victim;
    });
    record('DELETION', 'R13', stillThere.length === 0 ? 'PASS' : 'FAIL',
      `deleted "${victim}" via sync — ${stillThere.length} node(s) still reachable afterwards`);
  }

  // ── RESOLUTION (R3) ───────────────────────────────────────────────────────
  const symName = (nodes.find((n) => n.type === 'class') || nodes.find((n) => n.type === 'function') || {}).name;
  if (symName) {
    const symRes = await server.handleSymbolLookup(symName, name, false);
    record('RESOLUTION', 'R3', symRes.isError ? 'FAIL' : 'PASS',
      `sym("${symName}") ${symRes.isError ? 'errored: ' + txt(symRes).slice(0, 90) : 'resolved'}`);
  } else {
    record('RESOLUTION', 'R3', 'SKIP', 'no class or function node to look up');
  }

  // ── SEARCH + PATHS (R9, R10) ──────────────────────────────────────────────
  const queries = ['how does authentication work', 'error handling', 'database access'];
  let ok = 0, badPaths = [], leakedContent = 0;
  for (const q of queries) {
    const res = jsonOf(await server.handleSearch(q, name, 5, 'hybrid', false, false));
    if (!res || !res.results) continue;
    ok++;
    for (const hit of res.results) {
      if (path.isAbsolute(hit.file)) badPaths.push(hit.file);
      else if (!fs.existsSync(path.join(projectRecord.path, hit.file))) badPaths.push(hit.file);
      if (hit.snippet) leakedContent++;
    }
  }
  record('SEARCH', 'S2', ok === queries.length ? 'PASS' : 'FAIL', `${ok}/${queries.length} queries returned ranked results`);
  record('PATHS', 'R10', badPaths.length === 0 ? 'PASS' : 'FAIL',
    badPaths.length ? `${badPaths.length} path(s) absolute or missing on disk, e.g. ${badPaths.slice(0, 2).join(', ')}` : 'all returned paths project-relative and present');
  record('SUMMARIES', 'R9', leakedContent === 0 ? 'PASS' : 'FAIL',
    leakedContent ? `${leakedContent} result(s) carried a snippet without full:true` : 'no content returned by default');

  // ── STANDARDS (R18) ───────────────────────────────────────────────────────
  const std = jsonOf(await server.handleStandards({ project: name, category: 'all' }));
  if (!std || !std.standards) {
    record('STANDARDS', 'R18', 'SKIP', 'no standards generated for this corpus');
  } else {
    const cited = new Set();
    for (const cat of Object.values(std.standards)) {
      for (const pat of Object.values(cat || {})) for (const f of (pat.files || [])) cited.add(norm(f));
    }
    const nonSource = [...cited].filter((f) => /\.(md|txt|json|lock|yaml|yml)$/i.test(f) || /fixtures|node_modules|\/dist\//i.test(f));
    record('STANDARDS', 'R18', nonSource.length === 0 ? 'PASS' : 'FAIL',
      `${cited.size} files cited as evidence` + (nonSource.length ? `, ${nonSource.length} non-source, e.g. ${nonSource.slice(0, 3).join(', ')}` : ', all source'));
  }

  return { name, files: r.filesIndexed, chunks: r.chunksCreated, nodes: r.nodesCreated, edges: r.edgesCreated, seconds: Number(secs) };
}

async function main() {
  const args = process.argv.slice(2);
  const targets = [];
  if (args[0] === '--all') {
    const cfgPath = path.join(ROOT, 'scripts', 'corpus.json');
    if (!fs.existsSync(cfgPath)) { console.error('scripts/corpus.json not found'); process.exit(1); }
    for (const t of JSON.parse(fs.readFileSync(cfgPath, 'utf8')).corpora) {
      if (fs.existsSync(t.path)) targets.push(t);
      else console.log(`${c.yellow}skip${c.reset} ${t.name} — not present at ${t.path}`);
    }
  } else {
    if (!args[0]) { console.error('usage: node scripts/corpus-bench.js <project-path> [--name label]'); process.exit(1); }
    const ni = args.indexOf('--name');
    targets.push({ path: path.resolve(args[0]), name: ni >= 0 ? args[ni + 1] : undefined });
  }

  const summary = [];
  for (const t of targets) {
    try {
      const s = await benchOne(t.path, t.name);
      if (s) summary.push({ ...s, language: t.language, shape: t.shape });
    } catch (e) {
      console.log(`  [${c.red}ERROR${c.reset}] ${t.name || t.path}: ${e.message}`);
      results.push({ check: 'RUN', requirement: '-', status: 'ERROR', detail: `${t.name}: ${e.message}` });
    }
  }

  console.log(`\n${c.bold}━━━ summary ━━━${c.reset}`);
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const other = results.length - pass - fail;
  for (const s of summary) {
    console.log(`  ${s.name.padEnd(28)} ${String(s.files).padStart(5)} files  ${String(s.chunks).padStart(6)} chunks  ${String(s.nodes).padStart(6)} nodes  ${String(s.seconds).padStart(4)}s  ${s.language || ''} ${s.shape || ''}`);
  }
  console.log(`\n  ${c.green}${pass} pass${c.reset}  ${c.red}${fail} fail${c.reset}  ${c.yellow}${other} skip/error${c.reset}`);

  const failures = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  if (failures.length) {
    console.log(`\n${c.bold}failures${c.reset}`);
    for (const f of failures) console.log(`  ${c.red}${f.check}${c.reset} (${f.requirement}) — ${f.detail}`);
  }

  const out = path.join(ROOT, 'reports', 'corpus');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'corpus-bench.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2));
  console.log(`\n${c.dim}report: reports/corpus/corpus-bench.json${c.reset}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
