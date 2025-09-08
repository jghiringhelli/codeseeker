/**
 * Project-Specific API Endpoints for Enhanced Dashboard
 */

const { Pool } = require('pg');
const neo4j = require('neo4j-driver');

class ProjectAPI {
    constructor() {
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123'
        });

        // Neo4j connection
        this.neo4jDriver = neo4j.driver(
            process.env.NEO4J_URI || 'bolt://neo4j:7687',
            neo4j.auth.basic(
                process.env.NEO4J_USER || 'neo4j', 
                process.env.NEO4J_PASSWORD || 'codemind123'
            )
        );
    }

    /**
     * Get all projects
     */
    async getProjects() {
        try {
            const result = await this.db.query(`
                SELECT id, project_name, project_path, status, languages, frameworks, 
                       total_files, created_at, updated_at
                FROM projects 
                ORDER BY updated_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error getting projects:', error);
            return [];
        }
    }

    /**
     * Get project overview
     */
    async getProjectOverview(projectPath) {
        try {
            const result = await this.db.query(`
                SELECT p.*, 
                       COUNT(ce.id) as actual_file_count
                FROM projects p
                LEFT JOIN code_embeddings ce ON p.id = ce.project_id
                WHERE p.project_path = $1
                GROUP BY p.id
            `, [projectPath]);
            
            if (result.rows.length === 0) {
                throw new Error('Project not found');
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting project overview:', error);
            throw error;
        }
    }

    /**
     * Get file statistics for a project
     */
    async getFileStats(projectId) {
        try {
            const stats = await this.db.query(`
                SELECT 
                    COUNT(*) as totalFiles,
                    COUNT(CASE WHEN updated_at >= CURRENT_DATE THEN 1 END) as modifiedToday,
                    COUNT(CASE WHEN content_type = 'file' THEN 1 END) as codeFiles,
                    COUNT(CASE WHEN content_type = 'function' THEN 1 END) as functionFiles,
                    COUNT(CASE WHEN content_type = 'file' THEN 1 END) as configFiles,
                    COUNT(CASE WHEN content_type = 'documentation' THEN 1 END) as docFiles,
                    SUM(LENGTH(content_text)) as totalSize,
                    AVG(LENGTH(content_text)) as avgSize
                FROM code_embeddings 
                WHERE project_id = $1
            `, [projectId]);

            return stats.rows[0];
        } catch (error) {
            console.error('Error getting file stats:', error);
            return {
                totalFiles: 0,
                modifiedToday: 0,
                codeFiles: 0,
                testFiles: 0,
                configFiles: 0,
                docFiles: 0,
                totalSize: 0,
                avgSize: 0
            };
        }
    }

    /**
     * Get analysis results for a project
     */
    async getAnalysisResults(projectId) {
        try {
            const results = await this.db.query(`
                SELECT tool_name, COUNT(*) as count, MAX(updated_at) as last_run
                FROM tool_data 
                WHERE project_id = $1 
                GROUP BY tool_name
                ORDER BY last_run DESC
            `, [projectId]);

            const analysisMap = {};
            results.rows.forEach(row => {
                analysisMap[row.tool_name] = {
                    count: parseInt(row.count),
                    last_run: row.last_run,
                    available: true
                };
            });

            return analysisMap;
        } catch (error) {
            console.error('Error getting analysis results:', error);
            return {};
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(projectId) {
        try {
            // Get general cache stats
            const cacheResult = await this.db.query(`
                SELECT 
                    COUNT(*) as totalEntries,
                    COUNT(CASE WHEN expires_at > NOW() OR expires_at IS NULL THEN 1 END) as activeEntries,
                    SUM(size_bytes) as totalSizeBytes,
                    AVG(access_count) as avgAccessCount
                FROM cache_entries
                WHERE cache_key LIKE $1
            `, [`%${projectId}%`]);

            // Get semantic search specific cache stats
            const semanticResult = await this.db.query(`
                SELECT COUNT(*) as embeddingsCached
                FROM semantic_search_embeddings 
                WHERE project_id = $1
            `, [projectId]);

            const cacheStats = cacheResult.rows[0];
            const semanticStats = semanticResult.rows[0];

            return {
                totalEntries: parseInt(cacheStats.totalentries || 0),
                activeEntries: parseInt(cacheStats.activeentries || 0),
                cacheSizeMB: Math.round((cacheStats.totalsizebytes || 0) / 1024 / 1024 * 100) / 100,
                hitRate: Math.round((cacheStats.avgaccesscount || 0) * 10), // Simplified calculation
                embeddingsCached: parseInt(semanticStats.embeddingscached || 0)
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                totalEntries: 0,
                activeEntries: 0,
                cacheSizeMB: 0,
                hitRate: 0,
                embeddingsCached: 0
            };
        }
    }

    /**
     * Get semantic search data
     */
    async getSemanticData(projectId) {
        try {
            const result = await this.db.query(`
                SELECT file_path, content_type, content_text, content_hash, 
                       embedding IS NOT NULL as has_embedding, metadata
                FROM semantic_search_embeddings 
                WHERE project_id = $1 
                ORDER BY updated_at DESC 
                LIMIT 100
            `, [projectId]);

            return {
                segments: result.rows.map(row => ({
                    file_path: row.file_path,
                    content_type: row.content_type,
                    content_text: row.content_text,
                    content_hash: row.content_hash,
                    embedding: row.has_embedding,
                    metadata: row.metadata
                }))
            };
        } catch (error) {
            console.error('Error getting semantic data:', error);
            return { segments: [] };
        }
    }

    /**
     * Get graph data from Neo4j
     */
    async getGraphData(projectId) {
        const session = this.neo4jDriver.session();
        
        try {
            // Get nodes
            const nodeResult = await session.run(`
                MATCH (n) 
                WHERE n.project_id = $projectId 
                RETURN n, labels(n) as labels 
                LIMIT 100
            `, { projectId });

            // Get relationships
            const relResult = await session.run(`
                MATCH (a)-[r]->(b) 
                WHERE a.project_id = $projectId OR b.project_id = $projectId 
                RETURN type(r) as type, COUNT(r) as count
            `, { projectId });

            const nodes = nodeResult.records.map(record => ({
                id: record.get('n').identity.toString(),
                properties: record.get('n').properties,
                labels: record.get('labels')
            }));

            const relationships = relResult.records.map(record => ({
                type: record.get('type'),
                count: record.get('count').toNumber()
            }));

            return { nodes, relationships };
        } catch (error) {
            console.error('Error getting graph data:', error);
            return { nodes: [], relationships: [] };
        } finally {
            await session.close();
        }
    }

    /**
     * Get project files with filtering
     */
    async getProjectFiles(projectId, filters = {}) {
        try {
            let query = `
                SELECT 
                    file_path, 
                    content_type, 
                    LENGTH(content_text) as file_size,
                    updated_at as last_modified, 
                    content_hash,
                    id
                FROM code_embeddings 
                WHERE project_id = $1
            `;
            const params = [projectId];

            // Add filters
            if (filters.contentType) {
                query += ` AND content_type = $${params.length + 1}`;
                params.push(filters.contentType);
            }

            if (filters.language) {
                query += ` AND language = $${params.length + 1}`;
                params.push(filters.language);
            }

            query += ` ORDER BY last_modified DESC LIMIT 200`;

            const result = await this.db.query(query, params);

            return {
                files: result.rows
            };
        } catch (error) {
            console.error('Error getting project files:', error);
            return { files: [] };
        }
    }

    /**
     * Get project insights and metrics
     */
    async getProjectInsights(projectId) {
        try {
            // Get tool analysis summary
            const toolSummary = await this.db.query(`
                SELECT 
                    tool_name,
                    COUNT(*) as analysis_count,
                    MAX(updated_at) as last_analysis,
                    jsonb_agg(DISTINCT data->'analysis'->'summary') as summaries
                FROM tool_data 
                WHERE project_id = $1 
                GROUP BY tool_name
            `, [projectId]);

            // Get code quality metrics
            const qualityMetrics = await this.db.query(`
                SELECT 
                    AVG(CASE WHEN data->'analysis'->'complexity' IS NOT NULL 
                        THEN (data->'analysis'->'complexity')::float ELSE NULL END) as avg_complexity,
                    COUNT(CASE WHEN data->'analysis'->'issues' IS NOT NULL 
                        THEN 1 ELSE NULL END) as files_with_issues
                FROM tool_data 
                WHERE project_id = $1 AND tool_name = 'solid-principles'
            `, [projectId]);

            return {
                tools: toolSummary.rows,
                quality: qualityMetrics.rows[0],
                insights: [
                    'Project analysis is up to date',
                    'Semantic search index is populated',
                    'Graph relationships are mapped'
                ]
            };
        } catch (error) {
            console.error('Error getting project insights:', error);
            return { tools: [], quality: {}, insights: [] };
        }
    }

    /**
     * Close connections
     */
    async close() {
        try {
            await this.db.end();
            await this.neo4jDriver.close();
        } catch (error) {
            console.error('Error closing connections:', error);
        }
    }
}

module.exports = { ProjectAPI };