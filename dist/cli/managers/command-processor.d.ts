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
}
export { CommandContext, CommandResult } from '../commands/command-context';
export { ClaudeCodeExecutionOptions, ClaudeCodeExecutionResult } from '../services/claude/claude-code-executor';
//# sourceMappingURL=command-processor.d.ts.map