/**
 * Node Builder - Single Responsibility: Create Neo4j nodes
 * Follows Single Responsibility and Open/Closed principles
 */
import { SemanticGraphService } from '../../semantic-graph';
import { ParsedCodeStructure } from '../parsers/ILanguageParser';
export interface NodeCreationResult {
    fileNodeId: string;
    classNodeIds: Map<string, string>;
    functionNodeIds: Map<string, string>;
    interfaceNodeIds: Map<string, string>;
}
export declare class NodeBuilder {
    private semanticGraph;
    private logger;
    constructor(semanticGraph: SemanticGraphService);
    /**
     * Create all nodes for a parsed file structure
     */
    createNodesForFile(structure: ParsedCodeStructure, projectId: string): Promise<NodeCreationResult>;
    /**
     * Create file node with metadata
     */
    private createFileNode;
    /**
     * Create class node with inheritance info
     */
    private createClassNode;
    /**
     * Create function node with signature info
     */
    private createFunctionNode;
    /**
     * Create interface node
     */
    private createInterfaceNode;
    /**
     * Create business concept node from code analysis
     */
    createBusinessConceptNode(conceptName: string, description: string, domain: string, projectId: string): Promise<string>;
    /**
     * Create documentation node
     */
    createDocumentationNode(title: string, filePath: string, content: string, projectId: string): Promise<string>;
    /**
     * Create test node
     */
    createTestNode(testName: string, filePath: string, testedFile: string, projectId: string): Promise<string>;
    private getFileName;
    private extractKeywords;
    private extractDocumentationKeywords;
    private buildFunctionSignature;
}
//# sourceMappingURL=NodeBuilder.d.ts.map