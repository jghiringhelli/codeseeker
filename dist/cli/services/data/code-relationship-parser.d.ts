/**
 * Code Relationship Parser
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Parses project files to extract relationships for the semantic graph
 */
import { ParsedFile, ProjectStructure, IFileParsingService, IProjectStructureService, IGraphPopulationService } from './code-parsing/interfaces/index';
export { ParsedFile, ProjectStructure } from './code-parsing/interfaces/index';
export declare class CodeRelationshipParser {
    private fileParsingService?;
    private projectStructureService?;
    private graphPopulationService?;
    private logger;
    private semanticGraph;
    constructor(fileParsingService?: IFileParsingService, projectStructureService?: IProjectStructureService, graphPopulationService?: IGraphPopulationService);
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
     * Analyze project structure without populating the graph
     */
    analyzeProjectStructure(projectPath: string): Promise<ProjectStructure>;
    /**
     * Get parsing statistics for a project
     */
    getProjectStatistics(structure: ProjectStructure): {
        files: number;
        relationships: number;
        languages: {
            [language: string]: number;
        };
        classes: number;
        functions: number;
        interfaces: number;
        complexity: {
            average: number;
            max: number;
            total: number;
        };
        patterns: {
            patterns: string[];
            layered: boolean;
            modular: boolean;
            suggestions: string[];
        };
    };
    private generateProjectSummary;
    private calculateLanguageStatistics;
    private calculateComplexityStatistics;
    close(): Promise<void>;
}
export default CodeRelationshipParser;
//# sourceMappingURL=code-relationship-parser.d.ts.map