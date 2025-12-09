"use strict";
/**
 * Claude Code Integration Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all Claude Code integration operations using focused services
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
exports.RequestProcessingService = exports.SessionManagementService = exports.ProjectAnalysisService = exports.PromptProcessingService = exports.ClaudeExecutionService = exports.ClaudeCodeIntegration = void 0;
const logger_1 = require("../../utils/logger");
const database_config_1 = require("../../config/database-config");
const claude_execution_service_1 = require("./services/claude-execution-service");
const prompt_processing_service_1 = require("./services/prompt-processing-service");
const project_analysis_service_1 = require("./services/project-analysis-service");
const session_management_service_1 = require("./services/session-management-service");
const request_processing_service_1 = require("./services/request-processing-service");
const claude_response_parser_1 = require("./services/claude-response-parser");
const project_context_builder_1 = require("./services/project-context-builder");
class ClaudeCodeIntegration {
    executionService;
    promptService;
    analysisService;
    sessionManager;
    requestProcessor;
    contextBuilder;
    responseParser;
    dbConnections;
    logger = logger_1.Logger.getInstance();
    initialized = false;
    constructor(executionService, promptService, analysisService, sessionManager, requestProcessor, contextBuilder, responseParser) {
        this.executionService = executionService;
        this.promptService = promptService;
        this.analysisService = analysisService;
        this.sessionManager = sessionManager;
        this.requestProcessor = requestProcessor;
        this.contextBuilder = contextBuilder;
        this.responseParser = responseParser;
        this.dbConnections = new database_config_1.DatabaseConnections();
        // Initialize services with dependency injection
        this.executionService = this.executionService || new claude_execution_service_1.ClaudeExecutionService();
        this.promptService = this.promptService || new prompt_processing_service_1.PromptProcessingService();
        this.contextBuilder = this.contextBuilder || new project_context_builder_1.ProjectContextBuilder();
        this.responseParser = this.responseParser || new claude_response_parser_1.ClaudeResponseParser();
        this.sessionManager = this.sessionManager || new session_management_service_1.SessionManagementService();
        this.analysisService = this.analysisService || new project_analysis_service_1.ProjectAnalysisService(this.executionService, this.contextBuilder, this.responseParser);
        this.requestProcessor = this.requestProcessor || new request_processing_service_1.RequestProcessingService(this.executionService, this.promptService, this.contextBuilder, this.sessionManager);
    }
    /**
     * Execute Claude Code with a specific prompt and context using centralized command processor
     */
    async executeClaudeCode(prompt, context, options = {}) {
        await this.ensureInitialized();
        try {
            this.logger.info('🤖 Executing Claude Code with centralized command processor');
            // Process prompt (handle large prompts)
            const promptResult = await this.promptService.processLargePrompt(prompt, options.projectPath || '.', prompt);
            if (!promptResult.success) {
                return {
                    success: false,
                    error: `Prompt processing failed: ${promptResult.error}`,
                    tokensUsed: promptResult.tokensUsed
                };
            }
            // Execute using Claude Code
            const response = await this.executionService.executeClaudeCode(promptResult.finalPrompt, context, options);
            // Calculate total tokens used
            const totalTokens = (response.tokensUsed || 0) + promptResult.tokensUsed;
            return {
                ...response,
                tokensUsed: totalTokens
            };
        }
        catch (error) {
            this.logger.error(`❌ Claude Code execution failed: ${error instanceof Error ? error.message : error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Perform comprehensive project analysis using Claude Code
     */
    async analyzeProject(projectPath, resumeToken) {
        await this.ensureInitialized();
        return this.analysisService.analyzeProject(projectPath, resumeToken);
    }
    /**
     * Process user request with enhanced context and prompt optimization
     */
    async processRequest(userRequest, projectPath, options = {}) {
        await this.ensureInitialized();
        return this.requestProcessor.processRequest(userRequest, projectPath, options);
    }
    /**
     * Build comprehensive project context for Claude Code
     */
    async buildProjectContext(projectPath) {
        await this.ensureInitialized();
        return this.contextBuilder.buildProjectContext(projectPath);
    }
    // Session Management Operations (delegated to SessionManagementService)
    async getSessionForProject(projectPath) {
        await this.ensureInitialized();
        return this.sessionManager.getSessionForProject(projectPath);
    }
    async startNewSession(projectPath) {
        await this.ensureInitialized();
        return this.sessionManager.startNewSession(projectPath);
    }
    async endSession(sessionId) {
        await this.ensureInitialized();
        return this.sessionManager.endSession(sessionId);
    }
    // Advanced Operations
    async processBatchRequests(requests, maxConcurrent = 3) {
        await this.ensureInitialized();
        return this.requestProcessor.processBatchRequests(requests, maxConcurrent);
    }
    async testConnection() {
        await this.ensureInitialized();
        return this.executionService.testConnection();
    }
    // Analysis Operations (delegated to ProjectAnalysisService)
    async extractUseCases(projectPath, context) {
        await this.ensureInitialized();
        return this.analysisService.extractUseCases(projectPath, context);
    }
    async assessCodeQuality(projectPath, context) {
        await this.ensureInitialized();
        return this.analysisService.assessCodeQuality(projectPath, context);
    }
    async detectUserIntentSimple(query) {
        await this.ensureInitialized();
        // Use Claude-based intent analysis instead of hardcoded keywords
        try {
            const { ClaudeIntentAnalyzer } = await Promise.resolve().then(() => __importStar(require('../../cli/commands/services/claude-intent-analyzer')));
            const analyzer = ClaudeIntentAnalyzer.getInstance();
            const result = await analyzer.analyzeQuery(query);
            if (result.success && result.analysis) {
                return {
                    category: result.analysis.intent,
                    confidence: result.analysis.confidence,
                    requiresModifications: result.analysis.requiresModifications,
                    reasoning: result.analysis.reasoning
                };
            }
        }
        catch (error) {
            this.logger.debug('Claude intent analysis unavailable, using fallback');
        }
        // Fallback - return general analysis
        return {
            category: 'general',
            confidence: 0.5,
            requiresModifications: false,
            reasoning: 'Intent analysis fallback - Claude unavailable'
        };
    }
    // Prompt Operations (delegated to PromptProcessingService)
    async processLargePrompt(prompt, projectPath, originalRequest) {
        await this.ensureInitialized();
        return this.promptService.processLargePrompt(prompt, projectPath, originalRequest);
    }
    validatePromptSize(prompt) {
        return this.executionService.validatePromptSize(prompt);
    }
    // Utility Operations
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Initialize database connections
            await this.dbConnections.initialize();
            this.initialized = true;
            this.logger.debug('🔗 Claude Code integration initialized');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize Claude Code integration:', error);
            // Continue in degraded mode
            this.initialized = true;
        }
    }
    async close() {
        if (!this.initialized)
            return;
        try {
            await this.sessionManager.cleanupExpiredSessions();
            await this.dbConnections.close();
            this.initialized = false;
            this.logger.debug('🔗 Claude Code integration closed');
        }
        catch (error) {
            this.logger.error('Failed to close Claude Code integration:', error);
        }
    }
    // Statistics and Monitoring
    getSessionStats() {
        return this.sessionManager.getSessionStats();
    }
    getExecutionStats() {
        return this.executionService.getExecutionStats();
    }
    analyzeRequestComplexity(request) {
        return this.requestProcessor.analyzeRequestComplexity(request);
    }
    // Helper Methods
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    // Factory Methods for Testing and Dependency Injection
    static createWithServices(executionService, promptService, analysisService, sessionManager, requestProcessor, contextBuilder, responseParser) {
        return new ClaudeCodeIntegration(executionService, promptService, analysisService, sessionManager, requestProcessor, contextBuilder, responseParser);
    }
    static createDefault() {
        return new ClaudeCodeIntegration();
    }
    // Backward Compatibility Methods
    async executeCommand(command, options) {
        await this.ensureInitialized();
        return this.executionService.executeCommand(command, options);
    }
    validateRequest(request) {
        return this.requestProcessor.validateRequest(request);
    }
    sanitizeInput(input) {
        return this.requestProcessor.sanitizeInput(input);
    }
}
exports.ClaudeCodeIntegration = ClaudeCodeIntegration;
// Export the main class and convenience factory
exports.default = ClaudeCodeIntegration;
// Re-export service classes for advanced usage
var claude_execution_service_2 = require("./services/claude-execution-service");
Object.defineProperty(exports, "ClaudeExecutionService", { enumerable: true, get: function () { return claude_execution_service_2.ClaudeExecutionService; } });
var prompt_processing_service_2 = require("./services/prompt-processing-service");
Object.defineProperty(exports, "PromptProcessingService", { enumerable: true, get: function () { return prompt_processing_service_2.PromptProcessingService; } });
var project_analysis_service_2 = require("./services/project-analysis-service");
Object.defineProperty(exports, "ProjectAnalysisService", { enumerable: true, get: function () { return project_analysis_service_2.ProjectAnalysisService; } });
var session_management_service_2 = require("./services/session-management-service");
Object.defineProperty(exports, "SessionManagementService", { enumerable: true, get: function () { return session_management_service_2.SessionManagementService; } });
var request_processing_service_2 = require("./services/request-processing-service");
Object.defineProperty(exports, "RequestProcessingService", { enumerable: true, get: function () { return request_processing_service_2.RequestProcessingService; } });
//# sourceMappingURL=claude-cli-integration.js.map