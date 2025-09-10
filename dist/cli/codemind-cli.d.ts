#!/usr/bin/env node
/**
 * CodeMind Unified Interactive CLI
 * A comprehensive command-line interface with interactive prompts like Claude Code
 */
declare class CodeMindCLI {
    private rl;
    private session;
    private logger;
    private localCache;
    private orchestrator;
    private semanticOrchestrator;
    private treeNavigator;
    private toolSelector;
    private contextOptimizer;
    private bundleSystem;
    private isInitialized;
    private performanceMetrics;
    private inInteractiveSession;
    constructor();
    private getPrompt;
    private setupEventHandlers;
    private loadHistory;
    private saveHistory;
    private autocomplete;
    setProjectPath(projectPath: string): void;
    start(): Promise<void>;
    private initialize;
    private checkProject;
    private processCommand;
    private executeBuiltinCommand;
    /**
     * Three-Layer Architecture Analysis Flow
     * Layer 2: Semantic Search → Semantic Graph → Tree Navigation
     * Layer 3: Tool Selection → Database Learning + Claude Code Outcome Analysis
     */
    private handleAnalyze;
    private handleSearch;
    private handleRefactor;
    private handleOptimize;
    private handleTest;
    private handleDocument;
    private handleSetup;
    private handleInit;
    private checkDatabaseConnectivity;
    private analyzeProjectWithClaude;
    private registerProject;
    private generateSemanticEmbeddings;
    private getSourceFiles;
    private cacheFileInRedis;
    private detectFileLanguage;
    private extractExports;
    private extractImports;
    private extractClasses;
    private extractFunctions;
    private populateSemanticSearchTable;
    private populateBasicContentIndex;
    private getProjectIdFromPath;
    private buildCodeGraph;
    private summarizeRelationships;
    private inferUseCasesWithClaude;
    private runDuplicationDetection;
    private detectLanguages;
    private detectFrameworks;
    private buildEnhancedPrompt;
    private processWithClaude;
    private getLanguageFromPath;
    private groupByRelationship;
    private handleConfig;
    private handleTools;
    private handleBundles;
    private handleSettings;
    private handleCache;
    private handleProject;
    private handleNaturalQuery;
    private executeBasicSemanticProcessing;
    private determineIntent;
    private displayStatus;
    private displayHistory;
    private displayHelp;
    private displayDetailedHelp;
    private displayAnalysisResults;
    private getAvailableTools;
    private getProjectFiles;
    private showSpinner;
    private stopSpinner;
    private handleExit;
    /**
     * Execute tools with enriched context from three-layer analysis
     */
    private executeToolsWithContext;
    /**
     * Execute a single tool with context
     */
    private executeSingleTool;
    /**
     * Analyze Claude Code outcome for intelligent database updates
     */
    private analyzeClaudeCodeOutcome;
    /**
     * Perform comprehensive database update across all systems
     */
    private performComprehensiveDatabaseUpdate;
    /**
     * Update PostgreSQL with tool metrics and operational data
     */
    private updatePostgreSQLMetrics;
    /**
     * Update MongoDB with complex analysis results
     */
    private updateMongoDBAnalysis;
    /**
     * Update Neo4j with new semantic relationships
     */
    private updateNeo4jRelationships;
    /**
     * Update Redis with cached patterns
     */
    private updateRedisCache;
    /**
     * Update DuckDB with analytics data
     */
    private updateDuckDBAnalytics;
    /**
     * Universal Learning - ALL tools learn from this request
     */
    private performUniversalLearning;
    /**
     * Update individual tool's learning database
     */
    private updateToolLearning;
    /**
     * Perform class rehashing for tools that need updated class information
     */
    private performClassRehashing;
    /**
     * Rehash a specific class for a specific tool
     */
    private rehashClassForTool;
    /**
     * Get all available tools for universal learning
     */
    private getAllAvailableTools;
    /**
     * Display comprehensive summary of three-layer analysis
     */
    private displayThreeLayerSummary;
    /**
     * Generate intelligent recommendations based on analysis results
     */
    private generateRecommendations;
    private calculateTokensUsed;
    private calculateTokensSaved;
    private calculateRelevance;
}
declare function main(): Promise<void>;
export { CodeMindCLI, main };
//# sourceMappingURL=codemind-cli.d.ts.map