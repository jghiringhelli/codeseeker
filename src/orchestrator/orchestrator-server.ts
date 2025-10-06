/**
 * Sequential Workflow Orchestrator Server
 * 
 * HTTP API server that manages sequential workflow orchestrations.
 * Provides REST endpoints for starting, monitoring, and controlling
 * multi-role analysis workflows with Redis-based message queuing.
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import SequentialWorkflowOrchestrator, { OrchestrationRequest } from './sequential-workflow-orchestrator';
import RedisQueue from './messaging/redis-queue';
import { PostgreSQLAdapter } from '../database/adapters/postgresql';
import { Logger } from '../utils/logger';
import { ExternalToolManager } from './external-tool-manager';
import { SemanticOrchestrator } from './semantic-orchestrator';
import { ToolManagementAPI } from './tool-management-api';

export class OrchestratorServer {
  private app: express.Application;
  private orchestrator: SequentialWorkflowOrchestrator;
  private redis: RedisQueue;
  private db: PostgreSQLAdapter;
  private toolManager: ExternalToolManager;
  private semanticOrchestrator: SemanticOrchestrator;
  private toolManagementAPI: ToolManagementAPI;
  private logger = Logger.getInstance();
  private port: number;
  private server?: any;

  constructor() {
    this.app = express();
    this.orchestrator = new SequentialWorkflowOrchestrator();
    this.redis = new RedisQueue();
    this.db = new PostgreSQLAdapter({
      type: 'postgresql',
      host: process.env.DB_HOST || 'codemind-db',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'codemind',
      username: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123',
      ssl: false
    }, this.logger);
    this.toolManager = new ExternalToolManager(this.db as any);
    this.semanticOrchestrator = new SemanticOrchestrator();
    this.toolManagementAPI = new ToolManagementAPI();
    this.port = parseInt(process.env.ORCHESTRATOR_PORT || '3006');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`🌐 ${req.method} ${req.path}`, {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      next();
    });
  }

  private setupRoutes(): void {
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
    const api = express.Router();
    
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

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  private async startOrchestration(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { query, projectPath, requestedBy = 'api', options = {} } = req.body;

      if (!query || !projectPath) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['query', 'projectPath']
        });
        return;
      }

      const orchestrationRequest: OrchestrationRequest = {
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

    } catch (error) {
      this.logger.error('❌ Failed to start orchestration:', error);
      res.status(500).json({
        error: 'Failed to start orchestration',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get orchestration status
   */
  private async getOrchestrationStatus(req: express.Request, res: express.Response): Promise<void> {
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

    } catch (error) {
      this.logger.error('❌ Failed to get orchestration status:', error);
      res.status(500).json({
        error: 'Failed to get orchestration status',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get detailed orchestration information
   */
  private async getOrchestrationDetails(req: express.Request, res: express.Response): Promise<void> {
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

    } catch (error) {
      this.logger.error('❌ Failed to get orchestration details:', error);
      res.status(500).json({
        error: 'Failed to get orchestration details',
        message: (error as Error).message
      });
    }
  }

  /**
   * Stop orchestration
   */
  private async stopOrchestration(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { orchestrationId } = req.params;
      
      const result = await this.orchestrator.stopOrchestration(orchestrationId);
      
      res.json({
        orchestrationId,
        status: 'stopped',
        terminatedRoles: result.terminatedRoles,
        message: 'Orchestration stopped successfully'
      });

    } catch (error) {
      this.logger.error('❌ Failed to stop orchestration:', error);
      res.status(500).json({
        error: 'Failed to stop orchestration',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get active orchestrations
   */
  private async getActiveOrchestrations(req: express.Request, res: express.Response): Promise<void> {
    try {
      const orchestrations = await this.orchestrator.getActiveOrchestrations();
      
      // Enrich with current queue status
      const enrichedOrchestrations = await Promise.all(
        orchestrations.map(async (orchestration) => ({
          ...orchestration,
          activeRole: await this.redis.getWorkflowActiveRole(orchestration.orchestrationId)
        }))
      );
      
      res.json({
        orchestrations: enrichedOrchestrations,
        totalActive: orchestrations.length
      });

    } catch (error) {
      this.logger.error('❌ Failed to get active orchestrations:', error);
      res.status(500).json({
        error: 'Failed to get active orchestrations',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get queue status for all roles
   */
  private async getQueueStatus(req: express.Request, res: express.Response): Promise<void> {
    try {
      const queueLengths = await this.redis.getAllQueueLengths();
      
      res.json({
        queues: queueLengths,
        timestamp: Date.now(),
        totalPendingWork: Object.values(queueLengths).reduce((sum: number, length: any) => sum + (length as number), 0)
      });

    } catch (error) {
      this.logger.error('❌ Failed to get queue status:', error);
      res.status(500).json({
        error: 'Failed to get queue status',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get role processing metrics
   */
  private async getRoleMetrics(req: express.Request, res: express.Response): Promise<void> {
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

    } catch (error) {
      this.logger.error('❌ Failed to get role metrics:', error);
      res.status(500).json({
        error: 'Failed to get role metrics',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get system status
   */
  private async getSystemStatus(req: express.Request, res: express.Response): Promise<void> {
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
          totalQueuedWork: Object.values(queueLengths).reduce((sum: number, length: any) => sum + (length as number), 0),
          queueLengths
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('❌ Failed to get system status:', error);
      res.status(500).json({
        error: 'Failed to get system status',
        message: (error as Error).message
      });
    }
  }

  /**
   * Start the orchestrator server
   */
  async start(): Promise<void> {
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

    } catch (error) {
      this.logger.error('❌ Failed to start orchestrator server:', error);
      throw error;
    }
  }

  /**
   * Get tool recommendations for a project
   */
  private async getToolRecommendations(req: express.Request, res: express.Response): Promise<void> {
    try {
      const projectPath = decodeURIComponent(req.params.projectPath);
      const { roleType } = req.query;
      
      const recommendations = await this.toolManager.getToolRecommendations(
        projectPath, 
        roleType as string || 'general'
      );
      
      res.json({
        projectPath,
        roleType,
        recommendations,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('❌ Failed to get tool recommendations:', error);
      res.status(500).json({
        error: 'Failed to get tool recommendations',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get available tools
   */
  private async getAvailableTools(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { category, language } = req.query;
      
      const tools = await this.toolManager.getAvailableTools({
        category: category as string,
        language: language as string
      });
      
      res.json({
        tools,
        totalCount: tools.length,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('❌ Failed to get available tools:', error);
      res.status(500).json({
        error: 'Failed to get available tools',
        message: (error as Error).message
      });
    }
  }

  /**
   * Install a tool
   */
  private async installTool(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { toolId, projectPath, installationType = 'local' } = req.body;

      if (!toolId || !projectPath) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['toolId', 'projectPath']
        });
        return;
      }

      const result = await this.toolManager.installTool(
        toolId,
        projectPath,
        installationType as 'global' | 'local' | 'project'
      );
      
      res.json({
        toolId,
        projectPath,
        installationType,
        result,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('❌ Failed to install tool:', error);
      res.status(500).json({
        error: 'Failed to install tool',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get tools status for a project
   */
  private async getToolsStatus(req: express.Request, res: express.Response): Promise<void> {
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

    } catch (error) {
      this.logger.error('❌ Failed to get tools status:', error);
      res.status(500).json({
        error: 'Failed to get tools status',
        message: (error as Error).message
      });
    }
  }

  /**
   * Shutdown the orchestrator server
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Sequential Workflow Orchestrator...');

    try {
      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
      }

      // Shutdown dependencies
      await this.orchestrator.shutdown();
      await this.redis.disconnect();

      this.logger.info('✅ Sequential Workflow Orchestrator shutdown complete');
      process.exit(0);

    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Semantic graph endpoints
  private async semanticSearch(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { projectPath } = req.params;
      const { query, intent = 'overview', maxResults = 10 } = req.query;

      if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      await this.ensureSemanticInitialized();

      const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
        query: query as string,
        projectPath: decodeURIComponent(projectPath),
        intent: intent as any,
        maxResults: parseInt(maxResults as string),
        includeRelated: true
      });

      res.json(result);
    } catch (error) {
      this.logger.error('❌ Semantic search failed:', error);
      res.status(500).json({ 
        error: 'Semantic search failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getSemanticContext(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { projectPath } = req.params;
      const { 
        intent = 'overview', 
        maxTokens = 800, 
        includeCode = 'true' 
      } = req.query;

      await this.ensureSemanticInitialized();

      // This is the main endpoint for Claude Code context enhancement
      const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
        query: `project overview with ${intent} focus`,
        projectPath: decodeURIComponent(projectPath),
        intent: intent as any,
        maxResults: Math.min(parseInt(maxTokens as string) / 40, 20), // Estimate ~40 tokens per result
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
    } catch (error) {
      this.logger.error('❌ Get semantic context failed:', error);
      res.status(500).json({ 
        error: 'Get semantic context failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getImpactAnalysis(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { projectPath, nodeId } = req.params;
      const { maxDepth = 3 } = req.query;

      await this.ensureSemanticInitialized();

      // Use the semantic graph service directly for impact analysis
      const impact = await this.semanticOrchestrator['semanticGraph'].analyzeImpact(
        nodeId, 
        parseInt(maxDepth as string)
      );

      res.json(impact);
    } catch (error) {
      this.logger.error('❌ Impact analysis failed:', error);
      res.status(500).json({ 
        error: 'Impact analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async ensureSemanticInitialized(): Promise<void> {
    try {
      await this.semanticOrchestrator.initialize();
    } catch (error) {
      this.logger.warn('⚠️ Could not initialize semantic graph:', error);
      throw new Error('Semantic graph not available - ensure Neo4j is running');
    }
  }

  /**
   * Register external project in PostgreSQL database
   */
  private async registerExternalProject(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { 
        project_name, 
        project_path, 
        project_type, 
        description, 
        languages, 
        frameworks, 
        metadata, 
        status = 'active' 
      } = req.body;

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

    } catch (error) {
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
  private async initializeInternalTools(req: express.Request, res: express.Response): Promise<void> {
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

    } catch (error) {
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
  private async autodiscoverAndInitializeTools(req: express.Request, res: express.Response): Promise<void> {
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
        success_rate: Array.from(initResult.results.values()).filter((r: any) => r.success).length / initResult.results.size,
        tables_created: initResult.totalTablesCreated,
        records_inserted: initResult.totalRecordsInserted,
        tools: toolsForRegistration,
        initialization_results: Array.from(initResult.results.entries()).map(([name, result]: [string, any]) => ({
          tool_name: name,
          success: result.success,
          records_inserted: result.recordsInserted || 0,
          error: result.error
        })),
        message: 'Tools autodiscovered and initialized successfully'
      };

      this.logger.info(`✅ Autodiscovered and initialized ${toolsForRegistration.length} tools`);
      res.status(200).json(response);

    } catch (error) {
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
  private async analyzeProjectWithAllTools(req: express.Request, res: express.Response): Promise<void> {
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
          .filter((r: any) => r.recommendations && r.recommendations.length > 0)
          .flatMap((r: any) => r.recommendations!),
        message: 'Project analysis completed successfully'
      };

      this.logger.info(`✅ Project analysis completed in ${analysisResult.totalExecutionTime}ms`);
      res.status(200).json(response);

    } catch (error) {
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
  private async updateToolsAfterRequest(req: express.Request, res: express.Response): Promise<void> {
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
      const updateResult = await toolService.updateToolsAfterCliRequest(
        project_path, 
        projectId, 
        cli_command, 
        cli_result
      );
      
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
          .reduce((sum, r: any) => sum + (r.recordsModified || 0), 0),
        message: 'Tools updated successfully after CLI request'
      };

      this.logger.info(`✅ Updated ${updateResult.results.size} tools after CLI request`);
      res.status(200).json(response);

    } catch (error) {
      this.logger.error('❌ Failed to update tools:', error);
      res.status(500).json({ 
        error: 'Failed to update tools', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// CLI entry point
async function main() {
  const server = new OrchestratorServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start Sequential Workflow Orchestrator:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default OrchestratorServer;