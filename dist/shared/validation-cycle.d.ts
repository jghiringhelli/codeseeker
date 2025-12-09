/**
 * CodeMind Validation Cycle System - SOLID Architecture
 *
 * Implements automatic quality and safety validation that runs before every Claude Code response.
 * Refactored using SOLID principles for better maintainability and testability.
 *
 * This module exports the SOLID-compliant validation cycle and maintains backward compatibility.
 */
export { CodeMindValidationCycle, createValidationCycle, DEFAULT_VALIDATION_CONFIG } from './validation-cycle/validation-cycle';
export type { ProjectContext, CycleResult, ValidationWarning, ValidationError, CycleConfig, SafetyCheckResult, QualityMetrics, ICoreSafetyService, IQualityValidationService, IValidationAggregatorService, IValidationReportService, IProjectAnalysisService } from './validation-cycle/interfaces/index';
export { CodeMindValidationCycle as default } from './validation-cycle/validation-cycle';
//# sourceMappingURL=validation-cycle.d.ts.map