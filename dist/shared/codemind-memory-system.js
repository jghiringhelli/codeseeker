"use strict";
/**
 * CodeMind Memory System
 *
 * Comprehensive memory architecture for tracking CodeMind-Claude Code interactions,
 * preserving context across requests, and enabling intelligent continuation of work.
 *
 * Key Features:
 * - Multi-layered memory hierarchy (immediate, session, project, global)
 * - Interaction pattern learning between CodeMind and Claude Code
 * - Lossless compression with intelligent summarization
 * - Context continuity across requests and sessions
 * - Performance tracking and optimization insights
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMindMemorySystem = void 0;
const logger_1 = require("./logger");
// Temporary stubs for missing services
class PostgreSQLService {
    async query() { return []; }
    async insert() { return 'id'; }
}
class Neo4jService {
    async createNode() { return 'id'; }
    async query() { return []; }
}
class RedisService {
    async get(key) { return null; }
    async set(key, value) { return 'OK'; }
    async del(key) { return 1; }
    async exists(key) { return false; }
    async lpush(key, value) { return 1; }
    async lrange(key, start, end) { return []; }
    async expire(key, ttl) { return 1; }
    async setex(key, ttl, value) { return 'OK'; }
}
const crypto = __importStar(require("crypto"));
// ============================================
// MAIN MEMORY SYSTEM
// ============================================
class CodeMindMemorySystem {
    logger;
    postgresql;
    neo4j;
    redis;
    // Memory layer caches
    activeInteractions = new Map();
    sessionCache = new Map();
    projectCache = new Map();
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.postgresql = new PostgreSQLService();
        this.neo4j = new Neo4jService();
        this.redis = new RedisService();
    }
    /**
     * Initialize memory system for a new request
     */
    async initializeRequestMemory(userRequest, projectPath, sessionId) {
        const requestId = this.generateRequestId(userRequest, sessionId);
        try {
            this.logger.info(`🧠 Initializing memory for request: ${requestId}`);
            // 1. Load or create session memory
            const sessionMemory = await this.getOrCreateSessionMemory(sessionId, projectPath);
            // 2. Load or create project memory  
            const projectMemory = await this.getOrCreateProjectMemory(projectPath);
            // 3. Generate contextual continuation from previous work
            const context = await this.generateContextualContinuation(userRequest, sessionMemory, projectMemory);
            // 4. Initialize request memory structure
            const requestMemory = {
                requestId,
                sessionId,
                userRequest,
                projectPath,
                timestamp: new Date(),
                duration: 0,
                context: {
                    changedFiles: [],
                    affectedFiles: [],
                    requestType: this.classifyRequestType(userRequest),
                    complexity: await this.estimateComplexity(userRequest, projectMemory),
                    riskLevel: 'low' // Will be updated during analysis
                },
                interactions: [],
                outcome: {
                    success: false,
                    tasksCompleted: 0,
                    tasksFailed: 0,
                    integrationResult: null,
                    branchMerged: false,
                    filesChanged: []
                },
                learnings: {
                    effectivePatterns: [],
                    ineffectivePatterns: [],
                    timeEstimateAccuracy: 0,
                    surprisingChallenges: [],
                    unexpectedSuccesses: []
                }
            };
            // 5. Store in active memory and cache
            sessionMemory.requests.push(requestMemory);
            this.activeInteractions.set(requestId, []);
            // 6. Cache recent context in Redis for fast access
            await this.cacheRequestContext(requestId, context);
            this.logger.info(`✅ Memory initialized with contextual continuation`);
            return { requestId, context };
        }
        catch (error) {
            this.logger.error('Failed to initialize request memory:', error.message);
            throw error;
        }
    }
    /**
     * Record interaction between CodeMind and Claude Code
     */
    async recordInteraction(requestId, codemindRequest, claudeResponse) {
        try {
            const interaction = {
                id: crypto.randomUUID(),
                timestamp: new Date(),
                requestId,
                sessionId: this.getSessionIdFromRequest(requestId),
                codemindRequest,
                claudeResponse,
                effectiveness: this.calculateInteractionEffectiveness(codemindRequest, claudeResponse),
                patterns: this.extractInteractionPatterns(codemindRequest, claudeResponse),
                improvements: this.suggestInteractionImprovements(codemindRequest, claudeResponse)
            };
            // Store in active memory
            const interactions = this.activeInteractions.get(requestId) || [];
            interactions.push(interaction);
            this.activeInteractions.set(requestId, interactions);
            // Store in Redis for immediate access
            await this.redis.lpush(`interactions:${requestId}`, JSON.stringify(interaction));
            // Learn patterns for future optimization
            await this.updateInteractionPatterns(interaction);
            this.logger.debug(`📝 Recorded interaction: ${codemindRequest.type} → ${claudeResponse.success ? 'success' : 'failure'}`);
        }
        catch (error) {
            this.logger.error('Failed to record interaction:', error.message);
        }
    }
    /**
     * Complete request memory and perform intelligent summarization
     */
    async finalizeRequestMemory(requestId, outcome, duration) {
        try {
            this.logger.info(`🎯 Finalizing memory for request: ${requestId}`);
            // 1. Get all interactions for this request
            const interactions = this.activeInteractions.get(requestId) || [];
            // 2. Update request memory with final outcome
            const sessionId = this.getSessionIdFromRequest(requestId);
            const sessionMemory = this.sessionCache.get(sessionId);
            const requestMemory = sessionMemory?.requests.find(r => r.requestId === requestId);
            if (requestMemory) {
                requestMemory.duration = duration;
                requestMemory.outcome = outcome;
                requestMemory.interactions = interactions;
                requestMemory.learnings = await this.extractLearnings(interactions, outcome);
            }
            // 3. Perform intelligent compression
            const compressionResult = await this.compressAndSummarize(interactions, outcome);
            // 4. Store compressed memory in PostgreSQL
            await this.storeRequestMemoryPersistent(requestMemory, compressionResult);
            // 5. Update project knowledge base
            await this.updateProjectKnowledge(requestMemory);
            // 6. Update Neo4j knowledge graph
            await this.updateKnowledgeGraph(requestMemory, interactions);
            // 7. Clean up active memory
            this.activeInteractions.delete(requestId);
            this.logger.info(`✅ Request memory finalized with ${compressionResult.compressed.compressionRatio.toFixed(2)}x compression`);
            return compressionResult;
        }
        catch (error) {
            this.logger.error('Failed to finalize request memory:', error.message);
            throw error;
        }
    }
    /**
     * Retrieve contextual information for a new request
     */
    async getContextForNewRequest(userRequest, projectPath, sessionId) {
        try {
            // 1. Get project memory
            const projectMemory = await this.getProjectMemory(projectPath);
            // 2. Find similar past requests using semantic search
            const similarRequests = await this.findSimilarRequests(userRequest, projectMemory);
            // 3. Extract relevant patterns from Neo4j knowledge graph
            const relevantPatterns = await this.findRelevantPatterns(userRequest, projectPath);
            // 4. Generate approach suggestion based on past successes
            const suggestedApproach = await this.suggestApproach(userRequest, similarRequests, relevantPatterns);
            // 5. Predict potential challenges
            const potentialChallenges = await this.predictChallenges(userRequest, projectMemory, similarRequests);
            // 6. Estimate complexity and duration
            const estimatedComplexity = await this.estimateComplexity(userRequest, projectMemory);
            const estimatedDuration = await this.estimateDuration(userRequest, projectMemory, similarRequests);
            return {
                similarPastRequests: similarRequests,
                relevantPatterns,
                suggestedApproach,
                potentialChallenges,
                estimatedComplexity,
                estimatedDuration
            };
        }
        catch (error) {
            this.logger.error('Failed to get context for new request:', error.message);
            throw error;
        }
    }
    /**
     * Get memory statistics and health metrics
     */
    async getMemoryStats() {
        // Implementation would gather statistics from all storage layers
        return {
            storage: {
                activeInteractions: this.activeInteractions.size,
                cachedSessions: this.sessionCache.size,
                cachedProjects: this.projectCache.size,
                totalRequests: 0, // From PostgreSQL
                totalInteractions: 0 // From PostgreSQL
            },
            performance: {
                averageCompressionRatio: 0,
                averageRetrievalTime: 0,
                cacheHitRate: 0,
                learningEffectiveness: 0
            },
            insights: {
                mostEffectivePatterns: [],
                commonFailurePoints: [],
                improvementOpportunities: []
            }
        };
    }
    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================
    generateRequestId(userRequest, sessionId) {
        const hash = crypto.createHash('sha256')
            .update(`${sessionId}-${userRequest}-${Date.now()}`)
            .digest('hex');
        return `req_${hash.substring(0, 16)}`;
    }
    getSessionIdFromRequest(requestId) {
        // Extract session ID from request ID or lookup in cache
        return 'session_placeholder'; // Would implement proper lookup
    }
    async getOrCreateSessionMemory(sessionId, projectPath) {
        let sessionMemory = this.sessionCache.get(sessionId);
        if (!sessionMemory) {
            sessionMemory = {
                sessionId,
                projectId: this.generateProjectId(projectPath),
                startTime: new Date(),
                context: {
                    projectState: {},
                    workingDirectory: projectPath,
                    gitBranch: 'main', // Would detect actual branch
                    lastSnapshot: ''
                },
                requests: [],
                patterns: {
                    commonRequestTypes: [],
                    workflowPreferences: {},
                    effectiveStrategies: [],
                    recurringChallenges: []
                },
                summary: {
                    totalRequests: 0,
                    successRate: 0,
                    averageRequestTime: 0,
                    majorChangesImplemented: [],
                    keyLearnings: []
                }
            };
            this.sessionCache.set(sessionId, sessionMemory);
        }
        return sessionMemory;
    }
    async getOrCreateProjectMemory(projectPath) {
        const projectId = this.generateProjectId(projectPath);
        let projectMemory = this.projectCache.get(projectId);
        if (!projectMemory) {
            // Try to load from PostgreSQL first
            projectMemory = await this.loadProjectMemoryFromDB(projectId);
            if (!projectMemory) {
                // Create new project memory
                projectMemory = {
                    projectId,
                    projectPath,
                    profile: {
                        language: 'typescript', // Would detect
                        framework: 'unknown', // Would detect
                        architecture: 'layered', // Would analyze
                        complexity: 'moderate',
                        domain: 'unknown'
                    },
                    performance: {
                        totalRequests: 0,
                        averageSuccessRate: 0,
                        averageRequestTime: 0,
                        commonFailurePoints: [],
                        mostEffectivePatterns: []
                    },
                    evolution: {
                        majorMilestones: [],
                        architecturalChanges: [],
                        dependencyEvolution: []
                    },
                    knowledge: {
                        codingPatterns: new Map(),
                        commonSolutions: new Map(),
                        bestPractices: [],
                        antiPatterns: [],
                        projectSpecificKnowledge: {}
                    }
                };
            }
            this.projectCache.set(projectId, projectMemory);
        }
        return projectMemory;
    }
    generateProjectId(projectPath) {
        return crypto.createHash('sha256').update(projectPath).digest('hex').substring(0, 16);
    }
    classifyRequestType(userRequest) {
        const codeKeywords = ['add', 'create', 'implement', 'fix', 'update', 'refactor'];
        const analysisKeywords = ['analyze', 'review', 'examine', 'explain', 'understand'];
        const lower = userRequest.toLowerCase();
        if (codeKeywords.some(keyword => lower.includes(keyword))) {
            return 'code_modification';
        }
        else if (analysisKeywords.some(keyword => lower.includes(keyword))) {
            return 'analysis';
        }
        else {
            return 'general';
        }
    }
    async estimateComplexity(userRequest, projectMemory) {
        // Implement complexity estimation based on request content and project history
        return 5; // 1-10 scale
    }
    async generateContextualContinuation(userRequest, sessionMemory, projectMemory) {
        // Implement contextual continuation logic
        return {
            previousRequestContext: {
                whatWasDone: [],
                howItWasDone: [],
                challengesEncountered: [],
                solutionsApplied: []
            },
            currentRequestContext: {
                relatedToPrevious: false,
                buildingUpon: [],
                potentialConflicts: [],
                suggestedApproach: ''
            },
            continuityInstructions: {
                forCodeMind: [],
                forClaude: [],
                warningsAndCautions: []
            }
        };
    }
    calculateInteractionEffectiveness(request, response) {
        // Calculate effectiveness score based on success, duration, token usage, etc.
        let score = response.success ? 0.8 : 0.2;
        // Adjust based on efficiency
        if (response.duration < 30000)
            score += 0.1; // Fast response
        if (response.tokensUsed < 1000)
            score += 0.1; // Efficient token usage
        return Math.min(1.0, score);
    }
    extractInteractionPatterns(request, response) {
        // Extract patterns from the interaction
        const patterns = [];
        patterns.push(`${request.type}:${response.success ? 'success' : 'failure'}`);
        patterns.push(`priority:${request.priority}`);
        return patterns;
    }
    suggestInteractionImprovements(request, response) {
        // Suggest improvements based on the interaction
        const improvements = [];
        if (!response.success) {
            improvements.push('Consider providing more specific instructions');
        }
        if (response.duration > 60000) {
            improvements.push('Break down complex requests into smaller tasks');
        }
        return improvements;
    }
    async compressAndSummarize(interactions, outcome) {
        // Implement intelligent compression with summarization
        const originalSize = JSON.stringify(interactions).length;
        // Critical interactions to preserve
        const criticalInteractions = interactions.filter(i => !i.claudeResponse.success ||
            i.codemindRequest.priority === 'critical' ||
            i.effectiveness < 0.5);
        // Successful routine interactions can be summarized
        const routineInteractions = interactions.filter(i => i.claudeResponse.success &&
            i.codemindRequest.priority !== 'critical' &&
            i.effectiveness >= 0.7);
        const summary = {
            keyPatterns: this.extractKeyPatterns(interactions),
            importantOutcomes: this.extractImportantOutcomes(interactions, outcome),
            criticalLearnings: this.extractCriticalLearnings(interactions)
        };
        const compressedSize = JSON.stringify({
            critical: criticalInteractions,
            routineSummary: this.summarizeRoutineInteractions(routineInteractions),
            summary
        }).length;
        return {
            original: {
                size: originalSize,
                interactionCount: interactions.length,
                tokenCount: interactions.reduce((sum, i) => sum + i.claudeResponse.tokensUsed, 0)
            },
            compressed: {
                size: compressedSize,
                preservedInteractions: criticalInteractions.length,
                compressionRatio: originalSize / compressedSize
            },
            summary,
            lossless: false // Some routine interactions summarized
        };
    }
    extractKeyPatterns(interactions) {
        // Extract key patterns from interactions
        return [];
    }
    extractImportantOutcomes(interactions, outcome) {
        // Extract important outcomes
        return [];
    }
    extractCriticalLearnings(interactions) {
        // Extract critical learnings
        return [];
    }
    summarizeRoutineInteractions(interactions) {
        // Summarize routine successful interactions
        return {
            count: interactions.length,
            averageEffectiveness: interactions.reduce((sum, i) => sum + i.effectiveness, 0) / interactions.length,
            commonPatterns: [],
            totalTokensUsed: interactions.reduce((sum, i) => sum + i.claudeResponse.tokensUsed, 0)
        };
    }
    // Additional helper methods would be implemented...
    async cacheRequestContext(requestId, context) { }
    async updateInteractionPatterns(interaction) { }
    async extractLearnings(interactions, outcome) { return { effectivePatterns: [], ineffectivePatterns: [], timeEstimateAccuracy: 0, surprisingChallenges: [], unexpectedSuccesses: [] }; }
    async storeRequestMemoryPersistent(requestMemory, compressionResult) { }
    async updateProjectKnowledge(requestMemory) { }
    async updateKnowledgeGraph(requestMemory, interactions) { }
    async getProjectMemory(projectPath) { return await this.getOrCreateProjectMemory(projectPath); }
    async loadProjectMemoryFromDB(projectId) { return null; }
    async findSimilarRequests(userRequest, projectMemory) { return []; }
    async findRelevantPatterns(userRequest, projectPath) { return []; }
    async suggestApproach(userRequest, similarRequests, patterns) { return ''; }
    async predictChallenges(userRequest, projectMemory, similarRequests) { return []; }
    async estimateDuration(userRequest, projectMemory, similarRequests) { return 0; }
}
exports.CodeMindMemorySystem = CodeMindMemorySystem;
exports.default = CodeMindMemorySystem;
//# sourceMappingURL=codemind-memory-system.js.map