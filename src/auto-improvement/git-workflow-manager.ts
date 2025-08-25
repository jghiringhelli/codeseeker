import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface GitWorkflowOptions {
  projectPath: string;
  branchPrefix?: string;
  createCommit?: boolean;
  runTests?: boolean;
  requireUserApproval?: boolean;
}

export interface GitWorkflowResult {
  initialCommit?: string;
  branchName: string;
  testResults?: TestResults;
  userApproved: boolean;
  finalCommit?: string;
}

export interface TestResults {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
  testCommand: string;
}

export class GitWorkflowManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async manageWorkflow(options: GitWorkflowOptions): Promise<GitWorkflowResult> {
    const { projectPath, branchPrefix = 'codemind-autofix' } = options;
    
    // Ensure we're in a git repository
    await this?.ensureGitRepository(projectPath);

    // Create initial commit if there are uncommitted changes
    let initialCommit: string | undefined;
    if (options?.createCommit && await this?.hasUncommittedChanges(projectPath)) {
      initialCommit = await this?.createInitialCommit(projectPath);
    }

    // Create and switch to improvement branch
    const branchName = await this?.createImprovementBranch(projectPath, branchPrefix);

    // Run tests if requested
    let testResults: TestResults | undefined;
    if (options?.runTests) {
      testResults = await this?.runTests(projectPath);
    }

    // Get user approval (this will be handled by the CLI)
    const userApproved = !options?.requireUserApproval; // Default to true, CLI will handle the actual prompt

    return {
      initialCommit,
      branchName,
      testResults,
      userApproved,
    };
  }

  async finalizeWorkflow(
    projectPath: string, 
    branchName: string, 
    approved: boolean,
    commitMessage?: string
  ): Promise<string | null> {
    if (approved) {
      // Commit the improvements
      const finalCommit = await this?.commitImprovements(projectPath, commitMessage);
      this?.logger?.info(`✅ Improvements committed: ${finalCommit}`);
      
      // Offer to merge back to main branch
      const currentBranch = await this?.getCurrentBranch(projectPath);
      this?.logger?.info(`🔀 To merge improvements: git checkout main && git merge ${currentBranch}`);
      
      return finalCommit;
    } else {
      // Revert to original state
      await this?.revertToOriginalBranch(projectPath);
      this?.logger?.info('❌ Improvements rejected - reverted to original state');
      return null;
    }
  }

  private async ensureGitRepository(projectPath: string): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectPath });
    } catch (error) {
      // Initialize git repository if it doesn't exist
      this?.logger?.info('Initializing Git repository?.?.?.');
      await execAsync('git init', { cwd: projectPath });
      await execAsync('git config user?.name "CodeMind AutoFix"', { cwd: projectPath });
      await execAsync('git config user?.email "autofix@codemind?.local"', { cwd: projectPath });
    }
  }

  private async hasUncommittedChanges(projectPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
      return stdout?.trim()?.length > 0;
    } catch (error) {
      return false;
    }
  }

  private async createInitialCommit(projectPath: string): Promise<string> {
    this?.logger?.info('📝 Creating initial commit before improvements?.?.?.');
    
    try {
      // Add all files
      await execAsync('git add ?.', { cwd: projectPath });
      
      // Create commit
      const commitMessage = '🔄 Pre-CodeMind AutoFix checkpoint\n\nSaving current state before automatic improvements';
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: projectPath });
      
      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
      const commitHash = stdout?.trim();
      
      this?.logger?.info(`✅ Initial commit created: ${commitHash?.substring(0, 8)}`);
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create initial commit: ${(error as Error)?.message}`);
    }
  }

  private async createImprovementBranch(projectPath: string, branchPrefix: string): Promise<string> {
    const timestamp = new Date()?.toISOString()?.replace(/[:?.]/g, '-')?.substring(0, 19);
    const branchName = `${branchPrefix}-${timestamp}`;
    
    this?.logger?.info(`🌿 Creating improvement branch: ${branchName}`);
    
    try {
      await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });
      this?.logger?.info(`✅ Switched to branch: ${branchName}`);
      return branchName;
    } catch (error) {
      throw new Error(`Failed to create branch: ${(error as Error)?.message}`);
    }
  }

  private async runTests(projectPath: string): Promise<TestResults> {
    this?.logger?.info('🧪 Running project tests?.?.?.');
    
    // Detect test command
    const testCommand = await this?.detectTestCommand(projectPath);
    const startTime = Date?.now();
    
    try {
      const { stdout, stderr } = await execAsync(testCommand, { 
        cwd: projectPath,
        timeout: 300000 // 5 minutes timeout
      });
      
      const duration = Date?.now() - startTime;
      const output = stdout + stderr;
      
      this?.logger?.info(`✅ Tests passed in ${duration}ms`);
      
      return {
        success: true,
        output,
        exitCode: 0,
        duration,
        testCommand
      };
    } catch (error: any) {
      const duration = Date?.now() - startTime;
      const output = error?.stdout + error?.stderr;
      
      this?.logger?.warn(`❌ Tests failed in ${duration}ms`);
      
      return {
        success: false,
        output,
        exitCode: error?.code || 1,
        duration,
        testCommand
      };
    }
  }

  private async detectTestCommand(projectPath: string): Promise<string> {
    try {
      // Check package?.json for test script
      const packageJson = JSON?.parse(
        await require('fs')?.promises?.readFile(path?.join(projectPath, 'package?.json'), 'utf-8')
      );
      
      if (packageJson?.scripts?.test) {
        return 'npm test';
      }
      
      if (packageJson?.scripts?.['test:unit']) {
        return 'npm run test:unit';
      }
    } catch (error) {
      // package?.json doesn't exist or is invalid
    }
    
    // Check for common test frameworks
    const testFiles = [
      'jest?.config?.js',
      'jest?.config?.ts',
      'mocha?.opts',
      'karma?.conf?.js',
      'test',
      'tests',
      'spec'
    ];
    
    for (const testFile of testFiles) {
      try {
        await require('fs')?.promises?.access(path?.join(projectPath, testFile));
        if (testFile?.startsWith('jest')) return 'npx jest';
        if (testFile?.startsWith('mocha')) return 'npx mocha';
        if (testFile?.startsWith('karma')) return 'npx karma start';
        if (['test', 'tests', 'spec']?.includes(testFile)) return 'npm test';
      } catch (error) {
        continue;
      }
    }
    
    // Default fallback
    return 'npm test';
  }

  private async commitImprovements(projectPath: string, customMessage?: string): Promise<string> {
    this?.logger?.info('💾 Committing improvements?.?.?.');
    
    try {
      // Add all changes
      await execAsync('git add ?.', { cwd: projectPath });
      
      // Check if there are changes to commit
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });
      if (!statusOutput?.trim()) {
        throw new Error('No changes to commit');
      }
      
      // Create commit message
      const commitMessage = customMessage || this?.generateCommitMessage();
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: projectPath });
      
      // Get commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
      const commitHash = stdout?.trim();
      
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to commit improvements: ${(error as Error)?.message}`);
    }
  }

  private generateCommitMessage(): string {
    return `🔧 CodeMind Auto-Improvements Applied

✅ Automated code improvements via CodeMind AutoFix
- Duplicate code analysis and refactoring
- Configuration centralization
- Code quality enhancements
- Architecture improvements

Generated by CodeMind Auto-Improvement Mode
Co-Authored-By: CodeMind <autofix@codemind?.local>`;
  }

  private async getCurrentBranch(projectPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: projectPath });
      return stdout?.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${(error as Error)?.message}`);
    }
  }

  private async revertToOriginalBranch(projectPath: string): Promise<void> {
    try {
      // Get the original branch (usually main or master)
      const { stdout } = await execAsync('git branch -r', { cwd: projectPath });
      const remoteBranches = stdout?.split('\n')?.map(b => b?.trim());
      
      let originalBranch = 'main';
      if (remoteBranches?.some(b => b?.includes('origin/master'))) {
        originalBranch = 'master';
      }
      
      // Switch back to original branch
      await execAsync(`git checkout ${originalBranch}`, { cwd: projectPath });
      
      // Delete the improvement branch
      const currentBranch = await this?.getCurrentBranch(projectPath);
      if (currentBranch?.startsWith('codemind-autofix-')) {
        await execAsync(`git branch -D ${currentBranch}`, { cwd: projectPath });
      }
    } catch (error) {
      this?.logger?.warn(`Warning: Could not fully revert to original state: ${(error as Error)?.message}`);
    }
  }

  async getGitStatus(projectPath: string): Promise<{
    isGitRepo: boolean;
    currentBranch: string;
    hasChanges: boolean;
    lastCommit?: string;
  }> {
    try {
      const isGitRepo = await execAsync('git rev-parse --git-dir', { cwd: projectPath })
        ?.then(() => true)
        ?.catch(() => false);

      if (!isGitRepo) {
        return { isGitRepo: false, currentBranch: '', hasChanges: false };
      }

      const currentBranch = await this?.getCurrentBranch(projectPath);
      const hasChanges = await this?.hasUncommittedChanges(projectPath);
      
      let lastCommit: string | undefined;
      try {
        const { stdout } = await execAsync('git log -1 --format="%h %s"', { cwd: projectPath });
        lastCommit = stdout?.trim();
      } catch (error) {
        lastCommit = undefined;
      }

      return {
        isGitRepo: true,
        currentBranch,
        hasChanges,
        lastCommit
      };
    } catch (error) {
      return { isGitRepo: false, currentBranch: '', hasChanges: false };
    }
  }
}