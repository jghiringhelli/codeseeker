"use strict";
/**
 * CLI Orchestrator - High-Level Command Orchestration
 *
 * Follows SOLID principles:
 * - Single Responsibility: Orchestrates high-level CLI flow
 * - Open/Closed: Extensible for new command types
 * - Liskov Substitution: Command handlers are interchangeable
 * - Interface Segregation: Clean command interfaces
 * - Dependency Inversion: Depends on abstractions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIOrchestrator = void 0;
const logger_1 = require("../../utils/logger");
const semantic_orchestrator_1 = require("../../orchestration/semantic-orchestrator");
const navigator_1 = require("../../features/tree-navigation/navigator");
const tool_selector_1 = require("../tool-selector");
const context_optimizer_1 = require("../context-optimizer");
const tool_bundle_system_1 = require("../tool-bundle-system");
/**
 * High-level orchestrator that coordinates all CLI operations
 * Keeps the main CLI class simple by handling complex orchestration logic
 */
class CLIOrchestrator {
    logger;
    semanticOrchestrator;
    treeNavigator;
    toolSelector;
    contextOptimizer;
    bundleSystem;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        // Initialize orchestration services
        this.semanticOrchestrator = new semantic_orchestrator_1.SemanticOrchestrator();
        this.treeNavigator = new navigator_1.TreeNavigator();
        this.toolSelector = new tool_selector_1.ToolSelector();
        this.contextOptimizer = new context_optimizer_1.ContextOptimizer();
        this.bundleSystem = new tool_bundle_system_1.ToolBundleSystem();
    }
    /**
     * High-level analysis orchestration
     * Simplified 4-step process
     */
    async executeAnalysis(request, context) {
        const startTime = performance.now();
        try {
            this.logger.info(`🚀 Starting analysis: "${request.query}"`);
            // Step 1: Semantic Discovery
            const semanticResults = await this.performSemanticDiscovery(request);
            // Step 2: Context Enhancement  
            const enhancedContext = await this.enhanceContext(request, semanticResults);
            // Step 3: Tool Selection & Execution
            const toolResults = await this.selectAndExecuteTools(request, enhancedContext, context);
            // Step 4: Results Integration
            const finalResult = await this.integrateResults(semanticResults, toolResults);
            const executionTime = performance.now() - startTime;
            this.logger.info(`✅ Analysis completed in ${Math.round(executionTime)}ms`);
            return {
                success: true,
                analysis: finalResult,
                executionTime,
                tokensUsed: this.calculateTokensUsed(semanticResults, toolResults)
            };
        }
        catch (error) {
            const executionTime = performance.now() - startTime;
            this.logger.error(`❌ Analysis failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                executionTime
            };
        }
    }
    /**
     * Step 1: Semantic Discovery
     * Use semantic orchestrator to understand the query and find relevant code
     */
    async performSemanticDiscovery(request) {
        this.logger.info('🔍 Step 1: Semantic Discovery');
        return await this.semanticOrchestrator.analyzeWithSemanticContext({
            query: request.query,
            projectPath: request.projectPath,
            maxResults: 50,
            includeRelated: true,
            intent: this.determineIntent(request.query)
        });
    }
    /**
     * Step 2: Context Enhancement
     * Use tree navigation and context optimization to build rich context
     */
    async enhanceContext(request, semanticResults) {
        this.logger.info('🌳 Step 2: Context Enhancement');
        // Get relevant files from semantic results
        const relevantFiles = [
            ...(semanticResults.primaryResults || []),
            ...(semanticResults.relatedFiles || [])
        ];
        // Perform tree analysis on relevant files
        const treeAnalysis = await this.treeNavigator.performAnalysis(request.projectPath, request.projectId, {
            focusFiles: relevantFiles.slice(0, 20), // Limit for performance
            semanticBoost: true,
            callGraphDepth: 2,
            includeComplexity: true
        });
        // Optimize context based on token budget
        const optimizedContext = await this.contextOptimizer.optimizeContext({
            query: request.query,
            projectPath: request.projectPath,
            tokenBudget: request.options?.tokenBudget || 4000,
            strategy: 'smart'
        });
        return {
            semanticResults,
            treeAnalysis,
            optimizedContext
        };
    }
    /**
     * Step 3: Tool Selection & Execution
     * Select appropriate tools and execute them with enhanced context
     */
    async selectAndExecuteTools(request, enhancedContext, context) {
        this.logger.info('🔧 Step 3: Tool Selection & Execution');
        // Select tools based on query and context
        const toolSelection = this.toolSelector.selectTools({
            userQuery: request.query,
            projectPath: request.projectPath,
            maxTokens: context.settings.tokenBudget,
            preferBundles: true
        });
        this.logger.info(`Selected ${toolSelection.selectedTools.length} tools: ${toolSelection.selectedTools.map(t => t.name).join(', ')}`);
        // Execute tools (simplified - in real implementation would execute each tool)
        const toolResults = {
            toolSelection,
            results: [] // Tool execution results would go here
        };
        return toolResults;
    }
    /**
     * Step 4: Results Integration
     * Combine all results into coherent analysis
     */
    async integrateResults(semanticResults, toolResults) {
        this.logger.info('📊 Step 4: Results Integration');
        return {
            semanticInsights: semanticResults,
            toolInsights: toolResults,
            summary: this.generateAnalysisSummary(semanticResults, toolResults),
            recommendations: this.generateRecommendations(semanticResults, toolResults)
        };
    }
    /**
     * Determine user intent from query
     */
    determineIntent(query) {
        const queryLower = query.toLowerCase();
        if (queryLower.includes('bug') || queryLower.includes('fix') || queryLower.includes('error'))
            return 'debugging';
        if (queryLower.includes('refactor') || queryLower.includes('improve') || queryLower.includes('code'))
            return 'coding';
        if (queryLower.includes('architect') || queryLower.includes('design') || queryLower.includes('pattern'))
            return 'architecture';
        if (queryLower.includes('research') || queryLower.includes('find') || queryLower.includes('search'))
            return 'research';
        return 'overview'; // Default
    }
    /**
     * Calculate approximate tokens used
     */
    calculateTokensUsed(semanticResults, toolResults) {
        // Simplified calculation - in real implementation would sum actual usage
        return 1500;
    }
    /**
     * Generate analysis summary
     */
    generateAnalysisSummary(semanticResults, toolResults) {
        const fileCount = (semanticResults.primaryResults?.length || 0) + (semanticResults.relatedFiles?.length || 0);
        const toolCount = toolResults.toolSelection?.selectedTools?.length || 0;
        return `Analysis complete. Examined ${fileCount} files using ${toolCount} specialized tools.`;
    }
    /**
     * Generate recommendations
     */
    generateRecommendations(semanticResults, toolResults) {
        return [
            'Consider reviewing the identified files for optimization opportunities',
            'Run the suggested tools for deeper analysis',
            'Check the semantic relationships for architectural insights'
        ];
    }
}
exports.CLIOrchestrator = CLIOrchestrator;
//# sourceMappingURL=cli-orchestrator.js.map