/**
 * Redis Database Service
 * Handles all Redis operations for the dashboard
 */

const redis = require('redis');
const { DatabaseService } = require('./database-service');

class RedisService extends DatabaseService {
    constructor() {
        super('Redis');
        this.client = null;
    }

    async connect() {
        try {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0
            };

            this.client = redis.createClient(redisConfig);
            
            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.connected = false;
            });

            this.client.on('connect', () => {
                console.log('✅ Redis service connected');
                this.connected = true;
            });

            await this.client.connect();
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            this.connected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.connected = false;
            console.log('📤 Redis service disconnected');
        }
    }

    async healthCheck() {
        try {
            if (!this.client) throw new Error('Not connected');
            await this.client.ping();
            return { connected: true, database: 'redis' };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    // Cache operations
    async getCacheStats() {
        if (!this.client) throw new Error('Redis not connected');
        
        const info = await this.client.info('memory');
        const keyspace = await this.client.info('keyspace');
        const stats = await this.client.info('stats');
        
        return {
            memory: this.parseRedisInfo(info),
            keyspace: this.parseRedisInfo(keyspace),
            stats: this.parseRedisInfo(stats)
        };
    }

    async getProjectCache(projectId) {
        if (!this.client) throw new Error('Redis not connected');
        
        const pattern = `project:${projectId}:*`;
        const keys = await this.client.keys(pattern);
        
        const cacheData = {};
        for (const key of keys) {
            const value = await this.client.get(key);
            const ttl = await this.client.ttl(key);
            cacheData[key] = {
                value: value ? JSON.parse(value) : null,
                ttl: ttl
            };
        }
        
        return cacheData;
    }

    async getRecentOperations(limit = 50) {
        if (!this.client) throw new Error('Redis not connected');
        
        // Get slowlog (recent slow operations)
        const slowlog = await this.client.slowlogGet(limit);
        
        return slowlog.map(entry => ({
            id: entry.id,
            timestamp: new Date(entry.timestamp * 1000),
            duration: entry.duration,
            command: entry.command.join(' ')
        }));
    }

    // Session and workflow data
    async getActiveSessions() {
        if (!this.client) throw new Error('Redis not connected');
        
        const sessionKeys = await this.client.keys('session:*');
        const sessions = [];
        
        for (const key of sessionKeys) {
            const sessionData = await this.client.hgetall(key);
            const ttl = await this.client.ttl(key);
            sessions.push({
                sessionId: key.replace('session:', ''),
                data: sessionData,
                ttl: ttl
            });
        }
        
        return sessions;
    }

    async getWorkflowQueue() {
        if (!this.client) throw new Error('Redis not connected');
        
        const queueLength = await this.client.llen('workflow:queue');
        const queueItems = await this.client.lrange('workflow:queue', 0, 10);
        
        return {
            length: queueLength,
            items: queueItems.map(item => JSON.parse(item))
        };
    }

    // Utility method to parse Redis INFO output
    parseRedisInfo(infoString) {
        const lines = infoString.split('\r\n');
        const result = {};
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                result[key] = isNaN(value) ? value : Number(value);
            }
        }
        
        return result;
    }

    // Performance metrics
    async getPerformanceMetrics() {
        if (!this.client) throw new Error('Redis not connected');
        
        const info = await this.client.info('all');
        const parsed = this.parseRedisInfo(info);
        
        return {
            connectionsReceived: parsed.total_connections_received || 0,
            commandsProcessed: parsed.total_commands_processed || 0,
            memoryUsage: parsed.used_memory_human || '0B',
            keyspaceHits: parsed.keyspace_hits || 0,
            keyspaceMisses: parsed.keyspace_misses || 0,
            hitRate: parsed.keyspace_hits && parsed.keyspace_misses ? 
                (parsed.keyspace_hits / (parsed.keyspace_hits + parsed.keyspace_misses) * 100).toFixed(2) + '%' : '0%'
        };
    }
}

module.exports = { RedisService };