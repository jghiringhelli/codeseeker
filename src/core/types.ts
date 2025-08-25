/**
 * Core type definitions for the Intelligent Code Auxiliary System
 */

// === PROJECT TYPES ===
export interface ProjectContext {
  path: string;
  name: string;
  type?: ProjectType;
  languages: string[];
  frameworks: string[];
  size: ProjectSize;
  domain?: string;
}

export enum ProjectType {
  WEB_APPLICATION = 'web_application',
  API_SERVICE = 'api_service',
  LIBRARY = 'library',
  MOBILE_APP = 'mobile_app',
  DESKTOP_APP = 'desktop_app',
  CLI_TOOL = 'cli_tool',
  UNKNOWN = 'unknown'
}

export enum ProjectSize {
  SMALL = 'small',      // < 100 files
  MEDIUM = 'medium',    // 100-1000 files
  LARGE = 'large',      // 1000-10000 files
  ENTERPRISE = 'enterprise' // 10000+ files
}

// === INITIALIZATION TYPES ===
export enum InitPhase {
  PROJECT_DISCOVERY = 'project_discovery',
  PATTERN_ANALYSIS = 'pattern_analysis',
  STANDARDS_INFERENCE = 'standards_inference',
  SMART_QUESTIONING = 'smart_questioning',
  DEEP_ANALYSIS = 'deep_analysis',
  CONFIGURATION_GENERATION = 'configuration_generation',
  CLAUDE_MD_UPDATE = 'claude_md_update',
  COMPLETED = 'completed'
}

export interface InitializationProgress {
  id?: number;
  projectPath: string;
  phase: InitPhase;
  resumeToken: string;
  progressData: ProgressData;
  techStackData?: TechStackInfo;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProgressData {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  currentFile?: string;
  estimatedTimeRemaining?: number;
  batchSize: number;
  processingStartTime: Date;
}

export interface TechStackInfo {
  languages: Record<string, string>; // language -> version
  frameworks: Record<string, string>; // framework -> version
  tools: Record<string, string>; // tool -> version
  packageManagers: string[];
  buildTools: string[];
}

// === PATTERN DETECTION TYPES ===
export interface DetectedPattern {
  id?: number;
  projectPath: string;
  patternType: PatternType;
  patternName: string;
  confidence: number;
  evidence: Evidence[];
  createdAt?: Date;
}

export enum PatternType {
  ARCHITECTURE = 'architecture',
  DESIGN_PATTERN = 'design_pattern',
  CODING_STANDARD = 'coding_standard',
  TESTING_PATTERN = 'testing_pattern'
}

export interface Evidence {
  type: EvidenceType;
  location: SourceLocation;
  description: string;
  confidence: number;
}

export enum EvidenceType {
  FILE_STRUCTURE = 'file_structure',
  CODE_PATTERN = 'code_pattern',
  NAMING_CONVENTION = 'naming_convention',
  IMPORT_PATTERN = 'import_pattern',
  CONFIGURATION = 'configuration'
}

export interface SourceLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

// === QUESTIONING SYSTEM TYPES ===
export interface QuestionnaireResponse {
  id?: number;
  projectPath: string;
  category: QuestionCategory;
  questionId: string;
  response: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export enum QuestionCategory {
  ARCHITECTURE = 'architecture',
  STANDARDS = 'standards',
  PATTERNS = 'patterns',
  PURPOSE = 'purpose',
  QUALITY = 'quality'
}

export interface SmartQuestion {
  id: string;
  category: QuestionCategory;
  text: string;
  options?: string[];
  context: QuestionContext;
  impact: QuestionImpact;
  multiple?: boolean;
  recommendation?: string;
  reasoning?: string;
}

export interface QuestionContext {
  projectType: ProjectType;
  detectedPatterns: string[];
  techStack: string[];
  projectSize: ProjectSize;
}

export enum QuestionImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// === ANALYSIS RESULT TYPES ===
export interface AnalysisResult {
  id?: number;
  projectPath: string;
  filePath: string;
  fileHash: string;
  analysisType: AnalysisType;
  result: Record<string, unknown>;
  confidenceScore?: number;
  createdAt?: Date;
}

export enum AnalysisType {
  PATTERN = 'pattern',
  QUALITY = 'quality',
  ARCHITECTURE = 'architecture',
  TECH_STACK = 'tech_stack',
  DUPLICATION = 'duplication'
}

// === ERROR HANDLING TYPES ===
export interface SystemError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: Date;
}

export enum ErrorCode {
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  MCP_ERROR = 'MCP_ERROR'
}

// === MCP TOOL TYPES ===
export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: SystemError;
  metadata?: Record<string, unknown>;
}

export interface InitializationRequest {
  projectPath: string;
  mode: InitializationMode;
  batchSize?: number;
  resumeToken?: string;
  claudeMdPath?: string;
}

export enum InitializationMode {
  GREENFIELD = 'greenfield',
  LEGACY = 'legacy',
  AUTO = 'auto'
}

export interface SmartQuestionRequest {
  projectContext: ProjectContext;
  questionCategories?: QuestionCategory[];
  maxQuestions?: number;
}

export interface ResumeInitializationRequest {
  resumeToken: string;
}