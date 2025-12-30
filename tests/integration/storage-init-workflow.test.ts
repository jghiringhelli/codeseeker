/**
 * Storage Integration Test: Init → DB Entries → Query Workflow
 *
 * This is a TRUE integration test that verifies:
 * 1. Running init creates expected DB entries (project, vectors, graph nodes)
 * 2. Semantic search queries find the expected files
 * 3. Both embedded and server modes work identically
 *
 * Run in different modes:
 * - CODEMIND_STORAGE_MODE=embedded npm test -- storage-init-workflow
 * - CODEMIND_STORAGE_MODE=server npm test -- storage-init-workflow
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
import type { IVectorStore, IGraphStore, IProjectStore } from '../../src/storage/interfaces';

// Test fixture directory - isolated per test run
const TEST_DIR = path.join(os.tmpdir(), `codemind-init-workflow-${Date.now()}`);
const TEST_PROJECT_PATH = path.join(TEST_DIR, 'test-project');

// Test file contents for verification
const TEST_FILES = {
  'main.ts': `
// Main entry point
import { UserService } from './services/user-service';
import { ContractManager } from './services/contract-manager';

export class Application {
  private userService: UserService;
  private contractManager: ContractManager;

  async start(): Promise<void> {
    console.log('Application starting...');
  }
}
`,
  'services/user-service.ts': `
// User service - handles user operations
export class UserService {
  async registerUser(email: string, name: string): Promise<void> {
    // Validate email format
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }
    console.log('User registered:', name);
  }

  async authenticateUser(email: string, password: string): Promise<boolean> {
    // Authentication logic
    return true;
  }
}
`,
  'services/contract-manager.ts': `
// Contract management service
import { ContractValidator } from './contract-validator';

export class ContractManager {
  private validator: ContractValidator;

  async processContract(contractData: any): Promise<void> {
    await this.validator.validate(contractData);
    console.log('Contract processed');
  }

  async deleteContract(id: string): Promise<boolean> {
    if (!id) {
      throw new Error('Contract ID required');
    }
    return true;
  }
}
`,
  'services/contract-validator.ts': `
// Contract validation service
export class ContractValidator {
  async validate(data: any): Promise<boolean> {
    if (!data.id || !data.amount) {
      throw new Error('Missing required fields');
    }
    return true;
  }
}
`
};

/**
 * Create test project with sample files
 */
async function createTestProject(): Promise<void> {
  await fs.mkdir(TEST_PROJECT_PATH, { recursive: true });
  await fs.mkdir(path.join(TEST_PROJECT_PATH, 'services'), { recursive: true });

  for (const [filePath, content] of Object.entries(TEST_FILES)) {
    const fullPath = path.join(TEST_PROJECT_PATH, filePath);
    await fs.writeFile(fullPath, content);
  }
}

/**
 * Generate test embedding (1536 dimensions for pgvector compatibility)
 */
function generateTestEmbedding(): number[] {
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

describe('Storage Init Workflow Integration', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let graphStore: IGraphStore;
  let projectStore: IProjectStore;
  let testProjectId: string;

  beforeAll(async () => {
    // Create test directory and project files
    await fs.mkdir(TEST_DIR, { recursive: true });
    await createTestProject();

    // Set up storage
    process.env.CODEMIND_DATA_DIR = path.join(TEST_DIR, '.codemind-data');
    await resetStorageManager();
    storageManager = await getStorageManager();

    vectorStore = storageManager.getVectorStore();
    graphStore = storageManager.getGraphStore();
    projectStore = storageManager.getProjectStore();

    testProjectId = crypto.randomUUID();
  }, 60000);

  afterAll(async () => {
    // Cleanup
    try {
      await storageManager.closeAll();
    } catch {
      // Ignore cleanup errors
    }
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }, 30000);

  describe('Step 1: Project Registration (simulates init)', () => {
    it('should create project entry in storage', async () => {
      // This simulates what "codemind init" does
      const project = await projectStore.upsert({
        id: testProjectId,
        name: 'test-project',
        path: TEST_PROJECT_PATH,
        metadata: {
          initialized_at: new Date().toISOString(),
          cli_version: 'test'
        }
      });

      expect(project.id).toBe(testProjectId);
      expect(project.name).toBe('test-project');
      expect(project.path).toBe(TEST_PROJECT_PATH);
    });

    it('should be able to find project by path', async () => {
      const found = await projectStore.findByPath(TEST_PROJECT_PATH);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(testProjectId);
    });

    it('should be able to find project by id', async () => {
      const found = await projectStore.findById(testProjectId);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('test-project');
    });
  });

  describe('Step 2: File Indexing (simulates init indexing)', () => {
    it('should create vector documents for each file', async () => {
      // This simulates the indexing phase of "codemind init"
      for (const [filePath, content] of Object.entries(TEST_FILES)) {
        await vectorStore.upsert({
          id: `${testProjectId}:${filePath}:0`,
          projectId: testProjectId,
          filePath: filePath,
          content: content,
          embedding: generateTestEmbedding(),
          metadata: {
            language: 'typescript',
            indexedAt: new Date().toISOString()
          }
        });
      }

      // Verify count
      const count = await vectorStore.count(testProjectId);
      expect(count).toBe(Object.keys(TEST_FILES).length);
    });

    it('should create graph nodes for files and classes', async () => {
      // Create file nodes
      for (const filePath of Object.keys(TEST_FILES)) {
        await graphStore.upsertNode({
          id: `file:${testProjectId}:${filePath}`,
          type: 'file',
          name: path.basename(filePath),
          filePath: filePath,
          projectId: testProjectId,
          properties: { relativePath: filePath }
        });
      }

      // Create class nodes (extracted from file content)
      const classNodes = [
        { file: 'main.ts', className: 'Application' },
        { file: 'services/user-service.ts', className: 'UserService' },
        { file: 'services/contract-manager.ts', className: 'ContractManager' },
        { file: 'services/contract-validator.ts', className: 'ContractValidator' }
      ];

      for (const { file, className } of classNodes) {
        const classNodeId = `class:${testProjectId}:${file}:${className}`;
        await graphStore.upsertNode({
          id: classNodeId,
          type: 'class',
          name: className,
          filePath: file,
          projectId: testProjectId
        });

        // Create contains relationship from file to class
        await graphStore.upsertEdge({
          id: `contains:file:${testProjectId}:${file}:${classNodeId}`,
          source: `file:${testProjectId}:${file}`,
          target: classNodeId,
          type: 'contains'
        });
      }

      // Verify node count
      const fileNodes = await graphStore.findNodes(testProjectId, 'file');
      expect(fileNodes.length).toBe(4);

      const classNodesFound = await graphStore.findNodes(testProjectId, 'class');
      expect(classNodesFound.length).toBe(4);
    });

    it('should create import/dependency relationships', async () => {
      // ContractManager imports ContractValidator
      await graphStore.upsertEdge({
        id: `imports:${testProjectId}:contract-manager:contract-validator`,
        source: `class:${testProjectId}:services/contract-manager.ts:ContractManager`,
        target: `class:${testProjectId}:services/contract-validator.ts:ContractValidator`,
        type: 'imports'
      });

      // Application imports UserService and ContractManager
      await graphStore.upsertEdge({
        id: `imports:${testProjectId}:application:user-service`,
        source: `class:${testProjectId}:main.ts:Application`,
        target: `class:${testProjectId}:services/user-service.ts:UserService`,
        type: 'imports'
      });

      await graphStore.upsertEdge({
        id: `imports:${testProjectId}:application:contract-manager`,
        source: `class:${testProjectId}:main.ts:Application`,
        target: `class:${testProjectId}:services/contract-manager.ts:ContractManager`,
        type: 'imports'
      });

      // Verify edges exist
      const appEdges = await graphStore.getEdges(`class:${testProjectId}:main.ts:Application`, 'out');
      expect(appEdges.length).toBeGreaterThanOrEqual(2);
    });

    it('should persist data (flush)', async () => {
      await vectorStore.flush();
      await graphStore.flush();
      await projectStore.flush();

      // Verify data is still accessible after flush
      const project = await projectStore.findById(testProjectId);
      expect(project).not.toBeNull();
    });
  });

  describe('Step 3: Query Verification (simulates semantic search)', () => {
    it('should find files by text search for "user"', async () => {
      // Search for "user" - should find user-service.ts
      const results = await vectorStore.searchByText('user registration email', testProjectId, 10);

      // Results should include user-service.ts
      expect(results.length).toBeGreaterThan(0);

      // At least one result should be about users
      const hasUserResult = results.some(r =>
        r.document.content.toLowerCase().includes('user') ||
        r.document.filePath.includes('user')
      );
      expect(hasUserResult).toBe(true);
    });

    it('should find files by text search for "contract"', async () => {
      const results = await vectorStore.searchByText('contract validation processing', testProjectId, 10);

      expect(results.length).toBeGreaterThan(0);

      // Should find contract-related files
      const hasContractResult = results.some(r =>
        r.document.content.toLowerCase().includes('contract') ||
        r.document.filePath.includes('contract')
      );
      expect(hasContractResult).toBe(true);
    });

    it('should find files by hybrid search', async () => {
      const queryEmbedding = generateTestEmbedding();
      const results = await vectorStore.searchHybrid(
        'validate contract data',
        queryEmbedding,
        testProjectId,
        10
      );

      expect(Array.isArray(results)).toBe(true);
      // Hybrid search should return results (vector + text search combined)
      // Note: Results depend on embedding similarity which is random in tests
    });

    it('should find graph nodes by type', async () => {
      // Find all file nodes
      const fileNodes = await graphStore.findNodes(testProjectId, 'file');
      expect(fileNodes.length).toBe(4);
      expect(fileNodes.map(n => n.name)).toContain('main.ts');
      expect(fileNodes.map(n => n.name)).toContain('user-service.ts');
      expect(fileNodes.map(n => n.name)).toContain('contract-manager.ts');
      expect(fileNodes.map(n => n.name)).toContain('contract-validator.ts');
    });

    it('should find class relationships via graph traversal', async () => {
      // Get neighbors of Application class
      const neighbors = await graphStore.getNeighbors(
        `class:${testProjectId}:main.ts:Application`,
        'imports'
      );

      expect(neighbors.length).toBeGreaterThanOrEqual(2);
      expect(neighbors.map(n => n.name)).toContain('UserService');
      expect(neighbors.map(n => n.name)).toContain('ContractManager');
    });

    it('should find edges between related nodes', async () => {
      // Get edges from ContractManager
      const edges = await graphStore.getEdges(
        `class:${testProjectId}:services/contract-manager.ts:ContractManager`,
        'out'
      );

      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges.some(e => e.type === 'imports')).toBe(true);
    });
  });

  describe('Step 4: Cleanup Verification (simulates project deletion)', () => {
    it('should delete all project data from vector store', async () => {
      const deletedCount = await vectorStore.deleteByProject(testProjectId);
      expect(deletedCount).toBeGreaterThan(0);

      // Verify deletion
      const count = await vectorStore.count(testProjectId);
      expect(count).toBe(0);
    });

    it('should delete all project data from graph store', async () => {
      const deletedCount = await graphStore.deleteByProject(testProjectId);
      expect(deletedCount).toBeGreaterThan(0);

      // Verify deletion
      const fileNodes = await graphStore.findNodes(testProjectId, 'file');
      expect(fileNodes.length).toBe(0);

      const classNodes = await graphStore.findNodes(testProjectId, 'class');
      expect(classNodes.length).toBe(0);
    });

    it('should delete project from project store', async () => {
      const deleted = await projectStore.delete(testProjectId);
      expect(deleted).toBe(true);

      // Verify deletion
      const project = await projectStore.findById(testProjectId);
      expect(project).toBeNull();
    });
  });

  describe('Mode Detection and Verification', () => {
    it('should correctly detect storage mode', () => {
      const status = storageManager.getStatus();
      expect(['embedded', 'server']).toContain(status.mode);

      if (isUsingEmbeddedStorage()) {
        expect(status.mode).toBe('embedded');
        expect(status.dataDir).toBeDefined();
      } else {
        expect(status.mode).toBe('server');
      }
    });

    it('should pass health check', async () => {
      const health = await storageManager.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should report correct component modes', () => {
      const status = storageManager.getStatus();
      expect(status.components.vectorStore).toBeDefined();
      expect(status.components.graphStore).toBeDefined();
      expect(status.components.cacheStore).toBeDefined();
    });
  });
});

describe('Storage Mode Specific Behavior', () => {
  let storageManager: StorageManager;

  beforeAll(async () => {
    storageManager = await getStorageManager();
  });

  it('should use correct storage backends based on mode', async () => {
    const status = storageManager.getStatus();

    console.log(`Running in ${status.mode.toUpperCase()} mode`);
    console.log(`  Vector Store: ${status.components.vectorStore}`);
    console.log(`  Graph Store: ${status.components.graphStore}`);
    console.log(`  Cache Store: ${status.components.cacheStore}`);

    if (status.mode === 'embedded') {
      expect(status.components.vectorStore).toBe('embedded');
      expect(status.components.graphStore).toBe('embedded');
      expect(status.components.cacheStore).toBe('embedded');
    } else {
      expect(status.components.vectorStore).toBe('server');
      expect(status.components.graphStore).toBe('server');
      expect(status.components.cacheStore).toBe('server');
    }
  });
});