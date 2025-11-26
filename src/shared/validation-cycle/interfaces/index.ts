/**
 * Validation Cycle Interfaces
 * SOLID Principles: Interface Segregation - Separate interfaces for different validation concerns
 */

// Core types
export interface ProjectContext {
  projectPath: string;
  changedFiles?: string[];
  requestType: 'code_modification' | 'analysis' | 'general';
  language?: string;
  framework?: string;
  userIntent?: string;
}

export interface CycleResult {
  success: boolean;
  duration: number;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  recommendations: string[];
}

export interface ValidationWarning {
  type: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'info' | 'warning' | 'error';
}

export interface ValidationError {
  type: string;
  message: string;
  file?: string;
  line?: number;
  blocking: boolean;
}

export interface CycleConfig {
  enableCoreCycle: boolean;
  enableQualityCycle: boolean;
  maxDuration: number;
  skipOnPatterns?: string[];
  qualityThresholds: {
    solidMinScore: number;
    maxDuplicationLines: number;
    maxComplexityPerFunction: number;
  };
}

export interface SafetyCheckResult {
  passed: boolean;
  issues: ValidationError[];
  warnings: ValidationWarning[];
  checkType: string;
}

export interface QualityMetrics {
  solidScore: number;
  duplicationLines: number;
  complexityScore: number;
  securityIssues: number;
}

// Service interfaces following SOLID principles
export interface ICoreSafetyService {
  runCoreSafetyChecks(context: ProjectContext): Promise<CycleResult>;
  validateCompilation(context: ProjectContext): Promise<SafetyCheckResult>;
  validateProjectStructure(context: ProjectContext): Promise<SafetyCheckResult>;
  validateBasicSafety(context: ProjectContext): Promise<SafetyCheckResult>;
}

export interface IQualityValidationService {
  runQualityChecks(context: ProjectContext): Promise<CycleResult>;
  analyzeSOLIDPrinciples(context: ProjectContext): Promise<SafetyCheckResult>;
  detectDuplication(context: ProjectContext): Promise<SafetyCheckResult>;
  analyzeComplexity(context: ProjectContext): Promise<SafetyCheckResult>;
  performSecurityScan(context: ProjectContext): Promise<SafetyCheckResult>;
}

export interface IValidationAggregatorService {
  aggregateResults(coreResult: CycleResult, qualityResult?: CycleResult): CycleResult;
  prioritizeIssues(results: CycleResult): CycleResult;
  generateRecommendations(results: CycleResult, context: ProjectContext): string[];
}

export interface IProjectAnalysisService {
  analyzeProjectStructure(projectPath: string): Promise<{
    language: string;
    framework: string;
    fileCount: number;
    structure: string[];
  }>;
  detectChangedFiles(projectPath: string, lastCheck?: Date): Promise<string[]>;
  getProjectMetrics(projectPath: string): Promise<QualityMetrics>;
}

export interface IValidationReportService {
  generateReport(result: CycleResult, context: ProjectContext): string;
  generateSummary(result: CycleResult): { status: string; summary: string };
  exportResults(result: CycleResult, format: 'json' | 'markdown' | 'text'): string;
}