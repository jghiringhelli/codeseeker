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
exports.TestMappingAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
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
    async analyzeTestFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            // Detect test framework
            const testFramework = this.detectTestFramework(content);
            // Count tests and analyze methods
            const testMethods = this.extractTestMethods(content);
            const testCount = testMethods.length;
            // Determine test types
            const testTypes = this.determineTestTypes(filePath, content);
            // Find covered files through imports and mocks
            const coveredFiles = await this.mapTestToSourceFiles(content, filePath);
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
    async analyzeSourceFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            // Extract functions and classes
            const functions = this.extractFunctions(content);
            const classes = this.extractClasses(content);
            const exports = this.extractExports(content);
            return {
                path: filePath,
                functions,
                classes,
                exports,
                lastModified: stats.mtime,
                testFiles: [], // Will be populated during mapping
                untested: true // Will be updated during mapping
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze source file ${filePath}:`, error);
            return null;
        }
    }
    async buildTestMappings(testFiles, sourceFiles) {
        const testMappings = new Map();
        const reverseTestMappings = new Map();
        // Build source file -> test files mapping
        for (const testFile of testFiles) {
            reverseTestMappings.set(testFile.path, []);
            for (const mapping of testFile.coveredFiles) {
                const sourceFile = mapping.sourceFile;
                // Add to source -> test mapping
                if (!testMappings.has(sourceFile)) {
                    testMappings.set(sourceFile, []);
                }
                testMappings.get(sourceFile).push(testFile.path);
                // Add to test -> source mapping
                reverseTestMappings.get(testFile.path).push(sourceFile);
            }
        }
        // Update source files with their test mappings
        for (const sourceFile of sourceFiles) {
            sourceFile.testFiles = testMappings.get(sourceFile.path) || [];
            sourceFile.untested = sourceFile.testFiles.length === 0;
        }
        return { testMappings, reverseTestMappings };
    }
    detectTestFramework(content) {
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
    extractTestMethods(content) {
        const methods = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Match test method patterns
            const testPatterns = [
                /\bit\s*\(\s*['"`]([^'"`]+)['"`]/,
                /\btest\s*\(\s*['"`]([^'"`]+)['"`]/,
                /\bshould\s*\(\s*['"`]([^'"`]+)['"`]/
            ];
            for (const pattern of testPatterns) {
                const match = pattern.exec(line);
                if (match) {
                    const testName = match[1];
                    const testedFunctions = this.extractTestedFunctions(line, lines, index);
                    const mocks = this.extractMocks(line, lines, index);
                    methods.push({
                        name: testName,
                        line: index + 1,
                        type: this.inferTestType(testName, line),
                        testedFunctions,
                        testedClasses: [],
                        mocks,
                        fixtures: [],
                        dependencies: []
                    });
                    break;
                }
            }
        });
        return methods;
    }
    extractTestedFunctions(line, lines, startIndex) {
        const functions = [];
        // Look for function calls in test method and surrounding context
        const testBlock = lines.slice(startIndex, Math.min(startIndex + 20, lines.length)).join(' ');
        // Extract function call patterns
        const functionCallPatterns = [
            /(\w+)\s*\(/g,
            /\.(\w+)\s*\(/g,
            /expect\s*\(\s*(\w+)/g
        ];
        for (const pattern of functionCallPatterns) {
            let match;
            while ((match = pattern.exec(testBlock)) !== null) {
                const funcName = match[1];
                if (funcName && funcName.length > 2 && !this.isTestKeyword(funcName)) {
                    functions.push(funcName);
                }
            }
        }
        return [...new Set(functions)];
    }
    extractMocks(line, lines, startIndex) {
        const mocks = [];
        const testBlock = lines.slice(Math.max(0, startIndex - 5), startIndex + 15).join(' ');
        const mockPatterns = [
            /mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /jest\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /vi\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /mockImplementation/g,
            /spyOn\s*\(\s*(\w+)/g
        ];
        for (const pattern of mockPatterns) {
            let match;
            while ((match = pattern.exec(testBlock)) !== null) {
                if (match[1]) {
                    mocks.push(match[1]);
                }
            }
        }
        return [...new Set(mocks)];
    }
    isTestKeyword(word) {
        const testKeywords = [
            'describe', 'it', 'test', 'expect', 'should', 'beforeEach', 'afterEach',
            'beforeAll', 'afterAll', 'jest', 'mock', 'spy', 'vi', 'cy'
        ];
        return testKeywords.includes(word);
    }
    inferTestType(testName, line) {
        const testNameLower = testName.toLowerCase();
        const lineLower = line.toLowerCase();
        if (testNameLower.includes('integration') || lineLower.includes('integration')) {
            return 'integration';
        }
        if (testNameLower.includes('e2e') || lineLower.includes('cypress') || lineLower.includes('playwright')) {
            return 'e2e';
        }
        return 'unit';
    }
    determineTestTypes(filePath, content) {
        const types = [];
        const pathLower = filePath.toLowerCase();
        if (pathLower.includes('e2e') || content.includes('cy.') || content.includes('page.')) {
            types.push('e2e');
        }
        if (pathLower.includes('integration') || content.includes('supertest')) {
            types.push('integration');
        }
        if (types.length === 0) {
            types.push('unit');
        }
        return types;
    }
    async mapTestToSourceFiles(content, testFilePath) {
        const mappings = [];
        // Extract import statements
        const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
                // Local file import
                const resolvedPath = path.resolve(path.dirname(testFilePath), importPath);
                try {
                    const sourceFile = await this.resolveSourceFile(resolvedPath);
                    if (sourceFile) {
                        mappings.push({
                            sourceFile,
                            importPath,
                            mappingType: 'direct',
                            needsUpdate: false,
                            confidence: 0.9
                        });
                    }
                }
                catch (error) {
                    // File might not exist or be accessible
                }
            }
        }
        // Look for mocked modules
        const mockRegex = /mock\s*\(\s*['"`]([^'"`]+)['"`]/g;
        while ((match = mockRegex.exec(content)) !== null) {
            const mockPath = match[1];
            try {
                const sourceFile = await this.resolveSourceFile(mockPath);
                if (sourceFile) {
                    mappings.push({
                        sourceFile,
                        importPath: mockPath,
                        mappingType: 'mock',
                        needsUpdate: false,
                        confidence: 0.8
                    });
                }
            }
            catch (error) {
                // Mock might be external or non-existent
            }
        }
        return mappings;
    }
    async resolveSourceFile(importPath) {
        const possibleExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
        for (const ext of possibleExtensions) {
            const fullPath = importPath + ext;
            try {
                await fs.access(fullPath);
                return fullPath;
            }
            catch {
                continue;
            }
        }
        // Try index files
        for (const ext of possibleExtensions) {
            const indexPath = path.join(importPath, `index${ext}`);
            try {
                await fs.access(indexPath);
                return indexPath;
            }
            catch {
                continue;
            }
        }
        return null;
    }
    extractFunctions(content) {
        const functions = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const functionPatterns = [
                /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
                /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/,
                /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/,
                /(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*[:{]/
            ];
            for (const pattern of functionPatterns) {
                const match = pattern.exec(line);
                if (match) {
                    const functionName = match[1];
                    if (functionName !== 'constructor') {
                        functions.push({
                            name: functionName,
                            line: index + 1,
                            complexity: this.calculateComplexity(line),
                            isPublic: !line.includes('private') && !line.includes('protected'),
                            testMethods: [],
                            needsTestUpdate: false
                        });
                    }
                    break;
                }
            }
        });
        return functions;
    }
    extractClasses(content) {
        const classes = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
            const match = classPattern.exec(line);
            if (match) {
                const className = match[1];
                const methods = this.extractClassMethods(content, index, className);
                classes.push({
                    name: className,
                    line: index + 1,
                    methods,
                    testFiles: [],
                    needsTestUpdate: false
                });
            }
        });
        return classes;
    }
    extractClassMethods(content, classStartLine, className) {
        const methods = [];
        const lines = content.split('\n');
        // Find class end (simplified - assumes proper indentation)
        let braceCount = 0;
        let inClass = false;
        for (let i = classStartLine; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('{')) {
                braceCount += (line.match(/\{/g) || []).length;
                inClass = true;
            }
            if (line.includes('}')) {
                braceCount -= (line.match(/\}/g) || []).length;
                if (braceCount <= 0 && inClass)
                    break;
            }
            if (inClass && braceCount > 0) {
                const methodPattern = /(\w+)\s*\([^)]*\)\s*[:{]/;
                const match = methodPattern.exec(line.trim());
                if (match && !line.includes('class') && !line.includes('interface')) {
                    const methodName = match[1];
                    if (methodName !== className && !methods.includes(methodName)) {
                        methods.push(methodName);
                    }
                }
            }
        }
        return methods;
    }
    extractExports(content) {
        const exports = [];
        const exportPatterns = [
            /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
            /export\s*\{\s*([^}]+)\s*\}/g,
            /module\.exports\s*=\s*(\w+)/g
        ];
        for (const pattern of exportPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (pattern.source.includes('{')) {
                    // Handle export { a, b, c }
                    const exportList = match[1].split(',').map(e => e.trim().split(' as ')[0]);
                    exports.push(...exportList);
                }
                else {
                    exports.push(match[1]);
                }
            }
        }
        return [...new Set(exports)];
    }
    calculateComplexity(line) {
        // Simple complexity based on keywords
        const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'try', 'catch'];
        return complexityKeywords.reduce((count, keyword) => count + (line.includes(keyword) ? 1 : 0), 1);
    }
    async findStaleTests(testFiles, sourceFiles) {
        const staleTests = [];
        for (const testFile of testFiles) {
            for (const mapping of testFile.coveredFiles) {
                const sourceFile = sourceFiles.find(sf => sf.path === mapping.sourceFile);
                if (!sourceFile) {
                    // Source file no longer exists
                    staleTests.push(`${testFile.path} tests non-existent ${mapping.sourceFile}`);
                    continue;
                }
                if (mapping.sourceLastModified && sourceFile.lastModified > mapping.sourceLastModified) {
                    // Source file modified after test
                    staleTests.push(`${testFile.path} may be stale for ${mapping.sourceFile}`);
                }
            }
        }
        return staleTests;
    }
    async findUntestedFunctions(sourceFiles, testMappings) {
        const untestedFunctions = [];
        for (const sourceFile of sourceFiles) {
            const testFiles = testMappings.get(sourceFile.path) || [];
            for (const func of sourceFile.functions) {
                if (func.isPublic && func.testMethods.length === 0) {
                    untestedFunctions.push(`${sourceFile.path}:${func.name} (line ${func.line})`);
                }
            }
            if (testFiles.length === 0 && sourceFile.functions.length > 0) {
                untestedFunctions.push(`${sourceFile.path} (entire file untested)`);
            }
        }
        return untestedFunctions;
    }
    async identifyMaintenanceIssues(testFiles, sourceFiles, testMappings) {
        const issues = [];
        // Check for broken mappings
        for (const testFile of testFiles) {
            for (const mapping of testFile.coveredFiles) {
                const sourceExists = sourceFiles.some(sf => sf.path === mapping.sourceFile);
                if (!sourceExists) {
                    issues.push({
                        type: 'broken_mapping',
                        severity: 'high',
                        testFile: testFile.path,
                        sourceFile: mapping.sourceFile,
                        description: `Test references non-existent source file`,
                        suggestion: `Update import or remove test for deleted source file`,
                        lastChecked: new Date()
                    });
                }
            }
        }
        // Check for missing tests
        for (const sourceFile of sourceFiles) {
            const hasTests = testMappings.has(sourceFile.path);
            if (!hasTests && sourceFile.functions.length > 0) {
                const publicFunctions = sourceFile.functions.filter(f => f.isPublic);
                if (publicFunctions.length > 0) {
                    issues.push({
                        type: 'missing_test',
                        severity: publicFunctions.length > 3 ? 'high' : 'medium',
                        sourceFile: sourceFile.path,
                        description: `Source file has ${publicFunctions.length} public functions but no tests`,
                        suggestion: `Create test file for this source file`,
                        affectedFunctions: publicFunctions.map(f => f.name),
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
            if (issue.type === 'missing_test' && issue.sourceFile) {
                actions.push({
                    action: 'create_test',
                    priority: issue.severity,
                    sourceFile: issue.sourceFile,
                    description: `Create test file for ${path.basename(issue.sourceFile)}`,
                    reason: issue.description
                });
            }
            if (issue.type === 'broken_mapping' && issue.testFile) {
                actions.push({
                    action: 'fix_import',
                    priority: issue.severity,
                    testFile: issue.testFile,
                    description: `Fix broken import in ${path.basename(issue.testFile)}`,
                    reason: issue.description
                });
            }
        }
        // Actions for stale tests
        for (const staleTest of staleTests) {
            actions.push({
                action: 'update_test',
                priority: 'medium',
                testFile: staleTest.split(' ')[0],
                description: `Update stale test`,
                reason: staleTest
            });
        }
        return actions;
    }
    generateMappingRecommendations(maintenanceIssues, syncActions, testMappings) {
        const recommendations = [];
        const criticalIssues = maintenanceIssues.filter(i => i.severity === 'critical');
        const highPriorityActions = syncActions.filter(a => a.priority === 'high' || a.priority === 'critical');
        if (criticalIssues.length > 0) {
            recommendations.push(`Address ${criticalIssues.length} critical test mapping issues immediately`);
        }
        if (highPriorityActions.length > 0) {
            recommendations.push(`Execute ${highPriorityActions.length} high-priority sync actions`);
        }
        const missingTests = maintenanceIssues.filter(i => i.type === 'missing_test');
        if (missingTests.length > 0) {
            recommendations.push(`Create tests for ${missingTests.length} untested source files`);
        }
        const mappingCoverage = testMappings.size;
        recommendations.push(`Current test mapping coverage: ${mappingCoverage} source files have associated tests`);
        return recommendations;
    }
}
exports.TestMappingAnalyzer = TestMappingAnalyzer;
exports.default = TestMappingAnalyzer;
//# sourceMappingURL=analyzer.js.map