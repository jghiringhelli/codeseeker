"use strict";
/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind Core Cycle workflow
 *
 * This orchestrator manages the 12-step workflow with Context-Aware Clarification:
 * 1. Query Analysis - Analyze user input for assumptions and ambiguities
 * 2. Task Decomposition - Split complex queries into focused sub-tasks
 * 3. Semantic Search - Find relevant files using PostgreSQL pgvector + FTS
 * 4. Code Relationship Analysis - Map relationships using knowledge graph
 * 5. Context-Aware Clarification - Ask targeted questions based on research results
 * 6. Sub-Task Context Generation - Build tailored context per sub-task
 * 7. Enhanced Context Building - Build optimized prompt for Claude
 * 8. Claude Code Execution - Execute sub-tasks or full query with context
 * 9. File Modification Approval - Confirm changes before applying
 * 10. Build/Test Verification - Ensure code compiles and tests pass
 * 11. Database Sync - Update semantic search and knowledge graph
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
exports.WorkflowOrchestrator = void 0;
const natural_language_processor_1 = require("./natural-language-processor");
const semantic_search_orchestrator_1 = require("./semantic-search-orchestrator");
const graph_analysis_service_1 = require("./graph-analysis-service");
const context_builder_1 = require("./context-builder");
const user_interaction_service_1 = require("./user-interaction-service");
const task_decomposition_service_1 = require("./task-decomposition-service");
const context_aware_clarification_service_1 = require("./context-aware-clarification-service");
const database_update_manager_1 = require("../../../shared/managers/database-update-manager");
const database_config_1 = require("../../../config/database-config");
const theme_1 = require("../../ui/theme");
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const logger_1 = require("../../../utils/logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class WorkflowOrchestrator {
    _nlpProcessor;
    _searchOrchestrator;
    _graphAnalysisService;
    _contextBuilder;
    _userInteractionService;
    _taskDecompositionService;
    _clarificationService;
    _databaseUpdateManager;
    _dbConnections;
    projectPath;
    projectId;
    _readlineInterface;
    // Lazy initialization with singleton pattern for better performance
    get nlpProcessor() {
        if (!this._nlpProcessor) {
            this._nlpProcessor = new natural_language_processor_1.NaturalLanguageProcessor();
        }
        return this._nlpProcessor;
    }
    get searchOrchestrator() {
        if (!this._searchOrchestrator) {
            this._searchOrchestrator = new semantic_search_orchestrator_1.SemanticSearchOrchestrator(this.dbConnections);
            if (this.projectId) {
                this._searchOrchestrator.setProjectId(this.projectId);
            }
        }
        return this._searchOrchestrator;
    }
    get graphAnalysisService() {
        if (!this._graphAnalysisService) {
            this._graphAnalysisService = new graph_analysis_service_1.GraphAnalysisService(this.projectPath);
        }
        return this._graphAnalysisService;
    }
    get contextBuilder() {
        if (!this._contextBuilder) {
            this._contextBuilder = new context_builder_1.ContextBuilder();
        }
        return this._contextBuilder;
    }
    get userInteractionService() {
        if (!this._userInteractionService) {
            this._userInteractionService = new user_interaction_service_1.UserInteractionService();
            if (this._readlineInterface) {
                this._userInteractionService.setReadlineInterface(this._readlineInterface);
            }
        }
        return this._userInteractionService;
    }
    get taskDecompositionService() {
        if (!this._taskDecompositionService) {
            this._taskDecompositionService = new task_decomposition_service_1.TaskDecompositionService();
        }
        return this._taskDecompositionService;
    }
    get clarificationService() {
        if (!this._clarificationService) {
            this._clarificationService = new context_aware_clarification_service_1.ContextAwareClarificationService();
            if (this._readlineInterface) {
                this._clarificationService.setReadlineInterface(this._readlineInterface);
            }
        }
        return this._clarificationService;
    }
    get dbConnections() {
        if (!this._dbConnections) {
            this._dbConnections = new database_config_1.DatabaseConnections();
        }
        return this._dbConnections;
    }
    get databaseUpdateManager() {
        if (!this._databaseUpdateManager) {
            this._databaseUpdateManager = new database_update_manager_1.DatabaseUpdateManager(this.projectId, this.projectPath);
        }
        return this._databaseUpdateManager;
    }
    constructor(projectPath, projectId) {
        this.projectPath = projectPath;
        this.projectId = projectId || 'default';
    }
    /**
     * Set readline interface for user interactions
     */
    setReadlineInterface(rl) {
        this._readlineInterface = rl;
        if (this._userInteractionService) {
            this._userInteractionService.setReadlineInterface(rl);
        }
        if (this._clarificationService) {
            this._clarificationService.setReadlineInterface(rl);
        }
    }
    /**
     * Set project context
     */
    setProject(projectId, projectPath) {
        this.projectId = projectId;
        this.projectPath = projectPath;
        if (this._searchOrchestrator) {
            this._searchOrchestrator.setProjectId(projectId);
        }
        if (this._databaseUpdateManager) {
            this._databaseUpdateManager.setProject(projectId, projectPath);
        }
    }
    /**
     * Check database health and provide setup guidance if unavailable
     */
    async checkDatabaseHealth() {
        const issues = [];
        // Check PostgreSQL
        try {
            const { Pool } = require('pg');
            const pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123',
                connectionTimeoutMillis: 3000
            });
            await pool.query('SELECT 1');
            await pool.end();
        }
        catch (error) {
            issues.push('PostgreSQL');
        }
        // Check Redis (optional, warn only)
        try {
            const Redis = require('ioredis');
            const redis = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                connectTimeout: 3000,
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                retryStrategy: () => null // Don't retry
            });
            // Suppress error events to prevent console flooding
            redis.on('error', () => { });
            await redis.connect();
            await redis.ping();
            await redis.quit();
        }
        catch {
            // Redis is optional, don't add to critical issues
        }
        return { healthy: issues.length === 0, issues };
    }
    /**
     * Display database setup guidance
     */
    displayDatabaseSetupGuidance(issues) {
        console.log('\n⚠️  Database Connection Issues Detected');
        console.log('━'.repeat(50));
        console.log(`Unable to connect to: ${issues.join(', ')}\n`);
        console.log('📋 Setup Options:\n');
        console.log('1️⃣  Start databases with Docker (recommended):');
        console.log('   docker-compose up -d postgres redis\n');
        console.log('2️⃣  Or start Rancher Desktop / Docker Desktop\n');
        console.log('3️⃣  Environment variables (if using custom setup):');
        console.log('   DB_HOST=localhost DB_PORT=5432 DB_NAME=codemind');
        console.log('   DB_USER=codemind DB_PASSWORD=codemind123');
        console.log('   REDIS_HOST=localhost REDIS_PORT=6379\n');
        console.log('4️⃣  Initialize project after databases are running:');
        console.log('   codemind setup\n');
        console.log('━'.repeat(50));
        console.log('⏳ Continuing with limited functionality (file-based search only)...\n');
    }
    /**
     * Execute the complete CodeMind Core Cycle workflow
     */
    async executeWorkflow(query, projectPath, options = {}) {
        try {
            // Update project path if different
            if (projectPath !== this.projectPath) {
                this.projectPath = projectPath;
            }
            if (options.projectId) {
                this.projectId = options.projectId;
            }
            // Check database health and provide guidance if needed
            const dbHealth = await this.checkDatabaseHealth();
            if (!dbHealth.healthy) {
                this.displayDatabaseSetupGuidance(dbHealth.issues);
            }
            // Transparent mode is now controlled by explicit option, not auto-detected
            // Users can pass --transparent flag to skip interactive prompts
            const isTransparentMode = options.transparentMode === true;
            if (isTransparentMode) {
                // In transparent mode, skip interactive prompts
                options.skipUserClarification = true;
                options.skipFileConfirmation = true;
                options.skipBuildTest = true; // Let Claude handle build/test
                options.skipDatabaseSync = true; // Sync after Claude completes
            }
            // ==========================================
            // STEP 1: Query Analysis (with spinner) - Now using Claude-based analysis
            // ==========================================
            let spinner = theme_1.Spinner.create('Analyzing query with Claude...');
            const queryAnalysis = await this.nlpProcessor.analyzeQueryAsync(query);
            spinner.succeed(`Query analyzed (intent: ${queryAnalysis.intent}, confidence: ${(queryAnalysis.confidence * 100).toFixed(0)}%)`);
            // Show analysis details from Claude's analysis
            if (queryAnalysis.assumptions.length > 0 || queryAnalysis.ambiguities.length > 0 || queryAnalysis.reasoning) {
                this.logQueryAnalysis(queryAnalysis);
            }
            // ==========================================
            // STEP 2: Task Decomposition (for complex queries)
            // Run BEFORE preview so we can show all sub-tasks
            // Uses Claude AI for intelligent decomposition
            // ==========================================
            spinner = theme_1.Spinner.create('Analyzing task complexity...');
            const decomposition = await this.taskDecompositionService.decomposeQueryAsync(query, queryAnalysis);
            if (decomposition.isComplex) {
                spinner.succeed(`Complex query: ${decomposition.subTasks.length} sub-tasks identified`);
            }
            else {
                spinner.succeed('Simple query: single task identified');
            }
            // ==========================================
            // TASK PREVIEW: Show user what CodeMind will do
            // Shows all sub-tasks if query was decomposed into multiple parts
            // ==========================================
            this.displayTaskPreview(query, queryAnalysis, decomposition);
            // For complex queries, show detailed breakdown and get user confirmation
            if (decomposition.isComplex && !isTransparentMode) {
                const confirmed = await this.confirmTaskExecution(decomposition);
                if (!confirmed.proceed) {
                    if (confirmed.clarification) {
                        // User provided clarification - retry with updated query
                        return this.executeWorkflow(confirmed.clarification, projectPath, options);
                    }
                    return {
                        success: false,
                        queryAnalysis,
                        semanticResults: [],
                        graphContext: this.createEmptyGraphContext(),
                        enhancedContext: this.createEmptyEnhancedContext(query),
                        error: 'Task execution cancelled by user'
                    };
                }
            }
            // ==========================================
            // WORKFLOW BRANCHES: Simple vs Complex Query Processing
            // ==========================================
            let claudeResponse;
            let semanticResults = [];
            let graphContext = this.createEmptyGraphContext();
            let enhancedContext;
            let clarificationResult;
            let subTaskContexts = [];
            if (decomposition.isComplex && decomposition.subTasks.length > 1) {
                // ==========================================
                // COMPLEX QUERY: Process each sub-task with its own search & context
                // Steps 3-7 run in a loop for each sub-task, then step 8 executes
                // ==========================================
                console.log(theme_1.Theme.sectionTitle(`Processing ${decomposition.subTasks.length} Sub-Tasks`, '🔄'));
                const combinedResponse = {
                    response: '',
                    filesToModify: [],
                    summary: ''
                };
                // Aggregate all semantic results and graph contexts for final result
                const allSemanticResults = [];
                const allClasses = [];
                const allRelationships = [];
                for (const subTask of decomposition.subTasks) {
                    // Enhanced sub-task header with visual separation
                    console.log(theme_1.Theme.formatTaskHeader(subTask.id, subTask.type, subTask.description));
                    console.log(theme_1.Theme.colors.muted(`  ${theme_1.Theme.createProgressBar(subTask.id, decomposition.subTasks.length)}`));
                    // STEP 3 (per sub-task): Semantic Search using sub-task's search terms
                    const searchQuery = subTask.searchTerms.length > 0
                        ? subTask.searchTerms.join(' ')
                        : subTask.description;
                    spinner = theme_1.Spinner.create(`  Searching for: "${searchQuery.substring(0, 30)}..."`);
                    const taskSemanticResults = await this.searchOrchestrator.performSemanticSearch(searchQuery, projectPath);
                    // Apply context filter if defined
                    let filteredResults = taskSemanticResults;
                    if (subTask.contextFilter) {
                        filteredResults = this.applyContextFilter(taskSemanticResults, subTask.contextFilter);
                    }
                    if (filteredResults.length > 0) {
                        spinner.succeed(`  Found ${theme_1.Theme.colors.highlight(String(filteredResults.length))} relevant files`);
                        // Show files with enhanced formatting
                        filteredResults.slice(0, 3).forEach(r => {
                            console.log(theme_1.Theme.formatFile(r.file, r.similarity, r.type));
                        });
                        if (filteredResults.length > 3) {
                            console.log(theme_1.Theme.colors.muted(`     ... +${filteredResults.length - 3} more`));
                        }
                    }
                    else {
                        spinner.succeed('  Search complete (no specific matches)');
                    }
                    // STEP 4 (per sub-task): Code Relationship Analysis
                    spinner = theme_1.Spinner.create('  Analyzing relationships...');
                    const taskGraphContext = await this.graphAnalysisService.performGraphAnalysis(searchQuery, filteredResults);
                    const taskRelCount = taskGraphContext.relationships?.length || 0;
                    const taskClassCount = taskGraphContext.classes?.length || 0;
                    spinner.succeed(`  Found ${theme_1.Theme.colors.component(String(taskClassCount))} components, ${theme_1.Theme.colors.relationship(String(taskRelCount))} relationships`);
                    // STEP 5 (per sub-task): Context-Aware Clarification
                    // Only ask for first sub-task or if high-impact ambiguity detected
                    if (!options.skipUserClarification && filteredResults.length > 0 && subTask.id === 1) {
                        const taskClarification = await this.clarificationService.analyzeAndClarify(subTask.description, { ...queryAnalysis, intent: subTask.type }, filteredResults, taskGraphContext, { skipClarification: isTransparentMode, maxQuestions: 2 });
                        if (!taskClarification.skipped && taskClarification.questionsAnswered > 0) {
                            clarificationResult = taskClarification;
                        }
                        else if (taskClarification.skipped && taskClarification.skipReason) {
                            // Display why clarification was skipped
                            console.log(theme_1.Theme.colors.muted(`  ℹ️  No clarification needed: ${taskClarification.skipReason}`));
                        }
                    }
                    // STEP 6 (per sub-task): Build Sub-Task Context
                    spinner = theme_1.Spinner.create('  Building context...');
                    const taskContext = this.taskDecompositionService.filterContextForSubTask(subTask, filteredResults, taskGraphContext);
                    subTaskContexts.push(taskContext);
                    spinner.succeed('  Context ready');
                    // Display sub-task context summary with enhanced formatting
                    if (filteredResults.length > 0 || taskClassCount > 0) {
                        console.log('\n' + theme_1.Theme.formatResultsSummary({
                            files: filteredResults.length,
                            components: taskClassCount,
                            relationships: taskRelCount
                        }));
                    }
                    // STEP 7 (per sub-task): Execute Claude Code
                    console.log(theme_1.Theme.colors.claudeCode('\n  🤖 Executing with Claude Code...'));
                    const subResponse = await this.userInteractionService.executeClaudeCode(taskContext.enhancedPrompt);
                    // Aggregate responses
                    if (subResponse.response) {
                        combinedResponse.response += `\n--- Sub-task ${subTask.id} (${subTask.type}) ---\n`;
                        combinedResponse.response += subResponse.response;
                    }
                    if (subResponse.filesToModify) {
                        combinedResponse.filesToModify.push(...subResponse.filesToModify);
                    }
                    if (subResponse.summary) {
                        combinedResponse.summary += subResponse.summary + '\n';
                    }
                    // Aggregate search results for final WorkflowResult
                    allSemanticResults.push(...filteredResults);
                    if (taskGraphContext.classes)
                        allClasses.push(...taskGraphContext.classes);
                    if (taskGraphContext.relationships)
                        allRelationships.push(...taskGraphContext.relationships);
                    console.log(theme_1.Theme.colors.success(`  ✓ Sub-task ${subTask.id} complete`));
                }
                // Deduplicate aggregated results
                combinedResponse.filesToModify = [...new Set(combinedResponse.filesToModify)];
                claudeResponse = combinedResponse;
                // Set aggregated results for WorkflowResult
                semanticResults = this.deduplicateSemanticResults(allSemanticResults);
                graphContext = {
                    classes: this.deduplicateClasses(allClasses),
                    relationships: this.deduplicateRelationships(allRelationships),
                    relationshipDetails: allRelationships,
                    packageStructure: [],
                    graphInsights: {
                        totalNodes: allClasses.length,
                        totalRelationships: allRelationships.length,
                        architecturalPatterns: [],
                        qualityMetrics: { coupling: 0, cohesion: 0, complexity: 0 }
                    }
                };
                // Build combined enhanced context for result
                enhancedContext = this.contextBuilder.buildEnhancedContext(query, queryAnalysis, [], semanticResults, graphContext);
                console.log(theme_1.Theme.colors.success(`\n✅ Completed all ${decomposition.subTasks.length} sub-tasks`));
            }
            else {
                // ==========================================
                // SIMPLE QUERY: Single pass through steps 3-8
                // ==========================================
                // STEP 3: Semantic Search (PostgreSQL pgvector + FTS)
                spinner = theme_1.Spinner.create('Searching codebase...');
                semanticResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
                if (semanticResults.length > 0) {
                    spinner.succeed(`Found ${theme_1.Theme.colors.highlight(String(semanticResults.length))} relevant files`);
                    console.log(theme_1.Theme.colors.highlight('\n  📁 RELEVANT FILES'));
                    console.log(theme_1.Theme.divider('─', 55));
                    const topFiles = semanticResults.slice(0, 5);
                    topFiles.forEach(r => {
                        console.log(theme_1.Theme.formatFile(r.file, r.similarity, r.type));
                    });
                    if (semanticResults.length > 5) {
                        console.log(theme_1.Theme.colors.muted(`     ... +${semanticResults.length - 5} more files`));
                    }
                }
                else {
                    spinner.succeed('Search complete');
                }
                // STEP 4: Code Relationship Analysis
                spinner = theme_1.Spinner.create('Analyzing code relationships...');
                graphContext = await this.graphAnalysisService.performGraphAnalysis(query, semanticResults);
                const relCount = graphContext.relationships?.length || 0;
                const classCount = graphContext.classes?.length || 0;
                spinner.succeed(`Found ${theme_1.Theme.colors.component(String(classCount))} components, ${theme_1.Theme.colors.relationship(String(relCount))} relationships`);
                if (relCount > 0) {
                    console.log(theme_1.Theme.colors.highlight('\n  🔗 RELATIONSHIPS'));
                    console.log(theme_1.Theme.divider('─', 55));
                    const topRels = graphContext.relationships.slice(0, 3);
                    topRels.forEach(r => {
                        console.log(theme_1.Theme.formatRelationship(r.from, r.to, r.type));
                    });
                    if (relCount > 3) {
                        console.log(theme_1.Theme.colors.muted(`     ... +${relCount - 3} more relationships`));
                    }
                }
                // STEP 5: Context-Aware Clarification
                let userClarifications = [];
                if (!options.skipUserClarification && semanticResults.length > 0) {
                    clarificationResult = await this.clarificationService.analyzeAndClarify(query, queryAnalysis, semanticResults, graphContext, { skipClarification: isTransparentMode, maxQuestions: 3 });
                    if (!clarificationResult.skipped && clarificationResult.questionsAnswered > 0) {
                        userClarifications = Array.from(clarificationResult.clarifications.entries())
                            .map(([key, value]) => `${key}: ${value}`);
                        query = clarificationResult.enhancedQuery;
                    }
                    else if (clarificationResult.skipped && clarificationResult.skipReason) {
                        // Display why clarification was skipped
                        console.log(theme_1.Theme.colors.muted(`\n  ℹ️  No clarification needed: ${clarificationResult.skipReason}`));
                    }
                }
                // STEP 6: Enhanced Context Building
                spinner = theme_1.Spinner.create('Building context...');
                enhancedContext = this.contextBuilder.buildEnhancedContext(query, queryAnalysis, userClarifications, semanticResults, graphContext);
                spinner.succeed('Context ready');
                // Display context summary
                if (semanticResults.length > 0 || graphContext.classes?.length > 0) {
                    this.displayContextSummary(semanticResults, graphContext);
                }
                // STEP 7: Claude Code Execution
                claudeResponse = await this.userInteractionService.executeClaudeCode(semanticResults.length > 0 ? enhancedContext.enhancedPrompt : query);
            }
            // Note: File changes are now confirmed BEFORE being applied (in executeClaudeCode)
            // No need for post-execution file modification approval
            // ==========================================
            // STEP 9: Build/Test Verification (with user options)
            // ==========================================
            let buildResult;
            if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0) {
                // Ask user which verification steps to run
                const buildOptions = await this.userInteractionService.confirmBuildAndTest();
                if (buildOptions.cancelled) {
                    console.log(theme_1.Theme.colors.muted('\n  Skipped build/test verification'));
                }
                else {
                    buildResult = { buildSuccess: true, testSuccess: true };
                    // ==========================================
                    // AUTONOMOUS BUILD CHECK
                    // If build fails, automatically fix and retry
                    // ==========================================
                    if (buildOptions.runBuild) {
                        console.log(theme_1.Theme.colors.muted('\n  Running build...'));
                        let buildOnlyResult = await this.runBuild(projectPath);
                        buildResult.buildSuccess = buildOnlyResult.success;
                        buildResult.buildOutput = buildOnlyResult.output;
                        buildResult.buildError = buildOnlyResult.error;
                        if (buildResult.buildSuccess) {
                            console.log(theme_1.Theme.colors.success('  ✓ Build successful'));
                        }
                        else {
                            // Autonomous fix - no user prompt needed
                            console.log(theme_1.Theme.colors.error('  ✗ Build failed'));
                            console.log(theme_1.Theme.colors.muted('  Automatically fixing build errors...'));
                            const fixPrompt = `Fix the build error in ${projectPath}:

${buildResult.buildError?.substring(0, 2000)}

Instructions:
1. Analyze the build error above
2. Fix the root cause of the build failure
3. Apply the necessary changes to make the build pass`;
                            await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'build');
                            // Re-run build after fix
                            console.log(theme_1.Theme.colors.muted('\n  Re-running build...'));
                            buildOnlyResult = await this.runBuild(projectPath);
                            buildResult.buildSuccess = buildOnlyResult.success;
                            if (buildResult.buildSuccess) {
                                console.log(theme_1.Theme.colors.success('  ✓ Build fixed and successful'));
                            }
                            else {
                                console.log(theme_1.Theme.colors.warning('  ⚠️ Build still failing - manual intervention may be needed'));
                            }
                        }
                    }
                    // ==========================================
                    // AUTONOMOUS TEST CHECK
                    // If tests fail, automatically fix and retry
                    // ==========================================
                    if (buildOptions.runTests && (buildResult.buildSuccess || !buildOptions.runBuild)) {
                        console.log(theme_1.Theme.colors.muted('\n  Running tests...'));
                        let testOnlyResult = await this.runTests(projectPath);
                        buildResult.testSuccess = testOnlyResult.success;
                        buildResult.testOutput = testOnlyResult.output;
                        buildResult.testError = testOnlyResult.error;
                        if (buildResult.testSuccess) {
                            console.log(theme_1.Theme.colors.success('  ✓ Tests passed'));
                        }
                        else {
                            // Autonomous fix - no user prompt needed
                            console.log(theme_1.Theme.colors.error('  ✗ Tests failed'));
                            console.log(theme_1.Theme.colors.muted('  Automatically fixing test failures...'));
                            const fixPrompt = `Fix the failing tests in ${projectPath}:

Error Output:
${buildResult.testError?.substring(0, 2000)}

Instructions:
1. Analyze the test failure(s) above to identify the root cause
2. Determine if the issue is in the test code or the implementation code
3. If the test expectations are wrong, fix the test assertions
4. If the implementation has a bug, fix the implementation
5. Apply the minimal changes needed to make tests pass
6. Do NOT skip or delete failing tests - fix them properly`;
                            await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'test');
                            // Re-run tests after fix
                            console.log(theme_1.Theme.colors.muted('\n  Re-running tests...'));
                            testOnlyResult = await this.runTests(projectPath);
                            buildResult.testSuccess = testOnlyResult.success;
                            if (buildResult.testSuccess) {
                                console.log(theme_1.Theme.colors.success('  ✓ Tests fixed and passing'));
                            }
                            else {
                                console.log(theme_1.Theme.colors.warning('  ⚠️ Some tests still failing - manual intervention may be needed'));
                            }
                        }
                    }
                    // ==========================================
                    // AUTONOMOUS TEST GENERATION
                    // Generate and run new tests for changed files
                    // ==========================================
                    if (buildOptions.generateTests && claudeResponse.filesToModify.length > 0) {
                        const testType = buildOptions.testType || 'unit';
                        const testTypeLabels = {
                            'unit': {
                                label: 'unit tests',
                                description: 'Test individual functions/classes in isolation with mocked dependencies'
                            },
                            'integration': {
                                label: 'integration tests',
                                description: 'Test component interactions and data flow between modules'
                            },
                            'e2e': {
                                label: 'end-to-end tests',
                                description: 'Test complete user workflows from start to finish'
                            }
                        };
                        const { label, description } = testTypeLabels[testType];
                        console.log(theme_1.Theme.colors.info(`\n  📝 Generating ${label} for changed files...`));
                        const testGenPrompt = `Generate ${label} for the following files in ${projectPath}:

${claudeResponse.filesToModify.join('\n')}

Test type: ${testType.toUpperCase()}
Description: ${description}

Requirements:
- Follow the project's existing test patterns and conventions
- Use the project's testing framework (Jest, Mocha, etc.)
- ${testType === 'unit' ? 'Mock external dependencies and focus on isolated functionality' : ''}
- ${testType === 'integration' ? 'Test realistic component interactions without external services' : ''}
- ${testType === 'e2e' ? 'Test complete user journeys with realistic data' : ''}
- Include edge cases and error scenarios
- Add descriptive test names that explain the expected behavior`;
                        await this.userInteractionService.executeDirectFixCommand(testGenPrompt, 'test');
                        // Run the new tests
                        console.log(theme_1.Theme.colors.muted('\n  Running new tests...'));
                        const newTestResult = await this.runTests(projectPath);
                        if (newTestResult.success) {
                            console.log(theme_1.Theme.colors.success(`  ✓ New ${label} generated and passing`));
                        }
                        else {
                            // Auto-fix failing new tests
                            console.log(theme_1.Theme.colors.warning(`  ⚠️ Some new ${label} failing, auto-fixing...`));
                            const fixNewTestsPrompt = `Fix the failing tests that were just generated:

${newTestResult.error?.substring(0, 2000)}

Instructions:
1. Analyze the test failures
2. Fix the test assertions or implementation as needed
3. Ensure all tests pass`;
                            await this.userInteractionService.executeDirectFixCommand(fixNewTestsPrompt, 'test');
                            // Re-run after fix
                            const retryNewTests = await this.runTests(projectPath);
                            if (retryNewTests.success) {
                                console.log(theme_1.Theme.colors.success(`  ✓ New ${label} fixed and passing`));
                            }
                            else {
                                console.log(theme_1.Theme.colors.warning(`  ⚠️ Some ${label} may still need adjustment`));
                            }
                        }
                    }
                }
            }
            // ==========================================
            // STEP 10: Database Sync (silent)
            // ==========================================
            let syncResult;
            if (!options.skipDatabaseSync && claudeResponse.filesToModify.length > 0) {
                syncResult = await this.syncDatabases(claudeResponse.filesToModify);
            }
            return {
                success: true,
                queryAnalysis,
                decomposition,
                clarificationResult,
                subTaskContexts: subTaskContexts.length > 0 ? subTaskContexts : undefined,
                semanticResults,
                graphContext,
                enhancedContext,
                claudeResponse,
                buildResult,
                syncResult
            };
        }
        catch (error) {
            console.error('❌ Workflow execution failed:', error);
            // Use synchronous fallback for error case
            const fallbackAnalysis = this.nlpProcessor.analyzeQuery(query);
            return {
                success: false,
                queryAnalysis: fallbackAnalysis,
                semanticResults: [],
                graphContext: this.createEmptyGraphContext(),
                enhancedContext: this.createEmptyEnhancedContext(query),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Confirm task execution with user
     * Shows detailed task breakdown and allows user to proceed, modify, or cancel
     */
    async confirmTaskExecution(_decomposition) {
        // Task details already shown by displayTaskPreview - just show the confirmation prompt
        // Pause readline and mute logger before inquirer prompts
        if (this._readlineInterface) {
            this._readlineInterface.pause();
        }
        logger_1.Logger.mute();
        try {
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'How would you like to proceed?',
                    choices: [
                        { name: '✅ Proceed with these tasks', value: 'proceed' },
                        { name: '✏️  Clarify or modify the request', value: 'clarify' },
                        { name: '❌ Cancel', value: 'cancel' }
                    ]
                }
            ]);
            if (answer.action === 'proceed') {
                return { proceed: true };
            }
            if (answer.action === 'clarify') {
                const clarification = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'text',
                        message: 'Provide additional details or modifications:',
                        validate: (input) => input.trim().length > 0 || 'Please provide some clarification'
                    }
                ]);
                return {
                    proceed: false,
                    clarification: clarification.text
                };
            }
            return { proceed: false };
        }
        catch (error) {
            // Handle Ctrl+C gracefully - treat as cancel
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                console.log(theme_1.Theme.colors.muted('\n⚠️  Prompt cancelled'));
                return { proceed: false };
            }
            throw error;
        }
        finally {
            // Unmute logger and resume readline after inquirer
            logger_1.Logger.unmute();
            if (this._readlineInterface) {
                this._readlineInterface.resume();
            }
        }
    }
    /**
     * Get complexity badge
     */
    getComplexityBadge(complexity) {
        const badges = {
            'low': theme_1.Theme.colors.success('●') + ' Low',
            'medium': theme_1.Theme.colors.warning('●') + ' Medium',
            'high': theme_1.Theme.colors.error('●') + ' High'
        };
        return badges[complexity] || complexity;
    }
    /**
     * Run build only
     */
    async runBuild(projectPath) {
        try {
            const { stdout, stderr } = await execAsync('npm run build', {
                cwd: projectPath,
                timeout: 120000 // 2 minute timeout
            });
            return {
                success: true,
                output: stdout + (stderr ? '\n' + stderr : '')
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
    /**
     * Run tests only
     */
    async runTests(projectPath) {
        try {
            const { stdout, stderr } = await execAsync('npm test', {
                cwd: projectPath,
                timeout: 180000 // 3 minute timeout
            });
            return {
                success: true,
                output: stdout + (stderr ? '\n' + stderr : '')
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
    /**
     * Verify build and run tests (legacy method - kept for compatibility)
     * @deprecated Use runBuild and runTests separately with the new workflow
     */
    async _verifyBuildAndTests(projectPath) {
        const buildResult = await this.runBuild(projectPath);
        const testResult = await this.runTests(projectPath);
        return {
            buildSuccess: buildResult.success,
            buildOutput: buildResult.output,
            buildError: buildResult.error,
            testSuccess: testResult.success,
            testOutput: testResult.output,
            testError: testResult.error
        };
    }
    /**
     * Sync modified files to all databases
     */
    async syncDatabases(files) {
        const absoluteFiles = files.map(f => path.isAbsolute(f) ? f : path.join(this.projectPath, f));
        // Update PostgreSQL (semantic search)
        const dbResult = await this.databaseUpdateManager.updateMainDatabase(absoluteFiles);
        // Update Neo4j (knowledge graph)
        const graphResult = await this.databaseUpdateManager.updateGraphDatabase(absoluteFiles);
        // Update Redis (cache)
        const cacheResult = await this.databaseUpdateManager.updateRedisCache(absoluteFiles);
        return {
            filesUpdated: dbResult.recordsUpdated,
            graphNodesCreated: graphResult.nodesCreated,
            cacheUpdated: cacheResult.filesUpdated
        };
    }
    /**
     * Display context summary - shows what CodeMind found
     * Uses enhanced formatting to highlight important information
     */
    displayContextSummary(semanticResults, graphContext) {
        // Section header with visual emphasis
        console.log(theme_1.Theme.sectionTitle('CodeMind Context Details', '🧠'));
        // Show relevant files with enhanced formatting
        if (semanticResults.length > 0) {
            console.log(theme_1.Theme.colors.highlight('\n  📁 RELEVANT FILES'));
            console.log(theme_1.Theme.divider('─', 55));
            const topFiles = semanticResults.slice(0, 8);
            topFiles.forEach(r => {
                // Find corresponding class for line number
                const classInfo = graphContext.classes?.find(c => c.filePath === r.file ||
                    r.file.toLowerCase().includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()));
                const startLine = classInfo?.metadata?.startLine || classInfo?.sourceLocation?.startLine;
                const location = startLine ? `${r.file}:${startLine}` : r.file;
                console.log(theme_1.Theme.formatFile(location, r.similarity, r.type));
            });
            if (semanticResults.length > 8) {
                console.log(theme_1.Theme.colors.muted(`     ... +${semanticResults.length - 8} more files`));
            }
        }
        // Show classes found with enhanced formatting
        if (graphContext.classes && graphContext.classes.length > 0) {
            console.log(theme_1.Theme.colors.highlight('\n  📦 COMPONENTS'));
            console.log(theme_1.Theme.divider('─', 55));
            const topClasses = graphContext.classes.slice(0, 6);
            topClasses.forEach(c => {
                const startLine = c.metadata?.startLine || c.sourceLocation?.startLine;
                const location = c.filePath
                    ? `${c.filePath}${startLine ? `:${startLine}` : ''}`
                    : undefined;
                console.log(theme_1.Theme.formatComponent(c.name, c.type, location));
            });
            if (graphContext.classes.length > 6) {
                console.log(theme_1.Theme.colors.muted(`     ... +${graphContext.classes.length - 6} more`));
            }
        }
        // Show relationships with enhanced formatting
        if (graphContext.relationships.length > 0) {
            console.log(theme_1.Theme.colors.highlight('\n  🔗 RELATIONSHIPS'));
            console.log(theme_1.Theme.divider('─', 55));
            const topRels = graphContext.relationships.slice(0, 5);
            topRels.forEach(r => {
                // Format: ClassName.methodName() → TargetClass.targetMethod()
                const fromDisplay = r.fromMethod
                    ? `${r.from}.${r.fromMethod}()`
                    : r.from;
                const toDisplay = r.toMethod
                    ? `${r.to}.${r.toMethod}()`
                    : r.to;
                console.log(theme_1.Theme.formatRelationship(fromDisplay, toDisplay, r.type));
            });
            if (graphContext.relationships.length > 5) {
                console.log(theme_1.Theme.colors.muted(`     ... +${graphContext.relationships.length - 5} more`));
            }
        }
        // Summary statistics box
        console.log('\n' + theme_1.Theme.formatResultsSummary({
            files: semanticResults.length,
            components: graphContext.classes?.length || 0,
            relationships: graphContext.relationships.length
        }));
        console.log('');
    }
    /**
     * Check if input is suitable for the full workflow
     */
    shouldUseWorkflow(input) {
        return this.nlpProcessor.isNaturalLanguageQuery(input);
    }
    /**
     * Get workflow statistics for monitoring
     */
    getWorkflowStats(result) {
        let stepsCompleted = 0;
        const totalSteps = 10;
        if (result.queryAnalysis)
            stepsCompleted++;
        if (result.semanticResults.length > 0)
            stepsCompleted += 2;
        if (result.graphContext.relationships.length >= 0)
            stepsCompleted++;
        if (result.enhancedContext)
            stepsCompleted++;
        if (result.claudeResponse)
            stepsCompleted++;
        if (result.buildResult)
            stepsCompleted++;
        if (result.syncResult)
            stepsCompleted++;
        if (result.success)
            stepsCompleted += 2;
        return {
            stepsCompleted,
            totalSteps,
            filesAnalyzed: result.semanticResults.length,
            relationshipsFound: result.graphContext.relationships.length,
            assumptionsDetected: result.queryAnalysis.assumptions.length
        };
    }
    /**
     * Display task preview at the beginning of the workflow
     * Shows users what CodeMind will do based on query analysis and decomposition
     */
    displayTaskPreview(query, analysis, decomposition) {
        console.log(theme_1.Theme.sectionTitle('Task Preview', '📋'));
        if (decomposition.isComplex && decomposition.subTasks.length > 1) {
            // Complex query with multiple sub-tasks - highlight task count
            console.log(theme_1.Theme.colors.warning(`  📊 Complex request: `) + theme_1.Theme.colors.highlight(`${decomposition.subTasks.length} tasks identified`));
            console.log(theme_1.Theme.colors.muted(`     Overall confidence: ${this.formatConfidenceLabel(analysis.confidence)}`));
            console.log(theme_1.Theme.colors.highlight('\n  📝 TASKS TO EXECUTE'));
            console.log(theme_1.Theme.divider('─', 55));
            for (const task of decomposition.subTasks) {
                // Use enhanced task header formatting
                console.log(theme_1.Theme.formatTaskHeader(task.id, task.type, task.description));
                const complexity = this.getComplexityBadge(task.estimatedComplexity);
                console.log(theme_1.Theme.colors.muted(`     Complexity: ${complexity}`));
                // Show dependencies if any
                if (task.dependencies.length > 0) {
                    console.log(theme_1.Theme.colors.relationship(`     ↳ Depends on: Task ${task.dependencies.join(', Task ')}`));
                }
            }
            // Show execution phases with visual progress
            if (decomposition.executionPlan.phases.length > 1) {
                console.log(theme_1.Theme.colors.highlight('\n  🔄 EXECUTION ORDER'));
                console.log(theme_1.Theme.divider('─', 55));
                for (const phase of decomposition.executionPlan.phases) {
                    const taskList = phase.taskIds.map(id => theme_1.Theme.colors.component(`#${id}`)).join(', ');
                    console.log(`  ${theme_1.Theme.colors.warning(`Phase ${phase.phaseNumber}:`)} ${taskList}`);
                }
            }
        }
        else {
            // Simple query - single task with prominent action display
            const intentIcon = this.getIntentIcon(analysis.intent);
            const intentLabel = this.formatIntentLabel(analysis.intent);
            const confidenceLabel = this.formatConfidenceLabel(analysis.confidence);
            console.log(theme_1.Theme.emphasize(`${intentIcon} Action: ${intentLabel}`));
            console.log(theme_1.Theme.colors.muted(`     Confidence: ${confidenceLabel}`));
            // Show what CodeMind will do
            const taskDescription = this.generateTaskDescription(query, analysis);
            console.log(theme_1.Theme.colors.highlight('\n  📝 WHAT CODEMIND WILL DO'));
            console.log(theme_1.Theme.divider('─', 55));
            console.log(theme_1.Theme.formatList(taskDescription, '▸', 4));
        }
        // Show files that will be targeted (if entities identified)
        if (analysis.targetEntities && analysis.targetEntities.length > 0) {
            console.log(theme_1.Theme.colors.highlight('\n  🎯 TARGET AREAS'));
            console.log(theme_1.Theme.divider('─', 55));
            analysis.targetEntities.forEach(entity => {
                console.log(`  ${theme_1.Theme.colors.file(`→ ${entity}`)}`);
            });
        }
        console.log('');
    }
    /**
     * Get icon for intent type
     */
    getIntentIcon(intent) {
        const icons = {
            'create': '✨',
            'modify': '📝',
            'refactor': '🔄',
            'fix': '🔧',
            'analyze': '🔍',
            'explain': '💡',
            'test': '🧪',
            'document': '📚',
            'delete': '🗑️',
            'general': '📌'
        };
        return icons[intent] || '📌';
    }
    /**
     * Format intent as human-readable label
     */
    formatIntentLabel(intent) {
        const labels = {
            'create': 'CREATE new code',
            'modify': 'MODIFY existing code',
            'refactor': 'REFACTOR code structure',
            'fix': 'FIX/DEBUG issues',
            'analyze': 'ANALYZE codebase',
            'explain': 'EXPLAIN code behavior',
            'test': 'CREATE/RUN tests',
            'document': 'UPDATE documentation',
            'delete': 'REMOVE code',
            'general': 'PROCESS request'
        };
        return labels[intent] || intent.toUpperCase();
    }
    /**
     * Format confidence as visual indicator
     */
    formatConfidenceLabel(confidence) {
        const percentage = Math.round(confidence * 100);
        if (confidence >= 0.8) {
            return theme_1.Theme.colors.success(`●●●●● ${percentage}% (High)`);
        }
        else if (confidence >= 0.6) {
            return theme_1.Theme.colors.warning(`●●●○○ ${percentage}% (Medium)`);
        }
        else {
            return theme_1.Theme.colors.error(`●●○○○ ${percentage}% (Low - may need clarification)`);
        }
    }
    /**
     * Generate human-readable task description based on analysis
     */
    generateTaskDescription(query, analysis) {
        const steps = [];
        // First, what we'll search for
        steps.push('1. Search codebase for relevant files');
        // Then, based on intent
        switch (analysis.intent) {
            case 'create':
                steps.push('2. Identify similar patterns for reference');
                steps.push('3. Generate new code following existing conventions');
                break;
            case 'modify':
                steps.push('2. Identify files to modify');
                steps.push('3. Apply requested changes');
                break;
            case 'refactor':
                steps.push('2. Analyze current code structure');
                steps.push('3. Apply refactoring improvements');
                break;
            case 'fix':
                steps.push('2. Identify the source of the issue');
                steps.push('3. Apply fix and verify');
                break;
            case 'analyze':
                steps.push('2. Gather code metrics and patterns');
                steps.push('3. Generate analysis report');
                break;
            case 'explain':
                steps.push('2. Trace code flow and dependencies');
                steps.push('3. Provide detailed explanation');
                break;
            case 'test':
                steps.push('2. Identify testable components');
                steps.push('3. Generate/run tests');
                break;
            case 'document':
                steps.push('2. Extract documentation from code');
                steps.push('3. Generate/update documentation');
                break;
            default:
                steps.push('2. Analyze context and requirements');
                steps.push('3. Execute requested action');
        }
        // Add modification warning if needed
        if (analysis.requiresModifications) {
            steps.push('4. Request approval before making changes');
        }
        return steps;
    }
    /**
     * Log query analysis results from Claude-based analysis
     */
    logQueryAnalysis(analysis) {
        // Show Claude's reasoning if available
        if (analysis.reasoning) {
            console.log(theme_1.Theme.colors.muted(`   Reasoning: ${analysis.reasoning}`));
        }
        // Show if modifications are required
        if (analysis.requiresModifications !== undefined) {
            console.log(theme_1.Theme.colors.muted(`   Requires modifications: ${analysis.requiresModifications ? 'Yes' : 'No'}`));
        }
        // Show detected assumptions
        if (analysis.assumptions.length > 0) {
            console.log(theme_1.Theme.colors.warning(`   ⚠️  Assumptions detected: ${analysis.assumptions.length}`));
            analysis.assumptions.forEach(assumption => {
                console.log(theme_1.Theme.colors.muted(`      • ${assumption}`));
            });
        }
        // Show detected ambiguities
        if (analysis.ambiguities.length > 0) {
            console.log(theme_1.Theme.colors.warning(`   ❓ Ambiguities detected: ${analysis.ambiguities.length}`));
            analysis.ambiguities.forEach(ambiguity => {
                console.log(theme_1.Theme.colors.muted(`      • ${ambiguity}`));
            });
        }
        // Show suggested clarifications
        if (analysis.suggestedClarifications && analysis.suggestedClarifications.length > 0) {
            console.log(theme_1.Theme.colors.info(`   💡 Suggested clarifications:`));
            analysis.suggestedClarifications.forEach(clarification => {
                console.log(theme_1.Theme.colors.muted(`      • ${clarification}`));
            });
        }
        // Show target entities
        if (analysis.targetEntities && analysis.targetEntities.length > 0) {
            console.log(theme_1.Theme.colors.muted(`   🎯 Target entities: ${analysis.targetEntities.join(', ')}`));
        }
    }
    /**
     * Create empty graph context for error cases
     */
    createEmptyGraphContext() {
        return {
            classes: [],
            relationships: [],
            relationshipDetails: [],
            packageStructure: [],
            graphInsights: {
                totalNodes: 0,
                totalRelationships: 0,
                architecturalPatterns: [],
                qualityMetrics: {
                    coupling: 0,
                    cohesion: 0,
                    complexity: 0
                }
            }
        };
    }
    /**
     * Create empty enhanced context for error cases
     */
    createEmptyEnhancedContext(query) {
        return {
            originalQuery: query,
            clarifications: [],
            assumptions: [],
            relevantFiles: [],
            codeRelationships: [],
            packageStructure: [],
            enhancedPrompt: query
        };
    }
    /**
     * Apply context filter to semantic results
     */
    applyContextFilter(results, filter) {
        let filtered = [...results];
        // Filter by file patterns
        if (filter.filePatterns && filter.filePatterns.length > 0) {
            filtered = filtered.filter(r => filter.filePatterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                return regex.test(r.file);
            }));
        }
        // Filter by file types
        if (filter.fileTypes && filter.fileTypes.length > 0) {
            filtered = filtered.filter(r => filter.fileTypes.some(type => r.type.toLowerCase().includes(type.toLowerCase())));
        }
        // Apply max files limit
        if (filter.maxFiles && filtered.length > filter.maxFiles) {
            filtered = filtered.slice(0, filter.maxFiles);
        }
        // If filtering removed all results, return original (limited)
        if (filtered.length === 0 && results.length > 0) {
            return results.slice(0, filter.maxFiles || 10);
        }
        return filtered;
    }
    /**
     * Deduplicate semantic results by file path
     */
    deduplicateSemanticResults(results) {
        const seen = new Map();
        for (const result of results) {
            const existing = seen.get(result.file);
            // Keep the one with higher similarity
            if (!existing || result.similarity > existing.similarity) {
                seen.set(result.file, result);
            }
        }
        return Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);
    }
    /**
     * Deduplicate classes by name
     */
    deduplicateClasses(classes) {
        if (!classes)
            return [];
        const seen = new Map();
        for (const cls of classes) {
            if (!seen.has(cls.name)) {
                seen.set(cls.name, cls);
            }
        }
        return Array.from(seen.values());
    }
    /**
     * Deduplicate relationships
     */
    deduplicateRelationships(relationships) {
        if (!relationships)
            return [];
        const seen = new Set();
        const unique = [];
        for (const rel of relationships) {
            const key = `${rel.from}-${rel.type}-${rel.to}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(rel);
            }
        }
        return unique;
    }
    /**
     * Factory method for dependency injection
     */
    static create(projectPath, projectId) {
        return new WorkflowOrchestrator(projectPath || process.cwd(), projectId);
    }
    /**
     * Validate that all required services are properly initialized
     */
    validateServices() {
        return !!(this.nlpProcessor &&
            this.searchOrchestrator &&
            this.graphAnalysisService &&
            this.contextBuilder &&
            this.userInteractionService);
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        if (this._databaseUpdateManager) {
            await this._databaseUpdateManager.close();
        }
        if (this._dbConnections) {
            await this._dbConnections.closeAll();
        }
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
//# sourceMappingURL=workflow-orchestrator.js.map