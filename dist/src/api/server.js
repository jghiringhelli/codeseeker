"use strict";
/**
 * REST API Server for Claude Code Integration
 * Token-efficient endpoints for the Intelligent Code Auxiliary System
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const factory_1 = require("../database/factory");
const file_system_1 = require("../utils/file-system");
const cache_1 = require("../utils/cache");
const hash_1 = require("../utils/hash");
const logger_1 = require("../utils/logger");
const types_1 = require("../core/types");
const path_1 = require("path");
const fs_1 = require("fs");
class APIServer {
    app;
    dbManager;
    fsHelper;
    cache;
    logger;
    port;
    isDev;
    constructor() {
        this.app = (0, express_1.default)();
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'API');
        this.port = parseInt(process.env.PORT || '3000', 10);
        this.isDev = process.argv.includes('--dev');
        // Initialize services
        this.initializeServices();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    initializeServices() {
        // Parse database configuration from environment
        const dbConfig = factory_1.DatabaseFactory.parseConfigFromEnv();
        // Override for development mode
        if (this.isDev && dbConfig.type === 'sqlite') {
            dbConfig.path = ':memory:';
        }
        // Ensure data directory exists for SQLite production
        if (dbConfig.type === 'sqlite' && dbConfig.path && dbConfig.path !== ':memory:') {
            const dataDir = (0, path_1.dirname)(dbConfig.path);
            if (!(0, fs_1.existsSync)(dataDir)) {
                (0, fs_1.mkdirSync)(dataDir, { recursive: true });
            }
        }
        this.dbManager = factory_1.DatabaseFactory.create(dbConfig, this.logger);
        this.fsHelper = new file_system_1.FileSystemHelper(this.logger);
        this.cache = new cache_1.InMemoryCacheManager({
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            maxSize: 1000,
            logger: this.logger
        });
    }
    setupMiddleware() {
        // CORS
        this.app.use((0, cors_1.default)({
            origin: this.isDev ? true : ['http://localhost:*'],
            credentials: true
        }));
        // JSON parsing with size limit
        this.app.use(express_1.default.json({ limit: '1mb' }));
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, { ip: req.ip });
            next();
        });
        // Response time header
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                try {
                    res.setHeader('X-Response-Time', `${duration}ms`);
                }
                catch (error) {
                    // Headers already sent, ignore
                }
            });
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', this.handleHealth.bind(this));
        // Quick stats (minimal tokens)
        this.app.get('/stats', this.handleStats.bind(this));
        // Project analysis (token-optimized)
        this.app.post('/analyze', this.handleAnalyze.bind(this));
        // Initialize project
        this.app.post('/init', this.handleInit.bind(this));
        // Get patterns for project
        this.app.get('/patterns/:projectPath(*)', this.handleGetPatterns.bind(this));
        // Save questionnaire response
        this.app.post('/questionnaire', this.handleQuestionnaire.bind(this));
        // Get project suggestions (AI-friendly format)
        this.app.get('/suggestions/:projectPath(*)', this.handleSuggestions.bind(this));
        // Claude-specific endpoints
        this.app.post('/claude/context', this.handleClaudeContext.bind(this));
        this.app.post('/claude/validate', this.handleClaudeValidate.bind(this));
        this.app.get('/claude/guidance/:projectPath(*)', this.handleClaudeGuidance.bind(this));
        // Cache management
        this.app.delete('/cache', this.handleClearCache.bind(this));
        // Database operations
        this.app.get('/db/stats', this.handleDBStats.bind(this));
        // Project management endpoints
        this.app.get('/projects', this.handleListProjects.bind(this));
        this.app.get('/projects/:projectId', this.handleGetProject.bind(this));
        this.app.put('/projects/:projectId', this.handleUpdateProject.bind(this));
        this.app.delete('/projects/:projectId', this.handleDeleteProject.bind(this));
        // Project path management
        this.app.post('/projects/:projectId/paths', this.handleAddProjectPath.bind(this));
        this.app.put('/projects/:projectId/paths', this.handleUpdateProjectPath.bind(this));
        this.app.get('/projects/:projectId/paths', this.handleGetProjectPaths.bind(this));
        this.app.delete('/projects/:projectId/paths', this.handleDeactivateProjectPath.bind(this));
    }
    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            this.sendError(res, 'Endpoint not found', 404);
        });
        // Error handler
        this.app.use((error, req, res, next) => {
            this.logger.error('API Error', error);
            this.sendError(res, 'Internal server error', 500);
        });
    }
    // Route handlers (token-efficient)
    async handleHealth(req, res) {
        const uptime = process.uptime();
        this.sendSuccess(res, {
            status: 'healthy',
            uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
            version: '1.0.0'
        });
    }
    async handleStats(req, res) {
        try {
            const cacheKey = 'quick-stats';
            let stats = await this.cache.get(cacheKey);
            if (!stats) {
                const dbStats = await this.dbManager.getDatabaseStats();
                const cacheStats = await this.cache.getStats();
                stats = {
                    projects: dbStats.initialization_progress || 0,
                    patterns: dbStats.detected_patterns || 0,
                    analyses: dbStats.analysis_results || 0,
                    uptime: `${Math.floor(process.uptime() / 60)}m`,
                    cache: `${cacheStats.size}/${cacheStats.maxSize}`,
                    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
                };
                await this.cache.set(cacheKey, stats, 30000); // 30 second cache
            }
            this.sendSuccess(res, stats, !!stats.cached);
        }
        catch (error) {
            this.sendError(res, 'Failed to get stats');
        }
    }
    async handleAnalyze(req, res) {
        try {
            const { projectPath, includePatterns = true, includeProgress = true, maxResults = 5 } = req.body;
            if (!projectPath) {
                this.sendError(res, 'projectPath is required', 400);
                return;
            }
            const cacheKey = `analysis:${hash_1.HashUtils.shortHash(projectPath)}`;
            let result = await this.cache.get(cacheKey);
            if (!result) {
                // Analyze project structure
                const files = await this.fsHelper.getAllFiles(projectPath, ['.ts', '.js', '.py', '.java']);
                const projectSize = this.categorizeProjectSize(files.length);
                const languages = this.detectLanguages(files);
                const projectType = this.inferProjectType(projectPath, files);
                result = {
                    project: {
                        path: projectPath,
                        type: projectType,
                        size: projectSize,
                        languages,
                        fileCount: files.length
                    }
                };
                // Add patterns if requested
                if (includePatterns) {
                    const patterns = await this.dbManager.getDetectedPatterns(projectPath);
                    const topPatterns = patterns
                        .filter(p => p.patternType === types_1.PatternType.ARCHITECTURE)
                        .slice(0, maxResults)
                        .map(p => p.patternName);
                    result.patterns = {
                        architecture: topPatterns,
                        confidence: patterns.length > 0 ? patterns[0]?.confidence || 0 : 0
                    };
                }
                // Add progress if requested
                if (includeProgress) {
                    const progress = await this.dbManager.getInitializationProgress(projectPath);
                    if (progress) {
                        const completion = Math.round((progress.progressData.processedFiles / progress.progressData.totalFiles) * 100);
                        result.progress = {
                            phase: progress.phase,
                            completion,
                            eta: this.calculateETA(progress.progressData)
                        };
                    }
                }
                // Generate recommendations
                result.recommendations = this.generateRecommendations(result.project, result.patterns);
                await this.cache.set(cacheKey, result, 2 * 60 * 1000); // 2 minute cache
            }
            this.sendSuccess(res, result, !!result.cached);
        }
        catch (error) {
            this.logger.error('Analysis failed', error);
            this.sendError(res, 'Analysis failed');
        }
    }
    async handleInit(req, res) {
        try {
            const { projectPath, mode = 'auto' } = req.body;
            if (!projectPath) {
                this.sendError(res, 'projectPath is required', 400);
                return;
            }
            // Check if already initialized
            let progress = await this.dbManager.getInitializationProgress(projectPath);
            if (!progress) {
                // Create new initialization
                const files = await this.fsHelper.getAllFiles(projectPath);
                progress = await this.dbManager.saveInitializationProgress({
                    projectPath,
                    phase: types_1.InitPhase.PROJECT_DISCOVERY,
                    resumeToken: hash_1.HashUtils.generateToken(32),
                    progressData: {
                        totalFiles: files.length,
                        processedFiles: 0,
                        skippedFiles: 0,
                        errorFiles: 0,
                        batchSize: 50,
                        processingStartTime: new Date()
                    }
                });
            }
            const response = {
                initialized: true,
                resumeToken: progress.resumeToken,
                phase: progress.phase,
                totalFiles: progress.progressData.totalFiles,
                nextSteps: this.getNextSteps(progress.phase)
            };
            this.sendSuccess(res, response);
        }
        catch (error) {
            this.logger.error('Initialization failed', error);
            this.sendError(res, 'Initialization failed');
        }
    }
    async handleGetPatterns(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const patterns = await this.dbManager.getDetectedPatterns(projectPath);
            const response = {
                total: patterns.length,
                architecture: patterns.filter(p => p.patternType === types_1.PatternType.ARCHITECTURE),
                design: patterns.filter(p => p.patternType === types_1.PatternType.DESIGN_PATTERN),
                standards: patterns.filter(p => p.patternType === types_1.PatternType.CODING_STANDARD)
            };
            this.sendSuccess(res, response);
        }
        catch (error) {
            this.sendError(res, 'Failed to get patterns');
        }
    }
    async handleQuestionnaire(req, res) {
        try {
            const { projectPath, category, questionId, response: userResponse } = req.body;
            if (!projectPath || !category || !questionId || !userResponse) {
                this.sendError(res, 'Missing required fields', 400);
                return;
            }
            const response = await this.dbManager.saveQuestionnaireResponse({
                projectPath,
                category: category,
                questionId,
                response: userResponse,
                metadata: { timestamp: new Date().toISOString() }
            });
            this.sendSuccess(res, { saved: true, id: response.id });
        }
        catch (error) {
            this.sendError(res, 'Failed to save response');
        }
    }
    async handleSuggestions(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const cacheKey = `suggestions:${hash_1.HashUtils.shortHash(projectPath)}`;
            let suggestions = await this.cache.get(cacheKey);
            if (!suggestions) {
                const patterns = await this.dbManager.getDetectedPatterns(projectPath);
                const responses = await this.dbManager.getQuestionnaireResponses(projectPath);
                suggestions = this.generateContextualSuggestions(patterns, responses);
                await this.cache.set(cacheKey, suggestions, 10 * 60 * 1000); // 10 minute cache
            }
            this.sendSuccess(res, suggestions, !!suggestions.cached);
        }
        catch (error) {
            this.sendError(res, 'Failed to generate suggestions');
        }
    }
    async handleClearCache(req, res) {
        await this.cache.clear();
        this.sendSuccess(res, { cleared: true });
    }
    async handleDBStats(req, res) {
        try {
            const stats = await this.dbManager.getDatabaseStats();
            this.sendSuccess(res, stats);
        }
        catch (error) {
            this.sendError(res, 'Failed to get database stats');
        }
    }
    // Claude-specific handlers (token-optimized)
    async handleClaudeContext(req, res) {
        try {
            const { projectPath, operation, filePatterns = [] } = req.body;
            if (!projectPath) {
                this.sendError(res, 'projectPath is required', 400);
                return;
            }
            const cacheKey = `claude-context:${hash_1.HashUtils.shortHash(projectPath + operation)}`;
            let context = await this.cache.get(cacheKey);
            if (!context) {
                // Get minimal context for Claude
                const patterns = await this.dbManager.getDetectedPatterns(projectPath);
                const progress = await this.dbManager.getInitializationProgress(projectPath);
                context = {
                    status: progress?.phase || 'not_initialized',
                    architecture: patterns.filter(p => p.patternType === types_1.PatternType.ARCHITECTURE).slice(0, 3),
                    standards: patterns.filter(p => p.patternType === types_1.PatternType.CODING_STANDARD).slice(0, 3),
                    recommendations: this.generateClaudeRecommendations(patterns, operation),
                    nextActions: this.getClaudeNextActions(progress?.phase)
                };
                await this.cache.set(cacheKey, context, 5 * 60 * 1000); // 5 minute cache
            }
            this.sendSuccess(res, context, !!context.cached);
        }
        catch (error) {
            this.logger.error('Claude context request failed', error);
            this.sendError(res, 'Failed to get context');
        }
    }
    async handleClaudeValidate(req, res) {
        try {
            const { projectPath, code, language, operation } = req.body;
            if (!projectPath || !code) {
                this.sendError(res, 'projectPath and code are required', 400);
                return;
            }
            // Quick validation based on detected patterns
            const patterns = await this.dbManager.getDetectedPatterns(projectPath);
            const validation = this.validateCodeAgainstPatterns(code, patterns, language);
            this.sendSuccess(res, validation);
        }
        catch (error) {
            this.sendError(res, 'Validation failed');
        }
    }
    async handleClaudeGuidance(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const { task } = req.query;
            const cacheKey = `claude-guidance:${hash_1.HashUtils.shortHash(projectPath + task)}`;
            let guidance = await this.cache.get(cacheKey);
            if (!guidance) {
                const patterns = await this.dbManager.getDetectedPatterns(projectPath);
                const responses = await this.dbManager.getQuestionnaireResponses(projectPath);
                guidance = {
                    patterns: this.formatPatternsForClaude(patterns),
                    conventions: this.extractConventions(responses),
                    bestPractices: this.getTaskSpecificGuidance(task, patterns),
                    warnings: this.getClaudeWarnings(patterns)
                };
                await this.cache.set(cacheKey, guidance, 15 * 60 * 1000); // 15 minute cache
            }
            this.sendSuccess(res, guidance, !!guidance.cached);
        }
        catch (error) {
            this.sendError(res, 'Failed to get guidance');
        }
    }
    // Helper methods
    categorizeProjectSize(fileCount) {
        if (fileCount < 100)
            return types_1.ProjectSize.SMALL;
        if (fileCount < 1000)
            return types_1.ProjectSize.MEDIUM;
        if (fileCount < 10000)
            return types_1.ProjectSize.LARGE;
        return types_1.ProjectSize.ENTERPRISE;
    }
    detectLanguages(files) {
        const extensions = new Set(files.map(f => this.fsHelper.getFileExtension(f)));
        const langMap = {
            '.ts': 'TypeScript',
            '.js': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust'
        };
        return Array.from(extensions).map(ext => langMap[ext]).filter((lang) => Boolean(lang));
    }
    inferProjectType(projectPath, files) {
        const hasPackageJson = files.some(f => f.includes('package.json'));
        const hasReactFiles = files.some(f => f.includes('.tsx') || f.includes('react'));
        const hasExpressFiles = files.some(f => f.includes('express') || f.includes('server'));
        if (hasReactFiles)
            return types_1.ProjectType.WEB_APPLICATION;
        if (hasExpressFiles)
            return types_1.ProjectType.API_SERVICE;
        if (hasPackageJson)
            return types_1.ProjectType.WEB_APPLICATION;
        return types_1.ProjectType.UNKNOWN;
    }
    calculateETA(progressData) {
        const { totalFiles, processedFiles, processingStartTime } = progressData;
        if (processedFiles === 0)
            return 'unknown';
        const elapsed = Date.now() - new Date(processingStartTime).getTime();
        const rate = processedFiles / elapsed;
        const remaining = totalFiles - processedFiles;
        const eta = remaining / rate;
        return `${Math.round(eta / 1000 / 60)}m`;
    }
    generateRecommendations(project, patterns) {
        const recommendations = [];
        if (project.fileCount > 1000) {
            recommendations.push('Consider implementing modular architecture for better maintainability');
        }
        if (!patterns || patterns.architecture.length === 0) {
            recommendations.push('Run pattern analysis to identify architectural improvements');
        }
        if (project.languages.length > 3) {
            recommendations.push('Multiple languages detected - ensure consistent coding standards');
        }
        return recommendations.slice(0, 3); // Limit for token efficiency
    }
    generateContextualSuggestions(patterns, responses) {
        return {
            architecture: patterns.filter(p => p.patternType === types_1.PatternType.ARCHITECTURE).slice(0, 3),
            nextSteps: [
                'Implement identified patterns consistently',
                'Set up automated quality checks',
                'Document architectural decisions'
            ],
            improvements: [
                'Consider adding integration tests',
                'Implement CI/CD pipeline',
                'Add error handling patterns'
            ]
        };
    }
    getNextSteps(phase) {
        const steps = {
            [types_1.InitPhase.PROJECT_DISCOVERY]: ['Scan project files', 'Detect languages and frameworks'],
            [types_1.InitPhase.PATTERN_ANALYSIS]: ['Analyze architectural patterns', 'Detect design patterns'],
            [types_1.InitPhase.STANDARDS_INFERENCE]: ['Infer coding standards', 'Check consistency'],
            [types_1.InitPhase.SMART_QUESTIONING]: ['Answer setup questions', 'Provide preferences'],
            [types_1.InitPhase.DEEP_ANALYSIS]: ['Deep code analysis', 'Quality assessment'],
            [types_1.InitPhase.CONFIGURATION_GENERATION]: ['Generate configuration', 'Apply standards'],
            [types_1.InitPhase.CLAUDE_MD_UPDATE]: ['Update documentation', 'Finalize setup'],
            [types_1.InitPhase.COMPLETED]: ['Ready for development', 'Monitor for changes']
        };
        return steps[phase] || ['Continue initialization'];
    }
    // Claude-specific helper methods
    generateClaudeRecommendations(patterns, operation) {
        const recommendations = [];
        if (operation === 'create') {
            recommendations.push('Follow detected architectural patterns');
            if (patterns.some(p => p.patternName.includes('Clean'))) {
                recommendations.push('Implement clean architecture principles');
            }
        }
        if (operation === 'refactor') {
            recommendations.push('Maintain consistency with existing patterns');
            recommendations.push('Consider pattern consolidation opportunities');
        }
        return recommendations.slice(0, 3);
    }
    getClaudeNextActions(phase) {
        if (!phase)
            return ['Initialize project with /init endpoint'];
        const actions = {
            [types_1.InitPhase.PROJECT_DISCOVERY]: ['Continue file scanning', 'Call /analyze for progress'],
            [types_1.InitPhase.PATTERN_ANALYSIS]: ['Review detected patterns', 'Validate architecture'],
            [types_1.InitPhase.STANDARDS_INFERENCE]: ['Check coding standards', 'Apply consistently'],
            [types_1.InitPhase.SMART_QUESTIONING]: ['Complete questionnaire', 'Provide preferences'],
            [types_1.InitPhase.DEEP_ANALYSIS]: ['Monitor analysis progress', 'Review results'],
            [types_1.InitPhase.CONFIGURATION_GENERATION]: ['Validate configuration', 'Apply settings'],
            [types_1.InitPhase.CLAUDE_MD_UPDATE]: ['Review generated guidance', 'Finalize setup'],
            [types_1.InitPhase.COMPLETED]: ['System ready', 'Begin development']
        };
        return actions[phase] || ['Continue initialization'];
    }
    validateCodeAgainstPatterns(code, patterns, language) {
        const issues = [];
        const suggestions = [];
        // Basic pattern validation
        const archPatterns = patterns.filter(p => p.patternType === types_1.PatternType.ARCHITECTURE);
        const codeStandards = patterns.filter(p => p.patternType === types_1.PatternType.CODING_STANDARD);
        // Check for common issues
        if (language === 'typescript' && !code.includes('interface') && code.includes('object')) {
            suggestions.push('Consider using TypeScript interfaces for type definitions');
        }
        if (archPatterns.some(p => p.patternName.includes('Clean')) && code.includes('new Date()')) {
            suggestions.push('Consider injecting date dependencies for testability');
        }
        return {
            valid: issues.length === 0,
            issues,
            suggestions: suggestions.slice(0, 3),
            patterns: archPatterns.slice(0, 2).map(p => p.patternName)
        };
    }
    formatPatternsForClaude(patterns) {
        return {
            architecture: patterns
                .filter(p => p.patternType === types_1.PatternType.ARCHITECTURE)
                .slice(0, 3)
                .map(p => ({ name: p.patternName, confidence: p.confidence })),
            design: patterns
                .filter(p => p.patternType === types_1.PatternType.DESIGN_PATTERN)
                .slice(0, 2)
                .map(p => ({ name: p.patternName, evidence: p.evidence?.length || 0 }))
        };
    }
    extractConventions(responses) {
        const conventions = {};
        responses.forEach(r => {
            if (r.category === types_1.QuestionCategory.STANDARDS) {
                conventions[r.questionId] = r.response;
            }
        });
        return {
            naming: conventions.naming || 'camelCase',
            formatting: conventions.formatting || 'prettier',
            testing: conventions.testing || 'jest'
        };
    }
    getTaskSpecificGuidance(task, patterns) {
        const guidance = [];
        if (task?.includes('component')) {
            if (patterns.some(p => p.patternName.includes('React'))) {
                guidance.push('Use functional components with hooks');
                guidance.push('Follow established component patterns');
            }
        }
        if (task?.includes('api')) {
            if (patterns.some(p => p.patternName.includes('REST'))) {
                guidance.push('Follow REST conventions');
                guidance.push('Implement proper error handling');
            }
        }
        return guidance.slice(0, 3);
    }
    getClaudeWarnings(patterns) {
        const warnings = [];
        if (patterns.length === 0) {
            warnings.push('No patterns detected - consider running analysis first');
        }
        const conflictingPatterns = patterns.filter(p => p.confidence < 0.5);
        if (conflictingPatterns.length > 0) {
            warnings.push('Some patterns have low confidence - review for consistency');
        }
        return warnings.slice(0, 2);
    }
    // Project management handlers
    async handleListProjects(req, res) {
        try {
            const { status = 'active', limit = 50, offset = 0 } = req.query;
            // Check if using PostgreSQL adapter with project management
            if (typeof this.dbManager.listProjects === 'function') {
                const projects = await this.dbManager.listProjects(status, parseInt(limit), parseInt(offset));
                this.sendSuccess(res, { projects, total: projects.length });
            }
            else {
                this.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to list projects', error);
            this.sendError(res, 'Failed to list projects');
        }
    }
    async handleGetProject(req, res) {
        try {
            const { projectId } = req.params;
            if (typeof this.dbManager.getProjectById === 'function') {
                const project = await this.dbManager.getProjectById(projectId);
                if (project) {
                    this.sendSuccess(res, project);
                }
                else {
                    this.sendError(res, 'Project not found', 404);
                }
            }
            else {
                this.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to get project', error);
            this.sendError(res, 'Failed to get project');
        }
    }
    async handleUpdateProject(req, res) {
        try {
            const { projectId } = req.params;
            const updates = req.body;
            if (typeof this.dbManager.updateProject === 'function') {
                const project = await this.dbManager.updateProject(projectId, updates);
                this.sendSuccess(res, project);
            }
            else {
                this.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to update project', error);
            this.sendError(res, 'Failed to update project');
        }
    }
    async handleDeleteProject(req, res) {
        try {
            const { projectId } = req.params;
            if (typeof this.dbManager.deleteProject === 'function') {
                await this.dbManager.deleteProject(projectId);
                this.sendSuccess(res, { deleted: true });
            }
            else {
                this.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to delete project', error);
            this.sendError(res, 'Failed to delete project');
        }
    }
    // Project path management handlers
    async handleAddProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { path, pathType = 'alias' } = req.body;
            if (!path) {
                this.sendError(res, 'Path is required', 400);
                return;
            }
            if (typeof this.dbManager.addProjectPath === 'function') {
                const projectPath = await this.dbManager.addProjectPath(projectId, path, pathType);
                this.sendSuccess(res, projectPath);
            }
            else {
                this.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to add project path', error);
            this.sendError(res, 'Failed to add project path');
        }
    }
    async handleUpdateProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { oldPath, newPath } = req.body;
            if (!oldPath || !newPath) {
                this.sendError(res, 'Both oldPath and newPath are required', 400);
                return;
            }
            if (typeof this.dbManager.updateProjectPath === 'function') {
                await this.dbManager.updateProjectPath(projectId, oldPath, newPath);
                this.sendSuccess(res, { updated: true, oldPath, newPath });
            }
            else {
                this.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to update project path', error);
            this.sendError(res, 'Failed to update project path');
        }
    }
    async handleGetProjectPaths(req, res) {
        try {
            const { projectId } = req.params;
            if (typeof this.dbManager.getProjectPaths === 'function') {
                const paths = await this.dbManager.getProjectPaths(projectId);
                this.sendSuccess(res, paths);
            }
            else {
                this.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to get project paths', error);
            this.sendError(res, 'Failed to get project paths');
        }
    }
    async handleDeactivateProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { path } = req.body;
            if (!path) {
                this.sendError(res, 'Path is required', 400);
                return;
            }
            if (typeof this.dbManager.deactivateProjectPath === 'function') {
                await this.dbManager.deactivateProjectPath(projectId, path);
                this.sendSuccess(res, { deactivated: true, path });
            }
            else {
                this.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to deactivate project path', error);
            this.sendError(res, 'Failed to deactivate project path');
        }
    }
    sendSuccess(res, data, cached = false) {
        res.json({ success: true, data, cached });
    }
    sendError(res, error, status = 500) {
        res.status(status).json({ success: false, error });
    }
    async start() {
        try {
            // Initialize database
            await this.dbManager.initialize();
            // Start server
            this.app.listen(this.port, () => {
                this.logger.info(`🚀 Auxiliary System API running on port ${this.port}`);
                this.logger.info(`📊 Database: ${this.isDev ? 'In-Memory' : 'Persistent'}`);
                this.logger.info(`🔧 Mode: ${this.isDev ? 'Development' : 'Production'}`);
                this.logger.info(`📝 Health check: http://localhost:${this.port}/health`);
            });
        }
        catch (error) {
            this.logger.error('Failed to start server', error);
            process.exit(1);
        }
    }
    async stop() {
        await this.dbManager.close();
        this.cache.destroy();
        this.logger.info('Server stopped');
    }
}
exports.APIServer = APIServer;
// Start server if called directly
if (require.main === module) {
    const server = new APIServer();
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });
    void server.start();
}
//# sourceMappingURL=server.js.map