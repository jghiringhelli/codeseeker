/**
 * Quality Score Calculator Service
 * SOLID Principles: Single Responsibility - Handle quality scoring and recommendations only
 */

import { Logger } from '../../../utils/logger';
import {
  IQualityScoreCalculator,
  CompilationResult,
  TestResult,
  SecurityResult,
  ArchitectureResult,
  QualityThresholds
} from '../interfaces/index';

export class QualityScoreCalculator implements IQualityScoreCalculator {
  private logger = Logger.getInstance();

  calculateOverallScore(
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    architecture: ArchitectureResult
  ): number {
    let score = 0;

    // Compilation (30% weight)
    score += compilation.success ? 30 : 0;

    // Tests (25% weight)
    const testScore = tests.failed === 0 ? 25 : Math.max(0, 25 * (tests.passed / (tests.passed + tests.failed)));
    score += testScore;

    // Security (25% weight)
    score += (security.overallScore / 100) * 25;

    // Architecture (20% weight)
    score += (architecture.solidPrinciples.score / 100) * 20;

    return Math.round(score);
  }

  determineQualityPassed(
    overallScore: number,
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    thresholds: QualityThresholds
  ): boolean {
    // Must compile successfully
    if (!compilation.success) return false;

    // Must not have critical security vulnerabilities
    const criticalVulns = security.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) return false;

    // Must meet minimum score threshold
    if (overallScore < thresholds.minimumScore) return false;

    // Must not have failing tests
    if (tests.failed > 0) return false;

    return true;
  }

  generateRecommendations(
    compilation: CompilationResult,
    tests: TestResult,
    security: SecurityResult,
    architecture: ArchitectureResult,
    thresholds: QualityThresholds
  ): string[] {
    const recommendations: string[] = [];
    const blockers: string[] = [];

    // Compilation blockers
    if (!compilation.success) {
      blockers.push('Fix compilation errors before proceeding');
      compilation.errors.forEach(error => blockers.push(`  - ${error}`));
    }

    // Test blockers
    if (tests.failed > 0) {
      blockers.push('Fix failing tests before proceeding');
      tests.failedTests.slice(0, 3).forEach(test => blockers.push(`  - ${test}`));
    }

    // Security blockers
    const criticalVulns = security.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      blockers.push('Fix critical security vulnerabilities');
      criticalVulns.forEach(vuln => blockers.push(`  - ${vuln.file}: ${vuln.description}`));
    }

    // Quality recommendations
    if (tests.coverage < thresholds.testCoverage) {
      recommendations.push(`Increase test coverage from ${tests.coverage}% to ${thresholds.testCoverage}%`);
    }

    if (architecture.solidPrinciples.score < 80) {
      recommendations.push('Improve adherence to SOLID principles');

      if (!architecture.solidPrinciples.singleResponsibility) {
        recommendations.push('  - Break down large classes with multiple responsibilities');
      }
      if (!architecture.solidPrinciples.openClosed) {
        recommendations.push('  - Use inheritance and interfaces instead of modifying existing classes');
      }
      if (!architecture.solidPrinciples.dependencyInversion) {
        recommendations.push('  - Use dependency injection instead of direct instantiation');
      }
      if (!architecture.solidPrinciples.interfaceSegregation) {
        recommendations.push('  - Split large interfaces into focused, specific ones');
      }
    }

    if (security.vulnerabilities.length > 0) {
      recommendations.push('Address security vulnerabilities found in code analysis');

      const highVulns = security.vulnerabilities.filter(v => v.severity === 'high');
      const mediumVulns = security.vulnerabilities.filter(v => v.severity === 'medium');

      if (highVulns.length > 0) {
        recommendations.push(`  - ${highVulns.length} high severity vulnerabilities need immediate attention`);
      }
      if (mediumVulns.length > 0) {
        recommendations.push(`  - ${mediumVulns.length} medium severity vulnerabilities should be addressed`);
      }
    }

    // Code quality recommendations
    if (architecture.codeQuality.complexity > thresholds.maxComplexity) {
      recommendations.push(`Reduce cyclomatic complexity (current: ${architecture.codeQuality.complexity}, max: ${thresholds.maxComplexity})`);
    }

    if (architecture.codeQuality.duplication > thresholds.maxDuplication) {
      recommendations.push(`Reduce code duplication (current: ${architecture.codeQuality.duplication}%, max: ${thresholds.maxDuplication}%)`);
    }

    if (architecture.codeQuality.maintainability < 70) {
      recommendations.push('Improve code maintainability by reducing complexity and duplication');
    }

    if (architecture.codeQuality.readability < 70) {
      recommendations.push('Improve code readability with better naming and documentation');
    }

    // Architecture pattern recommendations
    recommendations.push(...architecture.patterns.recommendations);

    // Anti-pattern warnings
    if (architecture.patterns.antiPatterns.length > 0) {
      recommendations.push('Address detected anti-patterns:');
      architecture.patterns.antiPatterns.forEach(pattern => {
        recommendations.push(`  - ${pattern}`);
      });
    }

    // Compilation warnings
    if (compilation.warnings.length > 0) {
      recommendations.push(`Address ${compilation.warnings.length} compilation warnings`);
    }

    // Combine blockers and recommendations, with blockers first
    return [...blockers, ...recommendations];
  }
}