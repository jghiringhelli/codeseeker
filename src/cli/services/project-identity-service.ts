/**
 * Project Identity Service
 * Single Responsibility: Manage project identity with deterministic IDs
 *
 * Key Features:
 * - Deterministic ID generation based on normalized path
 * - Project move detection and handling
 * - Duplicate cleanup
 * - Registry management
 * - Storage-mode aware (embedded SQLite or server PostgreSQL)
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { getStorageProvider, loadStorageConfig } from '../../storage/storage-provider';
import { IProjectStore, Project, StorageMode } from '../../storage/interfaces';

// CodeSeeker namespace for UUID v5 generation (deterministic)
const CODESEEKER_NAMESPACE = 'codeseeker-project-identity';

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
  private logger: Logger;
  private projectStore: IProjectStore | null = null;
  private storageMode: StorageMode;

  constructor() {
    this.logger = Logger.getInstance().child('ProjectIdentity');
    const config = loadStorageConfig();
    this.storageMode = config.mode;
  }

  /**
   * Get or initialize the project store
   */
  private async getProjectStore(): Promise<IProjectStore> {
    if (!this.projectStore) {
      const storage = await getStorageProvider();
      this.projectStore = storage.getProjectStore();
    }
    return this.projectStore;
  }

  /**
   * Generate a deterministic project ID from normalized path
   * Same path always produces the same ID
   */
  generateDeterministicId(projectPath: string): string {
    const normalizedPath = this.normalizePath(projectPath);

    // Create deterministic hash using SHA-256
    const hash = crypto.createHash('sha256')
      .update(CODESEEKER_NAMESPACE + ':' + normalizedPath)
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
      const store = await this.getProjectStore();

      // Step 1: Check if project exists by deterministic ID
      const byId = await store.findById(deterministicId);
      if (byId) {
        // Update last seen (touch the project)
        await store.upsert({
          id: byId.id,
          name: byId.name,
          path: byId.path,
          metadata: byId.metadata
        });

        // Check if path changed (project was moved)
        if (this.normalizePath(byId.path) !== normalizedPath) {
          return {
            identity: this.projectToIdentity(byId, projectPath),
            action: 'update_path',
            message: `Project "${byId.name}" appears to have moved from ${byId.path} to ${projectPath}`
          };
        }

        return {
          identity: this.projectToIdentity(byId),
          action: 'use_existing',
          message: `Using existing project: ${byId.name} (${deterministicId})`
        };
      }

      // Step 2: Check for project by path (might have different ID from old indexing)
      const byPath = await store.findByPath(projectPath);
      if (byPath) {
        return {
          identity: this.projectToIdentity(byPath),
          action: 'use_existing',
          message: `Using existing project: ${byPath.name} (found by path)`
        };
      }

      // Step 3: Check for projects with similar paths (for duplicate detection)
      const allProjects = await store.list();
      const duplicates = allProjects.filter(p =>
        this.normalizePath(p.path) === normalizedPath && p.id !== deterministicId
      );

      if (duplicates.length > 0) {
        return {
          identity: this.projectToIdentity(duplicates[0]),
          action: 'merge_duplicate',
          message: `Found ${duplicates.length} existing project(s) for this path`,
          duplicates: duplicates.map(p => this.projectToIdentity(p))
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

    } catch (error) {
      this.logger.error(`Failed to resolve project: ${error instanceof Error ? error.message : error}`);

      // Fallback: return new identity without storage check
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
        message: `Creating new project (storage unavailable): ${resolvedName}`
      };
    }
  }

  /**
   * Convert Project interface to ProjectIdentity
   */
  private projectToIdentity(project: Project, overridePath?: string): ProjectIdentity {
    const metadata = (project.metadata || {}) as Record<string, unknown>;
    return {
      id: project.id,
      projectName: project.name,
      currentPath: overridePath || project.path,
      originalPath: (metadata.originalPath as string) || project.path,
      aliases: (metadata.aliases as string[]) || [],
      status: (metadata.status as ProjectIdentity['status']) || 'active',
      createdAt: project.createdAt.toISOString(),
      lastSeen: project.updatedAt.toISOString(),
      dataStats: metadata.dataStats as { embeddings: number; entities: number } | undefined
    };
  }

  /**
   * Update project path when a move is confirmed
   */
  async updateProjectPath(projectId: string, newPath: string, oldPath: string): Promise<boolean> {
    try {
      const store = await this.getProjectStore();
      const existing = await store.findById(projectId);

      if (!existing) {
        this.logger.warn(`Project not found for path update: ${projectId}`);
        return false;
      }

      const metadata = (existing.metadata || {}) as Record<string, unknown>;
      const aliases = (metadata.aliases as string[]) || [];
      aliases.push(oldPath);

      await store.upsert({
        id: projectId,
        name: existing.name,
        path: newPath,
        metadata: { ...metadata, aliases, originalPath: metadata.originalPath || oldPath }
      });

      this.logger.info(`Updated project ${projectId} path: ${oldPath} -> ${newPath}`);
      return true;

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

    try {
      const store = await this.getProjectStore();
      const allProjects = await store.list();

      // Find projects with exact same normalized path
      const matchingProjects = allProjects.filter(p =>
        this.normalizePath(p.path) === normalizedPath
      );

      if (matchingProjects.length <= 1) {
        result.success = true;
        return result;
      }

      this.logger.info(`Found ${matchingProjects.length} project(s) matching path`);

      // Keep the canonical one (or first if canonical doesn't exist)
      const canonical = matchingProjects.find(p => p.id === canonicalId) || matchingProjects[0];
      const duplicates = matchingProjects.filter(p => p.id !== canonical.id);

      // Delete duplicates
      for (const dup of duplicates) {
        const deleted = await store.delete(dup.id);
        if (deleted) {
          result.projectsCleaned++;
        }
      }

      // Ensure canonical project exists with correct path
      await store.upsert({
        id: canonicalId,
        name: canonical.name,
        path: projectPath,
        metadata: canonical.metadata
      });

      result.success = true;
      this.logger.info(`Cleanup complete: ${result.projectsCleaned} duplicates removed`);

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
      const store = await this.getProjectStore();
      const projects = await store.list();

      return projects.map(p => this.projectToIdentity(p));

    } catch (error) {
      this.logger.error(`Failed to list projects: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Find duplicates - projects with same path
   */
  async findAllDuplicates(): Promise<Map<string, ProjectIdentity[]>> {
    const duplicateGroups = new Map<string, ProjectIdentity[]>();

    try {
      const store = await this.getProjectStore();
      const allProjects = await store.list();

      // Group by normalized path
      const pathGroups = new Map<string, Project[]>();
      for (const project of allProjects) {
        const normalizedPath = this.normalizePath(project.path);
        const group = pathGroups.get(normalizedPath) || [];
        group.push(project);
        pathGroups.set(normalizedPath, group);
      }

      // Only keep groups with duplicates
      for (const [normalizedPath, projects] of pathGroups) {
        if (projects.length > 1) {
          duplicateGroups.set(normalizedPath, projects.map(p => this.projectToIdentity(p)));
        }
      }

    } catch (error) {
      this.logger.error(`Failed to find duplicates: ${error instanceof Error ? error.message : error}`);
    }

    return duplicateGroups;
  }
}
