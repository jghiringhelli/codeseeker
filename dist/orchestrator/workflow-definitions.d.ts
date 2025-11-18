/**
 * Workflow Definitions for CodeMind Orchestrator
 */
import { WorkflowDefinition } from './types';
export declare const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition>;
export declare function getWorkflowDefinition(workflowId: string): WorkflowDefinition | undefined;
export declare function listWorkflows(): string[];
export declare function validateWorkflow(workflow: WorkflowDefinition): boolean;
//# sourceMappingURL=workflow-definitions.d.ts.map