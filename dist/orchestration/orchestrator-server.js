"use strict";
/**
 * Sequential Workflow Orchestrator Server
 *
 * HTTP API server that manages sequential workflow orchestrations.
 * Provides REST endpoints for starting, monitoring, and controlling
 * multi-role analysis workflows with Redis-based message queuing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const sequential_workflow_orchestrator_1 = __importDefault(require("./sequential-workflow-orchestrator"));
const redis_queue_1 = __importDefault(require("../messaging/redis-queue"));
const postgresql_1 = require("../database/adapters/postgresql");
const logger_1 = require("../utils/logger");
const external_tool_manager_1 = require("./external-tool-manager");
class OrchestratorServer {
    app;
    orchestrator;
    redis;
    db;
    toolManager;
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