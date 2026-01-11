/**
 * Workflow Definitions for CodeSeeker Orchestrator
 */

import { WorkflowDefinition } from './types';

export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  codeAnalysis: {
    id: 'code-analysis',
    name: 'Code Analysis Workflow',
    description: 'Comprehensive code analysis including quality, complexity, and duplication',
    steps: [
      {
        id: 'scan-files',
        name: 'Scan Project Files',
        type: 'analysis'
      },
      {
        id: 'parse-code',
        name: 'Parse Code Structure',
        type: 'analysis',
        dependencies: ['scan-files']
      },
      {
        id: 'generate-embeddings',
        name: 'Generate Embeddings',
        type: 'execution',
        dependencies: ['parse-code']
      },
      {
        id: 'quality-check',
        name: 'Quality Analysis',
        type: 'validation',
        dependencies: ['parse-code']
      },
      {
        id: 'generate-report',
        name: 'Generate Report',
        type: 'reporting',
        dependencies: ['quality-check', 'generate-embeddings']
      }
    ],
    qualityGates: [
      {
        id: 'min-coverage',
        name: 'Minimum Code Coverage',
        threshold: 70,
        metric: 'coverage',
        required: false
      },
      {
        id: 'max-complexity',
        name: 'Maximum Complexity',
        threshold: 10,
        metric: 'complexity',
        required: true
      }
    ],
    executionTimeoutMs: 300000 // 5 minutes
  },

  semanticSearch: {
    id: 'semantic-search',
    name: 'Semantic Search Workflow',
    description: 'Semantic code search using embeddings',
    steps: [
      {
        id: 'prepare-query',
        name: 'Prepare Search Query',
        type: 'analysis'
      },
      {
        id: 'generate-query-embedding',
        name: 'Generate Query Embedding',
        type: 'execution',
        dependencies: ['prepare-query']
      },
      {
        id: 'search-vectors',
        name: 'Search Vector Database',
        type: 'execution',
        dependencies: ['generate-query-embedding']
      },
      {
        id: 'rank-results',
        name: 'Rank Search Results',
        type: 'analysis',
        dependencies: ['search-vectors']
      },
      {
        id: 'format-results',
        name: 'Format Results',
        type: 'reporting',
        dependencies: ['rank-results']
      }
    ],
    executionTimeoutMs: 30000 // 30 seconds
  },

  initialization: {
    id: 'project-init',
    name: 'Project Initialization',
    description: 'Initialize CodeSeeker for a new project',
    steps: [
      {
        id: 'validate-project',
        name: 'Validate Project Structure',
        type: 'validation'
      },
      {
        id: 'setup-database',
        name: 'Setup Database',
        type: 'execution',
        dependencies: ['validate-project']
      },
      {
        id: 'initial-scan',
        name: 'Initial Project Scan',
        type: 'analysis',
        dependencies: ['setup-database']
      },
      {
        id: 'build-graph',
        name: 'Build Semantic Graph',
        type: 'execution',
        dependencies: ['initial-scan']
      },
      {
        id: 'generate-initial-embeddings',
        name: 'Generate Initial Embeddings',
        type: 'execution',
        dependencies: ['initial-scan']
      },
      {
        id: 'verify-setup',
        name: 'Verify Setup',
        type: 'validation',
        dependencies: ['build-graph', 'generate-initial-embeddings']
      }
    ],
    executionTimeoutMs: 600000 // 10 minutes
  }
};

export function getWorkflowDefinition(workflowId: string): WorkflowDefinition | undefined {
  return WORKFLOW_DEFINITIONS[workflowId];
}

export function listWorkflows(): string[] {
  return Object.keys(WORKFLOW_DEFINITIONS);
}

export function validateWorkflow(workflow: WorkflowDefinition): boolean {
  // Basic validation
  if (!workflow.id || !workflow.name || !workflow.steps || workflow.steps.length === 0) {
    return false;
  }

  // Validate step dependencies
  const stepIds = new Set(workflow.steps.map(s => s.id));
  for (const step of workflow.steps) {
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          return false; // Invalid dependency
        }
      }
    }
  }

  return true;
}