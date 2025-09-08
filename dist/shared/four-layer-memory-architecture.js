"use strict";
/**
 * Four-Layer Memory Architecture for CodeMind
 *
 * Complete memory system mapping to different storage types:
 * 1. SHORT TERM: Live task execution (Redis) - Active working memory
 * 2. LONG TERM: Persistent information, knowledge retention (PostgreSQL + pgvector) - Facts and patterns
 * 3. EPISODIC: Experiential records for improvements (MongoDB) - Event sequences and experiences
 * 4. SEMANTIC: Factual knowledge and concepts for agents (Neo4j) - Relationships and understanding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticMemoryManager = exports.EpisodicMemoryManager = exports.LongTermMemoryManager = exports.ShortTermMemoryManager = exports.FourLayerMemoryManager = void 0;
const logger_1 = require("./logger");
// Temporary stubs for missing services
class RedisService {
    async get(key) { return null; }
    async set(key, value) { return 'OK'; }
    async del(key) { return 1; }
    async exists(key) { return false; }
    async setex(key, ttl, value) { return 'OK'; }
    async ttl(key) { return -1; }
    async lpush(key, value) { return 1; }
    async lrange(key, start, end) { return []; }
    async expire(key, ttl) { return 1; }
}
class PostgreSQLService {
    async query() { return []; }
    async insert() { return 'id'; }
}
class MongoDBService {
    async find() { return []; }
    async insert() { return 'id'; }
    async update() { return { modifiedCount: 1 }; }
}
class Neo4jService {
    async createNode() { return 'id'; }
    async query() { return []; }
}
// ============================================
// FOUR-LAYER MEMORY MANAGER
// ============================================
class FourLayerMemoryManager {
    logger;
    // Storage services for each layer
    redis; // Short term memory
    postgresql; // Long term memory  
    mongodb; // Episodic memory
    neo4j; // Semantic memory
    // Layer-specific managers
    shortTermManager;
    longTermManager;
    episodicManager;
    semanticManager;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        // Initialize storage services
        this.redis = new RedisService();
        this.postgresql = new PostgreSQLService();
        this.mongodb = new MongoDBService();
        this.neo4j = new Neo4jService();
        // Initialize layer managers
        this.shortTermManager = new ShortTermMemoryManager(this.redis);
        this.longTermManager = new LongTermMemoryManager(this.postgresql);
        this.episodicManager = new EpisodicMemoryManager(this.mongodb);
        this.semanticManager = new SemanticMemoryManager(this.neo4j);
    }
    async initialize() {
        this.logger.info('🧠 Initializing Four-Layer Memory Architecture');
        await Promise.all([
            this.shortTermManager.initialize(),
            this.longTermManager.initialize(),
            this.episodicManager.initialize(),
            this.semanticManager.initialize()
        ]);
        this.logger.info('✅ All memory layers initialized');
    }
    /**
     * ORCHESTRATED MEMORY OPERATIONS
     * These methods coordinate across all memory layers
     */
    /**
     * Start new request - initialize across all layers
     */
    async startRequest(requestId, sessionId, projectId, userRequest) {
        this.logger.info(`🎬 Starting request memory: ${requestId}`);
        // 1. Initialize short term working memory
        const shortTermContext = await this.shortTermManager.createWorkingContext(requestId, sessionId, userRequest);
        // 2. Retrieve relevant long term patterns  
        const longTermPatterns = await this.longTermManager.findRelevantPatterns(userRequest, projectId);
        // 3. Get episodic insights from similar experiences
        const episodicInsights = await this.episodicManager.findSimilarExperiences(userRequest, projectId);
        // 4. Build semantic context from knowledge graph
        const semanticContext = await this.semanticManager.buildSemanticContext(userRequest, projectId);
        this.logger.info('🔄 Cross-layer memory context assembled');
        return {
            shortTermContext,
            longTermPatterns,
            episodicInsights,
            semanticContext
        };
    }
    /**
     * Record interaction - distribute to appropriate layers
     */
    async recordInteraction(requestId, interaction) {
        // 1. Short term: Buffer interaction for immediate access
        await this.shortTermManager.bufferInteraction(requestId, interaction);
        // 2. Long term: Extract patterns if significant
        if (this.isSignificantInteraction(interaction)) {
            await this.longTermManager.extractPattern(interaction);
        }
        // 3. Episodic: Add to current episode sequence
        await this.episodicManager.addEventToEpisode(requestId, {
            timestamp: new Date(),
            type: 'action',
            actor: 'codemind',
            description: interaction.type,
            data: interaction,
            effectiveness: interaction.outcome.effectiveness
        });
        // 4. Semantic: Update knowledge graph if new concepts learned
        if (this.hasNewConcepts(interaction)) {
            await this.semanticManager.updateKnowledgeGraph(interaction);
        }
    }
    /**
     * Complete request - finalize across all layers
     */
    async completeRequest(requestId, outcome) {
        this.logger.info(`🎯 Completing request memory: ${requestId}`);
        // 1. Short term: Move to persistent storage and cleanup
        const bufferedInteractions = await this.shortTermManager.flushAndCleanup(requestId);
        // 2. Long term: Store successful patterns and performance data
        const longTermUpdates = await this.longTermManager.storePatterns(requestId, bufferedInteractions, outcome);
        // 3. Episodic: Finalize episode with outcome and learnings  
        const episodeFinalized = await this.episodicManager.finalizeEpisode(requestId, outcome);
        // 4. Semantic: Enhance knowledge graph with new understanding
        const semanticEnhancements = await this.semanticManager.enhanceKnowledge(requestId, outcome);
        this.logger.info('✅ Request memory completed across all layers');
        return {
            shortTermCleanup: true,
            longTermUpdates,
            episodeFinalized,
            semanticEnhancements
        };
    }
    /**
     * MEMORY LAYER ACCESS METHODS
     */
    getShortTermManager() {
        return this.shortTermManager;
    }
    getLongTermManager() {
        return this.longTermManager;
    }
    getEpisodicManager() {
        return this.episodicManager;
    }
    getSemanticManager() {
        return this.semanticManager;
    }
    /**
     * MEMORY STATISTICS AND HEALTH
     */
    async getMemoryStats() {
        return {
            shortTerm: await this.shortTermManager.getStats(),
            longTerm: await this.longTermManager.getStats(),
            episodic: await this.episodicManager.getStats(),
            semantic: await this.semanticManager.getStats()
        };
    }
    // Private helper methods
    isSignificantInteraction(interaction) {
        return interaction.outcome.effectiveness < 0.7 || // Failed or low effectiveness
            interaction.type === 'critical' || // Critical interactions
            interaction.codemindAction.novel; // Novel approaches
    }
    hasNewConcepts(interaction) {
        return interaction.outcome.conceptsLearned?.length > 0 ||
            interaction.codemindAction.newPatterns?.length > 0;
    }
}
exports.FourLayerMemoryManager = FourLayerMemoryManager;
// ============================================
// LAYER-SPECIFIC MANAGERS
// ============================================
/**
 * SHORT TERM MEMORY MANAGER - Redis
 * Manages active working memory, task execution state, immediate context
 */
class ShortTermMemoryManager {
    redis;
    logger;
    constructor(redis) {
        this.redis = redis;
        this.logger = logger_1.Logger.getInstance();
    }
    async initialize() {
        // Set up Redis key patterns and expiration policies
        this.logger.info('🔥 Short term memory (Redis) initialized');
    }
    async createWorkingContext(requestId, sessionId, userRequest) {
        const context = {
            id: `stm_${requestId}`,
            requestId,
            sessionId,
            timestamp: new Date(),
            ttl: 3600, // 1 hour TTL
            type: 'context_cache',
            data: {
                activeContext: {
                    files: [],
                    changes: {},
                    workingDirectory: process.cwd(),
                    gitBranch: 'main',
                    lastSnapshot: ''
                }
            }
        };
        await this.redis.setex(`context:${requestId}`, context.ttl, JSON.stringify(context));
        return context;
    }
    async bufferInteraction(requestId, interaction) {
        await this.redis.lpush(`interactions:${requestId}`, JSON.stringify(interaction));
        await this.redis.expire(`interactions:${requestId}`, 3600); // 1 hour expiry
    }
    async flushAndCleanup(requestId) {
        const interactions = await this.redis.lrange(`interactions:${requestId}`, 0, -1);
        await this.redis.del(`interactions:${requestId}`);
        await this.redis.del(`context:${requestId}`);
        return interactions.map(i => JSON.parse(i));
    }
    async getStats() {
        return {
            activeContexts: 0, // Would count active context keys
            bufferSize: 0, // Would sum buffer sizes
            ttlRemaining: 0 // Would get average TTL
        };
    }
}
exports.ShortTermMemoryManager = ShortTermMemoryManager;
/**
 * LONG TERM MEMORY MANAGER - PostgreSQL + pgvector
 * Manages persistent patterns, solutions, performance data, knowledge base
 */
class LongTermMemoryManager {
    postgresql;
    logger;
    constructor(postgresql) {
        this.postgresql = postgresql;
        this.logger = logger_1.Logger.getInstance();
    }
    async initialize() {
        // Set up pgvector tables and indices
        this.logger.info('🏗️ Long term memory (PostgreSQL + pgvector) initialized');
    }
    async findRelevantPatterns(userRequest, projectId) {
        // Use pgvector similarity search to find relevant patterns
        // Implementation would query long_term_memory table with vector similarity
        return [];
    }
    async extractPattern(interaction) {
        // Extract and store significant patterns from interaction
        // Use OpenAI to generate embedding for pattern
        // Store in PostgreSQL with pgvector embedding
    }
    async storePatterns(requestId, interactions, outcome) {
        // Store successful patterns and performance data
        return 0;
    }
    async getStats() {
        return {
            patterns: 0, // Count from patterns table
            solutions: 0, // Count from solutions table  
            avgConfidence: 0 // Average confidence score
        };
    }
}
exports.LongTermMemoryManager = LongTermMemoryManager;
/**
 * EPISODIC MEMORY MANAGER - MongoDB
 * Manages experiential records, event sequences, improvement insights
 */
class EpisodicMemoryManager {
    mongodb;
    logger;
    constructor(mongodb) {
        this.mongodb = mongodb;
        this.logger = logger_1.Logger.getInstance();
    }
    async initialize() {
        // Set up MongoDB collections and indexes
        this.logger.info('📚 Episodic memory (MongoDB) initialized');
    }
    async findSimilarExperiences(userRequest, projectId) {
        // Find similar episodes from MongoDB
        // Use text search and content similarity
        return {};
    }
    async addEventToEpisode(requestId, event) {
        // Add event to current episode sequence
        // Use MongoDB document updates
    }
    async finalizeEpisode(requestId, outcome) {
        // Complete episode with outcome and extract learnings
        return true;
    }
    async getStats() {
        return {
            episodes: 0, // Count from episodes collection
            avgDuration: 0, // Average episode duration
            learningRate: 0 // Rate of learning extraction
        };
    }
}
exports.EpisodicMemoryManager = EpisodicMemoryManager;
/**
 * SEMANTIC MEMORY MANAGER - Neo4j
 * Manages factual knowledge, concepts, relationships, understanding
 */
class SemanticMemoryManager {
    neo4j;
    logger;
    constructor(neo4j) {
        this.neo4j = neo4j;
        this.logger = logger_1.Logger.getInstance();
    }
    async initialize() {
        // Set up Neo4j schema and constraints
        this.logger.info('🌐 Semantic memory (Neo4j) initialized');
    }
    async buildSemanticContext(userRequest, projectId) {
        // Build semantic context from knowledge graph
        // Query related concepts and relationships
        return {};
    }
    async updateKnowledgeGraph(interaction) {
        // Update knowledge graph with new concepts and relationships
        // Create or update nodes and relationships in Neo4j
    }
    async enhanceKnowledge(requestId, outcome) {
        // Enhance knowledge graph based on request outcome
        return 0;
    }
    async getStats() {
        return {
            concepts: 0, // Count of concept nodes
            relationships: 0, // Count of relationships
            knowledgeDepth: 0 // Average depth of knowledge
        };
    }
}
exports.SemanticMemoryManager = SemanticMemoryManager;
exports.default = FourLayerMemoryManager;
//# sourceMappingURL=four-layer-memory-architecture.js.map