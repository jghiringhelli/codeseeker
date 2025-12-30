/**
 * Database Connection Service
 * SOLID Principles: Single Responsibility - Handle database connection only
 */

import { Pool } from 'pg';
import { IDatabaseConnection, DatabaseConfig } from '../interfaces';

export class DatabaseConnectionService implements IDatabaseConnection {
  private pool: Pool;
  private initialized = false;

  constructor(config?: DatabaseConfig) {
    const defaultConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    };

    this.pool = new Pool(config || defaultConfig);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection
      await this.pool.query('SELECT 1');
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize database connection: ${error}`);
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.pool.query(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
  }
}