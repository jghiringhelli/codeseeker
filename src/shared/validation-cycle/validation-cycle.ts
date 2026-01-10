/**
 * CodeSeeker Validation Cycle
 * SOLID Principles: Single Responsibility - Coordinate validation workflow only
 *
 * Main coordinator that orchestrates the complete validation cycle
 * using specialized services following SOLID principles.
 */

import { Logger } from '../logger';
import { CoreSafetyService } from './services/core-safety-service';
import { QualityValidationService } from './services/quality-validation-service';
import { ValidationAggregatorService } from './services/validation-aggregator-service';
import { ValidationReportService } from './services/validation-report-service';
import {
  ProjectContext,
  CycleResult,
  CycleConfig,
  ICoreSafetyService,
  IQualityValidationService,
  IValidationAggregatorService,
  IValidationReportService
} from './interfaces/index';

export class CodeSeekerValidationCycle {
  private logger = Logger.getInstance();

  constructor(
    private config: CycleConfig,
    private coreSafetyService?: ICoreSafetyService,
    private qualityService?: IQualityValidationService,
    private aggregatorService?: IValidationAggregatorService,
    private reportService?: IValidationReportService
  ) {
    // Initialize services with dependency injection
    this.coreSafetyService = coreSafetyService || new CoreSafetyService();
    this.qualityService = qualityService || new QualityValidationService(config.qualityThresholds);
    this.aggregatorService = aggregatorService || new ValidationAggregatorService();
    this.reportService = reportService || new ValidationReportService();
  }

  /**
   * Execute complete validation cycle with both core safety and quality checks
   */
  async executeValidationCycle(context: ProjectContext): Promise<{
    result: CycleResult;
    report: string;
    shouldBlock: boolean;
  }> {
    const startTime = Date.now();
    this.logger.info('🔄 Starting CodeSeeker Validation Cycle...');

    try {
      // Check if we should skip based on patterns
      if (this.shouldSkipValidation(context)) {
        return this.createSkippedResult(context);
      }

      // Execute validation phases
      const coreResult = await this.executeCoreSafetyCycle(context);
      const qualityResult = await this.executeQualityCycle(context);

      // Aggregate and finalize results
      const aggregatedResult = this.aggregatorService!.aggregateResults(coreResult, qualityResult);
      const finalResult = this.finalizeResult(aggregatedResult, context);

      // Generate comprehensive report
      const report = this.reportService!.generateReport(finalResult, context);
      const shouldBlock = this.aggregatorService!.shouldBlockExecution(finalResult);

      const totalDuration = Date.now() - startTime;
      this.logger.info(`✅ Validation cycle completed in ${totalDuration}ms`);

      return {
        result: finalResult,
        report,
        shouldBlock
      };
    } catch (error) {
      const errorResult = this.createErrorResult(error, Date.now() - startTime);
      const errorReport = this.reportService!.generateReport(errorResult, context);

      this.logger.error('❌ Validation cycle failed:', error);

      return {
        result: errorResult,
        report: errorReport,
        shouldBlock: true
      };
    }
  }

  /**
   * Execute only core safety validations (faster, critical checks only)
   */
  async executeCoreSafetyCycle(context: ProjectContext): Promise<CycleResult> {
    if (!this.config.enableCoreCycle) {
      return this.createEmptyResult();
    }

    this.logger.debug('🛡️ Executing core safety cycle...');
    return await this.coreSafetyService!.runCoreSafetyChecks(context);
  }

  /**
   * Execute quality validations (comprehensive, includes SOLID, duplication, etc.)
   */
  async executeQualityCycle(context: ProjectContext): Promise<CycleResult | undefined> {
    if (!this.config.enableQualityCycle) {
      return undefined;
    }

    this.logger.debug('📊 Executing quality validation cycle...');
    return await this.qualityService!.runQualityChecks(context);
  }

  /**
   * Quick validation check - returns basic status without full cycle
   */
  async quickValidationCheck(context: ProjectContext): Promise<{
    status: string;
    criticalIssues: number;
    canProceed: boolean;
  }> {
    try {
      const coreResult = await this.executeCoreSafetyCycle(context);
      const summary = this.aggregatorService!.getIssueSummary(coreResult);

      return {
        status: this.reportService!.generateQuickStatus(coreResult),
        criticalIssues: summary.criticalErrors + summary.blockingErrors,
        canProceed: !this.aggregatorService!.shouldBlockExecution(coreResult)
      };
    } catch (error) {
      this.logger.error('Quick validation check failed:', error);
      return {
        status: '❌ Validation system error',
        criticalIssues: 1,
        canProceed: false
      };
    }
  }

  /**
   * Export validation results in specified format
   */
  exportValidationResults(result: CycleResult, format: 'json' | 'markdown' | 'text'): string {
    return this.reportService!.exportResults(result, format);
  }

  /**
   * Get validation metrics for monitoring/analytics
   */
  getValidationMetrics(result: CycleResult): ReturnType<typeof this.reportService.generateMetrics> {
    return this.reportService!.generateMetrics(result);
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<CycleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Validation configuration updated');
  }

  // Private helper methods
  private shouldSkipValidation(context: ProjectContext): boolean {
    if (!this.config.skipOnPatterns) {
      return false;
    }

    const projectPath = context.projectPath.toLowerCase();
    return this.config.skipOnPatterns.some(pattern =>
      projectPath.includes(pattern.toLowerCase())
    );
  }

  private finalizeResult(result: CycleResult, context: ProjectContext): CycleResult {
    // Add generated recommendations
    const generatedRecommendations = this.aggregatorService!.generateRecommendations(result, context);

    // Prioritize all issues
    const prioritized = this.aggregatorService!.prioritizeIssues({
      ...result,
      recommendations: [...result.recommendations, ...generatedRecommendations]
    });

    return prioritized;
  }

  private createSkippedResult(context: ProjectContext): {
    result: CycleResult;
    report: string;
    shouldBlock: boolean;
  } {
    const result: CycleResult = {
      success: true,
      duration: 0,
      warnings: [],
      errors: [],
      recommendations: ['Validation skipped based on project patterns']
    };

    return {
      result,
      report: this.reportService!.generateReport(result, context),
      shouldBlock: false
    };
  }

  private createErrorResult(error: unknown, duration: number): CycleResult {
    return {
      success: false,
      duration,
      warnings: [],
      errors: [{
        type: 'validation_system_error',
        message: `Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        blocking: true
      }],
      recommendations: ['Check validation system configuration and dependencies']
    };
  }

  private createEmptyResult(): CycleResult {
    return {
      success: true,
      duration: 0,
      warnings: [],
      errors: [],
      recommendations: []
    };
  }

  // Additional methods required by task-specific-file-orchestrator
  async runCoreCycle(context: ProjectContext): Promise<CycleResult> {
    if (!this.config.enableCoreCycle) {
      return this.createEmptyResult();
    }
    return this.executeCoreSafetyCycle(context);
  }

  async runQualityCycle(context: ProjectContext): Promise<CycleResult> {
    if (!this.config.enableQualityCycle) {
      return this.createEmptyResult();
    }
    const qualityResult = await this.executeQualityCycle(context);
    return qualityResult || this.createEmptyResult();
  }

  async runValidation(context: ProjectContext): Promise<CycleResult> {
    const result = await this.executeValidationCycle(context);
    return result.result;
  }
}

// Export factory function for easy instantiation
export function createValidationCycle(config: CycleConfig): CodeSeekerValidationCycle {
  return new CodeSeekerValidationCycle(config);
}

// Export default configuration
export const DEFAULT_VALIDATION_CONFIG: CycleConfig = {
  enableCoreCycle: true,
  enableQualityCycle: true,
  maxDuration: 30000, // 30 seconds
  skipOnPatterns: ['node_modules', '.git', 'dist', 'build'],
  qualityThresholds: {
    solidMinScore: 0.7,
    maxDuplicationLines: 100,
    maxComplexityPerFunction: 15
  }
};