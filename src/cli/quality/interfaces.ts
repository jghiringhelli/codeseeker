/**
 * Quality Checker Interfaces
 * Shared interfaces for quality checking components
 */

export interface SubTaskResult {
  success: boolean;
  filesModified: string[];
  summary: string;
  changes: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
  };
}

export interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface TestResult {
  passed: number;
  failed: number;
  coverage: number;
  duration: number;
  failedTests: string[];
  coverageFiles: {
    file: string;
    coverage: number;
  }[];
}

export interface SecurityResult {
  vulnerabilities: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    file: string;
    line?: number;
    description: string;
  }[];
  overallScore: number;
}

export interface ArchitectureResult {
  solidPrinciples: {
    singleResponsibility: boolean;
    openClosed: boolean;
    liskovSubstitution: boolean;
    interfaceSegregation: boolean;
    dependencyInversion: boolean;
    score: number;
  };
  codeQuality: {
    maintainability: number;
    readability: number;
    complexity: number;
    duplication: number;
  };
  patterns: {
    detectedPatterns: string[];
    antiPatterns: string[];
    recommendations: string[];
  };
}

export interface QualityCheckResult {
  compilation: CompilationResult;
  tests: TestResult;
  security: SecurityResult;
  architecture: ArchitectureResult;
  overallScore: number;
  passed: boolean;
  recommendations: string[];
  blockers: string[];
}

export interface QualityThresholds {
  minimumScore: number;
  testCoverage: number;
  maxComplexity: number;
  maxDuplication: number;
}