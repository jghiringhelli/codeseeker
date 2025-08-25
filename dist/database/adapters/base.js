"use strict";
/**
 * Base database adapter interface for CodeMind
 * Supports both SQLite and PostgreSQL implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseAdapter = void 0;
class DatabaseAdapter {
    logger;
    config;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    // Helper methods
    handleError(operation, error) {
        this.logger.error(`Database ${operation} failed`, error);
        return {
            code: 'DATABASE_ERROR',
            message: `Database ${operation} failed`,
            details: { error: error instanceof Error ? error.message : String(error) },
            timestamp: new Date()
        };
    }
}
exports.DatabaseAdapter = DatabaseAdapter;
//# sourceMappingURL=base.js.map