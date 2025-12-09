"use strict";
/**
 * Minimal SOLID Principles Analyzer - MVP Implementation
 * Provides basic SOLID principles analysis for validation cycle
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
exports.SOLIDPrinciplesAnalyzer = void 0;
const logger_1 = require("../../../utils/logger");
class SOLIDPrinciplesAnalyzer {
    logger = logger_1.Logger.getInstance().child('SOLIDAnalyzer');
    /**
     * Perform basic SOLID analysis using simple heuristics
     */
    async analyzeSOLID(request) {
        try {
            const { glob } = await Promise.resolve().then(() => __importStar(require('fast-glob')));
            // Find all TypeScript/JavaScript files
            const files = await glob([
                '**/*.ts',
                '**/*.js'
            ], {
                cwd: request.projectPath,
                ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
            });
            const violations = [];
            const principleScores = {
                singleResponsibility: 0.8, // Default good score
                openClosed: 0.7,
                liskovSubstitution: 0.9,
                interfaceSegregation: 0.8,
                dependencyInversion: 0.7
            };
            // Basic analysis for each file
            for (const file of files.slice(0, 10)) { // Limit to avoid performance issues
                try {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                    const filePath = require('path').join(request.projectPath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    // Single Responsibility Principle check
                    const classCount = (content.match(/class\s+\w+/g) || []).length;
                    const methodCount = (content.match(/(?:function|method)\s+\w+/g) || []).length;
                    if (classCount > 1 && methodCount > 10) {
                        violations.push({
                            principle: 'Single Responsibility',
                            file,
                            description: 'File contains multiple classes and many methods, suggesting multiple responsibilities',
                            severity: 'medium'
                        });
                        principleScores.singleResponsibility -= 0.1;
                    }
                    // Open/Closed Principle check
                    const privateMethodCount = (content.match(/private\s+\w+/g) || []).length;
                    const publicMethodCount = (content.match(/public\s+\w+/g) || []).length;
                    if (privateMethodCount < publicMethodCount) {
                        violations.push({
                            principle: 'Open/Closed',
                            file,
                            description: 'Class has more public than private methods, may not be well-encapsulated',
                            severity: 'low'
                        });
                        principleScores.openClosed -= 0.05;
                    }
                    // Dependency Inversion Principle check
                    const newKeywordCount = (content.match(/new\s+\w+\(/g) || []).length;
                    const constructorParams = (content.match(/constructor\([^)]*\)/g) || []).length;
                    if (newKeywordCount > 3 && constructorParams === 0) {
                        violations.push({
                            principle: 'Dependency Inversion',
                            file,
                            description: 'Class creates many dependencies directly instead of using dependency injection',
                            severity: 'medium'
                        });
                        principleScores.dependencyInversion -= 0.1;
                    }
                }
                catch (error) {
                    // Ignore file analysis errors
                    continue;
                }
            }
            const overallScore = Object.values(principleScores).reduce((sum, score) => sum + score, 0) / 5;
            return {
                overallScore: Math.max(0, Math.min(1, overallScore)),
                principleScores,
                violations,
                suggestions: this.generateSuggestions(violations)
            };
        }
        catch (error) {
            this.logger.error('SOLID analysis failed', error);
            return {
                overallScore: 0.5,
                principleScores: {
                    singleResponsibility: 0.5,
                    openClosed: 0.5,
                    liskovSubstitution: 0.5,
                    interfaceSegregation: 0.5,
                    dependencyInversion: 0.5
                },
                violations: [],
                suggestions: ['Unable to analyze SOLID principles - basic analysis failed']
            };
        }
    }
    /**
     * Generate improvement suggestions based on violations
     */
    generateSuggestions(violations) {
        const suggestions = [];
        if (violations.some(v => v.principle === 'Single Responsibility')) {
            suggestions.push('Consider breaking large classes into smaller, focused classes');
        }
        if (violations.some(v => v.principle === 'Open/Closed')) {
            suggestions.push('Use interfaces and abstract classes for better extensibility');
        }
        if (violations.some(v => v.principle === 'Dependency Inversion')) {
            suggestions.push('Implement dependency injection to reduce coupling');
        }
        if (suggestions.length === 0) {
            suggestions.push('SOLID principles look good overall');
        }
        return suggestions;
    }
    // Additional method for validation cycle compatibility
    async analyzeProject(projectPath) {
        return this.analyzeSOLID({ projectPath });
    }
}
exports.SOLIDPrinciplesAnalyzer = SOLIDPrinciplesAnalyzer;
//# sourceMappingURL=analyzer.js.map