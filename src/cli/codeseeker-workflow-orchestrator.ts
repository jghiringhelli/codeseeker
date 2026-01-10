/**
 * CodeSeeker Core Workflow Orchestrator - SOLID Architecture
 *
 * This is the main brain of CodeSeeker CLI refactored using SOLID principles.
 * The orchestrator coordinates specialized services to execute complete workflows.
 *
 * Core Workflow Steps:
 * 1. Analyze user intent and select tools
 * 2. Execute semantic search and graph traversal
 * 3. Split request into manageable sub-tasks
 * 4. Process each sub-task with Claude + context
 * 5. Run comprehensive quality checks
 * 6. Manage git branches and safe deployment
 * 7. Update all databases with changes
 */

// Re-export the new SOLID-compliant workflow orchestrator
export {
  CodeSeekerWorkflowOrchestrator,
  createWorkflowOrchestrator
} from './workflow/workflow-orchestrator';

// Re-export all interfaces for backward compatibility
export type {
  UserFeatureRequest,
  ProcessedIntent,
  SubTask,
  QualityCheckResult,
  WorkflowResult,
  SubTaskResult,
  EnhancementContext,
  IWorkflowOrchestrator,
  IIntentAnalysisService,
  IContextGatheringService,
  IGitWorkflowService,
  ITaskOrchestrationService,
  IQualityAssuranceService,
  IDatabaseSyncService
} from './workflow/interfaces/index';

// Legacy compatibility - export default for backward compatibility
export { CodeSeekerWorkflowOrchestrator as default } from './workflow/workflow-orchestrator';