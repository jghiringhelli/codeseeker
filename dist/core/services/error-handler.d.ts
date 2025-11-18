/**
 * Error Handler Service - SOLID implementation for centralized error handling
 * Single Responsibility: Handle errors consistently across the application
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
import { IErrorHandler, IErrorLogger, IErrorReporter, IErrorRecovery, CodeMindError, Result } from '../interfaces/error-interfaces';
export declare class ErrorHandler implements IErrorHandler {
    private logger;
    private reporter;
    private recovery;
    constructor(logger: IErrorLogger, reporter: IErrorReporter, recovery: IErrorRecovery);
    handle(error: CodeMindError): Promise<Result<any>>;
    handleWithRecovery(error: CodeMindError): Promise<Result<any>>;
    isRecoverable(error: CodeMindError): boolean;
    private isCritical;
    private createErrorResult;
}
export declare class ConsoleErrorLogger implements IErrorLogger {
    log(error: CodeMindError): Promise<void>;
    logWithContext(error: CodeMindError, context: Record<string, any>): Promise<void>;
}
export declare class ConsoleErrorReporter implements IErrorReporter {
    report(error: CodeMindError): Promise<void>;
    reportCritical(error: CodeMindError): Promise<void>;
}
export declare class BasicErrorRecovery implements IErrorRecovery {
    canRecover(error: CodeMindError): boolean;
    recover(error: CodeMindError): Promise<Result<any>>;
    private retryNetworkOperation;
    private retryFileOperation;
    private provideDefaultValue;
}
//# sourceMappingURL=error-handler.d.ts.map