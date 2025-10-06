/**
 * Sequential Workflow Orchestrator - Graph-based role coordination
 *
 * Manages complex analysis workflows by coordinating role-based terminals
 * in sequential order based on dependency graphs. Each role processes
 * and enriches context before passing to the next logical role.
 */
export interface WorkflowGraph {
    id: string;
    name: string;
    description: string;
    roles: WorkflowRole[];
    edges: WorkflowEdge[];
    estimatedDuration: number;
    estimatedTokens: number;
}
export interface WorkflowRole {
    id: string;
    name: string;
    description: string;
    expertise: string[];
    tools: string[];
    contextRequirements: string[];
    outputFormat: string;
}
export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: string;
    contextMapping: ContextMapping;
}
export interface ContextMapping {
    pass: string[];
    transform: string[];
    focus: string[];
}
export interface OrchestrationRequest {
    query: string;
    projectPath: string;
    requestedBy: string;
    options?: {
        priority?: 'high' | 'normal';
        timeoutMinutes?: number;
        maxRetries?: number;
    };
}
export interface OrchestrationResult {
    orchestrationId: string;
    workflowGraph: WorkflowGraph;
    status: 'initiated' | 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    finalResult?: any;
    error?: string;
}
export declare class SequentialWorkflowOrchestrator {
    private redis;
    private db;
    private logger;
    private activeOrchestrations;
    constructor();
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Start a sequential workflow orchestration
     */
    orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult>;
    /**
     * Execute the sequential workflow
     */
    private executeWorkflow;
    /**
     * Monitor workflow for completion
     */
    private monitorWorkflowCompletion;
    /**
     * Handle workflow completion
     */
    private handleWorkflowComplete;
    /**
     * Handle workflow error
     */
    private handleWorkflowError;
    /**
     * Build workflow graph based on query analysis
     */
    private buildWorkflowGraph;
    /**
     * Analyze query complexity (simplified version of tool selector logic)
     */
    private analyzeQueryComplexity;
    private countComplexityKeywords;
    private assessQueryScope;
    private identifyDomains;
    /**
     * Create role definitions
     */
    private createArchitectRole;
    private createSecurityRole;
    private createQualityRole;
    private createPerformanceRole;
    private createCoordinatorRole;
    /**
     * Build sequential edges between roles
     */
    private buildSequentialEdges;
    /**
     * Get orchestration status
     */
    getOrchestrationStatus(orchestrationId: string): Promise<OrchestrationResult | null>;
    /**
     * Get all active orchestrations
     */
    getActiveOrchestrations(): Promise<OrchestrationResult[]>;
    /**
     * Stop an orchestration
     */
    stopOrchestration(orchestrationId: string): Promise<{
        terminatedRoles: string[];
    }>;
    private generateWorkflowName;
    private estimateWorkflowDuration;
    private estimateWorkflowTokens;
    private storeOrchestration;
    private updateOrchestrationResult;
}
export default SequentialWorkflowOrchestrator;
//# sourceMappingURL=sequential-workflow-orchestrator.d.ts.map