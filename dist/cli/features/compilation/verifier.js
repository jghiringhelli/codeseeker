"use strict";
/**
 * Compilation Verifier - Simplified Build Safety Verification
 * Ensures that code changes don't break compilation before Claude Code suggests them
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
exports.CompilationVerifier = void 0;
const logger_1 = require("../../../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class CompilationVerifier {
    logger = logger_1.Logger.getInstance();
    async verifyCompilation(config) {
        const startTime = Date.now();
        try {
            this.logger.info('🔨 Starting compilation verification...');
            // 1. Detect build system and framework
            const framework = await this.detectBuildFramework(config.projectPath);
            // 2. Determine the right build command
            const buildCommand = config.buildCommand || await this.determineBuildCommand(config.projectPath, framework);
            // 3. Run verification stages
            const typeCheckResult = await this.runTypeCheck(config.projectPath, config.typeCheckCommand);
            const compilationResult = await this.runCompilation(config.projectPath, buildCommand, config.maxDuration || 120000);
            let lintingResult;
            if (!config.skipLinting) {
                lintingResult = await this.runLinting(config.projectPath, config.lintCommand);
            }
            let testingResult;
            if (!config.skipTests) {
                testingResult = await this.runQuickTests(config.projectPath, config.testCommand);
            }
            // 4. Combine results and generate analysis
            const result = this.combineResults(typeCheckResult, compilationResult, lintingResult, testingResult, framework, buildCommand, Date.now() - startTime);
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Compilation verification completed in ${duration}ms`, {
                success: result.success,
                errors: result.errors.length,
                warnings: result.warnings.length,
                framework: framework
            });
            return result;
        }
        catch (error) {
            this.logger.error('❌ Compilation verification failed:', error);
            throw error;
        }
    }
    async detectBuildFramework(projectPath) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            // Check for popular frameworks
            if (deps['react'] || deps['@types/react'])
                return 'react';
            if (deps['vue'] || deps['@vue/cli'])
                return 'vue';
            if (deps['@angular/core'])
                return 'angular';
            if (deps['svelte'])
                return 'svelte';
            if (deps['next'])
                return 'nextjs';
            if (deps['nuxt'])
                return 'nuxtjs';
            if (deps['typescript'])
                return 'typescript';
            return 'node';
        }
        catch {
            // Check for other framework indicators
            try {
                await fs.access(path.join(projectPath, 'tsconfig.json'));
                return 'typescript';
            }
            catch {
                try {
                    await fs.access(path.join(projectPath, 'package.json'));
                    return 'node';
                }
                catch {
                    return 'generic';
                }
            }
        }
    }
    async determineBuildCommand(projectPath, framework) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            const scripts = packageJson.scripts || {};
            // Check for common build scripts
            if (scripts['build'])
                return 'npm run build';
            if (scripts['compile'])
                return 'npm run compile';
            if (scripts['tsc'])
                return 'npm run tsc';
            // Framework-specific defaults
            switch (framework) {
                case 'typescript':
                    return 'npx tsc --noEmit';
                case 'react':
                    return 'npm run build';
                case 'vue':
                    return 'npm run build';
                case 'angular':
                    return 'ng build';
                default:
                    return 'npm run build';
            }
        }
        catch {
            return 'npm run build';
        }
    }
    async runTypeCheck(projectPath, customCommand) {
        const startTime = Date.now();
        try {
            // Determine type check command
            let command = customCommand;
            if (!command) {
                try {
                    await fs.access(path.join(projectPath, 'tsconfig.json'));
                    command = 'npx tsc --noEmit';
                }
                catch {
                    return {
                        name: 'typecheck',
                        success: true,
                        duration: Date.now() - startTime,
                        output: 'No TypeScript configuration found, skipping type check',
                        errorCount: 0,
                        warningCount: 0
                    };
                }
            }
            this.logger.info(`Running type check: ${command}`);
            const output = (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 60000
            });
            return {
                name: 'typecheck',
                success: true,
                duration: Date.now() - startTime,
                output: output || 'Type check passed',
                errorCount: 0,
                warningCount: 0
            };
        }
        catch (error) {
            const output = error.stdout || error.message || 'Type check failed';
            const errorCount = this.countErrors(output);
            return {
                name: 'typecheck',
                success: errorCount === 0,
                duration: Date.now() - startTime,
                output,
                errorCount,
                warningCount: this.countWarnings(output)
            };
        }
    }
    async runCompilation(projectPath, buildCommand, maxDuration) {
        const startTime = Date.now();
        try {
            this.logger.info(`Running compilation: ${buildCommand}`);
            const output = (0, child_process_1.execSync)(buildCommand, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: maxDuration
            });
            return {
                name: 'compilation',
                success: true,
                duration: Date.now() - startTime,
                output: output || 'Build completed successfully',
                errorCount: 0,
                warningCount: this.countWarnings(output)
            };
        }
        catch (error) {
            const output = error.stdout || error.message || 'Build failed';
            const errorCount = this.countErrors(output);
            return {
                name: 'compilation',
                success: false,
                duration: Date.now() - startTime,
                output,
                errorCount,
                warningCount: this.countWarnings(output)
            };
        }
    }
    async runLinting(projectPath, customCommand) {
        const startTime = Date.now();
        try {
            // Determine lint command
            let command = customCommand;
            if (!command) {
                try {
                    await fs.access(path.join(projectPath, '.eslintrc.js'));
                    command = 'npx eslint . --ext .ts,.js,.tsx,.jsx';
                }
                catch {
                    try {
                        await fs.access(path.join(projectPath, '.eslintrc.json'));
                        command = 'npx eslint . --ext .ts,.js,.tsx,.jsx';
                    }
                    catch {
                        return {
                            name: 'linting',
                            success: true,
                            duration: Date.now() - startTime,
                            output: 'No ESLint configuration found, skipping linting',
                            errorCount: 0,
                            warningCount: 0
                        };
                    }
                }
            }
            this.logger.info(`Running linting: ${command}`);
            const output = (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 30000
            });
            return {
                name: 'linting',
                success: true,
                duration: Date.now() - startTime,
                output: output || 'Linting passed',
                errorCount: 0,
                warningCount: this.countWarnings(output)
            };
        }
        catch (error) {
            const output = error.stdout || error.message || 'Linting failed';
            const errorCount = this.countErrors(output);
            return {
                name: 'linting',
                success: errorCount === 0,
                duration: Date.now() - startTime,
                output,
                errorCount,
                warningCount: this.countWarnings(output)
            };
        }
    }
    async runQuickTests(projectPath, customCommand) {
        const startTime = Date.now();
        try {
            // Determine test command  
            let command = customCommand || 'npm test -- --passWithNoTests';
            this.logger.info(`Running quick tests: ${command}`);
            const output = (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 60000
            });
            return {
                name: 'testing',
                success: true,
                duration: Date.now() - startTime,
                output: output || 'Tests passed',
                errorCount: 0,
                warningCount: 0
            };
        }
        catch (error) {
            const output = error.stdout || error.message || 'Tests failed';
            const errorCount = this.countTestFailures(output);
            return {
                name: 'testing',
                success: errorCount === 0,
                duration: Date.now() - startTime,
                output,
                errorCount,
                warningCount: 0
            };
        }
    }
    combineResults(typeCheck, compilation, linting, testing, framework, buildCommand, totalDuration) {
        const errors = [];
        const warnings = [];
        // Extract errors and warnings from all stages
        this.extractIssues(typeCheck, errors, warnings);
        this.extractIssues(compilation, errors, warnings);
        if (linting)
            this.extractIssues(linting, errors, warnings);
        if (testing)
            this.extractIssues(testing, errors, warnings);
        // Determine overall success
        const success = typeCheck.success && compilation.success &&
            (linting?.success !== false) && (testing?.success !== false);
        // Generate recommendations
        const recommendations = this.generateRecommendations(errors, warnings, framework || 'unknown');
        return {
            success,
            framework: framework || 'unknown',
            buildCommand: buildCommand || 'unknown',
            duration: totalDuration || 0,
            stages: {
                typeCheck,
                compilation,
                linting,
                testing
            },
            errors,
            warnings,
            recommendations
        };
    }
    extractIssues(stage, errors, warnings) {
        if (stage.errorCount > 0) {
            errors.push({
                stage: stage.name,
                message: `${stage.errorCount} errors in ${stage.name}`,
                severity: 'error'
            });
        }
        if (stage.warningCount > 0) {
            warnings.push({
                stage: stage.name,
                message: `${stage.warningCount} warnings in ${stage.name}`
            });
        }
    }
    generateRecommendations(errors, warnings, framework) {
        const recommendations = [];
        if (errors.length > 0) {
            recommendations.push('Fix compilation errors before deploying');
            if (errors.some(e => e.stage === 'typecheck')) {
                recommendations.push('Address TypeScript type errors for better code safety');
            }
            if (errors.some(e => e.stage === 'linting')) {
                recommendations.push('Resolve linting issues to maintain code quality standards');
            }
        }
        if (warnings.length > 5) {
            recommendations.push('Consider addressing warnings to improve code quality');
        }
        if (errors.length === 0 && warnings.length === 0) {
            recommendations.push('Build verification successful - code is ready for deployment');
        }
        return recommendations;
    }
    // Helper methods for counting issues
    countErrors(output) {
        const errorPatterns = [
            /error TS\d+:/gi,
            /\berror\b.*:/gi,
            /Error:/gi,
            /✖ \d+ problem/gi
        ];
        let count = 0;
        for (const pattern of errorPatterns) {
            const matches = output.match(pattern);
            if (matches)
                count += matches.length;
        }
        return count;
    }
    countWarnings(output) {
        const warningPatterns = [
            /warning TS\d+:/gi,
            /\bwarning\b.*:/gi,
            /Warning:/gi
        ];
        let count = 0;
        for (const pattern of warningPatterns) {
            const matches = output.match(pattern);
            if (matches)
                count += matches.length;
        }
        return count;
    }
    countTestFailures(output) {
        const failurePatterns = [
            /FAIL/gi,
            /failed/gi,
            /✗/gi
        ];
        let count = 0;
        for (const pattern of failurePatterns) {
            const matches = output.match(pattern);
            if (matches)
                count += matches.length;
        }
        return count;
    }
}
exports.CompilationVerifier = CompilationVerifier;
exports.default = CompilationVerifier;
//# sourceMappingURL=verifier.js.map