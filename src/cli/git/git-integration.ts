import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { Logger } from '../../utils/logger';
import { DatabaseFactory } from '../../database/factory';
import { ChangeDetector, ChangeSignificance as DetailedChangeSignificance } from './change-detector';

const execAsync = promisify(exec);

// Simple in-memory store for Git integration when no database is available
class InMemoryGitStore {
  private commits: Map<string, any> = new Map();
  private rules: Map<string, any> = new Map();

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Simple mock implementation - in a real scenario you'd implement actual SQL parsing
    if (sql?.includes('INSERT INTO git_commits')) {
      const id = Date?.now().toString();
      this.commits?.set(id, { id, ...params });
      return [];
    } else if (sql?.includes('SELECT') && sql?.includes('git_commits')) {
      return Array.from(this.commits?.values()).slice(0, parseInt(params?.[0] || '10'));
    } else if (sql?.includes('INSERT INTO auto_commit_rules')) {
      const projectPath = params?.[0] || 'default';
      this.rules?.set(projectPath, { 
        project_path: projectPath,
        enabled: params?.[1] || false,
        min_significance_score: params?.[2] || 2.0,
        requires_compilation: params?.[3] || true
      });
      return [];
    }
    return [];
  }
}

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

export interface AutoCommitRules {
  enabled: boolean;
  minSignificanceScore?: number;
  requiresCompilation?: boolean;
  watchPatterns?: string[];
  maxCommitFrequency?: number;
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

export class GitIntegration {
  private logger = Logger?.getInstance();
  private projectPath: string;
  private db: any;
  private changeDetector: ChangeDetector;
  private fileWatcher?: chokidar.FSWatcher;
  private autoCommitRules: AutoCommitRules = { enabled: false };

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process?.cwd();
    this.changeDetector = new ChangeDetector(this.logger);
    this?.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Try to use existing database configuration or create a simple in-memory store
      const config = DatabaseFactory?.parseConfigFromEnv();
      
      if (config) {
        this.db = DatabaseFactory?.create(config, this.logger);
        await this.db?.initialize();
        await this?.createGitTables();
      } else {
        // Use a simple in-memory store for Git integration if no database configured
        this.logger.warn('No database configuration found, using in-memory store for Git integration');
        this.db = new InMemoryGitStore();
      }
    } catch (error) {
      this.logger.error('Failed to initialize Git integration database', error as Error);
      // Fall back to in-memory store
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

    // Insert default auto-commit rules
    await this?.insertDefaultAutoCommitRules();
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

  async getCurrentCommit(): Promise<GitCommitInfo | null> {
    try {
      const { stdout } = await execAsync(
        'git log -1 --format="%H|%h|%s|%an|%ad" --date=iso',
        { cwd: this.projectPath }
      );

      if (!stdout?.trim()) return null;

      const [hash, shortHash, message, author, dateStr] = stdout?.trim().split('|');
      const changedFiles = await this?.getChangedFiles(hash);
      const { additions, deletions } = await this?.getCommitStats(hash);

      return {
        hash,
        shortHash,
        message,
        author,
        date: new Date(dateStr),
        changedFiles,
        additions,
        deletions
      };
    } catch (error) {
      this.logger.warn('Failed to get current commit info', error);
      return null;
    }
  }

  async getCommitsSince(since: string): Promise<GitCommitInfo[]> {
    try {
      const { stdout } = await execAsync(
        `git log ${since}..HEAD --format="%H|%h|%s|%an|%ad" --date=iso`,
        { cwd: this.projectPath }
      );

      if (!stdout?.trim()) return [];

      const commits: GitCommitInfo[] = [];
      for (const line of stdout?.trim().split('\n')) {
        const [hash, shortHash, message, author, dateStr] = line?.split('|');
        const changedFiles = await this?.getChangedFiles(hash);
        const { additions, deletions } = await this?.getCommitStats(hash);

        commits?.push({
          hash,
          shortHash,
          message,
          author,
          date: new Date(dateStr),
          changedFiles,
          additions,
          deletions
        });
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to get commits since', error as Error);
      return [];
    }
  }

  async getDiffBetweenCommits(from: string, to: string = 'HEAD'): Promise<GitDiffResult[]> {
    try {
      const { stdout } = await execAsync(
        `git diff --name-status --numstat ${from}..${to}`,
        { cwd: this.projectPath }
      );

      if (!stdout?.trim()) return [];

      const results: GitDiffResult[] = [];
      const lines = stdout?.trim().split('\n');
      
      for (let i = 0; i < lines?.length; i += 2) {
        const statusLine = lines[i];
        const statsLine = lines[i + 1];
        
        if (!statusLine || !statsLine) continue;

        const statusMatch = statusLine?.match(/^([AMDRT])\s+(.+)$/);
        const statsMatch = statsLine?.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
        
        if (statusMatch && statsMatch) {
          const status = this?.mapGitStatus(statusMatch[1]);
          const file = statusMatch[2];
          const additions = statsMatch[1] === '-' ? 0 : parseInt(statsMatch[1]);
          const deletions = statsMatch[2] === '-' ? 0 : parseInt(statsMatch[2]);

          const changes = await this?.getFileChanges(file, from, to);

          // Get patch for detailed analysis
          const patch = await this?.getFilePatch(file, from, to);

          results?.push({
            file,
            status,
            linesAdded: additions,
            linesDeleted: deletions,
            patch,
            changes
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get diff between commits', error as Error);
      return [];
    }
  }

  private mapGitStatus(status: string): GitDiffResult['status'] {
    switch (status) {
      case 'A': return 'added';
      case 'M': return 'modified';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      default: return 'modified';
    }
  }

  private async getChangedFiles(commitHash: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `git show --name-only --format="" ${commitHash}`,
        { cwd: this.projectPath }
      );

      return stdout?.trim().split('\n').filter(line => line?.trim());
    } catch (error) {
      return [];
    }
  }

  private async getCommitStats(commitHash: string): Promise<{ additions: number; deletions: number }> {
    try {
      const { stdout } = await execAsync(
        `git show --numstat --format="" ${commitHash}`,
        { cwd: this.projectPath }
      );

      let totalAdditions = 0;
      let totalDeletions = 0;

      for (const line of stdout?.trim().split('\n')) {
        const match = line?.match(/^(\d+|-)\s+(\d+|-)\s+/);
        if (match) {
          totalAdditions += match[1] === '-' ? 0 : parseInt(match[1]);
          totalDeletions += match[2] === '-' ? 0 : parseInt(match[2]);
        }
      }

      return { additions: totalAdditions, deletions: totalDeletions };
    } catch (error) {
      return { additions: 0, deletions: 0 };
    }
  }

  private async getFilePatch(file: string, from: string, to: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `git diff ${from}..${to} -- "${file}"`,
        { cwd: this.projectPath }
      );
      return stdout;
    } catch (error) {
      return '';
    }
  }

  private async getFileChanges(file: string, from: string, to: string): Promise<GitFileChange[]> {
    try {
      const { stdout } = await execAsync(
        `git diff --unified=0 ${from}..${to} -- "${file}"`,
        { cwd: this.projectPath }
      );

      const changes: GitFileChange[] = [];
      const lines = stdout?.split('\n');
      
      let currentLine = 0;
      for (const line of lines) {
        if (line?.startsWith('@@')) {
          const match = line?.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (match) {
            currentLine = parseInt(match[2]);
          }
        } else if (line?.startsWith('+') && !line?.startsWith('+++')) {
          changes?.push({
            type: 'added',
            lineNumber: currentLine++,
            content: line?.substring(1)
          });
        } else if (line?.startsWith('-') && !line?.startsWith('---')) {
          changes?.push({
            type: 'removed',
            lineNumber: currentLine,
            content: line?.substring(1)
          });
        }
      }

      return changes;
    } catch (error) {
      return [];
    }
  }

  async analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance> {
    // Use the advanced change detector for detailed analysis
    const detailedSignificance = await this.changeDetector?.analyzeChanges(diff);
    
    // Convert to legacy format for backward compatibility
    const factors: SignificanceFactor[] = [];
    let score = detailedSignificance.score;

    // File count factor
    const fileCount = diff?.length;
    if (fileCount > 0) {
      factors?.push({
        type: 'file_count',
        impact: fileCount * 0.2,
        description: `${fileCount} files changed`
      });
    }

    // Line changes factor
    const totalAdditions = detailedSignificance.linesAdded;
    const totalDeletions = detailedSignificance.linesDeleted;
    const totalChanges = totalAdditions + totalDeletions;

    if (totalChanges > 0) {
      factors?.push({
        type: 'line_changes',
        impact: totalChanges * 0.01,
        description: `${totalAdditions} additions, ${totalDeletions} deletions`
      });
    }

    // Add factors based on detailed analysis
    if (detailedSignificance.newFeatures?.length > 0) {
      factors?.push({
        type: 'new_features',
        impact: detailedSignificance.newFeatures?.length * 0.5,
        description: `New features: ${detailedSignificance.newFeatures?.join(', ')}`
      });
    }

    if (detailedSignificance.testChanges?.length > 0) {
      factors?.push({
        type: 'tests',
        impact: detailedSignificance.testChanges?.length * 0.3,
        description: `Test files: ${detailedSignificance.testChanges?.join(', ')}`
      });
    }

    if (detailedSignificance.configChanges?.length > 0) {
      factors?.push({
        type: 'config',
        impact: detailedSignificance.configChanges?.length * 0.4,
        description: `Config files: ${detailedSignificance.configChanges?.join(', ')}`
      });
    }

    // Generate commit message based on analysis
    const commitMessage = this?.generateCommitMessage(detailedSignificance);
    
    return {
      score,
      factors,
      shouldAutoCommit: score >= this.autoCommitRules.minSignificanceScore && this.autoCommitRules.enabled,
      commitMessage
    };
  }

  private generateCommitMessage(significance: DetailedChangeSignificance): string {
    const categories = significance.categories;
    const primaryCategory = categories?.length > 0 ? categories[0] : null;
    
    let baseMessage = '';
    
    if (primaryCategory) {
      switch (primaryCategory.type) {
        case 'feature':
          baseMessage = 'feat: ';
          break;
        case 'bugfix':
          baseMessage = 'fix: ';
          break;
        case 'refactor':
          baseMessage = 'refactor: ';
          break;
        case 'test':
          baseMessage = 'test: ';
          break;
        case 'config':
          baseMessage = 'chore: ';
          break;
        case 'docs':
          baseMessage = 'docs: ';
          break;
        default:
          baseMessage = 'update: ';
      }
    } else {
      baseMessage = 'update: ';
    }

    // Generate description based on changes
    const descriptions: string[] = [];
    
    if (significance.newFeatures?.length > 0) {
      descriptions?.push(`add ${significance.newFeatures?.slice(0, 2).join(', ')}`);
    }
    
    if (significance.bugFixes?.length > 0) {
      descriptions?.push(`fix ${significance.bugFixes?.slice(0, 2).join(', ')}`);
    }
    
    if (significance.testChanges?.length > 0) {
      descriptions?.push(`update ${significance.testChanges?.length} tests`);
    }
    
    if (significance.configChanges?.length > 0) {
      descriptions?.push(`modify ${significance.configChanges?.slice(0, 2).join(', ')}`);
    }
    
    if (descriptions?.length === 0) {
      descriptions?.push(`${significance.filesChanged} files, +${significance.linesAdded}/-${significance.linesDeleted}`);
    }

    const message = baseMessage + descriptions?.join(', ');
    
    // Add context about significance and impact areas
    const details: string[] = [];
    if (significance?.riskLevel === 'high') {
      details?.push('High-risk changes');
    }
    if (significance.impactAreas?.length > 0) {
      details?.push(`Affects: ${significance.impactAreas?.slice(0, 3).join(', ')}`);
    }
    
    return details?.length > 0 ? `${message}\n\n${details?.join(', ')}` : message;
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git status', { cwd: this.projectPath });
      return true;
    } catch {
      return false;
    }
  }

  async compilesSuccessfully(): Promise<boolean> {
    try {
      // Check for TypeScript project
      const tsConfigExists = await fs?.access(path?.join(this.projectPath, 'tsconfig.json'))
        .then(() => true)
        .catch(() => false);

      if (tsConfigExists) {
        const { stdout, stderr } = await execAsync('npm run build', { cwd: this.projectPath });
        return !stderr || !stderr?.includes('error');
      }

      // Check for package.json scripts
      const packageJsonPath = path?.join(this.projectPath, 'package.json');
      const packageJsonExists = await fs?.access(packageJsonPath)
        .then(() => true)
        .catch(() => false);

      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs?.readFile(packageJsonPath, 'utf-8'));
        
        // Try common build/compile scripts
        const buildScripts = ['build', 'compile', 'tsc', 'test'];
        for (const script of buildScripts) {
          if (packageJson.scripts?.[script]) {
            try {
              const { stderr } = await execAsync(`npm run ${script}`, { cwd: this.projectPath });
              if (!stderr || !stderr?.includes('error')) {
                return true;
              }
            } catch (error) {
              // Continue to next script
            }
          }
        }
      }

      // Default to true if no clear compilation process
      return true;
    } catch (error) {
      this.logger.warn('Failed to check compilation status', error);
      return false;
    }
  }

  async performAutoCommit(significance: ChangeSignificance): Promise<boolean> {
    if (!significance.shouldAutoCommit || !significance.commitMessage) {
      return false;
    }

    try {
      // Stage all changes
      await execAsync('git add -A', { cwd: this.projectPath });

      // Check if there are changes to commit
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: this.projectPath });
      if (!stdout?.trim()) {
        this.logger.info('No changes to commit');
        return false;
      }

      // Create commit
      await execAsync(`git commit -m "${significance.commitMessage}"`, { cwd: this.projectPath });
      
      this.logger.info(`Auto-commit created: ${significance.commitMessage?.split('\n')[0]}`);
      
      // Record the auto-commit in database
      const currentCommit = await this?.getCurrentCommit();
      if (currentCommit) {
        await this?.recordCommit(currentCommit, significance, true);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to perform auto-commit', error as Error);
      return false;
    }
  }

  async recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted: boolean = false): Promise<void> {
    try {
      // Insert commit record
      await this.db?.query(
        `INSERT OR REPLACE INTO git_commits (
          hash, short_hash, message, author, commit_date, changed_files, 
          additions, deletions, significance_score, auto_committed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commit.hash,
          commit.shortHash,
          commit.message,
          commit.author,
          commit.date,
          commit.changedFiles?.length,
          commit.additions,
          commit.deletions,
          significance.score,
          autoCommitted
        ]
      );

      // Insert significance factors
      for (const factor of significance.factors) {
        await this.db?.query(
          `INSERT INTO git_file_changes (commit_hash, file_path, change_type, significance_factors) 
           VALUES (?, ?, ?, ?)`,
          [commit.hash, 'multiple', factor.type, JSON.stringify(factor)]
        );
      }

      this.logger.info(`Recorded commit ${commit.shortHash} with significance score ${significance.score}`);
    } catch (error) {
      this.logger.error('Failed to record commit', error as Error);
    }
  }

  async updateDatabaseFromGitHistory(): Promise<void> {
    this.logger.info('Updating database from Git history...');

    try {
      // Get last processed commit
      const lastProcessed = await this.db?.query(
        'SELECT hash FROM git_commits ORDER BY commit_date DESC LIMIT 1'
      );

      const since = lastProcessed?.[0]?.hash || 'HEAD~10'; // Default to last 10 commits
      const newCommits = await this?.getCommitsSince(since);

      for (const commit of newCommits) {
        const diff = await this?.getDiffBetweenCommits(`${commit.hash}~1`, commit.hash);
        const significance = await this?.analyzeChangeSignificance(diff);
        await this?.recordCommit(commit, significance);
      }

      this.logger.info(`Processed ${newCommits?.length} new commits`);
    } catch (error) {
      this.logger.error('Failed to update database from Git history', error as Error);
    }
  }

  async startAutoCommitWatcher(): Promise<void> {
    this.logger.info('Starting auto-commit watcher...');

    // Set up file system watcher
    const chokidar = await import('chokidar');
    const watcher = chokidar?.watch(this.projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.codemind/**'
      ],
      persistent: true
    });

    let changeTimeout: NodeJS.Timeout | null = null;

    const processChanges = async () => {
      try {
        // Check if there are uncommitted changes
        const { stdout } = await execAsync('git status --porcelain', { cwd: this.projectPath });
        
        if (!stdout?.trim()) return; // No changes

        // Analyze current changes
        const diff = await this?.getDiffBetweenCommits('HEAD');
        const significance = await this?.analyzeChangeSignificance(diff);

        this.logger.info(`Change detected. Significance score: ${significance.score}`);

        if (significance.shouldAutoCommit) {
          const success = await this?.performAutoCommit(significance);
          if (success) {
            this.logger.info('Auto-commit performed successfully');
          }
        }
      } catch (error) {
        this.logger.error('Error processing changes', error as Error);
      }
    };

    watcher?.on('change', (filePath) => {
      this.logger.debug(`File changed: ${filePath}`);
      
      // Debounce changes - wait 5 seconds after last change
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      
      changeTimeout = setTimeout(processChanges, 5000);
    });

    watcher?.on('add', (filePath) => {
      this.logger.debug(`File added: ${filePath}`);
      
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      
      changeTimeout = setTimeout(processChanges, 5000);
    });
  }

  async getCommitHistory(limit: number = 20): Promise<CommitAnalysis[]> {
    try {
      const commits = await this.db?.query(
        `SELECT * FROM git_commits 
         ORDER BY commit_date DESC 
         LIMIT ?`,
        [limit]
      );

      const analyses: CommitAnalysis[] = [];

      for (const commitRow of commits) {
        const commit: GitCommitInfo = {
          hash: commitRow.hash,
          shortHash: commitRow.short_hash,
          message: commitRow.message,
          author: commitRow.author,
          date: new Date(commitRow.commit_date),
          changedFiles: [], // Would need to fetch separately
          additions: commitRow.additions,
          deletions: commitRow.deletions
        };

        const significance: ChangeSignificance = {
          score: commitRow.significance_score,
          factors: [], // Would need to fetch separately
          shouldAutoCommit: false
        };

        analyses?.push({
          commit,
          significance
        });
      }

      return analyses;
    } catch (error) {
      this.logger.error('Failed to get commit history', error as Error);
      return [];
    }
  }

  // CLI Interface Methods
  async getIntegrationStatus(projectPath: string): Promise<{
    isRepository: boolean;
    autoCommitEnabled: boolean;
    isTracking: boolean;
    recentCommits: Array<{hash: string; message: string; timestamp: Date}>;
  }> {
    const gitIntegration = new GitIntegration(projectPath);
    const isRepository = await gitIntegration?.isGitRepository();
    
    const recentCommits = isRepository ? 
      (await gitIntegration?.getCommitsSince('HEAD~5')).map(commit => ({
        hash: commit.hash,
        message: commit.message,
        timestamp: commit.date
      })) : [];

    return {
      isRepository,
      autoCommitEnabled: gitIntegration.autoCommitRules.enabled,
      isTracking: gitIntegration?.fileWatcher !== undefined,
      recentCommits
    };
  }

  async analyzeCommitRange(projectPath: string, from: string, to: string): Promise<{
    significanceScore: number;
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    newFeatures: string[];
  }> {
    const gitIntegration = new GitIntegration(projectPath);
    const diff = await gitIntegration?.getDiffBetweenCommits(from, to);
    const significance = await gitIntegration?.analyzeChangeSignificance(diff);
    
    return {
      significanceScore: significance.score,
      filesChanged: diff?.length,
      linesAdded: diff?.reduce((sum, d) => sum + (d.linesAdded || 0), 0),
      linesDeleted: diff?.reduce((sum, d) => sum + (d.linesDeleted || 0), 0),
      newFeatures: [] // Will be populated by detailed analysis
    };
  }

  async configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void> {
    const gitIntegration = new GitIntegration(projectPath);
    gitIntegration.autoCommitRules = { ...gitIntegration.autoCommitRules, ...rules };
    
    // Save rules to database
    try {
      await gitIntegration.db?.query(
        `INSERT OR REPLACE INTO auto_commit_rules 
         (project_path, enabled, min_significance_score, requires_compilation, watch_patterns, max_frequency)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          projectPath,
          rules.enabled || false,
          rules.minSignificanceScore || 2.0,
          rules.requiresCompilation || true,
          JSON.stringify(rules.watchPatterns || []),
          rules.maxCommitFrequency || 60
        ]
      );
    } catch (error) {
      this.logger.error('Failed to save auto-commit rules', error as Error);
    }
  }

  async stopAutoCommitWatcher(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher?.close();
      this.fileWatcher = undefined;
      this.logger.info('Stopped file watcher');
    }
  }

  private async checkForAutoCommit(): Promise<void> {
    if (!this.autoCommitRules.enabled) return;

    const diff = await this?.getWorkingDirectoryDiff(this.projectPath);
    if (diff?.length === 0) return;

    const significance = await this?.analyzeChangeSignificance(diff);
    
    if (significance.shouldAutoCommit) {
      const success = await this?.performAutoCommit(significance);
      if (success) {
        this.logger.info(`Auto-committed changes with score ${significance.score}`);
      }
    }
  }


  async getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]> {
    try {
      const { stdout } = await execAsync('git diff --name-status HEAD', { cwd: projectPath });
      
      if (!stdout?.trim()) return [];

      const results: GitDiffResult[] = [];
      const lines = stdout?.trim().split('\n');
      
      for (const line of lines) {
        const match = line?.match(/^([AMDRT])\s+(.+)$/);
        if (match) {
          const status = this?.mapGitStatus(match[1]);
          const file = match[2];
          
          // Get line changes for this file
          const stats = await this?.getFileStats(file, 'HEAD');
          const patch = await this?.getWorkingFilePatch(file);
          
          results?.push({
            file,
            status,
            linesAdded: stats.additions,
            linesDeleted: stats.deletions,
            patch
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get working directory diff', error as Error);
      return [];
    }
  }

  private async getWorkingFilePatch(file: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git diff HEAD -- "${file}"`, { cwd: this.projectPath });
      return stdout;
    } catch (error) {
      return '';
    }
  }

  private async getFileStats(file: string, from: string): Promise<{ additions: number; deletions: number }> {
    try {
      const { stdout } = await execAsync(
        `git diff --numstat ${from} -- "${file}"`,
        { cwd: this.projectPath }
      );
      
      if (!stdout?.trim()) return { additions: 0, deletions: 0 };
      
      const match = stdout?.trim().match(/^(\d+|-)\s+(\d+|-)\s+/);
      if (match) {
        const additions = match[1] === '-' ? 0 : parseInt(match[1]);
        const deletions = match[2] === '-' ? 0 : parseInt(match[2]);
        return { additions, deletions };
      }
      
      return { additions: 0, deletions: 0 };
    } catch (error) {
      return { additions: 0, deletions: 0 };
    }
  }

  async getStagedFiles(projectPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: projectPath });
      return stdout?.trim() ? stdout?.trim().split('\n') : [];
    } catch (error) {
      return [];
    }
  }
}

export default GitIntegration;