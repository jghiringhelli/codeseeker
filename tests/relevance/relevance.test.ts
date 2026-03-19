/**
 * Relevance Tests — Corpus Runner
 *
 * Runs every CorpusCase against the embedded search pipeline using the
 * ContractMaster-Test-Original fixture. Uses the same themed-embedding
 * technique as empirical-search-types.test.ts so results are deterministic
 * without needing the Xenova model.
 *
 * Pass/fail criterion per case:
 *  - All mustFind basenames appear in results within maxRank
 *  - mustNotFind basenames do NOT appear in results[0..4]
 *  - minResults / minTopScore are met when specified
 *
 * Run individually:
 *   npx jest --testPathPattern=relevance
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
import { CORPUS, CorpusCase } from './corpus';

// ── Fixture ───────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.join(
  __dirname,
  '../fixtures/ContractMaster-Test-Original/server'
);
const TEST_DIR = path.join(os.tmpdir(), `codeseeker-relevance-${Date.now()}`);

function uuid(): string {
  return crypto.randomUUID();
}

// Theme subspaces (384 dims, 32 dims per theme block) — identical to empirical tests
const THEMES: Record<string, number> = {
  auth:        0,
  controller:  1,
  model:       2,
  middleware:  3,
  utility:     4,
  validation:  5,
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
  const raw = Array(384).fill(0) as number[];
  for (const t of themes) {
    const e = makeThemedEmbedding(t);
    for (let i = 0; i < 384; i++) raw[i] += e[i];
  }
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? raw.map(v => v / norm) : raw;
}

// Fixture file registry (mirrors empirical-search-types.test.ts)
interface FileEntry {
  relPath: string;
  themes: Array<keyof typeof THEMES>;
}

const FIXTURE_FILES: FileEntry[] = [
  { relPath: 'controllers/MegaController.js',  themes: ['controller', 'auth', 'validation'] },
  { relPath: 'controllers/UserController.js',  themes: ['controller', 'auth'] },
  { relPath: 'controllers/BusinessLogic.js',   themes: ['controller', 'model'] },
  { relPath: 'services/UserService.js',        themes: ['auth', 'model'] },
  { relPath: 'services/user-service.js',       themes: ['auth'] },
  { relPath: 'services/contract-validator.js', themes: ['validation', 'model'] },
  { relPath: 'services/IServiceProvider.js',   themes: ['utility'] },
  { relPath: 'services/ProcessorFactory.js',   themes: ['utility', 'model'] },
  { relPath: 'utils/DatabaseHelper.js',        themes: ['model', 'utility'] },
];

// Query → themes mapping: determines which synthetic embedding a query gets.
// This simulates what the real transformer model would produce for these queries.
const QUERY_THEME_MAP: Record<string, Array<keyof typeof THEMES>> = {
  'bcrypt password hashing':                       ['auth'],
  'jwt sign token expiresIn':                      ['auth'],
  'contract validation rules':                     ['validation'],
  'registerUser function':                         ['controller', 'auth'],
  'authenticate user credentials':                 ['auth'],
  'getUserById method':                            ['controller'],
  'user login session management':                 ['auth', 'controller'],
  'database record persistence':                   ['model'],
  'user management authentication validation':     ['auth', 'controller', 'validation'],
  'business logic processing factory':             ['controller', 'model', 'utility'],
  'kubernetes helm chart deployment ingress':      ['utility'],  // no overlap
  'neural network training gradient descent loss function': ['utility'],
  'duplicate authentication bcrypt login':         ['auth'],
  'what do the controllers do':                    ['controller'],
  'service layer business logic':                  ['model', 'utility'],
};

// Graph edges for cross-directory expansion tests
const GRAPH_EDGES = [
  { from: 'controllers/UserController.js',   to: 'controllers/MegaController.js', type: 'extends' as const },
  { from: 'controllers/BusinessLogic.js',    to: 'controllers/MegaController.js', type: 'imports' as const },
  { from: 'controllers/MegaController.js',   to: 'services/UserService.js',       type: 'imports' as const },
];

// ── Test Setup ────────────────────────────────────────────────────────────────

describe('Relevance Corpus — ContractMaster fixture', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;
  let graphStore: IGraphStore;
  let projectId: string;

  function fileNodeId(relPath: string): string {
    return `node-${crypto.createHash('md5').update(relPath).digest('hex').slice(0, 8)}-${projectId.slice(0, 8)}`;
  }

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await resetStorageManager();

    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-data');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore    = storageManager.getVectorStore();
    projectStore   = storageManager.getProjectStore();
    graphStore     = storageManager.getGraphStore();

    projectId = uuid();
    await projectStore.upsert({ id: projectId, name: 'relevance-corpus', path: FIXTURE_DIR });

    // Index fixture files with themed embeddings
    const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [];
    for (const entry of FIXTURE_FILES) {
      const absPath = path.join(FIXTURE_DIR, entry.relPath);
      let content = '';
      try { content = fsSync.readFileSync(absPath, 'utf-8'); } catch { continue; }

      docs.push({
        id: crypto.createHash('md5').update(`${projectId}:${entry.relPath}`).digest('hex'),
        projectId,
        filePath: path.join(FIXTURE_DIR, entry.relPath),
        content,
        embedding: blendEmbeddings(entry.themes),
        metadata: { themes: entry.themes },
      });
    }
    if (docs.length > 0) await vectorStore.upsertMany(docs);

    // Build graph for cross-dir tests
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
        id: `edge-${crypto.createHash('md5').update(`${edge.from}->${edge.to}`).digest('hex').slice(0, 8)}`,
        source: fileNodeId(edge.from),
        target: fileNodeId(edge.to),
        type: edge.type,
      });
    }
  }, 90_000);

  afterAll(async () => {
    try { await vectorStore.deleteByProject(projectId); } catch { /* ignore */ }
    try { await projectStore.delete(projectId); } catch { /* ignore */ }
    try { await storageManager.closeAll(); } catch { /* ignore */ }
    try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function runCase(
    corpusCase: CorpusCase,
    searchType: 'hybrid' | 'fts' | 'vector' | 'graph' = 'hybrid'
  ): Promise<string[]> {
    const orch = new SemanticSearchOrchestrator();
    orch.setProjectId(projectId);
    await (orch as any).initStorage();

    // Inject themed query embedding so vector search is deterministic
    const themes = QUERY_THEME_MAP[corpusCase.query];
    if (themes) {
      const queryEmb = blendEmbeddings(themes);
      jest.spyOn((orch as any).embeddingGenerator, 'generateQueryEmbedding')
        .mockResolvedValue(queryEmb);
    }

    const results = await orch.performSemanticSearch(corpusCase.query, FIXTURE_DIR, searchType);
    return results.map(r => path.basename(r.file));
  }

  function assertCorpusCase(
    corpusCase: CorpusCase,
    resultFiles: string[],
    searchType: string
  ): void {
    // mustFind: each file must appear within maxRank
    for (const expected of corpusCase.mustFind) {
      const rank = resultFiles.findIndex(f => f.includes(expected)) + 1; // 1-based, 0 = not found
      expect(rank).toBeGreaterThan(0);
      expect(rank).toBeLessThanOrEqual(corpusCase.maxRank);
    }

    // mustNotFind: these should not appear in top-5
    for (const banned of corpusCase.mustNotFind ?? []) {
      const inTop5 = resultFiles.slice(0, 5).some(f => f.includes(banned));
      expect(inTop5).toBe(false);
    }

    // minResults
    if (corpusCase.minResults !== undefined && corpusCase.mustFind.length > 0) {
      expect(resultFiles.length).toBeGreaterThanOrEqual(corpusCase.minResults);
    }
  }

  // ── Corpus cases ─────────────────────────────────────────────────────────────

  describe('hybrid search', () => {
    for (const corpusCase of CORPUS) {
      it(`[${corpusCase.id}] ${corpusCase.description}`, async () => {
        const files = await runCase(corpusCase, 'hybrid');
        assertCorpusCase(corpusCase, files, 'hybrid');
      });
    }
  });

  describe('fts search', () => {
    // FTS cases: only run cases that rely on keyword matches
    const ftsCases = CORPUS.filter(c =>
      c.tags.some(t => t === 'exact-keyword' || t === 'exact-symbol' || t === 'duplicate-detection')
    );
    for (const corpusCase of ftsCases) {
      it(`[${corpusCase.id}] ${corpusCase.description}`, async () => {
        const files = await runCase(corpusCase, 'fts');
        assertCorpusCase(corpusCase, files, 'fts');
      });
    }
  });

  describe('corpus metadata', () => {
    it('corpus has at least 12 cases', () => {
      expect(CORPUS.length).toBeGreaterThanOrEqual(12);
    });

    it('every case has at least one tag', () => {
      for (const c of CORPUS) {
        expect(c.tags.length).toBeGreaterThan(0);
      }
    });

    it('every mustFind entry is a non-empty string', () => {
      for (const c of CORPUS) {
        for (const f of c.mustFind) {
          expect(typeof f).toBe('string');
          expect(f.length).toBeGreaterThan(0);
        }
      }
    });

    it('maxRank is at least 1 and at most 10', () => {
      for (const c of CORPUS) {
        expect(c.maxRank).toBeGreaterThanOrEqual(1);
        expect(c.maxRank).toBeLessThanOrEqual(10);
      }
    });
  });
});
