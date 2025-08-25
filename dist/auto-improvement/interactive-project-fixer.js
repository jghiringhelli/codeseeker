"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveProjectFixer = void 0;
const readline = __importStar(require("readline"));
const project_fixer_1 = require("./project-fixer");
const git_workflow_manager_1 = require("./git-workflow-manager");
const logger_1 = require("../utils/logger");
class InteractiveProjectFixer {
    logger;
    projectFixer;
    gitWorkflow;
    rl;
    constructor() {
        this.logger = new logger_1.Logger();
        this.projectFixer = new project_fixer_1.ProjectFixer();
        this.gitWorkflow = new git_workflow_manager_1.GitWorkflowManager();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    async analyzeAndFixInteractive(options) {
        const startTime = Date.now();
        this.logger.info(`🚀 Starting CodeMind Auto-Improvement for: ${options.projectPath}`);
        try {
            // Phase 1: Git Setup and Initial State
            console.log('\n🔄 Phase 1: Git Repository Setup');
            const gitStatus = await this.gitWorkflow.getGitStatus(options.projectPath);
            if (!gitStatus.isGitRepo && !options.skipGitWorkflow) {
                console.log('📋 This project is not a Git repository. Initializing...');
            }
            // Phase 2: Initial Analysis (Dry Run First)
            console.log('\n📊 Phase 2: Project Analysis');
            console.log('Running initial analysis to identify improvement opportunities...');
            const dryRunOptions = { ...options, dryRun: true };
            const analysisReport = await this.projectFixer.analyzeAndFix(dryRunOptions);
            // Display analysis results
            this.displayAnalysisResults(analysisReport);
            // Ask user if they want to proceed
            if (options.interactive && !options.autoApprove) {
                const proceed = await this.askUserConfirmation('\n🤔 Do you want to apply these improvements to your project?', 'This will create a new Git branch and apply the suggested fixes.');
                if (!proceed) {
                    console.log('❌ Auto-improvement cancelled by user.');
                    this.rl.close();
                    return {
                        ...analysisReport,
                        gitWorkflow: { branchName: '', userApproved: false },
                        userApproved: false
                    };
                }
            }
            // Phase 3: Git Workflow Setup
            let gitWorkflowResult = { branchName: '', userApproved: true };
            if (!options.skipGitWorkflow) {
                console.log('\n🌿 Phase 3: Git Workflow Setup');
                console.log('Setting up Git branch for improvements...');
                const gitOptions = {
                    projectPath: options.projectPath,
                    branchPrefix: 'codemind-autofix',
                    createCommit: gitStatus.hasChanges,
                    runTests: !options.skipTests,
                    requireUserApproval: options.interactive && !options.autoApprove
                };
                gitWorkflowResult = await this.gitWorkflow.manageWorkflow(gitOptions);
                if (gitWorkflowResult.initialCommit) {
                    console.log(`✅ Created checkpoint commit: ${gitWorkflowResult.initialCommit.substring(0, 8)}`);
                }
                console.log(`✅ Created improvement branch: ${gitWorkflowResult.branchName}`);
            }
            // Phase 4: Apply Improvements
            console.log('\n⚡ Phase 4: Applying Improvements');
            console.log('Applying fixes to your project...');
            const liveOptions = { ...options, dryRun: false };
            const improvementReport = await this.projectFixer.analyzeAndFix(liveOptions);
            // Phase 5: Run Tests
            let testResults;
            if (!options.skipTests && gitWorkflowResult.testResults) {
                console.log('\n🧪 Phase 5: Testing Changes');
                testResults = gitWorkflowResult.testResults;
                this.displayTestResults(testResults);
                if (!testResults.success && options.interactive) {
                    const continueAnyway = await this.askUserConfirmation('\n⚠️  Tests failed. Do you want to continue anyway?', 'You can fix the test failures manually or revert the changes.');
                    if (!continueAnyway) {
                        console.log('❌ Reverting changes due to test failures...');
                        await this.gitWorkflow.finalizeWorkflow(options.projectPath, gitWorkflowResult.branchName, false);
                        this.rl.close();
                        return {
                            ...improvementReport,
                            gitWorkflow: { ...gitWorkflowResult, userApproved: false },
                            userApproved: false,
                            testResults
                        };
                    }
                }
            }
            // Phase 6: Final Review and Confirmation
            console.log('\n📋 Phase 6: Final Review');
            this.displayFinalSummary(improvementReport, testResults);
            let userApproved = true;
            if (options.interactive && !options.autoApprove) {
                userApproved = await this.askUserConfirmation('\n✅ Do you want to commit these improvements?', 'This will create a commit with all the applied fixes. You can always revert later.');
            }
            // Phase 7: Finalize
            console.log('\n💾 Phase 7: Finalizing Changes');
            let finalCommitHash = null;
            if (!options.skipGitWorkflow) {
                const commitMessage = this.generateCustomCommitMessage(improvementReport);
                finalCommitHash = await this.gitWorkflow.finalizeWorkflow(options.projectPath, gitWorkflowResult.branchName, userApproved, commitMessage);
            }
            // Display completion summary
            console.log('\n🎉 Auto-Improvement Complete!');
            console.log('━'.repeat(50));
            if (userApproved) {
                console.log(`✅ Successfully applied ${improvementReport.summary.totalIssuesFixed} improvements`);
                console.log(`📁 Files modified: ${improvementReport.summary.filesModified}`);
                console.log(`📈 Quality score: ${improvementReport.metrics.before.qualityScore.toFixed(1)} → ${improvementReport.metrics.after.qualityScore.toFixed(1)}`);
                if (finalCommitHash) {
                    console.log(`🔗 Commit: ${finalCommitHash.substring(0, 8)}`);
                    console.log(`🌿 Branch: ${gitWorkflowResult.branchName}`);
                    console.log('\n🔀 To merge improvements to main:');
                    console.log(`   git checkout main`);
                    console.log(`   git merge ${gitWorkflowResult.branchName}`);
                }
            }
            else {
                console.log('❌ Improvements were not applied - project remains unchanged');
            }
            const duration = Date.now() - startTime;
            console.log(`⏱️  Total time: ${Math.round(duration / 1000)}s`);
            this.rl.close();
            return {
                ...improvementReport,
                gitWorkflow: { ...gitWorkflowResult, userApproved },
                userApproved,
                testResults,
                finalCommitHash: finalCommitHash || undefined
            };
        }
        catch (error) {
            this.logger.error('Auto-improvement failed', error);
            this.rl.close();
            throw error;
        }
    }
    displayAnalysisResults(report) {
        console.log('\n📊 Analysis Results:');
        console.log('━'.repeat(30));
        console.log(`📁 Files analyzed: ${report.summary.filesAnalyzed}`);
        console.log(`🔍 Issues found: ${report.summary.totalIssuesFound}`);
        console.log(`📈 Current quality score: ${report.metrics.before.qualityScore.toFixed(1)}/100`);
        if (report.metrics.before.duplicateLines > 0) {
            console.log(`🔄 Duplicate lines: ${report.metrics.before.duplicateLines}`);
        }
        if (report.metrics.before.scatteredConfigs > 0) {
            console.log(`⚙️  Scattered configs: ${report.metrics.before.scatteredConfigs}`);
        }
        if (report.metrics.before.architectureViolations > 0) {
            console.log(`🏗️  Architecture issues: ${report.metrics.before.architectureViolations}`);
        }
        if (report.fixes.length > 0) {
            console.log('\n🔧 Proposed Improvements:');
            report.fixes.forEach((fix, i) => {
                const icon = this.getFixIcon(fix.fixType);
                const effort = this.getEffortIcon(fix.effort);
                console.log(`   ${i + 1}. ${icon} ${fix.description} ${effort}`);
            });
        }
        if (report.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            report.recommendations.slice(0, 3).forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
    }
    displayTestResults(testResults) {
        if (testResults.success) {
            console.log(`✅ Tests passed (${Math.round(testResults.duration / 1000)}s)`);
            console.log(`   Command: ${testResults.testCommand}`);
        }
        else {
            console.log(`❌ Tests failed (${Math.round(testResults.duration / 1000)}s)`);
            console.log(`   Command: ${testResults.testCommand}`);
            console.log(`   Exit code: ${testResults.exitCode}`);
            // Show last few lines of test output
            const outputLines = testResults.output.split('\n');
            const lastLines = outputLines.slice(-5).filter(line => line.trim());
            if (lastLines.length > 0) {
                console.log('   Last output:');
                lastLines.forEach(line => console.log(`   │ ${line}`));
            }
        }
    }
    displayFinalSummary(report, testResults) {
        console.log('📋 Summary of Changes:');
        console.log('━'.repeat(25));
        console.log(`✅ Fixes applied: ${report.summary.totalIssuesFixed}/${report.summary.totalIssuesFound}`);
        console.log(`📁 Files modified: ${report.summary.filesModified}`);
        console.log(`📝 Lines changed: ${report.summary.linesChanged}`);
        console.log(`📈 Quality improvement: +${report.metrics.improvement.qualityScore.toFixed(1)} points`);
        if (testResults) {
            const testIcon = testResults.success ? '✅' : '❌';
            console.log(`🧪 Tests: ${testIcon} ${testResults.success ? 'Passed' : 'Failed'}`);
        }
        console.log(`🎯 Benefit score: ${report.summary.overallBenefitScore}`);
    }
    async askUserConfirmation(question, details) {
        console.log(question);
        if (details) {
            console.log(`   ${details}`);
        }
        return new Promise((resolve) => {
            this.rl.question('   Enter (y/n): ', (answer) => {
                const normalized = answer.toLowerCase().trim();
                resolve(normalized === 'y' || normalized === 'yes');
            });
        });
    }
    generateCustomCommitMessage(report) {
        const fixes = report.fixes.filter(f => f.success);
        const fixTypes = [...new Set(fixes.map(f => f.fixType))];
        let message = '🔧 CodeMind Auto-Improvements Applied\n\n';
        if (fixes.length > 0) {
            message += '✅ Applied improvements:\n';
            fixTypes.forEach(type => {
                const typeIcon = this.getFixIcon(type);
                message += `• ${typeIcon} ${type} optimization\n`;
            });
            message += '\n';
        }
        message += `📊 Impact:\n`;
        message += `• Quality score: +${report.metrics.improvement.qualityScore.toFixed(1)} points\n`;
        message += `• Files modified: ${report.summary.filesModified}\n`;
        message += `• Lines changed: ${report.summary.linesChanged}\n`;
        message += `• Overall benefit: ${report.summary.overallBenefitScore} points\n\n`;
        message += 'Generated by CodeMind Auto-Improvement Mode\n';
        message += 'Co-Authored-By: CodeMind <autofix@codemind.local>';
        return message;
    }
    getFixIcon(fixType) {
        const icons = {
            [project_fixer_1.AutoFixType.DUPLICATES]: '🔄',
            [project_fixer_1.AutoFixType.CENTRALIZATION]: '⚙️',
            [project_fixer_1.AutoFixType.DEPENDENCIES]: '🔗',
            [project_fixer_1.AutoFixType.QUALITY]: '✨',
            [project_fixer_1.AutoFixType.ARCHITECTURE]: '🏗️',
            [project_fixer_1.AutoFixType.SECURITY]: '🔒',
            [project_fixer_1.AutoFixType.PERFORMANCE]: '⚡',
            [project_fixer_1.AutoFixType.ALL]: '🎯'
        };
        return icons[fixType] || '🔧';
    }
    getEffortIcon(effort) {
        const icons = {
            low: '🟢',
            medium: '🟡',
            high: '🔴'
        };
        return icons[effort];
    }
    close() {
        this.rl.close();
    }
}
exports.InteractiveProjectFixer = InteractiveProjectFixer;
//# sourceMappingURL=interactive-project-fixer.js.map