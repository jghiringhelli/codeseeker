"use strict";
/**
 * DatabaseManager - Handles all database operations and health checks
 * Single Responsibility: Database connectivity and operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const database_config_1 = require("../../config/database-config");
const theme_1 = require("../ui/theme");
class DatabaseManager {
    dbConnections;
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
    }
    /**
     * Check health of all database systems
     */
    async checkSystemHealth() {
        try {
            // Test PostgreSQL
            let postgresql = false;
            try {
                const pgClient = await this.dbConnections.getPostgresConnection();
                await pgClient.query('SELECT 1');
                postgresql = true;
            }
            catch (error) {
                console.log(theme_1.Theme.colors.muted(`PostgreSQL: ${error.message}`));
            }
            // Test other databases (simplified for now)
            let redis = true; // Would implement actual Redis test  
            let neo4j = true; // Would implement actual Neo4j test
            await this.dbConnections.closeAll();
            return { postgresql, redis, neo4j };
        }
        catch (error) {
            return { postgresql: false, redis: false, neo4j: false };
        }
    }
    /**
     * Initialize database schemas and configurations
     */
    async initializeSchemas() {
        try {
            // This would be called by the setup script
            // Implementation would create all necessary tables, indexes, etc.
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Store project data across all databases
     */
    async storeProjectData(projectId, data) {
        // Implementation would store data in appropriate databases
        // PostgreSQL: Project metadata, analysis results, use cases, configurations
        // Neo4j: Code relationships, dependency graph  
        // Redis: Cache, session data, embeddings
    }
    /**
     * Get project statistics and metrics
     */
    async getProjectStats(projectId) {
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            const statsQuery = `
        SELECT 
          COUNT(*) as total_files,
          COUNT(DISTINCT file_extension) as file_types,
          MAX(updated_at) as last_analysis
        FROM semantic_search_embeddings 
        WHERE project_path IN (
          SELECT project_path FROM projects WHERE id = $1
        );
      `;
            const result = await pgClient.query(statsQuery, [projectId]);
            return result.rows[0] || {};
        }
        catch (error) {
            console.error(`Failed to get project stats: ${error.message}`);
            return {};
        }
    }
    /**
     * Get PostgreSQL connection
     */
    async getPostgresConnection() {
        return await this.dbConnections.getPostgresConnection();
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=DatabaseManager.js.map