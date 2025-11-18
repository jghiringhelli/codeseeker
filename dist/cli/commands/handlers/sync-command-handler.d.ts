/**
 * Sync Command Handler
 * Single Responsibility: Handle synchronization commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SyncCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=sync-command-handler.d.ts.map