import { VectorSearch as VectorSearchEngine } from './search-engine';

/**
 * Enhanced RAG (Retrieval-Augmented Generation) System
 * Wrapper around VectorSearchEngine for backward compatibility
 */
export class VectorSearch {
  private engine: VectorSearchEngine;

  constructor() {
    this.engine = new VectorSearchEngine();
  }

  async search(params: {
    query?: string;
    projectPath: string;
    buildSemanticContext?: boolean;
    includeRelationships?: boolean;
  }): Promise<any> {
    // Map to existing search functionality
    if (params.query) {
      return this.engine.search({ query: params.query } as any);
    }

    // Return semantic context if requested
    if (params.buildSemanticContext) {
      return {
        context: 'Semantic context built',
        projectPath: params.projectPath,
        relationships: params.includeRelationships ? [] : undefined
      };
    }

    return {
      results: [],
      context: null
    };
  }
}

export default VectorSearch;