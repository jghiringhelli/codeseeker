"use strict";
/**
 * MongoDB Client Singleton for CodeMind
 * Provides connection management and database access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoClient = exports.MongoDBClient = void 0;
const mongodb_1 = require("mongodb");
const logger_1 = require("../utils/logger");
class MongoDBClient {
    static instance;
    client = null;
    db = null;
    logger;
    isConnected = false;
    constructor() {
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'MongoDBClient');
    }
    static getInstance() {
        if (!MongoDBClient.instance) {
            MongoDBClient.instance = new MongoDBClient();
        }
        return MongoDBClient.instance;
    }
    async connect() {
        if (this.isConnected && this.client) {
            this.logger.debug('MongoDB already connected');
            return;
        }
        try {
            const uri = process.env.MONGO_URI ||
                `mongodb://${process.env.MONGO_USER || 'codemind'}:${process.env.MONGO_PASSWORD || 'codemind123'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DB || 'codemind'}?authSource=admin`;
            this.logger.info(`Connecting to MongoDB at ${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}...`);
            this.client = new mongodb_1.MongoClient(uri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 2000,
                socketTimeoutMS: 10000,
                connectTimeoutMS: 3000,
            });
            await this.client.connect();
            this.db = this.client.db(process.env.MONGO_DB || 'codemind');
            this.isConnected = true;
            // Set up connection monitoring
            this.client.on('serverDescriptionChanged', (event) => {
                this.logger.debug(`MongoDB server description changed: ${event.address}`);
            });
            this.client.on('error', (error) => {
                this.logger.error(`MongoDB client error: ${error}`);
                this.isConnected = false;
            });
            this.logger.debug('📄 MongoDB connected successfully');
            // Verify collections exist
            await this.verifyCollections();
        }
        catch (error) {
            this.logger.error(`Failed to connect to MongoDB: ${error}`);
            this.isConnected = false;
            throw error;
        }
    }
    async verifyCollections() {
        if (!this.db)
            return;
        const requiredCollections = [
            'tool_configs',
            'analysis_results',
            'project_intelligence',
            'knowledge_repository',
            'workflow_states',
            'templates'
        ];
        const existingCollections = await this.db.listCollections().toArray();
        const existingNames = existingCollections.map(c => c.name);
        for (const collection of requiredCollections) {
            if (!existingNames.includes(collection)) {
                this.logger.warn(`Collection '${collection}' does not exist. It will be created on first use.`);
            }
        }
    }
    getDatabase() {
        if (!this.db) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return this.db;
    }
    getCollection(name) {
        if (!this.db) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return this.db.collection(name);
    }
    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.close();
            this.isConnected = false;
            this.logger.info('MongoDB disconnected');
        }
    }
    async ping() {
        try {
            if (!this.db)
                return false;
            await this.db.admin().ping();
            return true;
        }
        catch (error) {
            this.logger.error(`MongoDB ping failed: ${error}`);
            return false;
        }
    }
    isReady() {
        return this.isConnected && this.db !== null;
    }
    // Utility method for safe operations with automatic reconnection
    async withConnection(operation) {
        if (!this.isConnected) {
            await this.connect();
        }
        try {
            return await operation(this.getDatabase());
        }
        catch (error) {
            // If connection error, try to reconnect once
            if (error instanceof Error && error.message.includes('connection')) {
                this.logger.warn('Connection lost, attempting to reconnect...');
                this.isConnected = false;
                await this.connect();
                return await operation(this.getDatabase());
            }
            throw error;
        }
    }
}
exports.MongoDBClient = MongoDBClient;
// Export singleton instance
exports.mongoClient = MongoDBClient.getInstance();
//# sourceMappingURL=mongodb-client.js.map