/**
 * Git Analysis Service
 * SOLID Principles: Single Responsibility - Handle Git change analysis
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../../utils/logger';
import { ChangeDetector } from '../change-detector';
import { IGitAnalysisService, GitDiffResult, ChangeSignificance, SignificanceFactor } from '../interfaces';

const execAsync = promisify(exec);

export class GitAnalysisService implements IGitAnalysisService {
  private logger = Logger.getInstance();
  private projectPath: string;
  private changeDetector: ChangeDetector;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.changeDetector = new ChangeDetector(this.logger);
  }

  async analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance> {
    const detailedSignificance = await this.changeDetector.analyzeChanges(diff);

    const factors: SignificanceFactor[] = [];

    if (diff.length > 0) {
      factors.push({
        type: 'file_count',
        impact: Math.min(diff.length * 10, 50),
        description: `Changed ${diff.length} files`
      });
    }

    const totalLineChanges = diff.reduce((sum, d) =>
      sum + (d.linesAdded || 0) + (d.linesDeleted || 0), 0);

    if (totalLineChanges > 0) {
      factors.push({
        type: 'line_changes',
        impact: Math.min(totalLineChanges * 2, 40),
        description: `${totalLineChanges} total line changes`
      });
    }

    const testFiles = diff.filter(d =>
      d.file.includes('test') ||
      d.file.includes('spec') ||
      d.file.endsWith('.test.js') ||
      d.file.endsWith('.test.ts')
    );

    if (testFiles.length > 0) {
      factors.push({
        type: 'tests',
        impact: 20,
        description: `Modified ${testFiles.length} test files`
      });
    }

    const configFiles = diff.filter(d =>
      d.file.includes('package.json') ||
      d.file.includes('tsconfig') ||
      d.file.includes('.config')
    );

    if (configFiles.length > 0) {
      factors.push({
        type: 'config',
        impact: 15,
        description: `Modified ${configFiles.length} config files`
      });
    }

    const newFeatures = diff.filter(d => d.status === 'added');
    if (newFeatures.length > 0) {
      factors.push({
        type: 'new_features',
        impact: newFeatures.length * 15,
        description: `Added ${newFeatures.length} new files`
      });
    }

    const score = factors.reduce((sum, factor) => sum + factor.impact, 0);
    const shouldAutoCommit = score >= 30 && score <= 80;

    let commitMessage: string | undefined;
    if (shouldAutoCommit) {
      commitMessage = await this.generateCommitMessage(diff, factors);
    }

    return {
      score,
      factors,
      shouldAutoCommit,
      commitMessage
    };
  }

  async analyzeCommitRange(projectPath: string, from: string, to: string): Promise<{
    commitCount: number;
    totalChanges: number;
    significantCommits: number;
    summary: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `git log ${from}..${to} --oneline`,
        { cwd: projectPath }
      );

      const commits = stdout.trim() ? stdout.trim().split('\n') : [];
      const commitCount = commits.length;

      const { stdout: diffStats } = await execAsync(
        `git diff --numstat ${from}..${to}`,
        { cwd: projectPath }
      );

      let totalChanges = 0;
      if (diffStats.trim()) {
        const lines = diffStats.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^(\d+|-)\s+(\d+|-)/);
          if (match) {
            const added = match[1] === '-' ? 0 : parseInt(match[1]);
            const deleted = match[2] === '-' ? 0 : parseInt(match[2]);
            totalChanges += added + deleted;
          }
        }
      }

      const significantCommits = Math.floor(commitCount * 0.6);

      return {
        commitCount,
        totalChanges,
        significantCommits,
        summary: `Analyzed ${commitCount} commits with ${totalChanges} total line changes`
      };
    } catch (error) {
      this.logger.error('Failed to analyze commit range', error as Error);
      return {
        commitCount: 0,
        totalChanges: 0,
        significantCommits: 0,
        summary: 'Failed to analyze commit range'
      };
    }
  }

  async compilesSuccessfully(): Promise<boolean> {
    try {
      const packageJsonExists = require('fs').existsSync(`${this.projectPath}/package.json`);

      if (!packageJsonExists) {
        return true;
      }

      const { stdout, stderr } = await execAsync(
        'npm run build 2>&1',
        {
          cwd: this.projectPath,
          timeout: 30000
        }
      );

      const output = stdout + stderr;
      const hasErrors = output.toLowerCase().includes('error') &&
                       !output.toLowerCase().includes('0 errors');

      return !hasErrors;
    } catch (error) {
      this.logger.warn('Compilation check failed', error);
      return false;
    }
  }

  private async generateCommitMessage(diff: GitDiffResult[], factors: SignificanceFactor[]): Promise<string> {
    const addedFiles = diff.filter(d => d.status === 'added');
    const modifiedFiles = diff.filter(d => d.status === 'modified');
    const deletedFiles = diff.filter(d => d.status === 'deleted');

    let message = '';

    if (addedFiles.length > 0) {
      message += `feat: Add ${addedFiles.length} new file(s)`;
    } else if (modifiedFiles.length > 0) {
      message += `chore: Update ${modifiedFiles.length} file(s)`;
    } else if (deletedFiles.length > 0) {
      message += `refactor: Remove ${deletedFiles.length} file(s)`;
    } else {
      message = 'chore: Various improvements';
    }

    const hasTests = factors.some(f => f.type === 'tests');
    const hasConfig = factors.some(f => f.type === 'config');

    if (hasTests && hasConfig) {
      message += ' with tests and config updates';
    } else if (hasTests) {
      message += ' with test updates';
    } else if (hasConfig) {
      message += ' with config changes';
    }

    return message;
  }
}