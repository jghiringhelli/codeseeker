/**
 * Git Branch Manager
 *
 * Manages feature branches, snapshots, and rollback capabilities for CodeMind
 * Each request gets its own branch with snapshot points for safe rollbacks
 */
export interface BranchSnapshot {
    branchName: string;
    commitHash: string;
    timestamp: Date;
    description: string;
    validationPassed: boolean;
    files: string[];
}
export interface FeatureBranch {
    branchName: string;
    userRequest: string;
    created: Date;
    snapshots: BranchSnapshot[];
    status: 'active' | 'completed' | 'failed' | 'merged' | 'abandoned';
    parentBranch: string;
}
export interface RollbackOptions {
    type: 'complete' | 'partial' | 'selective';
    targetSnapshot?: string;
    filesToKeep?: string[];
    createBackupBranch?: boolean;
}
export declare class GitBranchManager {
    private logger;
    private activeBranches;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Create a new feature branch for a request
     */
    createFeatureBranch(userRequest: string, requestId?: string): Promise<FeatureBranch>;
    /**
     * Create a snapshot at current state
     */
    createSnapshot(branchName: string, description: string, validationPassed: boolean, changedFiles: string[]): Promise<BranchSnapshot>;
    /**
     * Perform intelligent rollback based on validation results
     */
    performRollback(branchName: string, options: RollbackOptions): Promise<{
        success: boolean;
        message: string;
        restoredFiles: string[];
    }>;
    /**
     * Cherry-pick successful changes from validation cycles
     */
    cherryPickChanges(sourceBranch: string, targetBranch: string, commitHashes: string[]): Promise<{
        success: boolean;
        pickedCommits: string[];
    }>;
    /**
     * Merge feature branch back to main after successful validation
     */
    mergeFeatureBranch(branchName: string, squashCommits?: boolean): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Clean up old branches periodically
     */
    cleanupBranches(maxAge?: number, // days
    keepMerged?: boolean): Promise<{
        cleaned: string[];
        kept: string[];
    }>;
    /**
     * Get status of all active branches
     */
    getBranchStatus(): Promise<FeatureBranch[]>;
    /**
     * Get detailed information about a specific branch
     */
    getBranchInfo(branchName: string): Promise<FeatureBranch | null>;
    private performCompleteRollback;
    private performPartialRollback;
    private performSelectiveRollback;
    private generateBranchName;
    private generateCommitMessage;
    private execGit;
    private getCurrentBranch;
    private ensureCleanWorkingDirectory;
    private getParentBranchCommit;
    private getAllChangedFiles;
    private getChangedFilesBetweenCommits;
}
export default GitBranchManager;
//# sourceMappingURL=git-branch-manager.d.ts.map