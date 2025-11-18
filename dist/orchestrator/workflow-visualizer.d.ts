import { WorkflowDAG, WorkflowNode, WorkflowExecution, RoleType, WorkflowDefinition } from './types';
export interface ExtendedWorkflowDAG extends WorkflowDAG {
    name?: string;
    flowType?: string;
    entryPoints?: string[];
    exitPoints?: string[];
    mergePoints?: string[];
}
export interface ExtendedWorkflowNode extends WorkflowNode {
    roleType?: RoleType;
    qualityGates?: any[];
    parallelWith?: string[];
    condition?: {
        type: string;
        expression?: string;
    };
}
export interface ExtendedEdge {
    from: string;
    to: string;
    condition?: {
        type: string;
        expression?: string;
    };
}
export declare class WorkflowVisualizer {
    static generateMermaidDiagram(workflow: ExtendedWorkflowDAG): string;
    static generateDotDiagram(workflow: ExtendedWorkflowDAG): string;
    static analyzeWorkflowComplexity(workflow: WorkflowDAG): {
        cyclomaticComplexity: number;
        depth: number;
        parallelism: number;
        criticalPath: string[];
    };
    private static calculateDepth;
    private static calculateMaxParallelism;
    private static getNodeDepth;
    private static findCriticalPath;
    static validateWorkflowStructure(workflow: WorkflowDAG): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    private static hasCycles;
    private static formatNodeName;
    private static getRoleEmoji;
    private static getStatusEmoji;
    private static identifyParallelGroups;
    private static formatNodeLabel;
    private static getNodeStyle;
    private static getEdgeStyle;
    static summarizeExecution(execution: WorkflowExecution, workflow?: WorkflowDefinition): string;
}
//# sourceMappingURL=workflow-visualizer.d.ts.map