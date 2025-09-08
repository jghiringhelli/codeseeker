#!/usr/bin/env node

/**
 * CodeMind Orchestrated CLI - Complete Impact-Driven Workflow
 * 
 * Implements the full orchestration system:
 * 1. Comprehensive impact analysis (all affected files)
 * 2. Git branch-based workflow with snapshots
 * 3. Task-specific file instructions for Claude Code
 * 4. Intelligent rollback and recovery
 */

import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { CLILogger } from '../utils/cli-logger';
import { TaskSpecificFileOrchestrator, OrchestrationResult, FileTask } from '../shared/task-specific-file-orchestrator';
import { GitBranchManager } from '../shared/git-branch-manager';
import { ComprehensiveImpactAnalyzer } from '../shared/comprehensive-impact-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const program = new Command();
const logger = Logger.getInstance();
const cliLogger = CLILogger.getInstance();

class CodeMindOrchestratedCLI {
  private orchestrator: TaskSpecificFileOrchestrator;
  private branchManager: GitBranchManager;
  private impactAnalyzer: ComprehensiveImpactAnalyzer;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.orchestrator = new TaskSpecificFileOrchestrator(projectPath);
    this.branchManager = new GitBranchManager(projectPath);
    this.impactAnalyzer = new ComprehensiveImpactAnalyzer();
  }

  /**
   * Main orchestrated request processing
   */
  async processRequest(
    userRequest: string,
    options: {
      force?: boolean;
      skipCycles?: boolean;
      dryRun?: boolean;
      autoRollback?: boolean;
      interactive?: boolean;
    } = {}
  ): Promise<string> {
    const startTime = Date.now();

    try {
      cliLogger.info(chalk.blue('🎭 CodeMind Orchestrated Processing'));
      cliLogger.info(chalk.gray(`Request: "${userRequest}"`));
      cliLogger.info('');

      // Run full orchestration
      const result = await this.orchestrator.orchestrateRequest(
        this.projectPath,
        userRequest,
        options
      );

      // Display comprehensive results
      return this.formatOrchestrationResults(result);

    } catch (error: any) {
      logger.error('Orchestrated processing failed:', error);
      return this.formatError(error.message);
    }
  }

  /**
   * Interactive mode - show impact and confirm before execution
   */
  async processInteractiveRequest(userRequest: string): Promise<string> {
    try {
      cliLogger.info(chalk.blue('🔍 Interactive Impact Analysis'));
      cliLogger.info(chalk.gray(`Analyzing: "${userRequest}"`));
      cliLogger.info('');

      // 1. Show comprehensive impact analysis
      const impactResult = await this.impactAnalyzer.analyzeCompleteImpact(
        this.projectPath,
        userRequest
      );

      // 2. Display impact summary
      this.displayImpactSummary(impactResult);

      // 3. Show what Claude Code will do
      cliLogger.info(chalk.yellow('📋 Specific Tasks for Claude Code:'));
      const fileTasks = this.convertImpactToTasks(impactResult, userRequest);
      this.displayFileTasks(fileTasks);

      // 4. Ask for confirmation (simulated for now)
      cliLogger.info('');
      cliLogger.info(chalk.green('✨ This is what CodeMind will execute:'));
      cliLogger.info('');
      
      // For demo purposes, show what would happen
      return this.formatInteractivePreview(impactResult, fileTasks);

    } catch (error: any) {
      logger.error('Interactive processing failed:', error);
      return this.formatError(error.message);
    }
  }

  /**
   * Branch management operations
   */
  async manageBranches(action: 'list' | 'cleanup' | 'merge', branchName?: string): Promise<string> {
    try {
      switch (action) {
        case 'list':
          const branches = await this.branchManager.getBranchStatus();
          return this.formatBranchList(branches);

        case 'cleanup':
          const cleanupResult = await this.branchManager.cleanupBranches(7, false);
          return this.formatCleanupResults(cleanupResult);

        case 'merge':
          if (!branchName) {
            throw new Error('Branch name required for merge operation');
          }
          const mergeResult = await this.branchManager.mergeFeatureBranch(branchName, true);
          return this.formatMergeResults(mergeResult);

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      logger.error(`Branch management failed: ${error.message}`);
      return this.formatError(error.message);
    }
  }

  /**
   * Show detailed status of orchestration system
   */
  async showSystemStatus(): Promise<string> {
    try {
      const status = {
        projectPath: this.projectPath,
        gitStatus: await this.getGitStatus(),
        activeBranches: await this.branchManager.getBranchStatus(),
        systemHealth: await this.checkSystemHealth()
      };

      return this.formatSystemStatus(status);
    } catch (error: any) {
      return this.formatError(`Status check failed: ${error.message}`);
    }
  }

  // Private helper methods

  private displayImpactSummary(impactResult: any): void {
    cliLogger.info(chalk.cyan('📊 Complete Impact Analysis:'));
    cliLogger.info('');
    
    if (impactResult.primaryFiles.length > 0) {
      cliLogger.info(chalk.green(`📝 Primary Files (${impactResult.primaryFiles.length}):`));
      impactResult.primaryFiles.slice(0, 5).forEach((file: any) => {
        cliLogger.info(`   • ${file.filePath} (${file.priority})`);
      });
      if (impactResult.primaryFiles.length > 5) {
        cliLogger.info(`   ... and ${impactResult.primaryFiles.length - 5} more`);
      }
      cliLogger.info('');
    }

    if (impactResult.cascadingFiles.length > 0) {
      cliLogger.info(chalk.yellow(`🔄 Cascading Effects (${impactResult.cascadingFiles.length}):`));
      impactResult.cascadingFiles.slice(0, 3).forEach((file: any) => {
        cliLogger.info(`   • ${file.filePath} (${file.priority})`);
      });
      if (impactResult.cascadingFiles.length > 3) {
        cliLogger.info(`   ... and ${impactResult.cascadingFiles.length - 3} more`);
      }
      cliLogger.info('');
    }

    if (impactResult.configurationFiles.length > 0) {
      cliLogger.info(chalk.blue(`⚙️ Configuration (${impactResult.configurationFiles.length}):`));
      impactResult.configurationFiles.forEach((file: any) => {
        cliLogger.info(`   • ${file.filePath}`);
      });
      cliLogger.info('');
    }

    if (impactResult.testFiles.length > 0) {
      cliLogger.info(chalk.magenta(`🧪 Tests (${impactResult.testFiles.length}):`));
      impactResult.testFiles.forEach((file: any) => {
        cliLogger.info(`   • ${file.filePath}`);
      });
      cliLogger.info('');
    }

    cliLogger.info(chalk.white(`📈 Summary: ${impactResult.totalFiles} total files, Risk: ${impactResult.riskLevel}, Est: ${impactResult.estimatedTime}`));
    cliLogger.info('');
  }

  private displayFileTasks(fileTasks: FileTask[]): void {
    const priorityColors = {
      critical: chalk.red,
      high: chalk.yellow,
      medium: chalk.blue,
      low: chalk.gray
    };

    fileTasks.slice(0, 10).forEach((task, index) => {
      const priorityColor = priorityColors[task.priority];
      cliLogger.info(priorityColor(`${index + 1}. ${task.filePath} (${task.priority})`));
      cliLogger.info(chalk.gray(`   Task: ${task.specificTask}`));
      cliLogger.info(chalk.gray(`   Type: ${task.changeType} ${task.fileType}`));
      if (task.dependencies.length > 0) {
        cliLogger.info(chalk.gray(`   Depends on: ${task.dependencies.join(', ')}`));
      }
      cliLogger.info('');
    });

    if (fileTasks.length > 10) {
      cliLogger.info(chalk.gray(`... and ${fileTasks.length - 10} more tasks`));
    }
  }

  private convertImpactToTasks(impactResult: any, userRequest: string): FileTask[] {
    // Convert impact analysis to file tasks (simplified version of orchestrator logic)
    const tasks: FileTask[] = [];

    const allFiles = [
      ...impactResult.primaryFiles,
      ...impactResult.cascadingFiles,
      ...impactResult.configurationFiles,
      ...impactResult.documentationFiles,
      ...impactResult.testFiles,
      ...impactResult.deploymentFiles
    ];

    for (const file of allFiles) {
      tasks.push({
        filePath: file.filePath,
        specificTask: file.specificTask,
        priority: file.priority,
        estimatedComplexity: file.estimatedComplexity,
        dependencies: file.dependencies,
        fileType: file.fileType,
        changeType: file.changeType,
        claudeInstructions: `Update ${file.filePath} according to: ${userRequest}`,
        validationCriteria: [`File ${file.filePath} updated successfully`]
      });
    }

    return tasks;
  }

  private formatOrchestrationResults(result: OrchestrationResult): string {
    const lines: string[] = [];

    if (result.success) {
      lines.push(chalk.green('✅ Orchestration Completed Successfully'));
    } else {
      lines.push(chalk.red('❌ Orchestration Failed'));
    }

    lines.push('');
    lines.push(`🌿 Branch: ${result.branchName}`);
    lines.push(`⏱️ Duration: ${result.estimatedTimeActual}`);
    lines.push(`📊 Completed: ${result.completedTasks.length}, Failed: ${result.failedTasks.length}`);
    
    if (result.rollbackPerformed) {
      lines.push(chalk.yellow('🔄 Rollback performed'));
    }

    // Integration results
    if (result.integrationResult) {
      lines.push('');
      if (result.integrationResult.success) {
        lines.push(chalk.green('🔧 Post-Execution Integration: ✅ Complete'));
      } else {
        lines.push(chalk.yellow(`🔧 Post-Execution Integration: ⚠️ ${result.integrationResult.phase} phase`));
      }

      const integrationDetails = [];
      if (result.integrationResult.compilationFixed) integrationDetails.push('✅ Compilation fixed');
      if (result.integrationResult.testsFixed) integrationDetails.push('✅ Tests fixed');
      if (result.integrationResult.changesCommitted) integrationDetails.push('✅ Changes committed');
      if (result.integrationResult.branchMerged) integrationDetails.push('✅ Branch merged');
      if (result.integrationResult.documentationUpdated) integrationDetails.push('✅ Docs updated');
      if (result.integrationResult.configUpdated) integrationDetails.push('✅ Config updated');
      if (result.integrationResult.deploymentUpdated) integrationDetails.push('✅ Deployment updated');
      if (result.integrationResult.nextSnapshotReady) integrationDetails.push('✅ Next snapshot ready');

      if (integrationDetails.length > 0) {
        lines.push('   ' + integrationDetails.join(', '));
      }

      if (result.integrationResult.fixesApplied.length > 0) {
        lines.push('');
        lines.push('🔧 Automatic Fixes Applied:');
        result.integrationResult.fixesApplied.forEach(fix => {
          lines.push(`   • ${fix}`);
        });
      }
    }

    lines.push('');
    lines.push(chalk.white(result.message));

    if (result.snapshots.length > 0) {
      lines.push('');
      lines.push('📸 Snapshots created:');
      result.snapshots.forEach(snapshot => {
        const status = snapshot.validationPassed ? '✅' : '⚠️';
        lines.push(`   ${status} ${snapshot.description} (${snapshot.commitHash.substring(0, 8)})`);
      });
    }

    if (result.nextSteps.length > 0) {
      lines.push('');
      lines.push('🚀 Next Steps:');
      result.nextSteps.forEach(step => {
        lines.push(`   • ${step}`);
      });
    }

    return lines.join('\n');
  }

  private formatInteractivePreview(impactResult: any, fileTasks: FileTask[]): string {
    const lines: string[] = [];

    lines.push(chalk.green('🎯 Orchestration Preview'));
    lines.push('');
    lines.push(chalk.blue('What will happen when you run this request:'));
    lines.push('');

    lines.push('1. 🌿 Create feature branch');
    lines.push('2. 📸 Take initial snapshot');
    lines.push('3. 🔍 Run validation cycles');
    lines.push(`4. ⚡ Execute ${fileTasks.length} file tasks in priority order`);
    lines.push('5. 📸 Take incremental snapshots');
    lines.push('6. 🔬 Run post-execution validation');
    lines.push('7. 🔄 Auto-rollback if validation fails (optional)');
    lines.push('8. ✅ Provide comprehensive results');

    lines.push('');
    lines.push(chalk.cyan('🎛️ Available options:'));
    lines.push('  --force          Skip validation failures');
    lines.push('  --skip-cycles    Skip validation cycles');
    lines.push('  --dry-run        Show what would happen without executing');
    lines.push('  --auto-rollback  Automatically rollback on validation failure');

    lines.push('');
    lines.push(chalk.yellow('⚡ To execute: npm run codemind:orchestrated <request>'));
    lines.push(chalk.yellow('📋 To see tasks: npm run codemind:orchestrated --dry-run <request>'));

    return lines.join('\n');
  }

  private formatBranchList(branches: any[]): string {
    const lines: string[] = [];
    
    lines.push(chalk.blue('🌿 Active Feature Branches:'));
    lines.push('');

    if (branches.length === 0) {
      lines.push(chalk.gray('No active feature branches'));
    } else {
      branches.forEach(branch => {
        const statusColor = branch.status === 'active' ? chalk.green : 
                          branch.status === 'merged' ? chalk.blue : 
                          branch.status === 'failed' ? chalk.red : chalk.gray;
        
        lines.push(statusColor(`📍 ${branch.branchName}`));
        lines.push(`   Request: ${branch.userRequest}`);
        lines.push(`   Status: ${branch.status}`);
        lines.push(`   Created: ${new Date(branch.created).toLocaleString()}`);
        lines.push(`   Snapshots: ${branch.snapshots.length}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private formatCleanupResults(cleanupResult: any): string {
    const lines: string[] = [];
    
    lines.push(chalk.green('🧹 Branch Cleanup Results:'));
    lines.push('');
    lines.push(`✅ Cleaned: ${cleanupResult.cleaned.length} branches`);
    lines.push(`📌 Kept: ${cleanupResult.kept.length} branches`);

    if (cleanupResult.cleaned.length > 0) {
      lines.push('');
      lines.push('🗑️ Cleaned branches:');
      cleanupResult.cleaned.forEach((branch: string) => {
        lines.push(`   • ${branch}`);
      });
    }

    return lines.join('\n');
  }

  private formatMergeResults(mergeResult: any): string {
    if (mergeResult.success) {
      return chalk.green(`✅ Branch merged successfully: ${mergeResult.message}`);
    } else {
      return chalk.red(`❌ Merge failed: ${mergeResult.message}`);
    }
  }

  private formatSystemStatus(status: any): string {
    const lines: string[] = [];

    lines.push(chalk.blue('🎛️ CodeMind Orchestration System Status'));
    lines.push('');
    lines.push(`📂 Project: ${status.projectPath}`);
    lines.push(`🌿 Git: ${status.gitStatus}`);
    lines.push(`🔧 Active Branches: ${status.activeBranches.length}`);
    lines.push(`❤️ System Health: ${status.systemHealth}`);

    return lines.join('\n');
  }

  private formatError(message: string): string {
    return chalk.red(`❌ Error: ${message}`);
  }

  private async getGitStatus(): Promise<string> {
    try {
      const result = execSync('git status --porcelain', { 
        cwd: this.projectPath,
        encoding: 'utf8'
      });
      return result.trim() ? 'Modified files present' : 'Clean';
    } catch (error) {
      return 'Git not available';
    }
  }

  private async checkSystemHealth(): Promise<string> {
    // Basic health checks
    try {
      await fs.access(this.projectPath);
      return 'Healthy';
    } catch (error) {
      return 'Issues detected';
    }
  }
}

// CLI Command Setup
program
  .name('codemind-orchestrated')
  .description('CodeMind Orchestrated CLI - Complete Impact-Driven Workflow')
  .version('1.0.0');

program
  .command('process')
  .description('Process a request with full orchestration')
  .argument('<request>', 'User request to process')
  .option('--force', 'Skip validation failures')
  .option('--skip-cycles', 'Skip validation cycles')
  .option('--dry-run', 'Show what would happen without executing')
  .option('--auto-rollback', 'Automatically rollback on validation failure')
  .action(async (request: string, options: any) => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    
    const result = await cli.processRequest(request, options);
    console.log(result);
  });

program
  .command('preview')
  .description('Interactive preview of what would happen')
  .argument('<request>', 'User request to preview')
  .action(async (request: string) => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    
    const result = await cli.processInteractiveRequest(request);
    console.log(result);
  });

program
  .command('branches')
  .description('Manage feature branches')
  .argument('<action>', 'Action: list, cleanup, merge')
  .argument('[branch]', 'Branch name (required for merge)')
  .action(async (action: string, branch?: string) => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    
    const result = await cli.manageBranches(action as any, branch);
    console.log(result);
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    
    const result = await cli.showSystemStatus();
    console.log(result);
  });

// Default command
program
  .argument('[request]', 'User request to process')
  .option('--force', 'Skip validation failures')
  .option('--skip-cycles', 'Skip validation cycles')
  .option('--dry-run', 'Show what would happen without executing')
  .option('--auto-rollback', 'Automatically rollback on validation failure')
  .option('--interactive', 'Interactive mode with preview')
  .action(async (request?: string, options?: any) => {
    if (!request) {
      program.help();
      return;
    }

    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    
    if (options?.interactive) {
      const result = await cli.processInteractiveRequest(request);
      console.log(result);
    } else {
      const result = await cli.processRequest(request, options);
      console.log(result);
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  console.error(chalk.red(`CLI Error: ${error.message}`));
  process.exit(1);
}

export default CodeMindOrchestratedCLI;