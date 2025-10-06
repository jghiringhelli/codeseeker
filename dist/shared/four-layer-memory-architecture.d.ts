/**
 * Three-Database Memory Architecture for CodeMind
 *
 * Complete memory system mapping to three disjoint storage types:
 * 1. SHORT TERM: Live task execution (Redis) - Active working memory
 * 2. LONG TERM: Persistent information, knowledge retention, episodic records (PostgreSQL + pgvector) - Facts, patterns, and experiences
 * 3. SEMANTIC: Factual knowledge and concepts for agents (Neo4j) - Relationships and understanding
 *
 * Note: Episodic memory consolidated into PostgreSQL to maintain database disjointness
 */
declare class RedisService {
    get(key: string): Promise<any>;
    set(key: string, value: string): Promise<string>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    setex(key: string, ttl: number, value: string): Promise<string>;
    ttl(key: string): Promise<number>;
    lpush(key: string, value: string): Promise<number>;
    lrange(key: string, start: number, end: number): Promise<any[]>;
    expire(key: string, ttl: number): Promise<number>;
}
declare class PostgreSQLService {
    query(): Promise<any[]>;
    insert(): Promise<string>;
    insertEpisodicRecord(): Promise<string>;
    queryEpisodicRecords(): Promise<any[]>;
}
declare class Neo4jService {
    createNode(): Promise<string>;
    query(): Promise<any[]>;
}
/**
 * 1. SHORT TERM MEMORY - Redis
 * Live task execution, immediate context, working memory
 */
export interface ShortTermMemory {
    id: string;
    requestId: string;
    sessionId: string;
    timestamp: Date;
    ttl: number;
    type: 'task_execution' | 'validation_state' | 'context_cache' | 'interaction_buffer';
    data: {
        currentTask?: {
            taskId: string;
            instruction: string;
            status: 'pending' | 'in_progress' | 'completed' | 'failed';
            startTime: Date;
            context: any;
        };
        activeContext?: {
            files: string[];
            changes: any;
            workingDirectory: string;
            gitBranch: string;
            lastSnapshot: string;
        };
        validationState?: {
            preExecution: boolean;
            postExecution: boolean;
            compilationStatus: 'unknown' | 'passing' | 'failing';
            testStatus: 'unknown' | 'passing' | 'failing';
        };
        interactionBuffer?: {
            interactions: any[];
            pendingStorage: boolean;
            bufferSize: number;
        };
    };
}
/**
 * 2. LONG TERM MEMORY - PostgreSQL + pgvector
 * Persistent information, knowledge retention, factual patterns
 */
export interface LongTermMemory {
    id: string;
    projectId: string;
    timestamp: Date;
    type: 'pattern' | 'solution' | 'performance' | 'knowledge_base';
    embedding?: number[];
    content: {
        pattern?: {
            name: string;
            description: string;
            effectiveness: number;
            usageCount: number;
            contexts: string[];
            successRate: number;
        };
        solution?: {
            problem: string;
            approach: string;
            implementation: string;
            outcomes: string[];
            applicableContexts: string[];
            complexity: number;
        };
        performance?: {
            metric: string;
            value: number;
            context: string;
            benchmark: number;
            trend: 'improving' | 'stable' | 'declining';
        };
        knowledge?: {
            concept: string;
            definition: string;
            relationships: string[];
            examples: string[];
            confidence: number;
        };
    };
    metadata: {
        frequency: number;
        lastUsed: Date;
        confidence: number;
        source: string;
        tags: string[];
    };
}
/**
 * 3. EPISODIC MEMORY - MongoDB
 * Experiential records, event sequences, improvement learning
 */
export interface EpisodicMemory {
    _id: string;
    requestId: string;
    sessionId: string;
    projectId: string;
    timestamp: Date;
    episode: {
        trigger: string;
        context: any;
        sequence: EpisodeEvent[];
        outcome: {
            success: boolean;
            result: any;
            learnings: string[];
            improvements: string[];
        };
        duration: number;
        complexity: number;
    };
    experientialData: {
        challenges: Array<{
            challenge: string;
            attempts: Array<{
                approach: string;
                result: boolean;
                duration: number;
                learnings: string[];
            }>;
            finalSolution: string;
            effectiveness: number;
        }>;
        successes: Array<{
            achievement: string;
            approach: string;
            factors: string[];
            replicability: number;
        }>;
        patterns: Array<{
            pattern: string;
            frequency: number;
            contexts: string[];
            effectiveness: number;
        }>;
    };
    improvementInsights: {
        whatWorked: string[];
        whatDidnt: string[];
        whyItWorked: string[];
        nextTimeWouldDo: string[];
        avoidNext: string[];
    };
}
export interface EpisodeEvent {
    timestamp: Date;
    type: 'action' | 'observation' | 'decision' | 'outcome';
    actor: 'codemind' | 'claude' | 'system' | 'user';
    description: string;
    data: any;
    effectiveness?: number;
}
/**
 * 4. SEMANTIC MEMORY - Neo4j
 * Factual knowledge, concepts, relationships, understanding
 */
export interface SemanticMemory {
    nodeId: string;
    nodeType: 'concept' | 'relationship' | 'fact' | 'rule' | 'principle';
    concept?: {
        name: string;
        definition: string;
        category: string;
        confidence: number;
        examples: string[];
        counterexamples: string[];
    };
    relationship?: {
        sourceNodeId: string;
        targetNodeId: string;
        relationshipType: 'IS_A' | 'HAS_A' | 'DEPENDS_ON' | 'ENABLES' | 'CONFLICTS_WITH' | 'SIMILAR_TO';
        strength: number;
        context: string[];
    };
    fact?: {
        statement: string;
        domain: string;
        confidence: number;
        sources: string[];
        evidence: string[];
    };
    rule?: {
        condition: string;
        action: string;
        domain: string;
        confidence: number;
        exceptions: string[];
    };
    principle?: {
        name: string;
        statement: string;
        domain: string;
        applications: string[];
        violations: string[];
    };
    metadata: {
        created: Date;
        lastUpdated: Date;
        usageCount: number;
        confidence: number;
        source: string;
        tags: string[];
    };
}
export declare class FourLayerMemoryManager {
    private logger;
    private redis;
    private postgresql;
    private neo4j;
    private shortTermManager;
    private longTermManager;
    private episodicManager;
    private semanticManager;
    constructor();
    initialize(): Promise<void>;
    /**
     * ORCHESTRATED MEMORY OPERATIONS
     * These methods coordinate across all memory layers
     */
    /**
     * Start new request - initialize across all layers
     */
    startRequest(requestId: string, sessionId: string, projectId: string, userRequest: string): Promise<{
        shortTermContext: any;
        longTermPatterns: any[];
        episodicInsights: any;
        semanticContext: any;
    }>;
    /**
     * Record interaction - distribute to appropriate layers
     */
    recordInteraction(requestId: string, interaction: {
        type: string;
        codemindAction: any;
        claudeResponse: any;
        context: any;
        outcome: any;
    }): Promise<void>;
    /**
     * Complete request - finalize across all layers
     */
    completeRequest(requestId: string, outcome: any): Promise<{
        shortTermCleanup: boolean;
        longTermUpdates: number;
        episodeFinalized: boolean;
        semanticEnhancements: number;
    }>;
    /**
     * MEMORY LAYER ACCESS METHODS
     */
    getShortTermManager(): ShortTermMemoryManager;
    getLongTermManager(): LongTermMemoryManager;
    getEpisodicManager(): EpisodicMemoryManager;
    getSemanticManager(): SemanticMemoryManager;
    /**
     * MEMORY STATISTICS AND HEALTH
     */
    getMemoryStats(): Promise<{
        shortTerm: {
            activeContexts: number;
            bufferSize: number;
            ttlRemaining: number;
        };
        longTerm: {
            patterns: number;
            solutions: number;
            avgConfidence: number;
        };
        episodic: {
            episodes: number;
            avgDuration: number;
            learningRate: number;
        };
        semantic: {
            concepts: number;
            relationships: number;
            knowledgeDepth: number;
        };
    }>;
    private isSignificantInteraction;
    private hasNewConcepts;
}
/**
 * SHORT TERM MEMORY MANAGER - Redis
 * Manages active working memory, task execution state, immediate context
 */
export declare class ShortTermMemoryManager {
    private redis;
    private logger;
    constructor(redis: RedisService);
    initialize(): Promise<void>;
    createWorkingContext(requestId: string, sessionId: string, userRequest: string): Promise<any>;
    bufferInteraction(requestId: string, interaction: any): Promise<void>;
    flushAndCleanup(requestId: string): Promise<any[]>;
    getStats(): Promise<any>;
}
/**
 * LONG TERM MEMORY MANAGER - PostgreSQL + pgvector
 * Manages persistent patterns, solutions, performance data, knowledge base
 */
export declare class LongTermMemoryManager {
    private postgresql;
    private logger;
    constructor(postgresql: PostgreSQLService);
    initialize(): Promise<void>;
    findRelevantPatterns(userRequest: string, projectId: string): Promise<any[]>;
    extractPattern(interaction: any): Promise<void>;
    storePatterns(requestId: string, interactions: any[], outcome: any): Promise<number>;
    getStats(): Promise<any>;
}
/**
 * EPISODIC MEMORY MANAGER - MongoDB
 * Manages experiential records, event sequences, improvement insights
 */
export declare class EpisodicMemoryManager {
    private postgresql;
    private logger;
    constructor(postgresql: PostgreSQLService);
    initialize(): Promise<void>;
    findSimilarExperiences(userRequest: string, projectId: string): Promise<any>;
    addEventToEpisode(requestId: string, event: EpisodeEvent): Promise<void>;
    finalizeEpisode(requestId: string, outcome: any): Promise<boolean>;
    getStats(): Promise<any>;
}
/**
 * SEMANTIC MEMORY MANAGER - Neo4j
 * Manages factual knowledge, concepts, relationships, understanding
 */
export declare class SemanticMemoryManager {
    private neo4j;
    private logger;
    constructor(neo4j: Neo4jService);
    initialize(): Promise<void>;
    buildSemanticContext(userRequest: string, projectId: string): Promise<any>;
    updateKnowledgeGraph(interaction: any): Promise<void>;
    enhanceKnowledge(requestId: string, outcome: any): Promise<number>;
    getStats(): Promise<any>;
}
export default FourLayerMemoryManager;
//# sourceMappingURL=four-layer-memory-architecture.d.ts.map