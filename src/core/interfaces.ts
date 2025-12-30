/**
 * Core interface definitions for the Intelligent Code Auxiliary System
 */

import {
  ProjectContext,
  InitializationProgress,
  DetectedPattern,
  QuestionnaireResponse,
  SmartQuestion,
  AnalysisResult,
  MCPToolResult,
  InitializationRequest,
  SmartQuestionRequest,
  ResumeInitializationRequest
} from './types';

// === DATABASE INTERFACES ===
export interface DatabaseManager {
  initialize(): Promise<void>;
  close(): Promise<void>;
  migrate(): Promise<void>;
  
  // Initialization progress management
  saveInitializationProgress(progress: InitializationProgress): Promise<InitializationProgress>;
  getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
  updateInitializationProgress(progress: InitializationProgress): Promise<void>;
  deleteInitializationProgress(projectPath: string): Promise<void>;
  
  // Pattern detection storage
  saveDetectedPattern(pattern: DetectedPattern): Promise<DetectedPattern>;
  getDetectedPatterns(projectPath: string): Promise<DetectedPattern[]>;
  deleteDetectedPatterns(projectPath: string): Promise<void>;
  
  // Questionnaire responses
  saveQuestionnaireResponse(response: QuestionnaireResponse): Promise<QuestionnaireResponse>;
  getQuestionnaireResponses(projectPath: string): Promise<QuestionnaireResponse[]>;
  
  // Analysis results
  saveAnalysisResult(result: AnalysisResult): Promise<AnalysisResult>;
  getAnalysisResults(projectPath: string, analysisType?: string): Promise<AnalysisResult[]>;
}

// === INITIALIZATION SYSTEM INTERFACES ===
export interface InitializationSystem {
  initialize(request: InitializationRequest): Promise<MCPToolResult<InitializationProgress>>;
  resume(request: ResumeInitializationRequest): Promise<MCPToolResult<InitializationProgress>>;
  getProgress(projectPath: string): Promise<MCPToolResult<InitializationProgress>>;
}

export interface ProjectProfiler {
  analyzeProject(projectPath: string): Promise<ProjectContext>;
  detectTechStack(projectPath: string): Promise<any>;
  estimateProjectSize(projectPath: string): Promise<any>;
}

export interface SmartQuestionnaire {
  generateQuestions(request: SmartQuestionRequest): Promise<SmartQuestion[]>;
  validateResponse(questionId: string, response: string): boolean;
  getRecommendation(questionId: string, response: string): string | undefined;
}

export interface PatternDetector {
  detectArchitecturalPatterns(projectPath: string): Promise<DetectedPattern[]>;
  detectDesignPatterns(projectPath: string): Promise<DetectedPattern[]>;
  detectCodingStandards(projectPath: string): Promise<DetectedPattern[]>;
}

export interface StandardsInferencer {
  inferFromExistingCode(projectPath: string): Promise<Record<string, unknown>>;
  generateRecommendations(patterns: DetectedPattern[]): Promise<string[]>;
}

export interface PurposeAnalyzer {
  analyzeDomain(projectPath: string, projectContext: ProjectContext): Promise<string>;
  identifyBusinessRules(projectPath: string): Promise<string[]>;
}

// === BATCH PROCESSING INTERFACES ===
export interface BatchProcessor {
  processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]>;
  
  processWithResume<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    resumeToken: string,
    batchSize: number
  ): Promise<{results: R[]; completed: boolean; newResumeToken: string}>;
}

export interface ProgressTracker {
  startTracking(projectPath: string, totalItems: number): string; // returns resume token
  updateProgress(resumeToken: string, processedCount: number, currentItem?: string): void;
  getProgress(resumeToken: string): InitializationProgress | null;
  completeTracking(resumeToken: string): void;
}

export interface ResumableAnalyzer {
  saveState(resumeToken: string, state: any): Promise<void>;
  loadState(resumeToken: string): Promise<any | null>;
  clearState(resumeToken: string): Promise<void>;
}

// === MCP SERVER INTERFACES ===
export interface MCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(name: string, handler: MCPToolHandler): void;
}

export interface MCPToolHandler {
  (params: any): Promise<MCPToolResult>;
}

// === UTILITY INTERFACES ===
export interface FileSystemHelper {
  getAllFiles(directory: string, extensions?: string[]): Promise<string[]>;
  getFileContent(filePath: string): Promise<string>;
  getFileStats(filePath: string): Promise<any>;
  fileExists(filePath: string): Promise<boolean>;
  createDirectory(directoryPath: string): Promise<void>;
  writeFile(filePath: string, content: string): Promise<void>;
}

export interface CacheManager<K, V> {
  get(key: K): Promise<V | null>;
  set(key: K, value: V, ttl?: number): Promise<void>;
  delete(key: K): Promise<void>;
  clear(): Promise<void>;
  has(key: K): Promise<boolean>;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

export interface ConfigManager {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  load(configPath?: string): Promise<void>;
  save(configPath?: string): Promise<void>;
}

// === ANALYSIS ENGINE INTERFACES (for future phases) ===
export interface AnalysisEngine {
  analyzeFile(filePath: string): Promise<AnalysisResult[]>;
  analyzeProject(projectPath: string): Promise<AnalysisResult[]>;
  detectDuplication(projectPath: string): Promise<AnalysisResult[]>;
  generateQualityReport(projectPath: string): Promise<any>;
}