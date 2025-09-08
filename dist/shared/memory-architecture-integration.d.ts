/**
 * Memory Architecture Integration
 *
 * Integrates the Four-Layer Memory Architecture with the orchestration system,
 * ensuring proper data flow and storage optimization across all memory types.
 */
import { OrchestrationResult } from './task-specific-file-orchestrator';
export interface MemoryLayerUsage {
    shortTerm: {
        activeTaskTracking: boolean;
        contextCaching: boolean;
        interactionBuffering: boolean;
        validationState: boolean;
    };
    longTerm: {
        patternStorage: boolean;
        performanceTracking: boolean;
        knowledgeRetention: boolean;
        solutionLibrary: boolean;
    };
    episodic: {
        experienceRecording: boolean;
        improvementLearning: boolean;
        sequenceTracking: boolean;
        outcomeAnalysis: boolean;
    };
    semantic: {
        conceptMapping: boolean;
        relationshipTracking: boolean;
        factualKnowledge: boolean;
        principleStorage: boolean;
    };
}
export interface LayerOptimizedOrchestrationResult extends OrchestrationResult {
    memoryUsage: {
        shortTermOperations: number;
        longTermUpdates: number;
        episodicRecords: number;
        semanticEnhancements: number;
        totalMemoryFootprint: string;
        compressionAchieved: number;
    };
    layerInsights: {
        shortTermEfficiency: number;
        longTermLearning: number;
        episodicValue: number;
        semanticGrowth: number;
    };
}
export declare class MemoryArchitectureIntegration {
    private logger;
    private memoryManager;
    private orchestrator;
    constructor(projectPath: string);
    initialize(): Promise<void>;
    /**
     * Orchestrate with optimized memory layer usage
     */
    orchestrateWithLayerOptimization(projectPath: string, userRequest: string, sessionId: string, options?: {
        force?: boolean;
        skipCycles?: boolean;
        dryRun?: boolean;
        autoRollback?: boolean;
        memoryUsage?: MemoryLayerUsage;
    }): Promise<LayerOptimizedOrchestrationResult>;
    /**
     * Initialize memory layers based on usage configuration
     */
    private initializeMemoryLayers;
    /**
     * Run orchestration with integrated memory layers
     */
    private runMemoryIntegratedOrchestration;
    /**
     * Create orchestration wrapper with memory layer integration
     */
    private createMemoryIntegratedWrapper;
    /**
     * Finalize memory layers with optimization insights
     */
    private finalizeMemoryLayers;
    private optimizeShortTermTaskTracking;
    private optimizeLongTermPatternRetrieval;
    private optimizeEpisodicExperienceMatching;
    private optimizeSemanticContextBuilding;
    private calculateMemoryFootprint;
    private calculateCompressionRatio;
    private calculateShortTermEfficiency;
    private calculateLongTermLearning;
    private calculateEpisodicValue;
    private calculateSemanticGrowth;
    private generateRequestId;
    private generateProjectId;
    /**
     * Get memory architecture statistics
     */
    getMemoryArchitectureStats(): Promise<{
        layerDistribution: {
            shortTerm: {
                usage: string;
                efficiency: number;
            };
            longTerm: {
                usage: string;
                patterns: number;
            };
            episodic: {
                usage: string;
                experiences: number;
            };
            semantic: {
                usage: string;
                concepts: number;
            };
        };
        optimization: {
            overallEfficiency: number;
            compressionRatio: number;
            learningRate: number;
        };
    }>;
}
export default MemoryArchitectureIntegration;
//# sourceMappingURL=memory-architecture-integration.d.ts.map