/**
 * Vector Search Engine - SOLID Principles Implementation
 * Single Responsibility: Execute semantic searches using vector similarity
 * Uses fast-cosine-similarity library for optimized performance
 */

import { cosineSimilarity } from 'fast-cosine-similarity';
import { ContentChunk, EmbeddingVector } from '../content-processing/content-processor';

export interface SearchQuery {
  text: string;
  filters?: {
    language?: string;
    chunkType?: string;
    filePath?: string;
    significance?: 'high' | 'medium' | 'low';
  };
  options?: {
    maxResults?: number;
    minSimilarity?: number;
    includeContent?: boolean;
  };
}

export interface SearchResult {
  chunk: ContentChunk;
  similarity: number;
  rank: number;
  highlights?: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  metadata: {
    embeddingModel: string;
    indexSize: number;
  };
}

export interface VectorIndex {
  chunkId: string;
  vector: number[];
  chunk: ContentChunk;
  metadata: {
    indexed: Date;
    model: string;
    dimensions: number;
  };
}

/**
 * Abstract vector store - Dependency Inversion Principle
 */
export abstract class VectorStore {
  abstract addVectors(vectors: VectorIndex[]): Promise<void>;
  abstract searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]>;
  abstract getVectorCount(): Promise<number>;
  abstract clearIndex(): Promise<void>;
}

/**
 * In-Memory Vector Store using fast-cosine-similarity
 */
export class InMemoryVectorStore extends VectorStore {
  private vectors: VectorIndex[] = [];

  async addVectors(vectors: VectorIndex[]): Promise<void> {
    this.vectors.push(...vectors);
    console.log(`📊 Added ${vectors.length} vectors to index. Total: ${this.vectors.length}`);
  }

  async searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]> {
    const similarities = this.vectors.map(vectorIndex => ({
      vectorIndex,
      similarity: cosineSimilarity(queryVector, vectorIndex.vector)
    }));

    return similarities
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
      .map(result => result.vectorIndex);
  }

  async getVectorCount(): Promise<number> {
    return this.vectors.length;
  }

  async clearIndex(): Promise<void> {
    this.vectors = [];
    console.log('🧹 Vector index cleared');
  }
}

/**
 * PostgreSQL Vector Store using pgvector
 */
export class PostgreSQLVectorStore extends VectorStore {
  private client: any;

  constructor(client: any) {
    super();
    this.client = client;
  }

  async addVectors(vectors: VectorIndex[]): Promise<void> {
    if (vectors.length === 0) return;

    try {
      const crypto = await import('crypto');

      const values = vectors.map(vector => {
        // Generate content hash for the chunk
        const contentHash = crypto.createHash('sha256').update(vector.chunk.content).digest('hex');

        return `('${vector.chunkId}', '[${vector.vector.join(',')}]', '${JSON.stringify(vector.chunk).replace(/'/g, "''")}', '${contentHash}', '${vector.metadata.indexed.toISOString()}', '${vector.metadata.model}', ${vector.metadata.dimensions})`;
      }).join(',');

      const query = `
        INSERT INTO semantic_search_embeddings
        (chunk_id, embedding_vector, chunk_data, content_hash, created_at, model, dimensions)
        VALUES ${values}
        ON CONFLICT (chunk_id) DO UPDATE SET
          embedding_vector = EXCLUDED.embedding_vector,
          chunk_data = EXCLUDED.chunk_data,
          content_hash = EXCLUDED.content_hash,
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.client.query(query);
      console.log(`📊 Added ${vectors.length} vectors to PostgreSQL`);

    } catch (error) {
      console.error('Failed to add vectors:', error.message);
      throw error;
    }
  }

  async searchSimilar(queryVector: number[], maxResults: number, minSimilarity: number): Promise<VectorIndex[]> {
    try {
      const vectorStr = `[${queryVector.join(',')}]`;

      const query = `
        SELECT
          chunk_id,
          embedding_vector,
          chunk_data,
          created_at,
          model,
          dimensions,
          (embedding_vector <-> '${vectorStr}') as distance
        FROM semantic_search_embeddings
        WHERE (1 - (embedding_vector <-> '${vectorStr}')) >= $1
        ORDER BY distance ASC
        LIMIT $2
      `;

      const result = await this.client.query(query, [minSimilarity, maxResults]);

      return result.rows.map((row: any) => ({
        chunkId: row.chunk_id,
        vector: this.parseVector(row.embedding_vector),
        chunk: JSON.parse(row.chunk_data),
        metadata: {
          indexed: new Date(row.created_at),
          model: row.model,
          dimensions: row.dimensions
        }
      }));

    } catch (error) {
      console.error('Vector search failed:', error.message);
      return [];
    }
  }

  private parseVector(vectorStr: string): number[] {
    return vectorStr.slice(1, -1).split(',').map(x => parseFloat(x));
  }

  async getVectorCount(): Promise<number> {
    try {
      const result = await this.client.query('SELECT COUNT(*) FROM semantic_search_embeddings');
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Failed to get vector count:', error.message);
      return 0;
    }
  }

  async clearIndex(): Promise<void> {
    try {
      await this.client.query('DELETE FROM semantic_search_embeddings');
      console.log('🧹 PostgreSQL vector index cleared');
    } catch (error) {
      console.error('Failed to clear vector index:', error.message);
    }
  }
}

/**
 * Vector Search Engine - Main service
 */
export class VectorSearchEngine {
  private vectorStore: VectorStore;
  private embeddingProvider: any;

  constructor(vectorStore: VectorStore, embeddingProvider?: any) {
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
  }

  /**
   * Index content chunks with their embeddings
   */
  async indexContent(chunks: ContentChunk[], embeddings: EmbeddingVector[]): Promise<void> {
    console.log(`🔍 Indexing ${chunks.length} content chunks...`);

    const vectorIndices: VectorIndex[] = embeddings.map(embedding => {
      const chunk = chunks.find(c => c.id === embedding.chunkId);
      if (!chunk) {
        throw new Error(`Chunk not found for embedding: ${embedding.chunkId}`);
      }

      return {
        chunkId: embedding.chunkId,
        vector: embedding.embedding,
        chunk,
        metadata: {
          indexed: embedding.createdAt,
          model: embedding.model,
          dimensions: embedding.dimensions
        }
      };
    });

    await this.vectorStore.addVectors(vectorIndices);
    console.log(`✅ Successfully indexed ${vectorIndices.length} content chunks`);
  }

  /**
   * Perform semantic search using vector similarity
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      console.log(`🔎 Performing semantic search: "${query.text}"`);

      if (!this.embeddingProvider) {
        throw new Error('Embedding provider not configured');
      }

      // Generate query embedding
      const queryVector = await this.embeddingProvider.generateEmbedding(query.text);

      // Search similar vectors
      const maxResults = query.options?.maxResults || 10;
      const minSimilarity = query.options?.minSimilarity || 0.7;

      const similarVectors = await this.vectorStore.searchSimilar(queryVector, maxResults * 2, minSimilarity);

      // Apply additional filters
      const filteredVectors = this.applyFilters(similarVectors, query.filters);

      // Convert to search results with ranking
      const searchResults = await this.createSearchResults(filteredVectors.slice(0, maxResults), query, queryVector);

      const searchTime = Date.now() - startTime;

      console.log(`✓ Found ${searchResults.length} results in ${searchTime}ms`);

      return {
        query: query.text,
        results: searchResults,
        totalResults: filteredVectors.length,
        searchTime,
        metadata: {
          embeddingModel: this.embeddingProvider.getModel(),
          indexSize: await this.vectorStore.getVectorCount()
        }
      };

    } catch (error) {
      console.error(`Search failed: ${error.message}`);

      return {
        query: query.text,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        metadata: {
          embeddingModel: 'error',
          indexSize: 0
        }
      };
    }
  }

  private applyFilters(vectors: VectorIndex[], filters?: SearchQuery['filters']): VectorIndex[] {
    if (!filters) return vectors;

    return vectors.filter(vector => {
      const chunk = vector.chunk;

      if (filters.language && chunk.language !== filters.language) {
        return false;
      }

      if (filters.chunkType && chunk.chunkType !== filters.chunkType) {
        return false;
      }

      if (filters.filePath && !chunk.filePath.includes(filters.filePath)) {
        return false;
      }

      if (filters.significance && chunk.metadata.significance !== filters.significance) {
        return false;
      }

      return true;
    });
  }

  private async createSearchResults(vectors: VectorIndex[], query: SearchQuery, queryVector: number[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      const similarity = cosineSimilarity(queryVector, vector.vector);

      const highlights = this.generateHighlights(vector.chunk.content, query.text);

      results.push({
        chunk: vector.chunk,
        similarity,
        rank: i + 1,
        highlights
      });
    }

    return results;
  }

  private generateHighlights(content: string, query: string): string[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?\n]+/);
    const highlights: string[] = [];

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = queryWords.filter(word => lowerSentence.includes(word)).length;

      if (matchCount > 0) {
        highlights.push(sentence.trim());
        if (highlights.length >= 3) break;
      }
    }

    return highlights;
  }

  /**
   * Get search index statistics
   */
  async getIndexStats(): Promise<{
    totalChunks: number;
  }> {
    return {
      totalChunks: await this.vectorStore.getVectorCount()
    };
  }

  /**
   * Clear the search index
   */
  async clearIndex(): Promise<void> {
    await this.vectorStore.clearIndex();
  }
}