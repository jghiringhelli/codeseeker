/**
 * Command Router
 * Single Responsibility: Route commands to appropriate handlers
 * Open/Closed Principle: Easy to add new command handlers without modification
 * Dependency Inversion: Depends on abstractions (BaseCommandHandler)
 */
import * as readline from 'readline';
import { CommandContext, CommandResult } from './command-context';
export declare class CommandRouter {
    private context;
    private handlers;
    private rl?;
    constructor(context: CommandContext);
    /**
     * Set the readline interface for user interaction
     */
    setReadlineInterface(rl: readline.Interface): void;
    /**
     * Initialize all command handlers
     * Open/Closed: Add new handlers here without modifying existing code
     */
    private initializeHandlers;
    /**
     * Process user input and route to appropriate handler
     */
    processInput(input: string): Promise<CommandResult>;
    /**
     * Route command to appropriate handler
     */
    private routeToHandler;
    /**
     * Handle help command
     */
    private handleHelp;
    /**
     * Handle exit command
     */
    private handleExit;
    /**
     * Handle status command
     */
    private handleStatus;
    /**
     * Get available commands
     */
    getAvailableCommands(): string[];
    /**
     * Detect if input is likely natural language vs a command
     */
    private isNaturalLanguageQuery;
    /**
     * Handle natural language queries with enhanced CodeMind context
     * Core MVP Loop: Query → Analyze → Search → Context → Claude Code → Result
     */
    private handleNaturalLanguage;
    /**
     * Analyze query for assumptions and ambiguities
     */
    private analyzeQuery;
    /**
     * Perform semantic search to find relevant code
     */
    private performSemanticSearch;
    /**
     * Calculate semantic relevance of a file to the query
     */
    private calculateFileRelevance;
    /**
     * Determine file type from path patterns
     */
    private determineFileType;
    /**
     * Perform graph analysis to understand relationships
     */
    private performGraphAnalysis;
    /**
     * Extract class name from file path
     */
    private extractClassNameFromFile;
    /**
     * Extract package/namespace from file path
     */
    private extractPackageFromFile;
    /**
     * Generate class description based on file path and type
     */
    private generateClassDescription;
    /**
     * Detect if Claude Code is requesting user interaction
     */
    private detectClaudeCodeInteraction;
    private promptUserForSelection;
    /**
     * Build enhanced context for Claude Code with all gathered information
     */
    private buildEnhancedContext;
}
//# sourceMappingURL=command-router-old.d.ts.map