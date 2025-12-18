/**
 * Embedding Generator Adapter - Single Responsibility
 * Adapts the existing EmbeddingService to the IEmbeddingGenerator interface
 */

import { IEmbeddingGenerator, SemanticChunk } from '../../../core/interfaces/search-interfaces';
import { EmbeddingService } from '../data/embedding/embedding-service';

export class EmbeddingGeneratorAdapter implements IEmbeddingGenerator {
  private embeddingService: EmbeddingService;

  constructor() {
    // IMPORTANT: Use same embedding model as indexing (search-command-handler.ts)
    // Both must use Xenova/all-MiniLM-L6-v2 for proper similarity matching
    const defaultConfig = {
      provider: 'xenova' as const,
      model: 'Xenova/all-MiniLM-L6-v2' as const,
      batchSize: 32
    };
    this.embeddingService = new EmbeddingService(defaultConfig);
  }

  async generateEmbeddings(chunks: SemanticChunk[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(
          chunk.content,
          `file: ${chunk.filePath}, language: ${chunk.metadata.language}`
        );
        embeddings.push(embedding);
      } catch (error) {
        console.warn(`Failed to generate embedding for chunk ${chunk.id}: ${error.message}`);
        // Push zero vector as fallback
        embeddings.push(new Array(384).fill(0)); // Default Xenova model dimension
      }
    }

    return embeddings;
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      return await this.embeddingService.generateEmbedding(query, 'search query');
    } catch (error) {
      console.warn(`Failed to generate query embedding: ${error.message}`);
      // Return zero vector as fallback
      return new Array(384).fill(0);
    }
  }

  /**
   * Get the underlying embedding service (for compatibility)
   */
  getEmbeddingService(): EmbeddingService {
    return this.embeddingService;
  }
}