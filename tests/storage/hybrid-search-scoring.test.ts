/**
 * Hybrid Search Scoring Tests
 *
 * Tests the RRF (Reciprocal Rank Fusion) scoring mechanism:
 * 1. FTS score normalization (dynamic max-based normalization)
 * 2. Match source tracking (semantic, text, path combinations)
 * 3. Score capping (never exceeds 1.0)
 * 4. Debug info presence
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  getStorageManager,
  resetStorageManager,
  StorageManager
} from '../../src/storage';
import type {
  IVectorStore,
  IProjectStore,
  VectorDocument
} from '../../src/storage/interfaces';

// Test data directory
const TEST_DATA_DIR = path.join(os.tmpdir(), 'codeseeker-scoring-test-' + Date.now());

function generateUUID(): string {
  return crypto.randomUUID();
}

// Generate 384-dim embedding (MiniLM-L6-v2 default) for embedded mode
function generateTestEmbedding(seed = 0): number[] {
  const dim = 384;
  const embedding = [];
  for (let i = 0; i < dim; i++) {
    // Deterministic pseudo-random based on seed
    embedding.push(Math.sin(seed * 100 + i) * 0.5);
  }
  return embedding;
}

describe('Hybrid Search Scoring', () => {
  let storageManager: StorageManager;
  let vectorStore: IVectorStore;
  let projectStore: IProjectStore;
  const testProjectId = generateUUID();

  beforeAll(async () => {
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await resetStorageManager();
    process.env.CODESEEKER_DATA_DIR = TEST_DATA_DIR;
    process.env.CODESEEKER_STORAGE_MODE = 'embedded';

    storageManager = await getStorageManager();
    vectorStore = storageManager.getVectorStore();
    projectStore = storageManager.getProjectStore();

    // Create test project
    await projectStore.upsert({
      id: testProjectId,
      name: 'Scoring Test Project',
      path: '/test/scoring'
    });
  });

  afterAll(async () => {
    try {
      await vectorStore.deleteByProject(testProjectId);
      await projectStore.delete(testProjectId);
      await storageManager.closeAll();
    } catch { /* ignore */ }

    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('Score Normalization', () => {
    beforeEach(async () => {
      // Clean up before each test
      await vectorStore.deleteByProject(testProjectId);
    });

    test('should cap all scores at 1.0', async () => {
      // Add documents with high-scoring text content
      const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [];
      for (let i = 0; i < 5; i++) {
        docs.push({
          id: `${testProjectId}:score-test-${i}.ts:0`,
          projectId: testProjectId,
          filePath: `score-test-${i}.ts`,
          content: `function searchableFunction${i}() { return searchable; } // searchable keyword repeated`,
          embedding: generateTestEmbedding(i),
          metadata: {}
        });
      }

      await vectorStore.upsertMany(docs);

      // Search for a term that should match multiple documents
      const results = await vectorStore.searchHybrid(
        'searchable function',
        generateTestEmbedding(0),
        testProjectId,
        10
      );

      // All scores should be <= 1.0
      for (const result of results) {
        expect(result.score).toBeLessThanOrEqual(1.0);
        expect(result.score).toBeGreaterThanOrEqual(0);
      }
    });

    test('should normalize FTS scores dynamically', async () => {
      // Add documents with varying text relevance
      const docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>> = [
        {
          id: `${testProjectId}:high-relevance.ts:0`,
          projectId: testProjectId,
          filePath: 'high-relevance.ts',
          // Many occurrences of keyword = high BM25 score
          content: 'authentication auth login auth authenticate auth session auth',
          embedding: generateTestEmbedding(100),
          metadata: {}
        },
        {
          id: `${testProjectId}:medium-relevance.ts:0`,
          projectId: testProjectId,
          filePath: 'medium-relevance.ts',
          content: 'function doAuth() { // auth logic }',
          embedding: generateTestEmbedding(101),
          metadata: {}
        },
        {
          id: `${testProjectId}:low-relevance.ts:0`,
          projectId: testProjectId,
          filePath: 'low-relevance.ts',
          content: 'function unrelated() { return 42; }',
          embedding: generateTestEmbedding(102),
          metadata: {}
        }
      ];

      await vectorStore.upsertMany(docs);

      // Use a query that should produce varying FTS scores
      const results = await vectorStore.searchHybrid(
        'auth',
        generateTestEmbedding(999), // Unrelated embedding
        testProjectId,
        10
      );

      // Should have at least some results
      expect(results.length).toBeGreaterThan(0);

      // Highest score should be significant but capped
      if (results.length > 0) {
        expect(results[0].score).toBeLessThanOrEqual(1.0);
        expect(results[0].score).toBeGreaterThan(0);
      }
    });
  });

  describe('Match Source Tracking', () => {
    beforeEach(async () => {
      await vectorStore.deleteByProject(testProjectId);
    });

    test('should include debug info with match source', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:debug-test.ts:0`,
        projectId: testProjectId,
        filePath: 'debug-test.ts',
        content: 'function testFunction() { return "test"; }',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      const results = await vectorStore.searchHybrid(
        'test function',
        generateTestEmbedding(0),
        testProjectId,
        10
      );

      // Should have results with debug info
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result.debug).toBeDefined();
      expect(result.debug?.matchSource).toBeDefined();
      expect(typeof result.debug?.vectorScore).toBe('number');
      expect(typeof result.debug?.textScore).toBe('number');
      expect(typeof result.debug?.pathMatch).toBe('boolean');
    });

    test('should track path match bonus', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:authentication-service.ts:0`,
        projectId: testProjectId,
        filePath: 'authentication-service.ts',
        content: 'export class Service { login() {} }',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      // Query that matches file path
      const results = await vectorStore.searchHybrid(
        'authentication',
        generateTestEmbedding(0),
        testProjectId,
        10
      );

      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result.debug?.pathMatch).toBe(true);
      expect(result.debug?.matchSource).toContain('path');
    });

    test('should indicate semantic match source', async () => {
      // Create doc with embedding that will match semantically
      const embedding = generateTestEmbedding(42);
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:semantic-test.ts:0`,
        projectId: testProjectId,
        filePath: 'semantic-test.ts',
        content: 'complex algorithm implementation',
        embedding,
        metadata: {}
      };

      await vectorStore.upsert(doc);

      // Search with same embedding (should have high vector score)
      const results = await vectorStore.searchHybrid(
        'unrelated query text',
        embedding, // Same embedding = high cosine similarity
        testProjectId,
        10
      );

      expect(results.length).toBeGreaterThan(0);

      // Should have vector score
      const result = results[0];
      expect(result.debug?.vectorScore).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Match Types', () => {
    beforeEach(async () => {
      await vectorStore.deleteByProject(testProjectId);
    });

    test('should return hybrid match type for combined results', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:hybrid-test.ts:0`,
        projectId: testProjectId,
        filePath: 'hybrid-test.ts',
        content: 'function hybridSearch() { return results; }',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      const results = await vectorStore.searchHybrid(
        'hybrid search results',
        generateTestEmbedding(0),
        testProjectId,
        10
      );

      expect(results.length).toBeGreaterThan(0);

      // All results from hybrid search should have hybrid match type
      for (const result of results) {
        expect(result.matchType).toBe('hybrid');
      }
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await vectorStore.deleteByProject(testProjectId);
    });

    test('should handle empty embedding gracefully', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:empty-embed-test.ts:0`,
        projectId: testProjectId,
        filePath: 'empty-embed-test.ts',
        content: 'function test() {}',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      // Search with empty embedding (should fallback to text-only)
      const results = await vectorStore.searchHybrid(
        'function test',
        [], // Empty embedding
        testProjectId,
        10
      );

      // Should still return results from FTS
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle zero-magnitude embedding', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:zero-embed-test.ts:0`,
        projectId: testProjectId,
        filePath: 'zero-embed-test.ts',
        content: 'function test() { return zero; }',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      // Search with zero embedding (should fallback to text-only)
      const zeroEmbedding = new Array(384).fill(0);
      const results = await vectorStore.searchHybrid(
        'function test zero',
        zeroEmbedding,
        testProjectId,
        10
      );

      // Should still return results from FTS
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle query with no matches', async () => {
      const doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'> = {
        id: `${testProjectId}:no-match-test.ts:0`,
        projectId: testProjectId,
        filePath: 'no-match-test.ts',
        content: 'function completely() { unrelated(); }',
        embedding: generateTestEmbedding(0),
        metadata: {}
      };

      await vectorStore.upsert(doc);

      // Search for something completely unrelated
      const results = await vectorStore.searchHybrid(
        'xyzabc123nonexistent',
        generateTestEmbedding(9999),
        testProjectId,
        10
      );

      expect(Array.isArray(results)).toBe(true);
      // May or may not have results depending on vector similarity threshold
    });
  });
});
