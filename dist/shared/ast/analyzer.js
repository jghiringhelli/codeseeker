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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTAnalyzer = void 0;
const ts = __importStar(require("typescript"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
class ASTAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const language = this.detectLanguage(filePath);
            switch (language) {
                case 'typescript':
                case 'javascript':
                    return this.analyzeTypeScript(content, filePath, language);
                case 'python':
                    return this.analyzePython(content, filePath);
                default:
                    throw new Error(`Unsupported language: ${language}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to analyze file ${filePath}`, error);
            throw error;
        }
    }
    detectLanguage(filePath) {
        const ext = path.extname(filePath);
        const mapping = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python'
        };
        return mapping[ext] || 'unknown';
    }
    async analyzeTypeScript(content, filePath, language) {
        const result = {
            language,
            symbols: [],
            dependencies: [],
            complexity: this.initializeComplexityMetrics(),
            patterns: [],
            errors: []
        };
        try {
            // Use TypeScript compiler API for better analysis
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
            // Extract symbols
            result.symbols = this.extractTypeScriptSymbols(sourceFile);
            // Extract dependencies
            result.dependencies = this.extractTypeScriptDependencies(sourceFile);
            // Calculate complexity
            result.complexity = this.calculateTypeScriptComplexity(sourceFile);
            // Detect patterns
            result.patterns = this.detectTypeScriptPatterns(sourceFile, result.symbols);
        }
        catch (error) {
            // Fallback to Babel parser
            try {
                const ast = (0, parser_1.parse)(content, {
                    sourceType: 'module',
                    allowImportExportEverywhere: true,
                    allowAwaitOutsideFunction: true,
                    allowReturnOutsideFunction: true,
                    allowUndeclaredExports: true,
                    plugins: [
                        'typescript',
                        'jsx',
                        'decorators-legacy',
                        'asyncGenerators',
                        'bigInt',
                        'classProperties',
                        'dynamicImport',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'functionBind',
                        'nullishCoalescingOperator',
                        'objectRestSpread',
                        'optionalCatchBinding',
                        'optionalChaining'
                    ]
                });
                result.symbols = this.extractBabelSymbols(ast, filePath);
                result.dependencies = this.extractBabelDependencies(ast, filePath);
                result.complexity = this.calculateBabelComplexity(ast);
            }
            catch (babelError) {
                result.errors.push({
                    message: `Failed to parse with both TypeScript and Babel: ${error.message}`,
                    severity: 'error'
                });
            }
        }
        return result;
    }
    async analyzePython(content, filePath) {
        // Python AST analysis would require additional libraries
        // For now, return a basic analysis
        return {
            language: 'python',
            symbols: [],
            dependencies: [],
            complexity: this.initializeComplexityMetrics(),
            patterns: [],
            errors: [{
                    message: 'Python AST analysis not fully implemented',
                    severity: 'info'
                }]
        };
    }
    extractTypeScriptSymbols(sourceFile) {
        const symbols = [];
        const visit = (node) => {
            // Function declarations
            if (ts.isFunctionDeclaration(node) && node.name) {
                symbols.push({
                    name: node.name.text,
                    type: 'function',
                    location: this.getSourceLocation(node, sourceFile.fileName),
                    signature: this.getFunctionSignature(node),
                    isExported: this.hasExportModifier(node),
                    isAsync: this.hasAsyncModifier(node),
                    parameters: this.getFunctionParameters(node)
                });
            }
            // Class declarations
            if (ts.isClassDeclaration(node) && node.name) {
                symbols.push({
                    name: node.name.text,
                    type: 'class',
                    location: this.getSourceLocation(node, sourceFile.fileName),
                    isExported: this.hasExportModifier(node)
                });
                // Class methods
                node.members?.forEach(member => {
                    if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                        symbols.push({
                            name: `${node.name.text}.${member.name.text}`,
                            type: 'method',
                            location: this.getSourceLocation(member, sourceFile.fileName),
                            visibility: this.getVisibility(member),
                            isAsync: this.hasAsyncModifier(member)
                        });
                    }
                });
            }
            // Interface declarations
            if (ts.isInterfaceDeclaration(node)) {
                symbols.push({
                    name: node.name.text,
                    type: 'interface',
                    location: this.getSourceLocation(node, sourceFile.fileName),
                    isExported: this.hasExportModifier(node)
                });
            }
            // Type aliases
            if (ts.isTypeAliasDeclaration(node)) {
                symbols.push({
                    name: node.name.text,
                    type: 'type',
                    location: this.getSourceLocation(node, sourceFile.fileName),
                    isExported: this.hasExportModifier(node)
                });
            }
            // Variable declarations
            if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
                symbols.push({
                    name: node.name.text,
                    type: 'variable',
                    location: this.getSourceLocation(node, sourceFile.fileName)
                });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return symbols;
    }
    extractBabelSymbols(ast, filePath) {
        const symbols = [];
        (0, traverse_1.default)(ast, {
            FunctionDeclaration(path) {
                if (path.node.id) {
                    symbols.push({
                        name: path.node.id.name,
                        type: 'function',
                        location: this.getBabelLocation(path.node, filePath),
                        isAsync: path.node.async
                    });
                }
            },
            ClassDeclaration(path) {
                if (path.node.id) {
                    symbols.push({
                        name: path.node.id.name,
                        type: 'class',
                        location: this.getBabelLocation(path.node, filePath)
                    });
                }
            },
            VariableDeclarator(path) {
                if (t.isIdentifier(path.node.id)) {
                    symbols.push({
                        name: path.node.id.name,
                        type: 'variable',
                        location: this.getBabelLocation(path.node, filePath)
                    });
                }
            }
        });
        return symbols;
    }
    extractTypeScriptDependencies(sourceFile) {
        const dependencies = [];
        const visit = (node) => {
            // Import declarations
            if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                const location = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                dependencies.push({
                    type: 'import',
                    source: sourceFile.fileName,
                    target: node.moduleSpecifier.text,
                    line: location.line + 1,
                    isExternal: !node.moduleSpecifier.text.startsWith('.')
                });
            }
            // Export declarations
            if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                const location = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                dependencies.push({
                    type: 'export',
                    source: sourceFile.fileName,
                    target: node.moduleSpecifier.text,
                    line: location.line + 1,
                    isExternal: !node.moduleSpecifier.text.startsWith('.')
                });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return dependencies;
    }
    extractBabelDependencies(ast, filePath) {
        const dependencies = [];
        (0, traverse_1.default)(ast, {
            ImportDeclaration(path) {
                dependencies.push({
                    type: 'import',
                    source: filePath,
                    target: path.node.source.value,
                    line: path.node.loc?.start.line || 0,
                    isExternal: !path.node.source.value.startsWith('.')
                });
            },
            ExportNamedDeclaration(path) {
                if (path.node.source) {
                    dependencies.push({
                        type: 'export',
                        source: filePath,
                        target: path.node.source.value,
                        line: path.node.loc?.start.line || 0,
                        isExternal: !path.node.source.value.startsWith('.')
                    });
                }
            }
        });
        return dependencies;
    }
    calculateTypeScriptComplexity(sourceFile) {
        let cyclomaticComplexity = 1; // Base complexity
        let nestingDepth = 0;
        let maxNesting = 0;
        let linesOfCode = sourceFile.getLineStarts().length;
        const visit = (node, depth = 0) => {
            maxNesting = Math.max(maxNesting, depth);
            // Increment complexity for branching statements
            if (ts.isIfStatement(node) ||
                ts.isWhileStatement(node) ||
                ts.isForStatement(node) ||
                ts.isDoStatement(node) ||
                ts.isSwitchStatement(node) ||
                ts.isConditionalExpression(node)) {
                cyclomaticComplexity++;
            }
            // Case labels add complexity
            if (ts.isCaseClause(node)) {
                cyclomaticComplexity++;
            }
            ts.forEachChild(node, child => visit(child, depth + 1));
        };
        visit(sourceFile);
        return {
            cyclomaticComplexity,
            cognitiveComplexity: cyclomaticComplexity * 1.2, // Simplified calculation
            linesOfCode,
            maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)),
            nestingDepth: maxNesting
        };
    }
    calculateBabelComplexity(ast) {
        let cyclomaticComplexity = 1;
        let nestingDepth = 0;
        let linesOfCode = 100; // Estimate since we don't have direct access
        (0, traverse_1.default)(ast, {
            enter(path) {
                if (path.isIfStatement() ||
                    path.isWhileStatement() ||
                    path.isForStatement() ||
                    path.isDoWhileStatement() ||
                    path.isSwitchStatement() ||
                    path.isConditionalExpression()) {
                    cyclomaticComplexity++;
                }
                if (path.isSwitchCase()) {
                    cyclomaticComplexity++;
                }
            }
        });
        return {
            cyclomaticComplexity,
            cognitiveComplexity: cyclomaticComplexity * 1.2,
            linesOfCode,
            maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)),
            nestingDepth
        };
    }
    detectTypeScriptPatterns(sourceFile, symbols) {
        const patterns = [];
        // Singleton pattern detection
        const classes = symbols.filter(s => s.type === 'class');
        const singletonPattern = this.detectSingletonPattern(sourceFile, classes);
        if (singletonPattern) {
            patterns.push(singletonPattern);
        }
        // Factory pattern detection
        const factoryPattern = this.detectFactoryPattern(sourceFile, symbols);
        if (factoryPattern) {
            patterns.push(factoryPattern);
        }
        return patterns;
    }
    detectSingletonPattern(sourceFile, classes) {
        // Simple singleton detection - look for private constructor and getInstance method
        // This is a simplified implementation
        return null; // Placeholder
    }
    detectFactoryPattern(sourceFile, symbols) {
        // Simple factory detection - look for create* methods
        // This is a simplified implementation
        return null; // Placeholder
    }
    initializeComplexityMetrics() {
        return {
            cyclomaticComplexity: 1,
            cognitiveComplexity: 1,
            linesOfCode: 0,
            maintainabilityIndex: 100,
            nestingDepth: 0
        };
    }
    getSourceLocation(node, fileName) {
        const sourceFile = node.getSourceFile();
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        return {
            file: fileName,
            line: start.line + 1,
            column: start.character + 1,
            endLine: end.line + 1,
            endColumn: end.character + 1
        };
    }
    getBabelLocation(node, fileName) {
        return {
            file: fileName,
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0,
            endLine: node.loc?.end.line || 0,
            endColumn: node.loc?.end.column || 0
        };
    }
    getFunctionSignature(node) {
        // Simplified signature extraction
        return node.name?.text || 'anonymous';
    }
    hasExportModifier(node) {
        return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;
    }
    hasAsyncModifier(node) {
        return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    }
    getFunctionParameters(node) {
        return node.parameters.map(param => ({
            name: param.name.getText(),
            optional: !!param.questionToken,
            type: param.type?.getText()
        }));
    }
    getVisibility(node) {
        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword)) {
            return 'private';
        }
        if (node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ProtectedKeyword)) {
            return 'protected';
        }
        return 'public';
    }
}
exports.ASTAnalyzer = ASTAnalyzer;
exports.default = ASTAnalyzer;
//# sourceMappingURL=analyzer.js.map