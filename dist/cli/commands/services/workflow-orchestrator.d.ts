/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind Core Cycle workflow
 *
 * This orchestrator manages the 12-step workflow with Context-Aware Clarification:
 * 1. Query Analysis - Analyze user input for assumptions and ambiguities
 * 2. Task Decomposition - Split complex queries into focused sub-tasks
 * 3. Semantic Search - Find relevant files using PostgreSQL pgvector + FTS
 * 4. Code Relationship Analysis - Map relationships using knowledge graph
 * 5. Context-Aware Clarification - Ask targeted questions based on research results
 * 6. Sub-Task Context Generation - Build tailored context per sub-task
 * 7. Enhanced Context Building - Build optimized prompt for Claude
 * 8. Claude Code Execution - Execute sub-tasks or full query with context
 * 9. File Modification Approval - Confirm changes before applying
 * 10. Build/Test Verification - Ensure code compiles and tests pass
 * 11. Database Sync - Update semantic search and knowledge graph
 */
import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { EnhancedContext } from './context-builder';
import { ClaudeResponse } from './user-interaction-service';
import { DecompositionResult, SubTaskContext } from './task-decomposition-service';
import { ClarificationResult } from './context-aware-clarification-service';
export interface WorkflowResult {
    success: boolean;
    queryAnalysis: QueryAnalysis;
    decomposition?: DecompositionResult;
    clarificationResult?: ClarificationResult;
    subTaskContexts?: SubTaskContext[];
    semanticResults: SemanticResult[];
    graphContext: GraphContext;
    enhancedContext: EnhancedContext;
    claudeResponse?: ClaudeResponse;
    buildResult?: BuildTestResult;
    syncResult?: SyncResult;
    error?: string;
}
export interface BuildTestResult {
    buildSuccess: boolean;
    testSuccess: boolean;
    buildOutput?: string;
    testOutput?: string;
    buildError?: string;
    testError?: string;
}
export interface SyncResult {
    filesUpdated: number;
    graphNodesCreated: number;
    cacheUpdated: number;
}
export interface WorkflowOptions {
    skipUserClarification?: boolean;
    skipFileConfirmation?: boolean;
    skipBuildTest?: boolean;
    skipDatabaseSync?: boolean;
    maxSemanticResults?: number;
    semanticThreshold?: number;
    projectId?: string;
    transparentMode?: boolean;
}
export declare class WorkflowOrchestrator {
    private _nlpProcessor?;
    private _searchOrchestrator?;
    private _graphAnalysisService?;
    private _contextBuilder?;
    private _userInteractionService?;
    private _taskDecompositionService?;
    private _clarificationService?;
    private _databaseUpdateManager?;
    private _dbConnections?;
    private projectPath;
    private projectId;
    private _readlineInterface?;
    private get nlpProcessor();
    private get searchOrchestrator();
    private get graphAnalysisService();
    private get contextBuilder();
    private get userInteractionService();
    private get taskDecompositionService();
    private get clarificationService();
    private get dbConnections();
    private get databaseUpdateManager();
    constructor(projectPath: string, projectId?: string);
    /**
     * Set readline interface for user interactions
     */
    setReadlineInterface(rl: any): void;
    /**
     * Set project context
     */
    setProject(projectId: string, projectPath: string): void;
    /**
     * Check database health and provide setup guidance if unavailable
     */
    private checkDatabaseHealth;
    /**
     * Display database setup guidance
     */
    private displayDatabaseSetupGuidance;
    /**
     * Execute the complete CodeMind Core Cycle workflow
     */
    executeWorkflow(query: string, projectPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
    /**
     * Confirm task execution with user
     * Shows detailed task breakdown and allows user to proceed, modify, or cancel
     */
    private confirmTaskExecution;
    /**
     * Get complexity badge
     */
    private getComplexityBadge;
    /**
     * Run build only
     */
    private runBuild;
    /**
     * Run tests only
     */
    private runTests;
    /**
     * Verify build and run tests (legacy method - kept for compatibility)
     * @deprecated Use runBuild and runTests separately with the new workflow
     */
    private _verifyBuildAndTests;
    /**
     * Sync modified files to all databases
     */
    private syncDatabases;
    /**
     * Display context summary - shows what CodeMind found
     * Uses enhanced formatting to highlight important information
     */
    private displayContextSummary;
    /**
     * Check if input is suitable for the full workflow
     */
    shouldUseWorkflow(input: string): boolean;
    /**
     * Get workflow statistics for monitoring
     */
    getWorkflowStats(result: WorkflowResult): {
        stepsCompleted: number;
        totalSteps: number;
        filesAnalyzed: number;
        relationshipsFound: number;
        assumptionsDetected: number;
        executionTime?: number;
    };
    /**
     * Display task preview at the beginning of the workflow
     * Shows users what CodeMind will do based on query analysis and decomposition
     */
    private displayTaskPreview;
    /**
     * Get icon for intent type
     */
    private getIntentIcon;
    /**
     * Format intent as human-readable label
     */
    private formatIntentLabel;
    /**
     * Format confidence as visual indicator
     */
    private formatConfidenceLabel;
    /**
     * Generate human-readable task description based on analysis
     */
    private generateTaskDescription;
    /**
     * Log query analysis results from Claude-based analysis
     */
    private logQueryAnalysis;
    /**
     * Create empty graph context for error cases
     */
    private createEmptyGraphContext;
    /**
     * Create empty enhanced context for error cases
     */
    private createEmptyEnhancedContext;
    /**
     * Apply context filter to semantic results
     */
    private applyContextFilter;
    /**
     * Deduplicate semantic results by file path
     */
    private deduplicateSemanticResults;
    /**
     * Deduplicate classes by name
     */
    private deduplicateClasses;
    /**
     * Deduplicate relationships
     */
    private deduplicateRelationships;
    /**
     * Factory method for dependency injection
     */
    static create(projectPath?: string, projectId?: string): WorkflowOrchestrator;
    /**
     * Validate that all required services are properly initialized
     */
    validateServices(): boolean;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=workflow-orchestrator.d.ts.map