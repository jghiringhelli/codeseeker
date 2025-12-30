/**
 * Consolidated Database Manager - SOLID Principles Compliant
 * Single Responsibility: Database operations coordination
 * Uses dependency injection for health, schema, and update strategies
 */

import { DatabaseConnections } from '../../config/database-config';
import { Logger } from '../../utils/logger';

// Core interfaces for dependency injection
export interface IDatabaseHealthStrategy {
  checkSystemHealth(): Promise<DatabaseStatus>;
  startMissingServices(requirements: DatabaseRequirements): Promise<boolean>;
  ensureServicesRunning(requirements: DatabaseRequirements): Promise<DatabaseStatus>;
}

export interface IDatabaseSchemaStrategy {
  validateSchema(): Promise<SchemaValidationResult>;
  repairSchema(): Promise<SchemaRepairResult>;
  initializeTables(): Promise<{ success: boolean; errors?: string[] }>;
}

export interface IDatabaseUpdateStrategy {
  updateAllDatabases(context: unknown, options?: unknown): Promise<DatabaseUpdateResult>;
  updateFileEmbeddings(projectId: string, filePath: string, content: string): Promise<void>;
  removeFileEmbeddings(projectId: string, filePath: string): Promise<void>;
}

// Shared interfaces from original classes
export interface DatabaseStatus {
  postgresql: { available: boolean; error?: string };
  redis: { available: boolean; error?: string };
  neo4j: { available: boolean; error?: string };
}

export interface DatabaseRequirements {
  postgresql?: boolean;
  redis?: boolean;
  neo4j?: boolean;
}

export interface SchemaValidationResult {
  valid: boolean;
  missingTables: string[];
  missingIndexes: string[];
  errors: string[];
}

export interface SchemaRepairResult {
  success: boolean;
  tablesCreated: string[];
  indexesCreated: string[];
  errors: string[];
}

export interface DatabaseUpdateResult {
  neo4j: {
    nodesCreated: number;
    nodesUpdated: number;
    relationshipsCreated: number;
    relationshipsUpdated: number;
    success: boolean;
    error?: string;
  };
  redis: {
    filesUpdated: number;
    hashesUpdated: number;
    cacheEntriesInvalidated: number;
    success: boolean;
    error?: string;
  };
  postgres: {
    recordsUpdated: number;
    embeddingsUpdated: number;
    success: boolean;
    error?: string;
  };
}

export interface SystemHealth {
  postgresql: boolean;
  redis: boolean;
  neo4j: boolean;
}

/**
 * Consolidated DatabaseManager with injected strategies
 * Follows Single Responsibility and Dependency Inversion principles
 */
export class DatabaseManager {
  private dbConnections: DatabaseConnections;
  private logger = Logger.getInstance();

  constructor(
    private healthStrategy?: IDatabaseHealthStrategy,
    private schemaStrategy?: IDatabaseSchemaStrategy,
    private updateStrategy?: IDatabaseUpdateStrategy
  ) {
    this.dbConnections = new DatabaseConnections();
  }

  // === HEALTH MANAGEMENT ===

  /**
   * Check system health - delegates to health strategy if available
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    if (this.healthStrategy) {
      const status = await this.healthStrategy.checkSystemHealth();
      return {
        postgresql: status.postgresql.available,
        redis: status.redis.available,
        neo4j: status.neo4j.available
      };
    }

    // Fallback to basic health check
    return await this.basicHealthCheck();
  }

  /**
   * Get detailed database status
   */
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    if (this.healthStrategy) {
      return await this.healthStrategy.checkSystemHealth();
    }

    // Fallback implementation
    const health = await this.basicHealthCheck();
    return {
      postgresql: { available: health.postgresql },
      redis: { available: health.redis },
      neo4j: { available: health.neo4j }
    };
  }

  /**
   * Start missing database services
   */
  async startMissingServices(requirements: DatabaseRequirements = {}): Promise<boolean> {
    if (this.healthStrategy) {
      return await this.healthStrategy.startMissingServices(requirements);
    }

    this.logger.warn('No health strategy available for starting services');
    return false;
  }

  // === SCHEMA MANAGEMENT ===

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<SchemaValidationResult> {
    if (this.schemaStrategy) {
      return await this.schemaStrategy.validateSchema();
    }

    this.logger.warn('No schema strategy available for validation');
    return {
      valid: false,
      missingTables: [],
      missingIndexes: [],
      errors: ['Schema strategy not configured']
    };
  }

  /**
   * Initialize database tables
   */
  async initializeTables(): Promise<{ success: boolean; errors?: string[] }> {
    if (this.schemaStrategy) {
      return await this.schemaStrategy.initializeTables();
    }

    this.logger.warn('No schema strategy available for table initialization');
    return { success: false, errors: ['Schema strategy not configured'] };
  }

  /**
   * Repair database schema
   */
  async repairSchema(): Promise<SchemaRepairResult> {
    if (this.schemaStrategy) {
      return await this.schemaStrategy.repairSchema();
    }

    return {
      success: false,
      tablesCreated: [],
      indexesCreated: [],
      errors: ['Schema strategy not configured']
    };
  }

  // === UPDATE MANAGEMENT ===

  /**
   * Update all databases atomically
   */
  async updateAllDatabases(context: unknown, options?: unknown): Promise<DatabaseUpdateResult> {
    if (this.updateStrategy) {
      return await this.updateStrategy.updateAllDatabases(context, options);
    }

    this.logger.warn('No update strategy available');
    return {
      neo4j: { nodesCreated: 0, nodesUpdated: 0, relationshipsCreated: 0, relationshipsUpdated: 0, success: false, error: 'Update strategy not configured' },
      redis: { filesUpdated: 0, hashesUpdated: 0, cacheEntriesInvalidated: 0, success: false, error: 'Update strategy not configured' },
      postgres: { recordsUpdated: 0, embeddingsUpdated: 0, success: false, error: 'Update strategy not configured' }
    };
  }

  /**
   * Update file embeddings
   */
  async updateFileEmbeddings(projectId: string, filePath: string, content: string): Promise<void> {
    if (this.updateStrategy) {
      await this.updateStrategy.updateFileEmbeddings(projectId, filePath, content);
    } else {
      this.logger.warn('No update strategy available for file embeddings');
    }
  }

  /**
   * Remove file embeddings
   */
  async removeFileEmbeddings(projectId: string, filePath: string): Promise<void> {
    if (this.updateStrategy) {
      await this.updateStrategy.removeFileEmbeddings(projectId, filePath);
    } else {
      this.logger.warn('No update strategy available for file embedding removal');
    }
  }

  // === CONNECTION MANAGEMENT ===

  /**
   * Get database connections
   */
  getConnections(): DatabaseConnections {
    return this.dbConnections;
  }

  /**
   * Close all database connections
   */
  async closeConnections(): Promise<void> {
    try {
      await this.dbConnections.closeAll();
      this.logger.info('All database connections closed');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error closing database connections: ${errorMessage}`);
    }
  }

  // === PRIVATE HELPER METHODS ===

  /**
   * Basic health check fallback implementation
   */
  private async basicHealthCheck(): Promise<SystemHealth> {
    try {
      // Test PostgreSQL
      let postgresql = false;
      try {
        const pgClient = await this.dbConnections.getPostgresConnection();
        await pgClient.query('SELECT 1');
        await pgClient.end();
        postgresql = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.debug(`PostgreSQL health check failed: ${errorMessage}`);
      }

      // Test Redis
      let redis = false;
      try {
        const redisClient = await this.dbConnections.getRedisConnection();
        await (redisClient as { ping: () => Promise<unknown> }).ping();
        await (redisClient as { quit: () => Promise<unknown> }).quit();
        redis = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.debug(`Redis health check failed: ${errorMessage}`);
      }

      // Test Neo4j
      let neo4j = false;
      try {
        const neo4jClient = await this.dbConnections.getNeo4jConnection();
        const session = (neo4jClient as { session: () => unknown }).session();
        await (session as { run: (query: string) => Promise<unknown> }).run('RETURN 1');
        await (session as { close: () => Promise<unknown> }).close();
        neo4j = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.debug(`Neo4j health check failed: ${errorMessage}`);
      }

      return { postgresql, redis, neo4j };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`System health check failed: ${errorMessage}`);
      return { postgresql: false, redis: false, neo4j: false };
    }
  }
}