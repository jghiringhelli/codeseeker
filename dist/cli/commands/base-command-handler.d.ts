/**
 * Base Command Handler
 * Single Responsibility: Provide common functionality for all command handlers
 * Open/Closed Principle: Extensible base class for new command types
 */
import { CommandContext, CommandResult, PathAnalysisOptions } from './command-context';
export declare abstract class BaseCommandHandler {
    protected context: CommandContext;
    constructor(context: CommandContext);
    /**
     * Parse path and flags from command arguments
     */
    protected parsePathAndFlags(args: string): PathAnalysisOptions;
    /**
     * Check if current project is available
     */
    protected requireProject(): CommandResult | null;
    /**
     * Parse boolean flags from arguments
     */
    protected parseFlags(args: string, flagMappings: Record<string, string[]>): Record<string, boolean>;
    /**
     * Extract specific argument values (e.g., --tech-stack=react,node)
     */
    protected extractArgValue(args: string, argName: string): string | null;
    /**
     * Abstract method that each command handler must implement
     */
    abstract handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=base-command-handler.d.ts.map