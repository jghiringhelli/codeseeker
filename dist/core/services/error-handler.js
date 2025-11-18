"use strict";
/**
 * Error Handler Service - SOLID implementation for centralized error handling
 * Single Responsibility: Handle errors consistently across the application
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicErrorRecovery = exports.ConsoleErrorReporter = exports.ConsoleErrorLogger = exports.ErrorHandler = void 0;
class ErrorHandler {
    logger;
    reporter;
    recovery;
    constructor(logger, reporter, recovery) {
        this.logger = logger;
        this.reporter = reporter;
        this.recovery = recovery;
    }
    async handle(error) {
        try {
            // Log the error
            await this.logger.log(error);
            // Report critical errors
            if (this.isCritical(error)) {
                await this.reporter.reportCritical(error);
            }
            // Return error result
            return this.createErrorResult(error);
        }
        catch (handlingError) {
            // If error handling itself fails, create a simple error result
            const fallbackError = {
                type: 'project',
                code: 'ERROR_HANDLER_FAILURE',
                message: 'Error handler failed to process error',
                timestamp: new Date().toISOString(),
                operation: 'error_handling',
                context: { originalError: error, handlingError }
            };
            return this.createErrorResult(fallbackError);
        }
    }
    async handleWithRecovery(error) {
        try {
            // First attempt standard handling
            await this.logger.log(error);
            // Check if recovery is possible
            if (this.recovery.canRecover(error)) {
                console.log(`🔄 Attempting recovery for error: ${error.code}`);
                const recoveryResult = await this.recovery.recover(error);
                if (recoveryResult.success) {
                    console.log(`✅ Recovery successful for error: ${error.code}`);
                    return recoveryResult;
                }
                else {
                    console.log(`❌ Recovery failed for error: ${error.code}`);
                    // Report failed recovery
                    await this.reporter.report(error);
                }
            }
            // If no recovery possible or recovery failed, report error
            if (this.isCritical(error)) {
                await this.reporter.reportCritical(error);
            }
            else {
                await this.reporter.report(error);
            }
            return this.createErrorResult(error);
        }
        catch (handlingError) {
            return this.handle(error); // Fallback to basic handling
        }
    }
    isRecoverable(error) {
        return this.recovery.canRecover(error);
    }
    isCritical(error) {
        // Define critical error conditions
        switch (error.type) {
            case 'database':
                return error.operation === 'connect' || error.message.includes('connection');
            case 'filesystem':
                return error.operation === 'write' && error.permissions === false;
            case 'project':
                return error.operation === 'initialize';
            case 'network':
                return error.statusCode === 500 || error.timeout === true;
            default:
                return false;
        }
    }
    createErrorResult(error) {
        return {
            success: false,
            error
        };
    }
}
exports.ErrorHandler = ErrorHandler;
// Error Logger Implementation
class ConsoleErrorLogger {
    async log(error) {
        const timestamp = new Date(error.timestamp).toLocaleString();
        console.error(`[${timestamp}] ${error.type.toUpperCase()}: ${error.code}`);
        console.error(`Message: ${error.message}`);
        if (error.context) {
            console.error('Context:', JSON.stringify(error.context, null, 2));
        }
    }
    async logWithContext(error, context) {
        const enhancedError = {
            ...error,
            context: { ...error.context, ...context }
        };
        await this.log(enhancedError);
    }
}
exports.ConsoleErrorLogger = ConsoleErrorLogger;
// Error Reporter Implementation
class ConsoleErrorReporter {
    async report(error) {
        console.warn(`⚠️  Error reported: ${error.code} - ${error.message}`);
    }
    async reportCritical(error) {
        console.error(`🚨 CRITICAL ERROR: ${error.code}`);
        console.error(`Type: ${error.type}`);
        console.error(`Message: ${error.message}`);
        console.error(`Timestamp: ${error.timestamp}`);
        // In a real implementation, this would send to monitoring systems
        // such as Sentry, DataDog, CloudWatch, etc.
    }
}
exports.ConsoleErrorReporter = ConsoleErrorReporter;
// Basic Error Recovery Implementation
class BasicErrorRecovery {
    canRecover(error) {
        switch (error.type) {
            case 'network':
                return error.statusCode !== 404 && !error.timeout;
            case 'filesystem':
                return error.operation === 'read' && !error.permissions;
            case 'database':
                return error.operation !== 'connect';
            case 'validation':
                return true; // Validation errors are usually recoverable
            default:
                return false;
        }
    }
    async recover(error) {
        switch (error.type) {
            case 'network':
                return this.retryNetworkOperation(error);
            case 'filesystem':
                return this.retryFileOperation(error);
            case 'validation':
                return this.provideDefaultValue(error);
            default:
                return {
                    success: false,
                    error
                };
        }
    }
    async retryNetworkOperation(error) {
        // Simulate retry logic
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            success: true,
            data: { retried: true, originalError: error.code }
        };
    }
    async retryFileOperation(error) {
        // Simulate file retry logic
        return {
            success: true,
            data: { defaultContent: '', originalError: error.code }
        };
    }
    async provideDefaultValue(error) {
        return {
            success: true,
            data: { defaultValue: null, field: error.field }
        };
    }
}
exports.BasicErrorRecovery = BasicErrorRecovery;
//# sourceMappingURL=error-handler.js.map