/**
 * Code Relationship Parser
 * Parses project files to extract relationships for the semantic graph
 */
export declare class CodeRelationshipParser {
    private logger;
    private semanticGraph;
    constructor();
    initialize(): Promise<void>;
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
     * Parse JavaScript/TypeScript files
     */
    private parseJavaScriptFile;
    /**
     * Parse Python files
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
     * Create nodes in Neo4j graph
     */
    private createGraphNodes;
    /**
     * Create relationships in Neo4j graph
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
    close(): Promise<void>;
}
//# sourceMappingURL=code-relationship-parser.d.ts.map