/**
 * Error handling interfaces following SOLID principles
 * Single Responsibility: Each interface handles specific error types
 * Open/Closed: Extensible for new error types without modification
 */
export interface BaseError {
    code: string;
    message: string;
    timestamp: string;
    context?: Record<string, any>;
}
export interface DatabaseError extends BaseError {
    type: 'database';
    operation: string;
    table?: string;
    query?: string;
}
export interface FileSystemError extends BaseError {
    type: 'filesystem';
    operation: 'read' | 'write' | 'delete' | 'create';
    path: string;
    permissions?: boolean;
}
export interface ValidationError extends BaseError {
    type: 'validation';
    field: string;
    value: any;
    expected: string;
}
export interface NetworkError extends BaseError {
    type: 'network';
    url: string;
    method: string;
    statusCode?: number;
    timeout?: boolean;
}
export interface ProjectError extends BaseError {
    type: 'project';
    projectId?: string;
    projectPath?: string;
    operation: string;
}
export interface SemanticAnalysisError extends BaseError {
    type: 'semantic';
    filePath: string;
    language: string;
    parseStage: 'lexical' | 'syntactic' | 'semantic';
}
export interface ClaudeCodeError extends BaseError {
    type: 'claude';
    operation: string;
    prompt?: string;
    apiError?: boolean;
}
export type CodeMindError = DatabaseError | FileSystemError | ValidationError | NetworkError | ProjectError | SemanticAnalysisError | ClaudeCodeError;
export interface SuccessResult<T> {
    success: true;
    data: T;
}
export interface ErrorResult {
    success: false;
    error: CodeMindError;
}
export type Result<T> = SuccessResult<T> | ErrorResult;
export interface IErrorLogger {
    log(error: CodeMindError): Promise<void>;
    logWithContext(error: CodeMindError, context: Record<string, any>): Promise<void>;
}
export interface IErrorReporter {
    report(error: CodeMindError): Promise<void>;
    reportCritical(error: CodeMindError): Promise<void>;
}
export interface IErrorRecovery {
    canRecover(error: CodeMindError): boolean;
    recover(error: CodeMindError): Promise<Result<any>>;
}
export interface IErrorFactory {
    createDatabaseError(operation: string, message: string, context?: any): DatabaseError;
    createFileSystemError(operation: 'read' | 'write' | 'delete' | 'create', path: string, message: string): FileSystemError;
    createValidationError(field: string, value: any, expected: string): ValidationError;
    createNetworkError(url: string, method: string, message: string, statusCode?: number): NetworkError;
    createProjectError(operation: string, message: string, projectId?: string, projectPath?: string): ProjectError;
    createSemanticAnalysisError(filePath: string, language: string, stage: 'lexical' | 'syntactic' | 'semantic', message: string): SemanticAnalysisError;
    createClaudeCodeError(operation: string, message: string, prompt?: string): ClaudeCodeError;
}
export interface IErrorHandler {
    handle(error: CodeMindError): Promise<Result<any>>;
    handleWithRecovery(error: CodeMindError): Promise<Result<any>>;
    isRecoverable(error: CodeMindError): boolean;
}
export interface IErrorMiddleware {
    process(error: CodeMindError): Promise<CodeMindError>;
    enrichWithContext(error: CodeMindError, context: Record<string, any>): CodeMindError;
}
//# sourceMappingURL=error-interfaces.d.ts.map