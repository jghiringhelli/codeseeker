"use strict";
/**
 * Database factory for creating PostgreSQL database adapters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseFactory = void 0;
const postgresql_1 = require("./adapters/postgresql");
class DatabaseFactory {
    static create(config, logger) {
        if (config?.type !== 'postgresql') {
            throw new Error('Only PostgreSQL is supported');
        }
        return new postgresql_1.PostgreSQLAdapter(config, logger);
    }
    static parseConfigFromEnv() {
        // PostgreSQL configuration from environment
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
            return {
                type: 'postgresql',
                connectionString: databaseUrl
            };
        }
        else {
            return {
                type: 'postgresql',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                username: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123',
                ssl: process.env?.DB_SSL === 'true'
            };
        }
    }
}
exports.DatabaseFactory = DatabaseFactory;
//# sourceMappingURL=factory.js.map