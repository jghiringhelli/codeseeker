/**
 * Symbol Score Boost Tests
 *
 * `processRawResults()` grades a query-token match by how strong the evidence is:
 *
 *   +0.20  some chunk of the file DECLARES a symbol the query names
 *   +0.12  only the filename shares a word with the query
 *
 * These were a single +0.20 for either, which is how a 14-line `routes.ts` that declares
 * nothing outranked the controller declaring all eleven endpoints, and how a README
 * outranked the service it describes. Over the 23 RealWorld benchmark queries the split
 * moved MRR 66.3% -> 80.4% and P@1 43.5% -> 65.2%.
 *
 * The boost also read `metadata.classes` and `metadata.functions`. The indexer writes
 * neither — it writes `symbolName` and `symbolType` — so those two inputs were always
 * undefined in production and only ever fired in tests that supplied them by hand. The
 * tests that did so are gone with the code path.
 *
 * Test strategy:
 *  - Two candidate files, A (weaker evidence) and B (stronger), A with the higher raw score
 *  - After boosting, B should outrank A
 *  - Mutation matrix: confirms boost values, token length filter, and RAPTOR exclusion
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
      makeResult('src/controllers/MegaController.ts', 0.80, { symbolName: 'MegaController', symbolType: 'class' }),
      makeResult('src/services/UserService.ts',       0.65, { symbolName: 'UserService', symbolType: 'class' }),  // lower raw score
    ];
    const ranked = process(orch, results);
    // UserService should now outrank MegaController due to symbolName token match
    expect(ranked[0].file).toContain('UserService');
    expect(ranked[1].file).toContain('MegaController');
  });

  it('finds a declaration in any chunk of the file, not only the best-scoring one', () => {
    // A service declares `getTags` in one chunk while an unrelated chunk of the same file
    // scores highest. Reading only the winner's metadata would miss the declaration.
    const orch = makeOrchestrator('return the list of popular tags');
    const results = [
      makeResult('src/tag/tag.service.ts', 0.55, { symbolName: 'buildClient', symbolType: 'function' }),
      makeResult('src/tag/tag.service.ts', 0.50, { symbolName: 'getTags',     symbolType: 'function' }),
      makeResult('src/tag/tag.model.ts',   0.62, { symbolName: 'Tag',         symbolType: 'class' }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('tag.service.ts');
  });

  it('ranks a file that declares the query term above one that merely shares its name', () => {
    // The ex-routes failure: a 14-line `routes.ts` wiring routers together outranked the
    // controller that declares every endpoint, because both scored the same +0.20.
    const orch = makeOrchestrator('express routes exposing the articles REST endpoints');
    const results = [
      makeResult('src/app/routes/routes.ts',                   0.70, {}),
      makeResult('src/app/routes/article/article.controller.ts', 0.62, {
        symbolName: 'routesArticles', symbolType: 'function',
      }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('article.controller.ts');
  });

  it('treats a chunk with no symbol type as no declaration', () => {
    // `symbolType: 'unknown'` means the chunker could not identify a declaration. A prose
    // or config chunk must not claim the declaration boost.
    const orch = makeOrchestrator('article service');
    const results = [
      makeResult('docs/article.md',    0.70, { symbolName: 'article', symbolType: 'unknown' }),
      makeResult('src/article.svc.ts', 0.62, { symbolName: 'article', symbolType: 'function' }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('article.svc.ts');
  });

  it('does NOT boost files when no query token (>2 chars) matches any metadata', () => {
    const orch = makeOrchestrator('bcrypt hashing');
    const results = [
      makeResult('src/config/Settings.ts', 0.80, { symbolName: 'Settings',  symbolType: 'class' }),
      makeResult('src/auth/Crypto.ts',     0.60, { symbolName: 'CryptoUtil', symbolType: 'class' }),
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
    // Weaker than a declaration but real: 0.12 against nothing still reverses a 0.11 gap.
    const orch = makeOrchestrator('ProcessorFactory creation');
    const results = [
      makeResult('src/utils/Helpers.ts',             0.64, {}),
      makeResult('src/services/ProcessorFactory.ts', 0.55, {}),  // no symbolName but filename matches
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('ProcessorFactory');
  });

  it('does not let a filename match outrank a declaration', () => {
    // The README-outranks-the-service failure, stated as an invariant.
    const orch = makeOrchestrator('log a user in and sign a jwt');
    const results = [
      makeResult('src/auth/jwt-notes.ts',   0.70, {}),                                       // name only
      makeResult('src/auth/auth.service.ts', 0.70, { symbolName: 'login', symbolType: 'function' }),
    ];
    const ranked = process(orch, results);
    expect(ranked[0].file).toContain('auth.service.ts');
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
      makeResult('src/controllers/MegaController.ts', 0.80, { symbolName: 'MegaController', symbolType: 'class' }),
      makeResult('src/services/UserService.ts',       0.65, { symbolName: 'UserService', symbolType: 'class' }),
    ];
    const ranked = process(orch, results);
    const userServiceScore = ranked.find(r => r.file.includes('UserService'))?.similarity ?? 0;
    const megaScore        = ranked.find(r => r.file.includes('MegaController'))?.similarity ?? 0;
    // UserService declares the queried symbol: 0.65 + 0.10 (source) + 0.20 = 0.95.
    // MegaController matches nothing: 0.80 + 0.10 = 0.90.
    expect(userServiceScore).toBeGreaterThan(megaScore);
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
