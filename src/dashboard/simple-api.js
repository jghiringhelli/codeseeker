/**
 * Simple API endpoints for the simplified CodeMind dashboard
 * Uses dedicated database services following SOLID principles
 */

const { PostgreSQLService } = require('./services/postgresql-service');
const { MongoDBService } = require('./services/mongodb-service');
const { RedisService } = require('./services/redis-service');
const { Neo4jService } = require('./services/neo4j-service');

class SimpleDashboardAPI {
    constructor() {
        this.initializeDatabaseServices();
    }

    initializeDatabaseServices() {
        // Initialize database services
        this.postgresService = new PostgreSQLService();
        this.mongoService = new MongoDBService();
        this.redisService = new RedisService();
        this.neo4jService = new Neo4jService();
        
        // Connect to databases (don't wait for it)
        this.connectDatabases().catch(console.error);
    }

    async connectDatabases() {
        const services = [
            this.postgresService,
            this.mongoService,
            this.redisService,
            this.neo4jService
        ];

        for (const service of services) {
            try {
                await service.connect();
            } catch (error) {
                console.warn(`⚠️ ${service.getName()} connection failed:`, error.message);
                // Don't throw error, just log it
            }
        }
    }

    setupRoutes(app) {
        // Health check endpoints
        app.get('/api/health/postgres', this.checkPostgresHealth.bind(this));
        app.get('/api/health/mongo', this.checkMongoHealth.bind(this));
        app.get('/api/health/redis', this.checkRedisHealth.bind(this));
        app.get('/api/health/neo4j', this.checkNeo4jHealth.bind(this));

        // Projects endpoints
        app.get('/api/projects', this.getProjects.bind(this));
        app.get('/api/project/:id', this.getProjectData.bind(this));

        // Database query endpoints
        app.post('/api/query', this.executeQuery.bind(this));
        app.post('/api/semantic-search', this.performSemanticSearch.bind(this));
    }

    // Health check methods
    async checkPostgresHealth(req, res) {
        try {
            const health = await this.postgresService.healthCheck();
            res.json(health);
        } catch (error) {
            res.json({ connected: false, error: error.message });
        }
    }

    async checkMongoHealth(req, res) {
        try {
            const health = await this.mongoService.healthCheck();
            res.json(health);
        } catch (error) {
            res.json({ connected: false, error: error.message });
        }
    }

    async checkRedisHealth(req, res) {
        try {
            const health = await this.redisService.healthCheck();
            res.json(health);
        } catch (error) {
            res.json({ connected: false, error: error.message });
        }
    }

    async checkNeo4jHealth(req, res) {
        try {
            const health = await this.neo4jService.healthCheck();
            res.json(health);
        } catch (error) {
            res.json({ connected: false, error: error.message });
        }
    }

    // Projects methods
    async getProjects(req, res) {
        try {
            const projects = await this.postgresService.getAllProjects();
            res.json(projects);
        } catch (error) {
            console.error('Error fetching projects:', error);
            res.status(500).json({ error: 'Failed to fetch projects' });
        }
    }

    async getProjectData(req, res) {
        const { id } = req.params;
        
        try {
            const projectData = await this.postgresService.getProjectStats(id);
            res.json(projectData);
        } catch (error) {
            console.error('Error fetching project data:', error);
            if (error.message === 'Project not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Failed to fetch project data' });
            }
        }
    }

    // Query methods
    async executeQuery(req, res) {
        const { type, projectId } = req.body;

        try {
            let result;
            
            switch (type) {
                // PostgreSQL queries
                case 'pg-projects':
                    result = await this.postgresService.getAllProjects();
                    break;
                case 'pg-recent-analyses':
                    result = await this.postgresService.getRecentAnalyses(projectId);
                    break;
                case 'pg-project-stats':
                    result = await this.postgresService.getDatabaseInsights();
                    break;
                case 'pg-tool-usage':
                    result = await this.postgresService.getToolUsage(projectId);
                    break;
                    
                // MongoDB queries
                case 'mongo-intelligence':
                    result = await this.mongoService.getProjectIntelligence(projectId);
                    break;
                case 'mongo-analysis-results':
                    result = await this.mongoService.getAnalysisResults(projectId);
                    break;
                case 'mongo-tool-configs':
                    result = await this.mongoService.getToolConfigurations();
                    break;
                case 'mongo-knowledge':
                    result = await this.mongoService.getKnowledgeRepository(projectId);
                    break;
                    
                // Neo4j queries
                case 'neo4j-nodes':
                    result = await this.neo4jService.getAllNodes();
                    break;
                case 'neo4j-relationships':
                    result = await this.neo4jService.getRelationships();
                    break;
                case 'neo4j-dependencies':
                    result = await this.neo4jService.getCodeDependencies(projectId);
                    break;
                case 'neo4j-patterns':
                    result = await this.neo4jService.getCodePatterns(projectId);
                    break;
                    
                default:
                    return res.status(400).json({ success: false, error: 'Unknown query type' });
            }

            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Query error:', error);
            res.json({ success: false, error: error.message });
        }
    }

    // Semantic search
    async performSemanticSearch(req, res) {
        const { query, projectId } = req.body;

        try {
            const results = await this.postgresService.performSemanticSearch(query, projectId);
            res.json({ success: true, results });
        } catch (error) {
            console.error('Semantic search error:', error);
            res.json({ success: false, error: error.message });
        }
    }
    
    // Database disconnect method
    async disconnect() {
        const services = [
            this.postgresService,
            this.mongoService,
            this.redisService,
            this.neo4jService
        ];

        for (const service of services) {
            try {
                await service.disconnect();
            } catch (error) {
                console.warn(`Warning disconnecting ${service.getName()}:`, error.message);
            }
        }
    }
}

module.exports = { SimpleDashboardAPI };