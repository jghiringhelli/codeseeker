/**
 * Git Branch Manager - Real implementation for safe development workflow
 * Creates feature branches, manages commits, and handles rollback scenarios
 */
export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    modified: string[];
    untracked: string[];
    staged: string[];
}
export interface CommitResult {
    hash: string;
    message: string;
    filesChanged: number;
}
export declare class GitBranchManager {
    private logger;
    private projectPath;
    constructor(projectPath?: string);
    /**
     * Create a new feature branch for safe development
     */
    createFeatureBranch(workflowId: string, description: string): Promise<string>;
    /**
     * Commit changes with descriptive message
     */
    commitChanges(message: string, files?: string[]): Promise<CommitResult>;
    /**
     * Commit and merge feature branch to main if quality checks pass
     */
    commitAndMerge(branchName: string, finalMessage: string): Promise<void>;
    /**
     * Rollback branch if quality checks fail
     */
    rollbackBranch(branchName: string): Promise<void>;
    /**
     * Get current git status
     */
    getGitStatus(): Promise<GitStatus>;
    private ensureGitRepo;
    private getMainBranch;
    private stashUncommittedChanges;
}
export default GitBranchManager;
//# sourceMappingURL=git-branch-manager.d.ts.map