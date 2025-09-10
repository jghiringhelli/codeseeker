/**
 * Database Configuration and Connection Manager
 * Handles connections to all 4 CodeMind databases: PostgreSQL, Neo4j, Redis, MongoDB
 */
import { Client } from 'pg';
import { MongoClient } from 'mongodb';
export interface DatabaseConfig {
    postgres: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
    };
    neo4j: {
        uri: string;
        user: string;
        password: string;
    };
    mongodb: {
        uri: string;
    };
}
export declare class DatabaseConnections {
    private config;
    private pgClient?;
    private redisClient?;
    private mongoClient?;
    private neo4jDriver?;
    constructor(config?: DatabaseConfig);
    private getDefaultConfig;
    getPostgresConnection(): Promise<Client>;
    getRedisConnection(): Promise<any>;
    getMongoConnection(): Promise<MongoClient>;
    getNeo4jConnection(): Promise<any>;
    closeAll(): Promise<void>;
}
export default DatabaseConnections;
//# sourceMappingURL=database-config.d.ts.map