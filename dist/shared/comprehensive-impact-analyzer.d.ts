/**
 * Comprehensive Impact Analyzer
 *
 * Uses Neo4j tree traversal to find ALL affected files across the entire project
 * including classes, methods, documents, configs, deployments, tests, etc.
 */
export interface AffectedFile {
    filePath: string;
    fileType: 'code' | 'config' | 'documentation' | 'test' | 'deployment' | 'static';
    changeType: 'update' | 'create' | 'delete' | 'rename';
    specificTask: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    dependencies: string[];
    estimatedComplexity: number;
}
export interface ImpactAnalysisResult {
    primaryFiles: AffectedFile[];
    cascadingFiles: AffectedFile[];
    configurationFiles: AffectedFile[];
    documentationFiles: AffectedFile[];
    testFiles: AffectedFile[];
    deploymentFiles: AffectedFile[];
    totalFiles: number;
    estimatedTime: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export declare class ComprehensiveImpactAnalyzer {
    private logger;
    private semanticGraph;
    constructor();
    initialize(): Promise<void>;
    /**
     * Analyze complete impact of a change request across ALL project files
     */
    analyzeCompleteImpact(projectPath: string, userRequest: string, changedFiles?: string[]): Promise<ImpactAnalysisResult>;
    /**
     * Analyze primary impact - files directly mentioned or inferred from request
     */
    private analyzePrimaryImpact;
    /**
     * Use Neo4j tree traversal to find ALL cascading effects
     */
    private analyzeCascadingImpact;
    /**
     * Analyze configuration file impacts
     */
    private analyzeConfigurationImpact;
    /**
     * Analyze documentation impacts
     */
    private analyzeDocumentationImpact;
    /**
     * Analyze test file impacts
     */
    private analyzeTestImpact;
    /**
     * Analyze deployment/infrastructure impacts
     */
    private analyzeDeploymentImpact;
    /**
     * Generate specific task description for a file
     */
    private generateSpecificTask;
    /**
     * Determine file type from path
     */
    private determineFileType;
    /**
     * Calculate total files across all categories
     */
    private calculateTotalFiles;
    /**
     * Estimate completion time based on file complexity
     */
    private estimateCompletionTime;
    /**
     * Calculate risk level based on number and type of affected files
     */
    private calculateRiskLevel;
    private inferPrimaryFilesFromIntent;
    private generateCascadingTask;
    private calculateCascadingPriority;
    private deduplicateCascadingFiles;
    private estimateComplexity;
    private detectNewDependencies;
    private shouldUpdateDocumentation;
    private detectNewDocumentationNeeds;
    private findExistingTestFiles;
    private needsNewTests;
    private generateTestFilePath;
    private checkDeploymentImpact;
}
export default ComprehensiveImpactAnalyzer;
//# sourceMappingURL=comprehensive-impact-analyzer.d.ts.map