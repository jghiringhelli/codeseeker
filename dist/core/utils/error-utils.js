"use strict";
/**
 * Error Utilities - Helper functions for error handling
 * Following Single Responsibility and DRY principles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResult = createSuccessResult;
exports.createErrorResult = createErrorResult;
exports.isDatabaseError = isDatabaseError;
exports.isFileSystemError = isFileSystemError;
exports.isValidationError = isValidationError;
exports.isNetworkError = isNetworkError;
exports.isProjectError = isProjectError;
exports.isSemanticAnalysisError = isSemanticAnalysisError;
exports.isClaudeCodeError = isClaudeCodeError;
exports.convertToCodeMindError = convertToCodeMindError;
exports.withErrorHandling = withErrorHandling;
exports.withSyncErrorHandling = withSyncErrorHandling;
exports.mapResult = mapResult;
exports.flatMapResult = flatMapResult;
exports.formatErrorMessage = formatErrorMessage;
exports.formatDetailedErrorMessage = formatDetailedErrorMessage;
const error_factory_1 = require("../factories/error-factory");
// Result creation utilities
function createSuccessResult(data) {
    return {
        success: true,
        data
    };
}
function createErrorResult(error) {
    return {
        success: false,
        error
    };
}
// Type guards for error types
function isDatabaseError(error) {
    return error.type === 'database';
}
function isFileSystemError(error) {
    return error.type === 'filesystem';
}
function isValidationError(error) {
    return error.type === 'validation';
}
function isNetworkError(error) {
    return error.type === 'network';
}
function isProjectError(error) {
    return error.type === 'project';
}
function isSemanticAnalysisError(error) {
    return error.type === 'semantic';
}
function isClaudeCodeError(error) {
    return error.type === 'claude';
}
// Error conversion utilities
function convertToCodeMindError(error, context) {
    if (error instanceof Error) {
        // Try to detect error type from message patterns
        const message = error.message.toLowerCase();
        if (message.includes('database') || message.includes('sql') || message.includes('postgres')) {
            return error_factory_1.errorFactory.createDatabaseError('unknown', error.message, context);
        }
        if (message.includes('file') || message.includes('path') || message.includes('enoent')) {
            return error_factory_1.errorFactory.createFileSystemError('read', context?.path || 'unknown', error.message);
        }
        if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
            return error_factory_1.errorFactory.createNetworkError(context?.url || 'unknown', context?.method || 'GET', error.message);
        }
        if (message.includes('validation') || message.includes('invalid')) {
            return error_factory_1.errorFactory.createValidationError(context?.field || 'unknown', context?.value, 'valid value');
        }
        // Default to project error
        return error_factory_1.errorFactory.createProjectError('unknown', error.message, context?.projectId, context?.projectPath);
    }
    // Handle string errors
    if (typeof error === 'string') {
        return error_factory_1.errorFactory.createProjectError('unknown', error, context?.projectId, context?.projectPath);
    }
    // Handle unknown error types
    return error_factory_1.errorFactory.createProjectError('unknown', 'An unknown error occurred', context?.projectId, context?.projectPath);
}
// Async operation wrapper with error handling
async function withErrorHandling(operation, context) {
    try {
        const result = await operation();
        return createSuccessResult(result);
    }
    catch (error) {
        const codeMindError = convertToCodeMindError(error, context);
        return createErrorResult(codeMindError);
    }
}
// Synchronous operation wrapper with error handling
function withSyncErrorHandling(operation, context) {
    try {
        const result = operation();
        return createSuccessResult(result);
    }
    catch (error) {
        const codeMindError = convertToCodeMindError(error, context);
        return createErrorResult(codeMindError);
    }
}
// Result chaining utilities
function mapResult(result, mapper) {
    if (result.success) {
        try {
            return createSuccessResult(mapper(result.data));
        }
        catch (error) {
            const codeMindError = convertToCodeMindError(error);
            return createErrorResult(codeMindError);
        }
    }
    return result;
}
async function flatMapResult(result, mapper) {
    if (result.success) {
        try {
            return await mapper(result.data);
        }
        catch (error) {
            const codeMindError = convertToCodeMindError(error);
            return createErrorResult(codeMindError);
        }
    }
    return result;
}
// Error message formatting
function formatErrorMessage(error) {
    const timestamp = new Date(error.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${error.type.toUpperCase()}: ${error.message} (${error.code})`;
}
function formatDetailedErrorMessage(error) {
    let message = formatErrorMessage(error);
    // Add type-specific details
    switch (error.type) {
        case 'database':
            const dbError = error;
            if (dbError.table)
                message += `\nTable: ${dbError.table}`;
            if (dbError.operation)
                message += `\nOperation: ${dbError.operation}`;
            break;
        case 'filesystem':
            const fsError = error;
            message += `\nPath: ${fsError.path}`;
            message += `\nOperation: ${fsError.operation}`;
            break;
        case 'network':
            const netError = error;
            message += `\nURL: ${netError.url}`;
            message += `\nMethod: ${netError.method}`;
            if (netError.statusCode)
                message += `\nStatus: ${netError.statusCode}`;
            break;
        case 'validation':
            const valError = error;
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
//# sourceMappingURL=error-utils.js.map