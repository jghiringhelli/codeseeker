"use strict";
/**
 * PostgreSQL Initializer for /init workflow
 * Populates all required tables during project initialization
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLInitializer = void 0;
const logger_1 = require("../../../utils/logger");
const database_config_1 = require("../../../config/database-config");
const embedding_service_1 = require("../embedding-service");
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class PostgreSQLInitializer {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    embeddingService;
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
        // Use TensorFlow.js for high-quality semantic embeddings
        this.embeddingService = new embedding_service_1.EmbeddingService({
            batchSize: 25, // Slightly smaller batches for TensorFlow processing
            maxTokens: 6000 // Optimal for Universal Sentence Encoder
        });
    }
    /**
     * Complete PostgreSQL initialization for a project
     */
    async initializeProject(projectId, projectPath, languageSetup) {
        this.logger.info('📊 Initializing PostgreSQL data for project...');
        const result = {
            embeddings: { created: 0, updated: 0, errors: 0 },
            analysisResults: { created: 0, errors: 0 },
            techStack: { detected: false, languages: [], frameworks: [], dependencies: {} },
            progress: { phase: 'starting', percentage: 0 }
        };
        try {
            // Step 1: Initialize progress tracking
            await this.initializeProgressTracking(projectId, result);
            // Step 2: Detect and store tech stack
            await this.detectTechStack(projectId, projectPath, languageSetup, result);
            // Step 3: Generate semantic embeddings  
            await this.generateSemanticEmbeddings(projectId, projectPath, result);
            // Step 4: Run file analysis
            await this.runFileAnalysis(projectId, projectPath, result);
            // Step 5: Complete initialization
            await this.completeInitialization(projectId, result);
            this.logger.info(`✅ PostgreSQL initialization complete for project ${projectId}`);
            this.logger.info(`📊 Stats: ${result.embeddings.created} embeddings, ${result.analysisResults.created} analyses`);
        }
        catch (error) {
            this.logger.error(`❌ PostgreSQL initialization failed: ${error.message}`);
            await this.markInitializationFailed(projectId, error.message);
            throw error;
        }
        return result;
    }
    /**
     * Initialize progress tracking for resumable processing
     */
    async initializeProgressTracking(projectId, result) {
        const pgClient = await this.dbConnections.getPostgresConnection();
        // Generate unique resume token for this initialization
        const resumeToken = `init_${projectId}_${Date.now()}`;
        await pgClient.query(`
      INSERT INTO initialization_progress (
        project_id, phase, resume_token, progress_data, tech_stack_data
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id) DO UPDATE SET
        phase = EXCLUDED.phase,
        resume_token = EXCLUDED.resume_token,
        progress_data = EXCLUDED.progress_data,
        tech_stack_data = EXCLUDED.tech_stack_data,
        updated_at = NOW()
    `, [
            projectId,
            'deep_analysis',
            resumeToken,
            JSON.stringify({
                phase: 'initialization',
                percentage: 0,
                step: 'tech_stack_detection',
                startTime: new Date().toISOString()
            }),
            JSON.stringify({})
        ]);
        result.progress = { phase: 'initialization', percentage: 0, resumeToken };
    }
    /**
     * Detect tech stack and store in database
     */
    async detectTechStack(projectId, projectPath, languageSetup, result) {
        this.logger.info('🔍 Detecting tech stack...');
        const detectedFrameworks = await this.detectFrameworks(projectPath);
        const detectedDependencies = await this.detectDependencies(projectPath);
        // Convert language array to JSONB object with percentages
        const languagesObject = {};
        for (const langStats of languageSetup.detectedLanguages) {
            languagesObject[langStats.language] = langStats.percentage;
        }
        // Convert frameworks array to JSONB object
        const frameworksObject = {};
        for (const framework of detectedFrameworks) {
            frameworksObject[framework] = []; // Will be populated with files that use this framework
        }
        const pgClient = await this.dbConnections.getPostgresConnection();
        // Check if tech stack already exists for this project
        const existingTechStack = await pgClient.query('SELECT id FROM tech_stack_detections WHERE project_id = $1', [projectId]);
        if (existingTechStack.rows.length > 0) {
            // Update existing record
            await pgClient.query(`
        UPDATE tech_stack_detections SET
          languages = $2,
          frameworks = $3,
          linters = $4,
          formatters = $5,
          dependencies = $6,
          detection_confidence = $7,
          file_count_analyzed = $8,
          last_scan = NOW()
        WHERE project_id = $1
      `, [
                projectId,
                JSON.stringify(languagesObject),
                JSON.stringify(frameworksObject),
                JSON.stringify(await this.detectLinters(projectPath)),
                JSON.stringify(await this.detectFormatters(projectPath)),
                JSON.stringify(detectedDependencies),
                0.9, // High confidence from language setup
                languageSetup.detectedLanguages.reduce((sum, lang) => sum + lang.fileCount, 0)
            ]);
        }
        else {
            // Insert new record
            await pgClient.query(`
        INSERT INTO tech_stack_detections (
          project_id, project_path, languages, frameworks, linters, formatters,
          dependencies, detection_confidence, file_count_analyzed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
                projectId,
                projectPath,
                JSON.stringify(languagesObject),
                JSON.stringify(frameworksObject),
                JSON.stringify(await this.detectLinters(projectPath)),
                JSON.stringify(await this.detectFormatters(projectPath)),
                JSON.stringify(detectedDependencies),
                0.9, // High confidence from language setup
                languageSetup.detectedLanguages.reduce((sum, lang) => sum + lang.fileCount, 0)
            ]);
        }
        result.techStack = {
            detected: true,
            languages: languageSetup.selectedLanguages,
            frameworks: detectedFrameworks,
            dependencies: detectedDependencies
        };
        // Update progress
        await this.updateProgress(projectId, 'tech_stack_detection', 25);
        result.progress.percentage = 25;
    }
    /**
     * Generate semantic embeddings for all code files using EmbeddingService
     */
    async generateSemanticEmbeddings(projectId, projectPath, result) {
        this.logger.info('🔍 Generating semantic embeddings with lightweight local algorithm...');
        const codeFiles = await this.discoverCodeFiles(projectPath);
        // Use EmbeddingService for efficient batch processing
        const embeddingResult = await this.embeddingService.generateProjectEmbeddings(projectId, codeFiles, (progress, currentFile) => {
            // Update progress in real-time
            const adjustedProgress = 25 + Math.round((progress / 100) * 50);
            this.updateProgress(projectId, 'semantic_embeddings', adjustedProgress).catch(() => {
                // Ignore progress update errors
            });
            result.progress.percentage = adjustedProgress;
            // Log every 10% progress
            if (progress % 10 === 0) {
                this.logger.info(`📊 Embedding progress: ${progress}% (${currentFile})`);
            }
        });
        // Update result with actual numbers from EmbeddingService
        result.embeddings.created = embeddingResult.success;
        result.embeddings.errors = embeddingResult.errors;
        this.logger.info(`✅ Generated ${result.embeddings.created} semantic embeddings (${embeddingResult.skipped} skipped, ${embeddingResult.errors} errors)`);
    }
    /**
     * Run file analysis for patterns, dependencies, quality
     */
    async runFileAnalysis(projectId, projectPath, result) {
        this.logger.info('🔍 Running file analysis...');
        const codeFiles = await this.discoverCodeFiles(projectPath);
        const pgClient = await this.dbConnections.getPostgresConnection();
        let processed = 0;
        for (const filePath of codeFiles) {
            try {
                await this.analyzeFile(projectId, projectPath, filePath, pgClient);
                result.analysisResults.created++;
                processed++;
                // Update progress
                if (processed % 5 === 0) {
                    const progress = 75 + Math.round((processed / codeFiles.length) * 20);
                    await this.updateProgress(projectId, 'file_analysis', progress);
                    result.progress.percentage = progress;
                }
            }
            catch (error) {
                this.logger.warn(`Failed to analyze ${filePath}: ${error.message}`);
                result.analysisResults.errors++;
            }
        }
        this.logger.info(`✅ Analyzed ${result.analysisResults.created} files`);
    }
    /**
     * Complete initialization and update progress
     */
    async completeInitialization(projectId, result) {
        const pgClient = await this.dbConnections.getPostgresConnection();
        await pgClient.query(`
      UPDATE initialization_progress 
      SET 
        phase = 'completed',
        progress_data = jsonb_set(
          COALESCE(progress_data, '{}'), 
          '{completion_stats}', 
          $2::jsonb
        ),
        tech_stack_data = jsonb_set(
          COALESCE(tech_stack_data, '{}'),
          '{final_stats}',
          $3::jsonb
        ),
        updated_at = NOW()
      WHERE project_id = $1
    `, [
            projectId,
            JSON.stringify({
                phase: 'completed',
                percentage: 100,
                embeddings_created: result.embeddings.created,
                analysis_results: result.analysisResults.created,
                completion_time: new Date().toISOString()
            }),
            JSON.stringify({
                languages: result.techStack.languages,
                frameworks: result.techStack.frameworks,
                dependencies_count: Object.keys(result.techStack.dependencies).length
            })
        ]);
        result.progress = { phase: 'completed', percentage: 100 };
    }
    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================
    async discoverCodeFiles(projectPath) {
        return await (0, fast_glob_1.default)([
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
            '**/*.cs', '**/*.go', '**/*.rs'
        ], {
            cwd: projectPath,
            absolute: true,
            ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/coverage/**'
            ]
        });
    }
    async analyzeFile(projectId, projectPath, filePath, pgClient) {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        const fileHash = (0, crypto_1.createHash)('sha256').update(content).digest('hex');
        // Basic dependency analysis
        const dependencies = this.extractDependencies(content, relativePath);
        // Check if analysis already exists
        const existingAnalysis = await pgClient.query('SELECT id FROM analysis_results WHERE project_id = $1 AND file_path = $2 AND analysis_type = $3', [projectId, relativePath, 'dependency']);
        if (existingAnalysis.rows.length > 0) {
            // Update existing record
            await pgClient.query(`
        UPDATE analysis_results SET
          file_hash = $4,
          analysis_result = $5,
          confidence_score = $6,
          created_at = NOW()
        WHERE project_id = $1 AND file_path = $2 AND analysis_type = $3
      `, [
                projectId,
                relativePath,
                'dependency',
                fileHash,
                JSON.stringify({
                    imports: dependencies.imports,
                    exports: dependencies.exports,
                    dependencies: dependencies.dependencies
                }),
                0.8
            ]);
        }
        else {
            // Insert new record
            await pgClient.query(`
        INSERT INTO analysis_results (
          project_id, file_path, file_hash, analysis_type, 
          analysis_result, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                projectId,
                relativePath,
                fileHash,
                'dependency',
                JSON.stringify({
                    imports: dependencies.imports,
                    exports: dependencies.exports,
                    dependencies: dependencies.dependencies
                }),
                0.8
            ]);
        }
    }
    async detectFrameworks(projectPath) {
        const frameworks = [];
        try {
            // Check package.json for frameworks
            const packagePath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (deps.react)
                frameworks.push('React');
            if (deps.vue)
                frameworks.push('Vue');
            if (deps.angular)
                frameworks.push('Angular');
            if (deps.express)
                frameworks.push('Express');
            if (deps.nextjs || deps.next)
                frameworks.push('Next.js');
            if (deps.typescript)
                frameworks.push('TypeScript');
        }
        catch (error) {
            // No package.json or parsing error
        }
        // TODO: Check for other framework indicators (Python requirements.txt, etc.)
        return frameworks;
    }
    async detectLinters(projectPath) {
        const linters = [];
        try {
            // Check package.json for linter dependencies
            const packagePath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (allDeps.eslint)
                linters.push('ESLint');
            if (allDeps.tslint)
                linters.push('TSLint');
            if (allDeps.jshint)
                linters.push('JSHint');
            if (allDeps.jslint)
                linters.push('JSLint');
            if (allDeps.stylelint)
                linters.push('StyleLint');
            if (allDeps.htmlhint)
                linters.push('HTMLHint');
        }
        catch (error) {
            // No package.json
        }
        // Check for config files
        const configFiles = [
            '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc',
            'tslint.json', '.jshintrc', '.stylelintrc.json', '.stylelintrc.js'
        ];
        for (const configFile of configFiles) {
            try {
                await fs.access(path.join(projectPath, configFile));
                if (configFile.includes('eslint'))
                    linters.push('ESLint');
                if (configFile.includes('tslint'))
                    linters.push('TSLint');
                if (configFile.includes('jshint'))
                    linters.push('JSHint');
                if (configFile.includes('stylelint'))
                    linters.push('StyleLint');
            }
            catch (error) {
                // Config file doesn't exist
            }
        }
        // Check for Python linters
        try {
            const requirementsFiles = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml'];
            for (const reqFile of requirementsFiles) {
                const content = await fs.readFile(path.join(projectPath, reqFile), 'utf-8');
                if (content.includes('flake8'))
                    linters.push('Flake8');
                if (content.includes('pylint'))
                    linters.push('Pylint');
                if (content.includes('mypy'))
                    linters.push('MyPy');
                if (content.includes('black'))
                    linters.push('Black');
            }
        }
        catch (error) {
            // No Python requirements files
        }
        return [...new Set(linters)];
    }
    async detectFormatters(projectPath) {
        const formatters = [];
        try {
            // Check package.json for formatter dependencies
            const packagePath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (allDeps.prettier)
                formatters.push('Prettier');
            if (allDeps['js-beautify'])
                formatters.push('JS Beautify');
            if (allDeps['css-beautify'])
                formatters.push('CSS Beautify');
        }
        catch (error) {
            // No package.json
        }
        // Check for config files
        const configFiles = [
            '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yml', '.prettierrc.yaml',
            'prettier.config.js', '.prettierignore'
        ];
        for (const configFile of configFiles) {
            try {
                await fs.access(path.join(projectPath, configFile));
                formatters.push('Prettier');
                break;
            }
            catch (error) {
                // Config file doesn't exist
            }
        }
        // Check for Python formatters
        try {
            const requirementsFiles = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml'];
            for (const reqFile of requirementsFiles) {
                const content = await fs.readFile(path.join(projectPath, reqFile), 'utf-8');
                if (content.includes('black'))
                    formatters.push('Black');
                if (content.includes('autopep8'))
                    formatters.push('Autopep8');
                if (content.includes('yapf'))
                    formatters.push('YAPF');
            }
        }
        catch (error) {
            // No Python requirements files
        }
        // Check for .editorconfig
        try {
            await fs.access(path.join(projectPath, '.editorconfig'));
            formatters.push('EditorConfig');
        }
        catch (error) {
            // No .editorconfig
        }
        return [...new Set(formatters)];
    }
    async detectDependencies(projectPath) {
        const dependencies = {};
        try {
            // Node.js dependencies
            const packagePath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            Object.assign(dependencies, packageJson.dependencies || {});
        }
        catch (error) {
            // No package.json
        }
        // Python dependencies
        try {
            const requirementsContent = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
            const pythonDeps = requirementsContent.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .reduce((deps, line) => {
                const [name, version] = line.split('==');
                if (name) {
                    deps[name.trim()] = version ? version.trim() : 'latest';
                }
                return deps;
            }, {});
            Object.assign(dependencies, pythonDeps);
        }
        catch (error) {
            // No requirements.txt
        }
        return dependencies;
    }
    extractDependencies(content, filePath) {
        const lines = content.split('\n');
        const imports = [];
        const exports = [];
        const dependencies = [];
        for (const line of lines) {
            const trimmed = line.trim();
            // Extract imports
            const importMatch = trimmed.match(/^import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/);
            if (importMatch) {
                imports.push(importMatch[1]);
                if (importMatch[1].startsWith('./') || importMatch[1].startsWith('../')) {
                    dependencies.push(importMatch[1]);
                }
            }
            // Extract exports
            if (trimmed.startsWith('export')) {
                const exportMatch = trimmed.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/);
                if (exportMatch) {
                    exports.push(exportMatch[1]);
                }
            }
        }
        return { imports, exports, dependencies };
    }
    async updateProgress(projectId, step, percentage) {
        const pgClient = await this.dbConnections.getPostgresConnection();
        await pgClient.query(`
      UPDATE initialization_progress 
      SET 
        progress_data = jsonb_set(
          COALESCE(progress_data, '{}'),
          '{current_step}',
          $2::jsonb
        ) ||
        jsonb_set(
          COALESCE(progress_data, '{}'),
          '{percentage}',
          $3::jsonb
        ),
        updated_at = NOW()
      WHERE project_id = $1
    `, [projectId, JSON.stringify(step), JSON.stringify(percentage)]);
    }
    async markInitializationFailed(projectId, errorMessage) {
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            await pgClient.query(`
        UPDATE initialization_progress 
        SET 
          phase = 'deep_analysis',
          error_log = error_log || $2::jsonb,
          progress_data = jsonb_set(
            COALESCE(progress_data, '{}'),
            '{failed}',
            'true'::jsonb
          ) ||
          jsonb_set(
            COALESCE(progress_data, '{}'),
            '{error_message}',
            $3::jsonb
          ),
          updated_at = NOW()
        WHERE project_id = $1
      `, [
                projectId,
                JSON.stringify([{
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                        phase: 'initialization'
                    }]),
                JSON.stringify(errorMessage)
            ]);
        }
        catch (error) {
            this.logger.error(`Failed to mark initialization as failed: ${error.message}`);
        }
    }
}
exports.PostgreSQLInitializer = PostgreSQLInitializer;
//# sourceMappingURL=postgresql-initializer.js.map