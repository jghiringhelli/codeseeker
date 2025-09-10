/**
 * Context Optimizer Tool Implementation
 * Example of how internal tools should implement the InternalTool interface
 */
import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from '../../shared/tool-interface';
export declare class ContextOptimizerTool extends InternalTool {
    private logger;
    private contextOptimizer;
    constructor();
    getMetadata(): ToolMetadata;
    initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult>;
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult>;
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    getStatus(projectId: string): Promise<{
        initialized: boolean;
        lastAnalysis?: Date;
        recordCount?: number;
        health: 'healthy' | 'warning' | 'error';
    }>;
}
//# sourceMappingURL=context-optimizer-tool.d.ts.map