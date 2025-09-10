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
    initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult>;
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult>;
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    private mapCategory;
    private shouldUpdateForCommand;
}
//# sourceMappingURL=tool-adapter.d.ts.map