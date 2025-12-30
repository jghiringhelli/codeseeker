/**
 * Project Service
 * SOLID Principles: Single Responsibility - Handle project CRUD operations
 */

import { Pool } from 'pg';
import { Logger } from '../../../utils/logger';
import { Project } from '../base';
import { IProjectService } from '../interfaces';

export class ProjectService implements IProjectService {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create project
      const projectResult = await client.query(`
        INSERT INTO projects (
          project_path, project_name, project_type, languages, frameworks,
          project_size, domain, total_files, total_lines, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        projectData.projectPath,
        projectData.projectName,
        projectData.projectType,
        JSON.stringify(projectData.languages),
        JSON.stringify(projectData.frameworks),
        projectData.projectSize,
        projectData.domain,
        projectData.totalFiles,
        projectData.totalLines,
        projectData.status,
        JSON.stringify(projectData.metadata)
      ]);

      const project = this.mapRowToProject(projectResult.rows[0]);

      // Create primary path entry
      await client.query(`
        INSERT INTO project_paths (project_id, path, path_type, is_active)
        VALUES ($1, $2, 'primary', true)
      `, [project.id, project.projectPath]);

      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProject(projectPath: string): Promise<Project | null> {
    try {
      const result = await this.pool.query(`
        SELECT p.* FROM projects p
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
        ORDER BY pp.created_at ASC
        LIMIT 1
      `, [projectPath]);

      if (result.rows.length === 0) return null;
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get project:', error);
      throw error;
    }
  }

  async getProjectById(id: string): Promise<Project | null> {
    try {
      const result = await this.pool.query('SELECT * FROM projects WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get project by ID:', error);
      throw error;
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt') continue;

        if (['languages', 'frameworks', 'metadata'].includes(key)) {
          setClause.push(`${this.camelToSnake(key)} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${this.camelToSnake(key)} = $${paramIndex++}`);
          values.push(value);
        }
      }

      setClause.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE projects
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error(`Project with id ${id} not found`);
      }

      await client.query('COMMIT');
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProject(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete - set status to deleted
      const result = await client.query(`
        UPDATE projects
        SET status = 'deleted', updated_at = NOW()
        WHERE id = $1 AND status != 'deleted'
        RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        throw new Error(`Project with id ${id} not found or already deleted`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to delete project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async listProjects(status = 'active', limit = 50, offset = 0): Promise<Project[]> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM projects
        WHERE status = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `, [status, limit, offset]);

      return result.rows.map(row => this.mapRowToProject(row));
    } catch (error) {
      this.logger.error('Failed to list projects:', error);
      throw error;
    }
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      projectPath: row.project_path,
      projectName: row.project_name,
      projectType: row.project_type,
      languages: typeof row.languages === 'string' ? JSON.parse(row.languages) : row.languages,
      frameworks: typeof row.frameworks === 'string' ? JSON.parse(row.frameworks) : row.frameworks,
      projectSize: row.project_size,
      domain: row.domain,
      totalFiles: row.total_files,
      totalLines: row.total_lines,
      status: row.status,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}