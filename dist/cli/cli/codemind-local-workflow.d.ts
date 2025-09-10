#!/usr/bin/env node
/**
 * CodeMind Local Workflow CLI
 * Self-contained CLI that executes the complete workflow cycle locally:
 * 1. Infer user intention
 * 2. Select tools based on intention
 * 3. Find exact files related to request
 * 4. Split request into manageable steps
 * 5. Execute each step with enhanced context
 * 6. Quality checks after each step
 */
declare class CodeMindLocalWorkflow {
    private toolSelector;
    private contextProvider;
    private changeAssessment;
    private fileDiscovery;
    private impactAnalyzer;
    constructor();
    /**
     * Step 1: Infer user intention from the request
     */
    private inferUserIntention;
    /**
     * Step 2: Select relevant tools based on intention
     */
    private selectTools;
    /**
     * Step 3: Find exact files related to the request
     */
    private findRelevantFiles;
    /**
     * Fallback file discovery using patterns
     */
    private fallbackFileDiscovery;
    /**
     * Step 4: Split request into manageable steps
     */
    private planWorkflowSteps;
    /**
     * Step 5: Execute each step with enhanced context
     */
    private executeWorkflowStep;
    /**
     * Step 6: Quality checks after each step
     */
    private performQualityCheck;
    /**
     * Main workflow execution
     */
    executeWorkflow(userRequest: string, projectPath: string): Promise<void>;
    private resolveProjectId;
    private createSimpleWorkflowSteps;
    private getAllTSFiles;
    private waitForUserConfirmation;
    private checkCompilation;
    private checkSOLIDPrinciples;
    private runTests;
    private checkCodeDuplication;
}
export { CodeMindLocalWorkflow };
//# sourceMappingURL=codemind-local-workflow.d.ts.map