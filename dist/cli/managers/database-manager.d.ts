/**
 * Consolidated Database Manager - SOLID Principles Compliant
 * Single Responsibility: Database operations coordination
 * Uses dependency injection for health, schema, and update strategies
 */
import { DatabaseConnections } from '../../config/database-config';
export interface IDatabaseHealthStrategy {
    checkSystemHealth(): Promise<DatabaseStatus>;
    startMissingServices(requirements: DatabaseRequirements): Promise<boolean>;
    ensureServicesRunning(requirements: DatabaseRequirements): Promise<DatabaseStatus>;
}
export interface IDatabaseSchemaStrategy {
    validateSchema(): Promise<SchemaValidationResult>;
    repairSchema(): Promise<SchemaRepairResult>;
    initializeTables(): Promise<{
        success: boolean;
        errors?: string[];
    }>;
}
export interface IDatabaseUpdateStrategy {
    updateAllDatabases(context: unknown, options?: unknown): Promise<DatabaseUpdateResult>;
    updateFileEmbeddings(projectId: string, filePath: string, content: string): Promise<void>;
    removeFileEmbeddings(projectId: string, filePath: string): Promise<void>;
}
export interface DatabaseStatus {
    postgresql: {
        available: boolean;
        error?: string;
    };
    redis: {
        available: boolean;
        error?: string;
    };
    neo4j: {
        available: boolean;
        error?: string;
    };
}
export interface DatabaseRequirements {
    postgresql?: boolean;
    redis?: boolean;
    neo4j?: boolean;
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
export interface DatabaseUpdateResult {
    neo4j: {
        nodesCreated: number;
        nodesUpdated: number;
        relationshipsCreated: number;
        relationshipsUpdated: number;
        success: boolean;
        error?: string;
    };
    redis: {
        filesUpdated: number;
        hashesUpdated: number;
        cacheEntriesInvalidated: number;
        success: boolean;
        error?: string;
    };
    postgres: {
        recordsUpdated: number;
        embeddingsUpdated: number;
        success: boolean;
        error?: string;
    };
}
export interface SystemHealth {
    postgresql: boolean;
    redis: boolean;
    neo4j: boolean;
}
/**
 * Consolidated DatabaseManager with injected strategies
 * Follows Single Responsibility and Dependency Inversion principles
 */
export declare class DatabaseManager {
    private healthStrategy?;
    private schemaStrategy?;
    private updateStrategy?;
    private dbConnections;
    private logger;
    constructor(healthStrategy?: IDatabaseHealthStrategy, schemaStrategy?: IDatabaseSchemaStrategy, updateStrategy?: IDatabaseUpdateStrategy);
    /**
     * Check system health - delegates to health strategy if available
     */
    checkSystemHealth(): Promise<SystemHealth>;
    /**
     * Get detailed database status
     */
    getDatabaseStatus(): Promise<DatabaseStatus>;
    /**
     * Start missing database services
     */
    startMissingServices(requirements?: DatabaseRequirements): Promise<boolean>;
    /**
     * Validate database schema
     */
    validateSchema(): Promise<SchemaValidationResult>;
    /**
     * Initialize database tables
     */
    initializeTables(): Promise<{
        success: boolean;
        errors?: string[];
    }>;
    /**
     * Repair database schema
     */
    repairSchema(): Promise<SchemaRepairResult>;
    /**
     * Update all databases atomically
     */
    updateAllDatabases(context: unknown, options?: unknown): Promise<DatabaseUpdateResult>;
    /**
     * Update file embeddings
     */
    updateFileEmbeddings(projectId: string, filePath: string, content: string): Promise<void>;
    /**
     * Remove file embeddings
     */
    removeFileEmbeddings(projectId: string, filePath: string): Promise<void>;
    /**
     * Get database connections
     */
    getConnections(): DatabaseConnections;
    /**
     * Close all database connections
     */
    closeConnections(): Promise<void>;
    /**
     * Basic health check fallback implementation
     */
    private basicHealthCheck;
}
//# sourceMappingURL=database-manager.d.ts.map