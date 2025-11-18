/**
 * Analyze Command Handler
 * Single Responsibility: Handle code analysis commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class AnalyzeCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=analyze-command-handler.d.ts.map