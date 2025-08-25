// Development Orchestration System - Type Definitions

export interface WorkflowNode {
  id: string;
  roleType: RoleType;
  name: string;
  description: string;
  dependencies: string[]; // Node IDs that must complete before this node
  parallelWith?: string[]; // Node IDs that can run concurrently
  inputs: InputType[];
  outputs: OutputType[];
  executionTimeoutMs: number;
  retryAttempts: number;
  qualityGates?: QualityGate[];
  branchStrategy: BranchStrategy;
}

export interface WorkflowDAG {
  id: string;
  name: string;
  flowType: FlowType;
  nodes: Map<string, WorkflowNode>;
  edges: WorkflowEdge[];
  entryPoints: string[]; // Starting node IDs
  mergePoints: string[]; // Quality gate node IDs
  exitPoints: string[]; // Final node IDs
  backtrackRules: BacktrackRule[];
}

export enum RoleType {
  ORCHESTRATOR = 'ORCHESTRATOR',
  WORK_CLASSIFIER = 'WORK_CLASSIFIER',
  REQUIREMENT_ANALYST = 'REQUIREMENT_ANALYST',
  TEST_DESIGNER = 'TEST_DESIGNER',
  IMPLEMENTATION_DEVELOPER = 'IMPLEMENTATION_DEVELOPER',
  CODE_REVIEWER = 'CODE_REVIEWER',
  COMPILER_BUILDER = 'COMPILER_BUILDER',
  DEVOPS_ENGINEER = 'DEVOPS_ENGINEER',
  DEPLOYER = 'DEPLOYER',
  UNIT_TEST_EXECUTOR = 'UNIT_TEST_EXECUTOR',
  INTEGRATION_TEST_ENGINEER = 'INTEGRATION_TEST_ENGINEER',
  E2E_TEST_ENGINEER = 'E2E_TEST_ENGINEER',
  SECURITY_AUDITOR = 'SECURITY_AUDITOR',
  PERFORMANCE_AUDITOR = 'PERFORMANCE_AUDITOR',
  QUALITY_AUDITOR = 'QUALITY_AUDITOR',
  TECHNICAL_DOCUMENTER = 'TECHNICAL_DOCUMENTER',
  USER_DOCUMENTER = 'USER_DOCUMENTER',
  RELEASE_MANAGER = 'RELEASE_MANAGER',
  COMMITTER = 'COMMITTER'
}

export enum FlowType {
  FEATURE_DEVELOPMENT = 'FEATURE_DEVELOPMENT',
  DEFECT_RESOLUTION = 'DEFECT_RESOLUTION',
  TECH_DEBT_REDUCTION = 'TECH_DEBT_REDUCTION',
  HOTFIX = 'HOTFIX',
  REFACTORING = 'REFACTORING'
}

export interface WorkflowEdge {
  from: string; // Node ID
  to: string; // Node ID
  condition?: EdgeCondition;
  priority: number; // For ordering when multiple edges are available
}

export interface EdgeCondition {
  type: 'QUALITY_GATE' | 'SUCCESS' | 'FAILURE' | 'CONDITIONAL';
  criteria?: QualityCriteria;
  expression?: string; // For complex conditions
}

export interface QualityGate {
  id: string;
  name: string;
  type: QualityGateType;
  criteria: QualityCriteria[];
  blockingLevel: 'WARNING' | 'ERROR' | 'CRITICAL';
  autoFix: boolean;
}

export enum QualityGateType {
  REQUIREMENTS_GATE = 'REQUIREMENTS_GATE',
  IMPLEMENTATION_GATE = 'IMPLEMENTATION_GATE',
  QUALITY_GATE = 'QUALITY_GATE',
  DEPLOYMENT_GATE = 'DEPLOYMENT_GATE',
  RELEASE_GATE = 'RELEASE_GATE'
}

export interface QualityCriteria {
  metric: QualityMetric;
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ';
  threshold: number;
  weight: number; // For composite scoring
}

export enum QualityMetric {
  // Security Metrics
  SECURITY_SCORE = 'SECURITY_SCORE',
  VULNERABILITY_COUNT = 'VULNERABILITY_COUNT',
  CRITICAL_VULNERABILITIES = 'CRITICAL_VULNERABILITIES',
  
  // Performance Metrics
  RESPONSE_TIME = 'RESPONSE_TIME',
  MEMORY_USAGE = 'MEMORY_USAGE',
  CPU_UTILIZATION = 'CPU_UTILIZATION',
  
  // Quality Metrics
  CODE_COVERAGE = 'CODE_COVERAGE',
  CYCLOMATIC_COMPLEXITY = 'CYCLOMATIC_COMPLEXITY',
  DUPLICATION_PERCENTAGE = 'DUPLICATION_PERCENTAGE',
  
  // Architecture Metrics
  SOLID_COMPLIANCE = 'SOLID_COMPLIANCE',
  DEPENDENCY_COUNT = 'DEPENDENCY_COUNT',
  COUPLING_METRICS = 'COUPLING_METRICS',
  
  // Test Metrics
  TEST_SUCCESS_RATE = 'TEST_SUCCESS_RATE',
  INTEGRATION_SUCCESS_RATE = 'INTEGRATION_SUCCESS_RATE',
  E2E_SUCCESS_RATE = 'E2E_SUCCESS_RATE'
}

export interface BacktrackRule {
  id: string;
  trigger: BacktrackTrigger;
  targetNode: string; // Node ID to backtrack to
  condition: string; // Condition expression
  priority: number;
  includeContext: ContextType[];
  maxBacktrackCount: number;
}

export enum BacktrackTrigger {
  TEST_FAILURE = 'TEST_FAILURE',
  BUILD_FAILURE = 'BUILD_FAILURE',
  QUALITY_GATE_FAILURE = 'QUALITY_GATE_FAILURE',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  DEPLOYMENT_FAILURE = 'DEPLOYMENT_FAILURE'
}

export interface BranchStrategy {
  pattern: string; // e.g., "feature/{workItemId}", "hotfix/{issueId}"
  baseRef: string; // Branch to create from
  mergeTarget: string; // Branch to merge into
  autoDelete: boolean; // Delete branch after successful merge
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
  branchRefs: Map<string, string>; // Node ID -> Branch name
  backtrackHistory: BacktrackEvent[];
  metadata: ExecutionMetadata;
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  BACKTRACKING = 'BACKTRACKING'
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
}

export enum InputType {
  REQUIREMENTS = 'REQUIREMENTS',
  SOURCE_CODE = 'SOURCE_CODE',
  TEST_RESULTS = 'TEST_RESULTS',
  BUILD_ARTIFACTS = 'BUILD_ARTIFACTS',
  DEPLOYMENT_CONFIG = 'DEPLOYMENT_CONFIG',
  QUALITY_REPORT = 'QUALITY_REPORT',
  SECURITY_REPORT = 'SECURITY_REPORT',
  PERFORMANCE_METRICS = 'PERFORMANCE_METRICS',
  DOCUMENTATION = 'DOCUMENTATION',
  SPECIFICATIONS = 'SPECIFICATIONS',
  TEST_SUITE = 'TEST_SUITE',
  IMPLEMENTED_CODE = 'IMPLEMENTED_CODE',
  DEPLOYMENT_PACKAGE = 'DEPLOYMENT_PACKAGE',
  TEST_REPORT = 'TEST_REPORT',
  DOCUMENTATION_UPDATE = 'DOCUMENTATION_UPDATE'
}

export enum OutputType {
  SPECIFICATIONS = 'SPECIFICATIONS',
  TEST_SUITE = 'TEST_SUITE',
  IMPLEMENTED_CODE = 'IMPLEMENTED_CODE',
  BUILD_ARTIFACTS = 'BUILD_ARTIFACTS',
  DEPLOYMENT_PACKAGE = 'DEPLOYMENT_PACKAGE',
  TEST_REPORT = 'TEST_REPORT',
  QUALITY_SCORES = 'QUALITY_SCORES',
  SECURITY_ASSESSMENT = 'SECURITY_ASSESSMENT',
  PERFORMANCE_ANALYSIS = 'PERFORMANCE_ANALYSIS',
  DOCUMENTATION_UPDATE = 'DOCUMENTATION_UPDATE',
  COMMIT_MESSAGE = 'COMMIT_MESSAGE'
}

export enum ContextType {
  ERROR_LOGS = 'ERROR_LOGS',
  TEST_FAILURES = 'TEST_FAILURES',
  CODE_DIFF = 'CODE_DIFF',
  QUALITY_ISSUES = 'QUALITY_ISSUES',
  SECURITY_VULNERABILITIES = 'SECURITY_VULNERABILITIES',
  PERFORMANCE_BOTTLENECKS = 'PERFORMANCE_BOTTLENECKS',
  DEPENDENCY_CONFLICTS = 'DEPENDENCY_CONFLICTS',
  ARCHITECTURAL_VIOLATIONS = 'ARCHITECTURAL_VIOLATIONS'
}

// Concurrent Execution Configuration
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

// Terminal Multiplexor Integration
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
  logRetention: number; // Days
  autoCleanup: boolean;
}