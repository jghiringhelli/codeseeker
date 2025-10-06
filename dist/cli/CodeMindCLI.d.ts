/**
 * CodeMindCLI - Lightweight orchestrator for the CLI
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 */
export declare class CodeMindCLI {
    private rl;
    private projectManager;
    private commandProcessor;
    private databaseManager;
    private userInterface;
    private currentProject;
    constructor();
    /**
     * Start the CLI
     */
    start(): Promise<void>;
    /**
     * Setup event handlers for readline
     */
    private setupEventHandlers;
    /**
     * Process user input through command processor
     */
    private processInput;
    /**
     * Auto-detect CodeMind project in current directory
     */
    private autoDetectProject;
}
/**
 * Main entry point
 */
export declare function main(): Promise<void>;
export default CodeMindCLI;
//# sourceMappingURL=CodeMindCLI.d.ts.map