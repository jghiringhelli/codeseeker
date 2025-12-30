/**
 * PostgreSQL Adapter Interfaces
 * SOLID Principles: Interface Segregation
 */

import { Pool, PoolClient } from 'pg';
import { DatabaseConfig, Project, ProjectPath, DatabaseStats } from './base';
import {
  InitializationProgress,
  DetectedPattern,
  QuestionnaireResponse,
  AnalysisResult
} from '../../core/types';

// Service Interfaces (SOLID: Interface Segregation)
export interface IConnectionManager {
  initialize(config: DatabaseConfig): Promise<Pool>;
  close(): Promise<void>;
  migrate(): Promise<void>; // Keep original name to avoid breaking interface contracts
  isHealthy(): Promise<boolean>;
  getPool(): Pool;
}

export interface IProjectService {
  createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  getProject(projectPath: string): Promise<Project | null>;
  getProjectById(id: string): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listProjects(status?: string, limit?: number, offset?: number): Promise<Project[]>;
}

export interface IProjectPathService {
  addProjectPath(projectId: string, path: string, pathType: 'primary' | 'alias' | 'historical'): Promise<ProjectPath>;
  updateProjectPath(projectId: string, oldPath: string, newPath: string): Promise<void>;
  deactivateProjectPath(projectId: string, path: string): Promise<void>;
  getProjectByAnyPath(path: string): Promise<Project | null>;
  getProjectPaths(projectId: string): Promise<ProjectPath[]>;
}

export interface IInitializationService {
  saveInitializationProgress(progress: Omit<InitializationProgress, 'id' | 'createdAt' | 'updatedAt'>): Promise<InitializationProgress>;
  getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
  updateInitializationProgress(resumeToken: string, updates: Partial<InitializationProgress>): Promise<InitializationProgress>;
  cleanupExpiredResumeStates(): Promise<number>;
}

export interface IPatternService {
  saveDetectedPattern(pattern: Omit<DetectedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<DetectedPattern>;
  getDetectedPatterns(projectPath: string, patternType?: string): Promise<DetectedPattern[]>;
  updatePatternStatus(id: string, status: 'detected' | 'validated' | 'rejected'): Promise<void>;
}

export interface IQuestionnaireService {
  saveQuestionnaireResponse(response: Omit<QuestionnaireResponse, 'id' | 'createdAt'>): Promise<QuestionnaireResponse>;
  getQuestionnaireResponses(projectPath: string, category?: string): Promise<QuestionnaireResponse[]>;
}

export interface IAnalysisService {
  saveAnalysisResult(analysisResult: Omit<AnalysisResult, 'id' | 'createdAt'>): Promise<AnalysisResult>;
  getAnalysisResults(projectPath: string, analysisType?: string, fileHash?: string): Promise<AnalysisResult[]>;
  archiveOldAnalysisResults(olderThanDays: number): Promise<number>;
}

export interface IConfigService {
  getSystemConfig(key: string): Promise<any>;
  setSystemConfig(key: string, value: any, projectId?: string): Promise<void>;
}

export interface IMetricsService {
  getDatabaseStats(): Promise<DatabaseStats>;
  recordOperationMetrics(
    operation: string,
    projectId: string | null,
    durationMs: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void>;
}

export interface IDatabaseQuery {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}