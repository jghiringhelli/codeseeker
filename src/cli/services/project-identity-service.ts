/**
 * Project Identity Service
 * Single Responsibility: Manage project identity with deterministic IDs
 *
 * Key Features:
 * - Deterministic ID generation based on normalized path
 * - Project move detection and handling
 * - Duplicate cleanup
 * - Registry management
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { Client } from 'pg';
import { DatabaseConnections } from '../../config/database-config';
import { Logger } from '../../utils/logger';

// CodeMind namespace for UUID v5 generation (deterministic)
const CODEMIND_NAMESPACE = 'codemind-project-identity';

export interface ProjectIdentity {
  id: string;
  projectName: string;
  currentPath: string;
  originalPath: string;
  aliases: string[];  // Previous paths if project was moved
  status: 'active' | 'moved' | 'missing' | 'duplicate';
  createdAt: string;
  lastSeen: string;
  dataStats?: {
    embeddings: number;
    entities: number;
  };
}

export interface ProjectResolutionResult {
  identity: ProjectIdentity | null;
  action: 'use_existing' | 'create_new' | 'update_path' | 'merge_duplicate' | 'not_found';
  message: string;
  duplicates?: ProjectIdentity[];
}

export interface DuplicateCleanupResult {
  success: boolean;
  projectsCleaned: number;
  embeddingsMerged: number;
  entitiesMerged: number;
  errors: string[];
}

export class ProjectIdentityService {
  private dbConnections: DatabaseConnections;
  private logger: Logger;

  constructor() {
    this.dbConnections = new DatabaseConnections();
    this.logger = Logger.getInstance().child('ProjectIdentity');
  }

  /**
   * Generate a deterministic project ID from normalized path
   * Same path always produces the same ID
   */
  generateDeterministicId(projectPath: string): string {
    const normalizedPath = this.normalizePath(projectPath);

    // Create deterministic hash using SHA-256
    const hash = crypto.createHash('sha256')
      .update(CODEMIND_NAMESPACE + ':' + normalizedPath)
      .digest('hex');

    // Format as UUID-like string (8-4-4-4-12)
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Normalize path for consistent comparison
   * - Resolve to absolute path
   * - Convert to lowercase (for case-insensitive file systems)
   * - Use forward slashes
   */
  normalizePath(projectPath: string): string {
    return path.resolve(projectPath)
      .toLowerCase()
      .replace(/\\/g, '/');
  }

  /**
   * Resolve project identity - main entry point
   * Checks for existing project, handles moves, detects duplicates
   */
  async resolveProject(projectPath: string, projectName?: string): Promise<ProjectResolutionResult> {
    const normalizedPath = this.normalizePath(projectPath);
    const deterministicId = this.generateDeterministicId(projectPath);
    const baseName = path.basename(projectPath);
    const resolvedName = projectName || baseName;

    try {
      const client = await this.dbConnections.getPostgresConnection();

      // Step 1: Check if project exists by deterministic ID
      const byId = await this.findProjectById(client, deterministicId);
      if (byId) {
        // Update last seen
        await this.updateLastSeen(client, deterministicId);

        // Check if path changed (project was moved)
        if (this.normalizePath(byId.currentPath) !== normalizedPath) {
          return {
            identity: { ...byId, currentPath: projectPath },
            action: 'update_path',
            message: `Project "${byId.projectName}" appears to have moved from ${byId.currentPath} to ${projectPath}`
          };
        }

        return {
          identity: byId,
          action: 'use_existing',
          message: `Using existing project: ${byId.projectName} (${deterministicId})`
        };
      }

      // Step 2: Check for duplicates by path or similar name
      const duplicates = await this.findDuplicates(client, normalizedPath, resolvedName);
      if (duplicates.length > 0) {
        return {
          identity: duplicates[0],
          action: 'merge_duplicate',
          message: `Found ${duplicates.length} existing project(s) for this path/name`,
          duplicates
        };
      }

      // Step 3: Check for projects that might have been moved to this location
      const movedFrom = await this.findByAlias(client, normalizedPath);
      if (movedFrom) {
        return {
          identity: movedFrom,
          action: 'use_existing',
          message: `Found project that was previously at this location: ${movedFrom.projectName}`
        };
      }

      // Step 4: No existing project found - create new
      const newIdentity: ProjectIdentity = {
        id: deterministicId,
        projectName: resolvedName,
        currentPath: projectPath,
        originalPath: projectPath,
        aliases: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      return {
        identity: newIdentity,
        action: 'create_new',
        message: `New project will be created: ${resolvedName} (${deterministicId})`
      };
      // Note: Don't close the client - it's a shared/cached connection from DatabaseConnections
    } catch (error) {
      this.logger.error(`Failed to resolve project: ${error instanceof Error ? error.message : error}`);

      // Fallback: return new identity without DB check
      return {
        identity: {
          id: deterministicId,
          projectName: resolvedName,
          currentPath: projectPath,
          originalPath: projectPath,
          aliases: [],
          status: 'active',
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        },
        action: 'create_new',
        message: `Creating new project (database unavailable): ${resolvedName}`
      };
    }
  }

  /**
   * Update project path when a move is confirmed
   */
  async updateProjectPath(projectId: string, newPath: string, oldPath: string): Promise<boolean> {
    try {
      const client = await this.dbConnections.getPostgresConnection();

      // Update current path and add old path to aliases
      await client.query(`
        UPDATE projects
        SET project_path = $1,
            metadata = jsonb_set(
              COALESCE(metadata, '{}')::jsonb,
              '{aliases}',
              COALESCE(metadata->'aliases', '[]')::jsonb || to_jsonb($2::text)
            ),
            updated_at = NOW()
        WHERE id = $3
      `, [newPath, oldPath, projectId]);

      this.logger.info(`Updated project ${projectId} path: ${oldPath} -> ${newPath}`);
      return true;
      // Note: Don't close the client - it's a shared/cached connection from DatabaseConnections
    } catch (error) {
      this.logger.error(`Failed to update project path: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Clean up duplicate projects
   * Merges data from duplicates into the canonical (deterministic) entry
   */
  async cleanupDuplicates(projectPath: string): Promise<DuplicateCleanupResult> {
    const result: DuplicateCleanupResult = {
      success: false,
      projectsCleaned: 0,
      embeddingsMerged: 0,
      entitiesMerged: 0,
      errors: []
    };

    const canonicalId = this.generateDeterministicId(projectPath);
    const normalizedPath = this.normalizePath(projectPath);
    const baseName = path.basename(projectPath).toLowerCase();

    try {
      const client = await this.dbConnections.getPostgresConnection();

      // Find ALL projects with EXACT same normalized path (true duplicates only)
      // This should NOT match ContractMaster-Test when cleaning up ContractMaster
      const allMatchingResult = await client.query(`
        SELECT id, project_name, project_path
        FROM projects
        WHERE LOWER(REPLACE(project_path, '\\', '/')) = $1
        ORDER BY created_at ASC
      `, [normalizedPath]);

      if (allMatchingResult.rows.length <= 1) {
        // 0 or 1 project - nothing to clean up
        result.success = true;
        result.projectsCleaned = 0;
        return result;
      }

      this.logger.info(`Found ${allMatchingResult.rows.length} project(s) matching path`);

      // Check if canonical project already exists
      const canonicalExists = allMatchingResult.rows.find(r => r.id === canonicalId);
      const duplicateRows = allMatchingResult.rows.filter(r => r.id !== canonicalId);
      const duplicateIds = duplicateRows.map(r => r.id);

      // Step 1: FIRST ensure canonical project exists (FK constraint requires this)
      if (!canonicalExists) {
        // Get first duplicate's name for the canonical entry
        const projectName = duplicateRows[0]?.project_name || path.basename(projectPath);

        // Use a temporary unique path to avoid unique constraint, will update later
        const tempPath = `${projectPath}_canonical_temp_${Date.now()}`;
        await client.query(`
          INSERT INTO projects (id, project_name, project_path, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [canonicalId, projectName, tempPath]);

        this.logger.info(`Created canonical project entry: ${canonicalId}`);
      }

      // Step 2: Migrate embeddings - handle duplicates by keeping the one with most recent data
      // First, delete embeddings from duplicates that would conflict with canonical
      for (const dupId of duplicateIds) {
        // Delete duplicate embeddings that already exist in canonical
        await client.query(`
          DELETE FROM semantic_search_embeddings dup
          WHERE dup.project_id = $1
            AND EXISTS (
              SELECT 1 FROM semantic_search_embeddings canon
              WHERE canon.project_id = $2
                AND canon.file_path = dup.file_path
                AND canon.chunk_index = dup.chunk_index
            )
        `, [dupId, canonicalId]);

        // Now safely migrate remaining embeddings
        const embeddingResult = await client.query(`
          UPDATE semantic_search_embeddings
          SET project_id = $1
          WHERE project_id = $2
          RETURNING id
        `, [canonicalId, dupId]);

        result.embeddingsMerged += embeddingResult.rowCount || 0;
      }

      // Step 3: Delete all duplicate project entries (not the canonical one)
      if (duplicateIds.length > 0) {
        const deleteResult = await client.query(`
          DELETE FROM projects WHERE id = ANY($1)
          RETURNING id
        `, [duplicateIds]);

        result.projectsCleaned = deleteResult.rowCount || 0;
      }

      // Step 4: Update canonical project with correct path (now that duplicates are gone)
      await client.query(`
        UPDATE projects SET project_path = $1, updated_at = NOW() WHERE id = $2
      `, [projectPath, canonicalId]);

      result.success = true;

      this.logger.info(`Cleanup complete: ${result.projectsCleaned} projects, ${result.embeddingsMerged} embeddings merged`);
      // Note: Don't close the client - it's a shared/cached connection from DatabaseConnections

      // Also clean up Neo4j
      try {
        await this.cleanupNeo4jDuplicates(canonicalId, projectPath);
      } catch (error) {
        result.errors.push(`Neo4j cleanup failed: ${error instanceof Error ? error.message : error}`);
      }

    } catch (error) {
      result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : error}`);
    }

    return result;
  }

  /**
   * List all projects with their data statistics
   */
  async listProjects(): Promise<ProjectIdentity[]> {
    try {
      const client = await this.dbConnections.getPostgresConnection();

      const result = await client.query(`
        SELECT
          p.id,
          p.project_name,
          p.project_path as current_path,
          COALESCE(p.metadata->>'originalPath', p.project_path) as original_path,
          COALESCE(p.metadata->'aliases', '[]') as aliases,
          COALESCE(p.metadata->>'status', 'active') as status,
          p.created_at,
          p.updated_at as last_seen,
          COUNT(DISTINCT e.id) as embedding_count
        FROM projects p
        LEFT JOIN semantic_search_embeddings e ON p.id = e.project_id
        GROUP BY p.id, p.project_name, p.project_path, p.metadata, p.created_at, p.updated_at
        ORDER BY p.updated_at DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        projectName: row.project_name,
        currentPath: row.current_path,
        originalPath: row.original_path,
        aliases: row.aliases || [],
        status: row.status as ProjectIdentity['status'],
        createdAt: row.created_at?.toISOString() || new Date().toISOString(),
        lastSeen: row.last_seen?.toISOString() || new Date().toISOString(),
        dataStats: {
          embeddings: parseInt(row.embedding_count) || 0,
          entities: 0 // Would need Neo4j query
        }
      }));
      // Note: Don't close the client - it's a shared/cached connection from DatabaseConnections
    } catch (error) {
      this.logger.error(`Failed to list projects: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Find duplicates - projects with same path or very similar names
   */
  async findAllDuplicates(): Promise<Map<string, ProjectIdentity[]>> {
    const duplicateGroups = new Map<string, ProjectIdentity[]>();

    try {
      const client = await this.dbConnections.getPostgresConnection();

      // Find projects grouped by normalized path
      const result = await client.query(`
        SELECT
          LOWER(REPLACE(project_path, '\\', '/')) as normalized_path,
          array_agg(json_build_object(
            'id', id,
            'projectName', project_name,
            'currentPath', project_path,
            'createdAt', created_at
          )) as projects,
          COUNT(*) as count
        FROM projects
        GROUP BY LOWER(REPLACE(project_path, '\\', '/'))
        HAVING COUNT(*) > 1
      `);

      for (const row of result.rows) {
        duplicateGroups.set(row.normalized_path, row.projects);
      }
      // Note: Don't close the client - it's a shared/cached connection from DatabaseConnections
    } catch (error) {
      this.logger.error(`Failed to find duplicates: ${error instanceof Error ? error.message : error}`);
    }

    return duplicateGroups;
  }

  // Private helper methods

  private async findProjectById(client: Client, projectId: string): Promise<ProjectIdentity | null> {
    const result = await client.query(`
      SELECT
        id, project_name, project_path,
        COALESCE(metadata->>'originalPath', project_path) as original_path,
        COALESCE(metadata->'aliases', '[]') as aliases,
        COALESCE(metadata->>'status', 'active') as status,
        created_at, updated_at
      FROM projects
      WHERE id = $1
    `, [projectId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      projectName: row.project_name,
      currentPath: row.project_path,
      originalPath: row.original_path,
      aliases: row.aliases || [],
      status: row.status,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      lastSeen: row.updated_at?.toISOString() || new Date().toISOString()
    };
  }

  private async findDuplicates(client: Client, normalizedPath: string, _projectName: string): Promise<ProjectIdentity[]> {
    // Only find true duplicates: projects with EXACT same normalized path
    // Do NOT match by name or partial path - different folders are different projects
    const result = await client.query(`
      SELECT
        id, project_name, project_path,
        COALESCE(metadata->>'originalPath', project_path) as original_path,
        created_at, updated_at
      FROM projects
      WHERE LOWER(REPLACE(project_path, '\\', '/')) = $1
    `, [normalizedPath]);

    return result.rows.map(row => ({
      id: row.id,
      projectName: row.project_name,
      currentPath: row.project_path,
      originalPath: row.original_path,
      aliases: [],
      status: 'duplicate' as const,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      lastSeen: row.updated_at?.toISOString() || new Date().toISOString()
    }));
  }

  private async findByAlias(client: Client, normalizedPath: string): Promise<ProjectIdentity | null> {
    const result = await client.query(`
      SELECT
        id, project_name, project_path,
        COALESCE(metadata->>'originalPath', project_path) as original_path,
        COALESCE(metadata->'aliases', '[]') as aliases,
        created_at, updated_at
      FROM projects
      WHERE metadata->'aliases' @> to_jsonb($1::text)
    `, [normalizedPath]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      projectName: row.project_name,
      currentPath: row.project_path,
      originalPath: row.original_path,
      aliases: row.aliases || [],
      status: 'active',
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      lastSeen: row.updated_at?.toISOString() || new Date().toISOString()
    };
  }

  private async updateLastSeen(client: Client, projectId: string): Promise<void> {
    await client.query(
      'UPDATE projects SET updated_at = NOW() WHERE id = $1',
      [projectId]
    );
  }

  private async cleanupNeo4jDuplicates(canonicalId: string, projectPath: string): Promise<void> {
    const driver = await this.dbConnections.getNeo4jConnection();
    const session = driver.session();

    try {
      const baseName = path.basename(projectPath);

      // Find duplicate project nodes
      const duplicates = await session.run(`
        MATCH (p:PROJECT)
        WHERE p.path CONTAINS $baseName AND p.id <> $canonicalId
        RETURN p.id as id
      `, { baseName, canonicalId });

      for (const record of duplicates.records) {
        const dupId = record.get('id');

        // Migrate entities to canonical project
        await session.run(`
          MATCH (e:ENTITY {projectId: $dupId})
          SET e.projectId = $canonicalId
        `, { dupId, canonicalId });

        // Delete duplicate project node
        await session.run(`
          MATCH (p:PROJECT {id: $dupId})
          DELETE p
        `, { dupId });
      }
    } finally {
      await session.close();
    }
  }
}
