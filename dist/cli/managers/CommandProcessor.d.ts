/**
 * CommandProcessor - Handles command parsing, routing, and help system
 * Single Responsibility: Command processing and routing
 */
import { ProjectManager } from './ProjectManager';
import { DatabaseManager } from './DatabaseManager';
import { UserInterface } from './UserInterface';
export interface CommandContext {
    projectManager: ProjectManager;
    claudeOrchestrator: any;
    databaseManager: DatabaseManager;
    userInterface: UserInterface;
    currentProject?: any;
}
export interface CommandResult {
    success: boolean;
    message?: string;
    data?: any;
}
export declare class CommandProcessor {
    private context;
    constructor(context: CommandContext);
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
    private handleInit;
    private handleStatus;
    private handleProject;
    private handleSearch;
    private handleAnalyze;
    private handleHelp;
    private handleExit;
    /**
     * Reset database tables for clean initialization
     */
    private resetDatabase;
}
//# sourceMappingURL=CommandProcessor.d.ts.map