import { ExternalToolManager, ToolRecommendation } from '../services/managers/external-tool-manager';
import { WorkflowToolIntegrator } from './workflow-tool-integrator';
import { Database } from '../database/database';
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
export declare class ClaudeToolIntegration {
    private logger;
    private toolManager;
    private workflowIntegrator;
    private db;
    private pendingPrompts;
    constructor(toolManager: ExternalToolManager, workflowIntegrator: WorkflowToolIntegrator, database: Database);
    private handleWorkflowToolEvent;
    private generatePermissionPrompt;
    private generateRecommendationPrompt;
    private notifyInstallationSuccess;
    private sendPromptToClaudeCode;
    handleUserResponse(promptId: string, response: UserResponse): Promise<void>;
    private processApproval;
    private processDenial;
    private showToolDetails;
    private logUserDecision;
    private getToolById;
    getPendingPrompts(): Map<string, ClaudeToolPrompt>;
    clearPendingPrompts(): void;
    getUrgentRecommendations(projectPath: string): Promise<ToolRecommendation[]>;
}
//# sourceMappingURL=claude-tool-integration.d.ts.map