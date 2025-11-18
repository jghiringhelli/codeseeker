/**
 * Instructions Command Handler
 * Single Responsibility: Handle instructions management commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class InstructionsCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=instructions-command-handler.d.ts.map