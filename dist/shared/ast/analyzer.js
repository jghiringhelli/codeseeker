"use strict";
/**
 * Minimal AST Analyzer - MVP Implementation
 * Provides basic AST analysis functionality for features that depend on it
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
exports.ASTAnalyzer = void 0;
class ASTAnalyzer {
    /**
     * Basic file analysis using regex patterns instead of full AST parsing
     */
    async analyzeFile(filePath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const content = await fs.readFile(filePath, 'utf-8');
            return {
                symbols: this.extractSymbols(content, filePath),
                dependencies: this.extractDependencies(content, filePath),
                exports: this.extractExports(content, filePath),
                imports: this.extractImports(content, filePath),
                complexity: this.calculateComplexity(content)
            };
        }
        catch (error) {
            return {
                symbols: [],
                dependencies: [],
                exports: [],
                imports: [],
                complexity: 0
            };
        }
    }
    /**
     * Extract symbols (functions, classes, variables) using regex
     */
    extractSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        // Extract classes
        lines.forEach((line, index) => {
            const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[1],
                    type: 'class',
                    location: { file: filePath, line: index + 1, endLine: index + 1, column: classMatch.index || 0, endColumn: (classMatch.index || 0) + classMatch[0].length }
                });
            }
            // Extract functions
            const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (functionMatch) {
                symbols.push({
                    name: functionMatch[1],
                    type: 'function',
                    location: { file: filePath, line: index + 1, endLine: index + 1, column: functionMatch.index || 0, endColumn: (functionMatch.index || 0) + functionMatch[0].length }
                });
            }
            // Extract arrow functions
            const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
            if (arrowMatch) {
                symbols.push({
                    name: arrowMatch[1],
                    type: 'function',
                    location: { file: filePath, line: index + 1, endLine: index + 1, column: arrowMatch.index || 0, endColumn: (arrowMatch.index || 0) + arrowMatch[0].length }
                });
            }
        });
        return symbols;
    }
    /**
     * Extract dependencies using regex
     */
    extractDependencies(content, filePath) {
        const dependencies = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Import dependencies
            const importMatch = line.match(/import.*?from\s+['"]([^'"]+)['"]/);
            if (importMatch) {
                dependencies.push({
                    from: filePath,
                    to: importMatch[1],
                    target: importMatch[1],
                    type: 'import',
                    location: { line: index + 1, column: importMatch.index || 0 }
                });
            }
            // Require dependencies
            const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
            if (requireMatch) {
                dependencies.push({
                    from: filePath,
                    to: requireMatch[1],
                    target: requireMatch[1],
                    type: 'import',
                    location: { line: index + 1, column: requireMatch.index || 0 }
                });
            }
        });
        return dependencies;
    }
    /**
     * Extract exports using regex
     */
    extractExports(content, filePath) {
        const exports = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Named exports
            const exportMatch = line.match(/export\s+(?:class|function|const|let|var)\s+(\w+)/);
            if (exportMatch) {
                exports.push({
                    name: exportMatch[1],
                    type: 'export',
                    location: { file: filePath, line: index + 1, endLine: index + 1, column: exportMatch.index || 0, endColumn: (exportMatch.index || 0) + exportMatch[0].length }
                });
            }
        });
        return exports;
    }
    /**
     * Extract imports using regex
     */
    extractImports(content, filePath) {
        const imports = [];
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const importMatch = line.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from/);
            if (importMatch) {
                if (importMatch[1]) {
                    // Named imports
                    const namedImports = importMatch[1].split(',').map(imp => imp.trim());
                    namedImports.forEach(imp => {
                        imports.push({
                            name: imp,
                            type: 'import',
                            location: { file: filePath, line: index + 1, endLine: index + 1, column: importMatch.index || 0, endColumn: (importMatch.index || 0) + importMatch[0].length }
                        });
                    });
                }
                else if (importMatch[2] || importMatch[3]) {
                    // Default or namespace import
                    imports.push({
                        name: importMatch[2] || importMatch[3],
                        type: 'import',
                        location: { file: filePath, line: index + 1, endLine: index + 1, column: importMatch.index || 0, endColumn: (importMatch.index || 0) + importMatch[0].length }
                    });
                }
            }
        });
        return imports;
    }
    /**
     * Calculate basic complexity based on control flow keywords
     */
    calculateComplexity(content) {
        const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try'];
        let complexity = 1; // Base complexity
        complexityKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            complexity += matches ? matches.length : 0;
        });
        return complexity;
    }
}
exports.ASTAnalyzer = ASTAnalyzer;
//# sourceMappingURL=analyzer.js.map