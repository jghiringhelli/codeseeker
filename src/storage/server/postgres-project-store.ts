/**
 * PostgreSQL Project Store
 *
 * Stores project metadata in PostgreSQL for server mode.
 */

import { Pool } from 'pg';
import { IProjectStore, Project } from '../interfaces';

export interface PostgresProjectStoreConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class PostgresProjectStore implements IProjectStore {
  private pool: Pool;
  private initialized = false;

  constructor(private config: PostgresProjectStoreConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // The projects table already exists with legacy schema (project_path, project_name)
    // We don't create it here - just verify connection
    try {
      await this.pool.query('SELECT 1 FROM projects LIMIT 1');
    } catch {
      // Table doesn't exist - this is a test or fresh database
      // Create with the legacy schema for compatibility
      await this.pool.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_path TEXT NOT NULL UNIQUE,
          project_name TEXT NOT NULL,
          project_type TEXT,
          languages JSONB NOT NULL DEFAULT '[]',
          frameworks JSONB DEFAULT '[]',
          project_size TEXT,
          domain TEXT,
          total_files INTEGER DEFAULT 0,
          total_lines INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);
      `);
    }

    this.initialized = true;
  }

  async upsert(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    await this.initialize();

    // Use legacy column names: project_path, project_name
    const result = await this.pool.query(`
      INSERT INTO projects (id, project_name, project_path, metadata, updated_at)
      VALUES ($1::uuid, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        project_name = EXCLUDED.project_name,
        project_path = EXCLUDED.project_path,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id, project_name, project_path, metadata, created_at, updated_at
    `, [
      project.id,
      project.name,
      project.path,
      project.metadata ? JSON.stringify(project.metadata) : null
    ]);

    return this.rowToProject(result.rows[0]);
  }

  async findByPath(projectPath: string): Promise<Project | null> {
    await this.initialize();

    const result = await this.pool.query(`
      SELECT id, project_name, project_path, metadata, created_at, updated_at
      FROM projects
      WHERE project_path = $1
    `, [projectPath]);

    if (result.rows.length === 0) return null;
    return this.rowToProject(result.rows[0]);
  }

  async findById(id: string): Promise<Project | null> {
    await this.initialize();

    const result = await this.pool.query(`
      SELECT id, project_name, project_path, metadata, created_at, updated_at
      FROM projects
      WHERE id = $1::uuid
    `, [id]);

    if (result.rows.length === 0) return null;
    return this.rowToProject(result.rows[0]);
  }

  async list(): Promise<Project[]> {
    await this.initialize();

    const result = await this.pool.query(`
      SELECT id, project_name, project_path, metadata, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC
    `);

    return result.rows.map(row => this.rowToProject(row));
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const result = await this.pool.query(
      'DELETE FROM projects WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async flush(): Promise<void> {
    // No-op for PostgreSQL (writes are immediate)
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private rowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.project_name,
      path: row.project_path,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}