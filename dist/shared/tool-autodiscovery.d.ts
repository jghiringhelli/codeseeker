/**
 * Tool Autodiscovery Service
 * Automatically discovers, registers, and manages all internal tools
 */
import { AnalysisResult, ToolInitResult, ToolUpdateResult } from './tool-interface';
export declare class ToolAutodiscoveryService {
    private logger;
    private initialized;
    constructor();
    /**
     * Auto-register all internal tools
     */
    initializeTools(): Promise<void>;
    /**
     * Get all tools metadata for database registration
     */
    getToolsForRegistration(): Array<{
        name: string;
        category: string;
        trust_level: number;
        installation_status: string;
        metadata: string;
    }>;
    /**
     * Initialize all tools for a specific project
     * Uses Claude Code to analyze and populate tables
     */
    initializeProjectForAllTools(projectPath: string, projectId: string): Promise<{
        success: boolean;
        results: Map<string, ToolInitResult>;
        totalTablesCreated: number;
        totalRecordsInserted: number;
    }>;
    /**
     * Analyze project with all applicable tools
     */
    analyzeProjectWithAllTools(projectPath: string, projectId: string): Promise<{
        success: boolean;
        results: Map<string, AnalysisResult>;
        totalExecutionTime: number;
    }>;
    /**
     * Update all tools after CLI command execution
     */
    updateToolsAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<{
        success: boolean;
        results: Map<string, ToolUpdateResult>;
    }>;
    /**
     * Get status of all tools for a project
     */
    getToolsStatus(projectId: string): Promise<Array<{
        name: string;
        category: string;
        status: any;
    }>>;
}
//# sourceMappingURL=tool-autodiscovery.d.ts.map