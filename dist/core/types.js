"use strict";
/**
 * Core type definitions for the Intelligent Code Auxiliary System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializationMode = exports.ErrorCode = exports.AnalysisType = exports.QuestionImpact = exports.QuestionCategory = exports.EvidenceType = exports.PatternType = exports.InitPhase = exports.ProjectSize = exports.ProjectType = void 0;
var ProjectType;
(function (ProjectType) {
    ProjectType["WEB_APPLICATION"] = "web_application";
    ProjectType["API_SERVICE"] = "api_service";
    ProjectType["LIBRARY"] = "library";
    ProjectType["MOBILE_APP"] = "mobile_app";
    ProjectType["DESKTOP_APP"] = "desktop_app";
    ProjectType["CLI_TOOL"] = "cli_tool";
    ProjectType["UNKNOWN"] = "unknown";
})(ProjectType || (exports.ProjectType = ProjectType = {}));
var ProjectSize;
(function (ProjectSize) {
    ProjectSize["SMALL"] = "small";
    ProjectSize["MEDIUM"] = "medium";
    ProjectSize["LARGE"] = "large";
    ProjectSize["ENTERPRISE"] = "enterprise"; // 10000+ files
})(ProjectSize || (exports.ProjectSize = ProjectSize = {}));
// === INITIALIZATION TYPES ===
var InitPhase;
(function (InitPhase) {
    InitPhase["PROJECT_DISCOVERY"] = "project_discovery";
    InitPhase["PATTERN_ANALYSIS"] = "pattern_analysis";
    InitPhase["STANDARDS_INFERENCE"] = "standards_inference";
    InitPhase["SMART_QUESTIONING"] = "smart_questioning";
    InitPhase["DEEP_ANALYSIS"] = "deep_analysis";
    InitPhase["CONFIGURATION_GENERATION"] = "configuration_generation";
    InitPhase["CLAUDE_MD_UPDATE"] = "claude_md_update";
    InitPhase["COMPLETED"] = "completed";
})(InitPhase || (exports.InitPhase = InitPhase = {}));
var PatternType;
(function (PatternType) {
    PatternType["ARCHITECTURE"] = "architecture";
    PatternType["DESIGN_PATTERN"] = "design_pattern";
    PatternType["CODING_STANDARD"] = "coding_standard";
    PatternType["TESTING_PATTERN"] = "testing_pattern";
})(PatternType || (exports.PatternType = PatternType = {}));
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["FILE_STRUCTURE"] = "file_structure";
    EvidenceType["CODE_PATTERN"] = "code_pattern";
    EvidenceType["NAMING_CONVENTION"] = "naming_convention";
    EvidenceType["IMPORT_PATTERN"] = "import_pattern";
    EvidenceType["CONFIGURATION"] = "configuration";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
var QuestionCategory;
(function (QuestionCategory) {
    QuestionCategory["ARCHITECTURE"] = "architecture";
    QuestionCategory["STANDARDS"] = "standards";
    QuestionCategory["PATTERNS"] = "patterns";
    QuestionCategory["PURPOSE"] = "purpose";
    QuestionCategory["QUALITY"] = "quality";
})(QuestionCategory || (exports.QuestionCategory = QuestionCategory = {}));
var QuestionImpact;
(function (QuestionImpact) {
    QuestionImpact["LOW"] = "low";
    QuestionImpact["MEDIUM"] = "medium";
    QuestionImpact["HIGH"] = "high";
    QuestionImpact["CRITICAL"] = "critical";
})(QuestionImpact || (exports.QuestionImpact = QuestionImpact = {}));
var AnalysisType;
(function (AnalysisType) {
    AnalysisType["PATTERN"] = "pattern";
    AnalysisType["QUALITY"] = "quality";
    AnalysisType["ARCHITECTURE"] = "architecture";
    AnalysisType["TECH_STACK"] = "tech_stack";
    AnalysisType["DUPLICATION"] = "duplication";
})(AnalysisType || (exports.AnalysisType = AnalysisType = {}));
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["FILE_ACCESS_ERROR"] = "FILE_ACCESS_ERROR";
    ErrorCode["PARSE_ERROR"] = "PARSE_ERROR";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["INITIALIZATION_ERROR"] = "INITIALIZATION_ERROR";
    ErrorCode["MCP_ERROR"] = "MCP_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
var InitializationMode;
(function (InitializationMode) {
    InitializationMode["GREENFIELD"] = "greenfield";
    InitializationMode["LEGACY"] = "legacy";
    InitializationMode["AUTO"] = "auto";
})(InitializationMode || (exports.InitializationMode = InitializationMode = {}));
//# sourceMappingURL=types.js.map