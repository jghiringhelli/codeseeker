/**
 * Quality Validation Service
 * SOLID Principles: Single Responsibility - Handle quality validations only
 */

import { Logger } from '../../logger';
import { SOLIDPrinciplesAnalyzer } from '../../../cli/features/solid-principles/analyzer';
import { IntelligentCycleFeatures } from '../../intelligent-cycle-features';
import {
  IQualityValidationService,
  ProjectContext,
  CycleResult,
  SafetyCheckResult,
  ValidationError,
  ValidationWarning,
  CycleConfig
} from '../interfaces/index';

export class QualityValidationService implements IQualityValidationService {
  private logger = Logger.getInstance();
  private solidAnalyzer: SOLIDPrinciplesAnalyzer;
  private intelligentFeatures: IntelligentCycleFeatures;

  constructor(
    private config: CycleConfig['qualityThresholds'],
    solidAnalyzer?: SOLIDPrinciplesAnalyzer,
    intelligentFeatures?: IntelligentCycleFeatures
  ) {
    this.solidAnalyzer = solidAnalyzer || new SOLIDPrinciplesAnalyzer();
    this.intelligentFeatures = intelligentFeatures || new IntelligentCycleFeatures();
  }

  async runQualityChecks(context: ProjectContext): Promise<CycleResult> {
    const startTime = Date.now();
    this.logger.info('📊 Running Quality Validation Cycle...');

    const results: CycleResult = {
      success: true,
      duration: 0,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      // Run quality checks in parallel for performance
      const [solidCheck, duplicationCheck, complexityCheck, securityCheck] = await Promise.all([
        this.analyzeSOLIDPrinciples(context),
        this.detectDuplication(context),
        this.analyzeComplexity(context),
        this.performSecurityScan(context)
      ]);

      // Aggregate all results
      this.aggregateCheckResult(results, solidCheck);
      this.aggregateCheckResult(results, duplicationCheck);
      this.aggregateCheckResult(results, complexityCheck);
      this.aggregateCheckResult(results, securityCheck);

      // Generate quality-specific recommendations
      this.generateQualityRecommendations(results, context);

      results.duration = Date.now() - startTime;
      this.logger.info(`✅ Quality validation cycle completed in ${results.duration}ms`);

      return results;
    } catch (error) {
      results.duration = Date.now() - startTime;
      results.success = false;
      results.errors.push({
        type: 'quality_system_error',
        message: `Quality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        blocking: false
      });

      this.logger.error('❌ Quality validation cycle failed:', error);
      return results;
    }
  }

  async analyzeSOLIDPrinciples(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('🏗️ Analyzing SOLID principles...');

      // Skip SOLID analysis for non-code requests
      if (context.requestType !== 'code_modification') {
        return {
          passed: true,
          issues: [],
          warnings: [],
          checkType: 'solid_principles'
        };
      }

      const result = await this.solidAnalyzer.analyzeProject(context.projectPath);

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (result.overallScore < this.config.solidMinScore) {
        warnings.push({
          type: 'solid_score_low',
          message: `SOLID principles score (${result.overallScore.toFixed(2)}) below threshold (${this.config.solidMinScore})`,
          severity: 'warning'
        });
      }

      // Check individual principles
      for (const [principle, analysis] of Object.entries(result.principles)) {
        if (analysis.score < 0.6) { // Individual principle threshold
          warnings.push({
            type: 'solid_principle_violation',
            message: `${principle} principle score low: ${analysis.score.toFixed(2)}`,
            severity: 'warning'
          });
        }
      }

      // Check for violations
      if (result.violations.length > 0) {
        for (const violation of result.violations.slice(0, 5)) { // Limit to 5 violations
          warnings.push({
            type: 'solid_violation',
            message: violation.description,
            file: violation.file,
            line: violation.line,
            severity: violation.severity === 'error' ? 'error' : 'warning'
          });
        }
      }

      return {
        passed: result.overallScore >= this.config.solidMinScore,
        issues,
        warnings,
        checkType: 'solid_principles'
      };
    } catch (error) {
      return {
        passed: false,
        issues: [{
          type: 'solid_analysis_failed',
          message: `SOLID analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          blocking: false
        }],
        warnings: [],
        checkType: 'solid_principles'
      };
    }
  }

  async detectDuplication(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('🔍 Detecting code duplication...');

      const result = await this.intelligentFeatures.performSemanticDeduplication(context.projectPath);

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (result.success && result.duplicates) {
        const totalDuplicatedLines = result.duplicates.reduce((sum, dup) => sum + dup.lines, 0);

        if (totalDuplicatedLines > this.config.maxDuplicationLines) {
          warnings.push({
            type: 'excessive_duplication',
            message: `Found ${totalDuplicatedLines} duplicated lines (threshold: ${this.config.maxDuplicationLines})`,
            severity: 'warning'
          });
        }

        // Report significant duplications
        for (const duplicate of result.duplicates.slice(0, 3)) { // Limit to 3 reports
          if (duplicate.lines > 5) {
            warnings.push({
              type: 'code_duplication',
              message: `${duplicate.lines} lines duplicated: ${duplicate.description}`,
              severity: 'info'
            });
          }
        }
      }

      return {
        passed: true, // Duplication is warning-level, not blocking
        issues,
        warnings,
        checkType: 'duplication'
      };
    } catch (error) {
      return {
        passed: true, // Don't fail on duplication check errors
        issues: [],
        warnings: [{
          type: 'duplication_check_failed',
          message: `Duplication detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'info'
        }],
        checkType: 'duplication'
      };
    }
  }

  async analyzeComplexity(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('📈 Analyzing code complexity...');

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Simple complexity analysis for changed files
      if (context.changedFiles) {
        for (const file of context.changedFiles) {
          const complexity = await this.analyzeFileComplexity(file);

          if (complexity > this.config.maxComplexityPerFunction) {
            warnings.push({
              type: 'high_complexity',
              message: `High complexity detected in ${file}: ${complexity}`,
              file: file,
              severity: 'warning'
            });
          }
        }
      }

      return {
        passed: true, // Complexity is warning-level
        issues,
        warnings,
        checkType: 'complexity'
      };
    } catch (error) {
      return {
        passed: true,
        issues: [],
        warnings: [{
          type: 'complexity_analysis_failed',
          message: `Complexity analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'info'
        }],
        checkType: 'complexity'
      };
    }
  }

  async performSecurityScan(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('🛡️ Performing security scan...');

      const result = await this.intelligentFeatures.performSmartSecurity(
        context.userIntent || 'Security scan',
        context.projectPath
      );

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (result.success && result.vulnerabilities) {
        for (const vuln of result.vulnerabilities.slice(0, 5)) { // Limit to 5 vulnerabilities
          const severity = this.getSecuritySeverity(vuln.risk);

          if (vuln.risk === 'critical' || vuln.risk === 'high') {
            issues.push({
              type: 'security_vulnerability',
              message: vuln.description,
              file: vuln.location?.file,
              line: vuln.location?.line,
              blocking: vuln.risk === 'critical'
            });
          } else {
            warnings.push({
              type: 'security_warning',
              message: vuln.description,
              file: vuln.location?.file,
              line: vuln.location?.line,
              severity
            });
          }
        }
      }

      return {
        passed: issues.filter(i => i.blocking).length === 0,
        issues,
        warnings,
        checkType: 'security'
      };
    } catch (error) {
      return {
        passed: true, // Don't fail on security scan errors
        issues: [],
        warnings: [{
          type: 'security_scan_failed',
          message: `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'info'
        }],
        checkType: 'security'
      };
    }
  }

  private aggregateCheckResult(results: CycleResult, checkResult: SafetyCheckResult): void {
    results.errors.push(...checkResult.issues);
    results.warnings.push(...checkResult.warnings);
  }

  private generateQualityRecommendations(results: CycleResult, context: ProjectContext): void {
    const recommendations: string[] = [];

    // Generate recommendations based on findings
    const solidIssues = results.warnings.filter(w => w.type.includes('solid'));
    if (solidIssues.length > 0) {
      recommendations.push('Consider refactoring code to better follow SOLID principles');
    }

    const duplicationIssues = results.warnings.filter(w => w.type.includes('duplication'));
    if (duplicationIssues.length > 0) {
      recommendations.push('Extract common functionality to reduce code duplication');
    }

    const complexityIssues = results.warnings.filter(w => w.type.includes('complexity'));
    if (complexityIssues.length > 0) {
      recommendations.push('Break down complex functions into smaller, more manageable pieces');
    }

    const securityIssues = results.warnings.filter(w => w.type.includes('security'));
    if (securityIssues.length > 0) {
      recommendations.push('Address security vulnerabilities before deployment');
    }

    // Add framework-specific recommendations
    if (context.framework === 'react') {
      recommendations.push('Consider using React hooks for better component organization');
    } else if (context.framework === 'express') {
      recommendations.push('Ensure proper middleware error handling');
    }

    results.recommendations.push(...recommendations);
  }

  private async analyzeFileComplexity(filePath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      // Simple cyclomatic complexity estimation
      const complexityPatterns = [
        /if\s*\(/g,
        /else\s*if/g,
        /while\s*\(/g,
        /for\s*\(/g,
        /switch\s*\(/g,
        /catch\s*\(/g,
        /&&/g,
        /\|\|/g
      ];

      let complexity = 1; // Base complexity

      for (const pattern of complexityPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          complexity += matches.length;
        }
      }

      return complexity;
    } catch (error) {
      this.logger.debug(`Could not analyze complexity for ${filePath}:`, error);
      return 0;
    }
  }

  private getSecuritySeverity(risk: string): 'info' | 'warning' | 'error' {
    switch (risk) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }
}