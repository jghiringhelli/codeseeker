/**
 * Docs Command Handler
 * Single Responsibility: Handle documentation commands
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class DocsCommandHandler extends BaseCommandHandler {
    handle(args: string): Promise<CommandResult>;
}
//# sourceMappingURL=docs-command-handler.d.ts.map