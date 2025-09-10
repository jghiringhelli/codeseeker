/**
 * CodeMind Core Workflow Orchestrator
 *
 * This is the main brain of CodeMind CLI - a high-level class that orchestrates
 * the complete workflow from user request to final implementation with quality checks.
 *
 * Core Workflow Steps:
 * 1. Analyze user intent and select tools
 * 2. Execute semantic search and graph traversal
 * 3. Split request into manageable sub-tasks
 * 4. Process each sub-task with Claude + context
 * 5. Run comprehensive quality checks
 * 6. Manage git branches and safe deployment
 * 7. Update all databases with changes
 */
export interface UserFeatureRequest {
    query: string;
    userId?: string;
    projectId: string;
    timestamp: number;
}
export interface ProcessedIntent {
    intention: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedFiles: number;
    suggestedTools: string[];
    riskLevel: 'low' | 'medium' | 'high';
}
export interface SubTask {
    id: string;
    description: string;
    files: string[];
    dependencies: string[];
    estimatedTime: number;
    priority: number;
}
export interface QualityCheckResult {
    compilation: {
        success: boolean;
        errors: string[];
    };
    tests: {
        passed: number;
        failed: number;
        coverage: number;
    };
    codeQuality: {
        solidPrinciples: boolean;
        security: boolean;
        architecture: boolean;
    };
    overallScore: number;
}
export interface WorkflowResult {
    success: boolean;
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
            hashesUpdated: number;
        };
        postgres: {
            recordsUpdated: number;
        };
        mongodb: {
            documentsUpdated: number;
        };
    };
    summary: string;
}
export declare class CodeMindWorkflowOrchestrator {
    private logger;
    private semanticEngine;
    private intentAnalyzer;
    private toolSelector;
    private taskSplitter;
    private claudeProcessor;
    private qualityChecker;
    private gitManager;
    private databaseUpdater;
    constructor(projectId: string);
    /**
     * MAIN WORKFLOW: Execute complete feature request workflow
     * This is the single entry point that orchestrates everything
     */
    executeFeatureRequest(request: UserFeatureRequest): Promise<WorkflowResult>;
    private analyzeIntentAndSelectTools;
    private gatherSemanticContext;
    private createFeatureBranch;
    private splitIntoSubTasks;
    private processAllSubTasks;
    private runQualityChecks;
    private finalizeChanges;
    private updateAllDatabases;
    private rollbackChanges;
    private calculateDatabaseUpdates;
}
export default CodeMindWorkflowOrchestrator;
//# sourceMappingURL=codemind-workflow-orchestrator.d.ts.map