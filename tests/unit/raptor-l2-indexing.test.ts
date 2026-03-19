/**
 * RAPTOR L2 Indexing Integration Test
 *
 * Verifies that RaptorIndexingService.generateForProject() actually writes
 * L2 (directory-summary) and L3 (root-summary) nodes to the embedded vector
 * store, using the same storage path as production indexing.
 *
 * This test explains why the RAPTOR config sweep in metrics.test.ts shows
 * flat results: the metrics test inserts raw docs but never calls
 * generateForProject, so no L2 nodes exist.
 *
 * Mutation matrix:
 *   1. MIN_FILES_FOR_L2 guard — removing it makes single-file dirs create nodes
 *   2. L3 creation guard — removing it creates L3 even with < 3 L2 nodes
 *   3. Prefix guard — RAPTOR nodes must have RAPTOR_FILE_PREFIX in filePath
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

import { getStorageManager, resetStorageManager, StorageManager } from '../../src/storage';
import type { IVectorStore, IProjectStore, VectorDocument } from '../../src/storage/interfaces';
import { RaptorIndexingService, RAPTOR_FILE_PREFIX } from '../../src/cli/services/search/raptor-indexing-service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-raptor-integ-${Date.now()}`);
const PROJECT_ROOT = '/fake/project';
const PROJECT_ID = crypto.randomUUID();

/** 384-dim unit vector with a spike at a given dimension band */
function makeEmbedding(band: number): number[] {
  const dim = 384, blockSize = 32;
  const offset = band * blockSize;
  const val = 1 / Math.sqrt(blockSize);
  return Array.from({ length: dim }, (_, i) => (i >= offset && i < offset + blockSize ? val : 0));
}

function makeDoc(relPath: string, band: number): VectorDocument {
  return {
    id: crypto.createHash('md5').update(relPath).digest('hex'),
    projectId: PROJECT_ID,
    filePath: path.join(PROJECT_ROOT, relPath).replace(/\\/g, '/'),
    content: `// content of ${relPath}`,
    embedding: makeEmbedding(band),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('RAPTOR L2 indexing integration', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await resetStorageManager();
    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-raptor');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore    = storageManager.getVectorStore();
    projectStore   = storageManager.getProjectStore();

    await projectStore.upsert({ id: PROJECT_ID, name: 'test-project', path: PROJECT_ROOT });
  }, 60_000);

  afterAll(async () => {
    try { await storageManager.closeAll(); } catch { /* ignore */ }
    try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── Main test ──────────────────────────────────────────────────────────────

  it('generateForProject creates L2 nodes for dirs with ≥2 files and an L3 root node', async () => {
    // Insert docs: 3 dirs, each with 2+ files → should produce 3 L2 nodes + 1 L3 node
    const fileDefs = [
      { rel: 'src/auth/login.ts',          band: 0 },
      { rel: 'src/auth/register.ts',        band: 0 },
      { rel: 'src/services/UserService.ts', band: 1 },
      { rel: 'src/services/EmailService.ts',band: 1 },
      { rel: 'src/utils/helpers.ts',        band: 2 },
      { rel: 'src/utils/logger.ts',         band: 2 },
    ];
    const docs = fileDefs.map(({ rel, band }) => makeDoc(rel, band));
    await vectorStore.upsertMany(docs);

    const indexedFiles = fileDefs.map(({ rel }) =>
      path.join(PROJECT_ROOT, rel).replace(/\\/g, '/')
    );

    const service = new RaptorIndexingService();
    const result = await service.generateForProject(
      PROJECT_ROOT, PROJECT_ID, indexedFiles, vectorStore
    );

    // 3 dirs × 2 files each → 3 L2 nodes
    expect(result.l2NodesCreated).toBe(3);
    // 3 L2 nodes >= MIN_L2_FOR_L3 (3) → 1 L3 root created
    expect(result.l3Created).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('L2 nodes are stored in the vector store with RAPTOR_FILE_PREFIX paths', async () => {
    // Search for all docs in this project — RAPTOR nodes should be present
    // getFileEmbeddings only returns real files; search by vector should also return RAPTOR nodes
    const anyVector = makeEmbedding(0);
    const results = await vectorStore.searchByVector(anyVector, PROJECT_ID, 20);

    const raptorNodes = results.filter(r => r.document.filePath.startsWith(RAPTOR_FILE_PREFIX));
    const realNodes   = results.filter(r => !r.document.filePath.startsWith(RAPTOR_FILE_PREFIX));

    // Should have 3 L2 + 1 L3 = 4 RAPTOR nodes
    expect(raptorNodes.length).toBe(4);
    // 6 real file docs still present
    expect(realNodes.length).toBe(6);
  });

  it('L2 node metadata contains raptorLevel=2, raptorDir, and childFiles', async () => {
    const anyVector = makeEmbedding(0);
    const results = await vectorStore.searchByVector(anyVector, PROJECT_ID, 20);
    const l2Nodes = results.filter(r => {
      if (!r.document.filePath.startsWith(RAPTOR_FILE_PREFIX)) return false;
      const meta = r.document.metadata as any;
      return meta?.raptorLevel === 2;
    });

    expect(l2Nodes.length).toBe(3);
    for (const node of l2Nodes) {
      const meta = node.document.metadata as any;
      expect(meta.raptorDir).toBeTruthy();
      expect(Array.isArray(meta.childFiles)).toBe(true);
      expect((meta.childFiles as string[]).length).toBe(2);
    }
  });

  it('L3 root node has raptorLevel=3 and l2Count=3', async () => {
    const anyVector = makeEmbedding(0);
    const results = await vectorStore.searchByVector(anyVector, PROJECT_ID, 20);
    const l3Nodes = results.filter(r => {
      if (!r.document.filePath.startsWith(RAPTOR_FILE_PREFIX)) return false;
      const meta = r.document.metadata as any;
      return meta?.raptorLevel === 3;
    });

    expect(l3Nodes.length).toBe(1);
    const meta = l3Nodes[0].document.metadata as any;
    expect(meta.l2Count).toBe(3);
    expect(l3Nodes[0].document.filePath).toBe(RAPTOR_FILE_PREFIX + '.');
  });

  it('does NOT create an L2 node for a directory with only 1 file', async () => {
    // Insert a lone file in a brand-new dir
    const lonePid = crypto.randomUUID();
    await projectStore.upsert({ id: lonePid, name: 'lone-project', path: '/fake/lone' });
    const loneDoc = makeDoc('src/alone/orphan.ts', 3);
    loneDoc.projectId = lonePid;
    loneDoc.id = crypto.createHash('md5').update('lone:orphan').digest('hex');
    await vectorStore.upsert(loneDoc);

    const service = new RaptorIndexingService();
    const result = await service.generateForProject(
      '/fake/lone', lonePid, [loneDoc.filePath], vectorStore
    );

    // Only 1 file → no L2 nodes
    expect(result.l2NodesCreated).toBe(0);
    expect(result.l3Created).toBe(false);
  });

  it('generateForProject is idempotent — calling twice produces same node count', async () => {
    const indexedFiles = [
      'src/auth/login.ts', 'src/auth/register.ts',
      'src/services/UserService.ts', 'src/services/EmailService.ts',
      'src/utils/helpers.ts', 'src/utils/logger.ts',
    ].map(r => path.join(PROJECT_ROOT, r).replace(/\\/g, '/'));

    const service = new RaptorIndexingService();
    const r1 = await service.generateForProject(PROJECT_ROOT, PROJECT_ID, indexedFiles, vectorStore);
    const r2 = await service.generateForProject(PROJECT_ROOT, PROJECT_ID, indexedFiles, vectorStore);

    expect(r2.l2NodesCreated).toBe(r1.l2NodesCreated);
    expect(r2.l3Created).toBe(r1.l3Created);
  });
});

// ── Mutation detection ────────────────────────────────────────────────────────
// These verify the guards that the cascade relies on.

describe('RAPTOR L2 — mutation detection', () => {
  // The main suite already covers the "≥2 files" guard by testing the lone-file case.
  // Here we verify the L3 guard separately.

  let storageManager2: StorageManager;
  let vectorStore2: IVectorStore;
  let projectStore2: IProjectStore;
  const pid2 = crypto.randomUUID();
  const TEST_DIR2 = path.join(os.tmpdir(), `codeseeker-raptor-mut-${Date.now()}`);
  const ROOT2 = '/fake/two-dir';

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR2, { recursive: true });
    await resetStorageManager();
    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR2, '.codeseeker-raptor-mut');
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager2 = await getStorageManager();
    vectorStore2    = storageManager2.getVectorStore();
    projectStore2   = storageManager2.getProjectStore();

    await projectStore2.upsert({ id: pid2, name: 'two-dir', path: ROOT2 });
  }, 30_000);

  afterAll(async () => {
    try { await storageManager2.closeAll(); } catch { /* ignore */ }
    try { await fs.rm(TEST_DIR2, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('[mutation: L3 guard] only 2 dirs → L3 must NOT be created', async () => {
    const fileDefs = [
      { rel: 'src/a/file1.ts', band: 0 },
      { rel: 'src/a/file2.ts', band: 0 },
      { rel: 'src/b/file1.ts', band: 1 },
      { rel: 'src/b/file2.ts', band: 1 },
    ];
    const docs = fileDefs.map(({ rel, band }) => {
      const absPath = path.join(ROOT2, rel).replace(/\\/g, '/');
      return {
        id: crypto.createHash('md5').update(`${pid2}:${rel}`).digest('hex'),
        projectId: pid2,
        filePath: absPath,
        content: `// ${rel}`,
        embedding: makeEmbedding(band),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    await vectorStore2.upsertMany(docs);

    const indexedFiles = fileDefs.map(({ rel }) =>
      path.join(ROOT2, rel).replace(/\\/g, '/')
    );

    const service = new RaptorIndexingService();
    const result = await service.generateForProject(ROOT2, pid2, indexedFiles, vectorStore2);

    // 2 L2 nodes (one per dir), but < MIN_L2_FOR_L3 (3) → no L3
    expect(result.l2NodesCreated).toBe(2);
    expect(result.l3Created).toBe(false);
  });
});
