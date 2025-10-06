/**
 * Relationship Builder - Single Responsibility: Create Neo4j relationships
 * Follows Single Responsibility and Dependency Inversion principles
 */
import { SemanticGraphService } from '../../semantic-graph';
import { ParsedCodeStructure } from '../parsers/ILanguageParser';
import { NodeCreationResult } from './NodeBuilder';
export declare class RelationshipBuilder {
    private semanticGraph;
    private logger;
    constructor(semanticGraph: SemanticGraphService);
    /**
     * Create all relationships for a file's structure
     */
    createRelationshipsForFile(structure: ParsedCodeStructure, nodeResult: NodeCreationResult, allFileNodes: Map<string, string>, projectPath: string): Promise<void>;
    /**
     * Create import/dependency relationships between files
     */
    private createImportRelationships;
    /**
     * Create class inheritance and implementation relationships
     */
    private createClassRelationships;
    /**
     * Create inheritance relationship (extends/implements)
     */
    private createInheritanceRelationship;
    /**
     * Create function-related relationships
     */
    private createFunctionRelationships;
    /**
     * Create containment relationships (file contains classes, functions, etc.)
     */
    private createContainmentRelationships;
    /**
     * Create business concept relationships
     */
    createBusinessConceptRelationships(conceptNodeId: string, relatedCodeNodeIds: string[], relatedDocNodeIds?: string[], relatedTestNodeIds?: string[]): Promise<void>;
    /**
     * Create configuration relationships
     */
    createConfigurationRelationships(configNodeId: string, affectedFileNodeIds: string[]): Promise<void>;
    /**
     * Create test relationships
     */
    createTestRelationships(testNodeId: string, testedFileNodeIds: string[]): Promise<void>;
    /**
     * Resolve import path to actual file path
     */
    private resolveImportPath;
    private fileExists;
}
//# sourceMappingURL=RelationshipBuilder.d.ts.map