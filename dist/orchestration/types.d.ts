export interface WorkflowNode {
    id: string;
    roleType: RoleType;
    name: string;
    description: string;
    dependencies: string[];
    parallelWith?: string[];
    inputs: InputType[];
    outputs: OutputType[];
    executionTimeoutMs: number;
    retryAttempts: number;
    qualityGates?: QualityGate[];
    branchStrategy: BranchStrategy;
    optional?: boolean;
}
export interface WorkflowDAG {
    id: string;
    name: string;
    flowType: FlowType;
    nodes: Map<string, WorkflowNode>;
    edges: WorkflowEdge[];
    entryPoints: string[];
    mergePoints: string[];
    exitPoints: string[];
    backtrackRules: BacktrackRule[];
}
export declare enum RoleType {
    ORCHESTRATOR = "ORCHESTRATOR",
    WORK_CLASSIFIER = "WORK_CLASSIFIER",
    REQUIREMENT_ANALYST = "REQUIREMENT_ANALYST",
    TEST_DESIGNER = "TEST_DESIGNER",
    IMPLEMENTATION_DEVELOPER = "IMPLEMENTATION_DEVELOPER",
    CODE_REVIEWER = "CODE_REVIEWER",
    COMPILER_BUILDER = "COMPILER_BUILDER",
    DEVOPS_ENGINEER = "DEVOPS_ENGINEER",
    DEPLOYER = "DEPLOYER",
    UNIT_TEST_EXECUTOR = "UNIT_TEST_EXECUTOR",
    INTEGRATION_TEST_ENGINEER = "INTEGRATION_TEST_ENGINEER",
    E2E_TEST_ENGINEER = "E2E_TEST_ENGINEER",
    SECURITY_AUDITOR = "SECURITY_AUDITOR",
    PERFORMANCE_AUDITOR = "PERFORMANCE_AUDITOR",
    QUALITY_AUDITOR = "QUALITY_AUDITOR",
    TECHNICAL_DOCUMENTER = "TECHNICAL_DOCUMENTER",
    USER_DOCUMENTER = "USER_DOCUMENTER",
    DOCUMENTATION_WRITER = "DOCUMENTATION_WRITER",
    RELEASE_MANAGER = "RELEASE_MANAGER",
    COMMITTER = "COMMITTER"
}
export declare enum FlowType {
    FEATURE_DEVELOPMENT = "FEATURE_DEVELOPMENT",
    DEFECT_RESOLUTION = "DEFECT_RESOLUTION",
    TECH_DEBT_REDUCTION = "TECH_DEBT_REDUCTION",
    HOTFIX = "HOTFIX",
    REFACTORING = "REFACTORING",
    SIMPLE_DEVELOPMENT = "SIMPLE_DEVELOPMENT",
    PROTOTYPE_DEVELOPMENT = "PROTOTYPE_DEVELOPMENT",
    NONFUNCTIONAL_IMPROVEMENTS = "NONFUNCTIONAL_IMPROVEMENTS"
}
export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: EdgeCondition;
    priority: number;
}
export interface EdgeCondition {
    type: 'QUALITY_GATE' | 'SUCCESS' | 'FAILURE' | 'CONDITIONAL';
    criteria?: QualityCriteria;
    expression?: string;
}
export interface QualityGate {
    id: string;
    name: string;
    type: QualityGateType;
    criteria: QualityCriteria[];
    blockingLevel: 'WARNING' | 'ERROR' | 'CRITICAL';
    autoFix: boolean;
}
export declare enum QualityGateType {
    REQUIREMENTS_GATE = "REQUIREMENTS_GATE",
    IMPLEMENTATION_GATE = "IMPLEMENTATION_GATE",
    QUALITY_GATE = "QUALITY_GATE",
    DEPLOYMENT_GATE = "DEPLOYMENT_GATE",
    RELEASE_GATE = "RELEASE_GATE"
}
export interface QualityCriteria {
    metric: QualityMetric;
    operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ';
    threshold: number;
    weight: number;
}
export declare enum QualityMetric {
    SECURITY_SCORE = "SECURITY_SCORE",
    VULNERABILITY_COUNT = "VULNERABILITY_COUNT",
    CRITICAL_VULNERABILITIES = "CRITICAL_VULNERABILITIES",
    RESPONSE_TIME = "RESPONSE_TIME",
    MEMORY_USAGE = "MEMORY_USAGE",
    CPU_UTILIZATION = "CPU_UTILIZATION",
    PERFORMANCE_IMPROVEMENT = "PERFORMANCE_IMPROVEMENT",
    CODE_COVERAGE = "CODE_COVERAGE",
    CYCLOMATIC_COMPLEXITY = "CYCLOMATIC_COMPLEXITY",
    DUPLICATION_PERCENTAGE = "DUPLICATION_PERCENTAGE",
    SOLID_COMPLIANCE = "SOLID_COMPLIANCE",
    DEPENDENCY_COUNT = "DEPENDENCY_COUNT",
    COUPLING_METRICS = "COUPLING_METRICS",
    TEST_SUCCESS_RATE = "TEST_SUCCESS_RATE",
    INTEGRATION_SUCCESS_RATE = "INTEGRATION_SUCCESS_RATE",
    E2E_SUCCESS_RATE = "E2E_SUCCESS_RATE"
}
export interface BacktrackRule {
    id: string;
    trigger: BacktrackTrigger;
    targetNode: string;
    condition: string;
    priority: number;
    includeContext: ContextType[];
    maxBacktrackCount: number;
}
export declare enum BacktrackTrigger {
    TEST_FAILURE = "TEST_FAILURE",
    BUILD_FAILURE = "BUILD_FAILURE",
    QUALITY_GATE_FAILURE = "QUALITY_GATE_FAILURE",
    SECURITY_VIOLATION = "SECURITY_VIOLATION",
    PERFORMANCE_DEGRADATION = "PERFORMANCE_DEGRADATION",
    DEPLOYMENT_FAILURE = "DEPLOYMENT_FAILURE"
}
export interface BranchStrategy {
    pattern: string;
    baseRef: string;
    mergeTarget: string;
    autoDelete: boolean;
    protectionRules?: BranchProtectionRule[];
}
export interface BranchProtectionRule {
    requireReviews: boolean;
    requiredReviewers: number;
    requireTests: boolean;
    requireQualityGates: boolean;
    allowForcePush: boolean;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    workItemId: string;
    status: ExecutionStatus;
    currentNode: string | null;
    completedNodes: string[];
    failedNodes: string[];
    startTime: Date;
    endTime?: Date;
    qualityScores: Map<QualityMetric, number>;
    branchRefs: Map<string, string>;
    backtrackHistory: BacktrackEvent[];
    metadata: ExecutionMetadata;
}
export declare enum ExecutionStatus {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    BACKTRACKING = "BACKTRACKING"
}
export interface BacktrackEvent {
    id: string;
    fromNode: string;
    toNode: string;
    reason: BacktrackTrigger;
    timestamp: Date;
    context: any;
    attempts: number;
}
export interface ExecutionMetadata {
    workItemType: FlowType;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTeam?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    complexity: 'TRIVIAL' | 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    projectId?: string;
}
export interface WorkflowContext {
    workItemId: string;
    projectPath: string;
    metadata: ExecutionMetadata;
    workflowId?: string;
    projectContext?: any;
    systemLoad?: any;
    inputs?: any;
}
export interface ClaudeWorkflowDecision {
    selectedWorkflow: string;
    confidence: number;
    reasoning: string;
    estimatedDuration: number;
    optimizations?: any;
    roleAdjustments?: any;
    qualityGates?: any;
    executionStrategy?: any;
    resourceAllocation?: any;
}
export declare enum InputType {
    REQUIREMENTS = "REQUIREMENTS",
    SOURCE_CODE = "SOURCE_CODE",
    TEST_RESULTS = "TEST_RESULTS",
    BUILD_ARTIFACTS = "BUILD_ARTIFACTS",
    DEPLOYMENT_CONFIG = "DEPLOYMENT_CONFIG",
    QUALITY_REPORT = "QUALITY_REPORT",
    SECURITY_REPORT = "SECURITY_REPORT",
    PERFORMANCE_METRICS = "PERFORMANCE_METRICS",
    PERFORMANCE_ANALYSIS = "PERFORMANCE_ANALYSIS",
    SECURITY_ASSESSMENT = "SECURITY_ASSESSMENT",
    DOCUMENTATION = "DOCUMENTATION",
    SPECIFICATIONS = "SPECIFICATIONS",
    TEST_SUITE = "TEST_SUITE",
    IMPLEMENTED_CODE = "IMPLEMENTED_CODE",
    DEPLOYMENT_PACKAGE = "DEPLOYMENT_PACKAGE",
    TEST_REPORT = "TEST_REPORT",
    DOCUMENTATION_UPDATE = "DOCUMENTATION_UPDATE"
}
export declare enum OutputType {
    SPECIFICATIONS = "SPECIFICATIONS",
    TEST_SUITE = "TEST_SUITE",
    IMPLEMENTED_CODE = "IMPLEMENTED_CODE",
    BUILD_ARTIFACTS = "BUILD_ARTIFACTS",
    DEPLOYMENT_PACKAGE = "DEPLOYMENT_PACKAGE",
    TEST_REPORT = "TEST_REPORT",
    QUALITY_SCORES = "QUALITY_SCORES",
    SECURITY_ASSESSMENT = "SECURITY_ASSESSMENT",
    PERFORMANCE_ANALYSIS = "PERFORMANCE_ANALYSIS",
    DOCUMENTATION_UPDATE = "DOCUMENTATION_UPDATE",
    COMMIT_MESSAGE = "COMMIT_MESSAGE"
}
export declare enum ContextType {
    ERROR_LOGS = "ERROR_LOGS",
    TEST_FAILURES = "TEST_FAILURES",
    CODE_DIFF = "CODE_DIFF",
    QUALITY_ISSUES = "QUALITY_ISSUES",
    SECURITY_VULNERABILITIES = "SECURITY_VULNERABILITIES",
    PERFORMANCE_BOTTLENECKS = "PERFORMANCE_BOTTLENECKS",
    PERFORMANCE_METRICS = "PERFORMANCE_METRICS",
    DEPENDENCY_CONFLICTS = "DEPENDENCY_CONFLICTS",
    ARCHITECTURAL_VIOLATIONS = "ARCHITECTURAL_VIOLATIONS"
}
export interface ConcurrencyConfig {
    maxParallelNodes: number;
    roleInstanceLimits: Map<RoleType, number>;
    resourceAllocation: ResourceAllocation;
    loadBalancingStrategy: 'ROUND_ROBIN' | 'LEAST_LOADED' | 'CAPABILITY_BASED';
}
export interface ResourceAllocation {
    cpuCores: number;
    memoryMb: number;
    diskSpaceMb: number;
    networkBandwidthMbps: number;
    maxConcurrentBranches: number;
}
export interface TerminalSession {
    id: string;
    nodeId: string;
    roleType: RoleType;
    sessionName: string;
    command: string;
    workingDirectory: string;
    environmentVariables: Map<string, string>;
    status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
    startTime: Date;
    endTime?: Date;
    output: string[];
    exitCode?: number;
}
export interface MultiplexorConfig {
    sessionManager: 'TMUX' | 'SCREEN' | 'CUSTOM';
    maxSessions: number;
    sessionTimeout: number;
    logRetention: number;
    autoCleanup: boolean;
}
//# sourceMappingURL=types.d.ts.map