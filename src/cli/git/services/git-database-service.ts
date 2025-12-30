/**
 * Git Database Service
 * SOLID Principles: Single Responsibility - Handle Git database operations
 */

import { Logger } from '../../../utils/logger';
import { DatabaseConnections } from '../../../config/database-config';
import { IGitDatabaseService, GitCommitInfo, ChangeSignificance, CommitAnalysis, AutoCommitRules } from '../interfaces';

export class GitDatabaseService implements IGitDatabaseService {
  private logger = Logger.getInstance();
  private db: any;

  constructor() {
    this.initializeDatabase();
  }

  async recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted: boolean = false): Promise<void> {
    try {
      await this.db?.query(
        `INSERT OR REPLACE INTO git_commits (
          hash, short_hash, message, author, commit_date,
          changed_files, additions, deletions, significance_score, auto_committed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commit.hash,
          commit.shortHash,
          commit.message,
          commit.author,
          commit.date.toISOString(),
          commit.changedFiles.length,
          commit.additions,
          commit.deletions,
          significance.score,
          autoCommitted
        ]
      );

      for (const file of commit.changedFiles) {
        await this.db?.query(
          `INSERT OR REPLACE INTO git_file_changes (
            commit_hash, file_path, change_type, significance_factors
          ) VALUES (?, ?, ?, ?)`,
          [
            commit.hash,
            file,
            'modified',
            JSON.stringify(significance.factors)
          ]
        );
      }

      this.logger.info(`Recorded commit ${commit.shortHash} with significance score ${significance.score}`);
    } catch (error) {
      this.logger.error('Failed to record commit', error as Error);
    }
  }

  async updateDatabaseFromGitHistory(): Promise<void> {
    try {
      this.logger.info('Updating database from Git history...');

      const gitOps = new (require('./git-operations-service').GitOperationsService)(process.cwd());
      const gitAnalysis = new (require('./git-analysis-service').GitAnalysisService)(process.cwd());

      const commits = await gitOps.getCommitsSince('HEAD~10');

      for (const commit of commits) {
        const existingCommit = await this.db?.query(
          'SELECT hash FROM git_commits WHERE hash = ?',
          [commit.hash]
        );

        if (existingCommit?.length === 0) {
          const diff = await gitOps.getDiffBetweenCommits(`${commit.hash}~1`, commit.hash);
          const significance = await gitAnalysis.analyzeChangeSignificance(diff);

          await this.recordCommit(commit, significance, false);
        }
      }

      this.logger.info('Database updated from Git history');
    } catch (error) {
      this.logger.error('Failed to update database from Git history', error as Error);
    }
  }

  async getCommitHistory(limit: number = 20): Promise<CommitAnalysis[]> {
    try {
      const commits = await this.db?.query(`
        SELECT
          hash, short_hash, message, author, commit_date,
          changed_files, additions, deletions, significance_score, auto_committed
        FROM git_commits
        ORDER BY commit_date DESC
        LIMIT ?
      `, [limit]);

      const commitAnalyses: CommitAnalysis[] = [];

      for (const commitRow of commits || []) {
        const factors = await this.db?.query(
          'SELECT significance_factors FROM git_file_changes WHERE commit_hash = ? LIMIT 1',
          [commitRow.hash]
        );

        const significance: ChangeSignificance = {
          score: commitRow.significance_score || 0,
          factors: factors?.[0]?.significance_factors ?
            JSON.parse(factors[0].significance_factors) : [],
          shouldAutoCommit: false
        };

        const codeAnalysis = await this.db?.query(
          `SELECT
            duplications_changed, dependencies_changed,
            complexity_delta, new_patterns
          FROM commit_analysis
          WHERE commit_hash = ?`,
          [commitRow.hash]
        );

        commitAnalyses.push({
          commit: {
            hash: commitRow.hash,
            shortHash: commitRow.short_hash,
            message: commitRow.message,
            author: commitRow.author,
            date: new Date(commitRow.commit_date),
            changedFiles: [],
            additions: commitRow.additions || 0,
            deletions: commitRow.deletions || 0
          },
          significance,
          codeAnalysis: codeAnalysis?.[0] ? {
            duplicationsChanged: codeAnalysis[0].duplications_changed || 0,
            dependenciesChanged: codeAnalysis[0].dependencies_changed || 0,
            complexityDelta: codeAnalysis[0].complexity_delta || 0,
            newPatterns: codeAnalysis[0].new_patterns ?
              JSON.parse(codeAnalysis[0].new_patterns) : []
          } : undefined
        });
      }

      return commitAnalyses;
    } catch (error) {
      this.logger.error('Failed to get commit history', error as Error);
      return [];
    }
  }

  async getIntegrationStatus(projectPath: string): Promise<{
    isGitRepository: boolean;
    lastCommit?: any;
    autoCommitEnabled: boolean;
    totalCommitsTracked: number;
  }> {
    try {
      const gitOps = new (require('./git-operations-service').GitOperationsService)(projectPath);
      const isGitRepository = await gitOps.isGitRepository();

      if (!isGitRepository) {
        return {
          isGitRepository: false,
          autoCommitEnabled: false,
          totalCommitsTracked: 0
        };
      }

      const lastCommit = await gitOps.getCurrentCommit();

      const totalCommitsResult = await this.db?.query(
        'SELECT COUNT(*) as count FROM git_commits'
      );
      const totalCommitsTracked = totalCommitsResult?.[0]?.count || 0;

      const rulesResult = await this.db?.query(
        'SELECT enabled FROM auto_commit_rules WHERE enabled = 1 LIMIT 1'
      );
      const autoCommitEnabled = rulesResult?.length > 0;

      return {
        isGitRepository,
        lastCommit,
        autoCommitEnabled,
        totalCommitsTracked
      };
    } catch (error) {
      this.logger.error('Failed to get integration status', error as Error);
      return {
        isGitRepository: false,
        autoCommitEnabled: false,
        totalCommitsTracked: 0
      };
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // For now, always use in-memory store for Git integration
      // TODO: Implement proper database integration when needed
      const InMemoryGitStore = require('../in-memory-git-store').InMemoryGitStore;
      this.db = new InMemoryGitStore();
      this.logger.info('Git database service initialized with in-memory store');
    } catch (error) {
      this.logger.error('Failed to initialize Git integration database', error as Error);
      const InMemoryGitStore = require('../in-memory-git-store').InMemoryGitStore;
      this.db = new InMemoryGitStore();
    }
  }

  private async createGitTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS git_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        short_hash TEXT NOT NULL,
        message TEXT NOT NULL,
        author TEXT NOT NULL,
        commit_date TIMESTAMP NOT NULL,
        analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_files INTEGER DEFAULT 0,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        significance_score REAL DEFAULT 0,
        auto_committed BOOLEAN DEFAULT FALSE
      )`,

      `CREATE TABLE IF NOT EXISTS git_file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        significance_factors TEXT,
        FOREIGN KEY (commit_hash) REFERENCES git_commits(hash)
      )`,

      `CREATE TABLE IF NOT EXISTS commit_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_hash TEXT NOT NULL,
        duplications_changed INTEGER DEFAULT 0,
        dependencies_changed INTEGER DEFAULT 0,
        complexity_delta REAL DEFAULT 0,
        new_patterns TEXT,
        analysis_metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (commit_hash) REFERENCES git_commits(hash)
      )`,

      `CREATE TABLE IF NOT EXISTS auto_commit_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        conditions TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.db?.query(table);
    }

    await this.insertDefaultAutoCommitRules();
  }

  private async insertDefaultAutoCommitRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'successful_compilation',
        type: 'compilation',
        conditions: JSON.stringify({
          compilesSuccessfully: true,
          minSignificanceScore: 50,
          minChangedFiles: 1,
          excludePatterns: ['*.md', '*.txt', '.gitignore']
        })
      },
      {
        name: 'feature_completion',
        type: 'feature',
        conditions: JSON.stringify({
          compilesSuccessfully: true,
          minSignificanceScore: 75,
          requiredPatterns: ['test', 'spec'],
          minTestCoverage: 80
        })
      },
      {
        name: 'dependency_updates',
        type: 'dependency',
        conditions: JSON.stringify({
          compilesSuccessfully: true,
          changedFiles: ['package.json', 'package-lock.json', 'yarn.lock', 'requirements.txt'],
          autoInstall: true
        })
      }
    ];

    for (const rule of defaultRules) {
      await this.db?.query(
        `INSERT OR IGNORE INTO auto_commit_rules (rule_name, rule_type, conditions) VALUES (?, ?, ?)`,
        [rule.name, rule.type, rule.conditions]
      );
    }
  }
}