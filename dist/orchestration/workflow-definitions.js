"use strict";
// Predefined Workflow DAG Definitions
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowDefinitions = void 0;
const types_1 = require("./types");
class WorkflowDefinitions {
    static createFeatureDevelopmentWorkflow() {
        const nodes = new Map();
        // Entry Point: Work Classification
        nodes?.set('classify-work', {
            id: 'classify-work',
            roleType: types_1.RoleType.WORK_CLASSIFIER,
            name: 'Classify Feature Request',
            description: 'Analyze and classify the feature request',
            dependencies: [],
            inputs: [types_1.InputType.REQUIREMENTS],
            outputs: [types_1.OutputType.SPECIFICATIONS],
            executionTimeoutMs: 300000, // 5 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'feature/{workItemId}-classification',
                baseRef: 'main',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Concurrent Analysis Phase
        nodes?.set('analyze-requirements', {
            id: 'analyze-requirements',
            roleType: types_1.RoleType.REQUIREMENT_ANALYST,
            name: 'Analyze Requirements',
            description: 'Break down requirements into detailed specifications',
            dependencies: ['classify-work'],
            parallelWith: ['estimate-complexity'],
            inputs: [types_1.InputType.REQUIREMENTS],
            outputs: [types_1.OutputType.SPECIFICATIONS],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'requirements-complete',
                    name: 'Requirements Completeness Gate',
                    type: types_1.QualityGateType.REQUIREMENTS_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.TEST_SUCCESS_RATE, operator: 'GTE', threshold: 0.95, weight: 1.0 }
                    ],
                    blockingLevel: 'ERROR',
                    autoFix: false
                }],
            branchStrategy: {
                pattern: 'feature/{workItemId}-requirements',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // TDD Test Design Phase
        nodes?.set('design-tests', {
            id: 'design-tests',
            roleType: types_1.RoleType.TEST_DESIGNER,
            name: 'Design Test Suite',
            description: 'Create comprehensive test suite following TDD principles',
            dependencies: ['analyze-requirements'],
            inputs: [types_1.InputType.SPECIFICATIONS],
            outputs: [types_1.OutputType.TEST_SUITE],
            executionTimeoutMs: 2400000, // 40 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'test/{workItemId}-design',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Implementation Phase
        nodes?.set('implement-feature', {
            id: 'implement-feature',
            roleType: types_1.RoleType.IMPLEMENTATION_DEVELOPER,
            name: 'Implement Feature',
            description: 'Implement feature to make all tests pass',
            dependencies: ['design-tests'],
            inputs: [types_1.InputType.SPECIFICATIONS, types_1.InputType.TEST_SUITE],
            outputs: [types_1.OutputType.IMPLEMENTED_CODE],
            executionTimeoutMs: 7200000, // 2 hours
            retryAttempts: 5,
            branchStrategy: {
                pattern: 'impl/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Code Review
        nodes?.set('review-code', {
            id: 'review-code',
            roleType: types_1.RoleType.CODE_REVIEWER,
            name: 'Code Review',
            description: 'Comprehensive code review and feedback',
            dependencies: ['implement-feature'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE],
            outputs: [types_1.OutputType.QUALITY_SCORES],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'code-review-gate',
                    name: 'Code Review Gate',
                    type: types_1.QualityGateType.IMPLEMENTATION_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.SOLID_COMPLIANCE, operator: 'GTE', threshold: 0.85, weight: 0.4 },
                        { metric: types_1.QualityMetric.DUPLICATION_PERCENTAGE, operator: 'LTE', threshold: 0.05, weight: 0.3 },
                        { metric: types_1.QualityMetric.CYCLOMATIC_COMPLEXITY, operator: 'LTE', threshold: 10, weight: 0.3 }
                    ],
                    blockingLevel: 'ERROR',
                    autoFix: false
                }],
            branchStrategy: {
                pattern: 'review/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Build Phase
        nodes?.set('build-artifact', {
            id: 'build-artifact',
            roleType: types_1.RoleType.COMPILER_BUILDER,
            name: 'Build Artifacts',
            description: 'Compile and build application artifacts',
            dependencies: ['review-code'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE],
            outputs: [types_1.OutputType.BUILD_ARTIFACTS],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'build/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Parallel Quality Analysis
        nodes?.set('security-audit', {
            id: 'security-audit',
            roleType: types_1.RoleType.SECURITY_AUDITOR,
            name: 'Security Audit',
            description: 'Comprehensive security vulnerability assessment',
            dependencies: ['build-artifact'],
            parallelWith: ['performance-audit', 'quality-audit'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE, types_1.InputType.BUILD_ARTIFACTS],
            outputs: [types_1.OutputType.SECURITY_ASSESSMENT],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'security-gate',
                    name: 'Security Gate',
                    type: types_1.QualityGateType.QUALITY_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.SECURITY_SCORE, operator: 'GTE', threshold: 0.90, weight: 0.6 },
                        { metric: types_1.QualityMetric.CRITICAL_VULNERABILITIES, operator: 'EQ', threshold: 0, weight: 0.4 }
                    ],
                    blockingLevel: 'CRITICAL',
                    autoFix: false
                }],
            branchStrategy: {
                pattern: 'security/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        nodes?.set('performance-audit', {
            id: 'performance-audit',
            roleType: types_1.RoleType.PERFORMANCE_AUDITOR,
            name: 'Performance Audit',
            description: 'Performance testing and optimization analysis',
            dependencies: ['build-artifact'],
            parallelWith: ['security-audit', 'quality-audit'],
            inputs: [types_1.InputType.BUILD_ARTIFACTS],
            outputs: [types_1.OutputType.PERFORMANCE_ANALYSIS],
            executionTimeoutMs: 2400000, // 40 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'performance-gate',
                    name: 'Performance Gate',
                    type: types_1.QualityGateType.QUALITY_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.RESPONSE_TIME, operator: 'LTE', threshold: 2000, weight: 0.4 }, // 2s
                        { metric: types_1.QualityMetric.MEMORY_USAGE, operator: 'LTE', threshold: 0.80, weight: 0.3 }, // 80%
                        { metric: types_1.QualityMetric.CPU_UTILIZATION, operator: 'LTE', threshold: 0.70, weight: 0.3 } // 70%
                    ],
                    blockingLevel: 'WARNING',
                    autoFix: true
                }],
            branchStrategy: {
                pattern: 'perf/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        nodes?.set('quality-audit', {
            id: 'quality-audit',
            roleType: types_1.RoleType.QUALITY_AUDITOR,
            name: 'Quality Audit',
            description: 'Comprehensive code quality and architecture audit',
            dependencies: ['build-artifact'],
            parallelWith: ['security-audit', 'performance-audit'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE, types_1.InputType.BUILD_ARTIFACTS],
            outputs: [types_1.OutputType.QUALITY_SCORES],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'quality-gate',
                    name: 'Quality Gate',
                    type: types_1.QualityGateType.QUALITY_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.CODE_COVERAGE, operator: 'GTE', threshold: 0.85, weight: 0.25 },
                        { metric: types_1.QualityMetric.SOLID_COMPLIANCE, operator: 'GTE', threshold: 0.90, weight: 0.25 },
                        { metric: types_1.QualityMetric.DUPLICATION_PERCENTAGE, operator: 'LTE', threshold: 0.03, weight: 0.25 },
                        { metric: types_1.QualityMetric.CYCLOMATIC_COMPLEXITY, operator: 'LTE', threshold: 8, weight: 0.25 }
                    ],
                    blockingLevel: 'ERROR',
                    autoFix: true
                }],
            branchStrategy: {
                pattern: 'quality/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // DevOps Phase
        nodes?.set('devops-setup', {
            id: 'devops-setup',
            roleType: types_1.RoleType.DEVOPS_ENGINEER,
            name: 'DevOps Setup',
            description: 'Setup deployment pipeline and infrastructure',
            dependencies: ['security-audit', 'performance-audit', 'quality-audit'],
            inputs: [types_1.InputType.BUILD_ARTIFACTS, types_1.InputType.DEPLOYMENT_CONFIG],
            outputs: [types_1.OutputType.DEPLOYMENT_PACKAGE],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'ops/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Deployment Phase
        nodes?.set('deploy-staging', {
            id: 'deploy-staging',
            roleType: types_1.RoleType.DEPLOYER,
            name: 'Deploy to Staging',
            description: 'Deploy to staging environment',
            dependencies: ['devops-setup'],
            inputs: [types_1.InputType.DEPLOYMENT_PACKAGE],
            outputs: [types_1.OutputType.DEPLOYMENT_PACKAGE],
            executionTimeoutMs: 1200000, // 20 minutes
            retryAttempts: 3,
            qualityGates: [{
                    id: 'deployment-gate',
                    name: 'Deployment Gate',
                    type: types_1.QualityGateType.DEPLOYMENT_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.TEST_SUCCESS_RATE, operator: 'GTE', threshold: 1.0, weight: 1.0 }
                    ],
                    blockingLevel: 'ERROR',
                    autoFix: false
                }],
            branchStrategy: {
                pattern: 'deploy/{workItemId}-staging',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Testing Phase - Parallel Testing
        nodes?.set('unit-tests', {
            id: 'unit-tests',
            roleType: types_1.RoleType.UNIT_TEST_EXECUTOR,
            name: 'Execute Unit Tests',
            description: 'Run comprehensive unit test suite',
            dependencies: ['deploy-staging'],
            parallelWith: ['integration-tests'],
            inputs: [types_1.InputType.BUILD_ARTIFACTS],
            outputs: [types_1.OutputType.TEST_REPORT],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'feature/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: false
            }
        });
        nodes?.set('integration-tests', {
            id: 'integration-tests',
            roleType: types_1.RoleType.INTEGRATION_TEST_ENGINEER,
            name: 'Integration Tests',
            description: 'Design and execute integration tests',
            dependencies: ['deploy-staging'],
            parallelWith: ['unit-tests'],
            inputs: [types_1.InputType.DEPLOYMENT_PACKAGE],
            outputs: [types_1.OutputType.TEST_REPORT],
            executionTimeoutMs: 2400000, // 40 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'integration/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        nodes?.set('e2e-tests', {
            id: 'e2e-tests',
            roleType: types_1.RoleType.E2E_TEST_ENGINEER,
            name: 'End-to-End Tests',
            description: 'Execute end-to-end user journey tests',
            dependencies: ['unit-tests', 'integration-tests'],
            inputs: [types_1.InputType.DEPLOYMENT_PACKAGE],
            outputs: [types_1.OutputType.TEST_REPORT],
            executionTimeoutMs: 3600000, // 1 hour
            retryAttempts: 2,
            branchStrategy: {
                pattern: 'e2e/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Documentation Phase - Parallel Documentation
        nodes?.set('tech-docs', {
            id: 'tech-docs',
            roleType: types_1.RoleType.TECHNICAL_DOCUMENTER,
            name: 'Technical Documentation',
            description: 'Update technical documentation and API docs',
            dependencies: ['e2e-tests'],
            parallelWith: ['user-docs'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE, types_1.InputType.SPECIFICATIONS],
            outputs: [types_1.OutputType.DOCUMENTATION_UPDATE],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            branchStrategy: {
                pattern: 'docs/{workItemId}-tech',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        nodes?.set('user-docs', {
            id: 'user-docs',
            roleType: types_1.RoleType.USER_DOCUMENTER,
            name: 'User Documentation',
            description: 'Update user-facing documentation and guides',
            dependencies: ['e2e-tests'],
            parallelWith: ['tech-docs'],
            inputs: [types_1.InputType.SPECIFICATIONS, types_1.InputType.TEST_REPORT],
            outputs: [types_1.OutputType.DOCUMENTATION_UPDATE],
            executionTimeoutMs: 1800000, // 30 minutes
            retryAttempts: 2,
            branchStrategy: {
                pattern: 'docs/{workItemId}-user',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'feature/{workItemId}',
                autoDelete: true
            }
        });
        // Release Management
        nodes?.set('release-prep', {
            id: 'release-prep',
            roleType: types_1.RoleType.RELEASE_MANAGER,
            name: 'Release Preparation',
            description: 'Prepare release package and changelog',
            dependencies: ['tech-docs', 'user-docs'],
            inputs: [types_1.InputType.BUILD_ARTIFACTS, types_1.InputType.DOCUMENTATION_UPDATE],
            outputs: [types_1.OutputType.DEPLOYMENT_PACKAGE],
            executionTimeoutMs: 1200000, // 20 minutes
            retryAttempts: 2,
            qualityGates: [{
                    id: 'release-gate',
                    name: 'Release Gate',
                    type: types_1.QualityGateType.RELEASE_GATE,
                    criteria: [
                        { metric: types_1.QualityMetric.TEST_SUCCESS_RATE, operator: 'EQ', threshold: 1.0, weight: 0.4 },
                        { metric: types_1.QualityMetric.SECURITY_SCORE, operator: 'GTE', threshold: 0.90, weight: 0.3 },
                        { metric: types_1.QualityMetric.CODE_COVERAGE, operator: 'GTE', threshold: 0.85, weight: 0.3 }
                    ],
                    blockingLevel: 'CRITICAL',
                    autoFix: false
                }],
            branchStrategy: {
                pattern: 'release/{workItemId}',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'main',
                autoDelete: false
            }
        });
        // Final Commit
        nodes?.set('commit-changes', {
            id: 'commit-changes',
            roleType: types_1.RoleType.COMMITTER,
            name: 'Commit Changes',
            description: 'Create meaningful commit and merge to main',
            dependencies: ['release-prep'],
            inputs: [types_1.InputType.IMPLEMENTED_CODE, types_1.InputType.DOCUMENTATION_UPDATE],
            outputs: [types_1.OutputType.COMMIT_MESSAGE],
            executionTimeoutMs: 300000, // 5 minutes
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'main',
                baseRef: 'feature/{workItemId}',
                mergeTarget: 'main',
                autoDelete: false
            }
        });
        // Define edges
        const edges = [
            { from: 'classify-work', to: 'analyze-requirements', priority: 1 },
            { from: 'analyze-requirements', to: 'design-tests', priority: 1 },
            { from: 'design-tests', to: 'implement-feature', priority: 1 },
            { from: 'implement-feature', to: 'review-code', priority: 1 },
            { from: 'review-code', to: 'build-artifact', priority: 1 },
            { from: 'build-artifact', to: 'security-audit', priority: 1 },
            { from: 'build-artifact', to: 'performance-audit', priority: 1 },
            { from: 'build-artifact', to: 'quality-audit', priority: 1 },
            { from: 'security-audit', to: 'devops-setup', priority: 1 },
            { from: 'performance-audit', to: 'devops-setup', priority: 1 },
            { from: 'quality-audit', to: 'devops-setup', priority: 1 },
            { from: 'devops-setup', to: 'deploy-staging', priority: 1 },
            { from: 'deploy-staging', to: 'unit-tests', priority: 1 },
            { from: 'deploy-staging', to: 'integration-tests', priority: 1 },
            { from: 'unit-tests', to: 'e2e-tests', priority: 1 },
            { from: 'integration-tests', to: 'e2e-tests', priority: 1 },
            { from: 'e2e-tests', to: 'tech-docs', priority: 1 },
            { from: 'e2e-tests', to: 'user-docs', priority: 1 },
            { from: 'tech-docs', to: 'release-prep', priority: 1 },
            { from: 'user-docs', to: 'release-prep', priority: 1 },
            { from: 'release-prep', to: 'commit-changes', priority: 1 }
        ];
        return {
            id: 'feature-development-v1',
            name: 'Feature Development Workflow',
            flowType: types_1.FlowType.FEATURE_DEVELOPMENT,
            nodes,
            edges,
            entryPoints: ['classify-work'],
            mergePoints: ['analyze-requirements', 'devops-setup', 'e2e-tests', 'release-prep'],
            exitPoints: ['commit-changes'],
            backtrackRules: [
                {
                    id: 'test-failure-backtrack',
                    trigger: types_1.BacktrackTrigger.TEST_FAILURE,
                    targetNode: 'implement-feature',
                    condition: 'testSuccessRate < 0.95',
                    priority: 1,
                    includeContext: [types_1.ContextType.TEST_FAILURES, types_1.ContextType.ERROR_LOGS],
                    maxBacktrackCount: 3
                },
                {
                    id: 'build-failure-backtrack',
                    trigger: types_1.BacktrackTrigger.BUILD_FAILURE,
                    targetNode: 'implement-feature',
                    condition: 'buildStatus === "FAILED"',
                    priority: 1,
                    includeContext: [types_1.ContextType.ERROR_LOGS, types_1.ContextType.DEPENDENCY_CONFLICTS],
                    maxBacktrackCount: 2
                },
                {
                    id: 'quality-gate-backtrack',
                    trigger: types_1.BacktrackTrigger.QUALITY_GATE_FAILURE,
                    targetNode: 'implement-feature',
                    condition: 'qualityScore < qualityThreshold',
                    priority: 2,
                    includeContext: [types_1.ContextType.QUALITY_ISSUES, types_1.ContextType.ARCHITECTURAL_VIOLATIONS],
                    maxBacktrackCount: 2
                },
                {
                    id: 'security-violation-backtrack',
                    trigger: types_1.BacktrackTrigger.SECURITY_VIOLATION,
                    targetNode: 'implement-feature',
                    condition: 'securityScore < 0.90 || criticalVulnerabilities > 0',
                    priority: 1,
                    includeContext: [types_1.ContextType.SECURITY_VULNERABILITIES],
                    maxBacktrackCount: 1
                }
            ]
        };
    }
    static createDefectResolutionWorkflow() {
        // Simplified defect resolution workflow
        const nodes = new Map();
        nodes?.set('classify-defect', {
            id: 'classify-defect',
            roleType: types_1.RoleType.WORK_CLASSIFIER,
            name: 'Classify Defect',
            description: 'Analyze and classify the defect',
            dependencies: [],
            inputs: [types_1.InputType.REQUIREMENTS],
            outputs: [types_1.OutputType.SPECIFICATIONS],
            executionTimeoutMs: 300000,
            retryAttempts: 2,
            branchStrategy: {
                pattern: 'bugfix/{workItemId}',
                baseRef: 'main',
                mergeTarget: 'main',
                autoDelete: true
            }
        });
        nodes?.set('reproduce-issue', {
            id: 'reproduce-issue',
            roleType: types_1.RoleType.TEST_DESIGNER,
            name: 'Reproduce Issue',
            description: 'Create test that reproduces the defect',
            dependencies: ['classify-defect'],
            inputs: [types_1.InputType.SPECIFICATIONS],
            outputs: [types_1.OutputType.TEST_SUITE],
            executionTimeoutMs: 1800000,
            retryAttempts: 3,
            branchStrategy: {
                pattern: 'test/{workItemId}-repro',
                baseRef: 'bugfix/{workItemId}',
                mergeTarget: 'bugfix/{workItemId}',
                autoDelete: true
            }
        });
        // Add more nodes for defect resolution...
        const edges = [
            { from: 'classify-defect', to: 'reproduce-issue', priority: 1 }
            // Add more edges...
        ];
        return {
            id: 'defect-resolution-v1',
            name: 'Defect Resolution Workflow',
            flowType: types_1.FlowType.DEFECT_RESOLUTION,
            nodes,
            edges,
            entryPoints: ['classify-defect'],
            mergePoints: ['reproduce-issue'],
            exitPoints: ['commit-changes'],
            backtrackRules: []
        };
    }
    static createTechDebtWorkflow() {
        // Tech debt reduction workflow implementation
        const nodes = new Map();
        // Implementation details...
        return {
            id: 'tech-debt-v1',
            name: 'Tech Debt Reduction Workflow',
            flowType: types_1.FlowType.TECH_DEBT_REDUCTION,
            nodes,
            edges: [],
            entryPoints: [],
            mergePoints: [],
            exitPoints: [],
            backtrackRules: []
        };
    }
    static createHotfixWorkflow() {
        // Hotfix workflow for critical issues
        const nodes = new Map();
        // Streamlined hotfix process...
        return {
            id: 'hotfix-v1',
            name: 'Hotfix Workflow',
            flowType: types_1.FlowType.HOTFIX,
            nodes,
            edges: [],
            entryPoints: [],
            mergePoints: [],
            exitPoints: [],
            backtrackRules: []
        };
    }
    static getAllWorkflows() {
        return [
            this?.createFeatureDevelopmentWorkflow(),
            this?.createDefectResolutionWorkflow(),
            this?.createTechDebtWorkflow(),
            this?.createHotfixWorkflow()
        ];
    }
}
exports.WorkflowDefinitions = WorkflowDefinitions;
//# sourceMappingURL=workflow-definitions.js.map