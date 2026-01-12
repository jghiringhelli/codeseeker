/**
 * Analysis Results Repository
 * Stores and retrieves complex analysis results in PostgreSQL
 */

import { Logger, LogLevel } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';
import { v4 as uuidv4 } from 'uuid';

export interface AnalysisResult {
  id?: string;
  projectId: string;
  toolName: string;
  timestamp: Date;
  analysis: any;
  summary?: string;
  fileCount?: number;
  hasIssues?: boolean;
  tags?: string[];
  metrics?: {
    executionTime?: number;
    filesProcessed?: number;
    issuesFound?: number;
    complexity?: number;
  };
}

export class AnalysisRepository {
  private logger: Logger;
  private dbConnections: DatabaseConnections;

  constructor() {
    this.logger = new Logger(LogLevel.INFO, 'AnalysisRepository');
    this.dbConnections = new DatabaseConnections();
  }

  /**
   * Store analysis result (PostgreSQL implementation)
   */
  async storeAnalysis(projectId: string, toolName: string, analysis: any): Promise<string> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();
      const id = uuidv4();

      const query = `
        INSERT INTO analysis_results (id, project_id, tool_name, timestamp, analysis, summary, file_count, has_issues)
        VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
        RETURNING id
      `;

      const values = [
        id,
        projectId,
        toolName,
        JSON.stringify(analysis),
        analysis.summary || `${toolName} analysis completed`,
        analysis.fileCount || 0,
        analysis.hasIssues || false
      ];

      const result = await pgClient.query(query, values);

      this.logger.info(`Analysis stored for ${toolName} in project ${projectId} with ID ${id}`);
      return result.rows[0].id;
    } catch (error) {
      this.logger.error(`Failed to store analysis: ${error}`);
      throw error;
    }
  }

  /**
   * Get analysis history with filtering
   */
  async getAnalysisHistory(projectId: string, toolName?: string, limit = 10): Promise<AnalysisResult[]> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      let query = `
        SELECT id, project_id, tool_name, timestamp, analysis, summary, file_count, has_issues
        FROM analysis_results
        WHERE project_id = $1
      `;
      const values: any[] = [projectId];

      if (toolName) {
        query += ` AND tool_name = $2`;
        values.push(toolName);
        query += ` ORDER BY timestamp DESC LIMIT $3`;
        values.push(limit);
      } else {
        query += ` ORDER BY timestamp DESC LIMIT $2`;
        values.push(limit);
      }

      const result = await pgClient.query(query, values);

      const analyses = result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        toolName: row.tool_name,
        timestamp: row.timestamp,
        analysis: JSON.parse(row.analysis),
        summary: row.summary,
        fileCount: row.file_count,
        hasIssues: row.has_issues
      }));

      this.logger.info(`Retrieved ${analyses.length} analysis records for project ${projectId}`);
      return analyses;
    } catch (error) {
      this.logger.error(`Failed to get analysis history: ${error}`);
      return [];
    }
  }

  /**
   * Get latest analysis for a tool
   */
  async getLatestAnalysis(projectId: string, toolName: string): Promise<AnalysisResult | null> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        SELECT id, project_id, tool_name, timestamp, analysis, summary, file_count, has_issues
        FROM analysis_results
        WHERE project_id = $1 AND tool_name = $2
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await pgClient.query(query, [projectId, toolName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        projectId: row.project_id,
        toolName: row.tool_name,
        timestamp: row.timestamp,
        analysis: JSON.parse(row.analysis),
        summary: row.summary,
        fileCount: row.file_count,
        hasIssues: row.has_issues
      };
    } catch (error) {
      this.logger.error(`Failed to get latest analysis: ${error}`);
      return null;
    }
  }

  /**
   * Search analysis results by query
   */
  async searchAnalysis(projectId: string, query: string): Promise<AnalysisResult[]> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const searchQuery = `
        SELECT id, project_id, tool_name, timestamp, analysis, summary, file_count, has_issues
        FROM analysis_results
        WHERE project_id = $1
        AND (
          tool_name ILIKE $2
          OR summary ILIKE $2
          OR analysis::text ILIKE $2
        )
        ORDER BY timestamp DESC
        LIMIT 50
      `;

      const searchPattern = `%${query}%`;
      const result = await pgClient.query(searchQuery, [projectId, searchPattern]);

      const analyses = result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        toolName: row.tool_name,
        timestamp: row.timestamp,
        analysis: JSON.parse(row.analysis),
        summary: row.summary,
        fileCount: row.file_count,
        hasIssues: row.has_issues
      }));

      this.logger.info(`Found ${analyses.length} analysis records matching "${query}" for project ${projectId}`);
      return analyses;
    } catch (error) {
      this.logger.error(`Failed to search analysis: ${error}`);
      return [];
    }
  }

  /**
   * Delete analysis results for a project
   */
  async deleteProjectAnalysis(projectId: string): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        DELETE FROM analysis_results
        WHERE project_id = $1
      `;

      const result = await pgClient.query(query, [projectId]);

      this.logger.info(`Deleted ${result.rowCount} analysis records for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to delete analysis: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const analysisRepo = new AnalysisRepository();