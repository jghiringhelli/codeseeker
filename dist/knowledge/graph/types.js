"use strict";
/**
 * Semantic Knowledge Graph Types for CodeMind
 *
 * A knowledge graph representing code semantics using triads (subject-predicate-object)
 * to capture relationships between code entities, concepts, and patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightType = exports.TriadSource = exports.EvidenceType = exports.RelationType = exports.NodeType = void 0;
var NodeType;
(function (NodeType) {
    // Code Entities
    NodeType["CLASS"] = "class";
    NodeType["FUNCTION"] = "function";
    NodeType["METHOD"] = "method";
    NodeType["INTERFACE"] = "interface";
    NodeType["VARIABLE"] = "variable";
    NodeType["CONSTANT"] = "constant";
    NodeType["TYPE"] = "type";
    NodeType["ENUM"] = "enum";
    NodeType["NAMESPACE"] = "namespace";
    NodeType["MODULE"] = "module";
    NodeType["PACKAGE"] = "package";
    // Architectural Entities
    NodeType["SERVICE"] = "service";
    NodeType["COMPONENT"] = "component";
    NodeType["REPOSITORY"] = "repository";
    NodeType["CONTROLLER"] = "controller";
    NodeType["MODEL"] = "model";
    // Conceptual Entities
    NodeType["PATTERN"] = "pattern";
    NodeType["CONCEPT"] = "concept";
    NodeType["FEATURE"] = "feature";
    NodeType["BUSINESS_RULE"] = "business_rule";
    NodeType["REQUIREMENT"] = "requirement";
    // Infrastructure
    NodeType["DATABASE_TABLE"] = "database_table";
    NodeType["API_ENDPOINT"] = "api_endpoint";
    NodeType["CONFIGURATION"] = "configuration";
    NodeType["DEPENDENCY"] = "dependency";
})(NodeType || (exports.NodeType = NodeType = {}));
var RelationType;
(function (RelationType) {
    // Structural Relationships
    RelationType["EXTENDS"] = "extends";
    RelationType["IMPLEMENTS"] = "implements";
    RelationType["INHERITS_FROM"] = "inherits_from";
    RelationType["CONTAINS"] = "contains";
    RelationType["COMPOSED_OF"] = "composed_of";
    RelationType["PART_OF"] = "part_of";
    // Behavioral Relationships
    RelationType["CALLS"] = "calls";
    RelationType["INVOKES"] = "invokes";
    RelationType["RETURNS"] = "returns";
    RelationType["ACCEPTS"] = "accepts";
    RelationType["THROWS"] = "throws";
    RelationType["HANDLES"] = "handles";
    // Data Flow Relationships
    RelationType["READS_FROM"] = "reads_from";
    RelationType["WRITES_TO"] = "writes_to";
    RelationType["TRANSFORMS"] = "transforms";
    RelationType["PRODUCES"] = "produces";
    RelationType["CONSUMES"] = "consumes";
    // Dependency Relationships
    RelationType["DEPENDS_ON"] = "depends_on";
    RelationType["USES"] = "uses";
    RelationType["IMPORTS"] = "imports";
    RelationType["EXPORTS"] = "exports";
    RelationType["REQUIRES"] = "requires";
    RelationType["PROVIDES"] = "provides";
    // Pattern Relationships
    RelationType["FOLLOWS_PATTERN"] = "follows_pattern";
    RelationType["IMPLEMENTS_PATTERN"] = "implements_pattern";
    RelationType["VIOLATES_PATTERN"] = "violates_pattern";
    // Semantic Relationships
    RelationType["IS_SIMILAR_TO"] = "is_similar_to";
    RelationType["IS_OPPOSITE_OF"] = "is_opposite_of";
    RelationType["IS_TYPE_OF"] = "is_type_of";
    RelationType["IS_INSTANCE_OF"] = "is_instance_of";
    RelationType["REPRESENTS"] = "represents";
    RelationType["RELATES_TO"] = "relates_to";
    // Business Logic Relationships
    RelationType["SATISFIES"] = "satisfies";
    RelationType["VALIDATES"] = "validates";
    RelationType["ENFORCES"] = "enforces";
    RelationType["TRIGGERS"] = "triggers";
    // Quality Relationships
    RelationType["DUPLICATES"] = "duplicates";
    RelationType["REFACTORS"] = "refactors";
    RelationType["REPLACES"] = "replaces";
    RelationType["IMPROVES"] = "improves";
})(RelationType || (exports.RelationType = RelationType = {}));
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["STATIC_ANALYSIS"] = "static_analysis";
    EvidenceType["DYNAMIC_ANALYSIS"] = "dynamic_analysis";
    EvidenceType["PATTERN_MATCHING"] = "pattern_matching";
    EvidenceType["SEMANTIC_SIMILARITY"] = "semantic_similarity";
    EvidenceType["DOCUMENTATION"] = "documentation";
    EvidenceType["TEST_ANALYSIS"] = "test_analysis";
    EvidenceType["USER_ANNOTATION"] = "user_annotation";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
var TriadSource;
(function (TriadSource) {
    TriadSource["STATIC_ANALYZER"] = "static_analyzer";
    TriadSource["AST_PARSER"] = "ast_parser";
    TriadSource["DEPENDENCY_ANALYZER"] = "dependency_analyzer";
    TriadSource["PATTERN_DETECTOR"] = "pattern_detector";
    TriadSource["SEMANTIC_ANALYZER"] = "semantic_analyzer";
    TriadSource["USER_INPUT"] = "user_input";
    TriadSource["MACHINE_LEARNING"] = "machine_learning";
    TriadSource["GIT_ANALYSIS"] = "git_analysis";
})(TriadSource || (exports.TriadSource = TriadSource = {}));
var InsightType;
(function (InsightType) {
    InsightType["DESIGN_PATTERN_DETECTED"] = "design_pattern_detected";
    InsightType["ANTI_PATTERN_DETECTED"] = "anti_pattern_detected";
    InsightType["ARCHITECTURAL_VIOLATION"] = "architectural_violation";
    InsightType["COUPLING_ISSUE"] = "coupling_issue";
    InsightType["COHESION_OPPORTUNITY"] = "cohesion_opportunity";
    InsightType["REFACTORING_OPPORTUNITY"] = "refactoring_opportunity";
    InsightType["DUPLICATE_LOGIC"] = "duplicate_logic";
    InsightType["MISSING_ABSTRACTION"] = "missing_abstraction";
})(InsightType || (exports.InsightType = InsightType = {}));
//# sourceMappingURL=types.js.map