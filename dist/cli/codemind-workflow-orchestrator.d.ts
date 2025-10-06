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
    primaryDomains: string[];
    timeEstimate: number;
    confidence: number;
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
        errors: any[];
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
    issues?: string[];
    analysisDetails?: {
        linting: {
            penalty: number;
            issues: string[];
        };
        security: {
            penalty: number;
            issues: string[];
        };
        dependencies: {
            penalty: number;
            issues: string[];
        };
        complexity: {
            penalty: number;
            issues: string[];
        };
        testing: {
            penalty: number;
            issues: string[];
            results: any;
        };
        taskExecution: {
            penalty: number;
            issues: string[];
        };
    };
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
    };
    summary: string;
}
export declare class CodeMindWorkflowOrchestrator {
    private logger;
    private semanticEngine;
    private claudeIntegration;
    private taskDecomposer;
    private taskExecutor;
    private qualityChecker;
    private gitManager;
    private databaseUpdater;
    private projectId;
    constructor(projectId: string);
    /**
     * MAIN WORKFLOW: Execute complete feature request workflow
     * This is the single entry point that orchestrates everything
     */
    executeFeatureRequest(request: UserFeatureRequest): Promise<WorkflowResult>;
    private analyzeIntentAndSelectTools;
    private mapComplexity;
    private estimateFiles;
    private suggestTools;
    private assessRisk;
    private estimateTime;
    private gatherSemanticContext;
    private createFeatureBranch;
    private splitIntoSubTasks;
    private selectRelevantFiles;
    private calculateTaskDependencies;
    private estimateTaskTime;
    private processAllSubTasks;
    private buildTaskContext;
    private needsClaudeCodeExecution;
    private executeTaskWithClaude;
    private buildClaudePrompt;
    private extractModifiedFiles;
    private runQualityChecks;
    private finalizeChanges;
    private updateAllDatabases;
    private rollbackChanges;
    private calculateDatabaseUpdates;
}
export default CodeMindWorkflowOrchestrator;
//# sourceMappingURL=codemind-workflow-orchestrator.d.ts.map