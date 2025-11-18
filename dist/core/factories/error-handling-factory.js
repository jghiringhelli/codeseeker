"use strict";
/**
 * Error Handling Factory - SOLID implementation for error handling dependency injection
 * Single Responsibility: Create and configure error handling components
 * Dependency Inversion: Provides abstractions for error handling services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlingFactory = exports.ErrorHandlingFactory = void 0;
const error_handler_1 = require("../services/error-handler");
class ErrorHandlingFactory {
    static instance;
    constructor() { }
    static getInstance() {
        if (!ErrorHandlingFactory.instance) {
            ErrorHandlingFactory.instance = new ErrorHandlingFactory();
        }
        return ErrorHandlingFactory.instance;
    }
    /**
     * Create a complete error handler with all dependencies
     */
    createErrorHandler() {
        const logger = this.createErrorLogger();
        const reporter = this.createErrorReporter();
        const recovery = this.createErrorRecovery();
        return new error_handler_1.ErrorHandler(logger, reporter, recovery);
    }
    /**
     * Create error logger based on environment
     */
    createErrorLogger() {
        // In production, this could switch to FileErrorLogger, DatabaseErrorLogger, etc.
        return new error_handler_1.ConsoleErrorLogger();
    }
    /**
     * Create error reporter based on environment
     */
    createErrorReporter() {
        // In production, this could switch to SentryReporter, DataDogReporter, etc.
        return new error_handler_1.ConsoleErrorReporter();
    }
    /**
     * Create error recovery service
     */
    createErrorRecovery() {
        // In production, this could be more sophisticated with circuit breakers, retries, etc.
        return new error_handler_1.BasicErrorRecovery();
    }
    /**
     * Create error handler with custom dependencies
     */
    createCustomErrorHandler(logger, reporter, recovery) {
        return new error_handler_1.ErrorHandler(logger || this.createErrorLogger(), reporter || this.createErrorReporter(), recovery || this.createErrorRecovery());
    }
}
exports.ErrorHandlingFactory = ErrorHandlingFactory;
// Global instance for easy access
exports.errorHandlingFactory = ErrorHandlingFactory.getInstance();
//# sourceMappingURL=error-handling-factory.js.map