/**
 * Quality Assurance Service
 * SOLID Principles: Single Responsibility - Handle quality checks and validation only
 */

import { Logger } from '../../../shared/logger';
import { QualityToolManager } from '../../../services/managers/quality-manager';
import {
  IQualityAssuranceService,
  QualityCheckResult,
  SubTaskResult
} from '../interfaces/index';

export class QualityAssuranceService implements IQualityAssuranceService {
  private logger = Logger.getInstance();
  private qualityManager: QualityToolManager;

  constructor(qualityManager?: QualityToolManager) {
    this.qualityManager = qualityManager || new QualityToolManager();
  }

  async runQualityChecks(results: SubTaskResult[]): Promise<QualityCheckResult> {
    this.logger.info('🔍 Running comprehensive quality checks...');

    const filesModified = this.extractUniqueFiles(results);

    try {
      // Run all quality checks in parallel for speed
      const [compilation, tests, codeQuality] = await Promise.all([
        this.validateCompilation(filesModified),
        this.runTests(process.cwd()), // Assuming we're in project directory
        this.checkCodeQuality(filesModified)
      ]);

      // Calculate overall score
      const analysisDetails = await this.generateAnalysisDetails(filesModified);
      const overallScore = this.calculateOverallScore(compilation, tests, codeQuality, analysisDetails);

      const result: QualityCheckResult = {
        compilation,
        tests,
        codeQuality,
        overallScore,
        issues: this.collectIssues(analysisDetails),
        analysisDetails
      };

      this.logger.info(`Quality check completed: ${overallScore}% overall score`);
      return result;
    } catch (error) {
      this.logger.error('Quality check failed:', error);

      // Return failed result
      return this.createFailedQualityResult(error);
    }
  }

  async validateCompilation(filesModified: string[]): Promise<{ success: boolean; errors: any[] }> {
    this.logger.debug('🔧 Validating compilation...');

    try {
      // Use quality manager's compilation check
      const result = await this.qualityManager.runCompilationCheck(process.cwd());

      return {
        success: result.success,
        errors: result.errors || []
      };
    } catch (error) {
      this.logger.error('Compilation validation failed:', error);

      return {
        success: false,
        errors: [{
          type: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
          file: undefined,
          line: undefined
        }]
      };
    }
  }

  async runTests(projectPath: string): Promise<{ passed: number; failed: number; coverage: number }> {
    this.logger.debug('🧪 Running tests...');

    try {
      const result = await this.qualityManager.runTests(projectPath);

      return {
        passed: result.passed || 0,
        failed: result.failed || 0,
        coverage: result.coverage || 0
      };
    } catch (error) {
      this.logger.error('Test execution failed:', error);

      return {
        passed: 0,
        failed: 1,
        coverage: 0
      };
    }
  }

  async checkCodeQuality(filesModified: string[]): Promise<{
    solidPrinciples: boolean;
    security: boolean;
    architecture: boolean;
  }> {
    this.logger.debug('📊 Checking code quality...');

    try {
      // Run multiple quality checks
      const [solidResult, securityResult, architectureResult] = await Promise.all([
        this.checkSOLIDPrinciples(filesModified),
        this.checkSecurity(filesModified),
        this.checkArchitecture(filesModified)
      ]);

      return {
        solidPrinciples: solidResult,
        security: securityResult,
        architecture: architectureResult
      };
    } catch (error) {
      this.logger.error('Code quality check failed:', error);

      return {
        solidPrinciples: false,
        security: false,
        architecture: false
      };
    }
  }

  private async generateAnalysisDetails(filesModified: string[]): Promise<QualityCheckResult['analysisDetails']> {
    try {
      // Run detailed analysis for each category
      const [linting, security, dependencies, complexity, testing, taskExecution] = await Promise.all([
        this.analyzeLinting(filesModified),
        this.analyzeSecurity(filesModified),
        this.analyzeDependencies(filesModified),
        this.analyzeComplexity(filesModified),
        this.analyzeTesting(filesModified),
        this.analyzeTaskExecution()
      ]);

      return {
        linting,
        security,
        dependencies,
        complexity,
        testing,
        taskExecution
      };
    } catch (error) {
      this.logger.error('Failed to generate analysis details:', error);

      // Return empty analysis
      return {
        linting: { penalty: 0, issues: [] },
        security: { penalty: 0, issues: [] },
        dependencies: { penalty: 0, issues: [] },
        complexity: { penalty: 0, issues: [] },
        testing: { penalty: 0, issues: [], results: {} },
        taskExecution: { penalty: 0, issues: [] }
      };
    }
  }

  private async checkSOLIDPrinciples(filesModified: string[]): Promise<boolean> {
    try {
      const result = await this.qualityManager.runSOLIDAnalysis(process.cwd());
      return result.overallScore >= 0.7; // 70% threshold
    } catch {
      return false;
    }
  }

  private async checkSecurity(filesModified: string[]): Promise<boolean> {
    try {
      const result = await this.qualityManager.runSecurityAnalysis(process.cwd());
      return result.securityScore >= 0.8; // 80% threshold for security
    } catch {
      return false;
    }
  }

  private async checkArchitecture(filesModified: string[]): Promise<boolean> {
    try {
      // Architecture check could be more sophisticated
      // For now, check if files follow expected patterns
      const hasProperStructure = filesModified.every(file => {
        // Basic structure checks
        return !file.includes('..') && // No relative path traversal
               !file.startsWith('/') && // No absolute paths
               file.includes('/'); // Should be in a directory
      });

      return hasProperStructure;
    } catch {
      return false;
    }
  }

  private async analyzeLinting(filesModified: string[]): Promise<{ penalty: number; issues: string[] }> {
    try {
      const result = await this.qualityManager.runLintingCheck(process.cwd());
      return {
        penalty: Math.min(result.errorCount * 2 + result.warningCount, 20), // Max 20 penalty
        issues: result.issues || []
      };
    } catch {
      return { penalty: 5, issues: ['Linting check failed'] };
    }
  }

  private async analyzeSecurity(filesModified: string[]): Promise<{ penalty: number; issues: string[] }> {
    try {
      const result = await this.qualityManager.runSecurityAnalysis(process.cwd());
      const criticalIssues = result.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
      const highIssues = result.vulnerabilities?.filter(v => v.severity === 'high').length || 0;

      return {
        penalty: criticalIssues * 15 + highIssues * 8, // Heavy penalty for security issues
        issues: result.vulnerabilities?.map(v => v.description) || []
      };
    } catch {
      return { penalty: 5, issues: ['Security analysis failed'] };
    }
  }

  private async analyzeDependencies(filesModified: string[]): Promise<{ penalty: number; issues: string[] }> {
    try {
      // Simple dependency analysis
      const issues: string[] = [];
      let penalty = 0;

      for (const file of filesModified) {
        if (file.includes('node_modules')) {
          issues.push(`Modified file in node_modules: ${file}`);
          penalty += 10;
        }
      }

      return { penalty, issues };
    } catch {
      return { penalty: 2, issues: ['Dependency analysis failed'] };
    }
  }

  private async analyzeComplexity(filesModified: string[]): Promise<{ penalty: number; issues: string[] }> {
    try {
      // Basic complexity analysis
      const issues: string[] = [];
      let penalty = 0;

      // Penalize large number of files modified
      if (filesModified.length > 10) {
        issues.push(`High number of files modified: ${filesModified.length}`);
        penalty += Math.min((filesModified.length - 10) * 2, 15);
      }

      return { penalty, issues };
    } catch {
      return { penalty: 3, issues: ['Complexity analysis failed'] };
    }
  }

  private async analyzeTesting(filesModified: string[]): Promise<{ penalty: number; issues: string[]; results: any }> {
    try {
      const testResult = await this.runTests(process.cwd());
      const issues: string[] = [];
      let penalty = 0;

      if (testResult.failed > 0) {
        issues.push(`${testResult.failed} test(s) failed`);
        penalty += testResult.failed * 5;
      }

      if (testResult.coverage < 70) {
        issues.push(`Low test coverage: ${testResult.coverage}%`);
        penalty += (70 - testResult.coverage) / 10;
      }

      return {
        penalty: Math.min(penalty, 25), // Cap penalty at 25
        issues,
        results: testResult
      };
    } catch {
      return {
        penalty: 10,
        issues: ['Test analysis failed'],
        results: {}
      };
    }
  }

  private async analyzeTaskExecution(): Promise<{ penalty: number; issues: string[] }> {
    // This would analyze how well tasks were executed
    return { penalty: 0, issues: [] };
  }

  private calculateOverallScore(
    compilation: { success: boolean; errors: any[] },
    tests: { passed: number; failed: number; coverage: number },
    codeQuality: { solidPrinciples: boolean; security: boolean; architecture: boolean },
    analysisDetails?: QualityCheckResult['analysisDetails']
  ): number {
    let score = 100;

    // Critical factors
    if (!compilation.success) score -= 30; // Compilation failures are critical
    if (!codeQuality.security) score -= 20; // Security issues are critical

    // Important factors
    if (!codeQuality.solidPrinciples) score -= 15;
    if (!codeQuality.architecture) score -= 10;

    // Test results
    const totalTests = tests.passed + tests.failed;
    if (totalTests > 0) {
      const testSuccessRate = tests.passed / totalTests;
      score -= (1 - testSuccessRate) * 15; // Up to 15 points for test failures
    }

    if (tests.coverage < 70) {
      score -= (70 - tests.coverage) / 5; // Penalty for low coverage
    }

    // Apply analysis penalties
    if (analysisDetails) {
      score -= analysisDetails.linting.penalty;
      score -= analysisDetails.security.penalty;
      score -= analysisDetails.dependencies.penalty;
      score -= analysisDetails.complexity.penalty;
      score -= analysisDetails.testing.penalty;
      score -= analysisDetails.taskExecution.penalty;
    }

    return Math.max(0, Math.round(score));
  }

  private collectIssues(analysisDetails?: QualityCheckResult['analysisDetails']): string[] {
    if (!analysisDetails) return [];

    const allIssues: string[] = [];

    allIssues.push(...analysisDetails.linting.issues);
    allIssues.push(...analysisDetails.security.issues);
    allIssues.push(...analysisDetails.dependencies.issues);
    allIssues.push(...analysisDetails.complexity.issues);
    allIssues.push(...analysisDetails.testing.issues);
    allIssues.push(...analysisDetails.taskExecution.issues);

    return allIssues;
  }

  private extractUniqueFiles(results: SubTaskResult[]): string[] {
    const allFiles = new Set<string>();

    for (const result of results) {
      for (const file of result.filesModified) {
        allFiles.add(file);
      }
    }

    return Array.from(allFiles);
  }

  private createFailedQualityResult(error: any): QualityCheckResult {
    return {
      compilation: { success: false, errors: [error.message] },
      tests: { passed: 0, failed: 1, coverage: 0 },
      codeQuality: { solidPrinciples: false, security: false, architecture: false },
      overallScore: 0,
      issues: ['Quality check system failed'],
      analysisDetails: {
        linting: { penalty: 50, issues: ['Quality system error'] },
        security: { penalty: 50, issues: ['Quality system error'] },
        dependencies: { penalty: 50, issues: ['Quality system error'] },
        complexity: { penalty: 50, issues: ['Quality system error'] },
        testing: { penalty: 50, issues: ['Quality system error'], results: {} },
        taskExecution: { penalty: 50, issues: ['Quality system error'] }
      }
    };
  }
}