#!/usr/bin/env node
/**
 * CodeMind Orchestrated CLI - Complete Impact-Driven Workflow
 *
 * Implements the full orchestration system:
 * 1. Comprehensive impact analysis (all affected files)
 * 2. Git branch-based workflow with snapshots
 * 3. Task-specific file instructions for Claude Code
 * 4. Intelligent rollback and recovery
 */
declare class CodeMindOrchestratedCLI {
    private orchestrator;
    private branchManager;
    private impactAnalyzer;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Main orchestrated request processing
     */
    processRequest(userRequest: string, options?: {
        force?: boolean;
        skipCycles?: boolean;
        dryRun?: boolean;
        autoRollback?: boolean;
        interactive?: boolean;
    }): Promise<string>;
    /**
     * Interactive mode - show impact and confirm before execution
     */
    processInteractiveRequest(userRequest: string): Promise<string>;
    /**
     * Branch management operations
     */
    manageBranches(action: 'list' | 'cleanup' | 'merge', branchName?: string): Promise<string>;
    /**
     * Show detailed status of orchestration system
     */
    showSystemStatus(): Promise<string>;
    private displayImpactSummary;
    private displayFileTasks;
    private convertImpactToTasks;
    private formatOrchestrationResults;
    private formatInteractivePreview;
    private formatBranchList;
    private formatCleanupResults;
    private formatMergeResults;
    private formatSystemStatus;
    private formatError;
    private getGitStatus;
    private checkSystemHealth;
}
export default CodeMindOrchestratedCLI;
//# sourceMappingURL=codemind-orchestrated.d.ts.map