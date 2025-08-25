import { ContextManager, CompressionStrategy } from '../../../src/orchestration/context-manager';
import { RoleType } from '../../../src/orchestration/workflow-definitions';
import { EventEmitter } from 'events';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  describe('compressContext', () => {
    test('should compress context with correct compression ratio', async () => {
      const testContent = {
        data: 'x'.repeat(1000),
        metadata: { type: 'test', important: true },
        verbose: 'y'.repeat(500),
        debug: 'z'.repeat(300)
      };

      const result = await contextManager.compressContext(
        testContent,
        RoleType.ORCHESTRATOR,
        true
      );

      expect(result).toBeDefined();
      expect(result.roleType).toBe(RoleType.ORCHESTRATOR);
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.compressedContent).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(result.compressedContent.length);
    });

    test('should preserve essential keys during compression', async () => {
      const testContent = {
        workflowId: 'test-workflow-123',
        currentPhase: 'implementation',
        criticalDecisions: ['decision1', 'decision2'],
        unimportantData: 'x'.repeat(500),
        debug: 'debug info'
      };

      const result = await contextManager.compressContext(
        testContent,
        RoleType.ORCHESTRATOR
      );

      expect(result.metadata.essentialKeys).toContain('workflowId');
      expect(result.metadata.essentialKeys).toContain('currentPhase');
      expect(result.metadata.essentialKeys).toContain('criticalDecisions');
    });

    test('should apply different compression strategies per role', async () => {
      const testContent = { data: 'test content' };

      const orchestratorResult = await contextManager.compressContext(
        testContent,
        RoleType.ORCHESTRATOR
      );

      const implementerResult = await contextManager.compressContext(
        testContent,
        RoleType.IMPLEMENTATION_DEVELOPER
      );

      expect(orchestratorResult.roleType).toBe(RoleType.ORCHESTRATOR);
      expect(implementerResult.roleType).toBe(RoleType.IMPLEMENTATION_DEVELOPER);
      
      // Orchestrator should have higher priority
      expect(orchestratorResult.priority).toBeGreaterThanOrEqual(implementerResult.priority);
    });
  });

  describe('detectClaudeLimitApproaching', () => {
    test('should detect when limit is approaching', async () => {
      const executionId = 'test-execution-1';
      
      // Update usage to near limit
      await contextManager.updateUsage(executionId, 170000); // 85% of 200k limit

      const isApproaching = await contextManager.detectClaudeLimitApproaching(executionId);
      
      expect(isApproaching).toBe(true);
    });

    test('should return false when usage is low', async () => {
      const executionId = 'test-execution-2';
      
      await contextManager.updateUsage(executionId, 50000); // 25% of limit

      const isApproaching = await contextManager.detectClaudeLimitApproaching(executionId);
      
      expect(isApproaching).toBe(false);
    });

    test('should emit limit-approaching event', async () => {
      const executionId = 'test-execution-3';
      let eventEmitted = false;

      contextManager.on('limit-approaching', (data) => {
        eventEmitted = true;
        expect(data.type).toBe('conversation');
        expect(data.usage).toBeGreaterThan(80);
      });

      await contextManager.updateUsage(executionId, 175000);
      await contextManager.detectClaudeLimitApproaching(executionId);

      expect(eventEmitted).toBe(true);
    });
  });

  describe('queue management', () => {
    test('should queue messages with priority', async () => {
      const testMessage = { content: 'test message' };

      await contextManager.queueMessage(testMessage, RoleType.SECURITY_AUDITOR, 8);
      await contextManager.queueMessage(testMessage, RoleType.ORCHESTRATOR, 10);

      const queueSize = contextManager.getQueueSize();
      expect(queueSize).toBe(2);
    });

    test('should process high-priority messages first', async () => {
      const processedMessages: RoleType[] = [];

      contextManager.on('message-ready', (data) => {
        processedMessages.push(data.roleType);
      });

      // Add messages in reverse priority order
      await contextManager.queueMessage({ content: 'low' }, RoleType.COMMITTER, 1);
      await contextManager.queueMessage({ content: 'high' }, RoleType.SECURITY_AUDITOR, 9);

      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(processedMessages[0]).toBe(RoleType.SECURITY_AUDITOR);
    });
  });

  describe('pause and resume functionality', () => {
    test('should pause and resume nodes correctly', async () => {
      const nodeId = 'test-node-1';

      expect(contextManager.isPaused(nodeId)).toBe(false);

      await contextManager.pauseNode(nodeId, 'Testing pause functionality');
      expect(contextManager.isPaused(nodeId)).toBe(true);

      await contextManager.resumeNode(nodeId);
      expect(contextManager.isPaused(nodeId)).toBe(false);
    });

    test('should emit pause and resume events', async () => {
      const nodeId = 'test-node-2';
      const events: string[] = [];

      contextManager.on('node-paused', () => events.push('paused'));
      contextManager.on('node-resumed', () => events.push('resumed'));

      await contextManager.pauseNode(nodeId, 'Test pause');
      await contextManager.resumeNode(nodeId);

      expect(events).toEqual(['paused', 'resumed']);
    });
  });

  describe('usage tracking', () => {
    test('should track usage correctly', async () => {
      const executionId = 'usage-test';

      await contextManager.updateUsage(executionId, 5000);
      await contextManager.updateUsage(executionId, 3000);

      // Should accumulate to 8000 tokens
      const isApproaching = await contextManager.detectClaudeLimitApproaching(executionId);
      expect(isApproaching).toBe(false); // 8k out of 200k is still low
    });
  });

  describe('context window management', () => {
    test('should store and retrieve context windows', async () => {
      const testContent = { test: 'data' };
      
      const contextWindow = await contextManager.compressContext(
        testContent,
        RoleType.TEST_DESIGNER
      );

      const retrieved = await contextManager.getContextWindow(contextWindow.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(contextWindow.id);
      expect(retrieved?.roleType).toBe(RoleType.TEST_DESIGNER);
    });

    test('should return null for non-existent context window', async () => {
      const retrieved = await contextManager.getContextWindow('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should handle invalid compression gracefully', async () => {
      const circularObject: any = {};
      circularObject.self = circularObject;

      await expect(
        contextManager.compressContext(circularObject, RoleType.ORCHESTRATOR)
      ).rejects.toThrow();
    });

    test('should handle null/undefined content', async () => {
      const result1 = await contextManager.compressContext(null, RoleType.ORCHESTRATOR);
      const result2 = await contextManager.compressContext(undefined, RoleType.ORCHESTRATOR);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.tokens).toBeGreaterThanOrEqual(0);
      expect(result2.tokens).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance', () => {
    test('should compress large content within reasonable time', async () => {
      const largeContent = {
        data: 'x'.repeat(50000),
        arrays: Array(1000).fill('test data'),
        nested: {
          level1: {
            level2: {
              data: 'y'.repeat(10000)
            }
          }
        }
      };

      const startTime = Date.now();
      const result = await contextManager.compressContext(
        largeContent,
        RoleType.ORCHESTRATOR
      );
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.compressionRatio).toBeLessThan(0.8); // Should achieve decent compression
    });
  });
});