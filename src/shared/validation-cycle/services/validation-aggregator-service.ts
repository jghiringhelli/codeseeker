/**
 * Validation Aggregator Service
 * SOLID Principles: Single Responsibility - Handle result aggregation and prioritization only
 */

import { Logger } from '../../logger';
import {
  IValidationAggregatorService,
  CycleResult,
  ProjectContext,
  ValidationError,
  ValidationWarning
} from '../interfaces/index';

export class ValidationAggregatorService implements IValidationAggregatorService {
  private logger = Logger.getInstance();

  aggregateResults(coreResult: CycleResult, qualityResult?: CycleResult): CycleResult {
    const aggregated: CycleResult = {
      success: coreResult.success && (qualityResult?.success ?? true),
      duration: coreResult.duration + (qualityResult?.duration ?? 0),
      warnings: [...coreResult.warnings],
      errors: [...coreResult.errors],
      recommendations: [...coreResult.recommendations]
    };

    // Add quality results if available
    if (qualityResult) {
      aggregated.warnings.push(...qualityResult.warnings);
      aggregated.errors.push(...qualityResult.errors);
      aggregated.recommendations.push(...qualityResult.recommendations);
    }

    // Prioritize and deduplicate
    const prioritized = this.prioritizeIssues(aggregated);

    this.logger.debug(
      `Aggregated results: ${prioritized.errors.length} errors, ${prioritized.warnings.length} warnings`
    );

    return prioritized;
  }

  prioritizeIssues(results: CycleResult): CycleResult {
    // Sort errors by blocking status and severity
    const prioritizedErrors = this.prioritizeErrors(results.errors);
    const prioritizedWarnings = this.prioritizeWarnings(results.warnings);

    // Remove duplicates
    const uniqueErrors = this.deduplicateErrors(prioritizedErrors);
    const uniqueWarnings = this.deduplicateWarnings(prioritizedWarnings);

    return {
      ...results,
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      recommendations: this.deduplicateRecommendations(results.recommendations)
    };
  }

  generateRecommendations(results: CycleResult, context: ProjectContext): string[] {
    const recommendations = new Set<string>();

    // Add existing recommendations
    results.recommendations.forEach(rec => recommendations.add(rec));

    // Generate recommendations based on error patterns
    const errorTypes = new Set(results.errors.map(e => e.type));
    const warningTypes = new Set(results.warnings.map(w => w.type));

    // Compilation-related recommendations
    if (errorTypes.has('compilation_error')) {
      recommendations.add('Fix compilation errors before proceeding with development');
      recommendations.add('Consider setting up automated compilation checks in your CI/CD pipeline');
    }

    // Security-related recommendations
    if (errorTypes.has('security_vulnerability') || warningTypes.has('security_warning')) {
      recommendations.add('Review and address security vulnerabilities');
      recommendations.add('Consider implementing security scanning in your development workflow');
    }

    // SOLID principles recommendations
    if (warningTypes.has('solid_violation') || warningTypes.has('solid_score_low')) {
      recommendations.add('Refactor code to better follow SOLID principles for improved maintainability');
    }

    // Duplication recommendations
    if (warningTypes.has('excessive_duplication') || warningTypes.has('code_duplication')) {
      recommendations.add('Extract common functionality into reusable components or utilities');
    }

    // Complexity recommendations
    if (warningTypes.has('high_complexity')) {
      recommendations.add('Break down complex functions into smaller, more focused units');
    }

    // Project-specific recommendations
    this.addProjectSpecificRecommendations(recommendations, context, errorTypes, warningTypes);

    return Array.from(recommendations).slice(0, 8); // Limit to 8 recommendations
  }

  private prioritizeErrors(errors: ValidationError[]): ValidationError[] {
    return errors.sort((a, b) => {
      // Blocking errors first
      if (a.blocking !== b.blocking) {
        return a.blocking ? -1 : 1;
      }

      // Then by type priority
      const typePriority = this.getErrorTypePriority(a.type) - this.getErrorTypePriority(b.type);
      if (typePriority !== 0) {
        return typePriority;
      }

      // Finally by message length (shorter = more critical usually)
      return a.message.length - b.message.length;
    });
  }

  private prioritizeWarnings(warnings: ValidationWarning[]): ValidationWarning[] {
    return warnings.sort((a, b) => {
      // By severity first
      const severityPriority = this.getSeverityPriority(a.severity) - this.getSeverityPriority(b.severity);
      if (severityPriority !== 0) {
        return severityPriority;
      }

      // Then by type priority
      const typePriority = this.getWarningTypePriority(a.type) - this.getWarningTypePriority(b.type);
      if (typePriority !== 0) {
        return typePriority;
      }

      // Finally by message length
      return a.message.length - b.message.length;
    });
  }

  private getErrorTypePriority(type: string): number {
    const priorities: Record<string, number> = {
      'compilation_error': 1,
      'project_not_found': 2,
      'security_vulnerability': 3,
      'system_error': 4,
      'quality_system_error': 5
    };

    return priorities[type] || 10;
  }

  private getWarningTypePriority(type: string): number {
    const priorities: Record<string, number> = {
      'security_warning': 1,
      'potential_secret': 2,
      'dangerous_operation': 3,
      'solid_violation': 4,
      'excessive_duplication': 5,
      'high_complexity': 6,
      'compilation_warning': 7
    };

    return priorities[type] || 10;
  }

  private getSeverityPriority(severity: 'info' | 'warning' | 'error'): number {
    const priorities = {
      'error': 1,
      'warning': 2,
      'info': 3
    };

    return priorities[severity];
  }

  private deduplicateErrors(errors: ValidationError[]): ValidationError[] {
    const seen = new Set<string>();
    const unique: ValidationError[] = [];

    for (const error of errors) {
      const key = `${error.type}:${error.message}:${error.file || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(error);
      }
    }

    return unique;
  }

  private deduplicateWarnings(warnings: ValidationWarning[]): ValidationWarning[] {
    const seen = new Set<string>();
    const unique: ValidationWarning[] = [];

    for (const warning of warnings) {
      const key = `${warning.type}:${warning.message}:${warning.file || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(warning);
      }
    }

    return unique;
  }

  private deduplicateRecommendations(recommendations: string[]): string[] {
    return Array.from(new Set(recommendations));
  }

  private addProjectSpecificRecommendations(
    recommendations: Set<string>,
    context: ProjectContext,
    errorTypes: Set<string>,
    warningTypes: Set<string>
  ): void {
    // TypeScript/JavaScript specific
    if (context.language === 'typescript') {
      if (warningTypes.has('missing_tsconfig')) {
        recommendations.add('Add a tsconfig.json file for better TypeScript configuration');
      }
      if (warningTypes.has('compilation_warning')) {
        recommendations.add('Consider enabling stricter TypeScript compiler options');
      }
    }

    // Framework specific recommendations
    if (context.framework === 'react') {
      if (warningTypes.has('high_complexity')) {
        recommendations.add('Consider splitting complex React components into smaller ones');
      }
    } else if (context.framework === 'express') {
      if (warningTypes.has('security_warning')) {
        recommendations.add('Implement proper Express.js middleware for security');
      }
    }

    // Request type specific
    if (context.requestType === 'code_modification') {
      if (errorTypes.size === 0 && warningTypes.size === 0) {
        recommendations.add('Consider adding tests for the modified code');
      }
    }

    // General project health
    if (warningTypes.has('missing_package_json')) {
      recommendations.add('Initialize project with proper package.json configuration');
    }
  }

  // Helper methods for analysis
  getIssueSummary(results: CycleResult): {
    criticalErrors: number;
    blockingErrors: number;
    highPriorityWarnings: number;
    totalIssues: number;
  } {
    const criticalErrors = results.errors.filter(e =>
      e.type.includes('security') || e.type.includes('compilation')
    ).length;

    const blockingErrors = results.errors.filter(e => e.blocking).length;

    const highPriorityWarnings = results.warnings.filter(w =>
      w.severity === 'error' || w.type.includes('security')
    ).length;

    return {
      criticalErrors,
      blockingErrors,
      highPriorityWarnings,
      totalIssues: results.errors.length + results.warnings.length
    };
  }

  shouldBlockExecution(results: CycleResult): boolean {
    return results.errors.some(error => error.blocking);
  }
}