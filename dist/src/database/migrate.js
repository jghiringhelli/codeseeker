"use strict";
/**
 * Database Migration System
 * Handles database schema migrations and version management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationManager = void 0;
exports.runMigrationCLI = runMigrationCLI;
const manager_1 = require("./manager");
const fs_1 = require("fs");
const path_1 = require("path");
class MigrationManager {
    dbManager;
    logger;
    constructor(dbManager, logger) {
        this.dbManager = dbManager;
        this.logger = logger || console;
    }
    async runMigrations(targetVersion) {
        this.logger.info('Starting database migrations', { targetVersion });
        try {
            // Ensure database is initialized
            await this.dbManager.initialize();
            // Create migrations tracking table if it doesn't exist
            await this.createMigrationsTable();
            // Get current version
            const currentVersion = await this.getCurrentVersion();
            this.logger.info('Current database version', { version: currentVersion });
            // Get available migrations
            const migrations = this.getMigrations();
            const pendingMigrations = this.getPendingMigrations(migrations, currentVersion, targetVersion);
            if (pendingMigrations.length === 0) {
                this.logger.info('No pending migrations');
                return;
            }
            this.logger.info(`Running ${pendingMigrations.length} migrations`);
            // Run migrations in transaction
            for (const migration of pendingMigrations) {
                await this.runMigration(migration);
            }
            this.logger.info('All migrations completed successfully');
        }
        catch (error) {
            this.logger.error('Migration failed', error);
            throw error;
        }
    }
    async rollbackMigration(version) {
        this.logger.info('Rolling back migration', { version });
        try {
            const migrations = this.getMigrations();
            const migration = migrations.find(m => m.version === version);
            if (!migration) {
                throw new Error(`Migration ${version} not found`);
            }
            // Check if migration is applied
            const appliedVersions = await this.getAppliedVersions();
            if (!appliedVersions.includes(version)) {
                throw new Error(`Migration ${version} is not applied`);
            }
            // Run rollback
            if (migration.down) {
                await this.dbManager.executeQuery(migration.down);
                await this.removeMigrationRecord(version);
                this.logger.info(`Migration ${version} rolled back successfully`);
            }
            else {
                throw new Error(`Migration ${version} does not support rollback`);
            }
        }
        catch (error) {
            this.logger.error('Rollback failed', error);
            throw error;
        }
    }
    async getCurrentVersion() {
        try {
            const result = await this.dbManager.executeQuery(`
        SELECT version FROM migrations 
        ORDER BY applied_at DESC 
        LIMIT 1
      `);
            return result.length > 0 ? result[0].version : null;
        }
        catch {
            // Table might not exist yet
            return null;
        }
    }
    async getAppliedVersions() {
        try {
            const result = await this.dbManager.executeQuery(`
        SELECT version FROM migrations 
        ORDER BY applied_at ASC
      `);
            return result.map((row) => row.version);
        }
        catch {
            return [];
        }
    }
    async createMigrationsTable() {
        await this.dbManager.executeQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    getMigrations() {
        // For now, we define migrations inline
        // In a larger system, these would be loaded from migration files
        return [
            {
                version: '001',
                description: 'Initial schema',
                up: '', // Schema is already handled by the main schema.sql
                down: 'DROP TABLE IF EXISTS initialization_progress; DROP TABLE IF EXISTS detected_patterns; DROP TABLE IF EXISTS questionnaire_responses; DROP TABLE IF EXISTS analysis_results;'
            },
            {
                version: '002',
                description: 'Add project metadata table',
                up: `
          CREATE TABLE IF NOT EXISTS project_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_path TEXT UNIQUE NOT NULL,
            project_name TEXT NOT NULL,
            project_type TEXT CHECK (
              project_type IN (
                'web_application', 'api_service', 'library', 'mobile_app', 
                'desktop_app', 'cli_tool', 'unknown'
              )
            ),
            languages TEXT NOT NULL,
            frameworks TEXT,
            project_size TEXT CHECK (
              project_size IN ('small', 'medium', 'large', 'enterprise')
            ),
            domain TEXT,
            total_files INTEGER DEFAULT 0,
            total_lines INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_metadata_project_path ON project_metadata(project_path);
        `,
                down: 'DROP TABLE IF EXISTS project_metadata;'
            },
            {
                version: '003',
                description: 'Add performance metrics table',
                up: `
          CREATE TABLE IF NOT EXISTS operation_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_type TEXT NOT NULL,
            project_path TEXT,
            duration_ms INTEGER NOT NULL,
            files_processed INTEGER DEFAULT 0,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_metrics_operation_type ON operation_metrics(operation_type);
          CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON operation_metrics(created_at);
        `,
                down: 'DROP TABLE IF EXISTS operation_metrics;'
            }
        ];
    }
    getPendingMigrations(migrations, currentVersion, targetVersion) {
        let startIndex = 0;
        if (currentVersion) {
            startIndex = migrations.findIndex(m => m.version === currentVersion) + 1;
        }
        let endIndex = migrations.length;
        if (targetVersion) {
            endIndex = migrations.findIndex(m => m.version === targetVersion) + 1;
            if (endIndex === 0) {
                throw new Error(`Target version ${targetVersion} not found`);
            }
        }
        return migrations.slice(startIndex, endIndex);
    }
    async runMigration(migration) {
        this.logger.info(`Running migration ${migration.version}: ${migration.description}`);
        try {
            // Run migration SQL if provided
            if (migration.up) {
                await this.dbManager.executeQuery(migration.up);
            }
            // Record migration as applied
            await this.recordMigration(migration.version, migration.description);
            this.logger.info(`Migration ${migration.version} completed`);
        }
        catch (error) {
            this.logger.error(`Migration ${migration.version} failed`, error);
            throw error;
        }
    }
    async recordMigration(version, description) {
        await this.dbManager.executeQuery(`
      INSERT INTO migrations (version, description)
      VALUES (?, ?)
    `, [version, description]);
    }
    async removeMigrationRecord(version) {
        await this.dbManager.executeQuery(`
      DELETE FROM migrations WHERE version = ?
    `, [version]);
    }
}
exports.MigrationManager = MigrationManager;
// CLI migration tool
async function runMigrationCLI() {
    const args = process.argv.slice(2);
    const command = args[0] || 'migrate';
    const dbPath = process.env.DB_PATH || './data/auxiliary-system.db';
    // Ensure data directory exists
    const dataDir = (0, path_1.dirname)(dbPath);
    if (!(0, fs_1.existsSync)(dataDir)) {
        (0, fs_1.mkdirSync)(dataDir, { recursive: true });
    }
    const dbManager = new manager_1.DatabaseManager(dbPath);
    const migrationManager = new MigrationManager(dbManager);
    try {
        switch (command) {
            case 'migrate':
                const targetVersion = args[1];
                await migrationManager.runMigrations(targetVersion);
                break;
            case 'rollback':
                const rollbackVersion = args[1];
                if (!rollbackVersion) {
                    throw new Error('Rollback version is required');
                }
                await migrationManager.rollbackMigration(rollbackVersion);
                break;
            case 'status':
                const currentVersion = await migrationManager.getCurrentVersion();
                const appliedVersions = await migrationManager.getAppliedVersions();
                console.log('Current version:', currentVersion || 'None');
                console.log('Applied migrations:', appliedVersions.join(', ') || 'None');
                break;
            default:
                console.log(`
Usage: npm run db:migrate [command] [args]

Commands:
  migrate [version]  - Run migrations up to version (default: all pending)
  rollback <version> - Rollback a specific migration
  status            - Show migration status

Examples:
  npm run db:migrate
  npm run db:migrate 003
  npm run db:migrate rollback 002
  npm run db:migrate status
        `);
                break;
        }
    }
    catch (error) {
        console.error('Migration command failed:', error);
        process.exit(1);
    }
    finally {
        await dbManager.close();
    }
}
// Run CLI if called directly
if (require.main === module) {
    void runMigrationCLI();
}
//# sourceMappingURL=migrate.js.map