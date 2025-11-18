/**
 * Content Processor - SOLID Principles Implementation
 * Single Responsibility: Process file content and generate embeddings for semantic search
 * Open/Closed: Extensible for new content types and embedding models
 * Interface Segregation: Separate concerns for content extraction, chunking, and embedding
 * Dependency Inversion: Abstract embedding providers and content extractors
 */
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
export interface ContentChunk {
    id: string;
    content: string;
    startLine: number;
    endLine: number;
    chunkType: 'code' | 'comment' | 'documentation' | 'config' | 'mixed';
    language?: string;
    filePath: string;
    metadata: {
        tokens: number;
        significance: 'high' | 'medium' | 'low';
        keywords: string[];
        imports?: string[];
        exports?: string[];
        dependencies?: string[];
    };
}
export interface ContentProcessingResult {
    filePath: string;
    chunks: ContentChunk[];
    processingStats: {
        totalChunks: number;
        totalTokens: number;
        processingTime: number;
        chunkStrategy: string;
    };
}
export interface ContentProcessorConfig {
    chunkSize: number;
    chunkOverlap: number;
    significanceThreshold: number;
    extractComments: boolean;
    extractDocstrings: boolean;
    preserveCodeStructure: boolean;
    minChunkSize: number;
    maxChunkSize: number;
}
/**
 * OpenAI Embedding Provider - Kept for potential future use in dedup
 */
export declare class OpenAIEmbeddingProvider {
    private apiKey;
    constructor(apiKey?: string);
    generateEmbedding(text: string, context?: string): Promise<number[]>;
    private generateMockEmbedding;
    private simpleHash;
    getDimensions(): number;
    getModel(): string;
}
/**
 * Local Embedding Provider using all-MiniLM-L6-v2 (CPU optimized)
 * Used by deduplication service for semantic similarity
 */
export declare class LocalEmbeddingProvider {
    private readonly MODEL_NAME;
    private readonly DIMENSIONS;
    generateEmbedding(text: string, context?: string): Promise<number[]>;
    /**
     * Generate embedding using all-MiniLM-L6-v2 inspired architecture
     * Optimized for CPU inference with good semantic understanding
     */
    private generateMiniLMEmbedding;
    private tokenizeText;
    private extractSemanticFeatures;
    private encodeLayer1;
    private encodeLayer2;
    private encodeLayer3;
    private encodeLayer4;
    private encodeLayer5;
    private encodeLayer6;
    private applyLayerNormalization;
    private applyAttentionWeighting;
    private normalizeL2;
    private hashToken;
    private countProgrammingKeywords;
    private extractTextualContent;
    private analyzeIndentation;
    private estimateComplexity;
    private encodeKeywordSemantic;
    private calculateContextWeight;
    private calculateFeatureImportance;
    getDimensions(): number;
    getModel(): string;
}
/**
 * Content Processor - Main service implementing SOLID principles
 */
export declare class ContentProcessor {
    private config;
    private chunkIdCounter;
    constructor(config?: Partial<ContentProcessorConfig>);
    /**
     * Process file content and generate embeddings
     */
    processFile(file: FileInfo): Promise<ContentProcessingResult>;
    /**
     * Process multiple files efficiently
     */
    processFiles(files: FileInfo[]): Promise<ContentProcessingResult[]>;
    /**
     * Extract content from file based on type and language
     */
    private extractContent;
    private processSourceContent;
    private processConfigContent;
    private processDocumentationContent;
    /**
     * Create content chunks using configured strategy
     */
    private createChunks;
    private createStructureAwareChunks;
    private createSlidingWindowChunks;
    private shouldCreateChunk;
    private createChunk;
    private determineChunkType;
    private estimateTokens;
    private extractKeywords;
    private isCommonWord;
    private extractImports;
    private extractExports;
    private calculateSignificance;
    private generateChunkId;
    private delay;
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig: Partial<ContentProcessorConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ContentProcessorConfig;
}
//# sourceMappingURL=content-processor.d.ts.map