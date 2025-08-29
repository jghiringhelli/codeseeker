"use strict";
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
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class CompilationVerifier {
    logger = logger_1.Logger.getInstance();
    async verifyCompilation(config) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.toolExecution('compilation-verifier', 'started');
        try {
            // 1. Detect build system and framework
            const framework = await this.detectBuildFramework(config.projectPath);
            // 2. Determine the right build command
            const buildCommand = config.buildCommand || await this.determineBuildCommand(config.projectPath, framework);
            // 3. Run type checking first (faster feedback)
            const typeCheckResult = await this.runTypeCheck(config.projectPath, config.typeCheckCommand);
            // 4. Run compilation/build
            const compilationResult = await this.runCompilation(config.projectPath, buildCommand, config.maxDuration);
            // 5. Run linting if requested
            const lintResult = config.skipLinting ? null :
                await this.runLinting(config.projectPath, config.lintCommand);
            // 6. Check if tests still pass (optional quick smoke test)
            const testResult = config.skipTests ? null :
                await this.runQuickTests(config.projectPath, config.testCommand);
            // 7. Combine results and generate recommendations
            const combinedResult = this.combineResults(typeCheckResult, compilationResult, lintResult, testResult, framework, buildCommand, Date.now() - startTime);
            const duration = Date.now() - startTime;
            colored_logger_1.cliLogger.toolExecution('compilation-verifier', 'completed', duration, {
                success: combinedResult.success,
                errors: combinedResult.errors.length,
                warnings: combinedResult.warnings.length,
                framework: framework,
                buildCommand: buildCommand
            });
            return combinedResult;
        }
        catch (error) {
            colored_logger_1.cliLogger.toolExecution('compilation-verifier', 'failed', Date.now() - startTime, error);
            throw error;
        }
    }
    async detectBuildFramework(projectPath) {
        try {
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            // Check for specific build tools
            if (allDeps.vite)
                return 'vite';
            if (allDeps.webpack || allDeps['webpack-cli'])
                return 'webpack';
            if (allDeps.typescript || allDeps['@types/node'])
                return 'typescript';
            if (allDeps.babel || allDeps['@babel/core'])
                return 'babel';
            // Check for TypeScript config
            try {
                await fs.access(path.join(projectPath, 'tsconfig.json'));
                return 'typescript';
            }
            catch {
                // No TypeScript config found
            }
            // Check for Webpack config
            try {
                await fs.access(path.join(projectPath, 'webpack.config.js'));
                return 'webpack';
            }
            catch {
                // No Webpack config found
            }
            // Check for Vite config
            try {
                await fs.access(path.join(projectPath, 'vite.config.js'));
                return 'vite';
            }
            catch {
                // No Vite config found
            }
            return 'javascript';
        }
        catch (error) {
            this.logger.warn('Failed to detect build framework:', error);
            return 'unknown';
        }
    }
    async determineBuildCommand(projectPath, framework) {
        try {
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            const scripts = packageJson.scripts || {};
            // Check for common build script names
            if (scripts.build)
                return 'npm run build';
            if (scripts.compile)
                return 'npm run compile';
            if (scripts.dev)
                return 'npm run dev';
            // Framework-specific defaults
            switch (framework) {
                case 'typescript':
                    return 'npx tsc --noEmit'; // Type check only, no output
                case 'vite':
                    return 'npx vite build';
                case 'webpack':
                    return 'npx webpack --mode=development';
                case 'babel':
                    return 'npx babel src --out-dir dist --extensions .js,.jsx,.ts,.tsx';
                default:
                    return 'npm run build';
            }
        }
        catch (error) {
            this.logger.warn('Failed to determine build command:', error);
            return 'npm run build';
        }
    }
    async runTypeCheck(projectPath, typeCheckCommand) {
        const startTime = Date.now();
        try {
            // Check if TypeScript is available
            try {
                await fs.access(path.join(projectPath, 'tsconfig.json'));
            }
            catch {
                // No TypeScript configuration, skip type checking
                return { success: true, errors: [], duration: Date.now() - startTime };
            }
            const command = typeCheckCommand || 'npx tsc --noEmit';
            colored_logger_1.cliLogger.info('COMPILE', `Running type check: ${command}`);
            const output = (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 60000 // 1 minute timeout for type checking
            });
            return {
                success: true,
                errors: [],
                duration: Date.now() - startTime
            };
        }
        catch (error) {
            const errors = this.parseTypeScriptErrors(error.stdout || error.message || '');
            return {
                success: false,
                errors,
                duration: Date.now() - startTime
            };
        }
    }
    async runCompilation(projectPath, buildCommand, maxDuration) {
        const startTime = Date.now();
        try {
            colored_logger_1.cliLogger.info('COMPILE', `Running build: ${buildCommand}`);
            const output = (0, child_process_1.execSync)(buildCommand, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: maxDuration || 300000 // 5 minutes default timeout
            });
            // Check if build output was generated
            const outputStats = await this.analyzeBuildOutput(projectPath);
            return {
                success: true,
                errors: [],
                outputSize: outputStats.outputSize,
                sourceMapGenerated: outputStats.sourceMapGenerated,
                affectedFiles: outputStats.affectedFiles
            };
        }
        catch (error) {
            const errors = this.parseBuildErrors(error.stdout || error.message || '', buildCommand);
            return {
                success: false,
                errors,
                outputSize: 0,
                sourceMapGenerated: false,
                affectedFiles: []
            };
        }
    }
    async runLinting(projectPath, lintCommand) {
        try {
            // Determine lint command
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            const scripts = packageJson.scripts || {};
            const command = lintCommand ||
                (scripts.lint ? 'npm run lint' :
                    scripts.eslint ? 'npm run eslint' :
                        'npx eslint src --ext .js,.jsx,.ts,.tsx');
            colored_logger_1.cliLogger.info('COMPILE', `Running lint: ${command}`);
            (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 60000
            });
            return { success: true, warnings: [] };
        }
        catch (error) {
            const warnings = this.parseLintErrors(error.stdout || error.message || '');
            return {
                success: warnings.length === 0,
                warnings
            };
        }
    }
    async runQuickTests(projectPath, testCommand) {
        try {
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            const scripts = packageJson.scripts || {};
            const command = testCommand ||
                (scripts['test:quick'] ? 'npm run test:quick' :
                    scripts.test ? 'npm run test -- --bail --passWithNoTests' :
                        'npx jest --bail --passWithNoTests');
            colored_logger_1.cliLogger.info('COMPILE', `Running quick test: ${command}`);
            (0, child_process_1.execSync)(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 30000 // Quick test should be fast
            });
            return { success: true, errors: [] };
        }
        catch (error) {
            const errors = this.parseTestErrors(error.stdout || error.message || '');
            return {
                success: false,
                errors
            };
        }
    }
    parseTypeScriptErrors(output) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // TypeScript error format: file.ts(line,column): error TSxxxx: message
            const tsErrorMatch = line.match(/(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s+(.+)/);
            if (tsErrorMatch) {
                errors.push({
                    file: tsErrorMatch[1],
                    line: parseInt(tsErrorMatch[2]),
                    column: parseInt(tsErrorMatch[3]),
                    severity: tsErrorMatch[4],
                    code: `TS${tsErrorMatch[5]}`,
                    message: tsErrorMatch[6],
                    suggestion: this.getTypeScriptSuggestion(tsErrorMatch[5], tsErrorMatch[6])
                });
            }
        }
        return errors;
    }
    parseBuildErrors(output, buildCommand) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // Generic error patterns
            const errorPatterns = [
                /ERROR in (.+?):(\d+):(\d+)\s+(.+)/, // Webpack style
                /Error: (.+) at (.+?):(\d+):(\d+)/, // General JS error
                /✖ (.+?) \((.+?):(\d+):(\d+)\)/, // ESLint style
                /(.+?):(\d+):(\d+): (.+)/ // Generic file:line:col format
            ];
            for (const pattern of errorPatterns) {
                const match = line.match(pattern);
                if (match) {
                    errors.push({
                        file: match[2] || match[1] || 'unknown',
                        line: parseInt(match[3] || match[2] || '1'),
                        column: parseInt(match[4] || match[3] || '1'),
                        severity: 'error',
                        code: 'BUILD_ERROR',
                        message: match[4] || match[1] || line,
                        suggestion: this.getBuildErrorSuggestion(line)
                    });
                    break;
                }
            }
        }
        return errors;
    }
    parseLintErrors(output) {
        const warnings = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // ESLint format: file.js:line:column: message (rule-name)
            const eslintMatch = line.match(/(.+?):(\d+):(\d+):\s+(warning|error)\s+(.+?)\s+(.+)/);
            if (eslintMatch) {
                warnings.push({
                    file: eslintMatch[1],
                    line: parseInt(eslintMatch[2]),
                    column: parseInt(eslintMatch[3]),
                    severity: eslintMatch[4],
                    code: eslintMatch[6] || 'LINT_ISSUE',
                    message: eslintMatch[5],
                    suggestion: this.getLintSuggestion(eslintMatch[6], eslintMatch[5])
                });
            }
        }
        return warnings;
    }
    parseTestErrors(output) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // Jest error format varies, look for test failures
            if (line.includes('FAIL') || line.includes('✕') || line.includes('Error:')) {
                errors.push({
                    file: 'test',
                    line: 1,
                    column: 1,
                    severity: 'error',
                    code: 'TEST_FAILURE',
                    message: line.trim(),
                    suggestion: 'Fix failing tests before proceeding with code generation'
                });
            }
        }
        return errors;
    }
    getTypeScriptSuggestion(code, message) {
        const suggestions = {
            '2304': 'Import the missing module or check the spelling',
            '2339': 'Check property name spelling or add property to type definition',
            '2345': 'Check function signature and provided arguments',
            '2322': 'Ensure all required properties are provided',
            '2571': 'Add return type annotation to function'
        };
        return suggestions[code] || 'Check TypeScript documentation for this error';
    }
    getBuildErrorSuggestion(error) {
        if (error.includes('Module not found')) {
            return 'Install missing dependency or check import path';
        }
        if (error.includes('Cannot resolve')) {
            return 'Verify file exists and import path is correct';
        }
        if (error.includes('Unexpected token')) {
            return 'Check for syntax errors in the referenced file';
        }
        return 'Review build configuration and dependencies';
    }
    getLintSuggestion(rule, message) {
        const commonSuggestions = {
            'no-unused-vars': 'Remove unused variables or prefix with underscore',
            'no-console': 'Remove console statements or use proper logging',
            '@typescript-eslint/no-explicit-any': 'Use more specific type instead of any',
            'prefer-const': 'Use const for variables that are not reassigned'
        };
        return commonSuggestions[rule] || 'Follow the linting rule guidelines';
    }
    async analyzeBuildOutput(projectPath) {
        const outputDirs = ['dist', 'build', 'out', '.next'];
        let outputSize = 0;
        let sourceMapGenerated = false;
        const affectedFiles = [];
        for (const dir of outputDirs) {
            const outputPath = path.join(projectPath, dir);
            try {
                const stats = await fs.stat(outputPath);
                if (stats.isDirectory()) {
                    const files = await this.getDirectorySize(outputPath);
                    outputSize += files.size;
                    affectedFiles.push(...files.files);
                    if (files.files.some(f => f.endsWith('.map'))) {
                        sourceMapGenerated = true;
                    }
                }
            }
            catch {
                // Directory doesn't exist, skip
            }
        }
        return { outputSize, sourceMapGenerated, affectedFiles };
    }
    async getDirectorySize(dirPath) {
        let totalSize = 0;
        const files = [];
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    const subDir = await this.getDirectorySize(fullPath);
                    totalSize += subDir.size;
                    files.push(...subDir.files);
                }
                else {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to analyze directory ${dirPath}:`, error);
        }
        return { size: totalSize, files };
    }
    combineResults(typeCheckResult, compilationResult, lintResult, testResult, framework, buildCommand, totalDuration) {
        const allErrors = [
            ...typeCheckResult.errors,
            ...compilationResult.errors,
            ...(testResult?.errors || [])
        ];
        const allWarnings = lintResult?.warnings || [];
        const success = typeCheckResult.success &&
            compilationResult.success &&
            (lintResult?.success !== false) &&
            (testResult?.success !== false);
        const recommendations = this.generateCompilationRecommendations(allErrors, allWarnings, success, framework);
        return {
            success,
            errors: allErrors,
            warnings: allWarnings,
            duration: totalDuration,
            command: buildCommand,
            framework,
            outputSize: compilationResult.outputSize,
            sourceMapGenerated: compilationResult.sourceMapGenerated,
            affectedFiles: compilationResult.affectedFiles,
            recommendations
        };
    }
    generateCompilationRecommendations(errors, warnings, success, framework) {
        const recommendations = [];
        if (!success) {
            recommendations.push('❌ Compilation failed - fix errors before proceeding with code generation');
            const criticalErrors = errors.filter(e => e.severity === 'error');
            if (criticalErrors.length > 0) {
                recommendations.push(`Fix ${criticalErrors.length} compilation errors immediately`);
            }
            const typeErrors = errors.filter(e => e.code.startsWith('TS'));
            if (typeErrors.length > 0) {
                recommendations.push(`Address ${typeErrors.length} TypeScript type errors`);
            }
        }
        else {
            recommendations.push('✅ Compilation successful - safe to proceed with code generation');
        }
        if (warnings.length > 0) {
            recommendations.push(`Consider addressing ${warnings.length} linting warnings for better code quality`);
        }
        if (framework === 'typescript') {
            recommendations.push('TypeScript provides excellent type safety for AI-assisted development');
        }
        return recommendations;
    }
}
exports.CompilationVerifier = CompilationVerifier;
exports.default = CompilationVerifier;
//# sourceMappingURL=verifier.js.map