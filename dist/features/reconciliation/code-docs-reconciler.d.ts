/**
 * Code-Documentation Reconciliation System
 * Bidirectional synchronization between code implementation and documentation
 */
export interface Feature {
    id: string;
    name: string;
    description: string;
    type: 'function' | 'class' | 'module' | 'api' | 'component' | 'workflow';
    status: 'implemented' | 'documented' | 'partial' | 'missing' | 'outdated';
    priority: 'critical' | 'high' | 'medium' | 'low';
}
export interface CodeElement {
    id: string;
    name: string;
    type: 'function' | 'class' | 'method' | 'property' | 'interface';
    signature: string;
    description?: string;
    parameters?: Parameter[];
    returnType?: string;
    filePath: string;
    lineNumber: number;
    complexity: number;
    documentation?: string;
}
export interface DocumentationElement {
    id: string;
    title: string;
    description: string;
    type: 'api' | 'guide' | 'specification' | 'requirement' | 'example';
    filePath: string;
    section: string;
    codeReferences: string[];
    expectedImplementation?: string;
    examples?: string[];
}
export interface Parameter {
    name: string;
    type: string;
    description?: string;
    required: boolean;
    defaultValue?: string;
}
export interface ReconciliationResult {
    feature: Feature;
    codeElements: CodeElement[];
    docElements: DocumentationElement[];
    discrepancies: Discrepancy[];
    recommendations: Recommendation[];
    syncOptions: SyncOption[];
}
export interface Discrepancy {
    type: 'missing_implementation' | 'missing_documentation' | 'signature_mismatch' | 'parameter_mismatch' | 'behavior_mismatch' | 'outdated_docs' | 'deprecated_code';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    codeLocation?: {
        file: string;
        line: number;
    };
    docLocation?: {
        file: string;
        section: string;
    };
    suggestedFix?: string;
}
export interface Recommendation {
    action: 'implement_from_docs' | 'update_docs_from_code' | 'refactor_code' | 'clarify_docs' | 'add_tests' | 'deprecate_feature';
    priority: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    generatedCode?: string;
    generatedDocs?: string;
}
export interface SyncOption {
    direction: 'code_to_docs' | 'docs_to_code' | 'bidirectional';
    description: string;
    preview: string;
    confidence: number;
    risks: string[];
    benefits: string[];
    action: string;
}
export declare class CodeDocumentationReconciler {
    private projectPath;
    private options;
    private codePatterns;
    private docPatterns;
    private excludePatterns;
    constructor(options: {
        codeDirectory: string;
        documentationDirectory: string;
        languages?: string[];
        documentationFormats?: string[];
        codePatterns?: string[];
        docPatterns?: string[];
        excludePatterns?: string[];
    });
    reconcile(): Promise<ReconciliationResult[]>;
    private analyzeCodeStructure;
    private parseCodeFile;
    private parseTypeScriptFile;
    private parsePythonFile;
    private parseDocumentation;
    private parseDocumentationFile;
    private parseMarkdown;
    private extractFeatures;
    private reconcileFeature;
    private analyzeDiscrepancies;
    private generateRecommendations;
    private generateSyncOptions;
    private findLineNumber;
    private calculateComplexity;
    private extractJSDoc;
    private extractPythonDocstring;
    private parseParameters;
    private parsePythonParameters;
    private extractReturnType;
    private extractPythonReturnType;
    private extractCodeReferences;
    private extractAPISpecifications;
    private determineDocumentationType;
    private inferFeatureName;
    private inferFeatureNameFromDoc;
    private inferFeatureType;
    private inferFeatureTypeFromDoc;
    private inferPriority;
    private inferPriorityFromDoc;
    private findRelatedCodeElements;
    private findRelatedDocElements;
    private hasSignatureMismatch;
    private generateCodeFromDocs;
    private generateDocsFromCode;
    private generateRefactoredCode;
    private calculateSyncConfidence;
    private elementsMatch;
    /**
     * Applies a synchronization option to reconcile code and documentation
     */
    applySyncOption(feature: Feature, syncDirection: 'code-to-docs' | 'docs-to-code', options?: {
        selectedSyncOption?: SyncOption;
        preview?: boolean;
        dryRun?: boolean;
        backupFiles?: boolean;
    }): Promise<{
        success: boolean;
        error?: string;
        details?: any;
        changes?: string[];
        updatedContent?: string;
    }>;
    /**
     * Syncs code implementation to documentation
     */
    private syncCodeToDocumentation;
    /**
     * Syncs documentation to code implementation
     */
    private syncDocumentationToCode;
    /**
     * Helper methods for file operations
     */
    private findDocumentationFileForFeature;
    private findCodeFileForFeature;
    private generateDocumentationFromCode;
    private generateCodeFromDocumentation;
    private generateFunctionImplementation;
    private generateClassImplementation;
    private generateGenericImplementation;
}
export default CodeDocumentationReconciler;
export declare const CodeDocsReconciler: typeof CodeDocumentationReconciler;
//# sourceMappingURL=code-docs-reconciler.d.ts.map