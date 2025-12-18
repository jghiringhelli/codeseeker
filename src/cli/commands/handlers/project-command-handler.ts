/**
 * Project Command Handler
 * Single Responsibility: Handle project management commands
 *
 * Subcommands:
 * - list: Show all registered projects
 * - cleanup [path]: Clean up duplicate projects for a path
 * - info [id]: Show detailed project information
 * - duplicates: Find all duplicate project entries
 */

import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { ProjectIdentityService } from '../../services/project-identity-service';
import { Theme } from '../../ui/theme';

export class ProjectCommandHandler extends BaseCommandHandler {
  private identityService: ProjectIdentityService;

  constructor(context: import('../command-context').CommandContext) {
    super(context);
    this.identityService = new ProjectIdentityService();
  }

  async handle(args: string): Promise<CommandResult> {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase() || 'list';
    const subArgs = parts.slice(1).join(' ');

    switch (subcommand) {
      case 'list':
      case 'ls':
        return await this.handleList();

      case 'cleanup':
      case 'clean':
        return await this.handleCleanup(subArgs);

      case 'duplicates':
      case 'dups':
        return await this.handleDuplicates();

      case 'info':
        return await this.handleInfo(subArgs);

      case 'id':
        return await this.handleGetId(subArgs);

      case 'help':
        return this.showHelp();

      default:
        return {
          success: false,
          message: `Unknown project subcommand: ${subcommand}. Use 'project help' for available commands.`
        };
    }
  }

  /**
   * List all registered projects with their data statistics
   */
  private async handleList(): Promise<CommandResult> {
    try {
      console.log(Theme.colors.info('\n=== Registered Projects ===\n'));

      const projects = await this.identityService.listProjects();

      if (projects.length === 0) {
        return {
          success: true,
          message: 'No projects registered. Run "init" to register a project.'
        };
      }

      for (const project of projects) {
        const statusIcon = project.status === 'active' ? '✓' :
                          project.status === 'missing' ? '!' :
                          project.status === 'duplicate' ? '⚠' : '?';

        console.log(Theme.colors.info(`  ${statusIcon} ${project.projectName}`));
        console.log(Theme.colors.muted(`    ID: ${project.id}`));
        console.log(Theme.colors.muted(`    Path: ${project.currentPath}`));
        console.log(Theme.colors.muted(`    Status: ${project.status}`));
        if (project.dataStats) {
          console.log(Theme.colors.muted(`    Embeddings: ${project.dataStats.embeddings}`));
        }
        console.log('');
      }

      return {
        success: true,
        message: `Found ${projects.length} registered project(s)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list projects: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Clean up duplicate project entries for a path
   */
  private async handleCleanup(pathArg: string): Promise<CommandResult> {
    const projectPath = pathArg || this.context.currentProject?.projectPath || process.cwd();

    console.log(Theme.colors.info(`\nCleaning up duplicates for: ${projectPath}\n`));

    try {
      // Show what will be cleaned
      const deterministicId = this.identityService.generateDeterministicId(projectPath);
      console.log(Theme.colors.muted(`Canonical ID: ${deterministicId}`));

      const result = await this.identityService.cleanupDuplicates(projectPath);

      if (result.success) {
        if (result.projectsCleaned === 0) {
          console.log(Theme.colors.success('\n✓ No duplicates found'));
        } else {
          console.log(Theme.colors.success(`\n✓ Cleanup completed:`));
          console.log(Theme.colors.info(`  - Projects merged: ${result.projectsCleaned}`));
          console.log(Theme.colors.info(`  - Embeddings migrated: ${result.embeddingsMerged}`));
          console.log(Theme.colors.info(`  - Entities migrated: ${result.entitiesMerged}`));
        }

        if (result.errors.length > 0) {
          console.log(Theme.colors.warning('\nWarnings:'));
          result.errors.forEach(err => console.log(Theme.colors.warning(`  - ${err}`)));
        }

        return {
          success: true,
          message: result.projectsCleaned === 0
            ? 'No duplicates to clean up'
            : `Cleaned up ${result.projectsCleaned} duplicate project(s)`
        };
      } else {
        return {
          success: false,
          message: `Cleanup failed: ${result.errors.join(', ')}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Find all duplicate project entries across the database
   */
  private async handleDuplicates(): Promise<CommandResult> {
    try {
      console.log(Theme.colors.info('\n=== Duplicate Detection ===\n'));

      const duplicates = await this.identityService.findAllDuplicates();

      if (duplicates.size === 0) {
        console.log(Theme.colors.success('✓ No duplicates found'));
        return {
          success: true,
          message: 'No duplicate projects detected'
        };
      }

      let totalDuplicates = 0;
      for (const [normalizedPath, projects] of duplicates) {
        console.log(Theme.colors.warning(`\nPath: ${normalizedPath}`));
        console.log(Theme.colors.muted(`  Duplicate entries: ${projects.length}`));

        for (const project of projects) {
          const p = project as { id: string; projectName: string; createdAt?: string };
          console.log(Theme.colors.muted(`    - ${p.id}: ${p.projectName}`));
          totalDuplicates++;
        }
      }

      console.log(Theme.colors.info(`\nTotal duplicate groups: ${duplicates.size}`));
      console.log(Theme.colors.info(`Run 'project cleanup <path>' to merge duplicates for a specific path`));

      return {
        success: true,
        message: `Found ${duplicates.size} duplicate group(s) with ${totalDuplicates} total entries`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to find duplicates: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Show detailed information about a specific project
   */
  private async handleInfo(projectIdOrPath: string): Promise<CommandResult> {
    try {
      const projectPath = projectIdOrPath || this.context.currentProject?.projectPath || process.cwd();

      console.log(Theme.colors.info(`\n=== Project Information ===\n`));

      const resolution = await this.identityService.resolveProject(projectPath);

      if (!resolution.identity) {
        return {
          success: false,
          message: 'Project not found in registry'
        };
      }

      const identity = resolution.identity;
      console.log(Theme.colors.info(`  Name: ${identity.projectName}`));
      console.log(Theme.colors.muted(`  ID: ${identity.id}`));
      console.log(Theme.colors.muted(`  Deterministic ID: ${this.identityService.generateDeterministicId(projectPath)}`));
      console.log(Theme.colors.muted(`  Current Path: ${identity.currentPath}`));
      console.log(Theme.colors.muted(`  Original Path: ${identity.originalPath}`));
      console.log(Theme.colors.muted(`  Status: ${identity.status}`));
      console.log(Theme.colors.muted(`  Created: ${identity.createdAt}`));
      console.log(Theme.colors.muted(`  Last Seen: ${identity.lastSeen}`));

      if (identity.aliases && identity.aliases.length > 0) {
        console.log(Theme.colors.muted(`  Previous Paths:`));
        identity.aliases.forEach(alias => console.log(Theme.colors.muted(`    - ${alias}`)));
      }

      if (identity.dataStats) {
        console.log(Theme.colors.muted(`\n  Data Statistics:`));
        console.log(Theme.colors.muted(`    Embeddings: ${identity.dataStats.embeddings}`));
        console.log(Theme.colors.muted(`    Entities: ${identity.dataStats.entities}`));
      }

      if (resolution.action !== 'use_existing') {
        console.log(Theme.colors.warning(`\n  Note: ${resolution.message}`));
      }

      return {
        success: true,
        message: `Project: ${identity.projectName} (${identity.id})`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get project info: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Get deterministic ID for a path
   */
  private async handleGetId(pathArg: string): Promise<CommandResult> {
    const projectPath = pathArg || this.context.currentProject?.projectPath || process.cwd();

    const deterministicId = this.identityService.generateDeterministicId(projectPath);
    const normalizedPath = this.identityService.normalizePath(projectPath);

    console.log(Theme.colors.info(`\nPath: ${projectPath}`));
    console.log(Theme.colors.muted(`Normalized: ${normalizedPath}`));
    console.log(Theme.colors.success(`Deterministic ID: ${deterministicId}`));

    return {
      success: true,
      message: deterministicId
    };
  }

  /**
   * Show help for project commands
   */
  private showHelp(): CommandResult {
    console.log(Theme.colors.info('\n=== Project Commands ===\n'));
    console.log(Theme.colors.info('  project list|ls'));
    console.log(Theme.colors.muted('    List all registered projects with their status and data stats\n'));
    console.log(Theme.colors.info('  project cleanup|clean [path]'));
    console.log(Theme.colors.muted('    Clean up duplicate project entries for a path'));
    console.log(Theme.colors.muted('    Merges embeddings and entities into canonical project\n'));
    console.log(Theme.colors.info('  project duplicates|dups'));
    console.log(Theme.colors.muted('    Find all duplicate project entries across the database\n'));
    console.log(Theme.colors.info('  project info [path|id]'));
    console.log(Theme.colors.muted('    Show detailed information about a specific project\n'));
    console.log(Theme.colors.info('  project id [path]'));
    console.log(Theme.colors.muted('    Get the deterministic ID for a project path\n'));

    return {
      success: true,
      message: 'Project command help'
    };
  }
}