/**
 * Database Initialization Service
 * Single Responsibility: Verify database connections and ensure constraints exist
 *
 * Note: For pre-MVP, this focuses on connection verification and constraint creation.
 * Schema migrations can be added post-MVP when needed.
 */
import { IDatabaseInitializer, SetupResult } from './interfaces/setup-interfaces';
export declare class DatabaseInitializer implements IDatabaseInitializer {
    private readonly config;
    testConnections(): Promise<{
        postgres: boolean;
        neo4j: boolean;
        redis: boolean;
    }>;
    initializePostgreSQL(): Promise<SetupResult>;
    initializeNeo4j(): Promise<SetupResult>;
    /**
     * Clean up duplicate Neo4j nodes that prevent constraint creation
     */
    private cleanupDuplicateNeo4jNodes;
    initializeRedis(): Promise<SetupResult>;
}
//# sourceMappingURL=database-initializer.d.ts.map