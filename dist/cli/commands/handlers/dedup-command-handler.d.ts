/**
 * Dedup Command Handler
 * Single Responsibility: Handle deduplication commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class DedupCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=dedup-command-handler.d.ts.map