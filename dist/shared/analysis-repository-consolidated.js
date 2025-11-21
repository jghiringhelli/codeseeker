"use strict";
/**
 * Consolidated Analysis Repository - Unified data access for all analysis results
 * Replaces the tool-based architecture with a single, centralized approach
 *
 * This repository provides CRUD operations for all analysis data using the
 * consolidated schema with the unified analysis_results table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisRepository = exports.ConsolidatedAnalysisRepository = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
class ConsolidatedAnalysisRepository {
    pool;
    logger;
    initialized = false;
    constructor() {
        this.logger = logger_1.Logger.getInstance().child('ConsolidatedAnalysisRepository');
        this.pool = new pg_1.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123'
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Test connection
            await this.pool.query('SELECT 1');
            this.initialized = true;
            this.logger.info('ConsolidatedAnalysisRepository initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize database connection:', error);
            throw new Error(`Failed to initialize database connection: ${error}`);
        }
    }
    async close() {
        await this.pool.end();
        this.initialized = false;
    }
    async query(text, params) {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.pool.query(text, params);
    }
    // ============================================
    // CONSOLIDATED ANALYSIS RESULTS OPERATIONS
    // ============================================
    /**
     * Save analysis results to the unified analysis_results table
     */
    async saveAnalysis(analysis) {
        try {
            const query = `
        INSERT INTO analysis_results (
          project_id, file_path, file_hash, analysis_type, analysis_subtype,
          analysis_result, confidence_score, severity, status, metadata, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (project_id, file_path, file_hash, analysis_type)
        DO UPDATE SET
          analysis_result = EXCLUDED.analysis_result,
          confidence_score = EXCLUDED.confidence_score,
          severity = EXCLUDED.severity,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          tags = EXCLUDED.tags,
          updated_at = NOW()
        RETURNING *
      `;
            const result = await this.query(query, [
                analysis.project_id,
                analysis.file_path,
                analysis.file_hash,
                analysis.analysis_type,
                analysis.analysis_subtype || null,
                JSON.stringify(analysis.analysis_result),
                analysis.confidence_score || null,
                analysis.severity || 'info',
                analysis.status || 'detected',
                JSON.stringify(analysis.metadata || {}),
                analysis.tags || []
            ]);
            this.logger.debug(`Saved ${analysis.analysis_type} analysis for ${analysis.file_path}`);
            return result.rows[0];
        }
        catch (error) {
            this.logger.error(`Error saving ${analysis.analysis_type} analysis:`, error);
            throw error;
        }
    }
    /**
     * Save multiple analysis results in a single transaction
     */
    async saveMultipleAnalyses(analyses) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const analysis of analyses) {
                const query = `
          INSERT INTO analysis_results (
            project_id, file_path, file_hash, analysis_type, analysis_subtype,
            analysis_result, confidence_score, severity, status, metadata, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (project_id, file_path, file_hash, analysis_type)
          DO UPDATE SET
            analysis_result = EXCLUDED.analysis_result,
            confidence_score = EXCLUDED.confidence_score,
            updated_at = NOW()
          RETURNING *
        `;
                const result = await client.query(query, [
                    analysis.project_id,
                    analysis.file_path,
                    analysis.file_hash,
                    analysis.analysis_type,
                    analysis.analysis_subtype || null,
                    JSON.stringify(analysis.analysis_result),
                    analysis.confidence_score || null,
                    analysis.severity || 'info',
                    analysis.status || 'detected',
                    JSON.stringify(analysis.metadata || {}),
                    analysis.tags || []
                ]);
                results.push(result.rows[0]);
            }
            await client.query('COMMIT');
            this.logger.info(`Saved ${analyses.length} analysis results in transaction`);
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('Error saving multiple analyses:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get analysis results with flexible filtering
     */
    async getAnalysis(projectId, filters = {}) {
        try {
            let query = 'SELECT * FROM analysis_results WHERE project_id = $1';
            const params = [projectId];
            let paramIndex = 2;
            // Apply filters
            if (filters.analysis_type) {
                query += ` AND analysis_type = $${paramIndex}`;
                params.push(filters.analysis_type);
                paramIndex++;
            }
            if (filters.analysis_subtype) {
                query += ` AND analysis_subtype = $${paramIndex}`;
                params.push(filters.analysis_subtype);
                paramIndex++;
            }
            if (filters.file_path) {
                query += ` AND file_path ILIKE $${paramIndex}`;
                params.push(`%${filters.file_path}%`);
                paramIndex++;
            }
            if (filters.severity) {
                query += ` AND severity = $${paramIndex}`;
                params.push(filters.severity);
                paramIndex++;
            }
            if (filters.status) {
                query += ` AND status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }
            if (filters.confidence_threshold) {
                query += ` AND confidence_score >= $${paramIndex}`;
                params.push(String(filters.confidence_threshold));
                paramIndex++;
            }
            if (filters.tags && filters.tags.length > 0) {
                query += ` AND tags @> $${paramIndex}`;
                params.push(JSON.stringify(filters.tags));
                paramIndex++;
            }
            // Order by
            const orderBy = filters.order_by || 'created_at';
            const direction = filters.order_direction || 'DESC';
            query += ` ORDER BY ${orderBy} ${direction}`;
            // Limit and offset
            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(String(filters.limit));
                paramIndex++;
            }
            if (filters.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(String(filters.offset));
                paramIndex++;
            }
            const result = await this.query(query, params);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Error getting analysis results:', error);
            throw error;
        }
    }
    /**
     * Get analysis by specific type and file
     */
    async getAnalysisByType(projectId, analysisType, filePath) {
        const filters = {
            analysis_type: analysisType,
            file_path: filePath
        };
        return this.getAnalysis(projectId, filters);
    }
    /**
     * Delete analysis results
     */
    async deleteAnalysis(projectId, analysisType, filePath) {
        try {
            let query = 'DELETE FROM analysis_results WHERE project_id = $1';
            const params = [projectId];
            let paramIndex = 2;
            if (analysisType) {
                query += ` AND analysis_type = $${paramIndex}`;
                params.push(analysisType);
                paramIndex++;
            }
            if (filePath) {
                query += ` AND file_path = $${paramIndex}`;
                params.push(filePath);
                paramIndex++;
            }
            const result = await this.query(query, params);
            this.logger.info(`Deleted ${result.rowCount} analysis results`);
            return result.rowCount;
        }
        catch (error) {
            this.logger.error('Error deleting analysis results:', error);
            throw error;
        }
    }
    // ============================================
    // SEMANTIC SEARCH EMBEDDINGS OPERATIONS
    // ============================================
    /**
     * Save semantic search embeddings
     */
    async saveEmbedding(embedding) {
        try {
            const query = `
        INSERT INTO semantic_search_embeddings (
          project_id, file_path, chunk_index, content_type, content_text,
          content_hash, embedding, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
        ON CONFLICT (project_id, file_path, chunk_index, content_hash)
        DO UPDATE SET
          content_text = EXCLUDED.content_text,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `;
            const embeddingVector = embedding.embedding ?
                `[${embedding.embedding.join(',')}]` : null;
            const result = await this.query(query, [
                embedding.project_id,
                embedding.file_path,
                embedding.chunk_index || 0,
                embedding.content_type,
                embedding.content_text,
                embedding.content_hash,
                embeddingVector,
                JSON.stringify(embedding.metadata || {})
            ]);
            return result.rows[0];
        }
        catch (error) {
            this.logger.error('Error saving embedding:', error);
            throw error;
        }
    }
    /**
     * Save multiple embeddings in a transaction
     */
    async saveMultipleEmbeddings(embeddings) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (const embedding of embeddings) {
                const query = `
          INSERT INTO semantic_search_embeddings (
            project_id, file_path, chunk_index, content_type, content_text,
            content_hash, embedding, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
          ON CONFLICT (project_id, file_path, chunk_index, content_hash)
          DO UPDATE SET
            content_text = EXCLUDED.content_text,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
          RETURNING *
        `;
                const embeddingVector = embedding.embedding ?
                    `[${embedding.embedding.join(',')}]` : null;
                const result = await client.query(query, [
                    embedding.project_id,
                    embedding.file_path,
                    embedding.chunk_index || 0,
                    embedding.content_type,
                    embedding.content_text,
                    embedding.content_hash,
                    embeddingVector,
                    JSON.stringify(embedding.metadata || {})
                ]);
                results.push(result.rows[0]);
            }
            await client.query('COMMIT');
            this.logger.info(`Saved ${embeddings.length} embeddings in transaction`);
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('Error saving multiple embeddings:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Perform semantic similarity search
     */
    async searchSimilarCode(projectId, queryEmbedding, options = {}) {
        const { contentTypes, threshold = 0.7, limit = 10 } = options;
        try {
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
        FROM semantic_search_embeddings
        WHERE ${conditions.join(' AND ')}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $${paramIndex}::vector) >= $${paramIndex + 1}
        ORDER BY embedding <=> $${paramIndex}::vector
        LIMIT $${paramIndex + 2}
      `;
            const result = await this.query(query, params);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Error performing similarity search:', error);
            throw error;
        }
    }
    /**
     * Get embeddings by filters
     */
    async getEmbeddings(projectId, filters = {}) {
        try {
            let query = 'SELECT * FROM semantic_search_embeddings WHERE project_id = $1';
            const params = [projectId];
            let paramIndex = 2;
            if (filters.content_type) {
                query += ` AND content_type = $${paramIndex}`;
                params.push(filters.content_type);
                paramIndex++;
            }
            if (filters.file_path) {
                query += ` AND file_path ILIKE $${paramIndex}`;
                params.push(`%${filters.file_path}%`);
                paramIndex++;
            }
            query += ' ORDER BY created_at DESC';
            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(String(filters.limit));
                paramIndex++;
            }
            if (filters.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(String(filters.offset));
                paramIndex++;
            }
            const result = await this.query(query, params);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Error getting embeddings:', error);
            throw error;
        }
    }
    /**
     * Delete embeddings
     */
    async deleteEmbeddings(projectId, filePath) {
        try {
            let query = 'DELETE FROM semantic_search_embeddings WHERE project_id = $1';
            const params = [projectId];
            if (filePath) {
                query += ' AND file_path = $2';
                params.push(filePath);
            }
            const result = await this.query(query, params);
            this.logger.info(`Deleted ${result.rowCount} embeddings`);
            return result.rowCount;
        }
        catch (error) {
            this.logger.error('Error deleting embeddings:', error);
            throw error;
        }
    }
    // ============================================
    // MIGRATION UTILITIES
    // ============================================
    /**
     * Migrate tool-specific data to consolidated format
     */
    async migrateToolData(projectId, toolName, toolData, analysisType) {
        this.logger.info(`Migrating ${toolName} data to consolidated format`);
        const analyses = toolData.map(data => ({
            project_id: projectId,
            file_path: data.file_path || 'unknown',
            file_hash: data.file_hash || data.content_hash || 'migrated',
            analysis_type: analysisType,
            analysis_subtype: data.analysis_subtype || toolName,
            analysis_result: data,
            confidence_score: data.confidence_score || data.similarity_score,
            severity: data.severity || data.priority || 'info',
            status: data.status || 'detected',
            metadata: {
                migrated_from: toolName,
                migration_date: new Date().toISOString(),
                original_data: data
            }
        }));
        await this.saveMultipleAnalyses(analyses);
        this.logger.info(`Successfully migrated ${analyses.length} ${toolName} records`);
    }
    // ============================================
    // ANALYTICS AND REPORTING
    // ============================================
    /**
     * Get analysis summary for a project
     */
    async getAnalysisSummary(projectId) {
        try {
            const query = `
        SELECT
          analysis_type,
          COUNT(*) as total_count,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN severity = 'major' THEN 1 END) as major_count,
          COUNT(CASE WHEN status = 'fixed' THEN 1 END) as fixed_count,
          AVG(confidence_score) as avg_confidence,
          MAX(updated_at) as last_update
        FROM analysis_results
        WHERE project_id = $1
        GROUP BY analysis_type
        ORDER BY total_count DESC
      `;
            const result = await this.query(query, [projectId]);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Error getting analysis summary:', error);
            throw error;
        }
    }
    /**
     * Get projects from the database
     */
    async getProjects(filters = {}) {
        try {
            let whereClause = '';
            const params = [];
            let paramIndex = 1;
            if (filters.projectPath) {
                whereClause += whereClause ? ' AND ' : ' WHERE ';
                whereClause += `project_path = $${paramIndex}`;
                params.push(filters.projectPath);
                paramIndex++;
            }
            if (filters.project_name) {
                whereClause += whereClause ? ' AND ' : ' WHERE ';
                whereClause += `project_name = $${paramIndex}`;
                params.push(filters.project_name);
                paramIndex++;
            }
            if (filters.status) {
                whereClause += whereClause ? ' AND ' : ' WHERE ';
                whereClause += `status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }
            const limitClause = filters.limit ? ` LIMIT ${filters.limit}` : '';
            const query = `
        SELECT *
        FROM projects
        ${whereClause}
        ORDER BY updated_at DESC
        ${limitClause}
      `;
            const result = await this.query(query, params);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Error getting projects:', error);
            throw error;
        }
    }
}
exports.ConsolidatedAnalysisRepository = ConsolidatedAnalysisRepository;
// Export singleton instance
exports.analysisRepository = new ConsolidatedAnalysisRepository();
//# sourceMappingURL=analysis-repository-consolidated.js.map