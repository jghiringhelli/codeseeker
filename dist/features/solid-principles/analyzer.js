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
exports.SOLIDPrinciplesAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class SOLIDPrinciplesAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeSOLID(params) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.toolExecution('solid-principles-analyzer', 'started');
        try {
            // Find all class files
            const classFiles = await this.findClassFiles(params.projectPath, params.excludePatterns);
            // Analyze each class
            const classAnalyses = [];
            const allViolations = [];
            for (const file of classFiles) {
                const analysis = await this.analyzeClassFile(file);
                if (analysis) {
                    classAnalyses.push(analysis);
                    allViolations.push(...analysis.violations);
                }
            }
            // Calculate scores
            const principleScores = this.calculatePrincipleScores(allViolations, classAnalyses.length);
            const overallScore = this.calculateOverallScore(principleScores);
            // Generate recommendations
            const recommendations = this.generateRecommendations(allViolations, classAnalyses);
            const refactoringOpportunities = this.identifyRefactoringOpportunities(classAnalyses);
            const result = {
                violations: allViolations,
                classAnalyses,
                overallScore,
                principleScores,
                recommendations,
                refactoringOpportunities
            };
            const duration = Date.now() - startTime;
            colored_logger_1.cliLogger.toolExecution('solid-principles-analyzer', 'completed', duration, {
                classesAnalyzed: classAnalyses.length,
                violationsFound: allViolations.length,
                overallScore: Math.round(overallScore),
                criticalViolations: allViolations.filter(v => v.severity === 'critical').length
            });
            return result;
        }
        catch (error) {
            colored_logger_1.cliLogger.toolExecution('solid-principles-analyzer', 'failed', Date.now() - startTime, error);
            throw error;
        }
    }
    async findClassFiles(projectPath, excludePatterns) {
        const patterns = [
            'src/**/*.{ts,js,tsx,jsx}',
            'lib/**/*.{ts,js}',
            '!**/*.test.{ts,js}',
            '!**/*.spec.{ts,js}',
            '!**/node_modules/**'
        ];
        if (excludePatterns) {
            patterns.push(...excludePatterns.map(p => `!${p}`));
        }
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern, { cwd: projectPath });
            files.push(...matches.map(m => path.join(projectPath, m)));
        }
        return files;
    }
    async analyzeClassFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Extract class information
            const className = this.extractClassName(content);
            if (!className)
                return null;
            const methods = this.extractMethods(content);
            const dependencies = this.extractDependencies(content);
            const responsibilities = this.analyzeResponsibilities(content, methods);
            // Analyze SOLID violations
            const violations = await this.analyzeViolations(content, filePath, className, methods, dependencies);
            // Calculate metrics
            const complexity = this.calculateComplexity(content);
            const cohesion = this.calculateCohesion(methods, responsibilities);
            return {
                name: className,
                file: filePath,
                responsibilities,
                methods,
                dependencies,
                violations,
                complexity,
                cohesion
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze class file ${filePath}:`, error);
            return null;
        }
    }
    extractClassName(content) {
        // Extract class name from various patterns
        const classPatterns = [
            /class\s+(\w+)/,
            /export\s+class\s+(\w+)/,
            /export\s+default\s+class\s+(\w+)/,
            /interface\s+(\w+)/,
            /type\s+(\w+)\s*=/
        ];
        for (const pattern of classPatterns) {
            const match = pattern.exec(content);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    extractMethods(content) {
        const methods = [];
        // Extract method names
        const methodPatterns = [
            /(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*[:{]/g,
            /(\w+)\s*:\s*\([^)]*\)\s*=>/g,
            /(\w+)\s*=\s*\([^)]*\)\s*=>/g
        ];
        for (const pattern of methodPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const methodName = match[1];
                if (methodName !== 'constructor' && !methods.includes(methodName)) {
                    methods.push(methodName);
                }
            }
        }
        return methods;
    }
    extractDependencies(content) {
        const dependencies = [];
        // Extract imports
        const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        return dependencies;
    }
    analyzeResponsibilities(content, methods) {
        const responsibilities = [];
        // Analyze method names to infer responsibilities
        const responsibilityKeywords = {
            'Data Management': ['save', 'load', 'store', 'fetch', 'get', 'set', 'create', 'update', 'delete'],
            'Validation': ['validate', 'check', 'verify', 'ensure', 'confirm'],
            'Formatting': ['format', 'parse', 'convert', 'transform', 'serialize'],
            'UI Rendering': ['render', 'display', 'show', 'hide', 'toggle', 'draw'],
            'Event Handling': ['handle', 'on', 'click', 'submit', 'change'],
            'Business Logic': ['calculate', 'compute', 'process', 'execute', 'apply'],
            'Communication': ['send', 'receive', 'request', 'response', 'notify'],
            'Logging': ['log', 'debug', 'trace', 'error', 'warn']
        };
        for (const [responsibility, keywords] of Object.entries(responsibilityKeywords)) {
            const hasResponsibility = methods.some(method => keywords.some(keyword => method.toLowerCase().includes(keyword.toLowerCase())));
            if (hasResponsibility) {
                responsibilities.push(responsibility);
            }
        }
        // Check for additional patterns in content
        if (content.includes('fetch') || content.includes('axios') || content.includes('api')) {
            responsibilities.push('API Communication');
        }
        if (content.includes('localStorage') || content.includes('sessionStorage')) {
            responsibilities.push('Storage Management');
        }
        return [...new Set(responsibilities)];
    }
    async analyzeViolations(content, filePath, className, methods, dependencies) {
        const violations = [];
        // Single Responsibility Principle violations
        violations.push(...this.analyzeSRPViolations(content, filePath, className, methods));
        // Open/Closed Principle violations
        violations.push(...this.analyzeOCPViolations(content, filePath, className));
        // Liskov Substitution Principle violations
        violations.push(...this.analyzeLSPViolations(content, filePath, className));
        // Interface Segregation Principle violations
        violations.push(...this.analyzeISPViolations(content, filePath, className));
        // Dependency Inversion Principle violations
        violations.push(...this.analyzeDIPViolations(content, filePath, className, dependencies));
        return violations;
    }
    analyzeSRPViolations(content, filePath, className, methods) {
        const violations = [];
        // Check for too many responsibilities
        const responsibilities = this.analyzeResponsibilities(content, methods);
        if (responsibilities.length > 3) {
            violations.push({
                principle: 'SRP',
                file: filePath,
                severity: 'high',
                description: `Class ${className} has ${responsibilities.length} responsibilities: ${responsibilities.join(', ')}`,
                suggestion: `Consider splitting ${className} into separate classes, each handling one responsibility`,
                relatedClasses: [className]
            });
        }
        // Check for large number of methods
        if (methods.length > 15) {
            violations.push({
                principle: 'SRP',
                file: filePath,
                severity: 'medium',
                description: `Class ${className} has ${methods.length} methods, indicating multiple responsibilities`,
                suggestion: 'Extract related methods into separate classes or utility functions',
                relatedClasses: [className]
            });
        }
        return violations;
    }
    analyzeOCPViolations(content, filePath, className) {
        const violations = [];
        // Check for switch/case statements or long if-else chains
        const switchMatches = content.match(/switch\s*\([^)]+\)\s*\{[^}]*case/g);
        if (switchMatches && switchMatches.length > 0) {
            violations.push({
                principle: 'OCP',
                file: filePath,
                severity: 'medium',
                description: `Class ${className} contains switch statements that may require modification for new cases`,
                suggestion: 'Consider using polymorphism or strategy pattern instead of switch statements',
                relatedClasses: [className]
            });
        }
        // Check for hardcoded type checking
        if (content.includes('instanceof') || content.includes('typeof')) {
            violations.push({
                principle: 'OCP',
                file: filePath,
                severity: 'low',
                description: `Class ${className} uses type checking which may require modification for new types`,
                suggestion: 'Use polymorphism or visitor pattern instead of explicit type checking',
                relatedClasses: [className]
            });
        }
        return violations;
    }
    analyzeLSPViolations(content, filePath, className) {
        const violations = [];
        // Check for thrown exceptions in overridden methods
        if (content.includes('extends') && content.includes('throw new')) {
            violations.push({
                principle: 'LSP',
                file: filePath,
                severity: 'medium',
                description: `Class ${className} may throw exceptions not expected by base class contract`,
                suggestion: 'Ensure overridden methods maintain the same behavioral contract as base class',
                relatedClasses: [className]
            });
        }
        return violations;
    }
    analyzeISPViolations(content, filePath, className) {
        const violations = [];
        // Check for large interfaces
        const interfaceMatch = content.match(/interface\s+\w+\s*\{([^}]+)\}/);
        if (interfaceMatch) {
            const interfaceContent = interfaceMatch[1];
            const methods = (interfaceContent.match(/\w+\s*\(/g) || []).length;
            if (methods > 10) {
                violations.push({
                    principle: 'ISP',
                    file: filePath,
                    severity: 'high',
                    description: `Interface in ${className} has ${methods} methods, likely forcing clients to depend on unused methods`,
                    suggestion: 'Split large interfaces into smaller, more focused interfaces',
                    relatedClasses: [className]
                });
            }
        }
        return violations;
    }
    analyzeDIPViolations(content, filePath, className, dependencies) {
        const violations = [];
        // Check for direct instantiation of concrete classes
        const newStatements = content.match(/new\s+[A-Z]\w+\(/g);
        if (newStatements && newStatements.length > 2) {
            violations.push({
                principle: 'DIP',
                file: filePath,
                severity: 'medium',
                description: `Class ${className} directly instantiates ${newStatements.length} concrete classes`,
                suggestion: 'Use dependency injection or factory patterns instead of direct instantiation',
                relatedClasses: [className]
            });
        }
        // Check for concrete class imports
        const concreteImports = dependencies.filter(dep => !dep.startsWith('.') &&
            !dep.includes('interface') &&
            !dep.includes('type') &&
            !dep.includes('@'));
        if (concreteImports.length > 5) {
            violations.push({
                principle: 'DIP',
                file: filePath,
                severity: 'low',
                description: `Class ${className} depends on ${concreteImports.length} concrete implementations`,
                suggestion: 'Consider depending on abstractions (interfaces) rather than concrete classes',
                relatedClasses: [className]
            });
        }
        return violations;
    }
    calculateComplexity(content) {
        // Simple cyclomatic complexity calculation
        let complexity = 1; // Base complexity
        // Add complexity for control structures
        const controlStructures = [
            /if\s*\(/g,
            /else\s*if\s*\(/g,
            /while\s*\(/g,
            /for\s*\(/g,
            /switch\s*\(/g,
            /case\s+/g,
            /catch\s*\(/g,
            /\?\s*:/g, // ternary operator
            /&&/g,
            /\|\|/g
        ];
        for (const pattern of controlStructures) {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        return complexity;
    }
    calculateCohesion(methods, responsibilities) {
        // Simple cohesion calculation based on method grouping
        if (methods.length === 0 || responsibilities.length === 0)
            return 1;
        // Higher cohesion when fewer responsibilities relative to methods
        return Math.max(0, 1 - (responsibilities.length / methods.length));
    }
    calculatePrincipleScores(violations, classCount) {
        const scores = { SRP: 100, OCP: 100, LSP: 100, ISP: 100, DIP: 100 };
        if (classCount === 0)
            return scores;
        for (const violation of violations) {
            const penalty = violation.severity === 'critical' ? 20 :
                violation.severity === 'high' ? 15 :
                    violation.severity === 'medium' ? 10 : 5;
            scores[violation.principle] = Math.max(0, scores[violation.principle] - penalty);
        }
        return scores;
    }
    calculateOverallScore(principleScores) {
        const values = Object.values(principleScores);
        return values.reduce((sum, score) => sum + score, 0) / values.length;
    }
    generateRecommendations(violations, classAnalyses) {
        const recommendations = [];
        // Group violations by severity
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        const highViolations = violations.filter(v => v.severity === 'high');
        if (criticalViolations.length > 0) {
            recommendations.push(`Address ${criticalViolations.length} critical SOLID violations immediately`);
        }
        if (highViolations.length > 0) {
            recommendations.push(`Refactor ${highViolations.length} high-severity violations in next sprint`);
        }
        // Analyze most problematic classes
        const problematicClasses = classAnalyses
            .filter(c => c.violations.length > 3)
            .sort((a, b) => b.violations.length - a.violations.length)
            .slice(0, 3);
        if (problematicClasses.length > 0) {
            recommendations.push(`Focus refactoring efforts on: ${problematicClasses.map(c => c.name).join(', ')}`);
        }
        return recommendations;
    }
    identifyRefactoringOpportunities(classAnalyses) {
        const opportunities = [];
        // Classes with low cohesion
        const lowCohesionClasses = classAnalyses.filter(c => c.cohesion < 0.5);
        if (lowCohesionClasses.length > 0) {
            opportunities.push(`${lowCohesionClasses.length} classes have low cohesion and could benefit from method extraction`);
        }
        // Classes with high complexity
        const complexClasses = classAnalyses.filter(c => c.complexity > 20);
        if (complexClasses.length > 0) {
            opportunities.push(`${complexClasses.length} classes have high complexity and need simplification`);
        }
        // Classes with many responsibilities
        const multiResponsibilityClasses = classAnalyses.filter(c => c.responsibilities.length > 3);
        if (multiResponsibilityClasses.length > 0) {
            opportunities.push(`${multiResponsibilityClasses.length} classes should be split based on single responsibility principle`);
        }
        return opportunities;
    }
}
exports.SOLIDPrinciplesAnalyzer = SOLIDPrinciplesAnalyzer;
exports.default = SOLIDPrinciplesAnalyzer;
//# sourceMappingURL=analyzer.js.map