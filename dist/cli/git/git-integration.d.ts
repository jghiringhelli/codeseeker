/**
 * Git Integration - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 1006 lines to ~150 lines using service extraction
 */
import { IGitOperationsService, IGitAnalysisService, IGitDatabaseService, IGitAutoCommitService, GitCommitInfo, GitDiffResult, ChangeSignificance, CommitAnalysis, AutoCommitRules } from './interfaces';
/**
 * Main Git Integration Coordinator
 * Uses dependency injection for all Git operations
 */
export declare class GitIntegration {
    private gitOps?;
    private gitAnalysis?;
    private gitDatabase?;
    private gitAutoCommit?;
    private logger;
    private projectPath;
    constructor(projectPath?: string, gitOps?: IGitOperationsService, gitAnalysis?: IGitAnalysisService, gitDatabase?: IGitDatabaseService, gitAutoCommit?: IGitAutoCommitService);
    getCurrentCommit(): Promise<GitCommitInfo | null>;
    getCommitsSince(since: string): Promise<GitCommitInfo[]>;
    getDiffBetweenCommits(from: string, to?: string): Promise<GitDiffResult[]>;
    getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]>;
    getStagedFiles(projectPath: string): Promise<string[]>;
    isGitRepository(): Promise<boolean>;
    analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance>;
    analyzeCommitRange(projectPath: string, from: string, to: string): Promise<any>;
    compilesSuccessfully(): Promise<boolean>;
    recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted?: boolean): Promise<void>;
    updateDatabaseFromGitHistory(): Promise<void>;
    getCommitHistory(limit?: number): Promise<CommitAnalysis[]>;
    getIntegrationStatus(projectPath: string): Promise<any>;
    performAutoCommit(significance: ChangeSignificance): Promise<boolean>;
    configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void>;
    startAutoCommitWatcher(): Promise<void>;
    stopAutoCommitWatcher(): Promise<void>;
    /**
     * Complete workflow: analyze changes and optionally auto-commit
     */
    processChanges(): Promise<{
        diff: GitDiffResult[];
        significance: ChangeSignificance;
        committed: boolean;
    }>;
    /**
     * Initialize Git integration for project
     */
    initialize(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=git-integration.d.ts.map