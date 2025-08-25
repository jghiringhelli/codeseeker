import { EventEmitter } from 'events';
import { Logger } from '../../shared/logger';
export interface KnowledgeDocument {
    id: string;
    type: KnowledgeType;
    title: string;
    content: string;
    source: KnowledgeSource;
    metadata: DocumentMetadata;
    vector: Float32Array;
    invertedIndex: Map<string, number[]>;
    semanticHash: string;
    relevanceScore: number;
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
}
export declare enum KnowledgeType {
    COMMON_PRACTICE = "COMMON_PRACTICE",
    PROFESSIONAL_ADVICE = "PROFESSIONAL_ADVICE",
    RESEARCH_PAPER = "RESEARCH_PAPER",
    EXPERIMENTAL = "EXPERIMENTAL",
    BEST_PRACTICE = "BEST_PRACTICE",
    ANTI_PATTERN = "ANTI_PATTERN",
    CASE_STUDY = "CASE_STUDY",
    TUTORIAL = "TUTORIAL",
    API_DOCUMENTATION = "API_DOCUMENTATION",
    ARCHITECTURE_PATTERN = "ARCHITECTURE_PATTERN"
}
export declare enum KnowledgeSource {
    STACKOVERFLOW = "STACKOVERFLOW",
    GITHUB = "GITHUB",
    ARXIV = "ARXIV",
    MEDIUM = "MEDIUM",
    DOCUMENTATION = "DOCUMENTATION",
    RESEARCH_GATE = "RESEARCH_GATE",
    IEEE = "IEEE",
    ACM = "ACM",
    INTERNAL = "INTERNAL",
    COMMUNITY = "COMMUNITY"
}
export interface DocumentMetadata {
    author?: string;
    publishedDate?: Date;
    citations?: number;
    quality: QualityMetrics;
    tags: string[];
    language: string;
    framework?: string;
    version?: string;
    dependencies?: string[];
}
export interface QualityMetrics {
    reliability: number;
    relevance: number;
    recency: number;
    authority: number;
    completeness: number;
}
export interface SearchResult {
    document: KnowledgeDocument;
    score: number;
    matchType: 'exact' | 'semantic' | 'fuzzy' | 'hybrid';
    highlights: string[];
    explanation: string;
}
export interface RAGContext {
    query: string;
    relevantDocuments: KnowledgeDocument[];
    synthesizedKnowledge: string;
    confidence: number;
    sources: string[];
}
export declare class KnowledgeRepository extends EventEmitter {
    private logger;
    private documents;
    private invertedIndex;
    private vectorIndex;
    private semanticCache;
    private apiEndpoints;
    private knowledgeBasePath;
    constructor(logger: Logger, basePath?: string);
    private initializeAPIEndpoints;
    searchKnowledge(query: string, options?: {
        types?: KnowledgeType[];
        sources?: KnowledgeSource[];
        minQuality?: number;
        limit?: number;
        useHybrid?: boolean;
    }): Promise<SearchResult[]>;
    private keywordSearch;
    private semanticSearch;
    private mergeAndRerankResults;
    fetchExternalKnowledge(query: string, source: KnowledgeSource): Promise<KnowledgeDocument[]>;
    generateRAGContext(query: string, roleType?: string): Promise<RAGContext>;
    private synthesizeKnowledge;
    private createKnowledgeDocument;
    private inferKnowledgeType;
    private assessQuality;
    private calculateReliability;
    private calculateAuthority;
    private calculateCompleteness;
    private tokenize;
    private buildInvertedIndex;
    private calculateTFIDF;
    private generateVector;
    private cosineSimilarity;
    private generateHighlights;
    private generateSemanticHighlights;
    private calculateQualityScore;
    private calculateConfidence;
    private generateCacheKey;
    private generateSemanticHash;
    private extractKeyPoint;
    private simulateAPICall;
    private loadKnowledgeBase;
    private addDocument;
    getDocument(id: string): Promise<KnowledgeDocument | null>;
    saveKnowledgeBase(): Promise<void>;
}
//# sourceMappingURL=knowledge-repository.d.ts.map