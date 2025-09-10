/**
 * Tool Adapter - Bridges existing enhanced tools to InternalTool interface
 * Allows initialization script to work with existing tool implementations
 */
import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from './tool-interface';
import { AnalysisTool } from './tool-interface';
export declare class ToolAdapter extends InternalTool {
    private enhancedTool;
    private logger;
    constructor(enhancedTool: AnalysisTool);
    getMetadata(): ToolMetadata;
    initialize(projectId: string): Promise<ToolInitResult>;
    initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult>;
    analyze(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    update(projectId: string, data: any): Promise<void>;
    updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult>;
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    getStatus(projectId: string): Promise<{
        initialized: boolean;
        lastAnalysis?: Date;
        recordCount?: number;
        health: 'healthy' | 'warning' | 'error';
    }>;
    private mapCategory;
}
//# sourceMappingURL=tool-adapter.d.ts.map