/**
 * LLM Executor Registry
 *
 * Central registry for LLM executors following the Service Locator pattern.
 * Provides:
 * - Runtime provider switching
 * - Global mock injection for testing
 * - Factory methods for common use cases
 *
 * SOLID Principles:
 * - Single Responsibility: Manages LLM executor lifecycle only
 * - Open/Closed: New providers can be added without modifying existing code
 * - Dependency Inversion: Clients depend on ILLMExecutor, not concrete implementations
 */

import { ILLMExecutor, ILLMExecutorFactory, LLMProviderInfo } from './interfaces';
import { ClaudeLLMExecutor } from './claude-llm-executor';
import { MockLLMExecutor, MockLLMExecutorFactory } from './mock-llm-executor';

/**
 * Global LLM Executor Registry
 * Singleton pattern for application-wide LLM executor management
 */
export class LLMExecutorRegistry implements ILLMExecutorFactory {
  private static instance: LLMExecutorRegistry;

  private executors: Map<string, ILLMExecutor> = new Map();
  private defaultProviderId: string = 'claude';
  private overrideExecutor: ILLMExecutor | null = null;

  private constructor() {
    // Register default executors
    this.registerExecutor('claude', new ClaudeLLMExecutor());
    this.registerExecutor('mock', MockLLMExecutorFactory.createDefault());
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LLMExecutorRegistry {
    if (!LLMExecutorRegistry.instance) {
      LLMExecutorRegistry.instance = new LLMExecutorRegistry();
    }
    return LLMExecutorRegistry.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    LLMExecutorRegistry.instance = new LLMExecutorRegistry();
  }

  // ============================================================================
  // ILLMExecutorFactory Implementation
  // ============================================================================

  /**
   * Create/get an LLM executor for the specified provider
   */
  create(providerId: string, _config?: Record<string, unknown>): ILLMExecutor {
    const executor = this.executors.get(providerId);
    if (!executor) {
      throw new Error(`Unknown LLM provider: ${providerId}. Available: ${this.getAvailableProviders().join(', ')}`);
    }
    return executor;
  }

  /**
   * Get available provider IDs
   */
  getAvailableProviders(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(providerId: string): Promise<boolean> {
    const executor = this.executors.get(providerId);
    if (!executor) return false;

    try {
      const result = await executor.testConnection();
      return result.connected;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Registry Management
  // ============================================================================

  /**
   * Register a new LLM executor
   */
  registerExecutor(providerId: string, executor: ILLMExecutor): void {
    this.executors.set(providerId, executor);
  }

  /**
   * Unregister an LLM executor
   */
  unregisterExecutor(providerId: string): boolean {
    return this.executors.delete(providerId);
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(providerId: string): void {
    if (!this.executors.has(providerId)) {
      throw new Error(`Cannot set default to unknown provider: ${providerId}`);
    }
    this.defaultProviderId = providerId;
  }

  /**
   * Get the default provider ID
   */
  getDefaultProviderId(): string {
    return this.defaultProviderId;
  }

  // ============================================================================
  // Executor Access
  // ============================================================================

  /**
   * Get the current LLM executor
   * Returns override executor if set, otherwise the default
   */
  getExecutor(providerId?: string): ILLMExecutor {
    // If there's an override, always use it
    if (this.overrideExecutor) {
      return this.overrideExecutor;
    }

    // Otherwise use specified provider or default
    const id = providerId || this.defaultProviderId;
    const executor = this.executors.get(id);

    if (!executor) {
      throw new Error(`LLM executor not found: ${id}`);
    }

    return executor;
  }

  /**
   * Get provider information for all registered executors
   */
  getAllProviderInfo(): LLMProviderInfo[] {
    return Array.from(this.executors.values()).map(e => e.getProviderInfo());
  }

  // ============================================================================
  // Testing Support
  // ============================================================================

  /**
   * Override the executor globally (for testing)
   * All calls to getExecutor() will return this executor
   */
  setOverride(executor: ILLMExecutor | null): void {
    this.overrideExecutor = executor;
  }

  /**
   * Clear the global override
   */
  clearOverride(): void {
    this.overrideExecutor = null;
  }

  /**
   * Check if an override is currently set
   */
  hasOverride(): boolean {
    return this.overrideExecutor !== null;
  }

  /**
   * Enable mock mode for testing
   * This sets a mock executor as the global override
   */
  enableMockMode(mockExecutor?: MockLLMExecutor): MockLLMExecutor {
    const mock = mockExecutor || MockLLMExecutorFactory.createForCI();
    this.setOverride(mock);
    return mock;
  }

  /**
   * Disable mock mode
   */
  disableMockMode(): void {
    this.clearOverride();
  }

  /**
   * Run a function with mock mode enabled, then restore
   */
  async withMock<T>(
    fn: (mock: MockLLMExecutor) => Promise<T>,
    mockExecutor?: MockLLMExecutor
  ): Promise<T> {
    const mock = this.enableMockMode(mockExecutor);
    try {
      return await fn(mock);
    } finally {
      this.disableMockMode();
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the global LLM executor (convenience function)
 */
export function getLLMExecutor(providerId?: string): ILLMExecutor {
  return LLMExecutorRegistry.getInstance().getExecutor(providerId);
}

/**
 * Enable mock mode globally (convenience function for tests)
 */
export function enableMockLLM(mockExecutor?: MockLLMExecutor): MockLLMExecutor {
  return LLMExecutorRegistry.getInstance().enableMockMode(mockExecutor);
}

/**
 * Disable mock mode globally (convenience function for tests)
 */
export function disableMockLLM(): void {
  LLMExecutorRegistry.getInstance().disableMockMode();
}

/**
 * Run code with mock LLM (convenience function for tests)
 */
export async function withMockLLM<T>(
  fn: (mock: MockLLMExecutor) => Promise<T>,
  mockExecutor?: MockLLMExecutor
): Promise<T> {
  return LLMExecutorRegistry.getInstance().withMock(fn, mockExecutor);
}

// ============================================================================
// Module Exports
// ============================================================================

// Re-export for convenience
export { ILLMExecutor, LLMExecutionOptions, LLMExecutionResult, LLMProviderInfo } from './interfaces';
export { ClaudeLLMExecutor } from './claude-llm-executor';
export { MockLLMExecutor, MockLLMExecutorFactory } from './mock-llm-executor';