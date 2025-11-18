/**
 * EmbeddingService Test Suite
 * Simplified tests for the embedding service
 */

import { EmbeddingService } from '../../../src/cli/services/data/embedding/embedding-service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    // Create service with test config
    service = new EmbeddingService({
      provider: 'local',
      chunkSize: 100,
      maxTokens: 500,
      batchSize: 5
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new EmbeddingService();
      expect(defaultService).toBeDefined();
      expect(defaultService).toBeInstanceOf(EmbeddingService);
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
        model: 'Xenova/all-MiniLM-L6-v2'
      });
      expect(service1).toBeDefined();

      const service2 = new EmbeddingService({
        model: 'local'
      });
      expect(service2).toBeDefined();
    });

    it('should accept batch size configuration', () => {
      const service = new EmbeddingService({ batchSize: 10 });
      expect(service).toBeDefined();
    });

    it('should accept chunk size configuration', () => {
      const service = new EmbeddingService({ chunkSize: 500 });
      expect(service).toBeDefined();
    });
  });
});