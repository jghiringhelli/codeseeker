import { EventEmitter } from 'events';
/**
 * Base interface that all LLM providers must implement
 * Designed to work with CLI tools similar to Claude Code
 */
export interface LLMProvider {
    readonly name: string;
    readonly version: string;
    readonly capabilities: LLMCapabilities;
    analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    isAvailable(): Promise<boolean>;
    validateConfiguration(): Promise<ValidationResult>;
    executeCommand(command: string, args: string[]): Promise<CommandResult>;
    setContext(context: LLMContext): void;
    getContext(): LLMContext | null;
    clearContext(): void;
}
export interface LLMCapabilities {
    codeGeneration: boolean;
    codeReview: boolean;
    analysis: boolean;
    fileOperations: boolean;
    terminalAccess: boolean;
    toolIntegration: boolean;
    multiFileContext: boolean;
    projectAwareness: boolean;
}
export interface AnalysisOptions {
    maxTokens?: number;
    temperature?: number;
    includeContext?: boolean;
    timeout?: number;
    retries?: number;
}
export interface LLMResponse {
    content: string;
    confidence: number;
    tokensUsed: number;
    processingTime: number;
    metadata?: Record<string, any>;
}
export interface CodeGenerationRequest {
    description: string;
    language: string;
    framework?: string;
    existingCode?: string;
    projectContext?: string;
    constraints?: string[];
}
export interface CodeGenerationResponse extends LLMResponse {
    code: string;
    explanation: string;
    dependencies: string[];
    testSuggestions: string[];
}
export interface CodeReviewRequest {
    code: string;
    language: string;
    reviewFocus?: 'security' | 'performance' | 'maintainability' | 'all';
    projectContext?: string;
}
export interface CodeReviewResponse extends LLMResponse {
    issues: CodeIssue[];
    suggestions: CodeSuggestion[];
    quality: QualityScore;
}
export interface CodeIssue {
    type: 'error' | 'warning' | 'info';
    category: 'syntax' | 'logic' | 'security' | 'performance' | 'style';
    line: number;
    column?: number;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface CodeSuggestion {
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    code?: string;
}
export interface QualityScore {
    overall: number;
    maintainability: number;
    reliability: number;
    security: number;
    performance: number;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    requirements: string[];
}
export interface CommandResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: Error;
}
export interface LLMContext {
    projectPath: string;
    language: string;
    framework?: string;
    files: string[];
    dependencies: string[];
    recent: RecentContext[];
}
export interface RecentContext {
    type: 'analysis' | 'generation' | 'review';
    content: string;
    timestamp: Date;
    tokens: number;
}
/**
 * Base implementation providing common functionality
 */
export declare abstract class BaseLLMProvider extends EventEmitter implements LLMProvider {
    readonly name: string;
    readonly version: string;
    readonly capabilities: LLMCapabilities;
    protected context: LLMContext | null;
    protected config: Record<string, any>;
    constructor(name: string, version: string, capabilities: LLMCapabilities);
    abstract analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    abstract generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    abstract reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    abstract isAvailable(): Promise<boolean>;
    abstract validateConfiguration(): Promise<ValidationResult>;
    abstract executeCommand(command: string, args: string[]): Promise<CommandResult>;
    setContext(context: LLMContext): void;
    getContext(): LLMContext | null;
    clearContext(): void;
    protected logUsage(operation: string, tokens: number, duration: number): void;
    protected validateRequest<T>(request: T, requiredFields: (keyof T)[]): void;
    protected handleError(error: unknown, operation: string): never;
}
/**
 * Registry for managing multiple LLM providers
 */
export declare class LLMProviderRegistry {
    private providers;
    private activeProvider;
    register(provider: LLMProvider): void;
    unregister(name: string): boolean;
    getProvider(name: string): LLMProvider | undefined;
    getActiveProvider(): LLMProvider | null;
    setActiveProvider(name: string): boolean;
    getAvailableProviders(): string[];
    getAvailableProvidersWithStatus(): Promise<Record<string, boolean>>;
    autoSelectBestProvider(): Promise<string | null>;
}
export declare const llmRegistry: LLMProviderRegistry;
//# sourceMappingURL=base-provider.d.ts.map