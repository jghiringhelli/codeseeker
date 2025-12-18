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
    private verboseMode;
    private commandMode;
    private noSearchMode;
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
     * Set verbose mode (show full debug output: files, relationships, prompt)
     */
    setVerboseMode(enabled: boolean): void;
    /**
     * Set command mode (when running with -c flag)
     * In command mode, search is always forced on
     */
    setCommandMode(enabled: boolean): void;
    /**
     * Set no-search mode (skip semantic search)
     * When enabled, prompts go directly to Claude without file discovery
     * This flag overrides commandMode - if noSearchMode is true, search is always OFF
     */
    setNoSearchMode(enabled: boolean): void;
    /**
     * Prepare for a new prompt (manages search toggle state)
     * Call this before processing each new prompt
     */
    prepareForNewPrompt(): void;
    /**
     * Mark conversation as complete (for REPL mode)
     * After workflow completes, search will default to OFF for next prompt
     */
    markConversationComplete(): void;
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
     * Handle search toggle command (s or /s)
     */
    private handleSearchToggle;
    /**
     * Display the search toggle indicator
     * Called before showing the prompt in REPL mode
     */
    displaySearchToggleIndicator(): void;
    /**
     * Get the user interaction service
     * Allows access to search toggle state and methods
     */
    getUserInteractionService(): import("./services/user-interaction-service").UserInteractionService;
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