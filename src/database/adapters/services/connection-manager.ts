/**
 * Connection Manager Service
 * SOLID Principles: Single Responsibility - Handle database connection only
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '../../../utils/logger';
import { DatabaseConfig } from '../base';
import { IConnectionManager } from '../interfaces';

export class ConnectionManager implements IConnectionManager {
  private pool: Pool | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(config: DatabaseConfig): Promise<Pool> {
    try {
      this.logger.info('Initializing PostgreSQL connection', {
        host: config.host,
        database: config.database,
        port: config.port
      });

      // Create connection pool
      this.pool = new Pool({
        connectionString: config.connectionString,
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return error after 2 seconds if unable to connect
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.logger.info('PostgreSQL connection established successfully');

      return this.pool;

    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL connection:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      this.logger.info('Closing PostgreSQL connection pool');
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Run database schema migrations - should only be called during setup phase
   */
  async migrate(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      this.logger.info('Creating initial database schema');

      // Find the schema file - simplified for alpha development
      const schemaPath = join(process.cwd(), 'src/database/schema.postgres.sql');

      try {
        const schemaSql = readFileSync(schemaPath, 'utf8');
        await this.pool.query(schemaSql);
        this.logger.info('Database schema created successfully');
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Schema file not found at: ${schemaPath}`);
        }
        throw error;
      }

    } catch (error) {
      this.logger.error('Schema creation failed:', error);
      throw new Error(`Schema creation failed: ${error.message}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return true;
    } catch (error) {
      this.logger.warn('Database health check failed:', error);
      return false;
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return this.pool;
  }
}