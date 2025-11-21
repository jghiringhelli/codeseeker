/**
 * Database Initialization Service
 * Single Responsibility: Initialize and test database connections
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
    initializeRedis(): Promise<SetupResult>;
    private createBasicPostgreSQLSchema;
}
//# sourceMappingURL=database-initializer.d.ts.map