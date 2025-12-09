"use strict";
/**
 * Git Integration - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 1006 lines to ~150 lines using service extraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitIntegration = void 0;
const logger_1 = require("../../utils/logger");
const git_operations_service_1 = require("./services/git-operations-service");
const git_analysis_service_1 = require("./services/git-analysis-service");
const git_database_service_1 = require("./services/git-database-service");
const git_autocommit_service_1 = require("./services/git-autocommit-service");
/**
 * Main Git Integration Coordinator
 * Uses dependency injection for all Git operations
 */
class GitIntegration {
    gitOps;
    gitAnalysis;
    gitDatabase;
    gitAutoCommit;
    logger = logger_1.Logger.getInstance();
    projectPath;
    constructor(projectPath, gitOps, gitAnalysis, gitDatabase, gitAutoCommit) {
        this.gitOps = gitOps;
        this.gitAnalysis = gitAnalysis;
        this.gitDatabase = gitDatabase;
        this.gitAutoCommit = gitAutoCommit;
        this.projectPath = projectPath || process.cwd();
        // Initialize services with dependency injection
        this.gitOps = this.gitOps || new git_operations_service_1.GitOperationsService(this.projectPath);
        this.gitAnalysis = this.gitAnalysis || new git_analysis_service_1.GitAnalysisService(this.projectPath);
        this.gitDatabase = this.gitDatabase || new git_database_service_1.GitDatabaseService();
        this.gitAutoCommit = this.gitAutoCommit || new git_autocommit_service_1.GitAutoCommitService(this.projectPath);
    }
    // === GIT OPERATIONS DELEGATION ===
    async getCurrentCommit() {
        return await this.gitOps.getCurrentCommit();
    }
    async getCommitsSince(since) {
        return await this.gitOps.getCommitsSince(since);
    }
    async getDiffBetweenCommits(from, to = 'HEAD') {
        return await this.gitOps.getDiffBetweenCommits(from, to);
    }
    async getWorkingDirectoryDiff(projectPath) {
        return await this.gitOps.getWorkingDirectoryDiff(projectPath);
    }
    async getStagedFiles(projectPath) {
        return await this.gitOps.getStagedFiles(projectPath);
    }
    async isGitRepository() {
        return await this.gitOps.isGitRepository();
    }
    // === GIT ANALYSIS DELEGATION ===
    async analyzeChangeSignificance(diff) {
        return await this.gitAnalysis.analyzeChangeSignificance(diff);
    }
    async analyzeCommitRange(projectPath, from, to) {
        return await this.gitAnalysis.analyzeCommitRange(projectPath, from, to);
    }
    async compilesSuccessfully() {
        return await this.gitAnalysis.compilesSuccessfully();
    }
    // === GIT DATABASE DELEGATION ===
    async recordCommit(commit, significance, autoCommitted = false) {
        return await this.gitDatabase.recordCommit(commit, significance, autoCommitted);
    }
    async updateDatabaseFromGitHistory() {
        return await this.gitDatabase.updateDatabaseFromGitHistory();
    }
    async getCommitHistory(limit = 20) {
        return await this.gitDatabase.getCommitHistory(limit);
    }
    async getIntegrationStatus(projectPath) {
        return await this.gitDatabase.getIntegrationStatus(projectPath);
    }
    // === GIT AUTO-COMMIT DELEGATION ===
    async performAutoCommit(significance) {
        return await this.gitAutoCommit.performAutoCommit(significance);
    }
    async configureAutoCommit(projectPath, rules) {
        return await this.gitAutoCommit.configureAutoCommit(projectPath, rules);
    }
    async startAutoCommitWatcher() {
        return await this.gitAutoCommit.startAutoCommitWatcher();
    }
    async stopAutoCommitWatcher() {
        return await this.gitAutoCommit.stopAutoCommitWatcher();
    }
    // === CONVENIENCE METHODS ===
    /**
     * Complete workflow: analyze changes and optionally auto-commit
     */
    async processChanges() {
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
        }
        catch (error) {
            this.logger.error('Failed to process changes', error);
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
    async initialize() {
        try {
            const isRepo = await this.isGitRepository();
            if (!isRepo) {
                this.logger.warn('Not a Git repository, Git integration features disabled');
                return;
            }
            await this.updateDatabaseFromGitHistory();
            this.logger.info('Git integration initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize Git integration', error);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.stopAutoCommitWatcher();
            this.logger.info('Git integration cleanup completed');
        }
        catch (error) {
            this.logger.error('Error during Git integration cleanup', error);
        }
    }
}
exports.GitIntegration = GitIntegration;
//# sourceMappingURL=git-integration.js.map