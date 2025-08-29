import { EventEmitter } from 'events';

/**
 * Base interface that all LLM providers must implement
 * Designed to work with CLI tools similar to Claude Code
 */
export interface LLMProvider {
    readonly name: string;
    readonly version: string;
    readonly capabilities: LLMCapabilities;
    
    // Core methods
    analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    
    // CLI integration
    isAvailable(): Promise<boolean>;
    validateConfiguration(): Promise<ValidationResult>;
    executeCommand(command: string, args: string[]): Promise<CommandResult>;
    
    // Context management
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
    overall: number; // 0-100
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
export abstract class BaseLLMProvider extends EventEmitter implements LLMProvider {
    protected context: LLMContext | null = null;
    protected config: Record<string, any> = {};

    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly capabilities: LLMCapabilities
    ) {
        super();
    }

    // Abstract methods that must be implemented
    abstract analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    abstract generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    abstract reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    abstract isAvailable(): Promise<boolean>;
    abstract validateConfiguration(): Promise<ValidationResult>;
    abstract executeCommand(command: string, args: string[]): Promise<CommandResult>;

    // Common implementations
    setContext(context: LLMContext): void {
        this.context = context;
        this.emit('context-updated', context);
    }

    getContext(): LLMContext | null {
        return this.context;
    }

    clearContext(): void {
        this.context = null;
        this.emit('context-cleared');
    }

    protected logUsage(operation: string, tokens: number, duration: number): void {
        this.emit('usage', {
            provider: this.name,
            operation,
            tokens,
            duration,
            timestamp: new Date()
        });
    }

    protected validateRequest<T>(request: T, requiredFields: (keyof T)[]): void {
        for (const field of requiredFields) {
            if (!request[field]) {
                throw new Error(`Missing required field: ${String(field)}`);
            }
        }
    }

    protected handleError(error: unknown, operation: string): never {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', {
            provider: this.name,
            operation,
            error: err,
            timestamp: new Date()
        });
        throw err;
    }
}

/**
 * Registry for managing multiple LLM providers
 */
export class LLMProviderRegistry {
    private providers = new Map<string, LLMProvider>();
    private activeProvider: string | null = null;

    register(provider: LLMProvider): void {
        this.providers.set(provider.name, provider);
    }

    unregister(name: string): boolean {
        return this.providers.delete(name);
    }

    getProvider(name: string): LLMProvider | undefined {
        return this.providers.get(name);
    }

    getActiveProvider(): LLMProvider | null {
        if (!this.activeProvider) return null;
        return this.providers.get(this.activeProvider) || null;
    }

    setActiveProvider(name: string): boolean {
        if (!this.providers.has(name)) {
            throw new Error(`Provider '${name}' not registered`);
        }
        this.activeProvider = name;
        return true;
    }

    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    async getAvailableProvidersWithStatus(): Promise<Record<string, boolean>> {
        const result: Record<string, boolean> = {};
        
        for (const [name, provider] of this.providers.entries()) {
            try {
                result[name] = await provider.isAvailable();
            } catch {
                result[name] = false;
            }
        }
        
        return result;
    }

    async autoSelectBestProvider(): Promise<string | null> {
        const providers = Array.from(this.providers.entries());
        
        // Check availability in order of preference
        for (const [name, provider] of providers) {
            try {
                if (await provider.isAvailable()) {
                    this.setActiveProvider(name);
                    return name;
                }
            } catch {
                // Continue to next provider
            }
        }
        
        return null;
    }
}

// Global registry instance
export const llmRegistry = new LLMProviderRegistry();