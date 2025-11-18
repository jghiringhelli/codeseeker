"use strict";
/**
 * Error Factory - Implements Factory Pattern for SOLID error creation
 * Single Responsibility: Create properly structured errors
 * Open/Closed: Extensible for new error types without modification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorFactory = exports.ErrorFactory = void 0;
class ErrorFactory {
    generateTimestamp() {
        return new Date().toISOString();
    }
    generateErrorCode(type, operation) {
        const timestamp = Date.now().toString().slice(-6);
        return `${type.toUpperCase()}_${operation.toUpperCase()}_${timestamp}`;
    }
    createDatabaseError(operation, message, context) {
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
    createFileSystemError(operation, path, message) {
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
    createValidationError(field, value, expected) {
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
    createNetworkError(url, method, message, statusCode) {
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
    createProjectError(operation, message, projectId, projectPath) {
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
    createSemanticAnalysisError(filePath, language, stage, message) {
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
    createClaudeCodeError(operation, message, prompt) {
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
exports.ErrorFactory = ErrorFactory;
// Singleton instance for global access
exports.errorFactory = new ErrorFactory();
//# sourceMappingURL=error-factory.js.map