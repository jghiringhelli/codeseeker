/**
 * Orchestrator interfaces following Interface Segregation Principle
 * Each interface has a single, focused responsibility for workflow orchestration
 */
export interface UserFeatureRequest {
    query: string;
    projectId: string;
    timestamp: number;
    userId: string;
    context?: any;
}
export interface WorkflowResult {
    success: boolean;
    summary: string;
    filesModified: string[];
    qualityScore: number;
    gitBranch: string;
    databases: {
        neo4j: {
            nodesCreated: number;
            relationshipsCreated: number;
        };
        redis: {
            filesUpdated: number;
        };
        postgres: {
            recordsUpdated: number;
        };
    };
    error?: string;
}
export interface ProcessRequestResult {
    success: boolean;
    data?: any;
    error?: string;
}
export interface IWorkflowOrchestrator {
    executeFeatureRequest(request: UserFeatureRequest): Promise<WorkflowResult>;
    getWorkflowStatus(workflowId: string): Promise<any>;
    cancelWorkflow(workflowId: string): Promise<void>;
}
export interface IRequestProcessor {
    processRequest?(query: string, projectPath: string): Promise<ProcessRequestResult>;
    analyzeProject?(projectPath: string, resumeToken?: string): Promise<any>;
    performSemanticSearch?(query: string, projectPath: string): Promise<any>;
    [key: string]: any;
}
export interface IProjectAnalyzer {
    analyzeProjectStructure(projectPath: string): Promise<any>;
    detectProjectType(projectPath: string): Promise<string>;
    scanDependencies(projectPath: string): Promise<any>;
}
export interface IQualityChecker {
    checkCodeQuality(projectPath: string): Promise<{
        score: number;
        issues: string[];
        recommendations: string[];
    }>;
    runLinting(projectPath: string): Promise<any>;
    checkTestCoverage(projectPath: string): Promise<any>;
}
//# sourceMappingURL=orchestrator-interfaces.d.ts.map