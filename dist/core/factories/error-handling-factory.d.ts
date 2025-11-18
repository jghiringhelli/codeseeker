/**
 * Error Handling Factory - SOLID implementation for error handling dependency injection
 * Single Responsibility: Create and configure error handling components
 * Dependency Inversion: Provides abstractions for error handling services
 */
import { IErrorHandler, IErrorLogger, IErrorReporter, IErrorRecovery } from '../interfaces/error-interfaces';
export declare class ErrorHandlingFactory {
    private static instance;
    private constructor();
    static getInstance(): ErrorHandlingFactory;
    /**
     * Create a complete error handler with all dependencies
     */
    createErrorHandler(): IErrorHandler;
    /**
     * Create error logger based on environment
     */
    createErrorLogger(): IErrorLogger;
    /**
     * Create error reporter based on environment
     */
    createErrorReporter(): IErrorReporter;
    /**
     * Create error recovery service
     */
    createErrorRecovery(): IErrorRecovery;
    /**
     * Create error handler with custom dependencies
     */
    createCustomErrorHandler(logger?: IErrorLogger, reporter?: IErrorReporter, recovery?: IErrorRecovery): IErrorHandler;
}
export declare const errorHandlingFactory: ErrorHandlingFactory;
//# sourceMappingURL=error-handling-factory.d.ts.map