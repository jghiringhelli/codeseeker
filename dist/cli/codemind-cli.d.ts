#!/usr/bin/env node
/**
 * CodeMindCLI - SOLID Principles Implementation
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 * Following SOLID architecture with proper dependency injection
 */
export declare class CodeMindCLI {
    private rl;
    private projectManager;
    private commandProcessor;
    private databaseManager;
    private userInterface;
    private instructionService;
    private interruptManager;
    private claudeForwarder;
    private currentProject;
    private activeOperations;
    constructor();
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
     * Internal operation handler to be tracked
     */
    private processInputOperation;
    /**
     * Auto-detect CodeMind project - Delegated to ProjectManager (SOLID)
     */
    private autoDetectProject;
    /**
     * Set project path programmatically (for command-line options)
     */
    setProjectPath(projectPath: string): void;
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