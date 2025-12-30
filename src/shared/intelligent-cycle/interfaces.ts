/**
 * Intelligent Cycle Interfaces
 * SOLID Principles: Interface Segregation
 */

export interface SemanticDeduplicationResult {
  hasDuplicates: boolean;
  existingImplementations: ExistingImplementation[];
  semanticSimilarity: number;
  recommendations: string[];
  shouldProceed: boolean;
}

export interface ExistingImplementation {
  file: string;
  function?: string;
  class?: string;
  similarity: number;
  description: string;
  codeSnippet: string;
  lineRange: { start: number; end: number };
}

export interface IntentAnalysisResult {
  intendedFunctionality: string;
  detectedPatterns: string[];
  suggestedNames: string[];
  architecturalConcerns: string[];
  bestPractices: string[];
}

export interface SmartSecurityResult {
  vulnerabilities: SecurityVulnerability[];
  patterns: SecurityPattern[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file: string;
  line?: number;
  suggestion: string;
  example?: string;
}

export interface SecurityPattern {
  pattern: string;
  description: string;
  recommendation: string;
}

// Service Interfaces (SOLID: Interface Segregation)
export interface ISemanticDeduplicationService {
  checkSemanticDuplication(
    functionality: string,
    userIntent: string,
    projectPath: string,
    cacheKey?: string
  ): Promise<SemanticDeduplicationResult>;
}

export interface IIntentAnalysisService {
  analyzeUserIntent(userIntent: string): Promise<IntentAnalysisResult>;
  detectPatterns(functionality: string, projectPath: string): Promise<string[]>;
}

export interface ISimilarityMatchingService {
  findVectorSimilarityMatches(functionality: string): Promise<ExistingImplementation[]>;
  findRelationshipMatches(functionality: string): Promise<ExistingImplementation[]>;
  findSemanticMatches(functionality: string, projectPath: string): Promise<ExistingImplementation[]>;
}

export interface ISecurityScanningService {
  performSmartSecurity(
    functionality: string,
    userIntent: string,
    projectPath: string
  ): Promise<SmartSecurityResult>;
  scanForVulnerabilities(projectPath: string): Promise<SecurityVulnerability[]>;
}

export interface ICodeExtractionService {
  extractCodeSnippet(
    filePath: string,
    functionName?: string,
    className?: string,
    lineRange?: { start: number; end: number }
  ): Promise<string>;
}