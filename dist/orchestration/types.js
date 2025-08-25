"use strict";
// Development Orchestration System - Type Definitions
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextType = exports.OutputType = exports.InputType = exports.ExecutionStatus = exports.BacktrackTrigger = exports.QualityMetric = exports.QualityGateType = exports.FlowType = exports.RoleType = void 0;
var RoleType;
(function (RoleType) {
    RoleType["ORCHESTRATOR"] = "ORCHESTRATOR";
    RoleType["WORK_CLASSIFIER"] = "WORK_CLASSIFIER";
    RoleType["REQUIREMENT_ANALYST"] = "REQUIREMENT_ANALYST";
    RoleType["TEST_DESIGNER"] = "TEST_DESIGNER";
    RoleType["IMPLEMENTATION_DEVELOPER"] = "IMPLEMENTATION_DEVELOPER";
    RoleType["CODE_REVIEWER"] = "CODE_REVIEWER";
    RoleType["COMPILER_BUILDER"] = "COMPILER_BUILDER";
    RoleType["DEVOPS_ENGINEER"] = "DEVOPS_ENGINEER";
    RoleType["DEPLOYER"] = "DEPLOYER";
    RoleType["UNIT_TEST_EXECUTOR"] = "UNIT_TEST_EXECUTOR";
    RoleType["INTEGRATION_TEST_ENGINEER"] = "INTEGRATION_TEST_ENGINEER";
    RoleType["E2E_TEST_ENGINEER"] = "E2E_TEST_ENGINEER";
    RoleType["SECURITY_AUDITOR"] = "SECURITY_AUDITOR";
    RoleType["PERFORMANCE_AUDITOR"] = "PERFORMANCE_AUDITOR";
    RoleType["QUALITY_AUDITOR"] = "QUALITY_AUDITOR";
    RoleType["TECHNICAL_DOCUMENTER"] = "TECHNICAL_DOCUMENTER";
    RoleType["USER_DOCUMENTER"] = "USER_DOCUMENTER";
    RoleType["RELEASE_MANAGER"] = "RELEASE_MANAGER";
    RoleType["COMMITTER"] = "COMMITTER";
})(RoleType || (exports.RoleType = RoleType = {}));
var FlowType;
(function (FlowType) {
    FlowType["FEATURE_DEVELOPMENT"] = "FEATURE_DEVELOPMENT";
    FlowType["DEFECT_RESOLUTION"] = "DEFECT_RESOLUTION";
    FlowType["TECH_DEBT_REDUCTION"] = "TECH_DEBT_REDUCTION";
    FlowType["HOTFIX"] = "HOTFIX";
    FlowType["REFACTORING"] = "REFACTORING";
})(FlowType || (exports.FlowType = FlowType = {}));
var QualityGateType;
(function (QualityGateType) {
    QualityGateType["REQUIREMENTS_GATE"] = "REQUIREMENTS_GATE";
    QualityGateType["IMPLEMENTATION_GATE"] = "IMPLEMENTATION_GATE";
    QualityGateType["QUALITY_GATE"] = "QUALITY_GATE";
    QualityGateType["DEPLOYMENT_GATE"] = "DEPLOYMENT_GATE";
    QualityGateType["RELEASE_GATE"] = "RELEASE_GATE";
})(QualityGateType || (exports.QualityGateType = QualityGateType = {}));
var QualityMetric;
(function (QualityMetric) {
    // Security Metrics
    QualityMetric["SECURITY_SCORE"] = "SECURITY_SCORE";
    QualityMetric["VULNERABILITY_COUNT"] = "VULNERABILITY_COUNT";
    QualityMetric["CRITICAL_VULNERABILITIES"] = "CRITICAL_VULNERABILITIES";
    // Performance Metrics
    QualityMetric["RESPONSE_TIME"] = "RESPONSE_TIME";
    QualityMetric["MEMORY_USAGE"] = "MEMORY_USAGE";
    QualityMetric["CPU_UTILIZATION"] = "CPU_UTILIZATION";
    // Quality Metrics
    QualityMetric["CODE_COVERAGE"] = "CODE_COVERAGE";
    QualityMetric["CYCLOMATIC_COMPLEXITY"] = "CYCLOMATIC_COMPLEXITY";
    QualityMetric["DUPLICATION_PERCENTAGE"] = "DUPLICATION_PERCENTAGE";
    // Architecture Metrics
    QualityMetric["SOLID_COMPLIANCE"] = "SOLID_COMPLIANCE";
    QualityMetric["DEPENDENCY_COUNT"] = "DEPENDENCY_COUNT";
    QualityMetric["COUPLING_METRICS"] = "COUPLING_METRICS";
    // Test Metrics
    QualityMetric["TEST_SUCCESS_RATE"] = "TEST_SUCCESS_RATE";
    QualityMetric["INTEGRATION_SUCCESS_RATE"] = "INTEGRATION_SUCCESS_RATE";
    QualityMetric["E2E_SUCCESS_RATE"] = "E2E_SUCCESS_RATE";
})(QualityMetric || (exports.QualityMetric = QualityMetric = {}));
var BacktrackTrigger;
(function (BacktrackTrigger) {
    BacktrackTrigger["TEST_FAILURE"] = "TEST_FAILURE";
    BacktrackTrigger["BUILD_FAILURE"] = "BUILD_FAILURE";
    BacktrackTrigger["QUALITY_GATE_FAILURE"] = "QUALITY_GATE_FAILURE";
    BacktrackTrigger["SECURITY_VIOLATION"] = "SECURITY_VIOLATION";
    BacktrackTrigger["PERFORMANCE_DEGRADATION"] = "PERFORMANCE_DEGRADATION";
    BacktrackTrigger["DEPLOYMENT_FAILURE"] = "DEPLOYMENT_FAILURE";
})(BacktrackTrigger || (exports.BacktrackTrigger = BacktrackTrigger = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["PENDING"] = "PENDING";
    ExecutionStatus["RUNNING"] = "RUNNING";
    ExecutionStatus["COMPLETED"] = "COMPLETED";
    ExecutionStatus["FAILED"] = "FAILED";
    ExecutionStatus["CANCELLED"] = "CANCELLED";
    ExecutionStatus["BACKTRACKING"] = "BACKTRACKING";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var InputType;
(function (InputType) {
    InputType["REQUIREMENTS"] = "REQUIREMENTS";
    InputType["SOURCE_CODE"] = "SOURCE_CODE";
    InputType["TEST_RESULTS"] = "TEST_RESULTS";
    InputType["BUILD_ARTIFACTS"] = "BUILD_ARTIFACTS";
    InputType["DEPLOYMENT_CONFIG"] = "DEPLOYMENT_CONFIG";
    InputType["QUALITY_REPORT"] = "QUALITY_REPORT";
    InputType["SECURITY_REPORT"] = "SECURITY_REPORT";
    InputType["PERFORMANCE_METRICS"] = "PERFORMANCE_METRICS";
    InputType["DOCUMENTATION"] = "DOCUMENTATION";
    InputType["SPECIFICATIONS"] = "SPECIFICATIONS";
    InputType["TEST_SUITE"] = "TEST_SUITE";
    InputType["IMPLEMENTED_CODE"] = "IMPLEMENTED_CODE";
    InputType["DEPLOYMENT_PACKAGE"] = "DEPLOYMENT_PACKAGE";
    InputType["TEST_REPORT"] = "TEST_REPORT";
    InputType["DOCUMENTATION_UPDATE"] = "DOCUMENTATION_UPDATE";
})(InputType || (exports.InputType = InputType = {}));
var OutputType;
(function (OutputType) {
    OutputType["SPECIFICATIONS"] = "SPECIFICATIONS";
    OutputType["TEST_SUITE"] = "TEST_SUITE";
    OutputType["IMPLEMENTED_CODE"] = "IMPLEMENTED_CODE";
    OutputType["BUILD_ARTIFACTS"] = "BUILD_ARTIFACTS";
    OutputType["DEPLOYMENT_PACKAGE"] = "DEPLOYMENT_PACKAGE";
    OutputType["TEST_REPORT"] = "TEST_REPORT";
    OutputType["QUALITY_SCORES"] = "QUALITY_SCORES";
    OutputType["SECURITY_ASSESSMENT"] = "SECURITY_ASSESSMENT";
    OutputType["PERFORMANCE_ANALYSIS"] = "PERFORMANCE_ANALYSIS";
    OutputType["DOCUMENTATION_UPDATE"] = "DOCUMENTATION_UPDATE";
    OutputType["COMMIT_MESSAGE"] = "COMMIT_MESSAGE";
})(OutputType || (exports.OutputType = OutputType = {}));
var ContextType;
(function (ContextType) {
    ContextType["ERROR_LOGS"] = "ERROR_LOGS";
    ContextType["TEST_FAILURES"] = "TEST_FAILURES";
    ContextType["CODE_DIFF"] = "CODE_DIFF";
    ContextType["QUALITY_ISSUES"] = "QUALITY_ISSUES";
    ContextType["SECURITY_VULNERABILITIES"] = "SECURITY_VULNERABILITIES";
    ContextType["PERFORMANCE_BOTTLENECKS"] = "PERFORMANCE_BOTTLENECKS";
    ContextType["DEPENDENCY_CONFLICTS"] = "DEPENDENCY_CONFLICTS";
    ContextType["ARCHITECTURAL_VIOLATIONS"] = "ARCHITECTURAL_VIOLATIONS";
})(ContextType || (exports.ContextType = ContextType = {}));
//# sourceMappingURL=types.js.map