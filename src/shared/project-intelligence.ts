/**
 * Project Intelligence Service
 * Provides AI-driven insights about projects using PostgreSQL
 */

import { Logger, LogLevel } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectContext {
  projectId: string;
  name: string;
  type: string;
  languages: string[];
  frameworks: string[];
  patterns: string[];
  complexity: number;
  lastAnalyzed: Date;
}

export class ProjectIntelligence {
  private logger: Logger;
  private dbConnections: DatabaseConnections;

  constructor() {
    this.logger = new Logger(LogLevel.INFO, 'ProjectIntelligence');
    this.dbConnections = new DatabaseConnections();
  }

  /**
   * Get intelligent project context
   */
  async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        SELECT project_id, name, type, languages, frameworks, patterns, complexity, last_analyzed
        FROM project_intelligence
        WHERE project_id = $1
      `;

      const result = await pgClient.query(query, [projectId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        projectId: row.project_id,
        name: row.name,
        type: row.type,
        languages: JSON.parse(row.languages || '[]'),
        frameworks: JSON.parse(row.frameworks || '[]'),
        patterns: JSON.parse(row.patterns || '[]'),
        complexity: row.complexity,
        lastAnalyzed: row.last_analyzed
      };
    } catch (error) {
      this.logger.error(`Failed to get project context: ${error}`);
      return null;
    }
  }

  /**
   * Update project intelligence
   */
  async updateProjectIntelligence(projectId: string, data: any): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const query = `
        INSERT INTO project_intelligence (project_id, name, type, languages, frameworks, patterns, complexity, last_analyzed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (project_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          languages = EXCLUDED.languages,
          frameworks = EXCLUDED.frameworks,
          patterns = EXCLUDED.patterns,
          complexity = EXCLUDED.complexity,
          last_analyzed = NOW()
      `;

      await pgClient.query(query, [
        projectId,
        data.name || 'Unknown Project',
        data.type || 'unknown',
        JSON.stringify(data.languages || []),
        JSON.stringify(data.frameworks || []),
        JSON.stringify(data.patterns || []),
        data.complexity || 1
      ]);

      this.logger.info(`Updated intelligence for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to update project intelligence: ${error}`);
    }
  }

  /**
   * Get project insights
   */
  async getProjectInsights(projectId: string): Promise<any> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // Get basic project intelligence
      const context = await this.getProjectContext(projectId);
      if (!context) {
        return {};
      }

      // Get recent analysis results for insights
      const analysisQuery = `
        SELECT tool_name, analysis, has_issues, timestamp
        FROM analysis_results
        WHERE project_id = $1
        ORDER BY timestamp DESC
        LIMIT 10
      `;

      const analysisResult = await pgClient.query(analysisQuery, [projectId]);
      const recentAnalyses = analysisResult.rows;

      // Generate insights based on project data
      const insights = {
        projectType: context.type,
        primaryLanguages: context.languages.slice(0, 3),
        frameworks: context.frameworks,
        complexity: context.complexity,
        recentIssues: recentAnalyses.filter(a => a.has_issues).length,
        totalAnalyses: recentAnalyses.length,
        lastActivity: context.lastAnalyzed,
        recommendations: this.generateRecommendations(context, recentAnalyses)
      };

      this.logger.info(`Retrieved insights for project ${projectId}`);
      return insights;
    } catch (error) {
      this.logger.error(`Failed to get project insights: ${error}`);
      return {};
    }
  }

  /**
   * Learn from tool execution
   */
  async learnFromToolExecution(projectId: string, toolName: string, result: any): Promise<void> {
    try {
      // TODO: Implement PostgreSQL-based learning
      this.logger.info(`Learning from ${toolName} execution in project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to learn from tool execution: ${error}`);
    }
  }

  /**
   * Get smart recommendations
   */
  async getRecommendations(projectId: string): Promise<string[]> {
    try {
      const insights = await this.getProjectInsights(projectId);
      return insights.recommendations || [];
    } catch (error) {
      this.logger.error(`Failed to get recommendations: ${error}`);
      return [];
    }
  }

  /**
   * Generate recommendations based on project data
   */
  private generateRecommendations(context: ProjectContext, recentAnalyses: any[]): string[] {
    const recommendations = [];

    // Complexity-based recommendations
    if (context.complexity > 5) {
      recommendations.push('Consider refactoring to reduce code complexity');
    }

    // Language-based recommendations
    if (context.languages.includes('typescript') && !context.frameworks.includes('prettier')) {
      recommendations.push('Consider adding Prettier for consistent code formatting');
    }

    // Issue-based recommendations
    const recentIssues = recentAnalyses.filter(a => a.has_issues);
    if (recentIssues.length > 3) {
      recommendations.push('Multiple issues detected - consider running quality analysis');
    }

    // Framework-specific recommendations
    if (context.frameworks.includes('react') && !context.frameworks.includes('eslint')) {
      recommendations.push('Consider adding ESLint for React best practices');
    }

    return recommendations;
  }
}

// Export singleton instance
export const projectIntelligence = new ProjectIntelligence();