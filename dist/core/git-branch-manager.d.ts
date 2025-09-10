/**
 * Git Branch Manager - Safe git operations for feature development
 * Manages branch creation, commits, merges, and rollbacks for CodeMind workflow
 */
export interface GitBranchInfo {
    name: string;
    workflowId: string;
    description: string;
    createdAt: string;
    filesModified: string[];
    commits: GitCommitInfo[];
}
export interface GitCommitInfo {
    hash: string;
    message: string;
    timestamp: string;
    author: string;
    filesChanged: string[];
}
export interface GitOperationResult {
    success: boolean;
    message: string;
    output?: string;
    error?: string;
}
export interface BranchMergeResult {
    success: boolean;
    branch: string;
    targetBranch: string;
    commitHash?: string;
    conflictFiles?: string[];
    message: string;
}
export declare class GitBranchManager {
    private logger;
    private projectRoot;
    private defaultBaseBranch;
    constructor(projectRoot?: string);
    createFeatureBranch(workflowId: string, description: string): Promise<string>;
    commitAndMerge(branchName: string, message: string): Promise<BranchMergeResult>;
    rollbackBranch(branchName: string): Promise<GitOperationResult>;
    getBranchInfo(branchName: string): Promise<GitBranchInfo | null>;
    listActiveFeatureBranches(): Promise<GitBranchInfo[]>;
    private ensureGitRepository;
    private determineBaseBranch;
    private branchExists;
    private switchToBaseBranch;
    private switchToBranch;
    private pullLatestChanges;
    private ensureCleanWorkingDirectory;
    private hasUncommittedChanges;
    private generateBranchName;
    private stageAllChanges;
    private commitChanges;
    private mergeBranch;
    private deleteFeatureBranch;
    private executeGitCommand;
}
export default GitBranchManager;
//# sourceMappingURL=git-branch-manager.d.ts.map