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
export declare class ProjectCommandHandler extends BaseCommandHandler {
    private identityService;
    constructor(context: import('../command-context').CommandContext);
    handle(args: string): Promise<CommandResult>;
    /**
     * List all registered projects with their data statistics
     */
    private handleList;
    /**
     * Clean up duplicate project entries for a path
     */
    private handleCleanup;
    /**
     * Find all duplicate project entries across the database
     */
    private handleDuplicates;
    /**
     * Show detailed information about a specific project
     */
    private handleInfo;
    /**
     * Get deterministic ID for a path
     */
    private handleGetId;
    /**
     * Show help for project commands
     */
    private showHelp;
}
//# sourceMappingURL=project-command-handler.d.ts.map