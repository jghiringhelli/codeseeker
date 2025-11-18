/**
 * Initialization Status Tracker
 *
 * Tracks the progress of project initialization across multiple stages:
 * - Metadata Ready (project registered)
 * - File Discovery Ready (files scanned)
 * - Semantic Entities Ready (entities extracted and stored in Neo4j)
 * - Semantic Relationships Ready (relationships stored in Neo4j)
 * - Vector Embeddings Ready (embeddings stored in PostgreSQL)
 * - Initialization Complete (all stages successful)
 */
import { DatabaseConnections } from '../../../../config/database-config';
export interface InitializationStatus {
    projectId: string;
    projectName: string;
    projectPath: string;
    metadataReady: boolean;
    fileDiscoveryReady: boolean;
    semanticEntitiesReady: boolean;
    semanticRelationshipsReady: boolean;
    vectorEmbeddingsReady: boolean;
    initializationComplete: boolean;
    lastAttemptAt: Date;
    completedAt?: Date;
    errorMessage?: string;
    stats: {
        totalFiles?: number;
        entitiesCount?: number;
        relationshipsCount?: number;
        embeddingsCount?: number;
        processingTimeMs?: number;
    };
}
export interface StatusUpdateData {
    stage: 'metadata' | 'file_discovery' | 'semantic_entities' | 'semantic_relationships' | 'vector_embeddings' | 'complete';
    success: boolean;
    errorMessage?: string;
    stats?: any;
}
export declare class InitializationStatusTracker {
    private dbConnections;
    private logger;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Initialize tracking for a project
     */
    initializeProject(projectId: string, projectName: string, projectPath: string): Promise<void>;
    /**
     * Update status for a specific stage
     */
    updateStageStatus(projectId: string, update: StatusUpdateData): Promise<void>;
    /**
     * Get current status for a project
     */
    getProjectStatus(projectId: string): Promise<InitializationStatus | null>;
    /**
     * Check if initialization can be resumed (has partial progress)
     */
    canResumeInitialization(projectId: string): Promise<boolean>;
    /**
     * Clear error state for retry
     */
    clearErrorState(projectId: string): Promise<void>;
    /**
     * Display initialization progress
     */
    displayProgress(projectId: string): Promise<void>;
    private getUpdateFields;
    private checkCompletionStatus;
}
export default InitializationStatusTracker;
//# sourceMappingURL=initialization-status-tracker.d.ts.map