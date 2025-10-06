"use strict";
/**
 * Use Cases Analyzer - Simplified Business Logic Understanding
 * Maps business requirements to code implementation for Claude Code context enhancement
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
exports.UseCasesAnalyzer = void 0;
const logger_1 = require("../../../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
class UseCasesAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeUseCases(params) {
        const startTime = Date.now();
        try {
            this.logger.info('🎯 Starting use cases analysis...');
            // 1. Discover use cases from multiple sources
            const useCases = await this.discoverUseCases(params.projectPath, params.businessDocsPath);
            // 2. Analyze business logic in code
            const businessLogicFiles = await this.analyzeBusinessLogic(params.projectPath);
            // 3. Calculate coverage and health metrics
            const businessCoverage = this.calculateBusinessCoverage(useCases, businessLogicFiles);
            const separationScore = this.calculateSeparationScore(businessLogicFiles);
            const architectureHealth = this.assessArchitectureHealth(businessLogicFiles, useCases);
            // 4. Generate actionable recommendations
            const recommendations = this.generateRecommendations(useCases, businessLogicFiles, architectureHealth);
            const result = {
                useCases,
                businessLogicFiles,
                businessCoverage,
                separationScore,
                recommendations,
                architectureHealth
            };
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Use cases analysis completed in ${duration}ms`, {
                useCasesFound: useCases.length,
                businessFilesAnalyzed: businessLogicFiles.length,
                businessCoverage: Math.round(businessCoverage * 100),
                separationScore: Math.round(separationScore * 100)
            });
            return result;
        }
        catch (error) {
            this.logger.error('❌ Use cases analysis failed:', error);
            throw error;
        }
    }
    async discoverUseCases(projectPath, businessDocsPath) {
        const useCases = [];
        // Discover from documentation
        if (businessDocsPath) {
            const docUseCases = await this.parseDocumentationUseCases(businessDocsPath);
            useCases.push(...docUseCases);
        }
        // Discover from API endpoints
        const apiUseCases = await this.inferUseCasesFromAPI(projectPath);
        useCases.push(...apiUseCases);
        // Discover from code patterns
        const codeUseCases = await this.inferUseCasesFromCode(projectPath);
        useCases.push(...codeUseCases);
        return this.deduplicateUseCases(useCases);
    }
    async parseDocumentationUseCases(docsPath) {
        const useCases = [];
        try {
            const docFiles = await (0, fast_glob_1.glob)('**/*.{md,txt,rst}', { cwd: docsPath });
            for (const file of docFiles.slice(0, 10)) { // Limit to prevent overwhelming
                const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
                const extractedUseCases = this.extractUseCasesFromText(content, file);
                useCases.push(...extractedUseCases);
            }
        }
        catch (error) {
            this.logger.warn('Could not parse documentation use cases:', error);
        }
        return useCases;
    }
    async inferUseCasesFromAPI(projectPath) {
        const useCases = [];
        try {
            const apiFiles = await (0, fast_glob_1.glob)('**/*.{ts,js}', {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
            });
            for (const file of apiFiles) {
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                // Look for API endpoints/routes
                const endpointMatches = content.match(/(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/gi);
                if (endpointMatches) {
                    for (const match of endpointMatches) {
                        const endpoint = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
                        if (endpoint) {
                            useCases.push({
                                id: `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
                                name: this.endpointToUseCaseName(endpoint),
                                description: `API endpoint: ${endpoint}`,
                                source: 'api',
                                files: [file],
                                endpoints: [endpoint],
                                businessValue: 'medium',
                                implementationStatus: 'complete'
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn('Could not infer use cases from API:', error);
        }
        return useCases;
    }
    async inferUseCasesFromCode(projectPath) {
        const useCases = [];
        try {
            const codeFiles = await (0, fast_glob_1.glob)('**/*.{ts,js}', {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
            });
            for (const file of codeFiles.slice(0, 20)) { // Limit to prevent overwhelming
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                // Look for business logic patterns
                const businessMethods = this.extractBusinessMethods(content);
                if (businessMethods.length > 0) {
                    for (const method of businessMethods.slice(0, 3)) { // Limit methods per file
                        useCases.push({
                            id: `code_${path.basename(file, path.extname(file))}_${method}`,
                            name: this.methodToUseCaseName(method),
                            description: `Business logic method in ${file}`,
                            source: 'code',
                            files: [file],
                            businessValue: 'medium',
                            implementationStatus: 'complete'
                        });
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn('Could not infer use cases from code:', error);
        }
        return useCases;
    }
    async analyzeBusinessLogic(projectPath) {
        const businessFiles = [];
        try {
            const codeFiles = await (0, fast_glob_1.glob)('**/*.{ts,js}', {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
            });
            for (const file of codeFiles.slice(0, 30)) { // Reasonable limit
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                const businessMethods = this.extractBusinessMethods(content);
                if (businessMethods.length > 0) {
                    businessFiles.push({
                        path: file,
                        type: this.determineFileType(file, content),
                        useCases: businessMethods,
                        complexity: this.calculateFileComplexity(content),
                        businessMethods
                    });
                }
            }
        }
        catch (error) {
            this.logger.warn('Could not analyze business logic:', error);
        }
        return businessFiles;
    }
    extractUseCasesFromText(content, filename) {
        const useCases = [];
        // Simple patterns for use case extraction
        const patterns = [
            /(?:use case|user story|scenario|requirement)[\s:]*([^\n.!?]+)/gi,
            /(?:as a|when|given|then)[\s]*([^\n.!?]+)/gi
        ];
        let id = 0;
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && match[1].length > 10 && match[1].length < 100) {
                    useCases.push({
                        id: `doc_${filename}_${id++}`,
                        name: match[1].trim(),
                        description: `Use case from ${filename}`,
                        source: 'documentation',
                        files: [filename],
                        businessValue: 'high',
                        implementationStatus: 'partial'
                    });
                }
            }
        }
        return useCases.slice(0, 5); // Limit per file
    }
    extractBusinessMethods(content) {
        const methods = [];
        // Look for method patterns that suggest business logic
        const patterns = [
            /(?:function|async function)\s+([a-zA-Z][a-zA-Z0-9]*(?:User|Order|Payment|Product|Invoice|Report|Process|Handle|Manage|Create|Update|Delete|Calculate|Validate)[a-zA-Z0-9]*)/g,
            /([a-zA-Z][a-zA-Z0-9]*(?:Service|Manager|Handler|Controller|Processor))/g
        ];
        for (const pattern of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && methods.indexOf(match[1]) === -1) {
                    methods.push(match[1]);
                }
            }
        }
        return methods.slice(0, 5); // Limit per file
    }
    deduplicateUseCases(useCases) {
        const seen = new Set();
        return useCases.filter(useCase => {
            const key = useCase.name.toLowerCase().replace(/\s+/g, ' ').trim();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    calculateBusinessCoverage(useCases, businessFiles) {
        if (useCases.length === 0)
            return 0;
        const implementedCount = useCases.filter(uc => uc.implementationStatus === 'complete').length;
        return implementedCount / useCases.length;
    }
    calculateSeparationScore(businessFiles) {
        if (businessFiles.length === 0)
            return 1;
        const serviceFiles = businessFiles.filter(f => f.type === 'service' || f.type === 'business').length;
        return Math.min(serviceFiles / businessFiles.length, 1);
    }
    assessArchitectureHealth(businessFiles, useCases) {
        const issues = [];
        const strengths = [];
        // Check for business logic concentration
        const avgMethodsPerFile = businessFiles.reduce((sum, f) => sum + f.businessMethods.length, 0) / businessFiles.length;
        if (avgMethodsPerFile > 10) {
            issues.push('High concentration of business methods per file');
        }
        else if (avgMethodsPerFile < 3) {
            strengths.push('Well-distributed business logic');
        }
        // Check use case coverage
        const coverageRatio = useCases.filter(uc => uc.implementationStatus === 'complete').length / useCases.length;
        if (coverageRatio < 0.7) {
            issues.push('Low use case implementation coverage');
        }
        else if (coverageRatio > 0.9) {
            strengths.push('High use case implementation coverage');
        }
        const score = Math.max(0, 1 - (issues.length * 0.2));
        return { score, issues, strengths };
    }
    generateRecommendations(useCases, businessFiles, health) {
        const recommendations = [];
        if (health.score < 0.7) {
            recommendations.push('Consider refactoring business logic for better separation of concerns');
        }
        const incompleteUseCases = useCases.filter(uc => uc.implementationStatus !== 'complete');
        if (incompleteUseCases.length > 0) {
            recommendations.push(`${incompleteUseCases.length} use cases need implementation or completion`);
        }
        const complexFiles = businessFiles.filter(f => f.complexity > 15);
        if (complexFiles.length > 0) {
            recommendations.push(`${complexFiles.length} files have high complexity and may need refactoring`);
        }
        if (recommendations.length === 0) {
            recommendations.push('Business logic architecture appears well-structured');
        }
        return recommendations;
    }
    // Helper methods
    endpointToUseCaseName(endpoint) {
        return endpoint
            .replace(/^\//, '')
            .replace(/\//g, ' ')
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'API Endpoint';
    }
    methodToUseCaseName(method) {
        return method
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    determineFileType(filepath, content) {
        const filename = path.basename(filepath).toLowerCase();
        if (filename.includes('service'))
            return 'service';
        if (filename.includes('controller'))
            return 'controller';
        if (filename.includes('model'))
            return 'model';
        if (content.includes('business') || content.includes('logic'))
            return 'business';
        return 'other';
    }
    calculateFileComplexity(content) {
        // Simple complexity calculation
        const lines = content.split('\n').length;
        const functions = (content.match(/function|=>/g) || []).length;
        const conditions = (content.match(/if|else|switch|case|\?/g) || []).length;
        return Math.round((lines / 10) + functions + (conditions * 1.5));
    }
}
exports.UseCasesAnalyzer = UseCasesAnalyzer;
exports.default = UseCasesAnalyzer;
//# sourceMappingURL=analyzer.js.map