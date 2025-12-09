/**
 * Command Router - Refactored for SOLID Principles
 * Single Responsibility: Route commands to appropriate handlers
 * Open/Closed Principle: Easy to add new command handlers without modification
 * Dependency Inversion: Depends on abstractions and uses dependency injection
 */
import * as readline from 'readline';
import { CommandContext, CommandResult } from './command-context';
import { WorkflowOrchestrator } from './services/workflow-orchestrator';
export interface HistoryCallbacks {
    getHistory: () => string[];
    clearHistory: () => void;
    getHistoryFile: () => string;
}
export declare class CommandRouter {
    private context;
    private handlers;
    private rl?;
    private workflowOrchestrator;
    private transparentMode;
    private historyCallbacks?;
    constructor(context: CommandContext, workflowOrchestrator?: WorkflowOrchestrator);
    /**
     * Set the readline interface for user interaction
     * Passes it to the workflow orchestrator to avoid readline/inquirer conflicts
     */
    setReadlineInterface(rl: readline.Interface): void;
    /**
     * Set transparent mode (skip interactive prompts)
     */
    setTransparentMode(enabled: boolean): void;
    /**
     * Set history callbacks (for /history command)
     */
    setHistoryCallbacks(callbacks: HistoryCallbacks): void;
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
     * Handle history command
     */
    private handleHistory;
    /**
     * Get available commands
     */
    getAvailableCommands(): string[];
    /**
     * Handle natural language queries using the workflow orchestrator
     * Delegates to WorkflowOrchestrator following SOLID principles
     */
    private handleNaturalLanguage;
    /**
     * Get the workflow orchestrator instance for testing
     */
    getWorkflowOrchestrator(): WorkflowOrchestrator;
    /**
     * Set a new workflow orchestrator (for testing or different configurations)
     */
    setWorkflowOrchestrator(orchestrator: WorkflowOrchestrator): void;
}
//# sourceMappingURL=command-router.d.ts.map