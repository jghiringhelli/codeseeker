"use strict";
/**
 * Database Schema Manager
 * Manages database schema creation, validation, and migration
 * Single Responsibility: Database schema lifecycle management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSchemaManager = void 0;
const pg_1 = require("pg");
const logger_1 = require("../../utils/logger");
const theme_1 = require("../ui/theme");
class DatabaseSchemaManager {
    connections;
    logger;
    pool;
    schemaVersion = '1.0.0';
    constructor(connections) {
        this.connections = connections;
        this.logger = logger_1.Logger.getInstance();
        // Initialize pool with connection config
        this.pool = new pg_1.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
            connectionTimeoutMillis: 5000,
            query_timeout: 10000
        });
    }
    /**
     * Get all table definitions for CodeMind
     */
    getTableDefinitions() {
        return [
            {
                name: 'projects',
                required: true,
                createSQL: `
          CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_name VARCHAR(255) NOT NULL,
            project_path TEXT NOT NULL UNIQUE,
            description TEXT,
            status VARCHAR(50) DEFAULT 'active',
            languages JSONB DEFAULT '[]'::jsonb,
            frameworks JSONB DEFAULT '[]'::jsonb,
            project_type VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
                    'CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path)'
                ]
            },
            {
                name: 'semantic_search_embeddings',
                required: true,
                createSQL: `
          CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            content TEXT,
            content_hash VARCHAR(64),
            embedding VECTOR(384),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, file_path)
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_embeddings_project ON semantic_search_embeddings(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON semantic_search_embeddings(content_hash)',
                    // Vector similarity search index (requires vector extension)
                    `CREATE INDEX IF NOT EXISTS idx_embeddings_vector
           ON semantic_search_embeddings
           USING ivfflat (embedding vector_cosine_ops)
           WITH (lists = 100)`
                ]
            },
            {
                name: 'analysis_results',
                required: true,
                createSQL: `
          CREATE TABLE IF NOT EXISTS analysis_results (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            tool_name VARCHAR(100) NOT NULL,
            file_path TEXT,
            result_type VARCHAR(50),
            result_data JSONB NOT NULL,
            severity VARCHAR(20),
            line_number INTEGER,
            column_number INTEGER,
            message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_analysis_project_tool ON analysis_results(project_id, tool_name)',
                    'CREATE INDEX IF NOT EXISTS idx_analysis_severity ON analysis_results(severity)',
                    'CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_results(created_at DESC)'
                ]
            },
            {
                name: 'tool_configurations',
                required: true,
                createSQL: `
          CREATE TABLE IF NOT EXISTS tool_configurations (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            tool_name VARCHAR(100) NOT NULL,
            configuration JSONB NOT NULL DEFAULT '{}',
            enabled BOOLEAN DEFAULT true,
            priority INTEGER DEFAULT 0,
            last_run TIMESTAMP,
            run_count INTEGER DEFAULT 0,
            average_duration_ms INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, tool_name)
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_tool_config_project ON tool_configurations(project_id, enabled)',
                    'CREATE INDEX IF NOT EXISTS idx_tool_config_priority ON tool_configurations(priority DESC)'
                ]
            },
            {
                name: 'initialization_progress',
                required: false,
                createSQL: `
          CREATE TABLE IF NOT EXISTS initialization_progress (
            project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            stage VARCHAR(50) NOT NULL,
            percentage INTEGER DEFAULT 0,
            message TEXT,
            error TEXT,
            started_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `
            },
            {
                name: 'file_analysis_cache',
                required: false,
                createSQL: `
          CREATE TABLE IF NOT EXISTS file_analysis_cache (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            file_hash VARCHAR(64) NOT NULL,
            analysis_type VARCHAR(50),
            analysis_data JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, file_path, analysis_type)
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_file_cache_project ON file_analysis_cache(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_file_cache_hash ON file_analysis_cache(file_hash)'
                ]
            },
            {
                name: 'semantic_graph_nodes',
                required: false,
                createSQL: `
          CREATE TABLE IF NOT EXISTS semantic_graph_nodes (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            node_id VARCHAR(255) NOT NULL,
            node_type VARCHAR(50) NOT NULL,
            node_name VARCHAR(255),
            file_path TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, node_id)
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_graph_nodes_project ON semantic_graph_nodes(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON semantic_graph_nodes(node_type)'
                ]
            },
            {
                name: 'semantic_graph_edges',
                required: false,
                createSQL: `
          CREATE TABLE IF NOT EXISTS semantic_graph_edges (
            id SERIAL PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            source_id VARCHAR(255) NOT NULL,
            target_id VARCHAR(255) NOT NULL,
            edge_type VARCHAR(50) NOT NULL,
            weight FLOAT DEFAULT 1.0,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, source_id, target_id, edge_type)
          )
        `,
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON semantic_graph_edges(project_id)',
                    'CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON semantic_graph_edges(source_id)',
                    'CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON semantic_graph_edges(target_id)'
                ]
            },
            {
                name: 'schema_versions',
                required: true,
                createSQL: `
          CREATE TABLE IF NOT EXISTS schema_versions (
            version VARCHAR(20) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW(),
            description TEXT
          )
        `
            }
        ];
    }
    /**
     * Validate the current database schema
     */
    async validateSchema() {
        const result = {
            valid: true,
            missingTables: [],
            missingIndexes: [],
            errors: []
        };
        try {
            // Check for vector extension first
            const hasVectorExtension = await this.checkVectorExtension();
            if (!hasVectorExtension) {
                result.errors.push('Vector extension not installed - some features may not work');
            }
            // Get existing tables
            const existingTables = await this.getExistingTables();
            // Check required tables
            const definitions = this.getTableDefinitions();
            for (const def of definitions) {
                if (def.required && !existingTables.includes(def.name)) {
                    result.missingTables.push(def.name);
                    result.valid = false;
                }
            }
            // Check indexes if all tables exist
            if (result.missingTables.length === 0) {
                const missingIndexes = await this.checkMissingIndexes();
                if (missingIndexes.length > 0) {
                    result.missingIndexes = missingIndexes;
                    // Indexes are not critical, don't mark as invalid
                }
            }
        }
        catch (error) {
            result.valid = false;
            result.errors.push(`Schema validation error: ${error.message}`);
        }
        return result;
    }
    /**
     * Repair/create missing schema elements
     */
    async repairSchema() {
        const result = {
            success: false,
            tablesCreated: [],
            indexesCreated: [],
            errors: []
        };
        try {
            // First ensure vector extension is available
            await this.ensureVectorExtension();
            // Get current state
            const validation = await this.validateSchema();
            if (validation.valid && validation.missingIndexes.length === 0) {
                result.success = true;
                return result;
            }
            // Create missing tables
            const definitions = this.getTableDefinitions();
            for (const def of definitions) {
                if (validation.missingTables.includes(def.name)) {
                    try {
                        console.log(theme_1.Theme.colors.info(`  Creating table: ${def.name}...`));
                        await this.pool.query(def.createSQL);
                        result.tablesCreated.push(def.name);
                        // Create indexes for this table
                        if (def.indexes) {
                            for (const indexSQL of def.indexes) {
                                try {
                                    await this.pool.query(indexSQL);
                                    result.indexesCreated.push(`Index for ${def.name}`);
                                }
                                catch (indexError) {
                                    // Index creation failures are non-critical
                                    if (!indexError.message.includes('already exists')) {
                                        this.logger.warn(`Failed to create index: ${indexError.message}`);
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        result.errors.push(`Failed to create table ${def.name}: ${error.message}`);
                    }
                }
            }
            // Record schema version
            await this.recordSchemaVersion();
            result.success = result.errors.length === 0;
        }
        catch (error) {
            result.errors.push(`Schema repair failed: ${error.message}`);
        }
        return result;
    }
    /**
     * Get list of existing tables
     */
    async getExistingTables() {
        const result = await this.pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
        return result.rows.map(row => row.table_name);
    }
    /**
     * Check for missing indexes
     */
    async checkMissingIndexes() {
        // This is simplified - in production you'd check actual index existence
        const missingIndexes = [];
        try {
            const result = await this.pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
      `);
            const existingIndexes = result.rows.map(row => row.indexname);
            // Check for critical indexes
            const criticalIndexes = [
                'idx_projects_path',
                'idx_embeddings_project',
                'idx_analysis_project_tool',
                'idx_tool_config_project'
            ];
            for (const idx of criticalIndexes) {
                if (!existingIndexes.includes(idx)) {
                    missingIndexes.push(idx);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to check indexes: ${error.message}`);
        }
        return missingIndexes;
    }
    /**
     * Check if vector extension is installed
     */
    async checkVectorExtension() {
        try {
            const result = await this.pool.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `);
            return result.rows.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Ensure vector extension is installed
     */
    async ensureVectorExtension() {
        try {
            await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
            this.logger.info('Vector extension installed/verified');
        }
        catch (error) {
            // This might fail if user doesn't have superuser privileges
            this.logger.warn('Could not install vector extension - may need superuser privileges');
            this.logger.warn('Run as postgres user: CREATE EXTENSION vector;');
        }
    }
    /**
     * Record current schema version
     */
    async recordSchemaVersion() {
        try {
            await this.pool.query(`
        INSERT INTO schema_versions (version, description)
        VALUES ($1, $2)
        ON CONFLICT (version) DO UPDATE
        SET applied_at = NOW()
      `, [this.schemaVersion, 'CodeMind core schema']);
        }
        catch (error) {
            this.logger.warn(`Failed to record schema version: ${error.message}`);
        }
    }
    /**
     * Get current schema version
     */
    async getCurrentSchemaVersion() {
        try {
            const result = await this.pool.query(`
        SELECT version FROM schema_versions
        ORDER BY applied_at DESC
        LIMIT 1
      `);
            return result.rows[0]?.version || null;
        }
        catch (error) {
            // Table might not exist yet
            return null;
        }
    }
    /**
     * Check if schema needs update
     */
    async needsSchemaUpdate() {
        const currentVersion = await this.getCurrentSchemaVersion();
        return currentVersion !== this.schemaVersion;
    }
    /**
     * Close database connections
     */
    async close() {
        await this.pool.end();
    }
    /**
     * Quick health check
     */
    async isHealthy() {
        try {
            await this.pool.query('SELECT 1');
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.DatabaseSchemaManager = DatabaseSchemaManager;
//# sourceMappingURL=database-schema-manager.js.map