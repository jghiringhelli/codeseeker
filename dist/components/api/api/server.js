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
        this.isDev = process.argv?.includes('--dev');
        // Initialize services
        this?.initializeServices();
        this?.setupMiddleware();
        this?.setupRoutes();
        this?.setupErrorHandling();
    }
    initializeServices() {
        // Parse database configuration from environment
        const dbConfig = factory_1.DatabaseFactory?.parseConfigFromEnv();
        // Override for development mode
        if (this.isDev && dbConfig?.type === 'sqlite') {
            dbConfig.path = ':memory:';
        }
        // Ensure data directory exists for SQLite production
        if (dbConfig?.type === 'sqlite' && dbConfig.path && dbConfig?.path !== ':memory:') {
            const dataDir = (0, path_1.dirname)(dbConfig.path);
            if (!(0, fs_1.existsSync)(dataDir)) {
                (0, fs_1.mkdirSync)(dataDir, { recursive: true });
            }
        }
        this.dbManager = factory_1.DatabaseFactory?.create(dbConfig, this.logger);
        this.fsHelper = new file_system_1.FileSystemHelper(this.logger);
        this.cache = new cache_1.InMemoryCacheManager({
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            maxSize: 1000,
            logger: this.logger
        });
    }
    setupMiddleware() {
        // CORS
        this.app?.use((0, cors_1.default)({
            origin: this.isDev ? true : ['http://localhost:*'],
            credentials: true
        }));
        // JSON parsing with size limit
        this.app?.use(express_1.default?.json({ limit: '1mb' }));
        // Request logging
        this.app?.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, { ip: req.ip });
            next();
        });
        // Response time header
        this.app?.use((req, res, next) => {
            const start = Date?.now();
            res?.on('finish', () => {
                const duration = Date?.now() - start;
                try {
                    res?.setHeader('X-Response-Time', `${duration}ms`);
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
        this.app?.get('/health', this.handleHealth?.bind(this));
        // Quick stats (minimal tokens)
        this.app?.get('/stats', this.handleStats?.bind(this));
        // Project analysis (token-optimized)
        this.app?.post('/analyze', this.handleAnalyze?.bind(this));
        // Initialize project
        this.app?.post('/init', this.handleInit?.bind(this));
        // Get patterns for project
        this.app?.get('/patterns/:projectPath(*)', this.handleGetPatterns?.bind(this));
        // Save questionnaire response
        this.app?.post('/questionnaire', this.handleQuestionnaire?.bind(this));
        // Get project suggestions (AI-friendly format)
        this.app?.get('/suggestions/:projectPath(*)', this.handleSuggestions?.bind(this));
        // Claude-specific endpoints
        this.app?.post('/claude/context', this.handleClaudeContext?.bind(this));
        this.app?.post('/claude/validate', this.handleClaudeValidate?.bind(this));
        this.app?.get('/claude/guidance/:projectPath(*)', this.handleClaudeGuidance?.bind(this));
        // Phase 1: Claude-optimized endpoints
        this.app?.get('/claude/context/:projectPath(*)', this.handleClaudeOptimizedContext?.bind(this));
        this.app?.get('/claude/suggest-questions/:projectPath(*)', this.handleClaudeSuggestQuestions?.bind(this));
        this.app?.post('/claude/analyze-with-context', this.handleClaudeAnalyzeWithContext?.bind(this));
        // Phase 4: Development Plan Management endpoints
        this.app?.post('/plans', this.handleCreatePlan?.bind(this));
        this.app?.get('/plans/:projectPath(*)', this.handleGetProjectPlans?.bind(this));
        this.app?.get('/plans/details/:planId', this.handleGetPlanDetails?.bind(this));
        this.app?.put('/plans/:planId', this.handleUpdatePlan?.bind(this));
        this.app?.delete('/plans/:planId', this.handleArchivePlan?.bind(this));
        // Plan progress tracking
        this.app?.post('/plans/:planId/progress', this.handleUpdatePlanProgress?.bind(this));
        this.app?.get('/plans/:planId/progress', this.handleGetPlanProgress?.bind(this));
        this.app?.get('/plans/:planId/timeline', this.handleGetPlanTimeline?.bind(this));
        // Plan templates
        this.app?.get('/plan-templates', this.handleGetPlanTemplates?.bind(this));
        this.app?.get('/plan-templates/:templateId', this.handleGetPlanTemplate?.bind(this));
        this.app?.post('/plans/from-template/:templateId', this.handleCreatePlanFromTemplate?.bind(this));
        // Claude integration for plans
        this.app?.post('/plans/:planId/claude-optimize', this.handleClaudeOptimizePlan?.bind(this));
        this.app?.get('/claude/plan-suggestions/:projectPath(*)', this.handleClaudePlanSuggestions?.bind(this));
        // Cache management
        this.app?.delete('/cache', this.handleClearCache?.bind(this));
        // Database operations
        this.app?.get('/db/stats', this.handleDBStats?.bind(this));
        // Project management endpoints
        this.app?.get('/projects', this.handleListProjects?.bind(this));
        this.app?.get('/projects/:projectId', this.handleGetProject?.bind(this));
        this.app?.put('/projects/:projectId', this.handleUpdateProject?.bind(this));
        this.app?.delete('/projects/:projectId', this.handleDeleteProject?.bind(this));
        // Project path management
        this.app?.post('/projects/:projectId/paths', this.handleAddProjectPath?.bind(this));
        this.app?.put('/projects/:projectId/paths', this.handleUpdateProjectPath?.bind(this));
        this.app?.get('/projects/:projectId/paths', this.handleGetProjectPaths?.bind(this));
        this.app?.delete('/projects/:projectId/paths', this.handleDeactivateProjectPath?.bind(this));
    }
    setupErrorHandling() {
        // 404 handler
        this.app?.use('*', (req, res) => {
            this?.sendError(res, 'Endpoint not found', 404);
        });
        // Error handler
        this.app?.use((error, req, res, next) => {
            this.logger.error('API Error', error);
            this?.sendError(res, 'Internal server error', 500);
        });
    }
    // Route handlers (token-efficient)
    async handleHealth(req, res) {
        const uptime = process?.uptime();
        this?.sendSuccess(res, {
            status: 'healthy',
            uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
            version: '1.0.0'
        });
    }
    async handleStats(req, res) {
        try {
            const cacheKey = 'quick-stats';
            let stats = await this.cache?.get(cacheKey);
            if (!stats) {
                const dbStats = await this.dbManager?.getDatabaseStats();
                const cacheStats = await this.cache?.getStats();
                stats = {
                    projects: dbStats.initialization_progress || 0,
                    patterns: dbStats.detected_patterns || 0,
                    analyses: dbStats.analysis_results || 0,
                    uptime: `${Math.floor(process?.uptime() / 60)}m`,
                    cache: `${cacheStats.size}/${cacheStats.maxSize}`,
                    memory: `${Math.round(process?.memoryUsage().heapUsed / 1024 / 1024)}MB`
                };
                await this.cache?.set(cacheKey, stats, 30000); // 30 second cache
            }
            this?.sendSuccess(res, stats, !!stats.cached);
        }
        catch (error) {
            this?.sendError(res, 'Failed to get stats');
        }
    }
    async handleAnalyze(req, res) {
        try {
            const { projectPath, includePatterns = true, includeProgress = true, maxResults = 5 } = req.body;
            if (!projectPath) {
                this?.sendError(res, 'projectPath is required', 400);
                return;
            }
            const cacheKey = `analysis:${hash_1.HashUtils?.shortHash(projectPath)}`;
            let result = await this.cache?.get(cacheKey);
            if (!result) {
                // Analyze project structure
                const files = await this.fsHelper?.getAllFiles(projectPath, ['.ts', '.js', '.py', '.java']);
                const projectSize = this?.categorizeProjectSize(files?.length);
                const languages = this?.detectLanguages(files);
                const projectType = this?.inferProjectType(projectPath, files);
                result = {
                    project: {
                        path: projectPath,
                        type: projectType,
                        size: projectSize,
                        languages,
                        fileCount: files?.length
                    }
                };
                // Add patterns if requested
                if (includePatterns) {
                    const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                    const topPatterns = patterns
                        .filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE)
                        .slice(0, maxResults)
                        .map(p => p.patternName);
                    result.patterns = {
                        architecture: topPatterns,
                        confidence: patterns?.length > 0 ? patterns[0]?.confidence || 0 : 0
                    };
                }
                // Add progress if requested
                if (includeProgress) {
                    const progress = await this.dbManager?.getInitializationProgress(projectPath);
                    if (progress) {
                        const completion = Math.round((progress.progressData?.processedFiles / progress.progressData.totalFiles) * 100);
                        result.progress = {
                            phase: progress.phase,
                            completion,
                            eta: this?.calculateETA(progress.progressData)
                        };
                    }
                }
                // Generate recommendations
                result.recommendations = this?.generateRecommendations(result.project, result.patterns);
                await this.cache?.set(cacheKey, result, 2 * 60 * 1000); // 2 minute cache
            }
            this?.sendSuccess(res, result, !!result.cached);
        }
        catch (error) {
            this.logger.error('Analysis failed', error);
            this?.sendError(res, 'Analysis failed');
        }
    }
    async handleInit(req, res) {
        try {
            const { projectPath, mode = 'auto', batchSize = 50, metadata = {} } = req.body;
            if (!projectPath) {
                this?.sendError(res, 'projectPath is required', 400);
                return;
            }
            // Check if already initialized
            let progress = await this.dbManager?.getInitializationProgress(projectPath);
            if (!progress) {
                // Create new initialization
                const files = await this.fsHelper?.getAllFiles(projectPath);
                progress = await this.dbManager?.saveInitializationProgress({
                    projectPath,
                    phase: types_1.InitPhase.PROJECT_DISCOVERY,
                    resumeToken: hash_1.HashUtils?.generateToken(32),
                    progressData: {
                        totalFiles: files?.length,
                        processedFiles: 0,
                        skippedFiles: 0,
                        errorFiles: 0,
                        batchSize,
                        processingStartTime: new Date()
                    },
                    techStackData: metadata.languages || metadata.frameworks ? {
                        languages: Array.isArray(metadata.languages) ?
                            metadata.languages?.reduce((acc, lang) => ({ ...acc, [lang]: 'detected' }), {}) : {},
                        frameworks: Array.isArray(metadata.frameworks) ?
                            metadata.frameworks?.reduce((acc, fw) => ({ ...acc, [fw]: 'detected' }), {}) : {},
                        tools: {},
                        packageManagers: [],
                        buildTools: []
                    } : undefined
                });
            }
            const response = {
                initialized: true,
                resumeToken: progress.resumeToken,
                phase: progress.phase,
                totalFiles: progress.progressData.totalFiles,
                nextSteps: this?.getNextSteps(progress.phase)
            };
            this?.sendSuccess(res, response);
        }
        catch (error) {
            this.logger.error('Initialization failed', error);
            this?.sendError(res, 'Initialization failed');
        }
    }
    async handleGetPatterns(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
            const response = {
                total: patterns?.length,
                architecture: patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE),
                design: patterns?.filter(p => p?.patternType === types_1.PatternType.DESIGN_PATTERN),
                standards: patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD)
            };
            this?.sendSuccess(res, response);
        }
        catch (error) {
            this?.sendError(res, 'Failed to get patterns');
        }
    }
    async handleQuestionnaire(req, res) {
        try {
            const { projectPath, category, questionId, response: userResponse } = req.body;
            if (!projectPath || !category || !questionId || !userResponse) {
                this?.sendError(res, 'Missing required fields', 400);
                return;
            }
            const response = await this.dbManager?.saveQuestionnaireResponse({
                projectPath,
                category: category,
                questionId,
                response: userResponse,
                metadata: { timestamp: new Date().toISOString() }
            });
            this?.sendSuccess(res, { saved: true, id: response.id });
        }
        catch (error) {
            this?.sendError(res, 'Failed to save response');
        }
    }
    async handleSuggestions(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const cacheKey = `suggestions:${hash_1.HashUtils?.shortHash(projectPath)}`;
            let suggestions = await this.cache?.get(cacheKey);
            if (!suggestions) {
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                const responses = await this.dbManager?.getQuestionnaireResponses(projectPath);
                suggestions = this?.generateContextualSuggestions(patterns, responses);
                await this.cache?.set(cacheKey, suggestions, 10 * 60 * 1000); // 10 minute cache
            }
            this?.sendSuccess(res, suggestions, !!suggestions.cached);
        }
        catch (error) {
            this?.sendError(res, 'Failed to generate suggestions');
        }
    }
    async handleClearCache(req, res) {
        await this.cache?.clear();
        this?.sendSuccess(res, { cleared: true });
    }
    async handleDBStats(req, res) {
        try {
            const stats = await this.dbManager?.getDatabaseStats();
            this?.sendSuccess(res, stats);
        }
        catch (error) {
            this?.sendError(res, 'Failed to get database stats');
        }
    }
    // Claude-specific handlers (token-optimized)
    async handleClaudeContext(req, res) {
        try {
            const { projectPath, operation, filePatterns = [] } = req.body;
            if (!projectPath) {
                this?.sendError(res, 'projectPath is required', 400);
                return;
            }
            const cacheKey = `claude-context:${hash_1.HashUtils?.shortHash(projectPath + operation)}`;
            let context = await this.cache?.get(cacheKey);
            if (!context) {
                // Get minimal context for Claude
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                const progress = await this.dbManager?.getInitializationProgress(projectPath);
                context = {
                    status: progress?.phase || 'not_initialized',
                    architecture: patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE).slice(0, 3),
                    standards: patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD).slice(0, 3),
                    recommendations: this?.generateClaudeRecommendations(patterns, operation),
                    nextActions: this?.getClaudeNextActions(progress?.phase)
                };
                await this.cache?.set(cacheKey, context, 5 * 60 * 1000); // 5 minute cache
            }
            this?.sendSuccess(res, context, !!context.cached);
        }
        catch (error) {
            this.logger.error('Claude context request failed', error);
            this?.sendError(res, 'Failed to get context');
        }
    }
    async handleClaudeValidate(req, res) {
        try {
            const { projectPath, code, language, operation } = req.body;
            if (!projectPath || !code) {
                this?.sendError(res, 'projectPath and code are required', 400);
                return;
            }
            // Quick validation based on detected patterns
            const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
            const validation = this?.validateCodeAgainstPatterns(code, patterns, language);
            this?.sendSuccess(res, validation);
        }
        catch (error) {
            this?.sendError(res, 'Validation failed');
        }
    }
    async handleClaudeGuidance(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const { task } = req.query;
            const cacheKey = `claude-guidance:${hash_1.HashUtils?.shortHash(projectPath + task)}`;
            let guidance = await this.cache?.get(cacheKey);
            if (!guidance) {
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                const responses = await this.dbManager?.getQuestionnaireResponses(projectPath);
                guidance = {
                    patterns: this?.formatPatternsForClaude(patterns),
                    conventions: this?.extractConventions(responses),
                    bestPractices: this?.getTaskSpecificGuidance(task, patterns),
                    warnings: this?.getClaudeWarnings(patterns)
                };
                await this.cache?.set(cacheKey, guidance, 15 * 60 * 1000); // 15 minute cache
            }
            this?.sendSuccess(res, guidance, !!guidance.cached);
        }
        catch (error) {
            this?.sendError(res, 'Failed to get guidance');
        }
    }
    // Phase 1: Claude-optimized endpoint handlers
    async handleClaudeOptimizedContext(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const { intent = 'overview', includeFiles = false, maxTokens = 2000 } = req.query;
            const cacheKey = `claude-opt-context:${hash_1.HashUtils?.shortHash(projectPath + intent)}`;
            let context = await this.cache?.get(cacheKey);
            if (!context) {
                // Get project info first
                let project = await this.dbManager?.getProjectByAnyPath(projectPath);
                // If no project exists, create a minimal one
                if (!project) {
                    project = {
                        id: 'temp',
                        projectPath,
                        projectName: projectPath?.split('/').pop() || 'Unknown',
                        projectType: types_1.ProjectType.UNKNOWN,
                        languages: [],
                        frameworks: [],
                        totalFiles: 0,
                        totalLines: 0,
                        status: 'active',
                        metadata: {},
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                }
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                const progress = await this.dbManager?.getInitializationProgress(projectPath);
                // Build context based on intent
                context = await this?.buildContextForIntent(intent, project, patterns, progress, includeFiles === 'true', parseInt(maxTokens) || 2000);
                await this.cache?.set(cacheKey, context, 5 * 60 * 1000); // 5 minute cache
            }
            this?.sendSuccess(res, context, !!context.cached);
        }
        catch (error) {
            this.logger.error('Claude optimized context request failed', error);
            this?.sendError(res, 'Failed to get optimized context');
        }
    }
    async handleClaudeSuggestQuestions(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            const { context = 'general', limit = 5 } = req.query;
            const cacheKey = `claude-questions:${hash_1.HashUtils?.shortHash(projectPath + context)}`;
            let questions = await this.cache?.get(cacheKey);
            if (!questions) {
                const project = await this.dbManager?.getProjectByAnyPath(projectPath);
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                const progress = await this.dbManager?.getInitializationProgress(projectPath);
                questions = await this?.generateContextualQuestions(project, patterns, progress, context, parseInt(limit) || 5);
                await this.cache?.set(cacheKey, questions, 10 * 60 * 1000); // 10 minute cache
            }
            this?.sendSuccess(res, questions, !!questions.cached);
        }
        catch (error) {
            this.logger.error('Claude suggest questions request failed', error);
            this?.sendError(res, 'Failed to generate question suggestions');
        }
    }
    async handleClaudeAnalyzeWithContext(req, res) {
        try {
            const { projectPath, files = [], question, maxTokens = 4000, intent = 'analysis' } = req.body;
            if (!projectPath) {
                this?.sendError(res, 'projectPath is required', 400);
                return;
            }
            const cacheKey = `claude-analyze:${hash_1.HashUtils?.shortHash(JSON.stringify({ projectPath, files, question, intent }))}`;
            let analysis = await this.cache?.get(cacheKey);
            if (!analysis) {
                // Get focused context for the specific files and question
                const project = await this.dbManager?.getProjectByAnyPath(projectPath);
                const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
                // Build focused analysis context
                const context = await this?.buildFocusedAnalysisContext(project, patterns, files, question, intent, maxTokens);
                analysis = {
                    context,
                    suggestedPrompt: this?.buildSuggestedPrompt(context, question, intent),
                    tokenEstimate: this?.estimateTokens(context),
                    timestamp: new Date().toISOString()
                };
                await this.cache?.set(cacheKey, analysis, 15 * 60 * 1000); // 15 minute cache
            }
            this?.sendSuccess(res, analysis, !!analysis.cached);
        }
        catch (error) {
            this.logger.error('Claude analyze with context request failed', error);
            this?.sendError(res, 'Failed to analyze with context');
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
        const extensions = new Set(files?.map(f => this.fsHelper?.getFileExtension(f)));
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
        const hasPackageJson = files?.some(f => f?.includes('package.json'));
        const hasReactFiles = files?.some(f => f?.includes('.tsx') || f?.includes('react'));
        const hasExpressFiles = files?.some(f => f?.includes('express') || f?.includes('server'));
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
        const elapsed = Date?.now() - new Date(processingStartTime).getTime();
        const rate = processedFiles / elapsed;
        const remaining = totalFiles - processedFiles;
        const eta = remaining / rate;
        return `${Math.round(eta / 1000 / 60)}m`;
    }
    generateRecommendations(project, patterns) {
        const recommendations = [];
        if (project.fileCount > 1000) {
            recommendations?.push('Consider implementing modular architecture for better maintainability');
        }
        if (!patterns || patterns.architecture?.length === 0) {
            recommendations?.push('Run pattern analysis to identify architectural improvements');
        }
        if (project.languages?.length > 3) {
            recommendations?.push('Multiple languages detected - ensure consistent coding standards');
        }
        return recommendations?.slice(0, 3); // Limit for token efficiency
    }
    generateContextualSuggestions(patterns, responses) {
        return {
            architecture: patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE).slice(0, 3),
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
            recommendations?.push('Follow detected architectural patterns');
            if (patterns?.some(p => p.patternName?.includes('Clean'))) {
                recommendations?.push('Implement clean architecture principles');
            }
        }
        if (operation === 'refactor') {
            recommendations?.push('Maintain consistency with existing patterns');
            recommendations?.push('Consider pattern consolidation opportunities');
        }
        return recommendations?.slice(0, 3);
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
        const archPatterns = patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE);
        const codeStandards = patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD);
        // Check for common issues
        if (language === 'typescript' && !code?.includes('interface') && code?.includes('object')) {
            suggestions?.push('Consider using TypeScript interfaces for type definitions');
        }
        if (archPatterns?.some(p => p.patternName?.includes('Clean')) && code?.includes('new Date()')) {
            suggestions?.push('Consider injecting date dependencies for testability');
        }
        return {
            valid: issues?.length === 0,
            issues,
            suggestions: suggestions?.slice(0, 3),
            patterns: archPatterns?.slice(0, 2).map(p => p.patternName)
        };
    }
    formatPatternsForClaude(patterns) {
        return {
            architecture: patterns
                .filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE)
                .slice(0, 3)
                .map(p => ({ name: p.patternName, confidence: p.confidence })),
            design: patterns
                .filter(p => p?.patternType === types_1.PatternType.DESIGN_PATTERN)
                .slice(0, 2)
                .map(p => ({ name: p.patternName, evidence: p.evidence?.length || 0 }))
        };
    }
    extractConventions(responses) {
        const conventions = {};
        responses?.forEach(r => {
            if (r?.category === types_1.QuestionCategory.STANDARDS) {
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
            if (patterns?.some(p => p.patternName?.includes('React'))) {
                guidance?.push('Use functional components with hooks');
                guidance?.push('Follow established component patterns');
            }
        }
        if (task?.includes('api')) {
            if (patterns?.some(p => p.patternName?.includes('REST'))) {
                guidance?.push('Follow REST conventions');
                guidance?.push('Implement proper error handling');
            }
        }
        return guidance?.slice(0, 3);
    }
    getClaudeWarnings(patterns) {
        const warnings = [];
        if (patterns?.length === 0) {
            warnings?.push('No patterns detected - consider running analysis first');
        }
        const conflictingPatterns = patterns?.filter(p => p.confidence < 0.5);
        if (conflictingPatterns?.length > 0) {
            warnings?.push('Some patterns have low confidence - review for consistency');
        }
        return warnings?.slice(0, 2);
    }
    // Project management handlers
    async handleListProjects(req, res) {
        try {
            const { status = 'active', limit = 50, offset = 0 } = req.query;
            // Check if using PostgreSQL adapter with project management
            if (typeof this.dbManager.listProjects === 'function') {
                const projects = await this.dbManager.listProjects(status, parseInt(limit), parseInt(offset));
                this?.sendSuccess(res, { projects, total: projects?.length });
            }
            else {
                this?.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to list projects', error);
            this?.sendError(res, 'Failed to list projects');
        }
    }
    async handleGetProject(req, res) {
        try {
            const { projectId } = req.params;
            const acceptHeader = req.get('Accept') || '';
            // Check if this is a browser request for HTML (not an API request)
            if (acceptHeader.includes('text/html')) {
                // Serve the project view HTML page
                const path = require('path');
                const projectViewPath = path.join(__dirname, '..', 'dashboard', 'project-view.html');
                return res.sendFile(projectViewPath);
            }
            // Handle API request for JSON data
            if (typeof this.dbManager.getProjectById === 'function') {
                const project = await this.dbManager.getProjectById(projectId);
                if (project) {
                    this?.sendSuccess(res, project);
                }
                else {
                    this?.sendError(res, 'Project not found', 404);
                }
            }
            else {
                this?.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to get project', error);
            this?.sendError(res, 'Failed to get project');
        }
    }
    async handleUpdateProject(req, res) {
        try {
            const { projectId } = req.params;
            const updates = req.body;
            if (typeof this.dbManager.updateProject === 'function') {
                const project = await this.dbManager.updateProject(projectId, updates);
                this?.sendSuccess(res, project);
            }
            else {
                this?.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to update project', error);
            this?.sendError(res, 'Failed to update project');
        }
    }
    async handleDeleteProject(req, res) {
        try {
            const { projectId } = req.params;
            if (typeof this.dbManager.deleteProject === 'function') {
                await this.dbManager.deleteProject(projectId);
                this?.sendSuccess(res, { deleted: true });
            }
            else {
                this?.sendError(res, 'Project management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to delete project', error);
            this?.sendError(res, 'Failed to delete project');
        }
    }
    // Project path management handlers
    async handleAddProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { path, pathType = 'alias' } = req.body;
            if (!path) {
                this?.sendError(res, 'Path is required', 400);
                return;
            }
            if (typeof this.dbManager.addProjectPath === 'function') {
                const projectPath = await this.dbManager.addProjectPath(projectId, path, pathType);
                this?.sendSuccess(res, projectPath);
            }
            else {
                this?.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to add project path', error);
            this?.sendError(res, 'Failed to add project path');
        }
    }
    async handleUpdateProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { oldPath, newPath } = req.body;
            if (!oldPath || !newPath) {
                this?.sendError(res, 'Both oldPath and newPath are required', 400);
                return;
            }
            if (typeof this.dbManager.updateProjectPath === 'function') {
                await this.dbManager.updateProjectPath(projectId, oldPath, newPath);
                this?.sendSuccess(res, { updated: true, oldPath, newPath });
            }
            else {
                this?.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to update project path', error);
            this?.sendError(res, 'Failed to update project path');
        }
    }
    async handleGetProjectPaths(req, res) {
        try {
            const { projectId } = req.params;
            if (typeof this.dbManager.getProjectPaths === 'function') {
                const paths = await this.dbManager.getProjectPaths(projectId);
                this?.sendSuccess(res, paths);
            }
            else {
                this?.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to get project paths', error);
            this?.sendError(res, 'Failed to get project paths');
        }
    }
    async handleDeactivateProjectPath(req, res) {
        try {
            const { projectId } = req.params;
            const { path } = req.body;
            if (!path) {
                this?.sendError(res, 'Path is required', 400);
                return;
            }
            if (typeof this.dbManager.deactivateProjectPath === 'function') {
                await this.dbManager.deactivateProjectPath(projectId, path);
                this?.sendSuccess(res, { deactivated: true, path });
            }
            else {
                this?.sendError(res, 'Project path management not available with current database adapter', 501);
            }
        }
        catch (error) {
            this.logger.error('Failed to deactivate project path', error);
            this?.sendError(res, 'Failed to deactivate project path');
        }
    }
    // Phase 1: Claude-optimized helper methods
    async buildContextForIntent(intent, project, patterns, progress, includeFiles, maxTokens) {
        const context = {
            project: {
                name: project.projectName,
                type: project.projectType,
                languages: project.languages,
                frameworks: project.frameworks,
                status: project.status
            },
            timestamp: new Date().toISOString()
        };
        switch (intent) {
            case 'overview':
                context.summary = {
                    totalFiles: project.totalFiles,
                    totalLines: project.totalLines,
                    initializationStatus: progress?.phase || 'not_initialized',
                    keyPatterns: patterns?.slice(0, 3).map(p => ({
                        type: p.patternType,
                        name: p.patternName,
                        confidence: p.confidence
                    }))
                };
                break;
            case 'architecture':
                context.architecture = {
                    patterns: patterns?.filter(p => p?.patternType === 'architecture').slice(0, 5),
                    structure: progress?.progressData?.directoryStructure || null,
                    recommendations: this?.generateArchitecturalRecommendations(patterns)
                };
                break;
            case 'debugging':
                context.debugging = {
                    recentIssues: patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD).slice(0, 3),
                    testingSetup: project.metadata?.testing || 'unknown',
                    logPatterns: patterns?.filter(p => p.patternName?.includes('logging'))
                };
                break;
            case 'refactoring':
                context.refactoring = {
                    codeSmells: patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD),
                    opportunities: this?.identifyRefactoringOpportunities(patterns),
                    constraints: project.metadata?.constraints || []
                };
                break;
        }
        // Trim to maxTokens if needed
        const contextStr = JSON.stringify(context);
        if (contextStr?.length > maxTokens * 4) { // Rough token estimation
            context.truncated = true;
            context.note = 'Response truncated to fit token limit';
        }
        return context;
    }
    async generateContextualQuestions(project, patterns, progress, context, limit) {
        const questions = [];
        // Base questions for any project
        if (!project || project?.status === 'uninitialized') {
            questions?.push("What type of application is this project?", "What are the main architectural patterns used?", "What testing strategy should I follow?", "What are the coding standards and conventions?");
        }
        // Context-specific questions
        switch (context) {
            case 'architecture':
                questions?.push("How is the project structured and organized?", "What design patterns are most prevalent?", "Are there any architectural inconsistencies to address?", "How well does the current architecture support scalability?");
                break;
            case 'debugging':
                questions?.push("What debugging tools are available in this project?", "How is error handling implemented?", "What logging patterns are used?", "Are there any known performance bottlenecks?");
                break;
            case 'testing':
                questions?.push("What testing framework is used?", "What's the current test coverage?", "How are integration tests structured?", "What's the testing strategy for this project?");
                break;
            case 'security':
                questions?.push("What security patterns are implemented?", "How is authentication and authorization handled?", "Are there any security vulnerabilities to address?", "What data validation patterns are used?");
                break;
        }
        // Add project-specific questions based on detected patterns
        patterns?.forEach(pattern => {
            if (pattern?.patternType === types_1.PatternType.CODING_STANDARD) {
                questions?.push(`How should I address the ${pattern.patternName} anti-pattern found in the code?`);
            }
        });
        return {
            questions: questions?.slice(0, limit),
            context,
            projectStatus: project?.status || 'unknown',
            suggestedContext: this?.suggestBestContext(patterns),
            total: questions?.length
        };
    }
    async buildFocusedAnalysisContext(project, patterns, files, question, intent, maxTokens) {
        const context = {
            project: {
                name: project?.projectName || 'Unknown',
                type: project?.projectType || 'Unknown',
                languages: project?.languages || []
            },
            focus: {
                files: files?.slice(0, 10), // Limit files to prevent token overflow
                question,
                intent
            },
            relevantPatterns: this?.findRelevantPatterns(patterns, files, question),
            timestamp: new Date().toISOString()
        };
        // Add file-specific context if files are provided
        if (files?.length > 0) {
            context.fileContext = await this?.buildFileContext(files?.slice(0, 5), maxTokens * 0.6);
        }
        return context;
    }
    buildSuggestedPrompt(context, question, intent) {
        let prompt = '';
        switch (intent) {
            case 'analysis':
                prompt = `Based on this ${context.project.type} project using ${context.project.languages?.join(', ')}, `;
                if (question) {
                    prompt += question;
                }
                else {
                    prompt += 'please analyze the code structure and provide insights.';
                }
                break;
            case 'debugging':
                prompt = `I'm debugging an issue in this ${context.project.type} project. `;
                prompt += question || 'Can you help identify potential problems?';
                break;
            case 'refactoring':
                prompt = `I want to refactor code in this ${context.project.type} project. `;
                prompt += question || 'What refactoring opportunities do you see?';
                break;
            default:
                prompt = question || 'Please help me understand this code.';
        }
        if (context.relevantPatterns?.length > 0) {
            prompt += `\n\nRelevant patterns detected: ${context.relevantPatterns?.map((p) => p.name).join(', ')}`;
        }
        return prompt;
    }
    estimateTokens(context) {
        const contextStr = JSON.stringify(context);
        return Math.ceil(contextStr?.length / 4); // Rough token estimation
    }
    generateArchitecturalRecommendations(patterns) {
        const recommendations = [];
        const architecturalPatterns = patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE);
        const antiPatterns = patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD);
        if (architecturalPatterns?.length === 0) {
            recommendations?.push('Consider establishing a clear architectural pattern');
        }
        if (antiPatterns?.length > 0) {
            recommendations?.push(`Address ${antiPatterns?.length} anti-pattern(s) detected`);
        }
        return recommendations;
    }
    identifyRefactoringOpportunities(patterns) {
        const opportunities = [];
        patterns?.forEach(pattern => {
            if (pattern?.patternType === types_1.PatternType.CODING_STANDARD) {
                opportunities?.push(`Refactor ${pattern.patternName} instances`);
            }
        });
        return opportunities?.slice(0, 5);
    }
    suggestBestContext(patterns) {
        const antiPatterns = patterns?.filter(p => p?.patternType === types_1.PatternType.CODING_STANDARD);
        const architecturalPatterns = patterns?.filter(p => p?.patternType === types_1.PatternType.ARCHITECTURE);
        if (antiPatterns?.length > 0)
            return 'debugging';
        if (architecturalPatterns?.length > 3)
            return 'architecture';
        return 'general';
    }
    findRelevantPatterns(patterns, files, question) {
        const relevant = [];
        const questionLower = question?.toLowerCase() || '';
        patterns?.forEach(pattern => {
            // Check if pattern is relevant to the question
            if (questionLower?.includes(pattern.patternName?.toLowerCase()) ||
                questionLower?.includes(pattern.patternType?.toLowerCase())) {
                relevant?.push({
                    name: pattern.patternName,
                    type: pattern.patternType,
                    confidence: pattern.confidence
                });
            }
            // Check if pattern evidence relates to the files
            if (pattern.evidence?.some(e => files?.some(f => e.location?.file && e.location.file?.includes(f)))) {
                relevant?.push({
                    name: pattern.patternName,
                    type: pattern.patternType,
                    confidence: pattern.confidence
                });
            }
        });
        return relevant?.slice(0, 5);
    }
    async buildFileContext(files, maxLength) {
        // This is a placeholder - in a real implementation, you'd read the actual files
        return {
            note: 'File content analysis not implemented yet',
            files: files,
            maxLength
        };
    }
    sendSuccess(res, data, cached = false) {
        res?.json({ success: true, data, cached });
    }
    sendError(res, error, status = 500) {
        res?.status(status).json({ success: false, error });
    }
    async start() {
        try {
            // Initialize database
            await this.dbManager?.initialize();
            // Start server
            this.app?.listen(this.port, () => {
                this.logger.info(`🚀 Auxiliary System API running on port ${this.port}`);
                this.logger.info(`📊 Database: ${this.isDev ? 'In-Memory' : 'Persistent'}`);
                this.logger.info(`🔧 Mode: ${this.isDev ? 'Development' : 'Production'}`);
                this.logger.info(`📝 Health check: http://localhost:${this.port}/health`);
            });
        }
        catch (error) {
            this.logger.error('Failed to start server', error);
            process?.exit(1);
        }
    }
    // ============================================
    // PHASE 4: DEVELOPMENT PLAN MANAGEMENT HANDLERS
    // ============================================
    async handleCreatePlan(req, res) {
        try {
            // Placeholder implementation - would use PlanHandlers class
            this?.sendSuccess(res, {
                message: 'Phase 4 Development Plan Management is planned but not yet implemented',
                endpoint: 'POST /plans',
                status: 'coming_soon',
                expectedFeatures: [
                    'Register new development plans with goals and tasks',
                    'Support for different plan types (feature, bug fix, refactoring, etc.)',
                    'Template-based plan creation',
                    'Claude-enhanced plan optimization'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan creation not yet implemented');
        }
    }
    async handleGetProjectPlans(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            this?.sendSuccess(res, {
                projectPath,
                plans: [],
                message: 'Plan listing will be implemented in Phase 4',
                plannedFilters: ['status', 'type', 'priority', 'assignedTo'],
                plannedFeatures: [
                    'Filter plans by status, type, priority',
                    'Paginated results',
                    'Progress summaries',
                    'Timeline views'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan listing not yet implemented');
        }
    }
    async handleGetPlanDetails(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Detailed plan view will be implemented in Phase 4',
                plannedData: {
                    planMetadata: 'Plan info, timeline, status',
                    phases: 'Plan phases with tasks',
                    tasks: 'Individual tasks with progress',
                    blockers: 'Active blockers and impediments',
                    milestones: 'Milestone tracking',
                    progressHistory: 'Recent progress updates'
                }
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan details not yet implemented');
        }
    }
    async handleUpdatePlan(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Plan updates will be implemented in Phase 4',
                plannedUpdates: [
                    'Modify plan metadata and goals',
                    'Add/remove tasks and phases',
                    'Update timelines and assignments',
                    'Change plan status'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan updates not yet implemented');
        }
    }
    async handleArchivePlan(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Plan archiving will be implemented in Phase 4',
                plannedFeatures: [
                    'Soft delete with archive status',
                    'Maintain history for reporting',
                    'Optional permanent deletion',
                    'Bulk archiving operations'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan archiving not yet implemented');
        }
    }
    async handleUpdatePlanProgress(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Progress tracking will be implemented in Phase 4',
                plannedFeatures: [
                    'Update individual task progress',
                    'Record blockers and impediments',
                    'Log milestone achievements',
                    'Automatic progress calculations',
                    'Integration with Git commits'
                ],
                exampleUpdate: {
                    taskUpdates: ['Task status and hours'],
                    blockers: ['Technical blockers'],
                    milestones: ['Milestone achievements'],
                    generalUpdate: ['Progress summary']
                }
            });
        }
        catch (error) {
            this?.sendError(res, 'Progress updates not yet implemented');
        }
    }
    async handleGetPlanProgress(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Progress analytics will be implemented in Phase 4',
                plannedMetrics: {
                    overall: 'Completion percentage, timeline status',
                    tasks: 'Task breakdown by status and priority',
                    blockers: 'Active blockers and resolution metrics',
                    velocity: 'Team velocity and burndown data',
                    recommendations: 'AI-generated progress insights'
                }
            });
        }
        catch (error) {
            this?.sendError(res, 'Progress analytics not yet implemented');
        }
    }
    async handleGetPlanTimeline(req, res) {
        try {
            const planId = req.params.planId;
            this?.sendSuccess(res, {
                planId,
                message: 'Timeline views will be implemented in Phase 4',
                plannedViews: [
                    'Gantt chart data',
                    'Milestone timeline',
                    'Dependency visualization',
                    'Critical path analysis'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Timeline views not yet implemented');
        }
    }
    async handleGetPlanTemplates(req, res) {
        try {
            this?.sendSuccess(res, {
                message: 'Plan templates will be implemented in Phase 4',
                plannedTemplates: [
                    'Feature Development Template',
                    'Bug Fix Campaign Template',
                    'Refactoring Project Template',
                    'Performance Optimization Template',
                    'Security Hardening Template',
                    'Documentation Sprint Template',
                    'Testing Initiative Template',
                    'Architecture Migration Template'
                ],
                templateFeatures: [
                    'Pre-built task structures',
                    'Estimated timelines',
                    'Best practice guidance',
                    'Customizable phases'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Plan templates not yet implemented');
        }
    }
    async handleGetPlanTemplate(req, res) {
        try {
            const templateId = req.params.templateId;
            this?.sendSuccess(res, {
                templateId,
                message: 'Template details will be implemented in Phase 4',
                plannedData: {
                    metadata: 'Template name, description, category',
                    phases: 'Pre-defined phases and structure',
                    tasks: 'Template tasks with estimates',
                    milestones: 'Key milestones and deliverables',
                    customization: 'Customizable parameters'
                }
            });
        }
        catch (error) {
            this?.sendError(res, 'Template details not yet implemented');
        }
    }
    async handleCreatePlanFromTemplate(req, res) {
        try {
            const templateId = req.params.templateId;
            this?.sendSuccess(res, {
                templateId,
                message: 'Template-based plan creation will be implemented in Phase 4',
                plannedProcess: [
                    'Load template structure',
                    'Apply customizations',
                    'Generate plan with tasks',
                    'Set realistic timelines',
                    'Apply project-specific context'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Template-based creation not yet implemented');
        }
    }
    async handleClaudeOptimizePlan(req, res) {
        try {
            const planId = req.params.planId;
            const { optimizationType } = req.body;
            this?.sendSuccess(res, {
                planId,
                optimizationType,
                message: 'Claude plan optimization will be implemented in Phase 4',
                plannedOptimizations: {
                    task_breakdown: 'AI-enhanced task decomposition',
                    timeline_optimization: 'Smart timeline adjustments',
                    resource_allocation: 'Optimal resource distribution',
                    risk_assessment: 'AI risk analysis and mitigation',
                    dependency_analysis: 'Dependency optimization'
                },
                plannedFeatures: [
                    'AI-generated recommendations',
                    'Risk assessment and mitigation',
                    'Timeline optimization',
                    'Resource allocation suggestions',
                    'Integration with project context'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Claude optimization not yet implemented');
        }
    }
    async handleClaudePlanSuggestions(req, res) {
        try {
            const projectPath = `/${req.params.projectPath}`;
            // Get project context for basic suggestions
            const project = await this.dbManager?.getProject(projectPath);
            const patterns = await this.dbManager?.getDetectedPatterns(projectPath);
            const suggestions = this?.generateBasicPlanSuggestions(project, patterns);
            this?.sendSuccess(res, {
                projectPath,
                suggestions,
                message: 'Enhanced Claude plan suggestions will be implemented in Phase 4',
                currentFeatures: ['Basic plan type suggestions based on project analysis'],
                plannedEnhancements: [
                    'AI-generated custom plan templates',
                    'Context-aware task recommendations',
                    'Smart timeline estimates',
                    'Resource requirement predictions',
                    'Risk assessments and mitigation plans'
                ]
            });
        }
        catch (error) {
            this?.sendError(res, 'Claude plan suggestions failed');
        }
    }
    generateBasicPlanSuggestions(project, patterns) {
        const suggestions = [];
        if (!project) {
            suggestions?.push({
                planType: 'feature_development',
                title: 'Project Setup and Architecture',
                description: 'Initialize project structure and core architecture',
                priority: 'high',
                estimatedWeeks: 2
            });
            return suggestions;
        }
        // Suggest plans based on detected patterns
        const hasQualityIssues = patterns?.some(p => p?.patternType === types_1.PatternType.CODING_STANDARD);
        const hasArchitecturalPatterns = patterns?.some(p => p?.patternType === types_1.PatternType.ARCHITECTURE);
        if (hasQualityIssues) {
            suggestions?.push({
                planType: 'refactoring_project',
                title: 'Code Quality Improvement',
                description: 'Address coding standard violations and improve code quality',
                priority: 'medium',
                estimatedWeeks: 3,
                reasoning: 'Detected coding standard issues in project analysis'
            });
        }
        if (!hasArchitecturalPatterns) {
            suggestions?.push({
                planType: 'architecture_migration',
                title: 'Architecture Definition',
                description: 'Establish clear architectural patterns and structure',
                priority: 'high',
                estimatedWeeks: 4,
                reasoning: 'No clear architectural patterns detected'
            });
        }
        // Always suggest testing if not much testing detected
        suggestions?.push({
            planType: 'testing_initiative',
            title: 'Testing Infrastructure Setup',
            description: 'Implement comprehensive testing strategy and increase coverage',
            priority: 'medium',
            estimatedWeeks: 2,
            reasoning: 'Proactive testing improvement recommendation'
        });
        return suggestions;
    }
    async stop() {
        await this.dbManager?.close();
        this.cache?.destroy();
        this.logger.info('Server stopped');
    }
}
exports.APIServer = APIServer;
// Start server if called directly
if (require?.main === module) {
    const server = new APIServer();
    // Graceful shutdown
    process?.on('SIGTERM', async () => {
        console?.log('Received SIGTERM, shutting down gracefully...');
        await server?.stop();
        process?.exit(0);
    });
    process?.on('SIGINT', async () => {
        console?.log('Received SIGINT, shutting down gracefully...');
        await server?.stop();
        process?.exit(0);
    });
    void server?.start();
}
//# sourceMappingURL=server.js.map