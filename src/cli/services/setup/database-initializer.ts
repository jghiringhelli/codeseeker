/**
 * Database Initialization Service
 * Single Responsibility: Verify database connections and ensure constraints exist
 *
 * Note: For pre-MVP, this focuses on connection verification and constraint creation.
 * Schema migrations can be added post-MVP when needed.
 */

import { Pool } from 'pg';
import * as neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import { IDatabaseInitializer, SetupResult } from './interfaces/setup-interfaces';

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
        // Verify connection and check essential tables exist
        const tablesResult = await client.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('projects', 'semantic_search_embeddings')
        `);

        const existingTables = tablesResult.rows.map(r => r.table_name);
        const hasProjects = existingTables.includes('projects');
        const hasEmbeddings = existingTables.includes('semantic_search_embeddings');

        return {
          success: true,
          message: hasProjects && hasEmbeddings
            ? 'PostgreSQL verified successfully'
            : 'PostgreSQL connected (some tables may be missing)',
          data: {
            database: this.config.postgres.database,
            tables: existingTables
          }
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
        // First clean up any duplicate nodes that would prevent constraint creation
        await this.cleanupDuplicateNeo4jNodes(session);

        // Create basic constraints with proper error handling
        const constraintErrors: string[] = [];

        try {
          await session.run(`
            CREATE CONSTRAINT project_id_unique IF NOT EXISTS
            FOR (p:Project) REQUIRE p.id IS UNIQUE
          `);
        } catch (err: any) {
          // If constraint already exists or data issue, log but continue
          if (!err.message?.includes('already exists')) {
            constraintErrors.push(`Project constraint: ${err.message}`);
          }
        }

        try {
          await session.run(`
            CREATE CONSTRAINT file_path_unique IF NOT EXISTS
            FOR (f:File) REQUIRE (f.project_id, f.path) IS UNIQUE
          `);
        } catch (err: any) {
          if (!err.message?.includes('already exists')) {
            constraintErrors.push(`File constraint: ${err.message}`);
          }
        }

        // Verify connection works even if constraints had issues
        const verifyResult = await session.run('RETURN 1 as connected');
        const isConnected = verifyResult.records.length > 0;

        if (isConnected) {
          return {
            success: true,
            message: constraintErrors.length > 0
              ? 'Neo4j connected (some constraints skipped)'
              : 'Neo4j initialized successfully',
            data: {
              uri: this.config.neo4j.uri,
              warnings: constraintErrors.length > 0 ? constraintErrors : undefined
            }
          };
        }

        return {
          success: false,
          message: 'Neo4j connection verification failed',
          errors: constraintErrors
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

  /**
   * Clean up duplicate Neo4j nodes that prevent constraint creation
   */
  private async cleanupDuplicateNeo4jNodes(session: neo4j.Session): Promise<void> {
    try {
      // Find and remove duplicate Project nodes (keep the first one)
      await session.run(`
        MATCH (p:Project)
        WITH p.id AS projectId, COLLECT(p) AS nodes
        WHERE SIZE(nodes) > 1
        UNWIND nodes[1..] AS duplicateNode
        DETACH DELETE duplicateNode
      `);

      // Find and remove duplicate File nodes
      await session.run(`
        MATCH (f:File)
        WITH f.project_id AS pid, f.path AS path, COLLECT(f) AS nodes
        WHERE SIZE(nodes) > 1
        UNWIND nodes[1..] AS duplicateNode
        DETACH DELETE duplicateNode
      `);
    } catch {
      // Ignore cleanup errors - constraints may still work
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
}