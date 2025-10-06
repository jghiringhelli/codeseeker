/**
 * Claude Context Enhancer - SOLID Principles Implementation
 * Single Responsibility: Enhance Claude context using integrated semantic analysis
 * Integrates file scanning, semantic analysis, content processing, and vector search
 * Provides intelligent context optimization for Claude interactions
 */

import { ProjectFileScanner } from '../file-scanner/project-file-scanner';
import { IntegratedSemanticGraphService } from '../semantic-graph/integrated-semantic-graph-service';
import { ContentProcessor } from '../content-processing/content-processor';
import { VectorSearchEngine, InMemoryVectorStore, PostgreSQLVectorStore } from '../semantic-search/vector-search-engine';

export interface ContextEnhancementRequest {
  projectPath: string;
  userQuery: string;
  intent: 'overview' | 'coding' | 'architecture' | 'debugging' | 'exploration';
  maxTokens?: number;
  focusAreas?: string[];
  excludePatterns?: string[];
}

export interface ContextEnhancementResult {
  relevantFiles: Array<{
    path: string;
    relevanceScore: number;
    reason: string;
    contentSnippets: string[];
  }>;
  semanticContext: {
    relatedEntities: Array<{
      name: string;
      type: string;
      filePath: string;
      relationships: string[];
    }>;
    keyRelationships: Array<{
      source: string;
      target: string;
      type: string;
      confidence: number;
    }>;
  };
  searchResults: Array<{
    content: string;
    similarity: number;
    filePath: string;
    startLine: number;
    endLine: number;
  }>;
  contextSummary: {
    totalFiles: number;
    relevantFiles: number;
    tokenEstimate: number;
    processingTime: number;
    confidenceScore: number;
  };
  enhancedPrompt: string;
}

export interface ClaudeContextConfig {
  enableSemanticSearch: boolean;
  enableGraphTraversal: boolean;
  vectorStore: 'memory' | 'postgresql';
  embeddingModel: 'openai' | 'local';
  maxContextFiles: number;
  maxTokensPerFile: number;
  minRelevanceThreshold: number;
  includeRelationships: boolean;
  optimizeForIntent: boolean;
}

/**
 * Claude Context Enhancer - Orchestrates all semantic services
 */
export class ClaudeContextEnhancer {
  private fileScanner: ProjectFileScanner;
  private semanticGraphService: IntegratedSemanticGraphService;
  private contentProcessor: ContentProcessor;
  private vectorSearchEngine: VectorSearchEngine;
  private config: ClaudeContextConfig;
  private isInitialized = false;

  constructor(config?: Partial<ClaudeContextConfig>, databaseClient?: any) {
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
    this.fileScanner = new ProjectFileScanner();
    this.semanticGraphService = new IntegratedSemanticGraphService();
    this.contentProcessor = new ContentProcessor({
      embeddingModel: this.config.embeddingModel as any,
      chunkSize: this.config.maxTokensPerFile
    });

    // Initialize vector store based on configuration
    const vectorStore = this.config.vectorStore === 'postgresql' && databaseClient
      ? new PostgreSQLVectorStore(databaseClient)
      : new InMemoryVectorStore();

    this.vectorSearchEngine = new VectorSearchEngine(
      vectorStore,
      this.contentProcessor['embeddingProvider'] // Access embedding provider
    );
  }

  /**
   * Initialize the context enhancer with project analysis
   */
  async initialize(projectPath: string): Promise<void> {
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
      const contentResults = await this.contentProcessor.processFiles(
        scanResult.files.slice(0, 50) // Limit for initialization
      );

      // 4. Index content for semantic search
      console.log('🔍 Building semantic search index...');
      for (const result of contentResults) {
        if (result.chunks.length > 0 && result.embeddings.length > 0) {
          await this.vectorSearchEngine.indexContent(result.chunks, result.embeddings);
        }
      }

      const initTime = Date.now() - startTime;
      this.isInitialized = true;

      console.log(`✅ Context enhancer initialized in ${initTime}ms`);
      console.log(`📊 Stats: ${scanResult.files.length} files, ${semanticGraph.stats.totalEntities} entities, ${contentResults.length} processed files`);

    } catch (error) {
      console.error(`❌ Failed to initialize context enhancer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhance context for Claude interaction
   */
  async enhanceContext(request: ContextEnhancementRequest): Promise<ContextEnhancementResult> {
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

    } catch (error) {
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

  private async performSemanticSearch(request: ContextEnhancementRequest) {
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

    } catch (error) {
      console.warn(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  private async buildSemanticContext(request: ContextEnhancementRequest, searchResults: any[]) {
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

  private async analyzeFileRelevance(request: ContextEnhancementRequest, searchResults: any[]) {
    const fileRelevanceMap = new Map<string, {
      score: number;
      reasons: string[];
      snippets: string[];
    }>();

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

  private generateEnhancedPrompt(
    request: ContextEnhancementRequest,
    relevantFiles: any[],
    semanticContext: any,
    searchResults: any[]
  ): string {
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

  private calculateContextSummary(relevantFiles: any[], searchResults: any[], processingTime: number) {
    const tokenEstimate = relevantFiles.reduce((sum, file) =>
      sum + file.contentSnippets.reduce((snippetSum: number, snippet: string) =>
        snippetSum + Math.ceil(snippet.split(' ').length * 1.3), 0), 0);

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
  updateConfig(newConfig: Partial<ClaudeContextConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset and reinitialize
   */
  async reset(): Promise<void> {
    this.isInitialized = false;
    await this.vectorSearchEngine.clearIndex();
    console.log('🔄 Context enhancer reset');
  }
}