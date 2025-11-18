/**
 * LLM-based Intention Detection Service
 * Uses existing Claude Code integration to analyze user intentions and assumptions
 * Provides interactive clarification system for ambiguous requests
 */
export type IntentionType = 'feature_implementation' | 'feature_enhancement' | 'new_component' | 'new_service' | 'new_utility' | 'api_development' | 'ui_development' | 'database_changes' | 'integration_development' | 'bug_fix' | 'hotfix' | 'performance_optimization' | 'security_fix' | 'dependency_update' | 'code_cleanup' | 'technical_debt_reduction' | 'legacy_modernization' | 'refactoring' | 'architectural_change' | 'design_pattern_implementation' | 'scalability_improvement' | 'modularity_improvement' | 'abstraction_addition' | 'testing' | 'test_automation' | 'code_review' | 'quality_assurance' | 'performance_testing' | 'security_testing' | 'integration_testing' | 'codebase_analysis' | 'requirement_analysis' | 'feasibility_study' | 'research' | 'documentation_review' | 'impact_analysis' | 'technology_evaluation' | 'documentation' | 'code_documentation' | 'api_documentation' | 'user_documentation' | 'architecture_documentation' | 'process_documentation' | 'knowledge_transfer' | 'deployment' | 'configuration' | 'monitoring_setup' | 'ci_cd_setup' | 'infrastructure_setup' | 'environment_setup' | 'automation_script' | 'learning' | 'proof_of_concept' | 'experimental_feature' | 'technology_spike' | 'prototype_development' | 'concept_validation' | 'planning' | 'estimation' | 'task_breakdown' | 'project_setup' | 'workflow_optimization' | 'process_improvement';
export type AssumptionCategory = 'scope' | 'approach' | 'technology' | 'architecture' | 'data' | 'integration' | 'behavior' | 'format' | 'timeline' | 'quality' | 'performance' | 'security' | 'testing' | 'deployment' | 'maintenance' | 'compatibility' | 'resources';
export interface AssumptionDetail {
    category: AssumptionCategory;
    description: string;
    confidence: number;
    alternatives: string[];
    impact: 'low' | 'medium' | 'high' | 'critical';
    userSelectable: boolean;
}
export interface AmbiguityDetail {
    id: string;
    area: string;
    reason: string;
    clarificationNeeded: string;
    options: string[];
    allowCustomInput: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
export interface UserClarification {
    ambiguityId: string;
    selectedOption?: number;
    customInput?: string;
    timestamp: number;
}
export interface IntentionAnalysis {
    primaryIntent: IntentionType;
    confidence: number;
    subIntents: IntentionType[];
    assumptions: AssumptionDetail[];
    ambiguities: AmbiguityDetail[];
    urgency: 'low' | 'medium' | 'high' | 'critical';
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex' | 'unknown';
    estimatedDuration: 'minutes' | 'hours' | 'days' | 'weeks' | 'unknown';
    requiredSkills: string[];
    potentialRisks: string[];
}
export interface ClarifiedIntentionAnalysis extends IntentionAnalysis {
    userClarifications: UserClarification[];
    finalInstructions: string;
}
export declare class LLMIntentionDetector {
    private enableLLM;
    constructor(enableLLM?: boolean);
    analyzeIntention(userInput: string): Promise<IntentionAnalysis | null>;
    /**
     * Get all possible intention types grouped by category
     */
    getIntentionCategories(): Record<string, IntentionType[]>;
    /**
     * Apply user clarifications to create final instructions
     */
    applyClarifications(analysis: IntentionAnalysis, clarifications: UserClarification[]): ClarifiedIntentionAnalysis;
    private buildAnalysisPrompt;
    private parseResponse;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
}
//# sourceMappingURL=llm-intention-detector.d.ts.map