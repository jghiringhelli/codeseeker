/**
 * Database Schema Manager
 * Manages database schema creation, validation, and migration
 * Single Responsibility: Database schema lifecycle management
 */
import { DatabaseConnections } from '../../config/database-config';
export interface TableDefinition {
    name: string;
    createSQL: string;
    indexes?: string[];
    required: boolean;
}
export interface SchemaValidationResult {
    valid: boolean;
    missingTables: string[];
    missingIndexes: string[];
    errors: string[];
}
export interface SchemaRepairResult {
    success: boolean;
    tablesCreated: string[];
    indexesCreated: string[];
    errors: string[];
}
export declare class DatabaseSchemaManager {
    private connections?;
    private logger;
    private pool;
    private readonly schemaVersion;
    constructor(connections?: DatabaseConnections);
    /**
     * Get all table definitions for CodeMind
     */
    private getTableDefinitions;
    /**
     * Validate the current database schema
     */
    validateSchema(): Promise<SchemaValidationResult>;
    /**
     * Repair/create missing schema elements
     */
    repairSchema(): Promise<SchemaRepairResult>;
    /**
     * Get list of existing tables
     */
    private getExistingTables;
    /**
     * Check for missing indexes
     */
    private checkMissingIndexes;
    /**
     * Check if vector extension is installed
     */
    private checkVectorExtension;
    /**
     * Ensure vector extension is installed
     */
    private ensureVectorExtension;
    /**
     * Record current schema version
     */
    private recordSchemaVersion;
    /**
     * Get current schema version
     */
    getCurrentSchemaVersion(): Promise<string | null>;
    /**
     * Check if schema needs update
     */
    needsSchemaUpdate(): Promise<boolean>;
    /**
     * Close database connections
     */
    close(): Promise<void>;
    /**
     * Quick health check
     */
    isHealthy(): Promise<boolean>;
}
//# sourceMappingURL=database-schema-manager.d.ts.map