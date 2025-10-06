/**
 * Documentation RAG Service
 * Specialized RAG system for documentation with different chunking strategies than code
 * Handles technical documentation, README files, and internet-sourced technical info
 */
export interface DocumentationChunk {
    id: string;
    filePath: string;
    title: string;
    content: string;
    chunkIndex: number;
    hash: string;
    documentType: 'readme' | 'manual' | 'api-doc' | 'tutorial' | 'reference' | 'changelog' | 'internet-doc';
    metadata: {
        language: string;
        size: number;
        headings: string[];
        codeBlocks: string[];
        links: string[];
        techStack: string[];
        version?: string;
        source: 'local' | 'internet';
        sourceUrl?: string;
        lastUpdated: number;
        significance: 'critical' | 'high' | 'medium' | 'low';
    };
}
export interface DocumentationSearchResult {
    chunk: DocumentationChunk;
    relevanceScore: number;
    matchReason: string;
    contextSnippet: string;
    relatedChunks?: DocumentationChunk[];
}
export interface TechnicalContext {
    query: string;
    documentationResults: DocumentationSearchResult[];
    techStackInfo: Array<{
        technology: string;
        version?: string;
        officialDocs: string[];
        bestPractices: string[];
        commonPatterns: string[];
    }>;
    totalDocuments: number;
    searchTime: number;
    cacheHitRate: number;
    generatedAt: number;
}
/**
 * Documentation RAG Service
 * Separate collection for documentation with specialized chunking and search
 */
export declare class DocumentationRAGService {
    private logger;
    private dbConnections;
    private embeddingService;
    private semanticSearchManager;
    private initialized;
    private readonly DOC_CHUNK_SIZE;
    private readonly DOC_OVERLAP_SIZE;
    private readonly MIN_DOC_CHUNK_SIZE;
    private readonly MAX_HEADING_LEVELS;
    constructor(projectId: string);
    initialize(): Promise<void>;
    /**
     * Ingest documentation from specified paths
     */
    ingestDocumentationPaths(paths: string[]): Promise<{
        processed: number;
        chunksCreated: number;
        errors: string[];
    }>;
    /**
     * Ingest documentation directory recursively
     */
    private ingestDocumentationDirectory;
    /**
     * Ingest single documentation file
     */
    private ingestDocumentationFile;
    /**
     * Chunk documentation with heading-aware strategy
     */
    private chunkDocumentation;
    /**
     * Parse heading structure from markdown/text
     */
    private parseHeadingStructure;
    /**
     * Chunk by heading sections
     */
    private chunkByHeadings;
    /**
     * Fallback content-based chunking
     */
    private chunkByContent;
    /**
     * Create documentation chunk with metadata
     */
    private createDocumentationChunk;
    /**
     * Search documentation with specialized ranking
     */
    searchDocumentation(query: string, options?: {
        maxResults?: number;
        minSimilarity?: number;
        documentTypes?: DocumentationChunk['documentType'][];
        techStack?: string[];
        includeRelated?: boolean;
    }): Promise<DocumentationSearchResult[]>;
    /**
     * Get technical context for Claude Code integration
     */
    getTechnicalContext(query: string, maxTokens?: number): Promise<TechnicalContext>;
    /**
     * Fetch and ingest documentation from internet sources
     */
    fetchInternetDocumentation(techStack: string[], options?: {
        includeOfficialDocs?: boolean;
        includeGuides?: boolean;
        maxDocumentsPerTech?: number;
    }): Promise<{
        fetched: number;
        ingested: number;
        errors: string[];
    }>;
    private isDocumentationFile;
    private detectDocumentType;
    private detectLanguage;
    private extractTitleFromChunk;
    private extractHeadings;
    private extractCodeBlocks;
    private extractLinks;
    private detectTechStack;
    private calculateSignificance;
    private createDocumentationTables;
    private storeDocumentationChunk;
    private searchDocumentationChunks;
    private findRelatedDocumentationChunks;
    private extractTechStackInfo;
    private generateMatchReason;
    private generateContextSnippet;
}
export default DocumentationRAGService;
//# sourceMappingURL=documentation-rag-service.d.ts.map