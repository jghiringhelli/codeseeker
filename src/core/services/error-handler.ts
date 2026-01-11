/**
 * Error Handler Service - SOLID implementation for centralized error handling
 * Single Responsibility: Handle errors consistently across the application
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */

import {
  IErrorHandler,
  IErrorLogger,
  IErrorReporter,
  IErrorRecovery,
  CodeSeekerError,
  Result,
  SuccessResult,
  ErrorResult
} from '../interfaces/error-interfaces';

export class ErrorHandler implements IErrorHandler {
  constructor(
    private logger: IErrorLogger,
    private reporter: IErrorReporter,
    private recovery: IErrorRecovery
  ) {}

  async handle(error: CodeSeekerError): Promise<Result<any>> {
    try {
      // Log the error
      await this.logger.log(error);

      // Report critical errors
      if (this.isCritical(error)) {
        await this.reporter.reportCritical(error);
      }

      // Return error result
      return this.createErrorResult(error);
    } catch (handlingError) {
      // If error handling itself fails, create a simple error result
      const fallbackError: CodeSeekerError = {
        type: 'project',
        code: 'ERROR_HANDLER_FAILURE',
        message: 'Error handler failed to process error',
        timestamp: new Date().toISOString(),
        operation: 'error_handling',
        context: { originalError: error, handlingError }
      } as any;

      return this.createErrorResult(fallbackError);
    }
  }

  async handleWithRecovery(error: CodeSeekerError): Promise<Result<any>> {
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
        } else {
          console.log(`❌ Recovery failed for error: ${error.code}`);
          // Report failed recovery
          await this.reporter.report(error);
        }
      }

      // If no recovery possible or recovery failed, report error
      if (this.isCritical(error)) {
        await this.reporter.reportCritical(error);
      } else {
        await this.reporter.report(error);
      }

      return this.createErrorResult(error);
    } catch (handlingError) {
      return this.handle(error); // Fallback to basic handling
    }
  }

  isRecoverable(error: CodeSeekerError): boolean {
    return this.recovery.canRecover(error);
  }

  private isCritical(error: CodeSeekerError): boolean {
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

  private createErrorResult(error: CodeSeekerError): ErrorResult {
    return {
      success: false,
      error
    };
  }
}

// Error Logger Implementation
export class ConsoleErrorLogger implements IErrorLogger {
  async log(error: CodeSeekerError): Promise<void> {
    const timestamp = new Date(error.timestamp).toLocaleString();
    console.error(`[${timestamp}] ${error.type.toUpperCase()}: ${error.code}`);
    console.error(`Message: ${error.message}`);

    if (error.context) {
      console.error('Context:', JSON.stringify(error.context, null, 2));
    }
  }

  async logWithContext(error: CodeSeekerError, context: Record<string, any>): Promise<void> {
    const enhancedError = {
      ...error,
      context: { ...error.context, ...context }
    };
    await this.log(enhancedError);
  }
}

// Error Reporter Implementation
export class ConsoleErrorReporter implements IErrorReporter {
  async report(error: CodeSeekerError): Promise<void> {
    console.warn(`⚠️  Error reported: ${error.code} - ${error.message}`);
  }

  async reportCritical(error: CodeSeekerError): Promise<void> {
    console.error(`🚨 CRITICAL ERROR: ${error.code}`);
    console.error(`Type: ${error.type}`);
    console.error(`Message: ${error.message}`);
    console.error(`Timestamp: ${error.timestamp}`);

    // In a real implementation, this would send to monitoring systems
    // such as Sentry, DataDog, CloudWatch, etc.
  }
}

// Basic Error Recovery Implementation
export class BasicErrorRecovery implements IErrorRecovery {
  canRecover(error: CodeSeekerError): boolean {
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

  async recover(error: CodeSeekerError): Promise<Result<any>> {
    switch (error.type) {
      case 'network':
        return this.retryNetworkOperation(error as any);
      case 'filesystem':
        return this.retryFileOperation(error as any);
      case 'validation':
        return this.provideDefaultValue(error as any);
      default:
        return {
          success: false,
          error
        };
    }
  }

  private async retryNetworkOperation(error: any): Promise<Result<any>> {
    // Simulate retry logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      data: { retried: true, originalError: error.code }
    };
  }

  private async retryFileOperation(error: any): Promise<Result<any>> {
    // Simulate file retry logic
    return {
      success: true,
      data: { defaultContent: '', originalError: error.code }
    };
  }

  private async provideDefaultValue(error: any): Promise<Result<any>> {
    return {
      success: true,
      data: { defaultValue: null, field: error.field }
    };
  }
}