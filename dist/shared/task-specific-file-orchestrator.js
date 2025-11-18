"use strict";
/**
 * Task-Specific File Orchestrator
 *
 * Coordinates the complete workflow: Impact Analysis → Git Branching → File Updates → Validation → Rollback
 * Provides Claude Code with exact paths and specific tasks for each file to avoid extra work
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSpecificFileOrchestrator = void 0;
const logger_1 = require("./logger");
const comprehensive_impact_analyzer_1 = require("./comprehensive-impact-analyzer");
const git_branch_manager_1 = require("./managers/git-branch-manager");
const validation_cycle_1 = require("./validation-cycle");
const post_execution_integration_1 = require("./post-execution-integration");
class TaskSpecificFileOrchestrator {
    logger;
    impactAnalyzer;
    branchManager;
    validationCycle;
    postExecutionIntegration;
    constructor(projectPath) {
        this.logger = logger_1.Logger.getInstance();
        this.impactAnalyzer = new comprehensive_impact_analyzer_1.ComprehensiveImpactAnalyzer();
        this.branchManager = new git_branch_manager_1.GitBranchManager(projectPath);
        this.validationCycle = new validation_cycle_1.CodeMindValidationCycle();
        this.postExecutionIntegration = new post_execution_integration_1.PostExecutionIntegration(projectPath);
    }
    /**
     * Main orchestration method - handles complete workflow
     */
    async orchestrateRequest(projectPath, userRequest, options = {}) {
        const startTime = Date.now();
        try {
            this.logger.info(`🎭 Starting orchestration for: "${userRequest}"`);
            // 1. PHASE 1: Impact Analysis - Find ALL affected files
            this.logger.info('📊 Phase 1: Comprehensive impact analysis');
            const impactResult = await this.impactAnalyzer.analyzeCompleteImpact(projectPath, userRequest, [] // No initial changed files
            );
            this.logger.info(`📈 Impact: ${impactResult.totalFiles} files affected, risk: ${impactResult.riskLevel}`);
            // 2. PHASE 2: Create Feature Branch
            this.logger.info('🌿 Phase 2: Creating feature branch');
            const featureBranch = await this.branchManager.createFeatureBranch(userRequest);
            // 3. PHASE 3: Convert to Task-Specific Instructions
            this.logger.info('📋 Phase 3: Generating specific file tasks');
            const fileTasks = this.convertToFileTasks(impactResult, userRequest);
            // 4. PHASE 4: Pre-execution Validation (if not skipped)
            let validationPassed = true;
            if (!options.skipCycles) {
                this.logger.info('🔍 Phase 4: Pre-execution validation');
                validationPassed = await this.runPreExecutionValidation(projectPath, userRequest, fileTasks);
                if (!validationPassed && !options.force) {
                    return await this.handleValidationFailure(featureBranch, 'Pre-execution validation failed');
                }
            }
            // Create pre-execution snapshot
            await this.branchManager.createSnapshot(featureBranch.branchName, 'Pre-execution state', validationPassed, fileTasks.map(t => t.filePath));
            // 5. PHASE 5: Execute File Tasks (if not dry run)
            let completedTasks = [];
            let failedTasks = [];
            if (!options.dryRun) {
                this.logger.info('⚡ Phase 5: Executing file tasks');
                const executionResult = await this.executeFileTasks(fileTasks, featureBranch);
                completedTasks = executionResult.completed;
                failedTasks = executionResult.failed;
                // Create post-execution snapshot
                await this.branchManager.createSnapshot(featureBranch.branchName, 'Post-execution state', failedTasks.length === 0, completedTasks.map(t => t.filePath));
            }
            // 6. PHASE 6: Post-execution Validation
            let postValidationPassed = true;
            if (!options.skipCycles && !options.dryRun) {
                this.logger.info('🔬 Phase 6: Post-execution validation');
                postValidationPassed = await this.runPostExecutionValidation(projectPath, completedTasks.map(t => t.filePath));
                if (!postValidationPassed && options.autoRollback) {
                    this.logger.info('🔄 Auto-rollback triggered due to validation failure');
                    await this.performIntelligentRollback(featureBranch, completedTasks, failedTasks);
                    return {
                        success: false,
                        branchName: featureBranch.branchName,
                        completedTasks: [],
                        failedTasks: completedTasks, // Rolled back
                        validationResults: null,
                        snapshots: featureBranch.snapshots,
                        rollbackPerformed: true,
                        message: 'Request rolled back due to post-execution validation failure',
                        estimatedTimeActual: this.calculateActualTime(startTime),
                        nextSteps: ['Review validation errors', 'Adjust request and retry']
                    };
                }
            }
            // 7. PHASE 7: POST-EXECUTION INTEGRATION
            let integrationResult;
            if (!options.dryRun && completedTasks.length > 0 && postValidationPassed) {
                this.logger.info('🔧 Phase 7: Post-execution integration');
                integrationResult = await this.postExecutionIntegration.runCompleteIntegration(featureBranch, completedTasks.map(t => t.filePath), {
                    autoFixCompilation: true,
                    autoFixTests: !options.skipCycles,
                    autoCommit: true,
                    autoMerge: !failedTasks.length, // Only merge if no failures
                    updateDocumentation: true,
                    updateConfig: true,
                    updateDeployment: true,
                    createNextSnapshot: true,
                    preserveFeatureBranch: false
                });
                this.logger.info(`📊 Integration: ${integrationResult.success ? 'Success' : 'Partial'}`);
            }
            // 8. PHASE 8: Final Results
            const actualTime = this.calculateActualTime(startTime);
            const nextSteps = this.generateNextSteps(completedTasks, failedTasks, postValidationPassed, integrationResult);
            return {
                success: failedTasks.length === 0 && postValidationPassed && (integrationResult?.success !== false),
                branchName: featureBranch.branchName,
                completedTasks,
                failedTasks,
                validationResults: { preExecution: validationPassed, postExecution: postValidationPassed },
                snapshots: featureBranch.snapshots,
                rollbackPerformed: false,
                integrationResult,
                message: this.generateSuccessMessage(completedTasks, failedTasks, actualTime, integrationResult),
                estimatedTimeActual: actualTime,
                nextSteps
            };
        }
        catch (error) {
            this.logger.error('Orchestration failed:', error.message);
            return {
                success: false,
                branchName: 'unknown',
                completedTasks: [],
                failedTasks: [],
                validationResults: null,
                snapshots: [],
                rollbackPerformed: false,
                message: `Orchestration failed: ${error.message}`,
                estimatedTimeActual: this.calculateActualTime(startTime),
                nextSteps: ['Check logs for details', 'Retry with --force flag if needed']
            };
        }
    }
    /**
     * Convert impact analysis to specific file tasks with Claude instructions
     */
    convertToFileTasks(impactResult, userRequest) {
        const tasks = [];
        // Process all affected file categories
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
                claudeInstructions: this.generateClaudeInstructions(file, userRequest),
                validationCriteria: this.generateValidationCriteria(file, userRequest)
            });
        }
        // Sort by priority and dependencies
        return this.sortTasksByPriorityAndDependencies(tasks);
    }
    /**
     * Generate specific instructions for Claude Code
     */
    generateClaudeInstructions(file, userRequest) {
        const instructions = [`FILE: ${file.filePath}`, `TASK: ${file.specificTask}`, ``];
        switch (file.fileType) {
            case 'code':
                instructions.push('CODE FILE INSTRUCTIONS:', `• Implement: ${userRequest}`, `• Follow existing code patterns in this file`, `• Ensure type safety and proper error handling`, `• Add appropriate comments for complex logic`, `• Maintain consistent coding style`);
                break;
            case 'config':
                instructions.push('CONFIGURATION FILE INSTRUCTIONS:', `• Update configuration to support: ${userRequest}`, `• Preserve existing settings unless they conflict`, `• Validate JSON/YAML syntax`, `• Add comments where appropriate`, `• Follow project configuration patterns`);
                break;
            case 'documentation':
                instructions.push('DOCUMENTATION INSTRUCTIONS:', `• Document changes related to: ${userRequest}`, `• Update relevant sections without changing unrelated content`, `• Maintain consistent documentation style`, `• Include code examples if appropriate`, `• Update table of contents if needed`);
                break;
            case 'test':
                instructions.push('TEST FILE INSTRUCTIONS:', `• ${file.changeType === 'create' ? 'Create comprehensive tests' : 'Update existing tests'} for: ${userRequest}`, `• Cover both happy path and edge cases`, `• Follow project testing patterns`, `• Ensure tests are isolated and deterministic`, `• Include descriptive test names and assertions`);
                break;
            case 'deployment':
                instructions.push('DEPLOYMENT FILE INSTRUCTIONS:', `• Update deployment configuration for: ${userRequest}`, `• Ensure backwards compatibility where possible`, `• Validate deployment syntax`, `• Consider environment-specific settings`, `• Test configuration changes carefully`);
                break;
        }
        if (file.dependencies.length > 0) {
            instructions.push('', 'DEPENDENCIES:', ...file.dependencies.map(dep => `• Must be completed after: ${dep}`));
        }
        instructions.push('', 'VALIDATION:', `• Priority: ${file.priority}`, `• Complexity: ${file.estimatedComplexity}/10`, `• Change type: ${file.changeType}`);
        return instructions.join('\n');
    }
    /**
     * Generate validation criteria for each file
     */
    generateValidationCriteria(file, userRequest) {
        const criteria = [`File exists: ${file.filePath}`];
        switch (file.fileType) {
            case 'code':
                criteria.push('Code compiles without errors', 'No linting errors introduced', 'Follows project coding standards', 'Type definitions are correct');
                break;
            case 'config':
                criteria.push('Configuration file has valid syntax', 'No breaking changes to existing config', 'Required fields are present');
                break;
            case 'documentation':
                criteria.push('Markdown syntax is valid', 'Links are not broken', 'Content is relevant and accurate');
                break;
            case 'test':
                criteria.push('Tests run successfully', 'New functionality is covered', 'Existing tests still pass');
                break;
            case 'deployment':
                criteria.push('Deployment configuration is valid', 'No syntax errors', 'Compatible with target environment');
                break;
        }
        return criteria;
    }
    /**
     * Execute file tasks in dependency order
     */
    async executeFileTasks(tasks, featureBranch) {
        const completed = [];
        const failed = [];
        this.logger.info(`📝 Executing ${tasks.length} file tasks`);
        for (const task of tasks) {
            try {
                this.logger.info(`⚡ Executing: ${task.filePath} (${task.priority})`);
                // Here we would integrate with Claude Code API to perform the actual file changes
                // For now, we'll simulate the task execution
                const success = await this.executeFileTask(task);
                if (success) {
                    completed.push(task);
                    this.logger.info(`✅ Completed: ${task.filePath}`);
                    // Create incremental snapshot for important files
                    if (task.priority === 'critical' || task.priority === 'high') {
                        await this.branchManager.createSnapshot(featureBranch.branchName, `Completed: ${task.filePath}`, true, [task.filePath]);
                    }
                }
                else {
                    failed.push(task);
                    this.logger.error(`❌ Failed: ${task.filePath}`);
                }
            }
            catch (error) {
                this.logger.error(`Task execution failed for ${task.filePath}:`, error.message);
                failed.push(task);
            }
        }
        return { completed, failed };
    }
    /**
     * Execute a single file task (placeholder for Claude Code integration)
     */
    async executeFileTask(task) {
        // This would integrate with Claude Code API
        // For now, simulating task execution
        this.logger.info(`📋 CLAUDE TASK:`);
        this.logger.info(task.claudeInstructions);
        // Simulate different success rates based on complexity
        const successRate = Math.max(0.7, 1.0 - (task.estimatedComplexity * 0.05));
        return Math.random() < successRate;
    }
    /**
     * Run pre-execution validation
     */
    async runPreExecutionValidation(projectPath, userRequest, tasks) {
        try {
            // Build project context for validation
            const context = {
                projectPath,
                projectId: this.generateProjectId(projectPath),
                changedFiles: tasks.map(t => t.filePath),
                requestType: 'code_modification',
                language: 'typescript', // Would be detected
                framework: 'unknown', // Would be detected
                userIntent: userRequest
            };
            // Run core safety cycle
            const coreResult = await this.validationCycle.runCoreCycle(context);
            if (!coreResult.success) {
                this.logger.warn('⚠️ Core validation failed:', coreResult.errors);
                return false;
            }
            // Run quality cycle for code modifications
            const qualityResult = await this.validationCycle.runQualityCycle(context);
            if (qualityResult.warnings.length > 0) {
                this.logger.info('📊 Quality warnings:', qualityResult.warnings);
                // Warnings don't block execution
            }
            return true;
        }
        catch (error) {
            this.logger.error('Pre-execution validation failed:', error.message);
            return false;
        }
    }
    /**
     * Run post-execution validation
     */
    async runPostExecutionValidation(projectPath, changedFiles) {
        try {
            // Quick validation of changes
            const context = {
                projectPath,
                projectId: this.generateProjectId(projectPath),
                changedFiles,
                requestType: 'code_modification',
                language: 'typescript',
                framework: 'unknown',
                userIntent: 'post-execution validation'
            };
            // Run lightweight validation
            const result = await this.validationCycle.runCoreCycle(context);
            return result.success;
        }
        catch (error) {
            this.logger.error('Post-execution validation failed:', error.message);
            return false;
        }
    }
    /**
     * Perform intelligent rollback based on what succeeded/failed
     */
    async performIntelligentRollback(featureBranch, completedTasks, failedTasks) {
        try {
            // Determine rollback strategy
            if (failedTasks.length === 0) {
                // Complete rollback - validation failed
                await this.branchManager.performRollback(featureBranch.branchName, {
                    type: 'complete',
                    createBackupBranch: true
                });
            }
            else if (completedTasks.length > 0) {
                // Selective rollback - keep successful changes
                const filesToKeep = completedTasks
                    .filter(t => t.priority === 'critical' || t.priority === 'high')
                    .map(t => t.filePath);
                await this.branchManager.performRollback(featureBranch.branchName, {
                    type: 'selective',
                    filesToKeep,
                    createBackupBranch: true
                });
            }
            this.logger.info('🔄 Intelligent rollback completed');
        }
        catch (error) {
            this.logger.error('Rollback failed:', error.message);
        }
    }
    /**
     * Sort tasks by priority and dependencies
     */
    sortTasksByPriorityAndDependencies(tasks) {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        // Simple topological sort by dependencies, then by priority
        return tasks.sort((a, b) => {
            // First sort by dependencies (files with no dependencies come first)
            if (a.dependencies.length !== b.dependencies.length) {
                return a.dependencies.length - b.dependencies.length;
            }
            // Then by priority
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    /**
     * Handle validation failure
     */
    async handleValidationFailure(featureBranch, reason) {
        featureBranch.status = 'failed';
        return {
            success: false,
            branchName: featureBranch.branchName,
            completedTasks: [],
            failedTasks: [],
            validationResults: null,
            snapshots: featureBranch.snapshots,
            rollbackPerformed: false,
            message: reason,
            estimatedTimeActual: '0 minutes',
            nextSteps: ['Fix validation issues', 'Use --force flag to override', 'Review error details']
        };
    }
    /**
     * Generate success message
     */
    generateSuccessMessage(completedTasks, failedTasks, actualTime, integrationResult) {
        const baseMessage = failedTasks.length === 0
            ? `✅ All ${completedTasks.length} tasks completed successfully in ${actualTime}`
            : `⚠️ ${completedTasks.length} tasks completed, ${failedTasks.length} failed in ${actualTime}`;
        if (integrationResult) {
            const integrationStatus = integrationResult.success
                ? '🔧 Full integration completed'
                : `🔧 Partial integration (${integrationResult.phase} phase)`;
            const integrationDetails = [];
            if (integrationResult.compilationFixed)
                integrationDetails.push('compilation fixed');
            if (integrationResult.testsFixed)
                integrationDetails.push('tests fixed');
            if (integrationResult.changesCommitted)
                integrationDetails.push('changes committed');
            if (integrationResult.branchMerged)
                integrationDetails.push('branch merged');
            if (integrationResult.documentationUpdated)
                integrationDetails.push('docs updated');
            return `${baseMessage}\n${integrationStatus}: ${integrationDetails.join(', ')}`;
        }
        return baseMessage;
    }
    /**
     * Generate next steps based on results
     */
    generateNextSteps(completedTasks, failedTasks, validationPassed, integrationResult) {
        const steps = [];
        if (failedTasks.length > 0) {
            steps.push(`Review ${failedTasks.length} failed tasks`);
            steps.push('Check error logs for details');
            steps.push('Retry failed tasks individually');
        }
        if (integrationResult) {
            if (integrationResult.success) {
                steps.push('✅ Integration completed - project is ready for next request');
                if (integrationResult.branchMerged) {
                    steps.push('Feature branch has been merged to main');
                    steps.push('New snapshot created for next development cycle');
                }
                else {
                    steps.push('Consider manually merging the feature branch if desired');
                }
            }
            else {
                steps.push(`⚠️ Integration incomplete (stopped at ${integrationResult.phase})`);
                if (!integrationResult.changesCommitted) {
                    steps.push('Manually commit changes: git add -A && git commit');
                }
                if (integrationResult.changesCommitted && !integrationResult.branchMerged) {
                    steps.push(`Manually merge branch: git checkout main && git merge ${integrationResult.phase}`);
                }
                if (integrationResult.fixesApplied.length > 0) {
                    steps.push(`Review automatic fixes: ${integrationResult.fixesApplied.join(', ')}`);
                }
            }
        }
        else if (completedTasks.length > 0 && validationPassed) {
            steps.push('Run post-execution integration manually');
            steps.push('Review completed changes');
            steps.push('Run additional tests if needed');
            steps.push('Consider merging the feature branch');
        }
        if (!validationPassed) {
            steps.push('Fix validation issues');
            steps.push('Run validation again');
        }
        return steps;
    }
    /**
     * Calculate actual execution time
     */
    calculateActualTime(startTime) {
        const elapsed = Date.now() - startTime;
        const minutes = Math.round(elapsed / 60000);
        if (minutes < 60) {
            return `${minutes} minutes`;
        }
        else {
            return `${Math.round(minutes / 60)} hours`;
        }
    }
    /**
     * Generate project ID from path
     */
    generateProjectId(projectPath) {
        return require('crypto').createHash('sha256').update(projectPath).digest('hex').substring(0, 16);
    }
}
exports.TaskSpecificFileOrchestrator = TaskSpecificFileOrchestrator;
exports.default = TaskSpecificFileOrchestrator;
//# sourceMappingURL=task-specific-file-orchestrator.js.map