"use strict";
// Advanced Context Management System with Claude Limit Detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManager = void 0;
const events_1 = require("events");
const lz_string_1 = require("lz-string");
const types_1 = require("./types");
class ContextManager extends events_1.EventEmitter {
    logger;
    claudeLimits;
    currentUsage = new Map();
    contextWindows = new Map();
    compressionStrategies = new Map();
    pausedNodes = new Set();
    waitQueue = new PriorityQueue();
    constructor(logger) {
        super();
        this.logger = logger;
        // Initialize Claude limits (Claude 3 typical limits)
        this.claudeLimits = {
            maxTokensPerMessage: 100000,
            maxTokensPerConversation: 200000,
            maxMessagesPerMinute: 50,
            maxConcurrentRequests: 10,
            cooldownPeriodMs: 60000
        };
        this.initializeCompressionStrategies();
        this.startMonitoring();
    }
    initializeCompressionStrategies() {
        // Define compression strategies per role type
        const strategies = {
            [types_1.RoleType.ORCHESTRATOR]: {
                maxTokens: 8000,
                preserveKeys: ['workflowId', 'currentPhase', 'criticalDecisions', 'qualityGates'],
                summarizationLevel: 1,
                useVectorSearch: true
            },
            [types_1.RoleType.WORK_CLASSIFIER]: {
                maxTokens: 2000,
                preserveKeys: ['workType', 'priority', 'complexity'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.REQUIREMENT_ANALYST]: {
                maxTokens: 4000,
                preserveKeys: ['requirements', 'acceptanceCriteria', 'dependencies'],
                summarizationLevel: 1,
                useVectorSearch: true
            },
            [types_1.RoleType.TEST_DESIGNER]: {
                maxTokens: 3000,
                preserveKeys: ['testCases', 'coverage', 'criticalPaths'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: {
                maxTokens: 6000,
                preserveKeys: ['implementation', 'interfaces', 'dependencies', 'errors'],
                summarizationLevel: 1,
                useVectorSearch: true
            },
            [types_1.RoleType.CODE_REVIEWER]: {
                maxTokens: 4000,
                preserveKeys: ['issues', 'suggestions', 'qualityMetrics'],
                summarizationLevel: 2,
                useVectorSearch: true
            },
            [types_1.RoleType.SECURITY_AUDITOR]: {
                maxTokens: 3000,
                preserveKeys: ['vulnerabilities', 'securityScore', 'criticalIssues'],
                summarizationLevel: 1,
                useVectorSearch: true
            },
            [types_1.RoleType.PERFORMANCE_AUDITOR]: {
                maxTokens: 3000,
                preserveKeys: ['metrics', 'bottlenecks', 'optimization'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.QUALITY_AUDITOR]: {
                maxTokens: 3500,
                preserveKeys: ['qualityScores', 'violations', 'recommendations'],
                summarizationLevel: 2,
                useVectorSearch: true
            },
            [types_1.RoleType.COMPILER_BUILDER]: {
                maxTokens: 2500,
                preserveKeys: ['buildStatus', 'errors', 'artifacts'],
                summarizationLevel: 3,
                useVectorSearch: false
            },
            [types_1.RoleType.DEVOPS_ENGINEER]: {
                maxTokens: 3000,
                preserveKeys: ['pipeline', 'infrastructure', 'deploymentConfig'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.DEPLOYER]: {
                maxTokens: 2000,
                preserveKeys: ['deploymentStatus', 'environment', 'rollbackPlan'],
                summarizationLevel: 3,
                useVectorSearch: false
            },
            [types_1.RoleType.UNIT_TEST_EXECUTOR]: {
                maxTokens: 2500,
                preserveKeys: ['testResults', 'failures', 'coverage'],
                summarizationLevel: 3,
                useVectorSearch: false
            },
            [types_1.RoleType.INTEGRATION_TEST_ENGINEER]: {
                maxTokens: 3000,
                preserveKeys: ['integrationTests', 'apiContracts', 'failures'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.E2E_TEST_ENGINEER]: {
                maxTokens: 3500,
                preserveKeys: ['userJourneys', 'e2eResults', 'criticalPaths'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.TECHNICAL_DOCUMENTER]: {
                maxTokens: 3000,
                preserveKeys: ['documentation', 'apiSpecs', 'diagrams'],
                summarizationLevel: 2,
                useVectorSearch: true
            },
            [types_1.RoleType.USER_DOCUMENTER]: {
                maxTokens: 2500,
                preserveKeys: ['userGuides', 'tutorials', 'faqs'],
                summarizationLevel: 2,
                useVectorSearch: true
            },
            [types_1.RoleType.RELEASE_MANAGER]: {
                maxTokens: 2500,
                preserveKeys: ['version', 'changelog', 'releaseNotes'],
                summarizationLevel: 2,
                useVectorSearch: false
            },
            [types_1.RoleType.COMMITTER]: {
                maxTokens: 1500,
                preserveKeys: ['commitMessage', 'changes', 'branch'],
                summarizationLevel: 3,
                useVectorSearch: false
            }
        };
        Object.entries(strategies).forEach(([roleType, strategy]) => {
            this.compressionStrategies.set(roleType, strategy);
        });
    }
    async detectClaudeLimitApproaching(executionId) {
        const usage = this.currentUsage.get(executionId);
        if (!usage)
            return false;
        // Check if we're approaching limits
        const thresholds = {
            conversation: 0.85, // 85% of conversation limit
            rate: 0.90, // 90% of rate limit
            concurrent: 0.80 // 80% of concurrent request limit
        };
        if (usage.percentage >= thresholds.conversation) {
            this.logger.warn(`Claude conversation limit approaching: ${usage.percentage}% used`);
            this.emit('limit-approaching', {
                type: 'conversation',
                usage: usage.percentage,
                estimatedRemaining: usage.estimatedRemaining
            });
            return true;
        }
        // Check rate limits
        const rateUsage = await this.checkRateLimits(executionId);
        if (rateUsage >= thresholds.rate) {
            this.logger.warn(`Claude rate limit approaching: ${rateUsage}% used`);
            this.emit('limit-approaching', { type: 'rate', usage: rateUsage });
            return true;
        }
        return false;
    }
    async compressContext(content, roleType, preserveEssential = true) {
        const strategy = this.compressionStrategies.get(roleType);
        const originalSize = JSON.stringify(content).length;
        // Step 1: Extract essential information
        const essential = this.extractEssentialInfo(content, strategy.preserveKeys);
        // Step 2: Apply intelligent summarization
        const summarized = await this.intelligentSummarization(content, strategy.summarizationLevel, essential);
        // Step 3: Apply compression
        const compressed = (0, lz_string_1.compress)(JSON.stringify(summarized));
        // Step 4: Generate semantic hash for deduplication
        const semanticHash = this.generateSemanticHash(summarized);
        // Step 5: Create vector embedding if needed
        const vectorEmbedding = strategy.useVectorSearch
            ? await this.generateVectorEmbedding(summarized)
            : undefined;
        const contextWindow = {
            id: `ctx-${Date.now()}-${roleType}`,
            roleType,
            tokens: this.estimateTokens(summarized),
            compressedContent: compressed,
            originalSize,
            compressionRatio: compressed.length / originalSize,
            priority: this.calculatePriority(roleType, content),
            timestamp: new Date(),
            metadata: {
                essentialKeys: strategy.preserveKeys,
                droppableKeys: this.identifyDroppableKeys(content, strategy.preserveKeys),
                summarizationLevel: strategy.summarizationLevel,
                vectorEmbedding,
                semanticHash
            }
        };
        this.contextWindows.set(contextWindow.id, contextWindow);
        this.logger.info(`Context compressed for ${roleType}: ${originalSize} → ${compressed.length} bytes (${(contextWindow.compressionRatio * 100).toFixed(1)}% ratio)`);
        return contextWindow;
    }
    extractEssentialInfo(content, preserveKeys) {
        const essential = {};
        for (const key of preserveKeys) {
            if (this.hasNestedProperty(content, key)) {
                essential[key] = this.getNestedProperty(content, key);
            }
        }
        // Add critical system information
        essential._metadata = {
            timestamp: new Date().toISOString(),
            contextVersion: '1.0',
            essentialOnly: true
        };
        return essential;
    }
    async intelligentSummarization(content, level, essential) {
        if (level === 0)
            return content; // No summarization
        const summarized = { ...essential };
        // Level 1: Keep structure, summarize verbose content
        if (level >= 1) {
            summarized.summary = this.generateExecutiveSummary(content);
            summarized.keyPoints = this.extractKeyPoints(content);
        }
        // Level 2: Aggressive summarization, keep only critical data
        if (level >= 2) {
            summarized.criticalData = this.extractCriticalData(content);
            delete summarized.verbose;
            delete summarized.debug;
            delete summarized.logs;
        }
        // Level 3: Ultra-compressed, minimal context
        if (level >= 3) {
            return {
                essential: summarized.essential || essential,
                critical: summarized.criticalData,
                action: this.extractActionableInfo(content)
            };
        }
        return summarized;
    }
    async pauseNode(nodeId, reason) {
        this.pausedNodes.add(nodeId);
        this.logger.info(`Node ${nodeId} paused: ${reason}`);
        // Save current state for potential rollback
        await this.saveNodeState(nodeId);
        this.emit('node-paused', { nodeId, reason, timestamp: new Date() });
    }
    async resumeNode(nodeId) {
        this.pausedNodes.delete(nodeId);
        this.logger.info(`Node ${nodeId} resumed`);
        // Process any queued messages for this node
        await this.processQueuedMessages(nodeId);
        this.emit('node-resumed', { nodeId, timestamp: new Date() });
    }
    async queueMessage(message, roleType, priority = 5) {
        const queuedMessage = {
            id: `msg-${Date.now()}`,
            roleType,
            message,
            priority,
            timestamp: new Date(),
            attempts: 0,
            maxAttempts: 3
        };
        this.waitQueue.enqueue(queuedMessage, priority);
        this.logger.info(`Message queued for ${roleType} with priority ${priority}`);
    }
    async processQueuedMessages(nodeId) {
        while (!this.waitQueue.isEmpty()) {
            const message = this.waitQueue.dequeue();
            if (!message)
                break;
            // Check if we can process this message
            if (await this.canProcessMessage(message)) {
                await this.processMessage(message);
            }
            else {
                // Re-queue with lower priority
                message.priority = Math.max(1, message.priority - 1);
                this.waitQueue.enqueue(message, message.priority);
                break; // Stop processing for now
            }
        }
    }
    async canProcessMessage(message) {
        // Check Claude limits
        const limitCheck = await this.detectClaudeLimitApproaching('current');
        if (limitCheck)
            return false;
        // Check if role is paused
        if (this.pausedNodes.has(message.roleType))
            return false;
        // Check concurrent request limits
        const concurrentRequests = this.getCurrentConcurrentRequests();
        if (concurrentRequests >= this.claudeLimits.maxConcurrentRequests)
            return false;
        return true;
    }
    async processMessage(message) {
        try {
            // Compress the message
            const compressed = await this.compressContext(message.message, message.roleType);
            // Send to appropriate role handler
            this.emit('message-ready', {
                roleType: message.roleType,
                context: compressed,
                priority: message.priority
            });
        }
        catch (error) {
            this.logger.error(`Failed to process message for ${message.roleType}`, error);
            message.attempts++;
            if (message.attempts < message.maxAttempts) {
                // Re-queue for retry
                this.waitQueue.enqueue(message, message.priority - 1);
            }
        }
    }
    startMonitoring() {
        // Monitor Claude usage every 10 seconds
        setInterval(async () => {
            for (const [executionId, usage] of this.currentUsage) {
                if (await this.detectClaudeLimitApproaching(executionId)) {
                    await this.handleLimitApproaching(executionId);
                }
            }
        }, 10000);
        // Process queued messages every 5 seconds
        setInterval(() => {
            this.processQueuedMessages();
        }, 5000);
    }
    async handleLimitApproaching(executionId) {
        this.logger.warn(`Handling limit approaching for execution ${executionId}`);
        // Pause non-critical nodes
        const criticalRoles = [
            types_1.RoleType.ORCHESTRATOR,
            types_1.RoleType.SECURITY_AUDITOR,
            types_1.RoleType.DEPLOYER
        ];
        for (const nodeId of this.pausedNodes) {
            const role = this.getNodeRole(nodeId);
            if (role && !criticalRoles.includes(role)) {
                await this.pauseNode(nodeId, 'Claude limit approaching');
            }
        }
        // Increase compression levels
        this.increaseCompressionLevels();
        // Start cooldown period
        await this.startCooldownPeriod();
    }
    increaseCompressionLevels() {
        for (const [roleType, strategy] of this.compressionStrategies) {
            strategy.summarizationLevel = Math.min(3, strategy.summarizationLevel + 1);
            strategy.maxTokens = Math.floor(strategy.maxTokens * 0.7); // Reduce by 30%
        }
        this.logger.info('Compression levels increased due to limit approaching');
    }
    async startCooldownPeriod() {
        this.logger.info(`Starting cooldown period: ${this.claudeLimits.cooldownPeriodMs}ms`);
        // Pause all non-critical operations
        this.emit('cooldown-started', { duration: this.claudeLimits.cooldownPeriodMs });
        await new Promise(resolve => setTimeout(resolve, this.claudeLimits.cooldownPeriodMs));
        // Resume operations with reduced rate
        this.emit('cooldown-ended');
        // Reset compression levels gradually
        this.resetCompressionLevels();
    }
    resetCompressionLevels() {
        for (const [roleType, strategy] of this.compressionStrategies) {
            const original = this.getOriginalStrategy(roleType);
            strategy.summarizationLevel = original.summarizationLevel;
            strategy.maxTokens = original.maxTokens;
        }
    }
    // Helper methods
    estimateTokens(content) {
        // Rough estimation: 1 token ≈ 4 characters
        const contentStr = JSON.stringify(content);
        return Math.ceil(contentStr.length / 4);
    }
    generateSemanticHash(content) {
        // Generate a semantic hash for deduplication
        const key = JSON.stringify(content)
            .split('')
            .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
            .toString(36);
        return key;
    }
    async generateVectorEmbedding(content) {
        // Placeholder for vector embedding generation
        // In production, this would use an embedding model
        const text = JSON.stringify(content);
        const embedding = new Float32Array(768); // Standard embedding size
        // Simple hash-based pseudo-embedding for demo
        for (let i = 0; i < 768; i++) {
            embedding[i] = Math.sin(text.charCodeAt(i % text.length) * (i + 1));
        }
        return embedding;
    }
    calculatePriority(roleType, content) {
        const rolePriorities = {
            [types_1.RoleType.ORCHESTRATOR]: 10,
            [types_1.RoleType.SECURITY_AUDITOR]: 9,
            [types_1.RoleType.DEPLOYER]: 8,
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: 7,
            [types_1.RoleType.TEST_DESIGNER]: 6,
            [types_1.RoleType.CODE_REVIEWER]: 6,
            [types_1.RoleType.QUALITY_AUDITOR]: 5,
            [types_1.RoleType.PERFORMANCE_AUDITOR]: 5,
            [types_1.RoleType.REQUIREMENT_ANALYST]: 4,
            [types_1.RoleType.WORK_CLASSIFIER]: 3,
            [types_1.RoleType.COMPILER_BUILDER]: 3,
            [types_1.RoleType.DEVOPS_ENGINEER]: 4,
            [types_1.RoleType.UNIT_TEST_EXECUTOR]: 3,
            [types_1.RoleType.INTEGRATION_TEST_ENGINEER]: 3,
            [types_1.RoleType.E2E_TEST_ENGINEER]: 3,
            [types_1.RoleType.TECHNICAL_DOCUMENTER]: 2,
            [types_1.RoleType.USER_DOCUMENTER]: 2,
            [types_1.RoleType.RELEASE_MANAGER]: 2,
            [types_1.RoleType.COMMITTER]: 1
        };
        return rolePriorities[roleType] || 5;
    }
    hasNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj) !== undefined;
    }
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    identifyDroppableKeys(content, preserveKeys) {
        const allKeys = Object.keys(content);
        return allKeys.filter(key => !preserveKeys.includes(key));
    }
    generateExecutiveSummary(content) {
        // Generate concise executive summary
        return `Summary of ${content.type || 'content'}: ${content.status || 'in-progress'}`;
    }
    extractKeyPoints(content) {
        // Extract key points from content
        const points = [];
        if (content.results)
            points.push(`Results: ${content.results.length} items`);
        if (content.errors)
            points.push(`Errors: ${content.errors.length}`);
        if (content.status)
            points.push(`Status: ${content.status}`);
        return points;
    }
    extractCriticalData(content) {
        // Extract only critical data
        return {
            id: content.id,
            status: content.status,
            errors: content.errors?.length || 0,
            critical: content.critical || content.important || content.required
        };
    }
    extractActionableInfo(content) {
        // Extract actionable information
        return {
            action: content.action || content.nextStep || 'continue',
            blockers: content.blockers || content.errors || [],
            decisions: content.decisions || content.choices || []
        };
    }
    async saveNodeState(nodeId) {
        // Save node state for rollback capability
        const state = {
            nodeId,
            timestamp: new Date(),
            context: this.contextWindows.get(nodeId),
            usage: this.currentUsage.get(nodeId)
        };
        // Store in persistent storage (simplified)
        this.emit('state-saved', state);
    }
    async checkRateLimits(executionId) {
        // Check rate limit usage
        // Simplified implementation
        return 50; // Return percentage used
    }
    getCurrentConcurrentRequests() {
        // Count current concurrent requests
        // Simplified implementation
        return 5;
    }
    getNodeRole(nodeId) {
        // Get role type for a node
        // Simplified implementation
        return types_1.RoleType.IMPLEMENTATION_DEVELOPER;
    }
    getOriginalStrategy(roleType) {
        // Get original compression strategy
        // Would be stored during initialization
        return {
            maxTokens: 4000,
            preserveKeys: [],
            summarizationLevel: 1,
            useVectorSearch: false
        };
    }
    // Public API
    async getContextWindow(id) {
        return this.contextWindows.get(id) || null;
    }
    async updateUsage(executionId, tokensUsed) {
        const usage = this.currentUsage.get(executionId) || {
            current: 0,
            limit: this.claudeLimits.maxTokensPerConversation,
            percentage: 0,
            estimatedRemaining: this.claudeLimits.maxTokensPerConversation,
            willExceedIn: 1000
        };
        usage.current += tokensUsed;
        usage.percentage = (usage.current / usage.limit) * 100;
        usage.estimatedRemaining = usage.limit - usage.current;
        usage.willExceedIn = Math.floor(usage.estimatedRemaining / (tokensUsed || 1));
        this.currentUsage.set(executionId, usage);
    }
    isPaused(nodeId) {
        return this.pausedNodes.has(nodeId);
    }
    getQueueSize() {
        return this.waitQueue.size();
    }
}
exports.ContextManager = ContextManager;
class PriorityQueue {
    items = [];
    enqueue(element, priority) {
        const queueElement = { element, priority };
        let added = false;
        for (let i = 0; i < this.items.length; i++) {
            if (queueElement.priority > this.items[i].priority) {
                this.items.splice(i, 0, queueElement);
                added = true;
                break;
            }
        }
        if (!added) {
            this.items.push(queueElement);
        }
    }
    dequeue() {
        if (this.isEmpty())
            return null;
        return this.items.shift().element;
    }
    isEmpty() {
        return this.items.length === 0;
    }
    size() {
        return this.items.length;
    }
}
//# sourceMappingURL=context-manager.js.map