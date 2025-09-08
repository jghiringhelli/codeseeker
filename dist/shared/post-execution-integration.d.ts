/**
 * Post-Execution Integration System
 *
 * Ensures project compiles → tests pass → commits changes → merges branch → sets new snapshot
 * Automatically fixes compilation/test issues and manages the complete integration workflow
 */
import { FeatureBranch } from './git-branch-manager';
export interface IntegrationResult {
    success: boolean;
    phase: 'compilation' | 'testing' | 'commit' | 'merge' | 'documentation' | 'cleanup';
    compilationFixed: boolean;
    testsFixed: boolean;
    changesCommitted: boolean;
    branchMerged: boolean;
    documentationUpdated: boolean;
    configUpdated: boolean;
    deploymentUpdated: boolean;
    nextSnapshotReady: boolean;
    fixesApplied: string[];
    message: string;
    errors: string[];
}
export interface IntegrationOptions {
    autoFixCompilation: boolean;
    autoFixTests: boolean;
    autoCommit: boolean;
    autoMerge: boolean;
    updateDocumentation: boolean;
    updateConfig: boolean;
    updateDeployment: boolean;
    createNextSnapshot: boolean;
    preserveFeatureBranch: boolean;
}
export declare class PostExecutionIntegration {
    private logger;
    private branchManager;
    private validationCycle;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Complete post-execution integration workflow
     * Compile → Test → Fix Issues → Commit → Merge → Update Docs/Config → New Snapshot
     */
    runCompleteIntegration(featureBranch: FeatureBranch, changedFiles: string[], options?: IntegrationOptions): Promise<IntegrationResult>;
    /**
     * Ensure project compiles, with automatic fixing
     */
    private ensureProjectCompiles;
    /**
     * Ensure tests pass, with automatic fixing
     */
    private ensureTestsPass;
    /**
     * Commit all changes with descriptive message
     */
    private commitChanges;
    /**
     * Update documentation files
     */
    private updateDocumentation;
    /**
     * Update configuration files
     */
    private updateConfiguration;
    /**
     * Update deployment files
     */
    private updateDeploymentFiles;
    private runCompilation;
    private runTests;
    private applyCompilationFixes;
    private applyTestFixes;
    private generateCommitMessage;
    private generateSuccessMessage;
    private getDefaultOptions;
    private execGit;
    private parseCompilationErrors;
    private parseTestFailures;
    private fixMissingImports;
    private fixTypeAssignments;
    private fixMissingProperties;
    private fixMissingTestDependencies;
    private updateTestExpectations;
    private requiresReadmeUpdate;
    private requiresApiDocUpdate;
    private requiresVersionBump;
    private requiresTsConfigUpdate;
    private requiresDockerUpdate;
    private requiresCIUpdate;
    private updateReadmeFile;
    private updateApiDocumentation;
    private updateChangelog;
    private bumpPackageVersion;
    private updateTypeScriptConfig;
    private updateDockerConfiguration;
    private updateCIConfiguration;
}
export default PostExecutionIntegration;
//# sourceMappingURL=post-execution-integration.d.ts.map