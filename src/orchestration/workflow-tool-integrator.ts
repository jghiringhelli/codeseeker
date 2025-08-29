import { ExternalToolManager, ToolRecommendation } from './external-tool-manager';
import { Database } from '../database/database';
import { Logger } from '../utils/logger';
import { RoleType } from './types';

export interface ToolExecutionContext {
  workflowId: string;
  roleType: RoleType;
  projectPath: string;
  stepNumber: number;
  purpose: string; // What the role is trying to accomplish
  additionalContext?: any;
}

export interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  output: string;
  duration: number;
  error?: string;
  recommendations?: ToolRecommendation[];
}

export interface WorkflowToolEvent {
  type: 'tool-needed' | 'tool-installed' | 'tool-executed' | 'permission-requested';
  workflowId: string;
  roleType: RoleType;
  toolId: string;
  context: any;
  timestamp: Date;
}

/**
 * Integrates external tool management with workflow orchestration.
 * Handles tool recommendations, installations, and executions within role contexts.
 */
export class WorkflowToolIntegrator {
  private logger = Logger.getInstance();
  private toolManager: ExternalToolManager;
  private db: Database;
  private eventListeners: ((event: WorkflowToolEvent) => void)[] = [];

  constructor(toolManager: ExternalToolManager, database: Database) {
    this.toolManager = toolManager;
    this.db = database;
  }

  /**
   * Called when a role starts execution - proactively recommends tools
   */
  async onRoleStart(context: ToolExecutionContext): Promise<ToolRecommendation[]> {
    this.logger.info(`Role ${context.roleType} starting - analyzing tool needs`, {
      workflowId: context.workflowId,
      projectPath: context.projectPath,
      purpose: context.purpose
    });

    try {
      // Get tool recommendations for this role and project
      const recommendations = await this.toolManager.getToolRecommendations(
        context.projectPath,
        context.roleType
      );

      // Filter recommendations by timing (project-setup, before-coding, now)
      const relevantRecommendations = this.filterRecommendationsByTiming(
        recommendations,
        context
      );

      // Log recommendations for monitoring
      await this.logToolRecommendations(context, relevantRecommendations);

      // Auto-install high-priority tools with permissions
      await this.handleAutoInstallations(context, relevantRecommendations);

      return relevantRecommendations;

    } catch (error) {
      this.logger.error(`Error analyzing tool needs for ${context.roleType}:`, error as Error);
      return [];
    }
  }

  /**
   * Execute a tool within a role context
   */
  async executeTool(
    toolId: string, 
    args: string[], 
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    this.logger.debug(`Executing tool ${toolId} for role ${context.roleType}`, {
      args,
      workflowId: context.workflowId,
      projectPath: context.projectPath
    });

    try {
      // Check if tool is available, install if needed and permitted
      const isAvailable = await this.toolManager.isToolAvailable(toolId, context.projectPath);
      
      if (!isAvailable) {
        const installResult = await this.handleToolInstallation(toolId, context);
        if (!installResult) {
          return {
            toolId,
            success: false,
            output: '',
            duration: Date.now() - startTime,
            error: 'Tool not available and installation failed or denied'
          };
        }
      }

      // Execute the tool
      const result = await this.toolManager.executeTool(
        toolId,
        args,
        context.projectPath,
        context.roleType
      );

      const executionResult: ToolExecutionResult = {
        toolId,
        success: result.success,
        output: result.output,
        duration: Date.now() - startTime,
        error: result.error
      };

      // Log execution for analytics
      await this.logToolExecution(context, executionResult, args);

      // Emit event for monitoring
      this.emitEvent({
        type: 'tool-executed',
        workflowId: context.workflowId,
        roleType: context.roleType,
        toolId,
        context: { success: result.success, duration: executionResult.duration },
        timestamp: new Date()
      });

      return executionResult;

    } catch (error) {
      const executionResult: ToolExecutionResult = {
        toolId,
        success: false,
        output: '',
        duration: Date.now() - startTime,
        error: (error as Error).message
      };

      await this.logToolExecution(context, executionResult, args);
      return executionResult;
    }
  }

  /**
   * Handle tool installation with user permission flow
   */
  private async handleToolInstallation(
    toolId: string, 
    context: ToolExecutionContext
  ): Promise<boolean> {
    this.logger.info(`Attempting to install tool ${toolId} for ${context.roleType}`, {
      workflowId: context.workflowId,
      projectPath: context.projectPath
    });

    // Check existing permissions
    const hasPermission = await this.checkRoleToolPermission(context.roleType, toolId);
    
    if (hasPermission === 'auto-approved') {
      // Auto-install approved tools
      const installed = await this.toolManager.installTool(
        toolId,
        context.projectPath,
        context.roleType,
        true
      );

      if (installed) {
        this.emitEvent({
          type: 'tool-installed',
          workflowId: context.workflowId,
          roleType: context.roleType,
          toolId,
          context: { autoInstall: true },
          timestamp: new Date()
        });
      }

      return installed;
    }

    if (hasPermission === 'denied') {
      this.logger.warn(`Tool installation denied: ${toolId} for ${context.roleType}`);
      return false;
    }

    // Request permission from user
    const userApproval = await this.requestUserPermission(toolId, context);
    
    if (userApproval) {
      const installed = await this.toolManager.installTool(
        toolId,
        context.projectPath,
        context.roleType,
        false
      );

      if (installed) {
        this.emitEvent({
          type: 'tool-installed',
          workflowId: context.workflowId,
          roleType: context.roleType,
          toolId,
          context: { userApproved: true },
          timestamp: new Date()
        });
      }

      return installed;
    }

    return false;
  }

  /**
   * Request user permission for tool installation
   */
  private async requestUserPermission(
    toolId: string, 
    context: ToolExecutionContext
  ): Promise<boolean> {
    // Emit event for external handling (e.g., CLI prompts)
    this.emitEvent({
      type: 'permission-requested',
      workflowId: context.workflowId,
      roleType: context.roleType,
      toolId,
      context: {
        purpose: context.purpose,
        projectPath: context.projectPath
      },
      timestamp: new Date()
    });

    // In a real implementation, this would integrate with the CLI or web interface
    // For now, we'll implement a simple approval mechanism
    // This could be enhanced to show tool details, security info, etc.
    
    try {
      // Query database for any existing approval history
      const approvalHistory = await this.getToolApprovalHistory(
        context.projectPath,
        toolId,
        context.roleType
      );

      // If user previously approved "always", auto-approve
      if (approvalHistory?.user_decision === 'approve-always') {
        return true;
      }

      // Otherwise, default to requiring explicit approval
      // In practice, this would trigger a user prompt
      return false; // Conservative default
      
    } catch (error) {
      this.logger.error('Error checking approval history:', error as Error);
      return false;
    }
  }

  /**
   * Filter recommendations by timing context
   */
  private filterRecommendationsByTiming(
    recommendations: ToolRecommendation[],
    context: ToolExecutionContext
  ): ToolRecommendation[] {
    // Determine current phase based on context
    let currentTiming: 'now' | 'project-setup' | 'before-coding' | 'as-needed' = 'as-needed';
    
    if (context.stepNumber <= 2) {
      currentTiming = 'project-setup';
    } else if (context.purpose.toLowerCase().includes('implement') || 
               context.purpose.toLowerCase().includes('code')) {
      currentTiming = 'before-coding';
    } else if (context.roleType === RoleType.SECURITY_AUDITOR || 
               context.roleType === RoleType.QUALITY_AUDITOR) {
      currentTiming = 'now';
    }

    return recommendations.filter(rec => {
      // Always include critical and high urgency tools
      if (rec.urgency === 'critical' || rec.urgency === 'high') {
        return true;
      }

      // Include tools matching current timing
      if (rec.timing === currentTiming || rec.timing === 'now') {
        return true;
      }

      // Include high-confidence tools regardless of timing
      return rec.confidence > 0.8;
    });
  }

  /**
   * Handle auto-installations for approved tools
   */
  private async handleAutoInstallations(
    context: ToolExecutionContext,
    recommendations: ToolRecommendation[]
  ): Promise<void> {
    const autoInstallCandidates = recommendations.filter(rec => 
      rec.urgency === 'critical' && 
      rec.tool.trustLevel === 'safe' &&
      rec.confidence > 0.7
    );

    for (const candidate of autoInstallCandidates) {
      try {
        const hasPermission = await this.checkRoleToolPermission(
          context.roleType,
          candidate.tool.id
        );

        if (hasPermission === 'auto-approved') {
          await this.toolManager.installTool(
            candidate.tool.id,
            context.projectPath,
            context.roleType,
            true
          );

          this.logger.info(`Auto-installed critical tool: ${candidate.tool.name}`, {
            workflowId: context.workflowId,
            roleType: context.roleType
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to auto-install ${candidate.tool.name}:`, error);
      }
    }
  }

  /**
   * Check role-tool permission status
   */
  private async checkRoleToolPermission(
    roleType: RoleType, 
    toolId: string
  ): Promise<'allowed' | 'auto-approved' | 'ask-permission' | 'denied'> {
    try {
      // Query database for role permissions
      // In practice, this would use the Database class to query role_tool_permissions table
      return 'ask-permission'; // Conservative default
    } catch (error) {
      this.logger.error('Error checking role tool permission:', error as Error);
      return 'ask-permission';
    }
  }

  /**
   * Get tool approval history for user decisions
   */
  private async getToolApprovalHistory(
    projectPath: string,
    toolId: string,
    roleType: RoleType
  ): Promise<any> {
    try {
      // Query tool_approval_history table
      // This would be implemented using the Database class
      return null;
    } catch (error) {
      this.logger.error('Error getting approval history:', error as Error);
      return null;
    }
  }

  /**
   * Log tool recommendations for analytics
   */
  private async logToolRecommendations(
    context: ToolExecutionContext,
    recommendations: ToolRecommendation[]
  ): Promise<void> {
    try {
      for (const rec of recommendations) {
        // Insert into tool_recommendations table
        // This would use the Database class for persistence
        this.logger.debug(`Recommended tool ${rec.tool.name} with confidence ${rec.confidence}`, {
          workflowId: context.workflowId,
          roleType: context.roleType,
          urgency: rec.urgency,
          reasons: rec.reasons
        });
      }
    } catch (error) {
      this.logger.error('Error logging tool recommendations:', error as Error);
    }
  }

  /**
   * Log tool execution for analytics
   */
  private async logToolExecution(
    context: ToolExecutionContext,
    result: ToolExecutionResult,
    args: string[]
  ): Promise<void> {
    try {
      // Insert into tool_usage_analytics table
      // This would use the Database class for persistence
      this.logger.debug(`Tool execution logged: ${result.toolId}`, {
        workflowId: context.workflowId,
        roleType: context.roleType,
        success: result.success,
        duration: result.duration
      });
    } catch (error) {
      this.logger.error('Error logging tool execution:', error as Error);
    }
  }

  /**
   * Event system for monitoring and external integration
   */
  addEventListener(listener: (event: WorkflowToolEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: WorkflowToolEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: WorkflowToolEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Error in tool event listener:', error as Error);
      }
    });
  }

  /**
   * Get available tools for a role in current context
   */
  async getAvailableTools(context: ToolExecutionContext): Promise<string[]> {
    try {
      const recommendations = await this.toolManager.getToolRecommendations(
        context.projectPath,
        context.roleType
      );

      return recommendations.map(rec => rec.tool.id);
    } catch (error) {
      this.logger.error('Error getting available tools:', error as Error);
      return [];
    }
  }

  /**
   * Pre-install recommended tools during workflow initialization
   */
  async preInstallWorkflowTools(
    projectPath: string,
    workflowId: string,
    roles: RoleType[]
  ): Promise<{ installed: string[]; failed: string[]; pending: string[] }> {
    const results = { installed: [] as string[], failed: [] as string[], pending: [] as string[] };
    
    this.logger.info(`Pre-installing tools for workflow ${workflowId}`, { 
      projectPath, 
      roles: roles.length 
    });

    try {
      for (const roleType of roles) {
        const recommendations = await this.toolManager.getToolRecommendations(
          projectPath,
          roleType
        );

        const preInstallCandidates = recommendations.filter(rec => 
          rec.timing === 'project-setup' && 
          rec.urgency !== 'low' &&
          rec.tool.trustLevel === 'safe'
        );

        for (const candidate of preInstallCandidates) {
          const permission = await this.checkRoleToolPermission(roleType, candidate.tool.id);
          
          if (permission === 'auto-approved') {
            const success = await this.toolManager.installTool(
              candidate.tool.id,
              projectPath,
              roleType,
              true
            );
            
            if (success) {
              results.installed.push(candidate.tool.id);
            } else {
              results.failed.push(candidate.tool.id);
            }
          } else {
            results.pending.push(candidate.tool.id);
          }
        }
      }

      this.logger.info(`Pre-installation complete for workflow ${workflowId}`, results);
      return results;

    } catch (error) {
      this.logger.error(`Error pre-installing workflow tools:`, error as Error);
      return results;
    }
  }
}