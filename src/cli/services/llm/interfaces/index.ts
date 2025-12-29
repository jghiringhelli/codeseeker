/**
 * LLM Executor Interfaces
 *
 * SOLID Principles:
 * - Interface Segregation: Focused interfaces for LLM execution
 * - Dependency Inversion: Business logic depends on abstractions, not concrete LLM implementations
 *
 * This allows:
 * 1. Swapping LLM providers (Claude, OpenAI, Ollama, etc.) without changing business logic
 * 2. Mock implementations for fast CI testing
 * 3. Clean separation between workflow logic and LLM execution
 */

// ============================================================================
// Core LLM Types
// ============================================================================

/**
 * Options for LLM execution
 */
export interface LLMExecutionOptions {
  /** Working directory for file operations */
  projectPath?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Output format preference */
  outputFormat?: 'text' | 'json';
  /** Model to use (provider-specific) */
  model?: string;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Additional provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Result from LLM execution
 */
export interface LLMExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Response data (text or parsed JSON) */
  data?: string | Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Estimated tokens used */
  tokensUsed?: number;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  /** Provider-specific metadata */
  metadata?: {
    provider: string;
    model?: string;
    finishReason?: string;
    [key: string]: unknown;
  };
}

/**
 * Information about an LLM provider
 */
export interface LLMProviderInfo {
  /** Provider identifier (e.g., 'claude', 'openai', 'ollama') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider version */
  version?: string;
  /** Available models */
  availableModels?: string[];
  /** Maximum context window */
  maxContextTokens?: number;
  /** Whether provider is currently available */
  isAvailable: boolean;
}

// ============================================================================
// Core LLM Interface
// ============================================================================

/**
 * Core interface for LLM execution
 *
 * All LLM providers (Claude, OpenAI, Mock, etc.) must implement this interface.
 * This enables:
 * - Provider-agnostic workflow logic
 * - Easy testing with mock implementations
 * - Runtime provider switching
 */
export interface ILLMExecutor {
  /**
   * Execute a prompt and get a response
   * @param prompt The user's prompt
   * @param context Additional context to include
   * @param options Execution options
   */
  execute(
    prompt: string,
    context?: string,
    options?: LLMExecutionOptions
  ): Promise<LLMExecutionResult>;

  /**
   * Get information about this LLM provider
   */
  getProviderInfo(): LLMProviderInfo;

  /**
   * Test connection to the LLM provider
   */
  testConnection(): Promise<{ connected: boolean; error?: string }>;

  /**
   * Estimate tokens for a given text
   * @param text Text to estimate tokens for
   */
  estimateTokens(text: string): number;

  /**
   * Check if a prompt is within size limits
   * @param prompt Prompt to validate
   */
  validatePromptSize(prompt: string): {
    valid: boolean;
    size: number;
    maxSize: number;
    warning?: string;
  };
}

// ============================================================================
// Extended Interfaces for Advanced Features
// ============================================================================

/**
 * Interface for LLM executors that support streaming
 */
export interface IStreamingLLMExecutor extends ILLMExecutor {
  /**
   * Execute with streaming response
   */
  executeStream(
    prompt: string,
    context?: string,
    options?: LLMExecutionOptions
  ): AsyncIterable<string>;
}

/**
 * Interface for LLM executors that support conversation history
 */
export interface IConversationalLLMExecutor extends ILLMExecutor {
  /**
   * Execute with conversation history
   */
  executeWithHistory(
    prompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: string,
    options?: LLMExecutionOptions
  ): Promise<LLMExecutionResult>;

  /**
   * Clear conversation history for a session
   */
  clearHistory(sessionId: string): void;
}

/**
 * Interface for LLM executors that support tool/function calling
 */
export interface IToolCallingLLMExecutor extends ILLMExecutor {
  /**
   * Execute with tool definitions
   */
  executeWithTools(
    prompt: string,
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>,
    context?: string,
    options?: LLMExecutionOptions
  ): Promise<LLMExecutionResult & {
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
  }>;
}

// ============================================================================
// Factory Interface
// ============================================================================

/**
 * Factory for creating LLM executors
 */
export interface ILLMExecutorFactory {
  /**
   * Create an LLM executor for the specified provider
   * @param providerId Provider identifier
   * @param config Provider-specific configuration
   */
  create(providerId: string, config?: Record<string, unknown>): ILLMExecutor;

  /**
   * Get available provider IDs
   */
  getAvailableProviders(): string[];

  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerId: string): Promise<boolean>;
}

// ============================================================================
// Mock Configuration Types (for testing)
// ============================================================================

/**
 * Configuration for mock LLM responses
 */
export interface MockLLMResponse {
  /** Pattern to match in prompt (string or regex) */
  pattern: string | RegExp;
  /** Response to return when pattern matches */
  response: string | Record<string, unknown>;
  /** Optional delay to simulate network latency */
  delayMs?: number;
  /** Optional token count to report */
  tokensUsed?: number;
  /** Whether this response should simulate an error */
  simulateError?: boolean;
  /** Error message if simulateError is true */
  errorMessage?: string;
}

/**
 * Options for mock LLM executor
 */
export interface MockLLMOptions {
  /** Predefined responses */
  responses?: MockLLMResponse[];
  /** Default response when no pattern matches */
  defaultResponse?: string;
  /** Default delay for all responses */
  defaultDelayMs?: number;
  /** Whether to log mock operations */
  verbose?: boolean;
  /** Simulate intermittent failures */
  failureRate?: number;
}