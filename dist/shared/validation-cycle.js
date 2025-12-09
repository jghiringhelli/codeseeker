"use strict";
/**
 * CodeMind Validation Cycle System - SOLID Architecture
 *
 * Implements automatic quality and safety validation that runs before every Claude Code response.
 * Refactored using SOLID principles for better maintainability and testability.
 *
 * This module exports the SOLID-compliant validation cycle and maintains backward compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.DEFAULT_VALIDATION_CONFIG = exports.createValidationCycle = exports.CodeMindValidationCycle = void 0;
// Re-export the new SOLID-compliant validation cycle
var validation_cycle_1 = require("./validation-cycle/validation-cycle");
Object.defineProperty(exports, "CodeMindValidationCycle", { enumerable: true, get: function () { return validation_cycle_1.CodeMindValidationCycle; } });
Object.defineProperty(exports, "createValidationCycle", { enumerable: true, get: function () { return validation_cycle_1.createValidationCycle; } });
Object.defineProperty(exports, "DEFAULT_VALIDATION_CONFIG", { enumerable: true, get: function () { return validation_cycle_1.DEFAULT_VALIDATION_CONFIG; } });
// Legacy compatibility - create backward-compatible wrapper
var validation_cycle_2 = require("./validation-cycle/validation-cycle");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return validation_cycle_2.CodeMindValidationCycle; } });
//# sourceMappingURL=validation-cycle.js.map