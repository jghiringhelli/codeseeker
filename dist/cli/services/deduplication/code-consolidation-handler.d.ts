/**
 * Code Consolidation Handler
 * Orchestrates Claude Code to merge and consolidate duplicate code
 * Following SOLID principles with comprehensive workflow integration
 */
import { DeduplicationReport } from './duplicate-code-detector';
export interface ConsolidationPlan {
    groupId: string;
    action: 'extract_function' | 'extract_class' | 'create_utility' | 'merge_similar' | 'create_base_class';
    targetLocation: string;
    affectedFiles: string[];
    instructions: string;
    estimatedComplexity: 'low' | 'medium' | 'high';
    prerequisites: string[];
}
export interface ConsolidationResult {
    groupId: string;
    success: boolean;
    filesModified: string[];
    linesReduced: number;
    newUtilityCreated?: string;
    error?: string;
    qualityScore?: number;
}
export interface ConsolidationSummary {
    totalGroupsProcessed: number;
    successfulConsolidations: number;
    failedConsolidations: number;
    totalLinesReduced: number;
    newUtilitiesCreated: string[];
    filesModified: string[];
    overallQualityImprovement: number;
    errors: string[];
}
export declare class CodeConsolidationHandler {
    private logger;
    /**
     * Create consolidation plans for duplicate groups
     */
    createConsolidationPlans(report: DeduplicationReport): Promise<ConsolidationPlan[]>;
    /**
     * Execute consolidation plans using Claude Code
     */
    executeConsolidations(plans: ConsolidationPlan[], claudeOrchestrator: any, projectPath: string): Promise<ConsolidationSummary>;
    /**
     * Create a consolidation plan for a specific duplicate group
     */
    private createPlanForGroup;
    /**
     * Execute a specific consolidation plan using Claude Code
     */
    private executeConsolidationPlan;
    /**
     * Build comprehensive Claude Code instruction
     */
    private buildClaudeInstruction;
    private createExactFunctionExtractionInstructions;
    private createExactClassExtractionInstructions;
    private createUtilityExtractionInstructions;
    private createSemanticMergeInstructions;
    private createSemanticUtilityInstructions;
    private createBaseClassInstructions;
    private createStructuralUtilityInstructions;
    private suggestUtilityLocation;
    private suggestBaseClassLocation;
    private estimateLinesReduced;
    private createConsolidationSummary;
}
export default CodeConsolidationHandler;
//# sourceMappingURL=code-consolidation-handler.d.ts.map