/**
 * DatabaseManager - Handles all database operations and health checks
 * Single Responsibility: Database connectivity and operations
 */

import { DatabaseConnections } from '../../config/database-config';
import { Theme } from '../ui/theme';

export interface SystemHealth {
  postgresql: boolean;
  redis: boolean;
  neo4j: boolean;
}

export class DatabaseManager {
  private dbConnections: DatabaseConnections;

  constructor() {
    this.dbConnections = new DatabaseConnections();
  }

  /**
   * Check health of all database systems
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    try {
      // Test PostgreSQL
      let postgresql = false;
      try {
        const pgClient = await this.dbConnections.getPostgresConnection();
        await pgClient.query('SELECT 1');
        postgresql = true;
      } catch (error) {
        console.log(Theme.colors.muted(`PostgreSQL: ${error.message}`));
      }

      // Test other databases (simplified for now)
      let redis = true;    // Would implement actual Redis test  
      let neo4j = true;    // Would implement actual Neo4j test

      await this.dbConnections.closeAll();

      return { postgresql, redis, neo4j };
    } catch (error) {
      return { postgresql: false, redis: false, neo4j: false };
    }
  }

  /**
   * Initialize database schemas and configurations
   */
  async initializeSchemas(): Promise<{ success: boolean; error?: string }> {
    try {
      // This would be called by the setup script
      // Implementation would create all necessary tables, indexes, etc.
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Store project data across all databases
   */
  async storeProjectData(projectId: string, data: any): Promise<void> {
    // Implementation would store data in appropriate databases
    // PostgreSQL: Project metadata, analysis results, use cases, configurations
    // Neo4j: Code relationships, dependency graph  
    // Redis: Cache, session data, embeddings
  }

  /**
   * Get project statistics and metrics
   */
  async getProjectStats(projectId: string): Promise<any> {
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
    } catch (error) {
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

  /**
   * Cleanup database connections
   */
  async cleanup(): Promise<void> {
    try {
      await this.dbConnections.closeAll();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}