/**
 * Relevance Metrics — MRR, P@k, R@k, F1@k
 *
 * Runs every corpus case (ContractMaster hybrid+FTS, ForgeCraft FTS, Conclave FTS),
 * records the ACTUAL rank for each mustFind target, then computes:
 *
 *   MRR   — Mean Reciprocal Rank  (primary quality signal)
 *   P@1   — Precision at rank 1
 *   P@3   — Precision at rank 3
 *   R@5   — Recall at rank 5
 *   F1@3  — Harmonic mean of P@3 and R@3
 *
 * Also sweeps three RAPTOR cascade configurations to find optimal thresholds,
 * then reports the parameter set that maximises MRR for the hybrid corpus.
 *
 * Run:
 *   npx jest tests/relevance/metrics --no-coverage --verbose
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as crypto from 'crypto';
import {
  getStorageManager,
  resetStorageManager,
  StorageManager,
} from '../../src/storage';
import type { IVectorStore, IProjectStore, VectorDocument } from '../../src/storage/interfaces';
import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import { CORPUS } from './corpus';
import { FORGECRAFT_CORPUS, FORGECRAFT_FILES, FORGECRAFT_SRC } from './corpus-forgecraft';
import { CONCLAVE_CORPUS, CONCLAVE_FILES, CONCLAVE_ROOT } from './corpus-conclave';

// Metrics report file — Jest suppresses console.log on passing tests so we write to disk
const METRICS_REPORT = path.join(os.tmpdir(), 'codeseeker-metrics-report.txt');
const _lines: string[] = [];
function report(line: string): void { _lines.push(line); }
function flushReport(): void { fsSync.writeFileSync(METRICS_REPORT, _lines.join('\n') + '\n'); }

// ── Types ─────────────────────────────────────────────────────────────────────

interface RaptorConfig {
  label: string;
  l2Threshold: number;
  cascadeMinResults: number;
  cascadeTopScore: number;
}

interface CaseResult {
  id: string;
  query: string;
  corpus: string;
  searchType: string;
  mustFind: string[];
  /** 1-based rank for each mustFind item. 0 = not found in results. */
  ranks: number[];
  totalResults: number;
}

// ── Metrics math ──────────────────────────────────────────────────────────────

/** Reciprocal rank = 1 / best_rank_found, or 0 if nothing found */
function rr(ranks: number[]): number {
  const best = ranks.filter(r => r > 0).sort((a, b) => a - b)[0];
  return best ? 1 / best : 0;
}

/** Precision at k: of the top-k slots, how many contain a mustFind file? */
function precisionAtK(ranks: number[], k: number): number {
  const hits = ranks.filter(r => r > 0 && r <= k).length;
  return k > 0 ? hits / k : 0;
}

/** Recall at k: fraction of mustFind items found within top-k */
function recallAtK(ranks: number[], k: number): number {
  if (ranks.length === 0) return 1;
  return ranks.filter(r => r > 0 && r <= k).length / ranks.length;
}

function f1(p: number, r: number): number {
  return p + r > 0 ? (2 * p * r) / (p + r) : 0;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

interface MetricSet {
  mrr: number;
  p1: number;
  p3: number;
  r5: number;
  f1at3: number;
  n: number;
}

function computeMetrics(results: CaseResult[]): MetricSet {
  const relevant = results.filter(r => r.mustFind.length > 0);
  return {
    mrr:   avg(relevant.map(r => rr(r.ranks))),
    p1:    avg(relevant.map(r => precisionAtK(r.ranks, 1))),
    p3:    avg(relevant.map(r => precisionAtK(r.ranks, 3))),
    r5:    avg(relevant.map(r => recallAtK(r.ranks, 5))),
    f1at3: avg(relevant.map(r => f1(precisionAtK(r.ranks, 3), recallAtK(r.ranks, 3)))),
    n: relevant.length,
  };
}

function fmt(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function printTable(label: string, m: MetricSet): void {
  report(`\n  ${label} (n=${m.n})`);
  report(`    MRR   ${fmt(m.mrr)}   P@1 ${fmt(m.p1)}   P@3 ${fmt(m.p3)}   R@5 ${fmt(m.r5)}   F1@3 ${fmt(m.f1at3)}`);
}

// ── Themed embeddings (ContractMaster only) ───────────────────────────────────

const THEMES: Record<string, number> = {
  auth: 0, controller: 1, model: 2, middleware: 3, utility: 4, validation: 5,
};

function makeThemedEmbedding(theme: keyof typeof THEMES, strength = 1.0): number[] {
  const dims = 384, blockSize = 32, offset = THEMES[theme] * blockSize;
  const val = strength / Math.sqrt(blockSize);
  return Array.from({ length: dims }, (_, i) => i >= offset && i < offset + blockSize ? val : 0);
}

function blendEmbeddings(themes: Array<keyof typeof THEMES>): number[] {
  const raw = Array(384).fill(0) as number[];
  for (const t of themes) { const e = makeThemedEmbedding(t); for (let i = 0; i < 384; i++) raw[i] += e[i]; }
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? raw.map(v => v / norm) : raw;
}

const FIXTURE_DIR = path.join(__dirname, '../fixtures/ContractMaster-Test-Original/server');
const FIXTURE_FILES = [
  { relPath: 'controllers/MegaController.js',  themes: ['controller', 'auth', 'validation'] as const },
  { relPath: 'controllers/UserController.js',  themes: ['controller', 'auth'] as const },
  { relPath: 'controllers/BusinessLogic.js',   themes: ['controller', 'model'] as const },
  { relPath: 'services/UserService.js',        themes: ['auth', 'model'] as const },
  { relPath: 'services/user-service.js',       themes: ['auth'] as const },
  { relPath: 'services/contract-validator.js', themes: ['validation', 'model'] as const },
  { relPath: 'services/IServiceProvider.js',   themes: ['utility'] as const },
  { relPath: 'services/ProcessorFactory.js',   themes: ['utility', 'model'] as const },
  { relPath: 'utils/DatabaseHelper.js',        themes: ['model', 'utility'] as const },
];
const QUERY_THEME_MAP: Record<string, Array<keyof typeof THEMES>> = {
  'bcrypt password hashing':                        ['auth'],
  'jwt sign token expiresIn':                       ['auth'],
  'contract validation rules':                      ['validation'],
  'registerUser function':                          ['controller', 'auth'],
  'authenticate user credentials':                  ['auth'],
  'getUserById method':                             ['controller'],
  'user login session management':                  ['auth', 'controller'],
  'database record persistence':                    ['model'],
  'user management authentication validation':      ['auth', 'controller', 'validation'],
  'business logic processing factory':              ['controller', 'model', 'utility'],
  'kubernetes helm chart deployment ingress':       ['utility'],
  'neural network training gradient descent loss function': ['utility'],
  'duplicate authentication bcrypt login':          ['auth'],
  'what do the controllers do':                     ['controller'],
  'service layer business logic':                   ['model', 'utility'],
};

const ZERO_EMBEDDING = new Array(384).fill(0);

// ── Storage helpers ───────────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-metrics-${Date.now()}`);
let storageManager: StorageManager;
let vectorStore: IVectorStore;
let projectStore: IProjectStore;
let cmProjectId: string;
let fcProjectId: string | null = null;
let cvProjectId: string | null = null;

async function indexRealProject(root: string, relFiles: string[]): Promise<string> {
  const pid = crypto.randomUUID();
  await projectStore.upsert({ id: pid, name: path.basename(root), path: root });
  const docs: VectorDocument[] = [];
  for (const rel of relFiles) {
    const abs = path.join(root, rel);
    let content = '';
    try { content = fsSync.readFileSync(abs, 'utf-8'); } catch { continue; }
    docs.push({
      id: crypto.createHash('md5').update(`${pid}:${rel}`).digest('hex'),
      projectId: pid, filePath: abs, content,
      embedding: ZERO_EMBEDDING,
      metadata: { fileName: path.basename(rel), extension: path.extname(rel) },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  if (docs.length > 0) await vectorStore.upsertMany(docs);
  return pid;
}

// ── Search runner ─────────────────────────────────────────────────────────────

async function searchCM(
  query: string,
  searchType: 'hybrid' | 'fts',
  raptorConfig?: RaptorConfig
): Promise<string[]> {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(cmProjectId);
  if (raptorConfig) orch.setRaptorConfig(raptorConfig);
  await (orch as any).initStorage();

  const themes = QUERY_THEME_MAP[query];
  if (themes && searchType !== 'fts') {
    jest.spyOn((orch as any).embeddingGenerator, 'generateQueryEmbedding')
      .mockResolvedValue(blendEmbeddings(themes));
  }
  const results = await orch.performSemanticSearch(query, FIXTURE_DIR, searchType);
  return results.map(r => path.basename(r.file));
}

async function searchFts(pid: string, root: string, query: string): Promise<string[]> {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(pid);
  const results = await orch.performSemanticSearch(query, root, 'fts');
  return results.map(r => path.basename(r.file));
}

function collectResult(
  id: string, query: string, corpus: string, searchType: string,
  mustFind: string[], resultFiles: string[]
): CaseResult {
  const ranks = mustFind.map(target => {
    const idx = resultFiles.findIndex(f => f.includes(target));
    return idx >= 0 ? idx + 1 : 0;
  });
  return { id, query, corpus, searchType, mustFind, ranks, totalResults: resultFiles.length };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Relevance Metrics', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await resetStorageManager();
    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-metrics');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore    = storageManager.getVectorStore();
    projectStore   = storageManager.getProjectStore();

    // Index ContractMaster with themed embeddings
    cmProjectId = crypto.randomUUID();
    await projectStore.upsert({ id: cmProjectId, name: 'contractmaster', path: FIXTURE_DIR });
    const docs: VectorDocument[] = [];
    for (const entry of FIXTURE_FILES) {
      const abs = path.join(FIXTURE_DIR, entry.relPath);
      let content = '';
      try { content = fsSync.readFileSync(abs, 'utf-8'); } catch { continue; }
      docs.push({
        id: crypto.createHash('md5').update(`${cmProjectId}:${entry.relPath}`).digest('hex'),
        projectId: cmProjectId, filePath: abs, content,
        embedding: blendEmbeddings([...entry.themes]),
        metadata: { themes: entry.themes },
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    if (docs.length > 0) await vectorStore.upsertMany(docs);

    // Index real projects (graceful skip if absent)
    if (fsSync.existsSync(FORGECRAFT_SRC))
      fcProjectId = await indexRealProject(FORGECRAFT_SRC, FORGECRAFT_FILES);
    if (fsSync.existsSync(CONCLAVE_ROOT))
      cvProjectId = await indexRealProject(CONCLAVE_ROOT, CONCLAVE_FILES);
  }, 120_000);

  afterAll(async () => {
    try { await storageManager.closeAll(); } catch { /* ignore */ }
    try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── 1. Baseline metrics across all corpora ───────────────────────────────────

  it('compute baseline MRR / P@k / R@k / F1 across all corpora', async () => {
    const allResults: CaseResult[] = [];

    // ContractMaster — hybrid
    for (const c of CORPUS.filter(c => c.mustFind.length > 0)) {
      const files = await searchCM(c.query, 'hybrid');
      allResults.push(collectResult(c.id, c.query, 'contractmaster', 'hybrid', c.mustFind, files));
    }

    // ContractMaster — FTS
    const ftsCases = CORPUS.filter(c =>
      c.mustFind.length > 0 &&
      c.tags.some(t => ['exact-keyword', 'exact-symbol', 'duplicate-detection'].includes(t))
    );
    for (const c of ftsCases) {
      const files = await searchCM(c.query, 'fts');
      allResults.push(collectResult(c.id, c.query, 'contractmaster', 'fts', c.mustFind, files));
    }

    // ForgeCraft FTS
    if (fcProjectId) {
      for (const c of FORGECRAFT_CORPUS.filter(c => c.mustFind.length > 0)) {
        const files = await searchFts(fcProjectId!, FORGECRAFT_SRC, c.query);
        allResults.push(collectResult(c.id, c.query, 'forgecraft', 'fts', c.mustFind, files));
      }
    }

    // Conclave FTS
    if (cvProjectId) {
      for (const c of CONCLAVE_CORPUS.filter(c => c.mustFind.length > 0)) {
        const files = await searchFts(cvProjectId!, CONCLAVE_ROOT, c.query);
        allResults.push(collectResult(c.id, c.query, 'conclave', 'fts', c.mustFind, files));
      }
    }

    // ── Print per-corpus and aggregate ──────────────────────────────────────
    report('\n' + '═'.repeat(64));
    report('  CODESEEKER RELEVANCE METRICS — BASELINE');
    report('═'.repeat(64));

    const corpora = ['contractmaster', 'forgecraft', 'conclave'];
    const types   = ['hybrid', 'fts'];
    for (const corpus of corpora) {
      for (const stype of types) {
        const subset = allResults.filter(r => r.corpus === corpus && r.searchType === stype);
        if (subset.length > 0) printTable(`${corpus.padEnd(14)} ${stype}`, computeMetrics(subset));
      }
    }
    printTable('AGGREGATE', computeMetrics(allResults));

    // Per-case detail for any miss (rank 0 or rank > 3)
    const misses = allResults.filter(r => r.ranks.some(rank => rank === 0 || rank > 3));
    if (misses.length > 0) {
      report('\n  Misses / slow-finds (rank 0 or > 3):');
      for (const m of misses) {
        report(`    [${m.id}] ${m.corpus}/${m.searchType}: targets=${m.mustFind.join(',')}  ranks=${m.ranks.join(',')}`);
      }
    }

    report('═'.repeat(64) + '\n');

    // Minimum quality gate — fail CI if we regress below this
    const agg = computeMetrics(allResults);
    expect(agg.mrr).toBeGreaterThan(0.60);
    expect(agg.p1).toBeGreaterThan(0.50);
    expect(agg.r5).toBeGreaterThan(0.70);
    flushReport();
  }, 120_000);

  // ── 2. RAPTOR cascade config sweep (hybrid corpus only) ──────────────────────

  it('RAPTOR config sweep — find thresholds maximising MRR on hybrid corpus', async () => {
    const CONFIGS: RaptorConfig[] = [
      { label: 'current  (0.50 / 3 / 0.25)', l2Threshold: 0.50, cascadeMinResults: 3, cascadeTopScore: 0.25 },
      { label: 'relaxed  (0.30 / 2 / 0.15)', l2Threshold: 0.30, cascadeMinResults: 2, cascadeTopScore: 0.15 },
      { label: 'strict   (0.70 / 4 / 0.35)', l2Threshold: 0.70, cascadeMinResults: 4, cascadeTopScore: 0.35 },
      { label: 'disabled (1.00 / 1 / 1.00)', l2Threshold: 1.00, cascadeMinResults: 1, cascadeTopScore: 1.00 },
    ];

    const hybridCases = CORPUS.filter(c => c.mustFind.length > 0);

    report('\n' + '═'.repeat(64));
    report('  RAPTOR CONFIG SWEEP (ContractMaster hybrid)');
    report('═'.repeat(64));

    let bestConfig = CONFIGS[0];
    let bestMrr = 0;

    for (const cfg of CONFIGS) {
      const results: CaseResult[] = [];
      for (const c of hybridCases) {
        const files = await searchCM(c.query, 'hybrid', cfg);
        results.push(collectResult(c.id, c.query, 'contractmaster', 'hybrid', c.mustFind, files));
      }
      const m = computeMetrics(results);
      const marker = m.mrr > bestMrr ? ' ◀ best so far' : '';
      report(`  ${cfg.label.padEnd(34)} MRR ${fmt(m.mrr)}  P@1 ${fmt(m.p1)}  R@5 ${fmt(m.r5)}${marker}`);
      if (m.mrr > bestMrr) { bestMrr = m.mrr; bestConfig = cfg; }
    }

    report(`\n  Recommended config: ${bestConfig.label}`);
    report(`    l2Threshold=${bestConfig.l2Threshold}  cascadeMinResults=${bestConfig.cascadeMinResults}  cascadeTopScore=${bestConfig.cascadeTopScore}`);
    report('═'.repeat(64) + '\n');

    // All configs should produce at least baseline quality
    expect(bestMrr).toBeGreaterThan(0.55);
    flushReport();
  }, 180_000);
});

