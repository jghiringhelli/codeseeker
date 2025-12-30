/**
 * Git Integration - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 1006 lines to ~150 lines using service extraction
 */

import { Logger } from '../../utils/logger';
import {
  IGitOperationsService,
  IGitAnalysisService,
  IGitDatabaseService,
  IGitAutoCommitService,
  GitCommitInfo,
  GitDiffResult,
  ChangeSignificance,
  CommitAnalysis,
  AutoCommitRules
} from './interfaces';
import { GitOperationsService } from './services/git-operations-service';
import { GitAnalysisService } from './services/git-analysis-service';
import { GitDatabaseService } from './services/git-database-service';
import { GitAutoCommitService } from './services/git-autocommit-service';

/**
 * Main Git Integration Coordinator
 * Uses dependency injection for all Git operations
 */
export class GitIntegration {
  private logger = Logger.getInstance();
  private projectPath: string;

  constructor(
    projectPath?: string,
    private gitOps?: IGitOperationsService,
    private gitAnalysis?: IGitAnalysisService,
    private gitDatabase?: IGitDatabaseService,
    private gitAutoCommit?: IGitAutoCommitService
  ) {
    this.projectPath = projectPath || process.cwd();

    // Initialize services with dependency injection
    this.gitOps = this.gitOps || new GitOperationsService(this.projectPath);
    this.gitAnalysis = this.gitAnalysis || new GitAnalysisService(this.projectPath);
    this.gitDatabase = this.gitDatabase || new GitDatabaseService();
    this.gitAutoCommit = this.gitAutoCommit || new GitAutoCommitService(this.projectPath);
  }

  // === GIT OPERATIONS DELEGATION ===

  async getCurrentCommit(): Promise<GitCommitInfo | null> {
    return await this.gitOps!.getCurrentCommit();
  }

  async getCommitsSince(since: string): Promise<GitCommitInfo[]> {
    return await this.gitOps!.getCommitsSince(since);
  }

  async getDiffBetweenCommits(from: string, to: string = 'HEAD'): Promise<GitDiffResult[]> {
    return await this.gitOps!.getDiffBetweenCommits(from, to);
  }

  async getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]> {
    return await this.gitOps!.getWorkingDirectoryDiff(projectPath);
  }

  async getStagedFiles(projectPath: string): Promise<string[]> {
    return await this.gitOps!.getStagedFiles(projectPath);
  }

  async isGitRepository(): Promise<boolean> {
    return await this.gitOps!.isGitRepository();
  }

  // === GIT ANALYSIS DELEGATION ===

  async analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance> {
    return await this.gitAnalysis!.analyzeChangeSignificance(diff);
  }

  async analyzeCommitRange(projectPath: string, from: string, to: string): Promise<any> {
    return await this.gitAnalysis!.analyzeCommitRange(projectPath, from, to);
  }

  async compilesSuccessfully(): Promise<boolean> {
    return await this.gitAnalysis!.compilesSuccessfully();
  }

  // === GIT DATABASE DELEGATION ===

  async recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted: boolean = false): Promise<void> {
    return await this.gitDatabase!.recordCommit(commit, significance, autoCommitted);
  }

  async updateDatabaseFromGitHistory(): Promise<void> {
    return await this.gitDatabase!.updateDatabaseFromGitHistory();
  }

  async getCommitHistory(limit: number = 20): Promise<CommitAnalysis[]> {
    return await this.gitDatabase!.getCommitHistory(limit);
  }

  async getIntegrationStatus(projectPath: string): Promise<any> {
    return await this.gitDatabase!.getIntegrationStatus(projectPath);
  }

  // === GIT AUTO-COMMIT DELEGATION ===

  async performAutoCommit(significance: ChangeSignificance): Promise<boolean> {
    return await this.gitAutoCommit!.performAutoCommit(significance);
  }

  async configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void> {
    return await this.gitAutoCommit!.configureAutoCommit(projectPath, rules);
  }

  async startAutoCommitWatcher(): Promise<void> {
    return await this.gitAutoCommit!.startAutoCommitWatcher();
  }

  async stopAutoCommitWatcher(): Promise<void> {
    return await this.gitAutoCommit!.stopAutoCommitWatcher();
  }

  // === CONVENIENCE METHODS ===

  /**
   * Complete workflow: analyze changes and optionally auto-commit
   */
  async processChanges(): Promise<{
    diff: GitDiffResult[];
    significance: ChangeSignificance;
    committed: boolean;
  }> {
    try {
      const diff = await this.getWorkingDirectoryDiff(this.projectPath);
      const significance = await this.analyzeChangeSignificance(diff);

      let committed = false;
      if (significance.shouldAutoCommit) {
        committed = await this.performAutoCommit(significance);

        if (committed) {
          const currentCommit = await this.getCurrentCommit();
          if (currentCommit) {
            await this.recordCommit(currentCommit, significance, true);
          }
        }
      }

      return { diff, significance, committed };
    } catch (error) {
      this.logger.error('Failed to process changes', error as Error);
      return {
        diff: [],
        significance: { score: 0, factors: [], shouldAutoCommit: false },
        committed: false
      };
    }
  }

  /**
   * Initialize Git integration for project
   */
  async initialize(): Promise<void> {
    try {
      const isRepo = await this.isGitRepository();
      if (!isRepo) {
        this.logger.warn('Not a Git repository, Git integration features disabled');
        return;
      }

      await this.updateDatabaseFromGitHistory();
      this.logger.info('Git integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Git integration', error as Error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.stopAutoCommitWatcher();
      this.logger.info('Git integration cleanup completed');
    } catch (error) {
      this.logger.error('Error during Git integration cleanup', error as Error);
    }
  }
}