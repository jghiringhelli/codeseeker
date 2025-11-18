#!/usr/bin/env node
/**
 * CodeMindCLI - SOLID Principles Implementation
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 * Following SOLID architecture with proper dependency injection
 */
export declare class CodeMindCLI {
    private rl;
    private commandProcessor;
    private context;
    private currentProject;
    private activeOperations;
    private currentAbortController?;
    constructor();
    /**
     * Start silently for command mode (no welcome, no interactive prompt)
     */
    startSilent(): Promise<void>;
    /**
     * Start the CLI - SOLID implementation with immediate prompt
     */
    start(): Promise<void>;
    /**
     * Setup event handlers for readline - SOLID event handling
     */
    private setupEventHandlers;
    /**
     * Process user input through command processor - Single Responsibility
     */
    private processInput;
    /**
     * Sync project context with command processor (optimized)
     */
    private syncProjectContext;
    /**
     * Create a timeout promise with abort controller support
     */
    private createTimeoutPromise;
    /**
     * Internal operation handler to be tracked
     */
    private processInputOperation;
    /**
     * Auto-detect CodeMind project silently (no output)
     */
    private autoDetectProjectSilent;
    /**
     * Auto-detect CodeMind project - Delegated to ProjectManager (SOLID)
     */
    private autoDetectProject;
    /**
     * Set project path programmatically (for command-line options)
     */
    setProjectPath(projectPath: string): void;
    /**
     * Check database connections on startup
     */
    private checkDatabaseConnections;
    /**
     * Cleanup resources on exit
     */
    private cleanup;
}
/**
 * Main entry point - SOLID architecture
 */
export declare function main(): Promise<void>;
export default CodeMindCLI;
//# sourceMappingURL=codemind-cli.d.ts.map