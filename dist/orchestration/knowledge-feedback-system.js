"use strict";
// Knowledge Feedback Loops and Learning Mechanisms
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeFeedbackSystem = exports.FeedbackFrequency = exports.FeedbackLoopType = void 0;
const events_1 = require("events");
const types_1 = require("./types");
var FeedbackLoopType;
(function (FeedbackLoopType) {
    FeedbackLoopType["PERFORMANCE"] = "PERFORMANCE";
    FeedbackLoopType["QUALITY"] = "QUALITY";
    FeedbackLoopType["LEARNING"] = "LEARNING";
    FeedbackLoopType["ADAPTATION"] = "ADAPTATION";
    FeedbackLoopType["VALIDATION"] = "VALIDATION";
    FeedbackLoopType["OPTIMIZATION"] = "OPTIMIZATION";
})(FeedbackLoopType || (exports.FeedbackLoopType = FeedbackLoopType = {}));
var FeedbackFrequency;
(function (FeedbackFrequency) {
    FeedbackFrequency["REALTIME"] = "REALTIME";
    FeedbackFrequency["PER_STEP"] = "PER_STEP";
    FeedbackFrequency["PER_PHASE"] = "PER_PHASE";
    FeedbackFrequency["PER_MILESTONE"] = "PER_MILESTONE";
    FeedbackFrequency["PER_PROJECT"] = "PER_PROJECT";
    FeedbackFrequency["ADAPTIVE"] = "ADAPTIVE";
})(FeedbackFrequency || (exports.FeedbackFrequency = FeedbackFrequency = {}));
class KnowledgeFeedbackSystem extends events_1.EventEmitter {
    logger;
    knowledgeGraph;
    knowledgeRepo;
    projectKB;
    feedbackLoops = new Map();
    learningState = new Map();
    feedbackQueue = [];
    isProcessing = false;
    continuousLearning;
    systemMemory = new SystemMemory();
    constructor(logger, knowledgeGraph, knowledgeRepo, projectKB, config) {
        super();
        this.logger = logger;
        this.knowledgeGraph = knowledgeGraph;
        this.knowledgeRepo = knowledgeRepo;
        this.projectKB = projectKB;
        this.continuousLearning = config || {
            enabled: true,
            learningRate: 0.1,
            adaptationThreshold: 0.8,
            maxMemorySize: 10000,
            forgettingCurve: {
                enabled: true,
                decayRate: 0.95,
                minimumRetention: 0.1,
                importanceWeighting: true
            },
            reinforcementLearning: {
                enabled: true,
                rewardFunction: 'quality_improvement',
                explorationRate: 0.1,
                discountFactor: 0.9
            }
        };
        this?.initializeFeedbackLoops();
        this?.startFeedbackProcessing();
    }
    initializeFeedbackLoops() {
        // Performance feedback loop
        this?.createFeedbackLoop({
            id: 'performance-optimization',
            type: FeedbackLoopType.PERFORMANCE,
            source: {
                type: 'role_outcome',
                roleTypes: Object.values(types_1.RoleType),
                dataTypes: ['execution_time', 'resource_usage', 'throughput'],
                samplingStrategy: 'all',
                samplingRate: 1.0
            },
            target: {
                type: 'system_optimization',
                updateMechanism: 'batch',
                persistenceLevel: 'permanent',
                propagationRules: [
                    {
                        condition: 'performance_degradation > 0.2',
                        targets: ['role_configuration', 'resource_allocation'],
                        priority: 1
                    }
                ]
            },
            dataFlow: {
                inputFormat: 'role_metrics',
                transformations: [
                    {
                        name: 'performance_aggregation',
                        operation: 'rolling_average',
                        parameters: { window: 10 },
                        validation: 'positive_numbers'
                    }
                ],
                outputFormat: 'performance_recommendations',
                validationRules: [
                    {
                        field: 'execution_time',
                        rule: 'positive',
                        errorAction: 'flag'
                    }
                ]
            },
            frequency: FeedbackFrequency.PER_STEP,
            aggregationRules: [
                {
                    field: 'execution_time',
                    operation: 'average',
                    groupBy: ['roleType', 'step'],
                    timeWindow: 3600000, // 1 hour
                    weightingStrategy: {
                        type: 'recency',
                        parameters: { decayFactor: 0.95 }
                    }
                }
            ],
            qualityFilters: [
                {
                    field: 'confidence',
                    operator: 'gte',
                    value: 0.7,
                    action: 'include'
                }
            ],
            learningMechanisms: [
                {
                    type: 'trend_analysis',
                    algorithm: 'linear_regression',
                    parameters: { min_samples: 10 },
                    confidenceThreshold: 0.8,
                    validationMethod: 'cross_validation'
                }
            ],
            isActive: true,
            metrics: this?.initializeFeedbackMetrics()
        });
        // Quality improvement feedback loop
        this?.createFeedbackLoop({
            id: 'quality-improvement',
            type: FeedbackLoopType.QUALITY,
            source: {
                type: 'role_outcome',
                roleTypes: [types_1.RoleType.QUALITY_AUDITOR, types_1.RoleType.CODE_REVIEWER, types_1.RoleType.SECURITY_AUDITOR],
                dataTypes: ['quality_scores', 'issues_found', 'improvements_suggested'],
                samplingStrategy: 'all',
                samplingRate: 1.0
            },
            target: {
                type: 'knowledge_graph',
                updateMechanism: 'immediate',
                persistenceLevel: 'permanent',
                propagationRules: [
                    {
                        condition: 'quality_score < 0.8',
                        targets: ['best_practices', 'anti_patterns'],
                        priority: 1
                    }
                ]
            },
            dataFlow: {
                inputFormat: 'quality_assessment',
                transformations: [
                    {
                        name: 'quality_pattern_extraction',
                        operation: 'pattern_mining',
                        parameters: { min_support: 0.3 },
                        validation: 'valid_patterns'
                    }
                ],
                outputFormat: 'quality_insights',
                validationRules: [
                    {
                        field: 'quality_score',
                        rule: 'range_0_1',
                        errorAction: 'discard'
                    }
                ]
            },
            frequency: FeedbackFrequency.PER_STEP,
            aggregationRules: [
                {
                    field: 'quality_score',
                    operation: 'average',
                    groupBy: ['roleType', 'feature_type'],
                    timeWindow: 86400000 // 1 day
                }
            ],
            qualityFilters: [
                {
                    field: 'sample_size',
                    operator: 'gte',
                    value: 5,
                    action: 'include'
                }
            ],
            learningMechanisms: [
                {
                    type: 'pattern_recognition',
                    algorithm: 'clustering',
                    parameters: { n_clusters: 5 },
                    confidenceThreshold: 0.75,
                    validationMethod: 'silhouette_score'
                }
            ],
            isActive: true,
            metrics: this?.initializeFeedbackMetrics()
        });
        // Learning effectiveness feedback loop
        this?.createFeedbackLoop({
            id: 'learning-effectiveness',
            type: FeedbackLoopType.LEARNING,
            source: {
                type: 'role_outcome',
                roleTypes: Object.values(types_1.RoleType),
                dataTypes: ['learning_outcomes', 'knowledge_utilization', 'decision_confidence'],
                samplingStrategy: 'stratified',
                samplingRate: 0.8
            },
            target: {
                type: 'rag_context',
                updateMechanism: 'periodic',
                persistenceLevel: 'project',
                propagationRules: [
                    {
                        condition: 'knowledge_utilization < 0.6',
                        targets: ['knowledge_repository', 'context_generation'],
                        priority: 2
                    }
                ]
            },
            dataFlow: {
                inputFormat: 'learning_data',
                transformations: [
                    {
                        name: 'learning_effectiveness_analysis',
                        operation: 'correlation_analysis',
                        parameters: { significance_level: 0.05 },
                        validation: 'statistical_significance'
                    }
                ],
                outputFormat: 'learning_recommendations',
                validationRules: [
                    {
                        field: 'correlation_coefficient',
                        rule: 'range_minus1_1',
                        errorAction: 'flag'
                    }
                ]
            },
            frequency: FeedbackFrequency.PER_PHASE,
            aggregationRules: [
                {
                    field: 'knowledge_utilization',
                    operation: 'median',
                    groupBy: ['roleType', 'knowledge_type'],
                    timeWindow: 604800000 // 1 week
                }
            ],
            qualityFilters: [
                {
                    field: 'outcome_confidence',
                    operator: 'gte',
                    value: 0.6,
                    action: 'include'
                }
            ],
            learningMechanisms: [
                {
                    type: 'causal_inference',
                    algorithm: 'propensity_matching',
                    parameters: { matching_tolerance: 0.1 },
                    confidenceThreshold: 0.85,
                    validationMethod: 'randomized_trial'
                }
            ],
            isActive: true,
            metrics: this?.initializeFeedbackMetrics()
        });
        // Adaptation feedback loop
        this?.createFeedbackLoop({
            id: 'system-adaptation',
            type: FeedbackLoopType.ADAPTATION,
            source: {
                type: 'system_metric',
                dataTypes: ['workflow_efficiency', 'resource_utilization', 'error_rates'],
                samplingStrategy: 'adaptive',
                samplingRate: 1.0
            },
            target: {
                type: 'system_optimization',
                updateMechanism: 'threshold_based',
                persistenceLevel: 'permanent',
                propagationRules: [
                    {
                        condition: 'efficiency_drop > 0.15',
                        targets: ['workflow_configuration', 'resource_allocation', 'role_parameters'],
                        priority: 1
                    }
                ]
            },
            dataFlow: {
                inputFormat: 'system_metrics',
                transformations: [
                    {
                        name: 'adaptation_signal_detection',
                        operation: 'change_point_detection',
                        parameters: { sensitivity: 0.8 },
                        validation: 'statistical_change'
                    }
                ],
                outputFormat: 'adaptation_recommendations',
                validationRules: [
                    {
                        field: 'change_significance',
                        rule: 'positive',
                        errorAction: 'discard'
                    }
                ]
            },
            frequency: FeedbackFrequency.ADAPTIVE,
            aggregationRules: [
                {
                    field: 'efficiency_score',
                    operation: 'average',
                    groupBy: ['workflow_type', 'complexity_level'],
                    timeWindow: 2592000000 // 30 days
                }
            ],
            qualityFilters: [
                {
                    field: 'data_completeness',
                    operator: 'gte',
                    value: 0.9,
                    action: 'include'
                }
            ],
            learningMechanisms: [
                {
                    type: 'anomaly_detection',
                    algorithm: 'isolation_forest',
                    parameters: { contamination: 0.1 },
                    confidenceThreshold: 0.9,
                    validationMethod: 'cross_validation'
                }
            ],
            isActive: true,
            metrics: this?.initializeFeedbackMetrics()
        });
        this.logger.info(`Initialized ${this.feedbackLoops.size} feedback loops`);
    }
    createFeedbackLoop(config) {
        this.feedbackLoops?.set(config.id, config);
    }
    initializeFeedbackMetrics() {
        return {
            totalFeedbackItems: 0,
            processedItems: 0,
            learningInsights: 0,
            qualityImprovements: 0,
            systemOptimizations: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            lastUpdate: new Date()
        };
    }
    async processFeedback(roleOutcome, executionContext) {
        // Create feedback items for relevant loops
        const feedbackItems = [];
        for (const [loopId, loop] of this.feedbackLoops) {
            if (this?.shouldProcessFeedback(loop, roleOutcome)) {
                const item = {
                    id: `${loopId}-${Date?.now()}`,
                    loopId,
                    source: roleOutcome,
                    timestamp: new Date(),
                    processed: false,
                    quality: this?.assessFeedbackQuality(roleOutcome, loop),
                    metadata: {
                        executionId: roleOutcome.executionId,
                        roleType: roleOutcome.roleType,
                        context: executionContext
                    }
                };
                feedbackItems?.push(item);
            }
        }
        // Add to processing queue
        this.feedbackQueue?.push(...feedbackItems);
        this?.emit('feedback-queued', {
            count: feedbackItems?.length,
            queueSize: this.feedbackQueue?.length
        });
        // Trigger processing if not already running
        if (!this.isProcessing) {
            await this?.processFeedbackQueue();
        }
    }
    shouldProcessFeedback(loop, outcome) {
        if (!loop.isActive)
            return false;
        // Check if role type matches
        if (loop.source.roleTypes && !loop.source.roleTypes?.includes(outcome.roleType)) {
            return false;
        }
        // Check sampling strategy
        switch (loop.source.samplingStrategy) {
            case 'all':
                return true;
            case 'random':
                return Math.random() < loop.source.samplingRate;
            case 'stratified':
                return this?.shouldIncludeInStratifiedSample(outcome, loop);
            case 'adaptive':
                return this?.shouldIncludeInAdaptiveSample(outcome, loop);
            default:
                return false;
        }
    }
    shouldIncludeInStratifiedSample(outcome, loop) {
        // Implement stratified sampling logic
        const stratum = this?.getStratum(outcome);
        const stratumSampleRate = this?.getStratumSampleRate(stratum, loop);
        return Math.random() < stratumSampleRate;
    }
    shouldIncludeInAdaptiveSample(outcome, loop) {
        // Implement adaptive sampling based on recent system performance
        const recentPerformance = this?.getRecentPerformanceMetrics(loop);
        const adaptiveSampleRate = this?.calculateAdaptiveSampleRate(recentPerformance, loop);
        return Math.random() < adaptiveSampleRate;
    }
    async processFeedbackQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        this.logger.info(`Processing feedback queue: ${this.feedbackQueue?.length} items`);
        try {
            while (this.feedbackQueue?.length > 0) {
                const item = this.feedbackQueue?.shift();
                await this?.processFeedbackItem(item);
            }
        }
        catch (error) {
            this.logger.error('Error processing feedback queue', error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processFeedbackItem(item) {
        const startTime = Date?.now();
        const loop = this.feedbackLoops?.get(item.loopId);
        try {
            // Validate feedback quality
            if (!this?.passesQualityFilters(item, loop)) {
                this.logger.debug(`Feedback item ${item.id} failed quality filters`);
                return;
            }
            // Transform data
            const transformedData = await this?.transformFeedbackData(item, loop);
            // Apply aggregation rules
            const aggregatedData = await this?.aggregateFeedbackData(transformedData, loop);
            // Apply learning mechanisms
            const insights = await this?.applyLearningMechanisms(aggregatedData, loop);
            // Update target systems
            await this?.updateTargetSystems(insights, loop);
            // Update continuous learning state
            if (this.continuousLearning.enabled) {
                await this?.updateLearningState(insights, loop);
            }
            // Update metrics
            this?.updateFeedbackMetrics(loop, startTime, true);
            item.processed = true;
            this?.emit('feedback-processed', { item, insights });
        }
        catch (error) {
            this.logger.error(`Error processing feedback item ${item.id}`, error);
            this?.updateFeedbackMetrics(loop, startTime, false);
            item.processed = false;
            item.error = error;
        }
    }
    passesQualityFilters(item, loop) {
        return loop.qualityFilters?.every(filter => {
            const value = this?.extractFieldValue(item, filter.field);
            return this?.evaluateFilter(value, filter);
        });
    }
    async transformFeedbackData(item, loop) {
        let data = item.source;
        for (const transformation of loop.dataFlow.transformations) {
            data = await this?.applyTransformation(data, transformation);
        }
        return data;
    }
    async aggregateFeedbackData(data, loop) {
        const aggregated = {};
        for (const rule of loop.aggregationRules) {
            const values = this?.extractValuesForAggregation(data, rule);
            aggregated[rule.field] = this?.applyAggregation(values, rule);
        }
        return aggregated;
    }
    async applyLearningMechanisms(data, loop) {
        const insights = [];
        for (const mechanism of loop.learningMechanisms) {
            try {
                const insight = await this?.applyLearningMechanism(data, mechanism);
                if (insight.confidence >= mechanism.confidenceThreshold) {
                    insights?.push(insight);
                }
            }
            catch (error) {
                this.logger.error(`Learning mechanism ${mechanism.type} failed`, error);
            }
        }
        return insights;
    }
    async updateTargetSystems(insights, loop) {
        for (const insight of insights) {
            switch (loop.target.type) {
                case 'knowledge_graph':
                    await this?.updateKnowledgeGraph(insight);
                    break;
                case 'rag_context':
                    await this?.updateRAGContext(insight);
                    break;
                case 'role_learning':
                    await this?.updateRoleLearning(insight);
                    break;
                case 'project_kb':
                    await this?.updateProjectKB(insight);
                    break;
                case 'system_optimization':
                    await this?.updateSystemOptimization(insight);
                    break;
            }
        }
    }
    async updateLearningState(insights, loop) {
        if (!this.continuousLearning.enabled)
            return;
        // Update system memory
        this.systemMemory?.addInsights(insights);
        // Apply forgetting curve if enabled
        if (this.continuousLearning.forgettingCurve.enabled) {
            this.systemMemory?.applyForgetting(this.continuousLearning.forgettingCurve);
        }
        // Reinforcement learning updates
        if (this.continuousLearning.reinforcementLearning.enabled) {
            await this?.updateReinforcementLearning(insights, loop);
        }
        // Adaptation based on learning
        if (this?.shouldAdapt(insights)) {
            await this?.adaptSystem(insights);
        }
    }
    shouldAdapt(insights) {
        const avgConfidence = insights?.reduce((sum, i) => sum + i.confidence, 0) / insights?.length;
        return avgConfidence >= this.continuousLearning.adaptationThreshold;
    }
    async adaptSystem(insights) {
        // Implement system adaptation based on insights
        for (const insight of insights) {
            if (insight?.type === 'performance_optimization') {
                await this?.optimizeSystemPerformance(insight);
            }
            else if (insight?.type === 'quality_improvement') {
                await this?.improveSystemQuality(insight);
            }
            else if (insight?.type === 'learning_enhancement') {
                await this?.enhanceSystemLearning(insight);
            }
        }
        this?.emit('system-adapted', { insights: insights?.length });
    }
    // Helper method implementations
    assessFeedbackQuality(outcome, loop) {
        // Assess quality based on outcome completeness, confidence, and relevance
        let quality = 0;
        if (outcome.success)
            quality += 0.3;
        quality += outcome?.qualityScore * 0.4;
        quality += (outcome.insights?.length / 5) * 0.3;
        return Math.min(1, quality);
    }
    getStratum(outcome) {
        return `${outcome.roleType}-${outcome.success ? 'success' : 'failure'}`;
    }
    getStratumSampleRate(stratum, loop) {
        // Return stratum-specific sample rate (simplified)
        return loop.source.samplingRate;
    }
    getRecentPerformanceMetrics(loop) {
        return { avgProcessingTime: 100, errorRate: 0.05 };
    }
    calculateAdaptiveSampleRate(performance, loop) {
        // Higher sample rate when performance is poor
        const baseRate = loop.source.samplingRate;
        const performanceMultiplier = 1 + performance?.errorRate * 2;
        return Math.min(1, baseRate * performanceMultiplier);
    }
    extractFieldValue(item, field) {
        // Extract field value from feedback item
        const fields = field?.split('.');
        let value = item;
        for (const f of fields) {
            value = value?.[f];
        }
        return value;
    }
    evaluateFilter(value, filter) {
        switch (filter.operator) {
            case 'gt': return value > filter.value;
            case 'gte': return value >= filter.value;
            case 'lt': return value < filter.value;
            case 'lte': return value <= filter.value;
            case 'eq': return value === filter.value;
            case 'neq': return value !== filter.value;
            case 'in': return Array.isArray(filter.value) && filter.value?.includes(value);
            case 'not_in': return Array.isArray(filter.value) && !filter.value?.includes(value);
            default: return true;
        }
    }
    async applyTransformation(data, transformation) {
        // Apply data transformation (simplified implementation)
        switch (transformation.operation) {
            case 'rolling_average':
                return this?.calculateRollingAverage(data, transformation.parameters.window);
            case 'pattern_mining':
                return this?.extractPatterns(data, transformation.parameters.min_support);
            default:
                return data;
        }
    }
    extractValuesForAggregation(data, rule) {
        // Extract values for aggregation based on rule
        if (Array.isArray(data)) {
            return data?.map(item => item[rule.field]).filter(val => val !== undefined);
        }
        return [data[rule.field]].filter(val => val !== undefined);
    }
    applyAggregation(values, rule) {
        if (values?.length === 0)
            return null;
        switch (rule.operation) {
            case 'sum': return values?.reduce((sum, val) => sum + val, 0);
            case 'average': return values?.reduce((sum, val) => sum + val, 0) / values?.length;
            case 'median': return this?.calculateMedian(values);
            case 'max': return Math.max(...values);
            case 'min': return Math.min(...values);
            case 'count': return values?.length;
            case 'std_dev': return this?.calculateStdDev(values);
            default: return values[0];
        }
    }
    async applyLearningMechanism(data, mechanism) {
        // Apply learning mechanism (simplified implementation)
        switch (mechanism.type) {
            case 'pattern_recognition':
                return this?.recognizePatterns(data, mechanism);
            case 'trend_analysis':
                return this?.analyzeTrends(data, mechanism);
            case 'anomaly_detection':
                return this?.detectAnomalies(data, mechanism);
            default:
                return {
                    type: 'general',
                    description: 'Learning insight generated',
                    confidence: 0.5,
                    data: data,
                    mechanism: mechanism.type
                };
        }
    }
    updateFeedbackMetrics(loop, startTime, success) {
        const processingTime = Date?.now() - startTime;
        if (loop.metrics)
            loop.metrics.totalFeedbackItems++;
        if (success) {
            if (loop.metrics)
                loop.metrics.processedItems++;
        }
        // Update average processing time
        const totalTime = loop.metrics?.averageProcessingTime * (loop.metrics?.totalFeedbackItems - 1);
        loop.metrics.averageProcessingTime = (totalTime + processingTime) / loop.metrics.totalFeedbackItems;
        // Update error rate
        const errors = loop.metrics?.totalFeedbackItems - loop.metrics.processedItems;
        loop.metrics.errorRate = errors / loop.metrics.totalFeedbackItems;
        loop.metrics.lastUpdate = new Date();
    }
    // Utility methods for calculations
    calculateRollingAverage(data, window) {
        // Implement rolling average calculation
        return data; // Simplified
    }
    extractPatterns(data, minSupport) {
        // Implement pattern extraction
        return { patterns: [] }; // Simplified
    }
    calculateMedian(values) {
        const sorted = values?.sort((a, b) => a - b);
        const mid = Math.floor(sorted?.length / 2);
        return sorted?.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }
    calculateStdDev(values) {
        const mean = values?.reduce((sum, val) => sum + val, 0) / values?.length;
        const squaredDiffs = values?.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs?.reduce((sum, val) => sum + val, 0) / values?.length;
        return Math.sqrt(avgSquaredDiff);
    }
    async recognizePatterns(data, mechanism) {
        return {
            type: 'pattern_recognition',
            description: 'Pattern recognized in feedback data',
            confidence: 0.8,
            data: { patterns: [] },
            mechanism: mechanism.type
        };
    }
    async analyzeTrends(data, mechanism) {
        return {
            type: 'trend_analysis',
            description: 'Trend identified in feedback data',
            confidence: 0.85,
            data: { trend: 'improving' },
            mechanism: mechanism.type
        };
    }
    async detectAnomalies(data, mechanism) {
        return {
            type: 'anomaly_detection',
            description: 'Anomaly detected in feedback data',
            confidence: 0.9,
            data: { anomalies: [] },
            mechanism: mechanism.type
        };
    }
    // Target system update methods
    async updateKnowledgeGraph(insight) {
        // Update knowledge graph with new insights
        this?.emit('knowledge-graph-updated', insight);
    }
    async updateRAGContext(insight) {
        // Update RAG context with new insights
        this?.emit('rag-context-updated', insight);
    }
    async updateRoleLearning(insight) {
        // Update role learning databases
        this?.emit('role-learning-updated', insight);
    }
    async updateProjectKB(insight) {
        // Update project knowledge base
        this?.emit('project-kb-updated', insight);
    }
    async updateSystemOptimization(insight) {
        // Update system optimization parameters
        this?.emit('system-optimization-updated', insight);
    }
    async updateReinforcementLearning(insights, loop) {
        // Update reinforcement learning state
        this?.emit('reinforcement-learning-updated', { insights, loop: loop.id });
    }
    async optimizeSystemPerformance(insight) {
        // Optimize system performance based on insight
        this?.emit('performance-optimized', insight);
    }
    async improveSystemQuality(insight) {
        // Improve system quality based on insight
        this?.emit('quality-improved', insight);
    }
    async enhanceSystemLearning(insight) {
        // Enhance system learning capabilities
        this?.emit('learning-enhanced', insight);
    }
    startFeedbackProcessing() {
        // Start periodic processing
        setInterval(() => {
            if (this.feedbackQueue?.length > 0 && !this.isProcessing) {
                this?.processFeedbackQueue();
            }
        }, 5000); // Process every 5 seconds
    }
    // Public API
    async getFeedbackLoopStatus(loopId) {
        if (loopId) {
            const loop = this.feedbackLoops?.get(loopId);
            return loop ? { loop, metrics: loop.metrics } : null;
        }
        return Array.from(this.feedbackLoops?.entries()).map(([id, loop]) => ({
            id,
            type: loop.type,
            isActive: loop.isActive,
            metrics: loop.metrics
        }));
    }
    async getSystemLearningState() {
        return {
            continuousLearning: this.continuousLearning,
            memorySize: this.systemMemory?.getSize(),
            queueSize: this.feedbackQueue?.length,
            isProcessing: this.isProcessing
        };
    }
    async activateFeedbackLoop(loopId) {
        const loop = this.feedbackLoops?.get(loopId);
        if (loop) {
            loop.isActive = true;
            this?.emit('feedback-loop-activated', loopId);
        }
    }
    async deactivateFeedbackLoop(loopId) {
        const loop = this.feedbackLoops?.get(loopId);
        if (loop) {
            loop.isActive = false;
            this?.emit('feedback-loop-deactivated', loopId);
        }
    }
}
exports.KnowledgeFeedbackSystem = KnowledgeFeedbackSystem;
class SystemMemory {
    insights = new Map();
    maxSize = 10000;
    addInsights(insights) {
        insights?.forEach(insight => {
            if (!this.insights?.has(insight.type)) {
                this.insights?.set(insight.type, []);
            }
            const typeInsights = this.insights?.get(insight.type);
            typeInsights?.push(insight);
            // Maintain size limit
            if (typeInsights?.length > this?.maxSize / this.insights.size) {
                typeInsights?.shift(); // Remove oldest
            }
        });
    }
    applyForgetting(config) {
        for (const [type, insights] of this.insights) {
            insights?.forEach(insight => {
                if (insight)
                    insight.confidence *= config.decayRate;
            });
            // Remove insights below minimum retention
            const filtered = insights?.filter(i => i.confidence >= config.minimumRetention);
            this.insights?.set(type, filtered);
        }
    }
    getSize() {
        return Array.from(this.insights?.values()).reduce((sum, insights) => sum + insights?.length, 0);
    }
}
//# sourceMappingURL=knowledge-feedback-system.js.map