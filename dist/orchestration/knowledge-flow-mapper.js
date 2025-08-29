"use strict";
// Knowledge Flow Mapping for Each Workflow Step
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeFlowMapper = exports.RoleType = void 0;
const types_1 = require("./types");
Object.defineProperty(exports, "RoleType", { enumerable: true, get: function () { return types_1.RoleType; } });
class KnowledgeFlowMapper {
    static getCompleteWorkflowKnowledgeFlow() {
        const flowMap = new Map();
        // Map each role to its knowledge flow
        flowMap?.set(types_1.RoleType.WORK_CLASSIFIER, this?.getWorkClassifierFlow());
        flowMap?.set(types_1.RoleType.REQUIREMENT_ANALYST, this?.getRequirementAnalystFlow());
        flowMap?.set(types_1.RoleType.TEST_DESIGNER, this?.getTestDesignerFlow());
        flowMap?.set(types_1.RoleType.IMPLEMENTATION_DEVELOPER, this?.getImplementationDeveloperFlow());
        flowMap?.set(types_1.RoleType.CODE_REVIEWER, this?.getCodeReviewerFlow());
        flowMap?.set(types_1.RoleType.COMPILER_BUILDER, this?.getCompilerBuilderFlow());
        flowMap?.set(types_1.RoleType.SECURITY_AUDITOR, this?.getSecurityAuditorFlow());
        flowMap?.set(types_1.RoleType.PERFORMANCE_AUDITOR, this?.getPerformanceAuditorFlow());
        flowMap?.set(types_1.RoleType.QUALITY_AUDITOR, this?.getQualityAuditorFlow());
        flowMap?.set(types_1.RoleType.DEVOPS_ENGINEER, this?.getDevOpsEngineerFlow());
        flowMap?.set(types_1.RoleType.DEPLOYER, this?.getDeployerFlow());
        flowMap?.set(types_1.RoleType.UNIT_TEST_EXECUTOR, this?.getUnitTestExecutorFlow());
        flowMap?.set(types_1.RoleType.INTEGRATION_TEST_ENGINEER, this?.getIntegrationTestEngineerFlow());
        flowMap?.set(types_1.RoleType.E2E_TEST_ENGINEER, this?.getE2ETestEngineerFlow());
        flowMap?.set(types_1.RoleType.TECHNICAL_DOCUMENTER, this?.getTechnicalDocumenterFlow());
        flowMap?.set(types_1.RoleType.USER_DOCUMENTER, this?.getUserDocumenterFlow());
        flowMap?.set(types_1.RoleType.RELEASE_MANAGER, this?.getReleaseManagerFlow());
        flowMap?.set(types_1.RoleType.COMMITTER, this?.getCommitterFlow());
        flowMap?.set(types_1.RoleType.ORCHESTRATOR, this?.getOrchestratorFlow());
        return flowMap;
    }
    static getWorkClassifierFlow() {
        return {
            stepId: 'work-classification',
            roleType: types_1.RoleType.WORK_CLASSIFIER,
            stepName: 'Work Item Classification and Prioritization',
            knowledgeInputs: [
                {
                    type: 'historical',
                    source: 'Previous work classifications and outcomes',
                    priority: 'high',
                    usage: 'Pattern matching for similar work items',
                    examples: ['Similar feature requests', 'Comparable bug reports', 'Related technical debt']
                },
                {
                    type: 'project',
                    source: 'Current project phase, objectives, and constraints',
                    priority: 'critical',
                    usage: 'Align classification with strategic goals',
                    examples: ['Phase 3 objectives', 'Resource constraints', 'Quality targets']
                },
                {
                    type: 'domain',
                    source: 'Industry standards for work categorization',
                    priority: 'medium',
                    usage: 'Apply best practices for work classification',
                    examples: ['Agile story sizing', 'Risk assessment frameworks', 'Priority matrices']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Pattern Recognition',
                    description: 'Compare incoming work with historical patterns',
                    knowledgeSources: ['Historical outcomes', 'Similar work items'],
                    outputGenerated: 'Work type classification with confidence score',
                    qualityCheck: 'Confidence > 0.8 or escalate to human review'
                },
                {
                    process: 'Complexity Assessment',
                    description: 'Analyze work complexity based on similar items',
                    knowledgeSources: ['Historical complexity data', 'Domain knowledge'],
                    outputGenerated: 'Complexity rating and effort estimation',
                    qualityCheck: 'Complexity aligns with historical patterns'
                },
                {
                    process: 'Priority Scoring',
                    description: 'Score priority based on project objectives and business value',
                    knowledgeSources: ['Project objectives', 'Business impact data'],
                    outputGenerated: 'Priority score with business justification',
                    qualityCheck: 'Priority aligns with strategic objectives'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'outcome',
                    description: 'Classified work item with type, priority, complexity, and estimated effort',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR, types_1.RoleType.REQUIREMENT_ANALYST],
                    updateMechanism: 'Direct output to next roles',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'learning',
                    description: 'Classification patterns and accuracy metrics',
                    beneficiaries: [types_1.RoleType.WORK_CLASSIFIER, types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Update learning database',
                    persistenceLevel: 'permanent'
                },
                {
                    type: 'metric',
                    description: 'Classification confidence and accuracy scores',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Real-time metrics update',
                    persistenceLevel: 'project'
                }
            ],
            feedbackLoops: [
                {
                    from: 'Classification output',
                    to: 'Historical database',
                    dataType: 'Classification accuracy',
                    trigger: 'Work completion',
                    updateFrequency: 'step'
                }
            ],
            qualityGates: [
                {
                    name: 'Classification Confidence',
                    criteria: 'Confidence score > 0.8',
                    threshold: 0.8,
                    action: 'block',
                    fallbackStrategy: 'Escalate to human classifier or gather more context'
                }
            ]
        };
    }
    static getRequirementAnalystFlow() {
        return {
            stepId: 'requirement-analysis',
            roleType: types_1.RoleType.REQUIREMENT_ANALYST,
            stepName: 'Requirements Analysis and Specification',
            knowledgeInputs: [
                {
                    type: 'triads',
                    source: 'Code relationships and dependencies from knowledge graph',
                    priority: 'critical',
                    usage: 'Understand existing system architecture and dependencies',
                    examples: ['Class relationships', 'Module dependencies', 'API contracts']
                },
                {
                    type: 'rag',
                    source: 'Best practices for requirements analysis',
                    priority: 'high',
                    usage: 'Apply industry-standard requirement gathering techniques',
                    examples: ['User story templates', 'Acceptance criteria patterns', 'Stakeholder analysis']
                },
                {
                    type: 'historical',
                    source: 'Previous requirement analysis outcomes and learnings',
                    priority: 'high',
                    usage: 'Avoid past mistakes and reuse successful patterns',
                    examples: ['Well-specified requirements', 'Common requirement gaps', 'Stakeholder feedback patterns']
                },
                {
                    type: 'project',
                    source: 'Current project objectives and constraints',
                    priority: 'critical',
                    usage: 'Ensure requirements align with project goals',
                    examples: ['Project vision', 'Budget constraints', 'Timeline requirements']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Requirement Decomposition',
                    description: 'Break down high-level requirements into specific, testable requirements',
                    knowledgeSources: ['RAG best practices', 'Historical decomposition patterns'],
                    outputGenerated: 'Detailed requirements with acceptance criteria',
                    qualityCheck: 'Each requirement is specific, measurable, and testable'
                },
                {
                    process: 'Dependency Analysis',
                    description: 'Identify system dependencies and integration points',
                    knowledgeSources: ['Code triads', 'Architecture patterns'],
                    outputGenerated: 'Dependency map with integration requirements',
                    qualityCheck: 'All dependencies identified and integration points specified'
                },
                {
                    process: 'Risk Assessment',
                    description: 'Identify potential risks in requirements implementation',
                    knowledgeSources: ['Historical issues', 'Project risk factors'],
                    outputGenerated: 'Risk register with mitigation strategies',
                    qualityCheck: 'High and critical risks have mitigation plans'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'outcome',
                    description: 'Comprehensive requirements specification with acceptance criteria',
                    beneficiaries: [types_1.RoleType.TEST_DESIGNER, types_1.RoleType.IMPLEMENTATION_DEVELOPER],
                    updateMechanism: 'Structured requirements document',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'insight',
                    description: 'Requirements complexity analysis and risk assessment',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Risk and complexity reports',
                    persistenceLevel: 'project'
                },
                {
                    type: 'learning',
                    description: 'Requirement analysis patterns and stakeholder feedback',
                    beneficiaries: [types_1.RoleType.REQUIREMENT_ANALYST],
                    updateMechanism: 'Learning database update',
                    persistenceLevel: 'permanent'
                }
            ],
            feedbackLoops: [
                {
                    from: 'Implementation feedback',
                    to: 'Requirements database',
                    dataType: 'Requirements clarity and completeness scores',
                    trigger: 'Implementation completion',
                    updateFrequency: 'phase'
                },
                {
                    from: 'Testing feedback',
                    to: 'Acceptance criteria patterns',
                    dataType: 'Testability and coverage metrics',
                    trigger: 'Test completion',
                    updateFrequency: 'step'
                }
            ],
            qualityGates: [
                {
                    name: 'Requirements Completeness',
                    criteria: 'All user stories have acceptance criteria',
                    threshold: 1.0,
                    action: 'block',
                    fallbackStrategy: 'Generate missing acceptance criteria using RAG patterns'
                },
                {
                    name: 'Stakeholder Alignment',
                    criteria: 'Requirements align with project objectives',
                    threshold: 0.9,
                    action: 'warn',
                    fallbackStrategy: 'Flag misalignment for orchestrator review'
                }
            ]
        };
    }
    static getTestDesignerFlow() {
        return {
            stepId: 'test-design',
            roleType: types_1.RoleType.TEST_DESIGNER,
            stepName: 'Test Suite Design and TDD Implementation',
            knowledgeInputs: [
                {
                    type: 'triads',
                    source: 'Existing test patterns and coverage gaps',
                    priority: 'critical',
                    usage: 'Identify untested code paths and reusable test patterns',
                    examples: ['Test coverage relationships', 'Mock patterns', 'Test data dependencies']
                },
                {
                    type: 'rag',
                    source: 'Testing best practices and TDD methodology',
                    priority: 'high',
                    usage: 'Apply proven testing strategies and patterns',
                    examples: ['Test pyramid principles', 'Given-When-Then patterns', 'Test data generation']
                },
                {
                    type: 'historical',
                    source: 'Previous test effectiveness and bug detection rates',
                    priority: 'high',
                    usage: 'Learn from past test suite performance',
                    examples: ['High-impact test cases', 'Common bug patterns', 'Test maintenance costs']
                },
                {
                    type: 'peers',
                    source: 'Requirements specification from analyst',
                    priority: 'critical',
                    usage: 'Design tests that validate all requirements',
                    examples: ['Acceptance criteria', 'User stories', 'Business rules']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Test Coverage Analysis',
                    description: 'Analyze requirements and existing code to identify test coverage needs',
                    knowledgeSources: ['Requirements', 'Code triads', 'Coverage gaps'],
                    outputGenerated: 'Comprehensive test coverage plan',
                    qualityCheck: 'Coverage plan addresses all requirements and critical paths'
                },
                {
                    process: 'Test Strategy Selection',
                    description: 'Select appropriate testing strategies based on risk and complexity',
                    knowledgeSources: ['RAG testing practices', 'Historical effectiveness'],
                    outputGenerated: 'Test strategy document with rationale',
                    qualityCheck: 'Strategy aligns with project risk profile and constraints'
                },
                {
                    process: 'Test Case Generation',
                    description: 'Generate specific test cases following TDD principles',
                    knowledgeSources: ['Requirements', 'Test patterns', 'Edge case patterns'],
                    outputGenerated: 'Detailed test cases with expected outcomes',
                    qualityCheck: 'Test cases are specific, executable, and cover edge cases'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'outcome',
                    description: 'Complete test suite ready for TDD implementation',
                    beneficiaries: [types_1.RoleType.IMPLEMENTATION_DEVELOPER, types_1.RoleType.UNIT_TEST_EXECUTOR],
                    updateMechanism: 'Test specification documents and code stubs',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'metric',
                    description: 'Test coverage metrics and risk assessment',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR, types_1.RoleType.QUALITY_AUDITOR],
                    updateMechanism: 'Test metrics dashboard',
                    persistenceLevel: 'project'
                },
                {
                    type: 'learning',
                    description: 'Effective test patterns and design decisions',
                    beneficiaries: [types_1.RoleType.TEST_DESIGNER],
                    updateMechanism: 'Test pattern library update',
                    persistenceLevel: 'permanent'
                }
            ],
            feedbackLoops: [
                {
                    from: 'Test execution results',
                    to: 'Test effectiveness database',
                    dataType: 'Bug detection rates and false positive rates',
                    trigger: 'Test execution',
                    updateFrequency: 'realtime'
                },
                {
                    from: 'Implementation feedback',
                    to: 'Test design patterns',
                    dataType: 'Test maintainability and clarity scores',
                    trigger: 'Implementation completion',
                    updateFrequency: 'step'
                }
            ],
            qualityGates: [
                {
                    name: 'Test Coverage Threshold',
                    criteria: 'Test coverage plan covers > 90% of requirements',
                    threshold: 0.9,
                    action: 'block',
                    fallbackStrategy: 'Generate additional test cases for uncovered requirements'
                },
                {
                    name: 'Test Quality Score',
                    criteria: 'Tests follow TDD best practices',
                    threshold: 0.85,
                    action: 'warn',
                    fallbackStrategy: 'Refactor tests to improve quality and maintainability'
                }
            ]
        };
    }
    static getImplementationDeveloperFlow() {
        return {
            stepId: 'implementation',
            roleType: types_1.RoleType.IMPLEMENTATION_DEVELOPER,
            stepName: 'Feature Implementation Following TDD',
            knowledgeInputs: [
                {
                    type: 'triads',
                    source: 'Codebase architecture, patterns, and dependencies',
                    priority: 'critical',
                    usage: 'Maintain architectural consistency and leverage existing patterns',
                    examples: ['Design patterns in use', 'Dependency injection patterns', 'API contracts']
                },
                {
                    type: 'rag',
                    source: 'Implementation best practices and coding standards',
                    priority: 'high',
                    usage: 'Follow proven implementation patterns and avoid common pitfalls',
                    examples: ['SOLID principles', 'Error handling patterns', 'Performance optimization']
                },
                {
                    type: 'historical',
                    source: 'Previous implementation outcomes and code quality metrics',
                    priority: 'high',
                    usage: 'Learn from past successes and avoid repeated mistakes',
                    examples: ['High-quality implementations', 'Common bug patterns', 'Refactoring needs']
                },
                {
                    type: 'peers',
                    source: 'Requirements specification and test suite',
                    priority: 'critical',
                    usage: 'Implement exactly what is specified and make all tests pass',
                    examples: ['Detailed requirements', 'Failing tests', 'Acceptance criteria']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Architecture Alignment',
                    description: 'Ensure implementation follows existing architectural patterns',
                    knowledgeSources: ['Code triads', 'Architecture patterns'],
                    outputGenerated: 'Implementation plan aligned with architecture',
                    qualityCheck: 'Implementation follows established patterns and principles'
                },
                {
                    process: 'TDD Implementation Cycle',
                    description: 'Implement features following TDD red-green-refactor cycle',
                    knowledgeSources: ['Failing tests', 'Implementation patterns', 'Refactoring guidelines'],
                    outputGenerated: 'Working code that passes all tests',
                    qualityCheck: 'All tests pass and code meets quality standards'
                },
                {
                    process: 'Code Quality Optimization',
                    description: 'Optimize code for readability, maintainability, and performance',
                    knowledgeSources: ['Code quality patterns', 'Performance best practices'],
                    outputGenerated: 'High-quality, optimized code',
                    qualityCheck: 'Code meets quality gates and performance requirements'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'outcome',
                    description: 'Complete, tested implementation of required features',
                    beneficiaries: [types_1.RoleType.CODE_REVIEWER, types_1.RoleType.SECURITY_AUDITOR, types_1.RoleType.PERFORMANCE_AUDITOR],
                    updateMechanism: 'Code repository with comprehensive documentation',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'insight',
                    description: 'Implementation decisions and architectural choices',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR, types_1.RoleType.TECHNICAL_DOCUMENTER],
                    updateMechanism: 'Architecture decision records',
                    persistenceLevel: 'project'
                },
                {
                    type: 'metric',
                    description: 'Code quality metrics and implementation velocity',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR, types_1.RoleType.QUALITY_AUDITOR],
                    updateMechanism: 'Code quality dashboard',
                    persistenceLevel: 'project'
                },
                {
                    type: 'learning',
                    description: 'Effective implementation patterns and solutions',
                    beneficiaries: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
                    updateMechanism: 'Implementation pattern library',
                    persistenceLevel: 'permanent'
                }
            ],
            feedbackLoops: [
                {
                    from: 'Code review feedback',
                    to: 'Implementation quality database',
                    dataType: 'Code quality scores and improvement suggestions',
                    trigger: 'Code review completion',
                    updateFrequency: 'step'
                },
                {
                    from: 'Security audit results',
                    to: 'Security pattern library',
                    dataType: 'Security vulnerabilities and fixes',
                    trigger: 'Security audit completion',
                    updateFrequency: 'step'
                },
                {
                    from: 'Performance audit results',
                    to: 'Performance optimization patterns',
                    dataType: 'Performance bottlenecks and optimizations',
                    trigger: 'Performance audit completion',
                    updateFrequency: 'step'
                }
            ],
            qualityGates: [
                {
                    name: 'Test Success Rate',
                    criteria: '100% of tests pass',
                    threshold: 1.0,
                    action: 'block',
                    fallbackStrategy: 'Fix failing tests before proceeding'
                },
                {
                    name: 'Code Quality Score',
                    criteria: 'Code quality metrics meet standards',
                    threshold: 0.85,
                    action: 'warn',
                    fallbackStrategy: 'Refactor code to improve quality metrics'
                },
                {
                    name: 'Architecture Compliance',
                    criteria: 'Implementation follows architectural patterns',
                    threshold: 0.9,
                    action: 'block',
                    fallbackStrategy: 'Redesign implementation to align with architecture'
                }
            ]
        };
    }
    static getSecurityAuditorFlow() {
        return {
            stepId: 'security-audit',
            roleType: types_1.RoleType.SECURITY_AUDITOR,
            stepName: 'Comprehensive Security Assessment',
            knowledgeInputs: [
                {
                    type: 'triads',
                    source: 'Security-related code relationships and data flows',
                    priority: 'critical',
                    usage: 'Identify security-sensitive code paths and potential attack vectors',
                    examples: ['Authentication flows', 'Data access patterns', 'Input validation chains']
                },
                {
                    type: 'rag',
                    source: 'Latest security best practices and vulnerability databases',
                    priority: 'critical',
                    usage: 'Apply current security standards and identify known vulnerabilities',
                    examples: ['OWASP Top 10', 'CVE databases', 'Security compliance frameworks']
                },
                {
                    type: 'historical',
                    source: 'Previous security audits and vulnerability patterns',
                    priority: 'high',
                    usage: 'Learn from past security issues and apply proven fixes',
                    examples: ['Common vulnerabilities', 'Effective security controls', 'False positive patterns']
                },
                {
                    type: 'domain',
                    source: 'Industry-specific security requirements and standards',
                    priority: 'high',
                    usage: 'Ensure compliance with relevant security standards',
                    examples: ['PCI DSS', 'GDPR', 'SOC 2', 'Industry-specific regulations']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Threat Modeling',
                    description: 'Identify potential threats and attack vectors',
                    knowledgeSources: ['Code relationships', 'Data flow analysis', 'Threat databases'],
                    outputGenerated: 'Comprehensive threat model with risk ratings',
                    qualityCheck: 'All critical attack vectors identified and assessed'
                },
                {
                    process: 'Vulnerability Assessment',
                    description: 'Scan for known vulnerabilities and security weaknesses',
                    knowledgeSources: ['Vulnerability databases', 'Security patterns', 'Code analysis'],
                    outputGenerated: 'Detailed vulnerability report with severity ratings',
                    qualityCheck: 'All high and critical vulnerabilities identified'
                },
                {
                    process: 'Security Control Verification',
                    description: 'Verify implementation of security controls and best practices',
                    knowledgeSources: ['Security standards', 'Best practice guidelines'],
                    outputGenerated: 'Security control assessment with compliance status',
                    qualityCheck: 'All required security controls properly implemented'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'outcome',
                    description: 'Comprehensive security assessment with risk ratings and remediation plans',
                    beneficiaries: [types_1.RoleType.IMPLEMENTATION_DEVELOPER, types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Security assessment report with actionable recommendations',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'metric',
                    description: 'Security scores and vulnerability metrics',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR, types_1.RoleType.QUALITY_AUDITOR],
                    updateMechanism: 'Security dashboard with trend analysis',
                    persistenceLevel: 'project'
                },
                {
                    type: 'learning',
                    description: 'New security threats and effective countermeasures',
                    beneficiaries: [types_1.RoleType.SECURITY_AUDITOR, types_1.RoleType.IMPLEMENTATION_DEVELOPER],
                    updateMechanism: 'Security knowledge base update',
                    persistenceLevel: 'permanent'
                }
            ],
            feedbackLoops: [
                {
                    from: 'Vulnerability remediation results',
                    to: 'Security effectiveness database',
                    dataType: 'Fix effectiveness and time-to-remediation',
                    trigger: 'Vulnerability fix completion',
                    updateFrequency: 'realtime'
                },
                {
                    from: 'Security incident data',
                    to: 'Threat intelligence database',
                    dataType: 'New attack patterns and indicators',
                    trigger: 'Security incident',
                    updateFrequency: 'realtime'
                }
            ],
            qualityGates: [
                {
                    name: 'Critical Vulnerability Count',
                    criteria: 'Zero critical vulnerabilities',
                    threshold: 0,
                    action: 'block',
                    fallbackStrategy: 'Must fix all critical vulnerabilities before proceeding'
                },
                {
                    name: 'Security Score Threshold',
                    criteria: 'Security score > 90%',
                    threshold: 0.9,
                    action: 'block',
                    fallbackStrategy: 'Improve security controls to meet threshold'
                }
            ]
        };
    }
    // Continue with other roles...
    static getOrchestratorFlow() {
        return {
            stepId: 'orchestration',
            roleType: types_1.RoleType.ORCHESTRATOR,
            stepName: 'Workflow Orchestration and Strategic Decision Making',
            knowledgeInputs: [
                {
                    type: 'project',
                    source: 'Complete project status, objectives, and strategic context',
                    priority: 'critical',
                    usage: 'Make informed decisions about workflow direction and priorities',
                    examples: ['Project phase status', 'Strategic objectives', 'Resource constraints']
                },
                {
                    type: 'peers',
                    source: 'All role outcomes, metrics, and insights',
                    priority: 'critical',
                    usage: 'Synthesize information across all roles for holistic decision making',
                    examples: ['Quality scores', 'Risk assessments', 'Performance metrics']
                },
                {
                    type: 'historical',
                    source: 'Previous orchestration decisions and their outcomes',
                    priority: 'high',
                    usage: 'Learn from past orchestration patterns and improve decision quality',
                    examples: ['Successful workflow patterns', 'Decision effectiveness', 'Resource optimization']
                },
                {
                    type: 'rag',
                    source: 'Best practices for project orchestration and management',
                    priority: 'medium',
                    usage: 'Apply proven orchestration strategies and methodologies',
                    examples: ['Agile methodologies', 'Risk management', 'Resource allocation']
                }
            ],
            knowledgeProcessing: [
                {
                    process: 'Holistic Status Analysis',
                    description: 'Synthesize information from all roles to assess overall project health',
                    knowledgeSources: ['All role outcomes', 'Project metrics', 'Quality indicators'],
                    outputGenerated: 'Comprehensive project status with risk assessment',
                    qualityCheck: 'Status accurately reflects input from all roles'
                },
                {
                    process: 'Strategic Decision Making',
                    description: 'Make informed decisions about workflow priorities and resource allocation',
                    knowledgeSources: ['Strategic context', 'Resource constraints', 'Risk factors'],
                    outputGenerated: 'Strategic decisions with clear rationale',
                    qualityCheck: 'Decisions align with project objectives and constraints'
                },
                {
                    process: 'Workflow Optimization',
                    description: 'Optimize workflow based on performance metrics and bottlenecks',
                    knowledgeSources: ['Performance data', 'Historical patterns', 'Best practices'],
                    outputGenerated: 'Workflow adjustments and optimizations',
                    qualityCheck: 'Optimizations address identified bottlenecks and inefficiencies'
                }
            ],
            knowledgeOutputs: [
                {
                    type: 'summary',
                    description: 'Comprehensive project status summary with strategic insights',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Executive dashboard and strategic reports',
                    persistenceLevel: 'project'
                },
                {
                    type: 'decision',
                    description: 'Strategic decisions and workflow adjustments',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Decision log and workflow configuration updates',
                    persistenceLevel: 'execution'
                },
                {
                    type: 'learning',
                    description: 'Orchestration patterns and decision effectiveness',
                    beneficiaries: [types_1.RoleType.ORCHESTRATOR],
                    updateMechanism: 'Orchestration knowledge base',
                    persistenceLevel: 'permanent'
                }
            ],
            feedbackLoops: [
                {
                    from: 'All role outcomes',
                    to: 'Orchestration effectiveness database',
                    dataType: 'Decision outcomes and workflow performance',
                    trigger: 'Workflow completion',
                    updateFrequency: 'phase'
                },
                {
                    from: 'Strategic conversations',
                    to: 'Strategic insight database',
                    dataType: 'Strategic insights and direction changes',
                    trigger: 'Strategic decision',
                    updateFrequency: 'milestone'
                }
            ],
            qualityGates: [
                {
                    name: 'Decision Confidence',
                    criteria: 'Strategic decisions have confidence > 80%',
                    threshold: 0.8,
                    action: 'warn',
                    fallbackStrategy: 'Gather additional information or escalate to strategic conversation'
                },
                {
                    name: 'Project Health Score',
                    criteria: 'Overall project health > 75%',
                    threshold: 0.75,
                    action: 'warn',
                    fallbackStrategy: 'Identify and address critical issues affecting project health'
                }
            ]
        };
    }
    // Placeholder implementations for other roles (would be similar detailed flows)
    static getCodeReviewerFlow() {
        return {
            stepId: 'code-review',
            roleType: types_1.RoleType.CODE_REVIEWER,
            stepName: 'Code Quality Review and Feedback',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getCompilerBuilderFlow() {
        return {
            stepId: 'build-compilation',
            roleType: types_1.RoleType.COMPILER_BUILDER,
            stepName: 'Build and Compilation Process',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getPerformanceAuditorFlow() {
        return {
            stepId: 'performance-audit',
            roleType: types_1.RoleType.PERFORMANCE_AUDITOR,
            stepName: 'Performance Analysis and Optimization',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getQualityAuditorFlow() {
        return {
            stepId: 'quality-audit',
            roleType: types_1.RoleType.QUALITY_AUDITOR,
            stepName: 'Code Quality Assessment',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getDevOpsEngineerFlow() {
        return {
            stepId: 'devops-setup',
            roleType: types_1.RoleType.DEVOPS_ENGINEER,
            stepName: 'DevOps Pipeline Configuration',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getDeployerFlow() {
        return {
            stepId: 'deployment',
            roleType: types_1.RoleType.DEPLOYER,
            stepName: 'Application Deployment',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getUnitTestExecutorFlow() {
        return {
            stepId: 'unit-testing',
            roleType: types_1.RoleType.UNIT_TEST_EXECUTOR,
            stepName: 'Unit Test Execution',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getIntegrationTestEngineerFlow() {
        return {
            stepId: 'integration-testing',
            roleType: types_1.RoleType.INTEGRATION_TEST_ENGINEER,
            stepName: 'Integration Testing',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getE2ETestEngineerFlow() {
        return {
            stepId: 'e2e-testing',
            roleType: types_1.RoleType.E2E_TEST_ENGINEER,
            stepName: 'End-to-End Testing',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getTechnicalDocumenterFlow() {
        return {
            stepId: 'technical-documentation',
            roleType: types_1.RoleType.TECHNICAL_DOCUMENTER,
            stepName: 'Technical Documentation',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getUserDocumenterFlow() {
        return {
            stepId: 'user-documentation',
            roleType: types_1.RoleType.USER_DOCUMENTER,
            stepName: 'User Documentation',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getReleaseManagerFlow() {
        return {
            stepId: 'release-management',
            roleType: types_1.RoleType.RELEASE_MANAGER,
            stepName: 'Release Preparation and Management',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    static getCommitterFlow() {
        return {
            stepId: 'commit-management',
            roleType: types_1.RoleType.COMMITTER,
            stepName: 'Version Control and Commit Management',
            knowledgeInputs: [],
            knowledgeProcessing: [],
            knowledgeOutputs: [],
            feedbackLoops: [],
            qualityGates: []
        };
    }
    // Utility methods for flow analysis
    static analyzeKnowledgeFlow(flow) {
        const analysis = {
            totalRoles: flow.size,
            knowledgeInputTypes: new Set(),
            outputTypes: new Set(),
            feedbackLoops: 0,
            qualityGates: 0,
            criticalPaths: []
        };
        flow?.forEach((step, roleType) => {
            step.knowledgeInputs?.forEach(input => analysis.knowledgeInputTypes?.add(input.type));
            step.knowledgeOutputs?.forEach(output => analysis.outputTypes?.add(output.type));
            if (analysis)
                analysis.feedbackLoops += step.feedbackLoops?.length || 0;
            if (analysis)
                analysis.qualityGates += step.qualityGates?.length || 0;
        });
        return analysis;
    }
    static generateFlowDiagram(flow) {
        let diagram = 'Knowledge Flow Diagram:\n\n';
        flow?.forEach((step, roleType) => {
            diagram += `${roleType}:\n`;
            diagram += `  Inputs: ${step.knowledgeInputs?.map(i => i.type).join(', ')}\n`;
            diagram += `  Outputs: ${step.knowledgeOutputs?.map(o => o.type).join(', ')}\n`;
            diagram += `  Quality Gates: ${step.qualityGates?.length}\n\n`;
        });
        return diagram;
    }
}
exports.KnowledgeFlowMapper = KnowledgeFlowMapper;
//# sourceMappingURL=knowledge-flow-mapper.js.map