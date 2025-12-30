/**
 * Git Auto-Commit Service
 * SOLID Principles: Single Responsibility - Handle automatic commit operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as chokidar from 'chokidar';
import { Logger } from '../../../utils/logger';
import { IGitAutoCommitService, ChangeSignificance, AutoCommitRules } from '../interfaces';

const execAsync = promisify(exec);

export class GitAutoCommitService implements IGitAutoCommitService {
  private logger = Logger.getInstance();
  private projectPath: string;
  private fileWatcher?: chokidar.FSWatcher;
  private autoCommitRules: AutoCommitRules = { enabled: false };
  private lastCommitTime: number = 0;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async performAutoCommit(significance: ChangeSignificance): Promise<boolean> {
    try {
      if (!significance.shouldAutoCommit || !significance.commitMessage) {
        return false;
      }

      const now = Date.now();
      const minInterval = (this.autoCommitRules.maxCommitFrequency || 5) * 60 * 1000;

      if (now - this.lastCommitTime < minInterval) {
        this.logger.debug('Auto-commit skipped: too frequent');
        return false;
      }

      if (this.autoCommitRules.requiresCompilation) {
        const gitAnalysis = new (require('./git-analysis-service').GitAnalysisService)(this.projectPath);
        const compilesSuccessfully = await gitAnalysis.compilesSuccessfully();

        if (!compilesSuccessfully) {
          this.logger.warn('Auto-commit skipped: compilation failed');
          return false;
        }
      }

      await execAsync('git add .', { cwd: this.projectPath });
      await execAsync(
        `git commit -m "${significance.commitMessage}"`,
        { cwd: this.projectPath }
      );

      this.lastCommitTime = now;
      this.logger.info(`Auto-commit successful: ${significance.commitMessage}`);
      return true;

    } catch (error) {
      this.logger.error('Auto-commit failed', error as Error);
      return false;
    }
  }

  async configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void> {
    try {
      this.autoCommitRules = {
        enabled: rules.enabled ?? this.autoCommitRules.enabled,
        minSignificanceScore: rules.minSignificanceScore ?? this.autoCommitRules.minSignificanceScore,
        requiresCompilation: rules.requiresCompilation ?? this.autoCommitRules.requiresCompilation,
        watchPatterns: rules.watchPatterns ?? this.autoCommitRules.watchPatterns,
        maxCommitFrequency: rules.maxCommitFrequency ?? this.autoCommitRules.maxCommitFrequency
      };

      const gitDb = new (require('./git-database-service').GitDatabaseService)();
      await gitDb.recordCommitRules?.(this.autoCommitRules);

      this.logger.info('Auto-commit configuration updated', this.autoCommitRules);

      if (this.autoCommitRules.enabled) {
        await this.startAutoCommitWatcher();
      } else {
        await this.stopAutoCommitWatcher();
      }
    } catch (error) {
      this.logger.error('Failed to configure auto-commit', error as Error);
    }
  }

  async startAutoCommitWatcher(): Promise<void> {
    try {
      if (this.fileWatcher) {
        this.logger.warn('Auto-commit watcher already running');
        return;
      }

      if (!this.autoCommitRules.enabled) {
        this.logger.info('Auto-commit disabled, skipping watcher start');
        return;
      }

      const watchPatterns = this.autoCommitRules.watchPatterns || [
        'src/**/*.{ts,js,tsx,jsx}',
        'test/**/*.{ts,js,tsx,jsx}',
        'package.json',
        'tsconfig.json'
      ];

      this.fileWatcher = chokidar.watch(watchPatterns, {
        cwd: this.projectPath,
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**'
        ],
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      let changeTimeout: NodeJS.Timeout;

      this.fileWatcher.on('change', (path) => {
        this.logger.debug(`File changed: ${path}`);

        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(async () => {
          await this.evaluateAutoCommit();
        }, 5000);
      });

      this.fileWatcher.on('add', (path) => {
        this.logger.debug(`File added: ${path}`);

        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(async () => {
          await this.evaluateAutoCommit();
        }, 5000);
      });

      this.fileWatcher.on('error', (error: Error) => {
        this.logger.error('File watcher error', error);
      });

      this.logger.info(`Auto-commit watcher started for patterns: ${watchPatterns.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to start auto-commit watcher', error as Error);
    }
  }

  async stopAutoCommitWatcher(): Promise<void> {
    try {
      if (this.fileWatcher) {
        await this.fileWatcher.close();
        this.fileWatcher = undefined;
        this.logger.info('Auto-commit watcher stopped');
      }
    } catch (error) {
      this.logger.error('Failed to stop auto-commit watcher', error as Error);
    }
  }

  private async evaluateAutoCommit(): Promise<void> {
    try {
      const gitOps = new (require('./git-operations-service').GitOperationsService)(this.projectPath);
      const gitAnalysis = new (require('./git-analysis-service').GitAnalysisService)(this.projectPath);

      const diff = await gitOps.getWorkingDirectoryDiff(this.projectPath);

      if (diff.length === 0) {
        this.logger.debug('No changes to commit');
        return;
      }

      const significance = await gitAnalysis.analyzeChangeSignificance(diff);

      const minScore = this.autoCommitRules.minSignificanceScore || 30;
      if (significance.score < minScore) {
        this.logger.debug(`Changes not significant enough for auto-commit (${significance.score} < ${minScore})`);
        return;
      }

      const committed = await this.performAutoCommit(significance);

      if (committed) {
        const gitDb = new (require('./git-database-service').GitDatabaseService)();
        const currentCommit = await gitOps.getCurrentCommit();

        if (currentCommit) {
          await gitDb.recordCommit(currentCommit, significance, true);
        }
      }
    } catch (error) {
      this.logger.error('Failed to evaluate auto-commit', error as Error);
    }
  }
}