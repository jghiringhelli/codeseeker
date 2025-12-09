/**
 * Duplication Detection Interfaces
 * SOLID Principles: Interface Segregation - Separate interfaces for different responsibilities
 */

import { ASTAnalysisResult } from '../../../../shared/ast/analyzer';

// Main interfaces for duplication detection
export interface DuplicationScanRequest {
  projectPath: string;
  includeSemantic: boolean;
  similarityThreshold: number;
  includeRefactoringSuggestions: boolean;
  filePatterns?: string[];
  excludePatterns?: string[];
}

export interface DuplicationResult {
  duplicates: DuplicationGroup[];
  scanInfo: ScanInfo;
  statistics: DuplicationStatistics;
}

export interface DuplicationGroup {
  id: string;
  type: DuplicationType;
  similarity: number;
  locations: CodeLocation[];
  refactoring?: RefactoringAdvice;
  metadata: {
    linesOfCode: number;
    tokenCount: number;
    complexity: number;
  };
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  codeSnippet: string;
  hash: string;
}

export interface RefactoringAdvice {
  approach: RefactoringApproach;
  description: string;
  estimatedEffort: EffortEstimate;
  steps: string[];
  example?: string;
  impact: RefactoringImpact;
}

export interface ScanInfo {
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  processingTime: number;
  timestamp: Date;
}

export interface DuplicationStatistics {
  totalDuplicates: number;
  byType: Record<DuplicationType, number>;
  bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
  estimatedTechnicalDebt: {
    linesOfCode: number;
    maintenanceHours: number;
    riskScore: number;
  };
}

export enum DuplicationType {
  EXACT = 'exact',
  STRUCTURAL = 'structural',
  SEMANTIC = 'semantic',
  RENAMED = 'renamed'
}

export enum RefactoringApproach {
  EXTRACT_FUNCTION = 'extract_function',
  EXTRACT_CLASS = 'extract_class',
  EXTRACT_UTILITY = 'extract_utility',
  USE_INHERITANCE = 'use_inheritance',
  APPLY_STRATEGY_PATTERN = 'apply_strategy_pattern',
  CONSOLIDATE_CONFIGURATION = 'consolidate_configuration'
}

export enum EffortEstimate {
  LOW = 'low',        // < 30 minutes
  MEDIUM = 'medium',  // 30 minutes - 2 hours
  HIGH = 'high',      // 2-8 hours
  VERY_HIGH = 'very_high' // > 8 hours
}

export interface RefactoringImpact {
  maintainability: number;  // 0-100
  testability: number;     // 0-100
  reusability: number;     // 0-100
  riskLevel: number;       // 0-100
}

export interface CodeBlock {
  content: string;
  hash: string;
  location: CodeLocation;
  astInfo?: ASTAnalysisResult;
  tokens: string[];
  structure: StructuralFingerprint;
}

export interface StructuralFingerprint {
  functionCount: number;
  classCount: number;
  variableCount: number;
  controlFlowHash: string;
  dependencyHash: string;
}

// Service interfaces following SOLID principles
export interface IFileAnalysisService {
  getProjectFiles(projectPath: string, filePatterns?: string[], excludePatterns?: string[]): Promise<string[]>;
  extractCodeBlocks(filePath: string): Promise<CodeBlock[]>;
  analyzeFileStructure(filePath: string): Promise<StructuralFingerprint>;
}

export interface IDuplicationDetectionService {
  findExactDuplicates(codeBlocks: CodeBlock[]): DuplicationGroup[];
  findStructuralDuplicates(codeBlocks: CodeBlock[], threshold: number): DuplicationGroup[];
  findSemanticDuplicates(codeBlocks: CodeBlock[], threshold: number): Promise<DuplicationGroup[]>;
  findRenamedDuplicates(codeBlocks: CodeBlock[], threshold: number): DuplicationGroup[];
}

export interface IRefactoringAdvisorService {
  generateRefactoringAdvice(group: DuplicationGroup): RefactoringAdvice;
  estimateRefactoringEffort(group: DuplicationGroup): EffortEstimate;
  calculateRefactoringImpact(group: DuplicationGroup): RefactoringImpact;
}

export interface IStatisticsService {
  calculateStatistics(duplicates: DuplicationGroup[]): DuplicationStatistics;
  estimateTechnicalDebt(duplicates: DuplicationGroup[]): {
    linesOfCode: number;
    maintenanceHours: number;
    riskScore: number;
  };
  categorizeByType(duplicates: DuplicationGroup[]): Record<DuplicationType, number>;
  categorizeBySeverity(duplicates: DuplicationGroup[]): Record<'low' | 'medium' | 'high' | 'critical', number>;
  generateSummaryReport(duplicates: DuplicationGroup[]): string;
  identifyPriorityGroups(duplicates: DuplicationGroup[], topN?: number): DuplicationGroup[];
}