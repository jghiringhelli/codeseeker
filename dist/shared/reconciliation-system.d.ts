/**
 * Reconciliation System for Codebase Changes
 *
 * Handles scenarios where:
 * 1. Branches are merged and database is out of sync
 * 2. End-of-request updates are not catching up with codebase changes
 * 3. Manual reconciliation is needed to sync database with actual codebase state
 */
export interface ReconciliationRequest {
    projectPath: string;
    projectId: string;
    scope: 'full' | 'incremental' | 'selective';
    targetTools?: string[];
    sinceTimestamp?: Date;
    dryRun?: boolean;
}
export interface ReconciliationResult {
    projectId: string;
    scope: string;
    startTime: Date;
    endTime: Date;
    summary: {
        filesScanned: number;
        toolsProcessed: number;
        discrepancies: number;
        updatesApplied: number;
        errorsEncountered: number;
    };
    details: ReconciliationDetail[];
    dryRun: boolean;
}
export interface ReconciliationDetail {
    toolName: string;
    action: 'created' | 'updated' | 'deleted' | 'skipped' | 'error';
    fileName?: string;
    reason: string;
    oldHash?: string;
    newHash?: string;
    recordsAffected: number;
}
export interface FileChecksum {
    filePath: string;
    hash: string;
    lastModified: Date;
    size: number;
}
export declare class ReconciliationSystem {
    private logger;
    constructor();
    /**
     * Main reconciliation entry point
     */
    reconcile(request: ReconciliationRequest): Promise<ReconciliationResult>;
    /**
     * Analyze current codebase state
     */
    private analyzeCodebaseState;
    /**
     * Get current database state for tools
     */
    private getDatabaseState;
    /**
     * Detect discrepancies between codebase and database
     */
    private detectDiscrepancies;
    /**
     * Plan reconciliation actions based on discrepancies
     */
    private planReconciliationActions;
    /**
     * Apply reconciliation actions
     */
    private applyReconciliationActions;
    /**
     * Reanalyze specific file/project with a tool
     */
    private reanalyzeWithTool;
    /**
     * Delete orphaned data from database
     */
    private deleteOrphanedData;
    /**
     * Update tool data for specific file
     */
    private updateToolData;
}
/**
 * Convenience functions for common reconciliation scenarios
 */
export declare class ReconciliationHelpers {
    private static reconciler;
    /**
     * Full project reconciliation (after major changes like merges)
     */
    static fullReconciliation(projectPath: string, projectId: string, dryRun?: boolean): Promise<ReconciliationResult>;
    /**
     * Quick incremental reconciliation (for recent changes)
     */
    static incrementalReconciliation(projectPath: string, projectId: string, sinceHours?: number, dryRun?: boolean): Promise<ReconciliationResult>;
    /**
     * Selective reconciliation (specific tools only)
     */
    static selectiveReconciliation(projectPath: string, projectId: string, targetTools: string[], dryRun?: boolean): Promise<ReconciliationResult>;
}
//# sourceMappingURL=reconciliation-system.d.ts.map