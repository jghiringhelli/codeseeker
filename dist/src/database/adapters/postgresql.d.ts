/**
 * PostgreSQL database adapter for CodeMind
 * Production-ready adapter with connection pooling and transactions
 */
import { DatabaseAdapter, DatabaseConfig, Project, ProjectPath, DatabaseStats } from './base';
import { Logger } from '../../utils/logger';
import { InitializationProgress, DetectedPattern, QuestionnaireResponse, AnalysisResult } from '../../core/types';
export declare class PostgreSQLAdapter extends DatabaseAdapter {
    private pool;
    constructor(config: DatabaseConfig, logger: Logger);
    initialize(): Promise<void>;
    close(): Promise<void>;
    migrate(): Promise<void>;
    isHealthy(): Promise<boolean>;
    createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
    getProject(projectPath: string): Promise<Project | null>;
    getProjectById(id: string): Promise<Project | null>;
    updateProject(id: string, updates: Partial<Project>): Promise<Project>;
    deleteProject(id: string): Promise<void>;
    listProjects(status?: string, limit?: number, offset?: number): Promise<Project[]>;
    addProjectPath(projectId: string, path: string, pathType: 'primary' | 'alias' | 'historical'): Promise<ProjectPath>;
    updateProjectPath(projectId: string, oldPath: string, newPath: string): Promise<void>;
    deactivateProjectPath(projectId: string, path: string): Promise<void>;
    getProjectByAnyPath(path: string): Promise<Project | null>;
    getProjectPaths(projectId: string): Promise<ProjectPath[]>;
    saveInitializationProgress(progress: Omit<InitializationProgress, 'id' | 'createdAt' | 'updatedAt'>): Promise<InitializationProgress>;
    getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
    updateInitializationProgress(resumeToken: string, updates: Partial<InitializationProgress>): Promise<InitializationProgress>;
    saveDetectedPattern(pattern: Omit<DetectedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<DetectedPattern>;
    getDetectedPatterns(projectPath: string, patternType?: string): Promise<DetectedPattern[]>;
    updatePatternStatus(id: string, status: 'detected' | 'validated' | 'rejected'): Promise<void>;
    saveQuestionnaireResponse(response: Omit<QuestionnaireResponse, 'id' | 'createdAt'>): Promise<QuestionnaireResponse>;
    getQuestionnaireResponses(projectPath: string, category?: string): Promise<QuestionnaireResponse[]>;
    saveAnalysisResult(analysisResult: Omit<AnalysisResult, 'id' | 'createdAt'>): Promise<AnalysisResult>;
    getAnalysisResults(projectPath: string, analysisType?: string, fileHash?: string): Promise<AnalysisResult[]>;
    getSystemConfig(key: string): Promise<any>;
    setSystemConfig(key: string, value: any, projectId?: string): Promise<void>;
    getDatabaseStats(): Promise<DatabaseStats>;
    recordOperationMetrics(operation: string, projectId: string | null, durationMs: number, success: boolean, error?: string, metadata?: Record<string, any>): Promise<void>;
    cleanupExpiredResumeStates(): Promise<number>;
    archiveOldAnalysisResults(olderThanDays: number): Promise<number>;
    private mapRowToProject;
    private mapRowToProjectPath;
    private mapRowToInitializationProgress;
    private mapRowToDetectedPattern;
    private mapRowToQuestionnaireResponse;
    private mapRowToAnalysisResult;
    private mapFieldToColumn;
}
//# sourceMappingURL=postgresql.d.ts.map