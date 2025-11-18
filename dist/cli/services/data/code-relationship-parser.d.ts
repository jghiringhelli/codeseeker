/**
 * Code Relationship Parser
 * Parses project files to extract relationships for the semantic graph
 */
interface ParsedMethod {
    name: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isAsync: boolean;
    parameters: Array<{
        name: string;
        type?: string;
    }>;
    returnType?: string;
    startLine: number;
    endLine: number;
    complexity: number;
    callsTo: string[];
}
interface ParsedClass {
    name: string;
    extends?: string;
    implements: string[];
    methods: ParsedMethod[];
    properties: Array<{
        name: string;
        type?: string;
        visibility: string;
    }>;
    startLine: number;
    endLine: number;
}
interface ParsedFunction {
    name: string;
    isAsync: boolean;
    parameters: Array<{
        name: string;
        type?: string;
    }>;
    returnType?: string;
    startLine: number;
    endLine: number;
    complexity: number;
    callsTo: string[];
}
interface ParsedFile {
    filePath: string;
    language: string;
    exports: string[];
    imports: Array<{
        name: string;
        from: string;
    }>;
    classes: ParsedClass[];
    functions: ParsedFunction[];
    interfaces: string[];
    dependencies: string[];
    constants: Array<{
        name: string;
        type?: string;
    }>;
    enums: Array<{
        name: string;
        values: string[];
    }>;
}
export declare class CodeRelationshipParser {
    private logger;
    private semanticGraph;
    constructor();
    initialize(): Promise<void>;
    /**
     * Parse individual file (public wrapper for parseCodeFile)
     */
    parseFile(filePath: string): Promise<ParsedFile>;
    /**
     * Parse entire project and populate semantic graph
     */
    parseAndPopulateProject(projectPath: string, projectId: string): Promise<void>;
    /**
     * Parse all files in the project to extract structure
     */
    private parseProjectStructure;
    /**
     * Parse individual code file
     */
    private parseCodeFile;
    /**
     * Parse JavaScript/TypeScript files with detailed analysis
     */
    private parseJavaScriptFile;
    /**
     * Parse Python files with detailed analysis
     */
    private parsePythonFile;
    /**
     * Parse Java files
     */
    private parseJavaFile;
    /**
     * Parse generic files (fallback)
     */
    private parseGenericFile;
    /**
     * Extract Python methods from class body
     */
    private extractPythonMethods;
    /**
     * Extract Python properties from class body
     */
    private extractPythonProperties;
    /**
     * Parse Python function parameters
     */
    private parsePythonParameters;
    /**
     * Create detailed nodes in Neo4j graph
     */
    private createGraphNodes;
    /**
     * Create detailed relationships in Neo4j graph
     */
    private createGraphRelationships;
    /**
     * Extract business concepts from code
     */
    private extractBusinessConcepts;
    /**
     * Resolve import path to actual file path
     */
    private resolveImportPath;
    /**
     * Detect programming language from file extension
     */
    private detectLanguage;
    /**
     * Extract methods from class body
     */
    private extractMethods;
    /**
     * Extract properties from class body
     */
    private extractProperties;
    /**
     * Parse function parameters
     */
    private parseParameters;
    /**
     * Extract function calls from code body
     */
    private extractFunctionCalls;
    /**
     * Calculate cyclomatic complexity (simplified)
     */
    private calculateComplexity;
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=code-relationship-parser.d.ts.map