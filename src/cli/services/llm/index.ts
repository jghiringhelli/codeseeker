/**
 * LLM Services Module
 *
 * Provides LLM-agnostic interfaces and implementations for CodeMind.
 * Enables easy testing with mock LLMs and future provider switching.
 *
 * Usage:
 *
 * ```typescript
 * // Get the current LLM executor
 * import { getLLMExecutor } from './services/llm';
 * const llm = getLLMExecutor();
 * const result = await llm.execute('Your prompt', 'Context');
 *
 * // For testing - enable mock mode
 * import { enableMockLLM, disableMockLLM, withMockLLM } from './services/llm';
 *
 * // Option 1: Manual enable/disable
 * const mock = enableMockLLM();
 * // ... run tests ...
 * disableMockLLM();
 *
 * // Option 2: Auto-cleanup with withMockLLM
 * const result = await withMockLLM(async (mock) => {
 *   // All LLM calls in here use the mock
 *   return await someFunction();
 * });
 *
 * // For custom mock responses
 * import { MockLLMExecutorFactory } from './services/llm';
 * const mock = MockLLMExecutorFactory.createWithResponses([
 *   { pattern: /my pattern/, response: 'Custom response' }
 * ]);
 * enableMockLLM(mock);
 * ```
 */

// Core interfaces
export {
  ILLMExecutor,
  IStreamingLLMExecutor,
  IConversationalLLMExecutor,
  IToolCallingLLMExecutor,
  ILLMExecutorFactory,
  LLMExecutionOptions,
  LLMExecutionResult,
  LLMProviderInfo,
  MockLLMOptions,
  MockLLMResponse
} from './interfaces';

// Implementations
export {
  ClaudeLLMExecutor,
  StreamingExecutionOptions,
  ToolCallEvent
} from './claude-llm-executor';
export { MockLLMExecutor, MockLLMExecutorFactory } from './mock-llm-executor';

// Registry and convenience functions
export {
  LLMExecutorRegistry,
  getLLMExecutor,
  enableMockLLM,
  disableMockLLM,
  withMockLLM
} from './llm-executor-registry';