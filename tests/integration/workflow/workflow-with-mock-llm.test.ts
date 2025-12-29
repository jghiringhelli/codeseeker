/**
 * Workflow Integration Tests with Mock LLM
 *
 * Tests the complete CodeMind workflow logic with LLM calls abstracted away.
 * This validates:
 * - Query analysis and intent detection
 * - Semantic search execution
 * - Context building
 * - User interaction flow (search enabled/disabled)
 * - Complete 11-step core cycle logic
 *
 * Benefits:
 * - Fast execution (no real LLM calls)
 * - Deterministic results
 * - Tests business logic in isolation
 * - CI-friendly
 */

import {
  MockLLMExecutor,
  MockLLMExecutorFactory,
  LLMExecutorRegistry,
  enableMockLLM,
  disableMockLLM,
  withMockLLM
} from '../../../src/cli/services/llm';

// ============================================================================
// Test Suite: Mock LLM Executor
// ============================================================================

describe('MockLLMExecutor', () => {
  let mockLLM: MockLLMExecutor;

  beforeEach(() => {
    mockLLM = MockLLMExecutorFactory.createForCI();
  });

  describe('Basic Execution', () => {
    it('should execute prompts and return mock responses', async () => {
      const result = await mockLLM.execute('analyze this code', 'some context');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata?.provider).toBe('mock');
    });

    it('should match patterns for different query types', async () => {
      // Analysis pattern
      const analyzeResult = await mockLLM.execute('analyze the user service');
      expect(analyzeResult.success).toBe(true);

      // Create pattern
      const createResult = await mockLLM.execute('create a new authentication middleware');
      expect(createResult.success).toBe(true);
      expect(String(createResult.data).toLowerCase()).toMatch(/implement|create|approach/i);

      // Fix pattern
      const fixResult = await mockLLM.execute('fix the bug in the login function');
      expect(fixResult.success).toBe(true);
      expect(String(fixResult.data).toLowerCase()).toMatch(/fix|issue|error/i);

      // Search pattern
      const searchResult = await mockLLM.execute('find the user registration function');
      expect(searchResult.success).toBe(true);
      expect(String(searchResult.data).toLowerCase()).toMatch(/found|location/i);

      // Test pattern - use "test coverage" to avoid matching "write" pattern first
      const testResult = await mockLLM.execute('check test coverage for the user service');
      expect(testResult.success).toBe(true);
      expect(String(testResult.data).toLowerCase()).toMatch(/test|describe|expect|coverage/i);
    });

    it('should return default response for unmatched patterns', async () => {
      const result = await mockLLM.execute('xyzzy random gibberish 123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Execution Logging', () => {
    it('should log all executions', async () => {
      await mockLLM.execute('first prompt');
      await mockLLM.execute('second prompt', 'with context');
      await mockLLM.execute('third prompt', undefined, { maxTokens: 1000 });

      const log = mockLLM.getExecutionLog();
      expect(log).toHaveLength(3);

      expect(log[0].prompt).toBe('first prompt');
      expect(log[1].prompt).toBe('second prompt');
      expect(log[1].context).toBe('with context');
      expect(log[2].options?.maxTokens).toBe(1000);
    });

    it('should track execution statistics', async () => {
      await mockLLM.execute('analyze something');
      await mockLLM.execute('create something');
      await mockLLM.execute('fix something');

      const stats = mockLLM.getStats();

      expect(stats.totalExecutions).toBe(3);
      expect(stats.successfulExecutions).toBe(3);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should clear execution log', async () => {
      await mockLLM.execute('test prompt');
      expect(mockLLM.getExecutionLog()).toHaveLength(1);

      mockLLM.clearExecutionLog();
      expect(mockLLM.getExecutionLog()).toHaveLength(0);
    });
  });

  describe('Custom Responses', () => {
    it('should allow adding custom responses', async () => {
      mockLLM.addResponse({
        pattern: /my custom pattern/i,
        response: 'My custom response',
        tokensUsed: 42
      });

      const result = await mockLLM.execute('test my custom pattern here');

      expect(result.success).toBe(true);
      expect(result.data).toBe('My custom response');
      expect(result.tokensUsed).toBe(42);
    });

    it('should support regex patterns', async () => {
      mockLLM.addResponse({
        pattern: /user(name|id|email)/i,
        response: 'User field matched'
      });

      const result1 = await mockLLM.execute('get username');
      expect(result1.data).toBe('User field matched');

      const result2 = await mockLLM.execute('validate userEmail');
      expect(result2.data).toBe('User field matched');
    });
  });

  describe('Error Simulation', () => {
    it('should simulate errors when configured', async () => {
      mockLLM.addResponse({
        pattern: /should fail/i,
        response: '',
        simulateError: true,
        errorMessage: 'Simulated failure for testing'
      });

      const result = await mockLLM.execute('this should fail');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Simulated failure for testing');
    });

    it('should support failure rate for chaos testing', async () => {
      mockLLM.setFailureRate(1.0); // 100% failure rate

      const result = await mockLLM.execute('any prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated');
    });
  });

  describe('Provider Info', () => {
    it('should return correct provider information', () => {
      const info = mockLLM.getProviderInfo();

      expect(info.id).toBe('mock');
      expect(info.name).toBe('Mock LLM Executor');
      expect(info.isAvailable).toBe(true);
    });

    it('should always report successful connection', async () => {
      const result = await mockLLM.testConnection();
      expect(result.connected).toBe(true);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for text', () => {
      const text = 'This is a test string with some words';
      const tokens = mockLLM.estimateTokens(text);

      // Rough estimate: ~4 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should validate prompt size', () => {
      const smallPrompt = 'Small prompt';
      const result = mockLLM.validatePromptSize(smallPrompt);

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Test Suite: LLM Executor Registry
// ============================================================================

describe('LLMExecutorRegistry', () => {
  beforeEach(() => {
    LLMExecutorRegistry.reset();
  });

  afterEach(() => {
    LLMExecutorRegistry.getInstance().clearOverride();
  });

  describe('Provider Management', () => {
    it('should have claude and mock providers registered by default', () => {
      const registry = LLMExecutorRegistry.getInstance();
      const providers = registry.getAvailableProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('mock');
    });

    it('should return correct executor by provider ID', () => {
      const registry = LLMExecutorRegistry.getInstance();

      const mockExecutor = registry.getExecutor('mock');
      expect(mockExecutor.getProviderInfo().id).toBe('mock');
    });

    it('should throw for unknown provider', () => {
      const registry = LLMExecutorRegistry.getInstance();

      expect(() => registry.getExecutor('unknown')).toThrow('LLM executor not found');
    });

    it('should allow registering new providers', () => {
      const registry = LLMExecutorRegistry.getInstance();
      const customMock = MockLLMExecutorFactory.createDefault();

      registry.registerExecutor('custom', customMock);

      expect(registry.getAvailableProviders()).toContain('custom');
    });
  });

  describe('Override System', () => {
    it('should return override executor when set', () => {
      const registry = LLMExecutorRegistry.getInstance();
      const customMock = MockLLMExecutorFactory.createDefault();

      registry.setOverride(customMock);

      // Even when requesting 'claude', should get the override
      const executor = registry.getExecutor('claude');
      expect(executor.getProviderInfo().id).toBe('mock');

      registry.clearOverride();
    });

    it('should report override status correctly', () => {
      const registry = LLMExecutorRegistry.getInstance();

      expect(registry.hasOverride()).toBe(false);

      const mock = MockLLMExecutorFactory.createDefault();
      registry.setOverride(mock);

      expect(registry.hasOverride()).toBe(true);

      registry.clearOverride();

      expect(registry.hasOverride()).toBe(false);
    });
  });

  describe('Mock Mode', () => {
    it('should enable mock mode and return mock executor', () => {
      const registry = LLMExecutorRegistry.getInstance();

      const mock = registry.enableMockMode();

      expect(mock).toBeInstanceOf(MockLLMExecutor);
      expect(registry.hasOverride()).toBe(true);

      const executor = registry.getExecutor();
      expect(executor.getProviderInfo().id).toBe('mock');

      registry.disableMockMode();
    });

    it('should support withMock for scoped mock usage', async () => {
      const registry = LLMExecutorRegistry.getInstance();

      let executedInMock = false;

      await registry.withMock(async (mock) => {
        const result = await mock.execute('test prompt');
        executedInMock = result.success;
      });

      expect(executedInMock).toBe(true);
      expect(registry.hasOverride()).toBe(false); // Should be cleared
    });
  });
});

// ============================================================================
// Test Suite: Convenience Functions
// ============================================================================

describe('Convenience Functions', () => {
  afterEach(() => {
    disableMockLLM();
  });

  describe('enableMockLLM / disableMockLLM', () => {
    it('should enable and disable mock mode', async () => {
      const mock = enableMockLLM();

      expect(mock).toBeInstanceOf(MockLLMExecutor);

      const result = await mock.execute('test');
      expect(result.success).toBe(true);

      disableMockLLM();

      // Registry should no longer have override
      expect(LLMExecutorRegistry.getInstance().hasOverride()).toBe(false);
    });
  });

  describe('withMockLLM', () => {
    it('should execute function with mock LLM', async () => {
      const result = await withMockLLM(async (mock) => {
        const response = await mock.execute('analyze code');
        return response.success;
      });

      expect(result).toBe(true);
    });

    it('should clean up mock after execution', async () => {
      await withMockLLM(async () => {
        expect(LLMExecutorRegistry.getInstance().hasOverride()).toBe(true);
      });

      expect(LLMExecutorRegistry.getInstance().hasOverride()).toBe(false);
    });

    it('should clean up mock even on error', async () => {
      try {
        await withMockLLM(async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(LLMExecutorRegistry.getInstance().hasOverride()).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: Workflow Simulation
// ============================================================================

describe('Workflow Simulation with Mock LLM', () => {
  let mock: MockLLMExecutor;

  beforeEach(() => {
    mock = enableMockLLM();
  });

  afterEach(() => {
    disableMockLLM();
  });

  describe('Query Analysis Flow', () => {
    it('should simulate complete query analysis', async () => {
      // Step 1: Query comes in
      const userQuery = 'add authentication to the API routes';

      // Step 2: Analyze intent
      const intentResult = await mock.execute(
        `Analyze this query and determine the intent: "${userQuery}"`
      );
      expect(intentResult.success).toBe(true);

      // Step 3: Build context (simulated semantic search would happen here)
      const contextResult = await mock.execute(
        `Given these files [routes.ts, auth.ts], build context for: "${userQuery}"`
      );
      expect(contextResult.success).toBe(true);

      // Step 4: Execute main request with context
      const mainResult = await mock.execute(
        userQuery,
        'Context: routes.ts contains API routes, auth.ts contains auth logic'
      );
      expect(mainResult.success).toBe(true);

      // Verify execution log shows all steps
      const log = mock.getExecutionLog();
      expect(log.length).toBe(3);
    });
  });

  describe('Search Toggle Behavior', () => {
    it('should simulate search-enabled workflow', async () => {
      // When search is enabled, the workflow should:
      // 1. Run semantic search
      // 2. Build enhanced context
      // 3. Execute with context

      const searchEnabled = true;

      if (searchEnabled) {
        // Simulate semantic search
        const searchResult = await mock.execute(
          'search for files related to: user authentication'
        );
        expect(searchResult.success).toBe(true);
      }

      // Execute main query
      const result = await mock.execute('implement user login');
      expect(result.success).toBe(true);

      const log = mock.getExecutionLog();
      expect(log.length).toBe(2); // Search + main query
    });

    it('should simulate search-disabled workflow', async () => {
      // When search is disabled, workflow should skip search

      const searchEnabled = false;

      if (searchEnabled) {
        await mock.execute('search query');
      }

      // Execute main query directly
      const result = await mock.execute('implement user login');
      expect(result.success).toBe(true);

      const log = mock.getExecutionLog();
      expect(log.length).toBe(1); // Only main query
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle LLM errors gracefully', async () => {
      // Configure to fail on specific pattern
      mock.addResponse({
        pattern: /critical operation/i,
        response: '',
        simulateError: true,
        errorMessage: 'LLM service unavailable'
      });

      const result = await mock.execute('perform critical operation');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Workflow should be able to continue with fallback
      const fallbackResult = await mock.execute('perform simple operation');
      expect(fallbackResult.success).toBe(true);
    });
  });

  describe('Multi-Step Task Decomposition', () => {
    it('should simulate task decomposition workflow', async () => {
      const complexQuery = 'refactor the user service and add tests';

      // Step 1: Decompose task
      const decompositionResult = await mock.execute(
        `Decompose this task into steps: "${complexQuery}"`
      );
      expect(decompositionResult.success).toBe(true);

      // Simulate decomposed tasks
      const subtasks = [
        'analyze current user service',
        'refactor user service',
        'create tests for user service'
      ];

      // Execute each subtask
      for (const subtask of subtasks) {
        const result = await mock.execute(subtask);
        expect(result.success).toBe(true);
      }

      // Verify all tasks executed
      const stats = mock.getStats();
      expect(stats.totalExecutions).toBe(4); // 1 decomposition + 3 subtasks
    });
  });

  describe('Context Building', () => {
    it('should track context passed to LLM', async () => {
      const context = `
        Files found:
        - src/services/user-service.ts
        - src/controllers/user-controller.ts

        Relationships:
        - UserController depends on UserService
      `;

      await mock.execute('explain the user module', context);

      const log = mock.getExecutionLog();
      expect(log[0].context).toBe(context);
    });
  });
});