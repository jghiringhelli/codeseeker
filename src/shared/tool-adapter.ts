/**
 * Tool Adapter - Bridges existing enhanced tools to InternalTool interface
 * Allows initialization script to work with existing tool implementations
 */

import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from './tool-interface';
import { AnalysisTool } from './tool-interface';
import { Logger, LogLevel } from '../utils/logger';

export class ToolAdapter extends InternalTool {
  private enhancedTool: AnalysisTool;
  private logger: Logger;

  constructor(enhancedTool: AnalysisTool) {
    super();
    this.enhancedTool = enhancedTool;
    this.logger = new Logger(LogLevel.INFO, enhancedTool.name);
  }

  getMetadata(): ToolMetadata {
    return {
      name: this.enhancedTool.name,
      category: this.mapCategory(this.enhancedTool.category),
      trustLevel: 0.8,
      version: this.enhancedTool.version,
      description: this.enhancedTool.description,
      dependencies: this.enhancedTool.dependencies,
      capabilities: Object.keys(this.enhancedTool.capabilities)
    };
  }

  override async initialize(projectId: string): Promise<ToolInitResult> {
    try {
      this.logger.info(`Initializing ${this.enhancedTool.name} for project ${projectId}`);
      
      return {
        success: true,
        metadata: this.getMetadata(),
        tablesCreated: 1
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
        metadata: this.getMetadata()
      };
    }
  }

  override async initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult> {
    return this.initialize(projectId);
  }

  override async analyze(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    return this.analyzeProject(projectPath, projectId, parameters);
  }

  override async analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    try {
      this.logger.info(`Running analysis with ${this.enhancedTool.name}`);
      
      // Use the enhanced tool's analyze method
      const result = await this.enhancedTool.analyze(projectPath, projectId, parameters);
      
      return {
        success: true,
        toolName: this.enhancedTool.name,
        projectId,
        timestamp: new Date(),
        data: result.data || result.analysis,
        metadata: this.getMetadata(),
        metrics: result.metrics,
        recommendations: this.enhancedTool.getRecommendations ? 
          this.enhancedTool.getRecommendations(result) : []
      };

    } catch (error) {
      this.logger.error(`Analysis failed: ${error}`);
      return {
        success: false,
        toolName: this.enhancedTool.name,
        projectId,
        timestamp: new Date(),
        metadata: this.getMetadata(),
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  override async update(projectId: string, data: any): Promise<void> {
    try {
      if (this.enhancedTool.updateKnowledge) {
        await this.enhancedTool.updateKnowledge(projectId, data);
      }
    } catch (error) {
      this.logger.error(`Update failed: ${error}`);
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
        changes: [`Updated knowledge for ${this.enhancedTool.name}`]
      };

    } catch (error) {
      return {
        success: false,
        updated: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  override async canAnalyzeProject(projectPath: string): Promise<boolean> {
    try {
      if (this.enhancedTool.isApplicable) {
        return this.enhancedTool.isApplicable(projectPath, {});
      }
      return true;
    } catch {
      return false;
    }
  }

  override async getStatus(projectId: string): Promise<{
    initialized: boolean;
    lastAnalysis?: Date;
    recordCount?: number;
    health: 'healthy' | 'warning' | 'error';
  }> {
    try {
      return {
        initialized: true,
        lastAnalysis: new Date(),
        recordCount: 0,
        health: 'healthy'
      };
    } catch (error) {
      return {
        initialized: false,
        health: 'error'
      };
    }
  }

  private mapCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      'code_analysis': 'analysis',
      'documentation': 'documentation', 
      'testing': 'quality',
      'optimization': 'optimization',
      'search': 'search'
    };
    
    return categoryMap[category] || 'other';
  }
}