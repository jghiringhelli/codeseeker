/**
 * Database Sync Service
 * SOLID Principles: Single Responsibility - Handle database synchronization only
 */

import { Logger } from '../../../shared/logger';
import { DatabaseUpdateManager } from '../../../shared/managers/database-update-manager';
import {
  IDatabaseSyncService,
  EnhancementContext
} from '../interfaces/index';

export class DatabaseSyncService implements IDatabaseSyncService {
  private logger = Logger.getInstance();
  private databaseUpdater: DatabaseUpdateManager;

  constructor(databaseUpdater?: DatabaseUpdateManager) {
    this.databaseUpdater = databaseUpdater || new DatabaseUpdateManager();
  }

  async updateAllDatabases(filesModified: string[], context: EnhancementContext): Promise<{
    neo4j: { nodesCreated: number; relationshipsCreated: number };
    redis: { filesUpdated: number; hashesUpdated: number };
    postgres: { recordsUpdated: number };
  }> {
    this.logger.info('🔄 Updating all databases with workflow changes...');

    try {
      // Run database updates in parallel for efficiency
      const [neo4jResult, redisResult, postgresResult] = await Promise.all([
        this.updateNeo4jGraph(filesModified),
        this.updateRedisCache(filesModified),
        this.updatePostgresRecords(filesModified)
      ]);

      const result = {
        neo4j: neo4jResult,
        redis: redisResult,
        postgres: postgresResult
      };

      this.logger.info('Database sync completed:', result);
      return result;
    } catch (error) {
      this.logger.error('Database sync failed:', error);

      // Return zero counts on failure
      return {
        neo4j: { nodesCreated: 0, relationshipsCreated: 0 },
        redis: { filesUpdated: 0, hashesUpdated: 0 },
        postgres: { recordsUpdated: 0 }
      };
    }
  }

  async updateNeo4jGraph(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    this.logger.debug('📊 Updating Neo4j graph database...');

    try {
      // Use database update manager to sync graph
      const result = await this.databaseUpdater.updateGraphDatabase(files);

      return {
        nodesCreated: result.nodesCreated || 0,
        relationshipsCreated: result.relationshipsCreated || 0
      };
    } catch (error) {
      this.logger.error('Neo4j update failed:', error);

      return {
        nodesCreated: 0,
        relationshipsCreated: 0
      };
    }
  }

  async updateRedisCache(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }> {
    this.logger.debug('⚡ Updating Redis cache...');

    try {
      // Use database update manager to sync cache
      const result = await this.databaseUpdater.updateRedisCache(files);

      return {
        filesUpdated: result.filesUpdated || 0,
        hashesUpdated: result.hashesUpdated || 0
      };
    } catch (error) {
      this.logger.error('Redis update failed:', error);

      return {
        filesUpdated: 0,
        hashesUpdated: 0
      };
    }
  }

  async updatePostgresRecords(files: string[]): Promise<{ recordsUpdated: number }> {
    this.logger.debug('🗄️ Updating PostgreSQL records...');

    try {
      // Use database update manager to sync main database
      const result = await this.databaseUpdater.updateMainDatabase(files);

      return {
        recordsUpdated: result.recordsUpdated || 0
      };
    } catch (error) {
      this.logger.error('PostgreSQL update failed:', error);

      return {
        recordsUpdated: 0
      };
    }
  }

  // Additional utility methods for database operations
  async validateDatabaseConnections(): Promise<{
    neo4j: boolean;
    redis: boolean;
    postgres: boolean;
  }> {
    this.logger.debug('🔍 Validating database connections...');

    try {
      const [neo4jHealth, redisHealth, postgresHealth] = await Promise.allSettled([
        this.checkNeo4jConnection(),
        this.checkRedisConnection(),
        this.checkPostgresConnection()
      ]);

      return {
        neo4j: neo4jHealth.status === 'fulfilled' && neo4jHealth.value,
        redis: redisHealth.status === 'fulfilled' && redisHealth.value,
        postgres: postgresHealth.status === 'fulfilled' && postgresHealth.value
      };
    } catch (error) {
      this.logger.error('Database connection validation failed:', error);

      return {
        neo4j: false,
        redis: false,
        postgres: false
      };
    }
  }

  async syncFileMetadata(files: string[], metadata: Record<string, any>): Promise<void> {
    this.logger.debug(`Syncing metadata for ${files.length} files...`);

    try {
      // Update file metadata across all databases
      await Promise.all([
        this.syncNeo4jMetadata(files, metadata),
        this.syncRedisMetadata(files, metadata),
        this.syncPostgresMetadata(files, metadata)
      ]);

      this.logger.info('File metadata sync completed');
    } catch (error) {
      this.logger.error('File metadata sync failed:', error);
      throw error;
    }
  }

  async cleanupStaleData(olderThanDays: number = 30): Promise<{
    neo4j: { nodesDeleted: number; relationshipsDeleted: number };
    redis: { keysDeleted: number };
    postgres: { recordsDeleted: number };
  }> {
    this.logger.info(`🧹 Cleaning up stale data older than ${olderThanDays} days...`);

    try {
      const [neo4jCleanup, redisCleanup, postgresCleanup] = await Promise.all([
        this.cleanupNeo4jData(olderThanDays),
        this.cleanupRedisData(olderThanDays),
        this.cleanupPostgresData(olderThanDays)
      ]);

      const result = {
        neo4j: neo4jCleanup,
        redis: redisCleanup,
        postgres: postgresCleanup
      };

      this.logger.info('Data cleanup completed:', result);
      return result;
    } catch (error) {
      this.logger.error('Data cleanup failed:', error);
      throw error;
    }
  }

  // Private helper methods
  private async checkNeo4jConnection(): Promise<boolean> {
    try {
      // Basic connection test
      await this.databaseUpdater.testGraphConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      // Basic connection test
      await this.databaseUpdater.testRedisConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async checkPostgresConnection(): Promise<boolean> {
    try {
      // Basic connection test
      await this.databaseUpdater.testMainDatabaseConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async syncNeo4jMetadata(files: string[], metadata: Record<string, any>): Promise<void> {
    // Update node properties with metadata
    for (const file of files) {
      if (metadata[file]) {
        await this.databaseUpdater.updateNodeProperties(file, metadata[file]);
      }
    }
  }

  private async syncRedisMetadata(files: string[], metadata: Record<string, any>): Promise<void> {
    // Update Redis hashes with metadata
    for (const file of files) {
      if (metadata[file]) {
        await this.databaseUpdater.updateRedisHash(file, metadata[file]);
      }
    }
  }

  private async syncPostgresMetadata(files: string[], metadata: Record<string, any>): Promise<void> {
    // Update PostgreSQL records with metadata
    for (const file of files) {
      if (metadata[file]) {
        await this.databaseUpdater.updateFileRecord(file, metadata[file]);
      }
    }
  }

  private async cleanupNeo4jData(olderThanDays: number): Promise<{ nodesDeleted: number; relationshipsDeleted: number }> {
    try {
      const result = await this.databaseUpdater.cleanupOldGraphData(olderThanDays);
      return {
        nodesDeleted: result.nodesDeleted || 0,
        relationshipsDeleted: result.relationshipsDeleted || 0
      };
    } catch (error) {
      this.logger.error('Neo4j cleanup failed:', error);
      return { nodesDeleted: 0, relationshipsDeleted: 0 };
    }
  }

  private async cleanupRedisData(olderThanDays: number): Promise<{ keysDeleted: number }> {
    try {
      const result = await this.databaseUpdater.cleanupOldCacheData(olderThanDays);
      return {
        keysDeleted: result.keysDeleted || 0
      };
    } catch (error) {
      this.logger.error('Redis cleanup failed:', error);
      return { keysDeleted: 0 };
    }
  }

  private async cleanupPostgresData(olderThanDays: number): Promise<{ recordsDeleted: number }> {
    try {
      const result = await this.databaseUpdater.cleanupOldMainData(olderThanDays);
      return {
        recordsDeleted: result.recordsDeleted || 0
      };
    } catch (error) {
      this.logger.error('PostgreSQL cleanup failed:', error);
      return { recordsDeleted: 0 };
    }
  }
}