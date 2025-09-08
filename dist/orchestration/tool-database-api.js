"use strict";
/**
 * Tool Database API - Provides CRUD operations for all internal tool data
 * This API is used by internal tools as database interface wrappers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDB = exports.ToolDatabaseAPI = void 0;
const pg_1 = require("pg");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
class ToolDatabaseAPI {
    pool;
    initialized = false;
    constructor(config) {
        const defaultConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123'
        };
        this.pool = new pg_1.Pool(config || defaultConfig);
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Test connection
            await this.pool.query('SELECT 1');
            this.initialized = true;
        }
        catch (error) {
            throw new Error(`Failed to initialize database connection: ${error}`);
        }
    }
    async query(text, params) {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.pool.query(text, params);
    }
    // ============================================
    // GENERIC TOOL DATA OPERATIONS (For Enhanced Tool Interface)
    // ============================================
    async saveToolData(projectId, toolName, data) {
        try {
            if (toolName === 'semantic-search') {
                return this.saveSemanticSearchData(projectId, data);
            }
            // Default to tool_data table
            const result = await this.query(`
        INSERT INTO tool_data (project_id, tool_name, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (project_id, tool_name) DO UPDATE SET
        data = $3, updated_at = NOW()
        RETURNING *
      `, [projectId, toolName, JSON.stringify(data)]);
            return result.rows[0];
        }
        catch (error) {
            console.error(`Error saving tool data for ${toolName}:`, error);
            throw error;
        }
    }
    // ============================================
    // SEMANTIC SEARCH SPECIFIC OPERATIONS
    // ============================================
    async getSemanticSearchData(projectId, filters = {}) {
        try {
            let query = 'SELECT * FROM semantic_search_embeddings WHERE project_id = $1';
            const params = [projectId];
            if (filters.content_type) {
                query += ` AND content_type = $${params.length + 1}`;
                params.push(filters.content_type);
            }
            if (filters.file_path) {
                query += ` AND file_path ILIKE $${params.length + 1}`;
                params.push(`%${filters.file_path}%`);
            }
            query += ' ORDER BY updated_at DESC';
            if (filters.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(filters.limit);
            }
            const result = await this.query(query, params);
            return result.rows;
        }
        catch (error) {
            console.error('Error getting semantic search data:', error);
            return [];
        }
    }
    async saveSemanticSearchData(projectId, data) {
        try {
            for (const item of data) {
                await this.query(`
          INSERT INTO semantic_search_embeddings (
            project_id, file_path, content_type, content_text, 
            content_hash, embedding, metadata, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (project_id, file_path, content_hash) DO UPDATE SET
          content_text = $4, embedding = $6, metadata = $7, updated_at = NOW()
        `, [
                    projectId,
                    item.file_path,
                    item.content_type,
                    item.content_text,
                    item.content_hash,
                    item.embedding,
                    JSON.stringify(item.metadata || {})
                ]);
            }
            return { success: true, processed: data.length };
        }
        catch (error) {
            console.error('Error saving semantic search data:', error);
            throw error;
        }
    }
    async close() {
        await this.pool.end();
    }
    // ============================================
    // TREE NAVIGATION DATA OPERATIONS
    // ============================================
    async getTreeNavigationData(projectId, filters = {}) {
        const { file_path, node_type, depth_limit } = filters;
        let query = 'SELECT * FROM tree_navigation_data WHERE project_id = $1';
        const params = [projectId];
        if (file_path) {
            query += ' AND file_path ILIKE $' + (params.length + 1);
            params.push(`%${file_path}%`);
        }
        if (node_type) {
            query += ' AND node_type = $' + (params.length + 1);
            params.push(node_type);
        }
        if (depth_limit) {
            query += ' AND depth <= $' + (params.length + 1);
            params.push(depth_limit);
        }
        query += ' ORDER BY depth, file_path';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveTreeNavigationData(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Clear existing data for this project
            await client.query('DELETE FROM tree_navigation_data WHERE project_id = $1', [projectId]);
            // Insert new data
            for (const item of data) {
                const query = `
          INSERT INTO tree_navigation_data 
          (project_id, file_path, node_type, node_name, parent_path, depth, children_count, metadata, relationships, complexity_score, last_modified)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
                await client.query(query, [
                    projectId,
                    item.file_path,
                    item.node_type,
                    item.node_name,
                    item.parent_path,
                    item.depth || 0,
                    item.children_count || 0,
                    JSON.stringify(item.metadata || {}),
                    JSON.stringify(item.relationships || []),
                    item.complexity_score || 0,
                    item.last_modified || new Date()
                ]);
            }
            await client.query('COMMIT');
            return { success: true, inserted: data.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // CODE DUPLICATIONS OPERATIONS
    // ============================================
    async getCodeDuplications(projectId, filters = {}) {
        const { duplication_type, similarity_threshold, priority, status } = filters;
        let query = 'SELECT * FROM code_duplications WHERE project_id = $1';
        const params = [projectId];
        if (duplication_type) {
            query += ' AND duplication_type = $' + (params.length + 1);
            params.push(duplication_type);
        }
        if (similarity_threshold) {
            query += ' AND similarity_score >= $' + (params.length + 1);
            params.push(similarity_threshold);
        }
        if (priority) {
            query += ' AND priority = $' + (params.length + 1);
            params.push(priority);
        }
        if (status) {
            query += ' AND status = $' + (params.length + 1);
            params.push(status);
        }
        query += ' ORDER BY similarity_score DESC, priority DESC';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveCodeDuplications(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of data) {
                const query = `
          INSERT INTO code_duplications 
          (project_id, duplication_type, similarity_score, source_file, source_start_line, source_end_line, 
           target_file, target_start_line, target_end_line, code_snippet, tokens_count, refactor_suggestion, priority, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (project_id, source_file, source_start_line, target_file, target_start_line) 
          DO UPDATE SET 
            similarity_score = EXCLUDED.similarity_score,
            refactor_suggestion = EXCLUDED.refactor_suggestion,
            updated_at = NOW()
        `;
                await client.query(query, [
                    projectId,
                    item.duplication_type,
                    item.similarity_score,
                    item.source_file,
                    item.source_start_line,
                    item.source_end_line,
                    item.target_file,
                    item.target_start_line,
                    item.target_end_line,
                    item.code_snippet,
                    item.tokens_count || 0,
                    item.refactor_suggestion,
                    item.priority || 'medium',
                    item.status || 'detected'
                ]);
            }
            await client.query('COMMIT');
            return { success: true, processed: data.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // CENTRALIZATION OPPORTUNITIES OPERATIONS
    // ============================================
    async getCentralizationOpportunities(projectId, filters = {}) {
        const { opportunity_type, priority, status } = filters;
        let query = 'SELECT * FROM centralization_opportunities WHERE project_id = $1';
        const params = [projectId];
        if (opportunity_type) {
            query += ' AND opportunity_type = $' + (params.length + 1);
            params.push(opportunity_type);
        }
        if (priority) {
            query += ' AND priority = $' + (params.length + 1);
            params.push(priority);
        }
        if (status) {
            query += ' AND status = $' + (params.length + 1);
            params.push(status);
        }
        query += ' ORDER BY priority DESC, complexity_reduction DESC';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveCentralizationOpportunities(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of data) {
                const query = `
          INSERT INTO centralization_opportunities 
          (project_id, opportunity_type, pattern_name, occurrences, affected_files, centralization_benefit, 
           suggested_location, suggested_approach, complexity_reduction, priority, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (project_id, pattern_name) 
          DO UPDATE SET 
            occurrences = EXCLUDED.occurrences,
            affected_files = EXCLUDED.affected_files,
            centralization_benefit = EXCLUDED.centralization_benefit,
            suggested_location = EXCLUDED.suggested_location,
            updated_at = NOW()
        `;
                await client.query(query, [
                    projectId,
                    item.opportunity_type,
                    item.pattern_name,
                    item.occurrences || 1,
                    item.affected_files,
                    item.centralization_benefit,
                    item.suggested_location,
                    item.suggested_approach,
                    item.complexity_reduction || 0,
                    item.priority || 'medium',
                    item.status || 'identified'
                ]);
            }
            await client.query('COMMIT');
            return { success: true, processed: data.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // TEST COVERAGE DATA OPERATIONS
    // ============================================
    async getTestCoverageData(projectId, filters = {}) {
        const { file_path, coverage_type, min_coverage, risk_level } = filters;
        let query = 'SELECT * FROM test_coverage_data WHERE project_id = $1';
        const params = [projectId];
        if (file_path) {
            query += ' AND file_path ILIKE $' + (params.length + 1);
            params.push(`%${file_path}%`);
        }
        if (coverage_type) {
            query += ' AND coverage_type = $' + (params.length + 1);
            params.push(coverage_type);
        }
        if (min_coverage) {
            query += ' AND coverage_percentage >= $' + (params.length + 1);
            params.push(min_coverage);
        }
        if (risk_level) {
            query += ' AND risk_level = $' + (params.length + 1);
            params.push(risk_level);
        }
        query += ' ORDER BY coverage_percentage ASC, risk_level DESC';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveTestCoverageData(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of data) {
                const query = `
          INSERT INTO test_coverage_data 
          (project_id, file_path, coverage_type, total_items, covered_items, coverage_percentage, 
           uncovered_lines, test_files, complexity_score, risk_level, last_test_run)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (project_id, file_path, coverage_type) 
          DO UPDATE SET 
            total_items = EXCLUDED.total_items,
            covered_items = EXCLUDED.covered_items,
            coverage_percentage = EXCLUDED.coverage_percentage,
            uncovered_lines = EXCLUDED.uncovered_lines,
            test_files = EXCLUDED.test_files,
            last_test_run = EXCLUDED.last_test_run,
            updated_at = NOW()
        `;
                await client.query(query, [
                    projectId,
                    item.file_path,
                    item.coverage_type,
                    item.total_items || 0,
                    item.covered_items || 0,
                    item.coverage_percentage || 0,
                    item.uncovered_lines || [],
                    item.test_files || [],
                    item.complexity_score || 0,
                    item.risk_level || 'medium',
                    item.last_test_run || new Date()
                ]);
            }
            await client.query('COMMIT');
            return { success: true, processed: data.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // COMPILATION RESULTS OPERATIONS
    // ============================================
    async getCompilationResults(projectId, filters = {}) {
        const { build_status, compiler, recent_only } = filters;
        let query = 'SELECT cr.*, ci.* FROM compilation_results cr LEFT JOIN compilation_issues ci ON cr.build_id = ci.build_id WHERE cr.project_id = $1';
        const params = [projectId];
        if (build_status) {
            query += ' AND cr.build_status = $' + (params.length + 1);
            params.push(build_status);
        }
        if (compiler) {
            query += ' AND cr.compiler = $' + (params.length + 1);
            params.push(compiler);
        }
        if (recent_only) {
            query += ' AND cr.created_at >= $' + (params.length + 1);
            params.push(new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24 hours
        }
        query += ' ORDER BY cr.created_at DESC';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveCompilationResults(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Insert compilation result
            const resultQuery = `
        INSERT INTO compilation_results 
        (project_id, build_id, build_status, compiler, total_files, successful_files, files_with_errors, 
         files_with_warnings, errors, warnings, build_time_ms, output_size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
            await client.query(resultQuery, [
                projectId,
                data.build_id,
                data.build_status,
                data.compiler,
                data.total_files || 0,
                data.successful_files || 0,
                data.files_with_errors || 0,
                data.files_with_warnings || 0,
                JSON.stringify(data.errors || []),
                JSON.stringify(data.warnings || []),
                data.build_time_ms || 0,
                data.output_size_bytes || 0
            ]);
            // Insert compilation issues if any
            if (data.issues && data.issues.length > 0) {
                for (const issue of data.issues) {
                    const issueQuery = `
            INSERT INTO compilation_issues 
            (project_id, build_id, file_path, line_number, column_number, issue_type, severity, message, suggestion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;
                    await client.query(issueQuery, [
                        projectId,
                        data.build_id,
                        issue.file_path,
                        issue.line_number || 0,
                        issue.column_number || 0,
                        issue.issue_type || 'other',
                        issue.severity || 'info',
                        issue.message,
                        issue.suggestion
                    ]);
                }
            }
            await client.query('COMMIT');
            return { success: true, build_id: data.build_id };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // SOLID VIOLATIONS OPERATIONS
    // ============================================
    async getSOLIDViolations(projectId, filters = {}) {
        const { file_path, principle, severity, status } = filters;
        let query = 'SELECT * FROM solid_violations WHERE project_id = $1';
        const params = [projectId];
        if (file_path) {
            query += ' AND file_path ILIKE $' + (params.length + 1);
            params.push(`%${file_path}%`);
        }
        if (principle) {
            query += ' AND principle = $' + (params.length + 1);
            params.push(principle);
        }
        if (severity) {
            query += ' AND severity = $' + (params.length + 1);
            params.push(severity);
        }
        if (status) {
            query += ' AND status = $' + (params.length + 1);
            params.push(status);
        }
        query += ' ORDER BY severity DESC, principle';
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async saveSOLIDViolations(projectId, data) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of data) {
                const query = `
          INSERT INTO solid_violations 
          (project_id, file_path, class_name, principle, violation_type, description, line_number, 
           severity, refactoring_suggestion, estimated_effort, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (project_id, file_path, class_name, principle, line_number) 
          DO UPDATE SET 
            violation_type = EXCLUDED.violation_type,
            description = EXCLUDED.description,
            refactoring_suggestion = EXCLUDED.refactoring_suggestion,
            updated_at = NOW()
        `;
                await client.query(query, [
                    projectId,
                    item.file_path,
                    item.class_name,
                    item.principle,
                    item.violation_type,
                    item.description,
                    item.line_number || 0,
                    item.severity || 'moderate',
                    item.refactoring_suggestion,
                    item.estimated_effort || 'medium',
                    item.status || 'detected'
                ]);
            }
            await client.query('COMMIT');
            return { success: true, processed: data.length };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    // ============================================
    // GENERIC TOOL DATA OPERATIONS
    // ============================================
    async getToolData(projectId, toolName, filters = {}) {
        const tableMap = {
            'tree-navigation': 'tree_navigation_data',
            'duplications': 'code_duplications',
            'centralization': 'centralization_opportunities',
            'test-coverage': 'test_coverage_data',
            'compilation': 'compilation_results',
            'solid-analysis': 'solid_violations',
            'ui-components': 'ui_components',
            'documentation': 'documentation_structure',
            'use-cases': 'use_cases',
            'database-analysis': 'database_analysis',
            'patterns': 'detected_patterns',
            'claude-decisions': 'claude_decisions'
        };
        const tableName = tableMap[toolName];
        if (!tableName) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        switch (toolName) {
            case 'tree-navigation':
                return this.getTreeNavigationData(projectId, filters);
            case 'duplications':
                return this.getCodeDuplications(projectId, filters);
            case 'centralization':
                return this.getCentralizationOpportunities(projectId, filters);
            case 'test-coverage':
                return this.getTestCoverageData(projectId, filters);
            case 'compilation':
                return this.getCompilationResults(projectId, filters);
            case 'solid-analysis':
                return this.getSOLIDViolations(projectId, filters);
            default:
                // Generic query for other tools
                const query = `SELECT * FROM ${tableName} WHERE project_id = $1 ORDER BY created_at DESC`;
                const result = await this.pool.query(query, [projectId]);
                return result.rows;
        }
    }
    // ============================================
    // SEMANTIC SEARCH OPERATIONS
    // ============================================
    /**
     * Save semantic search embeddings to database
     */
    async saveSemanticSearch(projectId, data) {
        console.log(`Saving ${data.length} semantic search embeddings for project ${projectId}`);
        const insertPromises = data.map(async (item) => {
            try {
                // Convert embedding array to PostgreSQL vector format if it exists
                let embeddingValue = null;
                if (item.embedding) {
                    if (typeof item.embedding === 'string') {
                        embeddingValue = item.embedding; // Already formatted
                    }
                    else if (Array.isArray(item.embedding)) {
                        embeddingValue = `[${item.embedding.join(',')}]`;
                    }
                }
                const result = await this.pool.query(`
          INSERT INTO code_embeddings (
            project_id, file_path, content_type, content_text, content_hash, 
            embedding, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, NOW(), NOW())
          RETURNING id
        `, [
                    projectId,
                    item.file_path,
                    item.content_type,
                    item.content_text,
                    item.content_hash,
                    embeddingValue,
                    JSON.stringify(item.metadata || {})
                ]);
                return { success: true, id: result.rows[0]?.id };
            }
            catch (error) {
                console.error(`Failed to insert embedding:`, error);
                return { success: false, error: error.message };
            }
        });
        const results = await Promise.all(insertPromises);
        const successful = results.filter(r => r.success).length;
        return {
            total: data.length,
            inserted: successful,
            errors: results.filter(r => !r.success).length
        };
    }
    /**
     * Get semantic search embeddings from database
     */
    async getSemanticSearch(projectId, filters = {}) {
        const conditions = ['project_id = $1'];
        const params = [projectId];
        let paramIndex = 2;
        if (filters.content_type) {
            conditions.push(`content_type = $${paramIndex}`);
            params.push(filters.content_type);
            paramIndex++;
        }
        if (filters.file_path) {
            conditions.push(`file_path LIKE $${paramIndex}`);
            params.push(`%${filters.file_path}%`);
            paramIndex++;
        }
        const limit = parseInt(filters.limit) || 100;
        const offset = parseInt(filters.offset) || 0;
        const query = `
      SELECT id, project_id, file_path, content_type, content_text, content_hash,
             embedding, metadata, created_at, updated_at
      FROM code_embeddings 
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        params.push(String(limit), String(offset));
        try {
            const result = await this.pool.query(query, params);
            return result.rows;
        }
        catch (error) {
            console.error('Error querying semantic search data:', error);
            throw error;
        }
    }
    /**
     * Perform semantic similarity search
     */
    async searchSimilarCode(projectId, queryEmbedding, options = {}) {
        const { contentTypes, threshold = 0.7, limit = 10 } = options;
        let conditions = ['project_id = $1'];
        let params = [projectId];
        let paramIndex = 2;
        if (contentTypes && contentTypes.length > 0) {
            conditions.push(`content_type = ANY($${paramIndex})`);
            params.push(contentTypes);
            paramIndex++;
        }
        // Convert query embedding to PostgreSQL vector format
        const queryVector = `[${queryEmbedding.join(',')}]`;
        params.push(queryVector, threshold, limit);
        const query = `
      SELECT 
        id, file_path, content_type, content_text, metadata,
        1 - (embedding <=> $${paramIndex}::vector) as similarity_score
      FROM code_embeddings 
      WHERE ${conditions.join(' AND ')}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $${paramIndex}::vector) >= $${paramIndex + 1}
      ORDER BY embedding <=> $${paramIndex}::vector
      LIMIT $${paramIndex + 2}
    `;
        try {
            const result = await this.pool.query(query, params);
            return result.rows;
        }
        catch (error) {
            console.error('Error performing similarity search:', error);
            throw error;
        }
    }
}
exports.ToolDatabaseAPI = ToolDatabaseAPI;
// Initialize database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'codemind',
    user: process.env.DB_USER || 'codemind',
    password: process.env.DB_PASSWORD || 'codemind123'
};
const toolDB = new ToolDatabaseAPI(dbConfig);
exports.toolDB = toolDB;
// ============================================
// REST API ENDPOINTS
// ============================================
// GET /api/tools/:projectId/:toolName - Read tool data
router.get('/:projectId/:toolName', async (req, res) => {
    try {
        const { projectId, toolName } = req.params;
        const filters = req.query;
        const data = await toolDB.getToolData(projectId, toolName, filters);
        res.json(data);
    }
    catch (error) {
        console.error(`Error getting ${req.params.toolName} data:`, error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/tools/:projectId/:toolName - Write tool data
router.post('/:projectId/:toolName', async (req, res) => {
    try {
        const { projectId, toolName } = req.params;
        const data = req.body;
        const result = await toolDB.saveToolData(projectId, toolName, data);
        res.json(result);
    }
    catch (error) {
        console.error(`Error saving ${req.params.toolName} data:`, error);
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/tools/:projectId/:toolName - Update tool data
router.put('/:projectId/:toolName', async (req, res) => {
    try {
        const { projectId, toolName } = req.params;
        const data = req.body;
        const result = await toolDB.saveToolData(projectId, toolName, data);
        res.json(result);
    }
    catch (error) {
        console.error(`Error updating ${req.params.toolName} data:`, error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/tools/:projectId/:toolName - Clear tool data
router.delete('/:projectId/:toolName', async (req, res) => {
    try {
        const { projectId, toolName } = req.params;
        const tableMap = {
            'tree-navigation': 'tree_navigation_data',
            'duplications': 'code_duplications',
            'centralization': 'centralization_opportunities',
            'test-coverage': 'test_coverage_data',
            'compilation': 'compilation_results',
            'solid-analysis': 'solid_violations',
            'ui-components': 'ui_components',
            'documentation': 'documentation_structure',
            'use-cases': 'use_cases',
            'database-analysis': 'database_analysis',
            'patterns': 'detected_patterns',
            'claude-decisions': 'claude_decisions',
            'semantic-search': 'code_embeddings'
        };
        const tableName = tableMap[toolName];
        if (!tableName) {
            return res.status(400).json({ error: `Unknown tool: ${toolName}` });
        }
        await toolDB.query(`DELETE FROM ${tableName} WHERE project_id = $1`, [projectId]);
        res.json({ success: true, message: `Cleared ${toolName} data for project ${projectId}` });
    }
    catch (error) {
        console.error(`Error clearing ${req.params.toolName} data:`, error);
        res.status(500).json({ error: error.message });
    }
});
// Special endpoint for semantic similarity search
router.post('/:projectId/semantic-search/search', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { query, queryEmbedding, contentTypes, threshold, limit } = req.body;
        if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
            return res.status(400).json({ error: 'queryEmbedding array is required' });
        }
        const results = await toolDB.searchSimilarCode(projectId, queryEmbedding, {
            contentTypes,
            threshold: threshold || 0.7,
            limit: limit || 10
        });
        res.json({
            query,
            projectId,
            results,
            count: results.length
        });
    }
    catch (error) {
        console.error('Error performing semantic search:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=tool-database-api.js.map