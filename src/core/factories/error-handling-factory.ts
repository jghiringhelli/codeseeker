/**
 * Error Handling Factory - SOLID implementation for error handling dependency injection
 * Single Responsibility: Create and configure error handling components
 * Dependency Inversion: Provides abstractions for error handling services
 */

import {
  IErrorHandler,
  IErrorLogger,
  IErrorReporter,
  IErrorRecovery
} from '../interfaces/error-interfaces';

import {
  ErrorHandler,
  ConsoleErrorLogger,
  ConsoleErrorReporter,
  BasicErrorRecovery
} from '../services/error-handler';

export class ErrorHandlingFactory {
  private static instance: ErrorHandlingFactory;

  private constructor() {}

  static getInstance(): ErrorHandlingFactory {
    if (!ErrorHandlingFactory.instance) {
      ErrorHandlingFactory.instance = new ErrorHandlingFactory();
    }
    return ErrorHandlingFactory.instance;
  }

  /**
   * Create a complete error handler with all dependencies
   */
  createErrorHandler(): IErrorHandler {
    const logger = this.createErrorLogger();
    const reporter = this.createErrorReporter();
    const recovery = this.createErrorRecovery();

    return new ErrorHandler(logger, reporter, recovery);
  }

  /**
   * Create error logger based on environment
   */
  createErrorLogger(): IErrorLogger {
    // In production, this could switch to FileErrorLogger, DatabaseErrorLogger, etc.
    return new ConsoleErrorLogger();
  }

  /**
   * Create error reporter based on environment
   */
  createErrorReporter(): IErrorReporter {
    // In production, this could switch to SentryReporter, DataDogReporter, etc.
    return new ConsoleErrorReporter();
  }

  /**
   * Create error recovery service
   */
  createErrorRecovery(): IErrorRecovery {
    // In production, this could be more sophisticated with circuit breakers, retries, etc.
    return new BasicErrorRecovery();
  }

  /**
   * Create error handler with custom dependencies
   */
  createCustomErrorHandler(
    logger?: IErrorLogger,
    reporter?: IErrorReporter,
    recovery?: IErrorRecovery
  ): IErrorHandler {
    return new ErrorHandler(
      logger || this.createErrorLogger(),
      reporter || this.createErrorReporter(),
      recovery || this.createErrorRecovery()
    );
  }
}

// Global instance for easy access
export const errorHandlingFactory = ErrorHandlingFactory.getInstance();