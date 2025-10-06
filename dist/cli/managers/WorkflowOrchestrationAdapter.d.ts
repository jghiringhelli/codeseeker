/**
 * Workflow Orchestration Adapter
 * Bridges the CLI CommandProcessor to the sophisticated CodeMindWorkflowOrchestrator
 * Implements the expected ClaudeCodeOrchestrator interface while delegating to the full workflow
 */
export interface ProcessRequestResult {
    success: boolean;
    data?: any;
    error?: string;
}
export declare class WorkflowOrchestrationAdapter {
    private workflowOrchestrator;
    private logger;
    constructor(projectId?: string, projectPath?: string);
    /**
     * Process user request through full CodeMind workflow
     * This is the main method called by CommandProcessor
     */
    processRequest(query: string, projectPath: string): Promise<ProcessRequestResult>;
    /**
     * Simplified project analysis for /init command
     */
    analyzeProject(projectPath: string, resumeToken?: string): Promise<any>;
    private extractProjectId;
    private convertWorkflowResult;
}
export default WorkflowOrchestrationAdapter;
//# sourceMappingURL=WorkflowOrchestrationAdapter.d.ts.map