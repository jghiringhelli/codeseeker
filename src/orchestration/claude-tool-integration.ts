import { ExternalToolManager, ExternalTool, ToolRecommendation } from './external-tool-manager';
import { WorkflowToolIntegrator, ToolExecutionContext, WorkflowToolEvent } from './workflow-tool-integrator';
import { Database } from '../database/database';
import { Logger } from '../utils/logger';
import { RoleType } from './types';

export interface ClaudeToolPrompt {
  type: 'permission-request' | 'tool-recommendation' | 'installation-status';
  toolId: string;
  toolName: string;
  context: {
    projectPath: string;
    roleType: RoleType;
    purpose: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    trustLevel: 'safe' | 'verified' | 'community' | 'experimental';
    diskSpace: number;
    installTime: 'instant' | 'fast' | 'medium' | 'slow';
    reasons: string[];
  };
  options: {
    approve: string;
    deny: string;
    approveAlways?: string;
    viewDetails?: string;
  };
}

export interface UserResponse {
  decision: 'approve' | 'deny' | 'approve-always' | 'approve-once' | 'view-details';
  remember: boolean;
  reasoning?: string;
}

export class ClaudeToolIntegration {
  private logger = Logger.getInstance();
  private toolManager: ExternalToolManager;
  private workflowIntegrator: WorkflowToolIntegrator;
  private db: Database;
  private pendingPrompts = new Map<string, ClaudeToolPrompt>();

  constructor(
    toolManager: ExternalToolManager,
    workflowIntegrator: WorkflowToolIntegrator,
    database: Database
  ) {
    this.toolManager = toolManager;
    this.workflowIntegrator = workflowIntegrator;
    this.db = database;
    this.workflowIntegrator.addEventListener(this.handleWorkflowToolEvent.bind(this));
  }

  private async handleWorkflowToolEvent(event: WorkflowToolEvent): Promise<void> {
    switch (event.type) {
      case 'permission-requested':
        await this.generatePermissionPrompt(event);
        break;
      case 'tool-needed':
        await this.generateRecommendationPrompt(event);
        break;
      case 'tool-installed':
        await this.notifyInstallationSuccess(event);
        break;
    }
  }

  private async generatePermissionPrompt(event: WorkflowToolEvent): Promise<void> {
    try {
      const tool = await this.getToolById(event.toolId);
      if (!tool) {
        this.logger.warn(`Tool not found for permission prompt: ${event.toolId}`);
        return;
      }

      const recommendations = await this.toolManager.getToolRecommendations(
        event.context.projectPath,
        event.roleType
      );

      const recommendation = recommendations.find(rec => rec.tool.id === event.toolId);
      const urgency = recommendation?.urgency || 'medium';
      const reasons = recommendation?.reasons || [`Required by ${event.roleType} role`];

      const prompt: ClaudeToolPrompt = {
        type: 'permission-request',
        toolId: event.toolId,
        toolName: tool.name,
        context: {
          projectPath: event.context.projectPath,
          roleType: event.roleType,
          purpose: event.context.purpose || 'Role execution',
          urgency,
          trustLevel: tool.trustLevel,
          diskSpace: tool.diskSpace,
          installTime: tool.installationTime,
          reasons
        },
        options: {
          approve: 'Install now',
          deny: 'Skip this tool',
          approveAlways: `Always install ${tool.name} for ${event.roleType}`,
          viewDetails: 'Show tool details'
        }
      };

      const promptId = `prompt_${Date.now()}_${event.toolId}`;
      this.pendingPrompts.set(promptId, prompt);
      await this.sendPromptToClaudeCode(promptId, prompt);

    } catch (error) {
      this.logger.error('Error generating permission prompt:', error as Error);
    }
  }

  private async generateRecommendationPrompt(event: WorkflowToolEvent): Promise<void> {
    try {
      const recommendations = await this.toolManager.getToolRecommendations(
        event.context.projectPath,
        event.roleType
      );

      const criticalTools = recommendations.filter(rec => 
        rec.urgency === 'critical' || rec.urgency === 'high'
      );

      if (criticalTools.length > 0) {
        for (const rec of criticalTools.slice(0, 3)) {
          const prompt: ClaudeToolPrompt = {
            type: 'tool-recommendation',
            toolId: rec.tool.id,
            toolName: rec.tool.name,
            context: {
              projectPath: event.context.projectPath,
              roleType: event.roleType,
              purpose: `${rec.tool.category} for ${event.roleType}`,
              urgency: rec.urgency,
              trustLevel: rec.tool.trustLevel,
              diskSpace: rec.tool.diskSpace,
              installTime: rec.tool.installationTime,
              reasons: rec.reasons
            },
            options: {
              approve: `Install ${rec.tool.name}`,
              deny: 'Not now',
              viewDetails: 'Learn more'
            }
          };

          const promptId = `rec_${Date.now()}_${rec.tool.id}`;
          this.pendingPrompts.set(promptId, prompt);
          await this.sendPromptToClaudeCode(promptId, prompt);
        }
      }
    } catch (error) {
      this.logger.error('Error generating recommendation prompt:', error as Error);
    }
  }

  private async notifyInstallationSuccess(event: WorkflowToolEvent): Promise<void> {
    try {
      const tool = await this.getToolById(event.toolId);
      if (!tool) return;

      this.logger.info(`Tool installation success: ${tool.name} for ${event.roleType}`);
    } catch (error) {
      this.logger.error('Error sending installation notification:', error as Error);
    }
  }

  private async sendPromptToClaudeCode(promptId: string, prompt: ClaudeToolPrompt): Promise<void> {
    this.logger.info(`Sending tool prompt to CLI: ${prompt.type} for ${prompt.toolName}`, {
      promptId,
      urgency: prompt.context.urgency,
      trustLevel: prompt.context.trustLevel
    });
  }

  async handleUserResponse(promptId: string, response: UserResponse): Promise<void> {
    const prompt = this.pendingPrompts.get(promptId);
    if (!prompt) {
      this.logger.warn(`Prompt not found: ${promptId}`);
      return;
    }

    try {
      await this.logUserDecision(prompt, response);

      switch (response.decision) {
        case 'approve':
        case 'approve-once':
          await this.processApproval(prompt, response, false);
          break;
        case 'approve-always':
          await this.processApproval(prompt, response, true);
          break;
        case 'deny':
          await this.processDenial(prompt, response);
          break;
        case 'view-details':
          await this.showToolDetails(prompt);
          break;
      }

      this.pendingPrompts.delete(promptId);
    } catch (error) {
      this.logger.error('Error handling user response:', error as Error);
    }
  }

  private async processApproval(prompt: ClaudeToolPrompt, response: UserResponse, remember: boolean): Promise<void> {
    const permissionLevel = remember ? 'auto-approved' : 'allowed';
    await this.toolManager.createToolPermission(
      prompt.context.roleType,
      prompt.toolId,
      permissionLevel,
      remember,
      'user'
    );

    const success = await this.toolManager.installTool(
      prompt.toolId,
      prompt.context.projectPath,
      prompt.context.roleType,
      true
    );

    if (success) {
      this.logger.info(`Tool approved and installed: ${prompt.toolName}`);
    } else {
      this.logger.error(`Tool approval succeeded but installation failed: ${prompt.toolName}`);
    }
  }

  private async processDenial(prompt: ClaudeToolPrompt, response: UserResponse): Promise<void> {
    if (response.remember) {
      await this.toolManager.createToolPermission(
        prompt.context.roleType,
        prompt.toolId,
        'denied',
        false,
        'user'
      );
    }
    this.logger.info(`Tool installation denied: ${prompt.toolName}`);
  }

  private async showToolDetails(prompt: ClaudeToolPrompt): Promise<void> {
    const tool = await this.getToolById(prompt.toolId);
    if (!tool) return;

    this.logger.info(`Tool details for ${tool.name}:`, {
      description: tool.description,
      category: tool.category,
      trustLevel: tool.trustLevel
    });
  }

  private async logUserDecision(prompt: ClaudeToolPrompt, response: UserResponse): Promise<void> {
    try {
      const projectResult = await this.db.query(`
        SELECT id FROM projects WHERE project_path = $1 LIMIT 1
      `, [prompt.context.projectPath]);

      if (projectResult.rows.length === 0) return;

      const projectId = projectResult.rows[0].id;
      const historyId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.query(`
        INSERT INTO tool_approval_history (
          id, project_id, tool_id, role_type, request_type, user_decision,
          requested_at, decided_at, reasoning, remember_decision
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        historyId,
        projectId,
        prompt.toolId,
        prompt.context.roleType,
        'install',
        response.decision,
        new Date(),
        new Date(),
        response.reasoning || 'User decision via CLI',
        response.remember
      ]);
    } catch (error) {
      this.logger.error('Error logging user decision:', error as Error);
    }
  }

  private async getToolById(toolId: string): Promise<ExternalTool | null> {
    try {
      const cached = (this.toolManager as any).toolCache.get(toolId);
      if (cached) return cached;

      const result = await this.db.query(`
        SELECT * FROM external_tools WHERE tool_id = $1 AND is_active = true LIMIT 1
      `, [toolId]);

      if (result.rows.length === 0) return null;
      return (this.toolManager as any).dbRowToExternalTool(result.rows[0]);
    } catch (error) {
      this.logger.error('Error getting tool by ID:', error as Error);
      return null;
    }
  }

  getPendingPrompts(): Map<string, ClaudeToolPrompt> {
    return new Map(this.pendingPrompts);
  }

  clearPendingPrompts(): void {
    this.pendingPrompts.clear();
  }

  async getUrgentRecommendations(projectPath: string): Promise<ToolRecommendation[]> {
    try {
      const result = await this.db.query(`
        SELECT tr.*, et.tool_name, et.description, et.category
        FROM tool_recommendations tr
        JOIN external_tools et ON tr.tool_id = et.tool_id
        JOIN projects p ON tr.project_id = p.id
        WHERE p.project_path = $1 AND tr.urgency IN ('critical', 'high')
          AND tr.recommendation_status = 'pending'
        ORDER BY 
          CASE tr.urgency 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            ELSE 3
          END,
          tr.confidence_score DESC
        LIMIT 10
      `, [projectPath]);

      return result.rows.map(row => ({
        tool: {
          id: row.tool_id,
          name: row.tool_name,
          description: row.description,
          category: row.category
        } as ExternalTool,
        confidence: row.confidence_score,
        reasons: row.reasons || [],
        urgency: row.urgency,
        timing: row.timing,
        estimatedBenefit: row.estimated_benefit
      }));
    } catch (error) {
      this.logger.error('Error getting urgent recommendations:', error as Error);
      return [];
    }
  }
}