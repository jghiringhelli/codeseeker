/**
 * PostgreSQL Initializer for /init workflow
 * Populates all required tables during project initialization
 */
import { LanguageSetupResult } from '../semantic-graph/LanguageDetector';
export interface PostgreSQLInitResult {
    embeddings: {
        created: number;
        updated: number;
        errors: number;
    };
    analysisResults: {
        created: number;
        errors: number;
    };
    techStack: {
        detected: boolean;
        languages: string[];
        frameworks: string[];
        dependencies: Record<string, string>;
    };
    progress: {
        phase: string;
        percentage: number;
        resumeToken?: string;
    };
}
export declare class PostgreSQLInitializer {
    private logger;
    private dbConnections;
    private embeddingService;
    constructor();
    /**
     * Complete PostgreSQL initialization for a project
     */
    initializeProject(projectId: string, projectPath: string, languageSetup: LanguageSetupResult): Promise<PostgreSQLInitResult>;
    /**
     * Initialize progress tracking for resumable processing
     */
    private initializeProgressTracking;
    /**
     * Detect tech stack and store in database
     */
    private detectTechStack;
    /**
     * Generate semantic embeddings for all code files using EmbeddingService
     */
    private generateSemanticEmbeddings;
    /**
     * Run file analysis for patterns, dependencies, quality
     */
    private runFileAnalysis;
    /**
     * Complete initialization and update progress
     */
    private completeInitialization;
    private discoverCodeFiles;
    private analyzeFile;
    private detectFrameworks;
    private detectDependencies;
    private extractDependencies;
    private updateProgress;
    private markInitializationFailed;
}
//# sourceMappingURL=PostgreSQLInitializer.d.ts.map