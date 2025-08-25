"use strict";
/**
 * Advanced change detection and significance scoring system
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
exports.ChangeDetector = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
class ChangeDetector {
    logger;
    constructor(logger) {
        this.logger = logger || logger_1.Logger?.getInstance();
    }
    async analyzeChanges(diff) {
        this.logger.debug(`Analyzing ${diff?.length} file changes`);
        const fileAnalyses = await Promise?.all(diff?.map(file => this?.analyzeFileChange(file)));
        const significance = this?.calculateSignificance(fileAnalyses);
        const categories = this?.categorizeChanges(fileAnalyses);
        const riskLevel = this?.assessRiskLevel(significance, fileAnalyses);
        const impactAreas = this?.identifyImpactAreas(fileAnalyses);
        return {
            score: significance.score,
            filesChanged: diff?.length,
            linesAdded: significance.linesAdded,
            linesDeleted: significance.linesDeleted,
            newFeatures: significance.newFeatures,
            bugFixes: significance.bugFixes,
            configChanges: significance.configChanges,
            testChanges: significance.testChanges,
            categories,
            riskLevel,
            impactAreas
        };
    }
    async analyzeFileChange(diff) {
        const file = diff.file;
        const isTest = this?.isTestFile(file);
        const isConfig = this?.isConfigFile(file);
        const isDoc = this?.isDocumentationFile(file);
        // Calculate complexity based on change patterns
        const complexity = this?.calculateFileComplexity(diff);
        // Analyze semantic changes
        const semanticChanges = await this?.analyzeSemanticChanges(diff);
        return {
            file,
            changeType: diff.status,
            linesAdded: diff.linesAdded || 0,
            linesDeleted: diff.linesDeleted || 0,
            complexity,
            isTest,
            isConfig,
            isDoc,
            semanticChanges
        };
    }
    calculateFileComplexity(diff) {
        let complexity = 0;
        const lines = diff.patch || '';
        // Base complexity from line changes
        const linesChanged = (diff.linesAdded || 0) + (diff.linesDeleted || 0);
        complexity += Math.min(linesChanged * 0.1, 2.0);
        // Increase complexity for certain patterns
        const complexPatterns = [
            /class\s+\w+/g, // Class definitions
            /interface\s+\w+/g, // Interface definitions  
            /function\s+\w+/g, // Function definitions
            /async\s+function/g, // Async functions
            /try\s*{|catch\s*\(/g, // Error handling
            /import\s+.*from/g, // Imports
            /export\s+(default\s+)?/g // Exports
        ];
        complexPatterns?.forEach(pattern => {
            const matches = lines?.match(pattern);
            if (matches) {
                complexity += matches?.length * 0.2;
            }
        });
        // Cap complexity at 5.0
        return Math.min(complexity, 5.0);
    }
    async analyzeSemanticChanges(diff) {
        const changes = [];
        const patch = diff.patch || '';
        const lines = patch?.split('\n');
        let currentLine = 0;
        for (const line of lines) {
            currentLine++;
            if (line?.startsWith('+') || line?.startsWith('-')) {
                const isAddition = line?.startsWith('+');
                const content = line?.substring(1).trim();
                // Detect function changes
                const functionMatch = content?.match(/(?:function\s+|const\s+|let\s+|var\s+)?(\w+)\s*[=:]?\s*(?:function\s*)?[(\[]/);
                if (functionMatch) {
                    changes?.push({
                        type: isAddition ? 'function_added' : 'function_deleted',
                        name: functionMatch[1],
                        confidence: 0.8,
                        location: { line: currentLine, column: 0 }
                    });
                }
                // Detect class changes
                const classMatch = content?.match(/class\s+(\w+)/);
                if (classMatch) {
                    changes?.push({
                        type: isAddition ? 'class_added' : 'class_deleted',
                        name: classMatch[1],
                        confidence: 0.9,
                        location: { line: currentLine, column: 0 }
                    });
                }
                // Detect interface changes
                const interfaceMatch = content?.match(/interface\s+(\w+)/);
                if (interfaceMatch) {
                    changes?.push({
                        type: isAddition ? 'interface_added' : 'interface_deleted',
                        name: interfaceMatch[1],
                        confidence: 0.9,
                        location: { line: currentLine, column: 0 }
                    });
                }
                // Detect import/export changes
                const importMatch = content?.match(/import\s+.*?\s+from\s+['"](.*?)['"]/);
                if (importMatch) {
                    changes?.push({
                        type: isAddition ? 'import_added' : 'import_removed',
                        name: importMatch[1],
                        confidence: 0.7,
                        location: { line: currentLine, column: 0 }
                    });
                }
                const exportMatch = content?.match(/export\s+(?:default\s+)?(?:class\s+|function\s+|const\s+|let\s+|var\s+)?(\w+)/);
                if (exportMatch) {
                    changes?.push({
                        type: isAddition ? 'export_added' : 'export_removed',
                        name: exportMatch[1],
                        confidence: 0.7,
                        location: { line: currentLine, column: 0 }
                    });
                }
            }
        }
        return changes;
    }
    calculateSignificance(analyses) {
        let score = 0;
        let linesAdded = 0;
        let linesDeleted = 0;
        const newFeatures = [];
        const bugFixes = [];
        const configChanges = [];
        const testChanges = [];
        for (const analysis of analyses) {
            linesAdded += analysis.linesAdded;
            linesDeleted += analysis.linesDeleted;
            // Base score from line changes
            const lineScore = Math.min((analysis?.linesAdded + analysis.linesDeleted) * 0.01, 1.0);
            score += lineScore;
            // Complexity multiplier
            score += analysis?.complexity * 0.2;
            // File type bonuses
            if (analysis.isTest) {
                testChanges?.push(path?.basename(analysis.file));
                score += 0.3; // Tests are important but not as significant as features
            }
            else if (analysis.isConfig) {
                configChanges?.push(path?.basename(analysis.file));
                score += 0.5; // Config changes can be significant
            }
            else if (!analysis.isDoc) {
                // Main code files
                score += 0.4;
            }
            // Semantic change bonuses
            for (const semanticChange of analysis.semanticChanges) {
                switch (semanticChange.type) {
                    case 'function_added':
                    case 'class_added':
                    case 'interface_added':
                        newFeatures?.push(`${semanticChange.type?.split('_')[0]} ${semanticChange.name}`);
                        score += 0.5;
                        break;
                    case 'function_modified':
                    case 'class_modified':
                    case 'interface_modified':
                        score += 0.3;
                        break;
                    case 'function_deleted':
                    case 'class_deleted':
                    case 'interface_deleted':
                        score += 0.4; // Deletions can be significant
                        break;
                }
                // Apply confidence multiplier
                score *= semanticChange.confidence;
            }
            // Detect potential bug fixes
            if (this?.isPotentialBugFix(analysis)) {
                bugFixes?.push(path?.basename(analysis.file));
                score += 0.4;
            }
        }
        // Cap score at 5.0
        score = Math.min(score, 5.0);
        return {
            score,
            linesAdded,
            linesDeleted,
            newFeatures,
            bugFixes,
            configChanges,
            testChanges
        };
    }
    categorizeChanges(analyses) {
        const categories = [];
        // Feature category
        const featureFiles = analyses?.filter(a => !a.isTest && !a.isConfig && !a.isDoc &&
            a.semanticChanges?.some(c => c.type?.includes('_added')));
        if (featureFiles?.length > 0) {
            categories?.push({
                type: 'feature',
                confidence: 0.8,
                evidence: featureFiles?.flatMap(f => f.semanticChanges?.map(c => c.name)),
                filesInvolved: featureFiles?.map(f => f.file)
            });
        }
        // Test category
        const testFiles = analyses?.filter(a => a.isTest);
        if (testFiles?.length > 0) {
            categories?.push({
                type: 'test',
                confidence: 0.9,
                evidence: [`${testFiles?.length} test files modified`],
                filesInvolved: testFiles?.map(f => f.file)
            });
        }
        // Config category
        const configFiles = analyses?.filter(a => a.isConfig);
        if (configFiles?.length > 0) {
            categories?.push({
                type: 'config',
                confidence: 0.9,
                evidence: configFiles?.map(f => path?.basename(f.file)),
                filesInvolved: configFiles?.map(f => f.file)
            });
        }
        // Bugfix category (heuristic-based)
        const bugfixFiles = analyses?.filter(a => this?.isPotentialBugFix(a));
        if (bugfixFiles?.length > 0) {
            categories?.push({
                type: 'bugfix',
                confidence: 0.6,
                evidence: [`${bugfixFiles?.length} files with potential bug fixes`],
                filesInvolved: bugfixFiles?.map(f => f.file)
            });
        }
        return categories;
    }
    isPotentialBugFix(analysis) {
        // Heuristics for detecting bug fixes
        const hasErrorHandling = analysis.semanticChanges?.some(c => c.name?.includes('try') || c.name?.includes('catch') || c.name?.includes('error'));
        const hasValidation = analysis.semanticChanges?.some(c => c.name?.includes('validate') || c.name?.includes('check') || c.name?.includes('verify'));
        const smallChanges = analysis?.linesAdded + analysis.linesDeleted < 20;
        const modifiesExisting = analysis.semanticChanges?.some(c => c.type?.includes('_modified'));
        return (hasErrorHandling || hasValidation) || (smallChanges && modifiesExisting);
    }
    assessRiskLevel(significance, analyses) {
        if (significance.score >= 4.0)
            return 'high';
        if (significance.score >= 2.0)
            return 'medium';
        // Check for specific risk factors
        const hasComplexChanges = analyses?.some(a => a.complexity > 3.0);
        const affectsCore = analyses?.some(a => a.file?.includes('core/') || a.file?.includes('lib/') || a.file?.includes('utils/'));
        const deletesCode = analyses?.some(a => a.semanticChanges?.some(c => c.type?.includes('_deleted')));
        if (hasComplexChanges || affectsCore || deletesCode)
            return 'medium';
        return 'low';
    }
    identifyImpactAreas(analyses) {
        const areas = new Set();
        for (const analysis of analyses) {
            const filePath = analysis.file;
            // Extract module/area from path
            const parts = filePath?.split('/');
            if (parts?.length > 1) {
                areas?.add(parts[1]); // Usually the module name
            }
            // Identify by file type/purpose
            if (analysis.isTest)
                areas?.add('testing');
            if (analysis.isConfig)
                areas?.add('configuration');
            if (analysis.isDoc)
                areas?.add('documentation');
            // Identify by semantic changes
            const hasApiChanges = analysis.semanticChanges?.some(c => c.type?.includes('export') || c.type?.includes('interface'));
            if (hasApiChanges)
                areas?.add('api');
            const hasDatabaseChanges = analysis.semanticChanges?.some(c => c.name?.toLowerCase().includes('db') ||
                c.name?.toLowerCase().includes('database') ||
                c.name?.toLowerCase().includes('migration'));
            if (hasDatabaseChanges)
                areas?.add('database');
        }
        return Array.from(areas);
    }
    isTestFile(filePath) {
        const testPatterns = [
            /\.test\.(js|ts|jsx|tsx)$/,
            /\.spec\.(js|ts|jsx|tsx)$/,
            /test[\/\\]/,
            /tests[\/\\]/,
            /__tests__[\/\\]/
        ];
        return testPatterns?.some(pattern => pattern?.test(filePath));
    }
    isConfigFile(filePath) {
        const configPatterns = [
            /^\.env/,
            /\.config\.(js|ts|json)$/,
            /^tsconfig\.json$/,
            /^package\.json$/,
            /^webpack\./,
            /^babel\./,
            /^eslint/,
            /^prettier/,
            /^jest\.config/,
            /^vite\.config/
        ];
        const fileName = path?.basename(filePath);
        return configPatterns?.some(pattern => pattern?.test(fileName));
    }
    isDocumentationFile(filePath) {
        const docPatterns = [
            /\.md$/,
            /\.rst$/,
            /\.txt$/,
            /README/i,
            /CHANGELOG/i,
            /docs[\/\\]/
        ];
        return docPatterns?.some(pattern => pattern?.test(filePath));
    }
}
exports.ChangeDetector = ChangeDetector;
//# sourceMappingURL=change-detector.js.map