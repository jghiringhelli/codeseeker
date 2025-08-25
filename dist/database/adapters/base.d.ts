/**
 * Base database adapter interface for CodeMind
 * Supports both SQLite and PostgreSQL implementations
 */
import { Logger } from '../../utils/logger';
import { InitializationProgress, DetectedPattern, QuestionnaireResponse, AnalysisResult, SystemError, ProjectType, ProjectSize } from '../../core/types';
export interface DatabaseConfig {
    type: 'sqlite' | 'postgresql';
    connectionString?: string;
    path?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
}
export interface Project {
    id: string;
    projectPath: string;
    projectName: string;
    projectType?: ProjectType;
    languages: string[];
    frameworks: string[];
    projectSize?: ProjectSize;
    domain?: string;
    totalFiles: number;
    totalLines: number;
    status: 'active' | 'archived' | 'analyzing';
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProjectPath {
    id: string;
    projectId: string;
    path: string;
    pathType: 'primary' | 'alias' | 'historical';
    isActive: boolean;
    createdAt: Date;
    deactivatedAt?: Date;
}
export interface DatabaseStats {
    projects: number;
    initialization_progress: number;
    detected_patterns: number;
    questionnaire_responses: number;
    analysis_results: number;
    active_projects: number;
}
export declare abstract class DatabaseAdapter {
    protected logger: Logger;
    protected config: DatabaseConfig;
    constructor(config: DatabaseConfig, logger: Logger);
    abstract initialize(): Promise<void>;
    abstract close(): Promise<void>;
    abstract migrate(): Promise<void>;
    abstract isHealthy(): Promise<boolean>;
    abstract createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
    abstract getProject(projectPath: string): Promise<Project | null>;
    abstract getProjectById(id: string): Promise<Project | null>;
    abstract updateProject(id: string, updates: Partial<Project>): Promise<Project>;
    abstract deleteProject(id: string): Promise<void>;
    abstract listProjects(status?: string, limit?: number, offset?: number): Promise<Project[]>;
    abstract addProjectPath(projectId: string, path: string, pathType: 'primary' | 'alias' | 'historical'): Promise<ProjectPath>;
    abstract updateProjectPath(projectId: string, oldPath: string, newPath: string): Promise<void>;
    abstract deactivateProjectPath(projectId: string, path: string): Promise<void>;
    abstract getProjectByAnyPath(path: string): Promise<Project | null>;
    abstract getProjectPaths(projectId: string): Promise<ProjectPath[]>;
    abstract saveInitializationProgress(progress: Omit<InitializationProgress, 'id' | 'createdAt' | 'updatedAt'>): Promise<InitializationProgress>;
    abstract getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
    abstract updateInitializationProgress(resumeToken: string, updates: Partial<InitializationProgress>): Promise<InitializationProgress>;
    abstract saveDetectedPattern(pattern: Omit<DetectedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<DetectedPattern>;
    abstract getDetectedPatterns(projectPath: string, patternType?: string): Promise<DetectedPattern[]>;
    abstract updatePatternStatus(id: string, status: 'detected' | 'validated' | 'rejected'): Promise<void>;
    abstract saveQuestionnaireResponse(response: Omit<QuestionnaireResponse, 'id' | 'createdAt'>): Promise<QuestionnaireResponse>;
    abstract getQuestionnaireResponses(projectPath: string, category?: string): Promise<QuestionnaireResponse[]>;
    abstract saveAnalysisResult(result: Omit<AnalysisResult, 'id' | 'createdAt'>): Promise<AnalysisResult>;
    abstract getAnalysisResults(projectPath: string, analysisType?: string, fileHash?: string): Promise<AnalysisResult[]>;
    abstract getSystemConfig(key: string): Promise<any>;
    abstract setSystemConfig(key: string, value: any, projectId?: string): Promise<void>;
    abstract getDatabaseStats(): Promise<DatabaseStats>;
    abstract recordOperationMetrics(operation: string, projectId: string | null, durationMs: number, success: boolean, error?: string, metadata?: Record<string, any>): Promise<void>;
    abstract cleanupExpiredResumeStates(): Promise<number>;
    abstract archiveOldAnalysisResults(olderThanDays: number): Promise<number>;
    protected handleError(operation: string, error: any): SystemError;
}
//# sourceMappingURL=base.d.ts.map