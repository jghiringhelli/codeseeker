/**
 * CodeMind Embedding Service
 * Generates vector embeddings for semantic search using multiple strategies
 */
export interface EmbeddingConfig {
    provider: 'openai' | 'local' | 'hybrid';
    openaiApiKey?: string;
    model: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large' | 'local';
    chunkSize: number;
    maxTokens: number;
    batchSize: number;
}
export interface FileEmbedding {
    filePath: string;
    content: string;
    hash: string;
    embedding: number[];
    metadata: {
        language: string;
        size: number;
        lines: number;
        functions: string[];
        classes: string[];
        imports: string[];
        exports: string[];
    };
}
export declare class EmbeddingService {
    private logger;
    private config;
    private openaiClient?;
    constructor(config?: Partial<EmbeddingConfig>);
    /**
     * Generate embeddings for all files in a project
     */
    generateProjectEmbeddings(projectId: string, files: string[], progressCallback?: (progress: number, current: string) => void): Promise<{
        success: number;
        errors: number;
        skipped: number;
    }>;
    /**
     * Process a single file for embedding generation
     */
    private processFile;
    /**
     * Generate embedding for content using configured provider
     */
    private generateEmbedding;
    /**
     * Generate OpenAI embedding
     */
    private generateOpenAIEmbedding;
    /**
     * Generate local embedding using simple but effective algorithm
     */
    private generateLocalEmbedding;
    /**
     * Extract content features for local embedding
     */
    private extractContentFeatures;
    /**
     * Map extracted features to embedding dimensions
     */
    private mapFeaturesToEmbedding;
    /**
     * Store embedding in database
     */
    private storeEmbedding;
    private shouldSkipFile;
    private truncateContent;
    private extractFileMetadata;
    private detectLanguage;
    private extractFunctions;
    private extractClasses;
    private extractImports;
    private extractExports;
    private extractKeywords;
    private extractComments;
    private estimateComplexity;
    private estimateNestingDepth;
    private generateStructureHash;
    private encodeLanguage;
    private encodeKeywords;
    private encodeStructure;
    private encodeHashes;
    private simpleHash;
    private initializeProviders;
    private delay;
}
export default EmbeddingService;
//# sourceMappingURL=embedding-service.d.ts.map