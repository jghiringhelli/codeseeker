/**
 * Database Initialization Service
 * Single Responsibility: Initialize and test database connections
 */

import { Pool } from 'pg';
import * as neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IDatabaseInitializer, SetupResult, DatabaseConfig } from './interfaces/setup-interfaces';

export class DatabaseInitializer implements IDatabaseInitializer {
  private readonly config = {
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    },
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'codemind123'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined
    }
  };

  async testConnections(): Promise<{ postgres: boolean; neo4j: boolean; redis: boolean }> {
    const results = {
      postgres: false,
      neo4j: false,
      redis: false
    };

    // Test PostgreSQL
    try {
      const pool = new Pool({
        ...this.config.postgres,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000,
        statement_timeout: 5000,
        max: 1
      });

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      results.postgres = true;
    } catch {
      results.postgres = false;
    }

    // Test Neo4j
    try {
      const driver = neo4j.driver(
        this.config.neo4j.uri,
        neo4j.auth.basic(this.config.neo4j.user, this.config.neo4j.password),
        { connectionTimeout: 5000 }
      );

      const session = driver.session();
      await session.run('RETURN 1');
      await session.close();
      await driver.close();
      results.neo4j = true;
    } catch {
      results.neo4j = false;
    }

    // Test Redis
    try {
      const client = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        connectTimeout: 5000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null // Don't retry
      });
      // Suppress error events to prevent console flooding
      client.on('error', () => {});

      await client.connect();
      await client.ping();
      await client.disconnect();
      results.redis = true;
    } catch {
      results.redis = false;
    }

    return results;
  }

  async initializePostgreSQL(): Promise<SetupResult> {
    try {
      const pool = new Pool(this.config.postgres);
      const client = await pool.connect();

      try {
        // Apply consolidated schema
        const schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.consolidated.sql');

        try {
          const schema = await fs.readFile(schemaPath, 'utf8');
          await client.query(schema);
        } catch (fileError) {
          // Schema file not found, create basic structure
          await this.createBasicPostgreSQLSchema(client);
        }

        return {
          success: true,
          message: 'PostgreSQL initialized successfully',
          data: { database: this.config.postgres.database }
        };

      } finally {
        client.release();
        await pool.end();
      }

    } catch (error) {
      return {
        success: false,
        message: 'PostgreSQL initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async initializeNeo4j(): Promise<SetupResult> {
    try {
      const driver = neo4j.driver(
        this.config.neo4j.uri,
        neo4j.auth.basic(this.config.neo4j.user, this.config.neo4j.password)
      );

      const session = driver.session();

      try {
        // Create basic constraints
        await session.run(`
          CREATE CONSTRAINT project_id_unique IF NOT EXISTS
          FOR (p:Project) REQUIRE p.id IS UNIQUE
        `);

        await session.run(`
          CREATE CONSTRAINT file_path_unique IF NOT EXISTS
          FOR (f:File) REQUIRE (f.project_id, f.path) IS UNIQUE
        `);

        return {
          success: true,
          message: 'Neo4j initialized successfully',
          data: { uri: this.config.neo4j.uri }
        };

      } finally {
        await session.close();
        await driver.close();
      }

    } catch (error) {
      return {
        success: false,
        message: 'Neo4j initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async initializeRedis(): Promise<SetupResult> {
    try {
      const client = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password
      });

      // Test basic operations
      await client.set('codemind:setup:test', 'success');
      const testResult = await client.get('codemind:setup:test');
      await client.del('codemind:setup:test');

      if (testResult !== 'success') {
        throw new Error('Redis test operation failed');
      }

      await client.disconnect();

      return {
        success: true,
        message: 'Redis initialized successfully',
        data: { host: this.config.redis.host, port: this.config.redis.port }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Redis initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async createBasicPostgreSQLSchema(client: any): Promise<void> {
    // Create essential tables if schema file is not available
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_path TEXT UNIQUE NOT NULL,
        project_name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        content_type TEXT DEFAULT 'code',
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }
}