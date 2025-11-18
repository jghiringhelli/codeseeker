/**
 * Watcher Command Handler
 * Single Responsibility: Handle file watching commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class WatcherCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=watcher-command-handler.d.ts.map