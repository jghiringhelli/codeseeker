/**
 * SOLID Command Handler
 * Single Responsibility: Handle SOLID principles analysis commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SolidCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=solid-command-handler.d.ts.map