"use strict";
/**
 * Consolidated Database Manager - SOLID Principles Compliant
 * Single Responsibility: Database operations coordination
 * Uses dependency injection for health, schema, and update strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const database_config_1 = require("../../config/database-config");
const logger_1 = require("../../utils/logger");
/**
 * Consolidated DatabaseManager with injected strategies
 * Follows Single Responsibility and Dependency Inversion principles
 */
class DatabaseManager {
    healthStrategy;
    schemaStrategy;
    updateStrategy;
    dbConnections;
    logger = logger_1.Logger.getInstance();
    constructor(healthStrategy, schemaStrategy, updateStrategy) {
        this.healthStrategy = healthStrategy;
        this.schemaStrategy = schemaStrategy;
        this.updateStrategy = updateStrategy;
        this.dbConnections = new database_config_1.DatabaseConnections();
    }
    // === HEALTH MANAGEMENT ===
    /**
     * Check system health - delegates to health strategy if available
     */
    async checkSystemHealth() {
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
    async getDatabaseStatus() {
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
    async startMissingServices(requirements = {}) {
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
    async validateSchema() {
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
    async initializeTables() {
        if (this.schemaStrategy) {
            return await this.schemaStrategy.initializeTables();
        }
        this.logger.warn('No schema strategy available for table initialization');
        return { success: false, errors: ['Schema strategy not configured'] };
    }
    /**
     * Repair database schema
     */
    async repairSchema() {
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
    async updateAllDatabases(context, options) {
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
    async updateFileEmbeddings(projectId, filePath, content) {
        if (this.updateStrategy) {
            await this.updateStrategy.updateFileEmbeddings(projectId, filePath, content);
        }
        else {
            this.logger.warn('No update strategy available for file embeddings');
        }
    }
    /**
     * Remove file embeddings
     */
    async removeFileEmbeddings(projectId, filePath) {
        if (this.updateStrategy) {
            await this.updateStrategy.removeFileEmbeddings(projectId, filePath);
        }
        else {
            this.logger.warn('No update strategy available for file embedding removal');
        }
    }
    // === CONNECTION MANAGEMENT ===
    /**
     * Get database connections
     */
    getConnections() {
        return this.dbConnections;
    }
    /**
     * Close all database connections
     */
    async closeConnections() {
        try {
            await this.dbConnections.closeAll();
            this.logger.info('All database connections closed');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error closing database connections: ${errorMessage}`);
        }
    }
    // === PRIVATE HELPER METHODS ===
    /**
     * Basic health check fallback implementation
     */
    async basicHealthCheck() {
        try {
            // Test PostgreSQL
            let postgresql = false;
            try {
                const pgClient = await this.dbConnections.getPostgresConnection();
                await pgClient.query('SELECT 1');
                await pgClient.end();
                postgresql = true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.debug(`PostgreSQL health check failed: ${errorMessage}`);
            }
            // Test Redis
            let redis = false;
            try {
                const redisClient = await this.dbConnections.getRedisConnection();
                await redisClient.ping();
                await redisClient.quit();
                redis = true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.debug(`Redis health check failed: ${errorMessage}`);
            }
            // Test Neo4j
            let neo4j = false;
            try {
                const neo4jClient = await this.dbConnections.getNeo4jConnection();
                const session = neo4jClient.session();
                await session.run('RETURN 1');
                await session.close();
                neo4j = true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.debug(`Neo4j health check failed: ${errorMessage}`);
            }
            return { postgresql, redis, neo4j };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`System health check failed: ${errorMessage}`);
            return { postgresql: false, redis: false, neo4j: false };
        }
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database-manager.js.map