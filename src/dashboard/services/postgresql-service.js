/**
 * PostgreSQL Database Service
 * Handles all PostgreSQL operations for the dashboard
 */

const { Pool } = require('pg');
const { DatabaseService } = require('./database-service');

class PostgreSQLService extends DatabaseService {
    constructor() {
        super('PostgreSQL');
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123',
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test connection
            await this.pool.query('SELECT 1');
            this.connected = true;
            console.log('✅ PostgreSQL service connected');
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            this.connected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.connected = false;
            console.log('📤 PostgreSQL service disconnected');
        }
    }

    async healthCheck() {
        try {
            if (!this.pool) throw new Error('Not connected');
            await this.pool.query('SELECT 1');
            return { connected: true, database: 'postgresql' };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    // Project queries
    async getAllProjects() {
        const result = await this.pool.query(`
            SELECT p.id, p.project_name, p.project_path, p.created_at, p.updated_at,
                   COUNT(ar.id) as analysis_count,
                   MAX(ar.created_at) as last_analysis
            FROM projects p
            LEFT JOIN analysis_results ar ON p.id = ar.project_id
            GROUP BY p.id, p.project_name, p.project_path, p.created_at, p.updated_at
            ORDER BY p.updated_at DESC
        `);
        return result.rows;
    }

    async getProjectById(projectId) {
        const result = await this.pool.query(`
            SELECT * FROM projects WHERE id = $1
        `, [projectId]);
        return result.rows[0];
    }

    async getProjectStats(projectId) {
        const queries = await Promise.all([
            // Basic project info
            this.pool.query('SELECT * FROM projects WHERE id = $1', [projectId]),
            
            // Analysis count
            this.pool.query('SELECT COUNT(*) as count FROM analysis_results WHERE project_id = $1', [projectId]),
            
            // Semantic embeddings count
            this.pool.query('SELECT COUNT(*) as count FROM semantic_search_embeddings WHERE project_id = $1', [projectId]),
            
            // Last analysis
            this.pool.query('SELECT MAX(created_at) as last_analysis FROM analysis_results WHERE project_id = $1', [projectId]),
            
            // Tool usage stats
            this.pool.query(`
                SELECT 
                    COUNT(DISTINCT analysis_type) as tools_used,
                    COUNT(*) as total_analyses,
                    COUNT(CASE WHEN analysis_result::text LIKE '%error%' THEN 1 END) as errors,
                    COUNT(CASE WHEN analysis_result::text LIKE '%warning%' THEN 1 END) as warnings
                FROM analysis_results 
                WHERE project_id = $1
            `, [projectId])
        ]);

        const [projectResult, analysisResult, semanticResult, lastAnalysisResult, statsResult] = queries;

        if (projectResult.rows.length === 0) {
            throw new Error('Project not found');
        }

        // Count actual files in project directory
        const fileCount = await this.countProjectFiles(projectResult.rows[0].project_path);

        return {
            project: projectResult.rows[0],
            fileCount,
            analysisCount: parseInt(analysisResult.rows[0].count),
            semanticNodes: parseInt(semanticResult.rows[0].count),
            lastAnalysis: lastAnalysisResult.rows[0].last_analysis ? 
                new Date(lastAnalysisResult.rows[0].last_analysis).toLocaleDateString() : '-',
            stats: statsResult.rows[0]
        };
    }

    // Analysis queries
    async getRecentAnalyses(projectId = null, limit = 20) {
        const whereClause = projectId ? 'WHERE ar.project_id = $1' : '';
        const params = projectId ? [projectId] : [];
        
        const result = await this.pool.query(`
            SELECT ar.analysis_type, ar.analysis_type, ar.created_at, 
                   p.project_name,
                   CASE 
                       WHEN ar.results::text LIKE '%error%' THEN 'error'
                       WHEN ar.results::text LIKE '%warning%' THEN 'warning'
                       ELSE 'success'
                   END as status
            FROM analysis_results ar
            JOIN projects p ON ar.project_id = p.id
            ${whereClause}
            ORDER BY ar.created_at DESC 
            LIMIT ${limit}
        `, params);
        return result.rows;
    }

    async getToolUsage(projectId = null) {
        const whereClause = projectId ? 'WHERE project_id = $1' : '';
        const params = projectId ? [projectId] : [];
        
        const result = await this.pool.query(`
            SELECT analysis_type, 
                   COUNT(*) as usage_count,
                   MAX(created_at) as last_used,
                   COUNT(CASE WHEN results::text LIKE '%error%' THEN 1 END) as error_count,
                   AVG(EXTRACT(epoch FROM (updated_at - created_at))) as avg_duration
            FROM analysis_results 
            ${whereClause}
            GROUP BY analysis_type 
            ORDER BY usage_count DESC
        `, params);
        return result.rows;
    }

    // Semantic search
    async performSemanticSearch(query, projectId = null, limit = 10) {
        const whereClause = projectId ? 'AND project_id = $2' : '';
        const params = projectId ? [query, projectId] : [query];
        
        const result = await this.pool.query(`
            SELECT sse.file_path, sse.content_snippet, sse.similarity_score,
                   p.project_name
            FROM semantic_search_embeddings sse
            JOIN projects p ON sse.project_id = p.id
            WHERE sse.content_snippet ILIKE '%' || $1 || '%'
            ${whereClause}
            ORDER BY sse.similarity_score DESC
            LIMIT ${limit}
        `, params);
        return result.rows;
    }

    // Count files in project directory
    async countProjectFiles(projectPath) {
        const fs = require('fs').promises;
        const path = require('path');

        try {
            // Check if directory exists and is accessible
            await fs.access(projectPath);

            const countFilesRecursive = async (dir) => {
                let count = 0;
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        // Skip common directories that shouldn't be counted
                        if (entry.isDirectory() &&
                            ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv'].includes(entry.name)) {
                            continue;
                        }

                        const fullPath = path.join(dir, entry.name);

                        if (entry.isFile()) {
                            count++;
                        } else if (entry.isDirectory()) {
                            count += await countFilesRecursive(fullPath);
                        }
                    }
                } catch (error) {
                    // Skip directories we can't access
                }
                return count;
            };

            return await countFilesRecursive(projectPath);
        } catch (error) {
            console.warn(`Could not count files in ${projectPath}: ${error.message}`);
            return 0;
        }
    }

    // Database insights
    async getDatabaseInsights() {
        const result = await this.pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM projects) as total_projects,
                (SELECT COUNT(*) FROM analysis_results) as total_analyses,
                (SELECT COUNT(*) FROM semantic_search_embeddings) as total_embeddings,
                (SELECT COUNT(DISTINCT analysis_type) FROM analysis_results) as unique_tools,
                (SELECT MAX(created_at) FROM analysis_results) as latest_analysis
        `);
        return result.rows[0];
    }
}

module.exports = { PostgreSQLService };