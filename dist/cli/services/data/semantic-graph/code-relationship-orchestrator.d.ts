/**
 * Code Relationship Orchestrator - Main coordinator following SOLID principles
 * Single Responsibility: Orchestrate semantic graph population
 * Open/Closed: Easy to extend with new parsers
 * Dependency Inversion: Depends on abstractions (interfaces)
 */
import { SemanticGraphService } from './semantic-graph';
export interface ProjectParsingResult {
    totalFiles: number;
    successfullyParsed: number;
    errors: string[];
    nodeStats: {
        files: number;
        classes: number;
        functions: number;
        interfaces: number;
    };
    relationshipStats: {
        imports: number;
        inheritance: number;
        containment: number;
    };
}
/**
 * Main orchestrator for semantic graph population
 * Follows Dependency Inversion Principle - depends on interfaces
 */
export declare class CodeRelationshipOrchestrator {
    private semanticGraph;
    private logger;
    private parsers;
    private genericParser;
    private nodeBuilder;
    private relationshipBuilder;
    constructor(semanticGraph: SemanticGraphService);
    /**
     * Initialize and register language parsers
     * Follows Open/Closed Principle - easy to add new parsers
     */
    private initializeParsers;
    /**
     * Initialize Tree-sitter parsers if packages are available
     */
    private initializeTreeSitterParsers;
    /**
     * Main entry point - populate semantic graph for entire project
     */
    populateSemanticGraph(projectPath: string, projectId: string): Promise<ProjectParsingResult>;
    /**
     * Update semantic graph for specific files (incremental updates)
     */
    updateFilesInGraph(filePaths: string[], projectPath: string, projectId: string): Promise<void>;
    private discoverCodeFiles;
    private parseAllFiles;
    private parseFile;
    private createAllNodes;
    private createAllRelationships;
    private postProcessGraph;
    private getFileExtension;
    private createEmptyResult;
}
export default CodeRelationshipOrchestrator;
//# sourceMappingURL=code-relationship-orchestrator.d.ts.map