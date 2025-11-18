/**
 * DatabaseHealthService - Manages database health checks and automatic recovery
 * Single Responsibility: Database health monitoring and recovery
 */
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
export declare class DatabaseHealthService {
    private connections;
    private schemaManager;
    private checkTimeouts;
    constructor();
    /**
     * Check health of all databases with timeout protection
     */
    checkDatabaseHealth(requirements?: DatabaseRequirements): Promise<DatabaseStatus>;
    /**
     * Check PostgreSQL health with timeout
     */
    private checkPostgreSQL;
    /**
     * Check Redis health with timeout
     */
    private checkRedis;
    /**
     * Check Neo4j health with timeout
     */
    private checkNeo4j;
    /**
     * Attempt to restart databases using Docker Compose
     */
    restartDatabases(services?: string[]): Promise<boolean>;
    /**
     * Wait for databases to become available
     */
    waitForDatabases(services: string[], maxWaitMs?: number): Promise<boolean>;
    /**
     * Check if database tables are initialized
     */
    checkDatabaseTables(): Promise<{
        initialized: boolean;
        missingTables?: string[];
    }>;
    /**
     * Initialize database tables
     */
    initializeDatabaseTables(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Ensure databases are available and initialized
     */
    ensureDatabasesReady(requirements?: DatabaseRequirements): Promise<boolean>;
    /**
     * Display database status
     */
    private displayDatabaseStatus;
    /**
     * Check which databases need restart
     */
    private checkIfRestartNeeded;
    /**
     * Clean up connections
     */
    cleanup(): Promise<void>;
}
export default DatabaseHealthService;
//# sourceMappingURL=database-health-service.d.ts.map