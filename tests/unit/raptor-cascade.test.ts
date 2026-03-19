/**
 * RAPTOR Cascade Tests (TDD)
 *
 * Tests the performCascadeSearch() method inside SemanticSearchOrchestrator.
 *
 * Cascade logic (post-processing, no IVectorStore changes):
 *  1. Run wide searchHybrid (always happens)
 *  2. Extract RAPTOR L2 nodes from results (RAPTOR_FILE_PREFIX paths)
 *  3. If top L2 score >= L2_THRESHOLD (0.5) AND at least 1 L2 node found:
 *       - Collect candidate dirs from L2 metadata.raptorDir
 *       - Post-filter non-RAPTOR results to those dirs only
 *       - If filtered results >= MIN_RESULTS (3) AND topScore >= TOP_SCORE_THRESHOLD (0.25):
 *           return filtered results (cascade wins)
 *  4. Otherwise: return the original wide results (fallback)
 *
 * All tests mock vectorStore.searchHybrid so no storage is needed.
 *
 * Mutation matrix (bottom of file): 3 targeted bugs, each caught.
 */

import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import { RAPTOR_FILE_PREFIX } from '../../src/cli/services/search/raptor-indexing-service';
import type { VectorSearchResult, VectorDocument } from '../../src/storage/interfaces';
import * as path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Use a project path that is absolute on the current OS
const PROJECT_PATH = path.resolve('/tmp/repo');
const PROJECT_ID   = '550e8400-e29b-41d4-a716-446655440000'; // valid UUID

/** Build a relative file path like src/auth/login.ts */
function rel(relPath: string): string { return relPath; }

function makeDoc(
  filePath: string,
  raptorDir?: string,
  raptorLevel?: number
): VectorDocument {
  const isRaptor = filePath.startsWith(RAPTOR_FILE_PREFIX);
  return {
    id: filePath,
    projectId: PROJECT_ID,
    // Store as absolute so path.relative works the same on all platforms
    filePath: path.isAbsolute(filePath) || filePath.startsWith(RAPTOR_FILE_PREFIX)
      ? filePath
      : path.join(PROJECT_PATH, filePath),
    content: 'content for ' + filePath,
    embedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      ...(isRaptor && raptorDir ? { raptorDir } : {}),
      ...(isRaptor && raptorLevel != null ? { raptorLevel } : {}),
    },
  };
}

function makeResult(filePath: string, score: number, raptorDir?: string, raptorLevel = 2): VectorSearchResult {
  const isRaptor = filePath.startsWith(RAPTOR_FILE_PREFIX);
  return {
    document: makeDoc(filePath, raptorDir, isRaptor ? raptorLevel : undefined),
    score,
    matchType: 'hybrid',
  };
}

/** Build a realistic searchHybrid response: some L2 nodes + some real files. */
function hybridResponse(opts: {
  l2DirScore?: number;      // Score for the RAPTOR L2 node (default: 0.7)
  l2Dir?: string;           // raptorDir metadata (default: 'src/auth')
  realFiles?: Array<{ relPath: string; score: number }>;
}): VectorSearchResult[] {
  const l2Score  = opts.l2DirScore ?? 0.7;
  const l2Dir    = opts.l2Dir ?? 'src/auth';
  const realFiles = opts.realFiles ?? [
    { relPath: 'src/auth/login.ts',    score: 0.8 },
    { relPath: 'src/auth/register.ts', score: 0.7 },
    { relPath: 'src/auth/session.ts',  score: 0.6 },  // 3rd auth file — meets CASCADE_MIN_RESULTS
    { relPath: 'src/db/user.ts',       score: 0.4 },
    { relPath: 'src/db/migrate.ts',    score: 0.3 },
  ];

  const results: VectorSearchResult[] = [
    makeResult(`${RAPTOR_FILE_PREFIX}${l2Dir}/__summary__`, l2Score, l2Dir),
    ...realFiles.map(f => makeResult(f.relPath, f.score)),
  ];
  return results;
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

function makeOrchestrator(): SemanticSearchOrchestrator {
  const orch = new SemanticSearchOrchestrator();
  (orch as any).projectId = PROJECT_ID;

  // Set storageManager to a truthy sentinel so initStorage() early-returns immediately
  // (it checks `if (this.storageManager !== null) return`)
  (orch as any).storageManager = {};

  // Inject minimal mock stores
  (orch as any).vectorStore = { searchHybrid: jest.fn() };
  (orch as any).projectStore = {};
  (orch as any).graphStore = { findNodes: jest.fn().mockResolvedValue([]) };

  // Stub embedding to return a dummy vector
  jest.spyOn((orch as any).embeddingGenerator, 'generateQueryEmbedding')
    .mockResolvedValue(new Array(384).fill(0.1));
  return orch;
}

function mockSearchHybrid(orch: SemanticSearchOrchestrator, results: VectorSearchResult[]): jest.Mock {
  const mock = jest.fn().mockResolvedValue(results);
  (orch as any).vectorStore.searchHybrid = mock;
  return mock;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RAPTOR cascade search', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Cascade activates when L2 score is good ──────────────────────────────

  describe('cascade activation', () => {
    it('uses filtered results when L2 score >= 0.5 and enough results remain', async () => {
      const orch = makeOrchestrator();
      const response = hybridResponse({ l2DirScore: 0.7, l2Dir: 'src/auth' });
      mockSearchHybrid(orch, response);

      const results = await orch.performSemanticSearch('login logic', PROJECT_PATH, 'hybrid');

      // The db files (not in src/auth) should be filtered out
      const fileNames = results.map(r => r.file);
      expect(fileNames.some(f => f.includes('login.ts'))).toBe(true);
      expect(fileNames.some(f => f.includes('register.ts'))).toBe(true);
      expect(fileNames.some(f => f.includes('db/user.ts'))).toBe(false);
      expect(fileNames.some(f => f.includes('db/migrate.ts'))).toBe(false);
    });

    it('searchHybrid is called exactly once (cascade is post-processing, not extra calls)', async () => {
      const orch = makeOrchestrator();
      const mock = mockSearchHybrid(orch, hybridResponse({}));

      await orch.performSemanticSearch('authenticate', PROJECT_PATH, 'hybrid');

      expect(mock).toHaveBeenCalledTimes(1);
    });

    it('cascade filters to multiple matching directories when L2 has multiple nodes', async () => {
      const orch = makeOrchestrator();
      const multiDirResponse: VectorSearchResult[] = [
        makeResult(`${RAPTOR_FILE_PREFIX}src/auth/__summary__`,       0.8, 'src/auth'),
        makeResult(`${RAPTOR_FILE_PREFIX}src/middleware/__summary__`,  0.6, 'src/middleware'),
        makeResult('src/auth/login.ts',         0.75),
        makeResult('src/auth/register.ts',      0.65), // 2nd auth file
        makeResult('src/middleware/auth.ts',    0.60),  // 3rd (across dirs) → meets min-results
        makeResult('src/db/user.ts',            0.3),
      ];
      mockSearchHybrid(orch, multiDirResponse);

      const results = await orch.performSemanticSearch('auth middleware', PROJECT_PATH, 'hybrid');

      const fileNames = results.map(r => r.file);
      expect(fileNames.some(f => f.includes('auth/login'))).toBe(true);
      expect(fileNames.some(f => f.includes('middleware/auth'))).toBe(true);
      expect(fileNames.some(f => f.includes('db/user'))).toBe(false);
    });
  });

  // ── Fallback conditions ───────────────────────────────────────────────────

  describe('fallback to wide results', () => {
    it('falls back when L2 score < 0.5 (L2 not confident)', async () => {
      const orch = makeOrchestrator();
      const response = hybridResponse({ l2DirScore: 0.4, l2Dir: 'src/auth' });
      mockSearchHybrid(orch, response);

      const results = await orch.performSemanticSearch('login logic', PROJECT_PATH, 'hybrid');

      // Wide results: db files should be present (not filtered away)
      const fileNames = results.map(r => r.file);
      expect(fileNames.some(f => f.includes('db/user'))).toBe(true);
    });

    it('falls back when cascade produces fewer than 3 results', async () => {
      const orch = makeOrchestrator();
      // Only 1 file in the L2 directory — cascade would produce < 3
      const thinResponse: VectorSearchResult[] = [
        makeResult(`${RAPTOR_FILE_PREFIX}src/auth/__summary__`, 0.8, 'src/auth'),
        makeResult('src/auth/login.ts',  0.75),
        makeResult('src/db/user.ts',     0.5),
        makeResult('src/db/migrate.ts',  0.4),
        makeResult('src/utils/helper.ts', 0.3),
      ];
      mockSearchHybrid(orch, thinResponse);

      const results = await orch.performSemanticSearch('login', PROJECT_PATH, 'hybrid');

      // Fallback: db and utils files should appear
      const fileNames = results.map(r => r.file);
      expect(fileNames.some(f => f.includes('db/user'))).toBe(true);
    });

    it('falls back when top cascade result score < 0.25', async () => {
      const orch = makeOrchestrator();
      // All auth files have very low scores after deduplication boost
      const lowScoreResponse: VectorSearchResult[] = [
        makeResult(`${RAPTOR_FILE_PREFIX}src/auth/__summary__`, 0.7, 'src/auth'),
        makeResult('src/auth/login.ts',    0.1),
        makeResult('src/auth/register.ts', 0.1),
        makeResult('src/auth/reset.ts',    0.1),
        makeResult('src/db/user.ts',       0.5),
      ];
      mockSearchHybrid(orch, lowScoreResponse);

      const results = await orch.performSemanticSearch('login', PROJECT_PATH, 'hybrid');

      // Fallback: wide results include db/user.ts
      const fileNames = results.map(r => r.file);
      expect(fileNames.some(f => f.includes('db/user'))).toBe(true);
    });

    it('falls back when no RAPTOR nodes in results at all', async () => {
      const orch = makeOrchestrator();
      const noRaptorResponse: VectorSearchResult[] = [
        makeResult('src/auth/login.ts',    0.8),
        makeResult('src/auth/register.ts', 0.7),
        makeResult('src/db/user.ts',       0.4),
      ];
      mockSearchHybrid(orch, noRaptorResponse);

      const results = await orch.performSemanticSearch('login logic', PROJECT_PATH, 'hybrid');

      // All 3 files present — nothing was filtered
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── No regression vs wide search ─────────────────────────────────────────

  describe('no regression', () => {
    it('cascade result set is a subset of wide results — no phantom files', async () => {
      const orch = makeOrchestrator();
      const response = hybridResponse({ l2DirScore: 0.8 });
      mockSearchHybrid(orch, response);

      const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'hybrid');
      // Every file in results must have come from the wide searchHybrid call
      const wideFiles = response.map(r => r.document.filePath);
      for (const r of results) {
        const matched = wideFiles.some(wf =>
          wf.endsWith(r.file) || r.file.endsWith(path.basename(wf))
        );
        expect(matched).toBe(true);
      }
    });

    it('empty searchHybrid → empty results regardless of cascade', async () => {
      const orch = makeOrchestrator();
      mockSearchHybrid(orch, []);

      const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'hybrid');
      expect(results).toEqual([]);
    });

    it('non-hybrid search types skip cascade (vector-only, fts)', async () => {
      // For 'vector' and 'fts' modes, cascade is irrelevant — just verify no crash
      const orch = makeOrchestrator();
      (orch as any).vectorStore.searchByVector = jest.fn().mockResolvedValue([]);
      (orch as any).vectorStore.searchByText   = jest.fn().mockResolvedValue([]);

      const vectorResults = await orch.performSemanticSearch('auth', PROJECT_PATH, 'vector');
      const ftsResults    = await orch.performSemanticSearch('auth', PROJECT_PATH, 'fts');

      expect(Array.isArray(vectorResults)).toBe(true);
      expect(Array.isArray(ftsResults)).toBe(true);
    });
  });

  // ── Cascade thresholds ────────────────────────────────────────────────────

  describe('threshold boundaries', () => {
    it('L2 score exactly 0.5 triggers cascade (inclusive boundary)', async () => {
      const orch = makeOrchestrator();
      const response = hybridResponse({ l2DirScore: 0.5 });
      mockSearchHybrid(orch, response);

      const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'hybrid');

      const fileNames = results.map(r => r.file);
      // Cascade active: db files filtered out
      expect(fileNames.some(f => f.includes('db/user'))).toBe(false);
    });

    it('L2 score 0.499 does NOT trigger cascade (just below threshold)', async () => {
      const orch = makeOrchestrator();
      const response = hybridResponse({ l2DirScore: 0.499 });
      mockSearchHybrid(orch, response);

      const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'hybrid');

      const fileNames = results.map(r => r.file);
      // Fallback: db files present
      expect(fileNames.some(f => f.includes('db/user'))).toBe(true);
    });
  });
});

/**
 * Mutation Matrix— 3 targeted bugs that the tests above will catch:
 *
 * MUTATION 1 (break fallback threshold):
 *   Change: `l2Score >= L2_THRESHOLD` → `l2Score > L2_THRESHOLD`  (exclusive instead of inclusive)
 *   Caught by: 'L2 score exactly 0.5 triggers cascade (inclusive boundary)'
 *
 * MUTATION 2 (break directory filter):
 *   Change: directory filter to always keep all files (remove `candidateDirs.has(dir)` check)
 *   Caught by: 'uses filtered results when L2 score >= 0.5 and enough results remain'
 *              db/user.ts would incorrectly appear
 *
 * MUTATION 3 (skip wide search, use only cascade):
 *   Change: remove fallback path, always return cascade results
 *   Caught by: 'falls back when L2 score < 0.5', 'falls back when no RAPTOR nodes in results'
 */
