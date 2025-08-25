"use strict";
/**
 * Database Manager for the Intelligent Code Auxiliary System
 * Handles SQLite database operations, migrations, and data access
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = require("fs");
const path_1 = require("path");
const types_1 = require("../core/types");
class DatabaseManager {
    db = null;
    logger;
    dbPath;
    constructor(dbPath = ':memory:', logger) {
        this.dbPath = dbPath;
        this.logger = logger || console;
    }
    async initialize() {
        try {
            this.logger.info('Initializing database', { path: this.dbPath });
            this.db = new better_sqlite3_1.default(this.dbPath);
            // Enable foreign key constraints and other pragmas
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('journal_mode = WAL'); // Better for concurrent access
            this.db.pragma('synchronous = NORMAL'); // Balance performance and durability
            // Run initial migration
            await this.migrate();
            this.logger.info('Database initialized successfully');
        }
        catch (error) {
            const dbError = {
                code: types_1.ErrorCode.DATABASE_ERROR,
                message: 'Failed to initialize database',
                details: { dbPath: this.dbPath },
                timestamp: new Date(),
                stack: error instanceof Error ? error.stack : undefined
            };
            this.logger.error('Database initialization failed', error, dbError.details);
            throw dbError;
        }
    }
    async close() {
        if (this.db) {
            this.logger.info('Closing database connection');
            this.db.close();
            this.db = null;
        }
    }
    async migrate() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        try {
            this.logger.info('Running database migrations');
            // Read and execute schema (use simple schema for now)
            const schemaPath = (0, path_1.join)(__dirname, 'schema-simple.sql');
            const schemaSql = (0, fs_1.readFileSync)(schemaPath, 'utf8');
            // Execute the entire schema at once - SQLite can handle multiple statements
            this.db.exec(schemaSql);
            this.logger.info('Database migrations completed successfully');
        }
        catch (error) {
            const migrationError = {
                code: types_1.ErrorCode.DATABASE_ERROR,
                message: 'Database migration failed',
                details: { error: error instanceof Error ? error.message : String(error) },
                timestamp: new Date()
            };
            this.logger.error('Database migration failed', error);
            throw migrationError;
        }
    }
    // ============================================
    // INITIALIZATION PROGRESS METHODS
    // ============================================
    async saveInitializationProgress(progress) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        INSERT INTO initialization_progress 
        (project_path, phase, resume_token, progress_data, tech_stack_data)
        VALUES (?, ?, ?, ?, ?)
      `);
            const result = stmt.run(progress.projectPath, progress.phase, progress.resumeToken, JSON.stringify(progress.progressData), progress.techStackData ? JSON.stringify(progress.techStackData) : null);
            return {
                ...progress,
                id: result.lastInsertRowid,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to save initialization progress', error);
            throw this.createDatabaseError('Failed to save initialization progress', error);
        }
    }
    async getInitializationProgress(projectPath) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM initialization_progress 
        WHERE project_path = ?
      `);
            const row = stmt.get(projectPath);
            if (!row)
                return null;
            return {
                id: row.id,
                projectPath: row.project_path,
                phase: row.phase,
                resumeToken: row.resume_token,
                progressData: JSON.parse(row.progress_data),
                techStackData: row.tech_stack_data ? JSON.parse(row.tech_stack_data) : undefined,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            };
        }
        catch (error) {
            this.logger.error('Failed to get initialization progress', error);
            throw this.createDatabaseError('Failed to get initialization progress', error);
        }
    }
    async updateInitializationProgress(progress) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        UPDATE initialization_progress 
        SET phase = ?, resume_token = ?, progress_data = ?, tech_stack_data = ?
        WHERE project_path = ?
      `);
            const result = stmt.run(progress.phase, progress.resumeToken, JSON.stringify(progress.progressData), progress.techStackData ? JSON.stringify(progress.techStackData) : null, progress.projectPath);
            if (result.changes === 0) {
                throw new Error(`No initialization progress found for project: ${progress.projectPath}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to update initialization progress', error);
            throw this.createDatabaseError('Failed to update initialization progress', error);
        }
    }
    async deleteInitializationProgress(projectPath) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        DELETE FROM initialization_progress WHERE project_path = ?
      `);
            stmt.run(projectPath);
        }
        catch (error) {
            this.logger.error('Failed to delete initialization progress', error);
            throw this.createDatabaseError('Failed to delete initialization progress', error);
        }
    }
    // ============================================
    // DETECTED PATTERNS METHODS
    // ============================================
    async saveDetectedPattern(pattern) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        INSERT INTO detected_patterns 
        (project_path, pattern_type, pattern_name, confidence_score, evidence)
        VALUES (?, ?, ?, ?, ?)
      `);
            const result = stmt.run(pattern.projectPath, pattern.patternType, pattern.patternName, pattern.confidence, JSON.stringify(pattern.evidence));
            return {
                ...pattern,
                id: result.lastInsertRowid,
                createdAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to save detected pattern', error);
            throw this.createDatabaseError('Failed to save detected pattern', error);
        }
    }
    async getDetectedPatterns(projectPath) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM detected_patterns 
        WHERE project_path = ?
        ORDER BY confidence_score DESC, created_at DESC
      `);
            const rows = stmt.all(projectPath);
            return rows.map(row => ({
                id: row.id,
                projectPath: row.project_path,
                patternType: row.pattern_type,
                patternName: row.pattern_name,
                confidence: row.confidence_score,
                evidence: JSON.parse(row.evidence),
                createdAt: new Date(row.created_at)
            }));
        }
        catch (error) {
            this.logger.error('Failed to get detected patterns', error);
            throw this.createDatabaseError('Failed to get detected patterns', error);
        }
    }
    async deleteDetectedPatterns(projectPath) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        DELETE FROM detected_patterns WHERE project_path = ?
      `);
            stmt.run(projectPath);
        }
        catch (error) {
            this.logger.error('Failed to delete detected patterns', error);
            throw this.createDatabaseError('Failed to delete detected patterns', error);
        }
    }
    // ============================================
    // QUESTIONNAIRE RESPONSES METHODS
    // ============================================
    async saveQuestionnaireResponse(response) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        INSERT INTO questionnaire_responses 
        (project_path, category, question_id, response, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
            const result = stmt.run(response.projectPath, response.category, response.questionId, response.response, response.metadata ? JSON.stringify(response.metadata) : null);
            return {
                ...response,
                id: result.lastInsertRowid,
                createdAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to save questionnaire response', error);
            throw this.createDatabaseError('Failed to save questionnaire response', error);
        }
    }
    async getQuestionnaireResponses(projectPath) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM questionnaire_responses 
        WHERE project_path = ?
        ORDER BY category, created_at
      `);
            const rows = stmt.all(projectPath);
            return rows.map(row => ({
                id: row.id,
                projectPath: row.project_path,
                category: row.category,
                questionId: row.question_id,
                response: row.response,
                metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                createdAt: new Date(row.created_at)
            }));
        }
        catch (error) {
            this.logger.error('Failed to get questionnaire responses', error);
            throw this.createDatabaseError('Failed to get questionnaire responses', error);
        }
    }
    // ============================================
    // ANALYSIS RESULTS METHODS
    // ============================================
    async saveAnalysisResult(result) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(`
        INSERT INTO analysis_results 
        (project_path, file_path, file_hash, analysis_type, analysis_result, confidence_score)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            const insertResult = stmt.run(result.projectPath, result.filePath, result.fileHash, result.analysisType, JSON.stringify(result.result), result.confidenceScore || null);
            return {
                ...result,
                id: insertResult.lastInsertRowid,
                createdAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to save analysis result', error);
            throw this.createDatabaseError('Failed to save analysis result', error);
        }
    }
    async getAnalysisResults(projectPath, analysisType) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            let query = `
        SELECT * FROM analysis_results 
        WHERE project_path = ?
      `;
            const params = [projectPath];
            if (analysisType) {
                query += ' AND analysis_type = ?';
                params.push(analysisType);
            }
            query += ' ORDER BY created_at DESC';
            const stmt = this.db.prepare(query);
            const rows = stmt.all(...params);
            return rows.map(row => ({
                id: row.id,
                projectPath: row.project_path,
                filePath: row.file_path,
                fileHash: row.file_hash,
                analysisType: row.analysis_type,
                result: JSON.parse(row.analysis_result),
                confidenceScore: row.confidence_score,
                createdAt: new Date(row.created_at)
            }));
        }
        catch (error) {
            this.logger.error('Failed to get analysis results', error);
            throw this.createDatabaseError('Failed to get analysis results', error);
        }
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    createDatabaseError(message, originalError) {
        return {
            code: types_1.ErrorCode.DATABASE_ERROR,
            message,
            details: {
                originalError: originalError instanceof Error ? originalError.message : String(originalError)
            },
            timestamp: new Date(),
            stack: originalError instanceof Error ? originalError.stack : undefined
        };
    }
    // Method for executing custom queries (useful for testing and advanced operations)
    async executeQuery(query, params = []) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stmt = this.db.prepare(query);
            return stmt.all(...params);
        }
        catch (error) {
            this.logger.error('Failed to execute custom query', error, { query });
            throw this.createDatabaseError('Failed to execute query', error);
        }
    }
    // Get database statistics for monitoring
    async getDatabaseStats() {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            const stats = {};
            // Count records in each table
            const tables = [
                'initialization_progress',
                'detected_patterns',
                'questionnaire_responses',
                'analysis_results',
                'project_metadata',
                'resume_state',
                'system_config',
                'operation_metrics'
            ];
            for (const table of tables) {
                const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
                const result = stmt.get();
                stats[table] = result.count;
            }
            return stats;
        }
        catch (error) {
            this.logger.error('Failed to get database stats', error);
            throw this.createDatabaseError('Failed to get database stats', error);
        }
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=manager.js.map