/**
 * Error Factory - Implements Factory Pattern for SOLID error creation
 * Single Responsibility: Create properly structured errors
 * Open/Closed: Extensible for new error types without modification
 */
import { IErrorFactory, DatabaseError, FileSystemError, ValidationError, NetworkError, ProjectError, SemanticAnalysisError, ClaudeCodeError } from '../interfaces/error-interfaces';
export declare class ErrorFactory implements IErrorFactory {
    private generateTimestamp;
    private generateErrorCode;
    createDatabaseError(operation: string, message: string, context?: any): DatabaseError;
    createFileSystemError(operation: 'read' | 'write' | 'delete' | 'create', path: string, message: string): FileSystemError;
    createValidationError(field: string, value: any, expected: string): ValidationError;
    createNetworkError(url: string, method: string, message: string, statusCode?: number): NetworkError;
    createProjectError(operation: string, message: string, projectId?: string, projectPath?: string): ProjectError;
    createSemanticAnalysisError(filePath: string, language: string, stage: 'lexical' | 'syntactic' | 'semantic', message: string): SemanticAnalysisError;
    createClaudeCodeError(operation: string, message: string, prompt?: string): ClaudeCodeError;
}
export declare const errorFactory: ErrorFactory;
//# sourceMappingURL=error-factory.d.ts.map