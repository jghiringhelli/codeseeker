"use strict";
/**
 * Claude Context Enhancer - SOLID Principles Implementation
 * Single Responsibility: Enhance Claude context using integrated semantic analysis
 * Integrates file scanning, semantic analysis, content processing, and vector search
 * Provides intelligent context optimization for Claude interactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeContextEnhancer = void 0;
const project_file_scanner_1 = require("../file-scanner/project-file-scanner");
const integrated_semantic_graph_service_1 = require("../semantic-graph/integrated-semantic-graph-service");
const content_processor_1 = require("../content-processing/content-processor");
const vector_search_engine_1 = require("../semantic-search/vector-search-engine");
/**
 * Claude Context Enhancer - Orchestrates all semantic services
 */
class ClaudeContextEnhancer {
    fileScanner;
    semanticGraphService;
    contentProcessor;
    vectorSearchEngine;
    config;
    isInitialized = false;
    constructor(config, databaseClient) {
        this.config = {
            enableSemanticSearch: true,
            enableGraphTraversal: true,
            vectorStore: databaseClient ? 'postgresql' : 'memory',
            embeddingModel: 'local',
            maxContextFiles: 10,
            maxTokensPerFile: 1000,
            minRelevanceThreshold: 0.7,
            includeRelationships: true,
            optimizeForIntent: true,
            ...config
        };
        // Initialize services following SOLID dependency injection
        this.fileScanner = new project_file_scanner_1.ProjectFileScanner();
        this.semanticGraphService = new integrated_semantic_graph_service_1.IntegratedSemanticGraphService();
        this.contentProcessor = new content_processor_1.ContentProcessor({
            chunkSize: this.config.maxTokensPerFile
        });
        // Initialize vector store based on configuration
        const vectorStore = this.config.vectorStore === 'postgresql' && databaseClient
            ? new vector_search_engine_1.PostgreSQLVectorStore(databaseClient)
            : new vector_search_engine_1.InMemoryVectorStore();
        this.vectorSearchEngine = new vector_search_engine_1.VectorSearchEngine(vectorStore, null // Embeddings are handled by SemanticSearchManager
        );
    }
    /**
     * Initialize the context enhancer with project analysis
     */
    async initialize(projectPath) {
        if (this.isInitialized) {
            console.log('🔄 Context enhancer already initialized');
            return;
        }
        console.log('🚀 Initializing Claude context enhancer...');
        const startTime = Date.now();
        try {
            // 1. Discover project files
            console.log('📂 Scanning project files...');
            const scanResult = await this.fileScanner.scanProject(projectPath);
            // 2. Build semantic graph
            console.log('🌳 Building semantic graph...');
            const semanticGraph = await this.semanticGraphService.buildGraph(scanResult.files);
            // 3. Process content and generate embeddings
            console.log('📄 Processing content and generating embeddings...');
            const contentResults = await this.contentProcessor.processFiles(scanResult.files.slice(0, 50) // Limit for initialization
            );
            // 4. Index content for semantic search
            console.log('🔍 Building semantic search index...');
            // Note: Actual embeddings are generated and stored by SemanticSearchManager
            // This enhancer uses the chunks for context preparation only
            for (const result of contentResults) {
                if (result.chunks.length > 0) {
                    // Chunks are used for context, embeddings come from SemanticSearchManager
                    await this.vectorSearchEngine.indexContent(result.chunks, []);
                }
            }
            const initTime = Date.now() - startTime;
            this.isInitialized = true;
            console.log(`✅ Context enhancer initialized in ${initTime}ms`);
            console.log(`📊 Stats: ${scanResult.files.length} files, ${semanticGraph.stats.totalEntities} entities, ${contentResults.length} processed files`);
        }
        catch (error) {
            console.error(`❌ Failed to initialize context enhancer: ${error.message}`);
            throw error;
        }
    }
    /**
     * Enhance context for Claude interaction
     */
    async enhanceContext(request) {
        const startTime = Date.now();
        try {
            console.log(`🧠 Enhancing context for: "${request.userQuery}"`);
            if (!this.isInitialized) {
                await this.initialize(request.projectPath);
            }
            // 1. Semantic search for relevant content
            const searchResults = this.config.enableSemanticSearch
                ? await this.performSemanticSearch(request)
                : [];
            // 2. Graph traversal for related entities (if enabled)
            const semanticContext = this.config.enableGraphTraversal
                ? await this.buildSemanticContext(request, searchResults)
                : { relatedEntities: [], keyRelationships: [] };
            // 3. File relevance analysis
            const relevantFiles = await this.analyzeFileRelevance(request, searchResults);
            // 4. Generate enhanced prompt
            const enhancedPrompt = this.generateEnhancedPrompt(request, relevantFiles, semanticContext, searchResults);
            // 5. Calculate context summary
            const contextSummary = this.calculateContextSummary(relevantFiles, searchResults, Date.now() - startTime);
            console.log(`✓ Context enhanced in ${contextSummary.processingTime}ms with confidence ${contextSummary.confidenceScore.toFixed(2)}`);
            return {
                relevantFiles,
                semanticContext,
                searchResults: searchResults.map(result => ({
                    content: result.chunk.content,
                    similarity: result.similarity,
                    filePath: result.chunk.filePath,
                    startLine: result.chunk.startLine,
                    endLine: result.chunk.endLine
                })),
                contextSummary,
                enhancedPrompt
            };
        }
        catch (error) {
            console.error(`❌ Context enhancement failed: ${error.message}`);
            // Return minimal fallback result
            return {
                relevantFiles: [],
                semanticContext: { relatedEntities: [], keyRelationships: [] },
                searchResults: [],
                contextSummary: {
                    totalFiles: 0,
                    relevantFiles: 0,
                    tokenEstimate: 0,
                    processingTime: Date.now() - startTime,
                    confidenceScore: 0
                },
                enhancedPrompt: request.userQuery
            };
        }
    }
    async performSemanticSearch(request) {
        try {
            const searchQuery = {
                text: request.userQuery,
                filters: {
                    ...(request.focusAreas && { filePath: request.focusAreas[0] })
                },
                options: {
                    maxResults: this.config.maxContextFiles,
                    minSimilarity: this.config.minRelevanceThreshold,
                    includeContent: true
                }
            };
            const searchResponse = await this.vectorSearchEngine.search(searchQuery);
            return searchResponse.results;
        }
        catch (error) {
            console.warn(`Semantic search failed: ${error.message}`);
            return [];
        }
    }
    async buildSemanticContext(request, searchResults) {
        // This would integrate with the semantic graph to find related entities
        // For now, return basic structure
        const relatedEntities = searchResults
            .map(result => ({
            name: result.chunk.metadata.keywords?.[0] || 'Unknown',
            type: result.chunk.chunkType,
            filePath: result.chunk.filePath,
            relationships: result.chunk.metadata.imports || []
        }))
            .slice(0, 5);
        return {
            relatedEntities,
            keyRelationships: [] // Would be populated by graph analysis
        };
    }
    async analyzeFileRelevance(request, searchResults) {
        const fileRelevanceMap = new Map();
        // Calculate relevance based on search results
        for (const result of searchResults) {
            const filePath = result.chunk.filePath;
            const existing = fileRelevanceMap.get(filePath) || {
                score: 0,
                reasons: [],
                snippets: []
            };
            existing.score = Math.max(existing.score, result.similarity);
            existing.reasons.push(`Semantic match (${result.similarity.toFixed(2)})`);
            existing.snippets.push(result.chunk.content.substring(0, 200) + '...');
            fileRelevanceMap.set(filePath, existing);
        }
        // Convert to array and sort by relevance
        return Array.from(fileRelevanceMap.entries())
            .map(([path, data]) => ({
            path,
            relevanceScore: data.score,
            reason: data.reasons.join(', '),
            contentSnippets: data.snippets.slice(0, 3)
        }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, this.config.maxContextFiles);
    }
    generateEnhancedPrompt(request, relevantFiles, semanticContext, searchResults) {
        let prompt = `# Enhanced Context for: ${request.userQuery}\n\n`;
        // Add intent-specific context
        switch (request.intent) {
            case 'overview':
                prompt += `## Project Overview Context\n`;
                break;
            case 'coding':
                prompt += `## Development Context\n`;
                break;
            case 'architecture':
                prompt += `## Architectural Context\n`;
                break;
            case 'debugging':
                prompt += `## Debugging Context\n`;
                break;
            default:
                prompt += `## Context\n`;
        }
        // Add relevant files
        if (relevantFiles.length > 0) {
            prompt += `\n### Most Relevant Files:\n`;
            relevantFiles.slice(0, 5).forEach((file, index) => {
                prompt += `${index + 1}. **${file.path}** (relevance: ${file.relevanceScore.toFixed(2)})\n`;
                prompt += `   - ${file.reason}\n`;
            });
        }
        // Add semantic insights
        if (semanticContext.relatedEntities.length > 0) {
            prompt += `\n### Related Code Elements:\n`;
            semanticContext.relatedEntities.slice(0, 3).forEach(entity => {
                prompt += `- **${entity.name}** (${entity.type}) in ${entity.filePath}\n`;
            });
        }
        // Add relevant code snippets
        if (searchResults.length > 0) {
            prompt += `\n### Relevant Code Context:\n`;
            searchResults.slice(0, 3).forEach((result, index) => {
                prompt += `\n#### Snippet ${index + 1} (similarity: ${result.similarity.toFixed(2)})\n`;
                prompt += `File: ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}\n`;
                prompt += `\`\`\`${result.chunk.language?.toLowerCase() || ''}\n`;
                prompt += result.chunk.content.substring(0, 400);
                prompt += `\`\`\`\n`;
            });
        }
        prompt += `\n---\n**Original Query:** ${request.userQuery}\n`;
        return prompt;
    }
    calculateContextSummary(relevantFiles, searchResults, processingTime) {
        const tokenEstimate = relevantFiles.reduce((sum, file) => sum + file.contentSnippets.reduce((snippetSum, snippet) => snippetSum + Math.ceil(snippet.split(' ').length * 1.3), 0), 0);
        const confidenceScore = searchResults.length > 0
            ? searchResults.reduce((sum, result) => sum + result.similarity, 0) / searchResults.length
            : 0;
        return {
            totalFiles: relevantFiles.length,
            relevantFiles: relevantFiles.filter(f => f.relevanceScore > this.config.minRelevanceThreshold).length,
            tokenEstimate,
            processingTime,
            confidenceScore
        };
    }
    /**
     * Get context enhancement statistics
     */
    async getStats() {
        if (!this.isInitialized) {
            return { initialized: false };
        }
        const indexStats = await this.vectorSearchEngine.getIndexStats();
        return {
            initialized: true,
            config: this.config,
            indexStats
        };
    }
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Reset and reinitialize
     */
    async reset() {
        this.isInitialized = false;
        await this.vectorSearchEngine.clearIndex();
        console.log('🔄 Context enhancer reset');
    }
}
exports.ClaudeContextEnhancer = ClaudeContextEnhancer;
//# sourceMappingURL=claude-context-enhancer.js.map