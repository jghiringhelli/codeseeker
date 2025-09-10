/**
 * Context Optimizer Tool Implementation
 * Wraps the ContextOptimizer class to implement InternalTool interface
 */
import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from '../../shared/tool-interface';
export declare class ContextOptimizerTool extends InternalTool {
    private logger;
    private contextOptimizer;
    constructor();
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
}
//# sourceMappingURL=context-optimizer-tool.d.ts.map