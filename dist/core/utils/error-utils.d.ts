/**
 * Error Utilities - Helper functions for error handling
 * Following Single Responsibility and DRY principles
 */
import { CodeMindError, Result, SuccessResult, ErrorResult } from '../interfaces/error-interfaces';
export declare function createSuccessResult<T>(data: T): SuccessResult<T>;
export declare function createErrorResult(error: CodeMindError): ErrorResult;
export declare function isDatabaseError(error: CodeMindError): error is CodeMindError & {
    type: 'database';
};
export declare function isFileSystemError(error: CodeMindError): error is CodeMindError & {
    type: 'filesystem';
};
export declare function isValidationError(error: CodeMindError): error is CodeMindError & {
    type: 'validation';
};
export declare function isNetworkError(error: CodeMindError): error is CodeMindError & {
    type: 'network';
};
export declare function isProjectError(error: CodeMindError): error is CodeMindError & {
    type: 'project';
};
export declare function isSemanticAnalysisError(error: CodeMindError): error is CodeMindError & {
    type: 'semantic';
};
export declare function isClaudeCodeError(error: CodeMindError): error is CodeMindError & {
    type: 'claude';
};
export declare function convertToCodeMindError(error: unknown, context?: Record<string, any>): CodeMindError;
export declare function withErrorHandling<T>(operation: () => Promise<T>, context?: Record<string, any>): Promise<Result<T>>;
export declare function withSyncErrorHandling<T>(operation: () => T, context?: Record<string, any>): Result<T>;
export declare function mapResult<T, U>(result: Result<T>, mapper: (data: T) => U): Result<U>;
export declare function flatMapResult<T, U>(result: Result<T>, mapper: (data: T) => Promise<Result<U>>): Promise<Result<U>>;
export declare function formatErrorMessage(error: CodeMindError): string;
export declare function formatDetailedErrorMessage(error: CodeMindError): string;
//# sourceMappingURL=error-utils.d.ts.map