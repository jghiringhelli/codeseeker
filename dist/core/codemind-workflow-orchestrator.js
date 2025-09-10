"use strict";
/**
 * CodeMind Core Workflow Orchestrator
 *
 * This is the main brain of CodeMind CLI - a high-level class that orchestrates
 * the complete workflow from user request to final implementation with quality checks.
 *
 * Core Workflow Steps:
 * 1. Analyze user intent and select tools
 * 2. Execute semantic search and graph traversal
 * 3. Split request into manageable sub-tasks
 * 4. Process each sub-task with Claude + context
 * 5. Run comprehensive quality checks
 * 6. Manage git branches and safe deployment
 * 7. Update all databases with changes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMindWorkflowOrchestrator = void 0;
const logger_1 = require("../utils/logger");
const semantic_enhancement_engine_1 = require("../shared/semantic-enhancement-engine");
class CodeMindWorkflowOrchestrator {
    logger = logger_1.Logger.getInstance();
    semanticEngine;
    intentAnalyzer;
    toolSelector;
    taskSplitter;
    claudeProcessor;
    qualityChecker;
    gitManager;
    databaseUpdater;
    constructor(projectId) {
        this.semanticEngine = new semantic_enhancement_engine_1.SemanticEnhancementEngine();
        this.intentAnalyzer = new IntentAnalyzer();
        this.toolSelector = new ToolSelector();
        this.taskSplitter = new TaskSplitter();
        this.claudeProcessor = new ClaudeSubTaskProcessor();
        this.qualityChecker = new QualityChecker();
        this.gitManager = new GitBranchManager();
        this.databaseUpdater = new DatabaseUpdateManager();
    }
    /**
     * MAIN WORKFLOW: Execute complete feature request workflow
     * This is the single entry point that orchestrates everything
     */
    async executeFeatureRequest(request) {
        const workflowId = `workflow_${Date.now()}`;
        this.logger.info(`🎯 Starting CodeMind workflow: ${workflowId}`);
        this.logger.info(`Request: "${request.query}"`);
        try {
            // STEP 1: Analyze user intent and select appropriate tools
            const intent = await this.analyzeIntentAndSelectTools(request);
            this.logger.info(`Intent: ${intent.intention} (${intent.complexity} complexity, ${intent.suggestedTools.length} tools)`);
            // STEP 2: Execute semantic search + graph traversal for complete context
            const context = await this.gatherSemanticContext(request.query, intent);
            this.logger.info(`Context: ${context.totalFiles} files (${Math.round(context.contextSize / 1000)}KB)`);
            // STEP 3: Create git branch for safe development
            const gitBranch = await this.createFeatureBranch(workflowId, request.query);
            this.logger.info(`Git branch: ${gitBranch}`);
            // STEP 4: Split request into manageable sub-tasks
            const subTasks = await this.splitIntoSubTasks(request, intent, context);
            this.logger.info(`Sub-tasks: ${subTasks.length} tasks identified`);
            // STEP 5: Process each sub-task with Claude + focused context
            const subTaskResults = await this.processAllSubTasks(subTasks, context);
            this.logger.info(`Sub-tasks completed: ${subTaskResults.filter(r => r.success).length}/${subTasks.length} successful`);
            // STEP 6: Run comprehensive quality checks
            const qualityResult = await this.runQualityChecks(subTaskResults);
            this.logger.info(`Quality score: ${qualityResult.overallScore}% (${qualityResult.compilation.success ? 'compiles' : 'compilation errors'})`);
            // STEP 7: If quality checks pass, commit and merge; otherwise rollback
            const finalResult = await this.finalizeChanges(gitBranch, qualityResult, subTaskResults);
            // STEP 8: Update all databases with changes made
            await this.updateAllDatabases(finalResult.filesModified, context);
            this.logger.info(`✅ Workflow complete: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
            return finalResult;
        }
        catch (error) {
            this.logger.error(`❌ Workflow failed: ${error.message}`);
            // Rollback any changes made
            await this.rollbackChanges(workflowId);
            throw error;
        }
    }
    // ===============================================
    // STEP IMPLEMENTATIONS (delegate to specialized classes)
    // ===============================================
    async analyzeIntentAndSelectTools(request) {
        // Analyze user request to understand intention and select appropriate tools
        return await this.intentAnalyzer.analyzeIntent(request.query);
    }
    async gatherSemanticContext(query, intent) {
        // Use semantic search + Neo4j graph traversal to get complete context
        return await this.semanticEngine.enhanceQuery(query, Math.min(10, intent.estimatedFiles), // Primary files
        Math.min(20, intent.estimatedFiles * 2), // Related files
        120000 // Max context size based on complexity
        );
    }
    async createFeatureBranch(workflowId, description) {
        // Create git branch for safe development
        return await this.gitManager.createFeatureBranch(workflowId, description);
    }
    async splitIntoSubTasks(request, intent, context) {
        // Split complex request into manageable sub-tasks
        return await this.taskSplitter.createSubTasks(request, intent, context);
    }
    async processAllSubTasks(subTasks, context) {
        // Process each sub-task with Claude, passing only relevant context
        const results = [];
        for (const task of subTasks) {
            this.logger.info(`Processing sub-task: ${task.description}`);
            const result = await this.claudeProcessor.processSubTask(task, context);
            results.push(result);
            // Update context for subsequent tasks if this task modified files
            if (result.filesModified?.length > 0) {
                await this.semanticEngine.updateContextAfterProcessing(result.filesModified, context);
            }
        }
        return results;
    }
    async runQualityChecks(subTaskResults) {
        // Run comprehensive quality checks: compilation, tests, coverage, principles
        return await this.qualityChecker.runAllChecks(subTaskResults);
    }
    async finalizeChanges(gitBranch, qualityResult, subTaskResults) {
        // Commit and merge if quality is good, otherwise rollback
        if (qualityResult.overallScore >= 80 && qualityResult.compilation.success) {
            await this.gitManager.commitAndMerge(gitBranch, 'Feature implementation with quality checks passed');
            return {
                success: true,
                filesModified: subTaskResults.flatMap(r => r.filesModified || []),
                qualityScore: qualityResult.overallScore,
                gitBranch,
                databases: await this.calculateDatabaseUpdates(subTaskResults),
                summary: `Successfully implemented feature with ${qualityResult.overallScore}% quality score`
            };
        }
        else {
            await this.gitManager.rollbackBranch(gitBranch);
            return {
                success: false,
                filesModified: [],
                qualityScore: qualityResult.overallScore,
                gitBranch,
                databases: { neo4j: { nodesCreated: 0, relationshipsCreated: 0 }, redis: { filesUpdated: 0, hashesUpdated: 0 }, postgres: { recordsUpdated: 0 }, mongodb: { documentsUpdated: 0 } },
                summary: `Feature implementation failed quality checks (${qualityResult.overallScore}% score)`
            };
        }
    }
    async updateAllDatabases(modifiedFiles, context) {
        // Update Neo4j graph, Redis cache, PostgreSQL records, MongoDB documents
        await this.databaseUpdater.updateAllDatabases(modifiedFiles, context);
    }
    async rollbackChanges(workflowId) {
        // Rollback any changes made during failed workflow
        await this.gitManager.rollbackBranch(`feature/${workflowId}`);
    }
    async calculateDatabaseUpdates(subTaskResults) {
        // Calculate database update statistics
        return {
            neo4j: { nodesCreated: 0, relationshipsCreated: 0 },
            redis: { filesUpdated: subTaskResults.length, hashesUpdated: subTaskResults.length },
            postgres: { recordsUpdated: 1 },
            mongodb: { documentsUpdated: 1 }
        };
    }
}
exports.CodeMindWorkflowOrchestrator = CodeMindWorkflowOrchestrator;
// ===============================================
// SPECIALIZED CLASSES (to be implemented)
// ===============================================
class IntentAnalyzer {
    async analyzeIntent(query) {
        // Implementation would use Claude to analyze user intent
        return {
            intention: 'add_feature',
            complexity: 'medium',
            estimatedFiles: 5,
            suggestedTools: ['semantic_search', 'code_graph', 'quality_checks'],
            riskLevel: 'medium'
        };
    }
}
class ToolSelector {
}
class TaskSplitter {
    async createSubTasks(request, intent, context) {
        // Implementation would break complex requests into sub-tasks
        return [
            {
                id: 'task_1',
                description: 'Implement core functionality',
                files: context.primaryFiles.slice(0, 3).map(f => f.filePath),
                dependencies: [],
                estimatedTime: 30,
                priority: 1
            }
        ];
    }
}
class ClaudeSubTaskProcessor {
    async processSubTask(task, context) {
        // Implementation would process sub-task with Claude
        return {
            success: true,
            filesModified: task.files,
            summary: `Completed: ${task.description}`
        };
    }
}
class QualityChecker {
    async runAllChecks(subTaskResults) {
        // Implementation would run compilation, tests, coverage, security, architecture checks
        return {
            compilation: { success: true, errors: [] },
            tests: { passed: 10, failed: 0, coverage: 85 },
            codeQuality: { solidPrinciples: true, security: true, architecture: true },
            overallScore: 92
        };
    }
}
class GitBranchManager {
    async createFeatureBranch(workflowId, description) {
        // Implementation would create git branch
        return `feature/${workflowId}`;
    }
    async commitAndMerge(branch, message) {
        // Implementation would commit and merge branch
    }
    async rollbackBranch(branch) {
        // Implementation would rollback branch
    }
}
class DatabaseUpdateManager {
    async updateAllDatabases(modifiedFiles, context) {
        // Implementation would update Neo4j, Redis, PostgreSQL, MongoDB
    }
}
exports.default = CodeMindWorkflowOrchestrator;
//# sourceMappingURL=codemind-workflow-orchestrator.js.map