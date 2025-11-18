/**
 * Setup Command Handler - PROOF OF CONCEPT
 * Single Responsibility: Handle project setup and initialization commands
 * Note: Interface mismatches need to be resolved during full migration
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SetupCommandHandler extends BaseCommandHandler {
    /**
     * Handle setup/init commands
     */
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=setup-command-handler.d.ts.map