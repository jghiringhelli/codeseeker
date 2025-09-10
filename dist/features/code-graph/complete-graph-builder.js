"use strict";
/**
 * Complete Code Graph Builder
 * Creates comprehensive Neo4j graph representing entire codebase
 * Every file is a node, all relationships are mapped
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
exports.CompleteGraphBuilder = exports.RelationshipType = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const logger_1 = require("../../utils/logger");
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["DEPENDS_ON"] = "DEPENDS_ON";
    RelationshipType["IMPLEMENTS"] = "IMPLEMENTS";
    RelationshipType["EXTENDS"] = "EXTENDS";
    RelationshipType["USES"] = "USES";
    RelationshipType["CALLS"] = "CALLS";
    RelationshipType["INSTANTIATES"] = "INSTANTIATES";
    RelationshipType["CONFIGURES"] = "CONFIGURES";
    RelationshipType["CONFIGURED_BY"] = "CONFIGURED_BY";
    RelationshipType["OVERRIDES"] = "OVERRIDES";
    RelationshipType["FOLLOWS_PATTERN"] = "FOLLOWS_PATTERN";
    RelationshipType["VIOLATES_PATTERN"] = "VIOLATES_PATTERN";
    RelationshipType["DEFINES_PATTERN"] = "DEFINES_PATTERN";
    RelationshipType["DOCUMENTS"] = "DOCUMENTS";
    RelationshipType["DOCUMENTED_BY"] = "DOCUMENTED_BY";
    RelationshipType["TESTS"] = "TESTS";
    RelationshipType["TESTED_BY"] = "TESTED_BY";
    RelationshipType["SIMILAR_TO"] = "SIMILAR_TO";
    RelationshipType["RELATED_TO"] = "RELATED_TO";
    RelationshipType["SUPERSEDES"] = "SUPERSEDES";
    RelationshipType["REFERENCES"] = "REFERENCES";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
class CompleteGraphBuilder {
    logger = logger_1.Logger.getInstance();
    projectPath;
    fileNodes = new Map();
    relationships = [];
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    async buildCompleteGraph() {
        const startTime = Date.now();
        this.logger.info('🕸️  Building complete codebase graph...');
        try {
            // Step 1: Discover all files
            const files = await this.discoverAllFiles();
            this.logger.info(`Found ${files.length} files to analyze`);
            // Step 2: Analyze each file and create nodes
            for (const filePath of files) {
                await this.analyzeFileNode(filePath);
            }
            // Step 3: Analyze relationships between all nodes
            await this.analyzeAllRelationships();
            // Step 4: Detect patterns and architectural relationships
            await this.detectPatterns();
            // Step 5: Find semantic similarities
            await this.findSemanticRelationships();
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Complete graph built: ${this.fileNodes.size} nodes, ${this.relationships.length} relationships (${duration}ms)`);
            return {
                nodes: Array.from(this.fileNodes.values()),
                relationships: this.relationships
            };
        }
        catch (error) {
            this.logger.error('❌ Complete graph building failed:', error);
            throw error;
        }
    }
    async discoverAllFiles() {
        const patterns = [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.java', '**/*.cs', '**/*.go', '**/*.rs',
            '**/*.json', '**/*.yaml', '**/*.yml', '**/*.xml',
            '**/*.md', '**/*.txt', '**/*.rst',
            '**/*.test.*', '**/*.spec.*',
            '**/package.json', '**/tsconfig.json', '**/webpack.config.*',
            '**/.env*', '**/Dockerfile*', '**/docker-compose.*'
        ];
        const excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**',
            '**/.vscode/**',
            '**/.idea/**'
        ];
        return await (0, fast_glob_1.glob)(patterns, {
            cwd: this.projectPath,
            ignore: excludePatterns,
            onlyFiles: true
        });
    }
    async analyzeFileNode(filePath) {
        try {
            const fullPath = path.join(this.projectPath, filePath);
            const content = await fs.readFile(fullPath, 'utf-8');
            const stats = await fs.stat(fullPath);
            const fileNode = {
                path: filePath,
                name: path.basename(filePath),
                type: this.determineFileType(filePath, content),
                language: this.detectLanguage(filePath),
                size: stats.size,
                content: content.length > 50000 ? content.substring(0, 50000) : content, // Limit content size
                exports: this.extractExports(content, filePath),
                imports: this.extractImports(content, filePath),
                classes: this.extractClasses(content, filePath),
                functions: this.extractFunctions(content, filePath),
                variables: this.extractVariables(content, filePath),
                patterns: this.detectFilePatterns(content, filePath)
            };
            this.fileNodes.set(filePath, fileNode);
        }
        catch (error) {
            this.logger.warn(`Failed to analyze file ${filePath}:`, error);
        }
    }
    determineFileType(filePath, content) {
        const fileName = path.basename(filePath).toLowerCase();
        if (fileName.includes('.test.') || fileName.includes('.spec.') || filePath.includes('/test/') || filePath.includes('/__tests__/')) {
            return 'test';
        }
        if (fileName.includes('.md') || fileName.includes('.txt') || fileName.includes('.rst') || fileName.includes('readme')) {
            return 'documentation';
        }
        if (fileName.includes('config') || fileName.includes('.json') || fileName.includes('.yml') || fileName.includes('.yaml') || fileName.includes('.env')) {
            return 'config';
        }
        if (content.includes('export') || content.includes('module.exports') || content.includes('__all__')) {
            return 'module';
        }
        return 'file';
    }
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust',
            '.json': 'JSON',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.xml': 'XML',
            '.md': 'Markdown',
            '.txt': 'Text'
        };
        return languageMap[ext] || 'Unknown';
    }
    extractExports(content, filePath) {
        const exports = [];
        // TypeScript/JavaScript exports
        const exportPatterns = [
            /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /export\s*\{\s*([^}]+)\s*\}/g,
            /module\.exports\s*=\s*\{([^}]+)\}/g,
            /module\.exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        ];
        for (const pattern of exportPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1]) {
                    if (match[1].includes(',')) {
                        // Handle multiple exports
                        exports.push(...match[1].split(',').map(e => e.trim()));
                    }
                    else {
                        exports.push(match[1].trim());
                    }
                }
            }
        }
        return [...new Set(exports)]; // Remove duplicates
    }
    extractImports(content, filePath) {
        const imports = [];
        // TypeScript/JavaScript import patterns
        const importPatterns = [
            /import\s+(?:\{([^}]+)\}\s+from\s+)?['"`]([^'"`]+)['"`]/g,
            /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"`]([^'"`]+)['"`]/g,
            /require\(['"`]([^'"`]+)['"`]\)/g,
            /from\s+['"`]([^'"`]+)['"`]/g
        ];
        for (const pattern of importPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const targetPath = match[match.length - 1]; // Last capture group is the path
                const specifiers = match.length > 2 && match[1] ? match[1].split(',').map(s => s.trim()) : [];
                imports.push({
                    source: filePath,
                    target: this.resolveImportPath(targetPath, filePath),
                    type: content.includes('require(') ? 'require' : 'import',
                    specifiers
                });
            }
        }
        return imports;
    }
    extractClasses(content, filePath) {
        const classes = [];
        // Class pattern for TypeScript/JavaScript
        const classPattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:extends\s+([a-zA-Z_$][a-zA-Z0-9_$]*))?\s*(?:implements\s+([^{]+))?\s*\{/g;
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            const className = match[1];
            const extendsClass = match[2];
            const implementsInterfaces = match[3] ? match[3].split(',').map(i => i.trim()) : undefined;
            // Find class boundaries (simplified)
            const classStart = match.index;
            const lines = content.substring(0, classStart).split('\n');
            const lineStart = lines.length;
            classes.push({
                name: className,
                lineStart,
                lineEnd: lineStart + 50, // Simplified - would need proper parsing
                extends: extendsClass,
                implements: implementsInterfaces,
                methods: this.extractMethodsFromClass(content, classStart, className),
                properties: []
            });
        }
        return classes;
    }
    extractFunctions(content, filePath) {
        const functions = [];
        // Function patterns
        const functionPatterns = [
            /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g,
            /(?:export\s+)?const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
            /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s*)?\(([^)]*)\)\s*=>/g
        ];
        for (const pattern of functionPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const functionName = match[1];
                const parameters = match[2] ? match[2].split(',').map(p => p.trim()) : [];
                // Find line number
                const functionStart = match.index;
                const lines = content.substring(0, functionStart).split('\n');
                const lineStart = lines.length;
                functions.push({
                    name: functionName,
                    lineStart,
                    lineEnd: lineStart + 20, // Simplified
                    parameters,
                    complexity: this.calculateFunctionComplexity(content, functionStart),
                    calls: this.extractFunctionCalls(content, functionStart, functionName)
                });
            }
        }
        return functions;
    }
    extractVariables(content, filePath) {
        const variables = [];
        const variablePatterns = [
            /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        ];
        for (const pattern of variablePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const variableName = match[1];
                const variableStart = match.index;
                const lines = content.substring(0, variableStart).split('\n');
                variables.push({
                    name: variableName,
                    line: lines.length,
                    scope: 'global' // Simplified - would need proper scope analysis
                });
            }
        }
        return variables;
    }
    detectFilePatterns(content, filePath) {
        const patterns = [];
        // Simple pattern detection
        if (content.includes('class') && content.includes('extends')) {
            patterns.push({
                type: 'design',
                name: 'Inheritance',
                description: 'Uses class inheritance pattern',
                category: 'OOP',
                confidence: 0.8
            });
        }
        if (content.includes('interface') || content.includes('implements')) {
            patterns.push({
                type: 'design',
                name: 'Interface Implementation',
                description: 'Implements interface pattern',
                category: 'OOP',
                confidence: 0.9
            });
        }
        if (content.includes('singleton') || (content.includes('private constructor') && content.includes('static'))) {
            patterns.push({
                type: 'design',
                name: 'Singleton',
                description: 'Implements singleton pattern',
                category: 'Creational',
                confidence: 0.7
            });
        }
        return patterns;
    }
    async analyzeAllRelationships() {
        for (const [filePath, fileNode] of this.fileNodes) {
            // Create dependency relationships from imports
            for (const importRel of fileNode.imports || []) {
                if (this.fileNodes.has(importRel.target)) {
                    this.relationships.push({
                        from: filePath,
                        to: importRel.target,
                        type: RelationshipType.DEPENDS_ON,
                        properties: {
                            importType: importRel.type,
                            specifiers: importRel.specifiers
                        }
                    });
                }
            }
            // Create class relationships
            for (const classInfo of fileNode.classes || []) {
                if (classInfo.extends) {
                    // Find file containing the extended class
                    const extendedClassFile = this.findFileContainingClass(classInfo.extends);
                    if (extendedClassFile) {
                        this.relationships.push({
                            from: filePath,
                            to: extendedClassFile,
                            type: RelationshipType.EXTENDS,
                            properties: { className: classInfo.name, extends: classInfo.extends }
                        });
                    }
                }
                if (classInfo.implements) {
                    for (const interfaceName of classInfo.implements) {
                        const interfaceFile = this.findFileContainingInterface(interfaceName);
                        if (interfaceFile) {
                            this.relationships.push({
                                from: filePath,
                                to: interfaceFile,
                                type: RelationshipType.IMPLEMENTS,
                                properties: { className: classInfo.name, implements: interfaceName }
                            });
                        }
                    }
                }
            }
        }
    }
    async detectPatterns() {
        // Detect configuration relationships
        for (const [filePath, fileNode] of this.fileNodes) {
            if (fileNode.type === 'config') {
                // Find files that might be configured by this config
                for (const [targetPath, targetNode] of this.fileNodes) {
                    if (targetPath !== filePath && this.isConfigurationRelated(fileNode, targetNode)) {
                        this.relationships.push({
                            from: filePath,
                            to: targetPath,
                            type: RelationshipType.CONFIGURES,
                            properties: { configType: fileNode.name }
                        });
                    }
                }
            }
            // Detect test relationships
            if (fileNode.type === 'test') {
                const testedFile = this.findTestedFile(filePath, fileNode);
                if (testedFile) {
                    this.relationships.push({
                        from: filePath,
                        to: testedFile,
                        type: RelationshipType.TESTS,
                        properties: { testType: 'unit' }
                    });
                }
            }
        }
    }
    async findSemanticRelationships() {
        // Find files with similar names or functionality
        const fileList = Array.from(this.fileNodes.keys());
        for (let i = 0; i < fileList.length; i++) {
            for (let j = i + 1; j < fileList.length; j++) {
                const file1 = fileList[i];
                const file2 = fileList[j];
                const node1 = this.fileNodes.get(file1);
                const node2 = this.fileNodes.get(file2);
                const similarity = this.calculateSemanticSimilarity(node1, node2);
                if (similarity > 0.7) {
                    this.relationships.push({
                        from: file1,
                        to: file2,
                        type: RelationshipType.SIMILAR_TO,
                        properties: { similarity, reason: 'semantic_analysis' }
                    });
                }
            }
        }
    }
    // Helper methods (simplified implementations)
    resolveImportPath(importPath, currentFile) {
        // Simplified path resolution
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            return path.resolve(path.dirname(currentFile), importPath);
        }
        return importPath;
    }
    extractMethodsFromClass(content, classStart, className) {
        // Simplified method extraction
        return [];
    }
    calculateFunctionComplexity(content, functionStart) {
        // Simplified complexity calculation
        const functionContent = content.substring(functionStart, functionStart + 1000);
        const conditions = (functionContent.match(/if|else|switch|case|while|for|\?/g) || []).length;
        return conditions + 1;
    }
    extractFunctionCalls(content, functionStart, functionName) {
        // Simplified function call extraction
        const functionContent = content.substring(functionStart, functionStart + 1000);
        const callPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
        const calls = [];
        let match;
        while ((match = callPattern.exec(functionContent)) !== null) {
            if (match[1] !== functionName) {
                calls.push(match[1]);
            }
        }
        return [...new Set(calls)];
    }
    findFileContainingClass(className) {
        for (const [filePath, fileNode] of this.fileNodes) {
            if (fileNode.classes?.some(c => c.name === className)) {
                return filePath;
            }
        }
        return undefined;
    }
    findFileContainingInterface(interfaceName) {
        for (const [filePath, fileNode] of this.fileNodes) {
            if (fileNode.content?.includes(`interface ${interfaceName}`)) {
                return filePath;
            }
        }
        return undefined;
    }
    isConfigurationRelated(configNode, targetNode) {
        // Simple heuristic - configuration files configure modules with similar names
        const configBaseName = path.basename(configNode.name, path.extname(configNode.name));
        const targetBaseName = path.basename(targetNode.name, path.extname(targetNode.name));
        return targetBaseName.includes(configBaseName) || configBaseName.includes(targetBaseName);
    }
    findTestedFile(testPath, testNode) {
        // Find the file being tested
        const testBaseName = path.basename(testPath)
            .replace(/\.test\.|\.spec\./, '.')
            .replace(/test\.|spec\./, '');
        for (const [filePath] of this.fileNodes) {
            if (path.basename(filePath) === testBaseName) {
                return filePath;
            }
        }
        return undefined;
    }
    calculateSemanticSimilarity(node1, node2) {
        // Simple semantic similarity based on exports, functions, and content
        let similarity = 0;
        // Similar exports
        const exports1 = new Set(node1.exports || []);
        const exports2 = new Set(node2.exports || []);
        const commonExports = new Set([...exports1].filter(x => exports2.has(x)));
        if (exports1.size > 0 || exports2.size > 0) {
            similarity += (commonExports.size * 2) / (exports1.size + exports2.size);
        }
        // Similar function names
        const functions1 = new Set((node1.functions || []).map(f => f.name));
        const functions2 = new Set((node2.functions || []).map(f => f.name));
        const commonFunctions = new Set([...functions1].filter(x => functions2.has(x)));
        if (functions1.size > 0 || functions2.size > 0) {
            similarity += (commonFunctions.size * 2) / (functions1.size + functions2.size);
        }
        return Math.min(similarity / 2, 1); // Normalize
    }
}
exports.CompleteGraphBuilder = CompleteGraphBuilder;
exports.default = CompleteGraphBuilder;
//# sourceMappingURL=complete-graph-builder.js.map