/**
 * Embedding Service - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 924 lines to ~200 lines using service extraction
 */
import { DatabaseConnections } from '../../../../config/database-config';
import { EmbeddingConfig, EmbeddingResult, IEmbeddingProvider, IFileProcessor } from './interfaces';
export { EmbeddingConfig, FileEmbedding, MethodEmbedding, ClassEmbedding, EmbeddingResult } from './interfaces';
/**
 * Main Embedding Service Coordinator
 * Uses dependency injection for all embedding operations
 */
export declare class EmbeddingService {
    private config;
    private logger;
    private embeddingProvider;
    private fileProcessor;
    constructor(config: EmbeddingConfig, embeddingProvider?: IEmbeddingProvider, fileProcessor?: IFileProcessor);
    /**
     * Generate embeddings for a project - main entry point
     */
    generateProjectEmbeddings(projectPath: string, files: string[], dbConnections?: DatabaseConnections): Promise<EmbeddingResult>;
    /**
     * Generate embedding for single text
     */
    generateEmbedding(text: string, context?: string): Promise<number[]>;
    /**
     * Generate file-level embeddings
     */
    private generateFileEmbeddings;
    /**
     * Generate granular embeddings (classes and methods)
     * TODO: Implement when needed - placeholder for now
     */
    private generateGranularEmbeddings;
    /**
     * Save file embeddings to database
     */
    private saveFileEmbeddings;
    /**
     * Initialize database tables for embeddings
     */
    initializeDatabase(dbConnections: DatabaseConnections): Promise<void>;
    /**
     * Get embedding statistics
     */
    getEmbeddingStats(dbConnections: DatabaseConnections): Promise<any>;
    /**
     * Create appropriate embedding provider based on config
     */
    private createEmbeddingProvider;
    /**
     * Find similar methods (placeholder for backward compatibility)
     * TODO: Implement proper granular similarity search
     */
    findSimilarMethods(embedding: number[], threshold?: number): Promise<any[]>;
    /**
     * Find similar classes (placeholder for backward compatibility)
     * TODO: Implement proper granular similarity search
     */
    findSimilarClasses(embedding: number[], threshold?: number): Promise<any[]>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=embedding-service.d.ts.map