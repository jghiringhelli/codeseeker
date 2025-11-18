/**
 * Command Service Factory - Dependency Injection
 * Creates command services that implement proper interfaces
 * Now includes error handling for SOLID compliance
 */
import { CommandContext } from '../../cli/commands/command-context';
import { IErrorHandler } from '../interfaces/error-interfaces';
export declare class CommandServiceFactory {
    private static instance;
    private constructor();
    static getInstance(): CommandServiceFactory;
    /**
     * Create a complete command context with all services properly injected
     * Now includes error handling for SOLID compliance
     */
    createCommandContext(): CommandContext;
    /**
     * Create error handler service
     */
    createErrorHandler(): IErrorHandler;
    /**
     * Create command context with custom implementations (for testing)
     */
    createCommandContextWithCustomServices(services: Partial<CommandContext>): CommandContext;
}
//# sourceMappingURL=command-service-factory.d.ts.map