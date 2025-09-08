/**
 * Git Branch Manager
 * 
 * Manages feature branches, snapshots, and rollback capabilities for CodeMind
 * Each request gets its own branch with snapshot points for safe rollbacks
 */

import { Logger } from './logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BranchSnapshot {
  branchName: string;
  commitHash: string;
  timestamp: Date;
  description: string;
  validationPassed: boolean;
  files: string[];
}

export interface FeatureBranch {
  branchName: string;
  userRequest: string;
  created: Date;
  snapshots: BranchSnapshot[];
  status: 'active' | 'completed' | 'failed' | 'merged' | 'abandoned';
  parentBranch: string;
}

export interface RollbackOptions {
  type: 'complete' | 'partial' | 'selective';
  targetSnapshot?: string;
  filesToKeep?: string[];
  createBackupBranch?: boolean;
}

export class GitBranchManager {
  private logger: Logger;
  private activeBranches: Map<string, FeatureBranch> = new Map();
  private projectPath: string;

  constructor(projectPath: string) {
    this.logger = Logger.getInstance();
    this.projectPath = projectPath;
  }

  /**
   * Create a new feature branch for a request
   */
  async createFeatureBranch(userRequest: string, requestId?: string): Promise<FeatureBranch> {
    const branchName = this.generateBranchName(userRequest, requestId);
    const parentBranch = await this.getCurrentBranch();

    try {
      this.logger.info(`🌿 Creating feature branch: ${branchName}`);

      // Ensure we're on the main branch and it's clean
      await this.ensureCleanWorkingDirectory();
      
      // Create and checkout the feature branch
      await this.execGit(`checkout -b ${branchName}`);

      const featureBranch: FeatureBranch = {
        branchName,
        userRequest,
        created: new Date(),
        snapshots: [],
        status: 'active',
        parentBranch
      };

      this.activeBranches.set(branchName, featureBranch);

      // Create initial snapshot
      await this.createSnapshot(branchName, 'Initial branch creation', false, []);

      this.logger.info(`✅ Feature branch created: ${branchName}`);
      return featureBranch;

    } catch (error: any) {
      this.logger.error(`Failed to create feature branch: ${error.message}`);
      throw new Error(`Branch creation failed: ${error.message}`);
    }
  }

  /**
   * Create a snapshot at current state
   */
  async createSnapshot(
    branchName: string,
    description: string,
    validationPassed: boolean,
    changedFiles: string[]
  ): Promise<BranchSnapshot> {
    try {
      // Ensure we're on the correct branch
      await this.execGit(`checkout ${branchName}`);

      // Stage all changes
      await this.execGit('add -A');

      // Create commit with detailed message
      const commitMessage = this.generateCommitMessage(description, validationPassed, changedFiles);
      await this.execGit(`commit -m "${commitMessage}" --allow-empty`);

      // Get the commit hash
      const { stdout: commitHash } = await this.execGit('rev-parse HEAD');

      const snapshot: BranchSnapshot = {
        branchName,
        commitHash: commitHash.trim(),
        timestamp: new Date(),
        description,
        validationPassed,
        files: [...changedFiles]
      };

      // Update the feature branch record
      const featureBranch = this.activeBranches.get(branchName);
      if (featureBranch) {
        featureBranch.snapshots.push(snapshot);
      }

      this.logger.info(`📸 Snapshot created: ${description} (${commitHash.trim().substring(0, 8)})`);
      return snapshot;

    } catch (error: any) {
      this.logger.error(`Failed to create snapshot: ${error.message}`);
      throw new Error(`Snapshot creation failed: ${error.message}`);
    }
  }

  /**
   * Perform intelligent rollback based on validation results
   */
  async performRollback(
    branchName: string,
    options: RollbackOptions
  ): Promise<{ success: boolean; message: string; restoredFiles: string[] }> {
    try {
      this.logger.info(`🔄 Performing ${options.type} rollback for ${branchName}`);

      const featureBranch = this.activeBranches.get(branchName);
      if (!featureBranch) {
        throw new Error(`Feature branch ${branchName} not found`);
      }

      // Ensure we're on the correct branch
      await this.execGit(`checkout ${branchName}`);

      let restoredFiles: string[] = [];
      let message = '';

      switch (options.type) {
        case 'complete':
          restoredFiles = await this.performCompleteRollback(featureBranch, options);
          message = 'Complete rollback to parent branch';
          break;

        case 'partial':
          restoredFiles = await this.performPartialRollback(featureBranch, options);
          message = `Partial rollback to snapshot: ${options.targetSnapshot || 'previous'}`;
          break;

        case 'selective':
          restoredFiles = await this.performSelectiveRollback(featureBranch, options);
          message = `Selective rollback keeping ${options.filesToKeep?.length || 0} files`;
          break;
      }

      // Create a snapshot after rollback
      await this.createSnapshot(
        branchName,
        `Rollback: ${message}`,
        false,
        restoredFiles
      );

      this.logger.info(`✅ Rollback completed: ${message}`);
      return { success: true, message, restoredFiles };

    } catch (error: any) {
      this.logger.error(`Rollback failed: ${error.message}`);
      return { success: false, message: error.message, restoredFiles: [] };
    }
  }

  /**
   * Cherry-pick successful changes from validation cycles
   */
  async cherryPickChanges(
    sourceBranch: string,
    targetBranch: string,
    commitHashes: string[]
  ): Promise<{ success: boolean; pickedCommits: string[] }> {
    try {
      this.logger.info(`🍒 Cherry-picking ${commitHashes.length} commits from ${sourceBranch} to ${targetBranch}`);

      // Switch to target branch
      await this.execGit(`checkout ${targetBranch}`);

      const pickedCommits: string[] = [];

      for (const commitHash of commitHashes) {
        try {
          await this.execGit(`cherry-pick ${commitHash}`);
          pickedCommits.push(commitHash);
          this.logger.info(`✅ Cherry-picked: ${commitHash.substring(0, 8)}`);
        } catch (error) {
          this.logger.warn(`⚠️ Failed to cherry-pick: ${commitHash.substring(0, 8)}`);
          // Continue with other commits
        }
      }

      this.logger.info(`🍒 Cherry-pick completed: ${pickedCommits.length}/${commitHashes.length} commits`);
      return { success: true, pickedCommits };

    } catch (error: any) {
      this.logger.error(`Cherry-pick failed: ${error.message}`);
      return { success: false, pickedCommits: [] };
    }
  }

  /**
   * Merge feature branch back to main after successful validation
   */
  async mergeFeatureBranch(
    branchName: string,
    squashCommits: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    try {
      const featureBranch = this.activeBranches.get(branchName);
      if (!featureBranch) {
        throw new Error(`Feature branch ${branchName} not found`);
      }

      this.logger.info(`🔀 Merging feature branch: ${branchName}`);

      // Switch to parent branch
      await this.execGit(`checkout ${featureBranch.parentBranch}`);

      // Perform merge
      if (squashCommits) {
        await this.execGit(`merge --squash ${branchName}`);
        
        // Create a single commit for the feature
        const mergeMessage = `feat: ${featureBranch.userRequest}\n\nSquashed ${featureBranch.snapshots.length} commits from ${branchName}`;
        await this.execGit(`commit -m "${mergeMessage}"`);
      } else {
        await this.execGit(`merge ${branchName} --no-ff`);
      }

      // Update branch status
      featureBranch.status = 'merged';

      this.logger.info(`✅ Feature branch merged successfully`);
      return { success: true, message: 'Branch merged successfully' };

    } catch (error: any) {
      this.logger.error(`Merge failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * Clean up old branches periodically
   */
  async cleanupBranches(
    maxAge: number = 7, // days
    keepMerged: boolean = false
  ): Promise<{ cleaned: string[]; kept: string[] }> {
    const cleaned: string[] = [];
    const kept: string[] = [];

    try {
      this.logger.info(`🧹 Cleaning up branches older than ${maxAge} days`);

      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

      for (const [branchName, featureBranch] of this.activeBranches) {
        const shouldCleanup = 
          featureBranch.created < cutoffDate && 
          (featureBranch.status === 'merged' || featureBranch.status === 'failed' || featureBranch.status === 'abandoned') &&
          (!keepMerged || featureBranch.status !== 'merged');

        if (shouldCleanup) {
          try {
            // Delete the branch
            await this.execGit(`branch -D ${branchName}`);
            this.activeBranches.delete(branchName);
            cleaned.push(branchName);
            this.logger.info(`🗑️ Cleaned up branch: ${branchName}`);
          } catch (error) {
            this.logger.warn(`Failed to cleanup branch ${branchName}:`, error);
            kept.push(branchName);
          }
        } else {
          kept.push(branchName);
        }
      }

      this.logger.info(`🧹 Cleanup complete: ${cleaned.length} cleaned, ${kept.length} kept`);
      return { cleaned, kept };

    } catch (error: any) {
      this.logger.error(`Branch cleanup failed: ${error.message}`);
      return { cleaned, kept };
    }
  }

  /**
   * Get status of all active branches
   */
  async getBranchStatus(): Promise<FeatureBranch[]> {
    return Array.from(this.activeBranches.values());
  }

  /**
   * Get detailed information about a specific branch
   */
  async getBranchInfo(branchName: string): Promise<FeatureBranch | null> {
    return this.activeBranches.get(branchName) || null;
  }

  // Private helper methods

  private async performCompleteRollback(
    featureBranch: FeatureBranch,
    options: RollbackOptions
  ): Promise<string[]> {
    // Create backup branch if requested
    if (options.createBackupBranch) {
      const backupName = `${featureBranch.branchName}-backup-${Date.now()}`;
      await this.execGit(`branch ${backupName}`);
      this.logger.info(`📋 Backup branch created: ${backupName}`);
    }

    // Reset to parent branch state
    const parentCommit = await this.getParentBranchCommit(featureBranch.parentBranch);
    await this.execGit(`reset --hard ${parentCommit}`);

    // Get list of all files that were changed
    const changedFiles = this.getAllChangedFiles(featureBranch.snapshots);
    
    featureBranch.status = 'failed';
    return changedFiles;
  }

  private async performPartialRollback(
    featureBranch: FeatureBranch,
    options: RollbackOptions
  ): Promise<string[]> {
    let targetCommit: string;

    if (options.targetSnapshot) {
      const snapshot = featureBranch.snapshots.find(s => s.commitHash.startsWith(options.targetSnapshot!));
      if (!snapshot) {
        throw new Error(`Snapshot ${options.targetSnapshot} not found`);
      }
      targetCommit = snapshot.commitHash;
    } else {
      // Use the last successful snapshot
      const lastGoodSnapshot = featureBranch.snapshots.reverse().find(s => s.validationPassed);
      if (!lastGoodSnapshot) {
        throw new Error('No successful snapshot found for partial rollback');
      }
      targetCommit = lastGoodSnapshot.commitHash;
    }

    // Reset to the target commit
    await this.execGit(`reset --hard ${targetCommit}`);

    return await this.getChangedFilesBetweenCommits('HEAD~1', 'HEAD');
  }

  private async performSelectiveRollback(
    featureBranch: FeatureBranch,
    options: RollbackOptions
  ): Promise<string[]> {
    if (!options.filesToKeep || options.filesToKeep.length === 0) {
      throw new Error('Selective rollback requires filesToKeep to be specified');
    }

    // Get the parent commit
    const parentCommit = await this.getParentBranchCommit(featureBranch.parentBranch);

    // Stash current changes
    await this.execGit('stash push -m "selective-rollback-temp"');

    // Reset to parent
    await this.execGit(`reset --hard ${parentCommit}`);

    // Restore only the specified files
    try {
      await this.execGit('stash pop');
      
      // Keep only the specified files
      for (const file of options.filesToKeep) {
        try {
          await this.execGit(`add ${file}`);
        } catch (error) {
          this.logger.warn(`Could not restore file: ${file}`);
        }
      }

      // Remove all other changes
      await this.execGit('reset HEAD .');
      await this.execGit('checkout -- .');
      
      // Re-add the files we want to keep
      for (const file of options.filesToKeep) {
        try {
          await this.execGit(`add ${file}`);
        } catch (error) {
          // File might not exist anymore
        }
      }

    } catch (error) {
      this.logger.warn('Stash pop failed, continuing with partial restore');
    }

    return options.filesToKeep;
  }

  private generateBranchName(userRequest: string, requestId?: string): string {
    const sanitized = userRequest
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const id = requestId || Math.random().toString(36).substring(2, 8);
    
    return `codemind/${sanitized}-${timestamp}-${id}`;
  }

  private generateCommitMessage(
    description: string,
    validationPassed: boolean,
    changedFiles: string[]
  ): string {
    const status = validationPassed ? '✅' : '⚠️';
    const filesList = changedFiles.length > 0 ? `\n\nFiles: ${changedFiles.join(', ')}` : '';
    
    return `${status} ${description}${filesList}\n\n🤖 Generated with CodeMind CLI`;
  }

  private async execGit(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(`git ${command}`, { cwd: this.projectPath });
    } catch (error: any) {
      throw new Error(`Git command failed: ${command}\n${error.message}`);
    }
  }

  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await this.execGit('rev-parse --abbrev-ref HEAD');
      return stdout.trim();
    } catch (error) {
      return 'main'; // Default fallback
    }
  }

  private async ensureCleanWorkingDirectory(): Promise<void> {
    try {
      const { stdout } = await this.execGit('status --porcelain');
      if (stdout.trim()) {
        // Stash any uncommitted changes
        await this.execGit('stash push -m "auto-stash-before-branch-creation"');
        this.logger.info('📦 Stashed uncommitted changes before branch creation');
      }
    } catch (error) {
      this.logger.warn('Could not check/clean working directory:', error);
    }
  }

  private async getParentBranchCommit(parentBranch: string): Promise<string> {
    const { stdout } = await this.execGit(`rev-parse ${parentBranch}`);
    return stdout.trim();
  }

  private getAllChangedFiles(snapshots: BranchSnapshot[]): string[] {
    const allFiles = new Set<string>();
    snapshots.forEach(snapshot => {
      snapshot.files.forEach(file => allFiles.add(file));
    });
    return Array.from(allFiles);
  }

  private async getChangedFilesBetweenCommits(from: string, to: string): Promise<string[]> {
    try {
      const { stdout } = await this.execGit(`diff --name-only ${from}..${to}`);
      return stdout.trim().split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }
}

export default GitBranchManager;