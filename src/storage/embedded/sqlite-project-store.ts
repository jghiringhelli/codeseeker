/**
 * SQLite-based Project Store
 *
 * Stores project metadata and configuration in SQLite for:
 * - Zero external dependencies
 * - Automatic disk persistence
 * - ACID transactions
 *
 * Shares the same SQLite database as the vector store for efficiency.
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { IProjectStore, Project } from '../interfaces';

export class SQLiteProjectStore implements IProjectStore {
  private db: DatabaseType;
  private isDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private dataDir: string,
    private flushIntervalSeconds = 30
  ) {
    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = path.join(dataDir, 'projects.db');
    this.db = new Database(dbPath);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initializeSchema();
    this.startFlushTimer();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
    `);
  }

  private startFlushTimer(): void {
    if (this.flushIntervalSeconds > 0) {
      this.flushTimer = setInterval(() => {
        if (this.isDirty) {
          this.flush().catch(console.error);
        }
      }, this.flushIntervalSeconds * 1000);
    }
  }

  async upsert(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const nowIso = now.toISOString();
    const metadata = project.metadata ? JSON.stringify(project.metadata) : null;

    // Check if exists by ID or by path to support reinitializing existing projects
    let existing = await this.findById(project.id);
    if (!existing) {
      existing = await this.findByPath(project.path);
    }
    const createdAt = existing?.createdAt || now;
    const projectId = existing?.id || project.id;

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    stmt.run(projectId, project.name, project.path, metadata, createdAt.toISOString(), nowIso);
    this.isDirty = true;

    return {
      id: projectId,
      name: project.name,
      path: project.path,
      metadata: project.metadata,
      createdAt,
      updatedAt: now
    };
  }

  async findByPath(projectPath: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE path = ?');
    const row = stmt.get(projectPath) as {
      id: string;
      name: string;
      path: string;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async findById(id: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as {
      id: string;
      name: string;
      path: string;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async list(): Promise<Project[]> {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      path: string;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      path: row.path,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      this.isDirty = true;
      return true;
    }
    return false;
  }

  async flush(): Promise<void> {
    this.db.pragma('wal_checkpoint(PASSIVE)');
    this.isDirty = false;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.db.close();
  }
}