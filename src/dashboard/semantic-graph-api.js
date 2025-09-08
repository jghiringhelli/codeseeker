/**
 * Semantic Graph API for Dashboard
 * Provides REST endpoints for graph visualization and interaction
 */

const express = require('express');
const path = require('path');

// Import compiled semantic graph service
const { SemanticGraphService } = require('../../dist/services/semantic-graph');

class SemanticGraphAPI {
    constructor() {
        this.app = express();
        this.semanticGraph = new SemanticGraphService();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '..')));
        
        // CORS for dashboard
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            next();
        });
    }

    setupRoutes() {
        // Graph statistics endpoint
        this.app.get('/api/semantic-graph/statistics', async (req, res) => {
            try {
                const stats = await this.semanticGraph.getGraphStatistics();
                res.json(stats);
            } catch (error) {
                console.error('Failed to get graph statistics:', error);
                res.status(500).json({ 
                    error: 'Failed to get graph statistics',
                    details: error.message,
                    fallback: {
                        total_nodes: 0,
                        total_relationships: 0,
                        node_distribution: [],
                        relationship_distribution: []
                    }
                });
            }
        });

        // Get all nodes with pagination
        this.app.get('/api/semantic-graph/nodes', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const offset = parseInt(req.query.offset) || 0;
                const nodeType = req.query.type;
                
                const nodes = await this.getAllNodes(limit, offset, nodeType);
                res.json(nodes);
            } catch (error) {
                console.error('Failed to get nodes:', error);
                res.status(500).json({ 
                    error: 'Failed to get nodes',
                    details: error.message,
                    fallback: []
                });
            }
        });

        // Get all relationships with pagination
        this.app.get('/api/semantic-graph/relationships', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 200;
                const offset = parseInt(req.query.offset) || 0;
                
                const relationships = await this.getAllRelationships(limit, offset);
                res.json(relationships);
            } catch (error) {
                console.error('Failed to get relationships:', error);
                res.status(500).json({ 
                    error: 'Failed to get relationships',
                    details: error.message,
                    fallback: []
                });
            }
        });

        // Semantic search endpoint
        this.app.get('/api/semantic-graph/search', async (req, res) => {
            try {
                const query = req.query.q || '';
                const maxResults = parseInt(req.query.limit) || 20;
                
                if (!query.trim()) {
                    return res.json([]);
                }
                
                const results = await this.semanticGraph.semanticSearch(query, {
                    maxDepth: maxResults
                });
                
                res.json(results);
            } catch (error) {
                console.error('Failed to perform semantic search:', error);
                res.status(500).json({ 
                    error: 'Failed to perform semantic search',
                    details: error.message,
                    fallback: []
                });
            }
        });

        // Node exploration endpoint
        this.app.get('/api/semantic-graph/explore/:nodeId', async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                const maxDepth = parseInt(req.query.depth) || 2;
                
                const relatedNodes = await this.semanticGraph.findRelated(nodeId, maxDepth);
                res.json({
                    nodeId,
                    relatedNodes,
                    count: relatedNodes.length
                });
            } catch (error) {
                console.error('Failed to explore node:', error);
                res.status(500).json({ 
                    error: 'Failed to explore node',
                    details: error.message,
                    fallback: {
                        nodeId: req.params.nodeId,
                        relatedNodes: [],
                        count: 0
                    }
                });
            }
        });

        // Impact analysis endpoint
        this.app.get('/api/semantic-graph/impact/:nodeId', async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                const maxDepth = parseInt(req.query.depth) || 3;
                
                const impact = await this.semanticGraph.analyzeImpact(nodeId, maxDepth);
                res.json(impact);
            } catch (error) {
                console.error('Failed to analyze impact:', error);
                res.status(500).json({ 
                    error: 'Failed to analyze impact',
                    details: error.message,
                    fallback: {
                        affectedNodes: [],
                        relationships: [],
                        impact: {
                            codeFiles: 0,
                            documentation: 0,
                            tests: 0,
                            uiComponents: 0
                        },
                        riskLevel: 'unknown'
                    }
                });
            }
        });

        // Cross-references endpoint
        this.app.get('/api/semantic-graph/cross-references/:conceptName', async (req, res) => {
            try {
                const conceptName = decodeURIComponent(req.params.conceptName);
                const crossRefs = await this.semanticGraph.findCrossReferences(conceptName);
                res.json(crossRefs);
            } catch (error) {
                console.error('Failed to find cross references:', error);
                res.status(500).json({ 
                    error: 'Failed to find cross references',
                    details: error.message,
                    fallback: {
                        concept: null,
                        relatedCode: [],
                        relatedDocs: [],
                        relatedUI: [],
                        relatedTests: []
                    }
                });
            }
        });

        // Health check endpoint
        this.app.get('/api/semantic-graph/health', async (req, res) => {
            try {
                await this.semanticGraph.getGraphStatistics();
                res.json({ 
                    status: 'healthy', 
                    timestamp: new Date().toISOString(),
                    service: 'semantic-graph-api'
                });
            } catch (error) {
                res.status(500).json({ 
                    status: 'unhealthy', 
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    service: 'semantic-graph-api'
                });
            }
        });

        // Serve the dashboard page
        this.app.get('/dashboard/semantic-graph', (req, res) => {
            res.sendFile(path.join(__dirname, 'semantic-graph-page.html'));
        });
    }

    async getAllNodes(limit = 100, offset = 0, nodeType = null) {
        const session = this.semanticGraph.driver.session();
        try {
            let query = 'MATCH (n) ';
            let params = { limit: limit, offset: offset };
            
            if (nodeType) {
                query += `WHERE $nodeType IN labels(n) `;
                params.nodeType = nodeType;
            }
            
            query += 'RETURN n ORDER BY n.name SKIP $offset LIMIT $limit';
            
            // Convert to Neo4j integers
            const neo4j = require('neo4j-driver');
            params.limit = neo4j.int(params.limit);
            params.offset = neo4j.int(params.offset);
            
            const result = await session.run(query, params);
            
            return result.records.map(record => {
                const node = record.get('n');
                return {
                    id: node.identity.toString(),
                    labels: node.labels,
                    properties: node.properties
                };
            });
        } finally {
            await session.close();
        }
    }

    async getAllRelationships(limit = 200, offset = 0) {
        const session = this.semanticGraph.driver.session();
        try {
            const neo4j = require('neo4j-driver');
            const result = await session.run(
                'MATCH ()-[r]->() RETURN r SKIP $offset LIMIT $limit',
                { limit: neo4j.int(limit), offset: neo4j.int(offset) }
            );
            
            return result.records.map(record => {
                const rel = record.get('r');
                return {
                    id: rel.identity.toString(),
                    type: rel.type,
                    startNodeId: rel.start.toString(),
                    endNodeId: rel.end.toString(),
                    properties: rel.properties
                };
            });
        } finally {
            await session.close();
        }
    }

    async initialize() {
        try {
            await this.semanticGraph.initialize();
            console.log('🧠 Semantic Graph API initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Semantic Graph API:', error);
            throw error;
        }
    }

    async close() {
        await this.semanticGraph.close();
    }

    listen(port = 3005) {
        return new Promise((resolve) => {
            this.server = this.app.listen(port, () => {
                console.log(`🧠 Semantic Graph API running on http://localhost:${port}`);
                console.log(`📊 Dashboard available at http://localhost:${port}/dashboard/semantic-graph`);
                resolve(this.server);
            });
        });
    }

    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
        await this.close();
    }
}

module.exports = { SemanticGraphAPI };

// If running directly, start the server
if (require.main === module) {
    const api = new SemanticGraphAPI();
    
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down Semantic Graph API...');
        await api.stop();
        process.exit(0);
    });
    
    api.initialize()
        .then(() => api.listen(3005))
        .catch(error => {
            console.error('❌ Failed to start Semantic Graph API:', error);
            process.exit(1);
        });
}