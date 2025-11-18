/**
 * Task-Specific File Orchestrator
 *
 * Coordinates the complete workflow: Impact Analysis → Git Branching → File Updates → Validation → Rollback
 * Provides Claude Code with exact paths and specific tasks for each file to avoid extra work
 */
import { BranchSnapshot } from './managers/git-branch-manager';
import { IntegrationResult } from './post-execution-integration';
export interface FileTask {
    filePath: string;
    specificTask: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedComplexity: number;
    dependencies: string[];
    fileType: 'code' | 'config' | 'documentation' | 'test' | 'deployment' | 'static';
    changeType: 'update' | 'create' | 'delete' | 'rename';
    claudeInstructions: string;
    validationCriteria: string[];
}
export interface OrchestrationResult {
    success: boolean;
    branchName: string;
    completedTasks: FileTask[];
    failedTasks: FileTask[];
    validationResults: any;
    snapshots: BranchSnapshot[];
    rollbackPerformed?: boolean;
    integrationResult?: IntegrationResult;
    message: string;
    estimatedTimeActual: string;
    nextSteps: string[];
}
export declare class TaskSpecificFileOrchestrator {
    private logger;
    private impactAnalyzer;
    private branchManager;
    private validationCycle;
    private postExecutionIntegration;
    constructor(projectPath: string);
    /**
     * Main orchestration method - handles complete workflow
     */
    orchestrateRequest(projectPath: string, userRequest: string, options?: {
        skipCycles?: boolean;
        force?: boolean;
        dryRun?: boolean;
        autoRollback?: boolean;
    }): Promise<OrchestrationResult>;
    /**
     * Convert impact analysis to specific file tasks with Claude instructions
     */
    private convertToFileTasks;
    /**
     * Generate specific instructions for Claude Code
     */
    private generateClaudeInstructions;
    /**
     * Generate validation criteria for each file
     */
    private generateValidationCriteria;
    /**
     * Execute file tasks in dependency order
     */
    private executeFileTasks;
    /**
     * Execute a single file task (placeholder for Claude Code integration)
     */
    private executeFileTask;
    /**
     * Run pre-execution validation
     */
    private runPreExecutionValidation;
    /**
     * Run post-execution validation
     */
    private runPostExecutionValidation;
    /**
     * Perform intelligent rollback based on what succeeded/failed
     */
    private performIntelligentRollback;
    /**
     * Sort tasks by priority and dependencies
     */
    private sortTasksByPriorityAndDependencies;
    /**
     * Handle validation failure
     */
    private handleValidationFailure;
    /**
     * Generate success message
     */
    private generateSuccessMessage;
    /**
     * Generate next steps based on results
     */
    private generateNextSteps;
    /**
     * Calculate actual execution time
     */
    private calculateActualTime;
    /**
     * Generate project ID from path
     */
    private generateProjectId;
}
export default TaskSpecificFileOrchestrator;
//# sourceMappingURL=task-specific-file-orchestrator.d.ts.map