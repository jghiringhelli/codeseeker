/**
 * Symbol-Name Score Boost Tests (TDD)
 *
 * Verifies processRawResults() applies a +20% score boost when a query token
 * matches metadata.symbolName, metadata.functions, metadata.classes, or the
 * file's basename.
 *
 * Test strategy:
 *  - Two candidate files, A (no symbol match) and B (symbol match)
 *  - A starts with higher raw vector score than B
 *  - After boost B should outrank A
 *  - Mutation matrix: confirms boost value, token length filter, and RAPTOR exclusion
 */

import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import type { VectorSearchResult, VectorDocument } from '../../src/storage/interfaces';
import * as path from 'path';
import * as crypto from 'crypto';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_PATH = path.resolve('/tmp/repo');
const PROJECT_ID   = '550e8400-e29b-41d4-a716-446655440001';
const RAPTOR_PREFIX = '__raptor__/';

function makeDoc(relPath: string, metadata: Record<string, unknown> = {}): VectorDocument {
  return {
    id: crypto.createHash('md5').update(relPath).digest('hex'),
    projectId: PROJECT_ID,
    filePath: path.join(PROJECT_PATH, relPath),
    content: `// ${relPath} content`,
    embedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata,
  };
}

function makeResult(relPath: string, score: number, metadata: Record<string, unknown> = {}): VectorSearchResult {
  return { document: makeDoc(relPath, metadata), score, matchType: 'hybrid' };
}

function makeOrchestrator(query: string): SemanticSearchOrchestrator {
  const orch = new SemanticSearchOrchestrator();
  (orch as any).projectId = PROJECT_ID;
  (orch as any).storageManager = {};
  (orch as any).currentQuery = query;
  (orch as any).vectorStore = { searchHybrid: jest.fn().mockResolvedValue([]) };
  (orch as any).projectStore = {};
  (orch as any).graphStore = { findNodes: jest.fn().mockResolvedValue([]) };
  jest.spyOn((orch as any).embeddingGenerator, 'generateQueryEmbedding')
    .mockResolvedValue(new Array(384).fill(0.1));
  return orch;
}

/** Call private processRawResults directly */
function process(orch: SemanticSearchOrchestrator, results: VectorSearchResult[]): Array<{ file: string; similarity: number }> {
  return (orch as any).processRawResults(results, PROJECT_PATH);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('symbol-name score boost', () => {

  it('boosts a file whose symbolName matches a query token above a higher-scoring competitor', () => {
    const orch = makeOrchestrator('UserService authentication');
    const results = [
      makeResult('src/controllers/MegaController.ts', 0.80, { symbolName: 'MegaController' }),
      makeResult('src/services/UserService.ts',       0.65, { symbolName: 'UserService' }),  // lower raw score
    ];
    const ranked = process(orch, results);
    // UserService should now outrank MegaController due to symbolName token match
    expect(ranked[0].file).toContain('UserService');
    expect(ranked[1].file).toContain('MegaController');
  });

  it('boosts a file whose functions array contains a query token', () => {
    const orch = makeOrchestrator('registerUser endpoint');
    const results = [
      makeResult('src/routes/HealthCheck.ts', 0.75, { symbolName: 'HealthCheck', functions: ['ping', 'status'] }),
      makeResult('src/controllers/Auth.ts',   0.60, { symbolName: 'AuthController', functions: ['registerUser', 'loginUser'] }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('Auth');
    expect(ranked[1].file).toContain('HealthCheck');
  });

  it('boosts a file whose classes array contains a query token', () => {
    const orch = makeOrchestrator('DatabaseHelper operations');
    const results = [
      makeResult('src/api/Router.ts',      0.72, { symbolName: 'Router', classes: ['Router'] }),
      makeResult('src/utils/Database.ts',  0.58, { symbolName: 'Database', classes: ['DatabaseHelper'] }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('Database');
  });

  it('does NOT boost files when no query token (>2 chars) matches any metadata', () => {
    const orch = makeOrchestrator('bcrypt hashing');
    const results = [
      makeResult('src/config/Settings.ts', 0.80, { symbolName: 'Settings',  functions: ['load', 'save'] }),
      makeResult('src/auth/Crypto.ts',     0.60, { symbolName: 'CryptoUtil', functions: ['hash', 'verify'] }),
    ];
    const ranked = process(orch, results);
    // Neither symbolName contains "bcrypt" or "hashing" — order should be raw score
    expect(ranked[0].file).toContain('Settings');
    expect(ranked[1].file).toContain('Crypto');
  });

  it('does NOT boost RAPTOR synthetic nodes even if query matches', () => {
    const orch = makeOrchestrator('auth flow');
    const raptorResult: VectorSearchResult = {
      document: {
        id: 'r1',
        projectId: PROJECT_ID,
        filePath: `${RAPTOR_PREFIX}src/auth/__summary__`,
        content: 'auth directory summary',
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { raptorLevel: 2, raptorDir: 'src/auth', symbolName: 'auth' },
      },
      score: 0.50,
      matchType: 'hybrid',
    };
    const real = makeResult('src/config/App.ts', 0.60, { symbolName: 'AppConfig' });
    const ranked = process(orch, [raptorResult, real]);
    // Real file scored 0.60, RAPTOR 0.50 — RAPTOR has no boost so real file still wins
    const appEntry = ranked.find(r => r.file.includes('App'));
    const raptorEntry = ranked.find(r => r.file.includes('auth'));
    expect(appEntry?.similarity).toBeGreaterThan(raptorEntry?.similarity ?? 1);
  });

  it('ignores very short query tokens (≤2 chars) from boosting', () => {
    // "to do" → tokens ["to", "do"] both ≤ 2 chars, should not boost
    const orch = makeOrchestrator('to do');
    const results = [
      makeResult('src/A.ts', 0.80, { symbolName: 'DoWork' }),
      makeResult('src/B.ts', 0.60, { symbolName: 'Todo' }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('A.ts');
  });

  it('boosts filename match when metadata has no symbolName', () => {
    const orch = makeOrchestrator('ProcessorFactory creation');
    const results = [
      makeResult('src/utils/Helpers.ts',          0.74, {}),
      makeResult('src/services/ProcessorFactory.ts', 0.55, {}),  // no symbolName but filename matches
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('ProcessorFactory');
  });
});

// ── File-type boost tests ─────────────────────────────────────────────────────

describe('file-type boost', () => {
  it('source file (.ts) outranks an equal-score markdown doc (.md)', () => {
    const orch = makeOrchestrator('DagCycleError topologicalSort');
    const results = [
      makeResult('docs/spec.md',          0.70, {}),
      makeResult('src/dag/dag-engine.ts', 0.70, {}),  // equal score but .ts
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('dag-engine.ts');
  });

  it('source file (.ts) outranks an equal-score lock file (.lock)', () => {
    const orch = makeOrchestrator('registry spawnInstance');
    const results = [
      makeResult('pnpm-lock.yaml',          0.65, {}),
      makeResult('src/roles/registry.ts',   0.65, {}),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('registry.ts');
  });

  it('test file (.test.ts) is penalised below equal-score implementation file', () => {
    const orch = makeOrchestrator('DagCycleError topologicalSort');
    const results = [
      makeResult('tests/integration.test.ts', 0.70, {}),
      makeResult('src/dag/dag-engine.ts',     0.70, {}),
    ];
    const ranked = process(orch, results);
    // dag-engine.ts: 0.70 + 0.10 (src) = 0.80
    // integration.test.ts: 0.70 + 0.10 (ts) - 0.15 (test) = 0.65
    expect(ranked[0].file).toContain('dag-engine.ts');
  });

  it('files in __tests__ directory are penalised', () => {
    const orch = makeOrchestrator('registry spawnInstance');
    const results = [
      makeResult('src/__tests__/registry.test.ts', 0.75, {}),
      makeResult('src/roles/registry.ts',           0.65, {}),
    ];
    const ranked = process(orch, results);
    // registry.ts: 0.65 + 0.10 = 0.75; __tests__/registry.test.ts: 0.75 + 0.10 - 0.15 = 0.70
    expect(ranked[0].file).toContain('roles/registry');
  });

  it('multi-chunk boost requires per-chunk quality gate (score ≥ 0.15)', () => {
    const orch = makeOrchestrator('authenticate user');
    // Simulate large lock file: 5 chunks all scored 0.10 (below gate)
    const lockChunks = Array.from({ length: 5 }, (_, i) =>
      makeResult('pnpm-lock.yaml', 0.10, { chunkIndex: i })
    );
    // Small source file: 1 chunk scored 0.25 (above gate)
    const sourceFile = makeResult('src/auth/AuthService.ts', 0.25, { symbolName: 'AuthService' });
    const ranked = process(orch, [...lockChunks, sourceFile]);
    // lock file best chunk = 0.10, below gate → no multi-chunk boost → stays at ~0.10
    // source file = 0.25 + 0.20 (symbol) + 0.10 (type) = 0.55
    expect(ranked[0].file).toContain('AuthService.ts');
  });
});

// ── Mutation matrix ───────────────────────────────────────────────────────────
// Each test below is designed to catch a specific mutation.

describe('symbol-name boost — mutation detection', () => {

  it('[mutation: boost=0] removing the boost should fail rank-reversal test', () => {
    // If symbolBoost were always 0, UserService (0.65) would stay below MegaController (0.80)
    // This test ensures the boost value is non-zero
    const orch = makeOrchestrator('UserService');
    const results = [
      makeResult('src/controllers/MegaController.ts', 0.80, { symbolName: 'MegaController' }),
      makeResult('src/services/UserService.ts',       0.65, { symbolName: 'UserService' }),
    ];
    const ranked = process(orch, results);
    const userServiceScore = ranked.find(r => r.file.includes('UserService'))?.similarity ?? 0;
    const megaScore        = ranked.find(r => r.file.includes('MegaController'))?.similarity ?? 0;
    expect(userServiceScore).toBeGreaterThan(megaScore); // 0.65 + 0.20 = 0.85 > 0.80
  });

  it('[mutation: token filter off] allowing 1-char tokens must not change ranking here', () => {
    // "a b" — if filter were disabled, "a" and "b" would match any symbolName containing those letters
    // This test ensures stable ranking when only tiny tokens exist
    const orch = makeOrchestrator('a b');
    const results = [
      makeResult('src/big/File.ts',   0.80, { symbolName: 'BigFile' }),
      makeResult('src/auth/Auth.ts',  0.60, { symbolName: 'AuthService' }),  // 'a' would match 'AuthService' if filter off
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('big');
  });

  it('[mutation: boost applied to RAPTOR nodes] RAPTOR score must NOT exceed real file score via symbol boost', () => {
    const orch = makeOrchestrator('auth service handler');
    const raptorResult: VectorSearchResult = {
      document: {
        id: 'r2',
        projectId: PROJECT_ID,
        filePath: `${RAPTOR_PREFIX}src/auth/__summary__`,
        content: 'auth service handler summary',
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { raptorLevel: 2, raptorDir: 'src/auth', symbolName: 'authServiceHandler' },
      },
      score: 0.70,
      matchType: 'hybrid',
    };
    const real = makeResult('src/config/Config.ts', 0.75, { symbolName: 'Config' });
    const ranked = process(orch, [raptorResult, real]);
    // RAPTOR starts at 0.70, real at 0.75. Real has no boost. RAPTOR must not be boosted past real.
    const realEntry = ranked.find(r => r.file.includes('Config'));
    const raptorEntry = ranked.find(r => r.file.includes('auth'));
    expect(realEntry?.similarity).toBeGreaterThanOrEqual(raptorEntry?.similarity ?? 0);
  });
});
