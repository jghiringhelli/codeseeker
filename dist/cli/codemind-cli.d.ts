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
    private transparentMode;
    private commandMode;
    private commandModeCompleted;
    private replMode;
    private explicitExitRequested;
    private commandHistory;
    private historyFile;
    private historyDir;
    private static readonly MAX_HISTORY_SIZE;
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
     * Internal operation handler to be tracked
     * Note: No global timeout here - timeouts are handled at the service level
     * (database connections, Claude CLI calls) to avoid timing out during user input
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
     * Set transparent mode (skip interactive prompts, output context directly)
     */
    setTransparentMode(enabled: boolean): void;
    /**
     * Set command mode (single command execution with -c flag)
     * This prevents premature exit during inquirer prompts
     */
    setCommandMode(enabled: boolean): void;
    /**
     * Set REPL mode (interactive mode)
     * In REPL mode, the CLI only exits on explicit /exit or double Ctrl+C
     */
    setReplMode(enabled: boolean): void;
    /**
     * Request explicit exit (called by /exit command)
     */
    requestExit(): void;
    /**
     * Recreate readline interface after it's closed
     * This is used to recover from inquirer prompts or EOF signals
     */
    private recreateReadlineInterface;
    /**
     * Setup Escape key handler for interrupting operations
     * Uses keypress events to detect Escape without conflicting with readline
     */
    private setupEscapeKeyHandler;
    /**
     * Handle Escape key press - interrupt current operation
     */
    private handleEscapeKey;
    /**
     * Check database connections on startup
     */
    private checkDatabaseConnections;
    /**
     * Load command history from file
     */
    private loadHistory;
    /**
     * Save command history to file
     */
    private saveHistory;
    /**
     * Add command to history (avoid duplicates of last command)
     */
    private addToHistory;
    /**
     * Clear command history
     */
    private clearHistory;
    /**
     * Get current history file path
     */
    private getHistoryFile;
    /**
     * Get command history array
     */
    private getHistory;
    /**
     * Ensure history directory exists
     */
    private ensureHistoryDir;
    /**
     * Get project-specific history file path
     * Uses a hash of the project path to create unique history files per project
     */
    private getProjectHistoryFile;
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