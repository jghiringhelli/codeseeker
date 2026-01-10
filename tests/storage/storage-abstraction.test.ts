/**
 * Storage Abstraction Tests
 *
 * Tests the storage interface abstraction layer to ensure:
 * 1. Both embedded and server modes work correctly
 * 2. Interfaces are properly implemented
 * 3. Same operations work identically in both modes
 *
 * Run in different modes:
 * - CODESEEKER_STORAGE_MODE=embedded npm test -- storage-abstraction
 * - CODESEEKER_STORAGE_MODE=server npm test -- storage-abstraction
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  getStorageManager,
  resetStorageManager,
  isUsingEmbeddedStorage,
  StorageManager
} from '../../src/storage';
import type {
  IVectorStore,
  IGraphStore,
  ICacheStore,
  IProjectStore,
  GraphNode,
  GraphEdge,
  VectorDocument
} from '../../src/storage/interfaces';

// Test data directory - use temp folder for isolation
const TEST_DATA_DIR = path.join(os.tmpdir(), 'codeseeker-storage-test-' + Date.now());

// Generate UUID for tests (works with both embedded and server modes)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Generate test embedding with 1536 dimensions (OpenAI-compatible)
// PostgreSQL's pgvector is configured for 1536 dimensions
function generateTestEmbedding(): number[] {
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

describe('Storage Abstraction Layer', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let graphStore: IGraphStore;
  let cacheStore: ICacheStore;
  let projectStore: IProjectStore;
  // Use UUID format for compatibility with both embedded and server modes
  const testProjectId = generateUUID();

  beforeAll(async () => {
    // Create test data directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Reset any existing storage manager
    await resetStorageManager();

    // Set environment for embedded mode testing (default)
    process.env.CODESEEKER_DATA_DIR = TEST_DATA_DIR;

    // Initialize storage manager
    storageManager = await getStorageManager();
    vectorStore = storageManager.getVectorStore();
    graphStore = storageManager.getGraphStore();
    cacheStore = storageManager.getCacheStore();
    projectStore = storageManager.getProjectStore();
  });

  afterAll(async () => {
    // Cleanup - closeAll handles everything, resetStorageManager is not needed
    // since closeAll already closes the connections
    try {
      await storageManager.closeAll();
    } catch {
      // Ignore cleanup errors
    }

    // Remove test data directory
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('StorageManager', () => {
    test('should initialize successfully', () => {
      expect(storageManager).toBeDefined();
    });

    test('should provide all store interfaces', () => {
      expect(vectorStore).toBeDefined();
      expect(graphStore).toBeDefined();
      expect(cacheStore).toBeDefined();
      expect(projectStore).toBeDefined();
    });

    test('should report storage mode', () => {
      const status = storageManager.getStatus();
      expect(status.mode).toBeDefined();
      expect(['embedded', 'server']).toContain(status.mode);
    });

    test('should report component modes', () => {
      const status = storageManager.getStatus();
      expect(status.components).toBeDefined();
      expect(status.components.vectorStore).toBeDefined();
      expect(status.components.graphStore).toBeDefined();
      expect(status.components.cacheStore).toBeDefined();
    });

    test('should pass health check', async () => {
      const health = await storageManager.healthCheck();
      expect(health.healthy).toBe(true);
    });
  });

  describe('IProjectStore', () => {
    // Use unique path for each test run to avoid conflicts with existing data
    const uniquePath = `/test/project/path-${Date.now()}`;
    const testProject = {
      id: testProjectId,
      name: 'Test Project',
      path: uniquePath
    };

    test('should create a project', async () => {
      await projectStore.upsert(testProject);
      const retrieved = await projectStore.findById(testProjectId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Project');
    });

    test('should list projects', async () => {
      const projects = await projectStore.list();
      expect(projects.length).toBeGreaterThan(0);
      expect(projects.some(p => p.id === testProjectId)).toBe(true);
    });

    test('should find project by path', async () => {
      const found = await projectStore.findByPath(uniquePath);
      expect(found).toBeDefined();
      expect(found?.id).toBe(testProjectId);
    });

    test('should update project', async () => {
      await projectStore.upsert({
        ...testProject,
        name: 'Updated Test Project'
      });
      const retrieved = await projectStore.findById(testProjectId);
      expect(retrieved?.name).toBe('Updated Test Project');
    });
  });

  describe('IVectorStore', () => {
    // Generate embeddings once for reuse
    const testEmbedding = generateTestEmbedding();

    test('should upsert a document', async () => {
      const testDocument: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:test-file.ts:0`,
        projectId: testProjectId,
        filePath: 'test-file.ts',
        content: 'function hello() { return "world"; }',
        embedding: testEmbedding,
        metadata: {
          language: 'typescript',
          functions: ['hello']
        }
      };

      await vectorStore.upsert(testDocument);
      // Document stored successfully if no error
      expect(true).toBe(true);
    });

    test('should search by text (hybrid search)', async () => {
      // Add a document first
      await vectorStore.upsert({
        id: `${testProjectId}:search-test.ts:0`,
        projectId: testProjectId,
        filePath: 'search-test.ts',
        content: 'export function searchableFunction() { return "found"; }',
        embedding: testEmbedding,
        metadata: {}
      });

      // Perform hybrid search
      const results = await vectorStore.searchHybrid(
        'searchable function',
        testEmbedding,
        testProjectId,
        10
      );

      expect(Array.isArray(results)).toBe(true);
    });

    test('should delete documents by project', async () => {
      await vectorStore.deleteByProject(testProjectId);
      // Deletion successful if no error
      expect(true).toBe(true);
    });
  });

  describe('IGraphStore', () => {
    const testFileNode: GraphNode = {
      id: `file:${testProjectId}:test-file.ts`,
      type: 'file',
      name: 'test-file.ts',
      filePath: 'test-file.ts',
      projectId: testProjectId,
      properties: { hash: 'abc123' }
    };

    const testClassNode: GraphNode = {
      id: `class:${testProjectId}:TestClass`,
      type: 'class',
      name: 'TestClass',
      filePath: 'test-file.ts',
      projectId: testProjectId
    };

    test('should upsert a node', async () => {
      await graphStore.upsertNode(testFileNode);
      const retrieved = await graphStore.getNode(testFileNode.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-file.ts');
    });

    test('should upsert multiple nodes', async () => {
      await graphStore.upsertNode(testClassNode);
      const fileNode = await graphStore.getNode(testFileNode.id);
      const classNode = await graphStore.getNode(testClassNode.id);
      expect(fileNode).toBeDefined();
      expect(classNode).toBeDefined();
    });

    test('should create an edge between nodes', async () => {
      const testEdge: GraphEdge = {
        id: `edge:${testFileNode.id}:contains:${testClassNode.id}`,
        source: testFileNode.id,
        target: testClassNode.id,
        type: 'contains'
      };

      await graphStore.upsertEdge(testEdge);
      const edges = await graphStore.getEdges(testFileNode.id, 'out');
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some(e => e.target === testClassNode.id)).toBe(true);
    });

    test('should find nodes by project and type', async () => {
      const fileNodes = await graphStore.findNodes(testProjectId, 'file');
      expect(Array.isArray(fileNodes)).toBe(true);
      expect(fileNodes.some(n => n.id === testFileNode.id)).toBe(true);
    });

    test('should delete nodes by project', async () => {
      await graphStore.deleteByProject(testProjectId);
      const fileNode = await graphStore.getNode(testFileNode.id);
      expect(fileNode).toBeNull();
    });
  });

  describe('ICacheStore', () => {
    const testKey = `test:${testProjectId}:key1`;
    const testValue = { data: 'test value', timestamp: Date.now() };

    test('should set a value', async () => {
      await cacheStore.set(testKey, testValue);
      const retrieved = await cacheStore.get<{ data: string; timestamp: number }>(testKey);
      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toBe('test value');
    });

    test('should get a value', async () => {
      const retrieved = await cacheStore.get<{ data: string; timestamp: number }>(testKey);
      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toBe('test value');
    });

    test('should delete a value', async () => {
      await cacheStore.delete(testKey);
      const retrieved = await cacheStore.get(testKey);
      expect(retrieved).toBeNull();
    });

    test('should delete by pattern', async () => {
      // Set multiple keys
      await cacheStore.set(`pattern:${testProjectId}:a`, 'value-a');
      await cacheStore.set(`pattern:${testProjectId}:b`, 'value-b');

      // Delete by pattern
      await cacheStore.deletePattern(`pattern:${testProjectId}:*`);

      const valueA = await cacheStore.get(`pattern:${testProjectId}:a`);
      expect(valueA).toBeNull();
    });
  });

  describe('Cross-Store Integration', () => {
    test('should support complete project workflow', async () => {
      const projectId = generateUUID();
      const integrationPath = `/integration/test-${Date.now()}`;

      // 1. Create project
      await projectStore.upsert({
        id: projectId,
        name: 'Integration Test Project',
        path: integrationPath
      });

      // 2. Add graph nodes
      await graphStore.upsertNode({
        id: `file:${projectId}:main.ts`,
        type: 'file',
        name: 'main.ts',
        filePath: 'main.ts',
        projectId
      });

      // 3. Add vector document (use 1536-dim embedding for pgvector compatibility)
      await vectorStore.upsert({
        id: `${projectId}:main.ts:0`,
        projectId,
        filePath: 'main.ts',
        content: 'export function main() {}',
        embedding: generateTestEmbedding(),
        metadata: {}
      });

      // 4. Cache some data
      await cacheStore.set(`hash:${projectId}:main.ts`, 'abc123');

      // 5. Verify all stores have data
      const project = await projectStore.findById(projectId);
      expect(project).toBeDefined();

      const nodes = await graphStore.findNodes(projectId, 'file');
      expect(nodes.length).toBeGreaterThan(0);

      const hash = await cacheStore.get(`hash:${projectId}:main.ts`);
      expect(hash).toBe('abc123');

      // 6. Cleanup
      await vectorStore.deleteByProject(projectId);
      await graphStore.deleteByProject(projectId);
      await cacheStore.deletePattern(`*:${projectId}:*`);
      await projectStore.delete(projectId);
    });
  });

  describe('Mode Detection', () => {
    test('isUsingEmbeddedStorage returns correct mode', () => {
      const isEmbedded = isUsingEmbeddedStorage();
      const status = storageManager.getStatus();

      if (status.mode === 'embedded') {
        expect(isEmbedded).toBe(true);
      } else {
        expect(isEmbedded).toBe(false);
      }
    });
  });
});

describe('Storage Mode Specific Tests', () => {
  describe('Embedded Mode Features', () => {
    test('should use SQLite for vectors in embedded mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'embedded') {
        expect(status.components.vectorStore).toBe('embedded');
        expect(status.dataDir).toBeDefined();
      }
    });

    test('should use Graphology for graph in embedded mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'embedded') {
        expect(status.components.graphStore).toBe('embedded');
      }
    });

    test('should use LRU-cache in embedded mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'embedded') {
        expect(status.components.cacheStore).toBe('embedded');
      }
    });
  });

  describe('Server Mode Features', () => {
    test('should use PostgreSQL for vectors in server mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'server') {
        expect(status.components.vectorStore).toBe('server');
      }
    });

    test('should use Neo4j for graph in server mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'server') {
        expect(status.components.graphStore).toBe('server');
      }
    });

    test('should use Redis for cache in server mode', async () => {
      const manager = await getStorageManager();
      const status = manager.getStatus();

      if (status.mode === 'server') {
        expect(status.components.cacheStore).toBe('server');
      }
    });
  });
});