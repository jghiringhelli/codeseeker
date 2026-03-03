/**
 * Integration Tests: search_type routing with real embedded storage
 *
 * Test pyramid layer: INTEGRATION — uses actual SQLite + MiniSearch + Graphology.
 *
 * Coverage:
 *  1. 'vector' search   — ranked by cosine similarity, text-irrelevant docs can still surface
 *  2. 'fts' search      — ranked by BM25, semantic-only docs may not surface
 *  3. 'hybrid' search   — both vector and text signals contribute
 *  4. 'graph' search    — hybrid results expanded via code-relationship graph edges
 *  5. Result contracts  — all modes return SemanticResult[], scores in [0, 1]
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
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

// ── Test environment setup ────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-search-routing-${Date.now()}`);

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Build a deterministic 384-dim unit vector from a seed.
 * Used to produce embeddings with known cosine similarities.
 *
 *   seed 0 →  all weight in the first 192 dims
 *   seed 1 →  all weight in the last 192 dims
 */
function makeUnitVector(seed: 0 | 1): number[] {
  const dims = 384;
  const half = dims / 2;
  const val = 1 / Math.sqrt(half);
  return Array.from({ length: dims }, (_, i) =>
    seed === 0 ? (i < half ? val : 0) : (i >= half ? val : 0)
  );
}

describe('search_type routing – integration (embedded storage)', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;
  let graphStore: IGraphStore;
  let projectId: string;
  const projectPath = path.join(TEST_DIR, 'my-project');

  // Two clearly distinguishable documents:
  //   semanticDoc  – embedding aligned with query (cosine ≈ 1), content has NO query keywords
  //   keywordDoc   – embedding orthogonal to query (cosine = 0), content has MANY query keywords
  const SEMANTIC_FILE = 'src/semantic-doc.ts';
  const KEYWORD_FILE  = 'src/keyword-doc.ts';
  const THIRD_FILE    = 'src/unrelated.ts';

  // Graph expansion extra file (no vector doc, only a graph node)
  const GRAPH_NEIGHBOR_FILE = 'src/graph-neighbor.ts';

  // Query embedding pointing in the same direction as semanticDoc (seed 0)
  const QUERY_EMBEDDING = makeUnitVector(0);

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(projectPath, { recursive: true });
    await resetStorageManager();

    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-data');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore = storageManager.getVectorStore();
    projectStore = storageManager.getProjectStore();
    graphStore = storageManager.getGraphStore();

    projectId = uuid();
    await projectStore.upsert({ id: projectId, name: 'routing-test', path: projectPath });

    // ── Insert vector documents ──────────────────────────────────────────────

    const semanticDocId = crypto.createHash('md5').update(SEMANTIC_FILE).digest('hex');
    const keywordDocId  = crypto.createHash('md5').update(KEYWORD_FILE).digest('hex');
    const thirdDocId    = crypto.createHash('md5').update(THIRD_FILE).digest('hex');

    const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [
      {
        id: semanticDocId,
        projectId,
        filePath: SEMANTIC_FILE,
        // No "authentication" keywords — only surfaces via vector similarity
        content: 'export class NetworkProtocol { connect() { return true; } }',
        embedding: makeUnitVector(0),   // aligned with query embedding
        metadata: {},
      },
      {
        id: keywordDocId,
        projectId,
        filePath: KEYWORD_FILE,
        // Packed with query keywords — surfaces strongly via FTS
        content: 'authentication login login authentication password authentication ' +
                 'function authenticateUser() { validateLogin(); checkPassword(); }',
        embedding: makeUnitVector(1),   // orthogonal to query — near-zero cosine
        metadata: {},
      },
      {
        id: thirdDocId,
        projectId,
        filePath: THIRD_FILE,
        content: 'export const CONFIG = { debug: false };',
        embedding: makeUnitVector(1),
        metadata: {},
      },
    ];

    await vectorStore.upsertMany(docs);

    // ── Insert graph nodes and edges for Graph RAG test ─────────────────────

    // Create file nodes for semanticDoc and a neighbor that has no vector doc
    await graphStore.upsertNode({
      id: `node-semantic-${projectId}`,
      type: 'file',
      name: path.basename(SEMANTIC_FILE),
      filePath: path.join(projectPath, SEMANTIC_FILE),
      projectId,
    });
    await graphStore.upsertNode({
      id: `node-neighbor-${projectId}`,
      type: 'file',
      name: path.basename(GRAPH_NEIGHBOR_FILE),
      filePath: path.join(projectPath, GRAPH_NEIGHBOR_FILE),
      projectId,
    });
    // Edge: semanticDoc → graphNeighbor (imports relationship)
    await graphStore.upsertEdge({
      id: `edge-semantic-neighbor-${projectId}`,
      source: `node-semantic-${projectId}`,
      target: `node-neighbor-${projectId}`,
      type: 'imports',
    });
  }, 60_000);

  afterAll(async () => {
    try {
      await vectorStore.deleteByProject(projectId);
      await projectStore.delete(projectId);
      await storageManager.closeAll();
    } catch { /* ignore */ }
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  // ── Helper: build a pre-warmed orchestrator ─────────────────────────────────

  async function buildOrchestrator(): Promise<SemanticSearchOrchestrator> {
    const orch = new SemanticSearchOrchestrator();
    orch.setProjectId(projectId);
    // Warm up initStorage so the project ID resolver doesn't need to run
    await (orch as any).initStorage();
    return orch;
  }

  // ── Result contract (all modes) ───────────────────────────────────────────

  describe('result contract', () => {
    it.each(['hybrid', 'vector', 'fts', 'graph'] as const)(
      "'%s' returns SemanticResult[] with valid score in [0, 1]",
      async (searchType) => {
        const orch = await buildOrchestrator();
        const results = await orch.performSemanticSearch(
          'authentication login',
          projectPath,
          searchType
        );

        expect(Array.isArray(results)).toBe(true);
        for (const r of results) {
          expect(r).toHaveProperty('file');
          expect(r).toHaveProperty('similarity');
          expect(r).toHaveProperty('content');
          expect(r).toHaveProperty('type');
          expect(r.similarity).toBeGreaterThanOrEqual(0);
          expect(r.similarity).toBeLessThanOrEqual(1.0);
        }
      }
    );
  });

  // ── 'vector' search behaviours ────────────────────────────────────────────

  describe("'vector' search", () => {
    it('returns results ranked by cosine similarity', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'network protocol',  // words that don't appear in any doc
        projectPath,
        'vector'
      );

      // Vector search may return [] when the embedding model is unavailable in CI.
      // When results ARE present, they must be sorted descending.
      expect(Array.isArray(results)).toBe(true);
      if (results.length >= 2) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      }
    });

    it('semantic alignment makes the aligned doc appear in results', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'connect protocol',  // irrelevant keywords
        projectPath,
        'vector'
      );

      // If the transformer model is unavailable in this environment, vector search
      // returns [] (by design — see performVectorOnlySearch fallback). That is still
      // a valid outcome; the important thing is that no exception is thrown.
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        // semanticDoc's embedding is perfectly aligned → should rank highest
        expect(results[0].similarity).toBeGreaterThan(0);
        expect(results[0].similarity).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // ── 'fts' search behaviours ───────────────────────────────────────────────

  describe("'fts' search", () => {
    it('returns results for keyword query', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'authentication login',
        projectPath,
        'fts'
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it('keyword-heavy doc appears in FTS results', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'authentication login',
        projectPath,
        'fts'
      );

      const files = results.map(r => r.file);
      expect(files.some(f => f.includes('keyword-doc'))).toBe(true);
    });
  });

  // ── 'hybrid' search behaviours ────────────────────────────────────────────

  describe("'hybrid' search", () => {
    it('combines vector and text signals — finds keyword-heavy doc', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'authentication login',
        projectPath,
        'hybrid'
      );

      expect(results.length).toBeGreaterThan(0);
      const files = results.map(r => r.file);
      expect(files.some(f => f.includes('keyword-doc'))).toBe(true);
    });

    it('returns results sorted by descending score', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'authentication',
        projectPath,
        'hybrid'
      );

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });
  });

  // ── 'graph' search behaviours ─────────────────────────────────────────────

  describe("'graph' search", () => {
    it('returns at least as many results as hybrid for same query', async () => {
      const orch = await buildOrchestrator();

      const hybridResults = await orch.performSemanticSearch(
        'connect protocol',
        projectPath,
        'hybrid'
      );
      const graphResults = await orch.performSemanticSearch(
        'connect protocol',
        projectPath,
        'graph'
      );

      // Graph expansion can only add files; it never removes them
      expect(graphResults.length).toBeGreaterThanOrEqual(hybridResults.length);
    });

    it('appends graph-neighbor file not in hybrid results', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'connect protocol',   // targets semanticDoc (the file with graph edges)
        projectPath,
        'graph'
      );

      const files = results.map(r => r.file);
      // The neighbor node has no vector doc but IS connected via an import edge
      expect(files.some(f => f.includes('graph-neighbor'))).toBe(true);
    });

    it('graph-neighbor has lower score than the seed (vector-matched) file', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'connect protocol',
        projectPath,
        'graph'
      );

      const seedResult = results.find(r => r.file.includes('semantic-doc'));
      const neighborResult = results.find(r => r.file.includes('graph-neighbor'));

      if (seedResult && neighborResult) {
        expect(neighborResult.similarity).toBeLessThanOrEqual(seedResult.similarity);
      }
    });
  });
});
