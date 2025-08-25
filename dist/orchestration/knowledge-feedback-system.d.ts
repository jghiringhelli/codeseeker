import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType } from './types';
import { RoleOutcome } from './role-knowledge-integrator';
import { SemanticKnowledgeGraph } from '../knowledge/graph/knowledge-graph';
import { KnowledgeRepository } from '../knowledge/repository/knowledge-repository';
import { ProjectManagementKB } from './project-management-kb';
export interface FeedbackLoop {
    id: string;
    type: FeedbackLoopType;
    source: FeedbackSource;
    target: FeedbackTarget;
    dataFlow: DataFlow;
    frequency: FeedbackFrequency;
    aggregationRules: AggregationRule[];
    qualityFilters: QualityFilter[];
    learningMechanisms: LearningMechanism[];
    isActive: boolean;
    metrics: FeedbackMetrics;
}
export declare enum FeedbackLoopType {
    PERFORMANCE = "PERFORMANCE",
    QUALITY = "QUALITY",
    LEARNING = "LEARNING",
    ADAPTATION = "ADAPTATION",
    VALIDATION = "VALIDATION",
    OPTIMIZATION = "OPTIMIZATION"
}
export interface FeedbackSource {
    type: 'role_outcome' | 'execution_result' | 'user_feedback' | 'system_metric' | 'external_source';
    roleTypes?: RoleType[];
    dataTypes: string[];
    samplingStrategy: 'all' | 'random' | 'stratified' | 'adaptive';
    samplingRate: number;
}
export interface FeedbackTarget {
    type: 'knowledge_graph' | 'rag_context' | 'role_learning' | 'project_kb' | 'system_optimization';
    updateMechanism: 'immediate' | 'batch' | 'periodic' | 'threshold_based';
    persistenceLevel: 'temporary' | 'session' | 'project' | 'permanent';
    propagationRules: PropagationRule[];
}
export interface DataFlow {
    inputFormat: string;
    transformations: DataTransformation[];
    outputFormat: string;
    validationRules: ValidationRule[];
    compressionStrategy?: CompressionStrategy;
}
export declare enum FeedbackFrequency {
    REALTIME = "REALTIME",
    PER_STEP = "PER_STEP",
    PER_PHASE = "PER_PHASE",
    PER_MILESTONE = "PER_MILESTONE",
    PER_PROJECT = "PER_PROJECT",
    ADAPTIVE = "ADAPTIVE"
}
export interface AggregationRule {
    field: string;
    operation: 'sum' | 'average' | 'median' | 'max' | 'min' | 'count' | 'std_dev';
    groupBy?: string[];
    timeWindow?: number;
    weightingStrategy?: WeightingStrategy;
}
export interface QualityFilter {
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'not_in';
    value: any;
    action: 'include' | 'exclude' | 'flag' | 'transform';
}
export interface LearningMechanism {
    type: 'pattern_recognition' | 'correlation_analysis' | 'anomaly_detection' | 'trend_analysis' | 'causal_inference';
    algorithm: string;
    parameters: Record<string, any>;
    confidenceThreshold: number;
    validationMethod: string;
}
export interface FeedbackMetrics {
    totalFeedbackItems: number;
    processedItems: number;
    learningInsights: number;
    qualityImprovements: number;
    systemOptimizations: number;
    averageProcessingTime: number;
    errorRate: number;
    lastUpdate: Date;
}
export interface DataTransformation {
    name: string;
    operation: string;
    parameters: Record<string, any>;
    validation: string;
}
export interface ValidationRule {
    field: string;
    rule: string;
    errorAction: 'discard' | 'flag' | 'transform' | 'escalate';
}
export interface PropagationRule {
    condition: string;
    targets: string[];
    priority: number;
    batchSize?: number;
}
export interface WeightingStrategy {
    type: 'uniform' | 'recency' | 'quality' | 'relevance' | 'custom';
    parameters: Record<string, any>;
}
export interface CompressionStrategy {
    algorithm: 'lz4' | 'gzip' | 'semantic' | 'priority_based';
    compressionRatio: number;
    qualityThreshold: number;
}
export interface ContinuousLearningConfig {
    enabled: boolean;
    learningRate: number;
    adaptationThreshold: number;
    maxMemorySize: number;
    forgettingCurve: ForgettingCurveConfig;
    reinforcementLearning: ReinforcementConfig;
}
export interface ForgettingCurveConfig {
    enabled: boolean;
    decayRate: number;
    minimumRetention: number;
    importanceWeighting: boolean;
}
export interface ReinforcementConfig {
    enabled: boolean;
    rewardFunction: string;
    explorationRate: number;
    discountFactor: number;
}
export declare class KnowledgeFeedbackSystem extends EventEmitter {
    private logger;
    private knowledgeGraph;
    private knowledgeRepo;
    private projectKB;
    private feedbackLoops;
    private learningState;
    private feedbackQueue;
    private isProcessing;
    private continuousLearning;
    private systemMemory;
    constructor(logger: Logger, knowledgeGraph: SemanticKnowledgeGraph, knowledgeRepo: KnowledgeRepository, projectKB: ProjectManagementKB, config?: ContinuousLearningConfig);
    private initializeFeedbackLoops;
    private createFeedbackLoop;
    private initializeFeedbackMetrics;
    processFeedback(roleOutcome: RoleOutcome, executionContext?: any): Promise<void>;
    private shouldProcessFeedback;
    private shouldIncludeInStratifiedSample;
    private shouldIncludeInAdaptiveSample;
    private processFeedbackQueue;
    private processFeedbackItem;
    private passesQualityFilters;
    private transformFeedbackData;
    private aggregateFeedbackData;
    private applyLearningMechanisms;
    private updateTargetSystems;
    private updateLearningState;
    private shouldAdapt;
    private adaptSystem;
    private assessFeedbackQuality;
    private getStratum;
    private getStratumSampleRate;
    private getRecentPerformanceMetrics;
    private calculateAdaptiveSampleRate;
    private extractFieldValue;
    private evaluateFilter;
    private applyTransformation;
    private extractValuesForAggregation;
    private applyAggregation;
    private applyLearningMechanism;
    private updateFeedbackMetrics;
    private calculateRollingAverage;
    private extractPatterns;
    private calculateMedian;
    private calculateStdDev;
    private recognizePatterns;
    private analyzeTrends;
    private detectAnomalies;
    private updateKnowledgeGraph;
    private updateRAGContext;
    private updateRoleLearning;
    private updateProjectKB;
    private updateSystemOptimization;
    private updateReinforcementLearning;
    private optimizeSystemPerformance;
    private improveSystemQuality;
    private enhanceSystemLearning;
    private startFeedbackProcessing;
    getFeedbackLoopStatus(loopId?: string): Promise<any>;
    getSystemLearningState(): Promise<any>;
    activateFeedbackLoop(loopId: string): Promise<void>;
    deactivateFeedbackLoop(loopId: string): Promise<void>;
}
//# sourceMappingURL=knowledge-feedback-system.d.ts.map