// Predefined Workflow DAG Definitions

import {
  WorkflowDAG,
  WorkflowNode,
  WorkflowEdge,
  RoleType,
  FlowType,
  QualityGateType,
  QualityMetric,
  BacktrackTrigger,
  InputType,
  OutputType,
  ContextType
} from './types';

export class WorkflowDefinitions {
  
  static createFeatureDevelopmentWorkflow(): WorkflowDAG {
    const nodes = new Map<string, WorkflowNode>();
    
    // Entry Point: Work Classification
    nodes?.set('classify-work', {
      id: 'classify-work',
      roleType: RoleType.WORK_CLASSIFIER,
      name: 'Classify Feature Request',
      description: 'Analyze and classify the feature request',
      dependencies: [],
      inputs: [InputType.REQUIREMENTS],
      outputs: [OutputType.SPECIFICATIONS],
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
      roleType: RoleType.REQUIREMENT_ANALYST,
      name: 'Analyze Requirements',
      description: 'Break down requirements into detailed specifications',
      dependencies: ['classify-work'],
      parallelWith: ['estimate-complexity'],
      inputs: [InputType.REQUIREMENTS],
      outputs: [OutputType.SPECIFICATIONS],
      executionTimeoutMs: 1800000, // 30 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'requirements-complete',
        name: 'Requirements Completeness Gate',
        type: QualityGateType.REQUIREMENTS_GATE,
        criteria: [
          { metric: QualityMetric.TEST_SUCCESS_RATE, operator: 'GTE', threshold: 0.95, weight: 1.0 }
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
      roleType: RoleType.TEST_DESIGNER,
      name: 'Design Test Suite',
      description: 'Create comprehensive test suite following TDD principles',
      dependencies: ['analyze-requirements'],
      inputs: [InputType.SPECIFICATIONS],
      outputs: [OutputType.TEST_SUITE],
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
      roleType: RoleType.IMPLEMENTATION_DEVELOPER,
      name: 'Implement Feature',
      description: 'Implement feature to make all tests pass',
      dependencies: ['design-tests'],
      inputs: [InputType.SPECIFICATIONS, InputType.TEST_SUITE],
      outputs: [OutputType.IMPLEMENTED_CODE],
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
      roleType: RoleType.CODE_REVIEWER,
      name: 'Code Review',
      description: 'Comprehensive code review and feedback',
      dependencies: ['implement-feature'],
      inputs: [InputType.IMPLEMENTED_CODE],
      outputs: [OutputType.QUALITY_SCORES],
      executionTimeoutMs: 1800000, // 30 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'code-review-gate',
        name: 'Code Review Gate',
        type: QualityGateType.IMPLEMENTATION_GATE,
        criteria: [
          { metric: QualityMetric.SOLID_COMPLIANCE, operator: 'GTE', threshold: 0.85, weight: 0.4 },
          { metric: QualityMetric.DUPLICATION_PERCENTAGE, operator: 'LTE', threshold: 0.05, weight: 0.3 },
          { metric: QualityMetric.CYCLOMATIC_COMPLEXITY, operator: 'LTE', threshold: 10, weight: 0.3 }
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
      roleType: RoleType.COMPILER_BUILDER,
      name: 'Build Artifacts',
      description: 'Compile and build application artifacts',
      dependencies: ['review-code'],
      inputs: [InputType.IMPLEMENTED_CODE],
      outputs: [OutputType.BUILD_ARTIFACTS],
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
      roleType: RoleType.SECURITY_AUDITOR,
      name: 'Security Audit',
      description: 'Comprehensive security vulnerability assessment',
      dependencies: ['build-artifact'],
      parallelWith: ['performance-audit', 'quality-audit'],
      inputs: [InputType.IMPLEMENTED_CODE, InputType.BUILD_ARTIFACTS],
      outputs: [OutputType.SECURITY_ASSESSMENT],
      executionTimeoutMs: 1800000, // 30 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'security-gate',
        name: 'Security Gate',
        type: QualityGateType.QUALITY_GATE,
        criteria: [
          { metric: QualityMetric.SECURITY_SCORE, operator: 'GTE', threshold: 0.90, weight: 0.6 },
          { metric: QualityMetric.CRITICAL_VULNERABILITIES, operator: 'EQ', threshold: 0, weight: 0.4 }
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
      roleType: RoleType.PERFORMANCE_AUDITOR,
      name: 'Performance Audit',
      description: 'Performance testing and optimization analysis',
      dependencies: ['build-artifact'],
      parallelWith: ['security-audit', 'quality-audit'],
      inputs: [InputType.BUILD_ARTIFACTS],
      outputs: [OutputType.PERFORMANCE_ANALYSIS],
      executionTimeoutMs: 2400000, // 40 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'performance-gate',
        name: 'Performance Gate',
        type: QualityGateType.QUALITY_GATE,
        criteria: [
          { metric: QualityMetric.RESPONSE_TIME, operator: 'LTE', threshold: 2000, weight: 0.4 }, // 2s
          { metric: QualityMetric.MEMORY_USAGE, operator: 'LTE', threshold: 0.80, weight: 0.3 }, // 80%
          { metric: QualityMetric.CPU_UTILIZATION, operator: 'LTE', threshold: 0.70, weight: 0.3 } // 70%
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
      roleType: RoleType.QUALITY_AUDITOR,
      name: 'Quality Audit',
      description: 'Comprehensive code quality and architecture audit',
      dependencies: ['build-artifact'],
      parallelWith: ['security-audit', 'performance-audit'],
      inputs: [InputType.IMPLEMENTED_CODE, InputType.BUILD_ARTIFACTS],
      outputs: [OutputType.QUALITY_SCORES],
      executionTimeoutMs: 1800000, // 30 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'quality-gate',
        name: 'Quality Gate',
        type: QualityGateType.QUALITY_GATE,
        criteria: [
          { metric: QualityMetric.CODE_COVERAGE, operator: 'GTE', threshold: 0.85, weight: 0.25 },
          { metric: QualityMetric.SOLID_COMPLIANCE, operator: 'GTE', threshold: 0.90, weight: 0.25 },
          { metric: QualityMetric.DUPLICATION_PERCENTAGE, operator: 'LTE', threshold: 0.03, weight: 0.25 },
          { metric: QualityMetric.CYCLOMATIC_COMPLEXITY, operator: 'LTE', threshold: 8, weight: 0.25 }
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
      roleType: RoleType.DEVOPS_ENGINEER,
      name: 'DevOps Setup',
      description: 'Setup deployment pipeline and infrastructure',
      dependencies: ['security-audit', 'performance-audit', 'quality-audit'],
      inputs: [InputType.BUILD_ARTIFACTS, InputType.DEPLOYMENT_CONFIG],
      outputs: [OutputType.DEPLOYMENT_PACKAGE],
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
      roleType: RoleType.DEPLOYER,
      name: 'Deploy to Staging',
      description: 'Deploy to staging environment',
      dependencies: ['devops-setup'],
      inputs: [InputType.DEPLOYMENT_PACKAGE],
      outputs: [OutputType.DEPLOYMENT_PACKAGE],
      executionTimeoutMs: 1200000, // 20 minutes
      retryAttempts: 3,
      qualityGates: [{
        id: 'deployment-gate',
        name: 'Deployment Gate',
        type: QualityGateType.DEPLOYMENT_GATE,
        criteria: [
          { metric: QualityMetric.TEST_SUCCESS_RATE, operator: 'GTE', threshold: 1.0, weight: 1.0 }
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
      roleType: RoleType.UNIT_TEST_EXECUTOR,
      name: 'Execute Unit Tests',
      description: 'Run comprehensive unit test suite',
      dependencies: ['deploy-staging'],
      parallelWith: ['integration-tests'],
      inputs: [InputType.BUILD_ARTIFACTS],
      outputs: [OutputType.TEST_REPORT],
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
      roleType: RoleType.INTEGRATION_TEST_ENGINEER,
      name: 'Integration Tests',
      description: 'Design and execute integration tests',
      dependencies: ['deploy-staging'],
      parallelWith: ['unit-tests'],
      inputs: [InputType.DEPLOYMENT_PACKAGE],
      outputs: [OutputType.TEST_REPORT],
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
      roleType: RoleType.E2E_TEST_ENGINEER,
      name: 'End-to-End Tests',
      description: 'Execute end-to-end user journey tests',
      dependencies: ['unit-tests', 'integration-tests'],
      inputs: [InputType.DEPLOYMENT_PACKAGE],
      outputs: [OutputType.TEST_REPORT],
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
      roleType: RoleType.TECHNICAL_DOCUMENTER,
      name: 'Technical Documentation',
      description: 'Update technical documentation and API docs',
      dependencies: ['e2e-tests'],
      parallelWith: ['user-docs'],
      inputs: [InputType.IMPLEMENTED_CODE, InputType.SPECIFICATIONS],
      outputs: [OutputType.DOCUMENTATION_UPDATE],
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
      roleType: RoleType.USER_DOCUMENTER,
      name: 'User Documentation',
      description: 'Update user-facing documentation and guides',
      dependencies: ['e2e-tests'],
      parallelWith: ['tech-docs'],
      inputs: [InputType.SPECIFICATIONS, InputType.TEST_REPORT],
      outputs: [OutputType.DOCUMENTATION_UPDATE],
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
      roleType: RoleType.RELEASE_MANAGER,
      name: 'Release Preparation',
      description: 'Prepare release package and changelog',
      dependencies: ['tech-docs', 'user-docs'],
      inputs: [InputType.BUILD_ARTIFACTS, InputType.DOCUMENTATION_UPDATE],
      outputs: [OutputType.DEPLOYMENT_PACKAGE],
      executionTimeoutMs: 1200000, // 20 minutes
      retryAttempts: 2,
      qualityGates: [{
        id: 'release-gate',
        name: 'Release Gate',
        type: QualityGateType.RELEASE_GATE,
        criteria: [
          { metric: QualityMetric.TEST_SUCCESS_RATE, operator: 'EQ', threshold: 1.0, weight: 0.4 },
          { metric: QualityMetric.SECURITY_SCORE, operator: 'GTE', threshold: 0.90, weight: 0.3 },
          { metric: QualityMetric.CODE_COVERAGE, operator: 'GTE', threshold: 0.85, weight: 0.3 }
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
      roleType: RoleType.COMMITTER,
      name: 'Commit Changes',
      description: 'Create meaningful commit and merge to main',
      dependencies: ['release-prep'],
      inputs: [InputType.IMPLEMENTED_CODE, InputType.DOCUMENTATION_UPDATE],
      outputs: [OutputType.COMMIT_MESSAGE],
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
    const edges: WorkflowEdge[] = [
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
      flowType: FlowType.FEATURE_DEVELOPMENT,
      nodes,
      edges,
      entryPoints: ['classify-work'],
      mergePoints: ['analyze-requirements', 'devops-setup', 'e2e-tests', 'release-prep'],
      exitPoints: ['commit-changes'],
      backtrackRules: [
        {
          id: 'test-failure-backtrack',
          trigger: BacktrackTrigger.TEST_FAILURE,
          targetNode: 'implement-feature',
          condition: 'testSuccessRate < 0.95',
          priority: 1,
          includeContext: [ContextType.TEST_FAILURES, ContextType.ERROR_LOGS],
          maxBacktrackCount: 3
        },
        {
          id: 'build-failure-backtrack',
          trigger: BacktrackTrigger.BUILD_FAILURE,
          targetNode: 'implement-feature',
          condition: 'buildStatus === "FAILED"',
          priority: 1,
          includeContext: [ContextType.ERROR_LOGS, ContextType.DEPENDENCY_CONFLICTS],
          maxBacktrackCount: 2
        },
        {
          id: 'quality-gate-backtrack',
          trigger: BacktrackTrigger.QUALITY_GATE_FAILURE,
          targetNode: 'implement-feature',
          condition: 'qualityScore < qualityThreshold',
          priority: 2,
          includeContext: [ContextType.QUALITY_ISSUES, ContextType.ARCHITECTURAL_VIOLATIONS],
          maxBacktrackCount: 2
        },
        {
          id: 'security-violation-backtrack',
          trigger: BacktrackTrigger.SECURITY_VIOLATION,
          targetNode: 'implement-feature',
          condition: 'securityScore < 0.90 || criticalVulnerabilities > 0',
          priority: 1,
          includeContext: [ContextType.SECURITY_VULNERABILITIES],
          maxBacktrackCount: 1
        }
      ]
    };
  }

  static createDefectResolutionWorkflow(): WorkflowDAG {
    // Simplified defect resolution workflow
    const nodes = new Map<string, WorkflowNode>();

    nodes?.set('classify-defect', {
      id: 'classify-defect',
      roleType: RoleType.WORK_CLASSIFIER,
      name: 'Classify Defect',
      description: 'Analyze and classify the defect',
      dependencies: [],
      inputs: [InputType.REQUIREMENTS],
      outputs: [OutputType.SPECIFICATIONS],
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
      roleType: RoleType.TEST_DESIGNER,
      name: 'Reproduce Issue',
      description: 'Create test that reproduces the defect',
      dependencies: ['classify-defect'],
      inputs: [InputType.SPECIFICATIONS],
      outputs: [OutputType.TEST_SUITE],
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
    
    const edges: WorkflowEdge[] = [
      { from: 'classify-defect', to: 'reproduce-issue', priority: 1 }
      // Add more edges...
    ];

    return {
      id: 'defect-resolution-v1',
      name: 'Defect Resolution Workflow',
      flowType: FlowType.DEFECT_RESOLUTION,
      nodes,
      edges,
      entryPoints: ['classify-defect'],
      mergePoints: ['reproduce-issue'],
      exitPoints: ['commit-changes'],
      backtrackRules: []
    };
  }

  static createTechDebtWorkflow(): WorkflowDAG {
    // Tech debt reduction workflow implementation
    const nodes = new Map<string, WorkflowNode>();
    
    // Implementation details...
    
    return {
      id: 'tech-debt-v1',
      name: 'Tech Debt Reduction Workflow',
      flowType: FlowType.TECH_DEBT_REDUCTION,
      nodes,
      edges: [],
      entryPoints: [],
      mergePoints: [],
      exitPoints: [],
      backtrackRules: []
    };
  }

  static createHotfixWorkflow(): WorkflowDAG {
    // Hotfix workflow for critical issues
    const nodes = new Map<string, WorkflowNode>();
    
    // Streamlined hotfix process...
    
    return {
      id: 'hotfix-v1',
      name: 'Hotfix Workflow',
      flowType: FlowType.HOTFIX,
      nodes,
      edges: [],
      entryPoints: [],
      mergePoints: [],
      exitPoints: [],
      backtrackRules: []
    };
  }

  static getAllWorkflows(): WorkflowDAG[] {
    return [
      this?.createFeatureDevelopmentWorkflow(),
      this?.createDefectResolutionWorkflow(),
      this?.createTechDebtWorkflow(),
      this?.createHotfixWorkflow()
    ];
  }
}