/**
 * Quality Checker Service Interfaces
 * SOLID Principles: Interface Segregation - Specific interfaces for each concern
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

// Service Interfaces (SOLID: Interface Segregation)

export interface ICompilationService {
  runCompilationChecks(subTaskResults: SubTaskResult[]): Promise<CompilationResult>;
  runTypeScriptCompilation(): Promise<CompilationResult>;
  runJavaScriptSyntaxCheck(subTaskResults: SubTaskResult[]): Promise<CompilationResult>;
}

export interface ITestingService {
  runTestChecks(subTaskResults: SubTaskResult[]): Promise<TestResult>;
  runJestTests(): Promise<TestResult>;
  runMochaTests(): Promise<TestResult>;
}

export interface ISecurityService {
  runSecurityChecks(subTaskResults: SubTaskResult[]): Promise<SecurityResult>;
  scanForVulnerabilities(filePaths: string[]): Promise<SecurityResult>;
}

export interface IArchitectureService {
  runArchitectureChecks(subTaskResults: SubTaskResult[]): Promise<ArchitectureResult>;
  checkSOLIDPrinciples(filePaths: string[]): Promise<ArchitectureResult['solidPrinciples']>;
  analyzeCodeQuality(filePaths: string[]): Promise<ArchitectureResult['codeQuality']>;
  detectArchitecturalPatterns(subTaskResults: SubTaskResult[]): Promise<ArchitectureResult['patterns']>;
}

export interface IQualityScoreCalculator {
  calculateOverallScore(
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    architecture: ArchitectureResult
  ): number;
  determineQualityPassed(
    overallScore: number,
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    thresholds: QualityThresholds
  ): boolean;
  generateRecommendations(
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    architecture: ArchitectureResult,
    thresholds: QualityThresholds
  ): string[];
}