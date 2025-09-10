/**
 * Semantic Search Tool - Uses vector embeddings for intelligent code search
 *
 * This tool implements semantic search capabilities using OpenAI embeddings
 * and pgvector for similarity search across the codebase.
 */
import { AnalysisTool } from '../../shared/tool-interface';
export interface SemanticSearchRequest {
    query: string;
    projectPath: string;
    projectId: string;
    searchType?: 'similarity' | 'hybrid' | 'semantic';
    contentTypes?: string[];
    similarityThreshold?: number;
    maxResults?: number;
    includeContext?: boolean;
}
export interface CodeSegment {
    id: string;
    filePath: string;
    contentType: 'function' | 'class' | 'file' | 'comment' | 'variable' | 'import';
    contentText: string;
    startLine?: number;
    endLine?: number;
    metadata: {
        language: string;
        complexity?: number;
        dependencies?: string[];
        exports?: string[];
        [key: string]: any;
    };
}
export interface SemanticSearchResult {
    segment: CodeSegment;
    similarityScore: number;
    relevanceScore?: number;
    contextBefore?: string;
    contextAfter?: string;
}
export interface EmbeddingResponse {
    data: Array<{
        embedding: number[];
    }>;
    usage: {
        total_tokens: number;
    };
}
export declare class SemanticSearchTool extends AnalysisTool {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    intents: string[];
    keywords: string[];
    performanceImpact: 'medium' | 'high';
    tokenUsage: 'medium' | 'high';
    private logger;
    private openaiApiKey?;
    constructor();
    getMetadata(): any;
    initializeForProject(projectPath: string, projectId: string): Promise<any>;
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<any>;
    updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<any>;
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    getStatus(projectId: string): Promise<{
        initialized: boolean;
        lastAnalysis?: Date;
        recordCount?: number;
        health: 'healthy' | 'warning' | 'error';
    }>;
    performAnalysis(projectPath: string, projectId: string, parameters: any): Promise<any>;
    getDatabaseToolName(): string;
}
//# sourceMappingURL=semantic-search-tool.d.ts.map