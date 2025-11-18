/**
 * Project Command Handler
 * Single Responsibility: Handle project management commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class ProjectCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=project-command-handler.d.ts.map