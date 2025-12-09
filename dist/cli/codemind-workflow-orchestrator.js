"use strict";
/**
 * CodeMind Core Workflow Orchestrator - SOLID Architecture
 *
 * This is the main brain of CodeMind CLI refactored using SOLID principles.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.createWorkflowOrchestrator = exports.CodeMindWorkflowOrchestrator = void 0;
// Re-export the new SOLID-compliant workflow orchestrator
var workflow_orchestrator_1 = require("./workflow/workflow-orchestrator");
Object.defineProperty(exports, "CodeMindWorkflowOrchestrator", { enumerable: true, get: function () { return workflow_orchestrator_1.CodeMindWorkflowOrchestrator; } });
Object.defineProperty(exports, "createWorkflowOrchestrator", { enumerable: true, get: function () { return workflow_orchestrator_1.createWorkflowOrchestrator; } });
// Legacy compatibility - export default for backward compatibility
var workflow_orchestrator_2 = require("./workflow/workflow-orchestrator");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return workflow_orchestrator_2.CodeMindWorkflowOrchestrator; } });
//# sourceMappingURL=codemind-workflow-orchestrator.js.map