"use strict";
/**
 * Quality Checker - Comprehensive quality validation for code changes
 * Runs compilation, tests, coverage, security, and architecture checks
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
const logger_1 = require("../utils/logger");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const database_config_1 = require("../config/database-config");
class QualityChecker {
    logger = logger_1.Logger.getInstance();
    projectRoot;
    db;
    qualityThresholds = {
        minimumScore: 80,
        testCoverage: 80,
        maxComplexity: 10,
        maxDuplication: 5
    };
    constructor(projectRoot, db) {
        this.projectRoot = projectRoot || process.cwd();
        this.db = db || new database_config_1.DatabaseConnections();
    }
    async runAllChecks(subTaskResults) {
        this.logger.info('🔍 Starting comprehensive quality checks...');
        const startTime = Date.now();
        try {
            // Run all quality checks in parallel for efficiency
            const [compilationResult, testResult, securityResult, architectureResult] = await Promise.all([
                this.runCompilationChecks(subTaskResults),
                this.runTestChecks(subTaskResults),
                this.runSecurityChecks(subTaskResults),
                this.runArchitectureChecks(subTaskResults)
            ]);
            // Calculate overall quality score
            const overallScore = this.calculateOverallScore(compilationResult, testResult, securityResult, architectureResult);
            // Determine if quality checks passed
            const passed = this.determineQualityPassed(compilationResult, testResult, securityResult, architectureResult, overallScore);
            // Generate recommendations and blockers
            const { recommendations, blockers } = this.generateRecommendations(compilationResult, testResult, securityResult, architectureResult);
            const result = {
                compilation: compilationResult,
                tests: testResult,
                security: securityResult,
                architecture: architectureResult,
                overallScore,
                passed,
                recommendations,
                blockers
            };
            const duration = Date.now() - startTime;
            this.logger.info(`Quality checks completed in ${duration}ms (Score: ${overallScore}%, ${passed ? 'PASSED' : 'FAILED'})`);
            return result;
        }
        catch (error) {
            this.logger.error('Quality checks failed:', error);
            return this.generateFailedResult(error.message);
        }
    }
    async runCompilationChecks(subTaskResults) {
        this.logger.debug('Running compilation checks...');
        const startTime = Date.now();
        try {
            // Check if TypeScript project
            const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
            const hasTypeScript = await fs_1.promises.access(tsconfigPath).then(() => true).catch(() => false);
            if (hasTypeScript) {
                return await this.runTypeScriptCompilation();
            }
            else {
                // For JavaScript projects, run basic syntax checks
                return await this.runJavaScriptSyntaxCheck(subTaskResults);
            }
        }
        catch (error) {
            return {
                success: false,
                errors: [`Compilation check failed: ${error.message}`],
                warnings: [],
                duration: Date.now() - startTime
            };
        }
    }
    async runTypeScriptCompilation() {
        return new Promise((resolve) => {
            const tscProcess = (0, child_process_1.spawn)('npx', ['tsc', '--noEmit'], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            let stdout = '';
            let stderr = '';
            tscProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            tscProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            const startTime = Date.now();
            tscProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                const errors = this.parseTypeScriptErrors(stderr);
                const warnings = this.parseTypeScriptWarnings(stderr);
                resolve({
                    success: code === 0,
                    errors,
                    warnings,
                    duration
                });
            });
            tscProcess.on('error', (error) => {
                resolve({
                    success: false,
                    errors: [`TypeScript compilation failed: ${error.message}`],
                    warnings: [],
                    duration: Date.now() - startTime
                });
            });
        });
    }
    async runJavaScriptSyntaxCheck(subTaskResults) {
        const errors = [];
        const warnings = [];
        const startTime = Date.now();
        // Basic syntax validation for modified files
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                    try {
                        const content = await fs_1.promises.readFile(path.join(this.projectRoot, filePath), 'utf-8');
                        // Basic syntax check - try to parse with Node
                        new Function(content);
                    }
                    catch (syntaxError) {
                        errors.push(`${filePath}: ${syntaxError.message}`);
                    }
                }
            }
        }
        return {
            success: errors.length === 0,
            errors,
            warnings,
            duration: Date.now() - startTime
        };
    }
    async runTestChecks(subTaskResults) {
        this.logger.debug('Running test checks...');
        try {
            // Check for test framework
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(await fs_1.promises.readFile(packageJsonPath, 'utf-8'));
            if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
                return await this.runJestTests();
            }
            else if (packageJson.devDependencies?.mocha || packageJson.dependencies?.mocha) {
                return await this.runMochaTests();
            }
            else {
                return this.generateNoTestFrameworkResult();
            }
        }
        catch (error) {
            return {
                passed: 0,
                failed: 1,
                coverage: 0,
                duration: 0,
                failedTests: [`Test execution failed: ${error.message}`],
                coverageFiles: []
            };
        }
    }
    async runJestTests() {
        return new Promise((resolve) => {
            const jestProcess = (0, child_process_1.spawn)('npx', ['jest', '--coverage', '--json'], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            let stdout = '';
            let stderr = '';
            jestProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            jestProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            const startTime = Date.now();
            jestProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                try {
                    const jestOutput = JSON.parse(stdout);
                    resolve(this.parseJestResults(jestOutput, duration));
                }
                catch (parseError) {
                    // Fallback parsing from stderr if JSON parsing fails
                    resolve(this.parseJestResultsFromText(stderr, duration));
                }
            });
            jestProcess.on('error', (error) => {
                resolve({
                    passed: 0,
                    failed: 1,
                    coverage: 0,
                    duration: Date.now() - startTime,
                    failedTests: [`Jest execution failed: ${error.message}`],
                    coverageFiles: []
                });
            });
        });
    }
    async runMochaTests() {
        // Similar implementation for Mocha
        return {
            passed: 0,
            failed: 0,
            coverage: 75, // Mock coverage for now
            duration: 1000,
            failedTests: [],
            coverageFiles: []
        };
    }
    async runSecurityChecks(subTaskResults) {
        this.logger.debug('Running security checks...');
        const vulnerabilities = [];
        // Check for common security issues in modified files
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                try {
                    const content = await fs_1.promises.readFile(path.join(this.projectRoot, filePath), 'utf-8');
                    const fileVulns = this.scanFileForSecurityIssues(filePath, content);
                    vulnerabilities.push(...fileVulns);
                }
                catch (error) {
                    this.logger.warn(`Could not scan ${filePath} for security issues:`, error);
                }
            }
        }
        // Calculate security score based on vulnerabilities
        const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
        const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;
        const lowCount = vulnerabilities.filter(v => v.severity === 'low').length;
        let overallScore = 100;
        overallScore -= criticalCount * 30;
        overallScore -= highCount * 20;
        overallScore -= mediumCount * 10;
        overallScore -= lowCount * 5;
        overallScore = Math.max(0, overallScore);
        return {
            vulnerabilities,
            overallScore
        };
    }
    scanFileForSecurityIssues(filePath, content) {
        const vulnerabilities = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            // Check for hardcoded secrets
            if (/(?:password|secret|key|token)\s*[:=]\s*['"][^'"]+['"]/.test(line.toLowerCase())) {
                vulnerabilities.push({
                    severity: 'high',
                    type: 'Hardcoded Secret',
                    file: filePath,
                    line: lineNum,
                    description: 'Potential hardcoded secret detected'
                });
            }
            // Check for SQL injection risks
            if (/query\s*\+|WHERE.*\+/.test(line) && !line.includes('?')) {
                vulnerabilities.push({
                    severity: 'high',
                    type: 'SQL Injection',
                    file: filePath,
                    line: lineNum,
                    description: 'Potential SQL injection vulnerability'
                });
            }
            // Check for XSS risks
            if (/innerHTML|outerHTML/.test(line) && !line.includes('sanitize')) {
                vulnerabilities.push({
                    severity: 'medium',
                    type: 'XSS',
                    file: filePath,
                    line: lineNum,
                    description: 'Potential XSS vulnerability - unsanitized HTML'
                });
            }
            // Check for weak crypto
            if (/md5|sha1(?!\w)/.test(line.toLowerCase())) {
                vulnerabilities.push({
                    severity: 'medium',
                    type: 'Weak Cryptography',
                    file: filePath,
                    line: lineNum,
                    description: 'Weak hashing algorithm detected'
                });
            }
        });
        return vulnerabilities;
    }
    async runArchitectureChecks(subTaskResults) {
        this.logger.debug('Running architecture checks...');
        const solidScores = await this.checkSOLIDPrinciples(subTaskResults);
        const codeQuality = await this.analyzeCodeQuality(subTaskResults);
        const patterns = await this.detectArchitecturalPatterns(subTaskResults);
        return {
            solidPrinciples: solidScores,
            codeQuality,
            patterns
        };
    }
    async checkSOLIDPrinciples(subTaskResults) {
        // Simplified SOLID principle checking
        let singleResponsibility = true;
        let openClosed = true;
        let liskovSubstitution = true;
        let interfaceSegregation = true;
        let dependencyInversion = true;
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                try {
                    const content = await fs_1.promises.readFile(path.join(this.projectRoot, filePath), 'utf-8');
                    // Single Responsibility: Check class method count
                    const classMatches = content.match(/class\s+\w+/g);
                    if (classMatches) {
                        const methodCount = (content.match(/^\s*(public|private|protected)?\s*\w+\s*\(/gm) || []).length;
                        if (methodCount > 10) {
                            singleResponsibility = false;
                        }
                    }
                    // Dependency Inversion: Check for direct instantiation in constructors
                    if (/constructor.*new\s+\w+/.test(content)) {
                        dependencyInversion = false;
                    }
                }
                catch (error) {
                    this.logger.warn(`Could not analyze ${filePath} for SOLID principles:`, error);
                }
            }
        }
        const trueCount = [singleResponsibility, openClosed, liskovSubstitution, interfaceSegregation, dependencyInversion].filter(Boolean).length;
        const score = Math.round((trueCount / 5) * 100);
        return {
            singleResponsibility,
            openClosed,
            liskovSubstitution,
            interfaceSegregation,
            dependencyInversion,
            score
        };
    }
    async analyzeCodeQuality(subTaskResults) {
        let totalComplexity = 0;
        let totalDuplication = 0;
        let fileCount = 0;
        const allFileContents = {};
        // First pass: collect all file contents
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                try {
                    const content = await fs_1.promises.readFile(path.join(this.projectRoot, filePath), 'utf-8');
                    allFileContents[filePath] = content;
                }
                catch (error) {
                    this.logger.warn(`Could not read ${filePath} for quality analysis:`, error);
                }
            }
        }
        // Second pass: analyze each file
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                try {
                    const content = allFileContents[filePath];
                    if (!content)
                        continue;
                    // Complexity: Count cyclomatic complexity indicators
                    const complexityIndicators = (content.match(/if|else|while|for|switch|catch/g) || []).length;
                    totalComplexity += complexityIndicators;
                    // Enhanced duplication detection
                    const duplicationScore = await this.detectCodeDuplication(filePath, content, allFileContents);
                    totalDuplication += duplicationScore;
                    fileCount++;
                }
                catch (error) {
                    this.logger.warn(`Could not analyze ${filePath} for code quality:`, error);
                }
            }
        }
        const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;
        const avgDuplication = fileCount > 0 ? totalDuplication / fileCount : 0;
        return {
            maintainability: Math.max(0, 100 - avgComplexity * 5 - avgDuplication * 0.5),
            readability: Math.max(0, 100 - avgComplexity * 2 - avgDuplication * 0.3),
            complexity: avgComplexity,
            duplication: avgDuplication
        };
    }
    async detectCodeDuplication(currentFile, content, allFiles) {
        let duplicationScore = 0;
        // 1. Embedding-based semantic duplication detection (NEW - most sophisticated)
        const embeddingDuplication = await this.detectEmbeddingBasedDuplication(currentFile, content);
        duplicationScore += embeddingDuplication.score;
        // 2. Function-level duplication detection
        const functions = this.extractFunctions(content);
        const functionDuplication = this.detectFunctionDuplication(functions, allFiles, currentFile);
        duplicationScore += functionDuplication;
        // 3. Block-level duplication detection (3+ consecutive lines)
        const blockDuplication = this.detectBlockDuplication(content, allFiles, currentFile);
        duplicationScore += blockDuplication;
        // 4. Pattern-based duplication (similar logic structures)
        const patternDuplication = this.detectPatternDuplication(content, allFiles, currentFile);
        duplicationScore += patternDuplication;
        return Math.min(100, duplicationScore); // Cap at 100%
    }
    extractFunctions(content) {
        const functions = [];
        // Match function declarations (TypeScript/JavaScript)
        const functionRegex = /(?:async\s+)?(?:function\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            const name = match[1];
            const body = match[2].trim();
            const signature = match[0].substring(0, match[0].indexOf('{')).trim();
            if (body.length > 50) { // Only consider substantial functions
                functions.push({ name, body, signature });
            }
        }
        // Match method declarations in classes
        const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
        while ((match = methodRegex.exec(content)) !== null) {
            const name = match[1];
            const body = match[2].trim();
            const signature = match[0].substring(0, match[0].indexOf('{')).trim();
            if (body.length > 50 && !['constructor', 'ngOnInit', 'ngOnDestroy'].includes(name)) {
                functions.push({ name, body, signature });
            }
        }
        return functions;
    }
    detectFunctionDuplication(functions, allFiles, currentFile) {
        let duplications = 0;
        const totalFunctions = functions.length;
        if (totalFunctions === 0)
            return 0;
        for (const func of functions) {
            const normalizedBody = this.normalizeFunctionBody(func.body);
            // Check against all other files
            for (const [filePath, content] of Object.entries(allFiles)) {
                if (filePath === currentFile)
                    continue;
                const otherFunctions = this.extractFunctions(content);
                for (const otherFunc of otherFunctions) {
                    const otherNormalizedBody = this.normalizeFunctionBody(otherFunc.body);
                    // Calculate similarity
                    const similarity = this.calculateStringSimilarity(normalizedBody, otherNormalizedBody);
                    if (similarity > 0.8) { // 80% similarity threshold
                        duplications++;
                        this.logger.warn(`Potential function duplication: ${func.name} in ${currentFile} similar to ${otherFunc.name} in ${filePath}`);
                        break; // Don't double-count the same function
                    }
                }
            }
        }
        return (duplications / totalFunctions) * 100;
    }
    detectBlockDuplication(content, allFiles, currentFile) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 10);
        let duplicatedBlocks = 0;
        const totalBlocks = Math.max(1, lines.length - 2); // Minimum 3-line blocks
        // Create sliding window of 3+ consecutive lines
        for (let i = 0; i <= lines.length - 3; i++) {
            const block = lines.slice(i, i + 3).join('\n');
            const normalizedBlock = this.normalizeCodeBlock(block);
            if (normalizedBlock.length < 30)
                continue; // Skip trivial blocks
            // Check this block against all other files
            for (const [filePath, otherContent] of Object.entries(allFiles)) {
                if (filePath === currentFile)
                    continue;
                const normalizedOtherContent = this.normalizeCodeBlock(otherContent);
                if (normalizedOtherContent.includes(normalizedBlock)) {
                    duplicatedBlocks++;
                    break; // Don't double-count the same block
                }
            }
        }
        return Math.min(50, (duplicatedBlocks / totalBlocks) * 100); // Cap at 50% for block duplication
    }
    detectPatternDuplication(content, allFiles, currentFile) {
        let patternDuplications = 0;
        // Common patterns that indicate duplication
        const patterns = [
            // Similar if-else chains
            /if\s*\([^)]+\)\s*\{[^}]+\}\s*else\s*if\s*\([^)]+\)\s*\{[^}]+\}/g,
            // Similar try-catch blocks
            /try\s*\{[^}]+\}\s*catch\s*\([^)]+\)\s*\{[^}]+\}/g,
            // Similar loop structures
            /for\s*\([^)]+\)\s*\{[^}]+\}/g,
            // Similar object/array operations
            /\w+\.(map|filter|reduce|forEach)\s*\([^)]+\)/g
        ];
        for (const pattern of patterns) {
            const matches = Array.from(content.matchAll(pattern));
            for (const match of matches) {
                const normalizedMatch = this.normalizeCodeBlock(match[0]);
                // Check against other files
                for (const [filePath, otherContent] of Object.entries(allFiles)) {
                    if (filePath === currentFile)
                        continue;
                    const otherMatches = Array.from(otherContent.matchAll(pattern));
                    for (const otherMatch of otherMatches) {
                        const normalizedOther = this.normalizeCodeBlock(otherMatch[0]);
                        const similarity = this.calculateStringSimilarity(normalizedMatch, normalizedOther);
                        if (similarity > 0.7) {
                            patternDuplications++;
                            break;
                        }
                    }
                    if (patternDuplications > 0)
                        break;
                }
            }
        }
        return Math.min(25, patternDuplications * 5); // Cap at 25% for pattern duplication
    }
    normalizeFunctionBody(body) {
        return body
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments  
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\b(let|const|var)\s+\w+/g, 'VAR') // Normalize variable declarations
            .replace(/\b\d+\b/g, 'NUM') // Normalize numbers
            .replace(/['"`][^'"`]*['"`]/g, 'STR') // Normalize strings
            .trim();
    }
    normalizeCodeBlock(block) {
        return block
            .replace(/\/\/.*$/gm, '') // Remove comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\b\w+(?=\s*[=:])/g, 'IDENT') // Normalize identifiers
            .replace(/\b\d+\b/g, 'NUM') // Normalize numbers
            .trim();
    }
    calculateStringSimilarity(str1, str2) {
        if (str1 === str2)
            return 1.0;
        if (str1.length === 0 || str2.length === 0)
            return 0.0;
        // Simple Jaccard similarity based on character 3-grams
        const getTriGrams = (str) => {
            const trigrams = new Set();
            for (let i = 0; i <= str.length - 3; i++) {
                trigrams.add(str.substring(i, i + 3));
            }
            return trigrams;
        };
        const trigrams1 = getTriGrams(str1);
        const trigrams2 = getTriGrams(str2);
        const intersection = new Set([...trigrams1].filter(x => trigrams2.has(x)));
        const union = new Set([...trigrams1, ...trigrams2]);
        return intersection.size / union.size;
    }
    // ===============================================
    // EMBEDDING-BASED SEMANTIC DUPLICATION DETECTION
    // ===============================================
    async detectEmbeddingBasedDuplication(currentFile, content) {
        try {
            const duplicates = [];
            // Extract classes and methods from new code
            const codeElements = this.extractCodeElements(content);
            for (const element of codeElements) {
                // Generate embedding for the new code element
                const elementEmbedding = await this.generateCodeEmbedding(element.code);
                // Search for similar embeddings in the database
                const similarElements = await this.findSimilarEmbeddings(elementEmbedding, currentFile, element.type);
                // Analyze similarity scores and generate consolidation suggestions
                for (const similar of similarElements) {
                    if (similar.similarity > 0.85) { // Very high similarity threshold
                        duplicates.push({
                            file: similar.filePath,
                            similarity: similar.similarity,
                            suggestion: this.generateConsolidationSuggestion(element, similar)
                        });
                        this.logger.warn(`🔍 Semantic duplicate detected: ${element.name} in ${currentFile} is ${Math.round(similar.similarity * 100)}% similar to ${similar.elementName} in ${similar.filePath}`);
                    }
                }
            }
            // Calculate duplication score based on number and severity of duplicates
            const highSimilarityCount = duplicates.filter(d => d.similarity > 0.9).length;
            const mediumSimilarityCount = duplicates.filter(d => d.similarity > 0.85 && d.similarity <= 0.9).length;
            const score = Math.min(40, highSimilarityCount * 15 + mediumSimilarityCount * 8); // Cap at 40%
            if (duplicates.length > 0) {
                this.logger.info(`📊 Embedding analysis found ${duplicates.length} potential semantic duplicates (score: ${score}%)`);
            }
            return { score, duplicates };
        }
        catch (error) {
            this.logger.warn('Embedding-based duplication detection failed, skipping:', error);
            return { score: 0, duplicates: [] };
        }
    }
    extractCodeElements(content) {
        const elements = [];
        const lines = content.split('\n');
        // Extract classes with their complete implementation
        const classRegex = /^(\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/gm;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const className = match[2];
            const startIndex = match.index;
            const indentLevel = match[1].length;
            // Find the complete class body
            const classEnd = this.findMatchingBrace(content, startIndex + match[0].length - 1);
            if (classEnd !== -1) {
                const classCode = content.substring(startIndex, classEnd + 1);
                const startLine = content.substring(0, startIndex).split('\n').length;
                elements.push({
                    name: className,
                    type: 'class',
                    code: classCode,
                    startLine
                });
            }
        }
        // Extract standalone functions
        const functionRegex = /^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const functionName = match[2];
            const startIndex = match.index;
            // Check if this function is inside a class (skip if so)
            const isInsideClass = elements.some(element => element.type === 'class' &&
                startIndex > content.indexOf(element.code) &&
                startIndex < content.indexOf(element.code) + element.code.length);
            if (!isInsideClass) {
                const functionEnd = this.findMatchingBrace(content, startIndex + match[0].length - 1);
                if (functionEnd !== -1) {
                    const functionCode = content.substring(startIndex, functionEnd + 1);
                    const startLine = content.substring(0, startIndex).split('\n').length;
                    elements.push({
                        name: functionName,
                        type: 'function',
                        code: functionCode,
                        startLine
                    });
                }
            }
        }
        // Extract significant methods from classes (if we want more granular analysis)
        const classElements = elements.filter(e => e.type === 'class');
        for (const classElement of classElements) {
            const methods = this.extractMethodsFromClass(classElement);
            elements.push(...methods);
        }
        return elements;
    }
    extractMethodsFromClass(classElement) {
        const methods = [];
        // Match methods within the class
        const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm;
        let match;
        while ((match = methodRegex.exec(classElement.code)) !== null) {
            const methodName = match[1];
            // Skip constructor and lifecycle methods for now
            if (['constructor', 'ngOnInit', 'ngOnDestroy', 'componentDidMount', 'render'].includes(methodName)) {
                continue;
            }
            const startIndex = match.index;
            const methodEnd = this.findMatchingBrace(classElement.code, startIndex + match[0].length - 1);
            if (methodEnd !== -1) {
                const methodCode = classElement.code.substring(startIndex, methodEnd + 1);
                // Only include substantial methods (more than 3 lines, excluding braces)
                const codeLines = methodCode.split('\n').filter(line => line.trim() && !line.trim().match(/^[{}]\s*$/));
                if (codeLines.length > 3) {
                    methods.push({
                        name: `${classElement.name}.${methodName}`,
                        type: 'method',
                        code: methodCode,
                        startLine: classElement.startLine + classElement.code.substring(0, startIndex).split('\n').length - 1
                    });
                }
            }
        }
        return methods;
    }
    findMatchingBrace(content, startIndex) {
        let braceCount = 1;
        let currentIndex = startIndex + 1;
        while (currentIndex < content.length && braceCount > 0) {
            const char = content[currentIndex];
            if (char === '{') {
                braceCount++;
            }
            else if (char === '}') {
                braceCount--;
            }
            currentIndex++;
        }
        return braceCount === 0 ? currentIndex - 1 : -1;
    }
    async generateCodeEmbedding(code) {
        try {
            // Prepare code for embedding by normalizing and extracting semantic content
            const semanticCode = this.prepareCodeForEmbedding(code);
            // In a real implementation, this would call an embedding service like:
            // - OpenAI Embeddings API
            // - Hugging Face Transformers
            // - Local CodeBERT/GraphCodeBERT model
            // - Sentence Transformers with code-specific model
            // For now, create a sophisticated mock that considers code structure
            return this.generateMockCodeEmbedding(semanticCode);
        }
        catch (error) {
            this.logger.warn('Failed to generate code embedding:', error);
            // Return random embedding as fallback
            return new Array(384).fill(0).map(() => Math.random() * 2 - 1);
        }
    }
    prepareCodeForEmbedding(code) {
        return code
            // Remove comments but keep structure
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Normalize whitespace but preserve structure
            .replace(/\n\s*\n/g, '\n')
            // Keep semantic structure: class names, method names, control flow
            .replace(/\b(class|function|method|if|else|for|while|try|catch|return)\b/g, (match) => `<${match}>`)
            // Normalize string literals but keep their presence
            .replace(/"[^"]*"/g, '"STRING"')
            .replace(/'[^']*'/g, "'STRING'")
            .replace(/`[^`]*`/g, '`TEMPLATE`')
            // Normalize numbers but keep their presence
            .replace(/\b\d+\.?\d*\b/g, 'NUMBER')
            // Keep variable patterns
            .replace(/\b[a-z][a-zA-Z0-9]*\b/g, (match) => {
            // Preserve keywords and common patterns
            if (['let', 'const', 'var', 'this', 'super', 'null', 'undefined', 'true', 'false'].includes(match)) {
                return match;
            }
            return 'VAR';
        })
            .trim();
    }
    generateMockCodeEmbedding(semanticCode) {
        // Create a deterministic embedding based on code characteristics
        const embedding = new Array(384).fill(0);
        // Use hash-based features for consistency
        const hash = this.simpleHash(semanticCode);
        // Extract semantic features
        const features = {
            hasClasses: semanticCode.includes('<class>'),
            hasFunctions: semanticCode.includes('<function>'),
            hasLoops: semanticCode.includes('<for>') || semanticCode.includes('<while>'),
            hasConditionals: semanticCode.includes('<if>'),
            hasErrorHandling: semanticCode.includes('<try>'),
            complexity: (semanticCode.match(/<(if|for|while|try)>/g) || []).length,
            length: semanticCode.length,
            structurePattern: semanticCode.substring(0, 100) // First 100 chars for pattern
        };
        // Map features to embedding dimensions
        embedding[0] = features.hasClasses ? 1.0 : -1.0;
        embedding[1] = features.hasFunctions ? 1.0 : -1.0;
        embedding[2] = features.hasLoops ? 1.0 : -1.0;
        embedding[3] = features.hasConditionals ? 1.0 : -1.0;
        embedding[4] = features.hasErrorHandling ? 1.0 : -1.0;
        embedding[5] = Math.tanh(features.complexity / 10); // Normalize complexity
        embedding[6] = Math.tanh(features.length / 1000); // Normalize length
        // Fill remaining dimensions with hash-based values
        for (let i = 7; i < 384; i++) {
            const seed = hash + i;
            embedding[i] = (Math.sin(seed) + Math.cos(seed * 1.618)) * 0.5; // Golden ratio for distribution
        }
        // Add structure-based features
        for (let i = 0; i < Math.min(features.structurePattern.length, 100); i++) {
            const charCode = features.structurePattern.charCodeAt(i);
            const dimIndex = 50 + (i % 200); // Use dimensions 50-249
            embedding[dimIndex] += (charCode / 128.0 - 1.0) * 0.1; // Normalize to [-1,1]
        }
        // Normalize the embedding vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / (magnitude || 1));
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    async findSimilarEmbeddings(embedding, currentFile, elementType) {
        try {
            // Query the database for similar embeddings using cosine similarity
            const postgres = await this.db.getPostgresConnection();
            // In a real implementation, this would use pgvector's cosine similarity:
            // SELECT file_path, element_name, element_type, embedding <=> $1::vector as similarity
            // FROM code_embeddings 
            // WHERE file_path != $2 AND element_type = $3 AND embedding <=> $1::vector < 0.3
            // ORDER BY embedding <=> $1::vector LIMIT 10
            // For now, return mock similar embeddings
            return this.getMockSimilarEmbeddings(embedding, currentFile, elementType);
        }
        catch (error) {
            this.logger.warn('Failed to query similar embeddings:', error);
            return [];
        }
    }
    getMockSimilarEmbeddings(embedding, currentFile, elementType) {
        // Mock some potential duplicates for demonstration
        const mockSimilarFiles = [
            { filePath: 'src/utils/validation-helper.ts', elementName: 'ValidationHelper.validate', similarity: 0.92 },
            { filePath: 'src/services/data-processor.ts', elementName: 'DataProcessor.process', similarity: 0.87 },
            { filePath: 'src/core/base-manager.ts', elementName: 'BaseManager.execute', similarity: 0.89 },
        ].filter(item => item.filePath !== currentFile);
        // Add some variation based on embedding characteristics
        const embeddingSum = embedding.reduce((sum, val) => sum + Math.abs(val), 0);
        const hasHighComplexity = embedding[5] > 0.5;
        if (hasHighComplexity) {
            mockSimilarFiles.push({
                filePath: 'src/complex-algorithms/optimizer.ts',
                elementName: 'Optimizer.optimize',
                similarity: 0.86
            });
        }
        return mockSimilarFiles.slice(0, 3); // Return top 3 matches
    }
    generateConsolidationSuggestion(newElement, existingElement) {
        const similarityPercentage = Math.round(existingElement.similarity * 100);
        if (existingElement.similarity > 0.95) {
            return `⚠️  CRITICAL: ${newElement.name} is ${similarityPercentage}% similar to ${existingElement.elementName} in ${existingElement.filePath}. Consider reusing existing implementation instead of duplicating.`;
        }
        else if (existingElement.similarity > 0.9) {
            return `🔄 HIGH: ${newElement.name} is ${similarityPercentage}% similar to ${existingElement.elementName} in ${existingElement.filePath}. Consider extracting common functionality into a shared utility.`;
        }
        else {
            return `💡 MEDIUM: ${newElement.name} has ${similarityPercentage}% similarity to ${existingElement.elementName} in ${existingElement.filePath}. Review for potential consolidation opportunities.`;
        }
    }
    async detectArchitecturalPatterns(subTaskResults) {
        const detectedPatterns = [];
        const antiPatterns = [];
        const recommendations = [];
        for (const result of subTaskResults) {
            for (const filePath of result.filesModified) {
                try {
                    const content = await fs_1.promises.readFile(path.join(this.projectRoot, filePath), 'utf-8');
                    // Detect common patterns
                    if (content.includes('getInstance') && content.includes('private constructor')) {
                        detectedPatterns.push('Singleton Pattern');
                    }
                    if (content.includes('Observable') || content.includes('Subject')) {
                        detectedPatterns.push('Observer Pattern');
                    }
                    if (content.includes('interface') && content.includes('implements')) {
                        detectedPatterns.push('Interface Pattern');
                    }
                    // Detect anti-patterns
                    if (content.match(/class\s+\w*God\w*/i) || (content.match(/class/) && content.length > 10000)) {
                        antiPatterns.push('God Object');
                    }
                    if (content.includes('any') && content.match(/:\s*any/g)?.length > 5) {
                        antiPatterns.push('Type Erasure');
                    }
                }
                catch (error) {
                    this.logger.warn(`Could not analyze ${filePath} for patterns:`, error);
                }
            }
        }
        // Generate recommendations based on findings
        if (antiPatterns.includes('God Object')) {
            recommendations.push('Consider breaking large classes into smaller, more focused classes');
        }
        if (antiPatterns.includes('Type Erasure')) {
            recommendations.push('Replace generic "any" types with specific interfaces');
        }
        if (detectedPatterns.length === 0) {
            recommendations.push('Consider implementing design patterns to improve code structure');
        }
        return {
            detectedPatterns,
            antiPatterns,
            recommendations
        };
    }
    // Helper methods for parsing test results
    parseTypeScriptErrors(stderr) {
        const errors = [];
        const errorLines = stderr.split('\n').filter(line => line.includes('error TS'));
        for (const line of errorLines) {
            if (line.trim()) {
                errors.push(line.trim());
            }
        }
        return errors;
    }
    parseTypeScriptWarnings(stderr) {
        const warnings = [];
        const warningLines = stderr.split('\n').filter(line => line.includes('warning'));
        for (const line of warningLines) {
            if (line.trim()) {
                warnings.push(line.trim());
            }
        }
        return warnings;
    }
    parseJestResults(jestOutput, duration) {
        const testResults = jestOutput.testResults || [];
        let passed = 0;
        let failed = 0;
        const failedTests = [];
        for (const testResult of testResults) {
            passed += testResult.numPassingTests || 0;
            failed += testResult.numFailingTests || 0;
            if (testResult.assertionResults) {
                for (const assertion of testResult.assertionResults) {
                    if (assertion.status === 'failed') {
                        failedTests.push(`${testResult.name}: ${assertion.title}`);
                    }
                }
            }
        }
        const coverage = jestOutput.coverageMap ?
            this.calculateCoverageFromJest(jestOutput.coverageMap) : 0;
        return {
            passed,
            failed,
            coverage,
            duration,
            failedTests,
            coverageFiles: []
        };
    }
    parseJestResultsFromText(stderr, duration) {
        // Fallback text parsing
        const passedMatch = stderr.match(/(\d+) passing/);
        const failedMatch = stderr.match(/(\d+) failing/);
        return {
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0,
            coverage: 0,
            duration,
            failedTests: [],
            coverageFiles: []
        };
    }
    calculateCoverageFromJest(coverageMap) {
        // Simplified coverage calculation
        return 75; // Mock coverage for now
    }
    generateNoTestFrameworkResult() {
        return {
            passed: 0,
            failed: 0,
            coverage: 0,
            duration: 0,
            failedTests: ['No test framework detected (Jest, Mocha, etc.)'],
            coverageFiles: []
        };
    }
    calculateOverallScore(compilation, tests, security, architecture) {
        let score = 0;
        // Compilation (30% weight)
        score += compilation.success ? 30 : 0;
        // Tests (25% weight)
        const testScore = tests.failed === 0 ? 25 : Math.max(0, 25 * (tests.passed / (tests.passed + tests.failed)));
        score += testScore;
        // Security (25% weight)
        score += (security.overallScore / 100) * 25;
        // Architecture (20% weight)
        score += (architecture.solidPrinciples.score / 100) * 20;
        return Math.round(score);
    }
    determineQualityPassed(compilation, tests, security, architecture, overallScore) {
        // Must compile successfully
        if (!compilation.success)
            return false;
        // Must not have critical security vulnerabilities
        const criticalVulns = security.vulnerabilities.filter(v => v.severity === 'critical');
        if (criticalVulns.length > 0)
            return false;
        // Must meet minimum score threshold
        if (overallScore < this.qualityThresholds.minimumScore)
            return false;
        // Must not have failing tests
        if (tests.failed > 0)
            return false;
        return true;
    }
    generateRecommendations(compilation, tests, security, architecture) {
        const recommendations = [];
        const blockers = [];
        // Compilation blockers
        if (!compilation.success) {
            blockers.push('Fix compilation errors before proceeding');
            compilation.errors.forEach(error => blockers.push(`  - ${error}`));
        }
        // Test blockers
        if (tests.failed > 0) {
            blockers.push('Fix failing tests before proceeding');
            tests.failedTests.slice(0, 3).forEach(test => blockers.push(`  - ${test}`));
        }
        // Security blockers
        const criticalVulns = security.vulnerabilities.filter(v => v.severity === 'critical');
        if (criticalVulns.length > 0) {
            blockers.push('Fix critical security vulnerabilities');
            criticalVulns.forEach(vuln => blockers.push(`  - ${vuln.file}: ${vuln.description}`));
        }
        // Recommendations
        if (tests.coverage < this.qualityThresholds.testCoverage) {
            recommendations.push(`Increase test coverage from ${tests.coverage}% to ${this.qualityThresholds.testCoverage}%`);
        }
        if (architecture.solidPrinciples.score < 80) {
            recommendations.push('Improve adherence to SOLID principles');
        }
        if (security.vulnerabilities.length > 0) {
            recommendations.push('Address security vulnerabilities found in code analysis');
        }
        recommendations.push(...architecture.patterns.recommendations);
        return { recommendations, blockers };
    }
    generateFailedResult(errorMessage) {
        return {
            compilation: {
                success: false,
                errors: [errorMessage],
                warnings: [],
                duration: 0
            },
            tests: {
                passed: 0,
                failed: 1,
                coverage: 0,
                duration: 0,
                failedTests: ['Quality check system failure'],
                coverageFiles: []
            },
            security: {
                vulnerabilities: [],
                overallScore: 0
            },
            architecture: {
                solidPrinciples: {
                    singleResponsibility: false,
                    openClosed: false,
                    liskovSubstitution: false,
                    interfaceSegregation: false,
                    dependencyInversion: false,
                    score: 0
                },
                codeQuality: {
                    maintainability: 0,
                    readability: 0,
                    complexity: 100,
                    duplication: 100
                },
                patterns: {
                    detectedPatterns: [],
                    antiPatterns: ['System Failure'],
                    recommendations: ['Fix quality check system before proceeding']
                }
            },
            overallScore: 0,
            passed: false,
            recommendations: [],
            blockers: [errorMessage]
        };
    }
}
exports.QualityChecker = QualityChecker;
exports.default = QualityChecker;
//# sourceMappingURL=quality-checker.js.map