/**
 * Tool Database API - Provides CRUD operations for all internal tool data
 * This API is used by internal tools as database interface wrappers
 */
declare const router: import("express-serve-static-core").Router;
interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}
declare class ToolDatabaseAPI {
    private pool;
    private initialized;
    constructor(config?: DatabaseConfig);
    initialize(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    saveToolData(projectId: string, toolName: string, data: any): Promise<any>;
    getSemanticSearchData(projectId: string, filters?: any): Promise<any[]>;
    saveSemanticSearchData(projectId: string, data: any[]): Promise<any>;
    close(): Promise<void>;
    getTreeNavigationData(projectId: string, filters?: any): Promise<any[]>;
    saveTreeNavigationData(projectId: string, data: any[]): Promise<{
        success: boolean;
        inserted: number;
    }>;
    getCodeDuplications(projectId: string, filters?: any): Promise<any[]>;
    saveCodeDuplications(projectId: string, data: any[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    getCentralizationOpportunities(projectId: string, filters?: any): Promise<any[]>;
    saveCentralizationOpportunities(projectId: string, data: any[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    getTestCoverageData(projectId: string, filters?: any): Promise<any[]>;
    saveTestCoverageData(projectId: string, data: any[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    getCompilationResults(projectId: string, filters?: any): Promise<any[]>;
    saveCompilationResults(projectId: string, data: any): Promise<{
        success: boolean;
        build_id: any;
    }>;
    getSOLIDViolations(projectId: string, filters?: any): Promise<any[]>;
    saveSOLIDViolations(projectId: string, data: any[]): Promise<{
        success: boolean;
        processed: number;
    }>;
    getToolData(projectId: string, toolName: string, filters?: any): Promise<any[]>;
    /**
     * Save semantic search embeddings to database
     */
    saveSemanticSearch(projectId: string, data: any[]): Promise<any>;
    /**
     * Get semantic search embeddings from database
     */
    getSemanticSearch(projectId: string, filters?: any): Promise<any[]>;
    /**
     * Perform semantic similarity search
     */
    searchSimilarCode(projectId: string, queryEmbedding: number[], options?: {
        contentTypes?: string[];
        threshold?: number;
        limit?: number;
    }): Promise<any[]>;
}
declare const toolDB: ToolDatabaseAPI;
export default router;
export { ToolDatabaseAPI, toolDB };
//# sourceMappingURL=tool-database-api.d.ts.map