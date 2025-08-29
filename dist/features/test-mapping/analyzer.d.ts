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
    private analyzeTestFile;
    private analyzeSourceFile;
    private buildTestMappings;
    private detectTestFramework;
    private extractTestMethods;
    private extractTestedFunctions;
    private extractMocks;
    private isTestKeyword;
    private inferTestType;
    private determineTestTypes;
    private mapTestToSourceFiles;
    private resolveSourceFile;
    private extractFunctions;
    private extractClasses;
    private extractClassMethods;
    private extractExports;
    private calculateComplexity;
    private findStaleTests;
    private findUntestedFunctions;
    private identifyMaintenanceIssues;
    private generateSyncActions;
    private generateMappingRecommendations;
}
export default TestMappingAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map