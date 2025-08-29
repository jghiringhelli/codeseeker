import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { ASTAnalyzer } from '../../shared/ast/analyzer';
import { Logger } from '../../utils/logger';
import { createHash } from 'crypto';

export interface CentralizationScanRequest {
  projectPath: string;
  configTypes?: ConfigurationType[];
  includeMigrationPlan?: boolean;
  includeRiskAssessment?: boolean;
  minOccurrences?: number;
  excludePatterns?: string[];
}

export interface CentralizationResult {
  opportunities: CentralizationOpportunity[];
  scanInfo: CentralizationScanInfo;
  statistics: CentralizationStatistics;
  recommendations: GlobalRecommendation[];
}

export interface CentralizationOpportunity {
  id: string;
  configType: ConfigurationType;
  scatteredLocations: ConfigLocation[];
  benefitScore: number;
  complexityScore: number;
  consolidationTarget?: ConsolidationTarget;
  migrationPlan?: MigrationPlan;
  riskAssessment?: RiskAssessment;
  examples: ConfigExample[];
}

export interface ConfigLocation {
  file: string;
  line: number;
  column?: number;
  context: string;
  value: any;
  usage: ConfigUsage;
  isHardcoded: boolean;
}

export interface ConsolidationTarget {
  type: 'new_file' | 'existing_file' | 'environment' | 'database';
  path?: string;
  format: 'json' | 'yaml' | 'typescript' | 'javascript' | 'env';
  structure: any;
}

export interface MigrationPlan {
  approach: MigrationApproach;
  estimatedEffort: EffortLevel;
  steps: MigrationStep[];
  dependencies: string[];
  rollbackStrategy: string;
  testingStrategy: string;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  risks: Risk[];
  mitigations: Mitigation[];
  impact: ImpactAnalysis;
}

export interface ConfigExample {
  location: ConfigLocation;
  beforeCode: string;
  afterCode: string;
  explanation: string;
}

export interface CentralizationScanInfo {
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  configItemsFound: number;
  processingTime: number;
  timestamp: Date;
}

export interface CentralizationStatistics {
  totalOpportunities: number;
  byConfigType: Record<ConfigurationType, number>;
  estimatedSavings: {
    maintenanceHours: number;
    duplicatedLines: number;
    consistencyImprovements: number;
  };
  priorityDistribution: Record<Priority, number>;
}

export interface GlobalRecommendation {
  type: 'architectural' | 'tooling' | 'process';
  title: string;
  description: string;
  benefits: string[];
  effort: EffortLevel;
}

export enum ConfigurationType {
  API_ENDPOINTS = 'api_endpoints',
  DATABASE_CONFIG = 'database_config',
  STYLING_CONSTANTS = 'styling_constants',
  BUSINESS_RULES = 'business_rules',
  VALIDATION_RULES = 'validation_rules',
  ERROR_MESSAGES = 'error_messages',
  FEATURE_FLAGS = 'feature_flags',
  ENVIRONMENT_CONFIG = 'environment_config',
  ROUTING_CONFIG = 'routing_config',
  SECURITY_CONFIG = 'security_config',
  LOGGING_CONFIG = 'logging_config',
  CACHE_CONFIG = 'cache_config'
}

export enum ConfigUsage {
  DEFINITION = 'definition',
  REFERENCE = 'reference',
  MODIFICATION = 'modification',
  VALIDATION = 'validation'
}

export enum MigrationApproach {
  EXTRACT_TO_CONFIG_FILE = 'extract_to_config_file',
  ENVIRONMENT_VARIABLES = 'environment_variables',
  CENTRALIZED_CONSTANTS = 'centralized_constants',
  CONFIGURATION_CLASS = 'configuration_class',
  DEPENDENCY_INJECTION = 'dependency_injection',
  FEATURE_TOGGLE_SYSTEM = 'feature_toggle_system'
}

export enum EffortLevel {
  LOW = 'low',        // < 4 hours
  MEDIUM = 'medium',  // 4-16 hours
  HIGH = 'high',      // 16-40 hours
  VERY_HIGH = 'very_high' // > 40 hours
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface Risk {
  category: 'breaking_changes' | 'performance' | 'security' | 'complexity';
  description: string;
  probability: number; // 0-1
  impact: number; // 0-1
  severity: RiskLevel;
}

interface Mitigation {
  risk: string;
  strategy: string;
  effort: EffortLevel;
}

interface ImpactAnalysis {
  affectedFiles: number;
  affectedComponents: string[];
  businessImpact: string;
  technicalImpact: string;
}

interface MigrationStep {
  order: number;
  description: string;
  type: 'preparation' | 'extraction' | 'refactoring' | 'testing' | 'deployment';
  estimatedTime: string;
  dependencies?: string[];
}

interface ConfigPattern {
  type: ConfigurationType;
  patterns: RegExp[];
  extractValue: (match: RegExpMatchArray, content: string) => any;
  isHardcoded: (context: string) => boolean;
  getContext: (match: RegExpMatchArray, content: string, line: number) => string;
}

export class CentralizationDetector {
  private logger = Logger.getInstance();
  private astAnalyzer = new ASTAnalyzer();
  private configPatterns: ConfigPattern[];

  constructor() {
    this.configPatterns = this.initializeConfigPatterns();
  }

  async scanProject(request: CentralizationScanRequest): Promise<CentralizationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting centralization scan for ${request.projectPath}`);

    const scanInfo: CentralizationScanInfo = {
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
      const allConfigItems: ConfigLocation[] = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(request.projectPath, file);
          const configItems = await this.scanFile(filePath, request.configTypes);
          allConfigItems.push(...configItems);
          scanInfo.analyzedFiles++;
        } catch (error) {
          this.logger.warn(`Failed to scan file ${file}`, error);
          scanInfo.skippedFiles++;
        }
      }

      scanInfo.configItemsFound = allConfigItems.length;

      // Group similar configurations into opportunities
      const opportunities = this.identifyOpportunities(
        allConfigItems,
        request.minOccurrences || 2
      );

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

    } catch (error) {
      this.logger.error('Centralization scan failed', error);
      throw error;
    }
  }

  private initializeConfigPatterns(): ConfigPattern[] {
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

  private async getScanFiles(projectPath: string, excludePatterns?: string[]): Promise<string[]> {
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

    return await glob(defaultPatterns, {
      cwd: projectPath,
      ignore: [...defaultExcludes, ...(excludePatterns || [])],
      onlyFiles: true
    });
  }

  private async scanFile(filePath: string, configTypes?: ConfigurationType[]): Promise<ConfigLocation[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const locations: ConfigLocation[] = [];
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
            
            const location: ConfigLocation = {
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

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getLineContext(content: string, lineNumber: number, contextLines: number): string {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end).join('\n');
  }

  private isValidMatch(line: string, match: string): boolean {
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

  private determineUsage(context: string): ConfigUsage {
    if (context.includes('=') && !context.includes('==')) {
      return ConfigUsage.DEFINITION;
    } else if (context.includes('validate') || context.includes('check')) {
      return ConfigUsage.VALIDATION;
    } else if (context.includes('set') || context.includes('update')) {
      return ConfigUsage.MODIFICATION;
    } else {
      return ConfigUsage.REFERENCE;
    }
  }

  private identifyOpportunities(
    allConfigs: ConfigLocation[],
    minOccurrences: number
  ): CentralizationOpportunity[] {
    const opportunities: CentralizationOpportunity[] = [];

    // Group by config type first
    const byType = new Map<ConfigurationType, ConfigLocation[]>();
    
    for (const config of allConfigs) {
      // Determine config type from patterns
      const configType = this.inferConfigType(config);
      if (!byType.has(configType)) {
        byType.set(configType, []);
      }
      byType.get(configType)!.push(config);
    }

    // For each type, find similar values
    for (const [configType, configs] of byType) {
      const similarGroups = this.groupSimilarConfigs(configs);
      
      for (const group of similarGroups) {
        if (group.length >= minOccurrences) {
          const opportunity: CentralizationOpportunity = {
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

  private inferConfigType(config: ConfigLocation): ConfigurationType {
    // This is a simplified approach - in practice, you'd use the pattern that matched
    const value = config.value?.toString().toLowerCase() || '';
    const context = config.context.toLowerCase();

    if (value.includes('http') || value.includes('/api/')) {
      return ConfigurationType.API_ENDPOINTS;
    } else if (value.includes('mongodb://') || value.includes('postgres://') || context.includes('database')) {
      return ConfigurationType.DATABASE_CONFIG;
    } else if (context.includes('color') || context.includes('background') || context.includes('style')) {
      return ConfigurationType.STYLING_CONSTANTS;
    } else if (context.includes('error') || context.includes('message')) {
      return ConfigurationType.ERROR_MESSAGES;
    } else if (context.includes('feature') || context.includes('flag')) {
      return ConfigurationType.FEATURE_FLAGS;
    } else if (context.includes('valid') || context.includes('pattern') || context.includes('length')) {
      return ConfigurationType.VALIDATION_RULES;
    } else {
      return ConfigurationType.ENVIRONMENT_CONFIG;
    }
  }

  private groupSimilarConfigs(configs: ConfigLocation[]): ConfigLocation[][] {
    const groups: ConfigLocation[][] = [];
    const processed = new Set<ConfigLocation>();

    for (const config of configs) {
      if (processed.has(config)) continue;

      const similarGroup = [config];
      processed.add(config);

      for (const other of configs) {
        if (processed.has(other)) continue;

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

  private areConfigsSimilar(config1: ConfigLocation, config2: ConfigLocation): boolean {
    // Check if values are similar (for exact matches or patterns)
    const value1 = config1.value?.toString() || '';
    const value2 = config2.value?.toString() || '';

    // Exact match
    if (value1 === value2) return true;

    // Similar patterns (e.g., different URLs with same base)
    if (this.hasSimilarPattern(value1, value2)) return true;

    // Similar context (same variable names or similar code structure)
    if (this.hasSimilarContext(config1.context, config2.context)) return true;

    return false;
  }

  private hasSimilarPattern(value1: string, value2: string): boolean {
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

  private hasSimilarContext(context1: string, context2: string): boolean {
    // Extract variable names and function calls
    const vars1 = this.extractVariableNames(context1);
    const vars2 = this.extractVariableNames(context2);
    
    const commonVars = vars1.filter(v => vars2.includes(v));
    return commonVars.length > 0;
  }

  private getCommonWords(str1: string, str2: string): string[] {
    const words1 = str1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    return words1.filter(word => words2.includes(word));
  }

  private extractVariableNames(context: string): string[] {
    const matches = context.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    return matches.filter(match => match.length > 2);
  }

  private generateOpportunityId(configType: ConfigurationType, group: ConfigLocation[]): string {
    const hash = createHash('md5')
      .update(`${configType}_${group.map(g => g.file + g.line).join('_')}`)
      .digest('hex')
      .substring(0, 8);
    
    return `${configType}_${hash}`;
  }

  private calculateBenefitScore(opportunity: CentralizationOpportunity): number {
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

  private calculateComplexityScore(opportunity: CentralizationOpportunity): number {
    let complexity = 0;

    // Base complexity from number of locations
    complexity += Math.min(50, opportunity.scatteredLocations.length * 2);

    // Complexity from number of unique files
    const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file));
    complexity += uniqueFiles.size * 3;

    // Complexity from usage types
    const usageTypes = new Set(opportunity.scatteredLocations.map(loc => loc.usage));
    if (usageTypes.has(ConfigUsage.MODIFICATION)) complexity += 15;
    if (usageTypes.has(ConfigUsage.VALIDATION)) complexity += 10;

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

  private async generateMigrationPlan(opportunity: CentralizationOpportunity): Promise<MigrationPlan> {
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

  private selectMigrationApproach(opportunity: CentralizationOpportunity): MigrationApproach {
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

  private estimateMigrationEffort(opportunity: CentralizationOpportunity): EffortLevel {
    const complexity = opportunity.complexityScore;
    const locationCount = opportunity.scatteredLocations.length;
    const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;

    let effortScore = 0;
    effortScore += locationCount * 0.5;
    effortScore += uniqueFiles * 2;
    effortScore += complexity * 0.3;

    if (effortScore < 5) return EffortLevel.LOW;
    if (effortScore < 15) return EffortLevel.MEDIUM;
    if (effortScore < 30) return EffortLevel.HIGH;
    return EffortLevel.VERY_HIGH;
  }

  private generateMigrationSteps(
    opportunity: CentralizationOpportunity, 
    approach: MigrationApproach
  ): MigrationStep[] {
    const steps: MigrationStep[] = [
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
        steps.push(
          {
            order: 3,
            description: 'Create centralized configuration file',
            type: 'extraction',
            estimatedTime: '1-3 hours'
          },
          {
            order: 4,
            description: 'Replace hardcoded values with config references',
            type: 'refactoring',
            estimatedTime: `${opportunity.scatteredLocations.length * 0.5}-${opportunity.scatteredLocations.length * 1} hours`
          }
        );
        break;

      case MigrationApproach.ENVIRONMENT_VARIABLES:
        steps.push(
          {
            order: 3,
            description: 'Define environment variables and defaults',
            type: 'extraction',
            estimatedTime: '1-2 hours'
          },
          {
            order: 4,
            description: 'Replace hardcoded values with env var references',
            type: 'refactoring',
            estimatedTime: `${opportunity.scatteredLocations.length * 0.3}-${opportunity.scatteredLocations.length * 0.8} hours`
          }
        );
        break;

      case MigrationApproach.CONFIGURATION_CLASS:
        steps.push(
          {
            order: 3,
            description: 'Design and implement configuration class',
            type: 'extraction',
            estimatedTime: '2-4 hours'
          },
          {
            order: 4,
            description: 'Refactor components to use configuration class',
            type: 'refactoring',
            estimatedTime: `${opportunity.scatteredLocations.length * 0.8}-${opportunity.scatteredLocations.length * 1.5} hours`
          }
        );
        break;
    }

    steps.push(
      {
        order: steps.length + 1,
        description: 'Run comprehensive test suite',
        type: 'testing',
        estimatedTime: '1-2 hours'
      },
      {
        order: steps.length + 2,
        description: 'Deploy and monitor for issues',
        type: 'deployment',
        estimatedTime: '1-3 hours'
      }
    );

    return steps;
  }

  private identifyDependencies(opportunity: CentralizationOpportunity): string[] {
    const dependencies: string[] = [];
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

  private createRollbackStrategy(
    opportunity: CentralizationOpportunity, 
    approach: MigrationApproach
  ): string {
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

  private createTestingStrategy(opportunity: CentralizationOpportunity): string {
    const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
    
    return `
1. Unit tests for all ${uniqueFiles} affected files
2. Integration tests for configuration loading and access
3. End-to-end tests for critical user workflows
4. Performance tests to ensure no degradation
5. Configuration validation tests for all environments
    `.trim();
  }

  private assessRisk(opportunity: CentralizationOpportunity): RiskAssessment {
    const risks: Risk[] = [];
    const mitigations: Mitigation[] = [];

    // Breaking changes risk
    const breakingChangeRisk: Risk = {
      category: 'breaking_changes',
      description: 'Configuration changes may break existing functionality',
      probability: opportunity.complexityScore / 100,
      impact: opportunity.scatteredLocations.length / 20,
      severity: this.calculateRiskSeverity(
        opportunity.complexityScore / 100, 
        opportunity.scatteredLocations.length / 20
      )
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

  private calculateRiskSeverity(probability: number, impact: number): RiskLevel {
    const riskScore = probability * impact;
    
    if (riskScore < 0.2) return RiskLevel.LOW;
    if (riskScore < 0.4) return RiskLevel.MEDIUM;
    if (riskScore < 0.7) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private calculateOverallRisk(risks: Risk[]): RiskLevel {
    if (risks.some(r => r.severity === RiskLevel.CRITICAL)) return RiskLevel.CRITICAL;
    if (risks.some(r => r.severity === RiskLevel.HIGH)) return RiskLevel.HIGH;
    if (risks.some(r => r.severity === RiskLevel.MEDIUM)) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private getBusinessImpact(opportunity: CentralizationOpportunity): string {
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

  private getTechnicalImpact(opportunity: CentralizationOpportunity): string {
    const locationCount = opportunity.scatteredLocations.length;
    const uniqueFiles = new Set(opportunity.scatteredLocations.map(loc => loc.file)).size;
    
    return `Consolidation of ${locationCount} scattered configurations across ${uniqueFiles} files. ` +
           `Estimated ${Math.round(locationCount * 2)} lines of code will be modified.`;
  }

  private generateExamples(opportunity: CentralizationOpportunity): ConfigExample[] {
    const examples: ConfigExample[] = [];
    const maxExamples = Math.min(3, opportunity.scatteredLocations.length);
    
    for (let i = 0; i < maxExamples; i++) {
      const location = opportunity.scatteredLocations[i];
      const example = this.createExample(location, opportunity);
      examples.push(example);
    }
    
    return examples;
  }

  private createExample(location: ConfigLocation, opportunity: CentralizationOpportunity): ConfigExample {
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

  private generateAfterCode(location: ConfigLocation, opportunity: CentralizationOpportunity): string {
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

  private generateConfigKey(location: ConfigLocation, opportunity: CentralizationOpportunity): string {
    const value = location.value?.toString() || '';
    const context = location.context.toLowerCase();
    
    // Generate meaningful key based on context and value
    if (context.includes('error') || context.includes('message')) {
      return this.camelCase(`error_${this.extractKeyFromValue(value)}`);
    } else if (context.includes('api') || context.includes('endpoint')) {
      return this.camelCase(`api_${this.extractKeyFromValue(value)}`);
    } else if (context.includes('color') || context.includes('style')) {
      return this.camelCase(`style_${this.extractKeyFromValue(value)}`);
    } else {
      return this.camelCase(this.extractKeyFromValue(value));
    }
  }

  private extractKeyFromValue(value: string): string {
    // Extract meaningful words from the value
    const words = value.replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    return words.join('_').toLowerCase() || 'config_value';
  }

  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private generateExplanation(location: ConfigLocation, opportunity: CentralizationOpportunity): string {
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

  private suggestConsolidationTarget(opportunity: CentralizationOpportunity): ConsolidationTarget {
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

  private generateConfigStructure(opportunity: CentralizationOpportunity): any {
    const structure: any = {};
    
    opportunity.scatteredLocations.forEach((location, index) => {
      const key = this.generateConfigKey(location, opportunity);
      structure[key] = location.value;
    });
    
    return structure;
  }

  private generateEnvStructure(opportunity: CentralizationOpportunity): any {
    const structure: any = {};
    
    opportunity.scatteredLocations.forEach((location, index) => {
      const key = this.generateConfigKey(location, opportunity).toUpperCase();
      structure[key] = location.value;
    });
    
    return structure;
  }

  private generateConstantsStructure(opportunity: CentralizationOpportunity): any {
    const constants: string[] = [];
    
    opportunity.scatteredLocations.forEach((location, index) => {
      const key = this.generateConfigKey(location, opportunity).toUpperCase();
      const value = typeof location.value === 'string' ? 
        `'${location.value}'` : 
        JSON.stringify(location.value);
      constants.push(`export const ${key} = ${value};`);
    });
    
    return constants.join('\n');
  }

  private generateClassStructure(opportunity: CentralizationOpportunity): any {
    const className = this.camelCase(opportunity.configType.replace('_', ' ')) + 'Config';
    const properties: string[] = [];
    
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

  private calculateStatistics(opportunities: CentralizationOpportunity[]): CentralizationStatistics {
    const byConfigType: Record<ConfigurationType, number> = {} as any;
    let totalDuplicatedLines = 0;
    let totalMaintenanceHours = 0;
    
    const priorityDistribution: Record<Priority, number> = {
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

  private calculatePriority(opportunity: CentralizationOpportunity): Priority {
    const benefitScore = opportunity.benefitScore;
    const complexityScore = opportunity.complexityScore;
    const ratio = benefitScore / Math.max(complexityScore, 1);
    
    if (ratio > 2 && benefitScore > 60) return Priority.CRITICAL;
    if (ratio > 1.5 && benefitScore > 40) return Priority.HIGH;
    if (ratio > 1 && benefitScore > 20) return Priority.MEDIUM;
    return Priority.LOW;
  }

  private generateGlobalRecommendations(opportunities: CentralizationOpportunity[]): GlobalRecommendation[] {
    const recommendations: GlobalRecommendation[] = [];

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
    const envConfigCount = opportunities.filter(o => 
      o.configType === ConfigurationType.API_ENDPOINTS ||
      o.configType === ConfigurationType.DATABASE_CONFIG ||
      o.configType === ConfigurationType.SECURITY_CONFIG
    ).length;

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
    const featureFlagCount = opportunities.filter(o => 
      o.configType === ConfigurationType.FEATURE_FLAGS
    ).length;

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

  async analyze(params: any): Promise<any> {
    // Alias for backward compatibility
    return this.scanProject(params);
  }
}

export default CentralizationDetector;