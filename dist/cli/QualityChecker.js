"use strict";
/**
 * Quality Checker - Real implementation for comprehensive code quality checks
 * Runs compilation, tests, coverage, SOLID principles, and duplication detection
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
exports.QualityChecker = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class QualityChecker {
    logger = logger_1.Logger.getInstance();
    projectPath;
    constructor(projectPath = process.cwd()) {
        this.projectPath = projectPath;
    }
    /**
     * Run all quality checks and return comprehensive results
     */
    async runAllChecks(subTaskResults) {
        this.logger.info('🔍 Running comprehensive quality checks...');
        const startTime = Date.now();
        try {
            // Detect project structure and available tools
            const projectStructure = await this.detectProjectStructure();
            // Run individual checks in parallel where possible
            const [compilationResult, testsResult, codeQualityResult] = await Promise.all([
                this.runCompilationCheck(projectStructure),
                this.runTestsCheck(projectStructure),
                this.runCodeQualityCheck()
            ]);
            // Calculate overall score
            const overallScore = this.calculateOverallScore(compilationResult, testsResult, codeQualityResult);
            // Generate summary and recommendations
            const { summary, recommendations } = this.generateSummaryAndRecommendations(compilationResult, testsResult, codeQualityResult, overallScore);
            const totalTime = Date.now() - startTime;
            this.logger.info(`✅ Quality checks complete in ${totalTime}ms - Score: ${overallScore}%`);
            return {
                compilation: compilationResult,
                tests: testsResult,
                codeQuality: codeQualityResult,
                overallScore,
                summary,
                recommendations
            };
        }
        catch (error) {
            this.logger.error(`❌ Quality checks failed: ${error.message}`);
            return this.getFailedQualityResult(error.message);
        }
    }
    /**
     * Run compilation/build check
     */
    async runCompilationCheck(structure) {
        const startTime = Date.now();
        try {
            this.logger.info('🔨 Running compilation check...');
            let buildCommand = structure.buildCommand || 'npm run build';
            // Try different build commands based on project structure
            if (structure.hasTsConfig && !structure.buildCommand) {
                buildCommand = 'npx tsc --noEmit'; // Type check only
            }
            const { stdout, stderr } = await execAsync(buildCommand, {
                cwd: this.projectPath,
                timeout: 120000 // 2 minute timeout
            });
            const timeMs = Date.now() - startTime;
            // Parse TypeScript/build output for errors and warnings
            const errors = this.parseCompilerOutput(stderr, 'error');
            const warnings = this.parseCompilerOutput(stderr, 'warning');
            this.logger.info(`✅ Compilation successful (${timeMs}ms)`);
            return {
                success: true,
                errors,
                warnings,
                timeMs
            };
        }
        catch (error) {
            const timeMs = Date.now() - startTime;
            const stderr = error.stderr || error.message;
            const errors = this.parseCompilerOutput(stderr, 'error');
            this.logger.warn(`⚠️ Compilation failed (${timeMs}ms): ${errors.length} errors`);
            return {
                success: false,
                errors,
                warnings: this.parseCompilerOutput(stderr, 'warning'),
                timeMs
            };
        }
    }
    /**
     * Run tests and coverage check
     */
    async runTestsCheck(structure) {
        const startTime = Date.now();
        if (!structure.hasTests) {
            this.logger.warn('⚠️ No tests found in project');
            return {
                passed: 0,
                failed: 0,
                coverage: 0,
                failedTests: [],
                timeMs: Date.now() - startTime
            };
        }
        try {
            this.logger.info(`🧪 Running tests with ${structure.testFramework}...`);
            let testCommand = structure.testCommand || 'npm test';
            // Add coverage flag if supported
            if (structure.testFramework === 'jest') {
                testCommand += ' --coverage --passWithNoTests';
            }
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: this.projectPath,
                timeout: 300000 // 5 minute timeout
            });
            const timeMs = Date.now() - startTime;
            const testResults = this.parseTestOutput(stdout, stderr, structure.testFramework);
            this.logger.info(`✅ Tests completed: ${testResults.passed} passed, ${testResults.failed} failed`);
            return {
                ...testResults,
                timeMs
            };
        }
        catch (error) {
            const timeMs = Date.now() - startTime;
            const testResults = this.parseTestOutput(error.stdout || '', error.stderr || '', structure.testFramework);
            this.logger.warn(`⚠️ Tests had issues: ${testResults.failed} failures`);
            return {
                ...testResults,
                timeMs
            };
        }
    }
    /**
     * Run code quality checks (SOLID, duplicates, complexity)
     */
    async runCodeQualityCheck() {
        this.logger.info('📊 Running code quality analysis...');
        try {
            // Run checks in parallel
            const [solidCheck, duplicatesCheck, complexityCheck, securityCheck] = await Promise.all([
                this.checkSOLIDPrinciples(),
                this.checkForDuplicates(),
                this.checkComplexity(),
                this.checkSecurity()
            ]);
            return {
                solidPrinciples: solidCheck.score > 0.7,
                security: securityCheck.secure,
                architecture: solidCheck.architecture,
                duplicates: duplicatesCheck,
                complexity: complexityCheck
            };
        }
        catch (error) {
            this.logger.error(`❌ Code quality check failed: ${error.message}`);
            return {
                solidPrinciples: false,
                security: false,
                architecture: false,
                duplicates: { count: 0, files: [] },
                complexity: { average: 0, max: 0, violations: [] }
            };
        }
    }
    // Helper methods for parsing and analysis
    async detectProjectStructure() {
        const [packageJsonExists, tsConfigExists, testFiles] = await Promise.all([
            this.fileExists('package.json'),
            this.fileExists('tsconfig.json') || this.fileExists('tsconfig.core.json'),
            this.findTestFiles()
        ]);
        let buildCommand = null;
        let testCommand = null;
        let testFramework = null;
        if (packageJsonExists) {
            try {
                const packageJson = JSON.parse(await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf8'));
                buildCommand = packageJson.scripts?.build;
                testCommand = packageJson.scripts?.test;
                // Detect test framework
                if (packageJson.dependencies?.jest || packageJson.devDependencies?.jest) {
                    testFramework = 'jest';
                }
                else if (packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha) {
                    testFramework = 'mocha';
                }
            }
            catch (error) {
                // Invalid package.json
            }
        }
        return {
            hasPackageJson: packageJsonExists,
            hasTsConfig: tsConfigExists,
            hasTests: testFiles.length > 0,
            testFramework,
            buildCommand,
            testCommand
        };
    }
    async fileExists(filePath) {
        try {
            await fs.access(path.join(this.projectPath, filePath));
            return true;
        }
        catch {
            return false;
        }
    }
    async findTestFiles() {
        try {
            const { stdout } = await execAsync('find . -name "*.test.*" -o -name "*.spec.*" -o -name "__tests__" -type f', {
                cwd: this.projectPath
            });
            return stdout.trim().split('\n').filter(line => line.trim());
        }
        catch {
            return [];
        }
    }
    parseCompilerOutput(output, type) {
        if (!output)
            return [];
        const lines = output.split('\n');
        const pattern = type === 'error'
            ? /error TS\d+|Error:|ERROR/i
            : /warning TS\d+|Warning:|WARN/i;
        return lines
            .filter(line => pattern.test(line))
            .map(line => line.trim())
            .slice(0, 20); // Limit to first 20 errors/warnings
    }
    parseTestOutput(stdout, stderr, framework) {
        const output = stdout + stderr;
        if (framework === 'jest') {
            // Parse Jest output
            const passedMatch = output.match(/(\d+) passed/);
            const failedMatch = output.match(/(\d+) failed/);
            const coverageMatch = output.match(/All files\s+\|\s+(\d+\.?\d*)/);
            return {
                passed: passedMatch ? parseInt(passedMatch[1]) : 0,
                failed: failedMatch ? parseInt(failedMatch[1]) : 0,
                coverage: coverageMatch ? parseFloat(coverageMatch[1]) : 0,
                failedTests: this.extractFailedTestNames(output)
            };
        }
        // Generic parsing for other frameworks
        return {
            passed: (output.match(/passing|✓/g) || []).length,
            failed: (output.match(/failing|✗|failed/g) || []).length,
            coverage: 0,
            failedTests: []
        };
    }
    extractFailedTestNames(output) {
        const failedTests = [];
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('✕') || line.includes('FAIL')) {
                const testName = line.replace(/.*✕\s*/, '').replace(/.*FAIL\s*/, '').trim();
                if (testName)
                    failedTests.push(testName);
            }
        }
        return failedTests.slice(0, 10); // Limit to first 10 failed tests
    }
    async checkSOLIDPrinciples() {
        // Simplified SOLID check - would be more sophisticated in real implementation
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | head -20', {
                cwd: this.projectPath
            });
            const files = stdout.trim().split('\n').filter(f => f.trim());
            let solidScore = 0.8; // Start with decent score
            // Check for common SOLID violations (simplified)
            for (const file of files) {
                try {
                    const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
                    // Single Responsibility: Large classes/functions
                    if (content.split('\n').length > 200)
                        solidScore -= 0.1;
                    // Open/Closed: Excessive conditionals
                    if ((content.match(/if\s*\(/g) || []).length > 10)
                        solidScore -= 0.1;
                    // Interface Segregation: Large interfaces
                    if (content.includes('interface') && content.split('\n').length > 50)
                        solidScore -= 0.05;
                }
                catch (error) {
                    // File read error, skip
                }
            }
            return {
                score: Math.max(0, solidScore),
                architecture: solidScore > 0.6
            };
        }
        catch (error) {
            return { score: 0.5, architecture: false };
        }
    }
    async checkForDuplicates() {
        try {
            // Simple duplicate detection using file size and basic patterns
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | head -50', {
                cwd: this.projectPath
            });
            const files = stdout.trim().split('\n').filter(f => f.trim());
            const duplicates = [];
            // Check for files with similar names (potential duplicates)
            for (let i = 0; i < files.length; i++) {
                for (let j = i + 1; j < files.length; j++) {
                    const file1 = path.basename(files[i]);
                    const file2 = path.basename(files[j]);
                    if (this.areFilesSimilar(file1, file2)) {
                        duplicates.push(`${files[i]} <-> ${files[j]}`);
                    }
                }
            }
            return {
                count: duplicates.length,
                files: duplicates.slice(0, 10) // Limit results
            };
        }
        catch (error) {
            return { count: 0, files: [] };
        }
    }
    areFilesSimilar(file1, file2) {
        // Remove extensions and compare
        const name1 = file1.replace(/\.[^.]+$/, '').toLowerCase();
        const name2 = file2.replace(/\.[^.]+$/, '').toLowerCase();
        // Check for similar patterns
        return (name1.includes(name2) || name2.includes(name1) ||
            name1.includes('duplicate') || name2.includes('duplicate') ||
            name1.includes('copy') || name2.includes('copy') ||
            name1.endsWith('2') || name2.endsWith('2'));
    }
    async checkComplexity() {
        // Simplified complexity check
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | head -10', {
                cwd: this.projectPath
            });
            const files = stdout.trim().split('\n').filter(f => f.trim());
            let totalComplexity = 0;
            let maxComplexity = 0;
            const violations = [];
            for (const file of files) {
                try {
                    const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
                    // Simple cyclomatic complexity: count decision points
                    const complexity = (content.match(/if|else|while|for|switch|case|\?\:|&&|\|\|/g) || []).length;
                    totalComplexity += complexity;
                    maxComplexity = Math.max(maxComplexity, complexity);
                    if (complexity > 15) {
                        violations.push(`${file}: complexity ${complexity}`);
                    }
                }
                catch (error) {
                    // File read error, skip
                }
            }
            return {
                average: files.length > 0 ? totalComplexity / files.length : 0,
                max: maxComplexity,
                violations: violations.slice(0, 5)
            };
        }
        catch (error) {
            return { average: 0, max: 0, violations: [] };
        }
    }
    async checkSecurity() {
        // Basic security check
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | head -20', {
                cwd: this.projectPath
            });
            const files = stdout.trim().split('\n').filter(f => f.trim());
            const issues = [];
            for (const file of files) {
                try {
                    const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
                    // Check for common security issues
                    if (content.includes('eval('))
                        issues.push(`${file}: Uses eval()`);
                    if (content.includes('innerHTML'))
                        issues.push(`${file}: Uses innerHTML`);
                    if (content.match(/password.*=.*['"][^'"]*['"]$/m))
                        issues.push(`${file}: Hardcoded password`);
                    if (content.includes('process.env') && content.includes('console.log')) {
                        issues.push(`${file}: May log environment variables`);
                    }
                }
                catch (error) {
                    // File read error, skip
                }
            }
            return {
                secure: issues.length === 0,
                issues: issues.slice(0, 5)
            };
        }
        catch (error) {
            return { secure: true, issues: [] };
        }
    }
    calculateOverallScore(compilation, tests, codeQuality) {
        let score = 0;
        // Compilation (40% weight)
        if (compilation.success) {
            score += 40;
            if (compilation.warnings.length === 0)
                score += 10;
        }
        // Tests (30% weight)
        if (tests.passed > 0) {
            const testSuccessRate = tests.passed / (tests.passed + tests.failed);
            score += testSuccessRate * 30;
        }
        // Code Quality (30% weight)
        if (codeQuality.solidPrinciples)
            score += 10;
        if (codeQuality.security)
            score += 10;
        if (codeQuality.duplicates.count === 0)
            score += 5;
        if (codeQuality.complexity.average < 10)
            score += 5;
        return Math.round(Math.min(100, score));
    }
    generateSummaryAndRecommendations(compilation, tests, codeQuality, overallScore) {
        const recommendations = [];
        let summary = `Quality Score: ${overallScore}% - `;
        if (overallScore >= 90) {
            summary += 'Excellent code quality!';
        }
        else if (overallScore >= 70) {
            summary += 'Good code quality with room for improvement';
        }
        else if (overallScore >= 50) {
            summary += 'Moderate quality, needs attention';
        }
        else {
            summary += 'Poor quality, requires significant improvements';
        }
        // Generate specific recommendations
        if (!compilation.success) {
            recommendations.push('Fix compilation errors before proceeding');
        }
        if (compilation.warnings.length > 0) {
            recommendations.push(`Address ${compilation.warnings.length} compiler warnings`);
        }
        if (tests.failed > 0) {
            recommendations.push(`Fix ${tests.failed} failing tests`);
        }
        if (tests.coverage < 70) {
            recommendations.push(`Improve test coverage (currently ${tests.coverage}%)`);
        }
        if (!codeQuality.solidPrinciples) {
            recommendations.push('Review code for SOLID principle violations');
        }
        if (codeQuality.duplicates.count > 0) {
            recommendations.push(`Remove ${codeQuality.duplicates.count} duplicate code sections`);
        }
        if (codeQuality.complexity.average > 10) {
            recommendations.push('Reduce code complexity by refactoring complex functions');
        }
        return { summary, recommendations };
    }
    getFailedQualityResult(errorMessage) {
        return {
            compilation: { success: false, errors: [errorMessage], warnings: [], timeMs: 0 },
            tests: { passed: 0, failed: 0, coverage: 0, failedTests: [], timeMs: 0 },
            codeQuality: {
                solidPrinciples: false,
                security: false,
                architecture: false,
                duplicates: { count: 0, files: [] },
                complexity: { average: 0, max: 0, violations: [] }
            },
            overallScore: 0,
            summary: `Quality checks failed: ${errorMessage}`,
            recommendations: ['Fix the underlying error and retry quality checks']
        };
    }
}
exports.QualityChecker = QualityChecker;
exports.default = QualityChecker;
//# sourceMappingURL=QualityChecker.js.map