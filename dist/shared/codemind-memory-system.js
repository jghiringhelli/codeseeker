"use strict";
/**
 * CodeMind Memory System (Legacy Facade)
 * SOLID Principles: Facade Pattern - Provides simplified interface to memory subsystem
 * SOLID Principles: Dependency Inversion Principle - depends on MemorySystem abstraction
 *
 * This class provides backward compatibility for existing CodeMind memory operations
 * while delegating all functionality to the new SOLID-based MemorySystem architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySystem = exports.CodeMindMemorySystem = void 0;
const logger_1 = require("./logger");
const memory_system_1 = require("./memory-system/memory-system");
Object.defineProperty(exports, "MemorySystem", { enumerable: true, get: function () { return memory_system_1.MemorySystem; } });
class CodeMindMemorySystem {
    logger;
    memorySystem;
    initialized = false;
    sessionId;
    constructor(memorySystem) {
        this.logger = logger_1.Logger.getInstance();
        this.memorySystem = memorySystem || new memory_system_1.MemorySystem();
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.memorySystem.initialize();
            this.initialized = true;
            this.logger.info('🧠 CodeMind memory system initialized (legacy facade)');
        }
        catch (error) {
            this.logger.warn('⚠️ Memory system initialization failed, using fallback mode');
            this.initialized = true;
        }
    }
    async close() {
        if (!this.initialized)
            return;
        try {
            await this.memorySystem.close();
            this.initialized = false;
            this.logger.info('🧠 CodeMind memory system closed (legacy facade)');
        }
        catch (error) {
            this.logger.error('Failed to close memory system:', error);
        }
    }
    /**
     * Store and retrieve interaction with context
     * Main entry point for CodeMind → Claude Code interactions
     */
    async storeAndRetrieveInteraction(interaction) {
        await this.initialize();
        try {
            // Delegate to memory system
            return await this.memorySystem.storeAndRetrieveInteraction(interaction);
        }
        catch (error) {
            this.logger.error('Failed to store and retrieve interaction:', error);
            return null;
        }
    }
    // Storage Operations (delegated to MemorySystem)
    async storeInteraction(interaction) {
        return this.memorySystem.storeInteraction(interaction);
    }
    async storeRequest(request) {
        return this.memorySystem.storeRequest(request);
    }
    async storeSession(session) {
        return this.memorySystem.storeSession(session);
    }
    async storeProject(project) {
        return this.memorySystem.storeProject(project);
    }
    // Retrieval Operations (delegated to MemorySystem)
    async loadInteraction(id) {
        return this.memorySystem.loadInteraction(id);
    }
    async loadRequest(requestId) {
        return this.memorySystem.loadRequest(requestId);
    }
    async loadSession(sessionId) {
        return this.memorySystem.loadSession(sessionId);
    }
    async loadProject(projectId) {
        return this.memorySystem.loadProject(projectId);
    }
    async getContextForNewRequest(userRequest, projectPath, sessionId) {
        return this.memorySystem.getContextForNewRequest(userRequest, projectPath, sessionId);
    }
    async findSimilarRequests(userRequest, projectMemory) {
        return this.memorySystem.findSimilarRequests(userRequest, projectMemory);
    }
    async findRelevantPatterns(userRequest, projectPath) {
        return this.memorySystem.findRelevantPatterns(userRequest, projectPath);
    }
    async getProjectMemory(projectPath) {
        return this.memorySystem.getProjectMemory(projectPath);
    }
    async getSessionMemory(sessionId) {
        return this.memorySystem.getSessionMemory(sessionId);
    }
    // Update Operations (delegated to MemorySystem)
    async updateInteractionEffectiveness(id, effectiveness) {
        return this.memorySystem.updateInteractionEffectiveness(id, effectiveness);
    }
    async updateProjectKnowledge(projectId, knowledge) {
        return this.memorySystem.updateProjectKnowledge(projectId, knowledge);
    }
    // Optimization Operations (delegated to MemorySystem)
    async compressAndSummarize(interactions, outcome) {
        return this.memorySystem.compressAndSummarize(interactions, outcome);
    }
    // Analytics Operations (delegated to MemorySystem)
    async getMemoryStats() {
        return this.memorySystem.getMemoryStats();
    }
    async analyzeTrends(projectId, timeRange) {
        return this.memorySystem.analyzeTrends(projectId, timeRange);
    }
    async generateInsights(projectId) {
        return this.memorySystem.generateInsights(projectId);
    }
    // Backward Compatibility Helper Methods
    async extractKeyPatterns(interactions) {
        return this.memorySystem.extractKeyPatterns(interactions);
    }
    async extractImportantOutcomes(interactions, outcome) {
        return this.memorySystem.extractImportantOutcomes(interactions, outcome);
    }
    async extractCriticalLearnings(interactions) {
        return this.memorySystem.extractCriticalLearnings(interactions);
    }
    async calculateInteractionEffectiveness(interaction, finalOutcome) {
        return this.memorySystem.calculateInteractionEffectiveness(interaction, finalOutcome);
    }
    async extractInteractionPatterns(interaction) {
        return this.memorySystem.extractInteractionPatterns(interaction);
    }
    async suggestInteractionImprovements(interaction) {
        return this.memorySystem.suggestInteractionImprovements(interaction);
    }
    async optimizeMemoryUsage() {
        return this.memorySystem.optimizeMemoryUsage();
    }
    async cleanupExpiredSessions() {
        return this.memorySystem.cleanupExpiredSessions();
    }
    async compressOldInteractions(threshold) {
        return this.memorySystem.compressOldInteractions(threshold);
    }
    // Additional methods for orchestrator integration
    async initializeRequestMemory(userRequest, projectPath, sessionId) {
        // Generate a unique request ID
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Initialize request memory
        const request = {
            requestId,
            sessionId,
            userRequest: userRequest,
            projectPath: projectPath,
            timestamp: new Date(),
            duration: 0,
            type: 'general',
            complexity: 1,
            outcome: {
                success: false,
                result: 'pending',
                filesModified: [],
                errorsEncountered: [],
                tokensUsed: 0
            },
            interactions: [],
            learnings: {
                effectivePatterns: [],
                ineffectivePatterns: [],
                timeEstimateAccuracy: 1.0,
                surprisingChallenges: [],
                unexpectedSuccesses: []
            }
        };
        await this.memorySystem.storeRequest(request);
        // Get contextual continuation
        const contextualContinuation = await this.memorySystem.getContextForNewRequest(userRequest, projectPath, sessionId);
        return { requestId, context: contextualContinuation };
    }
    async recordInteraction(interactionOrRequestId, codemindRequest, claudeResponse) {
        if (typeof interactionOrRequestId === 'string') {
            // Build InteractionMemory from parameters
            const interaction = {
                id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                requestId: interactionOrRequestId,
                sessionId: this.sessionId || 'default',
                codemindRequest: codemindRequest,
                claudeResponse: claudeResponse,
                effectiveness: 0.5,
                patterns: [],
                improvements: []
            };
            return this.memorySystem.storeInteraction(interaction);
        }
        else {
            return this.memorySystem.storeInteraction(interactionOrRequestId);
        }
    }
    async finalizeRequestMemory(requestId, outcome, results) {
        // Update request with final outcome
        const request = await this.memorySystem.loadRequest(requestId);
        if (request) {
            request.outcome = outcome;
            request.duration = Date.now() - request.timestamp.getTime();
            await this.memorySystem.storeRequest(request);
        }
    }
}
exports.CodeMindMemorySystem = CodeMindMemorySystem;
// Export legacy class and new system for compatibility
exports.default = CodeMindMemorySystem;
//# sourceMappingURL=codemind-memory-system.js.map