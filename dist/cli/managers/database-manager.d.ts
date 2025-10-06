/**
 * DatabaseManager - Handles all database operations and health checks
 * Single Responsibility: Database connectivity and operations
 */
export interface SystemHealth {
    postgresql: boolean;
    redis: boolean;
    neo4j: boolean;
}
export declare class DatabaseManager {
    private dbConnections;
    constructor();
    /**
     * Check health of all database systems
     */
    checkSystemHealth(): Promise<SystemHealth>;
    /**
     * Initialize database schemas and configurations
     */
    initializeSchemas(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Store project data across all databases
     */
    storeProjectData(projectId: string, data: any): Promise<void>;
    /**
     * Get project statistics and metrics
     */
    getProjectStats(projectId: string): Promise<any>;
    /**
     * Get PostgreSQL connection
     */
    getPostgresConnection(): Promise<import("pg").Client>;
    /**
     * Cleanup database connections
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=database-manager.d.ts.map