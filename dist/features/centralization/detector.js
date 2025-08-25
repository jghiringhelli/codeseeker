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
exports.CentralizationDetector = exports.Priority = exports.RiskLevel = exports.EffortLevel = exports.MigrationApproach = exports.ConfigUsage = exports.ConfigurationType = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const analyzer_1 = require("../../shared/ast/analyzer");
const logger_1 = require("../../utils/logger");
const crypto_1 = require("crypto");
var ConfigurationType;
(function (ConfigurationType) {
    ConfigurationType["API_ENDPOINTS"] = "api_endpoints";
    ConfigurationType["DATABASE_CONFIG"] = "database_config";
    ConfigurationType["STYLING_CONSTANTS"] = "styling_constants";
    ConfigurationType["BUSINESS_RULES"] = "business_rules";
    ConfigurationType["VALIDATION_RULES"] = "validation_rules";
    ConfigurationType["ERROR_MESSAGES"] = "error_messages";
    ConfigurationType["FEATURE_FLAGS"] = "feature_flags";
    ConfigurationType["ENVIRONMENT_CONFIG"] = "environment_config";
    ConfigurationType["ROUTING_CONFIG"] = "routing_config";
    ConfigurationType["SECURITY_CONFIG"] = "security_config";
    ConfigurationType["LOGGING_CONFIG"] = "logging_config";
    ConfigurationType["CACHE_CONFIG"] = "cache_config";
})(ConfigurationType || (exports.ConfigurationType = ConfigurationType = {}));
var ConfigUsage;
(function (ConfigUsage) {
    ConfigUsage["DEFINITION"] = "definition";
    ConfigUsage["REFERENCE"] = "reference";
    ConfigUsage["MODIFICATION"] = "modification";
    ConfigUsage["VALIDATION"] = "validation";
})(ConfigUsage || (exports.ConfigUsage = ConfigUsage = {}));
var MigrationApproach;
(function (MigrationApproach) {
    MigrationApproach["EXTRACT_TO_CONFIG_FILE"] = "extract_to_config_file";
    MigrationApproach["ENVIRONMENT_VARIABLES"] = "environment_variables";
    MigrationApproach["CENTRALIZED_CONSTANTS"] = "centralized_constants";
    MigrationApproach["CONFIGURATION_CLASS"] = "configuration_class";
    MigrationApproach["DEPENDENCY_INJECTION"] = "dependency_injection";
    MigrationApproach["FEATURE_TOGGLE_SYSTEM"] = "feature_toggle_system";
})(MigrationApproach || (exports.MigrationApproach = MigrationApproach = {}));
var EffortLevel;
(function (EffortLevel) {
    EffortLevel["LOW"] = "low";
    EffortLevel["MEDIUM"] = "medium";
    EffortLevel["HIGH"] = "high";
    EffortLevel["VERY_HIGH"] = "very_high"; // > 40 hours
})(EffortLevel || (exports.EffortLevel = EffortLevel = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
    RiskLevel["CRITICAL"] = "critical";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var Priority;
(function (Priority) {
    Priority["LOW"] = "low";
    Priority["MEDIUM"] = "medium";
    Priority["HIGH"] = "high";
    Priority["CRITICAL"] = "critical";
})(Priority || (exports.Priority = Priority = {}));
class CentralizationDetector {
    logger = logger_1.Logger.getInstance();
    astAnalyzer = new analyzer_1.ASTAnalyzer();
    configPatterns;
    constructor() {
        this.configPatterns = this.initializeConfigPatterns();
    }
    async scanProject(request) {
        const startTime = Date.now();
        this.logger.info(`Starting centralization scan for ${request.projectPath}`);
        const scanInfo = {
            totalFiles: 0,
            analyzedFiles: 0,
            skippedFiles: 0,
            configItemsFound: 0,
            processingTime: 0,
            timestamp: new Date()
        };
        try {
            // Get all files to scan
            const files = await this.getScanFiles(request.projectPath, request.excludePatterns);
            scanInfo.totalFiles = files.length;
            // Scan all files for configuration patterns
            const allConfigItems = [];
            for (const file of files) {
                try {
                    const filePath = path.join(request.projectPath, file);
                    const configItems = await this.scanFile(filePath, request.configTypes);
                    allConfigItems.push(...configItems);
                    scanInfo.analyzedFiles++;
                }
                catch (error) {
                    this.logger.warn(`Failed to scan file ${file}`, error);
                    scanInfo.skippedFiles++;
                }
            }
            scanInfo.configItemsFound = allConfigItems.length;
            // Group similar configurations into opportunities
            const opportunities = this.identifyOpportunities(allConfigItems, request.minOccurrences || 2);
            // Calculate scores for each opportunity
            for (const opportunity of opportunities) {
                opportunity.benefitScore = this.calculateBenefitScore(opportunity);
                opportunity.complexityScore = this.calculateComplexityScore(opportunity);
                if (request.includeMigrationPlan) {
                    opportunity.migrationPlan = await this.generateMigrationPlan(opportunity);
                }
                if (request.includeRiskAssessment) {
                    opportunity.riskAssessment = this.assessRisk(opportunity);
                }
                // Generate examples
                opportunity.examples = this.generateExamples(opportunity);
                // Suggest consolidation target
                opportunity.consolidationTarget = this.suggestConsolidationTarget(opportunity);
            }
            scanInfo.processingTime = Date.now() - startTime;
            // Generate statistics and recommendations
            const statistics = this.calculateStatistics(opportunities);
            const recommendations = this.generateGlobalRecommendations(opportunities);
            this.logger.info(`Centralization scan completed: found ${opportunities.length} opportunities in ${scanInfo.processingTime}ms`);
            return {
                opportunities,
                scanInfo,
                statistics,
                recommendations
            };
        }
        catch (error) {
            this.logger.error('Centralization scan failed', error);
            throw error;
        }
    }
    initializeConfigPatterns() {
        return [
            // API Endpoints
            {
                type: ConfigurationType.API_ENDPOINTS,
                patterns: [
                    /(['"`])https?:\/\/[^'"`]+\1/g,
                    /(['"`])\/api\/[^'"`]+\1/g,
                    /url\s*:\s*(['"`])[^'"`]+\1/g,
                    /endpoint\s*:\s*(['"`])[^'"`]+\1/g
                ],
                extractValue: (match, content) => match[0].replace(/['"]/g, ''),
                isHardcoded: (context) => !context.includes('process.env') && !context.includes('config.'),
                getContext: (match, content, line) => this.getLineContext(content, line, 2)
            },
            // Database Configuration
            {
                type: ConfigurationType.DATABASE_CONFIG,
                patterns: [
                    /(['"`])mongodb:\/\/[^'"`]+\1/g,
                    /(['"`])postgres:\/\/[^'"`]+\1/g,
                    /(['"`])mysql:\/\/[^'"`]+\1/g,
                    /database\s*:\s*(['"`])[^'"`]+\1/g,
                    /host\s*:\s*(['"`])[^'"`]+\1/g,
                    /port\s*:\s*(['"`])?\d+\1?/g
                ],
                extractValue: (match, content) => match[0].replace(/['"]/g, ''),
                isHardcoded: (context) => !context.includes('process.env') && !context.includes('config.'),
                getContext: (match, content, line) => this.getLineContext(content, line, 3)
            },
            // Styling Constants
            {
                type: ConfigurationType.STYLING_CONSTANTS,
                patterns: [
                    /color\s*:\s*(['"`])[#\w]+\1/g,
                    /background\s*:\s*(['"`])[#\w]+\1/g,
                    /fontSize\s*:\s*(['"`])[\d\w]+\1/g,
                    /margin\s*:\s*(['"`])[\d\w\s]+\1/g,
                    /padding\s*:\s*(['"`])[\d\w\s]+\1/g
                ],
                extractValue: (match, content) => match[0].split(':')[1]?.trim().replace(/['"]/g, ''),
                isHardcoded: (context) => !context.includes('theme.') && !context.includes('styles.'),
                getContext: (match, content, line) => this.getLineContext(content, line, 1)
            },
            // Error Messages
            {
                type: ConfigurationType.ERROR_MESSAGES,
                patterns: [
                    /throw\s+new\s+Error\s*\(\s*(['"`])[^'"`]+\1\s*\)/g,
                    /error\s*:\s*(['"`])[^'"`]+\1/g,
                    /message\s*:\s*(['"`])[^'"`]+\1/g
                ],
                extractValue: (match, content) => {
                    const msgMatch = match[0].match(/(['"`])([^'"`]+)\1/);
                    return msgMatch ? msgMatch[2] : match[0];
                },
                isHardcoded: (context) => !context.includes('messages.') && !context.includes('i18n.'),
                getContext: (match, content, line) => this.getLineContext(content, line, 1)
            },
            // Feature Flags
            {
                type: ConfigurationType.FEATURE_FLAGS,
                patterns: [
                    /isEnabled\s*\(\s*(['"`])[^'"`]+\1\s*\)/g,
                    /featureFlag\s*:\s*(['"`])[^'"`]+\1/g,
                    /if\s*\(\s*(['"`])[^'"`]*[Ff]eature[^'"`]*\1/g
                ],
                extractValue: (match, content) => {
                    const flagMatch = match[0].match(/(['"`])([^'"`]+)\1/);
                    return flagMatch ? flagMatch[2] : match[0];
                },
                isHardcoded: (context) => true,
                getContext: (match, content, line) => this.getLineContext(content, line, 2)
            },
            // Validation Rules
            {
                type: ConfigurationType.VALIDATION_RULES,
                patterns: [
                    /minLength\s*:\s*\d+/g,
                    /maxLength\s*:\s*\d+/g,
                    /pattern\s*:\s*(['"`])[^'"`]+\1/g,
                    /required\s*:\s*(true|false)/g
                ],
                extractValue: (match, content) => match[0].split(':')[1]?.trim().replace(/['"]/g, ''),
                isHardcoded: (context) => !context.includes('validation.') && !context.includes('rules.'),
                getContext: (match, content, line) => this.getLineContext(content, line, 2)
            }
        ];
    }
    async getScanFiles(projectPath, excludePatterns) {
        const defaultPatterns = [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.json', '**/*.yaml', '**/*.yml'
        ];
        const defaultExcludes = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**',
            '**/*.min.js',
            '**/*.test.*',
            '**/*.spec.*'
        ];
        return await (0, fast_glob_1.glob)(defaultPatterns, {
            cwd: projectPath,
            ignore: [...defaultExcludes, ...(excludePatterns || [])],
            onlyFiles: true
        });
    }
    async scanFile(filePath, configTypes) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const locations = [];
        const relativePath = path.relative(process.cwd(), filePath);
        const patternsToUse = configTypes ?
            this.configPatterns.filter(p => configTypes.includes(p.type)) :
            this.configPatterns;
        for (const pattern of patternsToUse) {
            for (const regex of pattern.patterns) {
                const globalRegex = new RegExp(regex.source, 'g');
                let match;
                while ((match = globalRegex.exec(content)) !== null) {
                    const lineNumber = this.getLineNumber(content, match.index);
                    const lineContent = lines[lineNumber - 1];
                    if (lineContent && this.isValidMatch(lineContent, match[0])) {
                        const context = pattern.getContext(match, content, lineNumber);
                        const location = {
                            file: relativePath,
                            line: lineNumber,
                            column: match.index - content.lastIndexOf('\n', match.index - 1) - 1,
                            context,
                            value: pattern.extractValue(match, content),
                            usage: this.determineUsage(context),
                            isHardcoded: pattern.isHardcoded(context)
                        };
                        locations.push(location);
                    }
                }
            }
        }
        return locations;
    }
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    getLineContext(content, lineNumber, contextLines) {
        const lines = content.split('\n');
        const start = Math.max(0, lineNumber - contextLines - 1);
        const end = Math.min(lines.length, lineNumber + contextLines);
        return lines.slice(start, end).join('\n');
    }
    isValidMatch(line, match) {
        // Skip matches in comments
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
            return false;
        }
        // Skip very short matches that are likely false positives
        if (match.replace(/['"]/g, '').trim().length < 3) {
            return false;
        }
        return true;
    }
    determineUsage(context) {
        if (context.includes('=') && !context.includes('==')) {
            return ConfigUsage.DEFINITION;
        }
        else if (context.includes('validate') || context.includes('check')) {
            return ConfigUsage.VALIDATION;
        }
        else if (context.includes('set') || context.includes('update')) {
            return ConfigUsage.MODIFICATION;
        }
        else {
            return ConfigUsage.REFERENCE;
        }
    }
    identifyOpportunities(allConfigs, minOccurrences) {
        const opportunities = [];
        // Group by config type first
        const byType = new Map();
        for (const config of allConfigs) {
            // Determine config type from patterns
            const configType = this.inferConfigType(config);
            if (!byType.has(configType)) {
                byType.set(configType, []);
            }
            byType.get(configType).push(config);
        }
        // For each type, find similar values
        for (const [configType, configs] of byType) {
            const similarGroups = this.groupSimilarConfigs(configs);
            for (const group of similarGroups) {
                if (group.length >= minOccurrences) {
                    const opportunity = {
                        id: this.generateOpportunityId(configType, group),
                        configType,
                        scatteredLocations: group,
                        benefitScore: 0, // Will be calculated later
                        complexityScore: 0, // Will be calculated later
                        examples: []
                    };
                    opportunities.push(opportunity);
                }
            }
        }
        return opportunities;
    }
    inferConfigType(config) {
        // This is a simplified approach - in practice, you'd use the pattern that matched
        const value = config.value?.toString().toLowerCase() || '';
        const context = config.context.toLowerCase();
        if (value.includes('http') || value.includes('/api/')) {
            return ConfigurationType.API_ENDPOINTS;
        }
        else if (value.includes('mongodb://') || value.includes('postgres://') || context.includes('database')) {
            return ConfigurationType.DATABASE_CONFIG;
        }
        else if (context.includes('color') || context.includes('background') || context.includes('style')) {
            return ConfigurationType.STYLING_CONSTANTS;
        }
        else if (context.includes('error') || context.includes('message')) {
            return ConfigurationType.ERROR_MESSAGES;
        }
        else if (context.includes('feature') || context.includes('flag')) {
            return ConfigurationType.FEATURE_FLAGS;
        }
        else if (context.includes('valid') || context.includes('pattern') || context.includes('length')) {
            return ConfigurationType.VALIDATION_RULES;
        }
        else {
            return ConfigurationType.ENVIRONMENT_CONFIG;
        }
    }
    groupSimilarConfigs(configs) {
        const groups = [];
        const processed = new Set();
        for (const config of configs) {
            if (processed.has(config))
                continue;
            const similarGroup = [config];
            processed.add(config);
            for (const other of configs) {
                if (processed.has(other))
                    continue;
                if (this.areConfigsSimilar(config, other)) {
                    similarGroup.push(other);
                    processed.add(other);
                }
            }
            if (similarGroup.length > 1) {
                groups.push(similarGroup);
            }
        }
        return groups;
    }
    areConfigsSimilar(config1, config2) {
        // Check if values are similar (for exact matches or patterns)
        const value1 = config1.value?.toString() || '';
        const value2 = config2.value?.toString() || '';
        // Exact match
        if (value1 === value2)
            return true;
        // Similar patterns (e.g., different URLs with same base)
        if (this.hasSimilarPattern(value1, value2))
            return true;
        // Similar context (same variable names or similar code structure)
        if (this.hasSimilarContext(config1.context, config2.context))
            return true;
        return false;
    }
    hasSimilarPattern(value1, value2) {
        // Check for similar URL patterns
        if (value1.includes('://') && value2.includes('://')) {
            const domain1 = value1.split('/')[2];
            const domain2 = value2.split('/')[2];
            return domain1 === domain2;
        }
        // Check for similar numeric values (within 20%)
        const num1 = parseFloat(value1);
        const num2 = parseFloat(value2);
        if (!isNaN(num1) && !isNaN(num2)) {
            const diff = Math.abs(num1 - num2);
            const avg = (num1 + num2) / 2;
            return avg > 0 && (diff / avg) < 0.2;
        }
        // Check for similar string patterns
        const commonWords = this.getCommonWords(value1, value2);
        return commonWords.length > 0 && commonWords.length / Math.max(value1.split(' ').length, value2.split(' ').length) > 0.5;
    }
    hasSimilarContext(context1, context2) {
        // Extract variable names and function calls
        const vars1 = this.extractVariableNames(context1);
        const vars2 = this.extractVariableNames(context2);
        const commonVars = vars1.filter(v => vars2.includes(v));
        return commonVars.length > 0;
    }
    getCommonWords(str1, str2) {
        const words1 = str1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const words2 = str2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        return words1.filter(word => words2.includes(word));
    }
    extractVariableNames(context) {
        const matches = context.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
        return matches.filter(match => match.length > 2);
    }
    generateOpportunityId(configType, group) {
        const hash = (0, crypto_1.createHash)('md5')
            .update(`${configType}_${group.map(g => g.file + g.line).join('_')}`)
            .digest('hex')
            .substring(0, 8);
        return `${configType}_${hash}`;
    }
    calculateBenefitScore(opportunity) {
        let score = 0;
        // Base score from number of occurrences
        score += opportunity.scatteredLocations.length * 10;
        // Bonus for hardcoded values
        const hardcodedCount = opportunity.scatteredLocations.filter(loc => loc.isHardcoded).length;
        score += hardcodedCount * 15;
        // Bonus for cross-file duplication
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file));
        score += uniqueFiles.size * 5;
        // Type-specific scoring
        const typeMultipliers = {
            [ConfigurationType.API_ENDPOINTS]: 1.5,
            [ConfigurationType.DATABASE_CONFIG]: 1.4,
            [ConfigurationType.SECURITY_CONFIG]: 1.6,
            [ConfigurationType.ERROR_MESSAGES]: 1.2,
            [ConfigurationType.VALIDATION_RULES]: 1.3,
            [ConfigurationType.FEATURE_FLAGS]: 1.4,
            [ConfigurationType.STYLING_CONSTANTS]: 1.0,
            [ConfigurationType.BUSINESS_RULES]: 1.5,
            [ConfigurationType.ENVIRONMENT_CONFIG]: 1.3,
            [ConfigurationType.ROUTING_CONFIG]: 1.2,
            [ConfigurationType.LOGGING_CONFIG]: 1.1,
            [ConfigurationType.CACHE_CONFIG]: 1.2
        };
        score *= typeMultipliers[opportunity.configType] || 1.0;
        return Math.min(100, score);
    }
    calculateComplexityScore(opportunity) {
        let complexity = 0;
        // Base complexity from number of locations
        complexity += Math.min(50, opportunity.scatteredLocations.length * 2);
        // Complexity from number of unique files
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file));
        complexity += uniqueFiles.size * 3;
        // Complexity from usage types
        const usageTypes = new Set(opportunity.scatteredLocations.map(loc => loc.usage));
        if (usageTypes.has(ConfigUsage.MODIFICATION))
            complexity += 15;
        if (usageTypes.has(ConfigUsage.VALIDATION))
            complexity += 10;
        // Type-specific complexity
        const typeComplexity = {
            [ConfigurationType.API_ENDPOINTS]: 5,
            [ConfigurationType.DATABASE_CONFIG]: 15,
            [ConfigurationType.SECURITY_CONFIG]: 20,
            [ConfigurationType.ERROR_MESSAGES]: 3,
            [ConfigurationType.VALIDATION_RULES]: 10,
            [ConfigurationType.FEATURE_FLAGS]: 12,
            [ConfigurationType.STYLING_CONSTANTS]: 2,
            [ConfigurationType.BUSINESS_RULES]: 18,
            [ConfigurationType.ENVIRONMENT_CONFIG]: 8,
            [ConfigurationType.ROUTING_CONFIG]: 12,
            [ConfigurationType.LOGGING_CONFIG]: 5,
            [ConfigurationType.CACHE_CONFIG]: 10
        };
        complexity += typeComplexity[opportunity.configType] || 5;
        return Math.min(100, complexity);
    }
    async generateMigrationPlan(opportunity) {
        const approach = this.selectMigrationApproach(opportunity);
        const estimatedEffort = this.estimateMigrationEffort(opportunity);
        return {
            approach,
            estimatedEffort,
            steps: this.generateMigrationSteps(opportunity, approach),
            dependencies: this.identifyDependencies(opportunity),
            rollbackStrategy: this.createRollbackStrategy(opportunity, approach),
            testingStrategy: this.createTestingStrategy(opportunity)
        };
    }
    selectMigrationApproach(opportunity) {
        const configType = opportunity.configType;
        const locationCount = opportunity.scatteredLocations.length;
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
        // Decision logic based on config type and complexity
        switch (configType) {
            case ConfigurationType.API_ENDPOINTS:
            case ConfigurationType.DATABASE_CONFIG:
                return MigrationApproach.ENVIRONMENT_VARIABLES;
            case ConfigurationType.FEATURE_FLAGS:
                return MigrationApproach.FEATURE_TOGGLE_SYSTEM;
            case ConfigurationType.STYLING_CONSTANTS:
                return MigrationApproach.CENTRALIZED_CONSTANTS;
            case ConfigurationType.BUSINESS_RULES:
            case ConfigurationType.VALIDATION_RULES:
                return uniqueFiles > 3 ?
                    MigrationApproach.CONFIGURATION_CLASS :
                    MigrationApproach.CENTRALIZED_CONSTANTS;
            default:
                return locationCount > 5 ?
                    MigrationApproach.EXTRACT_TO_CONFIG_FILE :
                    MigrationApproach.CENTRALIZED_CONSTANTS;
        }
    }
    estimateMigrationEffort(opportunity) {
        const complexity = opportunity.complexityScore;
        const locationCount = opportunity.scatteredLocations.length;
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
        let effortScore = 0;
        effortScore += locationCount * 0.5;
        effortScore += uniqueFiles * 2;
        effortScore += complexity * 0.3;
        if (effortScore < 5)
            return EffortLevel.LOW;
        if (effortScore < 15)
            return EffortLevel.MEDIUM;
        if (effortScore < 30)
            return EffortLevel.HIGH;
        return EffortLevel.VERY_HIGH;
    }
    generateMigrationSteps(opportunity, approach) {
        const steps = [
            {
                order: 1,
                description: 'Create comprehensive test coverage for affected components',
                type: 'preparation',
                estimatedTime: '2-4 hours'
            },
            {
                order: 2,
                description: 'Document current configuration usage patterns',
                type: 'preparation',
                estimatedTime: '1-2 hours'
            }
        ];
        // Add approach-specific steps
        switch (approach) {
            case MigrationApproach.EXTRACT_TO_CONFIG_FILE:
                steps.push({
                    order: 3,
                    description: 'Create centralized configuration file',
                    type: 'extraction',
                    estimatedTime: '1-3 hours'
                }, {
                    order: 4,
                    description: 'Replace hardcoded values with config references',
                    type: 'refactoring',
                    estimatedTime: `${opportunity.scatteredLocations.length * 0.5}-${opportunity.scatteredLocations.length * 1} hours`
                });
                break;
            case MigrationApproach.ENVIRONMENT_VARIABLES:
                steps.push({
                    order: 3,
                    description: 'Define environment variables and defaults',
                    type: 'extraction',
                    estimatedTime: '1-2 hours'
                }, {
                    order: 4,
                    description: 'Replace hardcoded values with env var references',
                    type: 'refactoring',
                    estimatedTime: `${opportunity.scatteredLocations.length * 0.3}-${opportunity.scatteredLocations.length * 0.8} hours`
                });
                break;
            case MigrationApproach.CONFIGURATION_CLASS:
                steps.push({
                    order: 3,
                    description: 'Design and implement configuration class',
                    type: 'extraction',
                    estimatedTime: '2-4 hours'
                }, {
                    order: 4,
                    description: 'Refactor components to use configuration class',
                    type: 'refactoring',
                    estimatedTime: `${opportunity.scatteredLocations.length * 0.8}-${opportunity.scatteredLocations.length * 1.5} hours`
                });
                break;
        }
        steps.push({
            order: steps.length + 1,
            description: 'Run comprehensive test suite',
            type: 'testing',
            estimatedTime: '1-2 hours'
        }, {
            order: steps.length + 2,
            description: 'Deploy and monitor for issues',
            type: 'deployment',
            estimatedTime: '1-3 hours'
        });
        return steps;
    }
    identifyDependencies(opportunity) {
        const dependencies = [];
        const uniqueFiles = [...new Set(opportunity.scatteredLocations.map(loc => loc.file))];
        // Add file dependencies
        dependencies.push(...uniqueFiles);
        // Add type-specific dependencies
        switch (opportunity.configType) {
            case ConfigurationType.DATABASE_CONFIG:
                dependencies.push('database connection library', 'ORM configuration');
                break;
            case ConfigurationType.API_ENDPOINTS:
                dependencies.push('HTTP client configuration', 'API client libraries');
                break;
            case ConfigurationType.FEATURE_FLAGS:
                dependencies.push('feature flag library', 'runtime configuration system');
                break;
        }
        return dependencies;
    }
    createRollbackStrategy(opportunity, approach) {
        switch (approach) {
            case MigrationApproach.EXTRACT_TO_CONFIG_FILE:
                return 'Keep backup of original files. If issues arise, revert file changes and remove config file.';
            case MigrationApproach.ENVIRONMENT_VARIABLES:
                return 'Maintain hardcoded values as fallbacks. Gradual rollback by removing env var references.';
            case MigrationApproach.CONFIGURATION_CLASS:
                return 'Create configuration class with backward compatibility. Rollback by reverting to direct value access.';
            default:
                return 'Version control rollback to previous commit. Ensure all changes are in single commit for easy reversion.';
        }
    }
    createTestingStrategy(opportunity) {
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
        return `
1. Unit tests for all ${uniqueFiles} affected files
2. Integration tests for configuration loading and access
3. End-to-end tests for critical user workflows
4. Performance tests to ensure no degradation
5. Configuration validation tests for all environments
    `.trim();
    }
    assessRisk(opportunity) {
        const risks = [];
        const mitigations = [];
        // Breaking changes risk
        const breakingChangeRisk = {
            category: 'breaking_changes',
            description: 'Configuration changes may break existing functionality',
            probability: opportunity.complexityScore / 100,
            impact: opportunity.scatteredLocations.length / 20,
            severity: this.calculateRiskSeverity(opportunity.complexityScore / 100, opportunity.scatteredLocations.length / 20)
        };
        risks.push(breakingChangeRisk);
        mitigations.push({
            risk: 'breaking_changes',
            strategy: 'Comprehensive testing and gradual rollout with feature flags',
            effort: EffortLevel.MEDIUM
        });
        // Performance risk
        if (opportunity.configType === ConfigurationType.API_ENDPOINTS ||
            opportunity.configType === ConfigurationType.DATABASE_CONFIG) {
            risks.push({
                category: 'performance',
                description: 'Configuration loading may introduce performance overhead',
                probability: 0.3,
                impact: 0.4,
                severity: RiskLevel.LOW
            });
            mitigations.push({
                risk: 'performance',
                strategy: 'Cache configuration values and implement lazy loading',
                effort: EffortLevel.LOW
            });
        }
        // Security risk
        if (opportunity.configType === ConfigurationType.SECURITY_CONFIG ||
            opportunity.configType === ConfigurationType.DATABASE_CONFIG) {
            risks.push({
                category: 'security',
                description: 'Centralized configuration may create security vulnerabilities',
                probability: 0.2,
                impact: 0.8,
                severity: RiskLevel.HIGH
            });
            mitigations.push({
                risk: 'security',
                strategy: 'Implement proper access controls and encryption for sensitive configs',
                effort: EffortLevel.HIGH
            });
        }
        const overallRisk = this.calculateOverallRisk(risks);
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file));
        return {
            overallRisk,
            risks,
            mitigations,
            impact: {
                affectedFiles: uniqueFiles.size,
                affectedComponents: Array.from(uniqueFiles),
                businessImpact: this.getBusinessImpact(opportunity),
                technicalImpact: this.getTechnicalImpact(opportunity)
            }
        };
    }
    calculateRiskSeverity(probability, impact) {
        const riskScore = probability * impact;
        if (riskScore < 0.2)
            return RiskLevel.LOW;
        if (riskScore < 0.4)
            return RiskLevel.MEDIUM;
        if (riskScore < 0.7)
            return RiskLevel.HIGH;
        return RiskLevel.CRITICAL;
    }
    calculateOverallRisk(risks) {
        if (risks.some(r => r.severity === RiskLevel.CRITICAL))
            return RiskLevel.CRITICAL;
        if (risks.some(r => r.severity === RiskLevel.HIGH))
            return RiskLevel.HIGH;
        if (risks.some(r => r.severity === RiskLevel.MEDIUM))
            return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }
    getBusinessImpact(opportunity) {
        switch (opportunity.configType) {
            case ConfigurationType.API_ENDPOINTS:
                return 'Improved reliability and easier environment management';
            case ConfigurationType.ERROR_MESSAGES:
                return 'Better user experience and easier localization';
            case ConfigurationType.FEATURE_FLAGS:
                return 'Faster feature deployment and A/B testing capabilities';
            case ConfigurationType.VALIDATION_RULES:
                return 'Consistent data validation and reduced errors';
            default:
                return 'Reduced maintenance overhead and improved consistency';
        }
    }
    getTechnicalImpact(opportunity) {
        const locationCount = opportunity.scatteredLocations.length;
        const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
        return `Consolidation of ${locationCount} scattered configurations across ${uniqueFiles} files. ` +
            `Estimated ${Math.round(locationCount * 2)} lines of code will be modified.`;
    }
    generateExamples(opportunity) {
        const examples = [];
        const maxExamples = Math.min(3, opportunity.scatteredLocations.length);
        for (let i = 0; i < maxExamples; i++) {
            const location = opportunity.scatteredLocations[i];
            const example = this.createExample(location, opportunity);
            examples.push(example);
        }
        return examples;
    }
    createExample(location, opportunity) {
        const beforeLines = location.context.split('\n');
        const targetLine = beforeLines.find(line => line.includes(location.value?.toString() || ''));
        const beforeCode = targetLine || `// ${location.file}:${location.line}\n${location.context.split('\n')[0]}`;
        const afterCode = this.generateAfterCode(location, opportunity);
        const explanation = this.generateExplanation(location, opportunity);
        return {
            location,
            beforeCode,
            afterCode,
            explanation
        };
    }
    generateAfterCode(location, opportunity) {
        const configKey = this.generateConfigKey(location, opportunity);
        switch (opportunity.configType) {
            case ConfigurationType.API_ENDPOINTS:
                return `const endpoint = config.get('${configKey}');`;
            case ConfigurationType.ERROR_MESSAGES:
                return `const message = messages.get('${configKey}');`;
            case ConfigurationType.FEATURE_FLAGS:
                return `if (featureFlags.isEnabled('${configKey}')) {`;
            case ConfigurationType.STYLING_CONSTANTS:
                return `const color = theme.colors.${configKey};`;
            default:
                return `const value = config.${configKey};`;
        }
    }
    generateConfigKey(location, opportunity) {
        const value = location.value?.toString() || '';
        const context = location.context.toLowerCase();
        // Generate meaningful key based on context and value
        if (context.includes('error') || context.includes('message')) {
            return this.camelCase(`error_${this.extractKeyFromValue(value)}`);
        }
        else if (context.includes('api') || context.includes('endpoint')) {
            return this.camelCase(`api_${this.extractKeyFromValue(value)}`);
        }
        else if (context.includes('color') || context.includes('style')) {
            return this.camelCase(`style_${this.extractKeyFromValue(value)}`);
        }
        else {
            return this.camelCase(this.extractKeyFromValue(value));
        }
    }
    extractKeyFromValue(value) {
        // Extract meaningful words from the value
        const words = value.replace(/[^a-zA-Z0-9]/g, ' ')
            .split(' ')
            .filter(word => word.length > 2)
            .slice(0, 3);
        return words.join('_').toLowerCase() || 'config_value';
    }
    camelCase(str) {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    generateExplanation(location, opportunity) {
        const approach = this.selectMigrationApproach(opportunity);
        switch (approach) {
            case MigrationApproach.EXTRACT_TO_CONFIG_FILE:
                return 'Move hardcoded value to centralized configuration file for easier management across environments.';
            case MigrationApproach.ENVIRONMENT_VARIABLES:
                return 'Replace hardcoded value with environment variable for secure and flexible configuration.';
            case MigrationApproach.CENTRALIZED_CONSTANTS:
                return 'Extract to shared constants file to eliminate duplication and ensure consistency.';
            case MigrationApproach.CONFIGURATION_CLASS:
                return 'Move to configuration class with proper typing and validation.';
            default:
                return 'Centralize configuration to improve maintainability and reduce duplication.';
        }
    }
    suggestConsolidationTarget(opportunity) {
        const approach = this.selectMigrationApproach(opportunity);
        switch (approach) {
            case MigrationApproach.EXTRACT_TO_CONFIG_FILE:
                return {
                    type: 'new_file',
                    path: `config/${opportunity.configType.replace('_', '-')}.json`,
                    format: 'json',
                    structure: this.generateConfigStructure(opportunity)
                };
            case MigrationApproach.ENVIRONMENT_VARIABLES:
                return {
                    type: 'environment',
                    format: 'env',
                    structure: this.generateEnvStructure(opportunity)
                };
            case MigrationApproach.CENTRALIZED_CONSTANTS:
                return {
                    type: 'new_file',
                    path: `constants/${opportunity.configType.replace('_', '-')}.ts`,
                    format: 'typescript',
                    structure: this.generateConstantsStructure(opportunity)
                };
            case MigrationApproach.CONFIGURATION_CLASS:
                return {
                    type: 'new_file',
                    path: `config/${opportunity.configType.replace('_', '-')}-config.ts`,
                    format: 'typescript',
                    structure: this.generateClassStructure(opportunity)
                };
            default:
                return {
                    type: 'new_file',
                    path: `config/shared.json`,
                    format: 'json',
                    structure: {}
                };
        }
    }
    generateConfigStructure(opportunity) {
        const structure = {};
        opportunity.scatteredLocations.forEach((location, index) => {
            const key = this.generateConfigKey(location, opportunity);
            structure[key] = location.value;
        });
        return structure;
    }
    generateEnvStructure(opportunity) {
        const structure = {};
        opportunity.scatteredLocations.forEach((location, index) => {
            const key = this.generateConfigKey(location, opportunity).toUpperCase();
            structure[key] = location.value;
        });
        return structure;
    }
    generateConstantsStructure(opportunity) {
        const constants = [];
        opportunity.scatteredLocations.forEach((location, index) => {
            const key = this.generateConfigKey(location, opportunity).toUpperCase();
            const value = typeof location.value === 'string' ?
                `'${location.value}'` :
                JSON.stringify(location.value);
            constants.push(`export const ${key} = ${value};`);
        });
        return constants.join('\n');
    }
    generateClassStructure(opportunity) {
        const className = this.camelCase(opportunity.configType.replace('_', ' ')) + 'Config';
        const properties = [];
        opportunity.scatteredLocations.forEach((location, index) => {
            const key = this.generateConfigKey(location, opportunity);
            const type = typeof location.value === 'number' ? 'number' : 'string';
            const value = typeof location.value === 'string' ?
                `'${location.value}'` :
                JSON.stringify(location.value);
            properties.push(`  ${key}: ${type} = ${value};`);
        });
        return `export class ${className} {\n${properties.join('\n')}\n}`;
    }
    calculateStatistics(opportunities) {
        const byConfigType = {};
        let totalDuplicatedLines = 0;
        let totalMaintenanceHours = 0;
        const priorityDistribution = {
            [Priority.LOW]: 0,
            [Priority.MEDIUM]: 0,
            [Priority.HIGH]: 0,
            [Priority.CRITICAL]: 0
        };
        // Initialize config type counters
        Object.values(ConfigurationType).forEach(type => {
            byConfigType[type] = 0;
        });
        opportunities.forEach(opportunity => {
            byConfigType[opportunity.configType]++;
            // Calculate duplicated lines
            totalDuplicatedLines += opportunity.scatteredLocations.length;
            // Estimate maintenance hours saved
            const estimatedHours = Math.ceil(opportunity.scatteredLocations.length * 0.5);
            totalMaintenanceHours += estimatedHours;
            // Categorize priority
            const priority = this.calculatePriority(opportunity);
            priorityDistribution[priority]++;
        });
        return {
            totalOpportunities: opportunities.length,
            byConfigType,
            estimatedSavings: {
                maintenanceHours: totalMaintenanceHours,
                duplicatedLines: totalDuplicatedLines,
                consistencyImprovements: opportunities.length
            },
            priorityDistribution
        };
    }
    calculatePriority(opportunity) {
        const benefitScore = opportunity.benefitScore;
        const complexityScore = opportunity.complexityScore;
        const ratio = benefitScore / Math.max(complexityScore, 1);
        if (ratio > 2 && benefitScore > 60)
            return Priority.CRITICAL;
        if (ratio > 1.5 && benefitScore > 40)
            return Priority.HIGH;
        if (ratio > 1 && benefitScore > 20)
            return Priority.MEDIUM;
        return Priority.LOW;
    }
    generateGlobalRecommendations(opportunities) {
        const recommendations = [];
        // Configuration management recommendation
        if (opportunities.length > 5) {
            recommendations.push({
                type: 'architectural',
                title: 'Implement Configuration Management System',
                description: 'Consider implementing a comprehensive configuration management system to handle all application settings.',
                benefits: [
                    'Centralized configuration management',
                    'Environment-specific configurations',
                    'Runtime configuration updates',
                    'Configuration validation and type safety'
                ],
                effort: EffortLevel.HIGH
            });
        }
        // Environment variable usage
        const envConfigCount = opportunities.filter(o => o.configType === ConfigurationType.API_ENDPOINTS ||
            o.configType === ConfigurationType.DATABASE_CONFIG ||
            o.configType === ConfigurationType.SECURITY_CONFIG).length;
        if (envConfigCount > 2) {
            recommendations.push({
                type: 'process',
                title: 'Adopt Environment Variable Best Practices',
                description: 'Standardize on environment variables for configuration management across all environments.',
                benefits: [
                    'Secure configuration management',
                    'Easy deployment across environments',
                    'Follows 12-factor app principles',
                    'Reduced configuration drift'
                ],
                effort: EffortLevel.MEDIUM
            });
        }
        // Feature flag system
        const featureFlagCount = opportunities.filter(o => o.configType === ConfigurationType.FEATURE_FLAGS).length;
        if (featureFlagCount > 1) {
            recommendations.push({
                type: 'tooling',
                title: 'Implement Feature Flag System',
                description: 'Deploy a feature flag management system for dynamic feature control.',
                benefits: [
                    'Dynamic feature toggling',
                    'A/B testing capabilities',
                    'Gradual feature rollouts',
                    'Quick feature rollback'
                ],
                effort: EffortLevel.HIGH
            });
        }
        return recommendations;
    }
}
exports.CentralizationDetector = CentralizationDetector;
exports.default = CentralizationDetector;
//# sourceMappingURL=detector.js.map