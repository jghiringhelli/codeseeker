#!/usr/bin/env node
/**
 * Real-Index Benchmark Script
 *
 * Runs the full IndexingService pipeline on real projects:
 *   scan → AST chunk → real Xenova embeddings → graph → RAPTOR L2/L3
 * Then queries the live populated index and measures ranking quality.
 *
 * Usage:
 *   node scripts/real-bench.js
 *
 * Requires:
 *   npm run build  (reads from dist/)
 */

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Setup ─────────────────────────────────────────────────────────────────────

const BENCH_DIR = path.join(os.tmpdir(), `codeseeker-real-bench-${Date.now()}`);
const REPORT_PATH = path.join(os.tmpdir(), 'codeseeker-real-index-report.txt');

process.env.CODESEEKER_STORAGE_MODE = 'embedded';
process.env.CODESEEKER_DATA_DIR = path.join(BENCH_DIR, '.codeseeker');
fs.mkdirSync(process.env.CODESEEKER_DATA_DIR, { recursive: true });

// Load from dist/ — compiled code with working Xenova dynamic import
const { getStorageManager, resetStorageManager } = require('../dist/storage');
const { SemanticSearchOrchestrator } = require('../dist/cli/commands/services/semantic-search-orchestrator');
const { IndexingService } = require('../dist/mcp/indexing-service');

// ── Report ────────────────────────────────────────────────────────────────────

const lines = [];
function report(line) {
  lines.push(line);
  console.log(line);
}
function flushReport() {
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function rr(ranks) {
  const best = ranks.filter(r => r > 0).sort((a, b) => a - b)[0];
  return best ? 1 / best : 0;
}
function p_at_k(ranks, k) { return k > 0 ? ranks.filter(r => r > 0 && r <= k).length / k : 0; }
function r_at_k(ranks, k) {
  if (!ranks.length) return 1;
  return ranks.filter(r => r > 0 && r <= k).length / ranks.length;
}
function f1(p, r) { return p + r > 0 ? (2 * p * r) / (p + r) : 0; }
function avg(xs) { return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; }

function metrics(results) {
  const rel = results.filter(r => r.mustFind.length > 0);
  return {
    mrr:   avg(rel.map(r => rr(r.ranks))),
    p1:    avg(rel.map(r => p_at_k(r.ranks, 1))),
    p3:    avg(rel.map(r => p_at_k(r.ranks, 3))),
    r5:    avg(rel.map(r => r_at_k(r.ranks, 5))),
    f1at3: avg(rel.map(r => f1(p_at_k(r.ranks, 3), r_at_k(r.ranks, 3)))),
    n: rel.length,
  };
}
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function table(label, m) {
  report(`  ${label.padEnd(24)} n=${m.n}  MRR ${pct(m.mrr)}  P@1 ${pct(m.p1)}  P@3 ${pct(m.p3)}  R@5 ${pct(m.r5)}  F1@3 ${pct(m.f1at3)}`);
}
function collect(id, query, corpus, mustFind, resultFiles) {
  const ranks = mustFind.map(target => {
    const idx = resultFiles.findIndex(f => f.includes(target));
    return idx >= 0 ? idx + 1 : 0;
  });
  return { id, query, corpus, mustFind, ranks, totalResults: resultFiles.length };
}

// ── Corpora ───────────────────────────────────────────────────────────────────

const CONCLAVE_ROOT = 'C:\\workspace\\claude\\conclave';
const CONCLAVE_CORPUS = [
  { id: 'cv-dag',        query: 'topologicalSort getCriticalPath DagCycleError detectCycle',                          mustFind: ['dag-engine'],                   mustNotFind: [] },
  { id: 'cv-dag-errors', query: 'DagCycleError DagDuplicateNodeError DagInvalidDependencyError DagNodeNotFoundError', mustFind: ['dag-engine'],                   mustNotFind: [] },
  { id: 'cv-bounce',     query: 'escalate_tech_lead ESCALATE_TECH_LEAD_AT SUMMARIZE_AT BounceExceededError',          mustFind: ['bounce-protocol'],              mustNotFind: [] },
  { id: 'cv-bounce-act', query: 'bounceCount recordBounce determineAction getHumanEscalations resolveThread',         mustFind: ['bounce-protocol'],              mustNotFind: [] },
  { id: 'cv-registry',   query: 'spawnInstance teardownInstance findIdleInstances tokensConsumed instanceCounters',   mustFind: ['registry'],                    mustNotFind: [] },
  { id: 'cv-executor',   query: 'pendingGates approveGate rejectGate ConfirmationGate handleTaskAssigned',            mustFind: ['role-executor'],                mustNotFind: [] },
  { id: 'cv-exec-mode',  query: 'ExecutionMode autonomous supervised interactive',                                    mustFind: ['role-executor', 'types'],       mustNotFind: [] },
  { id: 'cv-orch',       query: 'checkpoint resume phase_change tickIntervalMs executionMode maxConcurrentRoles',     mustFind: ['orchestrator'],                 mustNotFind: [] },
  { id: 'cv-pipeline',   query: 'STANDARD_PIPELINE pipeline phases planning executing reviewing',                     mustFind: ['pipeline-template'],           mustNotFind: [] },
  { id: 'cv-prompts',    query: 'loadSystemPrompt role architect developer code_reviewer security',                   mustFind: ['orchestrator', 'role-executor'], mustNotFind: [] },
  { id: 'cv-bcrypt',     query: 'bcrypt password hash salt rounds compare',                                           mustFind: [],                              mustNotFind: ['orchestrator', 'dag-engine', 'registry'] },
  { id: 'cv-css',        query: 'flexbox grid media query CSS breakpoint viewport',                                   mustFind: [],                              mustNotFind: ['bounce-protocol', 'dag-engine', 'role-executor'] },
];

// Point to Assets/Scripts only — avoids ~3000 XML package doc files
const IC2_ROOT = 'C:\\workspace\\ImperialCommander2\\ImperialCommander2\\Assets\\Scripts';
const IC2_CORPUS = [
  { id: 'ic2-datastore',  query: 'DeploymentCard allyCards villainCards deploymentHand sessionData',    mustFind: ['DataStore'],                        mustNotFind: [] },
  { id: 'ic2-mission',    query: 'Mission gameType missionCards ownedExpansions languageCodeList',       mustFind: ['DataStore'],                        mustNotFind: [] },
  { id: 'ic2-glow',       query: 'GlowEngine glow pulse animation effect',                              mustFind: ['GlowEngine'],                       mustNotFind: [] },
  { id: 'ic2-saga',       query: 'SagaController saga session setup campaign',                          mustFind: ['SagaController'],                   mustNotFind: [] },
  { id: 'ic2-activation', query: 'EnemyActivationPopup enemy activation threat',                        mustFind: ['EnemyActivationPopup'],             mustNotFind: [] },
  { id: 'ic2-fileio',     query: 'FileManager save load JSON serialize persistence',                     mustFind: ['FileManager'],                      mustNotFind: [] },
  { id: 'ic2-sound',      query: 'Sound audio music play volume clip',                                  mustFind: ['Sound'],                            mustNotFind: [] },
  { id: 'ic2-camera',     query: 'SimpleCameraController camera movement input',                        mustFind: ['SimpleCameraController'],           mustNotFind: [] },
];

const GENSPEC_ROOT = 'C:\\workspace\\generative-specification';
// genspec: purely exploratory — no ground truth, just checking what surfaces
const GENSPEC_CORPUS = [
  { id: 'gs-cnt',        query: 'context navigation tree CNT wayfinder claude index',        mustFind: [], mustNotFind: [] },
  { id: 'gs-raptor',     query: 'RAPTOR hierarchical summary cascade retrieval augmented',   mustFind: [], mustNotFind: [] },
  { id: 'gs-metrics',    query: 'MRR precision recall F1 relevance evaluation metrics',     mustFind: [], mustNotFind: [] },
  { id: 'gs-codeseeker', query: 'CodeSeeker semantic search indexing graph MCP sentinel',   mustFind: [], mustNotFind: [] },
];

// ── Core helpers ──────────────────────────────────────────────────────────────

async function setupProject(name, projectPath) {
  await resetStorageManager();
  const sm = await getStorageManager();
  const projectId = crypto.randomUUID();
  await sm.getProjectStore().upsert({ id: projectId, name, path: projectPath });
  return { sm, projectId };
}

async function runIndex(projectPath, projectId) {
  const svc = new IndexingService();
  let lastPhase = '';
  const result = await svc.indexProject(projectPath, projectId, (p) => {
    if (p.phase !== lastPhase) {
      process.stdout.write(`\r  [${p.phase}] ...`);
      lastPhase = p.phase;
    }
  });
  process.stdout.write('\n');
  return result;
}

async function searchProject(projectId, projectPath, query) {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(projectId);
  const results = await orch.performSemanticSearch(query, projectPath);
  return results.map(r => path.basename(r.file));
}

// ── Benchmark runner ──────────────────────────────────────────────────────────

async function runBench(label, projectPath, projectName, corpus) {
  if (!fs.existsSync(projectPath)) {
    report(`\nSKIP ${label} — not found: ${projectPath}`);
    return null;
  }

  report('\n' + '═'.repeat(72));
  report(`  PROJECT: ${label}`);
  report('═'.repeat(72));

  const { sm, projectId } = await setupProject(projectName, projectPath);
  const indexResult = await runIndex(projectPath, projectId);
  report(`  Indexed: ${indexResult.filesIndexed} files, ${indexResult.chunksCreated} chunks, ` +
    `${indexResult.nodesCreated} nodes, ${indexResult.edgesCreated} edges, ` +
    `${(indexResult.durationMs / 1000).toFixed(1)}s`);
  if (indexResult.errors.length > 0) {
    report(`  Index errors: ${indexResult.errors.slice(0, 3).join('; ')}`);
  }

  // Debug: show which files were indexed
  try {
    const store = sm.getEmbeddingStore ? sm.getEmbeddingStore() : null;
    if (store && store.getAllByProject) {
      const allDocs = await store.getAllByProject(projectId);
      const uniqueFiles = [...new Set(allDocs.map(d => d.filePath))].sort();
      report(`  Indexed files (${uniqueFiles.length}):`);
      uniqueFiles.forEach(f => report(`    ${path.relative(projectPath, f)}`));
    }
  } catch (_e) { /* storage API may differ */ }

  report('\n  Queries:');
  const results = [];

  for (const c of corpus) {
    const files = await searchProject(projectId, projectPath, c.query);
    if (c.mustFind.length > 0) {
      const res = collect(c.id, c.query, label, c.mustFind, files);
      results.push(res);
      const hit = res.ranks.every(r => r > 0)
        ? `✓ ranks ${res.ranks.join(',')}`
        : `✗ miss  (${res.ranks.join(',')})`;
      report(`  [${c.id.padEnd(14)}] ${hit.padEnd(18)} → ${files.slice(0, 3).join(', ')}`);
    } else {
      // out-of-scope
      const bad = c.mustNotFind.length > 0
        ? files.filter(f => c.mustNotFind.some(m => f.includes(m)))
        : [];
      const scope = bad.length > 0 ? `✗ LEAK: ${bad.join(',')}` : `✓ scope ok (${files.length} results)`;
      report(`  [${c.id.padEnd(14)}] ${scope}`);
    }
  }

  report('');
  if (results.length > 0) table(label, metrics(results));

  await sm.closeAll().catch(() => {});
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  report('CODESEEKER REAL-INDEX BENCHMARK');
  report(`Version: ${require('../package.json').version}`);
  report(`Date: ${new Date().toISOString()}`);
  report(`Index dir: ${process.env.CODESEEKER_DATA_DIR}`);

  const allResults = [];

  // 1. Conclave — ground truth
  const cvResults = await runBench('Conclave (TypeScript)', CONCLAVE_ROOT, 'conclave', CONCLAVE_CORPUS);
  if (cvResults) allResults.push(...cvResults);

  // 2. ImperialCommander2 — C#/Unity, language-agnostic
  const ic2Results = await runBench('ImperialCommander2 (C#/Unity)', IC2_ROOT, 'ic2', IC2_CORPUS);
  if (ic2Results) allResults.push(...ic2Results);

  // 3. Generative Spec — skip for this run (exploratory, no mustFind)
  // const gsResults = await runBench('generative-specification (Markdown)', GENSPEC_ROOT, 'genspec', GENSPEC_CORPUS);
  // if (gsResults) allResults.push(...gsResults);

  // Aggregate
  if (allResults.length > 0) {
    report('\n' + '═'.repeat(72));
    report('  AGGREGATE (all projects with mustFind)');
    table('TOTAL', metrics(allResults));
    report('═'.repeat(72));
  }

  // Cleanup temp dir
  try { fs.rmSync(BENCH_DIR, { recursive: true, force: true }); } catch {}

  flushReport();
  report(`\nReport saved to: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
