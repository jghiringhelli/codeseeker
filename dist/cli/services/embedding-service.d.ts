/**
 * CodeMind Unified Embedding Service
 * Generates vector embeddings for semantic search at file, class, and method levels
 * Combines functionality from both embedding-service and granular-embedding-service
 */
import { DatabaseConnections } from '../../config/database-config';
export interface EmbeddingConfig {
    provider: 'xenova' | 'openai' | 'local' | 'hybrid';
    openaiApiKey?: string;
    model: 'Xenova/all-MiniLM-L6-v2' | 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large' | 'local';
    chunkSize: number;
    maxTokens: number;
    batchSize: number;
    granularMode?: boolean;
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
export interface MethodEmbedding {
    methodId: string;
    className?: string;
    methodName: string;
    filePath: string;
    content: string;
    signature: string;
    parameters: Array<{
        name: string;
        type?: string;
    }>;
    returnType?: string;
    complexity: number;
    embedding: number[];
    metadata: {
        isAsync: boolean;
        visibility: 'public' | 'private' | 'protected';
        isStatic: boolean;
        startLine: number;
        endLine: number;
        language: string;
        callsTo: string[];
    };
}
export interface ClassEmbedding {
    classId: string;
    className: string;
    filePath: string;
    content: string;
    embedding: number[];
    metadata: {
        extends?: string;
        implements: string[];
        methodCount: number;
        propertyCount: number;
        startLine: number;
        endLine: number;
        language: string;
        methods: string[];
        properties: string[];
    };
}
export declare class EmbeddingService {
    private logger;
    private config;
    private openaiClient?;
    private xenovaExtractor?;
    private codeParser?;
    constructor(config?: Partial<EmbeddingConfig>);
    /**
     * Initialize Xenova transformers pipeline
     */
    private initializeXenova;
    /**
     * Initialize OpenAI client
     */
    private initializeOpenAI;
    /**
     * Generate embeddings for a project - supports both file-level and granular modes
     */
    generateProjectEmbeddings(projectPath: string, files: string[], dbConnections?: DatabaseConnections): Promise<{
        embeddings: number;
        errors: number;
        methodEmbeddings?: number;
        classEmbeddings?: number;
    }>;
    /**
     * Generate file-level embeddings (original functionality)
     */
    private generateFileEmbeddings;
    /**
     * Generate granular embeddings at method and class levels
     */
    private generateGranularEmbeddings;
    /**
     * Generate embedding for a single file
     */
    private generateFileEmbedding;
    /**
     * Generate embedding for a class
     */
    private generateClassEmbedding;
    /**
     * Generate embedding for a method
     */
    private generateMethodEmbedding;
    /**
     * Generate embedding vector using configured provider
     */
    generateEmbedding(text: string, context?: string): Promise<number[]>;
    /**
     * Generate embedding using Xenova transformers
     */
    private generateXenovaEmbedding;
    /**
     * Generate embedding using OpenAI
     */
    private generateOpenAIEmbedding;
    /**
     * Generate local embedding using basic techniques
     */
    private generateLocalEmbedding;
    /**
     * Generate hybrid embedding combining multiple approaches
     */
    private generateHybridEmbedding;
    /**
     * Extract metadata from file content
     */
    private extractFileMetadata;
    /**
     * Detect programming language from file extension
     */
    private detectLanguage;
    /**
     * Extract class content from file
     */
    private extractClassContent;
    /**
     * Extract method content from file
     */
    private extractMethodContent;
    /**
     * Build context string for class embedding
     */
    private buildClassContext;
    /**
     * Build context string for method embedding
     */
    private buildMethodContext;
    /**
     * Store file embedding in database
     */
    private storeEmbedding;
    /**
     * Store class embedding in database
     */
    private storeClassEmbedding;
    /**
     * Store method embedding in database
     */
    private storeMethodEmbedding;
    /**
     * Search for similar content using embeddings
     */
    searchSimilar(query: string, limit?: number, threshold?: number): Promise<Array<{
        filePath: string;
        similarity: number;
        content: string;
    }>>;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Find similar methods using embeddings
     */
    findSimilarMethods(methodEmbedding: MethodEmbedding, threshold?: number): Promise<Array<{
        id: string;
        similarity: number;
        content: string;
    }>>;
    /**
     * Find similar classes using embeddings
     */
    findSimilarClasses(classEmbedding: ClassEmbedding, threshold?: number): Promise<Array<{
        id: string;
        similarity: number;
        content: string;
    }>>;
    /**
     * Initialize database tables for embeddings
     */
    initializeDatabase(dbConnections: DatabaseConnections): Promise<void>;
}
//# sourceMappingURL=embedding-service.d.ts.map