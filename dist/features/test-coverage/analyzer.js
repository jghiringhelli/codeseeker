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
exports.TestCoverageAnalyzer = exports.TestMappingAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const child_process_1 = require("child_process");
class TestMappingAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeTestMapping(params) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.toolExecution('test-mapping-analyzer', 'started');
        try {
            // 1. Find all test files and analyze them
            const testFiles = await this.findAndAnalyzeTestFiles(params.projectPath, params.excludePatterns);
            // 2. Find all source files and analyze them
            const sourceFiles = await this.findAndAnalyzeSourceFiles(params.projectPath, params.excludePatterns);
            // 3. Build bidirectional test mappings
            const { testMappings, reverseTestMappings } = await this.buildTestMappings(testFiles, sourceFiles);
            // 4. Check for stale tests (tests that test deleted/modified code)
            const staleTests = params.checkStaleTests ?
                await this.findStaleTests(testFiles, sourceFiles) : [];
            // 5. Find untested functions that need tests
            const untestedFunctions = await this.findUntestedFunctions(sourceFiles, testMappings);
            // 6. Identify maintenance issues
            const maintenanceIssues = await this.identifyMaintenanceIssues(testFiles, sourceFiles, testMappings);
            // 7. Generate sync actions
            const syncActions = await this.generateSyncActions(maintenanceIssues, staleTests, untestedFunctions, params.autoSync);
            // 8. Generate recommendations
            const recommendations = this.generateMappingRecommendations(maintenanceIssues, syncActions, testMappings);
            const result = {
                testFiles,
                sourceFiles,
                testMappings,
                reverseTestMappings,
                maintenanceIssues,
                staleTests,
                untestedFunctions,
                recommendations,
                syncActions
            };
            const duration = Date.now() - startTime;
            colored_logger_1.cliLogger.toolExecution('test-mapping-analyzer', 'completed', duration, {
                testFilesFound: testFiles.length,
                sourceFilesFound: sourceFiles.length,
                mappingsCreated: testMappings.size,
                maintenanceIssues: maintenanceIssues.length,
                staleTests: staleTests.length,
                untestedFunctions: untestedFunctions.length,
                syncActions: syncActions.length
            });
            return result;
        }
        catch (error) {
            colored_logger_1.cliLogger.toolExecution('test-mapping-analyzer', 'failed', Date.now() - startTime, error);
            throw error;
        }
    }
    async findAndAnalyzeTestFiles(projectPath, excludePatterns) {
        const testPatterns = [
            '**/*.test.{js,ts,tsx,jsx}',
            '**/*.spec.{js,ts,tsx,jsx}',
            '**/test/**/*.{js,ts,tsx,jsx}',
            '**/tests/**/*.{js,ts,tsx,jsx}',
            '**/__tests__/**/*.{js,ts,tsx,jsx}',
            '!**/node_modules/**'
        ];
        if (excludePatterns) {
            testPatterns.push(...excludePatterns.map(p => `!${p}`));
        }
        const testFiles = [];
        const files = await (0, glob_1.glob)(testPatterns, { cwd: projectPath });
        for (const file of files) {
            const fullPath = path.join(projectPath, file);
            const testFile = await this.analyzeTestFile(fullPath);
            if (testFile) {
                testFiles.push(testFile);
            }
        }
        return testFiles;
    }
    async findAndAnalyzeSourceFiles(projectPath, excludePatterns) {
        const sourcePatterns = [
            'src/**/*.{js,ts,tsx,jsx}',
            'lib/**/*.{js,ts,tsx,jsx}',
            '!**/*.test.{js,ts,tsx,jsx}',
            '!**/*.spec.{js,ts,tsx,jsx}',
            '!**/node_modules/**'
        ];
        if (excludePatterns) {
            sourcePatterns.push(...excludePatterns.map(p => `!${p}`));
        }
        const sourceFiles = [];
        const files = await (0, glob_1.glob)(sourcePatterns, { cwd: projectPath });
        for (const file of files) {
            const fullPath = path.join(projectPath, file);
            const sourceFile = await this.analyzeSourceFile(fullPath);
            if (sourceFile) {
                sourceFiles.push(sourceFile);
            }
        }
        return sourceFiles;
    }
    async findTestFiles(projectPath, excludePatterns) {
        const testPatterns = [
            '**/*.test.{js,ts,tsx,jsx}',
            '**/*.spec.{js,ts,tsx,jsx}',
            '**/test/**/*.{js,ts,tsx,jsx}',
            '**/tests/**/*.{js,ts,tsx,jsx}',
            '**/__tests__/**/*.{js,ts,tsx,jsx}',
            '**/cypress/**/*.{js,ts}',
            '**/e2e/**/*.{js,ts}',
            '!**/node_modules/**'
        ];
        if (excludePatterns) {
            testPatterns.push(...excludePatterns.map(p => `!${p}`));
        }
        const testFiles = [];
        for (const pattern of testPatterns.filter(p => !p.startsWith('!'))) {
            const files = await (0, glob_1.glob)(pattern, { cwd: projectPath });
            for (const file of files) {
                const fullPath = path.join(projectPath, file);
                const testFile = await this.analyzeTestFile(fullPath);
                if (testFile) {
                    testFiles.push(testFile);
                }
            }
        }
        return testFiles;
    }
    async analyzeTestFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Detect test framework
            const testFramework = this.detectFileTestFramework(content);
            // Count tests
            const testCount = this.countTests(content);
            // Determine test types
            const testTypes = this.determineTestTypes(filePath, content);
            // Find covered files (imports)
            const coveredFileStrings = this.findCoveredFiles(content, filePath);
            // Convert to TestFileMapping format
            const coveredFiles = coveredFileStrings.map(importPath => ({
                sourceFile: importPath,
                importPath: importPath,
                mappingType: 'direct',
                needsUpdate: false,
                confidence: 0.8
            }));
            // Extract test methods
            const testMethods = this.extractTestMethods(content);
            return {
                path: filePath,
                testFramework,
                testCount,
                testTypes,
                coveredFiles,
                testMethods
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze test file ${filePath}:`, error);
            return null;
        }
    }
    detectFileTestFramework(content) {
        if (content.includes('describe') && content.includes('it')) {
            if (content.includes('@jest') || content.includes('jest.'))
                return 'jest';
            if (content.includes('mocha'))
                return 'mocha';
            if (content.includes('vitest') || content.includes('vi.'))
                return 'vitest';
            return 'jest'; // Default for describe/it pattern
        }
        if (content.includes('cy.') || content.includes('cypress'))
            return 'cypress';
        if (content.includes('page.') && content.includes('test('))
            return 'playwright';
        return 'unknown';
    }
    countTests(content) {
        const testPatterns = [
            /\bit\s*\(/g,
            /\btest\s*\(/g,
            /\bshould\s*\(/g
        ];
        let total = 0;
        for (const pattern of testPatterns) {
            const matches = content.match(pattern);
            if (matches)
                total += matches.length;
        }
        return total;
    }
    determineTestTypes(filePath, content) {
        const types = [];
        const pathLower = filePath.toLowerCase();
        // Check path patterns
        if (pathLower.includes('e2e') || pathLower.includes('cypress') || pathLower.includes('playwright')) {
            types.push('e2e');
        }
        if (pathLower.includes('integration') || pathLower.includes('int.test')) {
            types.push('integration');
        }
        // Check content patterns
        if (content.includes('cy.') || content.includes('browser') || content.includes('page.goto')) {
            types.push('e2e');
        }
        if (content.includes('supertest') || content.includes('request') ||
            content.includes('api') || content.includes('server')) {
            types.push('integration');
        }
        // Default to unit if no specific patterns found
        if (types.length === 0) {
            types.push('unit');
        }
        return types;
    }
    findCoveredFiles(content, testFilePath) {
        const imports = [];
        // Extract import statements for local files
        const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            // Filter for local imports (relative paths)
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
                imports.push(importPath);
            }
        }
        return imports;
    }
    countAssertions(content) {
        const assertionPatterns = [
            /\.expect\(/g,
            /\.should\(/g,
            /\.toBe\(/g,
            /\.toEqual\(/g,
            /\.toHave\(/g,
            /\.toContain\(/g,
            /assert\./g,
            /chai\./g
        ];
        let total = 0;
        for (const pattern of assertionPatterns) {
            const matches = content.match(pattern);
            if (matches)
                total += matches.length;
        }
        return total;
    }
    async runCoverageAnalysis(projectPath) {
        try {
            // Try to run coverage based on available frameworks
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            let coverageCommand = '';
            if (packageJson.scripts?.coverage) {
                coverageCommand = 'npm run coverage';
            }
            else if (packageJson.scripts?.test) {
                coverageCommand = 'npm run test -- --coverage';
            }
            else {
                return this.getDefaultCoverage();
            }
            // Execute coverage command
            const output = (0, child_process_1.execSync)(coverageCommand, {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 60000
            });
            // Parse coverage output
            return this.parseCoverageOutput(output);
        }
        catch (error) {
            this.logger.warn('Failed to run coverage analysis:', error);
            return this.getDefaultCoverage();
        }
    }
    async estimateCoverage(projectPath, testFiles) {
        try {
            // Find all source files
            const sourceFiles = await (0, glob_1.glob)('src/**/*.{js,ts,tsx,jsx}', { cwd: projectPath });
            // Get covered files from tests
            const coveredFiles = new Set();
            testFiles.forEach(test => {
                test.coveredFiles.forEach(mapping => coveredFiles.add(mapping.sourceFile));
            });
            // Estimate coverage based on file coverage
            const estimatedCoverage = Math.min(90, (coveredFiles.size / sourceFiles.length) * 100);
            return {
                lines: estimatedCoverage,
                functions: Math.max(0, estimatedCoverage - 5),
                branches: Math.max(0, estimatedCoverage - 10),
                statements: estimatedCoverage
            };
        }
        catch (error) {
            this.logger.warn('Failed to estimate coverage:', error);
            return this.getDefaultCoverage();
        }
    }
    getDefaultCoverage() {
        return {
            lines: 0,
            functions: 0,
            branches: 0,
            statements: 0
        };
    }
    parseCoverageOutput(output) {
        // Parse Jest/NYC coverage output
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('All files')) {
                const match = line.match(/(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)/);
                if (match) {
                    return {
                        statements: parseFloat(match[1]),
                        branches: parseFloat(match[2]),
                        functions: parseFloat(match[3]),
                        lines: parseFloat(match[4])
                    };
                }
            }
        }
        return this.getDefaultCoverage();
    }
    async analyzeCoverageGaps(projectPath, testFiles, coverage, threshold = 80) {
        const gaps = [];
        try {
            // Find all source files
            const sourceFiles = await (0, glob_1.glob)('src/**/*.{js,ts,tsx,jsx}', { cwd: projectPath });
            // Get files covered by tests
            const coveredFiles = new Set();
            testFiles.forEach(test => {
                test.coveredFiles.forEach(mapping => coveredFiles.add(mapping.sourceFile));
            });
            // Check for untested files
            for (const sourceFile of sourceFiles) {
                const isTestFile = sourceFile.includes('.test.') || sourceFile.includes('.spec.');
                if (isTestFile)
                    continue;
                const isCovered = Array.from(coveredFiles).some(covered => sourceFile.includes(covered.replace(/\.[^.]+$/, '')));
                if (!isCovered) {
                    const fullPath = path.join(projectPath, sourceFile);
                    const severity = await this.assessFileSeverity(fullPath);
                    gaps.push({
                        type: 'function',
                        filePath: sourceFile,
                        severity,
                        description: `File ${sourceFile} has no corresponding tests`
                    });
                }
            }
            // Check for low overall coverage
            if (coverage.lines < threshold) {
                gaps.push({
                    type: 'line',
                    filePath: 'project',
                    severity: coverage.lines < 50 ? 'critical' : coverage.lines < 70 ? 'high' : 'medium',
                    description: `Overall line coverage is ${coverage.lines}%, below threshold of ${threshold}%`
                });
            }
        }
        catch (error) {
            this.logger.warn('Failed to analyze coverage gaps:', error);
        }
        return gaps;
    }
    async assessFileSeverity(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // High severity for files with many functions or complex logic
            const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=/g) || []).length;
            const complexity = (content.match(/if\s*\(|while\s*\(|for\s*\(|switch\s*\(/g) || []).length;
            if (functionCount > 10 || complexity > 15)
                return 'critical';
            if (functionCount > 5 || complexity > 8)
                return 'high';
            if (functionCount > 2 || complexity > 3)
                return 'medium';
            return 'low';
        }
        catch (error) {
            return 'low';
        }
    }
    async generateTestSuggestions(projectPath, testFiles, coverageGaps) {
        const suggestions = [];
        // Suggest tests for untested files
        const untestedFiles = coverageGaps.filter(gap => gap.filePath !== 'project');
        for (const gap of untestedFiles) {
            const suggestion = await this.generateFileSuggestion(path.join(projectPath, gap.filePath), gap.severity);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }
        // Suggest integration tests if only unit tests exist
        const hasIntegrationTests = testFiles.some(test => test.testTypes.includes('integration'));
        if (!hasIntegrationTests) {
            suggestions.push({
                type: 'integration_test',
                priority: 'medium',
                targetFunction: 'project',
                suggestedTestName: 'Integration test suite',
                reasoning: 'No integration tests found'
            });
        }
        // Suggest E2E tests for UI projects
        const hasE2ETests = testFiles.some(test => test.testTypes.includes('e2e'));
        const hasUIComponents = await this.detectUIComponents(projectPath);
        if (!hasE2ETests && hasUIComponents) {
            suggestions.push({
                type: 'integration_test',
                priority: 'medium',
                targetFunction: 'project',
                suggestedTestName: 'E2E test suite',
                reasoning: 'UI components found but no E2E tests'
            });
        }
        return suggestions;
    }
    async generateFileSuggestion(filePath, severity) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Extract function names
            const functions = this.extractFunctions(content);
            return {
                type: 'unit_test',
                priority: severity,
                targetFunction: functions[0] || 'unknown',
                suggestedTestName: `Test ${path.basename(filePath)} functions`,
                reasoning: `File contains ${functions.length} untested functions`
            };
        }
        catch (error) {
            return null;
        }
    }
    extractFunctions(content) {
        const functions = [];
        const patterns = [
            /function\s+(\w+)\s*\(/g,
            /const\s+(\w+)\s*=\s*\(/g,
            /(\w+)\s*:\s*\([^)]*\)\s*=>/g,
            /export\s+(?:const\s+)?(\w+)\s*=/g
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                functions.push(match[1]);
            }
        }
        return [...new Set(functions)];
    }
    extractFileDependencies(content) {
        const dependencies = [];
        const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            if (!match[1].startsWith('.')) {
                dependencies.push(match[1]);
            }
        }
        return dependencies;
    }
    async detectUIComponents(projectPath) {
        try {
            const uiFiles = await (0, glob_1.glob)('src/**/*.{jsx,tsx,vue}', { cwd: projectPath });
            return uiFiles.length > 0;
        }
        catch {
            return false;
        }
    }
    async identifyCriticalFiles(projectPath) {
        const criticalFiles = [];
        try {
            // Files that are likely critical
            const criticalPatterns = [
                'src/main.{js,ts}',
                'src/index.{js,ts}',
                'src/app.{js,ts,jsx,tsx}',
                'src/**/auth*.{js,ts}',
                'src/**/security*.{js,ts}',
                'src/**/payment*.{js,ts}',
                'src/**/api*.{js,ts}',
                'src/**/database*.{js,ts}'
            ];
            for (const pattern of criticalPatterns) {
                const files = await (0, glob_1.glob)(pattern, { cwd: projectPath });
                criticalFiles.push(...files);
            }
        }
        catch (error) {
            this.logger.warn('Failed to identify critical files:', error);
        }
        return [...new Set(criticalFiles)];
    }
    generateRecommendations(testFiles, coverageGaps, testSuggestions, coverage) {
        const recommendations = [];
        // Coverage recommendations
        if (coverage.lines < 80) {
            recommendations.push(`Increase line coverage from ${Math.round(coverage.lines)}% to at least 80%`);
        }
        if (coverage.branches < 70) {
            recommendations.push(`Improve branch coverage from ${Math.round(coverage.branches)}% by testing edge cases`);
        }
        // Test file recommendations
        const criticalGaps = coverageGaps.filter(gap => gap.severity === 'critical');
        if (criticalGaps.length > 0) {
            recommendations.push(`Address ${criticalGaps.length} critical coverage gaps immediately`);
        }
        // Test type recommendations
        const testTypes = new Set(testFiles.flatMap(t => t.testTypes));
        if (!testTypes.has('integration')) {
            recommendations.push('Add integration tests to verify component interactions');
        }
        if (!testTypes.has('e2e')) {
            recommendations.push('Consider adding E2E tests for critical user workflows');
        }
        // Framework recommendations
        const frameworks = [...new Set(testFiles.map(t => t.testFramework))];
        if (frameworks.length > 2) {
            recommendations.push('Consider standardizing on fewer test frameworks for consistency');
        }
        return recommendations;
    }
    calculateQualityScore(coverage, coverageGaps, testFileCount, criticalFileCount) {
        let score = 0;
        // Coverage score (60% weight)
        const avgCoverage = (coverage.lines + coverage.functions + coverage.branches + coverage.statements) / 4;
        score += (avgCoverage / 100) * 60;
        // Gap penalty (20% weight)
        const criticalGaps = coverageGaps.filter(g => g.severity === 'critical').length;
        const highGaps = coverageGaps.filter(g => g.severity === 'high').length;
        const gapPenalty = (criticalGaps * 10) + (highGaps * 5);
        score += Math.max(0, 20 - gapPenalty);
        // Test file count (10% weight)
        score += Math.min(10, testFileCount / 10);
        // Critical file coverage (10% weight)
        const untestedCritical = coverageGaps.filter(g => g.filePath !== 'project' &&
            criticalFileCount > 0).length;
        score += Math.max(0, 10 - (untestedCritical * 2));
        return Math.max(0, Math.min(100, score));
    }
    extractTestMethods(content) {
        const methods = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const testMatch = line.match(/(it|test|should)\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (testMatch) {
                methods.push({
                    name: testMatch[2],
                    line: i + 1,
                    type: 'unit',
                    testedFunctions: [],
                    testedClasses: [],
                    mocks: [],
                    fixtures: [],
                    dependencies: []
                });
            }
        }
        return methods;
    }
    async analyzeSourceFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            const functions = this.extractSourceFunctions(content);
            const classes = this.extractSourceClasses(content);
            const exports = this.extractExports(content);
            return {
                path: filePath,
                functions,
                classes,
                exports,
                lastModified: stats.mtime,
                testFiles: [],
                untested: functions.length > 0 && functions.every(f => f.testMethods.length === 0)
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze source file ${filePath}:`, error);
            return null;
        }
    }
    extractSourceFunctions(content) {
        const functions = [];
        const lines = content.split('\n');
        const functionPatterns = [
            /function\s+(\w+)\s*\(/,
            /const\s+(\w+)\s*=\s*\(/,
            /(\w+)\s*:\s*\([^)]*\)\s*=>/,
            /export\s+(?:const\s+)?(\w+)\s*=/
        ];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of functionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    functions.push({
                        name: match[1],
                        line: i + 1,
                        complexity: this.calculateComplexity(content, match[1]),
                        isPublic: line.includes('export'),
                        testMethods: [],
                        needsTestUpdate: false
                    });
                }
            }
        }
        return functions;
    }
    extractSourceClasses(content) {
        const classes = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                const methods = this.extractClassMethods(content, i);
                classes.push({
                    name: classMatch[1],
                    line: i + 1,
                    methods,
                    testFiles: [],
                    needsTestUpdate: false
                });
            }
        }
        return classes;
    }
    extractExports(content) {
        const exports = [];
        const exportRegex = /export\s+(?:const|function|class|default)?\s*(\w+)/g;
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }
        return [...new Set(exports)];
    }
    extractClassMethods(content, startLine) {
        const methods = [];
        const lines = content.split('\n');
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            // Stop at end of class
            if (line.match(/^}\s*$/))
                break;
            const methodMatch = line.match(/^\s*(\w+)\s*\(/);
            if (methodMatch && !line.includes('//') && !line.includes('/*')) {
                methods.push(methodMatch[1]);
            }
        }
        return methods;
    }
    calculateComplexity(content, functionName) {
        const functionStart = content.indexOf(functionName);
        if (functionStart === -1)
            return 1;
        const functionSection = content.slice(functionStart, functionStart + 1000);
        const complexityIndicators = [
            /if\s*\(/g,
            /while\s*\(/g,
            /for\s*\(/g,
            /switch\s*\(/g,
            /catch\s*\(/g
        ];
        let complexity = 1;
        for (const pattern of complexityIndicators) {
            const matches = functionSection.match(pattern);
            if (matches)
                complexity += matches.length;
        }
        return complexity;
    }
    async buildTestMappings(testFiles, sourceFiles) {
        const testMappings = new Map();
        const reverseTestMappings = new Map();
        for (const testFile of testFiles) {
            const testFilePaths = [];
            for (const mapping of testFile.coveredFiles) {
                const resolvedPath = this.resolveImportPath(mapping.importPath, testFile.path);
                if (resolvedPath) {
                    testFilePaths.push(resolvedPath);
                    // Add to reverse mapping
                    if (!reverseTestMappings.has(testFile.path)) {
                        reverseTestMappings.set(testFile.path, []);
                    }
                    reverseTestMappings.get(testFile.path).push(resolvedPath);
                    // Add to forward mapping
                    if (!testMappings.has(resolvedPath)) {
                        testMappings.set(resolvedPath, []);
                    }
                    testMappings.get(resolvedPath).push(testFile.path);
                }
            }
        }
        return { testMappings, reverseTestMappings };
    }
    resolveImportPath(importPath, fromFile) {
        try {
            if (importPath.startsWith('.')) {
                const dir = path.dirname(fromFile);
                const resolved = path.resolve(dir, importPath);
                return resolved;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async findStaleTests(testFiles, sourceFiles) {
        const staleTests = [];
        for (const testFile of testFiles) {
            for (const mapping of testFile.coveredFiles) {
                const sourceFile = sourceFiles.find(sf => sf.path.includes(mapping.sourceFile.replace(/\.[^.]+$/, '')));
                if (!sourceFile) {
                    staleTests.push(testFile.path);
                    break;
                }
                // Check if source file was modified after test file
                try {
                    const testStats = await fs.stat(testFile.path);
                    if (sourceFile.lastModified > testStats.mtime) {
                        staleTests.push(testFile.path);
                    }
                }
                catch {
                    // Ignore stat errors
                }
            }
        }
        return [...new Set(staleTests)];
    }
    async findUntestedFunctions(sourceFiles, testMappings) {
        const untestedFunctions = [];
        for (const sourceFile of sourceFiles) {
            const hasTests = testMappings.has(sourceFile.path);
            if (!hasTests) {
                sourceFile.functions.forEach(func => {
                    if (func.isPublic) {
                        untestedFunctions.push(`${sourceFile.path}:${func.name}`);
                    }
                });
            }
        }
        return untestedFunctions;
    }
    async identifyMaintenanceIssues(testFiles, sourceFiles, testMappings) {
        const issues = [];
        // Find orphaned tests (tests with no corresponding source)
        for (const testFile of testFiles) {
            for (const mapping of testFile.coveredFiles) {
                const hasSource = sourceFiles.some(sf => sf.path.includes(mapping.sourceFile.replace(/\.[^.]+$/, '')));
                if (!hasSource) {
                    issues.push({
                        type: 'orphaned_test',
                        severity: 'medium',
                        testFile: testFile.path,
                        description: `Test file references non-existent source: ${mapping.sourceFile}`,
                        suggestion: `Remove or update test references to ${mapping.sourceFile}`,
                        lastChecked: new Date()
                    });
                }
            }
        }
        // Find missing tests for critical functions
        for (const sourceFile of sourceFiles) {
            if (!testMappings.has(sourceFile.path)) {
                const criticalFunctions = sourceFile.functions.filter(f => f.isPublic && f.complexity > 3);
                if (criticalFunctions.length > 0) {
                    issues.push({
                        type: 'missing_test',
                        severity: 'high',
                        sourceFile: sourceFile.path,
                        description: `Source file has ${criticalFunctions.length} complex public functions without tests`,
                        suggestion: `Create test file for ${sourceFile.path}`,
                        affectedFunctions: criticalFunctions.map(f => f.name),
                        lastChecked: new Date()
                    });
                }
            }
        }
        return issues;
    }
    async generateSyncActions(maintenanceIssues, staleTests, untestedFunctions, autoSync) {
        const actions = [];
        // Actions for maintenance issues
        for (const issue of maintenanceIssues) {
            switch (issue.type) {
                case 'missing_test':
                    actions.push({
                        action: 'create_test',
                        priority: issue.severity,
                        sourceFile: issue.sourceFile,
                        description: `Create test file for ${issue.sourceFile}`,
                        reason: issue.description
                    });
                    break;
                case 'orphaned_test':
                    actions.push({
                        action: 'remove_test',
                        priority: 'low',
                        testFile: issue.testFile,
                        description: `Remove or update orphaned test references`,
                        reason: issue.description
                    });
                    break;
            }
        }
        // Actions for stale tests
        for (const staleTest of staleTests) {
            actions.push({
                action: 'update_test',
                priority: 'medium',
                testFile: staleTest,
                description: `Update stale test file ${staleTest}`,
                reason: 'Test file is older than corresponding source files'
            });
        }
        // Actions for untested functions
        for (const untestedFunction of untestedFunctions.slice(0, 10)) { // Limit to first 10
            const [sourceFile, functionName] = untestedFunction.split(':');
            actions.push({
                action: 'create_test',
                priority: 'medium',
                sourceFile,
                description: `Add test for function ${functionName}`,
                reason: `Function ${functionName} has no test coverage`
            });
        }
        return actions;
    }
    generateMappingRecommendations(maintenanceIssues, syncActions, testMappings) {
        const recommendations = [];
        const criticalIssues = maintenanceIssues.filter(i => i.severity === 'critical');
        const highIssues = maintenanceIssues.filter(i => i.severity === 'high');
        const criticalActions = syncActions.filter(a => a.priority === 'critical');
        if (criticalIssues.length > 0) {
            recommendations.push(`Address ${criticalIssues.length} critical test maintenance issues immediately`);
        }
        if (highIssues.length > 0) {
            recommendations.push(`Resolve ${highIssues.length} high-priority test issues`);
        }
        if (criticalActions.length > 0) {
            recommendations.push(`Execute ${criticalActions.length} critical sync actions`);
        }
        const coveragePercentage = (testMappings.size / Math.max(1, testMappings.size + maintenanceIssues.length)) * 100;
        if (coveragePercentage < 80) {
            recommendations.push(`Improve test coverage from ${Math.round(coveragePercentage)}% to at least 80%`);
        }
        if (syncActions.length > 20) {
            recommendations.push('Consider implementing automated test generation to handle large number of sync actions');
        }
        return recommendations;
    }
}
exports.TestMappingAnalyzer = TestMappingAnalyzer;
exports.TestCoverageAnalyzer = TestMappingAnalyzer;
exports.default = TestMappingAnalyzer;
//# sourceMappingURL=analyzer.js.map