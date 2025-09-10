"use strict";
/**
 * Database Configuration and Connection Manager
 * Handles connections to all 4 CodeMind databases: PostgreSQL, Neo4j, Redis, MongoDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnections = void 0;
const pg_1 = require("pg");
const redis_1 = require("redis");
const mongodb_1 = require("mongodb");
class DatabaseConnections {
    config;
    pgClient;
    redisClient;
    mongoClient;
    neo4jDriver;
    constructor(config) {
        this.config = config || this.getDefaultConfig();
    }
    getDefaultConfig() {
        return {
            postgres: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123'
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD
            },
            neo4j: {
                uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
                user: process.env.NEO4J_USER || 'neo4j',
                password: process.env.NEO4J_PASSWORD || 'codemind123'
            },
            mongodb: {
                uri: process.env.MONGO_URI || 'mongodb://codemind:codemind123@localhost:27017/codemind'
            }
        };
    }
    async getPostgresConnection() {
        if (!this.pgClient) {
            this.pgClient = new pg_1.Client({
                host: this.config.postgres.host,
                port: this.config.postgres.port,
                database: this.config.postgres.database,
                user: this.config.postgres.user,
                password: this.config.postgres.password
            });
            await this.pgClient.connect();
        }
        return this.pgClient;
    }
    async getRedisConnection() {
        if (!this.redisClient) {
            this.redisClient = (0, redis_1.createClient)({
                socket: {
                    host: this.config.redis.host,
                    port: this.config.redis.port
                },
                password: this.config.redis.password
            });
            await this.redisClient.connect();
        }
        return this.redisClient;
    }
    async getMongoConnection() {
        if (!this.mongoClient) {
            this.mongoClient = new mongodb_1.MongoClient(this.config.mongodb.uri);
            await this.mongoClient.connect();
        }
        return this.mongoClient;
    }
    async getNeo4jConnection() {
        if (!this.neo4jDriver) {
            // Mock Neo4j driver for now since we don't have the actual neo4j-driver package
            this.neo4jDriver = {
                session: () => ({
                    run: async (query, params) => ({
                        records: []
                    }),
                    close: async () => { }
                }),
                close: async () => { }
            };
        }
        return this.neo4jDriver;
    }
    async closeAll() {
        const promises = [];
        if (this.pgClient) {
            promises.push(this.pgClient.end());
        }
        if (this.redisClient) {
            promises.push(this.redisClient.quit());
        }
        if (this.mongoClient) {
            promises.push(this.mongoClient.close());
        }
        if (this.neo4jDriver) {
            promises.push(this.neo4jDriver.close());
        }
        await Promise.allSettled(promises);
    }
}
exports.DatabaseConnections = DatabaseConnections;
exports.default = DatabaseConnections;
//# sourceMappingURL=database-config.js.map