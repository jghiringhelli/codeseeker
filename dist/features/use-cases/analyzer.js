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
exports.UseCasesAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class UseCasesAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeUseCases(params) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.toolExecution('use-cases-analyzer', 'started');
        try {
            // Discover use cases from documentation and code
            const useCases = await this.discoverUseCases(params.projectPath, params.businessDocsPath);
            // Analyze business logic in code
            const businessLogicAnalysis = await this.analyzeBusinessLogic(params.projectPath);
            // Map responsibilities to components
            const responsibilityMappings = await this.mapResponsibilities(useCases, businessLogicAnalysis, params.projectPath);
            // Identify gaps and violations
            const gaps = await this.identifyGaps(useCases, businessLogicAnalysis, responsibilityMappings);
            // Calculate metrics
            const separationScore = this.calculateSeparationScore(responsibilityMappings);
            const businessCoverage = this.calculateBusinessCoverage(useCases, businessLogicAnalysis);
            const architectureHealth = this.assessArchitectureHealth(responsibilityMappings, businessLogicAnalysis);
            // Generate recommendations
            const recommendations = this.generateRecommendations(gaps, responsibilityMappings, architectureHealth);
            const result = {
                useCases,
                responsibilityMappings,
                businessLogicAnalysis,
                gaps,
                separationScore,
                businessCoverage,
                recommendations,
                architectureHealth
            };
            const duration = Date.now() - startTime;
            colored_logger_1.cliLogger.toolExecution('use-cases-analyzer', 'completed', duration, {
                useCasesFound: useCases.length,
                businessFilesAnalyzed: businessLogicAnalysis.length,
                gapsIdentified: gaps.length,
                separationScore: Math.round(separationScore * 100),
                businessCoverage: Math.round(businessCoverage * 100)
            });
            return result;
        }
        catch (error) {
            colored_logger_1.cliLogger.toolExecution('use-cases-analyzer', 'failed', Date.now() - startTime, error);
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
        // Discover from code patterns
        const codeUseCases = await this.inferUseCasesFromCode(projectPath);
        useCases.push(...codeUseCases);
        // Discover from API endpoints
        const apiUseCases = await this.inferUseCasesFromAPI(projectPath);
        useCases.push(...apiUseCases);
        return this.deduplicateUseCases(useCases);
    }
    async parseDocumentationUseCases(docsPath) {
        const useCases = [];
        try {
            // Find documentation files
            const docFiles = await (0, glob_1.glob)('**/*.{md,txt,doc,docx}', { cwd: docsPath });
            for (const docFile of docFiles) {
                const content = await fs.readFile(path.join(docsPath, docFile), 'utf-8');
                const extractedUseCases = this.extractUseCasesFromText(content);
                useCases.push(...extractedUseCases);
            }
        }
        catch (error) {
            this.logger.warn('Failed to parse documentation use cases:', error);
        }
        return useCases;
    }
    extractUseCasesFromText(content) {
        const useCases = [];
        // Look for use case patterns in documentation
        const useCasePatterns = [
            /# Use Case:?\s*([^\n]+)/gi,
            /## UC\d+:?\s*([^\n]+)/gi,
            /### ([^#\n]*(?:user|customer|admin).*?(?:can|should|will|must)[^#\n]*)/gi
        ];
        let useCaseId = 1;
        for (const pattern of useCasePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const name = match[1].trim();
                if (name && name.length > 10) {
                    useCases.push({
                        id: `UC${useCaseId.toString().padStart(3, '0')}`,
                        name,
                        description: this.extractDescription(content, match.index),
                        actors: this.extractActors(content, match.index),
                        preconditions: [],
                        postconditions: [],
                        mainFlow: [],
                        businessValue: this.inferBusinessValue(name),
                        complexity: this.inferComplexity(name),
                        implementationFiles: [],
                        missingImplementations: []
                    });
                    useCaseId++;
                }
            }
        }
        return useCases;
    }
    extractDescription(content, startIndex) {
        // Extract text following the use case title
        const remaining = content.substring(startIndex);
        const lines = remaining.split('\n').slice(1, 4);
        return lines.join(' ').trim().substring(0, 200);
    }
    extractActors(content, startIndex) {
        const actors = [];
        const text = content.substring(Math.max(0, startIndex - 200), startIndex + 200);
        const actorPatterns = [
            /(?:actor|user|customer|admin|manager|operator|system)s?\b/gi
        ];
        for (const pattern of actorPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                actors.push(...matches.map(m => m.toLowerCase()));
            }
        }
        return [...new Set(actors)];
    }
    inferBusinessValue(name) {
        const highValueKeywords = ['payment', 'purchase', 'order', 'security', 'auth', 'critical', 'revenue'];
        const mediumValueKeywords = ['user', 'profile', 'notification', 'report', 'dashboard'];
        const nameLower = name.toLowerCase();
        if (highValueKeywords.some(k => nameLower.includes(k)))
            return 'critical';
        if (mediumValueKeywords.some(k => nameLower.includes(k)))
            return 'medium';
        return 'low';
    }
    inferComplexity(name) {
        const complexKeywords = ['integrate', 'synchronize', 'workflow', 'multi-step', 'complex'];
        const simpleKeywords = ['view', 'display', 'show', 'list'];
        const nameLower = name.toLowerCase();
        if (complexKeywords.some(k => nameLower.includes(k)))
            return 'complex';
        if (simpleKeywords.some(k => nameLower.includes(k)))
            return 'simple';
        return 'medium';
    }
    async inferUseCasesFromCode(projectPath) {
        const useCases = [];
        try {
            // Look for service/controller files
            const serviceFiles = await (0, glob_1.glob)('src/**/*{service,controller,handler,use-case}*.{js,ts}', {
                cwd: projectPath
            });
            for (const file of serviceFiles) {
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                const fileUseCases = this.extractUseCasesFromServiceFile(content, file);
                useCases.push(...fileUseCases);
            }
        }
        catch (error) {
            this.logger.warn('Failed to infer use cases from code:', error);
        }
        return useCases;
    }
    extractUseCasesFromServiceFile(content, filePath) {
        const useCases = [];
        // Extract method names that look like use cases
        const methodPatterns = [
            /(?:async\s+)?(\w*(?:create|update|delete|get|fetch|process|handle|execute)\w*)\s*\(/gi,
            /(?:public\s+)?(\w+UseCase)\s*\(/gi,
            /(\w+Handler)\s*\(/gi
        ];
        for (const pattern of methodPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const methodName = match[1];
                if (methodName && methodName.length > 3) {
                    useCases.push({
                        id: `CODE_${methodName.toUpperCase()}`,
                        name: this.camelCaseToTitle(methodName),
                        description: `Inferred from ${methodName} method in ${path.basename(filePath)}`,
                        actors: ['user'],
                        preconditions: [],
                        postconditions: [],
                        mainFlow: [],
                        businessValue: this.inferBusinessValue(methodName),
                        complexity: 'medium',
                        implementationFiles: [filePath],
                        missingImplementations: []
                    });
                }
            }
        }
        return useCases;
    }
    camelCaseToTitle(camelCase) {
        return camelCase
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    async inferUseCasesFromAPI(projectPath) {
        const useCases = [];
        try {
            // Look for API route files
            const apiFiles = await (0, glob_1.glob)('src/**/*{route,api,endpoint}*.{js,ts}', {
                cwd: projectPath
            });
            for (const file of apiFiles) {
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                const apiUseCases = this.extractUseCasesFromAPIFile(content, file);
                useCases.push(...apiUseCases);
            }
        }
        catch (error) {
            this.logger.warn('Failed to infer use cases from API:', error);
        }
        return useCases;
    }
    extractUseCasesFromAPIFile(content, filePath) {
        const useCases = [];
        // Extract API endpoints
        const endpointPatterns = [
            /(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
            /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi
        ];
        for (const pattern of endpointPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const endpoint = match[1];
                if (endpoint && endpoint !== '/') {
                    const useCaseName = this.endpointToUseCase(endpoint);
                    useCases.push({
                        id: `API_${endpoint.replace(/[^\w]/g, '_').toUpperCase()}`,
                        name: useCaseName,
                        description: `API endpoint: ${endpoint}`,
                        actors: ['api_client'],
                        preconditions: [],
                        postconditions: [],
                        mainFlow: [],
                        businessValue: this.inferBusinessValue(endpoint),
                        complexity: 'medium',
                        implementationFiles: [filePath],
                        missingImplementations: []
                    });
                }
            }
        }
        return useCases;
    }
    endpointToUseCase(endpoint) {
        const parts = endpoint.split('/').filter(p => p && !p.startsWith(':'));
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    deduplicateUseCases(useCases) {
        const seen = new Set();
        const unique = [];
        for (const useCase of useCases) {
            const key = useCase.name.toLowerCase().replace(/\s+/g, ' ').trim();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(useCase);
            }
        }
        return unique;
    }
    async analyzeBusinessLogic(projectPath) {
        const analyses = [];
        try {
            // Find business logic files
            const businessFiles = await (0, glob_1.glob)('src/**/*.{js,ts}', { cwd: projectPath });
            for (const file of businessFiles) {
                // Skip test files
                if (file.includes('.test.') || file.includes('.spec.'))
                    continue;
                const fullPath = path.join(projectPath, file);
                const analysis = await this.analyzeBusinessLogicFile(fullPath);
                if (analysis) {
                    analyses.push(analysis);
                }
            }
        }
        catch (error) {
            this.logger.warn('Failed to analyze business logic:', error);
        }
        return analyses;
    }
    async analyzeBusinessLogicFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Extract business rules
            const businessRules = this.extractBusinessRules(content);
            // Extract data validations
            const dataValidations = this.extractDataValidations(content);
            // Extract business entities
            const businessEntities = this.extractBusinessEntities(content);
            // Extract workflows
            const workflows = this.extractWorkflows(content);
            // Extract integrations
            const integrations = this.extractIntegrations(content);
            // Calculate complexity
            const complexity = this.calculateFileComplexity(content);
            // Calculate maintainability
            const maintainability = this.calculateMaintainability(content, businessRules.length);
            // Only include files with business logic
            if (businessRules.length === 0 && dataValidations.length === 0 && workflows.length === 0) {
                return null;
            }
            return {
                file: filePath,
                businessRules,
                dataValidations,
                businessEntities,
                workflows,
                integrations,
                complexity,
                maintainability
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze business logic file ${filePath}:`, error);
            return null;
        }
    }
    extractBusinessRules(content) {
        const rules = [];
        // Look for validation and business rule patterns
        const rulePatterns = [
            /if\s*\([^)]*(?:amount|price|quantity|balance|limit|threshold)[^)]*\)/gi,
            /(?:validate|check|ensure|verify|confirm)\w*\([^)]*\)/gi,
            /throw\s+new\s+\w*(?:Error|Exception)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
            /\/\/.*(?:business rule|rule|policy|constraint).*$/gmi
        ];
        for (const pattern of rulePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                rules.push(...matches.map(m => m.trim()));
            }
        }
        return [...new Set(rules)];
    }
    extractDataValidations(content) {
        const validations = [];
        const validationPatterns = [
            /\.required\(\)/gi,
            /\.min\(\d+\)/gi,
            /\.max\(\d+\)/gi,
            /\.email\(\)/gi,
            /\.matches\([^)]+\)/gi,
            /\.isEmail\(\)/gi,
            /\.isLength\([^)]+\)/gi,
            /\bisValid\w*/gi
        ];
        for (const pattern of validationPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                validations.push(...matches);
            }
        }
        return [...new Set(validations)];
    }
    extractBusinessEntities(content) {
        const entities = [];
        // Look for class/interface names that look like business entities
        const entityPatterns = [
            /(?:class|interface)\s+(\w*(?:User|Customer|Order|Product|Account|Invoice|Payment|Transaction)\w*)/gi,
            /type\s+(\w*(?:User|Customer|Order|Product|Account|Invoice|Payment|Transaction)\w*)\s*=/gi
        ];
        for (const pattern of entityPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                entities.push(match[1]);
            }
        }
        return [...new Set(entities)];
    }
    extractWorkflows(content) {
        const workflows = [];
        // Look for workflow patterns
        const workflowPatterns = [
            /(?:async\s+)?(\w*(?:Process|Workflow|Flow|Pipeline)\w*)\s*\(/gi,
            /\.then\s*\([^)]*\)\s*\.then/gi, // Promise chains
            /await\s+\w+\s*\([^)]*\)\s*;\s*await/gi // Async workflows
        ];
        for (const pattern of workflowPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                workflows.push(...matches.map(m => m.trim()));
            }
        }
        return [...new Set(workflows)];
    }
    extractIntegrations(content) {
        const integrations = [];
        // Look for external integrations
        const integrationPatterns = [
            /axios\.|fetch\(/gi,
            /(?:import|require).*['"`](@?\w+\/\w+|http)['"`]/gi,
            /process\.env\.\w*(?:API|URL|ENDPOINT)/gi
        ];
        for (const pattern of integrationPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                integrations.push(...matches);
            }
        }
        return [...new Set(integrations)];
    }
    calculateFileComplexity(content) {
        // Cyclomatic complexity for business logic
        let complexity = 1;
        const complexityPatterns = [
            /if\s*\(/gi,
            /else\s*if\s*\(/gi,
            /while\s*\(/gi,
            /for\s*\(/gi,
            /switch\s*\(/gi,
            /case\s+/gi,
            /catch\s*\(/gi,
            /\?\s*:/gi,
            /&&/gi,
            /\|\|/gi
        ];
        for (const pattern of complexityPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        return complexity;
    }
    calculateMaintainability(content, businessRulesCount) {
        // Simple maintainability index
        const lines = content.split('\n').length;
        const complexity = this.calculateFileComplexity(content);
        // Penalize long files, high complexity, and many business rules
        let maintainability = 100;
        maintainability -= Math.max(0, (lines - 100) * 0.1);
        maintainability -= complexity * 2;
        maintainability -= businessRulesCount * 3;
        return Math.max(0, Math.min(100, maintainability));
    }
    async mapResponsibilities(useCases, businessLogic, projectPath) {
        const mappings = [];
        for (const useCase of useCases) {
            // Find implementations for this use case
            const relatedFiles = await this.findRelatedFiles(useCase, businessLogic, projectPath);
            for (const file of relatedFiles) {
                const mapping = this.createResponsibilityMapping(useCase, file, businessLogic);
                mappings.push(mapping);
            }
        }
        return mappings;
    }
    async findRelatedFiles(useCase, businessLogic, projectPath) {
        const relatedFiles = [];
        // Add files from use case
        relatedFiles.push(...useCase.implementationFiles);
        // Find files with similar names or keywords
        const keywords = this.extractKeywordsFromUseCase(useCase);
        for (const logic of businessLogic) {
            const fileContent = await fs.readFile(logic.file, 'utf-8').catch(() => '');
            const hasRelatedKeywords = keywords.some(keyword => fileContent.toLowerCase().includes(keyword.toLowerCase()));
            if (hasRelatedKeywords) {
                relatedFiles.push(logic.file);
            }
        }
        return [...new Set(relatedFiles)];
    }
    extractKeywordsFromUseCase(useCase) {
        const text = `${useCase.name} ${useCase.description}`.toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 3);
        return [...new Set(words)];
    }
    createResponsibilityMapping(useCase, filePath, businessLogic) {
        const logic = businessLogic.find(bl => bl.file === filePath);
        const responsibilities = [
            ...(logic?.businessRules || []),
            ...(logic?.workflows || []),
            ...(logic?.dataValidations || [])
        ].slice(0, 5); // Limit for readability
        // Calculate separation score
        const separationScore = this.calculateFileSeparationScore(logic);
        // Identify violations
        const violations = this.identifyResponsibilityViolations(useCase, logic);
        // Generate suggestions
        const suggestions = this.generateResponsibilitySuggestions(violations, separationScore);
        return {
            useCase: useCase.id,
            component: path.basename(filePath, path.extname(filePath)),
            file: filePath,
            responsibilities,
            separationScore,
            violations,
            suggestions
        };
    }
    calculateFileSeparationScore(logic) {
        if (!logic)
            return 0;
        // Higher score for focused responsibility
        const businessRuleCount = logic.businessRules.length;
        const integrationCount = logic.integrations.length;
        let score = 1;
        // Penalize mixed concerns
        if (businessRuleCount > 0 && integrationCount > 0) {
            score -= 0.3;
        }
        // Penalize high complexity
        if (logic.complexity > 20) {
            score -= 0.2;
        }
        // Reward good maintainability
        score += (logic.maintainability / 100) * 0.2;
        return Math.max(0, Math.min(1, score));
    }
    identifyResponsibilityViolations(useCase, logic) {
        const violations = [];
        if (!logic) {
            violations.push('No business logic implementation found');
            return violations;
        }
        // Check for mixed concerns
        if (logic.businessRules.length > 0 && logic.integrations.length > 5) {
            violations.push('Business logic mixed with integration concerns');
        }
        // Check for complex validation logic in business layer
        if (logic.dataValidations.length > 10) {
            violations.push('Too many data validations in business layer');
        }
        // Check for high complexity
        if (logic.complexity > 30) {
            violations.push('High complexity indicates multiple responsibilities');
        }
        return violations;
    }
    generateResponsibilitySuggestions(violations, separationScore) {
        const suggestions = [];
        if (separationScore < 0.6) {
            suggestions.push('Consider extracting separate classes for different concerns');
        }
        if (violations.includes('Business logic mixed with integration concerns')) {
            suggestions.push('Move integration logic to separate service layer');
        }
        if (violations.includes('Too many data validations in business layer')) {
            suggestions.push('Extract validation logic to dedicated validator classes');
        }
        if (violations.includes('High complexity indicates multiple responsibilities')) {
            suggestions.push('Break down complex methods into smaller, focused functions');
        }
        return suggestions;
    }
    async identifyGaps(useCases, businessLogic, mappings) {
        const gaps = [];
        // Find use cases without implementations
        const implementedUseCases = new Set(mappings.map(m => m.useCase));
        const unimplementedUseCases = useCases.filter(uc => !implementedUseCases.has(uc.id));
        for (const useCase of unimplementedUseCases) {
            gaps.push({
                type: 'missing_implementation',
                severity: useCase.businessValue === 'critical' ? 'critical' :
                    useCase.businessValue === 'high' ? 'high' : 'medium',
                description: `Use case "${useCase.name}" has no implementation`,
                affectedFiles: [],
                useCases: [useCase.id],
                suggestion: 'Implement missing use case or update documentation',
                businessImpact: `${useCase.businessValue} business value use case is not implemented`
            });
        }
        // Find business logic without use case mapping
        const mappedFiles = new Set(mappings.map(m => m.file));
        const orphanedLogic = businessLogic.filter(bl => !mappedFiles.has(bl.file));
        for (const logic of orphanedLogic) {
            if (logic.businessRules.length > 0 || logic.workflows.length > 0) {
                gaps.push({
                    type: 'orphaned_code',
                    severity: 'medium',
                    description: `Business logic in ${path.basename(logic.file)} not mapped to any use case`,
                    affectedFiles: [logic.file],
                    useCases: [],
                    suggestion: 'Create use case documentation or remove unused code',
                    businessImpact: 'Potential dead code increases maintenance cost'
                });
            }
        }
        // Find responsibility violations
        const violationMappings = mappings.filter(m => m.violations.length > 0);
        for (const mapping of violationMappings) {
            gaps.push({
                type: 'responsibility_violation',
                severity: mapping.separationScore < 0.3 ? 'high' : 'medium',
                description: `Responsibility violations in ${path.basename(mapping.file)}`,
                affectedFiles: [mapping.file],
                useCases: [mapping.useCase],
                suggestion: mapping.suggestions.join('; '),
                businessImpact: 'Poor separation of concerns affects maintainability'
            });
        }
        return gaps;
    }
    calculateSeparationScore(mappings) {
        if (mappings.length === 0)
            return 0;
        const totalScore = mappings.reduce((sum, mapping) => sum + mapping.separationScore, 0);
        return totalScore / mappings.length;
    }
    calculateBusinessCoverage(useCases, businessLogic) {
        if (useCases.length === 0)
            return 1;
        const implementedCount = useCases.filter(uc => uc.implementationFiles.length > 0 ||
            businessLogic.some(bl => this.extractKeywordsFromUseCase(uc).some(keyword => bl.file.toLowerCase().includes(keyword.toLowerCase())))).length;
        return implementedCount / useCases.length;
    }
    assessArchitectureHealth(mappings, businessLogic) {
        const layerSeparation = this.calculateSeparationScore(mappings);
        const businessLogicIsolation = businessLogic.length > 0 ?
            businessLogic.reduce((sum, bl) => sum + (bl.maintainability / 100), 0) / businessLogic.length :
            0;
        const dependencyDirection = this.assessDependencyDirection(businessLogic);
        const testability = this.assessTestability(businessLogic);
        return {
            layerSeparation,
            businessLogicIsolation,
            dependencyDirection,
            testability
        };
    }
    assessDependencyDirection(businessLogic) {
        // Simple heuristic: fewer external dependencies in business logic is better
        const avgIntegrations = businessLogic.length > 0 ?
            businessLogic.reduce((sum, bl) => sum + bl.integrations.length, 0) / businessLogic.length :
            0;
        return Math.max(0, 1 - (avgIntegrations / 10));
    }
    assessTestability(businessLogic) {
        // Simple heuristic: lower complexity means better testability
        const avgComplexity = businessLogic.length > 0 ?
            businessLogic.reduce((sum, bl) => sum + bl.complexity, 0) / businessLogic.length :
            0;
        return Math.max(0, 1 - (avgComplexity / 50));
    }
    generateRecommendations(gaps, mappings, architectureHealth) {
        const recommendations = [];
        // Gap-based recommendations
        const criticalGaps = gaps.filter(g => g.severity === 'critical');
        if (criticalGaps.length > 0) {
            recommendations.push(`Address ${criticalGaps.length} critical business gaps immediately`);
        }
        const missingImplementations = gaps.filter(g => g.type === 'missing_implementation');
        if (missingImplementations.length > 0) {
            recommendations.push(`Implement ${missingImplementations.length} missing use cases`);
        }
        const orphanedCode = gaps.filter(g => g.type === 'orphaned_code');
        if (orphanedCode.length > 0) {
            recommendations.push(`Review ${orphanedCode.length} files with orphaned business logic`);
        }
        // Architecture-based recommendations
        if (architectureHealth.layerSeparation < 0.7) {
            recommendations.push('Improve separation of concerns across layers');
        }
        if (architectureHealth.businessLogicIsolation < 0.6) {
            recommendations.push('Isolate business logic from infrastructure concerns');
        }
        if (architectureHealth.dependencyDirection < 0.7) {
            recommendations.push('Reduce external dependencies in business logic layer');
        }
        if (architectureHealth.testability < 0.6) {
            recommendations.push('Reduce complexity to improve testability');
        }
        // Responsibility-based recommendations
        const poorSeparation = mappings.filter(m => m.separationScore < 0.5);
        if (poorSeparation.length > 0) {
            recommendations.push(`Refactor ${poorSeparation.length} components with poor responsibility separation`);
        }
        return recommendations;
    }
}
exports.UseCasesAnalyzer = UseCasesAnalyzer;
exports.default = UseCasesAnalyzer;
//# sourceMappingURL=analyzer.js.map