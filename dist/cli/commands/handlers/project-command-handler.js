"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectCommandHandler = void 0;
const base_command_handler_1 = require("../base-command-handler");
const project_identity_service_1 = require("../../services/project-identity-service");
const theme_1 = require("../../ui/theme");
class ProjectCommandHandler extends base_command_handler_1.BaseCommandHandler {
    identityService;
    constructor(context) {
        super(context);
        this.identityService = new project_identity_service_1.ProjectIdentityService();
    }
    async handle(args) {
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
    async handleList() {
        try {
            console.log(theme_1.Theme.colors.info('\n=== Registered Projects ===\n'));
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
                console.log(theme_1.Theme.colors.info(`  ${statusIcon} ${project.projectName}`));
                console.log(theme_1.Theme.colors.muted(`    ID: ${project.id}`));
                console.log(theme_1.Theme.colors.muted(`    Path: ${project.currentPath}`));
                console.log(theme_1.Theme.colors.muted(`    Status: ${project.status}`));
                if (project.dataStats) {
                    console.log(theme_1.Theme.colors.muted(`    Embeddings: ${project.dataStats.embeddings}`));
                }
                console.log('');
            }
            return {
                success: true,
                message: `Found ${projects.length} registered project(s)`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to list projects: ${error instanceof Error ? error.message : error}`
            };
        }
    }
    /**
     * Clean up duplicate project entries for a path
     */
    async handleCleanup(pathArg) {
        const projectPath = pathArg || this.context.currentProject?.projectPath || process.cwd();
        console.log(theme_1.Theme.colors.info(`\nCleaning up duplicates for: ${projectPath}\n`));
        try {
            // Show what will be cleaned
            const deterministicId = this.identityService.generateDeterministicId(projectPath);
            console.log(theme_1.Theme.colors.muted(`Canonical ID: ${deterministicId}`));
            const result = await this.identityService.cleanupDuplicates(projectPath);
            if (result.success) {
                if (result.projectsCleaned === 0) {
                    console.log(theme_1.Theme.colors.success('\n✓ No duplicates found'));
                }
                else {
                    console.log(theme_1.Theme.colors.success(`\n✓ Cleanup completed:`));
                    console.log(theme_1.Theme.colors.info(`  - Projects merged: ${result.projectsCleaned}`));
                    console.log(theme_1.Theme.colors.info(`  - Embeddings migrated: ${result.embeddingsMerged}`));
                    console.log(theme_1.Theme.colors.info(`  - Entities migrated: ${result.entitiesMerged}`));
                }
                if (result.errors.length > 0) {
                    console.log(theme_1.Theme.colors.warning('\nWarnings:'));
                    result.errors.forEach(err => console.log(theme_1.Theme.colors.warning(`  - ${err}`)));
                }
                return {
                    success: true,
                    message: result.projectsCleaned === 0
                        ? 'No duplicates to clean up'
                        : `Cleaned up ${result.projectsCleaned} duplicate project(s)`
                };
            }
            else {
                return {
                    success: false,
                    message: `Cleanup failed: ${result.errors.join(', ')}`
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Cleanup failed: ${error instanceof Error ? error.message : error}`
            };
        }
    }
    /**
     * Find all duplicate project entries across the database
     */
    async handleDuplicates() {
        try {
            console.log(theme_1.Theme.colors.info('\n=== Duplicate Detection ===\n'));
            const duplicates = await this.identityService.findAllDuplicates();
            if (duplicates.size === 0) {
                console.log(theme_1.Theme.colors.success('✓ No duplicates found'));
                return {
                    success: true,
                    message: 'No duplicate projects detected'
                };
            }
            let totalDuplicates = 0;
            for (const [normalizedPath, projects] of duplicates) {
                console.log(theme_1.Theme.colors.warning(`\nPath: ${normalizedPath}`));
                console.log(theme_1.Theme.colors.muted(`  Duplicate entries: ${projects.length}`));
                for (const project of projects) {
                    const p = project;
                    console.log(theme_1.Theme.colors.muted(`    - ${p.id}: ${p.projectName}`));
                    totalDuplicates++;
                }
            }
            console.log(theme_1.Theme.colors.info(`\nTotal duplicate groups: ${duplicates.size}`));
            console.log(theme_1.Theme.colors.info(`Run 'project cleanup <path>' to merge duplicates for a specific path`));
            return {
                success: true,
                message: `Found ${duplicates.size} duplicate group(s) with ${totalDuplicates} total entries`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to find duplicates: ${error instanceof Error ? error.message : error}`
            };
        }
    }
    /**
     * Show detailed information about a specific project
     */
    async handleInfo(projectIdOrPath) {
        try {
            const projectPath = projectIdOrPath || this.context.currentProject?.projectPath || process.cwd();
            console.log(theme_1.Theme.colors.info(`\n=== Project Information ===\n`));
            const resolution = await this.identityService.resolveProject(projectPath);
            if (!resolution.identity) {
                return {
                    success: false,
                    message: 'Project not found in registry'
                };
            }
            const identity = resolution.identity;
            console.log(theme_1.Theme.colors.info(`  Name: ${identity.projectName}`));
            console.log(theme_1.Theme.colors.muted(`  ID: ${identity.id}`));
            console.log(theme_1.Theme.colors.muted(`  Deterministic ID: ${this.identityService.generateDeterministicId(projectPath)}`));
            console.log(theme_1.Theme.colors.muted(`  Current Path: ${identity.currentPath}`));
            console.log(theme_1.Theme.colors.muted(`  Original Path: ${identity.originalPath}`));
            console.log(theme_1.Theme.colors.muted(`  Status: ${identity.status}`));
            console.log(theme_1.Theme.colors.muted(`  Created: ${identity.createdAt}`));
            console.log(theme_1.Theme.colors.muted(`  Last Seen: ${identity.lastSeen}`));
            if (identity.aliases && identity.aliases.length > 0) {
                console.log(theme_1.Theme.colors.muted(`  Previous Paths:`));
                identity.aliases.forEach(alias => console.log(theme_1.Theme.colors.muted(`    - ${alias}`)));
            }
            if (identity.dataStats) {
                console.log(theme_1.Theme.colors.muted(`\n  Data Statistics:`));
                console.log(theme_1.Theme.colors.muted(`    Embeddings: ${identity.dataStats.embeddings}`));
                console.log(theme_1.Theme.colors.muted(`    Entities: ${identity.dataStats.entities}`));
            }
            if (resolution.action !== 'use_existing') {
                console.log(theme_1.Theme.colors.warning(`\n  Note: ${resolution.message}`));
            }
            return {
                success: true,
                message: `Project: ${identity.projectName} (${identity.id})`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to get project info: ${error instanceof Error ? error.message : error}`
            };
        }
    }
    /**
     * Get deterministic ID for a path
     */
    async handleGetId(pathArg) {
        const projectPath = pathArg || this.context.currentProject?.projectPath || process.cwd();
        const deterministicId = this.identityService.generateDeterministicId(projectPath);
        const normalizedPath = this.identityService.normalizePath(projectPath);
        console.log(theme_1.Theme.colors.info(`\nPath: ${projectPath}`));
        console.log(theme_1.Theme.colors.muted(`Normalized: ${normalizedPath}`));
        console.log(theme_1.Theme.colors.success(`Deterministic ID: ${deterministicId}`));
        return {
            success: true,
            message: deterministicId
        };
    }
    /**
     * Show help for project commands
     */
    showHelp() {
        console.log(theme_1.Theme.colors.info('\n=== Project Commands ===\n'));
        console.log(theme_1.Theme.colors.info('  project list|ls'));
        console.log(theme_1.Theme.colors.muted('    List all registered projects with their status and data stats\n'));
        console.log(theme_1.Theme.colors.info('  project cleanup|clean [path]'));
        console.log(theme_1.Theme.colors.muted('    Clean up duplicate project entries for a path'));
        console.log(theme_1.Theme.colors.muted('    Merges embeddings and entities into canonical project\n'));
        console.log(theme_1.Theme.colors.info('  project duplicates|dups'));
        console.log(theme_1.Theme.colors.muted('    Find all duplicate project entries across the database\n'));
        console.log(theme_1.Theme.colors.info('  project info [path|id]'));
        console.log(theme_1.Theme.colors.muted('    Show detailed information about a specific project\n'));
        console.log(theme_1.Theme.colors.info('  project id [path]'));
        console.log(theme_1.Theme.colors.muted('    Get the deterministic ID for a project path\n'));
        return {
            success: true,
            message: 'Project command help'
        };
    }
}
exports.ProjectCommandHandler = ProjectCommandHandler;
//# sourceMappingURL=project-command-handler.js.map