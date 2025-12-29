"use strict";
/**
 * Project Initialization Command Handler - Fully Implemented
 * Single Responsibility: Handle project initialization commands (per-project setup)
 * Implements project registration, indexing, and knowledge graph creation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupCommandHandler = void 0;
const base_command_handler_1 = require("../base-command-handler");
const theme_1 = require("../../ui/theme");
const analysis_repository_consolidated_1 = require("../../../shared/analysis-repository-consolidated");
const pg_1 = require("pg");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../../../utils/logger");
const search_command_handler_1 = require("./search-command-handler");
const platform_detector_1 = require("../../services/platform-detector");
const storage_1 = require("../../../storage");
const coding_standards_generator_1 = require("../../services/analysis/coding-standards-generator");
class SetupCommandHandler extends base_command_handler_1.BaseCommandHandler {
    // NOTE: This handler is for PROJECT initialization, not infrastructure setup
    // For infrastructure setup (Docker, databases), see InfrastructureSetupHandler
    logger = logger_1.Logger.getInstance().child('SetupCommandHandler');
    /**
     * Handle setup/init commands
     */
    async handle(args) {
        const isReset = args.includes('--reset');
        const isQuick = args.includes('--quick');
        const isNewConfig = args.includes('--new-config');
        // Check for stale project.json path mismatch
        const pathMismatchResult = await this.checkProjectPathMismatch(isNewConfig);
        if (!pathMismatchResult.success) {
            return pathMismatchResult;
        }
        if (isReset) {
            console.log('🗑️ Detected --reset flag - performing complete cleanup...');
            return await this.handleCompleteReset();
        }
        else {
            console.log('🚀 Initializing CodeMind project...');
            try {
                // First ensure the consolidated schema is applied
                const schemaResult = await this.applyConsolidatedSchema();
                if (!schemaResult.success) {
                    return schemaResult;
                }
                // Then run the init process (with or without indexing)
                return await this.handleInit(isQuick);
            }
            catch (error) {
                return {
                    success: false,
                    message: `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
            }
        }
    }
    /**
     * Check if project.json has a path mismatch with current directory
     * This happens when a project folder is copied from another location
     */
    async checkProjectPathMismatch(forceReset) {
        // Use CODEMIND_USER_CWD if available (set at CLI startup before any chdir)
        const currentPath = process.env.CODEMIND_USER_CWD || process.cwd();
        const configPath = path.join(currentPath, '.codemind', 'project.json');
        // Debug: show what paths we're comparing
        this.logger.debug(`Checking path mismatch - userCwd: ${currentPath}, configPath: ${configPath}`);
        try {
            // Check if project.json exists
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            this.logger.debug(`Config projectPath: ${config.projectPath}`);
            // Normalize paths for comparison (handle Windows path differences)
            const normalizedCurrentPath = currentPath.replace(/\\/g, '/').toLowerCase();
            const normalizedConfigPath = (config.projectPath || '').replace(/\\/g, '/').toLowerCase();
            if (normalizedConfigPath && normalizedCurrentPath !== normalizedConfigPath) {
                console.log(theme_1.Theme.colors.warning('\n⚠️  Project path mismatch detected!'));
                console.log(theme_1.Theme.colors.muted(`   Config path:  ${config.projectPath}`));
                console.log(theme_1.Theme.colors.muted(`   Current path: ${currentPath}`));
                if (forceReset) {
                    console.log(theme_1.Theme.colors.info('\n🔄 --new-config flag detected, resetting project configuration...'));
                    // Delete the stale project.json so init creates a fresh one
                    await fs.unlink(configPath);
                    console.log(theme_1.Theme.colors.success('✅ Removed stale project.json'));
                    return { success: true, message: 'Stale config removed, proceeding with fresh init' };
                }
                else {
                    console.log(theme_1.Theme.colors.warning('\n💡 This project folder appears to be copied from another location.'));
                    console.log(theme_1.Theme.colors.info('   The existing configuration points to a different path.'));
                    console.log(theme_1.Theme.colors.info('\n   Options:'));
                    console.log(theme_1.Theme.colors.primary('   • Run "codemind init --new-config" to create fresh config for this location'));
                    console.log(theme_1.Theme.colors.primary('   • Run "codemind init --reset" for complete database cleanup'));
                    return {
                        success: false,
                        message: `Path mismatch: config points to "${config.projectPath}" but current directory is "${currentPath}". Use --new-config to reset.`
                    };
                }
            }
            // No mismatch, continue normally
            return { success: true, message: 'Project path verified' };
        }
        catch (error) {
            // No project.json exists or can't be read - this is fine for new projects
            return { success: true, message: 'No existing config, will create new' };
        }
    }
    /**
     * Perform complete database cleanup and reinitialization
     * Uses storage abstraction for both embedded and server modes
     */
    async handleCompleteReset() {
        const projectPath = this.context.currentProject?.projectPath || process.cwd();
        console.log(theme_1.Theme.colors.warning(`🗑️ Resetting CodeMind project: ${path.basename(projectPath)}`));
        console.log(theme_1.Theme.colors.warning('⚠️ This will delete ALL project data'));
        try {
            console.log(theme_1.Theme.colors.info('\n🧹 Cleaning up existing data...'));
            // Use storage abstraction for cleanup
            if ((0, storage_1.isUsingEmbeddedStorage)()) {
                // Embedded mode - use storage manager
                const storageManager = await (0, storage_1.getStorageManager)();
                const projectStore = storageManager.getProjectStore();
                const vectorStore = storageManager.getVectorStore();
                const graphStore = storageManager.getGraphStore();
                // Find project by path
                const project = await projectStore.findByPath(projectPath);
                if (project) {
                    // Delete all related data
                    await vectorStore.deleteByProject(project.id);
                    await graphStore.deleteByProject(project.id);
                    await projectStore.delete(project.id);
                    console.log(theme_1.Theme.colors.success('✅ Deleted all embedded project data'));
                }
                else {
                    console.log(theme_1.Theme.colors.muted('   No existing project found'));
                }
            }
            else {
                // Server mode - use PostgreSQL directly
                const pool = new pg_1.Pool({
                    host: process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_PORT || '5432'),
                    database: process.env.DB_NAME || 'codemind',
                    user: process.env.DB_USER || 'codemind',
                    password: process.env.DB_PASSWORD || 'codemind123'
                });
                const client = await pool.connect();
                try {
                    // Delete all data related to this project path
                    await client.query('DELETE FROM semantic_search_embeddings WHERE project_id IN (SELECT id FROM projects WHERE project_path = $1)', [projectPath]);
                    await client.query('DELETE FROM analysis_results WHERE project_id IN (SELECT id FROM projects WHERE project_path = $1)', [projectPath]);
                    await client.query('DELETE FROM initialization_progress WHERE project_id IN (SELECT id FROM projects WHERE project_path = $1)', [projectPath]);
                    await client.query('DELETE FROM projects WHERE project_path = $1', [projectPath]);
                    console.log(theme_1.Theme.colors.success('✅ Deleted all PostgreSQL project data'));
                }
                finally {
                    client.release();
                    await pool.end();
                }
                // Clean up Neo4j knowledge graph data (server mode only)
                console.log(theme_1.Theme.colors.info('\n🕸️ Cleaning up Neo4j knowledge graph...'));
                await this.cleanupNeo4jData(projectPath);
            }
            // Apply fresh schema to ensure everything is correct
            console.log(theme_1.Theme.colors.info('\n🔄 Applying fresh database schema...'));
            await this.applyConsolidatedSchema();
            // Initialize fresh project
            console.log(theme_1.Theme.colors.info('\n🚀 Initializing fresh project...'));
            const initResult = await this.handleInit();
            if (initResult.success) {
                console.log(theme_1.Theme.colors.success('\n🎉 Complete reset successful!'));
                console.log(theme_1.Theme.colors.muted('💡 Next steps:'));
                console.log(theme_1.Theme.colors.muted('   • Run "/search --index" to index your codebase'));
                console.log(theme_1.Theme.colors.muted('   • Try "/analyze <question>" for AI assistance'));
            }
            return initResult;
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
            return {
                success: false,
                message: `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Clean up Neo4j knowledge graph data for a project
     */
    async cleanupNeo4jData(projectPath) {
        try {
            // For MVP, we'll use a simple approach - try to clean up if Neo4j is available
            const neo4j = require('neo4j-driver');
            const driver = neo4j.driver(process.env.NEO4J_URI || 'bolt://localhost:7687', neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'codemind123'));
            const session = driver.session();
            try {
                // Delete all nodes and relationships related to this project path
                // This is a simplified approach for MVP
                const result = await session.run(`
          MATCH (n {projectPath: $projectPath})-[r*0..]->(m)
          DETACH DELETE n, m
        `, { projectPath });
                // Also clean up any orphaned relationships
                await session.run(`
          MATCH ()-[r]-()
          WHERE r.projectPath = $projectPath
          DELETE r
        `, { projectPath });
                console.log(theme_1.Theme.colors.success('✅ Cleaned up Neo4j knowledge graph data'));
            }
            finally {
                await session.close();
                await driver.close();
            }
        }
        catch (error) {
            // Neo4j cleanup is not critical for MVP - warn but continue
            console.log(theme_1.Theme.colors.warning(`⚠️ Neo4j cleanup skipped: ${error instanceof Error ? error.message : 'Connection failed'}`));
            console.log(theme_1.Theme.colors.muted('   (Knowledge graph will be rebuilt on next analysis)'));
        }
    }
    /**
     * Initialize a CodeMind project
     */
    async handleInit(skipIndexing = false) {
        try {
            // Use CODEMIND_USER_CWD (set at CLI startup before chdir) to get the actual user's directory
            const projectPath = process.env.CODEMIND_USER_CWD || process.cwd();
            console.log(`📁 Project path: ${projectPath}`);
            // Step 1: Initialize database schema
            console.log(theme_1.Theme.colors.info('\n📊 Setting up database...'));
            const dbResult = await this.initializeDatabase();
            if (!dbResult.success) {
                return dbResult;
            }
            // Step 2: Create or update project in database
            console.log(theme_1.Theme.colors.info('\n📋 Registering project...'));
            const projectResult = await this.initializeProject(projectPath);
            if (!projectResult.success) {
                return projectResult;
            }
            // Step 3: Index codebase for semantic search (unless --quick flag is used)
            if (!skipIndexing) {
                console.log(theme_1.Theme.colors.info('\n🔍 Indexing codebase for semantic search...'));
                try {
                    const indexingResult = await this.indexCodebase(projectResult.data.projectId, projectPath);
                    if (indexingResult.success) {
                        console.log(theme_1.Theme.colors.success(`✅ Indexed ${indexingResult.data.filesProcessed} files, ${indexingResult.data.segmentsCreated} code segments`));
                    }
                    else {
                        console.log(theme_1.Theme.colors.warning(`⚠️ Indexing failed: ${indexingResult.message}`));
                    }
                }
                catch (error) {
                    console.log(theme_1.Theme.colors.warning(`⚠️ Indexing skipped: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            }
            else {
                console.log(theme_1.Theme.colors.info('\n⚡ Skipping indexing (--quick mode)'));
                console.log(theme_1.Theme.colors.muted('   Run "search --index" later to enable semantic search'));
            }
            // Step 3.5: Build initial knowledge graph
            console.log(theme_1.Theme.colors.info('\n🕸️ Building knowledge graph...'));
            try {
                await this.buildInitialKnowledgeGraph(projectPath, projectResult.data.projectId);
                console.log(theme_1.Theme.colors.success('✅ Knowledge graph created with triads'));
            }
            catch (error) {
                console.log(theme_1.Theme.colors.warning(`⚠️ Knowledge graph creation skipped: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
            // Step 3.6: Generate coding standards (if project is indexed)
            if (!skipIndexing) {
                console.log(theme_1.Theme.colors.info('\n📐 Generating coding standards...'));
                try {
                    await this.generateCodingStandards(projectResult.data.projectId, projectPath);
                }
                catch (error) {
                    console.log(theme_1.Theme.colors.warning(`⚠️ Coding standards generation skipped: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            }
            // Step 4: Create CODEMIND.md if it doesn't exist
            console.log(theme_1.Theme.colors.info('\n📝 Setting up project instructions...'));
            await this.createInstructionsFile(projectPath);
            console.log(theme_1.Theme.colors.success('\n🎉 CodeMind project initialized successfully!'));
            if (!skipIndexing) {
                console.log(theme_1.Theme.colors.muted('\n💡 Ready to use:'));
                console.log(theme_1.Theme.colors.muted('   • Ask questions: "what is this project about?"'));
                console.log(theme_1.Theme.colors.muted('   • Analyze code: "show me all the classes"'));
                console.log(theme_1.Theme.colors.muted('   • Request changes: "add authentication to the API"'));
                console.log(theme_1.Theme.colors.muted('   • Run "sync" to update after manual code changes'));
            }
            else {
                console.log(theme_1.Theme.colors.muted('\n💡 Next steps:'));
                console.log(theme_1.Theme.colors.muted('   • Run "search --index" to enable semantic search'));
                console.log(theme_1.Theme.colors.muted('   • Then try: "what is this project about?"'));
            }
            return {
                success: true,
                message: 'Project initialized successfully',
                data: projectResult.data
            };
        }
        catch (error) {
            this.logger.error('Project initialization failed:', error);
            return {
                success: false,
                message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Setup system-wide configuration
     */
    async handleSetup() {
        console.log(theme_1.Theme.colors.primary('⚙️ Setting up CodeMind system configuration...'));
        try {
            // Initialize database schema
            console.log(theme_1.Theme.colors.info('\n📊 Applying database schema...'));
            const dbResult = await this.initializeDatabase();
            if (!dbResult.success) {
                return dbResult;
            }
            // Apply consolidated schema
            console.log(theme_1.Theme.colors.info('\n🔄 Applying consolidated schema...'));
            const schemaResult = await this.applyConsolidatedSchema();
            if (!schemaResult.success) {
                return schemaResult;
            }
            console.log(theme_1.Theme.colors.success('\n✅ System setup completed successfully!'));
            console.log(theme_1.Theme.colors.muted('\n💡 Next steps:'));
            console.log(theme_1.Theme.colors.muted('   • Run "codemind init" in your project directory'));
            console.log(theme_1.Theme.colors.muted('   • Check database connections with "codemind status"'));
            return {
                success: true,
                message: 'System setup completed successfully'
            };
        }
        catch (error) {
            this.logger.error('System setup failed:', error);
            return {
                success: false,
                message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Initialize database connection and basic tables
     */
    async initializeDatabase() {
        try {
            // Initialize the consolidated analysis repository
            await analysis_repository_consolidated_1.analysisRepository.initialize();
            console.log(theme_1.Theme.colors.success('✅ Database connection established'));
            // In embedded mode, skip PostgreSQL connection test
            if ((0, storage_1.isUsingEmbeddedStorage)()) {
                return { success: true, message: 'Embedded storage initialized' };
            }
            // Test database connectivity (server mode only)
            const pool = new pg_1.Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123'
            });
            // Test connection
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            await pool.end();
            console.log(theme_1.Theme.colors.success('✅ PostgreSQL connection verified'));
            return { success: true, message: 'Database initialized' };
        }
        catch (error) {
            this.logger.error('Database initialization failed:', error);
            console.log(theme_1.Theme.colors.error('❌ Database initialization failed'));
            console.log(theme_1.Theme.colors.warning('💡 Please ensure PostgreSQL is running and credentials are correct'));
            console.log(theme_1.Theme.colors.muted('   Check your .env file or environment variables'));
            return {
                success: false,
                message: `Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Build initial knowledge graph for the project
     * Uses embedded Graphology store by default, Neo4j if in server mode
     */
    async buildInitialKnowledgeGraph(projectPath, projectId) {
        try {
            // Get the appropriate graph store based on storage mode
            const storageManager = await (0, storage_1.getStorageManager)();
            const graphStore = storageManager.getGraphStore();
            // First, delete any existing data for this project to ensure clean state
            await graphStore.deleteByProject(projectId);
            // Scan for code files and create basic nodes and relationships
            const { glob } = require('fast-glob');
            const files = await glob(['**/*.{ts,js,jsx,tsx}'], {
                cwd: projectPath,
                ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
            });
            const nodesToCreate = [];
            const edgesToCreate = [];
            // Create a project "file" node to represent the project root
            const projectNodeId = `project-${projectId}`;
            nodesToCreate.push({
                id: projectNodeId,
                type: 'file',
                name: path.basename(projectPath),
                filePath: projectPath,
                projectId,
                properties: {
                    isProjectRoot: true,
                    createdAt: new Date().toISOString()
                }
            });
            for (const file of files.slice(0, 20)) { // Limit to 20 files for performance
                const filePath = path.join(projectPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                // Create file node
                const fileNodeId = `file-${projectId}-${file}`;
                nodesToCreate.push({
                    id: fileNodeId,
                    type: 'file',
                    name: path.basename(file),
                    filePath: filePath,
                    projectId,
                    properties: {
                        relativePath: file
                    }
                });
                // Create edge from project to file
                edgesToCreate.push({
                    id: `contains-${projectNodeId}-${fileNodeId}`,
                    source: projectNodeId,
                    target: fileNodeId,
                    type: 'contains'
                });
                // Extract basic code elements (classes, functions)
                const classMatches = content.match(/class\s+(\w+)/g) || [];
                const functionMatches = content.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?(?:\(.*?\)|[^=]*?)\s*=>)/g) || [];
                for (const classMatch of classMatches) {
                    const className = classMatch.match(/class\s+(\w+)/)?.[1];
                    if (className) {
                        const classNodeId = `class-${projectId}-${file}-${className}`;
                        nodesToCreate.push({
                            id: classNodeId,
                            type: 'class',
                            name: className,
                            filePath: filePath,
                            projectId,
                            properties: {
                                relativePath: file
                            }
                        });
                        // Create edge from file to class
                        edgesToCreate.push({
                            id: `defines-${fileNodeId}-${classNodeId}`,
                            source: fileNodeId,
                            target: classNodeId,
                            type: 'contains'
                        });
                    }
                }
                for (const funcMatch of functionMatches.slice(0, 5)) { // Limit functions per file
                    const functionName = funcMatch.match(/function\s+(\w+)/)?.[1] ||
                        funcMatch.match(/(\w+)\s*=/)?.[1];
                    if (functionName && functionName.length > 1) {
                        const funcNodeId = `function-${projectId}-${file}-${functionName}`;
                        nodesToCreate.push({
                            id: funcNodeId,
                            type: 'function',
                            name: functionName,
                            filePath: filePath,
                            projectId,
                            properties: {
                                relativePath: file
                            }
                        });
                        // Create edge from file to function
                        edgesToCreate.push({
                            id: `defines-${fileNodeId}-${funcNodeId}`,
                            source: fileNodeId,
                            target: funcNodeId,
                            type: 'contains'
                        });
                    }
                }
            }
            // Bulk insert all nodes and edges
            if (nodesToCreate.length > 0) {
                await graphStore.upsertNodes(nodesToCreate);
            }
            if (edgesToCreate.length > 0) {
                await graphStore.upsertEdges(edgesToCreate);
            }
            // Flush to persist to disk
            await graphStore.flush();
            const nodeCount = nodesToCreate.length;
            const relationshipCount = edgesToCreate.length;
            console.log(theme_1.Theme.colors.success(`   📊 Created ${nodeCount} nodes and ${relationshipCount} relationships`));
        }
        catch (error) {
            // Re-throw to be handled by caller
            throw error;
        }
    }
    /**
     * Generate coding standards file from detected patterns
     */
    async generateCodingStandards(projectId, projectPath) {
        try {
            const storageManager = await (0, storage_1.getStorageManager)();
            const vectorStore = storageManager.getVectorStore();
            const generator = new coding_standards_generator_1.CodingStandardsGenerator(vectorStore);
            await generator.generateStandards(projectId, projectPath);
            console.log(theme_1.Theme.colors.success('   ✓ Coding standards file created'));
        }
        catch (error) {
            // Re-throw to be handled by caller
            throw error;
        }
    }
    /**
     * Apply the consolidated database schema
     * Uses embedded storage by default (no Docker required)
     */
    async applyConsolidatedSchema() {
        try {
            // Check if we're using embedded storage (default, no Docker needed)
            const storageManager = await (0, storage_1.getStorageManager)();
            if ((0, storage_1.isUsingEmbeddedStorage)()) {
                // Embedded mode - SQLite + Graphology + LRU-cache
                // Schema is automatically created by the storage providers
                const status = storageManager.getStatus();
                console.log(theme_1.Theme.colors.success('📦 Using embedded storage (no Docker required)'));
                console.log(theme_1.Theme.colors.muted(`   Data directory: ${status.dataDir}`));
                console.log(theme_1.Theme.colors.muted(`   Vector store: SQLite + FTS5`));
                console.log(theme_1.Theme.colors.muted(`   Graph store: Graphology (in-memory + JSON)`));
                console.log(theme_1.Theme.colors.muted(`   Cache: LRU-cache (in-memory + JSON)`));
                return { success: true, message: 'Embedded storage ready' };
            }
            // Server mode - use PostgreSQL (legacy behavior)
            console.log(theme_1.Theme.colors.info('🔌 Using server storage mode (PostgreSQL + Neo4j + Redis)'));
            const pool = new pg_1.Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123'
            });
            // Check if consolidated schema is properly applied
            const client = await pool.connect();
            try {
                // Check if semantic_search_embeddings has the content_type column
                const embeddingsSchemaCheck = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'semantic_search_embeddings' AND column_name = 'content_type'
        `);
                if (embeddingsSchemaCheck.rows.length > 0) {
                    console.log(theme_1.Theme.colors.success('✅ Consolidated schema already applied correctly'));
                    return { success: true, message: 'Schema already up to date' };
                }
                console.log(theme_1.Theme.colors.warning('⚠️ Semantic search table needs schema update...'));
                // Drop and recreate the semantic_search_embeddings table to ensure correct schema
                console.log(theme_1.Theme.colors.info('🗑️ Dropping old semantic_search_embeddings table...'));
                await client.query('DROP TABLE IF EXISTS semantic_search_embeddings CASCADE');
                // Read and apply the consolidated schema
                const schemaPath = path.join(process.env.CODEMIND_PROJECT_ROOT || __dirname, '..', '..', '..', 'database', 'schema.consolidated.sql');
                try {
                    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
                    await client.query(schemaSQL);
                    console.log(theme_1.Theme.colors.success('✅ Consolidated schema applied successfully'));
                }
                catch (fileError) {
                    console.log(theme_1.Theme.colors.warning('⚠️ Schema file not found, creating basic tables manually'));
                    await this.createBasicTables(client);
                }
                return { success: true, message: 'Schema applied successfully' };
            }
            finally {
                client.release();
                await pool.end();
            }
        }
        catch (error) {
            // If server connection fails, fall back to embedded mode
            if (String(error).includes('ECONNREFUSED') || String(error).includes('connection')) {
                console.log(theme_1.Theme.colors.warning('⚠️ Server databases not available, using embedded storage'));
                try {
                    // Force embedded mode
                    process.env.CODEMIND_STORAGE_MODE = 'embedded';
                    const storageManager = await (0, storage_1.getStorageManager)({ mode: 'embedded' });
                    const status = storageManager.getStatus();
                    console.log(theme_1.Theme.colors.success('📦 Embedded storage initialized'));
                    console.log(theme_1.Theme.colors.muted(`   Data directory: ${status.dataDir}`));
                    return { success: true, message: 'Using embedded storage (fallback)' };
                }
                catch (embeddedError) {
                    this.logger.error('Embedded storage fallback failed:', embeddedError);
                }
            }
            this.logger.error('Schema application failed:', error);
            return {
                success: false,
                message: `Schema application failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Create basic tables if schema file is not available
     */
    async createBasicTables(client) {
        // Create essential tables manually
        const basicSchema = `
      -- Enable extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS vector;

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_path TEXT UNIQUE NOT NULL,
        project_name TEXT NOT NULL,
        project_type TEXT DEFAULT 'unknown',
        languages JSONB DEFAULT '[]'::jsonb,
        frameworks JSONB DEFAULT '[]'::jsonb,
        total_files INTEGER DEFAULT 0,
        total_lines INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Analysis results table
      CREATE TABLE IF NOT EXISTS analysis_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        analysis_subtype TEXT,
        analysis_result JSONB NOT NULL,
        confidence_score DECIMAL(3,2),
        severity TEXT DEFAULT 'info',
        status TEXT DEFAULT 'detected',
        metadata JSONB DEFAULT '{}'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Semantic search embeddings table
      CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        content_type TEXT DEFAULT 'code',
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embedding VECTOR(384),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, file_path, chunk_index, content_hash)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);
      CREATE INDEX IF NOT EXISTS idx_analysis_project_type ON analysis_results(project_id, analysis_type);
      CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project ON semantic_search_embeddings(project_id);
    `;
        await client.query(basicSchema);
    }
    /**
     * Initialize project record in database
     * Uses embedded storage by default, PostgreSQL in server mode
     */
    async initializeProject(projectPath) {
        try {
            const projectName = path.basename(projectPath);
            // Generate proper UUID for project ID
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const projectId = crypto.randomUUID();
            // Check if we're using embedded storage (default)
            if ((0, storage_1.isUsingEmbeddedStorage)()) {
                const storageManager = await (0, storage_1.getStorageManager)();
                const projectStore = storageManager.getProjectStore();
                // Upsert project in embedded storage
                const project = await projectStore.upsert({
                    id: projectId,
                    name: projectName,
                    path: projectPath,
                    metadata: {
                        initialized_at: new Date().toISOString(),
                        cli_version: '2.0.0'
                    }
                });
                console.log(theme_1.Theme.colors.success(`✅ Project registered: ${project.name} (${project.id})`));
                // Update local config file
                await this.updateLocalProjectConfig(projectPath, {
                    projectId: project.id,
                    projectName: project.name,
                    projectPath,
                    createdAt: new Date().toISOString(),
                    languages: ['javascript'],
                    primaryLanguage: 'javascript',
                    installedParsers: []
                });
                return {
                    success: true,
                    message: 'Project registered successfully',
                    data: { projectId: project.id, projectName: project.name, projectPath }
                };
            }
            // Server mode - use PostgreSQL
            const pool = new pg_1.Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123'
            });
            const client = await pool.connect();
            try {
                // Insert or update project
                const result = await client.query(`
          INSERT INTO projects (id, project_path, project_name, status, metadata)
          VALUES ($1, $2, $3, 'active', $4)
          ON CONFLICT (project_path) DO UPDATE SET
            project_name = EXCLUDED.project_name,
            status = 'active',
            updated_at = NOW()
          RETURNING id, project_name, project_path
        `, [projectId, projectPath, projectName, JSON.stringify({
                        initialized_at: new Date().toISOString(),
                        cli_version: '2.0.0'
                    })]);
                // Use the actual ID from the database (could be existing or new)
                const actualProjectId = result.rows[0].id;
                const actualProjectName = result.rows[0].project_name;
                console.log(theme_1.Theme.colors.success(`✅ Project registered: ${actualProjectName} (${actualProjectId})`));
                // Update local config file with the actual project ID from database
                await this.updateLocalProjectConfig(projectPath, {
                    projectId: actualProjectId,
                    projectName: actualProjectName,
                    projectPath,
                    createdAt: new Date().toISOString(),
                    languages: ['javascript'], // Default for now
                    primaryLanguage: 'javascript',
                    installedParsers: []
                });
                return {
                    success: true,
                    message: 'Project registered successfully',
                    data: { projectId: actualProjectId, projectName: actualProjectName, projectPath }
                };
            }
            finally {
                client.release();
                await pool.end();
            }
        }
        catch (error) {
            this.logger.error('Project initialization failed:', error);
            return {
                success: false,
                message: `Project initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Generate initial embeddings for the project (basic implementation)
     */
    async generateInitialEmbeddings(projectId, projectPath) {
        try {
            // For now, just create a placeholder to avoid blocking initialization
            // The real embedding generation will happen when user runs "search --index"
            console.log(theme_1.Theme.colors.muted('   Creating embedding placeholders...'));
            return {
                success: true,
                message: 'Initial embeddings prepared',
                data: { count: 0 }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Create CODEMIND.md instructions file with detected platforms
     */
    async createInstructionsFile(projectPath) {
        const instructionsPath = path.join(projectPath, 'CODEMIND.md');
        try {
            // Check if file already exists
            await fs.access(instructionsPath);
            console.log(theme_1.Theme.colors.success('✅ CODEMIND.md already exists'));
            // Even if file exists, try to append platform detection if not already present
            const existingContent = await fs.readFile(instructionsPath, 'utf-8');
            if (!existingContent.includes('## Detected Platforms')) {
                await this.appendPlatformDetection(projectPath, instructionsPath, existingContent);
            }
        }
        catch {
            // Create new instructions file with platform detection
            console.log(theme_1.Theme.colors.info('🔍 Detecting platforms...'));
            const platforms = await platform_detector_1.platformDetector.detectPlatforms(projectPath);
            const platformsSection = platform_detector_1.platformDetector.formatPlatformsMarkdown(platforms);
            if (platforms.length > 0) {
                console.log(theme_1.Theme.colors.success(`   Found ${platforms.length} platforms: ${platforms.map(p => p.name).join(', ')}`));
            }
            const defaultInstructions = `# CODEMIND.md - ${path.basename(projectPath)}

This file provides instructions to CodeMind for analyzing and working with this project.

## Project Overview

**Project**: ${path.basename(projectPath)}
**Type**: api_service
**Description**: Your project description here
**Languages**: JavaScript, TypeScript
**Architecture**: Add your architecture pattern
**Testing Strategy**: Unit + Integration Testing
**Coding Standards**: ESLint/Prettier

${platformsSection}
## Development Guidelines

### Architecture Principles
- Follow SOLID principles consistently
- Use dependency injection patterns
- Maintain clear separation of concerns

### Code Quality Standards
- High Performance, High Reliability, Secure
- Comprehensive error handling
- Proper logging and monitoring

### Important Files and Patterns
- Add important file patterns here
- Document coding conventions
- List key dependencies and their purposes

## CodeMind Instructions

- Analyze code for SOLID principles violations
- Focus on maintainability and scalability
- Suggest improvements for performance and security
- Help with refactoring and code organization

Generated by CodeMind CLI v2.0.0
`;
            await fs.writeFile(instructionsPath, defaultInstructions);
            console.log(theme_1.Theme.colors.success('✅ Created CODEMIND.md with platform detection'));
        }
    }
    /**
     * Append platform detection to existing CODEMIND.md
     */
    async appendPlatformDetection(projectPath, instructionsPath, existingContent) {
        try {
            console.log(theme_1.Theme.colors.info('🔍 Detecting platforms for existing CODEMIND.md...'));
            const platforms = await platform_detector_1.platformDetector.detectPlatforms(projectPath);
            if (platforms.length === 0) {
                return;
            }
            console.log(theme_1.Theme.colors.success(`   Found ${platforms.length} platforms: ${platforms.map(p => p.name).join(', ')}`));
            const platformsSection = platform_detector_1.platformDetector.formatPlatformsMarkdown(platforms);
            // Insert before "## Development Guidelines" or at the end if not found
            let newContent;
            if (existingContent.includes('## Development Guidelines')) {
                newContent = existingContent.replace('## Development Guidelines', `${platformsSection}\n## Development Guidelines`);
            }
            else {
                newContent = existingContent + '\n\n' + platformsSection;
            }
            await fs.writeFile(instructionsPath, newContent);
            console.log(theme_1.Theme.colors.success('✅ Added platform detection to CODEMIND.md'));
        }
        catch (error) {
            // Don't fail the entire init for this
            console.log(theme_1.Theme.colors.warning(`⚠️ Could not append platforms: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }
    /**
     * Update local project configuration file
     */
    async updateLocalProjectConfig(projectPath, config) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const codemindDir = path.join(projectPath, '.codemind');
            const configPath = path.join(codemindDir, 'project.json');
            // Ensure .codemind directory exists
            try {
                await fs.mkdir(codemindDir, { recursive: true });
            }
            catch (error) {
                // Directory might already exist, ignore
            }
            // Write updated config
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            console.log(theme_1.Theme.colors.info(`✅ Updated local project config: ${configPath}`));
        }
        catch (error) {
            this.logger.warn('Failed to update local project config:', error);
            // Don't fail the entire operation for this
        }
    }
    /**
     * Index codebase for semantic search by delegating to search handler
     */
    async indexCodebase(projectId, projectPath) {
        try {
            // Update context with the correct project ID before creating the search handler
            // This ensures the search handler uses the newly registered project ID
            const updatedContext = {
                ...this.context,
                currentProject: {
                    ...this.context.currentProject,
                    projectId: projectId,
                    projectPath: projectPath
                }
            };
            // Create a search handler instance with updated context
            const searchHandler = new search_command_handler_1.SearchCommandHandler(updatedContext);
            // Call the indexing functionality (reuse existing search --index logic)
            const result = await searchHandler.handle('--index');
            if (result.success) {
                return {
                    success: true,
                    message: 'Codebase indexed successfully',
                    data: {
                        filesProcessed: result.data?.filesProcessed || 'unknown',
                        segmentsCreated: result.data?.segmentsCreated || 'unknown'
                    }
                };
            }
            else {
                return {
                    success: false,
                    message: result.message || 'Indexing failed'
                };
            }
        }
        catch (error) {
            this.logger.error('Codebase indexing failed:', error);
            return {
                success: false,
                message: `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
exports.SetupCommandHandler = SetupCommandHandler;
//# sourceMappingURL=setup-command-handler.js.map