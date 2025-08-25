export interface GitWorkflowOptions {
    projectPath: string;
    branchPrefix?: string;
    createCommit?: boolean;
    runTests?: boolean;
    requireUserApproval?: boolean;
}
export interface GitWorkflowResult {
    initialCommit?: string;
    branchName: string;
    testResults?: TestResults;
    userApproved: boolean;
    finalCommit?: string;
}
export interface TestResults {
    success: boolean;
    output: string;
    exitCode: number;
    duration: number;
    testCommand: string;
}
export declare class GitWorkflowManager {
    private logger;
    constructor();
    manageWorkflow(options: GitWorkflowOptions): Promise<GitWorkflowResult>;
    finalizeWorkflow(projectPath: string, branchName: string, approved: boolean, commitMessage?: string): Promise<string | null>;
    private ensureGitRepository;
    private hasUncommittedChanges;
    private createInitialCommit;
    private createImprovementBranch;
    private runTests;
    private detectTestCommand;
    private commitImprovements;
    private generateCommitMessage;
    private getCurrentBranch;
    private revertToOriginalBranch;
    getGitStatus(projectPath: string): Promise<{
        isGitRepo: boolean;
        currentBranch: string;
        hasChanges: boolean;
        lastCommit?: string;
    }>;
}
//# sourceMappingURL=git-workflow-manager.d.ts.map