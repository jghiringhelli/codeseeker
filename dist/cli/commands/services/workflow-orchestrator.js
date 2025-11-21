"use strict";
/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind workflow
 * Orchestrates the entire process from query analysis to Claude execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const natural_language_processor_1 = require("./natural-language-processor");
const semantic_search_orchestrator_1 = require("./semantic-search-orchestrator");
const graph_analysis_service_1 = require("./graph-analysis-service");
const context_builder_1 = require("./context-builder");
const user_interaction_service_1 = require("./user-interaction-service");
class WorkflowOrchestrator {
    _nlpProcessor;
    _searchOrchestrator;
    _graphAnalysisService;
    _contextBuilder;
    _userInteractionService;
    projectPath;
    // Lazy initialization with singleton pattern for better performance
    get nlpProcessor() {
        if (!this._nlpProcessor) {
            this._nlpProcessor = new natural_language_processor_1.NaturalLanguageProcessor();
        }
        return this._nlpProcessor;
    }
    get searchOrchestrator() {
        if (!this._searchOrchestrator) {
            this._searchOrchestrator = new semantic_search_orchestrator_1.SemanticSearchOrchestrator();
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
            // Set readline interface if available
            if (this._readlineInterface) {
                this._userInteractionService.setReadlineInterface(this._readlineInterface);
            }
        }
        return this._userInteractionService;
    }
    constructor(projectPath) {
        this.projectPath = projectPath;
        // Services now use lazy initialization for better performance
    }
    /**
     * Set readline interface for user interactions
     */
    setReadlineInterface(rl) {
        // Pass readline interface to user interaction service when it's created
        if (this._userInteractionService) {
            this._userInteractionService.setReadlineInterface(rl);
        }
        // Store for later use when service is created
        this._readlineInterface = rl;
    }
    _readlineInterface;
    /**
     * Execute the complete CodeMind workflow
     */
    async executeWorkflow(query, projectPath, options = {}) {
        try {
            // Analyze the query (silent for simple queries)
            const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
            const isSimpleQuery = queryAnalysis.assumptions.length === 0 && queryAnalysis.ambiguities.length === 0;
            if (!isSimpleQuery) {
                console.log('🧠 Starting CodeMind workflow...\n');
                console.log('1️⃣ Analyzing query for assumptions and ambiguities...');
                this.logQueryAnalysis(queryAnalysis);
            }
            // Get user clarifications if needed (only show if necessary)
            let userClarifications = [];
            if (!options.skipUserClarification && (queryAnalysis.assumptions.length > 0 || queryAnalysis.ambiguities.length > 0)) {
                console.log('\n2️⃣ Requesting user clarifications...');
                userClarifications = await this.userInteractionService.promptForClarifications(queryAnalysis);
            }
            // Perform semantic search (silent)
            const semanticResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
            // Only show search results if we found files or it's a complex query
            if (semanticResults.length > 0 || !isSimpleQuery) {
                console.log(`\n📁 Found ${semanticResults.length} relevant files`);
                if (semanticResults.length > 0) {
                    semanticResults.slice(0, 3).forEach((result, index) => {
                        console.log(`   ${index + 1}. ${result.file} (${result.type}, similarity: ${(result.similarity * 100).toFixed(0)}%)`);
                    });
                    if (semanticResults.length > 3) {
                        console.log(`   ... and ${semanticResults.length - 3} more files`);
                    }
                }
            }
            // Perform graph analysis (silent unless relevant)
            const graphContext = await this.graphAnalysisService.performGraphAnalysis(query, semanticResults);
            if (graphContext.relationships.length > 0 && !isSimpleQuery) {
                console.log(`\n🔗 Found ${graphContext.relationships.length} relationships between components`);
            }
            // Build enhanced context (silent)
            const enhancedContext = this.contextBuilder.buildEnhancedContext(query, queryAnalysis, userClarifications, semanticResults, graphContext);
            // Execute Claude Code (only show if relevant)
            if (!isSimpleQuery) {
                console.log('\n🚀 Processing with enhanced context...');
            }
            const claudeResponse = await this.userInteractionService.executeClaudeCode(enhancedContext.enhancedPrompt);
            // Show file modification confirmation (fix the display)
            if (!options.skipFileConfirmation && claudeResponse.filesToModify.length > 0) {
                console.log('\n📝 Changes to review:');
                // Show actual diffs here instead of just file list
                claudeResponse.filesToModify.forEach((file, index) => {
                    console.log(`   ${index + 1}. ${file}`);
                });
                const confirmation = await this.userInteractionService.confirmFileModifications(claudeResponse.filesToModify);
                if (!confirmation.approved) {
                    console.log('❌ File modifications cancelled by user');
                    return {
                        success: false,
                        queryAnalysis,
                        semanticResults,
                        graphContext,
                        enhancedContext,
                        error: 'File modifications cancelled by user'
                    };
                }
                if (confirmation.dontAskAgain) {
                    console.log('✅ File modification approval disabled for this session');
                }
            }
            // Display results (clean summary for simple queries)
            if (isSimpleQuery && semanticResults.length > 0) {
                console.log('\n✅ Results:\n');
                // For simple class queries, show the classes found directly
                semanticResults.forEach((result, index) => {
                    console.log(`${index + 1}. ${result.content}`);
                });
            }
            else if (!isSimpleQuery) {
                const contextStats = this.contextBuilder.getContextStats(enhancedContext);
                this.userInteractionService.displayExecutionSummary(claudeResponse.summary, contextStats);
            }
            return {
                success: true,
                queryAnalysis,
                semanticResults,
                graphContext,
                enhancedContext,
                claudeResponse
            };
        }
        catch (error) {
            console.error('❌ Workflow execution failed:', error);
            return {
                success: false,
                queryAnalysis: this.nlpProcessor.analyzeQuery(query),
                semanticResults: [],
                graphContext: {
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
                },
                enhancedContext: {
                    originalQuery: query,
                    clarifications: [],
                    assumptions: [],
                    relevantFiles: [],
                    codeRelationships: [],
                    packageStructure: [],
                    enhancedPrompt: query
                },
                error: error instanceof Error ? error.message : String(error)
            };
        }
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
        const totalSteps = 8;
        // Count completed steps based on result
        if (result.queryAnalysis)
            stepsCompleted++;
        if (result.semanticResults.length > 0)
            stepsCompleted += 2; // Search + clarification
        if (result.graphContext.relationships.length >= 0)
            stepsCompleted++;
        if (result.enhancedContext)
            stepsCompleted++;
        if (result.claudeResponse)
            stepsCompleted++;
        if (result.success)
            stepsCompleted += 2; // Confirmation + summary
        return {
            stepsCompleted,
            totalSteps,
            filesAnalyzed: result.semanticResults.length,
            relationshipsFound: result.graphContext.relationships.length,
            assumptionsDetected: result.queryAnalysis.assumptions.length
        };
    }
    /**
     * Log query analysis results
     */
    logQueryAnalysis(analysis) {
        console.log(`   Intent: ${analysis.intent} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);
        if (analysis.assumptions.length > 0) {
            console.log(`   Assumptions detected: ${analysis.assumptions.length}`);
            analysis.assumptions.forEach(assumption => {
                console.log(`   • ${assumption}`);
            });
        }
        if (analysis.ambiguities.length > 0) {
            console.log(`   Ambiguities detected: ${analysis.ambiguities.length}`);
            analysis.ambiguities.forEach(ambiguity => {
                console.log(`   • ${ambiguity}`);
            });
        }
        if (analysis.assumptions.length === 0 && analysis.ambiguities.length === 0) {
            console.log('   No assumptions or ambiguities detected');
        }
    }
    /**
     * Create a factory method for dependency injection
     */
    static create(projectPath) {
        return new WorkflowOrchestrator(projectPath || process.cwd());
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
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
//# sourceMappingURL=workflow-orchestrator.js.map