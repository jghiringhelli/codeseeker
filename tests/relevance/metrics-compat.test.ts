/**
 * Relevance Metrics — COMPAT VERSION (works on v1.8.1 and current)
 *
 * Differences from current metrics.test.ts:
 *   - performSemanticSearch called with 2 args only (no searchType — v1.8.1 API)
 *   - No setRaptorConfig (not in v1.8.1)
 *   - No RAPTOR sweep test
 *   - All searches use the version's default search mode
 *
 * Reports to: $TEMP/codeseeker-metrics-compat-report.txt
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

const METRICS_REPORT = path.join(os.tmpdir(), 'codeseeker-metrics-compat-report.txt');
const _lines: string[] = [];
function report(line: string): void { _lines.push(line); }
function flushReport(): void { fsSync.writeFileSync(METRICS_REPORT, _lines.join('\n') + '\n'); }

interface CaseResult {
  id: string;
  query: string;
  corpus: string;
  mustFind: string[];
  ranks: number[];
  totalResults: number;
}

function rr(ranks: number[]): number {
  const best = ranks.filter(r => r > 0).sort((a, b) => a - b)[0];
  return best ? 1 / best : 0;
}
function precisionAtK(ranks: number[], k: number): number {
  return k > 0 ? ranks.filter(r => r > 0 && r <= k).length / k : 0;
}
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
interface MetricSet { mrr: number; p1: number; p3: number; r5: number; f1at3: number; n: number; }
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
function fmt(v: number): string { return (v * 100).toFixed(1) + '%'; }
function printTable(label: string, m: MetricSet): void {
  report(`  ${label} (n=${m.n})`);
  report(`    MRR ${fmt(m.mrr)}  P@1 ${fmt(m.p1)}  P@3 ${fmt(m.p3)}  R@5 ${fmt(m.r5)}  F1@3 ${fmt(m.f1at3)}`);
}

// ── Themed embeddings ─────────────────────────────────────────────────────────

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
const FIXTURE_FILES: Array<{
  relPath: string;
  themes: ReadonlyArray<keyof typeof THEMES>;
  symbolName: string;
  functions: string[];
}> = [
  { relPath: 'controllers/MegaController.js',  themes: ['controller', 'auth', 'validation'] as const, symbolName: 'MegaController',   functions: ['registerUser', 'loginUser', 'validateInput'] },
  { relPath: 'controllers/UserController.js',  themes: ['controller', 'auth'] as const,              symbolName: 'UserController',    functions: ['getUserById', 'updateUser', 'deleteUser'] },
  { relPath: 'controllers/BusinessLogic.js',   themes: ['controller', 'model'] as const,             symbolName: 'BusinessLogic',     functions: ['processOrder', 'calculateTotal'] },
  { relPath: 'services/UserService.js',        themes: ['auth', 'model'] as const,                   symbolName: 'UserService',       functions: ['hashPassword', 'signToken', 'authenticateUser', 'registerUser'] },
  { relPath: 'services/user-service.js',       themes: ['auth'] as const,                            symbolName: 'userService',       functions: ['hashPassword', 'bcryptCompare', 'createJwt'] },
  { relPath: 'services/contract-validator.js', themes: ['validation', 'model'] as const,             symbolName: 'ContractValidator', functions: ['validateContract', 'checkRules'] },
  { relPath: 'services/IServiceProvider.js',   themes: ['utility'] as const,                         symbolName: 'IServiceProvider',  functions: [] },
  { relPath: 'services/ProcessorFactory.js',   themes: ['utility', 'model'] as const,                symbolName: 'ProcessorFactory',  functions: ['createProcessor', 'buildPipeline'] },
  { relPath: 'utils/DatabaseHelper.js',        themes: ['model', 'utility'] as const,                symbolName: 'DatabaseHelper',    functions: ['findById', 'save', 'delete', 'query'] },
];
const QUERY_THEME_MAP: Record<string, Array<keyof typeof THEMES>> = {
  'bcrypt password hashing':                              ['auth'],
  'jwt sign token expiresIn':                             ['auth'],
  'contract validation rules':                            ['validation'],
  'registerUser function':                                ['controller', 'auth'],
  'authenticate user credentials':                        ['auth'],
  'getUserById method':                                   ['controller'],
  'user login session management':                        ['auth', 'controller'],
  'database record persistence':                          ['model'],
  'user management authentication validation':            ['auth', 'controller', 'validation'],
  'business logic processing factory':                    ['controller', 'model', 'utility'],
  'kubernetes helm chart deployment ingress':             ['utility'],
  'neural network training gradient descent loss function': ['utility'],
  'duplicate authentication bcrypt login':                ['auth'],
  'what do the controllers do':                           ['controller'],
  'service layer business logic':                         ['model', 'utility'],
};
const ZERO_EMBEDDING = new Array(384).fill(0);

// ── Storage ───────────────────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-metrics-compat-${Date.now()}`);
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
      createdAt: new Date(), updatedAt: new Date(),
    });
  }
  if (docs.length > 0) await vectorStore.upsertMany(docs);
  return pid;
}

// ── Search (2-arg API — compatible with v1.8.1 and current) ──────────────────

async function searchCM(query: string): Promise<string[]> {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(cmProjectId);
  await (orch as any).initStorage();
  const themes = QUERY_THEME_MAP[query];
  if (themes) {
    jest.spyOn((orch as any).embeddingGenerator, 'generateQueryEmbedding')
      .mockResolvedValue(blendEmbeddings(themes));
  }
  // 2-arg call — compatible with both versions
  const results = await (orch as any).performSemanticSearch(query, FIXTURE_DIR);
  return results.map((r: any) => path.basename(r.file));
}

async function searchReal(pid: string, root: string, query: string): Promise<string[]> {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(pid);
  const results = await (orch as any).performSemanticSearch(query, root);
  return results.map((r: any) => path.basename(r.file));
}

function collectResult(id: string, query: string, corpus: string, mustFind: string[], resultFiles: string[]): CaseResult {
  const ranks = mustFind.map(target => {
    const idx = resultFiles.findIndex(f => f.includes(target));
    return idx >= 0 ? idx + 1 : 0;
  });
  return { id, query, corpus, mustFind, ranks, totalResults: resultFiles.length };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Relevance Metrics — Compat', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await resetStorageManager();
    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-metrics');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore    = storageManager.getVectorStore();
    projectStore   = storageManager.getProjectStore();

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
        metadata: { themes: entry.themes, symbolName: entry.symbolName, functions: entry.functions },
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    if (docs.length > 0) await vectorStore.upsertMany(docs);

    if (fsSync.existsSync(FORGECRAFT_SRC))
      fcProjectId = await indexRealProject(FORGECRAFT_SRC, FORGECRAFT_FILES);
    if (fsSync.existsSync(CONCLAVE_ROOT))
      cvProjectId = await indexRealProject(CONCLAVE_ROOT, CONCLAVE_FILES);
  }, 120_000);

  afterAll(async () => {
    try { await storageManager.closeAll(); } catch { /* ignore */ }
    try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('baseline MRR / P@k / R@k / F1 — compat (no RAPTOR, 2-arg search)', async () => {
    const allResults: CaseResult[] = [];

    for (const c of CORPUS.filter(c => c.mustFind.length > 0)) {
      const files = await searchCM(c.query);
      allResults.push(collectResult(c.id, c.query, 'contractmaster', c.mustFind, files));
    }

    if (fcProjectId) {
      for (const c of FORGECRAFT_CORPUS.filter(c => c.mustFind.length > 0)) {
        const files = await searchReal(fcProjectId!, FORGECRAFT_SRC, c.query);
        allResults.push(collectResult(c.id, c.query, 'forgecraft', c.mustFind, files));
      }
    }

    if (cvProjectId) {
      for (const c of CONCLAVE_CORPUS.filter(c => c.mustFind.length > 0)) {
        const files = await searchReal(cvProjectId!, CONCLAVE_ROOT, c.query);
        allResults.push(collectResult(c.id, c.query, 'conclave', c.mustFind, files));
      }
    }

    report('═'.repeat(60));
    report('  CODESEEKER RELEVANCE METRICS — COMPAT BASELINE');
    report(`  Version: ${require('../../package.json').version}`);
    report('═'.repeat(60));

    for (const corpus of ['contractmaster', 'forgecraft', 'conclave']) {
      const subset = allResults.filter(r => r.corpus === corpus);
      if (subset.length > 0) printTable(corpus.padEnd(14), computeMetrics(subset));
    }
    report('');
    printTable('AGGREGATE     ', computeMetrics(allResults));

    const misses = allResults.filter(r => r.ranks.some(rank => rank === 0 || rank > 3));
    if (misses.length > 0) {
      report('\n  Misses / slow-finds (rank 0 or > 3):');
      for (const m of misses) {
        report(`    [${m.id}] ${m.corpus}: targets=${m.mustFind.join(',')}  ranks=${m.ranks.join(',')}`);
      }
    }
    report('═'.repeat(60));

    const agg = computeMetrics(allResults);
    flushReport();

    expect(agg.mrr).toBeGreaterThan(0.40);  // relaxed gate — v1.8.1 may score lower
    expect(agg.r5).toBeGreaterThan(0.50);
  }, 120_000);
});
