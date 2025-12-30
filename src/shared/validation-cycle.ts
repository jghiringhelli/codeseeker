/**
 * CodeMind Validation Cycle System - SOLID Architecture
 *
 * Implements automatic quality and safety validation that runs before every Claude Code response.
 * Refactored using SOLID principles for better maintainability and testability.
 *
 * This module exports the SOLID-compliant validation cycle and maintains backward compatibility.
 */

// Re-export the new SOLID-compliant validation cycle
export {
  CodeMindValidationCycle,
  createValidationCycle,
  DEFAULT_VALIDATION_CONFIG
} from './validation-cycle/validation-cycle';

// Re-export all interfaces for backward compatibility
export type {
  ProjectContext,
  CycleResult,
  ValidationWarning,
  ValidationError,
  CycleConfig,
  SafetyCheckResult,
  QualityMetrics,
  ICoreSafetyService,
  IQualityValidationService,
  IValidationAggregatorService,
  IValidationReportService,
  IProjectAnalysisService
} from './validation-cycle/interfaces/index';

// Legacy compatibility - create backward-compatible wrapper
export { CodeMindValidationCycle as default } from './validation-cycle/validation-cycle';