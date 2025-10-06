/**
 * Advanced change detection and significance scoring system
 */
import { GitDiffResult } from './git-integration';
import { Logger } from '../../utils/logger';
export interface ChangeSignificance {
    score: number;
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    newFeatures: string[];
    bugFixes: string[];
    configChanges: string[];
    testChanges: string[];
    categories: ChangeCategory[];
    riskLevel: 'low' | 'medium' | 'high';
    impactAreas: string[];
}
export interface ChangeCategory {
    type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'config' | 'docs' | 'style';
    confidence: number;
    evidence: string[];
    filesInvolved: string[];
}
export interface FileChangeAnalysis {
    file: string;
    changeType: 'added' | 'modified' | 'deleted' | 'renamed';
    linesAdded: number;
    linesDeleted: number;
    complexity: number;
    isTest: boolean;
    isConfig: boolean;
    isDoc: boolean;
    semanticChanges: SemanticChange[];
}
export interface SemanticChange {
    type: 'function_added' | 'function_modified' | 'function_deleted' | 'class_added' | 'class_modified' | 'class_deleted' | 'interface_added' | 'interface_modified' | 'interface_deleted' | 'import_added' | 'import_removed' | 'export_added' | 'export_removed';
    name: string;
    confidence: number;
    location: {
        line: number;
        column: number;
    };
}
export declare class ChangeDetector {
    private logger;
    constructor(logger?: Logger);
    analyzeChanges(diff: GitDiffResult[]): Promise<ChangeSignificance>;
    private analyzeFileChange;
    private calculateFileComplexity;
    private analyzeSemanticChanges;
    private calculateSignificance;
    private categorizeChanges;
    private isPotentialBugFix;
    private assessRiskLevel;
    private identifyImpactAreas;
    private isTestFile;
    private isConfigFile;
    private isDocumentationFile;
}
//# sourceMappingURL=change-detector.d.ts.map