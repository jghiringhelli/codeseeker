/**
 * Codanna vs CodeSeeker — Search Accuracy Comparison
 *
 * Runs the same ground-truth queries from search-accuracy.benchmark.ts
 * against Codanna on the ContractMaster fixture, then prints a side-by-side
 * table vs the CodeSeeker baseline.json results.
 *
 * Run: node tests/benchmarks/codanna-comparison.mjs
 *
 * Requires: Codanna installed at %USERPROFILE%\.codanna-bin\codanna.exe
 *           Fixture already indexed (cd to fixture, run `codanna index .`)
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const FIXTURE_DIR = path.join(__dirname, '../fixtures/ContractMaster-Test-Original/server');
const BASELINE_FILE = path.join(__dirname, 'baseline.json');

// Find codanna binary
function findCodanna() {
  const binDir = path.join(os.homedir(), '.codanna-bin');
  const exts = process.platform === 'win32' ? ['.exe', ''] : ['', '.exe'];
  for (const ext of exts) {
    const p = path.join(binDir, `codanna${ext}`);
    if (fs.existsSync(p)) return p;
    // search recursively one level
    if (fs.existsSync(binDir)) {
      for (const sub of fs.readdirSync(binDir)) {
        const candidate = path.join(binDir, sub, `codanna${ext}`);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

// ── Ground truth (same as benchmark) ────────────────────────────────────────
const GROUND_TRUTH = [
  {
    id: 'auth-bcrypt',
    query: 'bcrypt authenticate password hash',
    primarySymbol: 'bcrypt',
    relevant: ['UserService.js', 'user-service.js'],
  },
  {
    id: 'contract-validate',
    query: 'validateContract title parties email',
    primarySymbol: 'validateContract',
    relevant: ['contract-validator.js'],
  },
  {
    id: 'user-crud',
    query: 'getUserById getAllUsers updateUser deleteUser',
    primarySymbol: 'getUserById',
    relevant: ['UserController.js'],
  },
  {
    id: 'jwt-token',
    query: 'jwt sign token userId expiresIn',
    primarySymbol: 'signToken',
    relevant: ['UserService.js'],
  },
  {
    id: 'factory-processor',
    query: 'createProcessor NDA employment factory switch',
    primarySymbol: 'createProcessor',
    relevant: ['ProcessorFactory.js'],
  },
  {
    id: 'interface-segregation',
    query: 'authenticateUser resetUserPassword createContract listContracts interface',
    primarySymbol: 'authenticateUser',
    relevant: ['IServiceProvider.js'],
  },
];

// ── IR metrics ───────────────────────────────────────────────────────────────
function toBasename(filePath) {
  return path.basename(filePath);
}

function precisionAtK(files, relevant, k) {
  const topK = files.slice(0, k);
  const hits = topK.filter(f => relevant.includes(toBasename(f)));
  return k === 0 ? 0 : hits.length / k;
}

function recallAtK(files, relevant, k) {
  if (relevant.length === 0) return 0;
  const topK = files.slice(0, k);
  const hits = topK.filter(f => relevant.includes(toBasename(f)));
  return hits.length / relevant.length;
}

function mrr(files, relevant) {
  for (let i = 0; i < Math.min(files.length, 10); i++) {
    if (relevant.includes(toBasename(files[i]))) return 1 / (i + 1);
  }
  return 0;
}

function r2(n) { return Math.round(n * 100) / 100; }

// ── Codanna search ───────────────────────────────────────────────────────────
function codannaSearchSymbols(codanna, query, limit = 10) {
  try {
    const raw = execSync(
      `"${codanna}" mcp search_symbols "query:${query}" limit:${limit} --json`,
      { cwd: FIXTURE_DIR, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(raw);
    if (result.status !== 'success' || !result.data) return [];
    // Deduplicate by file_path, preserve first occurrence (highest score)
    const seen = new Set();
    const files = [];
    for (const item of result.data) {
      const fp = item.symbol.file_path.replace(/^\.[\\/]/, '');
      if (!seen.has(fp)) { seen.add(fp); files.push(fp); }
    }
    return files;
  } catch (e) {
    return [];
  }
}

function codannaSemanticSearch(codanna, query, limit = 10) {
  try {
    const raw = execSync(
      `"${codanna}" mcp semantic_search_with_context "query:${query}" limit:${limit} --json`,
      { cwd: FIXTURE_DIR, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(raw);
    if (result.status !== 'success' || !result.data) return { files: [], enabled: false };
    const seen = new Set();
    const files = [];
    for (const item of (Array.isArray(result.data) ? result.data : [])) {
      const fp = (item.symbol?.file_path || item.file_path || '').replace(/^\.[\\/]/, '');
      if (fp && !seen.has(fp)) { seen.add(fp); files.push(fp); }
    }
    return { files, enabled: true };
  } catch (e) {
    // Parse the JSON error to see if semantic is disabled
    try {
      const msg = e.stdout?.toString() || '';
      const parsed = JSON.parse(msg);
      return { files: [], enabled: false, reason: parsed.message };
    } catch {
      return { files: [], enabled: false, reason: e.message };
    }
  }
}

// Multi-term: run each term, merge results by file (rank = first appearance)
function codannaMultiTermSearch(codanna, query, limit = 10) {
  const terms = query.split(/\s+/);
  const fileRank = new Map(); // file → first rank seen across all term searches
  let globalRank = 0;
  for (const term of terms) {
    const files = codannaSearchSymbols(codanna, term, limit);
    for (const f of files) {
      if (!fileRank.has(f)) { fileRank.set(f, globalRank++); }
    }
  }
  return [...fileRank.entries()].sort((a, b) => a[1] - b[1]).map(([f]) => f);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const codanna = findCodanna();
  if (!codanna) {
    console.error('❌  Codanna binary not found in ~/.codanna-bin/');
    process.exit(1);
  }
  console.log(`Codanna binary: ${codanna}\n`);

  // Check index info
  let indexInfo = {};
  try {
    const raw = execSync(`"${codanna}" mcp get_index_info --json`, { cwd: FIXTURE_DIR, encoding: 'utf-8', timeout: 10000 });
    indexInfo = JSON.parse(raw).data || {};
  } catch {}

  const semanticEnabled = indexInfo.semantic_search?.enabled === true;
  console.log(`Index: ${indexInfo.symbol_count ?? '?'} symbols, ${indexInfo.file_count ?? '?'} files`);
  console.log(`Semantic search: ${semanticEnabled ? '✅ enabled' : '❌ disabled (0 embeddings — JS without JSDoc not embedded)'}\n`);

  // Load CodeSeeker baseline
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
  const bMap = new Map(baseline.map(b => [`${b.queryId}::${b.mode}`, b]));

  // Run Codanna queries
  const codannaResults = [];

  console.log('Running Codanna searches...\n');
  for (const gt of GROUND_TRUTH) {
    // Primary symbol search (single term — what Codanna is designed for)
    const primaryFiles = codannaSearchSymbols(codanna, gt.primarySymbol, 10);
    // Multi-term symbol search (all query words)
    const multiFiles = codannaMultiTermSearch(codanna, gt.query, 10);
    // Semantic (likely disabled)
    const sem = codannaSemanticSearch(codanna, gt.query, 10);

    codannaResults.push({
      id: gt.id,
      relevant: gt.relevant,
      primary: { mode: 'symbol_primary', files: primaryFiles },
      multi:   { mode: 'symbol_multi',   files: multiFiles },
      semantic: { mode: 'semantic', files: sem.files, enabled: sem.enabled },
    });
  }

  // ── Print comparison table ─────────────────────────────────────────────────
  const SEP = '═'.repeat(110);
  const sep = '─'.repeat(110);

  console.log(SEP);
  console.log('  CODANNA vs CODESEEKER — Search Accuracy Comparison');
  console.log('  Fixture: ContractMaster (8 JS files, undocumented)');
  console.log(SEP);
  console.log(
    `  ${'Query ID'.padEnd(28)} ${'Tool'.padEnd(20)} ${'Mode'.padEnd(18)} ${'P@3'.padStart(5)} ${'P@5'.padStart(5)} ${'R@5'.padStart(5)} ${'MRR'.padStart(5)}`
  );
  console.log(sep);

  const summary = { codanna: [], codeseeker_hybrid: [] };

  for (const r of codannaResults) {
    const gt = GROUND_TRUTH.find(g => g.id === r.id);

    // CodeSeeker hybrid (best mode)
    const csHybrid = bMap.get(`${r.id}::hybrid`);
    if (csHybrid) {
      console.log(
        `  ${r.id.padEnd(28)} ${'CodeSeeker'.padEnd(20)} ${'hybrid'.padEnd(18)} ${String(csHybrid.p3).padStart(5)} ${String(csHybrid.p5).padStart(5)} ${String(csHybrid.r5).padStart(5)} ${String(csHybrid.mrr).padStart(5)}`
      );
      summary.codeseeker_hybrid.push(csHybrid);
    }

    // CodeSeeker graph
    const csGraph = bMap.get(`${r.id}::graph`);
    if (csGraph) {
      console.log(
        `  ${''.padEnd(28)} ${'CodeSeeker'.padEnd(20)} ${'graph'.padEnd(18)} ${String(csGraph.p3).padStart(5)} ${String(csGraph.p5).padStart(5)} ${String(csGraph.r5).padStart(5)} ${String(csGraph.mrr).padStart(5)}`
      );
    }

    // Codanna primary symbol
    const p = r.primary.files;
    const cp3 = r2(precisionAtK(p, r.relevant, 3));
    const cp5 = r2(precisionAtK(p, r.relevant, 5));
    const cr5 = r2(recallAtK(p, r.relevant, 5));
    const cmrr = r2(mrr(p, r.relevant));
    console.log(
      `  ${''.padEnd(28)} ${'Codanna'.padEnd(20)} ${'symbol (primary term)'.padEnd(18)} ${String(cp3).padStart(5)} ${String(cp5).padStart(5)} ${String(cr5).padStart(5)} ${String(cmrr).padStart(5)}`
    );
    summary.codanna.push({ p3: cp3, p5: cp5, r5: cr5, mrr: cmrr });

    // Codanna multi-term
    const m = r.multi.files;
    const mp3 = r2(precisionAtK(m, r.relevant, 3));
    const mp5 = r2(precisionAtK(m, r.relevant, 5));
    const mr5 = r2(recallAtK(m, r.relevant, 5));
    const mmrr = r2(mrr(m, r.relevant));
    console.log(
      `  ${''.padEnd(28)} ${'Codanna'.padEnd(20)} ${'symbol (multi-term)'.padEnd(18)} ${String(mp3).padStart(5)} ${String(mp5).padStart(5)} ${String(mr5).padStart(5)} ${String(mmrr).padStart(5)}`
    );

    // Codanna semantic
    if (r.semantic.enabled) {
      const sf = r.semantic.files;
      const sp3 = r2(precisionAtK(sf, r.relevant, 3));
      const sp5 = r2(precisionAtK(sf, r.relevant, 5));
      const sr5 = r2(recallAtK(sf, r.relevant, 5));
      const smrr = r2(mrr(sf, r.relevant));
      console.log(
        `  ${''.padEnd(28)} ${'Codanna'.padEnd(20)} ${'semantic'.padEnd(18)} ${String(sp3).padStart(5)} ${String(sp5).padStart(5)} ${String(sr5).padStart(5)} ${String(smrr).padStart(5)}`
      );
    } else {
      console.log(
        `  ${''.padEnd(28)} ${'Codanna'.padEnd(20)} ${'semantic'.padEnd(18)} ${'N/A'.padStart(5)} ${'N/A'.padStart(5)} ${'N/A'.padStart(5)} ${'N/A'.padStart(5)}  ← disabled (no JSDoc embeddings)`
      );
    }

    console.log(sep);
  }

  // ── Means ──────────────────────────────────────────────────────────────────
  const mean = arr => r2(arr.reduce((s, v) => s + v, 0) / arr.length);

  const csH = summary.codeseeker_hybrid;
  const ca = summary.codanna;

  console.log('');
  console.log('  MEAN across all queries:');
  console.log(`  ${'CodeSeeker hybrid:'.padEnd(30)} P@3=${mean(csH.map(x=>x.p3))}  P@5=${mean(csH.map(x=>x.p5))}  R@5=${mean(csH.map(x=>x.r5))}  MRR=${mean(csH.map(x=>x.mrr))}`);
  console.log(`  ${'Codanna symbol (primary):'.padEnd(30)} P@3=${mean(ca.map(x=>x.p3))}  P@5=${mean(ca.map(x=>x.p5))}  R@5=${mean(ca.map(x=>x.r5))}  MRR=${mean(ca.map(x=>x.mrr))}`);
  console.log('');
  console.log('  NOTES:');
  console.log('  • Codanna semantic search: 0 embeddings on this fixture — BY DESIGN, not a bug.');
  console.log('    Per Codanna docs: "Semantic search finds code through documentation comments, not the name."');
  console.log('    It embeds JSDoc/TypeDoc/Rust doc comments on symbols. Undocumented JS = nothing to embed.');
  console.log('    On well-documented codebases (JSDoc, Rust, Python docstrings) Codanna semantic would work.');
  console.log('    Most real-world JS/TS projects are partially or fully undocumented — this is the typical case.');
  console.log('  • Codanna symbol search (FTS) searches identifier names only, not code body/string content.');
  console.log('  • CodeSeeker embeds full code chunk content — works regardless of documentation presence.');
  console.log('  • CodeSeeker FTS searches full file content: variable values, string literals, comments, bodies.');
  console.log(SEP);
}

main().catch(console.error);
