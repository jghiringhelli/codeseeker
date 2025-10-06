import { WorkflowDAG, WorkflowExecution } from './types';
export declare class WorkflowVisualizer {
    static generateMermaidDiagram(workflow: WorkflowDAG): string;
    static generateDotDiagram(workflow: WorkflowDAG): string;
    static generateTextualFlow(workflow: WorkflowDAG): string;
    static generateExecutionReport(workflow: WorkflowDAG, execution: WorkflowExecution): string;
    static generateRoleUtilizationReport(executions: WorkflowExecution[]): string;
    private static formatNodeName;
    private static getRoleEmoji;
    private static getStatusEmoji;
    private static identifyParallelGroups;
    private static getNodesAtLevel;
    private static groupParallelNodes;
    private static getNextNodes;
    private static calculateWorkflowStatistics;
}
//# sourceMappingURL=workflow-visualizer.d.ts.map