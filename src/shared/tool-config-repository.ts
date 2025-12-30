/**
 * Tool Configuration Repository
 * Manages tool configurations using PostgreSQL
 */

import { Logger, LogLevel } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';
import { v4 as uuidv4 } from 'uuid';

export interface ToolConfig {
  id?: string;
  toolName: string;
  projectId: string;
  configuration: any;
  enabled: boolean;
  lastUsed: Date;
  successRate?: number;
  avgExecutionTime?: number;
}

export class ToolConfigRepository {
  private logger: Logger;
  private dbConnections: DatabaseConnections;

  constructor() {
    this.logger = new Logger(LogLevel.INFO, 'ToolConfigRepository');
    this.dbConnections = new DatabaseConnections();
  }

  /**
   * Get tool configuration
   */
  async getToolConfig(projectId: string, toolName: string): Promise<ToolConfig | null> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        SELECT id, tool_name, project_id, configuration, enabled, last_used, success_rate, avg_execution_time
        FROM tool_configs
        WHERE project_id = $1 AND tool_name = $2
      `;

      const result = await pgClient.query(query, [projectId, toolName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        toolName: row.tool_name,
        projectId: row.project_id,
        configuration: JSON.parse(row.configuration),
        enabled: row.enabled,
        lastUsed: row.last_used,
        successRate: row.success_rate,
        avgExecutionTime: row.avg_execution_time
      };
    } catch (error) {
      this.logger.error(`Failed to get tool config: ${error}`);
      return null;
    }
  }

  /**
   * Save tool configuration
   */
  async saveToolConfig(config: ToolConfig): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      if (config.id) {
        // Update existing config
        const query = `
          UPDATE tool_configs
          SET configuration = $1, enabled = $2, last_used = $3, success_rate = $4, avg_execution_time = $5
          WHERE id = $6
        `;

        await pgClient.query(query, [
          JSON.stringify(config.configuration),
          config.enabled,
          config.lastUsed,
          config.successRate,
          config.avgExecutionTime,
          config.id
        ]);
      } else {
        // Insert new config
        const id = uuidv4();
        const query = `
          INSERT INTO tool_configs (id, tool_name, project_id, configuration, enabled, last_used, success_rate, avg_execution_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await pgClient.query(query, [
          id,
          config.toolName,
          config.projectId,
          JSON.stringify(config.configuration),
          config.enabled,
          config.lastUsed,
          config.successRate,
          config.avgExecutionTime
        ]);
      }

      this.logger.info(`Saved config for ${config.toolName}`);
    } catch (error) {
      this.logger.error(`Failed to save tool config: ${error}`);
      throw error;
    }
  }

  /**
   * Get all tool configurations for a project
   */
  async getAllToolConfigs(projectId: string): Promise<ToolConfig[]> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        SELECT id, tool_name, project_id, configuration, enabled, last_used, success_rate, avg_execution_time
        FROM tool_configs
        WHERE project_id = $1
        ORDER BY tool_name
      `;

      const result = await pgClient.query(query, [projectId]);

      return result.rows.map(row => ({
        id: row.id,
        toolName: row.tool_name,
        projectId: row.project_id,
        configuration: JSON.parse(row.configuration),
        enabled: row.enabled,
        lastUsed: row.last_used,
        successRate: row.success_rate,
        avgExecutionTime: row.avg_execution_time
      }));
    } catch (error) {
      this.logger.error(`Failed to get tool configs: ${error}`);
      return [];
    }
  }

  /**
   * Get project configurations
   */
  async getProjectConfigs(projectId: string): Promise<ToolConfig[]> {
    // This is the same as getAllToolConfigs - keeping for backward compatibility
    return this.getAllToolConfigs(projectId);
  }

  /**
   * Update tool usage statistics
   */
  async updateToolStats(projectId: string, toolName: string, executionTime: number, success: boolean): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // First, get current stats
      const currentConfig = await this.getToolConfig(projectId, toolName);

      if (currentConfig) {
        // Calculate new averages
        const currentSuccessRate = currentConfig.successRate || 0;
        const currentAvgTime = currentConfig.avgExecutionTime || 0;

        // Simple weighted average update (could be more sophisticated)
        const newSuccessRate = success ? Math.min(currentSuccessRate + 0.1, 1.0) : Math.max(currentSuccessRate - 0.1, 0.0);
        const newAvgTime = currentAvgTime === 0 ? executionTime : (currentAvgTime + executionTime) / 2;

        const query = `
          UPDATE tool_configs
          SET last_used = NOW(), success_rate = $1, avg_execution_time = $2
          WHERE project_id = $3 AND tool_name = $4
        `;

        await pgClient.query(query, [newSuccessRate, newAvgTime, projectId, toolName]);
      } else {
        // Create new config entry
        const newConfig: ToolConfig = {
          toolName,
          projectId,
          configuration: {},
          enabled: true,
          lastUsed: new Date(),
          successRate: success ? 1.0 : 0.0,
          avgExecutionTime: executionTime
        };

        await this.saveToolConfig(newConfig);
      }

      this.logger.info(`Updated stats for ${toolName}: ${success ? 'success' : 'failure'}, ${executionTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to update tool stats: ${error}`);
    }
  }
}

// Export singleton instance
export const toolConfigRepo = new ToolConfigRepository();