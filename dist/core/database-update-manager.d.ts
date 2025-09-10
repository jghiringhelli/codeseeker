/**
 * Database Update Manager - Atomic updates across all CodeMind databases
 * Coordinates updates to PostgreSQL, Neo4j, Redis, and MongoDB after code changes
 */
import { EnhancementContext } from '../shared/semantic-enhancement-engine';
import { DatabaseConnections } from '../config/database-config';
export interface DatabaseUpdateResult {
    neo4j: {
        nodesCreated: number;
        nodesUpdated: number;
        relationshipsCreated: number;
        relationshipsUpdated: number;
        success: boolean;
        error?: string;
    };
    redis: {
        filesUpdated: number;
        hashesUpdated: number;
        cacheEntriesInvalidated: number;
        success: boolean;
        error?: string;
    };
    postgres: {
        recordsUpdated: number;
        embeddingsUpdated: number;
        projectStatsUpdated: boolean;
        success: boolean;
        error?: string;
    };
    mongodb: {
        documentsUpdated: number;
        analysisResultsStored: number;
        qualityReportsStored: number;
        success: boolean;
        error?: string;
    };
}
export interface FileUpdateInfo {
    filePath: string;
    action: 'created' | 'modified' | 'deleted';
    content?: string;
    oldHash?: string;
    newHash: string;
    size: number;
    lastModified: string;
}
export interface WorkflowStats {
    workflowId: string;
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
    qualityScore: number;
    duration: number;
    success: boolean;
}
export declare class DatabaseUpdateManager {
    private logger;
    private db;
    private projectRoot;
    constructor(db?: DatabaseConnections, projectRoot?: string);
    updateAllDatabases(modifiedFiles: string[], context: EnhancementContext, workflowStats?: WorkflowStats): Promise<DatabaseUpdateResult>;
    private prepareFileUpdates;
    private updateNeo4jGraph;
    private updateRedisCache;
    private updatePostgresData;
    private updateMongoDocuments;
    private calculateFileHash;
    private determineFileType;
    private analyzeFileRelationships;
    private resolveImportPath;
    private updateFileRelationships;
    private shouldGenerateEmbedding;
    private generateEmbedding;
    private generateFileAnalysis;
    private extractCodeElementsForEmbedding;
    private findMatchingBrace;
    private calculateSimpleComplexity;
    private calculateCodeHash;
}
export default DatabaseUpdateManager;
//# sourceMappingURL=database-update-manager.d.ts.map