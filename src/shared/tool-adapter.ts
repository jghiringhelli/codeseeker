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

  async initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult> {
    try {
      this.logger.info(`Initializing ${this.enhancedTool.name} for project ${projectId}`);
      
      // Check if tool is applicable
      const applicable = this.enhancedTool.isApplicable ? 
        this.enhancedTool.isApplicable(projectPath, { projectId }) : true;
        
      if (!applicable) {
        return {
          success: false,
          error: `Tool ${this.enhancedTool.name} is not applicable to this project`
        };
      }

      // Ensure database tables exist (handled by tool-database-api.ts)
      return {
        success: true,
        tablesCreated: [this.enhancedTool.getDatabaseToolName()],
        recordsInserted: 0
      };
      
    } catch (error) {
      this.logger.error(`Initialization failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error'
      };
    }
  }

  async analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    try {
      this.logger.info(`Running analysis with ${this.enhancedTool.name}`);
      
      const startTime = Date.now();
      const result = await this.enhancedTool.analyze(projectPath, projectId, parameters);
      const executionTime = Date.now() - startTime;

      return {
        toolName: this.enhancedTool.name,
        projectId,
        timestamp: new Date(),
        data: result.data,
        metrics: {
          executionTime,
          confidence: 0.8,
          coverage: Array.isArray(result.data) ? Math.min(result.data.length / 100, 1.0) : 1.0
        },
        recommendations: result.recommendations || [],
        errors: result.error ? [result.error] : []
      };
      
    } catch (error) {
      this.logger.error(`Analysis failed: ${error}`);
      return {
        toolName: this.enhancedTool.name,
        projectId,
        timestamp: new Date(),
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown analysis error']
      };
    }
  }

  async updateAfterCliRequest(
    projectPath: string,
    projectId: string,
    cliCommand: string,
    cliResult: any
  ): Promise<ToolUpdateResult> {
    try {
      this.logger.info(`Updating ${this.enhancedTool.name} after CLI request`);
      
      // Check if this tool should respond to the CLI command
      const shouldUpdate = this.shouldUpdateForCommand(cliCommand);
      if (!shouldUpdate) {
        return {
          success: true,
          tablesUpdated: [],
          recordsModified: 0
        };
      }

      // Use enhanced tool's update knowledge method if available
      if (this.enhancedTool.updateKnowledge) {
        await this.enhancedTool.updateKnowledge(projectId, {
          command: cliCommand,
          result: cliResult,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        tablesUpdated: [this.enhancedTool.getDatabaseToolName()],
        recordsModified: 1
      };
      
    } catch (error) {
      this.logger.error(`Update failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown update error'
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

  private mapCategory(category: string): ToolMetadata['category'] {
    const categoryMap: Record<string, ToolMetadata['category']> = {
      'navigation': 'navigation',
      'architecture': 'architecture',
      'code-quality': 'quality',
      'verification': 'verification',
      'analysis': 'analysis',
      'optimization': 'optimization',
      'search': 'search'
    };
    
    return categoryMap[category] || 'analysis';
  }

  private shouldUpdateForCommand(command: string): boolean {
    const updateTriggers = [
      'refactor', 'create', 'modify', 'delete', 'move', 'rename',
      'add', 'remove', 'update', 'change', 'fix'
    ];
    
    return updateTriggers.some(trigger => 
      command.toLowerCase().includes(trigger)
    );
  }
}