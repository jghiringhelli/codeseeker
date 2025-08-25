export interface GitCommitInfo {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: Date;
    changedFiles: string[];
    additions: number;
    deletions: number;
}
export interface GitDiffResult {
    file: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    linesAdded?: number;
    linesDeleted?: number;
    patch?: string;
    changes?: GitFileChange[];
}
export interface GitFileChange {
    type: 'added' | 'removed' | 'modified';
    lineNumber: number;
    content: string;
    context?: string;
}
export interface ChangeSignificance {
    score: number;
    factors: SignificanceFactor[];
    shouldAutoCommit: boolean;
    commitMessage?: string;
}
export interface SignificanceFactor {
    type: 'file_count' | 'line_changes' | 'new_features' | 'tests' | 'config' | 'dependencies';
    impact: number;
    description: string;
}
export interface CommitAnalysis {
    commit: GitCommitInfo;
    significance: ChangeSignificance;
    codeAnalysis?: {
        duplicationsChanged: number;
        dependenciesChanged: number;
        complexityDelta: number;
        newPatterns: string[];
    };
}
export declare class GitIntegration {
    private logger;
    private projectPath;
    private db;
    private changeDetector;
    private fileWatcher?;
    private autoCommitRules;
    constructor(projectPath?: string);
    private initializeDatabase;
    private createGitTables;
    private insertDefaultAutoCommitRules;
    getCurrentCommit(): Promise<GitCommitInfo | null>;
    getCommitsSince(since: string): Promise<GitCommitInfo[]>;
    getDiffBetweenCommits(from: string, to?: string): Promise<GitDiffResult[]>;
    private mapGitStatus;
    private getChangedFiles;
    private getCommitStats;
    private getFilePatch;
    private getFileChanges;
    analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance>;
    private generateCommitMessage;
    compilesSuccessfully(): Promise<boolean>;
    recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted?: boolean): Promise<void>;
    updateDatabaseFromGitHistory(): Promise<void>;
    startAutoCommitWatcher(): Promise<void>;
    getCommitHistory(limit?: number): Promise<CommitAnalysis[]>;
    getIntegrationStatus(projectPath: string): Promise<{
        isRepository: boolean;
        autoCommitEnabled: boolean;
        isTracking: boolean;
        recentCommits: Array<{
            hash: string;
            message: string;
            timestamp: Date;
        }>;
    }>;
    analyzeCommitRange(projectPath: string, from: string, to: string): Promise<{
        significanceScore: number;
        filesChanged: number;
        linesAdded: number;
        linesDeleted: number;
        newFeatures: string[];
    }>;
    configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void>;
    stopAutoCommitWatcher(): Promise<void>;
    private checkForAutoCommit;
    getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]>;
    private getWorkingFilePatch;
    getStagedFiles(projectPath: string): Promise<string[]>;
}
export default GitIntegration;
//# sourceMappingURL=git-integration.d.ts.map