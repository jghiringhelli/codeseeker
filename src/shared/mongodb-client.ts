/**
 * MongoDB Client Singleton for CodeMind
 * Provides connection management and database access
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { Logger, LogLevel } from '../utils/logger';

export class MongoDBClient {
  private static instance: MongoDBClient;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private logger: Logger;
  private isConnected = false;

  private constructor() {
    this.logger = new Logger(LogLevel.INFO, 'MongoDBClient');
  }

  static getInstance(): MongoDBClient {
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient();
    }
    return MongoDBClient.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      this.logger.debug('MongoDB already connected');
      return;
    }

    try {
      const uri = process.env.MONGO_URI || 
        `mongodb://${process.env.MONGO_USER || 'codemind'}:${process.env.MONGO_PASSWORD || 'codemind123'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DB || 'codemind'}?authSource=admin`;
      
      this.logger.info(`Connecting to MongoDB...`);
      
      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
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

      this.logger.info('📄 MongoDB connected successfully');
      
      // Verify collections exist
      await this.verifyCollections();
      
    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${error}`);
      this.isConnected = false;
      throw error;
    }
  }

  private async verifyCollections(): Promise<void> {
    if (!this.db) return;
    
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

  getDatabase(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  getCollection<T = any>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db.collection<T>(name);
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info('MongoDB disconnected');
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      this.logger.error(`MongoDB ping failed: ${error}`);
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.db !== null;
  }

  // Utility method for safe operations with automatic reconnection
  async withConnection<T>(operation: (db: Db) => Promise<T>): Promise<T> {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      return await operation(this.getDatabase());
    } catch (error) {
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

// Export singleton instance
export const mongoClient = MongoDBClient.getInstance();