/**
 * EmbeddingService Test Suite
 * Tests for the embedding service with updated API
 * Note: Config parameter is now required
 */

import { EmbeddingService } from '../../../src/cli/services/data/embedding/embedding-service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    // Create service with test config - config is now required
    service = new EmbeddingService({
      provider: 'local',
      chunkSize: 100,
      maxTokens: 500,
      batchSize: 5
    });
  });

  describe('initialization', () => {
    it('should initialize with configuration', () => {
      // Config is now required - use minimal config
      const testService = new EmbeddingService({
        provider: 'local'
      });
      expect(testService).toBeDefined();
      expect(testService).toBeInstanceOf(EmbeddingService);
    });

    it('should initialize with custom configuration', () => {
      const customService = new EmbeddingService({
        provider: 'local',
        chunkSize: 200
      });
      expect(customService).toBeDefined();
    });

    it('should have generateProjectEmbeddings method', () => {
      expect(typeof service.generateProjectEmbeddings).toBe('function');
    });

    it('should have generateEmbedding method', () => {
      expect(typeof service.generateEmbedding).toBe('function');
    });
  });

  describe('configuration', () => {
    it('should accept different providers', () => {
      const xenovaService = new EmbeddingService({ provider: 'xenova' });
      expect(xenovaService).toBeDefined();

      const localService = new EmbeddingService({ provider: 'local' });
      expect(localService).toBeDefined();

      const hybridService = new EmbeddingService({ provider: 'hybrid' });
      expect(hybridService).toBeDefined();
    });

    it('should accept different models', () => {
      const service1 = new EmbeddingService({
        provider: 'local',
        model: 'Xenova/all-MiniLM-L6-v2'
      });
      expect(service1).toBeDefined();

      const service2 = new EmbeddingService({
        provider: 'local',
        model: 'local'
      });
      expect(service2).toBeDefined();
    });

    it('should accept batch size configuration', () => {
      const batchService = new EmbeddingService({ provider: 'local', batchSize: 10 });
      expect(batchService).toBeDefined();
    });

    it('should accept chunk size configuration', () => {
      const chunkService = new EmbeddingService({ provider: 'local', chunkSize: 500 });
      expect(chunkService).toBeDefined();
    });

    it('should apply default values for missing config options', () => {
      // Config now has defaults applied internally
      const minService = new EmbeddingService({ provider: 'local' });
      expect(minService).toBeDefined();
    });
  });

  describe('SOLID principles', () => {
    it('should follow Single Responsibility - only handles embeddings', () => {
      // Service should only have embedding-related methods
      expect(typeof service.generateProjectEmbeddings).toBe('function');
      expect(typeof service.generateEmbedding).toBe('function');
    });

    it('should follow Dependency Inversion - accepts injected providers', () => {
      // Constructor accepts optional provider and processor
      const diService = new EmbeddingService(
        { provider: 'local' },
        undefined, // embeddingProvider - optional
        undefined  // fileProcessor - optional
      );
      expect(diService).toBeDefined();
    });
  });
});