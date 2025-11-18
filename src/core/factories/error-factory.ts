/**
 * Error Factory - Implements Factory Pattern for SOLID error creation
 * Single Responsibility: Create properly structured errors
 * Open/Closed: Extensible for new error types without modification
 */

import {
  IErrorFactory,
  DatabaseError,
  FileSystemError,
  ValidationError,
  NetworkError,
  ProjectError,
  SemanticAnalysisError,
  ClaudeCodeError
} from '../interfaces/error-interfaces';

export class ErrorFactory implements IErrorFactory {
  private generateTimestamp(): string {
    return new Date().toISOString();
  }

  private generateErrorCode(type: string, operation: string): string {
    const timestamp = Date.now().toString().slice(-6);
    return `${type.toUpperCase()}_${operation.toUpperCase()}_${timestamp}`;
  }

  createDatabaseError(
    operation: string,
    message: string,
    context?: any
  ): DatabaseError {
    return {
      type: 'database',
      code: this.generateErrorCode('db', operation),
      message,
      timestamp: this.generateTimestamp(),
      operation,
      table: context?.table,
      query: context?.query,
      context
    };
  }

  createFileSystemError(
    operation: 'read' | 'write' | 'delete' | 'create',
    path: string,
    message: string
  ): FileSystemError {
    return {
      type: 'filesystem',
      code: this.generateErrorCode('fs', operation),
      message,
      timestamp: this.generateTimestamp(),
      operation,
      path,
      permissions: message.toLowerCase().includes('permission')
    };
  }

  createValidationError(
    field: string,
    value: any,
    expected: string
  ): ValidationError {
    return {
      type: 'validation',
      code: this.generateErrorCode('val', field),
      message: `Validation failed for field '${field}': expected ${expected}, got ${typeof value}`,
      timestamp: this.generateTimestamp(),
      field,
      value,
      expected
    };
  }

  createNetworkError(
    url: string,
    method: string,
    message: string,
    statusCode?: number
  ): NetworkError {
    return {
      type: 'network',
      code: this.generateErrorCode('net', method),
      message,
      timestamp: this.generateTimestamp(),
      url,
      method,
      statusCode,
      timeout: message.toLowerCase().includes('timeout')
    };
  }

  createProjectError(
    operation: string,
    message: string,
    projectId?: string,
    projectPath?: string
  ): ProjectError {
    return {
      type: 'project',
      code: this.generateErrorCode('proj', operation),
      message,
      timestamp: this.generateTimestamp(),
      operation,
      projectId,
      projectPath
    };
  }

  createSemanticAnalysisError(
    filePath: string,
    language: string,
    stage: 'lexical' | 'syntactic' | 'semantic',
    message: string
  ): SemanticAnalysisError {
    return {
      type: 'semantic',
      code: this.generateErrorCode('sem', stage),
      message,
      timestamp: this.generateTimestamp(),
      filePath,
      language,
      parseStage: stage
    };
  }

  createClaudeCodeError(
    operation: string,
    message: string,
    prompt?: string
  ): ClaudeCodeError {
    return {
      type: 'claude',
      code: this.generateErrorCode('claude', operation),
      message,
      timestamp: this.generateTimestamp(),
      operation,
      prompt,
      apiError: message.toLowerCase().includes('api')
    };
  }
}

// Singleton instance for global access
export const errorFactory = new ErrorFactory();