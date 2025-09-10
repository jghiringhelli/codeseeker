import { ExternalToolManager, ToolRecommendation } from './external-tool-manager';
import { Database } from '../database/database';
import { RoleType } from './types';
export interface ToolExecutionContext {
    workflowId: string;
    roleType: RoleType;
    projectPath: string;
    stepNumber: number;
    purpose: string;
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
export declare class WorkflowToolIntegrator {
    private logger;
    private toolManager;
    private db;
    private eventListeners;
    constructor(toolManager: ExternalToolManager, database: Database);
    /**
     * Called when a role starts execution - proactively recommends tools
     */
    onRoleStart(context: ToolExecutionContext): Promise<ToolRecommendation[]>;
    /**
     * Execute a tool within a role context
     */
    executeTool(toolId: string, args: string[], context: ToolExecutionContext): Promise<ToolExecutionResult>;
    /**
     * Handle tool installation with user permission flow
     */
    private handleToolInstallation;
    /**
     * Request user permission for tool installation
     */
    private requestUserPermission;
    /**
     * Filter recommendations by timing context
     */
    private filterRecommendationsByTiming;
    /**
     * Handle auto-installations for approved tools
     */
    private handleAutoInstallations;
    /**
     * Check role-tool permission status
     */
    private checkRoleToolPermission;
    /**
     * Get tool approval history for user decisions
     */
    private getToolApprovalHistory;
    /**
     * Log tool recommendations for analytics
     */
    private logToolRecommendations;
    /**
     * Log tool execution for analytics
     */
    private logToolExecution;
    /**
     * Event system for monitoring and external integration
     */
    addEventListener(listener: (event: WorkflowToolEvent) => void): void;
    removeEventListener(listener: (event: WorkflowToolEvent) => void): void;
    private emitEvent;
    /**
     * Get available tools for a role in current context
     */
    getAvailableTools(context: ToolExecutionContext): Promise<string[]>;
    /**
     * Pre-install recommended tools during workflow initialization
     */
    preInstallWorkflowTools(projectPath: string, workflowId: string, roles: RoleType[]): Promise<{
        installed: string[];
        failed: string[];
        pending: string[];
    }>;
}
//# sourceMappingURL=workflow-tool-integrator.d.ts.map