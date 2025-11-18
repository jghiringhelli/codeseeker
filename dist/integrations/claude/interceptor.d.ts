import { EventEmitter } from 'events';
/**
 * Claude Code Interceptor
 * Intercepts and enhances Claude Code CLI commands with additional context
 */
export interface InterceptorOptions {
    projectPath: string;
    enhance?: boolean;
    enableQualityChecks?: boolean;
    enableContextOptimization?: boolean;
    enableRealTimeGuidance?: boolean;
    enableLearning?: boolean;
    maxContextTokens?: number;
    logLevel?: 'silent' | 'normal' | 'verbose';
}
export interface InterceptedCommand {
    command: string;
    args: string[];
    timestamp: Date;
    enhanced: boolean;
}
export interface CommandResult {
    success: boolean;
    output?: string;
    error?: string;
    exitCode?: number;
}
export declare class ClaudeCodeInterceptor extends EventEmitter {
    private options;
    private activeProcess?;
    private commandHistory;
    constructor(options: InterceptorOptions);
    /**
     * Initialize the interceptor
     */
    initialize(config?: any): Promise<void>;
    /**
     * Start Claude Code in the background
     */
    startClaudeCode(options?: any): Promise<void>;
    /**
     * Intercept and enhance a Claude Code command
     */
    intercept(command: string, args?: string[]): Promise<CommandResult>;
    /**
     * Enhance command arguments with additional context
     */
    private enhanceArguments;
    /**
     * Execute the actual Claude Code command
     */
    private executeCommand;
    /**
     * Generate enhanced context for Claude Code
     */
    generateEnhancedContext(query: string, projectPath: string): Promise<string>;
    /**
     * Stop any active process
     */
    stop(): void;
    /**
     * Get command history
     */
    getHistory(): InterceptedCommand[];
    /**
     * Clear command history
     */
    clearHistory(): void;
    /**
     * Check if Claude Code CLI is available
     */
    static isAvailable(): Promise<boolean>;
}
export default ClaudeCodeInterceptor;
//# sourceMappingURL=interceptor.d.ts.map