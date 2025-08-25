/**
 * Database Migration System
 * Handles database schema migrations and version management
 */
import { Logger } from '../core/interfaces';
export interface Migration {
    version: string;
    description: string;
    up: string;
    down: string;
}
export declare class MigrationManager {
    private dbManager;
    private logger;
    constructor(dbManager: DatabaseManager, logger?: Logger);
    runMigrations(targetVersion?: string): Promise<void>;
    rollbackMigration(version: string): Promise<void>;
    getCurrentVersion(): Promise<string | null>;
    getAppliedVersions(): Promise<string[]>;
    private createMigrationsTable;
    private getMigrations;
    private getPendingMigrations;
    private runMigration;
    private recordMigration;
    private removeMigrationRecord;
}
export declare function runMigrationCLI(): Promise<void>;
//# sourceMappingURL=migrate.d.ts.map