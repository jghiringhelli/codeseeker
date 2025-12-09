/**
 * Tool Database API - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 951 lines to ~150 lines using service extraction
 */
import { IToolDataService, ISemanticSearchService, ICodeDuplicationsService, DatabaseConfig } from './interfaces';
declare const router: import("express-serve-static-core").Router;
/**
 * Main Tool Database API Coordinator
 * Uses dependency injection for all database operations
 */
export declare class ToolDatabaseAPI {
    private toolDataService?;
    private semanticSearchService?;
    private codeDuplicationsService?;
    private db;
    constructor(config?: DatabaseConfig, toolDataService?: IToolDataService, semanticSearchService?: ISemanticSearchService, codeDuplicationsService?: ICodeDuplicationsService);
    initialize(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    close(): Promise<void>;
    saveToolData(projectId: string, toolName: string, data: any): Promise<any>;
    getToolData(projectId: string, toolName: string, options?: any): Promise<any>;
    deleteToolData(projectId: string, toolName: string): Promise<void>;
    getSemanticSearchData(projectId: string, filters?: any): Promise<any[]>;
    saveSemanticSearchData(projectId: string, data: any[]): Promise<any>;
    saveSemanticSearch(projectId: string, data: any[]): Promise<any>;
    getSemanticSearch(projectId: string, filters?: any): Promise<any[]>;
    getCodeDuplications(projectId: string, filters?: any): Promise<any[]>;
    saveCodeDuplications(projectId: string, data: any[]): Promise<any>;
    deleteCodeDuplications(projectId: string): Promise<void>;
    /**
     * Get comprehensive project data across all tools
     */
    getProjectOverview(projectId: string): Promise<any>;
    /**
     * Clean all data for a project
     */
    cleanProjectData(projectId: string): Promise<any>;
    /**
     * Health check for all services
     */
    healthCheck(): Promise<any>;
}
export declare const toolDB: ToolDatabaseAPI;
export { router as toolDatabaseRouter };
export default ToolDatabaseAPI;
//# sourceMappingURL=tool-database-api.d.ts.map