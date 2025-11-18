/**
 * Embedding Generator Adapter - Single Responsibility
 * Adapts the existing EmbeddingService to the IEmbeddingGenerator interface
 */
import { IEmbeddingGenerator, SemanticChunk } from '../../../core/interfaces/search-interfaces';
import { EmbeddingService } from '../data/embedding/embedding-service';
export declare class EmbeddingGeneratorAdapter implements IEmbeddingGenerator {
    private embeddingService;
    constructor();
    generateEmbeddings(chunks: SemanticChunk[]): Promise<number[][]>;
    generateQueryEmbedding(query: string): Promise<number[]>;
    /**
     * Get the underlying embedding service (for compatibility)
     */
    getEmbeddingService(): EmbeddingService;
}
//# sourceMappingURL=embedding-generator-adapter.d.ts.map