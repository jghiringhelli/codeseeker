export interface TestFile {
    path: string;
    testFramework: 'jest' | 'mocha' | 'vitest' | 'cypress' | 'playwright' | 'unknown';
    testCount: number;
    testTypes: ('unit' | 'integration' | 'e2e')[];
    coveredFiles: TestFileMapping[];
    testMethods: TestMethod[];
}
export interface TestFileMapping {
    sourceFile: string;
    importPath: string;
    mappingType: 'direct' | 'dependency' | 'mock' | 'fixture';
    lastUpdated?: Date;
    sourceLastModified?: Date;
    needsUpdate: boolean;
    confidence: number;
}
export interface TestMethod {
    name: string;
    line: number;
    type: 'unit' | 'integration' | 'e2e';
    testedFunctions: string[];
    testedClasses: string[];
    mocks: string[];
    fixtures: string[];
    dependencies: string[];
}
export interface SourceFile {
    path: string;
    functions: SourceFunction[];
    classes: SourceClass[];
    exports: string[];
    lastModified: Date;
    testFiles: string[];
    untested: boolean;
}
export interface SourceFunction {
    name: string;
    line: number;
    complexity: number;
    isPublic: boolean;
    testMethods: string[];
    needsTestUpdate: boolean;
}
export interface SourceClass {
    name: string;
    line: number;
    methods: string[];
    testFiles: string[];
    needsTestUpdate: boolean;
}
export interface TestMaintenanceIssue {
    type: 'outdated_test' | 'missing_test' | 'orphaned_test' | 'broken_mapping' | 'mock_mismatch';
    severity: 'low' | 'medium' | 'high' | 'critical';
    sourceFile?: string;
    testFile?: string;
    description: string;
    suggestion: string;
    affectedFunctions?: string[];
    lastChecked: Date;
}
export interface TestMappingResult {
    testFiles: TestFile[];
    sourceFiles: SourceFile[];
    testMappings: Map<string, string[]>;
    reverseTestMappings: Map<string, string[]>;
    maintenanceIssues: TestMaintenanceIssue[];
    staleTests: string[];
    untestedFunctions: string[];
    recommendations: string[];
    syncActions: TestSyncAction[];
}
export interface TestSyncAction {
    action: 'update_test' | 'create_test' | 'remove_test' | 'fix_import' | 'update_mock';
    priority: 'low' | 'medium' | 'high' | 'critical';
    sourceFile?: string;
    testFile?: string;
    description: string;
    suggestedCode?: string;
    reason: string;
}
export interface TestCoverageResult {
    overallCoverage: {
        lines: number;
        functions: number;
        branches: number;
        statements: number;
    };
    filesCoverage: Array<{
        filePath: string;
        lineCoverage: number;
        functionCoverage: number;
        branchCoverage: number;
    }>;
    uncoveredLines: Array<{
        filePath: string;
        lines: number[];
    }>;
}
export interface CoverageGap {
    type: 'function' | 'line' | 'branch' | 'statement';
    filePath: string;
    functionName?: string;
    lineNumber?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
}
export interface TestSuggestion {
    type: 'unit_test' | 'integration_test' | 'edge_case' | 'error_handling';
    priority: 'low' | 'medium' | 'high' | 'critical';
    targetFunction: string;
    suggestedTestName: string;
    testCode?: string;
    reasoning: string;
}
export declare class TestMappingAnalyzer {
    private logger;
    analyzeTestMapping(params: {
        projectPath: string;
        includeE2E?: boolean;
        excludePatterns?: string[];
        checkStaleTests?: boolean;
        autoSync?: boolean;
    }): Promise<TestMappingResult>;
    private findAndAnalyzeTestFiles;
    private findAndAnalyzeSourceFiles;
    private findTestFiles;
    private analyzeTestFile;
    private detectFileTestFramework;
    private countTests;
    private determineTestTypes;
    private findCoveredFiles;
    private countAssertions;
    private runCoverageAnalysis;
    private estimateCoverage;
    private getDefaultCoverage;
    private parseCoverageOutput;
    private analyzeCoverageGaps;
    private assessFileSeverity;
    private generateTestSuggestions;
    private generateFileSuggestion;
    private extractFunctions;
    private extractFileDependencies;
    private detectUIComponents;
    private identifyCriticalFiles;
    private generateRecommendations;
    private calculateQualityScore;
    private extractTestMethods;
    private analyzeSourceFile;
    private extractSourceFunctions;
    private extractSourceClasses;
    private extractExports;
    private extractClassMethods;
    private calculateComplexity;
    private buildTestMappings;
    private resolveImportPath;
    private findStaleTests;
    private findUntestedFunctions;
    private identifyMaintenanceIssues;
    private generateSyncActions;
    private generateMappingRecommendations;
}
export { TestMappingAnalyzer as TestCoverageAnalyzer };
export default TestMappingAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map