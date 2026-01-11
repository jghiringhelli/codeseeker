/**
 * Error Utilities - Helper functions for error handling
 * Following Single Responsibility and DRY principles
 */

import {
  CodeSeekerError,
  Result,
  SuccessResult,
  ErrorResult
} from '../interfaces/error-interfaces';
import { errorFactory } from '../factories/error-factory';

// Result creation utilities
export function createSuccessResult<T>(data: T): SuccessResult<T> {
  return {
    success: true,
    data
  };
}

export function createErrorResult(error: CodeSeekerError): ErrorResult {
  return {
    success: false,
    error
  };
}

// Type guards for error types
export function isDatabaseError(error: CodeSeekerError): error is CodeSeekerError & { type: 'database' } {
  return error.type === 'database';
}

export function isFileSystemError(error: CodeSeekerError): error is CodeSeekerError & { type: 'filesystem' } {
  return error.type === 'filesystem';
}

export function isValidationError(error: CodeSeekerError): error is CodeSeekerError & { type: 'validation' } {
  return error.type === 'validation';
}

export function isNetworkError(error: CodeSeekerError): error is CodeSeekerError & { type: 'network' } {
  return error.type === 'network';
}

export function isProjectError(error: CodeSeekerError): error is CodeSeekerError & { type: 'project' } {
  return error.type === 'project';
}

export function isSemanticAnalysisError(error: CodeSeekerError): error is CodeSeekerError & { type: 'semantic' } {
  return error.type === 'semantic';
}

export function isClaudeCodeError(error: CodeSeekerError): error is CodeSeekerError & { type: 'claude' } {
  return error.type === 'claude';
}

// Error conversion utilities
export function convertToCodeSeekerError(error: unknown, context?: Record<string, any>): CodeSeekerError {
  if (error instanceof Error) {
    // Try to detect error type from message patterns
    const message = error.message.toLowerCase();

    if (message.includes('database') || message.includes('sql') || message.includes('postgres')) {
      return errorFactory.createDatabaseError('unknown', error.message, context);
    }

    if (message.includes('file') || message.includes('path') || message.includes('enoent')) {
      return errorFactory.createFileSystemError('read', context?.path || 'unknown', error.message);
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return errorFactory.createNetworkError(context?.url || 'unknown', context?.method || 'GET', error.message);
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return errorFactory.createValidationError(context?.field || 'unknown', context?.value, 'valid value');
    }

    // Default to project error
    return errorFactory.createProjectError('unknown', error.message, context?.projectId, context?.projectPath);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return errorFactory.createProjectError('unknown', error, context?.projectId, context?.projectPath);
  }

  // Handle unknown error types
  return errorFactory.createProjectError('unknown', 'An unknown error occurred', context?.projectId, context?.projectPath);
}

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<Result<T>> {
  try {
    const result = await operation();
    return createSuccessResult(result);
  } catch (error) {
    const codeseekerError = convertToCodeSeekerError(error, context);
    return createErrorResult(codeseekerError);
  }
}

// Synchronous operation wrapper with error handling
export function withSyncErrorHandling<T>(
  operation: () => T,
  context?: Record<string, any>
): Result<T> {
  try {
    const result = operation();
    return createSuccessResult(result);
  } catch (error) {
    const codeseekerError = convertToCodeSeekerError(error, context);
    return createErrorResult(codeseekerError);
  }
}

// Result chaining utilities
export function mapResult<T, U>(
  result: Result<T>,
  mapper: (data: T) => U
): Result<U> {
  if (result.success) {
    try {
      return createSuccessResult(mapper(result.data));
    } catch (error) {
      const codeseekerError = convertToCodeSeekerError(error);
      return createErrorResult(codeseekerError);
    }
  }
  return result as ErrorResult;
}

export async function flatMapResult<T, U>(
  result: Result<T>,
  mapper: (data: T) => Promise<Result<U>>
): Promise<Result<U>> {
  if (result.success) {
    try {
      return await mapper(result.data);
    } catch (error) {
      const codeseekerError = convertToCodeSeekerError(error);
      return createErrorResult(codeseekerError);
    }
  }
  return result as ErrorResult;
}

// Error message formatting
export function formatErrorMessage(error: CodeSeekerError): string {
  const timestamp = new Date(error.timestamp).toLocaleTimeString();
  return `[${timestamp}] ${error.type.toUpperCase()}: ${error.message} (${error.code})`;
}

export function formatDetailedErrorMessage(error: CodeSeekerError): string {
  let message = formatErrorMessage(error);

  // Add type-specific details
  switch (error.type) {
    case 'database':
      const dbError = error as any;
      if (dbError.table) message += `\nTable: ${dbError.table}`;
      if (dbError.operation) message += `\nOperation: ${dbError.operation}`;
      break;

    case 'filesystem':
      const fsError = error as any;
      message += `\nPath: ${fsError.path}`;
      message += `\nOperation: ${fsError.operation}`;
      break;

    case 'network':
      const netError = error as any;
      message += `\nURL: ${netError.url}`;
      message += `\nMethod: ${netError.method}`;
      if (netError.statusCode) message += `\nStatus: ${netError.statusCode}`;
      break;

    case 'validation':
      const valError = error as any;
      message += `\nField: ${valError.field}`;
      message += `\nExpected: ${valError.expected}`;
      message += `\nReceived: ${typeof valError.value}`;
      break;
  }

  if (error.context) {
    message += `\nContext: ${JSON.stringify(error.context, null, 2)}`;
  }

  return message;
}