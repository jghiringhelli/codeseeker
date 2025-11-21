/**
 * Consolidated Analysis Repository - Unified data access for all analysis results
 * Replaces the tool-based architecture with a single, centralized approach
 *
 * This repository provides CRUD operations for all analysis data using the
 * consolidated schema with the unified analysis_results table.
 */
export interface AnalysisResult {
    id?: string;
    project_id: string;
    file_path: string;
    file_hash: string;
    analysis_type: AnalysisType;
    analysis_subtype?: string;
    analysis_result: any;
    confidence_score?: number;
    severity?: 'info' | 'minor' | 'moderate' | 'major' | 'critical';
    status?: 'detected' | 'acknowledged' | 'fixed' | 'ignored' | 'wont_fix';
    metadata?: any;
    tags?: string[];
    created_at?: Date;
    updated_at?: Date;
}
export type AnalysisType = 'pattern' | 'quality' | 'architecture' | 'tech_stack' | 'duplication' | 'dependency' | 'tree_navigation' | 'centralization' | 'test_coverage' | 'compilation' | 'solid_principles' | 'ui_components' | 'documentation' | 'use_cases' | 'database_schema';
export interface AnalysisFilters {
    analysis_type?: AnalysisType;
    analysis_subtype?: string;
    file_path?: string;
    severity?: string;
    status?: string;
    confidence_threshold?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
    order_by?: 'created_at' | 'updated_at' | 'confidence_score' | 'severity';
    order_direction?: 'ASC' | 'DESC';
}
export interface EmbeddingResult {
    id?: string;
    project_id: string;
    file_path: string;
    chunk_index?: number;
    content_type: 'code' | 'function' | 'class' | 'module' | 'comment' | 'documentation';
    content_text: string;
    content_hash: string;
    embedding?: number[];
    metadata?: any;
    created_at?: Date;
    updated_at?: Date;
}
export interface Project {
    id: string;
    project_path: string;
    project_name: string;
    project_type?: string;
    languages?: string[];
    frameworks?: string[];
    total_files?: number;
    total_lines?: number;
    status?: string;
    metadata?: any;
    created_at?: Date;
    updated_at?: Date;
}
export interface ProjectFilters {
    projectPath?: string;
    project_name?: string;
    status?: string;
    limit?: number;
}
export declare class ConsolidatedAnalysisRepository {
    private pool;
    private logger;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    close(): Promise<void>;
    private query;
    /**
     * Save analysis results to the unified analysis_results table
     */
    saveAnalysis(analysis: AnalysisResult): Promise<AnalysisResult>;
    /**
     * Save multiple analysis results in a single transaction
     */
    saveMultipleAnalyses(analyses: AnalysisResult[]): Promise<AnalysisResult[]>;
    /**
     * Get analysis results with flexible filtering
     */
    getAnalysis(projectId: string, filters?: AnalysisFilters): Promise<AnalysisResult[]>;
    /**
     * Get analysis by specific type and file
     */
    getAnalysisByType(projectId: string, analysisType: AnalysisType, filePath?: string): Promise<AnalysisResult[]>;
    /**
     * Delete analysis results
     */
    deleteAnalysis(projectId: string, analysisType?: AnalysisType, filePath?: string): Promise<number>;
    /**
     * Save semantic search embeddings
     */
    saveEmbedding(embedding: EmbeddingResult): Promise<EmbeddingResult>;
    /**
     * Save multiple embeddings in a transaction
     */
    saveMultipleEmbeddings(embeddings: EmbeddingResult[]): Promise<EmbeddingResult[]>;
    /**
     * Perform semantic similarity search
     */
    searchSimilarCode(projectId: string, queryEmbedding: number[], options?: {
        contentTypes?: string[];
        threshold?: number;
        limit?: number;
    }): Promise<any[]>;
    /**
     * Get embeddings by filters
     */
    getEmbeddings(projectId: string, filters?: {
        content_type?: string;
        file_path?: string;
        limit?: number;
        offset?: number;
    }): Promise<EmbeddingResult[]>;
    /**
     * Delete embeddings
     */
    deleteEmbeddings(projectId: string, filePath?: string): Promise<number>;
    /**
     * Migrate tool-specific data to consolidated format
     */
    migrateToolData(projectId: string, toolName: string, toolData: any[], analysisType: AnalysisType): Promise<void>;
    /**
     * Get analysis summary for a project
     */
    getAnalysisSummary(projectId: string): Promise<any>;
    /**
     * Get projects from the database
     */
    getProjects(filters?: ProjectFilters): Promise<Project[]>;
}
export declare const analysisRepository: ConsolidatedAnalysisRepository;
//# sourceMappingURL=analysis-repository-consolidated.d.ts.map