/**
 * Neo4j Semantic Graph Storage Service
 *
 * Stores semantic graphs in Neo4j with project-disjoint structure:
 * - Each project has a root PROJECT node
 * - All entities and relationships are connected through the project
 * - Ensures complete separation between different projects
 */
import { DatabaseConnections } from '../../../config/database-config';
export interface SemanticEntity {
    id: string;
    name: string;
    type: string;
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string;
    modifiers?: string[];
    metadata?: any;
}
export interface SemanticRelationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    metadata?: any;
}
export interface ProjectGraphStats {
    projectNodes: number;
    entityNodes: number;
    relationships: number;
    files: number;
}
export declare class Neo4jGraphStorage {
    private dbConnections;
    private logger;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Initialize semantic graph for a project with root PROJECT node
     */
    initializeProjectGraph(projectId: string, projectName: string, projectPath: string): Promise<void>;
    /**
     * Store semantic entities for a project
     */
    storeSemanticEntities(projectId: string, entities: SemanticEntity[]): Promise<void>;
    /**
     * Store semantic relationships between entities
     */
    storeSemanticRelationships(projectId: string, relationships: SemanticRelationship[]): Promise<void>;
    /**
     * Fallback method to store relationships without APOC
     */
    private storeRelationshipsFallback;
    /**
     * Get project graph statistics
     */
    getProjectGraphStats(projectId: string): Promise<ProjectGraphStats>;
    /**
     * Clear project graph (remove all nodes and relationships for a project)
     */
    clearProjectGraph(projectId: string): Promise<void>;
    /**
     * Query semantic relationships for graph traversal
     */
    querySemanticPath(projectId: string, fromEntity: string, toEntity: string, maxDepth?: number): Promise<any[]>;
}
export default Neo4jGraphStorage;
//# sourceMappingURL=neo4j-graph-storage.d.ts.map