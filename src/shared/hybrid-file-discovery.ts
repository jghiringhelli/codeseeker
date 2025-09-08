/**
 * Hybrid File Discovery System
 * Combines vector search (intent-based) + semantic graph (structure-based) for intelligent file discovery
 */

import { SemanticSearchTool } from '../features/search/semantic-search-complete';
import { SemanticGraphService } from '../services/semantic-graph';
import { Logger } from '../utils/logger';

export interface FileDiscoveryRequest {
  query: string;
  projectPath: string;
  projectId: string;
  intent?: 'search' | 'refactor' | 'test' | 'debug' | 'security' | 'optimize';
  maxFiles?: number;
  includeRelated?: boolean;
}

export interface DiscoveredFile {
  filePath: string;
  contentType: 'code' | 'config' | 'documentation' | 'test' | 'schema';
  language?: string;
  relevanceScore: number;
  discoveryPhase: 'vector' | 'graph' | 'both';
  relationships?: string[]; // From graph phase
}

export interface FileDiscoveryResult {
  primaryFiles: DiscoveredFile[]; // Phase 1 results
  relatedFiles: DiscoveredFile[]; // Phase 2 expansions
  totalFiles: number;
  phases: {
    vectorResults: number;
    graphExpansions: number;
  };
  graphContext?: {
    relationshipTypes: string[];
    impactLevel: 'low' | 'medium' | 'high';
  };
}

export class HybridFileDiscovery {
  private vectorSearch: SemanticSearchTool;
  private semanticGraph: SemanticGraphService;
  private logger = Logger.getInstance();

  constructor() {
    this.vectorSearch = new SemanticSearchTool();
    this.semanticGraph = new SemanticGraphService();
  }

  async initialize(): Promise<void> {
    await this.semanticGraph.initialize();
    this.logger.info('🔍 Hybrid file discovery initialized');
  }

  /**
   * Two-phase file discovery: Vector search + Graph expansion
   */
  async discoverFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult> {
    const startTime = Date.now();
    
    try {
      // Phase 1: Vector-based content similarity search
      this.logger.info(`🧠 Phase 1: Vector search for "${request.query}"`);
      const vectorFiles = await this.vectorBasedDiscovery(request);
      
      // Phase 2: Graph-based relationship expansion (if enabled)
      let graphFiles: DiscoveredFile[] = [];
      let graphContext;
      
      if (request.includeRelated !== false && vectorFiles.length > 0) {
        this.logger.info(`🔗 Phase 2: Graph expansion from ${vectorFiles.length} seed files`);
        const graphResult = await this.graphBasedExpansion(vectorFiles, request);
        graphFiles = graphResult.files;
        graphContext = graphResult.context;
      }

      // Merge and deduplicate results
      const allFiles = this.mergeAndDeduplicate(vectorFiles, graphFiles);
      
      // Limit results
      const maxFiles = request.maxFiles || 20;
      const limitedFiles = allFiles.slice(0, maxFiles);
      
      const result: FileDiscoveryResult = {
        primaryFiles: vectorFiles,
        relatedFiles: graphFiles,
        totalFiles: limitedFiles.length,
        phases: {
          vectorResults: vectorFiles.length,
          graphExpansions: graphFiles.length
        },
        graphContext
      };

      const duration = Date.now() - startTime;
      this.logger.info(`✅ File discovery completed in ${duration}ms: ${result.totalFiles} files`);
      
      return result;
    } catch (error) {
      this.logger.error(`❌ File discovery failed: ${error}`);
      throw error;
    }
  }

  /**
   * Phase 1: Vector-based file discovery using semantic embeddings
   */
  private async vectorBasedDiscovery(request: FileDiscoveryRequest): Promise<DiscoveredFile[]> {
    try {
      // Search for similar files using vector embeddings
      const searchResponse = await fetch(`http://localhost:3003/api/tools/${request.projectId}/semantic-search/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: request.query,
          queryEmbedding: await this.generateQueryEmbedding(request.query),
          contentTypes: ['file'], // Focus on file-level embeddings
          threshold: 0.6, // Lower threshold for broader discovery
          limit: 15
        })
      });

      if (!searchResponse.ok) {
        throw new Error(`Vector search failed: ${searchResponse.status}`);
      }

      const searchResult = await searchResponse.json();
      
      return searchResult.results.map((result: any) => ({
        filePath: result.file_path,
        contentType: this.inferContentType(result.file_path),
        language: result.metadata?.language,
        relevanceScore: result.similarity_score,
        discoveryPhase: 'vector' as const
      }));
    } catch (error) {
      this.logger.warn(`Vector search failed: ${error}, falling back to empty results`);
      return [];
    }
  }

  /**
   * Phase 2: Graph-based relationship expansion
   */
  private async graphBasedExpansion(
    seedFiles: DiscoveredFile[], 
    request: FileDiscoveryRequest
  ): Promise<{ files: DiscoveredFile[]; context: any }> {
    const expandedFiles: DiscoveredFile[] = [];
    const relationshipTypes: string[] = [];
    let impactLevel: 'low' | 'medium' | 'high' = 'low';

    try {
      for (const seedFile of seedFiles) {
        // Find graph nodes for this file path
        const graphNodes = await this.findGraphNodesForFile(seedFile.filePath);
        
        for (const node of graphNodes) {
          // Get related files based on intent
          const relatedNodes = await this.getRelatedNodesByIntent(node.id, request.intent);
          
          // Convert graph nodes back to file paths
          const relatedFiles = relatedNodes
            .map(relatedNode => this.convertGraphNodeToFile(relatedNode, seedFile.relevanceScore))
            .filter(file => file !== null);
          
          expandedFiles.push(...relatedFiles);
        }
      }

      // Determine impact level based on expansion size
      if (expandedFiles.length > 15) impactLevel = 'high';
      else if (expandedFiles.length > 5) impactLevel = 'medium';

      const context = {
        relationshipTypes: this.getRelationshipTypesForIntent(request.intent),
        impactLevel
      };

      return { files: expandedFiles, context };
    } catch (error) {
      this.logger.warn(`Graph expansion failed: ${error}`);
      return { files: [], context: { relationshipTypes: [], impactLevel: 'low' } };
    }
  }

  /**
   * Find semantic graph nodes that correspond to a file path
   */
  private async findGraphNodesForFile(filePath: string): Promise<any[]> {
    // Search for Code nodes with matching path property
    const results = await this.semanticGraph.semanticSearch(filePath, {});
    return results.map(r => r.node);
  }

  /**
   * Get related nodes based on user intent
   */
  private async getRelatedNodesByIntent(nodeId: string, intent?: string): Promise<any[]> {
    const relationshipTypes = this.getRelationshipTypesForIntent(intent);
    const maxDepth = this.getTraversalDepthForIntent(intent);
    
    return await this.semanticGraph.findRelated(nodeId, maxDepth, relationshipTypes as any[]);
  }

  /**
   * Map intent to relevant relationship types for graph traversal
   */
  private getRelationshipTypesForIntent(intent?: string): string[] {
    switch (intent) {
      case 'refactor':
        return ['IMPORTS', 'DEPENDS_ON', 'USES']; // Files that would be affected
      case 'test':
        return ['TESTS', 'IMPLEMENTS']; // Test files and implementations
      case 'debug':
        return ['IMPORTS', 'USES', 'DEPENDS_ON']; // Call chains and dependencies
      case 'security':
        return ['IMPORTS', 'USES']; // Security boundaries and data flow
      default:
        return ['IMPORTS', 'DEPENDS_ON', 'USES', 'IMPLEMENTS']; // All relationships
    }
  }

  /**
   * Map intent to graph traversal depth
   */
  private getTraversalDepthForIntent(intent?: string): number {
    switch (intent) {
      case 'refactor': return 3; // Deep impact analysis
      case 'debug': return 2; // Call chain analysis
      case 'test': return 2; // Test coverage
      default: return 2; // Balanced exploration
    }
  }

  /**
   * Convert graph node back to file information
   */
  private convertGraphNodeToFile(graphNode: any, baseRelevance: number): DiscoveredFile | null {
    const filePath = graphNode.properties.path || graphNode.properties.file_path;
    if (!filePath) return null;

    return {
      filePath,
      contentType: this.inferContentType(filePath),
      language: graphNode.properties.language,
      relevanceScore: baseRelevance * 0.8, // Slightly lower than seed files
      discoveryPhase: 'graph',
      relationships: graphNode.properties.relationships || []
    };
  }

  /**
   * Merge vector and graph results, removing duplicates
   */
  private mergeAndDeduplicate(
    vectorFiles: DiscoveredFile[], 
    graphFiles: DiscoveredFile[]
  ): DiscoveredFile[] {
    const fileMap = new Map<string, DiscoveredFile>();
    
    // Add vector results first (higher priority)
    vectorFiles.forEach(file => {
      fileMap.set(file.filePath, file);
    });
    
    // Add graph results, merging if file already exists
    graphFiles.forEach(file => {
      const existing = fileMap.get(file.filePath);
      if (existing) {
        // Merge information from both phases
        existing.discoveryPhase = 'both';
        existing.relationships = [...(existing.relationships || []), ...(file.relationships || [])];
        existing.relevanceScore = Math.max(existing.relevanceScore, file.relevanceScore);
      } else {
        fileMap.set(file.filePath, file);
      }
    });
    
    // Sort by relevance score
    return Array.from(fileMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Infer content type from file path
   */
  private inferContentType(filePath: string): 'code' | 'config' | 'documentation' | 'test' | 'schema' {
    const path = filePath.toLowerCase();
    
    if (path.includes('test') || path.includes('spec')) return 'test';
    if (path.endsWith('.md') || path.includes('doc')) return 'documentation';
    if (path.includes('config') || path.endsWith('.json') || path.endsWith('.yml')) return 'config';
    if (path.endsWith('.sql') || path.includes('schema')) return 'schema';
    return 'code';
  }

  /**
   * Generate query embedding for vector search
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY required for vector search');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async close(): Promise<void> {
    await this.semanticGraph.close();
  }
}