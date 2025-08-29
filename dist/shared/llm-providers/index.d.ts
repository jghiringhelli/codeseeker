/**
 * Multi-LLM Provider System for CodeMind CLI
 *
 * This system provides a clean abstraction layer for integrating multiple LLM providers
 * that offer CLI tools similar to Claude Code. It allows CodeMind to work with:
 *
 * - Claude Code (Anthropic) - Available now
 * - ChatGPT CLI (OpenAI) - Template for future CLI
 * - Gemini CLI (Google) - Template for future CLI
 * - Grok CLI (xAI) - Template for future CLI
 *
 * The system automatically detects available providers and can switch between them
 * seamlessly, maintaining the same functionality regardless of which LLM is being used.
 */
export { LLMProvider, LLMCapabilities, LLMContext, LLMResponse, AnalysisOptions, CodeGenerationRequest, CodeGenerationResponse, CodeReviewRequest, CodeReviewResponse, CodeIssue, CodeSuggestion, QualityScore, ValidationResult, CommandResult, BaseLLMProvider, LLMProviderRegistry, llmRegistry } from './base-provider';
export { ClaudeProvider } from './claude-provider';
export { GPTProvider } from './gpt-provider';
export { GeminiProvider } from './gemini-provider';
export { GrokProvider } from './grok-provider';
/**
 * Multi-LLM Manager for CodeMind
 * Handles provider registration, detection, and switching
 */
export declare class MultiLLMManager {
    private static instance;
    private currentWorkingDirectory;
    constructor(workingDirectory?: string);
    static getInstance(workingDirectory?: string): MultiLLMManager;
    /**
     * Initialize all available LLM providers
     */
    private initializeProviders;
    /**
     * Automatically detect and set the best available provider
     */
    autoSelectProvider(): Promise<string | null>;
    /**
     * Get status of all providers
     */
    getProviderStatus(): Promise<Record<string, any>>;
    /**
     * Switch to a specific provider
     */
    switchProvider(providerName: string): Promise<boolean>;
    /**
     * Get the currently active provider
     */
    getActiveProvider(): string | null;
    /**
     * Execute analysis with the active provider
     */
    analyze(prompt: string, options?: any): Promise<any>;
    /**
     * Generate code with the active provider
     */
    generateCode(request: any): Promise<any>;
    /**
     * Review code with the active provider
     */
    reviewCode(request: any): Promise<any>;
    /**
     * Show help for setting up providers
     */
    showProviderSetupHelp(): void;
}
export declare const multiLLMManager: MultiLLMManager;
export declare const autoSelectProvider: () => Promise<string>;
export declare const getProviderStatus: () => Promise<Record<string, any>>;
export declare const switchProvider: (name: string) => Promise<boolean>;
export declare const showProviderHelp: () => void;
//# sourceMappingURL=index.d.ts.map