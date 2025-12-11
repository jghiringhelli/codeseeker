"use strict";
/**
 * Workflow Orchestrator Service - STREAMLINED MVP
 * Single Responsibility: Coordinate the CodeMind Core Cycle with minimal friction
 *
 * Simplified workflow:
 * 1. Query Analysis (ONE Claude call for intent + complexity + clarification check)
 * 2. Semantic Search (find relevant files)
 * 3. Graph Analysis (show relationships if found)
 * 4. Build Context & Execute Claude
 * 5. Apply Changes (with user approval)
 * 6. Quality Check (auto build/test)
 * 7. Database Sync (silent)
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
const unified_query_analyzer_1 = require("./unified-query-analyzer");
const semantic_search_orchestrator_1 = require("./semantic-search-orchestrator");
const graph_analysis_service_1 = require("./graph-analysis-service");
const context_builder_1 = require("./context-builder");
const user_interaction_service_1 = require("./user-interaction-service");
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
    _unifiedAnalyzer;
    _searchOrchestrator;
    _graphAnalysisService;
    _contextBuilder;
    _userInteractionService;
    _databaseUpdateManager;
    _dbConnections;
    projectPath;
    projectId;
    _readlineInterface;
    // Lazy initialization
    get unifiedAnalyzer() {
        if (!this._unifiedAnalyzer) {
            this._unifiedAnalyzer = unified_query_analyzer_1.UnifiedQueryAnalyzer.getInstance();
        }
        return this._unifiedAnalyzer;
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
    setReadlineInterface(rl) {
        this._readlineInterface = rl;
        if (this._userInteractionService) {
            this._userInteractionService.setReadlineInterface(rl);
        }
    }
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
     * Execute the streamlined CodeMind workflow
     */
    async executeWorkflow(query, projectPath, options = {}) {
        try {
            if (projectPath !== this.projectPath) {
                this.projectPath = projectPath;
            }
            if (options.projectId) {
                this.projectId = options.projectId;
            }
            const isTransparentMode = options.transparentMode === true;
            // ==========================================
            // STEP 1: Unified Query Analysis (ONE Claude call)
            // ==========================================
            console.log(theme_1.Theme.colors.muted('⏳ Analyzing query...'));
            const analysisResult = await this.unifiedAnalyzer.analyzeQuery(query);
            const analysis = analysisResult.analysis;
            // Show minimal analysis result
            const intentIcon = this.getIntentIcon(analysis.intent);
            console.log(theme_1.Theme.colors.primary(`${intentIcon} ${analysis.intent.toUpperCase()}`) +
                theme_1.Theme.colors.muted(` (${Math.round(analysis.confidence * 100)}% confidence)`));
            // Handle clarification if Claude says it's critical
            let finalQuery = query;
            if (analysis.clarificationNeeded && analysis.clarificationQuestion && !isTransparentMode) {
                const answer = await this.askClarification(analysis.clarificationQuestion);
                if (answer) {
                    finalQuery = `${query}\n\nClarification: ${answer}`;
                }
            }
            // Convert to legacy QueryAnalysis format
            const queryAnalysis = this.toLegacyAnalysis(analysis);
            // ==========================================
            // STEP 2: Semantic Search
            // ==========================================
            console.log(theme_1.Theme.colors.muted('⏳ Searching codebase...'));
            const semanticResults = await this.searchOrchestrator.performSemanticSearch(analysis.searchTerms.length > 0 ? analysis.searchTerms.join(' ') : finalQuery, projectPath);
            // Show compact results
            if (semanticResults.length > 0) {
                console.log(theme_1.Theme.colors.success(`✓ Found ${semanticResults.length} relevant files`));
                // Show top 3 files inline
                const topFiles = semanticResults.slice(0, 3);
                topFiles.forEach(f => {
                    const match = Math.round(f.similarity * 100);
                    console.log(theme_1.Theme.colors.muted(`  → ${f.file}`) + theme_1.Theme.colors.success(` (${match}%)`));
                });
                if (semanticResults.length > 3) {
                    console.log(theme_1.Theme.colors.muted(`  ... +${semanticResults.length - 3} more`));
                }
            }
            else {
                console.log(theme_1.Theme.colors.muted('  No specific file matches (will use general context)'));
            }
            // ==========================================
            // STEP 3: Graph Analysis (only show if results found)
            // ==========================================
            let graphContext = this.createEmptyGraphContext();
            if (semanticResults.length > 0) {
                const graphResult = await this.graphAnalysisService.performGraphAnalysis(finalQuery, semanticResults);
                if (graphResult.relationships.length > 0 || (graphResult.classes && graphResult.classes.length > 0)) {
                    graphContext = graphResult;
                    // Show compact relationship info
                    const classCount = graphResult.classes?.length || 0;
                    const relCount = graphResult.relationships.length;
                    if (classCount > 0 || relCount > 0) {
                        console.log(theme_1.Theme.colors.success(`✓ Found ${classCount} components, ${relCount} relationships`));
                    }
                }
            }
            // ==========================================
            // STEP 4: Build Context & Execute Claude
            // ==========================================
            console.log(theme_1.Theme.colors.muted('⏳ Building context...'));
            const enhancedContext = this.contextBuilder.buildEnhancedContext(finalQuery, queryAnalysis, [], semanticResults, graphContext);
            // Execute Claude with enhanced context
            console.log(theme_1.Theme.colors.claudeCode('\n🤖 Claude is working...'));
            const claudeResponse = await this.userInteractionService.executeClaudeCode(semanticResults.length > 0 ? enhancedContext.enhancedPrompt : finalQuery);
            // ==========================================
            // STEP 5: Quality Check (auto build/test if files changed)
            // ==========================================
            let buildResult;
            if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0 && !isTransparentMode) {
                buildResult = await this.runAutonomousQualityCheck(projectPath);
            }
            // ==========================================
            // STEP 6: Database Sync (silent)
            // ==========================================
            let syncResult;
            if (!options.skipDatabaseSync && claudeResponse.filesToModify.length > 0) {
                syncResult = await this.syncDatabases(claudeResponse.filesToModify);
            }
            // Final summary
            this.showCompletionSummary(semanticResults.length, graphContext, buildResult);
            return {
                success: true,
                queryAnalysis,
                semanticResults,
                graphContext,
                enhancedContext,
                claudeResponse,
                buildResult,
                syncResult
            };
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error('❌ Workflow failed'));
            return {
                success: false,
                queryAnalysis: { assumptions: [], ambiguities: [], intent: 'general', confidence: 0.5 },
                semanticResults: [],
                graphContext: this.createEmptyGraphContext(),
                enhancedContext: this.createEmptyEnhancedContext(query),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Ask a clarification question (only when Claude says it's critical)
     */
    async askClarification(question) {
        if (this._readlineInterface) {
            this._readlineInterface.pause();
        }
        logger_1.Logger.mute();
        try {
            console.log(theme_1.Theme.colors.warning('\n❓ Clarification needed:'));
            const answer = await inquirer_1.default.prompt([{
                    type: 'input',
                    name: 'response',
                    message: question,
                    validate: (input) => input.trim().length > 0 || 'Please provide an answer (or press Ctrl+C to skip)'
                }]);
            return answer.response;
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                console.log(theme_1.Theme.colors.muted('  Skipped - proceeding with best guess'));
                return undefined;
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            if (this._readlineInterface) {
                this._readlineInterface.resume();
            }
        }
    }
    /**
     * Run autonomous quality check - build and test without prompts
     */
    async runAutonomousQualityCheck(projectPath) {
        const result = { buildSuccess: true, testSuccess: true };
        // Auto-run build
        console.log(theme_1.Theme.colors.muted('\n⏳ Running build...'));
        let buildOnlyResult = await this.runBuild(projectPath);
        result.buildSuccess = buildOnlyResult.success;
        result.buildOutput = buildOnlyResult.output;
        result.buildError = buildOnlyResult.error;
        if (result.buildSuccess) {
            console.log(theme_1.Theme.colors.success('✓ Build passed'));
        }
        else {
            console.log(theme_1.Theme.colors.error('✗ Build failed - auto-fixing...'));
            const fixPrompt = `Fix the build error:\n${result.buildError?.substring(0, 2000)}`;
            await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'build');
            // Retry build
            buildOnlyResult = await this.runBuild(projectPath);
            result.buildSuccess = buildOnlyResult.success;
            console.log(result.buildSuccess ?
                theme_1.Theme.colors.success('✓ Build fixed') :
                theme_1.Theme.colors.warning('⚠️ Build still failing'));
        }
        // Auto-run tests (only if build passed)
        if (result.buildSuccess) {
            console.log(theme_1.Theme.colors.muted('⏳ Running tests...'));
            let testOnlyResult = await this.runTests(projectPath);
            result.testSuccess = testOnlyResult.success;
            result.testOutput = testOnlyResult.output;
            result.testError = testOnlyResult.error;
            if (result.testSuccess) {
                console.log(theme_1.Theme.colors.success('✓ Tests passed'));
            }
            else {
                console.log(theme_1.Theme.colors.error('✗ Tests failed - auto-fixing...'));
                const fixPrompt = `Fix the failing tests:\n${result.testError?.substring(0, 2000)}`;
                await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'test');
                // Retry tests
                testOnlyResult = await this.runTests(projectPath);
                result.testSuccess = testOnlyResult.success;
                console.log(result.testSuccess ?
                    theme_1.Theme.colors.success('✓ Tests fixed') :
                    theme_1.Theme.colors.warning('⚠️ Some tests still failing'));
            }
        }
        return result;
    }
    /**
     * Show minimal completion summary
     */
    showCompletionSummary(filesFound, graphContext, buildResult) {
        const parts = [];
        if (filesFound > 0) {
            parts.push(`${filesFound} files analyzed`);
        }
        const relCount = graphContext.relationships?.length || 0;
        if (relCount > 0) {
            parts.push(`${relCount} relationships`);
        }
        if (buildResult) {
            if (buildResult.buildSuccess && buildResult.testSuccess) {
                parts.push('build ✓ tests ✓');
            }
            else if (buildResult.buildSuccess) {
                parts.push('build ✓');
            }
        }
        if (parts.length > 0) {
            console.log(theme_1.Theme.colors.muted(`\n📊 ${parts.join(' | ')}`));
        }
        console.log('');
    }
    /**
     * Convert UnifiedAnalysis to legacy QueryAnalysis format
     */
    toLegacyAnalysis(analysis) {
        return {
            assumptions: [],
            ambiguities: analysis.clarificationNeeded && analysis.clarificationQuestion
                ? [analysis.clarificationQuestion]
                : [],
            intent: analysis.intent,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            requiresModifications: ['create', 'modify', 'fix', 'delete'].includes(analysis.intent),
            targetEntities: analysis.targetEntities
        };
    }
    /**
     * Get icon for intent
     */
    getIntentIcon(intent) {
        const icons = {
            'create': '✨', 'modify': '📝', 'fix': '🔧', 'delete': '🗑️',
            'understand': '💡', 'analyze': '🔍', 'search': '🔎', 'general': '📌'
        };
        return icons[intent] || '📌';
    }
    /**
     * Run build
     */
    async runBuild(projectPath) {
        try {
            const { stdout, stderr } = await execAsync('npm run build', {
                cwd: projectPath,
                timeout: 120000
            });
            return { success: true, output: stdout + (stderr ? '\n' + stderr : '') };
        }
        catch (error) {
            return { success: false, error: error.message || String(error) };
        }
    }
    /**
     * Run tests
     */
    async runTests(projectPath) {
        try {
            const { stdout, stderr } = await execAsync('npm test', {
                cwd: projectPath,
                timeout: 180000
            });
            return { success: true, output: stdout + (stderr ? '\n' + stderr : '') };
        }
        catch (error) {
            return { success: false, error: error.message || String(error) };
        }
    }
    /**
     * Sync databases
     */
    async syncDatabases(files) {
        const absoluteFiles = files.map(f => path.isAbsolute(f) ? f : path.join(this.projectPath, f));
        const dbResult = await this.databaseUpdateManager.updateMainDatabase(absoluteFiles);
        const graphResult = await this.databaseUpdateManager.updateGraphDatabase(absoluteFiles);
        const cacheResult = await this.databaseUpdateManager.updateRedisCache(absoluteFiles);
        return {
            filesUpdated: dbResult.recordsUpdated,
            graphNodesCreated: graphResult.nodesCreated,
            cacheUpdated: cacheResult.filesUpdated
        };
    }
    /**
     * Check if workflow should be used
     */
    shouldUseWorkflow(input) {
        return this.unifiedAnalyzer.isNaturalLanguageQuery(input);
    }
    /**
     * Create empty graph context
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
                qualityMetrics: { coupling: 0, cohesion: 0, complexity: 0 }
            }
        };
    }
    /**
     * Create empty enhanced context
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
    /**
     * Factory method
     */
    static create(projectPath, projectId) {
        return new WorkflowOrchestrator(projectPath || process.cwd(), projectId);
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
//# sourceMappingURL=workflow-orchestrator.js.map