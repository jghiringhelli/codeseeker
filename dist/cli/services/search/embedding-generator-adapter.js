"use strict";
/**
 * Embedding Generator Adapter - Single Responsibility
 * Adapts the existing EmbeddingService to the IEmbeddingGenerator interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingGeneratorAdapter = void 0;
const embedding_service_1 = require("../data/embedding/embedding-service");
class EmbeddingGeneratorAdapter {
    embeddingService;
    constructor() {
        // IMPORTANT: Use same embedding model as indexing (search-command-handler.ts)
        // Both must use Xenova/all-MiniLM-L6-v2 for proper similarity matching
        const defaultConfig = {
            provider: 'xenova',
            model: 'Xenova/all-MiniLM-L6-v2',
            batchSize: 32
        };
        this.embeddingService = new embedding_service_1.EmbeddingService(defaultConfig);
    }
    async generateEmbeddings(chunks) {
        const embeddings = [];
        for (const chunk of chunks) {
            try {
                const embedding = await this.embeddingService.generateEmbedding(chunk.content, `file: ${chunk.filePath}, language: ${chunk.metadata.language}`);
                embeddings.push(embedding);
            }
            catch (error) {
                console.warn(`Failed to generate embedding for chunk ${chunk.id}: ${error.message}`);
                // Push zero vector as fallback
                embeddings.push(new Array(384).fill(0)); // Default Xenova model dimension
            }
        }
        return embeddings;
    }
    async generateQueryEmbedding(query) {
        try {
            return await this.embeddingService.generateEmbedding(query, 'search query');
        }
        catch (error) {
            console.warn(`Failed to generate query embedding: ${error.message}`);
            // Return zero vector as fallback
            return new Array(384).fill(0);
        }
    }
    /**
     * Get the underlying embedding service (for compatibility)
     */
    getEmbeddingService() {
        return this.embeddingService;
    }
}
exports.EmbeddingGeneratorAdapter = EmbeddingGeneratorAdapter;
//# sourceMappingURL=embedding-generator-adapter.js.map