/**
 * Tool Data Service
 * SOLID Principles: Single Responsibility - Handle generic tool data operations only
 */

import { IToolDataService, IDatabaseConnection } from '../interfaces';

export class ToolDataService implements IToolDataService {
  constructor(private db: IDatabaseConnection) {}

  async saveToolData(projectId: string, toolName: string, data: any): Promise<any> {
    try {
      // Special handling for specific tools
      if (toolName === 'semantic-search') {
        // Delegate to semantic search service - this should be handled by the coordinator
        throw new Error('Use SemanticSearchService for semantic-search data');
      }

      // Default to tool_data table
      const result = await this.db.query(`
        INSERT INTO tool_data (project_id, tool_name, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (project_id, tool_name) DO UPDATE SET
        data = $3, updated_at = NOW()
        RETURNING *
      `, [projectId, toolName, JSON.stringify(data)]);

      return result.rows[0];
    } catch (error) {
      console.error(`Error saving tool data for ${toolName}:`, error);
      throw error;
    }
  }

  async getToolData(projectId: string, toolName: string): Promise<any> {
    try {
      const result = await this.db.query(
        'SELECT * FROM tool_data WHERE project_id = $1 AND tool_name = $2',
        [projectId, toolName]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          ...row,
          data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting tool data for ${toolName}:`, error);
      throw error;
    }
  }

  async deleteToolData(projectId: string, toolName: string): Promise<void> {
    try {
      await this.db.query(
        'DELETE FROM tool_data WHERE project_id = $1 AND tool_name = $2',
        [projectId, toolName]
      );
    } catch (error) {
      console.error(`Error deleting tool data for ${toolName}:`, error);
      throw error;
    }
  }

  async getAllToolData(projectId: string): Promise<any[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM tool_data WHERE project_id = $1 ORDER BY updated_at DESC',
        [projectId]
      );

      return result.rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      }));
    } catch (error) {
      console.error('Error getting all tool data:', error);
      throw error;
    }
  }
}