/**
 * Common interface that all internal tools must implement
 * Enables autodiscovery and automatic integration
 */
export interface ToolMetadata {
    name: string;
    category: 'optimization' | 'search' | 'architecture' | 'quality' | 'navigation' | 'analysis' | 'verification';
    trustLevel: number;
    version: string;
    description: string;
    dependencies?: string[];
    capabilities: string[];
}
export interface AnalysisResult {
    toolName: string;
    projectId: string;
    timestamp: Date;
    data: any;
    metrics?: {
        executionTime?: number;
        confidence?: number;
        coverage?: number;
    };
    recommendations?: string[];
    errors?: string[];
}
export interface ToolInitResult {
    success: boolean;
    data?: any;
    error?: string;
    tablesCreated?: string[];
    recordsInserted?: number;
}
export interface ToolUpdateResult {
    success: boolean;
    tablesUpdated?: string[];
    recordsModified?: number;
    newInsights?: any[];
    error?: string;
}
/**
 * Base interface that all CodeMind internal tools must implement
 */
export declare abstract class InternalTool {
    abstract getMetadata(): ToolMetadata;
    /**
     * Initialize tool-specific data for a project
     * Called during project initialization
     */
    abstract initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult>;
    /**
     * Analyze project and populate tool-specific tables
     * Uses Claude Code API to perform deep analysis
     * @param parameters - Claude-selected parameters for this specific analysis
     */
    abstract analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    /**
     * Update tool data after CLI command execution
     * Called at the end of every CLI request
     */
    abstract updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult>;
    /**
     * Check if tool can analyze the given project
     */
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    /**
     * Get tool status for a project
     */
    getStatus(projectId: string): Promise<{
        initialized: boolean;
        lastAnalysis?: Date;
        recordCount?: number;
        health: 'healthy' | 'warning' | 'error';
    }>;
}
/**
 * Tool discovery registry
 */
export declare class ToolRegistry {
    private static tools;
    static registerTool(tool: InternalTool): void;
    static getAllTools(): InternalTool[];
    static getTool(name: string): InternalTool | undefined;
    static getToolById(id: string): InternalTool | undefined;
    static getToolsByCategory(category: ToolMetadata['category']): InternalTool[];
    static discoverTools(): ToolMetadata[];
}
//# sourceMappingURL=tool-interface.d.ts.map