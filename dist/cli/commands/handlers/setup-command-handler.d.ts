/**
 * Project Initialization Command Handler - Fully Implemented
 * Single Responsibility: Handle project initialization commands (per-project setup)
 * Implements project registration, indexing, and knowledge graph creation
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SetupCommandHandler extends BaseCommandHandler {
    private logger;
    /**
     * Handle setup/init commands
     */
    handle(args: string): Promise<CommandResult>;
    /**
     * Check if project.json has a path mismatch with current directory
     * This happens when a project folder is copied from another location
     */
    private checkProjectPathMismatch;
    /**
     * Perform complete database cleanup and reinitialization
     */
    private handleCompleteReset;
    /**
     * Clean up Neo4j knowledge graph data for a project
     */
    private cleanupNeo4jData;
    /**
     * Initialize a CodeMind project
     */
    private handleInit;
    /**
     * Setup system-wide configuration
     */
    private handleSetup;
    /**
     * Initialize database connection and basic tables
     */
    private initializeDatabase;
    /**
     * Build initial knowledge graph for the project
     */
    private buildInitialKnowledgeGraph;
    /**
     * Apply the consolidated database schema
     */
    private applyConsolidatedSchema;
    /**
     * Create basic tables if schema file is not available
     */
    private createBasicTables;
    /**
     * Initialize project record in database
     */
    private initializeProject;
    /**
     * Generate initial embeddings for the project (basic implementation)
     */
    private generateInitialEmbeddings;
    /**
     * Create CODEMIND.md instructions file
     */
    private createInstructionsFile;
    /**
     * Update local project configuration file
     */
    private updateLocalProjectConfig;
    /**
     * Index codebase for semantic search by delegating to search handler
     */
    private indexCodebase;
}
//# sourceMappingURL=setup-command-handler.d.ts.map