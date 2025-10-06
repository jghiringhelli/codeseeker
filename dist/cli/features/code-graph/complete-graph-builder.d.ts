/**
 * Complete Code Graph Builder
 * Creates comprehensive Neo4j graph representing entire codebase
 * Every file is a node, all relationships are mapped
 */
export interface FileNode {
    path: string;
    name: string;
    type: 'file' | 'module' | 'config' | 'test' | 'documentation';
    language: string;
    size: number;
    content?: string;
    exports?: string[];
    imports?: ImportRelation[];
    classes?: ClassInfo[];
    functions?: FunctionInfo[];
    variables?: VariableInfo[];
    patterns?: PatternInfo[];
}
export interface ImportRelation {
    source: string;
    target: string;
    type: 'import' | 'require' | 'include' | 'reference';
    specifiers: string[];
}
export interface ClassInfo {
    name: string;
    lineStart: number;
    lineEnd: number;
    extends?: string;
    implements?: string[];
    methods: FunctionInfo[];
    properties: VariableInfo[];
}
export interface FunctionInfo {
    name: string;
    lineStart: number;
    lineEnd: number;
    parameters: string[];
    returnType?: string;
    complexity: number;
    calls: string[];
}
export interface VariableInfo {
    name: string;
    line: number;
    type?: string;
    scope: 'global' | 'class' | 'function' | 'block';
}
export interface PatternInfo {
    type: 'architectural' | 'design' | 'coding';
    name: string;
    description: string;
    category: string;
    confidence: number;
}
export interface GraphRelationship {
    from: string;
    to: string;
    type: RelationshipType;
    properties?: Record<string, any>;
}
export declare enum RelationshipType {
    DEPENDS_ON = "DEPENDS_ON",
    IMPLEMENTS = "IMPLEMENTS",
    EXTENDS = "EXTENDS",
    USES = "USES",
    CALLS = "CALLS",
    INSTANTIATES = "INSTANTIATES",
    CONFIGURES = "CONFIGURES",
    CONFIGURED_BY = "CONFIGURED_BY",
    OVERRIDES = "OVERRIDES",
    FOLLOWS_PATTERN = "FOLLOWS_PATTERN",
    VIOLATES_PATTERN = "VIOLATES_PATTERN",
    DEFINES_PATTERN = "DEFINES_PATTERN",
    DOCUMENTS = "DOCUMENTS",
    DOCUMENTED_BY = "DOCUMENTED_BY",
    TESTS = "TESTS",
    TESTED_BY = "TESTED_BY",
    SIMILAR_TO = "SIMILAR_TO",
    RELATED_TO = "RELATED_TO",
    SUPERSEDES = "SUPERSEDES",
    REFERENCES = "REFERENCES"
}
export declare class CompleteGraphBuilder {
    private logger;
    private projectPath;
    private fileNodes;
    private relationships;
    constructor(projectPath: string);
    buildCompleteGraph(): Promise<{
        nodes: FileNode[];
        relationships: GraphRelationship[];
    }>;
    private discoverAllFiles;
    private analyzeFileNode;
    private determineFileType;
    private detectLanguage;
    private extractExports;
    private extractImports;
    private extractClasses;
    private extractFunctions;
    private extractVariables;
    private detectFilePatterns;
    private analyzeAllRelationships;
    private detectPatterns;
    private findSemanticRelationships;
    private resolveImportPath;
    private extractMethodsFromClass;
    private calculateFunctionComplexity;
    private extractFunctionCalls;
    private findFileContainingClass;
    private findFileContainingInterface;
    private isConfigurationRelated;
    private findTestedFile;
    private calculateSemanticSimilarity;
}
export default CompleteGraphBuilder;
//# sourceMappingURL=complete-graph-builder.d.ts.map