/**
 * Granular Embedding Service
 * Creates method-level and class-level embeddings aligned with semantic graph nodes
 * Instead of arbitrary chunking, we chunk by semantic boundaries (methods, classes)
 */
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
export interface SimilarityResult {
    targetId: string;
    targetType: 'method' | 'class';
    similarity: number;
    target: MethodEmbedding | ClassEmbedding;
}
export declare class GranularEmbeddingService {
    private logger;
    private embeddingService;
    private codeParser;
    private semanticGraph;
    constructor();
    /**
     * Generate method and class level embeddings for a project
     */
    generateGranularEmbeddings(projectId: string, files: string[], progressCallback?: (progress: number, current: string) => void): Promise<{
        methodEmbeddings: number;
        classEmbeddings: number;
        errors: number;
    }>;
    /**
     * Generate embedding for a single class
     */
    private generateClassEmbedding;
    /**
     * Generate embedding for a single method
     */
    private generateMethodEmbedding;
    /**
     * Find similar methods using cosine similarity
     */
    findSimilarMethods(projectId: string, methodId: string, threshold?: number, limit?: number): Promise<SimilarityResult[]>;
    /**
     * Find similar classes using cosine similarity
     */
    findSimilarClasses(projectId: string, classId: string, threshold?: number, limit?: number): Promise<SimilarityResult[]>;
    /**
     * Extract class content from file
     */
    private extractClassContent;
    /**
     * Extract method content from file
     */
    private extractMethodContent;
    /**
     * Build class context for embedding generation
     */
    private buildClassContext;
    /**
     * Build method context for embedding generation
     */
    private buildMethodContext;
    /**
     * Build method signature string
     */
    private buildMethodSignature;
    /**
     * Store class embedding in database
     */
    private storeClassEmbedding;
    /**
     * Store method embedding in database
     */
    private storeMethodEmbedding;
    /**
     * Initialize database tables for granular embeddings
     */
    initializeDatabase(projectId: string): Promise<void>;
}
export default GranularEmbeddingService;
//# sourceMappingURL=granular-embedding-service.d.ts.map