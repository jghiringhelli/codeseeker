/**
 * Git Operations Service
 * SOLID Principles: Single Responsibility - Handle Git command operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../../utils/logger';
import { IGitOperationsService, GitCommitInfo, GitDiffResult, GitFileChange } from '../interfaces';

const execAsync = promisify(exec);

export class GitOperationsService implements IGitOperationsService {
  private logger = Logger.getInstance();
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async getCurrentCommit(): Promise<GitCommitInfo | null> {
    try {
      const { stdout } = await execAsync(
        'git log -1 --format="%H|%h|%s|%an|%ad" --date=iso',
        { cwd: this.projectPath }
      );

      if (!stdout?.trim()) return null;

      const [hash, shortHash, message, author, dateStr] = stdout.trim().split('|');
      const changedFiles = await this.getChangedFiles(hash);
      const { additions, deletions } = await this.getCommitStats(hash);

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
      for (const line of stdout.trim().split('\n')) {
        const [hash, shortHash, message, author, dateStr] = line.split('|');
        const changedFiles = await this.getChangedFiles(hash);
        const { additions, deletions } = await this.getCommitStats(hash);

        commits.push({
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
      const lines = stdout.trim().split('\n');

      for (let i = 0; i < lines.length; i += 2) {
        const statusLine = lines[i];
        const statsLine = lines[i + 1];

        if (!statusLine || !statsLine) continue;

        const statusMatch = statusLine.match(/^([AMDRT])\s+(.+)$/);
        const statsMatch = statsLine.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);

        if (statusMatch && statsMatch) {
          const status = this.mapGitStatus(statusMatch[1]);
          const file = statusMatch[2];
          const additions = statsMatch[1] === '-' ? 0 : parseInt(statsMatch[1]);
          const deletions = statsMatch[2] === '-' ? 0 : parseInt(statsMatch[2]);

          const changes = await this.getFileChanges(file, from, to);
          const patch = await this.getFilePatch(file, from, to);

          results.push({
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

  async getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]> {
    try {
      const { stdout } = await execAsync(
        'git diff --name-status HEAD',
        { cwd: projectPath }
      );

      if (!stdout?.trim()) return [];

      const results: GitDiffResult[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const match = line.match(/^([AMDRT])\s+(.+)$/);
        if (match) {
          const status = this.mapGitStatus(match[1]);
          const file = match[2];

          const changes = await this.getFileChanges(file, 'HEAD', '');
          const patch = await this.getFilePatch(file, 'HEAD', '');

          results.push({
            file,
            status,
            patch,
            changes
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get working directory diff', error as Error);
      return [];
    }
  }

  async getStagedFiles(projectPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'git diff --cached --name-only',
        { cwd: projectPath }
      );

      return stdout?.trim() ? stdout.trim().split('\n') : [];
    } catch (error) {
      this.logger.error('Failed to get staged files', error as Error);
      return [];
    }
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.projectPath });
      return true;
    } catch {
      return false;
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

      return stdout.trim().split('\n').filter(line => line.trim());
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

      for (const line of stdout.trim().split('\n')) {
        const match = line.match(/^(\d+|-)\s+(\d+|-)\s+/);
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
      const lines = stdout.split('\n');

      let currentLine = 0;
      for (const line of lines) {
        if (line.startsWith('@@')) {
          const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (match) {
            currentLine = parseInt(match[2]);
          }
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          changes.push({
            type: 'added',
            lineNumber: currentLine++,
            content: line.substring(1)
          });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          changes.push({
            type: 'removed',
            lineNumber: currentLine,
            content: line.substring(1)
          });
        }
      }

      return changes;
    } catch (error) {
      return [];
    }
  }
}