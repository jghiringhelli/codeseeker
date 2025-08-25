import { ProjectFixerOptions, ProjectAnalysisReport } from './project-fixer';
import { GitWorkflowResult, TestResults } from './git-workflow-manager';
export interface InteractiveFixerOptions extends ProjectFixerOptions {
    interactive?: boolean;
    autoApprove?: boolean;
    skipTests?: boolean;
    skipGitWorkflow?: boolean;
}
export interface InteractiveFixerResult extends ProjectAnalysisReport {
    gitWorkflow: GitWorkflowResult;
    userApproved: boolean;
    testResults?: TestResults;
    finalCommitHash?: string;
}
export declare class InteractiveProjectFixer {
    private logger;
    private projectFixer;
    private gitWorkflow;
    private rl;
    constructor();
    analyzeAndFixInteractive(options: InteractiveFixerOptions): Promise<InteractiveFixerResult>;
    private displayAnalysisResults;
    private displayTestResults;
    private displayFinalSummary;
    private askUserConfirmation;
    private generateCustomCommitMessage;
    private getFixIcon;
    private getEffortIcon;
    close(): void;
}
//# sourceMappingURL=interactive-project-fixer.d.ts.map