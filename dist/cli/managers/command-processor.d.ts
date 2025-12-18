/**
 * Command Processor
 * Single Responsibility: Coordinate command routing and provide static Claude Code execution
 * Dependency Inversion: Uses command router and handlers for actual processing
 */
import * as readline from 'readline';
import { HistoryCallbacks } from '../commands/command-router';
import { CommandContext, CommandResult } from '../commands/command-context';
import { ClaudeCodeExecutionOptions, ClaudeCodeExecutionResult } from '../services/claude/claude-code-executor';
export declare class CommandProcessor {
    private router;
    private context;
    private transparentMode;
    constructor(context: CommandContext);
    /**
     * Set the readline interface for user interaction
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
     */
    setNoSearchMode(enabled: boolean): void;
    /**
     * Prepare for a new prompt (manages search toggle state)
     */
    prepareForNewPrompt(): void;
    /**
     * Mark conversation as complete (for REPL mode)
     */
    markConversationComplete(): void;
    /**
     * Set history callbacks (for /history command)
     */
    setHistoryCallbacks(callbacks: HistoryCallbacks): void;
    /**
     * Process user input and route to appropriate handler
     */
    processInput(input: string): Promise<CommandResult>;
    /**
     * Centralized Claude Code CLI execution method
     * All Claude Code interactions should go through this method
     * STATIC: Can be used without instantiating CommandProcessor
     */
    static executeClaudeCode(prompt: string, options?: ClaudeCodeExecutionOptions): Promise<ClaudeCodeExecutionResult>;
    /**
     * Get available commands from router
     */
    getAvailableCommands(): string[];
    /**
     * Display the search toggle indicator
     * Shows radio-button style indicator: "( * ) Search files and knowledge graph"
     */
    displaySearchToggleIndicator(): void;
    /**
     * Get the user interaction service (for advanced search toggle control)
     */
    getUserInteractionService(): import("../commands/services/user-interaction-service").UserInteractionService;
}
export { CommandContext, CommandResult } from '../commands/command-context';
export { ClaudeCodeExecutionOptions, ClaudeCodeExecutionResult } from '../services/claude/claude-code-executor';
//# sourceMappingURL=command-processor.d.ts.map