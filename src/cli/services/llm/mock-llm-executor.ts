/**
 * Mock LLM Executor
 *
 * A mock implementation of ILLMExecutor for testing purposes.
 * Allows testing the entire CodeSeeker workflow without real LLM API calls.
 *
 * Features:
 * - Pattern-based response matching
 * - Configurable delays to simulate network latency
 * - Execution logging for test verification
 * - Deterministic responses for reproducible tests
 * - Support for simulating errors and edge cases
 */

import {
  ILLMExecutor,
  LLMExecutionOptions,
  LLMExecutionResult,
  LLMProviderInfo,
  MockLLMOptions,
  MockLLMResponse
} from './interfaces';

// Default responses for common CodeSeeker operations
const DEFAULT_MOCK_RESPONSES: MockLLMResponse[] = [
  // Code analysis responses
  {
    pattern: /analyze|understand|explain|what does|how does/i,
    response: 'Based on my analysis of the codebase, this component handles data processing with a modular architecture. Key observations:\n\n1. **Structure**: The code follows a service-oriented pattern\n2. **Dependencies**: Relies on core utilities and database connections\n3. **Purpose**: Processes user requests and returns formatted responses\n\nThe implementation appears well-structured with clear separation of concerns.',
    tokensUsed: 150
  },

  // Code modification responses
  {
    pattern: /add|create|implement|write|generate/i,
    response: 'I\'ll help you with that implementation. Here\'s the approach:\n\n1. First, I\'ll analyze the existing code structure\n2. Then implement the requested changes following the existing patterns\n3. Finally, ensure proper integration with existing components\n\n**Files to modify:**\n- `src/services/target-service.ts`\n\n**Implementation complete.** The changes follow the existing coding conventions and include appropriate error handling.',
    tokensUsed: 200
  },

  // Refactoring responses
  {
    pattern: /refactor|improve|optimize|clean|extract/i,
    response: 'I\'ll refactor this code to improve maintainability:\n\n**Changes made:**\n1. Extracted common logic into a shared utility\n2. Simplified conditional logic\n3. Added proper type annotations\n4. Improved error handling\n\nThe refactored code is more modular and easier to test.',
    tokensUsed: 175
  },

  // Bug fix responses
  {
    pattern: /fix|bug|error|issue|problem/i,
    response: 'I\'ve identified and fixed the issue:\n\n**Root cause:** The error was caused by improper null handling in the data processing pipeline.\n\n**Fix applied:**\n- Added null checks before accessing properties\n- Implemented proper error boundaries\n- Added fallback values for edge cases\n\nThe fix has been applied and tested.',
    tokensUsed: 160
  },

  // Search/find responses
  {
    pattern: /find|search|locate|where|show me/i,
    response: 'I found the following relevant code:\n\n**Location:** `src/services/user-service.ts:45-67`\n\n```typescript\nexport class UserService {\n  async findUser(id: string) {\n    return this.repository.findById(id);\n  }\n}\n```\n\nThis is the main entry point for the functionality you\'re looking for.',
    tokensUsed: 120
  },

  // Test generation responses
  {
    pattern: /test|spec|coverage/i,
    response: 'I\'ll generate tests for this component:\n\n```typescript\ndescribe(\'UserService\', () => {\n  it(\'should find user by id\', async () => {\n    const user = await service.findUser(\'123\');\n    expect(user).toBeDefined();\n    expect(user.id).toBe(\'123\');\n  });\n});\n```\n\n**Coverage:** The tests cover the main functionality and edge cases.',
    tokensUsed: 180
  },

  // Documentation responses
  {
    pattern: /document|doc|readme|comment/i,
    response: 'Here\'s the documentation for this component:\n\n## UserService\n\nHandles user-related operations including authentication and profile management.\n\n### Methods\n\n- `findUser(id)`: Retrieves a user by their unique identifier\n- `createUser(data)`: Creates a new user account\n- `updateUser(id, data)`: Updates existing user information\n\n### Usage\n\n```typescript\nconst userService = new UserService();\nconst user = await userService.findUser(\'123\');\n```',
    tokensUsed: 200
  }
];

export class MockLLMExecutor implements ILLMExecutor {
  private responses: MockLLMResponse[];
  private defaultResponse: string;
  private defaultDelayMs: number;
  private verbose: boolean;
  private failureRate: number;
  private executionLog: Array<{
    timestamp: Date;
    prompt: string;
    context?: string;
    options?: LLMExecutionOptions;
    result: LLMExecutionResult;
  }> = [];

  constructor(options: MockLLMOptions = {}) {
    this.responses = [...DEFAULT_MOCK_RESPONSES, ...(options.responses || [])];
    this.defaultResponse = options.defaultResponse ||
      'I\'ve processed your request. The operation completed successfully.';
    this.defaultDelayMs = options.defaultDelayMs || 50;
    this.verbose = options.verbose || false;
    this.failureRate = options.failureRate || 0;
  }

  /**
   * Execute a prompt and return a mock response
   */
  async execute(
    prompt: string,
    context?: string,
    options?: LLMExecutionOptions
  ): Promise<LLMExecutionResult> {
    const startTime = Date.now();

    // Simulate failure based on failure rate
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      const result: LLMExecutionResult = {
        success: false,
        error: 'Simulated LLM failure for testing',
        executionTimeMs: Date.now() - startTime,
        metadata: { provider: 'mock' }
      };

      this.logExecution(prompt, context, options, result);
      return result;
    }

    // Find matching response
    const matchedResponse = this.findMatchingResponse(prompt);

    // Simulate delay
    const delay = matchedResponse?.delayMs || this.defaultDelayMs;
    if (delay > 0) {
      await this.sleep(delay);
    }

    // Check if this response should simulate an error
    if (matchedResponse?.simulateError) {
      const result: LLMExecutionResult = {
        success: false,
        error: matchedResponse.errorMessage || 'Simulated error',
        executionTimeMs: Date.now() - startTime,
        metadata: { provider: 'mock' }
      };

      this.logExecution(prompt, context, options, result);
      return result;
    }

    // Build response
    const responseData = matchedResponse?.response || this.defaultResponse;
    const tokensUsed = matchedResponse?.tokensUsed ||
      this.estimateTokens(typeof responseData === 'string' ? responseData : JSON.stringify(responseData));

    const result: LLMExecutionResult = {
      success: true,
      data: responseData,
      tokensUsed,
      executionTimeMs: Date.now() - startTime,
      metadata: {
        provider: 'mock',
        model: 'mock-model',
        finishReason: 'stop',
        matchedPattern: matchedResponse?.pattern?.toString()
      }
    };

    this.logExecution(prompt, context, options, result);

    if (this.verbose) {
      console.log(`[MockLLM] Prompt: "${prompt.substring(0, 50)}..."`);
      console.log(`[MockLLM] Matched: ${matchedResponse?.pattern?.toString() || 'default'}`);
      console.log(`[MockLLM] Response: "${String(result.data).substring(0, 50)}..."`);
    }

    return result;
  }

  /**
   * Get information about this mock provider
   */
  getProviderInfo(): LLMProviderInfo {
    return {
      id: 'mock',
      name: 'Mock LLM Executor',
      version: '1.0.0',
      availableModels: ['mock-model'],
      maxContextTokens: 100000,
      isAvailable: true
    };
  }

  /**
   * Test connection (always succeeds for mock)
   */
  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    return { connected: true };
  }

  /**
   * Estimate tokens for text
   */
  estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate prompt size
   */
  validatePromptSize(prompt: string): {
    valid: boolean;
    size: number;
    maxSize: number;
    warning?: string;
  } {
    const size = this.estimateTokens(prompt);
    const maxSize = 100000; // Mock has high limit

    if (size > maxSize) {
      return {
        valid: false,
        size,
        maxSize,
        warning: `Prompt size (${size} tokens) exceeds maximum (${maxSize} tokens)`
      };
    }

    if (size > 50000) {
      return {
        valid: true,
        size,
        maxSize,
        warning: `Large prompt (${size} tokens) - consider chunking`
      };
    }

    return { valid: true, size, maxSize };
  }

  // ============================================================================
  // Mock-Specific Methods
  // ============================================================================

  /**
   * Add a custom response pattern
   */
  addResponse(response: MockLLMResponse): void {
    // Add to beginning so custom responses take precedence
    this.responses.unshift(response);
  }

  /**
   * Clear all custom responses
   */
  clearCustomResponses(): void {
    this.responses = [...DEFAULT_MOCK_RESPONSES];
  }

  /**
   * Get the execution log for test verification
   */
  getExecutionLog(): Array<{
    timestamp: Date;
    prompt: string;
    context?: string;
    options?: LLMExecutionOptions;
    result: LLMExecutionResult;
  }> {
    return [...this.executionLog];
  }

  /**
   * Clear the execution log
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * Get statistics about mock executions
   */
  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalTokensUsed: number;
    averageExecutionTimeMs: number;
    patternMatchCounts: Record<string, number>;
  } {
    const successfulExecutions = this.executionLog.filter(e => e.result.success).length;
    const totalTokens = this.executionLog.reduce((sum, e) => sum + (e.result.tokensUsed || 0), 0);
    const totalTime = this.executionLog.reduce((sum, e) => sum + (e.result.executionTimeMs || 0), 0);

    const patternMatchCounts: Record<string, number> = {};
    for (const entry of this.executionLog) {
      const pattern = entry.result.metadata?.matchedPattern as string || 'default';
      patternMatchCounts[pattern] = (patternMatchCounts[pattern] || 0) + 1;
    }

    return {
      totalExecutions: this.executionLog.length,
      successfulExecutions,
      failedExecutions: this.executionLog.length - successfulExecutions,
      totalTokensUsed: totalTokens,
      averageExecutionTimeMs: this.executionLog.length > 0 ? totalTime / this.executionLog.length : 0,
      patternMatchCounts
    };
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Set failure rate for chaos testing
   */
  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private findMatchingResponse(prompt: string): MockLLMResponse | undefined {
    for (const response of this.responses) {
      if (typeof response.pattern === 'string') {
        if (prompt.toLowerCase().includes(response.pattern.toLowerCase())) {
          return response;
        }
      } else if (response.pattern instanceof RegExp) {
        if (response.pattern.test(prompt)) {
          return response;
        }
      }
    }
    return undefined;
  }

  private logExecution(
    prompt: string,
    context: string | undefined,
    options: LLMExecutionOptions | undefined,
    result: LLMExecutionResult
  ): void {
    this.executionLog.push({
      timestamp: new Date(),
      prompt,
      context,
      options,
      result
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory for creating pre-configured mock executors
// ============================================================================

export class MockLLMExecutorFactory {
  /**
   * Create a mock executor with default responses
   */
  static createDefault(): MockLLMExecutor {
    return new MockLLMExecutor();
  }

  /**
   * Create a mock executor for fast CI testing (no delays)
   */
  static createForCI(): MockLLMExecutor {
    return new MockLLMExecutor({
      defaultDelayMs: 0,
      verbose: false
    });
  }

  /**
   * Create a mock executor that simulates realistic latency
   */
  static createWithLatency(minDelayMs: number = 100, maxDelayMs: number = 500): MockLLMExecutor {
    const executor = new MockLLMExecutor({
      defaultDelayMs: Math.floor((minDelayMs + maxDelayMs) / 2),
      verbose: false
    });
    return executor;
  }

  /**
   * Create a mock executor for chaos/resilience testing
   */
  static createForChaosTesting(failureRate: number = 0.1): MockLLMExecutor {
    return new MockLLMExecutor({
      failureRate,
      verbose: true
    });
  }

  /**
   * Create a mock executor with custom responses
   */
  static createWithResponses(responses: MockLLMResponse[]): MockLLMExecutor {
    return new MockLLMExecutor({ responses });
  }
}