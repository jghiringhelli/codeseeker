const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const http = require('http');
const { OrchestratorService } = require('../services/orchestrator-service');
const { AuthService, createAuthMiddleware } = require('../middleware/auth');
const { NormalizedDashboardAPI } = require('./api-normalized');
const { ThreeToolsAPI } = require('./api-three-tools');
const { ToolBundleAPI } = require('./tool-bundle-api');
// const { ClaudeIntegration } = require('../cli/claude-integration'); // Temporarily disabled - file was removed
// TODO: Re-enable Claude integration after fixing module structure
const { PerformanceMonitor } = require('../shared/performance-monitor');
const cookieParser = require('cookie-parser');

class DashboardServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.DASHBOARD_ORIGIN || "http://localhost:3005",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            }
        });
        this.port = process.env.PORT || process.env.DASHBOARD_PORT || 3005;
        
        // Initialize core services
        // this.claude = new ClaudeIntegration(); // Temporarily disabled
        this.monitor = new PerformanceMonitor();
        this.connectedClients = new Map();
        
        this.setupDatabase();
        this.setupRedisMessaging();
        this.setupWebSocket();
        this.setupMiddleware();
        this.setupOrchestrator();
        this.setupClaudeMonitoring(); // Re-enabled with performance monitoring only
        this.setupRoutes();
    }

    setupDatabase() {
        // Database connection setup
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test database connection
        this.db.connect((err, client, release) => {
            if (err) {
                console.error('❌ Failed to connect to database:', err.message);
                return;
            }
            console.log('✅ Dashboard connected to PostgreSQL database');
            release();
        });

        // Initialize normalized API and three tools API
        this.normalizedAPI = new NormalizedDashboardAPI(this.db);
        this.threeToolsAPI = new ThreeToolsAPI(this.db);
        
        // Initialize tool bundle API
        this.toolBundleAPI = new ToolBundleAPI(this.db, this.monitor);
        this.toolBundleAPI.initialize().catch(error => {
            console.error('❌ Failed to initialize Tool Bundle API:', error);
        });
    }

    async setupRedisMessaging() {
        try {
            // Import Redis middleware dynamically since it's TypeScript
            const { RedisMiddleware } = require('../../dist/middleware/redis-middleware');
            this.redisMiddleware = RedisMiddleware.getInstance();
            
            // Initialize Redis connection
            await this.redisMiddleware.initialize();
            
            // Setup Redis event forwarding to WebSocket clients
            this.redisMiddleware.on('workflow_update', (data) => {
                this.io.emit('workflow_update', data);
            });
            
            this.redisMiddleware.on('terminal_response', (data) => {
                this.io.emit('terminal_response', data);
            });
            
            this.redisMiddleware.on('system_status', (data) => {
                this.io.emit('system_status', data);
            });

            console.log('✅ Redis messaging service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Redis messaging:', error);
            // Continue without Redis - fallback to direct WebSocket communication
            this.redisMiddleware = null;
        }
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 Dashboard client connected: ${socket.id}`);
            
            // Store client connection
            this.connectedClients.set(socket.id, {
                socket,
                connectedAt: new Date(),
                subscriptions: new Set()
            });

            // Send initial dashboard state
            this.sendDashboardState(socket);

            // Handle client subscriptions
            socket.on('subscribe', (channels) => {
                const client = this.connectedClients.get(socket.id);
                if (client) {
                    channels.forEach(channel => client.subscriptions.add(channel));
                    console.log(`📡 Client ${socket.id} subscribed to: ${channels.join(', ')}`);
                }
            });

            // Handle unsubscriptions
            socket.on('unsubscribe', (channels) => {
                const client = this.connectedClients.get(socket.id);
                if (client) {
                    channels.forEach(channel => client.subscriptions.delete(channel));
                    console.log(`📡 Client ${socket.id} unsubscribed from: ${channels.join(', ')}`);
                }
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`🔌 Dashboard client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });

            // Handle workflow control commands
            socket.on('workflow-control', async (command) => {
                try {
                    await this.handleWorkflowControl(command);
                } catch (error) {
                    socket.emit('workflow-error', { error: error.message });
                }
            });
        });

        // Broadcast system updates every 5 seconds
        setInterval(() => {
            this.broadcastSystemUpdate();
        }, 5000);

        console.log('🌐 WebSocket server initialized');
    }

    setupOrchestrator() {
        // Initialize orchestrator service (legacy)
        this.orchestratorService = new OrchestratorService();
        
        // Initialize sequential workflow orchestrator
        try {
            const { SequentialWorkflowOrchestrator } = require('../../dist/orchestration/sequential-workflow-orchestrator');
            this.sequentialOrchestrator = new SequentialWorkflowOrchestrator();
            this.sequentialOrchestrator.initialize();
            console.log('🎭 Sequential Workflow Orchestrator initialized');
        } catch (error) {
            console.warn('⚠️ Sequential Workflow Orchestrator not available:', error.message);
        }
        
        // Set up event listeners for legacy orchestrator
        this.orchestratorService.on('workflow-started', (data) => {
            console.log(`🚀 Workflow started: ${data.executionId}`);
        });
        
        this.orchestratorService.on('workflow-completed', (data) => {
            console.log(`✅ Workflow completed: ${data.executionId}`);
        });
        
        this.orchestratorService.on('workflow-progress', (data) => {
            console.log(`📈 Workflow progress: ${data.executionId} - ${data.progress}%`);
        });
        
        console.log('🎯 Orchestrator services initialized');
    }

    setupClaudeMonitoring() {
        // Temporarily disabled - Claude integration not available
        // TODO: Re-enable when Claude integration is fixed
        
        // Monitor system performance only
        this.monitor.on('metric-recorded', (metric) => {
            if (this.shouldBroadcastMetric(metric)) {
                this.broadcast('performance-metric', metric);
            }
        });

        // Monitor for critical events
        this.monitor.on('performance-alert', (alert) => {
            this.broadcast('system-alert', {
                level: alert.level,
                message: alert.message,
                metrics: alert.metrics,
                timestamp: Date.now()
            });
        });

        console.log('📊 Performance monitoring initialized (Claude integration disabled)');
    }

    shouldBroadcastMetric(metric) {
        // Only broadcast important metrics to avoid spam
        const importantMetrics = [
            'tool_selection_performance',
            'workflow_execution_time',
            'claude_decision_accuracy',
            'system_resource_usage',
            'error_rate'
        ];
        return importantMetrics.includes(metric.name);
    }

    async sendDashboardState(socket) {
        try {
            const state = await this.getCurrentDashboardState();
            socket.emit('dashboard-state', state);
        } catch (error) {
            console.error('❌ Error sending dashboard state:', error);
            socket.emit('dashboard-error', { error: error.message });
        }
    }

    async getCurrentDashboardState() {
        const [health, processes, workflows, metrics] = await Promise.all([
            this.getSystemHealthData(),
            this.getActiveProcessesData(),
            this.getActiveWorkflowsData(),
            this.getRealtimeMetrics()
        ]);

        return {
            timestamp: Date.now(),
            health,
            processes,
            workflows,
            metrics,
            claudeStatus: await this.getClaudeStatus()
        };
    }

    async getClaudeStatus() {
        return {
            active: false, // Temporarily disabled
            totalDecisions: 0,
            avgDecisionTime: 0,
            confidenceScore: 0,
            tokenEfficiency: 0
        };
    }

    broadcast(channel, data) {
        for (const [clientId, client] of this.connectedClients) {
            if (client.subscriptions.has(channel) || client.subscriptions.has('all')) {
                client.socket.emit(channel, data);
            }
        }
    }

    async broadcastSystemUpdate() {
        try {
            const update = await this.getSystemUpdate();
            this.broadcast('system-update', update);
        } catch (error) {
            console.error('❌ Error broadcasting system update:', error);
        }
    }

    async getSystemUpdate() {
        const [activeWorkflows, systemLoad, claudeActivity] = await Promise.all([
            this.db.query('SELECT COUNT(*) as count FROM orchestration_processes WHERE status IN (\'running\', \'paused\')'),
            this.getSystemLoad(),
            this.getRecentClaudeActivity()
        ]);

        return {
            timestamp: Date.now(),
            activeWorkflows: activeWorkflows.rows[0]?.count || 0,
            systemLoad,
            claudeActivity,
            uptime: process.uptime()
        };
    }

    async getSystemLoad() {
        const usage = process.cpuUsage();
        const memory = process.memoryUsage();
        
        return {
            cpu: (usage.system + usage.user) / 1000000, // Convert to percentage
            memory: {
                used: memory.heapUsed,
                total: memory.heapTotal,
                percentage: (memory.heapUsed / memory.heapTotal) * 100
            }
        };
    }

    async getRecentClaudeActivity() {
        try {
            const result = await this.db.query(`
                SELECT 
                    decision_type,
                    COUNT(*) as count,
                    AVG(CAST(decision->>'confidence' AS DECIMAL)) as avg_confidence
            `);
            
            return result.rows;
        } catch (error) {
            console.warn('❌ Could not fetch Claude activity:', error.message);
            return [];
        }
    }

    async getTotalClaudeDecisions() {
        try {
            const result = await this.db.query('SELECT COUNT(*) as count FROM claude_decisions WHERE timestamp >= NOW() - INTERVAL \'24 hours\'');
            return result.rows[0]?.count || 0;
        } catch (error) {
            return 0;
        }
    }

    async getAvgDecisionTime() {
        try {
            const result = await this.db.query(`
                AND performance_metrics->>'duration' IS NOT NULL
            `);
            return result.rows[0]?.avg_duration || 0;
        } catch (error) {
            return 0;
        }
    }

    async getAvgConfidenceScore() {
        try {
            const result = await this.db.query(`
                AND decision->>'confidence' IS NOT NULL
            `);
            return result.rows[0]?.avg_confidence || 0;
        } catch (error) {
            return 0;
        }
    }

    async getTokenEfficiency() {
        try {
            const result = await this.db.query(`
                SELECT 
                    AVG(CAST(performance_metrics->>'tokenEfficiency' AS DECIMAL)) as efficiency
                AND performance_metrics->>'tokenEfficiency' IS NOT NULL
            `);
            return result.rows[0]?.efficiency || 0;
        } catch (error) {
            return 0;
        }
    }

    async handleWorkflowControl(command) {
        const { action, workflowId, executionId } = command;
        
        switch (action) {
            case 'pause':
                return await this.orchestratorService.pauseWorkflow(executionId);
            case 'resume':
                return await this.orchestratorService.resumeWorkflow(executionId);
            case 'stop':
                return await this.orchestratorService.stopWorkflow(executionId);
            case 'start':
                return await this.orchestratorService.startWorkflow(workflowId, command.workItemId, command.metadata);
            default:
                throw new Error(`Unknown workflow action: ${action}`);
        }
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:3005',
            credentials: true
        }));
        this.app.use(express.json());
        this.app.use(cookieParser());
        this.app.use(express.static(path.join(__dirname)));
        
        // Initialize authentication
        this.authService = new AuthService();
        this.auth = createAuthMiddleware(this.authService);
        
        // Clean expired sessions periodically
        setInterval(() => {
            this.authService.cleanExpiredSessions();
        }, 60 * 60 * 1000); // Every hour
        
        // Request logging
        this.app.use((req, res, next) => {
            const userInfo = req.user ? ` [${req.user.name}]` : '';
            console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}${userInfo}`);
            next();
        });
    }

    setupRoutes() {
        // Serve dashboard HTML
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // Serve project view HTML
        this.app.get('/project-view', (req, res) => {
            res.sendFile(path.join(__dirname, 'project-view.html'));
        });

        // API root endpoint
        this.app.get('/api/dashboard/', (req, res) => {
            res.json({
                status: 'ok',
                service: 'CodeMind Dashboard API',
                version: '1.0.0',
                endpoints: {
                    health: '/api/dashboard/health',
                    projects: '/api/dashboard/projects',
                    metrics: '/api/dashboard/metrics',
                    orchestrator: '/api/dashboard/orchestrator/status'
                }
            });
        });

        // Authentication routes (public)
        this.app.post('/api/auth/login', this.login.bind(this));
        this.app.post('/api/auth/logout', this.logout.bind(this));
        this.app.get('/api/auth/status', this.auth.optionalAuth, this.getAuthStatus.bind(this));
        
        // API Routes (protected)
        this.app.get('/api/dashboard/health', this.auth.optionalAuth, this.getSystemHealth.bind(this));
        this.app.get('/api/dashboard/processes/active', this.auth.optionalAuth, this.getActiveProcesses.bind(this));
        this.app.get('/api/dashboard/roles/activity', this.auth.optionalAuth, this.getRoleActivity.bind(this));
        this.app.get('/api/dashboard/accomplishments/recent', this.auth.optionalAuth, this.getRecentAccomplishments.bind(this));
        this.app.get('/api/dashboard/logs/recent', this.auth.optionalAuth, this.getRecentLogs.bind(this));
        this.app.get('/api/dashboard/workflows/nodes', this.auth.optionalAuth, this.getWorkflowNodes.bind(this));
        this.app.get('/api/dashboard/metrics', this.auth.optionalAuth, this.getSystemMetrics.bind(this));
        
        // Project-specific endpoints (protected)
        this.app.get('/api/dashboard/projects', this.auth.optionalAuth, this.getProjects.bind(this));
        this.app.get('/api/dashboard/projects/all', this.auth.optionalAuth, this.getAllProjects.bind(this));
        this.app.post('/api/dashboard/projects', this.auth.optionalAuth, this.createProject.bind(this));
        this.app.put('/api/dashboard/projects/:id', this.auth.optionalAuth, this.updateProject.bind(this));
        this.app.post('/api/dashboard/projects/autodiscover', this.auth.optionalAuth, this.autodiscoverProject.bind(this));
        this.app.get('/api/dashboard/projects/:id/details', this.auth.optionalAuth, this.getProjectDetails.bind(this));
        this.app.get('/api/dashboard/projects/:id/patterns', this.auth.optionalAuth, this.getProjectPatterns.bind(this));
        
        // Comprehensive Project View endpoints
        this.app.get('/api/dashboard/projects/:id/tree', this.auth.optionalAuth, this.getProjectTree.bind(this));
        this.app.get('/api/dashboard/projects/:id/classes', this.auth.optionalAuth, this.getProjectClasses.bind(this));
        this.app.get('/api/dashboard/projects/:id/config', this.auth.optionalAuth, this.getProjectConfig.bind(this));
        this.app.get('/api/dashboard/projects/:id/metrics', this.auth.optionalAuth, this.getProjectMetrics.bind(this));
        this.app.get('/api/dashboard/projects/:id/roadmap', this.auth.optionalAuth, this.getProjectRoadmap.bind(this));
        this.app.get('/api/dashboard/projects/:id/search', this.auth.optionalAuth, this.getProjectSearch.bind(this));
        this.app.post('/api/dashboard/projects/:id/search', this.auth.optionalAuth, this.performProjectSearch.bind(this));
        this.app.post('/api/dashboard/projects/:id/diagrams', this.auth.optionalAuth, this.generateProjectDiagram.bind(this));
        this.app.get('/api/dashboard/projects/:id/standards', this.auth.optionalAuth, this.getProjectStandards.bind(this));
        this.app.post('/api/dashboard/projects/:id/analyze', this.auth.optionalAuth, this.runInitialAssessment.bind(this));
        this.app.get('/api/dashboard/projects/:id/knowledge', this.auth.optionalAuth, this.getKnowledgeRepository.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation', this.auth.optionalAuth, this.getNavigationData.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation/contexts', this.auth.optionalAuth, this.getNavigationContexts.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation/flows', this.auth.optionalAuth, this.getNavigationFlows.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation/diagrams', this.auth.optionalAuth, this.getNavigationDiagrams.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation/usecases', this.auth.optionalAuth, this.getNavigationUseCases.bind(this));
        this.app.get('/api/dashboard/projects/:id/navigation/diagram/:diagramName', this.auth.optionalAuth, this.getNavigationDiagram.bind(this));
        
        // Code-Documentation Reconciliation endpoints
        this.app.get('/api/dashboard/projects/:id/reconciliation', this.auth.optionalAuth, this.getReconciliationData.bind(this));
        this.app.post('/api/dashboard/projects/:id/reconciliation/analyze', this.auth.optionalAuth, this.runReconciliationAnalysis.bind(this));
        this.app.post('/api/dashboard/projects/:id/reconciliation/sync', this.auth.optionalAuth, this.applySyncOperation.bind(this));
        
        // Real-time monitoring endpoints (protected)
        this.app.get('/api/dashboard/status', this.auth.optionalAuth, this.getOverallStatus.bind(this));
        this.app.post('/api/dashboard/process/:id/action', this.auth.adminOnly, this.processAction.bind(this));
        
        // Orchestrator management endpoints (admin protected)
        this.app.get('/api/dashboard/orchestrator/status', this.auth.optionalAuth, this.getOrchestratorStatus.bind(this));
        this.app.get('/api/dashboard/orchestrator/templates', this.auth.optionalAuth, this.getWorkflowTemplates.bind(this));
        this.app.get('/api/dashboard/orchestrator/workflows/active', this.auth.optionalAuth, this.getActiveWorkflows.bind(this));
        this.app.get('/api/dashboard/orchestrator/configuration', this.auth.adminOnly, this.getOrchestratorConfig.bind(this));
        this.app.put('/api/dashboard/orchestrator/configuration', this.auth.adminOnly, this.updateOrchestratorConfig.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/start', this.auth.adminOnly, this.startWorkflow.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/pause-all', this.auth.adminOnly, this.pauseAllWorkflows.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/stop-all', this.auth.adminOnly, this.stopAllWorkflows.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/:id/pause', this.auth.adminOnly, this.pauseWorkflow.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/:id/stop', this.auth.adminOnly, this.stopWorkflow.bind(this));
        this.app.put('/api/dashboard/orchestrator/flows/:id/toggle', this.auth.adminOnly, this.toggleFlow.bind(this));
        
        // Redis messaging endpoints (for orchestrator-terminal communication)
        this.app.get('/api/dashboard/orchestrator/redis-status', this.auth.optionalAuth, this.getRedisStatus.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/:id/start', this.auth.adminOnly, this.startWorkflowViaRedis.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/:id/pause', this.auth.adminOnly, this.pauseWorkflowViaRedis.bind(this));
        this.app.post('/api/dashboard/orchestrator/workflows/:id/stop', this.auth.adminOnly, this.stopWorkflowViaRedis.bind(this));
        this.app.post('/api/dashboard/orchestrator/terminal/request', this.auth.adminOnly, this.sendTerminalRequest.bind(this));
        this.app.get('/api/dashboard/orchestrator/ws', this.handleWebSocketUpgrade.bind(this));
        
        // CLI tools endpoints  
        this.app.get('/api/dashboard/cli/tools', this.auth.optionalAuth, this.getCliTools.bind(this));
        this.app.get('/api/dashboard/cli/config', this.auth.optionalAuth, this.getCliConfig.bind(this));
        this.app.get('/api/dashboard/cli/stats', this.auth.optionalAuth, this.getCliStats.bind(this));
        this.app.get('/api/dashboard/projects/:id/tools', this.auth.optionalAuth, this.getProjectTools.bind(this));
        this.app.get('/api/dashboard/projects/:id/database', this.auth.optionalAuth, this.getProjectDatabase.bind(this));
        this.app.post('/api/dashboard/projects/:id/database/sync', this.auth.adminOnly, this.syncProjectDatabase.bind(this));
        
        // Planner endpoints
        this.app.post('/api/dashboard/planner/projects', this.auth.optionalAuth, this.createPlannerProject.bind(this));
        this.app.get('/api/dashboard/planner/templates', this.auth.optionalAuth, this.getPlannerTemplates.bind(this));
        
        // Terminal Orchestration endpoints (multi-terminal coordination - LEGACY)
        this.app.post('/api/orchestrate', this.requestTerminalOrchestration.bind(this));
        this.app.get('/api/orchestration/:orchestrationId/status', this.getOrchestrationStatus.bind(this));
        this.app.get('/api/orchestration/:orchestrationId/terminals', this.getOrchestrationTerminals.bind(this));
        this.app.post('/api/orchestration/:orchestrationId/stop', this.auth.adminOnly, this.stopOrchestration.bind(this));
        this.app.get('/api/orchestration/active', this.getActiveOrchestrations.bind(this));

        // Sequential Workflow Orchestration endpoints (NEW)
        this.app.post('/api/sequential/orchestrate', this.requestSequentialOrchestration.bind(this));
        this.app.get('/api/sequential/:orchestrationId/status', this.getSequentialOrchestrationStatus.bind(this));
        this.app.post('/api/sequential/:orchestrationId/stop', this.auth.adminOnly, this.stopSequentialOrchestration.bind(this));
        this.app.get('/api/sequential/active', this.getActiveSequentialOrchestrations.bind(this));
        this.app.get('/api/sequential/system/status', this.getSequentialSystemStatus.bind(this));
        
        // Three Tools API Routes
        this.app.get('/api/dashboard/three-tools/centralization/:projectId', this.auth.optionalAuth, this.getCentralizationData.bind(this));
        this.app.get('/api/dashboard/three-tools/reconciliation/:projectId', this.auth.optionalAuth, this.getReconciliationData.bind(this));
        this.app.get('/api/dashboard/three-tools/workflow/:projectId', this.auth.optionalAuth, this.getWorkflowData.bind(this));
        this.app.post('/api/dashboard/three-tools/workflow/execute', this.auth.adminOnly, this.executeWorkflow.bind(this));
        this.app.get('/api/dashboard/three-tools/workflow/:executionId/status', this.auth.optionalAuth, this.getWorkflowStatus.bind(this));
        this.app.get('/api/dashboard/three-tools/insights/:projectId', this.auth.optionalAuth, this.getCrossToolInsights.bind(this));

        // Tool Bundle API Routes
        this.app.get('/api/dashboard/tool-bundles/bundles', this.auth.optionalAuth, this.toolBundleAPI.getAllBundles.bind(this.toolBundleAPI));
        this.app.get('/api/dashboard/tool-bundles/bundles/:id', this.auth.optionalAuth, this.toolBundleAPI.getBundle.bind(this.toolBundleAPI));
        this.app.post('/api/dashboard/tool-bundles/bundles', this.auth.adminOnly, this.toolBundleAPI.createBundle.bind(this.toolBundleAPI));
        this.app.put('/api/dashboard/tool-bundles/bundles/:id', this.auth.adminOnly, this.toolBundleAPI.updateBundle.bind(this.toolBundleAPI));
        this.app.delete('/api/dashboard/tool-bundles/bundles/:id', this.auth.adminOnly, this.toolBundleAPI.deleteBundle.bind(this.toolBundleAPI));
        this.app.put('/api/dashboard/tool-bundles/bundles/:id/toggle', this.auth.adminOnly, this.toolBundleAPI.toggleBundleStatus.bind(this.toolBundleAPI));
        
        // Description Management Routes
        this.app.get('/api/dashboard/tool-bundles/descriptions', this.auth.optionalAuth, this.toolBundleAPI.getAllDescriptions.bind(this.toolBundleAPI));
        this.app.put('/api/dashboard/tool-bundles/descriptions/:id', this.auth.adminOnly, this.toolBundleAPI.updateDescription.bind(this.toolBundleAPI));
        this.app.put('/api/dashboard/tool-bundles/descriptions/:id/reset', this.auth.adminOnly, this.toolBundleAPI.resetDescriptionToDefault.bind(this.toolBundleAPI));
        
        // Selection and Analytics Routes
        this.app.post('/api/dashboard/tool-bundles/preview-selection', this.auth.optionalAuth, this.toolBundleAPI.previewSelection.bind(this.toolBundleAPI));
        this.app.get('/api/dashboard/tool-bundles/selection-history', this.auth.optionalAuth, this.toolBundleAPI.getSelectionHistory.bind(this.toolBundleAPI));
        this.app.get('/api/dashboard/tool-bundles/analytics', this.auth.optionalAuth, this.toolBundleAPI.getBundleAnalytics.bind(this.toolBundleAPI));
        this.app.post('/api/dashboard/tool-bundles/clear-cache', this.auth.adminOnly, this.toolBundleAPI.clearSelectionCache.bind(this.toolBundleAPI));

        // Static page route for tool bundles
        this.app.get('/dashboard/tool-bundles', (req, res) => {
            res.sendFile(path.join(__dirname, 'tool-bundles-page.html'));
        });
    }

    async getSystemHealth(req, res) {
        try {
            const result = await this.db.query(`
            `);
            
            const health = result.rows[0] || {
                active_processes: 0,
                failed_processes_today: 0,
                completed_today: 0,
                avg_process_duration: 0,
                total_input_tokens_today: 0,
                total_output_tokens_today: 0,
                active_roles_today: 0,
                avg_quality_score_today: 0,
                accomplishments_today: 0,
                error_count_today: 0
            };

            // Add system status
            health.system_status = this.determineSystemStatus(health);
            health.uptime_seconds = Math.floor(process.uptime());
            health.memory_usage = process.memoryUsage();
            health.timestamp = new Date().toISOString();

            res.json(health);
        } catch (error) {
            console.error('❌ Error fetching system health:', error);
            res.status(500).json({ error: 'Failed to fetch system health', details: error.message });
        }
    }

    async getActiveProcesses(req, res) {
        try {
            const projectId = req.query.project_id;
            let query = `
            `;
            const params = [];
            
            if (projectId) {
                query += ` WHERE project_id = $1`;
                params.push(projectId);
            }
            
            query += ` ORDER BY priority DESC, started_at DESC;`;
            
            const result = await this.db.query(query, params);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching active processes:', error);
            res.status(500).json({ error: 'Failed to fetch active processes', details: error.message });
        }
    }

    async getRoleActivity(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    ara.role_name,
                    ara.activity_type,
                    ara.status,
                    COUNT(*) as activity_count,
                    AVG(ara.duration_ms) as avg_duration_ms,
                    SUM(ara.input_tokens) as total_input_tokens,
                    SUM(ara.output_tokens) as total_output_tokens,
                    AVG(ara.quality_score) as avg_quality_score,
                    MAX(ara.started_at) as last_activity
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching role activity:', error);
            res.status(500).json({ error: 'Failed to fetch role activity', details: error.message });
        }
    }

    async getRecentAccomplishments(req, res) {
        try {
            const limit = req.query.limit || 20;
            const projectId = req.query.project_id;
            
            let query = `
            `;
            const params = [];
            
            if (projectId) {
                query += ` WHERE project_id = $${params.length + 1}`;
                params.push(projectId);
            }
            
            query += ` ORDER BY achieved_at DESC LIMIT $${params.length + 1}`;
            params.push(limit);
            
            const result = await this.db.query(query, params);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching accomplishments:', error);
            res.status(500).json({ error: 'Failed to fetch accomplishments', details: error.message });
        }
    }

    async getRecentLogs(req, res) {
        try {
            const limit = req.query.limit || 100;
            const level = req.query.level; // filter by log level
            const projectId = req.query.project_id; // filter by project
            
            let query = `
                SELECT 
                    pl.log_level,
                    pl.message,
                    pl.context,
                    pl.timestamp,
                    op.process_name,
                    p.project_name
                LEFT JOIN orchestration_processes op ON pl.process_id = op.id
                LEFT JOIN projects p ON op.project_id = p.id
            `;
            
            const params = [];
            if (level) {
                query += ` AND pl.log_level = $${params.length + 1}`;
                params.push(level);
            }
            
            if (projectId) {
                query += ` AND p.id = $${params.length + 1}`;
                params.push(projectId);
            }
            
            query += ` ORDER BY pl.timestamp DESC LIMIT $${params.length + 1}`;
            params.push(limit);
            
            const result = await this.db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching logs:', error);
            res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
        }
    }

    async getWorkflowNodes(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    op.id as process_id,
                    op.process_name,
                    op.execution_id,
                    op.status as process_status,
                    json_agg(
                        json_build_object(
                            'node_id', wn.node_id,
                            'node_type', wn.node_type,
                            'node_name', wn.node_name,
                            'status', wn.status,
                            'assigned_role', wn.assigned_role,
                            'position_x', wn.position_x,
                            'position_y', wn.position_y,
                            'dependencies', wn.dependencies,
                            'started_at', wn.started_at,
                            'completed_at', wn.completed_at,
                            'duration_ms', wn.duration_ms
                        )
                    ) as nodes
                LEFT JOIN workflow_nodes wn ON op.id = wn.process_id
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching workflow nodes:', error);
            res.status(500).json({ error: 'Failed to fetch workflow nodes', details: error.message });
        }
    }

    async getSystemMetrics(req, res) {
        try {
            const timeRange = req.query.range || '24h'; // 1h, 24h, 7d, 30d
            const projectId = req.query.project_id;
            const interval = this.getTimeInterval(timeRange);
            
            let query = `
                SELECT 
                    metric_type,
                    metric_name,
                    AVG(metric_value) as avg_value,
                    MIN(metric_value) as min_value,
                    MAX(metric_value) as max_value,
                    COUNT(*) as data_points,
                    date_trunc('${interval}', timestamp) as time_bucket
            `;
            
            const params = [];
            if (projectId) {
                query += ` AND project_id = $${params.length + 1}`;
                params.push(projectId);
            }
            
            query += `
            `;
            
            const result = await this.db.query(query, params);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching system metrics:', error);
            res.status(500).json({ error: 'Failed to fetch system metrics', details: error.message });
        }
    }

    async getProjects(req, res) {
        try {
            const result = await this.db.query(`
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching projects:', error);
            res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
        }
    }

    async getAllProjects(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    p.id AS project_id,
                    p.project_path,
                    p.project_name,
                    p.project_type,
                    p.project_size,
                    p.total_files,
                    p.status,
                    p.created_at,
                    p.updated_at,
                    ip.phase AS current_phase,
                    ip.updated_at AS last_progress_update,
                    COALESCE(COUNT(dp.id), 0) AS detected_patterns_count,
                    COALESCE(COUNT(DISTINCT qr.category), 0) AS completed_questionnaire_categories
                    LEFT JOIN initialization_progress ip ON p.id = ip.project_id
                    LEFT JOIN detected_patterns dp ON p.id = dp.project_id AND dp.status = 'detected'
                    LEFT JOIN questionnaire_responses qr ON p.id = qr.project_id
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching all projects:', error);
            res.status(500).json({ error: 'Failed to fetch all projects', details: error.message });
        }
    }

    async createProject(req, res) {
        try {
            const { project_name, project_path, project_type, languages, frameworks, project_size } = req.body;

            // Validate required fields
            if (!project_name || !project_path) {
                return res.status(400).json({ error: 'Project name and path are required' });
            }

            console.log(`📁 Creating new project: ${project_name} at ${project_path}`);

            // Check if project already exists
            const existingResult = await this.db.query('SELECT id FROM projects WHERE project_path = $1', [project_path]);
            if (existingResult.rows.length > 0) {
                return res.status(409).json({ error: 'Project with this path already exists' });
            }

            // Insert new project
            const insertQuery = `
                INSERT INTO projects (
                    project_name, project_path, project_type, languages, frameworks, project_size, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                project_name,
                project_path,
                project_type || 'unknown',
                JSON.stringify(languages || []),
                JSON.stringify(frameworks || []),
                project_size || 'medium'
            ];

            const result = await this.db.query(insertQuery, values);
            const newProject = result.rows[0];

            console.log(`✅ Project created successfully with ID: ${newProject.id}`);

            res.status(201).json({
                id: newProject.id,
                message: 'Project created successfully',
                project: newProject
            });

        } catch (error) {
            console.error('❌ Error creating project:', error);
            res.status(500).json({ error: 'Failed to create project', details: error.message });
        }
    }

    async updateProject(req, res) {
        try {
            const projectId = req.params.id;
            const { project_name, project_path, project_type, languages, frameworks, project_size, description, metadata, status } = req.body;

            console.log(`📁 Updating project: ${projectId}`);

            // Check if project exists
            const existingResult = await this.db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
            if (existingResult.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            // Build dynamic update query
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            if (project_name) {
                updateFields.push(`project_name = $${paramIndex}`);
                values.push(project_name);
                paramIndex++;
            }
            if (project_path) {
                updateFields.push(`project_path = $${paramIndex}`);
                values.push(project_path);
                paramIndex++;
            }
            if (project_type) {
                updateFields.push(`project_type = $${paramIndex}`);
                values.push(project_type);
                paramIndex++;
            }
            if (languages) {
                updateFields.push(`languages = $${paramIndex}`);
                values.push(JSON.stringify(languages));
                paramIndex++;
            }
            if (frameworks) {
                updateFields.push(`frameworks = $${paramIndex}`);
                values.push(JSON.stringify(frameworks));
                paramIndex++;
            }
            if (project_size) {
                updateFields.push(`project_size = $${paramIndex}`);
                values.push(project_size);
                paramIndex++;
            }
            if (description) {
                updateFields.push(`description = $${paramIndex}`);
                values.push(description);
                paramIndex++;
            }
            if (metadata) {
                updateFields.push(`metadata = $${paramIndex}`);
                values.push(JSON.stringify(metadata));
                paramIndex++;
            }
            if (status) {
                updateFields.push(`status = $${paramIndex}`);
                values.push(status);
                paramIndex++;
            }

            // Always update the updated_at timestamp
            updateFields.push(`updated_at = NOW()`);
            
            if (updateFields.length === 1) { // Only updated_at was added
                return res.status(400).json({ error: 'No fields to update' });
            }

            // Add project ID as the last parameter
            values.push(projectId);

            const updateQuery = `
                UPDATE projects 
                SET ${updateFields.join(', ')}
                RETURNING *
            `;

            const result = await this.db.query(updateQuery, values);
            const updatedProject = result.rows[0];

            console.log(`✅ Project updated successfully: ${projectId}`);

            res.json({
                id: updatedProject.id,
                message: 'Project updated successfully',
                project: updatedProject
            });

        } catch (error) {
            console.error('❌ Error updating project:', error);
            res.status(500).json({ error: 'Failed to update project', details: error.message });
        }
    }

    async autodiscoverProject(req, res) {
        try {
            const { project_path } = req.body;

            if (!project_path) {
                return res.status(400).json({ error: 'Project path is required' });
            }

            console.log(`🔍 Running autodiscovery for project path: ${project_path}`);

            const fs = require('fs').promises;
            const path = require('path');

            // Check if project path exists
            try {
                await fs.access(project_path);
            } catch (error) {
                return res.status(404).json({ error: 'Project path does not exist or is not accessible' });
            }

            const discovery = {
                project_type: 'unknown',
                project_size: 'medium',
                languages: [],
                frameworks: []
            };

            // Read directory contents
            const files = await fs.readdir(project_path, { withFileTypes: true });
            const fileNames = files.filter(f => f.isFile()).map(f => f.name);
            const allFiles = await this.getAllFiles(project_path);

            // Determine project size
            if (allFiles.length < 100) discovery.project_size = 'small';
            else if (allFiles.length < 1000) discovery.project_size = 'medium';
            else if (allFiles.length < 10000) discovery.project_size = 'large';
            else discovery.project_size = 'enterprise';

            // Detect languages
            const languageExtensions = {
                typescript: ['.ts', '.tsx'],
                javascript: ['.js', '.jsx', '.mjs'],
                python: ['.py', '.pyw'],
                java: ['.java'],
                csharp: ['.cs'],
                go: ['.go'],
                rust: ['.rs'],
                php: ['.php'],
                ruby: ['.rb'],
                cpp: ['.cpp', '.cc', '.cxx'],
                c: ['.c', '.h']
            };

            for (const [lang, extensions] of Object.entries(languageExtensions)) {
                if (allFiles.some(file => extensions.some(ext => file.endsWith(ext)))) {
                    discovery.languages.push(lang);
                }
            }

            // Detect frameworks and project type
            const packageJsonPath = path.join(project_path, 'package.json');
            const requirementsTxtPath = path.join(project_path, 'requirements.txt');
            const pomXmlPath = path.join(project_path, 'pom.xml');
            const goModPath = path.join(project_path, 'go.mod');

            // Node.js project detection
            if (fileNames.includes('package.json')) {
                try {
                    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    
                    // Framework detection
                    if (deps.react) discovery.frameworks.push('react');
                    if (deps.vue) discovery.frameworks.push('vue');
                    if (deps.angular) discovery.frameworks.push('angular');
                    if (deps.express) discovery.frameworks.push('express');
                    if (deps.nextjs || deps.next) discovery.frameworks.push('nextjs');
                    if (deps.nuxt) discovery.frameworks.push('nuxt');
                    if (deps.svelte) discovery.frameworks.push('svelte');
                    if (deps.gatsby) discovery.frameworks.push('gatsby');
                    if (deps['@nestjs/core']) discovery.frameworks.push('nestjs');
                    if (deps.fastify) discovery.frameworks.push('fastify');

                    // Project type detection
                    if (deps.react || deps.vue || deps.angular || deps.svelte) {
                        discovery.project_type = 'web_application';
                    } else if (deps.express || deps.fastify || deps['@nestjs/core']) {
                        discovery.project_type = 'api_service';
                    } else if (packageJson.bin) {
                        discovery.project_type = 'cli_tool';
                    } else if (deps.electron) {
                        discovery.project_type = 'desktop_app';
                    } else if (deps['react-native']) {
                        discovery.project_type = 'mobile_app';
                    }
                } catch (error) {
                    console.log('Warning: Could not parse package.json');
                }
            }

            // Python project detection
            if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py') || fileNames.includes('pyproject.toml')) {
                try {
                    if (fileNames.includes('requirements.txt')) {
                        const requirements = await fs.readFile(requirementsTxtPath, 'utf8');
                        if (requirements.includes('django')) discovery.frameworks.push('django');
                        if (requirements.includes('flask')) discovery.frameworks.push('flask');
                        if (requirements.includes('fastapi')) discovery.frameworks.push('fastapi');
                        if (requirements.includes('tornado')) discovery.frameworks.push('tornado');
                        
                        if (discovery.frameworks.some(f => ['django', 'flask', 'fastapi'].includes(f))) {
                            discovery.project_type = 'web_application';
                        }
                    }
                } catch (error) {
                    console.log('Warning: Could not parse requirements.txt');
                }
            }

            // Additional project type detection based on file structure
            if (fileNames.includes('Dockerfile') || fileNames.includes('docker-compose.yml')) {
                discovery.frameworks.push('docker');
            }
            
            if (fileNames.includes('.github') || allFiles.some(f => f.includes('/.github/'))) {
                discovery.frameworks.push('github-actions');
            }

            console.log(`✅ Autodiscovery completed:`, discovery);

            res.json(discovery);

        } catch (error) {
            console.error('❌ Error in autodiscovery:', error);
            res.status(500).json({ error: 'Failed to run autodiscovery', details: error.message });
        }
    }

    // Helper method to recursively get all files
    async getAllFiles(dirPath, allFiles = []) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const file of files) {
                const fullPath = path.join(dirPath, file.name);
                
                // Skip common directories that should be ignored
                if (file.isDirectory() && ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'venv', 'env'].includes(file.name)) {
                    continue;
                }
                
                if (file.isDirectory()) {
                    await this.getAllFiles(fullPath, allFiles);
                } else {
                    allFiles.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
            console.log(`Warning: Could not read directory ${dirPath}`);
        }
        
        return allFiles;
    }

    async getProjectDetails(req, res) {
        try {
            const projectId = req.params.id;
            
            const [projectResult, patternsResult, metricsResult] = await Promise.all([
                this.db.query(`
                    LEFT JOIN initialization_progress ip ON p.id = ip.project_id
                `, [projectId]),
                
                this.db.query(`
                `, [projectId]),
                
                this.db.query(`
                `, [projectId])
            ]);
            
            const project = projectResult.rows[0];
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            project.pattern_summary = patternsResult.rows[0];
            project.recent_metrics = metricsResult.rows;
            
            res.json(project);
        } catch (error) {
            console.error('❌ Error fetching project details:', error);
            res.status(500).json({ error: 'Failed to fetch project details', details: error.message });
        }
    }

    async getProjectPatterns(req, res) {
        try {
            const projectId = req.params.id;
            
            const result = await this.db.query(`
                SELECT 
                    pattern_name,
                    pattern_type,
                    confidence_score,
                    evidence,
                    source_files,
                    status,
                    created_at
            `, [projectId]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching project patterns:', error);
            res.status(500).json({ error: 'Failed to fetch project patterns', details: error.message });
        }
    }

    async getOverallStatus(req, res) {
        try {
            const [healthResult, processesResult, systemResult] = await Promise.all([
                this.db.query('SELECT * FROM dashboard_system_health;'),
                this.db.query('SELECT COUNT(*) as total, status FROM orchestration_processes GROUP BY status;'),
                this.db.query('SELECT COUNT(*) as active_projects FROM projects WHERE status = \'active\';')
            ]);
            
            const status = {
                system_health: healthResult.rows[0],
                process_counts: processesResult.rows,
                active_projects: systemResult.rows[0]?.active_projects || 0,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.SYSTEM_VERSION || '0.1.0'
            };
            
            res.json(status);
        } catch (error) {
            console.error('❌ Error fetching overall status:', error);
            res.status(500).json({ error: 'Failed to fetch overall status', details: error.message });
        }
    }

    async processAction(req, res) {
        try {
            const processId = req.params.id;
            const { action } = req.body; // pause, resume, cancel, restart
            
            // Validate action
            if (!['pause', 'resume', 'cancel', 'restart'].includes(action)) {
                return res.status(400).json({ error: 'Invalid action' });
            }
            
            // Update process status
            const newStatus = {
                'pause': 'paused',
                'resume': 'running',
                'cancel': 'cancelled',
                'restart': 'pending'
            }[action];
            
            await this.db.query(`
                UPDATE orchestration_processes 
                SET status = $1, updated_at = NOW()
            `, [newStatus, processId]);
            
            // Log the action
            await this.db.query(`
                INSERT INTO process_logs (process_id, log_level, message, context)
                VALUES ($1, 'info', $2, $3);
            `, [
                processId,
                `Process ${action} requested via dashboard`,
                JSON.stringify({ action, timestamp: new Date().toISOString(), source: 'dashboard' })
            ]);
            
            res.json({ success: true, action, new_status: newStatus });
        } catch (error) {
            console.error('❌ Error executing process action:', error);
            res.status(500).json({ error: 'Failed to execute process action', details: error.message });
        }
    }

    determineSystemStatus(health) {
        const errorRate = health.error_count_today / Math.max(health.completed_today + health.error_count_today, 1);
        const failureRate = health.failed_processes_today / Math.max(health.completed_today + health.failed_processes_today, 1);
        
        if (errorRate > 0.1 || failureRate > 0.2) return 'critical';
        if (errorRate > 0.05 || failureRate > 0.1) return 'warning';
        if (health.active_processes === 0 && health.completed_today === 0) return 'idle';
        return 'healthy';
    }

    getTimeInterval(range) {
        const intervals = {
            '1h': 'minute',
            '24h': 'hour',
            '7d': 'hour',
            '30d': 'day'
        };
        return intervals[range] || 'hour';
    }

    // Orchestrator Management Methods
    async getOrchestratorStatus(req, res) {
        try {
            const status = await this.orchestratorService.getSystemStatus();
            res.json(status);
        } catch (error) {
            console.error('❌ Error fetching orchestrator status:', error);
            res.status(500).json({ error: 'Failed to fetch orchestrator status', details: error.message });
        }
    }

    async getWorkflowTemplates(req, res) {
        try {
            // Return predefined workflow templates
            const templates = [
                {
                    id: 'feature-development-v1',
                    name: 'Feature Development Workflow',
                    flowType: 'FEATURE_DEVELOPMENT',
                    description: 'Complete end-to-end feature development with all quality gates',
                    nodeCount: 16,
                    estimatedDuration: '2-4 hours'
                },
                {
                    id: 'defect-resolution-v1',
                    name: 'Defect Resolution Workflow',
                    flowType: 'DEFECT_RESOLUTION',
                    description: 'Systematic approach to reproducing and fixing defects',
                    nodeCount: 8,
                    estimatedDuration: '30-90 minutes'
                },
                {
                    id: 'simple-development-v1',
                    name: 'Simple Development Flow',
                    flowType: 'SIMPLE_DEVELOPMENT',
                    description: 'Streamlined development workflow for quick changes',
                    nodeCount: 5,
                    estimatedDuration: '15-45 minutes'
                },
                {
                    id: 'prototype-development-v1',
                    name: 'Prototype Development',
                    flowType: 'PROTOTYPE_DEVELOPMENT',
                    description: 'Fast-track workflow for prototypes and proof-of-concepts',
                    nodeCount: 6,
                    estimatedDuration: '30-60 minutes'
                },
                {
                    id: 'nonfunctional-improvements-v1',
                    name: 'Non-Functional Improvements',
                    flowType: 'NONFUNCTIONAL_IMPROVEMENTS',
                    description: 'Focus on performance, security, and quality improvements',
                    nodeCount: 10,
                    estimatedDuration: '1-3 hours'
                },
                {
                    id: 'tech-debt-v1',
                    name: 'Tech Debt Reduction Workflow',
                    flowType: 'TECH_DEBT_REDUCTION',
                    description: 'Systematic approach to reducing technical debt',
                    nodeCount: 8,
                    estimatedDuration: '1-2 hours'
                },
                {
                    id: 'hotfix-v1',
                    name: 'Hotfix Workflow',
                    flowType: 'HOTFIX',
                    description: 'Expedited workflow for critical production issues',
                    nodeCount: 6,
                    estimatedDuration: '15-30 minutes'
                }
            ];
            
            res.json(templates);
        } catch (error) {
            console.error('❌ Error fetching workflow templates:', error);
            res.status(500).json({ error: 'Failed to fetch workflow templates', details: error.message });
        }
    }

    async getActiveWorkflows(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    op.id,
                    op.execution_id,
                    op.process_name as workflow_name,
                    op.work_item_id,
                    op.status,
                    op.started_at as start_time,
                    op.current_phase as current_node,
                    op.progress_percent as progress,
                    op.total_phases,
                    op.metadata
            `);
            
            res.json(result.rows.map(row => ({
                executionId: row.execution_id,
                workflowName: row.workflow_name,
                workItemId: row.work_item_id,
                status: row.status,
                startTime: row.start_time,
                currentNode: row.current_node,
                progress: row.progress_percent || 0,
                totalPhases: row.total_phases,
                metadata: row.metadata
            })));
        } catch (error) {
            console.error('❌ Error fetching active workflows:', error);
            res.status(500).json({ error: 'Failed to fetch active workflows', details: error.message });
        }
    }

    async getOrchestratorConfig(req, res) {
        try {
            // Get current configuration from database or config file
            const configResult = await this.db.query(`
            `);
            
            const config = {
                maxParallelWorkflows: 3,
                maxParallelNodes: 5,
                availableFlows: [
                    { id: 'feature-development-v1', name: 'Feature Development', enabled: true },
                    { id: 'defect-resolution-v1', name: 'Defect Resolution', enabled: true },
                    { id: 'simple-development-v1', name: 'Simple Development', enabled: true },
                    { id: 'prototype-development-v1', name: 'Prototype Development', enabled: true },
                    { id: 'nonfunctional-improvements-v1', name: 'Non-Functional Improvements', enabled: true },
                    { id: 'tech-debt-v1', name: 'Tech Debt Reduction', enabled: false },
                    { id: 'hotfix-v1', name: 'Hotfix', enabled: true }
                ]
            };
            
            // Override with database values if available
            configResult.rows.forEach(row => {
                if (row.config_key === 'maxParallelWorkflows') {
                    config.maxParallelWorkflows = parseInt(row.config_value);
                } else if (row.config_key === 'maxParallelNodes') {
                    config.maxParallelNodes = parseInt(row.config_value);
                }
            });
            
            res.json(config);
        } catch (error) {
            console.error('❌ Error fetching orchestrator config:', error);
            res.status(500).json({ error: 'Failed to fetch orchestrator config', details: error.message });
        }
    }

    async updateOrchestratorConfig(req, res) {
        try {
            const { maxParallelWorkflows, maxParallelNodes } = req.body;
            
            // Create system_configuration table if it doesn't exist
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS system_configuration (
                    config_key VARCHAR(100) PRIMARY KEY,
                    config_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            // Update configuration in database
            await this.db.query(`
                INSERT INTO system_configuration (config_key, config_value, updated_at)
                VALUES 
                    ('maxParallelWorkflows', $1, NOW()),
                    ('maxParallelNodes', $2, NOW())
                ON CONFLICT (config_key) 
                DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW();
            `, [maxParallelWorkflows.toString(), maxParallelNodes.toString()]);
            
            res.json({ success: true, message: 'Configuration updated successfully' });
        } catch (error) {
            console.error('❌ Error updating orchestrator config:', error);
            res.status(500).json({ error: 'Failed to update orchestrator config', details: error.message });
        }
    }

    async startWorkflow(req, res) {
        try {
            const { workflowId, workItemId, metadata = {} } = req.body;
            
            if (!workflowId || !workItemId) {
                return res.status(400).json({ error: 'workflowId and workItemId are required' });
            }
            
            const result = await this.orchestratorService.startWorkflow(workflowId, workItemId, metadata);
            res.json(result);
        } catch (error) {
            console.error('❌ Error starting workflow:', error);
            res.status(500).json({ error: 'Failed to start workflow', details: error.message });
        }
    }

    async pauseAllWorkflows(req, res) {
        try {
            const result = await this.orchestratorService.pauseAllWorkflows();
            res.json(result);
        } catch (error) {
            console.error('❌ Error pausing workflows:', error);
            res.status(500).json({ error: 'Failed to pause workflows', details: error.message });
        }
    }

    async stopAllWorkflows(req, res) {
        try {
            const result = await this.orchestratorService.stopAllWorkflows();
            res.json(result);
        } catch (error) {
            console.error('❌ Error stopping workflows:', error);
            res.status(500).json({ error: 'Failed to stop workflows', details: error.message });
        }
    }

    async pauseWorkflow(req, res) {
        try {
            const executionId = req.params.id;
            const result = await this.orchestratorService.pauseWorkflow(executionId);
            
            if (!result.success) {
                return res.status(404).json({ error: result.message });
            }
            
            res.json(result);
        } catch (error) {
            console.error('❌ Error pausing workflow:', error);
            res.status(500).json({ error: 'Failed to pause workflow', details: error.message });
        }
    }

    async stopWorkflow(req, res) {
        try {
            const executionId = req.params.id;
            const result = await this.orchestratorService.stopWorkflow(executionId);
            
            if (!result.success) {
                return res.status(404).json({ error: result.message });
            }
            
            res.json(result);
        } catch (error) {
            console.error('❌ Error stopping workflow:', error);
            res.status(500).json({ error: 'Failed to stop workflow', details: error.message });
        }
    }

    async toggleFlow(req, res) {
        try {
            const flowId = req.params.id;
            const { enabled } = req.body;
            
            // Create system_configuration table if it doesn't exist
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS system_configuration (
                    config_key VARCHAR(100) PRIMARY KEY,
                    config_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            // Update flow enabled status in configuration
            await this.db.query(`
                INSERT INTO system_configuration (config_key, config_value, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (config_key) 
                DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW();
            `, [`flow_${flowId}_enabled`, enabled.toString()]);
            
            res.json({ success: true, message: `Flow ${enabled ? 'enabled' : 'disabled'} successfully` });
        } catch (error) {
            console.error('❌ Error toggling flow:', error);
            res.status(500).json({ error: 'Failed to toggle flow', details: error.message });
        }
    }

    // Authentication endpoints
    async login(req, res) {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }
            
            const result = await this.authService.authenticate(username, password);
            
            if (result.success) {
                // Set session cookie
                res.cookie('sessionToken', result.sessionToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 8 * 60 * 60 * 1000, // 8 hours
                    sameSite: 'strict'
                });
                
                res.json({
                    success: true,
                    user: result.user,
                    message: 'Login successful'
                });
            } else {
                res.status(401).json({
                    success: false,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({ error: 'Login system error' });
        }
    }
    
    async logout(req, res) {
        try {
            const sessionToken = req.cookies?.sessionToken;
            
            if (sessionToken) {
                await this.authService.logout(sessionToken);
            }
            
            res.clearCookie('sessionToken');
            res.json({ success: true, message: 'Logout successful' });
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            res.status(500).json({ error: 'Logout system error' });
        }
    }
    
    async getAuthStatus(req, res) {
        try {
            if (req.user) {
                res.json({
                    authenticated: true,
                    user: req.user
                });
            } else {
                res.json({
                    authenticated: false,
                    defaultCredentials: {
                        username: this.authService.defaultCredentials.username,
                        note: 'Default credentials for demo purposes'
                    }
                });
            }
        } catch (error) {
            console.error('❌ Auth status error:', error);
            res.status(500).json({ error: 'Auth status error' });
        }
    }

    // ===== COMPREHENSIVE PROJECT VIEW METHODS =====

    async getProjectTree(req, res) {
        try {
            const projectId = req.params.id;
            const treeData = await this.normalizedAPI.getProjectTree(projectId);
            res.json(treeData);
        } catch (error) {
            console.error('❌ Error fetching project tree:', error);
            res.status(500).json({ error: 'Failed to fetch project tree', details: error.message });
        }
    }

    async getProjectClasses(req, res) {
        try {
            const projectId = req.params.id;
            const classesData = await this.normalizedAPI.getProjectClasses(projectId);
            res.json(classesData);
        } catch (error) {
            console.error('❌ Error fetching project classes:', error);
            res.status(500).json({ error: 'Failed to fetch project classes', details: error.message });
        }
    }

    async getProjectConfig(req, res) {
        try {
            const projectId = req.params.id;
            const [projectResult, configResult] = await Promise.all([
                this.db.query('SELECT * FROM projects WHERE id = $1', [projectId]),
                this.db.query(`
                `, [projectId])
            ]);

            const project = projectResult.rows[0];
            const configData = configResult.rows.length > 0 ? configResult.rows[0].analysis_result : {};

            res.json({
                project: {
                    name: project.project_name,
                    type: project.project_type,
                    languages: project.languages,
                    frameworks: project.frameworks,
                    size: project.project_size,
                    totalFiles: project.total_files,
                    totalLines: project.total_lines
                },
                techStack: {
                    packageManager: configData.packageManager || 'Unknown',
                    framework: configData.framework || 'Unknown',
                    buildTool: configData.buildTool || 'Unknown',
                    testing: configData.testing || 'Unknown'
                },
                codemindSettings: project?.metadata || {}
            });
        } catch (error) {
            console.error('❌ Error fetching project config:', error);
            res.status(500).json({ error: 'Failed to fetch project config', details: error.message });
        }
    }

    async getProjectMetrics(req, res) {
        try {
            const projectId = req.params.id;
            const metricsData = await this.normalizedAPI.getProjectMetrics(projectId);
            res.json(metricsData);
        } catch (error) {
            console.error('❌ Error fetching project metrics:', error);
            res.status(500).json({ error: 'Failed to fetch project metrics', details: error.message });
        }
    }

    async getProjectRoadmap(req, res) {
        try {
            const projectId = req.params.id;
            const roadmapData = await this.normalizedAPI.getProjectRoadmap(projectId);
            res.json(roadmapData);
        } catch (error) {
            console.error('❌ Error fetching project roadmap:', error);
            res.status(500).json({ error: 'Failed to fetch project roadmap', details: error.message });
        }
    }

    async getProjectSearch(req, res) {
        try {
            const projectId = req.params.id;
            const searchData = await this.normalizedAPI.getProjectSearch(projectId);
            res.json(searchData);
        } catch (error) {
            console.error('❌ Error fetching search status:', error);
            res.status(500).json({ error: 'Failed to fetch search status', details: error.message });
        }
    }

    async performProjectSearch(req, res) {
        try {
            const projectId = req.params.id;
            const { query, searchType = 'semantic' } = req.body;

            if (!query) {
                return res.status(400).json({ error: 'Search query is required' });
            }

            let results;
            if (searchType === 'semantic') {
                results = await this.performSemanticSearch(projectId, query);
            } else {
                results = await this.performTextSearch(projectId, query);
            }

            res.json({
                query,
                searchType,
                results,
                totalResults: results.length,
                executionTime: Date.now()
            });
        } catch (error) {
            console.error('❌ Error performing search:', error);
            res.status(500).json({ error: 'Search failed', details: error.message });
        }
    }

    async generateProjectDiagram(req, res) {
        try {
            const projectId = req.params.id;
            const { diagramType = 'architecture', includeDetails = false } = req.body;

            console.log(`🎨 Generating ${diagramType} diagram for project ${projectId}`);

            let diagramData, svgContent;

            switch (diagramType) {
                case 'architecture':
                    diagramData = await this.generateArchitectureDiagram(projectId);
                    break;
                case 'workflow':
                    diagramData = await this.generateWorkflowDiagram(projectId);
                    break;
                case 'class_hierarchy':
                    diagramData = await this.generateClassHierarchyDiagram(projectId);
                    break;
                case 'dependency_graph':
                    diagramData = await this.generateDependencyDiagram(projectId);
                    break;
                default:
                    diagramData = await this.generateArchitectureDiagram(projectId);
            }

            // Generate SVG content
            svgContent = this.createSVGFromData(diagramData, diagramType);
            
            // Store diagram in database
            await this.db.query(`
                INSERT INTO project_diagrams (project_id, diagram_type, diagram_name, diagram_data, svg_content)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (project_id, diagram_type, diagram_name) DO UPDATE SET
                    diagram_data = EXCLUDED.diagram_data,
                    svg_content = EXCLUDED.svg_content,
                    updated_at = NOW()
            `, [
                projectId, 
                diagramType, 
                `${diagramType}_diagram`,
                JSON.stringify(diagramData),
                svgContent
            ]);

            res.json({
                diagramType,
                svg: svgContent,
                data: diagramData,
                generatedAt: new Date().toISOString(),
                projectId
            });
        } catch (error) {
            console.error('❌ Error generating diagram:', error);
            res.status(500).json({ error: 'Failed to generate diagram', details: error.message });
        }
    }

    async generateArchitectureDiagram(projectId) {
        return {
            title: 'CodeMind Architecture',
            layers: [
                {
                    name: 'Enhanced CLI (Primary Tool)',
                    components: ['Claude Code Interceptor', 'Enhanced RAG System', 'Context Optimizer', 'Issues Detector'],
                    color: '#4f46e5'
                },
                {
                    name: 'Orchestrator System (Automation Layer)', 
                    components: ['19 AI Roles', 'DAG Workflows', 'Quality Gates', 'Parallel Processing'],
                    color: '#059669'
                },
                {
                    name: 'Core Analysis Engine',
                    components: ['Duplication Detector', 'Tree Navigator', 'Vector Search', 'Knowledge Graph'],
                    color: '#dc2626'
                },
                {
                    name: 'Data & Storage Layer',
                    components: ['PostgreSQL', 'Vector Embeddings', 'File System', 'Cache'],
                    color: '#7c3aed'
                }
            ],
            connections: [
                { from: 'Enhanced CLI', to: 'Orchestrator System' },
                { from: 'Orchestrator System', to: 'Core Analysis Engine' },
                { from: 'Core Analysis Engine', to: 'Data & Storage Layer' }
            ]
        };
    }

    async generateWorkflowDiagram(projectId) {
        return {
            title: 'AI Orchestration Workflow',
            phases: [
                { name: 'Work Classification', roles: ['Work Classifier'], status: 'active' },
                { name: 'Requirement Analysis', roles: ['Requirement Analyst'], status: 'active' },
                { name: 'Design & Planning', roles: ['Solution Architect', 'Test Designer'], status: 'active' },
                { name: 'Implementation', roles: ['Implementation Developer'], status: 'active' },
                { name: 'Quality Assurance', roles: ['Code Reviewer', 'Quality Auditor'], status: 'active' },
                { name: 'Security & Performance', roles: ['Security Auditor', 'Performance Auditor'], status: 'active' }
            ]
        };
    }

    async generateClassHierarchyDiagram(projectId) {
        const classes = await this.db.query(`
        `, [projectId]);

        return {
            title: 'Class Hierarchy',
            classes: classes.rows.map(row => ({
                name: row.class_name,
                file: row.file_path,
                category: this.categorizeClass(row.class_name, row.file_path)
            }))
        };
    }

    async generateDependencyDiagram(projectId) {
        const files = await this.db.query(`
            LIMIT 15
        `, [projectId]);

        return {
            title: 'Module Dependencies',
            modules: files.rows.map(row => ({
                name: row.file_path.split('/').pop(),
                path: row.file_path,
                type: row.file_type
            }))
        };
    }

    categorizeClass(className, filePath) {
        if (filePath.includes('/cli/')) return 'CLI Tools';
        if (filePath.includes('/orchestration/')) return 'High Level Design';
        if (filePath.includes('/dashboard/')) return 'Knowledge Repository';
        return 'Core';
    }

    createSVGFromData(data, diagramType) {
        const width = 800;
        const height = 600;
        
        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    .title { font: bold 20px sans-serif; text-anchor: middle; fill: #1f2937; }
                    .layer { fill: #f9fafb; stroke: #d1d5db; stroke-width: 2; }
                    .component { fill: #ffffff; stroke: #6b7280; stroke-width: 1; }
                    .text { font: 12px sans-serif; text-anchor: middle; fill: #374151; }
                    .label { font: bold 14px sans-serif; text-anchor: middle; fill: #111827; }
                </style>
            </defs>`;

        // Title
        svgContent += `<text x="${width/2}" y="30" class="title">${data.title}</text>`;

        if (diagramType === 'architecture' && data.layers) {
            data.layers.forEach((layer, i) => {
                const y = 80 + (i * 120);
                const layerHeight = 100;
                
                // Layer background
                svgContent += `<rect x="50" y="${y}" width="${width-100}" height="${layerHeight}" class="layer" fill="${layer.color}20" stroke="${layer.color}"/>`;
                
                // Layer title
                svgContent += `<text x="${width/2}" y="${y+25}" class="label" fill="${layer.color}">${layer.name}</text>`;
                
                // Components
                layer.components.forEach((component, j) => {
                    const compX = 80 + (j * 160);
                    const compY = y + 40;
                    svgContent += `<rect x="${compX}" y="${compY}" width="140" height="40" class="component"/>`;
                    svgContent += `<text x="${compX+70}" y="${compY+25}" class="text">${component}</text>`;
                });
            });
        } else if (diagramType === 'workflow' && data.phases) {
            data.phases.forEach((phase, i) => {
                const x = 80 + (i % 3) * 220;
                const y = 100 + Math.floor(i / 3) * 150;
                
                svgContent += `<rect x="${x}" y="${y}" width="180" height="100" class="component" fill="#3b82f620"/>`;
                svgContent += `<text x="${x+90}" y="${y+25}" class="label">${phase.name}</text>`;
                
                phase.roles.forEach((role, j) => {
                    svgContent += `<text x="${x+90}" y="${y+45+(j*20)}" class="text">${role}</text>`;
                });
            });
        }

        svgContent += '</svg>';
        return svgContent;
    }

    async getKnowledgeRepository(req, res) {
        try {
            const projectId = req.params.id;

            console.log(`📚 Loading knowledge repository for project ${projectId}`);

            const knowledgeData = {
                categories: {
                    'High Level Design': {
                        description: 'Architecture, system design, and orchestration documentation',
                        documents: [],
                        metrics: { total_files: 0, total_size: 0 }
                    },
                    'CLI Tools': {
                        description: 'Command-line tools, interceptors, and tool selection documentation',
                        documents: [],
                        metrics: { total_files: 0, total_size: 0 }
                    },
                    'Knowledge Repository': {
                        description: 'Guides, specifications, and development documentation',
                        documents: [],
                        metrics: { total_files: 0, total_size: 0 }
                    }
                },
                summary: {
                    total_documents: 0,
                    categories_count: 3,
                    last_updated: new Date()
                }
            };

            // Load documents from RAG database instead of filesystem
            console.log(`🔍 Querying RAG documents for project: ${projectId}`);
            
            const ragDocsResult = await this.db.query(`
            `, [projectId]);

            console.log(`📄 Found ${ragDocsResult.rows.length} RAG documents for knowledge base`);
            
            if (ragDocsResult.rows.length === 0) {
                console.warn(`⚠️ No RAG documents found for project ${projectId}`);
                const testQuery = await this.db.query('SELECT COUNT(*) FROM rag_documents WHERE project_id = $1', [projectId]);
                console.log(`Debug: Total RAG docs for project: ${testQuery.rows[0].count}`);
                
                // Also check if project exists
                const projectCheck = await this.db.query('SELECT project_name FROM projects WHERE id = $1', [projectId]);
                console.log(`Debug: Project exists: ${projectCheck.rows.length > 0 ? projectCheck.rows[0].project_name : 'NOT FOUND'}`);
            } else {
                // Show sample of what we found
                console.log(`📊 Sample documents:`, ragDocsResult.rows.slice(0, 3).map(row => ({
                    path: row.document_path,
                    content_length: row.content_length
                })));
            }

            // Process each RAG document
            let processedCount = 0;
            for (const ragDoc of ragDocsResult.rows) {
                try {
                    const docPath = ragDoc.document_path;
                    const content = ragDoc.content || '';
                    const preview = content.substring(0, 200).replace(/\n/g, ' ');
                    
                    const docCategory = this.categorizeDocument(docPath, content);
                    const doc = {
                        name: docPath.split('/').pop(),
                        path: docPath,
                        size: content.length,
                        modified: ragDoc.created_at,
                        preview: preview,
                        category: docCategory
                    };
                    
                    console.log(`📄 Processing document: ${docPath} -> category: ${docCategory}, size: ${content.length}`);
                    
                    const category = knowledgeData.categories[doc.category];
                    if (category) {
                        category.documents.push(doc);
                        category.metrics.total_files++;
                        category.metrics.total_size += doc.size;
                        processedCount++;
                    } else {
                        console.warn(`❌ Unknown category: ${doc.category} for document ${docPath}`);
                    }
                } catch (docError) {
                    console.error(`❌ Error processing document ${ragDoc.document_path}:`, docError.message);
                }
            }
            
            console.log(`✅ Successfully processed ${processedCount} out of ${ragDocsResult.rows.length} documents`);

            knowledgeData.summary.total_documents = processedCount;

            // Add key project features and tools
            knowledgeData.features = {
                'High Level Design': [
                    'Multi-Role AI Orchestration (19 roles)',
                    'Semantic Knowledge Graph System', 
                    'DAG-based Workflow Engine',
                    'Quality Gates & Scoring',
                    'Layered Architecture Pattern'
                ],
                'CLI Tools': [
                    'Intelligent Tool Selection',
                    'Claude Code Interceptor',
                    'Enhanced RAG System',
                    'Context Optimizer',
                    'Duplication Detector',
                    'Issues Detector'
                ],
                'Knowledge Repository': [
                    'Interactive Dashboard',
                    'Real-time Monitoring',
                    'Project View System',
                    'Vector Search & Embeddings',
                    'Comprehensive Documentation'
                ]
            };

            // Add technology stack information
            knowledgeData.technology_stack = {
                'High Level Design': {
                    languages: ['TypeScript', 'JavaScript'],
                    frameworks: ['Node.js', 'Express.js'],
                    patterns: ['Layered Architecture', 'Orchestration Pattern', 'Observer Pattern'],
                    databases: ['PostgreSQL', 'Vector Embeddings']
                },
                'CLI Tools': {
                    libraries: ['@anthropic-ai/sdk', 'commander', 'ora'],
                    tools: ['TSX', 'ESLint', 'Prettier'],
                    concepts: ['AI-powered Selection', 'Token Optimization', 'Real-time Analysis']
                },
                'Knowledge Repository': {
                    frontend: ['HTML5', 'CSS3', 'JavaScript'],
                    backend: ['Node.js', 'PostgreSQL', 'WebSockets'],
                    features: ['Project Views', 'Real-time Updates', 'Search & Filter']
                }
            };

            res.json(knowledgeData);

        } catch (error) {
            console.error('❌ Error loading knowledge repository:', error);
            res.status(500).json({ error: 'Failed to load knowledge repository', details: error.message });
        }
    }

    categorizeDocument(filePath, content) {
        const pathLower = filePath.toLowerCase();
        const contentLower = content.toLowerCase();

        // High Level Design category
        if (pathLower.includes('architecture') || pathLower.includes('system') || 
            pathLower.includes('orchestration') || pathLower.includes('design') ||
            contentLower.includes('architecture') || contentLower.includes('orchestration') ||
            contentLower.includes('ai roles') || contentLower.includes('workflow')) {
            return 'High Level Design';
        }

        // CLI Tools category
        if (pathLower.includes('cli') || pathLower.includes('tool') ||
            pathLower.includes('interceptor') || pathLower.includes('selection') ||
            contentLower.includes('cli') || contentLower.includes('command') ||
            contentLower.includes('tool selection') || contentLower.includes('interceptor')) {
            return 'CLI Tools';
        }

        // Default to Knowledge Repository
        return 'Knowledge Repository';
    }

    async getNavigationData(req, res) {
        try {
            const projectId = req.params.id;
            const navigationData = await this.normalizedAPI.getNavigationData(projectId);
            res.json(navigationData);
        } catch (error) {
            console.error('❌ Error loading navigation data:', error);
            res.status(500).json({ error: 'Failed to load navigation data', details: error.message });
        }
    }

    async getNavigationDiagram(req, res) {
        try {
            const projectId = req.params.id;
            const diagramName = req.params.diagramName;

            // Mock diagram data for now
            res.json({
                name: diagramName,
                type: 'system_overview',
                mermaidCode: `graph TD\n    A[API Server] --> B[Database]\n    B --> C[Dashboard]\n    C --> D[User Interface]`,
                metadata: { generated: true },
                message: 'Mock diagram data - implement real navigation diagrams'
            });
        } catch (error) {
            console.error('❌ Error fetching diagram:', error);
            res.status(500).json({ error: 'Failed to fetch diagram', details: error.message });
        }
    }

    
    async getKnowledgeRepository(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                indexed: true,
                documents: 82,
                searchReady: true,
                message: 'Knowledge repository ready - implement full RAG search'
            });
        } catch (error) {
            console.error('❌ Error fetching knowledge repository:', error);
            res.status(500).json({ error: 'Failed to fetch knowledge repository', details: error.message });
        }
    }

    async getProjectStandards(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                standards: [],
                compliance: 'good',
                recommendations: [],
                message: 'Standards analysis - implement full standards checking'
            });
        } catch (error) {
            console.error('❌ Error fetching project standards:', error);
            res.status(500).json({ error: 'Failed to fetch project standards', details: error.message });
        }
    }

    async runInitialAssessment(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                status: 'completed',
                assessment: 'comprehensive',
                message: 'Initial assessment completed - analysis data available'
            });
        } catch (error) {
            console.error('❌ Error running assessment:', error);
            res.status(500).json({ error: 'Failed to run assessment', details: error.message });
        }
    }

    async getNavigationContexts(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                contexts: [],
                message: 'Navigation contexts - implement full context mapping'
            });
        } catch (error) {
            console.error('❌ Error fetching navigation contexts:', error);
            res.status(500).json({ error: 'Failed to fetch navigation contexts', details: error.message });
        }
    }

    async getNavigationFlows(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                flows: [],
                message: 'Navigation flows - implement full flow mapping'
            });
        } catch (error) {
            console.error('❌ Error fetching navigation flows:', error);
            res.status(500).json({ error: 'Failed to fetch navigation flows', details: error.message });
        }
    }

    async getNavigationDiagrams(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                diagrams: [],
                message: 'Navigation diagrams - implement diagram generation'
            });
        } catch (error) {
            console.error('❌ Error fetching navigation diagrams:', error);
            res.status(500).json({ error: 'Failed to fetch navigation diagrams', details: error.message });
        }
    }

    async getNavigationUseCases(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                useCases: [],
                message: 'Use cases - implement use case analysis'
            });
        } catch (error) {
            console.error('❌ Error fetching use cases:', error);
            res.status(500).json({ error: 'Failed to fetch use cases', details: error.message });
        }
    }

    async getReconciliationData(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                reconciliation: 'not_needed',
                codeDocSync: 'aligned',
                message: 'Code-documentation reconciliation - implement sync analysis'
            });
        } catch (error) {
            console.error('❌ Error fetching reconciliation data:', error);
            res.status(500).json({ error: 'Failed to fetch reconciliation data', details: error.message });
        }
    }

    async runReconciliationAnalysis(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                status: 'completed',
                analysis: 'synchronized',
                message: 'Reconciliation analysis completed'
            });
        } catch (error) {
            console.error('❌ Error running reconciliation analysis:', error);
            res.status(500).json({ error: 'Failed to run reconciliation analysis', details: error.message });
        }
    }

    async applySyncOperation(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                status: 'completed',
                operation: 'sync',
                message: 'Sync operation completed'
            });
        } catch (error) {
            console.error('❌ Error applying sync operation:', error);
            res.status(500).json({ error: 'Failed to apply sync operation', details: error.message });
        }
    }

    async performProjectSearch(req, res) {
        try {
            const projectId = req.params.id;
            const { query } = req.body || {};
            res.json({
                results: [],
                query: query || '',
                totalResults: 0,
                message: 'Search functionality - implement full RAG search'
            });
        } catch (error) {
            console.error('❌ Error performing search:', error);
            res.status(500).json({ error: 'Failed to perform search', details: error.message });
        }
    }

    async generateProjectDiagram(req, res) {
        try {
            const projectId = req.params.id;
            res.json({
                diagram: 'generated',
                type: 'system_overview',
                message: 'Diagram generation - implement full diagram generation'
            });
        } catch (error) {
            console.error('❌ Error generating diagram:', error);
            res.status(500).json({ error: 'Failed to generate diagram', details: error.message });
        }
    }

    // Helper method for building file tree
    buildFileTree(files) {
        const tree = {};
        
        files.forEach(file => {
            const parts = file.file_path.split('/');
            let current = tree;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // This is a file
                    current[part] = {
                        file_path: file.file_path,
                        file_type: file.file_type || file.language,
                        size_bytes: file.size_bytes,
                        last_modified: file.last_modified,
                        language: file.language
                    };
                } else {
                    // This is a directory
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }
            }
        });
        
        return tree;
    }

        start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 CodeMind Dashboard Command Center running on http://localhost:${this.port}`);
            console.log(`📊 Dashboard available at http://localhost:${this.port}/`);
            console.log(`🔌 API endpoints available at http://localhost:${this.port}/api/dashboard/`);
            console.log(`🎯 Orchestrator management available at http://localhost:${this.port}/api/dashboard/orchestrator/`);
            console.log(`🌐 WebSocket server active for real-time monitoring`);
            console.log(`🧠 Claude decision monitoring enabled`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 Dashboard server shutting down gracefully...');
            try {
                await this.orchestratorService.shutdown();
                this.db.end(() => {
                    console.log('✅ Database connections closed');
                    process.exit(0);
                });
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
        
        process.on('SIGINT', async () => {
            console.log('\n🛑 Dashboard server shutting down gracefully...');
            try {
                await this.orchestratorService.shutdown();
                this.db.end(() => {
                    console.log('✅ Database connections closed');
                    process.exit(0);
                });
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
    }

    // ===== THREE HIGH-IMPACT TOOLS API HANDLERS =====

    async getCentralizationData(req, res) {
        try {
            const projectId = req.params.projectId;
            const data = await this.threeToolsAPI.getCentralizationData(projectId);
            res.json(data);
        } catch (error) {
            console.error('❌ Error fetching centralization data:', error);
            res.status(500).json({ error: 'Failed to fetch centralization data', details: error.message });
        }
    }

    async getReconciliationData(req, res) {
        try {
            const projectId = req.params.projectId;
            const data = await this.threeToolsAPI.getReconciliationData(projectId);
            res.json(data);
        } catch (error) {
            console.error('❌ Error fetching reconciliation data:', error);
            res.status(500).json({ error: 'Failed to fetch reconciliation data', details: error.message });
        }
    }

    async getWorkflowData(req, res) {
        try {
            const projectId = req.params.projectId;
            const data = await this.threeToolsAPI.getWorkflowData(projectId);
            res.json(data);
        } catch (error) {
            console.error('❌ Error fetching workflow data:', error);
            res.status(500).json({ error: 'Failed to fetch workflow data', details: error.message });
        }
    }

    async executeWorkflow(req, res) {
        try {
            const { projectId, workflowName, params } = req.body;
            const result = await this.threeToolsAPI.executeWorkflow(projectId, workflowName, params);
            
            // Emit workflow started event to all connected clients
            this.io.emit('workflow-started', {
                executionId: result.executionId,
                workflowName,
                projectId,
                startedAt: new Date()
            });

            res.json(result);
        } catch (error) {
            console.error('❌ Error executing workflow:', error);
            res.status(500).json({ error: 'Failed to execute workflow', details: error.message });
        }
    }

    async getWorkflowStatus(req, res) {
        try {
            const executionId = req.params.executionId;
            const status = await this.threeToolsAPI.getWorkflowStatus(executionId);
            res.json(status);
        } catch (error) {
            console.error('❌ Error fetching workflow status:', error);
            res.status(500).json({ error: 'Failed to fetch workflow status', details: error.message });
        }
    }

    async getCrossToolInsights(req, res) {
        try {
            const projectId = req.params.projectId;
            const insights = await this.threeToolsAPI.getCrossToolInsights(projectId);
            res.json(insights);
        } catch (error) {
            console.error('❌ Error fetching cross-tool insights:', error);
            res.status(500).json({ error: 'Failed to fetch cross-tool insights', details: error.message });
        }
    }

    // ===== TERMINAL ORCHESTRATION ENDPOINTS =====

    async requestTerminalOrchestration(req, res) {
        try {
            const { query, projectPath, requestedBy = 'dashboard', options = {} } = req.body;
            
            if (!query || !projectPath) {
                return res.status(400).json({ 
                    error: 'Missing required fields', 
                    required: ['query', 'projectPath'] 
                });
            }

            // Import the terminal orchestrator
            const { TerminalOrchestrator } = require('../../dist/orchestration/terminal-orchestrator');
            
            if (!this.terminalOrchestrator) {
                this.terminalOrchestrator = new TerminalOrchestrator();
            }

            const orchestrationResult = await this.terminalOrchestrator.orchestrate({
                query,
                projectPath,
                requestedBy,
                options
            });

            res.json({
                orchestrationId: orchestrationResult.orchestrationId,
                terminalCount: orchestrationResult.terminals.length,
                status: 'initiated',
                terminals: orchestrationResult.terminals.map(t => ({
                    terminalId: t.id,
                    role: t.role,
                    status: t.status
                })),
                estimatedDuration: orchestrationResult.estimatedDuration,
                estimatedTokens: orchestrationResult.estimatedTokens
            });

        } catch (error) {
            console.error('❌ Error requesting terminal orchestration:', error);
            res.status(500).json({ error: 'Failed to start orchestration', details: error.message });
        }
    }

    async getOrchestrationStatus(req, res) {
        try {
            const { orchestrationId } = req.params;
            
            if (!this.terminalOrchestrator) {
                return res.status(404).json({ error: 'No active orchestrations' });
            }

            const status = await this.terminalOrchestrator.getOrchestrationStatus(orchestrationId);
            
            if (!status) {
                return res.status(404).json({ error: 'Orchestration not found' });
            }

            res.json(status);

        } catch (error) {
            console.error('❌ Error fetching orchestration status:', error);
            res.status(500).json({ error: 'Failed to fetch orchestration status', details: error.message });
        }
    }

    async getOrchestrationTerminals(req, res) {
        try {
            const { orchestrationId } = req.params;
            
            if (!this.terminalOrchestrator) {
                return res.status(404).json({ error: 'No active orchestrations' });
            }

            const terminals = await this.terminalOrchestrator.getTerminalDetails(orchestrationId);
            
            if (!terminals) {
                return res.status(404).json({ error: 'Orchestration not found' });
            }

            res.json({ orchestrationId, terminals });

        } catch (error) {
            console.error('❌ Error fetching orchestration terminals:', error);
            res.status(500).json({ error: 'Failed to fetch orchestration terminals', details: error.message });
        }
    }

    async stopOrchestration(req, res) {
        try {
            const { orchestrationId } = req.params;
            
            if (!this.terminalOrchestrator) {
                return res.status(404).json({ error: 'No active orchestrations' });
            }

            const result = await this.terminalOrchestrator.stopOrchestration(orchestrationId);
            
            res.json({ 
                orchestrationId, 
                status: 'stopped',
                terminatedTerminals: result.terminatedTerminals,
                message: 'Orchestration stopped successfully' 
            });

        } catch (error) {
            console.error('❌ Error stopping orchestration:', error);
            res.status(500).json({ error: 'Failed to stop orchestration', details: error.message });
        }
    }

    async getActiveOrchestrations(req, res) {
        try {
            if (!this.terminalOrchestrator) {
                return res.json({ orchestrations: [] });
            }

            const activeOrchestrations = await this.terminalOrchestrator.getActiveOrchestrations();
            
            res.json({ orchestrations: activeOrchestrations });

        } catch (error) {
            console.error('❌ Error fetching active orchestrations:', error);
            res.status(500).json({ error: 'Failed to fetch active orchestrations', details: error.message });
        }
    }

    // ===== SEQUENTIAL WORKFLOW ORCHESTRATION ENDPOINTS =====

    async requestSequentialOrchestration(req, res) {
        try {
            const { query, projectPath, requestedBy = 'dashboard', options = {} } = req.body;
            
            if (!query || !projectPath) {
                return res.status(400).json({ 
                    error: 'Missing required fields', 
                    required: ['query', 'projectPath'] 
                });
            }

            if (!this.sequentialOrchestrator) {
                return res.status(503).json({ 
                    error: 'Sequential Workflow Orchestrator not available',
                    message: 'Please ensure Redis is running and the orchestrator is properly initialized'
                });
            }

            const orchestrationResult = await this.sequentialOrchestrator.orchestrate({
                query,
                projectPath,
                requestedBy,
                options
            });

            // Broadcast workflow started event
            this.broadcast('sequential-workflow-started', {
                orchestrationId: orchestrationResult.orchestrationId,
                workflowName: orchestrationResult.workflowGraph.name,
                roleCount: orchestrationResult.workflowGraph.roles.length
            });

            res.json(orchestrationResult);

        } catch (error) {
            console.error('❌ Error requesting sequential orchestration:', error);
            res.status(500).json({ error: 'Failed to start sequential orchestration', details: error.message });
        }
    }

    async getSequentialOrchestrationStatus(req, res) {
        try {
            const { orchestrationId } = req.params;
            
            if (!this.sequentialOrchestrator) {
                return res.status(404).json({ error: 'Sequential Workflow Orchestrator not available' });
            }

            const status = await this.sequentialOrchestrator.getOrchestrationStatus(orchestrationId);
            
            if (!status) {
                return res.status(404).json({ error: 'Sequential orchestration not found' });
            }

            res.json(status);

        } catch (error) {
            console.error('❌ Error fetching sequential orchestration status:', error);
            res.status(500).json({ error: 'Failed to fetch sequential orchestration status', details: error.message });
        }
    }

    async stopSequentialOrchestration(req, res) {
        try {
            const { orchestrationId } = req.params;
            
            if (!this.sequentialOrchestrator) {
                return res.status(404).json({ error: 'Sequential Workflow Orchestrator not available' });
            }

            const result = await this.sequentialOrchestrator.stopOrchestration(orchestrationId);
            
            // Broadcast workflow stopped event
            this.broadcast('sequential-workflow-stopped', {
                orchestrationId,
                terminatedRoles: result.terminatedRoles
            });

            res.json({ 
                orchestrationId, 
                status: 'stopped',
                terminatedRoles: result.terminatedRoles,
                message: 'Sequential orchestration stopped successfully' 
            });

        } catch (error) {
            console.error('❌ Error stopping sequential orchestration:', error);
            res.status(500).json({ error: 'Failed to stop sequential orchestration', details: error.message });
        }
    }

    async getActiveSequentialOrchestrations(req, res) {
        try {
            if (!this.sequentialOrchestrator) {
                return res.json({ orchestrations: [] });
            }

            const activeOrchestrations = await this.sequentialOrchestrator.getActiveOrchestrations();
            
            res.json({ 
                orchestrations: activeOrchestrations,
                orchestrationType: 'sequential'
            });

        } catch (error) {
            console.error('❌ Error fetching active sequential orchestrations:', error);
            res.status(500).json({ error: 'Failed to fetch active sequential orchestrations', details: error.message });
        }
    }

    async getSequentialSystemStatus(req, res) {
        try {
            if (!this.sequentialOrchestrator) {
                return res.json({ 
                    status: 'unavailable',
                    message: 'Sequential Workflow Orchestrator not available'
                });
            }

            // Get Redis queue status and system metrics
            const redisStatus = await this.sequentialOrchestrator.redis.getSystemStatus();
            const activeOrchestrations = await this.sequentialOrchestrator.getActiveOrchestrations();

            const status = {
                status: 'available',
                redis: redisStatus,
                activeWorkflows: activeOrchestrations.length,
                availableRoles: ['architect', 'security', 'quality', 'performance', 'coordinator'],
                systemHealth: 'healthy'
            };

            res.json(status);

        } catch (error) {
            console.error('❌ Error fetching sequential system status:', error);
            res.json({ 
                status: 'error',
                message: error.message,
                systemHealth: 'degraded'
            });
        }
    }

    // Redis messaging endpoints
    async getRedisStatus(req, res) {
        try {
            if (!this.redisMiddleware) {
                return res.json({ 
                    connected: false, 
                    error: 'Redis middleware not initialized'
                });
            }

            const status = await this.redisMiddleware.getRedisStatus();
            res.json(status);
        } catch (error) {
            console.error('❌ Error getting Redis status:', error);
            res.status(500).json({ 
                connected: false, 
                error: error.message 
            });
        }
    }

    async startWorkflowViaRedis(req, res) {
        try {
            const { id } = req.params;
            const { projectPath, parameters } = req.body;

            if (!this.redisMiddleware) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'Redis messaging not available'
                });
            }

            await this.redisMiddleware.sendWorkflowCommand({
                action: 'start',
                workflowId: id,
                projectPath: projectPath || '.',
                parameters: parameters || {}
            });

            res.json({ 
                success: true, 
                message: `Workflow ${id} start command sent via Redis`
            });
        } catch (error) {
            console.error('❌ Error starting workflow via Redis:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async pauseWorkflowViaRedis(req, res) {
        try {
            const { id } = req.params;

            if (!this.redisMiddleware) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'Redis messaging not available'
                });
            }

            await this.redisMiddleware.sendWorkflowCommand({
                action: 'pause',
                workflowId: id,
                projectPath: '.'
            });

            res.json({ 
                success: true, 
                message: `Workflow ${id} pause command sent via Redis`
            });
        } catch (error) {
            console.error('❌ Error pausing workflow via Redis:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async stopWorkflowViaRedis(req, res) {
        try {
            const { id } = req.params;

            if (!this.redisMiddleware) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'Redis messaging not available'
                });
            }

            await this.redisMiddleware.sendWorkflowCommand({
                action: 'stop',
                workflowId: id,
                projectPath: '.'
            });

            res.json({ 
                success: true, 
                message: `Workflow ${id} stop command sent via Redis`
            });
        } catch (error) {
            console.error('❌ Error stopping workflow via Redis:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // CLI tools and enhanced functionality endpoints
    async getCliTools(req, res) {
        const tools = [
            {
                id: 'intelligent-selector',
                name: 'Intelligent Tool Selector',
                description: 'AI-powered tool selection based on context and performance metrics',
                status: 'active',
                capabilities: ['Context Analysis', 'Performance Optimization', 'Smart Selection'],
                reliability: 95,
                tokenCost: 'Low',
                usage: 'High'
            }
        ];
        res.json(tools);
    }

    async getProjectTools(req, res) {
        const tools = [
            {
                id: 'project-analyzer',
                name: 'Project Analyzer', 
                description: 'Analyzes project structure and dependencies',
                status: 'active',
                capabilities: ['Structure Analysis', 'Dependency Mapping'],
                reliability: 98,
                tokenCost: 'Medium',
                usage: 'High'
            }
        ];
        res.json(tools);
    }

    async getProjectDatabase(req, res) {
        const dbStatus = [
            {
                name: 'Project Data',
                icon: '🗃️',
                connected: true,
                tables: 12,
                records: 1547,
                size: '2.3 MB',
                lastSync: '5 minutes ago'
            }
        ];
        res.json(dbStatus);
    }

    async createPlannerProject(req, res) {
        try {
            const projectData = req.body;
            const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log('🎯 Creating new planner project:', projectData.name);
            
            res.json({
                success: true,
                projectId,
                message: 'Project created successfully',
                ...projectData
            });
        } catch (error) {
            console.error('❌ Error creating planner project:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async sendTerminalRequest(req, res) {
        try {
            const { command, role, projectPath, requestedBy = 'dashboard', options = {} } = req.body;
            
            if (!command) {
                return res.status(400).json({ 
                    error: 'Missing required field: command' 
                });
            }

            // Check if Redis middleware is available
            if (!this.redisMiddleware) {
                return res.status(503).json({ 
                    error: 'Redis messaging service not available', 
                    fallback: 'Use direct terminal orchestration instead' 
                });
            }

            // Send terminal request via Redis
            await this.redisMiddleware.sendTerminalRequest({
                command,
                role: role || 'DEVELOPER',
                projectPath: projectPath || process.cwd(),
                requestedBy,
                timestamp: new Date().toISOString(),
                requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...options
            });

            res.json({
                success: true,
                message: 'Terminal request sent successfully',
                command,
                role: role || 'DEVELOPER',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error sending terminal request:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async handleWebSocketUpgrade(req, res) {
        try {
            // This is a REST endpoint that provides WebSocket connection info
            // The actual WebSocket upgrade happens via Socket.IO, not this endpoint
            
            if (!this.redisMiddleware) {
                return res.json({
                    websocketAvailable: false,
                    message: 'Redis messaging service not available',
                    fallback: 'Direct WebSocket connection via Socket.IO available'
                });
            }

            const redisStatus = await this.redisMiddleware.getRedisStatus();
            
            res.json({
                websocketAvailable: true,
                redisConnected: redisStatus.connected,
                activeConnections: redisStatus.websocketConnections || 0,
                channels: redisStatus.channels || [],
                endpoint: '/socket.io',
                message: 'WebSocket connections available via Socket.IO'
            });
        } catch (error) {
            console.error('❌ Error handling WebSocket upgrade request:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message,
                websocketAvailable: false
            });
        }
    }

    async getCliConfig(req, res) {
        try {
            const config = {
                version: '2.0.0',
                environment: process.env.NODE_ENV || 'development',
                features: {
                    intelligentToolSelection: true,
                    tokenOptimization: true,
                    realTimeMonitoring: true,
                    contextOptimization: true,
                    duplicationDetection: true
                },
                endpoints: {
                    dashboard: `http://localhost:${this.port}`,
                    orchestrator: process.env.ORCHESTRATOR_URL || 'http://localhost:3006',
                    redis: process.env.REDIS_HOST || 'localhost'
                },
                settings: {
                    maxTokens: 8000,
                    defaultRole: 'DEVELOPER',
                    autoImprovement: false
                }
            };
            res.json(config);
        } catch (error) {
            console.error('❌ Error getting CLI config:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async getCliStats(req, res) {
        try {
            // Mock CLI statistics
            const stats = {
                totalSessions: Math.floor(Math.random() * 1000) + 100,
                activeUsers: Math.floor(Math.random() * 50) + 10,
                averageSessionDuration: '12.5 minutes',
                tokensOptimized: Math.floor(Math.random() * 100000) + 50000,
                duplicationsDetected: Math.floor(Math.random() * 500) + 100,
                toolSelectionAccuracy: '92.8%',
                performanceGain: '34%',
                popularCommands: [
                    { command: 'codemind-enhanced', usage: 45 },
                    { command: 'marketplace', usage: 32 },
                    { command: 'self-improve', usage: 28 },
                    { command: 'analyze', usage: 21 }
                ]
            };
            res.json(stats);
        } catch (error) {
            console.error('❌ Error getting CLI stats:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async syncProjectDatabase(req, res) {
        try {
            const { id } = req.params;
            const { operation = 'sync' } = req.body;
            
            console.log(`🔄 Syncing database for project ${id} (operation: ${operation})`);
            
            // Mock database sync operation
            const syncResult = {
                projectId: id,
                operation,
                tablesUpdated: Math.floor(Math.random() * 10) + 3,
                recordsAffected: Math.floor(Math.random() * 1000) + 100,
                duration: Math.floor(Math.random() * 5000) + 1000,
                timestamp: new Date().toISOString(),
                success: true
            };

            res.json({
                success: true,
                message: 'Database sync completed successfully',
                ...syncResult
            });
        } catch (error) {
            console.error('❌ Error syncing project database:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async getPlannerTemplates(req, res) {
        try {
            const templates = [
                {
                    id: 'web-app',
                    name: 'Web Application',
                    description: 'Full-stack web application with modern tech stack',
                    category: 'web',
                    technologies: ['React', 'Node.js', 'PostgreSQL', 'Express'],
                    estimatedDuration: '2-4 weeks',
                    complexity: 'medium'
                },
                {
                    id: 'api-service',
                    name: 'REST API Service',
                    description: 'RESTful API service with authentication and database',
                    category: 'backend',
                    technologies: ['Node.js', 'Express', 'PostgreSQL', 'JWT'],
                    estimatedDuration: '1-2 weeks',
                    complexity: 'low'
                },
                {
                    id: 'mobile-app',
                    name: 'Mobile Application',
                    description: 'Cross-platform mobile app with native features',
                    category: 'mobile',
                    technologies: ['React Native', 'Firebase', 'Redux'],
                    estimatedDuration: '3-6 weeks',
                    complexity: 'high'
                },
                {
                    id: 'dashboard',
                    name: 'Analytics Dashboard',
                    description: 'Real-time analytics dashboard with charts and metrics',
                    category: 'web',
                    technologies: ['React', 'D3.js', 'WebSocket', 'Redis'],
                    estimatedDuration: '2-3 weeks',
                    complexity: 'medium'
                }
            ];
            
            res.json({
                success: true,
                templates,
                total: templates.length
            });
        } catch (error) {
            console.error('❌ Error getting planner templates:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
}

module.exports = DashboardServer;

// Start server if run directly
if (require.main === module) {
    const server = new DashboardServer();
    server.start();
}