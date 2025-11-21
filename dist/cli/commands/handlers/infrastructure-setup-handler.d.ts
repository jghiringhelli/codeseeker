/**
 * Infrastructure Setup Command Handler
 * Single Responsibility: Handle one-time infrastructure setup (Docker, databases, etc.)
 * Used when first cloning the project or setting up a new development environment
 *
 * Now uses SOLID-compliant setup architecture with proper dependency injection
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class InfrastructureSetupHandler extends BaseCommandHandler {
    private logger;
    /**
     * Handle infrastructure setup command using SOLID-compliant services
     */
    handle(args: string): Promise<CommandResult>;
    /**
     * Parse setup command arguments into options
     */
    private parseSetupOptions;
}
//# sourceMappingURL=infrastructure-setup-handler.d.ts.map