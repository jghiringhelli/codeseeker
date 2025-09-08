#!/usr/bin/env node
"use strict";
/**
 * CodeMind Orchestrated CLI - Complete Impact-Driven Workflow
 *
 * Implements the full orchestration system:
 * 1. Comprehensive impact analysis (all affected files)
 * 2. Git branch-based workflow with snapshots
 * 3. Task-specific file instructions for Claude Code
 * 4. Intelligent rollback and recovery
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const logger_1 = require("../utils/logger");
const cli_logger_1 = require("../utils/cli-logger");
const task_specific_file_orchestrator_1 = require("../shared/task-specific-file-orchestrator");
const git_branch_manager_1 = require("../shared/git-branch-manager");
const comprehensive_impact_analyzer_1 = require("../shared/comprehensive-impact-analyzer");
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
const logger = logger_1.Logger.getInstance();
const cliLogger = cli_logger_1.CLILogger.getInstance();
class CodeMindOrchestratedCLI {
    orchestrator;
    branchManager;
    impactAnalyzer;
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.orchestrator = new task_specific_file_orchestrator_1.TaskSpecificFileOrchestrator(projectPath);
        this.branchManager = new git_branch_manager_1.GitBranchManager(projectPath);
        this.impactAnalyzer = new comprehensive_impact_analyzer_1.ComprehensiveImpactAnalyzer();
    }
    /**
     * Main orchestrated request processing
     */
    async processRequest(userRequest, options = {}) {
        const startTime = Date.now();
        try {
            cliLogger.info(chalk_1.default.blue('🎭 CodeMind Orchestrated Processing'));
            cliLogger.info(chalk_1.default.gray(`Request: "${userRequest}"`));
            cliLogger.info('');
            // Run full orchestration
            const result = await this.orchestrator.orchestrateRequest(this.projectPath, userRequest, options);
            // Display comprehensive results
            return this.formatOrchestrationResults(result);
        }
        catch (error) {
            logger.error('Orchestrated processing failed:', error);
            return this.formatError(error.message);
        }
    }
    /**
     * Interactive mode - show impact and confirm before execution
     */
    async processInteractiveRequest(userRequest) {
        try {
            cliLogger.info(chalk_1.default.blue('🔍 Interactive Impact Analysis'));
            cliLogger.info(chalk_1.default.gray(`Analyzing: "${userRequest}"`));
            cliLogger.info('');
            // 1. Show comprehensive impact analysis
            const impactResult = await this.impactAnalyzer.analyzeCompleteImpact(this.projectPath, userRequest);
            // 2. Display impact summary
            this.displayImpactSummary(impactResult);
            // 3. Show what Claude Code will do
            cliLogger.info(chalk_1.default.yellow('📋 Specific Tasks for Claude Code:'));
            const fileTasks = this.convertImpactToTasks(impactResult, userRequest);
            this.displayFileTasks(fileTasks);
            // 4. Ask for confirmation (simulated for now)
            cliLogger.info('');
            cliLogger.info(chalk_1.default.green('✨ This is what CodeMind will execute:'));
            cliLogger.info('');
            // For demo purposes, show what would happen
            return this.formatInteractivePreview(impactResult, fileTasks);
        }
        catch (error) {
            logger.error('Interactive processing failed:', error);
            return this.formatError(error.message);
        }
    }
    /**
     * Branch management operations
     */
    async manageBranches(action, branchName) {
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
        }
        catch (error) {
            logger.error(`Branch management failed: ${error.message}`);
            return this.formatError(error.message);
        }
    }
    /**
     * Show detailed status of orchestration system
     */
    async showSystemStatus() {
        try {
            const status = {
                projectPath: this.projectPath,
                gitStatus: await this.getGitStatus(),
                activeBranches: await this.branchManager.getBranchStatus(),
                systemHealth: await this.checkSystemHealth()
            };
            return this.formatSystemStatus(status);
        }
        catch (error) {
            return this.formatError(`Status check failed: ${error.message}`);
        }
    }
    // Private helper methods
    displayImpactSummary(impactResult) {
        cliLogger.info(chalk_1.default.cyan('📊 Complete Impact Analysis:'));
        cliLogger.info('');
        if (impactResult.primaryFiles.length > 0) {
            cliLogger.info(chalk_1.default.green(`📝 Primary Files (${impactResult.primaryFiles.length}):`));
            impactResult.primaryFiles.slice(0, 5).forEach((file) => {
                cliLogger.info(`   • ${file.filePath} (${file.priority})`);
            });
            if (impactResult.primaryFiles.length > 5) {
                cliLogger.info(`   ... and ${impactResult.primaryFiles.length - 5} more`);
            }
            cliLogger.info('');
        }
        if (impactResult.cascadingFiles.length > 0) {
            cliLogger.info(chalk_1.default.yellow(`🔄 Cascading Effects (${impactResult.cascadingFiles.length}):`));
            impactResult.cascadingFiles.slice(0, 3).forEach((file) => {
                cliLogger.info(`   • ${file.filePath} (${file.priority})`);
            });
            if (impactResult.cascadingFiles.length > 3) {
                cliLogger.info(`   ... and ${impactResult.cascadingFiles.length - 3} more`);
            }
            cliLogger.info('');
        }
        if (impactResult.configurationFiles.length > 0) {
            cliLogger.info(chalk_1.default.blue(`⚙️ Configuration (${impactResult.configurationFiles.length}):`));
            impactResult.configurationFiles.forEach((file) => {
                cliLogger.info(`   • ${file.filePath}`);
            });
            cliLogger.info('');
        }
        if (impactResult.testFiles.length > 0) {
            cliLogger.info(chalk_1.default.magenta(`🧪 Tests (${impactResult.testFiles.length}):`));
            impactResult.testFiles.forEach((file) => {
                cliLogger.info(`   • ${file.filePath}`);
            });
            cliLogger.info('');
        }
        cliLogger.info(chalk_1.default.white(`📈 Summary: ${impactResult.totalFiles} total files, Risk: ${impactResult.riskLevel}, Est: ${impactResult.estimatedTime}`));
        cliLogger.info('');
    }
    displayFileTasks(fileTasks) {
        const priorityColors = {
            critical: chalk_1.default.red,
            high: chalk_1.default.yellow,
            medium: chalk_1.default.blue,
            low: chalk_1.default.gray
        };
        fileTasks.slice(0, 10).forEach((task, index) => {
            const priorityColor = priorityColors[task.priority];
            cliLogger.info(priorityColor(`${index + 1}. ${task.filePath} (${task.priority})`));
            cliLogger.info(chalk_1.default.gray(`   Task: ${task.specificTask}`));
            cliLogger.info(chalk_1.default.gray(`   Type: ${task.changeType} ${task.fileType}`));
            if (task.dependencies.length > 0) {
                cliLogger.info(chalk_1.default.gray(`   Depends on: ${task.dependencies.join(', ')}`));
            }
            cliLogger.info('');
        });
        if (fileTasks.length > 10) {
            cliLogger.info(chalk_1.default.gray(`... and ${fileTasks.length - 10} more tasks`));
        }
    }
    convertImpactToTasks(impactResult, userRequest) {
        // Convert impact analysis to file tasks (simplified version of orchestrator logic)
        const tasks = [];
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
    formatOrchestrationResults(result) {
        const lines = [];
        if (result.success) {
            lines.push(chalk_1.default.green('✅ Orchestration Completed Successfully'));
        }
        else {
            lines.push(chalk_1.default.red('❌ Orchestration Failed'));
        }
        lines.push('');
        lines.push(`🌿 Branch: ${result.branchName}`);
        lines.push(`⏱️ Duration: ${result.estimatedTimeActual}`);
        lines.push(`📊 Completed: ${result.completedTasks.length}, Failed: ${result.failedTasks.length}`);
        if (result.rollbackPerformed) {
            lines.push(chalk_1.default.yellow('🔄 Rollback performed'));
        }
        // Integration results
        if (result.integrationResult) {
            lines.push('');
            if (result.integrationResult.success) {
                lines.push(chalk_1.default.green('🔧 Post-Execution Integration: ✅ Complete'));
            }
            else {
                lines.push(chalk_1.default.yellow(`🔧 Post-Execution Integration: ⚠️ ${result.integrationResult.phase} phase`));
            }
            const integrationDetails = [];
            if (result.integrationResult.compilationFixed)
                integrationDetails.push('✅ Compilation fixed');
            if (result.integrationResult.testsFixed)
                integrationDetails.push('✅ Tests fixed');
            if (result.integrationResult.changesCommitted)
                integrationDetails.push('✅ Changes committed');
            if (result.integrationResult.branchMerged)
                integrationDetails.push('✅ Branch merged');
            if (result.integrationResult.documentationUpdated)
                integrationDetails.push('✅ Docs updated');
            if (result.integrationResult.configUpdated)
                integrationDetails.push('✅ Config updated');
            if (result.integrationResult.deploymentUpdated)
                integrationDetails.push('✅ Deployment updated');
            if (result.integrationResult.nextSnapshotReady)
                integrationDetails.push('✅ Next snapshot ready');
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
        lines.push(chalk_1.default.white(result.message));
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
    formatInteractivePreview(impactResult, fileTasks) {
        const lines = [];
        lines.push(chalk_1.default.green('🎯 Orchestration Preview'));
        lines.push('');
        lines.push(chalk_1.default.blue('What will happen when you run this request:'));
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
        lines.push(chalk_1.default.cyan('🎛️ Available options:'));
        lines.push('  --force          Skip validation failures');
        lines.push('  --skip-cycles    Skip validation cycles');
        lines.push('  --dry-run        Show what would happen without executing');
        lines.push('  --auto-rollback  Automatically rollback on validation failure');
        lines.push('');
        lines.push(chalk_1.default.yellow('⚡ To execute: npm run codemind:orchestrated <request>'));
        lines.push(chalk_1.default.yellow('📋 To see tasks: npm run codemind:orchestrated --dry-run <request>'));
        return lines.join('\n');
    }
    formatBranchList(branches) {
        const lines = [];
        lines.push(chalk_1.default.blue('🌿 Active Feature Branches:'));
        lines.push('');
        if (branches.length === 0) {
            lines.push(chalk_1.default.gray('No active feature branches'));
        }
        else {
            branches.forEach(branch => {
                const statusColor = branch.status === 'active' ? chalk_1.default.green :
                    branch.status === 'merged' ? chalk_1.default.blue :
                        branch.status === 'failed' ? chalk_1.default.red : chalk_1.default.gray;
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
    formatCleanupResults(cleanupResult) {
        const lines = [];
        lines.push(chalk_1.default.green('🧹 Branch Cleanup Results:'));
        lines.push('');
        lines.push(`✅ Cleaned: ${cleanupResult.cleaned.length} branches`);
        lines.push(`📌 Kept: ${cleanupResult.kept.length} branches`);
        if (cleanupResult.cleaned.length > 0) {
            lines.push('');
            lines.push('🗑️ Cleaned branches:');
            cleanupResult.cleaned.forEach((branch) => {
                lines.push(`   • ${branch}`);
            });
        }
        return lines.join('\n');
    }
    formatMergeResults(mergeResult) {
        if (mergeResult.success) {
            return chalk_1.default.green(`✅ Branch merged successfully: ${mergeResult.message}`);
        }
        else {
            return chalk_1.default.red(`❌ Merge failed: ${mergeResult.message}`);
        }
    }
    formatSystemStatus(status) {
        const lines = [];
        lines.push(chalk_1.default.blue('🎛️ CodeMind Orchestration System Status'));
        lines.push('');
        lines.push(`📂 Project: ${status.projectPath}`);
        lines.push(`🌿 Git: ${status.gitStatus}`);
        lines.push(`🔧 Active Branches: ${status.activeBranches.length}`);
        lines.push(`❤️ System Health: ${status.systemHealth}`);
        return lines.join('\n');
    }
    formatError(message) {
        return chalk_1.default.red(`❌ Error: ${message}`);
    }
    async getGitStatus() {
        try {
            const result = (0, child_process_1.execSync)('git status --porcelain', {
                cwd: this.projectPath,
                encoding: 'utf8'
            });
            return result.trim() ? 'Modified files present' : 'Clean';
        }
        catch (error) {
            return 'Git not available';
        }
    }
    async checkSystemHealth() {
        // Basic health checks
        try {
            await fs.access(this.projectPath);
            return 'Healthy';
        }
        catch (error) {
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
    .action(async (request, options) => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    const result = await cli.processRequest(request, options);
    console.log(result);
});
program
    .command('preview')
    .description('Interactive preview of what would happen')
    .argument('<request>', 'User request to preview')
    .action(async (request) => {
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
    .action(async (action, branch) => {
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    const result = await cli.manageBranches(action, branch);
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
    .action(async (request, options) => {
    if (!request) {
        program.help();
        return;
    }
    const projectPath = process.cwd();
    const cli = new CodeMindOrchestratedCLI(projectPath);
    if (options?.interactive) {
        const result = await cli.processInteractiveRequest(request);
        console.log(result);
    }
    else {
        const result = await cli.processRequest(request, options);
        console.log(result);
    }
});
// Error handling
program.exitOverride();
try {
    program.parse();
}
catch (error) {
    console.error(chalk_1.default.red(`CLI Error: ${error.message}`));
    process.exit(1);
}
exports.default = CodeMindOrchestratedCLI;
//# sourceMappingURL=codemind-orchestrated.js.map