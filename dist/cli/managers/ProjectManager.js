"use strict";
/**
 * ProjectManager - Handles all project-related operations
 * Single Responsibility: Project initialization, detection, configuration
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
exports.ProjectManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const database_config_1 = require("../../config/database-config");
const theme_1 = require("../ui/theme");
class ProjectManager {
    dbConnections;
    currentProjectPath;
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
        this.currentProjectPath = process.cwd();
    }
    /**
     * Set the current project path
     */
    setProjectPath(projectPath) {
        this.currentProjectPath = path.resolve(projectPath);
    }
    /**
     * Detect if current directory is a CodeMind project
     */
    detectProject(projectPath) {
        const configPath = path.join(projectPath, '.codemind', 'project.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return config;
            }
            catch (error) {
                console.warn(`Warning: Invalid project configuration: ${error.message}`);
            }
        }
        return null;
    }
    /**
     * Initialize a new CodeMind project with full AI analysis
     */
    async initializeProject(projectPath, options) {
        console.log(theme_1.Theme.colors.info(`\n📝 Initializing CodeMind project...`));
        console.log(theme_1.Theme.colors.muted(`Path: ${projectPath}`));
        console.log(theme_1.Theme.colors.muted(`Name: ${options.projectName}`));
        try {
            // Step 1: Check infrastructure
            await this.verifyInfrastructure();
            // Step 2: Language Detection and Setup
            console.log('🌐 Detecting project languages and setup...');
            const languageSetup = await this.detectLanguagesAndSetup(projectPath);
            // Step 3: Complete project analysis
            console.log('🤖 Running complete project analysis...');
            const analysis = await this.performCompleteAnalysis(projectPath);
            // Step 4: Register in databases  
            const projectId = await this.registerInDatabases(projectPath, options, analysis, languageSetup);
            // Step 5: Populate databases with analysis data
            console.log('📊 Populating databases with analysis data...');
            const initResult = await this.populateDatabases(projectPath, projectId, analysis, languageSetup);
            // Step 6: Create local configuration
            const config = await this.createLocalConfig(projectPath, projectId, options, analysis, languageSetup);
            console.log(theme_1.Theme.colors.success('\n✅ Project initialization complete!'));
            console.log(theme_1.Theme.colors.info(`📊 Architecture: ${analysis.architecture.type}`));
            console.log(theme_1.Theme.colors.info(`🔗 Dependencies: ${analysis.dependencies.files.length} files`));
            console.log(theme_1.Theme.colors.info(`📋 Use Cases: ${analysis.useCases.length} identified`));
            console.log(theme_1.Theme.colors.info(`🌐 Languages: ${languageSetup.selectedLanguages.join(', ')}`));
            console.log(theme_1.Theme.colors.info(`📦 Parsers: ${languageSetup.installedPackages.length} installed`));
            console.log(theme_1.Theme.colors.info(`🗄️ PostgreSQL: ${initResult.embeddings.created} embeddings, ${initResult.analysisResults.created} analyses`));
            console.log(theme_1.Theme.colors.info(`🔧 Tech Stack: ${initResult.techStack.languages.length} languages, ${initResult.techStack.frameworks.length} frameworks`));
            return { success: true, config };
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Project initialization failed: ${error.message}`));
            return { success: false, error: error.message };
        }
    }
    /**
     * Switch between projects
     */
    async switchProject(targetPath) {
        const config = this.detectProject(targetPath);
        if (config) {
            // Verify project still exists in database
            const exists = await this.verifyProjectInDatabase(config.projectId);
            if (!exists) {
                console.warn('⚠️  Project not found in database, may need re-initialization');
            }
        }
        return config;
    }
    /**
     * Get project information and statistics
     */
    async getProjectInfo(projectId) {
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            const query = `
        SELECT 
          project_name,
          project_type,
          languages,
          frameworks,
          total_files,
          created_at,
          updated_at,
          metadata
        FROM projects 
        WHERE id = $1;
      `;
            const result = await pgClient.query(query, [projectId]);
            if (result.rows.length === 0) {
                return null;
            }
            const project = result.rows[0];
            // Get additional statistics
            const statsQuery = `
        SELECT 
          COUNT(*) as embedding_count
        FROM semantic_search_embeddings 
        WHERE project_path = (SELECT project_path FROM projects WHERE id = $1);
      `;
            const stats = await pgClient.query(statsQuery, [projectId]);
            return {
                ...project,
                statistics: {
                    embeddings: parseInt(stats.rows[0]?.embedding_count || '0'),
                    lastAnalyzed: project.updated_at
                }
            };
        }
        catch (error) {
            console.error(`Failed to get project info: ${error.message}`);
            return null;
        }
    }
    // Private helper methods
    async verifyInfrastructure() {
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            await pgClient.query('SELECT 1');
        }
        catch (error) {
            throw new Error('PostgreSQL database not available. Run "/setup" first.');
        }
        finally {
            await dbConnections.closeAll();
        }
    }
    async verifyProjectInDatabase(projectId) {
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            const result = await pgClient.query('SELECT id FROM projects WHERE id = $1', [projectId]);
            return result.rows.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    async registerInDatabases(projectPath, options, analysis, languageSetup) {
        const projectId = (0, uuid_1.v4)();
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            const languages = languageSetup?.selectedLanguages || [];
            const result = await pgClient.query(`
        INSERT INTO projects (
          id, project_name, project_path, project_type, 
          languages, total_files, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (project_path) 
        DO UPDATE SET 
          project_name = EXCLUDED.project_name,
          project_type = EXCLUDED.project_type,
          languages = EXCLUDED.languages,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `, [
                projectId,
                options.projectName,
                projectPath,
                analysis.architecture?.type || 'api_service',
                JSON.stringify(languages),
                analysis.dependencies?.files?.length || 0,
                JSON.stringify({
                    languageSetup,
                    primaryLanguage: languages[0] || 'unknown',
                    analysis: {
                        architecture: analysis.architecture,
                        useCases: analysis.useCases.length,
                        dependencies: analysis.dependencies?.files?.length || 0
                    }
                })
            ]);
            const actualProjectId = result.rows[0].id;
            console.log(`✅ Project registered in database: ${actualProjectId}`);
            return actualProjectId;
        }
        catch (error) {
            console.error(`❌ Database registration failed: ${error.message}`);
            throw error;
        }
    }
    async createLocalConfig(projectPath, projectId, options, analysis, languageSetup) {
        const config = {
            projectId,
            projectName: options.projectName,
            projectPath,
            createdAt: new Date().toISOString(),
            languages: languageSetup?.selectedLanguages || [],
            primaryLanguage: languageSetup?.selectedLanguages?.[0] || 'unknown',
            installedParsers: languageSetup?.installedPackages || []
        };
        const configPath = path.join(projectPath, '.codemind', 'project.json');
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
        return config;
    }
    /**
     * Detect languages and setup project environment
     */
    async detectLanguagesAndSetup(projectPath) {
        console.log('  🔍 Scanning project files...');
        // Use glob to find all source files
        const fs = require('fs').promises;
        const path = require('path');
        const languageMap = new Map();
        const fileExtensions = new Set();
        // Scan project files recursively
        const scanDirectory = async (dir) => {
            try {
                const items = await fs.readdir(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = await fs.stat(fullPath);
                    if (stat.isDirectory()) {
                        // Skip common ignore directories
                        if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
                            await scanDirectory(fullPath);
                        }
                    }
                    else if (stat.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (ext) {
                            fileExtensions.add(ext);
                            // Map extensions to languages
                            const langMapping = {
                                '.ts': 'typescript',
                                '.tsx': 'typescript',
                                '.js': 'javascript',
                                '.jsx': 'javascript',
                                '.py': 'python',
                                '.java': 'java',
                                '.cs': 'csharp',
                                '.go': 'go',
                                '.rs': 'rust',
                                '.cpp': 'cpp',
                                '.c': 'c'
                            };
                            const language = langMapping[ext];
                            if (language) {
                                languageMap.set(language, (languageMap.get(language) || 0) + 1);
                            }
                        }
                    }
                }
            }
            catch (error) {
                // Skip directories we can't read
            }
        };
        await scanDirectory(projectPath);
        const detectedLanguages = Array.from(languageMap.keys()).sort((a, b) => (languageMap.get(b) || 0) - (languageMap.get(a) || 0));
        console.log(`  ✅ Found ${fileExtensions.size} file types, ${detectedLanguages.length} programming languages`);
        return {
            detectedLanguages,
            selectedLanguages: detectedLanguages,
            installedPackages: [],
            errors: []
        };
    }
    /**
     * Perform complete project analysis using semantic enhancement engine
     */
    async performCompleteAnalysis(projectPath) {
        console.log('  🧠 Initializing semantic analysis...');
        try {
            // Import and initialize semantic enhancement engine
            const { SemanticEnhancementEngine } = await Promise.resolve().then(() => __importStar(require('../../shared/semantic-enhancement-engine')));
            const semanticEngine = new SemanticEnhancementEngine();
            console.log('  📊 Analyzing project structure and dependencies...');
            // Use the semantic engine to analyze the project
            const analysisResult = await semanticEngine.enhanceQuery(`Analyze project structure for ${projectPath}`, 50, // Primary files limit
            100 // Related files limit
            );
            console.log(`  ✅ Analyzed ${analysisResult.totalFiles} files`);
            return {
                architecture: {
                    type: this.detectArchitectureType(analysisResult),
                    patterns: this.extractArchitecturePatterns(analysisResult),
                    frameworks: this.detectFrameworks(analysisResult)
                },
                dependencies: {
                    files: [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])],
                    totalFiles: analysisResult.totalFiles || 0
                },
                useCases: this.extractUseCases(analysisResult),
                semanticData: analysisResult
            };
        }
        catch (error) {
            console.log(`  ⚠️ Full analysis failed, using basic analysis: ${error.message}`);
            // Fallback to basic analysis
            return {
                architecture: { type: 'unknown' },
                dependencies: { files: [], totalFiles: 0 },
                useCases: [],
                semanticData: null
            };
        }
    }
    /**
     * Populate databases with complete analysis data
     */
    async populateDatabases(projectPath, projectId, analysis, languageSetup) {
        console.log('  🗃️ Storing embeddings and semantic data...');
        let embeddingsCreated = 0;
        let analysesCreated = 0;
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            // If we have semantic data, store it
            if (analysis.semanticData) {
                const allFiles = [...(analysis.semanticData.primaryFiles || []), ...(analysis.semanticData.relatedFiles || [])];
                for (const file of allFiles) {
                    try {
                        // Store file embedding
                        await pgClient.query(`
              INSERT INTO semantic_search_embeddings (
                project_id, file_path, content_hash, content_type,
                content_text, embedding, metadata, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                            projectId,
                            file.filePath,
                            file.hash || 'unknown',
                            require('path').extname(file.filePath) || 'unknown',
                            file.content?.substring(0, 1000) || '',
                            file.embedding || null,
                            JSON.stringify({
                                language: file.language || 'unknown',
                                size: file.content?.length || 0,
                                functions: file.functions || [],
                                classes: file.classes || [],
                                relevanceScore: file.relevanceScore || 0
                            })
                        ]);
                        embeddingsCreated++;
                        // Store analysis result
                        await pgClient.query(`
              INSERT INTO analysis_results (
                project_id, file_path, analysis_type, file_hash,
                analysis_result, confidence_score, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [
                            projectId,
                            file.filePath,
                            'architecture',
                            file.hash || 'unknown',
                            JSON.stringify({
                                architecture: analysis.architecture,
                                dependencies: file.dependencies || [],
                                exports: file.exports || [],
                                imports: file.imports || [],
                                functions: file.functions || [],
                                classes: file.classes || []
                            }),
                            file.relevanceScore || 0.5
                        ]);
                        analysesCreated++;
                    }
                    catch (fileError) {
                        console.log(`    ⚠️ Failed to store data for ${file.filePath}: ${fileError.message}`);
                    }
                }
            }
            console.log(`  ✅ Stored ${embeddingsCreated} embeddings, ${analysesCreated} analyses`);
        }
        catch (error) {
            console.log(`  ⚠️ Database population failed: ${error.message}`);
        }
        return {
            embeddings: { created: embeddingsCreated },
            analysisResults: { created: analysesCreated },
            techStack: {
                languages: languageSetup.selectedLanguages,
                frameworks: analysis.architecture?.frameworks || []
            }
        };
    }
    // Helper methods for analysis
    detectArchitectureType(analysisResult) {
        if (!analysisResult?.primaryFiles && !analysisResult?.relatedFiles)
            return 'unknown';
        const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
        const hasControllers = files.some((f) => f.filePath?.includes('controller'));
        const hasServices = files.some((f) => f.filePath?.includes('service'));
        const hasModels = files.some((f) => f.filePath?.includes('model'));
        const hasAPI = files.some((f) => f.filePath?.includes('api'));
        if (hasAPI || (hasControllers && hasServices))
            return 'api_service';
        if (hasControllers || hasServices || hasModels)
            return 'web_app';
        return 'library';
    }
    extractArchitecturePatterns(analysisResult) {
        const patterns = [];
        const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
        if (files.some((f) => f.filePath?.includes('layer'))) {
            patterns.push('layered-architecture');
        }
        return patterns;
    }
    detectFrameworks(analysisResult) {
        const frameworks = [];
        const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
        if (files.some((f) => f.content?.includes('express'))) {
            frameworks.push('express');
        }
        if (files.some((f) => f.content?.includes('react'))) {
            frameworks.push('react');
        }
        return frameworks;
    }
    extractUseCases(analysisResult) {
        // Basic use case extraction - could be enhanced
        const useCases = [];
        const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
        if (files.length > 0) {
            const apiFiles = files.filter((f) => f.filePath?.includes('api') || f.filePath?.includes('controller'));
            useCases.push(...apiFiles.map((f) => ({
                name: `API: ${require('path').basename(f.filePath, require('path').extname(f.filePath))}`,
                type: 'api_endpoint',
                file: f.filePath
            })));
        }
        return useCases;
    }
}
exports.ProjectManager = ProjectManager;
//# sourceMappingURL=ProjectManager.js.map