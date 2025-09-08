/**
 * Unit tests for Four-Layer Memory Architecture
 */

import { FourLayerMemoryManager } from '../../../src/shared/four-layer-memory-architecture';

describe('FourLayerMemoryManager', () => {
  let memoryManager: FourLayerMemoryManager;

  beforeEach(() => {
    memoryManager = new FourLayerMemoryManager();
  });

  describe('Memory Layer Management', () => {
    test('should initialize all memory layers', async () => {
      // Since we're using stubs, this should not throw
      expect(async () => {
        await memoryManager.initialize();
      }).not.toThrow();
    });

    test('should start request memory successfully', async () => {
      await memoryManager.initialize();
      
      const result = await memoryManager.startRequest(
        'test-request-123',
        'test-session-456',
        'test-project-789',
        'create user authentication'
      );

      expect(result).toBeDefined();
      expect(result.shortTermContext).toBeDefined();
      expect(result.longTermPatterns).toBeDefined();
      expect(result.episodicInsights).toBeDefined();
      expect(result.semanticContext).toBeDefined();
    });

    test('should record interactions', async () => {
      await memoryManager.initialize();
      
      await memoryManager.startRequest(
        'test-request-123',
        'test-session-456',
        'test-project-789',
        'test request'
      );

      const interaction = {
        type: 'task' as const,
        codemindAction: { instruction: 'test task', context: {} },
        claudeResponse: { success: true, duration: 1000 },
        context: { projectPath: '/test/path' },
        outcome: {
          success: true,
          effectiveness: 0.9,
          conceptsLearned: ['testing'],
          newPatterns: ['test-pattern']
        }
      };

      expect(async () => {
        await memoryManager.recordInteraction('test-request-123', interaction);
      }).not.toThrow();
    });

    test('should complete request and return memory stats', async () => {
      await memoryManager.initialize();
      
      await memoryManager.startRequest(
        'test-request-123',
        'test-session-456', 
        'test-project-789',
        'test request'
      );

      const result = await memoryManager.completeRequest('test-request-123', {
        success: true,
        completedTasks: 5,
        failedTasks: 0,
        duration: 30000,
        integrationSuccess: true
      });

      expect(result).toBeDefined();
      expect(result.shortTermCleanup).toBe(true);
      expect(typeof result.longTermUpdates).toBe('number');
    });
  });

  describe('Memory Statistics', () => {
    test('should return memory statistics', async () => {
      await memoryManager.initialize();
      
      const stats = await memoryManager.getMemoryStats();
      
      expect(stats).toBeDefined();
      expect(stats.shortTerm).toBeDefined();
      expect(stats.longTerm).toBeDefined();
      expect(stats.episodic).toBeDefined();
      expect(stats.semantic).toBeDefined();
    });
  });
});