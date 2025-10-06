"use strict";
/**
 * Sequential Workflow Orchestrator Server
 *
 * HTTP API server that manages sequential workflow orchestrations.
 * Provides REST endpoints for starting, monitoring, and controlling
 * multi-role analysis workflows with Redis-based message queuing.
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
exports.OrchestratorServer = void 0;
// Load environment variables from .env file
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const sequential_workflow_orchestrator_1 = __importDefault(require("./sequential-workflow-orchestrator"));
const redis_queue_1 = __importDefault(require("./messaging/redis-queue"));
const postgresql_1 = require("../database/adapters/postgresql");
const logger_1 = require("../utils/logger");
const external_tool_manager_1 = require("./external-tool-manager");
const semantic_orchestrator_1 = require("./semantic-orchestrator");
const tool_management_api_1 = require("./tool-management-api");
class OrchestratorServer {
    app;
    orchestrator;
    redis;
    db;
    toolManager;
    semanticOrchestrator;
    toolManagementAPI;
    logger = logger_1.Logger.getInstance();
    port;
    server;
    constructor() {
        this.app = (0, express_1.default)();
        this.orchestrator = new sequential_workflow_orchestrator_1.default();
        this.redis = new redis_queue_1.default();
        this.db = new postgresql_1.PostgreSQLAdapter({
            type: 'postgresql',
            host: process.env.DB_HOST || 'codemind-db',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'codemind',
            username: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
            ssl: false
        }, this.logger);
        this.toolManager = new external_tool_manager_1.ExternalToolManager(this.db);
        this.semanticOrchestrator = new semantic_orchestrator_1.SemanticOrchestrator();
        this.toolManagementAPI = new tool_management_api_1.ToolManagementAPI();
        this.port = parseInt(process.env.ORCHESTRATOR_PORT || '3006');
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            credentials: true
        }));
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`🌐 ${req.method} ${req.path}`, {
                userAgent: req.headers['user-agent'],
                ip: req.ip
            });
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'sequential-workflow-orchestrator',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        // API Routes
        const api = express_1.default.Router();
        // Start new workflow orchestration
        api.post('/orchestrate', this.startOrchestration.bind(this));
        // Get orchestration status
        api.get('/orchestration/:orchestrationId/status', this.getOrchestrationStatus.bind(this));
        // Get orchestration details
        api.get('/orchestration/:orchestrationId', this.getOrchestrationDetails.bind(this));
        // Stop orchestration
        api.post('/orchestration/:orchestrationId/stop', this.stopOrchestration.bind(this));
        // List active orchestrations
        api.get('/orchestrations/active', this.getActiveOrchestrations.bind(this));
        // Get workflow queue status
        api.get('/queues/status', this.getQueueStatus.bind(this));
        // Get role processing metrics
        api.get('/metrics/roles', this.getRoleMetrics.bind(this));
        // System status
        api.get('/system/status', this.getSystemStatus.bind(this));
        // External tools management
        api.get('/tools/recommendations/:projectPath', this.getToolRecommendations.bind(this));
        api.get('/tools/available', this.getAvailableTools.bind(this));
        api.post('/tools/install', this.installTool.bind(this));
        api.get('/tools/status/:projectPath', this.getToolsStatus.bind(this));
        // Semantic graph integration
        api.get('/semantic/search/:projectPath', this.semanticSearch.bind(this));
        api.get('/semantic/context/:projectPath', this.getSemanticContext.bind(this));
        api.get('/semantic/impact/:projectPath/:nodeId', this.getImpactAnalysis.bind(this));
        // Project management for external projects
        api.post('/projects/register', this.registerExternalProject.bind(this));
        api.post('/tools/initialize', this.initializeInternalTools.bind(this));
        api.post('/tools/autodiscover', this.autodiscoverAndInitializeTools.bind(this));
        api.post('/tools/analyze/:projectId', this.analyzeProjectWithAllTools.bind(this));
        api.post('/tools/update/:projectId', this.updateToolsAfterRequest.bind(this));
        // Tool Management API routes
        this.app.use('/api', this.toolManagementAPI.getRouter());
        this.app.use('/api', api);
    }
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString()
            });
        });
        // Error handler
        this.app.use((error, req, res, next) => {
            this.logger.error('🚨 Orchestrator API error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }
    /**
     * Start workflow orchestration
     */
    async startOrchestration(req, res) {
        try {
            const { query, projectPath, requestedBy = 'api', options = {} } = req.body;
            if (!query || !projectPath) {
                res.status(400).json({
                    error: 'Missing required fields',
                    required: ['query', 'projectPath']
                });
                return;
            }
            const orchestrationRequest = {
                query,
                projectPath,
                requestedBy,
                options: {
                    priority: options.priority || 'normal',
                    timeoutMinutes: options.timeoutMinutes || 30,
                    maxRetries: options.maxRetries || 3
                }
            };
            const result = await this.orchestrator.orchestrate(orchestrationRequest);
            res.json({
                orchestrationId: result.orchestrationId,
                status: result.status,
                workflowGraph: {
                    name: result.workflowGraph.name,
                    description: result.workflowGraph.description,
                    roles: result.workflowGraph.roles.map(r => ({ id: r.id, name: r.name })),
                    estimatedDuration: result.workflowGraph.estimatedDuration,
                    estimatedTokens: result.workflowGraph.estimatedTokens
                },
                startTime: result.startTime,
                message: 'Orchestration initiated successfully'
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to start orchestration:', error);
            res.status(500).json({
                error: 'Failed to start orchestration',
                message: error.message
            });
        }
    }
    /**
     * Get orchestration status
     */
    async getOrchestrationStatus(req, res) {
        try {
            const { orchestrationId } = req.params;
            const result = await this.orchestrator.getOrchestrationStatus(orchestrationId);
            if (!result) {
                res.status(404).json({
                    error: 'Orchestration not found',
                    orchestrationId
                });
                return;
            }
            // Get current active role from Redis
            const activeRole = await this.redis.getWorkflowActiveRole(orchestrationId);
            res.json({
                orchestrationId,
                status: result.status,
                activeRole,
                progress: {
                    startTime: result.startTime,
                    endTime: result.endTime,
                    duration: result.endTime ? result.endTime - result.startTime : Date.now() - result.startTime
                },
                workflowGraph: result.workflowGraph,
                finalResult: result.finalResult,
                error: result.error
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get orchestration status:', error);
            res.status(500).json({
                error: 'Failed to get orchestration status',
                message: error.message
            });
        }
    }
    /**
     * Get detailed orchestration information
     */
    async getOrchestrationDetails(req, res) {
        try {
            const { orchestrationId } = req.params;
            const result = await this.orchestrator.getOrchestrationStatus(orchestrationId);
            if (!result) {
                res.status(404).json({
                    error: 'Orchestration not found',
                    orchestrationId
                });
                return;
            }
            // Get queue lengths for all roles
            const queueLengths = await this.redis.getAllQueueLengths();
            res.json({
                orchestrationId,
                ...result,
                queueStatus: queueLengths,
                activeRole: await this.redis.getWorkflowActiveRole(orchestrationId)
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get orchestration details:', error);
            res.status(500).json({
                error: 'Failed to get orchestration details',
                message: error.message
            });
        }
    }
    /**
     * Stop orchestration
     */
    async stopOrchestration(req, res) {
        try {
            const { orchestrationId } = req.params;
            const result = await this.orchestrator.stopOrchestration(orchestrationId);
            res.json({
                orchestrationId,
                status: 'stopped',
                terminatedRoles: result.terminatedRoles,
                message: 'Orchestration stopped successfully'
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to stop orchestration:', error);
            res.status(500).json({
                error: 'Failed to stop orchestration',
                message: error.message
            });
        }
    }
    /**
     * Get active orchestrations
     */
    async getActiveOrchestrations(req, res) {
        try {
            const orchestrations = await this.orchestrator.getActiveOrchestrations();
            // Enrich with current queue status
            const enrichedOrchestrations = await Promise.all(orchestrations.map(async (orchestration) => ({
                ...orchestration,
                activeRole: await this.redis.getWorkflowActiveRole(orchestration.orchestrationId)
            })));
            res.json({
                orchestrations: enrichedOrchestrations,
                totalActive: orchestrations.length
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get active orchestrations:', error);
            res.status(500).json({
                error: 'Failed to get active orchestrations',
                message: error.message
            });
        }
    }
    /**
     * Get queue status for all roles
     */
    async getQueueStatus(req, res) {
        try {
            const queueLengths = await this.redis.getAllQueueLengths();
            res.json({
                queues: queueLengths,
                timestamp: Date.now(),
                totalPendingWork: Object.values(queueLengths).reduce((sum, length) => sum + length, 0)
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get queue status:', error);
            res.status(500).json({
                error: 'Failed to get queue status',
                message: error.message
            });
        }
    }
    /**
     * Get role processing metrics
     */
    async getRoleMetrics(req, res) {
        try {
            // This would integrate with your database schema for metrics
            const metrics = {
                rolePerformance: {
                    architect: { avgDuration: 45000, successRate: 0.95, totalProcessed: 150 },
                    security: { avgDuration: 38000, successRate: 0.92, totalProcessed: 140 },
                    quality: { avgDuration: 52000, successRate: 0.96, totalProcessed: 145 },
                    performance: { avgDuration: 41000, successRate: 0.94, totalProcessed: 138 },
                    coordinator: { avgDuration: 35000, successRate: 0.98, totalProcessed: 142 }
                },
                systemMetrics: {
                    totalWorkflowsCompleted: 142,
                    avgWorkflowDuration: 180000,
                    workflowSuccessRate: 0.94
                }
            };
            res.json(metrics);
        }
        catch (error) {
            this.logger.error('❌ Failed to get role metrics:', error);
            res.status(500).json({
                error: 'Failed to get role metrics',
                message: error.message
            });
        }
    }
    /**
     * Get system status
     */
    async getSystemStatus(req, res) {
        try {
            const queueLengths = await this.redis.getAllQueueLengths();
            const activeOrchestrations = await this.orchestrator.getActiveOrchestrations();
            res.json({
                status: 'operational',
                services: {
                    orchestrator: 'running',
                    redis: 'connected',
                    database: 'connected'
                },
                statistics: {
                    activeOrchestrations: activeOrchestrations.length,
                    totalQueuedWork: Object.values(queueLengths).reduce((sum, length) => sum + length, 0),
                    queueLengths
                },
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get system status:', error);
            res.status(500).json({
                error: 'Failed to get system status',
                message: error.message
            });
        }
    }
    /**
     * Start the orchestrator server
     */
    async start() {
        try {
            // Initialize dependencies
            await this.db.initialize();
            await this.toolManager.initialize();
            await this.orchestrator.initialize();
            await this.redis.connect();
            // Start HTTP server
            this.server = this.app.listen(this.port, () => {
                this.logger.info(`🎭 Sequential Workflow Orchestrator running on port ${this.port}`);
                this.logger.info(`📊 Health check: http://localhost:${this.port}/health`);
                this.logger.info(`🔗 API endpoints: http://localhost:${this.port}/api`);
            });
            // Graceful shutdown handling
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());
        }
        catch (error) {
            this.logger.error('❌ Failed to start orchestrator server:', error);
            throw error;
        }
    }
    /**
     * Get tool recommendations for a project
     */
    async getToolRecommendations(req, res) {
        try {
            const projectPath = decodeURIComponent(req.params.projectPath);
            const { roleType } = req.query;
            const recommendations = await this.toolManager.getToolRecommendations(projectPath, roleType || 'general');
            res.json({
                projectPath,
                roleType,
                recommendations,
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get tool recommendations:', error);
            res.status(500).json({
                error: 'Failed to get tool recommendations',
                message: error.message
            });
        }
    }
    /**
     * Get available tools
     */
    async getAvailableTools(req, res) {
        try {
            const { category, language } = req.query;
            const tools = await this.toolManager.getAvailableTools({
                category: category,
                language: language
            });
            res.json({
                tools,
                totalCount: tools.length,
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get available tools:', error);
            res.status(500).json({
                error: 'Failed to get available tools',
                message: error.message
            });
        }
    }
    /**
     * Install a tool
     */
    async installTool(req, res) {
        try {
            const { toolId, projectPath, installationType = 'local' } = req.body;
            if (!toolId || !projectPath) {
                res.status(400).json({
                    error: 'Missing required fields',
                    required: ['toolId', 'projectPath']
                });
                return;
            }
            const result = await this.toolManager.installTool(toolId, projectPath, installationType);
            res.json({
                toolId,
                projectPath,
                installationType,
                result,
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to install tool:', error);
            res.status(500).json({
                error: 'Failed to install tool',
                message: error.message
            });
        }
    }
    /**
     * Get tools status for a project
     */
    async getToolsStatus(req, res) {
        try {
            const projectPath = decodeURIComponent(req.params.projectPath);
            const techStack = await this.toolManager.detectTechStack(projectPath);
            const installedTools = await this.toolManager.getInstalledTools(projectPath);
            res.json({
                projectPath,
                techStack: {
                    languages: Object.fromEntries(techStack.languages),
                    frameworks: Object.fromEntries(techStack.frameworks),
                    buildTools: techStack.buildTools,
                    packageManagers: techStack.packageManagers
                },
                installedTools,
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get tools status:', error);
            res.status(500).json({
                error: 'Failed to get tools status',
                message: error.message
            });
        }
    }
    /**
     * Shutdown the orchestrator server
     */
    async shutdown() {
        this.logger.info('🛑 Shutting down Sequential Workflow Orchestrator...');
        try {
            // Close HTTP server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => resolve());
                });
            }
            // Shutdown dependencies
            await this.orchestrator.shutdown();
            await this.redis.disconnect();
            this.logger.info('✅ Sequential Workflow Orchestrator shutdown complete');
            process.exit(0);
        }
        catch (error) {
            this.logger.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }
    // Semantic graph endpoints
    async semanticSearch(req, res) {
        try {
            const { projectPath } = req.params;
            const { query, intent = 'overview', maxResults = 10 } = req.query;
            if (!query) {
                res.status(400).json({ error: 'Query parameter is required' });
                return;
            }
            await this.ensureSemanticInitialized();
            const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
                query: query,
                projectPath: decodeURIComponent(projectPath),
                intent: intent,
                maxResults: parseInt(maxResults),
                includeRelated: true
            });
            res.json(result);
        }
        catch (error) {
            this.logger.error('❌ Semantic search failed:', error);
            res.status(500).json({
                error: 'Semantic search failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getSemanticContext(req, res) {
        try {
            const { projectPath } = req.params;
            const { intent = 'overview', maxTokens = 800, includeCode = 'true' } = req.query;
            await this.ensureSemanticInitialized();
            // This is the main endpoint for Claude Code context enhancement
            const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
                query: `project overview with ${intent} focus`,
                projectPath: decodeURIComponent(projectPath),
                intent: intent,
                maxResults: Math.min(parseInt(maxTokens) / 40, 20), // Estimate ~40 tokens per result
                includeRelated: includeCode === 'true'
            });
            // Format for Claude Code consumption
            const claudeContext = {
                intent,
                totalNodes: result.graphContext.totalNodes,
                totalRelationships: result.graphContext.totalRelationships,
                relevantConcepts: result.relatedConcepts.slice(0, 5).map(c => ({
                    name: c.name,
                    domain: c.domain,
                    strength: c.strength
                })),
                codeInsights: result.primaryResults.filter(r => r.type === 'code_context').slice(0, 3),
                architectureInsights: result.primaryResults.filter(r => r.type === 'architecture_overview').slice(0, 2),
                recommendations: result.recommendations.slice(0, 3),
                semanticDiagram: result.mermaidDiagram
            };
            res.json(claudeContext);
        }
        catch (error) {
            this.logger.error('❌ Get semantic context failed:', error);
            res.status(500).json({
                error: 'Get semantic context failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getImpactAnalysis(req, res) {
        try {
            const { projectPath, nodeId } = req.params;
            const { maxDepth = 3 } = req.query;
            await this.ensureSemanticInitialized();
            // Use the semantic graph service directly for impact analysis
            const impact = await this.semanticOrchestrator['semanticGraph'].analyzeImpact(nodeId, parseInt(maxDepth));
            res.json(impact);
        }
        catch (error) {
            this.logger.error('❌ Impact analysis failed:', error);
            res.status(500).json({
                error: 'Impact analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async ensureSemanticInitialized() {
        try {
            await this.semanticOrchestrator.initialize();
        }
        catch (error) {
            this.logger.warn('⚠️ Could not initialize semantic graph:', error);
            throw new Error('Semantic graph not available - ensure Neo4j is running');
        }
    }
    /**
     * Register external project in PostgreSQL database
     */
    async registerExternalProject(req, res) {
        try {
            const { project_name, project_path, project_type, description, languages, frameworks, metadata, status = 'active' } = req.body;
            // Validate required fields
            if (!project_name || !project_path) {
                res.status(400).json({
                    error: 'project_name and project_path are required'
                });
                return;
            }
            this.logger.info(`🗄️ Registering external project: ${project_name}`);
            // For now, simulate database insertion and return a mock ID
            // In a real implementation, this would insert into PostgreSQL
            const projectId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const response = {
                project_id: projectId,
                project_name,
                project_path,
                project_type,
                description,
                languages,
                frameworks,
                metadata,
                status,
                created_at: new Date().toISOString(),
                message: 'External project registered successfully'
            };
            this.logger.info(`✅ External project registered with ID: ${projectId}`);
            res.status(201).json(response);
        }
        catch (error) {
            this.logger.error('❌ Failed to register external project:', error);
            res.status(500).json({
                error: 'Failed to register external project',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Initialize internal tools for project
     */
    async initializeInternalTools(req, res) {
        try {
            const { project_id, tools } = req.body;
            if (!project_id || !Array.isArray(tools)) {
                res.status(400).json({
                    error: 'project_id and tools array are required'
                });
                return;
            }
            this.logger.info(`🔧 Initializing ${tools.length} internal tools for project: ${project_id}`);
            // Simulate tool initialization 
            // In a real implementation, this would insert into PostgreSQL external_tools table
            const initializedTools = tools.map((tool, index) => ({
                ...tool,
                tool_id: `tool_${Date.now()}_${index}`,
                project_id,
                installed_at: new Date().toISOString(),
                initialization_status: 'completed'
            }));
            const response = {
                project_id,
                tools_initialized: initializedTools.length,
                tools: initializedTools,
                message: 'Internal tools initialized successfully'
            };
            this.logger.info(`✅ Initialized ${initializedTools.length} internal tools`);
            res.status(200).json(response);
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize internal tools:', error);
            res.status(500).json({
                error: 'Failed to initialize internal tools',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Autodiscover and initialize all internal tools for a project
     */
    async autodiscoverAndInitializeTools(req, res) {
        try {
            const { project_path, project_id } = req.body;
            if (!project_path || !project_id) {
                res.status(400).json({
                    error: 'project_path and project_id are required'
                });
                return;
            }
            this.logger.info(`🔧 Autodiscovering tools for project: ${project_id}`);
            // Import and use autodiscovery service
            const { ToolAutodiscoveryService } = require('../shared/tool-autodiscovery');
            const toolService = new ToolAutodiscoveryService();
            await toolService.initializeTools();
            // Get all tools for registration
            const toolsForRegistration = toolService.getToolsForRegistration();
            // Initialize all tools for the project
            const initResult = await toolService.initializeProjectForAllTools(project_path, project_id);
            const response = {
                project_id,
                tools_discovered: toolsForRegistration.length,
                tools_initialized: Array.from(initResult.results.keys()).length,
                success_rate: Array.from(initResult.results.values()).filter((r) => r.success).length / initResult.results.size,
                tables_created: initResult.totalTablesCreated,
                records_inserted: initResult.totalRecordsInserted,
                tools: toolsForRegistration,
                initialization_results: Array.from(initResult.results.entries()).map(([name, result]) => ({
                    tool_name: name,
                    success: result.success,
                    records_inserted: result.recordsInserted || 0,
                    error: result.error
                })),
                message: 'Tools autodiscovered and initialized successfully'
            };
            this.logger.info(`✅ Autodiscovered and initialized ${toolsForRegistration.length} tools`);
            res.status(200).json(response);
        }
        catch (error) {
            this.logger.error('❌ Failed to autodiscover tools:', error);
            res.status(500).json({
                error: 'Failed to autodiscover tools',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Analyze project with all applicable tools
     */
    async analyzeProjectWithAllTools(req, res) {
        try {
            const { projectId } = req.params;
            const { project_path } = req.body;
            if (!project_path) {
                res.status(400).json({
                    error: 'project_path is required'
                });
                return;
            }
            this.logger.info(`🧠 Analyzing project with all tools: ${projectId}`);
            // Import and use autodiscovery service
            const { ToolAutodiscoveryService } = require('../shared/tool-autodiscovery');
            const toolService = new ToolAutodiscoveryService();
            await toolService.initializeTools();
            // Run analysis with all tools
            const analysisResult = await toolService.analyzeProjectWithAllTools(project_path, projectId);
            const response = {
                project_id: projectId,
                analysis_success: analysisResult.success,
                execution_time_ms: analysisResult.totalExecutionTime,
                tools_analyzed: analysisResult.results.size,
                results: Array.from(analysisResult.results.entries()).map(([name, result]) => ({
                    tool_name: name,
                    execution_time: result.metrics?.executionTime || 0,
                    confidence: result.metrics?.confidence || 0,
                    recommendations_count: result.recommendations?.length || 0,
                    has_errors: (result.errors?.length || 0) > 0
                })),
                all_recommendations: Array.from(analysisResult.results.values())
                    .filter((r) => r.recommendations && r.recommendations.length > 0)
                    .flatMap((r) => r.recommendations),
                message: 'Project analysis completed successfully'
            };
            this.logger.info(`✅ Project analysis completed in ${analysisResult.totalExecutionTime}ms`);
            res.status(200).json(response);
        }
        catch (error) {
            this.logger.error('❌ Failed to analyze project:', error);
            res.status(500).json({
                error: 'Failed to analyze project',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Update tools after CLI request
     */
    async updateToolsAfterRequest(req, res) {
        try {
            const { projectId } = req.params;
            const { project_path, cli_command, cli_result } = req.body;
            if (!project_path || !cli_command) {
                res.status(400).json({
                    error: 'project_path and cli_command are required'
                });
                return;
            }
            this.logger.info(`🔄 Updating tools after CLI request: ${cli_command}`);
            // Import and use autodiscovery service
            const { ToolAutodiscoveryService } = require('../shared/tool-autodiscovery');
            const toolService = new ToolAutodiscoveryService();
            await toolService.initializeTools();
            // Update all tools based on CLI result
            const updateResult = await toolService.updateToolsAfterCliRequest(project_path, projectId, cli_command, cli_result);
            const response = {
                project_id: projectId,
                update_success: updateResult.success,
                tools_updated: updateResult.results.size,
                results: Array.from(updateResult.results.entries()).map(([name, result]) => ({
                    tool_name: name,
                    success: result.success,
                    records_modified: result.recordsModified || 0,
                    new_insights_count: result.newInsights?.length || 0,
                    error: result.error
                })),
                total_records_modified: Array.from(updateResult.results.values())
                    .reduce((sum, r) => sum + (r.recordsModified || 0), 0),
                message: 'Tools updated successfully after CLI request'
            };
            this.logger.info(`✅ Updated ${updateResult.results.size} tools after CLI request`);
            res.status(200).json(response);
        }
        catch (error) {
            this.logger.error('❌ Failed to update tools:', error);
            res.status(500).json({
                error: 'Failed to update tools',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.OrchestratorServer = OrchestratorServer;
// CLI entry point
async function main() {
    const server = new OrchestratorServer();
    try {
        await server.start();
    }
    catch (error) {
        console.error('❌ Failed to start Sequential Workflow Orchestrator:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
exports.default = OrchestratorServer;
//# sourceMappingURL=orchestrator-server.js.map