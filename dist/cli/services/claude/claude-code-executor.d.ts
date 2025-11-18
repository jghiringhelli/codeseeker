/**
 * Claude Code Executor Service
 * Single Responsibility: Handle all Claude Code CLI execution with consistent error handling
 * Dependency Inversion: Abstract interface for Claude Code interactions
 */
export interface ClaudeCodeExecutionOptions {
    projectPath?: string;
    maxTokens?: number;
    outputFormat?: 'text' | 'json';
    model?: string;
    systemPrompt?: string;
    timeout?: number;
}
export interface ClaudeCodeExecutionResult {
    success: boolean;
    data?: string;
    error?: string;
    tokensUsed?: number;
}
export declare class ClaudeCodeExecutor {
    private static readonly DEFAULT_TIMEOUT;
    private static readonly DEFAULT_MAX_TOKENS;
    /**
     * Execute Claude Code CLI with the provided prompt and options
     * All Claude Code interactions should go through this method
     */
    static execute(prompt: string, options?: ClaudeCodeExecutionOptions): Promise<ClaudeCodeExecutionResult>;
    /**
     * Check if Claude Code response includes assumptions that need user attention
     */
    static extractAssumptions(responseData: any): string[];
    /**
     * Estimate token usage for a given text
     */
    static estimateTokens(text: string): number;
}
//# sourceMappingURL=claude-code-executor.d.ts.map