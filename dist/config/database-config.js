"use strict";
/**
 * Database Configuration and Connection Manager
 * Handles connections to 3 CodeMind databases: PostgreSQL, Neo4j, Redis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnections = void 0;
const pg_1 = require("pg");
const redis_1 = require("redis");
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
class DatabaseConnections {
    config;
    pgClient;
    redisClient;
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
        if (!this.redisClient || !this.redisClient.isOpen) {
            // Clean up any existing client
            if (this.redisClient) {
                try {
                    await this.redisClient.quit();
                }
                catch {
                    // Ignore cleanup errors
                }
                this.redisClient = null;
            }
            this.redisClient = (0, redis_1.createClient)({
                socket: {
                    host: this.config.redis.host,
                    port: this.config.redis.port,
                    connectTimeout: 5000, // 5 second timeout
                    reconnectStrategy: (retries) => {
                        if (retries > 1) {
                            // Stop trying after 1 attempt for health checks
                            return new Error('Redis connection failed');
                        }
                        return 1000; // Try once after 1 second
                    }
                },
                password: this.config.redis.password
            });
            // Add error handler to prevent unhandled errors
            this.redisClient.on('error', (err) => {
                // Silent - errors are handled by the connection attempt
                // This prevents the TCP error loop from flooding the console
            });
            // Set a connection timeout promise
            const connectTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
            });
            // Try to connect with timeout protection
            try {
                await Promise.race([
                    this.redisClient.connect(),
                    connectTimeout
                ]);
            }
            catch (error) {
                // Clean up the failed client
                this.redisClient = null;
                // Don't log here - let the caller decide whether to log
                if (error.message.includes('ECONNREFUSED')) {
                    throw new Error('Redis is not running');
                }
                else if (error.message.includes('timeout')) {
                    throw new Error('Redis connection timed out');
                }
                throw new Error(`Redis connection failed: ${error.message}`);
            }
        }
        return this.redisClient;
    }
    async getNeo4jConnection() {
        if (!this.neo4jDriver) {
            this.neo4jDriver = neo4j_driver_1.default.driver(this.config.neo4j.uri, neo4j_driver_1.default.auth.basic(this.config.neo4j.user, this.config.neo4j.password));
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
        if (this.neo4jDriver) {
            promises.push(this.neo4jDriver.close());
        }
        await Promise.allSettled(promises);
    }
}
exports.DatabaseConnections = DatabaseConnections;
exports.default = DatabaseConnections;
//# sourceMappingURL=database-config.js.map