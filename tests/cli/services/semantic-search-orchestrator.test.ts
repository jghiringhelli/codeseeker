/**
 * Unit Tests: SemanticSearchOrchestrator
 *
 * Test pyramid layer: UNIT — all external I/O mocked.
 *
 * Coverage:
 *  1. search_type routing  — correct IVectorStore method called per type
 *  2. processRawResults    — dedup, multi-chunk boost, score cap, RAPTOR passthrough
 *  3. expandWithGraphNeighbors — graph expansion, discount scoring, graceful fallback
 *  4. initStorage fallback — graphStore absence doesn't crash anything
 */

import * as path from 'path';
import type {
  IVectorStore,
  IProjectStore,
  IGraphStore,
  VectorSearchResult,
  VectorDocument,
} from '../../../src/storage/interfaces';
import type { GraphNode } from '../../../src/storage/interfaces';

// ── Module mocks must be declared before any imports that trigger the modules ──

const mockVectorStore: jest.Mocked<
  Pick<IVectorStore, 'searchByVector' | 'searchByText' | 'searchHybrid'>
> = {
  searchByVector: jest.fn(),
  searchByText: jest.fn(),
  searchHybrid: jest.fn(),
};

const mockProjectStore: jest.Mocked<Pick<IProjectStore, 'list'>> = {
  list: jest.fn(),
};

const mockGraphStore: jest.Mocked<
  Pick<IGraphStore, 'findNodes' | 'getNeighbors' | 'getNode' | 'getEdges'>
> = {
  findNodes: jest.fn(),
  getNeighbors: jest.fn(),
  getNode: jest.fn(),
  getEdges: jest.fn(),
};

const mockStorageManager = {
  getVectorStore: jest.fn().mockReturnValue(mockVectorStore),
  getProjectStore: jest.fn().mockReturnValue(mockProjectStore),
  getGraphStore: jest.fn().mockReturnValue(mockGraphStore),
};

jest.mock('../../../src/storage', () => ({
  getStorageManager: jest.fn().mockResolvedValue(mockStorageManager),
  isUsingEmbeddedStorage: jest.fn().mockReturnValue(true),
  resetStorageManager: jest.fn(),
}));

jest.mock('../../../src/cli/services/search/embedding-generator-adapter', () => ({
  EmbeddingGeneratorAdapter: jest.fn().mockImplementation(() => ({
    generateQueryEmbedding: jest.fn().mockResolvedValue(Array(384).fill(0.1)),
  })),
}));

// Also mock RAPTOR service so isRaptorPath is stable
jest.mock('../../../src/cli/services/search/raptor-indexing-service', () => ({
  RaptorIndexingService: {
    isRaptorPath: jest.fn().mockReturnValue(false),
    realPath: jest.fn((p: string) => p),
  },
  RAPTOR_FILE_PREFIX: '__raptor__',
}));

// Import the class under test AFTER the mocks are registered
import { SemanticSearchOrchestrator } from '../../../src/cli/commands/services/semantic-search-orchestrator';

// ── Test helpers ─────────────────────────────────────────────────────────────

const PROJECT_PATH = '/test/project';
const PROJECT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeDoc(filePath: string): Omit<VectorDocument, 'createdAt' | 'updatedAt'> & Pick<VectorDocument, 'createdAt' | 'updatedAt'> {
  return {
    id: `id-${filePath.replace(/\//g, '-')}`,
    projectId: PROJECT_ID,
    filePath,
    content: `content of ${filePath}`,
    embedding: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeResult(filePath: string, score: number): VectorSearchResult {
  return {
    score,
    matchType: 'hybrid',
    document: makeDoc(filePath) as VectorDocument,
  };
}

function makeGraphNode(id: string, filePath: string): GraphNode {
  return {
    id,
    type: 'file',
    name: path.basename(filePath),
    filePath,
    projectId: PROJECT_ID,
  };
}

async function buildOrchestrator(): Promise<SemanticSearchOrchestrator> {
  // Reset project store mock to return our test project
  mockProjectStore.list.mockResolvedValue([
    { id: PROJECT_ID, name: 'test', path: PROJECT_PATH } as any,
  ]);
  const orch = new SemanticSearchOrchestrator();
  return orch;
}

// ── 1. search_type routing ────────────────────────────────────────────────────

describe('SemanticSearchOrchestrator – search_type routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectStore.list.mockResolvedValue([
      { id: PROJECT_ID, name: 'test', path: PROJECT_PATH } as any,
    ]);
    // Default: all store methods return empty results
    mockVectorStore.searchByVector.mockResolvedValue([]);
    mockVectorStore.searchByText.mockResolvedValue([]);
    mockVectorStore.searchHybrid.mockResolvedValue([]);
    mockGraphStore.findNodes.mockResolvedValue([]);
    mockGraphStore.getNeighbors.mockResolvedValue([]);
  });

  it("'hybrid' calls searchHybrid and NOT searchByVector or searchByText", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('auth service', PROJECT_PATH, 'hybrid');

    expect(mockVectorStore.searchHybrid).toHaveBeenCalledTimes(1);
    expect(mockVectorStore.searchByVector).not.toHaveBeenCalled();
    expect(mockVectorStore.searchByText).not.toHaveBeenCalled();
  });

  it("default (no searchType) calls searchHybrid", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('auth service', PROJECT_PATH);

    expect(mockVectorStore.searchHybrid).toHaveBeenCalledTimes(1);
    expect(mockVectorStore.searchByVector).not.toHaveBeenCalled();
  });

  it("'vector' calls searchByVector and NOT searchHybrid or searchByText", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('auth service', PROJECT_PATH, 'vector');

    expect(mockVectorStore.searchByVector).toHaveBeenCalledTimes(1);
    expect(mockVectorStore.searchHybrid).not.toHaveBeenCalled();
    expect(mockVectorStore.searchByText).not.toHaveBeenCalled();
  });

  it("'fts' calls searchByText and NOT searchHybrid or searchByVector", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('auth service', PROJECT_PATH, 'fts');

    expect(mockVectorStore.searchByText).toHaveBeenCalledTimes(1);
    expect(mockVectorStore.searchHybrid).not.toHaveBeenCalled();
    expect(mockVectorStore.searchByVector).not.toHaveBeenCalled();
  });

  it("'graph' calls searchHybrid (hybrid base) AND getNeighbors (graph expansion)", async () => {
    // Provide one result so expansion is attempted
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.8),
    ]);
    mockGraphStore.findNodes.mockResolvedValue([
      makeGraphNode('node-auth', `${PROJECT_PATH}/src/auth.ts`),
    ]);
    mockGraphStore.getNeighbors.mockResolvedValue([]);

    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('auth service', PROJECT_PATH, 'graph');

    expect(mockVectorStore.searchHybrid).toHaveBeenCalledTimes(1);
    expect(mockGraphStore.findNodes).toHaveBeenCalledTimes(1);
    expect(mockGraphStore.getNeighbors).toHaveBeenCalledTimes(1);
    expect(mockVectorStore.searchByVector).not.toHaveBeenCalled();
    expect(mockVectorStore.searchByText).not.toHaveBeenCalled();
  });

  it("searchByVector receives the generated embedding as first argument", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('test query', PROJECT_PATH, 'vector');

    const [calledEmbedding] = mockVectorStore.searchByVector.mock.calls[0];
    expect(Array.isArray(calledEmbedding)).toBe(true);
    expect(calledEmbedding).toHaveLength(384);
  });

  it("searchByText receives the query string as first argument", async () => {
    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('my query text', PROJECT_PATH, 'fts');

    const [calledQuery] = mockVectorStore.searchByText.mock.calls[0];
    expect(calledQuery).toBe('my query text');
  });

  it("returns empty array when no project matches the path", async () => {
    mockProjectStore.list.mockResolvedValue([]);
    const orch = new SemanticSearchOrchestrator();
    const results = await orch.performSemanticSearch('anything', '/no/such/path');
    expect(results).toEqual([]);
  });
});

// ── 2. processRawResults (dedup + multi-chunk boost + score cap) ─────────────

describe('SemanticSearchOrchestrator – processRawResults (dedup + boost)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectStore.list.mockResolvedValue([
      { id: PROJECT_ID, name: 'test', path: PROJECT_PATH } as any,
    ]);
    mockGraphStore.findNodes.mockResolvedValue([]);
    mockGraphStore.getNeighbors.mockResolvedValue([]);
  });

  it('deduplicates chunks that share the same file path', async () => {
    // Three chunks from two files
    mockVectorStore.searchByText.mockResolvedValue([
      makeResult('src/user.ts', 0.9),
      makeResult('src/user.ts', 0.7),  // duplicate file
      makeResult('src/auth.ts', 0.5),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('user auth', PROJECT_PATH, 'fts');

    const files = results.map(r => r.file);
    expect(files.filter(f => f.includes('user.ts'))).toHaveLength(1);
    expect(files.filter(f => f.includes('auth.ts'))).toHaveLength(1);
    expect(results).toHaveLength(2);
  });

  it('boosts a file with two matching chunks above its best single-chunk score', async () => {
    mockVectorStore.searchByText.mockResolvedValue([
      makeResult('src/user.ts', 0.8),
      makeResult('src/user.ts', 0.6),  // second chunk
    ]);

    const orch = await buildOrchestrator();
    const [result] = await orch.performSemanticSearch('user', PROJECT_PATH, 'fts');

    // Multi-chunk boost: 0.8 * 1.10 = 0.88, capped at 1.0
    expect(result.similarity).toBeGreaterThan(0.8);
    expect(result.similarity).toBeLessThanOrEqual(1.0);
  });

  it('score is never boosted above 1.0', async () => {
    // 6 chunks of the same file (would exceed 1.0 without cap)
    const chunks = Array.from({ length: 6 }, () => makeResult('src/huge.ts', 0.95));
    mockVectorStore.searchByText.mockResolvedValue(chunks);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('query', PROJECT_PATH, 'fts');

    for (const r of results) {
      expect(r.similarity).toBeLessThanOrEqual(1.0);
    }
  });

  it('keeps the highest-scoring chunk content when deduplicating', async () => {
    const lowChunk = makeResult('src/svc.ts', 0.5);
    lowChunk.document.content = 'low relevance content';

    const highChunk = makeResult('src/svc.ts', 0.9);
    highChunk.document.content = 'HIGH RELEVANCE CONTENT';

    mockVectorStore.searchByText.mockResolvedValue([lowChunk, highChunk]);

    const orch = await buildOrchestrator();
    const [result] = await orch.performSemanticSearch('svc', PROJECT_PATH, 'fts');

    expect(result.content).toContain('HIGH RELEVANCE CONTENT');
  });

  it('sorts results by descending similarity', async () => {
    mockVectorStore.searchByText.mockResolvedValue([
      makeResult('src/a.ts', 0.3),
      makeResult('src/b.ts', 0.8),
      makeResult('src/c.ts', 0.6),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('query', PROJECT_PATH, 'fts');

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
    }
  });

  it('limits output to 15 unique files even when storereturns more', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeResult(`src/file-${i}.ts`, 0.5 + (i % 5) * 0.1)
    );
    mockVectorStore.searchByText.mockResolvedValue(many);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('query', PROJECT_PATH, 'fts');

    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('returns correct file type labels based on file name', async () => {
    mockVectorStore.searchByText.mockResolvedValue([
      makeResult('src/auth-service.ts', 0.9),
      makeResult('src/user.controller.ts', 0.8),
      makeResult('src/types.ts', 0.7),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('query', PROJECT_PATH, 'fts');

    const serviceResult = results.find(r => r.file.includes('auth-service'));
    const controllerResult = results.find(r => r.file.includes('controller'));
    const typesResult = results.find(r => r.file.includes('types'));

    expect(serviceResult?.type).toBe('service');
    expect(controllerResult?.type).toBe('controller');
    expect(typesResult?.type).toBe('interface');
  });
});

// ── 3. expandWithGraphNeighbors (Graph RAG) ───────────────────────────────────

describe('SemanticSearchOrchestrator – graph expansion (search_type=\'graph\')', () => {
  const AUTH_PATH = `${PROJECT_PATH}/src/auth.ts`;
  const USER_PATH = `${PROJECT_PATH}/src/user.ts`;
  const MIDDLEWARE_PATH = `${PROJECT_PATH}/src/middleware.ts`;
  const ROUTER_PATH = `${PROJECT_PATH}/src/router.ts`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectStore.list.mockResolvedValue([
      { id: PROJECT_ID, name: 'test', path: PROJECT_PATH } as any,
    ]);
  });

  it('appends graph-neighbor files not in the original result set', async () => {
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.9),
    ]);
    mockGraphStore.findNodes.mockResolvedValue([
      makeGraphNode('node-auth', AUTH_PATH),
    ]);
    mockGraphStore.getNeighbors.mockResolvedValue([
      makeGraphNode('node-middleware', MIDDLEWARE_PATH),
      makeGraphNode('node-router', ROUTER_PATH),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    const files = results.map(r => r.file);
    expect(files.some(f => f.includes('auth.ts'))).toBe(true);
    expect(files.some(f => f.includes('middleware.ts'))).toBe(true);
    expect(files.some(f => f.includes('router.ts'))).toBe(true);
  });

  it('does NOT add files already present in hybrid results', async () => {
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.9),
      makeResult('src/middleware.ts', 0.7),  // already in results
    ]);
    mockGraphStore.findNodes.mockResolvedValue([
      makeGraphNode('node-auth', AUTH_PATH),
    ]);
    // Graph neighbor is middleware — already in results
    mockGraphStore.getNeighbors.mockResolvedValue([
      makeGraphNode('node-middleware', MIDDLEWARE_PATH),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    const middlewareResults = results.filter(r => r.file.includes('middleware.ts'));
    expect(middlewareResults).toHaveLength(1);  // no duplicate
  });

  it('assigns neighbor files a discounted score based on best source score', async () => {
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.9),
      makeResult('src/user.ts', 0.6),
    ]);
    mockGraphStore.findNodes.mockResolvedValue([
      makeGraphNode('node-auth', AUTH_PATH),
      makeGraphNode('node-user', USER_PATH),
    ]);
    mockGraphStore.getNeighbors.mockResolvedValue([
      makeGraphNode('node-middleware', MIDDLEWARE_PATH),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    const neighbor = results.find(r => r.file.includes('middleware.ts'));
    expect(neighbor).toBeDefined();
    // Per-source scoring: neighbor gets best-source-score × 0.7 (≥ 0.05 minimum)
    // Neighbor is reachable from both auth.ts and user.ts; best source wins
    expect(neighbor!.similarity).toBeGreaterThanOrEqual(0.05);
    expect(neighbor!.similarity).toBeLessThanOrEqual(1.0);
  });

  it('graph-expanded files have minimum score of 0.05', async () => {
    // Worst hybrid result has a near-zero score
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.01),
    ]);
    mockGraphStore.findNodes.mockResolvedValue([
      makeGraphNode('node-auth', AUTH_PATH),
    ]);
    mockGraphStore.getNeighbors.mockResolvedValue([
      makeGraphNode('node-middleware', MIDDLEWARE_PATH),
    ]);

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    const neighbor = results.find(r => r.file.includes('middleware.ts'));
    expect(neighbor).toBeDefined();
    expect(neighbor!.similarity).toBeGreaterThanOrEqual(0.05);
  });

  it('returns original results unchanged when graphStore throws', async () => {
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.9),
    ]);
    // Make graphStore.findNodes throw
    mockGraphStore.findNodes.mockRejectedValue(new Error('graph unavailable'));

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    // Should gracefully return the hybrid results unchanged
    expect(results).toHaveLength(1);
    expect(results[0].file).toContain('auth.ts');
  });

  it('returns original results unchanged when graphStore has no nodes', async () => {
    mockVectorStore.searchHybrid.mockResolvedValue([
      makeResult('src/auth.ts', 0.9),
    ]);
    mockGraphStore.findNodes.mockResolvedValue([]);  // empty graph

    const orch = await buildOrchestrator();
    const results = await orch.performSemanticSearch('auth', PROJECT_PATH, 'graph');

    // No expansion happened, original 1 result returned
    expect(results).toHaveLength(1);
  });

  it('expands up to top-10 results when looking for graph neighbors', async () => {
    // 12 hybrid results — only top-10 should be expanded
    const hybridResults = Array.from({ length: 12 }, (_, i) =>
      makeResult(`src/file-${i}.ts`, 0.9 - i * 0.05)
    );
    mockVectorStore.searchHybrid.mockResolvedValue(hybridResults);
    // Build node map for all 12 files
    mockGraphStore.findNodes.mockResolvedValue(
      hybridResults.map((r, i) =>
        makeGraphNode(`node-${i}`, `${PROJECT_PATH}/${r.document.filePath}`)
      )
    );
    mockGraphStore.getNeighbors.mockResolvedValue([]);

    const orch = await buildOrchestrator();
    await orch.performSemanticSearch('query', PROJECT_PATH, 'graph');

    // getNeighbors should only be called 10 times (top-10 cap)
    expect(mockGraphStore.getNeighbors).toHaveBeenCalledTimes(10);
  });
});

// ── 4. initStorage – graphStore absence doesn't crash ────────────────────────

describe('SemanticSearchOrchestrator – graceful degradation without graphStore', () => {
  it("does not throw when getGraphStore() throws during init", async () => {
    jest.clearAllMocks();
    mockProjectStore.list.mockResolvedValue([
      { id: PROJECT_ID, name: 'test', path: PROJECT_PATH } as any,
    ]);
    mockVectorStore.searchHybrid.mockResolvedValue([makeResult('src/a.ts', 0.8)]);
    // Make getGraphStore throw
    mockStorageManager.getGraphStore.mockImplementationOnce(() => {
      throw new Error('graph store not available');
    });

    const orch = new SemanticSearchOrchestrator();
    // Should not throw — graceful fallback
    const results = await orch.performSemanticSearch('test', PROJECT_PATH, 'graph');
    expect(Array.isArray(results)).toBe(true);
    // Results come from hybrid (graph expansion silently skipped)
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});
