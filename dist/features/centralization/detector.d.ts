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
export declare enum ConfigurationType {
    API_ENDPOINTS = "api_endpoints",
    DATABASE_CONFIG = "database_config",
    STYLING_CONSTANTS = "styling_constants",
    BUSINESS_RULES = "business_rules",
    VALIDATION_RULES = "validation_rules",
    ERROR_MESSAGES = "error_messages",
    FEATURE_FLAGS = "feature_flags",
    ENVIRONMENT_CONFIG = "environment_config",
    ROUTING_CONFIG = "routing_config",
    SECURITY_CONFIG = "security_config",
    LOGGING_CONFIG = "logging_config",
    CACHE_CONFIG = "cache_config"
}
export declare enum ConfigUsage {
    DEFINITION = "definition",
    REFERENCE = "reference",
    MODIFICATION = "modification",
    VALIDATION = "validation"
}
export declare enum MigrationApproach {
    EXTRACT_TO_CONFIG_FILE = "extract_to_config_file",
    ENVIRONMENT_VARIABLES = "environment_variables",
    CENTRALIZED_CONSTANTS = "centralized_constants",
    CONFIGURATION_CLASS = "configuration_class",
    DEPENDENCY_INJECTION = "dependency_injection",
    FEATURE_TOGGLE_SYSTEM = "feature_toggle_system"
}
export declare enum EffortLevel {
    LOW = "low",// < 4 hours
    MEDIUM = "medium",// 4-16 hours
    HIGH = "high",// 16-40 hours
    VERY_HIGH = "very_high"
}
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
interface Risk {
    category: 'breaking_changes' | 'performance' | 'security' | 'complexity';
    description: string;
    probability: number;
    impact: number;
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
export declare class CentralizationDetector {
    private logger;
    private astAnalyzer;
    private configPatterns;
    constructor();
    scanProject(request: CentralizationScanRequest): Promise<CentralizationResult>;
    private initializeConfigPatterns;
    private getScanFiles;
    private scanFile;
    private getLineNumber;
    private getLineContext;
    private isValidMatch;
    private determineUsage;
    private identifyOpportunities;
    private inferConfigType;
    private groupSimilarConfigs;
    private areConfigsSimilar;
    private hasSimilarPattern;
    private hasSimilarContext;
    private getCommonWords;
    private extractVariableNames;
    private generateOpportunityId;
    private calculateBenefitScore;
    private calculateComplexityScore;
    private generateMigrationPlan;
    private selectMigrationApproach;
    private estimateMigrationEffort;
    private generateMigrationSteps;
    private identifyDependencies;
    private createRollbackStrategy;
    private createTestingStrategy;
    private assessRisk;
    private calculateRiskSeverity;
    private calculateOverallRisk;
    private getBusinessImpact;
    private getTechnicalImpact;
    private generateExamples;
    private createExample;
    private generateAfterCode;
    private generateConfigKey;
    private extractKeyFromValue;
    private camelCase;
    private generateExplanation;
    private suggestConsolidationTarget;
    private generateConfigStructure;
    private generateEnvStructure;
    private generateConstantsStructure;
    private generateClassStructure;
    private calculateStatistics;
    private calculatePriority;
    private generateGlobalRecommendations;
    analyze(params: any): Promise<any>;
}
export default CentralizationDetector;
//# sourceMappingURL=detector.d.ts.map