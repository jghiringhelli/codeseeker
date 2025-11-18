"use strict";
/**
 * Vector Search Engine - SOLID Principles Implementation
 * Single Responsibility: Execute semantic searches using vector similarity
 * Uses fast-cosine-similarity library for optimized performance
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchEngine = exports.PostgreSQLVectorStore = exports.InMemoryVectorStore = exports.VectorStore = void 0;
const fast_cosine_similarity_1 = require("fast-cosine-similarity");
/**
 * Abstract vector store - Dependency Inversion Principle
 */
class VectorStore {
}
exports.VectorStore = VectorStore;
/**
 * In-Memory Vector Store using fast-cosine-similarity
 */
class InMemoryVectorStore extends VectorStore {
    vectors = [];
    async addVectors(vectors) {
        this.vectors.push(...vectors);
        console.log(`📊 Added ${vectors.length} vectors to index. Total: ${this.vectors.length}`);
    }
    async searchSimilar(queryVector, maxResults, minSimilarity) {
        const similarities = this.vectors.map(vectorIndex => ({
            vectorIndex,
            similarity: (0, fast_cosine_similarity_1.cosineSimilarity)(queryVector, vectorIndex.vector)
        }));
        return similarities
            .filter(result => result.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults)
            .map(result => result.vectorIndex);
    }
    async getVectorCount() {
        return this.vectors.length;
    }
    async clearIndex() {
        this.vectors = [];
        console.log('🧹 Vector index cleared');
    }
}
exports.InMemoryVectorStore = InMemoryVectorStore;
/**
 * PostgreSQL Vector Store using pgvector
 */
class PostgreSQLVectorStore extends VectorStore {
    client;
    constructor(client) {
        super();
        this.client = client;
    }
    async addVectors(vectors) {
        if (vectors.length === 0)
            return;
        try {
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
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
        }
        catch (error) {
            console.error('Failed to add vectors:', error.message);
            throw error;
        }
    }
    async searchSimilar(queryVector, maxResults, minSimilarity) {
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
            return result.rows.map((row) => ({
                chunkId: row.chunk_id,
                vector: this.parseVector(row.embedding_vector),
                chunk: JSON.parse(row.chunk_data),
                metadata: {
                    indexed: new Date(row.created_at),
                    model: row.model,
                    dimensions: row.dimensions
                }
            }));
        }
        catch (error) {
            console.error('Vector search failed:', error.message);
            return [];
        }
    }
    parseVector(vectorStr) {
        return vectorStr.slice(1, -1).split(',').map(x => parseFloat(x));
    }
    async getVectorCount() {
        try {
            const result = await this.client.query('SELECT COUNT(*) FROM semantic_search_embeddings');
            return parseInt(result.rows[0].count);
        }
        catch (error) {
            console.error('Failed to get vector count:', error.message);
            return 0;
        }
    }
    async clearIndex() {
        try {
            await this.client.query('DELETE FROM semantic_search_embeddings');
            console.log('🧹 PostgreSQL vector index cleared');
        }
        catch (error) {
            console.error('Failed to clear vector index:', error.message);
        }
    }
}
exports.PostgreSQLVectorStore = PostgreSQLVectorStore;
/**
 * Vector Search Engine - Main service
 */
class VectorSearchEngine {
    vectorStore;
    embeddingProvider;
    constructor(vectorStore, embeddingProvider) {
        this.vectorStore = vectorStore;
        this.embeddingProvider = embeddingProvider;
    }
    /**
     * Index content chunks with their embeddings
     */
    async indexContent(chunks, embeddings) {
        console.log(`🔍 Indexing ${chunks.length} content chunks...`);
        const vectorIndices = embeddings.map(embedding => {
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
    async search(query) {
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
        }
        catch (error) {
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
    applyFilters(vectors, filters) {
        if (!filters)
            return vectors;
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
    async createSearchResults(vectors, query, queryVector) {
        const results = [];
        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const similarity = (0, fast_cosine_similarity_1.cosineSimilarity)(queryVector, vector.vector);
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
    generateHighlights(content, query) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const sentences = content.split(/[.!?\n]+/);
        const highlights = [];
        for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            const matchCount = queryWords.filter(word => lowerSentence.includes(word)).length;
            if (matchCount > 0) {
                highlights.push(sentence.trim());
                if (highlights.length >= 3)
                    break;
            }
        }
        return highlights;
    }
    /**
     * Get search index statistics
     */
    async getIndexStats() {
        return {
            totalChunks: await this.vectorStore.getVectorCount()
        };
    }
    /**
     * Clear the search index
     */
    async clearIndex() {
        await this.vectorStore.clearIndex();
    }
}
exports.VectorSearchEngine = VectorSearchEngine;
//# sourceMappingURL=vector-search-engine.js.map