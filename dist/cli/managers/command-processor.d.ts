/**
 * CommandProcessor - Handles command parsing, routing, and help system
 * Single Responsibility: Command processing and routing
 */
import * as readline from 'readline';
import { ProjectManager } from './project-manager';
import { DatabaseManager } from './database-manager';
import { UserInterface } from './user-interface';
import { CodeMindInstructionService } from '../services/codemind-instruction-service';
import { InterruptManager } from './interrupt-manager';
import { ClaudeCodeForwarder } from './claude-code-forwarder';
export interface CommandContext {
    projectManager: ProjectManager;
    claudeOrchestrator: any;
    databaseManager: DatabaseManager;
    userInterface: UserInterface;
    instructionService: CodeMindInstructionService;
    interruptManager: InterruptManager;
    claudeForwarder: ClaudeCodeForwarder;
    currentProject?: any;
}
export interface CommandResult {
    success: boolean;
    message?: string;
    data?: any;
}
export declare class CommandProcessor {
    private context;
    private syncManager;
    private fileWatcher;
    private assumptionDetector;
    private databaseHealthService;
    private rl?;
    constructor(context: CommandContext);
    /**
     * Set the readline interface for user interaction
     */
    setReadlineInterface(rl: readline.Interface): void;
    /**
     * Parse path and flags from command arguments
     */
    private parsePathAndFlags;
    /**
     * Process any input - either command or natural language
     */
    processInput(input: string): Promise<CommandResult>;
    /**
     * Process slash commands
     */
    private processCommand;
    /**
     * Process natural language queries through Claude Code
     */
    private processNaturalLanguage;
    private handleSetup;
    handleInit(args: string): Promise<CommandResult>;
    private handleStatus;
    private handleProject;
    private handleSearch;
    private handleAnalyze;
    private handleDedup;
    /**
     * Handle dedup analyze command
     */
    private handleDedupAnalyze;
    /**
     * Handle dedup merge command
     */
    private handleDedupMerge;
    /**
     * Parse deduplication options from command arguments
     */
    private parseDeduplicationOptions;
    private handleHelp;
    private handleExit;
    /**
     * Sync project data with current state (incremental update)
     */
    private syncProject;
    /**
     * Intelligent sync with Redis-based change detection
     */
    private intelligentSyncProject;
    /**
     * Sync only changed files for performance
     */
    private syncChangedFiles;
    /**
     * Scan project files for sync analysis
     */
    private scanProjectFiles;
    /**
     * Remove embeddings for deleted files
     */
    private removeDeletedFileEmbeddings;
    /**
     * Clear all project data from databases
     */
    private clearProjectData;
    /**
     * Reset database tables for clean initialization
     */
    private resetDatabase;
    /**
     * Handle SOLID principles analysis and refactoring
     */
    private handleSolid;
    /**
     * Handle SOLID analyze command
     */
    private handleSolidAnalyze;
    /**
     * Handle SOLID refactor command
     */
    private handleSolidRefactor;
    /**
     * Handle documentation generation
     */
    private handleDocs;
    /**
     * Handle docs generate command
     */
    private handleDocsGenerate;
    /**
     * Auto-ingest documentation during project initialization
     */
    private autoIngestDocumentation;
    /**
     * Handle docs ingest command
     */
    private handleDocsIngest;
    /**
     * Handle docs search command
     */
    private handleDocsSearch;
    /**
     * Handle docs fetch command (internet documentation fetching)
     */
    private handleDocsFetch;
    /**
     * Handle instructions command - mirrors Claude Code's CLAUDE.md functionality
     */
    private handleInstructions;
    /**
     * Show current project instructions
     */
    private handleInstructionsShow;
    /**
     * Create sample CODEMIND.md file
     */
    private handleInstructionsCreate;
    /**
     * Edit instructions file (opens in default editor)
     */
    private handleInstructionsEdit;
    /**
     * Reload instructions cache
     */
    private handleInstructionsReload;
    /**
     * Handle sync command for semantic search and graph consistency
     */
    private handleSync;
    /**
     * Run intelligent sync with options
     */
    private handleSyncRun;
    /**
     * Quick sync check
     */
    private handleSyncCheck;
    /**
     * Force full sync
     */
    private handleSyncForce;
    /**
     * Show sync status
     */
    private handleSyncStatus;
    /**
     * Handle file watcher commands
     */
    private handleSyncWatcher;
    /**
     * Start file watcher
     */
    private handleWatcherStart;
    /**
     * Stop file watcher
     */
    private handleWatcherStop;
    /**
     * Show file watcher status
     */
    private handleWatcherStatus;
    /**
     * Enhance query with assumption detection information for Claude Code
     */
    private enhanceQueryForClaudeCode;
    /**
     * Check if Claude Code response includes assumptions and display them
     */
    private checkClaudeCodeAssumptions;
}
//# sourceMappingURL=command-processor.d.ts.map