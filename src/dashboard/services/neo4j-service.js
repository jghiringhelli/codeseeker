/**
 * Neo4j Database Service
 * Handles all Neo4j graph operations for the dashboard
 */

const neo4j = require('neo4j-driver');
const { DatabaseService } = require('./database-service');

class Neo4jService extends DatabaseService {
    constructor() {
        super('Neo4j');
        this.driver = null;
        this.session = null;
    }

    async connect() {
        try {
            const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
            const user = process.env.NEO4J_USER || 'neo4j';
            const password = process.env.NEO4J_PASSWORD || 'codemind123';
            
            this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
            
            // Test connection
            const session = this.driver.session();
            await session.run('RETURN 1');
            await session.close();
            
            this.connected = true;
            console.log('✅ Neo4j service connected');
        } catch (error) {
            console.error('❌ Neo4j connection failed:', error.message);
            this.connected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.driver) {
            await this.driver.close();
            this.connected = false;
            console.log('📤 Neo4j service disconnected');
        }
    }

    async healthCheck() {
        try {
            if (!this.driver) throw new Error('Not connected');
            const session = this.driver.session();
            await session.run('RETURN 1');
            await session.close();
            return { connected: true, database: 'neo4j' };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    // Graph queries
    async getAllNodes(limit = 50) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (n)
                RETURN labels(n) AS labels, properties(n) AS properties
                LIMIT $limit
            `, { limit: neo4j.int(limit) });
            
            return result.records.map(record => ({
                labels: record.get('labels'),
                properties: record.get('properties')
            }));
        } finally {
            await session.close();
        }
    }

    async getRelationships(limit = 50) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (a)-[r]->(b)
                RETURN type(r) AS relationshipType, 
                       labels(a) AS sourceLabels, 
                       labels(b) AS targetLabels,
                       properties(r) AS properties
                LIMIT $limit
            `, { limit: neo4j.int(limit) });
            
            return result.records.map(record => ({
                type: record.get('relationshipType'),
                sourceLabels: record.get('sourceLabels'),
                targetLabels: record.get('targetLabels'),
                properties: record.get('properties')
            }));
        } finally {
            await session.close();
        }
    }

    async getCodeDependencies(projectId = null) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const whereClause = projectId ? 'WHERE a.projectId = $projectId AND b.projectId = $projectId' : '';
            const params = projectId ? { projectId, limit: neo4j.int(100) } : { limit: neo4j.int(100) };
            
            const result = await session.run(`
                MATCH (a:CodeFile)-[r:DEPENDS_ON]->(b:CodeFile)
                ${whereClause}
                RETURN a.name AS source, b.name AS target, r.type AS dependencyType
                LIMIT $limit
            `, params);
            
            return result.records.map(record => ({
                source: record.get('source'),
                target: record.get('target'),
                type: record.get('dependencyType')
            }));
        } finally {
            await session.close();
        }
    }

    async getCodePatterns(projectId = null) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const whereClause = projectId ? 'WHERE n.projectId = $projectId' : '';
            const params = projectId ? { projectId, limit: neo4j.int(20) } : { limit: neo4j.int(20) };
            
            const result = await session.run(`
                MATCH (n:Pattern)
                ${whereClause}
                RETURN n.name AS patternName, 
                       n.type AS patternType, 
                       n.occurrences AS occurrences,
                       n.confidence AS confidence
                ORDER BY n.occurrences DESC
                LIMIT $limit
            `, params);
            
            return result.records.map(record => ({
                name: record.get('patternName'),
                type: record.get('patternType'),
                occurrences: record.get('occurrences')?.toNumber() || 0,
                confidence: record.get('confidence')?.toNumber() || 0
            }));
        } finally {
            await session.close();
        }
    }

    // Advanced graph analysis
    async getProjectArchitecture(projectId) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (m:Module {projectId: $projectId})
                OPTIONAL MATCH (m)-[r:CONTAINS]->(c:Component)
                RETURN m.name AS moduleName, 
                       collect(c.name) AS components,
                       m.complexity AS complexity
                ORDER BY m.complexity DESC
            `, { projectId });
            
            return result.records.map(record => ({
                module: record.get('moduleName'),
                components: record.get('components'),
                complexity: record.get('complexity')?.toNumber() || 0
            }));
        } finally {
            await session.close();
        }
    }

    async findCircularDependencies(projectId = null) {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const whereClause = projectId ? 'WHERE ALL(n IN nodes(p) WHERE n.projectId = $projectId)' : '';
            const params = projectId ? { projectId } : {};
            
            const result = await session.run(`
                MATCH p = (a:CodeFile)-[:DEPENDS_ON*2..5]->(a)
                ${whereClause}
                RETURN [n IN nodes(p) | n.name] AS cycle
                LIMIT 10
            `, params);
            
            return result.records.map(record => ({
                cycle: record.get('cycle')
            }));
        } finally {
            await session.close();
        }
    }

    // Graph statistics
    async getGraphStats() {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (n)
                OPTIONAL MATCH ()-[r]->()
                RETURN count(DISTINCT n) AS nodeCount, 
                       count(r) AS relationshipCount,
                       count(DISTINCT labels(n)) AS labelCount
            `);
            
            const record = result.records[0];
            return {
                nodes: record.get('nodeCount')?.toNumber() || 0,
                relationships: record.get('relationshipCount')?.toNumber() || 0,
                labels: record.get('labelCount')?.toNumber() || 0
            };
        } finally {
            await session.close();
        }
    }

    async getNodesByLabel() {
        if (!this.driver) throw new Error('Neo4j not connected');
        
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (n)
                UNWIND labels(n) AS label
                RETURN label, count(n) AS count
                ORDER BY count DESC
            `);
            
            return result.records.map(record => ({
                label: record.get('label'),
                count: record.get('count')?.toNumber() || 0
            }));
        } finally {
            await session.close();
        }
    }
}

module.exports = { Neo4jService };