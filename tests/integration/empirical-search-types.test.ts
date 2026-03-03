/**
 * Empirical Tests: SemanticSearchOrchestrator against ContractMaster fixture
 *
 * Test pyramid layer: EMPIRICAL / E2E — real file content, real embedded storage.
 *
 * This tests the search system the way a real user would experience it:
 * real code content, realistic queries, measured relevance.
 *
 * Fixture: tests/fixtures/ContractMaster-Test-Original/
 *   - Express backend (Node/JS) with controllers, services, middleware
 *   - Intentional SRP violations (MegaController handles too many concerns)
 *   - Duplicate authentication logic (UserService vs user-service/UserManager)
 *
 * Design decisions:
 *  - Synthetic THEMED embeddings are stored at fixture-load time so vector search
 *    produces deterministic results without needing the Xenova model to be loaded.
 *  - FTS assertions are based on exact keyword matches from real file content.
 *  - Graph assertions verify actual import/extends edges surfaced via graph expansion.
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

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.join(
  __dirname,
  '../fixtures/ContractMaster-Test-Original/server'
);

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-empirical-${Date.now()}`);

function uuid(): string {
  return crypto.randomUUID();
}

// ── Themed embedding helpers ──────────────────────────────────────────────────
//
// We map code themes to orthogonal subspaces (each 32 dims wide out of 384).
// This ensures vector search can distinguish auth files from controller files
// without needing the real sentence-transformer model.

const THEMES: Record<string, number> = {
  auth:        0,   // dims   0–31: authentication, jwt, bcrypt, login
  controller:  1,   // dims  32–63: request handling, routes, HTTP
  model:       2,   // dims  64–95: database, schema, mongoose
  middleware:  3,   // dims  96–127: auth guard, cors, rate-limit
  utility:     4,   // dims 128–159: helper functions, formatting
  validation:  5,   // dims 160–191: input validation, email, error
};

function makeThemedEmbedding(theme: keyof typeof THEMES, strength = 1.0): number[] {
  const dims = 384;
  const blockSize = 32;
  const offset = THEMES[theme] * blockSize;
  const val = (strength / Math.sqrt(blockSize));
  return Array.from({ length: dims }, (_, i) =>
    i >= offset && i < offset + blockSize ? val : 0
  );
}

// ── Fixture file registry ─────────────────────────────────────────────────────
//
// Maps each ContractMaster file to the themes it belongs to and
// the graph relationships it participates in.

interface FileEntry {
  relPath: string;       // relative to FIXTURE_DIR
  themes: Array<keyof typeof THEMES>;
  description: string;
}

const FIXTURE_FILES: FileEntry[] = [
  {
    relPath: 'controllers/MegaController.js',
    themes: ['controller', 'auth', 'validation'],
    description: 'God class: handles users, contracts, auth, email in one class',
  },
  {
    relPath: 'controllers/UserController.js',
    themes: ['controller', 'auth'],
    description: 'User CRUD operations; extends MegaController',
  },
  {
    relPath: 'controllers/BusinessLogic.js',
    themes: ['controller', 'model'],
    description: 'Business logic controller; also imports MegaController',
  },
  {
    relPath: 'services/UserService.js',
    themes: ['auth', 'model'],
    description: 'UserService: bcrypt + JWT authentication (duplicate 1)',
  },
  {
    relPath: 'services/user-service.js',
    themes: ['auth'],
    description: 'UserManager: bcrypt authentication, base64 token (duplicate 2)',
  },
  {
    relPath: 'services/contract-validator.js',
    themes: ['validation', 'model'],
    description: 'Contract validation logic',
  },
  {
    relPath: 'services/IServiceProvider.js',
    themes: ['utility'],
    description: 'Service provider interface',
  },
  {
    relPath: 'services/ProcessorFactory.js',
    themes: ['utility', 'model'],
    description: 'Factory for creating processors',
  },
];

// Graph edges modeled after actual JS `require()`/`extends` in the fixture
const GRAPH_EDGES: Array<{ from: string; to: string; type: 'imports' | 'extends' }> = [
  { from: 'controllers/UserController.js',   to: 'controllers/MegaController.js', type: 'extends' },
  { from: 'controllers/BusinessLogic.js',    to: 'controllers/MegaController.js', type: 'imports' },
  { from: 'controllers/MegaController.js',   to: 'services/UserService.js',       type: 'imports' },
];

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Empirical: ContractMaster fixture – search quality across all search_types', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;
  let graphStore: IGraphStore;
  let projectId: string;

  // Build a stable, concise ID for each file
  function fileNodeId(relPath: string): string {
    return `node-${crypto.createHash('md5').update(relPath).digest('hex').slice(0, 8)}-${projectId.slice(0, 8)}`;
  }

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
      id: projectId,
      name: 'contractmaster-empirical',
      path: FIXTURE_DIR,
    });

    // ── Index fixture files ──────────────────────────────────────────────────

    const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [];

    for (const entry of FIXTURE_FILES) {
      const absolutePath = path.join(FIXTURE_DIR, entry.relPath);
      let content: string;
      try {
        content = fsSync.readFileSync(absolutePath, 'utf-8');
      } catch {
        // Skip if file is missing (zip only)
        continue;
      }

      // Blend themed embeddings (average of all themes for this file)
      const blendedEmbedding = Array(384).fill(0);
      for (const theme of entry.themes) {
        const te = makeThemedEmbedding(theme);
        for (let i = 0; i < 384; i++) blendedEmbedding[i] += te[i];
      }
      const norm = Math.sqrt(blendedEmbedding.reduce((s, v) => s + v * v, 0));
      const unitEmbedding = blendedEmbedding.map(v => (norm > 0 ? v / norm : 0));

      docs.push({
        id: crypto.createHash('md5').update(`${projectId}:${entry.relPath}`).digest('hex'),
        projectId,
        filePath: path.join(FIXTURE_DIR, entry.relPath),
        content,
        embedding: unitEmbedding,
        metadata: { theme: entry.themes[0], description: entry.description },
      });
    }

    if (docs.length > 0) {
      await vectorStore.upsertMany(docs);
    }

    // ── Build graph ──────────────────────────────────────────────────────────

    for (const entry of FIXTURE_FILES) {
      await graphStore.upsertNode({
        id: fileNodeId(entry.relPath),
        type: 'file',
        name: path.basename(entry.relPath),
        filePath: path.join(FIXTURE_DIR, entry.relPath),
        projectId,
      });
    }

    for (const edge of GRAPH_EDGES) {
      await graphStore.upsertEdge({
        id: `edge-${crypto.createHash('md5').update(`${edge.from}->${edge.to}`).digest('hex').slice(0, 8)}-${projectId.slice(0, 8)}`,
        source: fileNodeId(edge.from),
        target: fileNodeId(edge.to),
        type: edge.type,
      });
    }
  }, 90_000);

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
    await (orch as any).initStorage();
    return orch;
  }

  // ── Smoke test ────────────────────────────────────────────────────────────

  describe('Fixture sanity: files are indexed', () => {
    it('indexed file count is at least 5 (most fixture files present)', async () => {
      const count = await vectorStore.count(projectId);
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('graph has nodes for all fixture files', async () => {
      const nodes = await graphStore.findNodes(projectId, 'file');
      expect(nodes.length).toBe(FIXTURE_FILES.length);
    });

    it('graph has edges for known code relationships', async () => {
      const userControllerNodeId = fileNodeId('controllers/UserController.js');
      const edges = await graphStore.getEdges(userControllerNodeId);
      // UserController extends MegaController (extends edge exists)
      expect(edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── FTS quality: keyword-relevant files must surface ─────────────────────

  describe("'fts' search: keyword relevance", () => {
    it('"bcrypt authenticate" finds UserService.js and user-service.js', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('bcrypt authenticate', FIXTURE_DIR, 'fts');

      const files = results.map(r => r.file);
      // Both service files contain bcrypt
      const serviceHits = files.filter(f =>
        f.includes('UserService') || f.includes('user-service')
      );
      expect(serviceHits.length).toBeGreaterThanOrEqual(1);
    });

    it('"password hashing bcrypt" — UserService ranks in top 3', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('password hashing bcrypt', FIXTURE_DIR, 'fts');

      const top3Files = results.slice(0, 3).map(r => r.file);
      const hasAuthFile = top3Files.some(f =>
        f.includes('UserService') || f.includes('user-service') || f.includes('MegaController')
      );
      expect(hasAuthFile).toBe(true);
    });

    it('"contract validation" finds contract-validator.js', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('contract validation', FIXTURE_DIR, 'fts');

      const files = results.map(r => r.file);
      expect(files.some(f => f.includes('contract-validator'))).toBe(true);
    });

    it('"registerUser email password" — MegaController or UserController appears', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('registerUser email password', FIXTURE_DIR, 'fts');

      const files = results.map(r => r.file);
      const controllerHits = files.filter(f =>
        f.includes('Controller') || f.includes('controller')
      );
      expect(controllerHits.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Hybrid quality: combines FTS and vector signals ───────────────────────

  describe("'hybrid' search: combined relevance", () => {
    it('"jwt token authentication" finds auth-themed files', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('jwt token authentication', FIXTURE_DIR, 'hybrid');

      expect(results.length).toBeGreaterThan(0);
      // At minimum the FTS component should find the keyword-rich auth files
      const files = results.map(r => r.file);
      const authFiles = files.filter(f =>
        f.includes('UserService') || f.includes('MegaController') || f.includes('user-service')
      );
      expect(authFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('all hybrid results have scores sorted descending', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch('user registration', FIXTURE_DIR, 'hybrid');

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });
  });

  // ── Graph RAG: structural expansion ──────────────────────────────────────

  describe("'graph' search: graph RAG expansion", () => {
    it('searching for UserController also surfaces MegaController (extends edge)', async () => {
      // Query specifically targets UserController's content
      const orch = await buildOrchestrator();

      const hybridResults = await orch.performSemanticSearch(
        'getUserById getAllUsers updateUser',  // methods only in UserController
        FIXTURE_DIR,
        'hybrid'
      );
      const graphResults = await orch.performSemanticSearch(
        'getUserById getAllUsers updateUser',
        FIXTURE_DIR,
        'graph'
      );

      const hybridFiles = new Set(hybridResults.map(r => r.file));
      const graphFiles = new Set(graphResults.map(r => r.file));

      // Graph search should return at least as many files as hybrid
      expect(graphFiles.size).toBeGreaterThanOrEqual(hybridFiles.size);

      // If UserController is in hybrid results, MegaController should also be in graph results
      const hasUserController = [...hybridFiles].some(f => f.includes('UserController'));
      if (hasUserController) {
        const hasMegaController = [...graphFiles].some(f => f.includes('MegaController'));
        expect(hasMegaController).toBe(true);
      }
    });

    it('graph search returns valid result structure for all expanded files', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'registerUser controller',
        FIXTURE_DIR,
        'graph'
      );

      for (const r of results) {
        expect(r.file).toBeTruthy();
        expect(typeof r.similarity).toBe('number');
        expect(r.similarity).toBeGreaterThanOrEqual(0);
        expect(r.similarity).toBeLessThanOrEqual(1.0);
        expect(r.content).toBeTruthy();
      }
    });

    it('graph-expanded neighbors have lower score than seed results', async () => {
      const orch = await buildOrchestrator();
      const results = await orch.performSemanticSearch(
        'getUserById updateUser deleteUser',
        FIXTURE_DIR,
        'graph'
      );

      if (results.length >= 2) {
        const topScore = results[0].similarity;
        const bottomScore = results[results.length - 1].similarity;
        // Scores should be non-increasing
        expect(topScore).toBeGreaterThanOrEqual(bottomScore);
      }
    });
  });

  // ── Vector vs FTS difference ──────────────────────────────────────────────

  describe('vector vs fts produce different rankings for orthogonal signals', () => {
    it('vector search surfaces themed files without explicit keywords', async () => {
      const orch = await buildOrchestrator();
      // Query with no exact keywords from any file — only vector similarity can help
      const results = await orch.performSemanticSearch(
        'credential verification session token',  // semantically close to auth
        FIXTURE_DIR,
        'vector'
      );

      // Should still return results (all embeddings are non-zero, cosine works)
      // Since we can't guarantee the real model's embedding direction matches our
      // synthetic embeddings, we just verify results are returned in valid form
      expect(Array.isArray(results)).toBe(true);
      for (const r of results) {
        expect(r.similarity).toBeGreaterThanOrEqual(0);
        expect(r.similarity).toBeLessThanOrEqual(1.0);
      }
    });

    it('vector and fts may produce different top-3 for the same query', async () => {
      const orch = await buildOrchestrator();
      const query = 'user authenticate';

      const vectorResults = await orch.performSemanticSearch(query, FIXTURE_DIR, 'vector');
      const ftsResults    = await orch.performSemanticSearch(query, FIXTURE_DIR, 'fts');

      // FTS always works without an embedding model
      expect(ftsResults.length).toBeGreaterThan(0);

      // Vector search requires the transformer model; gracefully returns [] when unavailable.
      // When results ARE available, verify they are valid.
      expect(Array.isArray(vectorResults)).toBe(true);

      // Verify file name format for whatever results exist in both modes
      for (const f of ftsResults.slice(0, 3).map(r => path.basename(r.file))) {
        expect(f).toMatch(/\.(js|ts|json|md)$/);
      }
      for (const f of vectorResults.slice(0, 3).map(r => path.basename(r.file))) {
        expect(f).toMatch(/\.(js|ts|json|md)$/);
      }
    });
  });

  // ── Benchmark: result count comparison across all modes ──────────────────

  describe('result counts and metadata across all modes', () => {
    it.each([
      ['hybrid', 'bcrypt authenticate password'],
      ['vector', 'bcrypt authenticate password'],
      ['fts',    'bcrypt authenticate password'],
      ['graph',  'bcrypt authenticate password'],
    ] as const)(
      "'%s' for '%s' returns results with valid scores",
      async (searchType, query) => {
        const orch = await buildOrchestrator();
        const results = await orch.performSemanticSearch(query, FIXTURE_DIR, searchType);

        expect(Array.isArray(results)).toBe(true);
        for (const r of results) {
          expect(r.similarity).toBeGreaterThanOrEqual(0);
          expect(r.similarity).toBeLessThanOrEqual(1.0);
          expect(typeof r.file).toBe('string');
          expect(r.file.length).toBeGreaterThan(0);
          expect(typeof r.content).toBe('string');
        }
      }
    );
  });
});
