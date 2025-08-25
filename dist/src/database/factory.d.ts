/**
 * Database factory for creating PostgreSQL database adapters
 */
import { Logger } from '../utils/logger';
import { DatabaseAdapter, DatabaseConfig } from './adapters/base';
export declare class DatabaseFactory {
    static create(config: DatabaseConfig, logger: Logger): DatabaseAdapter;
    static parseConfigFromEnv(): DatabaseConfig;
}
//# sourceMappingURL=factory.d.ts.map