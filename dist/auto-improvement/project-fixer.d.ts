export interface ProjectFixerOptions {
    projectPath: string;
    outputPath?: string;
    dryRun?: boolean;
    fixTypes?: AutoFixType[];
    aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
    backupOriginal?: boolean;
    generateReport?: boolean;
}
export declare enum AutoFixType {
    DUPLICATES = "duplicates",
    CENTRALIZATION = "centralization",
    DEPENDENCIES = "dependencies",
    SECURITY = "security",
    PERFORMANCE = "performance",
    ARCHITECTURE = "architecture",
    QUALITY = "quality",
    ALL = "all"
}
export interface FixResult {
    success: boolean;
    fixType: AutoFixType;
    description: string;
    filesModified: string[];
    linesChanged: number;
    benefitScore: number;
    effort: 'low' | 'medium' | 'high';
    errors?: string[];
}
export interface ProjectAnalysisReport {
    timestamp: Date;
    projectPath: string;
    summary: {
        totalIssuesFound: number;
        totalIssuesFixed: number;
        filesAnalyzed: number;
        filesModified: number;
        linesChanged: number;
        overallBenefitScore: number;
    };
    fixes: FixResult[];
    recommendations: string[];
    nextSteps: string[];
    metrics: {
        before: ProjectMetrics;
        after: ProjectMetrics;
        improvement: ProjectMetrics;
    };
}
export interface ProjectMetrics {
    duplicateLines: number;
    scatteredConfigs: number;
    circularDependencies: number;
    securityIssues: number;
    performanceIssues: number;
    architectureViolations: number;
    qualityScore: number;
}
export declare class ProjectFixer {
    private logger;
    constructor();
    analyzeAndFix(options: ProjectFixerOptions): Promise<ProjectAnalysisReport>;
    private validateProject;
    private createBackup;
    private analyzeProject;
    private applyFixes;
    private calculateImprovement;
    private calculateQualityScore;
    private countIssues;
    private countFiles;
    private getProjectFiles;
    private shouldSkipDirectory;
    private isCodeFile;
    private generateRecommendations;
    private generateNextSteps;
    private generateReportFile;
    private generateMarkdownReport;
}
//# sourceMappingURL=project-fixer.d.ts.map