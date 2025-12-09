"use strict";
/**
 * PostgreSQL database adapter for CodeMind
 * Production-ready adapter with connection pooling and transactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLAdapter = void 0;
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = require("path");
const base_1 = require("./base");
const types_1 = require("../../core/types");
class PostgreSQLAdapter extends base_1.DatabaseAdapter {
    pool = null;
    constructor(config, logger) {
        super(config, logger);
    }
    async initialize() {
        try {
            this.logger.debug('Initializing PostgreSQL connection', {
                host: this.config.host,
                database: this.config.database,
                port: this.config.port
            });
            // Create connection pool
            this.pool = new pg_1.Pool({
                connectionString: this.config.connectionString,
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.username,
                password: this.config.password,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
                max: 20, // Maximum number of clients in pool
                idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
                connectionTimeoutMillis: 2000, // Return error after 2 seconds if unable to connect
            });
            // Test connection
            const client = await this.pool?.connect();
            await client?.query('SELECT NOW()');
            client?.release();
            this.logger.debug('PostgreSQL connection established');
            // Run migrations
            await this?.migrate();
        }
        catch (error) {
            const dbError = this?.handleError('initialization', error);
            throw new Error(dbError.message);
        }
    }
    async close() {
        if (this.pool) {
            this.logger.debug('Closing PostgreSQL connection pool');
            await this.pool?.end();
            this.pool = null;
        }
    }
    async migrate() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        try {
            this.logger.debug('Running PostgreSQL migrations');
            // Try multiple possible paths for the schema file
            const possiblePaths = [
                (0, path_1.join)(__dirname, '../../src/database/schema.postgres.sql'), // Docker path
                (0, path_1.join)(__dirname, '../schema.postgres.sql'), // Local compiled path
                (0, path_1.join)(process?.cwd(), 'src/database/schema.postgres.sql'), // From project root
            ];
            let schemaSql = '';
            let schemaFound = false;
            for (const schemaPath of possiblePaths) {
                try {
                    schemaSql = (0, fs_1.readFileSync)(schemaPath, 'utf8');
                    schemaFound = true;
                    this.logger.debug(`Found schema file at: ${schemaPath}`);
                    break;
                }
                catch (error) {
                    // Try next path
                    continue;
                }
            }
            if (!schemaFound) {
                throw new Error(`Schema file not found. Tried paths: ${possiblePaths?.join(', ')}`);
            }
            const client = await this.pool?.connect();
            try {
                // Try to run schema - if it fails because objects already exist, that's OK
                try {
                    await client?.query(schemaSql);
                    this.logger.debug('PostgreSQL migrations completed');
                }
                catch (migrationError) {
                    // Check if the error is just about existing objects
                    const errorMessage = migrationError.message;
                    if (errorMessage?.includes('already exists') || errorMessage?.includes('does not exist')) {
                        this.logger.debug('PostgreSQL schema already exists');
                    }
                    else {
                        // Re-throw if it's a different error
                        throw migrationError;
                    }
                }
            }
            finally {
                client?.release();
            }
        }
        catch (error) {
            throw this?.handleError('migration', error);
        }
    }
    async isHealthy() {
        if (!this.pool)
            return false;
        try {
            const client = await this.pool?.connect();
            await client?.query('SELECT 1');
            client?.release();
            return true;
        }
        catch {
            return false;
        }
    }
    // Project management
    async createProject(projectData) {
        if (!this.pool)
            throw new Error('Database not initialized');
        const client = await this.pool?.connect();
        try {
            await client?.query('BEGIN');
            // Create project
            const projectResult = await client?.query(`
        INSERT INTO projects (
          project_path, project_name, project_type, languages, frameworks,
          project_size, domain, total_files, total_lines, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
                projectData.projectPath,
                projectData.projectName,
                projectData.projectType,
                JSON.stringify(projectData.languages),
                JSON.stringify(projectData.frameworks),
                projectData.projectSize,
                projectData.domain,
                projectData.totalFiles,
                projectData.totalLines,
                projectData.status,
                JSON.stringify(projectData.metadata)
            ]);
            const project = this?.mapRowToProject(projectResult.rows[0]);
            // Create primary path entry
            await client?.query(`
        INSERT INTO project_paths (project_id, path, path_type, is_active)
        VALUES ($1, $2, 'primary', true)
      `, [project.id, project.projectPath]);
            await client?.query('COMMIT');
            return project;
        }
        catch (error) {
            await client?.query('ROLLBACK');
            throw this?.handleError('createProject', error);
        }
        finally {
            client?.release();
        }
    }
    async getProject(projectPath) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        SELECT DISTINCT p.* FROM projects p
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
        LIMIT 1
      `, [projectPath]);
            return result.rows?.length > 0 ? this?.mapRowToProject(result.rows[0]) : null;
        }
        catch (error) {
            throw this?.handleError('getProject', error);
        }
    }
    async getProjectById(id) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query('SELECT * FROM projects WHERE id = $1', [id]);
            return result.rows?.length > 0 ? this?.mapRowToProject(result.rows[0]) : null;
        }
        catch (error) {
            throw this?.handleError('getProjectById', error);
        }
    }
    async updateProject(id, updates) {
        if (!this.pool)
            throw new Error('Database not initialized');
        const fields = [];
        const values = [];
        let paramCount = 1;
        Object.entries(updates)?.forEach(([key, value]) => {
            if (key === 'id' || key === 'createdAt')
                return;
            let dbColumn = this?.mapFieldToColumn(key);
            if (key === 'languages' || key === 'frameworks' || key === 'metadata') {
                fields?.push(`${dbColumn} = $${paramCount}`);
                values?.push(JSON.stringify(value));
            }
            else {
                fields?.push(`${dbColumn} = $${paramCount}`);
                values?.push(value);
            }
            paramCount++;
        });
        if (fields?.length === 0) {
            return this?.getProjectById(id);
        }
        values?.push(id);
        try {
            const result = await this.pool?.query(`
        UPDATE projects SET ${fields?.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `, values);
            if (result.rows?.length === 0) {
                throw new Error(`Project with id ${id} not found`);
            }
            return this?.mapRowToProject(result.rows[0]);
        }
        catch (error) {
            throw this?.handleError('updateProject', error);
        }
    }
    async deleteProject(id) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query('DELETE FROM projects WHERE id = $1', [id]);
            if (result?.rowCount === 0) {
                throw new Error(`Project with id ${id} not found`);
            }
        }
        catch (error) {
            throw this?.handleError('deleteProject', error);
        }
    }
    async listProjects(status = 'active', limit = 50, offset = 0) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        SELECT * FROM projects 
        WHERE status = $1 
        ORDER BY updated_at DESC 
        LIMIT $2 OFFSET $3
      `, [status, limit, offset]);
            return result.rows?.map(row => this?.mapRowToProject(row));
        }
        catch (error) {
            throw this?.handleError('listProjects', error);
        }
    }
    // Project path management
    async addProjectPath(projectId, path, pathType) {
        if (!this.pool)
            throw new Error('Database not initialized');
        const client = await this.pool?.connect();
        try {
            await client?.query('BEGIN');
            // If setting as primary, deactivate current primary
            if (pathType === 'primary') {
                await client?.query(`
          UPDATE project_paths 
          SET is_active = false, deactivated_at = NOW() 
          WHERE project_id = $1 AND path_type = 'primary' AND is_active = true
        `, [projectId]);
            }
            const result = await client?.query(`
        INSERT INTO project_paths (project_id, path, path_type, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [projectId, path, pathType, pathType === 'primary']);
            await client?.query('COMMIT');
            return this?.mapRowToProjectPath(result.rows[0]);
        }
        catch (error) {
            await client?.query('ROLLBACK');
            throw this?.handleError('addProjectPath', error);
        }
        finally {
            client?.release();
        }
    }
    async updateProjectPath(projectId, oldPath, newPath) {
        if (!this.pool)
            throw new Error('Database not initialized');
        const client = await this.pool?.connect();
        try {
            await client?.query('BEGIN');
            // Mark old path as historical
            await client?.query(`
        UPDATE project_paths 
        SET path_type = 'historical', is_active = false, deactivated_at = NOW()
        WHERE project_id = $1 AND path = $2
      `, [projectId, oldPath]);
            // Add new primary path
            await client?.query(`
        INSERT INTO project_paths (project_id, path, path_type, is_active)
        VALUES ($1, $2, 'primary', true)
      `, [projectId, newPath]);
            // Update project table
            await client?.query(`
        UPDATE projects SET project_path = $1, updated_at = NOW()
        WHERE id = $2
      `, [newPath, projectId]);
            await client?.query('COMMIT');
        }
        catch (error) {
            await client?.query('ROLLBACK');
            throw this?.handleError('updateProjectPath', error);
        }
        finally {
            client?.release();
        }
    }
    async deactivateProjectPath(projectId, path) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            await this.pool?.query(`
        UPDATE project_paths 
        SET is_active = false, deactivated_at = NOW()
        WHERE project_id = $1 AND path = $2
      `, [projectId, path]);
        }
        catch (error) {
            throw this?.handleError('deactivateProjectPath', error);
        }
    }
    async getProjectByAnyPath(path) {
        return this?.getProject(path); // Same implementation for now
    }
    async getProjectPaths(projectId) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        SELECT * FROM project_paths 
        WHERE project_id = $1 
        ORDER BY created_at DESC
      `, [projectId]);
            return result.rows?.map(row => this?.mapRowToProjectPath(row));
        }
        catch (error) {
            throw this?.handleError('getProjectPaths', error);
        }
    }
    // Initialization progress - implement all required methods
    async saveInitializationProgress(progress) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            // First get or create project
            let project = await this?.getProject(progress.projectPath);
            if (!project) {
                project = await this?.createProject({
                    projectPath: progress.projectPath,
                    projectName: progress.projectPath?.split('/').pop() || 'Unknown',
                    projectType: types_1.ProjectType.UNKNOWN,
                    languages: [],
                    frameworks: [],
                    totalFiles: 0,
                    totalLines: 0,
                    status: 'analyzing',
                    metadata: {}
                });
            }
            const result = await this.pool?.query(`
        INSERT INTO initialization_progress (
          project_id, phase, resume_token, progress_data, tech_stack_data
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id) DO UPDATE SET
          phase = EXCLUDED.phase,
          resume_token = EXCLUDED.resume_token,
          progress_data = EXCLUDED.progress_data,
          tech_stack_data = EXCLUDED.tech_stack_data,
          updated_at = NOW()
        RETURNING *
      `, [
                project.id,
                progress.phase,
                progress.resumeToken,
                JSON.stringify(progress.progressData),
                progress.techStackData ? JSON.stringify(progress.techStackData) : null
            ]);
            return this?.mapRowToInitializationProgress(result.rows[0], progress.projectPath);
        }
        catch (error) {
            throw this?.handleError('saveInitializationProgress', error);
        }
    }
    async getInitializationProgress(projectPath) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        SELECT ip.* FROM initialization_progress ip
        JOIN projects p ON ip.project_id = p.id
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
        LIMIT 1
      `, [projectPath]);
            return result.rows?.length > 0 ? this?.mapRowToInitializationProgress(result.rows[0], projectPath) : null;
        }
        catch (error) {
            throw this?.handleError('getInitializationProgress', error);
        }
    }
    async updateInitializationProgress(resumeToken, updates) {
        if (!this.pool)
            throw new Error('Database not initialized');
        const fields = [];
        const values = [];
        let paramCount = 1;
        Object.entries(updates)?.forEach(([key, value]) => {
            if (key === 'id' || key === 'createdAt' || key === 'projectPath')
                return;
            if (key === 'progressData' || key === 'techStackData') {
                fields?.push(`${this?.mapFieldToColumn(key)} = $${paramCount}`);
                values?.push(JSON.stringify(value));
            }
            else {
                fields?.push(`${this?.mapFieldToColumn(key)} = $${paramCount}`);
                values?.push(value);
            }
            paramCount++;
        });
        values?.push(resumeToken);
        try {
            const result = await this.pool?.query(`
        UPDATE initialization_progress SET ${fields?.join(', ')}, updated_at = NOW()
        WHERE resume_token = $${paramCount}
        RETURNING *
      `, values);
            if (result.rows?.length === 0) {
                throw new Error(`InitializationProgress with resume token ${resumeToken} not found`);
            }
            // Get project path for the returned object
            const projectResult = await this.pool?.query(`
        SELECT pp.path FROM projects p
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE p.id = $1 AND pp.path_type = 'primary' AND pp.is_active = true
      `, [result.rows?.[0].project_id]);
            const projectPath = projectResult.rows[0]?.path || '';
            return this?.mapRowToInitializationProgress(result.rows[0], projectPath);
        }
        catch (error) {
            throw this?.handleError('updateInitializationProgress', error);
        }
    }
    // Continue implementing other required methods...
    async saveDetectedPattern(pattern) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const project = await this?.getProject(pattern.projectPath);
            if (!project) {
                throw new Error(`Project not found: ${pattern.projectPath}`);
            }
            const result = await this.pool?.query(`
        INSERT INTO detected_patterns (
          project_id, pattern_type, pattern_name, confidence_score, evidence
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
                project.id,
                pattern.patternType,
                pattern.patternName,
                pattern.confidence,
                JSON.stringify(pattern.evidence)
            ]);
            return this?.mapRowToDetectedPattern(result.rows[0], pattern.projectPath);
        }
        catch (error) {
            throw this?.handleError('saveDetectedPattern', error);
        }
    }
    async getDetectedPatterns(projectPath, patternType) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            let query = `
        SELECT dp.* FROM detected_patterns dp
        JOIN projects p ON dp.project_id = p.id
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
      `;
            const params = [projectPath];
            if (patternType) {
                query += ' AND dp.pattern_type = $2';
                params?.push(patternType);
            }
            query += ' ORDER BY dp.confidence_score DESC, dp.created_at DESC';
            const result = await this.pool?.query(query, params);
            return result.rows?.map(row => this?.mapRowToDetectedPattern(row, projectPath));
        }
        catch (error) {
            throw this?.handleError('getDetectedPatterns', error);
        }
    }
    async updatePatternStatus(id, status) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            await this.pool?.query('UPDATE detected_patterns SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
        }
        catch (error) {
            throw this?.handleError('updatePatternStatus', error);
        }
    }
    // Implement remaining methods with similar patterns...
    async saveQuestionnaireResponse(response) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const project = await this?.getProject(response.projectPath);
            if (!project) {
                throw new Error(`Project not found: ${response.projectPath}`);
            }
            const result = await this.pool?.query(`
        INSERT INTO questionnaire_responses (
          project_id, category, question_id, response, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
                project.id,
                response.category,
                response.questionId,
                response.response,
                JSON.stringify(response.metadata || {})
            ]);
            return this?.mapRowToQuestionnaireResponse(result.rows[0], response.projectPath);
        }
        catch (error) {
            throw this?.handleError('saveQuestionnaireResponse', error);
        }
    }
    async getQuestionnaireResponses(projectPath, category) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            let query = `
        SELECT qr.* FROM questionnaire_responses qr
        JOIN projects p ON qr.project_id = p.id
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
      `;
            const params = [projectPath];
            if (category) {
                query += ' AND qr.category = $2';
                params?.push(category);
            }
            const result = await this.pool?.query(query, params);
            return result.rows?.map(row => this?.mapRowToQuestionnaireResponse(row, projectPath));
        }
        catch (error) {
            throw this?.handleError('getQuestionnaireResponses', error);
        }
    }
    async saveAnalysisResult(analysisResult) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const project = await this?.getProject(analysisResult.projectPath);
            if (!project) {
                throw new Error(`Project not found: ${analysisResult.projectPath}`);
            }
            const result = await this.pool?.query(`
        INSERT INTO analysis_results (
          project_id, file_path, file_hash, analysis_type, analysis_result, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
                project.id,
                analysisResult.filePath,
                analysisResult.fileHash,
                analysisResult.analysisType,
                JSON.stringify(analysisResult.result),
                analysisResult.confidenceScore
            ]);
            return this?.mapRowToAnalysisResult(result.rows[0], analysisResult.projectPath);
        }
        catch (error) {
            throw this?.handleError('saveAnalysisResult', error);
        }
    }
    async getAnalysisResults(projectPath, analysisType, fileHash) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            let query = `
        SELECT ar.* FROM analysis_results ar
        JOIN projects p ON ar.project_id = p.id
        JOIN project_paths pp ON p.id = pp.project_id
        WHERE pp.path = $1 AND pp.is_active = true
      `;
            const params = [projectPath];
            let paramCount = 2;
            if (analysisType) {
                query += ` AND ar.analysis_type = $${paramCount}`;
                params?.push(analysisType);
                paramCount++;
            }
            if (fileHash) {
                query += ` AND ar.file_hash = $${paramCount}`;
                params?.push(fileHash);
            }
            const result = await this.pool?.query(query, params);
            return result.rows?.map(row => this?.mapRowToAnalysisResult(row, projectPath));
        }
        catch (error) {
            throw this?.handleError('getAnalysisResults', error);
        }
    }
    async getSystemConfig(key) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query('SELECT config_value FROM system_config WHERE config_key = $1 AND is_global = true', [key]);
            if (result.rows?.length === 0)
                return null;
            return result.rows?.[0].config_value;
        }
        catch (error) {
            throw this?.handleError('getSystemConfig', error);
        }
    }
    async setSystemConfig(key, value, projectId) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            await this.pool?.query(`
        INSERT INTO system_config (config_key, config_value, is_global, project_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (config_key) DO UPDATE SET
          config_value = EXCLUDED.config_value,
          updated_at = NOW()
      `, [key, JSON.stringify(value), !projectId, projectId]);
        }
        catch (error) {
            throw this?.handleError('setSystemConfig', error);
        }
    }
    async getDatabaseStats() {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        SELECT 
          (SELECT COUNT(*) FROM projects) as projects,
          (SELECT COUNT(*) FROM initialization_progress) as initialization_progress,
          (SELECT COUNT(*) FROM detected_patterns) as detected_patterns,
          (SELECT COUNT(*) FROM questionnaire_responses) as questionnaire_responses,
          (SELECT COUNT(*) FROM analysis_results) as analysis_results,
          (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects
      `);
            return {
                projects: parseInt(result.rows?.[0].projects),
                initialization_progress: parseInt(result.rows?.[0].initialization_progress),
                detected_patterns: parseInt(result.rows?.[0].detected_patterns),
                questionnaire_responses: parseInt(result.rows?.[0].questionnaire_responses),
                analysis_results: parseInt(result.rows?.[0].analysis_results),
                active_projects: parseInt(result.rows?.[0].active_projects)
            };
        }
        catch (error) {
            throw this?.handleError('getDatabaseStats', error);
        }
    }
    async recordOperationMetrics(operation, projectId, durationMs, success, error, metadata) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            await this.pool?.query(`
        INSERT INTO operation_metrics (
          operation_type, project_id, duration_ms, success, error_message, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [operation, projectId, durationMs, success, error, JSON.stringify(metadata || {})]);
        }
        catch (error) {
            // Don't throw for metrics recording failures
            this.logger.warn('Failed to record operation metrics', { operation, error });
        }
    }
    async cleanupExpiredResumeStates() {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query('SELECT cleanup_expired_resume_states()');
            return parseInt(result.rows?.[0].cleanup_expired_resume_states);
        }
        catch (error) {
            throw this?.handleError('cleanupExpiredResumeStates', error);
        }
    }
    async archiveOldAnalysisResults(olderThanDays) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(`
        DELETE FROM analysis_results 
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
      `);
            return result.rowCount || 0;
        }
        catch (error) {
            throw this?.handleError('archiveOldAnalysisResults', error);
        }
    }
    // Generic query method for database operations
    async query(sql, params) {
        if (!this.pool)
            throw new Error('Database not initialized');
        try {
            const result = await this.pool?.query(sql, params || []);
            return {
                rows: result.rows || [],
                rowCount: result.rowCount || 0
            };
        }
        catch (error) {
            throw this?.handleError('query', error);
        }
    }
    // Helper mapping methods
    mapRowToProject(row) {
        return {
            id: row.id,
            projectPath: row.project_path,
            projectName: row.project_name,
            projectType: row.project_type,
            languages: row.languages,
            frameworks: row.frameworks,
            projectSize: row.project_size,
            domain: row.domain,
            totalFiles: row.total_files,
            totalLines: row.total_lines,
            status: row.status,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    mapRowToProjectPath(row) {
        return {
            id: row.id,
            projectId: row.project_id,
            path: row.path,
            pathType: row.path_type,
            isActive: row.is_active,
            createdAt: row.created_at,
            deactivatedAt: row.deactivated_at
        };
    }
    mapRowToInitializationProgress(row, projectPath) {
        return {
            id: row.id,
            projectPath: projectPath,
            phase: row.phase,
            resumeToken: row.resume_token,
            progressData: row.progress_data,
            techStackData: row.tech_stack_data,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    mapRowToDetectedPattern(row, projectPath) {
        return {
            id: row.id,
            projectPath: projectPath,
            patternType: row.pattern_type,
            patternName: row.pattern_name,
            confidence: row.confidence_score,
            evidence: row.evidence,
            createdAt: row.created_at
        };
    }
    mapRowToQuestionnaireResponse(row, projectPath) {
        return {
            id: row.id,
            projectPath: projectPath,
            category: row.category,
            questionId: row.question_id,
            response: row.response,
            metadata: row.metadata,
            createdAt: row.created_at
        };
    }
    mapRowToAnalysisResult(row, projectPath) {
        return {
            id: row.id,
            projectPath: projectPath,
            filePath: row.file_path,
            fileHash: row.file_hash,
            analysisType: row.analysis_type,
            result: row.analysis_result,
            confidenceScore: row.confidence_score,
            createdAt: row.created_at
        };
    }
    mapFieldToColumn(field) {
        const fieldMap = {
            'projectPath': 'project_path',
            'projectName': 'project_name',
            'projectType': 'project_type',
            'projectSize': 'project_size',
            'totalFiles': 'total_files',
            'totalLines': 'total_lines',
            'resumeToken': 'resume_token',
            'progressData': 'progress_data',
            'techStackData': 'tech_stack_data',
            'patternType': 'pattern_type',
            'patternName': 'pattern_name',
            'confidenceScore': 'confidence_score',
            'questionId': 'question_id',
            'filePath': 'file_path',
            'fileHash': 'file_hash',
            'analysisType': 'analysis_type',
            'analysisResult': 'analysis_result'
        };
        return fieldMap[field] || field;
    }
}
exports.PostgreSQLAdapter = PostgreSQLAdapter;
//# sourceMappingURL=postgresql.js.map