/**
 * Enhanced Project Overview API
 * Integrates data from all database sources (PostgreSQL, Neo4j, MongoDB, Redis)
 * to provide comprehensive project insights for the dashboard
 */

const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const { MongoClient } = require('mongodb');
const redis = require('redis');

class EnhancedProjectOverviewAPI {
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
        } catch (error) {
            console.warn('⚠️ Neo4j connection failed:', error.message);
            this.neo4j = null;
        }

        // MongoDB connection
        try {
            const mongoUri = process.env.MONGO_URI || 
                `mongodb://${process.env.MONGO_USER || 'codemind'}:${process.env.MONGO_PASSWORD || 'codemind123'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DB || 'codemind'}?authSource=admin`;
            
            this.mongoClient = new MongoClient(mongoUri);
            await this.mongoClient.connect();
            this.mongodb = this.mongoClient.db(process.env.MONGO_DB || 'codemind');
        } catch (error) {
            console.warn('⚠️ MongoDB connection failed:', error.message);
            this.mongodb = null;
        }

        // Redis connection
        try {
            this.redis = redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || '',
                db: process.env.REDIS_DB || 0,
            });
            await this.redis.connect();
        } catch (error) {
            console.warn('⚠️ Redis connection failed:', error.message);
            this.redis = null;
        }
    }

    /**
     * Get comprehensive project overview data
     */
    async getProjectOverview(projectPath) {
        try {
            const [
                projectData,
                initializationProgress,
                patterns,
                analysisResults,
                semanticData,
                workflowData,
                toolData,
                qualityMetrics,
                businessIntelligence
            ] = await Promise.allSettled([
                this.getProjectBasicData(projectPath),
                this.getInitializationProgress(projectPath),
                this.getDetectedPatterns(projectPath),
                this.getAnalysisResults(projectPath),
                this.getSemanticIntelligence(projectPath),
                this.getWorkflowData(projectPath),
                this.getToolInstallations(projectPath),
                this.getQualityMetrics(projectPath),
                this.getBusinessIntelligence(projectPath)
            ]);

            return {
                success: true,
                data: {
                    project: this.extractValue(projectData),
                    initialization: this.extractValue(initializationProgress),
                    patterns: this.extractValue(patterns),
                    analysis: this.extractValue(analysisResults),
                    semantic: this.extractValue(semanticData),
                    workflows: this.extractValue(workflowData),
                    tools: this.extractValue(toolData),
                    quality: this.extractValue(qualityMetrics),
                    business: this.extractValue(businessIntelligence),
                    lastUpdated: new Date().toISOString(),
                    dataSourcesStatus: await this.getDatabaseStatus()
                }
            };
        } catch (error) {
            console.error('Error getting project overview:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get basic project data from PostgreSQL
     */
    async getProjectBasicData(projectPath) {
        const query = `
            SELECT p.*, pp.phase as current_phase, ip.updated_at as last_progress_update,
                   COUNT(DISTINCT dp.id) as pattern_count,
                   COUNT(DISTINCT qr.id) as questionnaire_responses
            FROM projects p
            LEFT JOIN initialization_progress ip ON p.id = ip.project_id
            LEFT JOIN detected_patterns dp ON p.id = dp.project_id
            LEFT JOIN questionnaire_responses qr ON p.id = qr.project_id
            WHERE p.project_path = $1
            GROUP BY p.id, ip.phase, ip.updated_at
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        return result.rows[0] || null;
    }

    /**
     * Get initialization progress data
     */
    async getInitializationProgress(projectPath) {
        const query = `
            SELECT ip.*, p.project_name
            FROM initialization_progress ip
            JOIN projects p ON ip.project_id = p.id
            WHERE p.project_path = $1
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        return result.rows[0] || { phase: 'not_started', progress_data: {} };
    }

    /**
     * Get detected patterns
     */
    async getDetectedPatterns(projectPath) {
        const query = `
            SELECT dp.pattern_type, dp.pattern_name, dp.confidence_score, 
                   dp.evidence, dp.status, dp.created_at
            FROM detected_patterns dp
            JOIN projects p ON dp.project_id = p.id
            WHERE p.project_path = $1 AND dp.status = 'detected'
            ORDER BY dp.confidence_score DESC, dp.created_at DESC
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        
        // Group patterns by type
        const patterns = {};
        result.rows.forEach(row => {
            if (!patterns[row.pattern_type]) {
                patterns[row.pattern_type] = [];
            }
            patterns[row.pattern_type].push(row);
        });

        return {
            total: result.rows.length,
            byType: patterns,
            latest: result.rows.slice(0, 5)
        };
    }

    /**
     * Get analysis results
     */
    async getAnalysisResults(projectPath) {
        const query = `
            SELECT ar.analysis_type, ar.file_path, ar.analysis_result, 
                   ar.confidence_score, ar.created_at
            FROM analysis_results ar
            JOIN projects p ON ar.project_id = p.id
            WHERE p.project_path = $1
            ORDER BY ar.created_at DESC
            LIMIT 100
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        
        // Group results by analysis type
        const results = {};
        result.rows.forEach(row => {
            if (!results[row.analysis_type]) {
                results[row.analysis_type] = [];
            }
            results[row.analysis_type].push(row);
        });

        return {
            total: result.rows.length,
            byType: results,
            summary: this.generateAnalysisSummary(results)
        };
    }

    /**
     * Get semantic intelligence data from Neo4j
     */
    async getSemanticIntelligence(projectPath) {
        if (!this.neo4j) {
            return { nodes: 0, relationships: 0, concepts: [], entities: [] };
        }

        const session = this.neo4j.session();
        try {
            // Get overall graph statistics - simplified to get all nodes/relationships
            const statsQuery = `
                MATCH (n) 
                WITH count(n) as nodeCount
                MATCH ()-[r]->() 
                RETURN nodeCount, count(r) as relCount
            `;
            
            const statsResult = await session.run(statsQuery, { projectPath });
            const stats = statsResult.records[0];

            // Get concept nodes - simplified to get all concepts first
            const conceptsQuery = `
                MATCH (c:Concept) 
                RETURN c.name as name, c.type as type, c.description as description
                ORDER BY c.importance DESC
                LIMIT 20
            `;
            
            const conceptsResult = await session.run(conceptsQuery, { projectPath });
            const concepts = conceptsResult.records.map(record => ({
                name: record.get('name'),
                type: record.get('type'),
                description: record.get('description')
            }));

            // Get entity relationships - simplified to get all entities first
            const entitiesQuery = `
                MATCH (e:Entity)-[r]->(t) 
                RETURN e.name as entity, type(r) as relationship, t.name as target
                LIMIT 50
            `;
            
            const entitiesResult = await session.run(entitiesQuery, { projectPath });
            const entities = entitiesResult.records.map(record => ({
                entity: record.get('entity'),
                relationship: record.get('relationship'),
                target: record.get('target')
            }));

            return {
                nodes: stats ? stats.get('nodeCount').toNumber() : 0,
                relationships: stats ? stats.get('relCount').toNumber() : 0,
                concepts: concepts,
                entities: entities,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Neo4j query error:', error);
            return { nodes: 0, relationships: 0, concepts: [], entities: [] };
        } finally {
            await session.close();
        }
    }

    /**
     * Get workflow data from PostgreSQL
     */
    async getWorkflowData(projectPath) {
        const query = `
            SELECT sw.workflow_name, sw.status, sw.priority, sw.created_at,
                   sw.estimated_duration, sw.actual_duration,
                   COUNT(wre.id) as role_executions,
                   COUNT(CASE WHEN wre.status = 'completed' THEN 1 END) as completed_roles
            FROM sequential_workflows sw
            LEFT JOIN workflow_role_executions wre ON sw.id = wre.workflow_id
            JOIN projects p ON sw.project_id = p.id
            WHERE p.project_path = $1
            GROUP BY sw.id, sw.workflow_name, sw.status, sw.priority, sw.created_at,
                     sw.estimated_duration, sw.actual_duration
            ORDER BY sw.created_at DESC
            LIMIT 10
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        
        return {
            total: result.rows.length,
            active: result.rows.filter(w => ['initiated', 'running'].includes(w.status)).length,
            completed: result.rows.filter(w => w.status === 'completed').length,
            recent: result.rows
        };
    }

    /**
     * Get tool installation data
     */
    async getToolInstallations(projectPath) {
        const query = `
            SELECT et.tool_name, et.category, ti.installed_version, ti.is_working,
                   ti.last_used, ti.usage_count
            FROM tool_installations ti
            JOIN external_tools et ON ti.tool_id = et.tool_id
            JOIN projects p ON ti.project_id = p.id
            WHERE p.project_path = $1 AND ti.is_working = true
            ORDER BY ti.usage_count DESC, ti.last_used DESC
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        
        // Group tools by category
        const toolsByCategory = {};
        result.rows.forEach(tool => {
            if (!toolsByCategory[tool.category]) {
                toolsByCategory[tool.category] = [];
            }
            toolsByCategory[tool.category].push(tool);
        });

        return {
            total: result.rows.length,
            byCategory: toolsByCategory,
            mostUsed: result.rows.slice(0, 10)
        };
    }

    /**
     * Get quality metrics
     */
    async getQualityMetrics(projectPath) {
        const query = `
            SELECT 
                COUNT(CASE WHEN ar.analysis_type = 'quality' THEN 1 END) as quality_checks,
                COUNT(CASE WHEN ar.analysis_type = 'duplication' THEN 1 END) as duplication_issues,
                COUNT(CASE WHEN ar.analysis_type = 'architecture' THEN 1 END) as architecture_violations,
                AVG(ar.confidence_score) as avg_confidence
            FROM analysis_results ar
            JOIN projects p ON ar.project_id = p.id
            WHERE p.project_path = $1
        `;
        
        const result = await this.pg.query(query, [projectPath]);
        const metrics = result.rows[0] || {};

        return {
            qualityChecks: parseInt(metrics.quality_checks) || 0,
            duplicationIssues: parseInt(metrics.duplication_issues) || 0,
            architectureViolations: parseInt(metrics.architecture_violations) || 0,
            avgConfidence: parseFloat(metrics.avg_confidence) || 0,
            lastAssessment: new Date().toISOString()
        };
    }

    /**
     * Get business intelligence data from MongoDB
     */
    async getBusinessIntelligence(projectPath) {
        try {
            // Get use cases from PostgreSQL
            const useCasesQuery = `
                SELECT uc.use_case_name as name, uc.description, uc.category, uc.priority,
                       uc.implementation_status, uc.actors, uc.related_files,
                       uc.main_flow, uc.test_coverage
                FROM use_cases uc
                JOIN projects p ON uc.project_id = p.id
                WHERE p.project_path = $1
                ORDER BY 
                    CASE WHEN uc.priority = 'critical' THEN 1
                         WHEN uc.priority = 'high' THEN 2
                         WHEN uc.priority = 'medium' THEN 3
                         ELSE 4 END
                LIMIT 10
            `;
            
            const useCasesResult = await this.pg.query(useCasesQuery, [projectPath]);

            // Get business concepts from MongoDB if available
            let concepts = [];
            if (this.mongodb) {
                try {
                    concepts = await this.mongodb.collection('business_concepts')
                        .find({ project_path: projectPath })
                        .sort({ relevance_score: -1 })
                        .limit(15)
                        .toArray();
                } catch (mongoError) {
                    console.warn('MongoDB business concepts query failed:', mongoError.message);
                }
            }

            // Get requirements from PostgreSQL documentation structure if available
            const requirementsQuery = `
                SELECT ds.file_path as name, ds.title as description, 
                       'documentation' as source
                FROM documentation_structure ds
                JOIN projects p ON ds.project_id = p.id
                WHERE p.project_path = $1 
                  AND (ds.file_path ILIKE '%requirement%' OR ds.file_path ILIKE '%spec%')
                ORDER BY ds.created_at DESC
                LIMIT 10
            `;
            
            const requirementsResult = await this.pg.query(requirementsQuery, [projectPath]);

            return {
                useCases: useCasesResult.rows.map(uc => ({
                    name: uc.name,
                    description: uc.description,
                    category: uc.category,
                    priority: uc.priority,
                    status: uc.implementation_status,
                    actors: uc.actors,
                    relatedFiles: uc.related_files,
                    testCoverage: uc.test_coverage,
                    mainFlow: uc.main_flow
                })),
                requirements: requirementsResult.rows.map(req => ({
                    name: req.name,
                    description: req.description,
                    source: req.source
                })),
                concepts: concepts.map(concept => ({
                    name: concept.concept_name || concept.name,
                    description: concept.description,
                    relevance: concept.relevance_score || 0
                }))
            };
        } catch (error) {
            console.error('MongoDB business intelligence query error:', error);
            return { useCases: [], requirements: [], concepts: [] };
        }
    }

    /**
     * Get database connection status
     */
    async getDatabaseStatus() {
        return {
            postgresql: await this.testPostgreSQLConnection(),
            neo4j: await this.testNeo4jConnection(),
            mongodb: await this.testMongoConnection(),
            redis: await this.testRedisConnection()
        };
    }

    async testPostgreSQLConnection() {
        try {
            const result = await this.pg.query('SELECT NOW()');
            return { connected: true, lastCheck: result.rows[0].now };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    async testNeo4jConnection() {
        if (!this.neo4j) return { connected: false, error: 'Neo4j not initialized' };
        
        const session = this.neo4j.session();
        try {
            await session.run('RETURN 1');
            return { connected: true, lastCheck: new Date() };
        } catch (error) {
            return { connected: false, error: error.message };
        } finally {
            await session.close();
        }
    }

    async testMongoConnection() {
        if (!this.mongodb) return { connected: false, error: 'MongoDB not initialized' };
        
        try {
            await this.mongodb.admin().ping();
            return { connected: true, lastCheck: new Date() };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    async testRedisConnection() {
        if (!this.redis) return { connected: false, error: 'Redis not initialized' };
        
        try {
            await this.redis.ping();
            return { connected: true, lastCheck: new Date() };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    /**
     * Helper methods
     */
    extractValue(promiseResult) {
        return promiseResult.status === 'fulfilled' ? promiseResult.value : null;
    }

    generateAnalysisSummary(results) {
        const summary = {
            totalFiles: 0,
            issuesFound: 0,
            recommendations: []
        };

        Object.entries(results).forEach(([type, analyses]) => {
            const files = new Set(analyses.map(a => a.file_path));
            summary.totalFiles += files.size;
            
            analyses.forEach(analysis => {
                if (analysis.analysis_result && analysis.analysis_result.issues) {
                    summary.issuesFound += analysis.analysis_result.issues.length;
                }
            });
        });

        return summary;
    }

    /**
     * Close all database connections
     */
    async closeConnections() {
        try {
            if (this.pg) await this.pg.end();
            if (this.neo4j) await this.neo4j.close();
            if (this.mongoClient) await this.mongoClient.close();
            if (this.redis) await this.redis.quit();
        } catch (error) {
            console.error('Error closing connections:', error);
        }
    }
}

module.exports = { EnhancedProjectOverviewAPI };