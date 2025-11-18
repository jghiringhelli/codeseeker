/**
 * Project Registry Service - Single Responsibility
 * Handles database operations for project management
 */

import { IProjectRegistry, ProjectConfig } from '../../../core/interfaces/project-interfaces';
import { DatabaseConnections } from '../../../config/database-config';

export class ProjectRegistry implements IProjectRegistry {
  constructor(private dbConnections: DatabaseConnections) {}

  async registerProject(config: ProjectConfig): Promise<void> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const query = `
      INSERT INTO projects (
        project_id, project_name, project_path, project_type,
        languages, primary_language, frameworks, features,
        created_at, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (project_id)
      DO UPDATE SET
        project_name = EXCLUDED.project_name,
        project_path = EXCLUDED.project_path,
        project_type = EXCLUDED.project_type,
        languages = EXCLUDED.languages,
        primary_language = EXCLUDED.primary_language,
        frameworks = EXCLUDED.frameworks,
        features = EXCLUDED.features,
        last_updated = EXCLUDED.last_updated
    `;

    const values = [
      config.projectId,
      config.projectName,
      config.projectPath,
      config.projectType,
      JSON.stringify(config.languages),
      config.primaryLanguage,
      JSON.stringify(config.frameworks || []),
      JSON.stringify(config.features || []),
      config.createdAt,
      config.lastUpdated || new Date().toISOString()
    ];

    await postgres.query(query, values);
  }

  async updateProject(projectId: string, updates: Partial<ProjectConfig>): Promise<void> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    if (!setClause) return;

    const query = `
      UPDATE projects
      SET ${setClause}, last_updated = $1
      WHERE project_id = $${Object.keys(updates).length + 2}
    `;

    const values = [
      new Date().toISOString(),
      ...Object.values(updates).map(value =>
        typeof value === 'object' ? JSON.stringify(value) : value
      ),
      projectId
    ];

    await postgres.query(query, values);
  }

  async getProject(projectId: string): Promise<ProjectConfig | null> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const query = `
      SELECT project_id, project_name, project_path, project_type,
             languages, primary_language, frameworks, features,
             created_at, last_updated
      FROM projects
      WHERE project_id = $1
    `;

    const result = await postgres.query(query, [projectId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      projectId: row.project_id,
      projectName: row.project_name,
      projectPath: row.project_path,
      projectType: row.project_type,
      languages: JSON.parse(row.languages || '[]'),
      primaryLanguage: row.primary_language,
      frameworks: JSON.parse(row.frameworks || '[]'),
      features: JSON.parse(row.features || '[]'),
      createdAt: row.created_at,
      lastUpdated: row.last_updated
    };
  }

  async verifyProjectExists(projectId: string): Promise<boolean> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const query = 'SELECT 1 FROM projects WHERE project_id = $1';
    const result = await postgres.query(query, [projectId]);

    return result.rows.length > 0;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}