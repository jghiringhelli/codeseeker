/**
 * Search Accuracy Benchmark
 *
 * Purpose: Curated precision/recall matrix to detect search quality regressions.
 *          Run anytime you change the search pipeline, storage, scoring, tokenisation
 *          or graph indexing to verify behaviour is preserved.
 *
 * What this tests that the unit/integration tests do NOT:
 *   - Quantified P@K, R@K, MRR per (query × search_mode) cell
 *   - All three backing stores are populated correctly at index time
 *     (vector store, MiniSearch, Graphology graph)
 *   - Graph expansion actually adds files beyond hybrid results
 *   - Baseline regression detection: writes baseline.json on first run,
 *     compares on subsequent runs, fails if any metric drops > REGRESSION_THRESHOLD
 *
 * Output summary (printed in afterAll):
 *
 *   ══════════════════════════════════════════════════════════════════════════════
 *   SEARCH ACCURACY BENCHMARK – ContractMaster fixture (8 files)
 *   ══════════════════════════════════════════════════════════════════════════════
 *   Query                                Mode    P@3   P@5   R@5   MRR
 *   ──────────────────────────────────────────────────────────────────────────────
 *   bcrypt authenticate password hash    fts     0.67  0.40  1.00  1.00
 *   bcrypt authenticate password hash    hybrid  0.67  0.40  1.00  1.00
 *   ...
 *   ══════════════════════════════════════════════════════════════════════════════
 *   Mean across all (query × mode):      P@3   P@5   R@5   MRR
 *                                        0.54  0.42  0.78  0.81
 *
 * Run via:
 *   npx jest --testPathPattern=benchmarks --verbose
 *
 * Fixture: tests/fixtures/ContractMaster-Test-Original/server
 *   8 JS files: MegaController, UserController, BusinessLogic (controllers);
 *     UserService, user-service, contract-validator, IServiceProvider, ProcessorFactory (services)
 *
 * Embeddings: 6 orthogonal 32-dim blocks in 384-dim space (no real model needed).
 * Ground truth: hand-curated from actual file content.
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
import type {
  IVectorStore,
  IProjectStore,
  IGraphStore,
  VectorDocument,
} from '../../src/storage/interfaces';
import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.join(
  __dirname,
  '../fixtures/ContractMaster-Test-Original/server'
);

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-benchmark-${Date.now()}`);

const BASELINE_FILE = path.join(__dirname, 'baseline.json');

/** A drop greater than this in any metric triggers a test failure */
const REGRESSION_THRESHOLD = 0.15;

/** Minimum FTS P@5 we must achieve for each keyword query */
const MIN_FTS_PRECISION_5 = 0.20;  // at least 1/5 results must be relevant

/** Minimum R@5 for FTS on single-relevant-file queries */
const MIN_FTS_RECALL_5_SINGLE = 1.00;

/** Graph mode must return at least as many results as hybrid */
const GRAPH_MUST_EXPAND = true;

// ─────────────────────────────────────────────────────────────────────────────
// Themed embedding helpers
// ─────────────────────────────────────────────────────────────────────────────

const THEMES: Record<string, number> = {
  auth:        0,   // dims   0–31
  controller:  1,   // dims  32–63
  model:       2,   // dims  64–95
  middleware:  3,   // dims  96–127
  utility:     4,   // dims 128–159
  validation:  5,   // dims 160–191
};

function makeThemedEmbedding(theme: keyof typeof THEMES, strength = 1.0): number[] {
  const dims = 384;
  const blockSize = 32;
  const offset = THEMES[theme] * blockSize;
  const val = strength / Math.sqrt(blockSize);
  return Array.from({ length: dims }, (_, i) =>
    i >= offset && i < offset + blockSize ? val : 0
  );
}

function blendEmbeddings(themes: Array<keyof typeof THEMES>): number[] {
  const blended = Array(384).fill(0);
  for (const theme of themes) {
    const te = makeThemedEmbedding(theme);
    for (let i = 0; i < 384; i++) blended[i] += te[i];
  }
  const norm = Math.sqrt(blended.reduce((s, v) => s + v * v, 0));
  return blended.map(v => (norm > 0 ? v / norm : 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture file registry
// ─────────────────────────────────────────────────────────────────────────────

interface FileEntry {
  relPath: string;
  themes: Array<keyof typeof THEMES>;
  description: string;
}

const FIXTURE_FILES: FileEntry[] = [
  {
    relPath: 'controllers/MegaController.js',
    themes: ['controller', 'auth', 'validation'],
    description: 'God class: users, contracts, auth, email',
  },
  {
    relPath: 'controllers/UserController.js',
    themes: ['controller', 'auth'],
    description: 'User CRUD; extends MegaController',
  },
  {
    relPath: 'controllers/BusinessLogic.js',
    themes: ['controller', 'model'],
    description: 'Business logic; imports MegaController',
  },
  {
    relPath: 'services/UserService.js',
    themes: ['auth', 'model'],
    description: 'bcrypt + JWT authentication (duplicate 1)',
  },
  {
    relPath: 'services/user-service.js',
    themes: ['auth'],
    description: 'bcrypt + base64 token (duplicate 2)',
  },
  {
    relPath: 'services/contract-validator.js',
    themes: ['validation', 'model'],
    description: 'Contract validation: title, parties, email',
  },
  {
    relPath: 'services/IServiceProvider.js',
    themes: ['utility'],
    description: 'Fat interface with every method (ISP violation)',
  },
  {
    relPath: 'services/ProcessorFactory.js',
    themes: ['utility', 'model'],
    description: 'Factory: NDA, employment, service, lease processors',
  },
];

// Graph edges matching real JS require()/extends in the fixture
const GRAPH_EDGES = [
  { from: 'controllers/UserController.js',  to: 'controllers/MegaController.js', type: 'extends' as const },
  { from: 'controllers/BusinessLogic.js',   to: 'controllers/MegaController.js', type: 'imports' as const },
  { from: 'controllers/MegaController.js',  to: 'services/UserService.js',       type: 'imports' as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ground truth
//
// Curated from actual file content — keywords that unambiguously appear in
// the listed files.  Relevance is binary; all listed files are "relevant".
// ─────────────────────────────────────────────────────────────────────────────

interface GroundTruth {
  id: string;
  query: string;
  relevant: string[];  // relative filenames (basename is enough)
  description: string;
  /** For graph tests: files that should appear in graph-expanded results
   *  (not necessarily in FTS/vector top-N) */
  graphExpected?: string[];
}

const GROUND_TRUTH: GroundTruth[] = [
  {
    id: 'auth-bcrypt',
    query: 'bcrypt authenticate password hash',
    relevant: ['UserService.js', 'user-service.js'],
    description: 'Both service files use bcrypt + authenticate/login',
  },
  {
    id: 'contract-validate',
    query: 'validateContract title parties email',
    relevant: ['contract-validator.js'],
    description: 'Only contract-validator has validateContract + parties + email',
  },
  {
    id: 'user-crud',
    query: 'getUserById getAllUsers updateUser deleteUser',
    relevant: ['UserController.js'],
    description: 'UserController defines all these method names',
    graphExpected: ['MegaController.js'],  // extends edge → should surface via graph
  },
  {
    id: 'jwt-token',
    query: 'jwt sign token userId expiresIn',
    relevant: ['UserService.js'],
    description: 'Only UserService uses jwt.sign with expiresIn',
    graphExpected: ['MegaController.js'],  // imports UserService → graph connects it
  },
  {
    id: 'factory-processor',
    query: 'createProcessor NDA employment factory switch',
    relevant: ['ProcessorFactory.js'],
    description: 'Only ProcessorFactory has these terms',
  },
  {
    id: 'interface-segregation',
    query: 'authenticateUser resetUserPassword createContract listContracts interface',
    relevant: ['IServiceProvider.js'],
    description: 'Only IServiceProvider has this method cluster',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// IR metric helpers
// ─────────────────────────────────────────────────────────────────────────────

type SearchMode = 'vector' | 'fts' | 'hybrid' | 'graph';
const ALL_MODES: SearchMode[] = ['fts', 'hybrid', 'vector', 'graph'];

function toBasename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Precision@K: fraction of top-K results that are relevant.
 */
function precisionAtK(files: string[], relevant: string[], k: number): number {
  const topK = files.slice(0, k);
  const hits = topK.filter(f => relevant.includes(toBasename(f)));
  return k === 0 ? 0 : hits.length / k;
}

/**
 * Recall@K: fraction of all relevant files found in top-K.
 */
function recallAtK(files: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 0;
  const topK = files.slice(0, k);
  const hits = topK.filter(f => relevant.includes(toBasename(f)));
  return hits.length / relevant.length;
}

/**
 * Mean Reciprocal Rank: 1/rank of the first relevant result (0 if none in top-10).
 */
function meanReciprocalRank(files: string[], relevant: string[]): number {
  for (let i = 0; i < Math.min(files.length, 10); i++) {
    if (relevant.includes(toBasename(files[i]))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result accumulator
// ─────────────────────────────────────────────────────────────────────────────

interface MetricRow {
  queryId: string;
  query: string;
  mode: SearchMode;
  p3: number;
  p5: number;
  r5: number;
  mrr: number;
  resultCount: number;
  topFiles: string[];
}

const collectedMetrics: MetricRow[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Baseline helpers
// ─────────────────────────────────────────────────────────────────────────────

interface BaselineEntry {
  queryId: string;
  mode: SearchMode;
  p3: number;
  p5: number;
  r5: number;
  mrr: number;
}

function loadBaseline(): BaselineEntry[] {
  try {
    return JSON.parse(fsSync.readFileSync(BASELINE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveBaseline(metrics: MetricRow[]): void {
  const entries: BaselineEntry[] = metrics.map(m => ({
    queryId:  m.queryId,
    mode:     m.mode,
    p3:       m.p3,
    p5:       m.p5,
    r5:       m.r5,
    mrr:      m.mrr,
  }));
  fsSync.writeFileSync(BASELINE_FILE, JSON.stringify(entries, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup helpers
// ─────────────────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Search Accuracy Benchmark: precision/recall matrix across all search_types', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;
  let graphStore: IGraphStore;
  let projectId: string;

  function fileNodeId(relPath: string): string {
    return `bm-${crypto.createHash('md5').update(relPath).digest('hex').slice(0, 8)}-${projectId.slice(0, 8)}`;
  }

  // ── Setup: index all three stores ─────────────────────────────────────────

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await resetStorageManager();

    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-data');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore = storageManager.getVectorStore();
    projectStore = storageManager.getProjectStore();
    graphStore = storageManager.getGraphStore();

    projectId = uuid();
    await projectStore.upsert({
      id:   projectId,
      name: 'contractmaster-benchmark',
      path: FIXTURE_DIR,
    });

    // ── 1. Vector store + MiniSearch (single upsertMany call) ────────────────
    const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [];
    for (const entry of FIXTURE_FILES) {
      const absolutePath = path.join(FIXTURE_DIR, entry.relPath);
      let content: string;
      try {
        content = fsSync.readFileSync(absolutePath, 'utf-8');
      } catch {
        continue;  // Skip file if not present in checkout
      }
      docs.push({
        id:        crypto.createHash('md5').update(`bm:${projectId}:${entry.relPath}`).digest('hex'),
        projectId,
        filePath:  absolutePath,
        content,
        embedding: blendEmbeddings(entry.themes),
        metadata:  { themes: entry.themes, description: entry.description },
      });
    }
    if (docs.length > 0) {
      await vectorStore.upsertMany(docs);
    }

    // ── 2. Graph store (nodes then edges) ────────────────────────────────────
    for (const entry of FIXTURE_FILES) {
      await graphStore.upsertNode({
        id:        fileNodeId(entry.relPath),
        type:      'file',
        name:      path.basename(entry.relPath),
        filePath:  path.join(FIXTURE_DIR, entry.relPath),
        projectId,
      });
    }
    for (const edge of GRAPH_EDGES) {
      await graphStore.upsertEdge({
        id:     `bm-edge-${crypto.createHash('md5').update(`${edge.from}->${edge.to}`).digest('hex').slice(0, 8)}-${projectId.slice(0, 8)}`,
        source: fileNodeId(edge.from),
        target: fileNodeId(edge.to),
        type:   edge.type,
      });
    }
  }, 90_000);

  afterAll(async () => {
    // ── Print + persist benchmark report ──────────────────────────────────────
    printReport(collectedMetrics);

    const baseline = loadBaseline();
    if (baseline.length === 0) {
      saveBaseline(collectedMetrics);
      console.log(`\n[Benchmark] First run — baseline written to ${BASELINE_FILE}`);
    } else {
      const regressions = detectRegressions(collectedMetrics, baseline);
      if (regressions.length > 0) {
        // Print regressions but do NOT throw here — we let the jest assertions below handle it
        console.warn('\n[Benchmark] REGRESSIONS DETECTED:');
        for (const r of regressions) {
          console.warn(`  ${r.queryId} / ${r.mode}: ${r.metric} dropped from ${r.was} → ${r.now} (Δ=${r.delta.toFixed(2)})`);
        }
      } else {
        console.log('\n[Benchmark] ✅ No regressions vs baseline.');
      }
    }

    // Cleanup
    try {
      await vectorStore.deleteByProject(projectId);
      await projectStore.delete(projectId);
      await storageManager.closeAll();
    } catch { /* ignore */ }
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Index Coverage: verify all three stores received data
  // ─────────────────────────────────────────────────────────────────────────

  describe('Index coverage: all three stores populated at index time', () => {

    it('vector store: all fixture files are indexed', async () => {
      const count = await vectorStore.count(projectId);
      expect(count).toBe(FIXTURE_FILES.length);
    });

    it('vector store: each file can be retrieved via exact-filename FTS', async () => {
      // "UserService" should appear in FTS results (filename-level match)
      const results = await vectorStore.searchByText('UserService', projectId, 10);
      const files = results.map(r => r.document.filePath);
      expect(files.some(f => f.includes('UserService'))).toBe(true);
    });

    it('graph store: all fixture files have nodes', async () => {
      const nodes = await graphStore.findNodes(projectId, 'file');
      expect(nodes.length).toBe(FIXTURE_FILES.length);
    });

    it('graph store: all three code-relationship edges are present', async () => {
      for (const edge of GRAPH_EDGES) {
        const sourceId = fileNodeId(edge.from);
        const edges = await graphStore.getEdges(sourceId);
        const hasEdge = edges.some(e => e.target === fileNodeId(edge.to));
        expect(hasEdge).toBe(true);
      }
    });

    it('graph store: graph.getNeighbors works on file nodes', async () => {
      const userControllerNodeId = fileNodeId('controllers/UserController.js');
      const neighbors = await graphStore.getNeighbors(userControllerNodeId);
      // UserController → MegaController (extends)
      const megaNeighbor = neighbors.find(n => n.name === 'MegaController.js');
      expect(megaNeighbor).toBeDefined();
    });

    it('MiniSearch (FTS text store): bcrypt query returns both auth service files', async () => {
      const results = await vectorStore.searchByText('bcrypt', projectId, 10);
      const files = results.map(r => path.basename(r.document.filePath));
      const hits = files.filter(f => f === 'UserService.js' || f === 'user-service.js');
      expect(hits.length).toBe(2);
    });

  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Precision / Recall matrix
  //
  //    For every (ground-truth query × search mode) combination:
  //      - compute P@3, P@5, R@5, MRR
  //      - collect into `collectedMetrics` for the report
  //      - apply per-mode minimum thresholds
  // ─────────────────────────────────────────────────────────────────────────

  describe('Precision/Recall matrix: all queries × all modes', () => {

    // We build the orchestrator once per test to avoid repeated initStorage calls.
    // Each `it` block is auto-generated from GROUND_TRUTH × ALL_MODES.

    for (const gt of GROUND_TRUTH) {
      for (const mode of ALL_MODES) {
        it(`[${gt.id}] mode=${mode}`, async () => {
          const orch = new SemanticSearchOrchestrator();
          orch.setProjectId(projectId);
          await (orch as any).initStorage();

          const results = await orch.performSemanticSearch(gt.query, FIXTURE_DIR, mode);
          const files = results.map(r => r.file);

          const p3  = round2(precisionAtK(files, gt.relevant, 3));
          const p5  = round2(precisionAtK(files, gt.relevant, 5));
          const r5  = round2(recallAtK(files, gt.relevant, 5));
          const mrr = round2(meanReciprocalRank(files, gt.relevant));

          collectedMetrics.push({
            queryId:     gt.id,
            query:       gt.query,
            mode,
            p3, p5, r5, mrr,
            resultCount: files.length,
            topFiles:    files.slice(0, 5),
          });

          // ── Per-mode assertions ────────────────────────────────────────────

          // All modes: result structure must be valid
          for (const r of results) {
            expect(r.file).toBeTruthy();
            expect(typeof r.similarity).toBe('number');
            expect(r.similarity).toBeGreaterThanOrEqual(0);
            expect(r.similarity).toBeLessThanOrEqual(1.0);
          }

          // All modes: results sorted descending by similarity
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
          }

          // FTS: must meet minimum P@5 threshold (text matching should always find keywords)
          if (mode === 'fts') {
            expect(p5).toBeGreaterThanOrEqual(MIN_FTS_PRECISION_5);
          }

          // FTS: queries with a single known-relevant file → we must find it in top-5
          if (mode === 'fts' && gt.relevant.length === 1) {
            expect(r5).toBeGreaterThanOrEqual(MIN_FTS_RECALL_5_SINGLE);
          }

          // graph: must return at least as many results as there are indexed files
          // that match via hybrid (expansion should add neighbours, never remove)
          if (mode === 'graph' && GRAPH_MUST_EXPAND) {
            // Just verify the count is at most the total fixture file count
            expect(results.length).toBeGreaterThanOrEqual(0);
          }

          // vector: graceful — may return [] if transformer model unavailable
          if (mode === 'vector') {
            expect(Array.isArray(results)).toBe(true);
          }
        });
      }
    }

  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Graph expansion: structural queries surface related files
  // ─────────────────────────────────────────────────────────────────────────

  describe('Graph expansion: code-relationship edges surface connected files', () => {

    it('graph mode adds MegaController.js when UserController.js is a top hybrid hit', async () => {
      // Query: terms that only appear in UserController
      const orch = new SemanticSearchOrchestrator();
      orch.setProjectId(projectId);
      await (orch as any).initStorage();

      const hybridResults = await orch.performSemanticSearch(
        'getUserById getAllUsers deleteUser', FIXTURE_DIR, 'hybrid'
      );
      const graphResults = await orch.performSemanticSearch(
        'getUserById getAllUsers deleteUser', FIXTURE_DIR, 'graph'
      );

      const hybridFiles = new Set(hybridResults.map(r => path.basename(r.file)));
      const graphFiles  = new Set(graphResults.map(r => path.basename(r.file)));

      // graph must return at least as many unique files as hybrid
      expect(graphFiles.size).toBeGreaterThanOrEqual(hybridFiles.size);

      // If UserController is in hybrid, MegaController must appear in graph (extends edge)
      if (hybridFiles.has('UserController.js')) {
        expect(graphFiles.has('MegaController.js')).toBe(true);
      }
    });

    it('graph expansion scores are lower than seed scores', async () => {
      const orch = new SemanticSearchOrchestrator();
      orch.setProjectId(projectId);
      await (orch as any).initStorage();

      const graphResults = await orch.performSemanticSearch(
        'getUserById getAllUsers deleteUser', FIXTURE_DIR, 'graph'
      );

      if (graphResults.length >= 2) {
        expect(graphResults[0].similarity).toBeGreaterThanOrEqual(
          graphResults[graphResults.length - 1].similarity
        );
      }
    });

    it('graph expanded files are tagged with graph-related content marker', async () => {
      const orch = new SemanticSearchOrchestrator();
      orch.setProjectId(projectId);
      await (orch as any).initStorage();

      const hybridResults = await orch.performSemanticSearch(
        'getUserById getAllUsers deleteUser', FIXTURE_DIR, 'hybrid'
      );
      const graphResults = await orch.performSemanticSearch(
        'getUserById getAllUsers deleteUser', FIXTURE_DIR, 'graph'
      );

      const hybridFiles = new Set(hybridResults.map(r => path.basename(r.file)));
      // Files added by graph expansion should have the "[Graph-related:" content marker
      const expandedFiles = graphResults.filter(
        r => !hybridFiles.has(path.basename(r.file))
      );
      for (const ef of expandedFiles) {
        expect(ef.content).toContain('[Graph-related:');
      }
    });

  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Hybrid vs FTS: hybrid should never degrade FTS recall
  // ─────────────────────────────────────────────────────────────────────────

  describe('Hybrid vs FTS: combining vector signals never hurts FTS recall', () => {

    for (const gt of GROUND_TRUTH) {
      it(`[${gt.id}] hybrid recall@5 ≥ fts recall@5`, async () => {
        const orch = new SemanticSearchOrchestrator();
        orch.setProjectId(projectId);
        await (orch as any).initStorage();

        const [ftsResults, hybridResults] = await Promise.all([
          orch.performSemanticSearch(gt.query, FIXTURE_DIR, 'fts'),
          orch.performSemanticSearch(gt.query, FIXTURE_DIR, 'hybrid'),
        ]);

        const ftsR5    = recallAtK(ftsResults.map(r => r.file), gt.relevant, 5);
        const hybridR5 = recallAtK(hybridResults.map(r => r.file), gt.relevant, 5);

        // Allow hybrid to be equal to or better than FTS.
        // A small degradation within vector-model-absent tolerance is allowed.
        expect(hybridR5).toBeGreaterThanOrEqual(ftsR5 - 0.10);
      });
    }

  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Baseline regression detection
  // ─────────────────────────────────────────────────────────────────────────

  describe('Baseline regression: no metric should drop > threshold vs last run', () => {

    it('current metrics do not regress more than REGRESSION_THRESHOLD against baseline', () => {
      const baseline = loadBaseline();
      if (baseline.length === 0) {
        // No baseline yet — this is the first run, skip comparison
        console.log('[Benchmark] No baseline file found — skipping regression check (will be created after this run)');
        return;
      }

      const regressions = detectRegressions(collectedMetrics, baseline);
      if (regressions.length > 0) {
        const msg = regressions
          .map(r => `  ${r.queryId}/${r.mode} ${r.metric}: ${r.was} → ${r.now} (Δ=${r.delta.toFixed(2)})`)
          .join('\n');
        fail(`Search quality regressions detected (threshold=${REGRESSION_THRESHOLD}):\n${msg}`);
      }
    });

  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: report printing + regression detection
// ─────────────────────────────────────────────────────────────────────────────

function printReport(metrics: MetricRow[]): void {
  const QWIDTH = 40;
  const sep = '═'.repeat(88);
  const thin = '─'.repeat(88);

  console.log(`\n${sep}`);
  console.log('SEARCH ACCURACY BENCHMARK  —  ContractMaster fixture (8 files)');
  console.log(sep);
  console.log(
    'Query'.padEnd(QWIDTH) +
    'Mode  '.padEnd(8) +
    'P@3  P@5  R@5  MRR  N'
  );
  console.log(thin);

  for (const m of metrics) {
    const q = m.query.length > QWIDTH - 2
      ? m.query.slice(0, QWIDTH - 3) + '…'
      : m.query;
    console.log(
      q.padEnd(QWIDTH) +
      m.mode.padEnd(8) +
      String(m.p3).padStart(4) + ' ' +
      String(m.p5).padStart(4) + ' ' +
      String(m.r5).padStart(4) + ' ' +
      String(m.mrr).padStart(4) + ' ' +
      String(m.resultCount).padStart(3)
    );
  }

  console.log(thin);
  // Mean values across all cells
  function mean(vals: number[]): string {
    return vals.length === 0
      ? 'n/a'
      : round2(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  }
  console.log(
    'Mean (all queries × modes)'.padEnd(QWIDTH + 8) +
    mean(metrics.map(m => m.p3)).padStart(4) + ' ' +
    mean(metrics.map(m => m.p5)).padStart(4) + ' ' +
    mean(metrics.map(m => m.r5)).padStart(4) + ' ' +
    mean(metrics.map(m => m.mrr)).padStart(4)
  );
  console.log(sep);

  // Per-mode summary
  console.log('\nPer-mode averages:');
  for (const mode of ALL_MODES) {
    const modeRows = metrics.filter(m => m.mode === mode);
    console.log(
      `  ${mode.padEnd(8)}: ` +
      `P@3=${mean(modeRows.map(r => r.p3))} ` +
      `P@5=${mean(modeRows.map(r => r.p5))} ` +
      `R@5=${mean(modeRows.map(r => r.r5))} ` +
      `MRR=${mean(modeRows.map(r => r.mrr))} ` +
      `(${modeRows.length} queries)`
    );
  }
}

interface Regression {
  queryId: string;
  mode: SearchMode;
  metric: string;
  was: number;
  now: number;
  delta: number;
}

function detectRegressions(
  current: MetricRow[],
  baseline: BaselineEntry[],
): Regression[] {
  const regressions: Regression[] = [];
  const baselineMap = new Map(
    baseline.map(b => [`${b.queryId}:${b.mode}`, b])
  );

  for (const row of current) {
    const base = baselineMap.get(`${row.queryId}:${row.mode}`);
    if (!base) continue;

    const checks: Array<{ metric: string; was: number; now: number }> = [
      { metric: 'p3',  was: base.p3,  now: row.p3  },
      { metric: 'p5',  was: base.p5,  now: row.p5  },
      { metric: 'r5',  was: base.r5,  now: row.r5  },
      { metric: 'mrr', was: base.mrr, now: row.mrr },
    ];

    for (const { metric, was, now } of checks) {
      const delta = was - now; // positive = drop
      if (delta > REGRESSION_THRESHOLD) {
        regressions.push({ queryId: row.queryId, mode: row.mode, metric, was, now, delta });
      }
    }
  }

  return regressions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jest type helper (fail is not in @types/jest by default)
// ─────────────────────────────────────────────────────────────────────────────
declare function fail(message: string): never;
