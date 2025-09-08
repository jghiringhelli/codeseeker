"use strict";
/**
 * CodeMind Validation Cycle System
 *
 * Implements automatic quality and safety validation that runs before every Claude Code response.
 * Replaces database-heavy tools with fast, stateless validation for immediate feedback.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMindValidationCycle = void 0;
const logger_1 = require("./logger");
const verifier_1 = require("../features/compilation/verifier");
const analyzer_1 = require("../features/solid-principles/analyzer");
const intelligent_cycle_features_1 = require("./intelligent-cycle-features");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const child_process_1 = require("child_process");
class CodeMindValidationCycle {
    logger;
    compilationVerifier;
    solidAnalyzer;
    intelligentFeatures;
    config;
    constructor(config) {
        this.logger = logger_1.Logger.getInstance();
        this.compilationVerifier = new verifier_1.CompilationVerifier();
        this.solidAnalyzer = new analyzer_1.SOLIDPrinciplesAnalyzer();
        this.intelligentFeatures = new intelligent_cycle_features_1.IntelligentCycleFeatures();
        this.config = {
            enableCoreCycle: true,
            enableQualityCycle: true,
            maxDuration: 2000, // 2 seconds max
            qualityThresholds: {
                solidMinScore: 0.7,
                maxDuplicationLines: 20,
                maxComplexityPerFunction: 15
            },
            ...config
        };
    }
    /**
     * Core Safety Cycle - Always runs before every response
     * Critical validations that prevent breaking changes
     */
    async runCoreCycle(context) {
        const startTime = Date.now();
        this.logger.info('🔄 Running Core Safety Cycle...');
        const results = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            // 1. Compilation Check
            const compilationResult = await this.validateCompilation(context);
            if (!compilationResult.success) {
                results.success = false;
                results.errors.push({
                    type: 'compilation',
                    message: 'Project fails to compile',
                    blocking: true
                });
                results.errors.push(...compilationResult.errors.map(e => ({
                    type: 'compilation',
                    message: e.message,
                    file: e.file,
                    line: e.line,
                    blocking: true
                })));
            }
            // 2. Test Execution (if tests exist)
            const testResult = await this.validateTests(context);
            if (!testResult.success) {
                results.warnings.push({
                    type: 'tests',
                    message: 'Some tests are failing',
                    severity: 'warning'
                });
            }
            // 3. Destructive Command Guard
            const safetyResult = await this.validateSafetyConstraints(context);
            if (!safetyResult.success) {
                results.success = false;
                results.errors.push(...safetyResult.errors);
            }
            results.duration = Date.now() - startTime;
            if (results.success) {
                this.logger.info(`✅ Core Safety Cycle passed in ${results.duration}ms`);
            }
            else {
                this.logger.warn(`⚠️ Core Safety Cycle failed in ${results.duration}ms`);
            }
        }
        catch (error) {
            results.success = false;
            results.errors.push({
                type: 'cycle_error',
                message: `Core cycle failed: ${error.message}`,
                blocking: true
            });
            results.duration = Date.now() - startTime;
        }
        return results;
    }
    /**
     * Quality Cycle - Runs for code modifications
     * Provides quality feedback and architectural guidance
     */
    async runQualityCycle(context) {
        const startTime = Date.now();
        this.logger.info('🎯 Running Quality Cycle...');
        const results = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            // 1. SOLID Principles Check (fast, current context only)
            const solidResult = await this.validateSOLIDPrinciples(context);
            results.warnings.push(...solidResult.warnings);
            results.recommendations.push(...solidResult.recommendations);
            // 2. Linting Check
            const lintResult = await this.validateLinting(context);
            results.warnings.push(...lintResult.warnings);
            // 3. Dependency Cycle Detection
            const depResult = await this.validateDependencyCycles(context);
            if (!depResult.success) {
                results.errors.push(...depResult.errors);
            }
            // 4. Semantic Deduplication Check (intelligent)
            const dupResult = await this.validateSemanticDuplication(context);
            results.warnings.push(...dupResult.warnings);
            results.recommendations.push(...dupResult.recommendations);
            // 5. Smart Security Analysis (context-aware)
            const secResult = await this.validateSmartSecurity(context);
            results.warnings.push(...secResult.warnings);
            results.recommendations.push(...secResult.recommendations);
            results.duration = Date.now() - startTime;
            this.logger.info(`✅ Quality Cycle completed in ${results.duration}ms`);
        }
        catch (error) {
            results.warnings.push({
                type: 'quality_cycle',
                message: `Quality cycle error: ${error.message}`,
                severity: 'warning'
            });
            results.duration = Date.now() - startTime;
        }
        return results;
    }
    /**
     * Validate compilation status
     */
    async validateCompilation(context) {
        try {
            const result = await this.compilationVerifier.verifyCompilation({
                projectPath: context.projectPath,
                maxDuration: 30000
            });
            return {
                success: result.success,
                duration: result.duration,
                warnings: [],
                errors: result.errors.map(e => ({
                    type: 'compilation',
                    message: e.message,
                    file: e.file,
                    line: e.line,
                    blocking: true
                })),
                recommendations: result.recommendations
            };
        }
        catch (error) {
            return {
                success: false,
                duration: 0,
                warnings: [],
                errors: [{ type: 'compilation', message: error.message, blocking: true }],
                recommendations: []
            };
        }
    }
    /**
     * Validate tests (non-blocking)
     */
    async validateTests(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            // Check if tests exist
            const testFiles = await (0, fast_glob_1.glob)('**/*.{test,spec}.{ts,js}', {
                cwd: context.projectPath,
                absolute: false
            });
            if (testFiles.length === 0) {
                result.recommendations.push('Consider adding tests for better code reliability');
                return result;
            }
            // Run tests with timeout
            const startTime = Date.now();
            try {
                (0, child_process_1.execSync)('npm test 2>/dev/null', {
                    cwd: context.projectPath,
                    timeout: 10000,
                    stdio: 'pipe'
                });
                result.duration = Date.now() - startTime;
            }
            catch (error) {
                result.success = false;
                result.duration = Date.now() - startTime;
                result.warnings.push({
                    type: 'tests',
                    message: 'Some tests are failing - consider fixing before proceeding',
                    severity: 'warning'
                });
            }
        }
        catch (error) {
            result.warnings.push({
                type: 'tests',
                message: `Test validation error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Validate safety constraints (prevent destructive operations)
     */
    async validateSafetyConstraints(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        // Define dangerous patterns
        const dangerousPatterns = [
            /DROP\s+TABLE/i,
            /TRUNCATE\s+TABLE/i,
            /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i,
            /rm\s+-rf\s+\//,
            /docker\s+volume\s+rm/i,
            /\.delete\(\s*\)/,
            /fs\.rmSync\(/,
            /fs\.unlinkSync\(/
        ];
        if (context.changedFiles) {
            for (const file of context.changedFiles) {
                try {
                    const content = await fs.readFile(path.join(context.projectPath, file), 'utf-8');
                    for (const pattern of dangerousPatterns) {
                        if (pattern.test(content)) {
                            result.errors.push({
                                type: 'safety',
                                message: `Potentially destructive operation detected in ${file}`,
                                file,
                                blocking: true
                            });
                            result.success = false;
                        }
                    }
                }
                catch (error) {
                    // File might not exist or be readable, skip
                }
            }
        }
        return result;
    }
    /**
     * SOLID Principles validation (lightweight, context-aware)
     */
    async validateSOLIDPrinciples(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            // Analyze only changed files for speed
            const filesToAnalyze = context.changedFiles?.filter(f => f.endsWith('.ts') || f.endsWith('.js')) || [];
            if (filesToAnalyze.length === 0)
                return result;
            const startTime = Date.now();
            const solidResult = await this.solidAnalyzer.analyzeSOLID({
                projectPath: context.projectPath,
                focusOnFiles: filesToAnalyze
            });
            result.duration = Date.now() - startTime;
            // Convert to cycle format
            const criticalViolations = solidResult.violations.filter(v => v.severity === 'critical');
            const highViolations = solidResult.violations.filter(v => v.severity === 'high');
            if (criticalViolations.length > 0) {
                result.warnings.push({
                    type: 'solid',
                    message: `${criticalViolations.length} critical SOLID violations found`,
                    severity: 'error'
                });
            }
            if (highViolations.length > 0) {
                result.warnings.push({
                    type: 'solid',
                    message: `${highViolations.length} high-severity SOLID violations found`,
                    severity: 'warning'
                });
            }
            // Add top recommendations
            result.recommendations.push(...solidResult.recommendations.slice(0, 3));
        }
        catch (error) {
            result.warnings.push({
                type: 'solid',
                message: `SOLID analysis error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Linting validation
     */
    async validateLinting(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            const startTime = Date.now();
            // Check if eslint config exists
            const hasEslint = await fs.access(path.join(context.projectPath, '.eslintrc.json'))
                .then(() => true)
                .catch(() => false);
            if (!hasEslint) {
                result.recommendations.push('Consider adding ESLint for consistent code style');
                return result;
            }
            // Run eslint on changed files only
            const filesToLint = context.changedFiles?.filter(f => f.endsWith('.ts') || f.endsWith('.js')) || [];
            if (filesToLint.length > 0) {
                try {
                    (0, child_process_1.execSync)(`npx eslint ${filesToLint.join(' ')} --format=json`, {
                        cwd: context.projectPath,
                        timeout: 5000,
                        stdio: 'pipe'
                    });
                }
                catch (error) {
                    // Eslint returns non-zero for lint violations
                    const output = error.stdout?.toString();
                    if (output) {
                        try {
                            const lintResults = JSON.parse(output);
                            const totalErrors = lintResults.reduce((sum, file) => sum + file.errorCount, 0);
                            const totalWarnings = lintResults.reduce((sum, file) => sum + file.warningCount, 0);
                            if (totalErrors > 0) {
                                result.warnings.push({
                                    type: 'lint',
                                    message: `${totalErrors} linting errors found`,
                                    severity: 'error'
                                });
                            }
                            if (totalWarnings > 0) {
                                result.warnings.push({
                                    type: 'lint',
                                    message: `${totalWarnings} linting warnings found`,
                                    severity: 'warning'
                                });
                            }
                        }
                        catch (parseError) {
                            // If we can't parse eslint output, just note there are issues
                            result.warnings.push({
                                type: 'lint',
                                message: 'Linting issues detected',
                                severity: 'warning'
                            });
                        }
                    }
                }
            }
            result.duration = Date.now() - startTime;
        }
        catch (error) {
            result.warnings.push({
                type: 'lint',
                message: `Linting validation error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Check for dependency cycles
     */
    async validateDependencyCycles(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            const startTime = Date.now();
            // Simple dependency cycle detection for changed files
            const filesToCheck = context.changedFiles?.filter(f => f.endsWith('.ts') || f.endsWith('.js')) || [];
            const dependencies = {};
            for (const file of filesToCheck) {
                try {
                    const content = await fs.readFile(path.join(context.projectPath, file), 'utf-8');
                    const imports = this.extractImports(content);
                    dependencies[file] = imports;
                }
                catch (error) {
                    // Skip files that can't be read
                }
            }
            // Check for circular dependencies
            const cycles = this.findCircularDependencies(dependencies);
            if (cycles.length > 0) {
                result.success = false;
                result.errors.push({
                    type: 'dependency_cycle',
                    message: `Circular dependency detected: ${cycles[0].join(' → ')}`,
                    blocking: true
                });
            }
            result.duration = Date.now() - startTime;
        }
        catch (error) {
            result.warnings.push({
                type: 'dependency',
                message: `Dependency validation error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Semantic Deduplication Check (intelligent, semantic-search powered)
     */
    async validateSemanticDuplication(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            const startTime = Date.now();
            // Only run semantic deduplication for code modifications
            if (context.requestType !== 'code_modification' || !context.userIntent) {
                return result;
            }
            // Use intelligent semantic deduplication
            const semanticResult = await this.intelligentFeatures.checkSemanticDuplication(context.projectPath, context.userIntent, context.changedFiles);
            // Convert semantic results to cycle format
            if (semanticResult.hasDuplicates) {
                if (semanticResult.semanticSimilarity > 0.8) {
                    result.warnings.push({
                        type: 'semantic_duplication',
                        message: `High similarity (${Math.round(semanticResult.semanticSimilarity * 100)}%) with existing functionality`,
                        severity: 'error'
                    });
                }
                else if (semanticResult.semanticSimilarity > 0.6) {
                    result.warnings.push({
                        type: 'semantic_duplication',
                        message: `Similar functionality detected (${Math.round(semanticResult.semanticSimilarity * 100)}% match)`,
                        severity: 'warning'
                    });
                }
                // Add specific file references
                for (const impl of semanticResult.existingImplementations.slice(0, 3)) {
                    result.warnings.push({
                        type: 'existing_implementation',
                        message: `${impl.description} in ${impl.file}:${impl.lineRange.start}`,
                        file: impl.file,
                        line: impl.lineRange.start,
                        severity: 'info'
                    });
                }
            }
            // Add semantic recommendations
            result.recommendations.push(...semanticResult.recommendations);
            result.duration = Date.now() - startTime;
        }
        catch (error) {
            result.warnings.push({
                type: 'semantic_duplication',
                message: `Semantic deduplication error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Smart Security Analysis (context-aware, enhanced)
     */
    async validateSmartSecurity(context) {
        const result = {
            success: true,
            duration: 0,
            warnings: [],
            errors: [],
            recommendations: []
        };
        try {
            const startTime = Date.now();
            const filesToCheck = context.changedFiles?.filter(f => f.endsWith('.ts') || f.endsWith('.js')) || [];
            if (filesToCheck.length === 0 || !context.userIntent) {
                return result;
            }
            // Use intelligent security analysis
            const securityResult = await this.intelligentFeatures.performSmartSecurity(context.projectPath, filesToCheck, context.userIntent);
            // Convert security results to cycle format
            for (const vuln of securityResult.vulnerabilities) {
                let severity = 'info';
                if (vuln.severity === 'critical' || vuln.severity === 'high') {
                    severity = 'error';
                }
                else if (vuln.severity === 'medium') {
                    severity = 'warning';
                }
                result.warnings.push({
                    type: 'smart_security',
                    message: `${vuln.description}${vuln.file ? ` in ${vuln.file}` : ''}`,
                    file: vuln.file,
                    line: vuln.line,
                    severity
                });
            }
            // Add security pattern information as recommendations
            if (securityResult.patterns.length > 0) {
                result.recommendations.push(`Security patterns checked: ${securityResult.patterns.map(p => p.description).join(', ')}`);
            }
            // Add all security recommendations
            result.recommendations.push(...securityResult.recommendations);
            // Add risk level warning if high
            if (securityResult.riskLevel === 'high' || securityResult.riskLevel === 'critical') {
                result.warnings.push({
                    type: 'security_risk',
                    message: `Overall security risk level: ${securityResult.riskLevel}`,
                    severity: 'error'
                });
            }
            result.duration = Date.now() - startTime;
        }
        catch (error) {
            result.warnings.push({
                type: 'smart_security',
                message: `Smart security analysis error: ${error.message}`,
                severity: 'info'
            });
        }
        return result;
    }
    /**
     * Extract imports from file content
     */
    extractImports(content) {
        const imports = [];
        const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }
    /**
     * Find circular dependencies using DFS
     */
    findCircularDependencies(dependencies) {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const dfs = (file, path) => {
            visited.add(file);
            recursionStack.add(file);
            const deps = dependencies[file] || [];
            for (const dep of deps) {
                if (dependencies[dep]) { // Only check files we're analyzing
                    if (!visited.has(dep)) {
                        dfs(dep, [...path, file]);
                    }
                    else if (recursionStack.has(dep)) {
                        const cycleStart = path.indexOf(dep);
                        cycles.push([...path.slice(cycleStart), file, dep]);
                    }
                }
            }
            recursionStack.delete(file);
        };
        for (const file of Object.keys(dependencies)) {
            if (!visited.has(file)) {
                dfs(file, []);
            }
        }
        return cycles;
    }
    /**
     * Format cycle results for CLI output
     */
    formatCycleResults(coreResult, qualityResult) {
        const lines = [];
        // Core cycle results
        if (!coreResult.success) {
            lines.push('❌ **Safety Issues Found:**');
            coreResult.errors.forEach(error => {
                lines.push(`   • ${error.message}${error.file ? ` (${error.file}:${error.line || '?'})` : ''}`);
            });
            lines.push('');
        }
        // Quality cycle results
        if (qualityResult) {
            if (qualityResult.warnings.length > 0) {
                lines.push('⚠️ **Quality Recommendations:**');
                qualityResult.warnings.forEach(warning => {
                    lines.push(`   • ${warning.message}${warning.file ? ` (${warning.file}:${warning.line || '?'})` : ''}`);
                });
                lines.push('');
            }
            if (qualityResult.recommendations.length > 0) {
                lines.push('💡 **Suggestions:**');
                qualityResult.recommendations.forEach(rec => {
                    lines.push(`   • ${rec}`);
                });
                lines.push('');
            }
        }
        const totalDuration = coreResult.duration + (qualityResult?.duration || 0);
        lines.push(`⏱️ Validation completed in ${totalDuration}ms`);
        return lines.join('\n');
    }
}
exports.CodeMindValidationCycle = CodeMindValidationCycle;
exports.default = CodeMindValidationCycle;
//# sourceMappingURL=validation-cycle.js.map