/**
 * Workflow Orchestration Adapter - SOLID Principles Compliant
 * Bridges the CLI CommandProcessor to the sophisticated CodeMindWorkflowOrchestrator
 * Implements the IRequestProcessor interface following Dependency Inversion Principle
 */
import { IRequestProcessor, ProcessRequestResult } from '../../core/interfaces/orchestrator-interfaces';
export declare class WorkflowOrchestrationAdapter implements IRequestProcessor {
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
//# sourceMappingURL=workflow-orchestration-adapter.d.ts.map