/**
 * MongoDB Client Singleton for CodeMind
 * Provides connection management and database access
 */
import { Db, Collection } from 'mongodb';
export declare class MongoDBClient {
    private static instance;
    private client;
    private db;
    private logger;
    private isConnected;
    private constructor();
    static getInstance(): MongoDBClient;
    connect(): Promise<void>;
    private verifyCollections;
    getDatabase(): Db;
    getCollection<T = any>(name: string): Collection<T>;
    disconnect(): Promise<void>;
    ping(): Promise<boolean>;
    isReady(): boolean;
    withConnection<T>(operation: (db: Db) => Promise<T>): Promise<T>;
}
export declare const mongoClient: MongoDBClient;
//# sourceMappingURL=mongodb-client.d.ts.map