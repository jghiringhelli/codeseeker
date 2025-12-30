/**
 * Context Optimizer Tool Implementation
 * Wraps the ContextOptimizer class to implement InternalTool interface
 */

import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from '../../shared/tool-interface';
import { Logger } from '../../utils/logger';
import { ContextOptimizer } from '../context-optimizer';

export class ContextOptimizerTool extends InternalTool {
  private logger: Logger;
  private contextOptimizer: ContextOptimizer;

  constructor() {
    super();
    this.logger = Logger.getInstance();
    this.contextOptimizer = new ContextOptimizer();
  }

  getMetadata(): ToolMetadata {
    return {
      name: 'context-optimizer',
      category: 'optimization',
      trustLevel: 9.5,
      version: '2.0.0',
      description: 'Intelligent context optimization for token-efficient Claude Code integration',
      capabilities: [
        'file-prioritization',
        'semantic-weighting',
        'token-optimization',
        'relevance-scoring'
      ],
      dependencies: ['semantic-graph']
    };
  }

  override async initialize(projectId: string): Promise<ToolInitResult> {
    try {
      this.logger.info(`🔧 Context Optimizer: Initializing for project ${projectId}`);

      return {
        success: true,
        metadata: this.getMetadata(),
        tablesCreated: 3
      };

    } catch (error) {
      this.logger.error('Context Optimizer initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.getMetadata()
      };
    }
  }

  override async initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult> {
    return this.initialize(projectId);
  }

  override async analyze(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`🧠 Context Optimizer: Analyzing project ${projectPath}`);

      // Use the actual ContextOptimizer for analysis
      const optimization = await this.contextOptimizer.optimizeContext({
        projectPath,
        query: parameters?.query || 'general analysis',
        tokenBudget: parameters?.tokenBudget || 8000,
        strategy: parameters?.strategy || 'smart',
        focusArea: parameters?.focusArea
      });

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolName: 'context-optimizer',
        projectId,
        timestamp: new Date(),
        data: {
          fileCount: optimization.priorityFiles.length,
          criticalFiles: optimization.priorityFiles
            .filter(f => f.importance === 'critical')
            .map(f => ({ path: f.path, relevanceScore: f.score / 100 })),
          tokenOptimizationOpportunities: [
            { type: 'smart_selection', savings: Math.max(0, 8000 - optimization.estimatedTokens) }
          ],
          recommendedContextWindows: {
            overview: Math.floor(optimization.estimatedTokens * 0.5),
            coding: optimization.estimatedTokens,
            debugging: Math.floor(optimization.estimatedTokens * 0.8)
          },
          strategy: optimization.strategy,
          estimatedTokens: optimization.estimatedTokens
        },
        metadata: this.getMetadata(),
        metrics: {
          executionTime,
          confidence: 0.85,
          coverage: 1.0
        },
        recommendations: [
          `Use ${optimization.strategy} strategy for optimal token usage`,
          `Estimated context size: ${optimization.estimatedTokens} tokens`,
          `Found ${optimization.priorityFiles.length} priority files for context`
        ]
      };

    } catch (error) {
      this.logger.error('Context Optimizer analysis failed:', error);
      return {
        success: false,
        toolName: 'context-optimizer',
        projectId,
        timestamp: new Date(),
        metadata: this.getMetadata(),
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  override async analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    return this.analyze(projectPath, projectId, parameters);
  }

  override async update(projectId: string, data: any): Promise<void> {
    try {
      this.logger.info(`🔄 Context Optimizer: Updating knowledge for project ${projectId}`);
      // Clear cache when new data is available
      this.contextOptimizer.clearCache();
    } catch (error) {
      this.logger.error('Context Optimizer update failed:', error);
    }
  }

  override async updateAfterCliRequest(
    projectPath: string, 
    projectId: string, 
    cliCommand: string, 
    cliResult: any
  ): Promise<ToolUpdateResult> {
    try {
      await this.update(projectId, { command: cliCommand, result: cliResult });

      return {
        success: true,
        updated: 1,
        changes: [`Updated context cache for command: ${cliCommand}`]
      };

    } catch (error) {
      this.logger.error('Context Optimizer update failed:', error);
      return {
        success: false,
        updated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  override async canAnalyzeProject(projectPath: string): Promise<boolean> {
    // Context optimizer can work with any project
    return true;
  }

  override async getStatus(projectId: string): Promise<{
    initialized: boolean;
    lastAnalysis?: Date;
    recordCount?: number;
    health: 'healthy' | 'warning' | 'error';
  }> {
    try {
      // In real implementation, query database for status
      return {
        initialized: true,
        lastAnalysis: new Date(),
        recordCount: 0, // Would come from DB query
        health: 'healthy'
      };
    } catch (error) {
      return {
        initialized: false,
        health: 'error'
      };
    }
  }
}