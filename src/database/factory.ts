/**
 * Database factory for creating PostgreSQL database adapters
 */

import { Logger } from '../utils/logger';
import { DatabaseAdapter, DatabaseConfig } from './adapters/base';
import { PostgreSQLAdapter } from './adapters/postgresql';

export class DatabaseFactory {
  static create(config: DatabaseConfig, logger: Logger): DatabaseAdapter {
    if (config.type !== 'postgresql') {
      throw new Error('Only PostgreSQL is supported');
    }
    return new PostgreSQLAdapter(config, logger);
  }

  static parseConfigFromEnv(): DatabaseConfig {
    // PostgreSQL configuration from environment
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      return {
        type: 'postgresql',
        connectionString: databaseUrl
      };
    } else {
      return {
        type: 'postgresql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'codemind',
        username: process.env.DB_USER || 'codemind',
        password: process.env.DB_PASSWORD || 'codemind123',
        ssl: process.env.DB_SSL === 'true'
      };
    }
  }
}