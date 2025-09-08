/**
 * Multi-Database API for CodeMind Dashboard
 * Supports PostgreSQL, Neo4j, MongoDB, and Redis
 */

const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const { MongoClient } = require('mongodb');
const redis = require('redis');

class MultiDatabaseAPI {
    constructor() {
        this.initializeConnections();
    }

    async initializeConnections() {
        // PostgreSQL connection
        this.pg = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Neo4j connection
        try {
            this.neo4j = neo4j.driver(
                process.env.NEO4J_URI || 'bolt://localhost:7687',
                neo4j.auth.basic(
                    process.env.NEO4J_USER || 'neo4j',
                    process.env.NEO4J_PASSWORD || 'codemind123'
                )
            );
            console.log('✅ Neo4j driver initialized');
        } catch (error) {
            console.warn('⚠️ Neo4j connection failed:', error.message);
            this.neo4j = null;
        }

        // MongoDB connection
        try {
            const mongoUri = process.env.MONGO_URI || 
                `mongodb://${process.env.MONGO_USER || 'codemind'}:${process.env.MONGO_PASSWORD || 'codemind123'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DB || 'codemind'}?authSource=admin`;
            
            this.mongoClient = new MongoClient(mongoUri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            
            await this.mongoClient.connect();
            this.mongodb = this.mongoClient.db(process.env.MONGO_DB || 'codemind');
            console.log('✅ MongoDB connected');
        } catch (error) {
            console.warn('⚠️ MongoDB connection failed:', error.message);
            this.mongodb = null;
        }

        // Redis connection
        try {
            this.redis = redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || '',
                db: process.env.REDIS_DB || 0,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        return new Error('Redis server connection refused');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        return new Error('Redis retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });
            
            await this.redis.connect();
            console.log('✅ Redis connected');
        } catch (error) {
            console.warn('⚠️ Redis connection failed:', error.message);
            this.redis = null;
        }
    }

    /**
     * Get connection status for all databases
     */
    async getConnectionStatus() {
        const status = {
            postgresql: { connected: false, version: null, tables: 0, size: null },
            neo4j: { connected: false, version: null, nodes: 0, relationships: 0 },
            mongodb: { connected: false, version: null, collections: 0, documents: 0 },
            redis: { connected: false, version: null, keys: 0, memory: null }
        };

        // PostgreSQL status
        try {
            const pgResult = await this.pg.query('SELECT version(), COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = $1', ['public']);
            const sizeResult = await this.pg.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
            status.postgresql = {
                connected: true,
                version: pgResult.rows[0].version.split(' ')[1],
                tables: parseInt(pgResult.rows[0].table_count),
                size: sizeResult.rows[0].size
            };
        } catch (error) {
            console.error('PostgreSQL status check failed:', error.message);
        }

        // Neo4j status
        if (this.neo4j) {
            const session = this.neo4j.session();
            try {
                const result = await session.run(`
                    CALL dbms.components() YIELD versions
                    WITH versions[0] as version
                    MATCH (n) RETURN count(n) as nodes, version
                `);
                const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relationships');
                
                status.neo4j = {
                    connected: true,
                    version: result.records[0].get('version'),
                    nodes: result.records[0].get('nodes').toNumber(),
                    relationships: relResult.records[0].get('relationships').toNumber()
                };
            } catch (error) {
                console.error('Neo4j status check failed:', error.message);
            } finally {
                await session.close();
            }
        }

        // MongoDB status
        if (this.mongodb) {
            try {
                const admin = this.mongodb.admin();
                const serverStatus = await admin.serverStatus();
                const collections = await this.mongodb.listCollections().toArray();
                
                let totalDocs = 0;
                for (const collection of collections) {
                    try {
                        const count = await this.mongodb.collection(collection.name).countDocuments();
                        totalDocs += count;
                    } catch (e) {
                        // Skip collections that can't be counted
                    }
                }

                status.mongodb = {
                    connected: true,
                    version: serverStatus.version,
                    collections: collections.length,
                    documents: totalDocs
                };
            } catch (error) {
                console.error('MongoDB status check failed:', error.message);
            }
        }

        // Redis status
        if (this.redis && this.redis.isOpen) {
            try {
                const info = await this.redis.info();
                const keyCount = await this.redis.dbsize();
                const memory = info.split('\n').find(line => line.startsWith('used_memory_human:'));
                const version = info.split('\n').find(line => line.startsWith('redis_version:'));

                status.redis = {
                    connected: true,
                    version: version ? version.split(':')[1].trim() : 'Unknown',
                    keys: keyCount,
                    memory: memory ? memory.split(':')[1].trim() : 'Unknown'
                };
            } catch (error) {
                console.error('Redis status check failed:', error.message);
            }
        }

        return status;
    }

    /**
     * Execute PostgreSQL query
     */
    async executePostgreSQLQuery(query, params = []) {
        try {
            const result = await this.pg.query(query, params);
            return {
                success: true,
                data: result.rows,
                rowCount: result.rowCount,
                fields: result.fields?.map(f => f.name) || []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Execute Neo4j Cypher query
     */
    async executeCypherQuery(query, params = {}) {
        if (!this.neo4j) {
            return { success: false, error: 'Neo4j not connected', data: [] };
        }

        const session = this.neo4j.session();
        try {
            const result = await session.run(query, params);
            const data = result.records.map(record => {
                const obj = {};
                record.keys.forEach(key => {
                    const value = record.get(key);
                    obj[key] = this.neo4jValueToJs(value);
                });
                return obj;
            });

            return {
                success: true,
                data,
                rowCount: data.length,
                summary: result.summary
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Execute MongoDB query
     */
    async executeMongoQuery(collection, operation, query = {}, options = {}) {
        if (!this.mongodb) {
            return { success: false, error: 'MongoDB not connected', data: [] };
        }

        try {
            const coll = this.mongodb.collection(collection);
            let result;

            switch (operation) {
                case 'find':
                    result = await coll.find(query, options).limit(options.limit || 100).toArray();
                    break;
                case 'aggregate':
                    result = await coll.aggregate(query, options).toArray();
                    break;
                case 'count':
                    result = await coll.countDocuments(query);
                    break;
                case 'distinct':
                    result = await coll.distinct(options.field || '_id', query);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            return {
                success: true,
                data: Array.isArray(result) ? result : [result],
                rowCount: Array.isArray(result) ? result.length : 1
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Execute Redis command
     */
    async executeRedisCommand(command, args = []) {
        if (!this.redis || !this.redis.isOpen) {
            return { success: false, error: 'Redis not connected', data: [] };
        }

        try {
            let result;
            const cmd = command.toLowerCase();

            switch (cmd) {
                case 'keys':
                    result = await this.redis.keys(args[0] || '*');
                    break;
                case 'get':
                    result = await this.redis.get(args[0]);
                    break;
                case 'hgetall':
                    result = await this.redis.hgetall(args[0]);
                    break;
                case 'scan':
                    result = await this.redis.scan(args[0] || 0, { MATCH: args[1] || '*', COUNT: args[2] || 10 });
                    break;
                case 'info':
                    result = await this.redis.info(args[0]);
                    break;
                default:
                    throw new Error(`Command not supported: ${command}`);
            }

            return {
                success: true,
                data: Array.isArray(result) ? result : [result],
                rowCount: Array.isArray(result) ? result.length : 1
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Get semantic graph data for visualization
     */
    async getSemanticGraph(projectPath, options = {}) {
        const { depth = 2, maxNodes = 50, focusArea = null } = options;
        
        if (!this.neo4j) {
            return { success: false, error: 'Neo4j not connected', nodes: [], edges: [] };
        }

        const session = this.neo4j.session();
        try {
            let query = `
                MATCH (n)-[r]->(m)
                WHERE n.project_path = $projectPath
            `;
            
            if (focusArea) {
                query += ` AND (n.name CONTAINS $focusArea OR m.name CONTAINS $focusArea)`;
            }
            
            query += `
                RETURN n, r, m
                LIMIT $maxNodes
            `;

            const result = await session.run(query, { 
                projectPath, 
                focusArea,
                maxNodes: neo4j.int(maxNodes)
            });

            const nodes = new Map();
            const edges = [];

            result.records.forEach(record => {
                const startNode = record.get('n');
                const relationship = record.get('r');
                const endNode = record.get('m');

                // Add nodes
                if (!nodes.has(startNode.identity.toString())) {
                    nodes.set(startNode.identity.toString(), {
                        id: startNode.identity.toString(),
                        label: startNode.properties.name || startNode.properties.path || 'Unknown',
                        type: startNode.labels[0] || 'Unknown',
                        properties: startNode.properties
                    });
                }

                if (!nodes.has(endNode.identity.toString())) {
                    nodes.set(endNode.identity.toString(), {
                        id: endNode.identity.toString(),
                        label: endNode.properties.name || endNode.properties.path || 'Unknown',
                        type: endNode.labels[0] || 'Unknown',
                        properties: endNode.properties
                    });
                }

                // Add edge
                edges.push({
                    id: relationship.identity.toString(),
                    source: startNode.identity.toString(),
                    target: endNode.identity.toString(),
                    type: relationship.type,
                    properties: relationship.properties
                });
            });

            return {
                success: true,
                nodes: Array.from(nodes.values()),
                edges,
                totalNodes: nodes.size,
                totalEdges: edges.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                nodes: [],
                edges: []
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Get business intelligence data from MongoDB
     */
    async getBusinessIntelligence(projectPath) {
        if (!this.mongodb) {
            return { success: false, error: 'MongoDB not connected', data: {} };
        }

        try {
            // Get use cases
            const useCases = await this.mongodb.collection('use_cases').find({
                project_path: projectPath
            }).limit(20).toArray();

            // Get business concepts
            const concepts = await this.mongodb.collection('business_concepts').find({
                project_path: projectPath
            }).limit(20).toArray();

            // Get stakeholder requirements
            const requirements = await this.mongodb.collection('requirements').find({
                project_path: projectPath
            }).limit(20).toArray();

            return {
                success: true,
                data: {
                    useCases,
                    concepts,
                    requirements,
                    summary: {
                        totalUseCases: useCases.length,
                        totalConcepts: concepts.length,
                        totalRequirements: requirements.length
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: {}
            };
        }
    }

    /**
     * Helper method to convert Neo4j values to JavaScript values
     */
    neo4jValueToJs(value) {
        if (value === null || value === undefined) return null;
        if (neo4j.isInt(value)) return value.toNumber();
        if (neo4j.isDate(value)) return value.toString();
        if (neo4j.isDateTime(value)) return value.toString();
        if (typeof value === 'object' && value.properties) return value.properties;
        return value;
    }

    /**
     * Get reconciliation data
     */
    async getReconciliationData(projectPath) {
        try {
            // Get data from PostgreSQL
            const pgResult = await this.executePostgreSQLQuery(`
                SELECT p.project_name, p.total_files, p.languages, p.frameworks,
                       COUNT(ce.id) as indexed_files,
                       COUNT(cd.id) as claude_decisions
                FROM projects p
                LEFT JOIN code_embeddings ce ON p.id = ce.project_id
                LEFT JOIN claude_decisions cd ON p.id = cd.project_id
                WHERE p.project_path = $1
                GROUP BY p.id, p.project_name, p.total_files, p.languages, p.frameworks
            `, [projectPath]);

            // Get semantic graph stats
            const graphStats = await this.executeCypherQuery(`
                MATCH (n)
                WHERE n.project_path = $projectPath
                RETURN count(n) as total_nodes, 
                       count(distinct labels(n)[0]) as node_types
            `, { projectPath });

            // Get MongoDB stats
            const mongoStats = await this.getBusinessIntelligence(projectPath);

            const discrepancies = [];
            const recommendations = [];

            // Compare PostgreSQL vs actual files
            if (pgResult.success && pgResult.data.length > 0) {
                const pgData = pgResult.data[0];
                if (pgData.total_files !== pgData.indexed_files) {
                    discrepancies.push({
                        type: 'indexing_mismatch',
                        severity: 'warning',
                        message: `Database shows ${pgData.total_files} files but only ${pgData.indexed_files} are indexed`,
                        action: 'reindex_project'
                    });
                }
            }

            // Check semantic graph coverage
            if (graphStats.success && graphStats.data.length > 0) {
                const nodes = graphStats.data[0].total_nodes;
                if (nodes === 0) {
                    discrepancies.push({
                        type: 'semantic_missing',
                        severity: 'error',
                        message: 'No semantic graph data found for this project',
                        action: 'build_semantic_graph'
                    });
                }
            }

            // Check business intelligence data
            if (!mongoStats.success || mongoStats.data.summary?.totalUseCases === 0) {
                discrepancies.push({
                    type: 'business_missing',
                    severity: 'info',
                    message: 'No business use cases documented for this project',
                    action: 'create_use_cases'
                });
            }

            return {
                success: true,
                data: {
                    postgresql: pgResult.data[0] || {},
                    semantic_graph: graphStats.data[0] || {},
                    mongodb: mongoStats.data.summary || {},
                    discrepancies,
                    recommendations,
                    last_checked: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: {}
            };
        }
    }

    /**
     * Close all database connections
     */
    async close() {
        if (this.pg) await this.pg.end();
        if (this.neo4j) await this.neo4j.close();
        if (this.mongoClient) await this.mongoClient.close();
        if (this.redis) await this.redis.quit();
    }
}

module.exports = { MultiDatabaseAPI };