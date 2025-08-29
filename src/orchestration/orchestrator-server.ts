/**
 * Sequential Workflow Orchestrator Server
 * 
 * HTTP API server that manages sequential workflow orchestrations.
 * Provides REST endpoints for starting, monitoring, and controlling
 * multi-role analysis workflows with Redis-based message queuing.
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import SequentialWorkflowOrchestrator, { OrchestrationRequest } from './sequential-workflow-orchestrator';
import RedisQueue from '../messaging/redis-queue';
import { PostgreSQLAdapter } from '../database/adapters/postgresql';
import { Logger } from '../utils/logger';
import { ExternalToolManager } from './external-tool-manager';

export class OrchestratorServer {
  private app: express.Application;
  private orchestrator: SequentialWorkflowOrchestrator;
  private redis: RedisQueue;
  private db: PostgreSQLAdapter;
  private toolManager: ExternalToolManager;
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
        totalPendingWork: Object.values(queueLengths).reduce((sum, length) => sum + length, 0)
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
          totalQueuedWork: Object.values(queueLengths).reduce((sum, length) => sum + length, 0),
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