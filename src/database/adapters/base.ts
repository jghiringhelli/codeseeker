/**
 * Base database adapter interface for CodeSeeker
 * Supports both SQLite and PostgreSQL implementations
 */

import { Logger } from '../../utils/logger';
import {
  ProjectContext,
  InitializationProgress,
  DetectedPattern,
  QuestionnaireResponse,
  AnalysisResult,
  SystemError,
  ProjectType,
  ProjectSize,
  InitPhase
} from '../../core/types';

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

export abstract class DatabaseAdapter {
  protected logger: Logger;
  protected config: DatabaseConfig;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  // Connection management
  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract migrate(): Promise<void>;
  abstract isHealthy(): Promise<boolean>;

  // Project management
  abstract createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  abstract getProject(projectPath: string): Promise<Project | null>;
  abstract getProjectById(id: string): Promise<Project | null>;
  abstract updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  abstract deleteProject(id: string): Promise<void>;
  abstract listProjects(status?: string, limit?: number, offset?: number): Promise<Project[]>;

  // Project path management
  abstract addProjectPath(projectId: string, path: string, pathType: 'primary' | 'alias' | 'historical'): Promise<ProjectPath>;
  abstract updateProjectPath(projectId: string, oldPath: string, newPath: string): Promise<void>;
  abstract deactivateProjectPath(projectId: string, path: string): Promise<void>;
  abstract getProjectByAnyPath(path: string): Promise<Project | null>;
  abstract getProjectPaths(projectId: string): Promise<ProjectPath[]>;

  // Initialization progress
  abstract saveInitializationProgress(progress: Omit<InitializationProgress, 'id' | 'createdAt' | 'updatedAt'>): Promise<InitializationProgress>;
  abstract getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
  abstract updateInitializationProgress(resumeToken: string, updates: Partial<InitializationProgress>): Promise<InitializationProgress>;

  // Pattern detection
  abstract saveDetectedPattern(pattern: Omit<DetectedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<DetectedPattern>;
  abstract getDetectedPatterns(projectPath: string, patternType?: string): Promise<DetectedPattern[]>;
  abstract updatePatternStatus(id: string, status: 'detected' | 'validated' | 'rejected'): Promise<void>;

  // Questionnaire responses
  abstract saveQuestionnaireResponse(response: Omit<QuestionnaireResponse, 'id' | 'createdAt'>): Promise<QuestionnaireResponse>;
  abstract getQuestionnaireResponses(projectPath: string, category?: string): Promise<QuestionnaireResponse[]>;

  // Analysis results
  abstract saveAnalysisResult(result: Omit<AnalysisResult, 'id' | 'createdAt'>): Promise<AnalysisResult>;
  abstract getAnalysisResults(projectPath: string, analysisType?: string, fileHash?: string): Promise<AnalysisResult[]>;

  // System configuration
  abstract getSystemConfig(key: string): Promise<any>;
  abstract setSystemConfig(key: string, value: any, projectId?: string): Promise<void>;

  // Statistics and monitoring
  abstract getDatabaseStats(): Promise<DatabaseStats>;
  abstract recordOperationMetrics(operation: string, projectId: string | null, durationMs: number, success: boolean, error?: string, metadata?: Record<string, any>): Promise<void>;

  // Cleanup operations
  abstract cleanupExpiredResumeStates(): Promise<number>;
  abstract archiveOldAnalysisResults(olderThanDays: number): Promise<number>;

  // Helper methods
  protected handleError(operation: string, error: any): SystemError {
    this.logger.error(`Database ${operation} failed`, error as Error);
    return {
      code: 'DATABASE_ERROR' as any,
      message: `Database ${operation} failed`,
      details: { error: error instanceof Error ? error.message : String(error) },
      timestamp: new Date()
    };
  }
}