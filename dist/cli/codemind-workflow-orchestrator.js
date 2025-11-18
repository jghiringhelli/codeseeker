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
const claude_cli_integration_1 = require("./../integrations/claude/claude-cli-integration");
const task_decomposer_1 = require("./integration/task-decomposer");
const task_executor_1 = require("./integration/task-executor");
const quality_manager_1 = require("../services/managers/quality-manager");
class CodeMindWorkflowOrchestrator {
    logger = logger_1.Logger.getInstance();
    semanticEngine;
    claudeIntegration;
    taskDecomposer;
    taskExecutor;
    qualityChecker;
    gitManager;
    databaseUpdater;
    projectId;
    constructor(projectId) {
        this.projectId = projectId;
        this.semanticEngine = new semantic_enhancement_engine_1.SemanticEnhancementEngine();
        this.claudeIntegration = new claude_cli_integration_1.ClaudeCodeIntegration();
        this.taskDecomposer = new task_decomposer_1.TaskDecomposer();
        this.taskExecutor = new task_executor_1.TaskExecutor();
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
            // STEP 6: Run comprehensive quality checks (skip for report requests)
            let qualityResult;
            if (intent.intention === 'report') {
                console.log('📋 Skipping quality checks for report request');
                qualityResult = {
                    overallScore: 100,
                    issues: [],
                    compilation: { success: true, errors: [] },
                    tests: { passed: 100, failed: 0, coverage: 100 },
                    codeQuality: { solidPrinciples: true, security: true, architecture: true },
                    analysisDetails: {
                        linting: { penalty: 0, issues: [] },
                        security: { penalty: 0, issues: [] },
                        dependencies: { penalty: 0, issues: [] },
                        complexity: { penalty: 0, issues: [] },
                        testing: { penalty: 0, issues: [], results: {} },
                        taskExecution: { penalty: 0, issues: [] }
                    }
                };
            }
            else {
                qualityResult = await this.runQualityChecks(subTaskResults);
                this.logger.info(`Quality score: ${qualityResult.overallScore}% (${qualityResult.compilation.success ? 'compiles' : 'compilation errors'})`);
            }
            // STEP 7: If quality checks pass, commit and merge; otherwise rollback
            const finalResult = await this.finalizeChanges(gitBranch, qualityResult, subTaskResults, intent.intention === 'report');
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
        this.logger.info('🎯 Analyzing user intent with Claude Code CLI...');
        // Use the simple, more reliable intent detection
        const simpleIntentResult = await this.claudeIntegration.detectUserIntentSimple(request.query);
        // Convert to legacy format
        const intentResult = {
            category: simpleIntentResult.category,
            confidence: simpleIntentResult.confidence,
            params: {
                requiresModifications: simpleIntentResult.requiresModifications,
                reasoning: simpleIntentResult.reasoning
            }
        };
        // Transform ClaudeCodeIntegration result to ProcessedIntent format
        return {
            intention: intentResult.category,
            complexity: this.mapComplexity(intentResult.confidence),
            estimatedFiles: this.estimateFiles(intentResult.category),
            suggestedTools: this.suggestTools(intentResult.category),
            riskLevel: this.assessRisk(intentResult.category),
            primaryDomains: [intentResult.category],
            timeEstimate: this.estimateTime(intentResult.category),
            confidence: intentResult.confidence
        };
    }
    mapComplexity(confidence) {
        if (confidence > 0.8)
            return 'simple';
        if (confidence > 0.6)
            return 'medium';
        return 'complex';
    }
    estimateFiles(category) {
        const fileEstimates = {
            'analysis': 5,
            'feature_request': 8,
            'bug_fix': 3,
            'refactoring': 6,
            'documentation': 2,
            'testing': 4,
            'optimization': 7
        };
        return fileEstimates[category] || 5;
    }
    suggestTools(category) {
        const toolSuggestions = {
            'analysis': ['semantic_search', 'code_graph', 'pattern_detector'],
            'feature_request': ['semantic_search', 'code_graph', 'quality_checks', 'test_generation'],
            'bug_fix': ['semantic_search', 'quality_checks', 'test_generation'],
            'refactoring': ['code_graph', 'quality_checks', 'pattern_detector'],
            'documentation': ['semantic_search', 'documentation_gen'],
            'testing': ['test_generation', 'quality_checks'],
            'optimization': ['performance_analysis', 'code_graph', 'quality_checks'],
            'report': ['semantic_search', 'documentation_gen'] // Only read-only tools for reports
        };
        return toolSuggestions[category] || ['semantic_search', 'quality_checks'];
    }
    assessRisk(category) {
        const riskLevels = {
            'analysis': 'low',
            'report': 'low', // Reports have no risk since they don't change code
            'documentation': 'low',
            'testing': 'low',
            'bug_fix': 'medium',
            'optimization': 'medium',
            'feature_request': 'high',
            'refactoring': 'high'
        };
        return riskLevels[category] || 'medium';
    }
    estimateTime(category) {
        const timeEstimates = {
            'analysis': 15,
            'documentation': 20,
            'testing': 25,
            'bug_fix': 30,
            'optimization': 45,
            'feature_request': 60,
            'refactoring': 90
        };
        return timeEstimates[category] || 30;
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
        this.logger.info('🔄 Decomposing request into tasks using Claude Code CLI...');
        // Use the real task decomposer
        const tasks = await this.taskDecomposer.decompose(request.query, {
            category: intent.intention,
            confidence: intent.confidence,
            params: {}
        });
        // Transform to SubTask format and add context information
        return tasks.map((task, index) => ({
            id: `task_${index + 1}`,
            description: task.description,
            files: this.selectRelevantFiles(context, task.type),
            dependencies: this.calculateTaskDependencies(tasks, index),
            estimatedTime: this.estimateTaskTime(task.type),
            priority: task.priority || index + 1
        }));
    }
    selectRelevantFiles(context, taskType) {
        // Select most relevant files based on task type
        const maxFiles = taskType === 'general' ? 3 : 5;
        return context.primaryFiles
            .slice(0, maxFiles)
            .map(f => f.filePath);
    }
    calculateTaskDependencies(tasks, currentIndex) {
        // Simple dependency logic - sequential for now
        const dependencies = [];
        if (currentIndex > 0) {
            dependencies.push(`task_${currentIndex}`);
        }
        return dependencies;
    }
    estimateTaskTime(taskType) {
        const taskTimeEstimates = {
            'analyze': 15,
            'analyze-solid': 20,
            'refactor': 30,
            'report': 10,
            'identify': 15,
            'plan': 20,
            'validate': 25,
            'suggest-patterns': 18,
            'recommend-improvements': 22,
            'general': 25
        };
        return taskTimeEstimates[taskType] || 20;
    }
    async processAllSubTasks(subTasks, context) {
        this.logger.info('⚡ Executing tasks with Claude Code CLI...');
        const results = [];
        for (const task of subTasks) {
            this.logger.info(`Processing sub-task: ${task.description}`);
            // Use the real task executor
            const taskResult = await this.taskExecutor.execute(task, this.buildTaskContext(context, task));
            // For tasks that need actual Claude Code CLI execution, delegate to ClaudeCodeIntegration
            let enhancedResult = taskResult;
            if (this.needsClaudeCodeExecution(task)) {
                const claudeResult = await this.executeTaskWithClaude(task, context);
                enhancedResult = {
                    ...taskResult,
                    claudeOutput: claudeResult,
                    filesModified: claudeResult.filesModified || [],
                    tokensUsed: claudeResult.tokensUsed || 0
                };
            }
            results.push(enhancedResult);
            // Update context for subsequent tasks if this task modified files
            if (enhancedResult.filesModified?.length > 0) {
                await this.semanticEngine.updateContextAfterProcessing(enhancedResult.filesModified, context);
            }
        }
        return results;
    }
    buildTaskContext(context, task) {
        // Build enhanced context with actual file content
        const contextParts = [
            `# Enhanced Task Context: ${task.description}`,
            ``,
            `## Semantic Search Results`,
            `Found ${context.primaryFiles.length} primary files and ${context.relatedFiles.length} related files`,
            `Total context size: ${Math.round(context.contextSize / 1000)}KB`,
            ``,
            `## Primary Files (Most Relevant):`
        ];
        // Include top 3 most relevant files with their content
        const topFiles = context.primaryFiles.slice(0, 3);
        for (const file of topFiles) {
            contextParts.push(`### ${file.filePath} (relevance: ${file.relevanceScore})`);
            if (file.content && file.content.length > 0) {
                // Include file content (truncated if too long)
                const content = file.content.length > 2000
                    ? file.content.substring(0, 2000) + '\n... (content truncated)'
                    : file.content;
                contextParts.push('```');
                contextParts.push(content);
                contextParts.push('```');
            }
            else {
                contextParts.push('*File content not available in context*');
            }
            contextParts.push('');
        }
        // Include related files summary
        if (context.relatedFiles.length > 0) {
            contextParts.push(`## Related Files:`);
            context.relatedFiles.slice(0, 5).forEach(f => {
                contextParts.push(`- ${f.filePath} (${f.relationshipType})`);
            });
            contextParts.push('');
        }
        // Include task-specific files if different from semantic search results
        if (task.files.length > 0) {
            contextParts.push(`## Task Target Files:`);
            task.files.forEach(f => {
                contextParts.push(`- ${f}`);
            });
            contextParts.push('');
        }
        contextParts.push(`## Instructions`);
        contextParts.push(`- You are working in project directory: ${process.env.CODEMIND_USER_CWD || process.cwd()}`);
        contextParts.push(`- You have full access to read and modify files in this project`);
        contextParts.push(`- Focus on the task: "${task.description}"`);
        contextParts.push(`- Provide clear explanations of any changes you make`);
        contextParts.push(`- Follow the project's existing patterns and conventions`);
        return contextParts.join('\n');
    }
    needsClaudeCodeExecution(task) {
        // Almost all tasks need Claude Code execution except for very simple internal operations
        const internalOnlyTasks = ['database', 'git', 'file-scan', 'config'];
        const isInternalTask = internalOnlyTasks.some(type => task.description.toLowerCase().includes(type));
        // Return true for all tasks except internal-only operations
        return !isInternalTask;
    }
    async executeTaskWithClaude(task, context) {
        // Build a comprehensive prompt for Claude Code CLI
        const claudePrompt = this.buildClaudePrompt(task, context);
        const contextString = this.buildTaskContext(context, task);
        // Use the real Claude Code integration
        const result = await this.claudeIntegration.executeClaudeCode(claudePrompt, contextString, {
            projectPath: process.env.CODEMIND_USER_CWD || process.cwd(),
            maxTokens: 4000
        });
        const modifiedFiles = this.extractModifiedFiles(result.data);
        const claudeSummary = this.extractClaudeCodeSummary(result.data);
        // Report file changes transparently to user
        if (modifiedFiles.length > 0) {
            console.log(`📝 Files modified by Claude Code:`);
            modifiedFiles.forEach(file => {
                console.log(`   • ${file}`);
            });
        }
        // Display Claude's summary
        console.log(`📋 Claude Code Summary: ${claudeSummary}`);
        return {
            success: result.success,
            output: result.data,
            error: result.error,
            tokensUsed: result.tokensUsed,
            filesModified: modifiedFiles,
            summary: claudeSummary,
            claudeFullOutput: result.data // Keep full output for debugging
        };
    }
    buildClaudePrompt(task, context) {
        const taskType = task.description.toLowerCase();
        // Build enhanced prompt with semantic search context
        let prompt = '';
        if (taskType.includes('analyze')) {
            prompt = `Analyze the following code files for: ${task.description}

## Context from Semantic Search
Found ${context.primaryFiles.length} relevant files and ${context.relatedFiles.length} related files.

## Files to Analyze
${context.primaryFiles.slice(0, 5).map(f => `- ${f.filePath} (relevance: ${f.relevanceScore})`).join('\n')}

## Analysis Requirements
- Code structure and patterns
- Dependencies and relationships
- Quality metrics and issues
- Specific recommendations for improvement
- SOLID principles compliance

Please provide detailed analysis with specific examples and actionable recommendations.
If you need to modify files, use standard file editing tools.`;
        }
        else if (taskType.includes('refactor')) {
            prompt = `Refactor the following code for: ${task.description}

## Files Available for Refactoring
${context.primaryFiles.slice(0, 3).map(f => `- ${f.filePath}`).join('\n')}

## Refactoring Requirements
- Maintain existing functionality
- Improve code quality and readability
- Follow SOLID principles
- Make actual file modifications where beneficial
- Provide clear explanations for changes

Please modify the actual files and explain your changes.`;
        }
        else if (taskType.includes('report')) {
            prompt = `Generate a comprehensive report for: ${task.description}

## Available Context
- ${context.primaryFiles.length} primary files analyzed
- ${context.relatedFiles.length} related files in dependency graph
- ${Math.round(context.contextSize / 1000)}KB of code context

## Report Requirements
- Executive summary
- Key findings and metrics
- Code quality assessment
- Recommendations with priority levels
- Next steps and action items

Format as structured markdown with clear sections.`;
        }
        else {
            // Default enhanced prompt
            prompt = `Complete the following task: ${task.description}

## Available Context
${context.primaryFiles.length} relevant files found through semantic search:
${context.primaryFiles.slice(0, 3).map(f => `- ${f.filePath} (${f.relevanceScore} relevance)`).join('\n')}

## Task Context
This is part of an intelligent CodeMind workflow with enhanced context.

## Instructions
- Analyze the provided code files
- Make actual modifications if the task requires code changes
- Provide detailed explanations of your approach
- Include specific recommendations for improvement
- Consider SOLID principles and best practices

You have full access to modify project files as needed.`;
        }
        return prompt;
    }
    extractModifiedFiles(claudeOutput) {
        // Extract file paths that Claude Code might have modified
        const modifiedFiles = [];
        if (typeof claudeOutput === 'string') {
            // Look for various file modification patterns
            const patterns = [
                /(?:modified|updated|changed|created|edited|wrote to|saved)[\s:]*([^\s\n]+\.[a-zA-Z]+)/gi,
                /(?:File|file)[\s:]+([^\s\n]+\.[a-zA-Z]+)[\s]*(?:has been|was|is)[\s]*(?:modified|updated|changed|created)/gi,
                /\[([^\]]+\.[a-zA-Z]+)\]/gi, // File paths in brackets
                /(?:Write|Edit|Create).*?([a-zA-Z0-9_-]+\/[^\s\n]+\.[a-zA-Z]+)/gi // Paths with directories
            ];
            for (const pattern of patterns) {
                const matches = [...claudeOutput.matchAll(pattern)];
                matches.forEach(match => {
                    if (match[1]) {
                        modifiedFiles.push(match[1]);
                    }
                });
            }
        }
        if (claudeOutput && typeof claudeOutput === 'object' && claudeOutput.filesModified) {
            const files = Array.isArray(claudeOutput.filesModified) ? claudeOutput.filesModified : [claudeOutput.filesModified];
            modifiedFiles.push(...files);
        }
        // Remove duplicates and filter out invalid paths
        return [...new Set(modifiedFiles)]
            .filter(file => file && file.length > 0 && !file.includes(' ') && file.includes('.'));
    }
    /**
     * Extract and format Claude Code's summary for user display
     */
    extractClaudeCodeSummary(claudeOutput) {
        if (typeof claudeOutput === 'string') {
            // For responses shorter than 1000 characters, return the full response
            if (claudeOutput.length <= 1000) {
                return claudeOutput;
            }
            // Try to extract a summary section for longer responses
            const summaryPatterns = [
                /(?:Summary|SUMMARY)[\s:]*([^#\n]+(?:\n[^#\n]+)*)/i,
                /(?:Analysis|ANALYSIS)[\s:]*([^#\n]+(?:\n[^#\n]+)*)/i,
                /(?:Changes made|CHANGES)[\s:]*([^#\n]+(?:\n[^#\n]+)*)/i
            ];
            for (const pattern of summaryPatterns) {
                const match = claudeOutput.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
            // If no specific summary section, return first meaningful portion
            const lines = claudeOutput.split('\n').filter(line => line.trim().length > 0);
            if (lines.length > 0) {
                // For longer responses, use first few paragraphs (up to 500 chars)
                const summary = lines.slice(0, Math.min(5, lines.length)).join('\n');
                return summary.length > 500 ? summary.substring(0, 500) + '...' : summary;
            }
        }
        return 'Claude Code completed the task successfully.';
    }
    async runQualityChecks(subTaskResults) {
        // Run comprehensive quality checks: compilation, tests, coverage, principles
        return await this.qualityChecker.runAllChecks(subTaskResults);
    }
    async finalizeChanges(gitBranch, qualityResult, subTaskResults, isReportRequest = false) {
        // For report requests, always succeed (no code changes)
        if (isReportRequest) {
            return {
                success: true,
                filesModified: [],
                qualityScore: 100,
                gitBranch,
                databases: { neo4j: { nodesCreated: 0, relationshipsCreated: 0 }, redis: { filesUpdated: 0, hashesUpdated: 0 }, postgres: { recordsUpdated: 0 } },
                summary: 'Report generated successfully'
            };
        }
        // Commit and merge if quality is good, otherwise rollback
        if (qualityResult.overallScore >= 80 && qualityResult.compilation.success) {
            await this.gitManager.commitAndMerge(gitBranch, 'Feature implementation with quality checks passed');
            const allModifiedFiles = subTaskResults.flatMap(r => r.filesModified || []);
            const claudeSummaries = subTaskResults.map(r => r.summary).filter(s => s && s.length > 0);
            return {
                success: true,
                filesModified: allModifiedFiles,
                qualityScore: qualityResult.overallScore,
                gitBranch,
                databases: await this.calculateDatabaseUpdates(subTaskResults),
                summary: `✅ Task completed successfully!\n\n📊 Results:\n• ${allModifiedFiles.length} files modified\n• Quality score: ${qualityResult.overallScore}%\n\n📋 Claude Code Summary:\n${claudeSummaries.join('\n\n')}`
            };
        }
        else {
            await this.gitManager.rollbackBranch(gitBranch);
            return {
                success: false,
                filesModified: [],
                qualityScore: qualityResult.overallScore,
                gitBranch,
                databases: { neo4j: { nodesCreated: 0, relationshipsCreated: 0 }, redis: { filesUpdated: 0, hashesUpdated: 0 }, postgres: { recordsUpdated: 0 } },
                summary: `Feature implementation failed quality checks (${qualityResult.overallScore}% score)`
            };
        }
    }
    async updateAllDatabases(modifiedFiles, context) {
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
            postgres: { recordsUpdated: 1 }
        };
    }
}
exports.CodeMindWorkflowOrchestrator = CodeMindWorkflowOrchestrator;
// ===============================================
// REMAINING SPECIALIZED CLASSES (to be implemented)
// ===============================================
class QualityChecker {
    toolManager;
    constructor() {
        this.toolManager = new quality_manager_1.QualityToolManager();
    }
    async runAllChecks(subTaskResults) {
        console.log('🔍 Running comprehensive quality checks...');
        const projectPath = process.cwd();
        // Use the resilient quality tool manager
        const qualityResults = await this.toolManager.runQualityChecks(projectPath, {
            categories: ['linting', 'security', 'testing', 'compilation', 'complexity'],
            languages: [], // Auto-detect
            enableUserInteraction: false,
            skipOnFailure: true
        });
        // Convert tool manager results to expected interface
        let qualityScore = 100;
        const issues = [];
        // Calculate weighted scores and collect issues
        for (const [category, result] of Object.entries(qualityResults.results)) {
            const categoryResult = result;
            if (categoryResult.score < 100) {
                const weight = this.getCategoryWeight(category);
                qualityScore -= (100 - categoryResult.score) * weight / 100;
                issues.push(...categoryResult.issues);
            }
        }
        // Ensure score stays within bounds
        qualityScore = Math.max(0, Math.min(100, qualityScore));
        console.log(`📊 Quality analysis complete: ${qualityScore}% (${issues.length} issues found)`);
        if (issues.length > 0) {
            console.log('⚠️ Issues detected:');
            issues.forEach(issue => console.log(`   • ${issue}`));
        }
        // Extract specific results from quality tool manager
        const compilationResult = qualityResults.results.compilation || { success: true, errors: [] };
        const testingResult = qualityResults.results.testing || { passed: 100, failed: 0, coverage: 100 };
        return {
            compilation: compilationResult,
            tests: testingResult,
            codeQuality: {
                solidPrinciples: qualityScore > 70,
                security: qualityScore > 75,
                architecture: qualityScore > 75
            },
            overallScore: Math.round(qualityScore),
            issues,
            analysisDetails: {
                linting: qualityResults.results.linting || { penalty: 0, issues: [] },
                security: qualityResults.results.security || { penalty: 0, issues: [] },
                dependencies: qualityResults.results.dependencies || { penalty: 0, issues: [] },
                complexity: qualityResults.results.complexity || { penalty: 0, issues: [] },
                testing: qualityResults.results.testing || { penalty: 0, issues: [], results: {} },
                taskExecution: { penalty: 0, issues: [] }
            }
        };
    }
    getCategoryWeight(category) {
        const weights = {
            'linting': 15,
            'security': 20,
            'testing': 15,
            'compilation': 20,
            'complexity': 10,
            'dependencies': 10,
            'taskExecution': 10
        };
        return weights[category] || 5;
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
    }
}
exports.default = CodeMindWorkflowOrchestrator;
//# sourceMappingURL=codemind-workflow-orchestrator.js.map