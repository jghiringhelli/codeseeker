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

/**
 * The RealWorld corpora are cloned per-machine; `scripts/corpus.json` already records
 * where. Reading it here keeps one source of truth rather than a second list that drifts.
 * A corpus that is not on this machine is skipped with a notice, never a failure.
 */
function corpusPath(name) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf-8'));
    const entry = cfg.corpora.find(c => c.name === name);
    return entry ? entry.path : null;
  } catch {
    return null;
  }
}

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

// ── RealWorld corpora ────────────────────────────────────────────────────────────
//
// The same application - Conduit, a Medium clone - implemented three times in three
// languages. That is the point: the domain is held constant, so a score difference
// between these three is a difference in *language handling*, not in task difficulty.
// Everything above measures TypeScript and C# only.
//
// Queries are written as a developer would ask them - intent, not a symbol-name soup -
// and every target below was confirmed by reading the file it points at.

const DJANGO_ROOT = corpusPath('realworld-django');
const DJANGO_CORPUS = [
  { id: 'py-jwt-issue',  query: 'generate a JWT token for a user with an expiry date',              mustFind: ['authentication/models.py'],      mustNotFind: [] },
  { id: 'py-jwt-verify', query: 'authenticate a request by reading the Token authorization header', mustFind: ['authentication/backends.py'],    mustNotFind: [] },
  { id: 'py-follow',     query: 'follow and unfollow another user profile',                         mustFind: ['profiles/models.py'],            mustNotFind: [] },
  { id: 'py-favorite',   query: 'mark an article as favorited by a user and count favorites',       mustFind: ['profiles/models.py'],            mustNotFind: [] },
  { id: 'py-slug',       query: 'build a unique slug from the article title before saving',         mustFind: ['articles/signals.py'],           mustNotFind: [] },
  { id: 'py-tag-field',  query: 'serialize tags as a related field on an article',                  mustFind: ['articles/relations.py'],         mustNotFind: [] },
  { id: 'py-envelope',   query: 'wrap the JSON response body in a named envelope key',              mustFind: ['core/renderers.py'],             mustNotFind: [] },
  { id: 'py-register',   query: 'register a new user and validate the password on signup',          mustFind: ['authentication/serializers.py'], mustNotFind: [] },
  { id: 'py-comments',   query: 'list and create comments belonging to an article',                 mustFind: ['articles/views.py'],             mustNotFind: [] },
  { id: 'py-scope',      query: 'kubernetes deployment yaml ingress replica set',                   mustFind: [],                                mustNotFind: ['articles/views.py', 'authentication/models.py'] },
];

const REACT_ROOT = corpusPath('realworld-react-redux');
const REACT_CORPUS = [
  { id: 'js-api-client', query: 'send HTTP requests to the API with the auth token attached', mustFind: ['src/agent.js'],                           mustNotFind: [] },
  { id: 'js-persist',    query: 'persist the JWT to local storage after login or register',   mustFind: ['src/middleware.js'],                      mustNotFind: [] },
  { id: 'js-promise-mw', query: 'resolve promises inside redux actions before dispatching',   mustFind: ['src/middleware.js'],                      mustNotFind: [] },
  { id: 'js-list-state', query: 'reducer holding the article list and the current page',      mustFind: ['src/reducers/articleList.js'],            mustNotFind: [] },
  { id: 'js-editor',     query: 'form to write and publish an article with tags',             mustFind: ['src/components/Editor.js'],               mustNotFind: [] },
  { id: 'js-settings',   query: 'form to update the current user settings and logout',        mustFind: ['src/components/Settings.js'],             mustNotFind: [] },
  { id: 'js-delete-btn', query: 'button that deletes a comment on an article',                mustFind: ['src/components/Article/DeleteButton.js'], mustNotFind: [] },
  { id: 'js-pagination', query: 'render the page numbers under a list of articles',           mustFind: ['src/components/ListPagination.js'],       mustNotFind: [] },
  { id: 'js-scope',      query: 'sql migration schema primary key index',                     mustFind: [],                                         mustNotFind: ['src/agent.js', 'src/store.js'] },
];

const EXPRESS_ROOT = corpusPath('realworld-node-express');
const EXPRESS_CORPUS = [
  { id: 'ex-article-crud', query: 'create update and delete an article by its slug',            mustFind: ['article.service.ts'],    mustNotFind: [] },
  { id: 'ex-routes',       query: 'express routes exposing the articles REST endpoints',        mustFind: ['article.controller.ts'],  mustNotFind: [] },
  { id: 'ex-login',        query: 'log a user in and sign a JWT for them',                      mustFind: ['auth.service.ts'],        mustNotFind: [] },
  { id: 'ex-follow',       query: 'follow and unfollow a profile by username',                  mustFind: ['profile.service.ts'],     mustNotFind: [] },
  { id: 'ex-feed',         query: 'paginated feed of articles from the authors a user follows', mustFind: ['article.service.ts'],     mustNotFind: [] },
  { id: 'ex-tags',         query: 'return the list of popular tags',                            mustFind: ['tag.service.ts'],         mustNotFind: [] },
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

async function searchProject(projectId, projectPath, query, graphDepth = 1, raptorOff = false) {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(projectId);
  orch.setGraphExpansionDepth(graphDepth);
  if (raptorOff) orch.setRaptorConfig({ l2Threshold: 999 });
  const results = await orch.performSemanticSearch(query, projectPath);
  // Project-relative, forward-slashed. Basenames cannot address a Django project: conduit
  // has four `models.py`, four `views.py` and three `serializers.py`, so `mustFind:
  // ['models']` would be satisfied by the wrong app. Every existing target still matches,
  // because a basename is a substring of the path that ends with it.
  return results.map(r => path.relative(projectPath, r.file).replace(/\\/g, '/'));
}

// ── Benchmark runner ──────────────────────────────────────────────────────────

async function runQueries(label, projectId, projectPath, corpus, graphDepth, raptorOff) {
  const tag = raptorOff ? `(graph-depth=${graphDepth},no-raptor)` : `(graph-depth=${graphDepth})`;
  report(`\n  ── ${label} ${tag} ──`);
  const results = [];

  for (const c of corpus) {
    const files = await searchProject(projectId, projectPath, c.query, graphDepth, raptorOff);
    if (c.mustFind.length > 0) {
      const res = collect(c.id, c.query, label, c.mustFind, files);
      results.push(res);
      const hit = res.ranks.every(r => r > 0)
        ? `✓ ranks ${res.ranks.join(',')}`
        : `✗ miss  (${res.ranks.join(',')})`;
      report(`  [${c.id.padEnd(14)}] ${hit.padEnd(18)} → ${files.slice(0, 4).join(', ')}`);
    } else {
      const bad = c.mustNotFind.length > 0
        ? files.filter(f => c.mustNotFind.some(m => f.includes(m)))
        : [];
      const scope = bad.length > 0 ? `✗ LEAK: ${bad.join(',')}` : `✓ scope ok (${files.length} results)`;
      report(`  [${c.id.padEnd(14)}] ${scope}`);
    }
  }

  if (results.length > 0) table(label, metrics(results));
  return results;
}

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

  // Graph connectivity check
  try {
    const graphStore = sm.getGraphStore ? sm.getGraphStore() : null;
    if (graphStore) {
      const fileNodes = await graphStore.findNodes(projectId, 'file');
      report(`  Graph file nodes: ${fileNodes.length}`);
      if (fileNodes.length > 0) {
        let fileFileEdges = 0, totalNeighbors = 0;
        const N = Math.min(10, fileNodes.length);
        for (const fn of fileNodes.slice(0, N)) {
          const neighbors = await graphStore.getNeighbors(fn.id);
          fileFileEdges  += neighbors.filter(n => n.type === 'file').length;
          totalNeighbors += neighbors.length;
        }
        report(`  Graph (sample ${N}): avg ${(totalNeighbors/N).toFixed(1)} neighbors, ${(fileFileEdges/N).toFixed(1)} file→file`);
      }
    }
  } catch (e) { report(`  Graph debug error: ${e.message}`); }

  // Ablation: 3 graph depths + RAPTOR disabled control
  const r0  = await runQueries(`${label} [no-graph]`,   projectId, projectPath, corpus, 0, false);
  const r1  = await runQueries(`${label} [graph-1hop]`, projectId, projectPath, corpus, 1, false);
  const r2  = await runQueries(`${label} [graph-2hop]`, projectId, projectPath, corpus, 2, false);
  const rNR = await runQueries(`${label} [no-raptor]`,  projectId, projectPath, corpus, 1, true);

  await sm.closeAll().catch(() => {});
  return { r0, r1, r2, rNR };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  report('CODESEEKER REAL-INDEX BENCHMARK -- ABLATION');
  report(`Version: ${require('../package.json').version}`);
  report(`Date: ${new Date().toISOString()}`);
  report(`Index dir: ${process.env.CODESEEKER_DATA_DIR}`);

  const agg = { r0: [], r1: [], r2: [], rNR: [] };

  const cv = await runBench('Conclave (TypeScript)', CONCLAVE_ROOT, 'conclave', CONCLAVE_CORPUS);
  if (cv) { agg.r0.push(...cv.r0); agg.r1.push(...cv.r1); agg.r2.push(...cv.r2); agg.rNR.push(...cv.rNR); }

  const ic2 = await runBench('ImperialCommander2 (C#/Unity)', IC2_ROOT, 'ic2', IC2_CORPUS);
  if (ic2) { agg.r0.push(...ic2.r0); agg.r1.push(...ic2.r1); agg.r2.push(...ic2.r2); agg.rNR.push(...ic2.rNR); }

  for (const [label, root, name, corpus] of [
    ['RealWorld Conduit (Python/Django)',      DJANGO_ROOT,  'rw-django',  DJANGO_CORPUS],
    ['RealWorld Conduit (JavaScript/React)',   REACT_ROOT,   'rw-react',   REACT_CORPUS],
    ['RealWorld Conduit (TypeScript/Express)', EXPRESS_ROOT, 'rw-express', EXPRESS_CORPUS],
  ]) {
    if (!root) { report(`\nSKIP ${label} - not listed in scripts/corpus.json`); continue; }
    const r = await runBench(label, root, name, corpus);
    if (r) { agg.r0.push(...r.r0); agg.r1.push(...r.r1); agg.r2.push(...r.r2); agg.rNR.push(...r.rNR); }
  }

  report('\n' + '='.repeat(72));
  report(`  ABLATION SUMMARY (aggregate, n=${agg.r1.length} scored queries)`);
  report('='.repeat(72));
  if (agg.r0.length  > 0) table('no-graph (hybrid baseline)', metrics(agg.r0));
  if (agg.r1.length  > 0) table('+ graph-1hop',               metrics(agg.r1));
  if (agg.r2.length  > 0) table('+ graph-2hop',               metrics(agg.r2));
  if (agg.rNR.length > 0) table('no-raptor (graph-1hop)',      metrics(agg.rNR));
  report('='.repeat(72));

  try { fs.rmSync(BENCH_DIR, { recursive: true, force: true }); } catch {}
  flushReport();
  report(`\nReport saved to: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
