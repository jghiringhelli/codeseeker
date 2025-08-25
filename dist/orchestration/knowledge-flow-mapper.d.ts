import { RoleType } from './types';
export { RoleType };
export interface KnowledgeFlowStep {
    stepId: string;
    roleType: RoleType;
    stepName: string;
    knowledgeInputs: KnowledgeInput[];
    knowledgeProcessing: KnowledgeProcessing[];
    knowledgeOutputs: KnowledgeOutput[];
    feedbackLoops: FeedbackLoop[];
    qualityGates: KnowledgeQualityGate[];
}
export interface KnowledgeInput {
    type: 'triads' | 'rag' | 'historical' | 'project' | 'peers' | 'domain';
    source: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    usage: string;
    examples: string[];
}
export interface KnowledgeProcessing {
    process: string;
    description: string;
    knowledgeSources: string[];
    outputGenerated: string;
    qualityCheck: string;
}
export interface KnowledgeOutput {
    type: 'summary' | 'insight' | 'metric' | 'outcome' | 'learning' | 'decision';
    description: string;
    beneficiaries: RoleType[];
    updateMechanism: string;
    persistenceLevel: 'temporary' | 'execution' | 'project' | 'permanent';
}
export interface FeedbackLoop {
    from: string;
    to: string;
    dataType: string;
    trigger: string;
    updateFrequency: 'realtime' | 'step' | 'phase' | 'milestone';
}
export interface KnowledgeQualityGate {
    name: string;
    criteria: string;
    threshold: number;
    action: 'warn' | 'block' | 'enhance';
    fallbackStrategy: string;
}
export declare class KnowledgeFlowMapper {
    static getCompleteWorkflowKnowledgeFlow(): Map<RoleType, KnowledgeFlowStep>;
    private static getWorkClassifierFlow;
    private static getRequirementAnalystFlow;
    private static getTestDesignerFlow;
    private static getImplementationDeveloperFlow;
    private static getSecurityAuditorFlow;
    private static getOrchestratorFlow;
    private static getCodeReviewerFlow;
    private static getCompilerBuilderFlow;
    private static getPerformanceAuditorFlow;
    private static getQualityAuditorFlow;
    private static getDevOpsEngineerFlow;
    private static getDeployerFlow;
    private static getUnitTestExecutorFlow;
    private static getIntegrationTestEngineerFlow;
    private static getE2ETestEngineerFlow;
    private static getTechnicalDocumenterFlow;
    private static getUserDocumenterFlow;
    private static getReleaseManagerFlow;
    private static getCommitterFlow;
    static analyzeKnowledgeFlow(flow: Map<RoleType, KnowledgeFlowStep>): any;
    static generateFlowDiagram(flow: Map<RoleType, KnowledgeFlowStep>): string;
}
//# sourceMappingURL=knowledge-flow-mapper.d.ts.map