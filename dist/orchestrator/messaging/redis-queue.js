"use strict";
/**
 * Redis-based message queue system for sequential workflow orchestration
 *
 * Provides reliable message passing between workflow roles with blocking operations
 * and automatic cleanup. Each role has dedicated queues for input and completion.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisQueue = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../utils/logger");
class RedisQueue {
    redis;
    subscriber;
    logger = logger_1.Logger.getInstance();
    constructor() {
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            retryStrategy: () => null // Don't retry - fail fast
        });
        // Suppress error events to prevent console flooding
        this.redis.on('error', () => { });
        this.subscriber = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            lazyConnect: true,
            retryStrategy: () => null
        });
        // Suppress error events
        this.subscriber.on('error', () => { });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.redis.on('connect', () => {
            this.logger.info('🔗 Redis queue connected');
        });
        this.redis.on('error', (error) => {
            this.logger.error('❌ Redis queue error:', error);
        });
        this.subscriber.on('error', (error) => {
            this.logger.error('❌ Redis subscriber error:', error);
        });
    }
    async connect() {
        await Promise.all([
            this.redis.connect(),
            this.subscriber.connect()
        ]);
        this.logger.info('✅ Redis queue system ready');
    }
    async disconnect() {
        await Promise.all([
            this.redis.disconnect(),
            this.subscriber.disconnect()
        ]);
    }
    /**
     * Send message to a role's input queue
     */
    async sendToRole(roleId, message) {
        const queueKey = this.getRoleQueueKey(roleId);
        const messageData = JSON.stringify(message);
        await this.redis.lpush(queueKey, messageData);
        this.logger.info(`📨 Message sent to role ${roleId}`, {
            workflowId: message.workflowId,
            step: message.metadata.step,
            queueKey
        });
        // Track active workflow
        await this.setWorkflowActiveRole(message.workflowId, roleId);
    }
    /**
     * Wait for message from role's input queue (blocking)
     */
    async waitForWork(roleId, timeoutSeconds = 0) {
        const queueKey = this.getRoleQueueKey(roleId);
        try {
            this.logger.info(`⏳ Role ${roleId} waiting for work on ${queueKey}`);
            // BRPOP blocks until message available or timeout
            const result = await this.redis.brpop(queueKey, timeoutSeconds);
            if (!result) {
                return null; // Timeout
            }
            const [, messageData] = result;
            const message = JSON.parse(messageData);
            this.logger.info(`📩 Role ${roleId} received work`, {
                workflowId: message.workflowId,
                step: message.metadata.step
            });
            return message;
        }
        catch (error) {
            this.logger.error(`❌ Error waiting for work in role ${roleId}:`, error);
            throw error;
        }
    }
    /**
     * Send completion notification
     */
    async sendCompletion(completion) {
        const completionKey = this.getWorkflowCompletionKey(completion.workflowId);
        const completionData = JSON.stringify(completion);
        await this.redis.lpush(completionKey, completionData);
        this.logger.info(`✅ Completion sent for workflow ${completion.workflowId}`, {
            roleId: completion.roleId,
            status: completion.status
        });
    }
    /**
     * Wait for workflow completion (blocking)
     */
    async waitForCompletion(workflowId, timeoutSeconds = 300) {
        const completionKey = this.getWorkflowCompletionKey(workflowId);
        try {
            const result = await this.redis.brpop(completionKey, timeoutSeconds);
            if (!result) {
                return null; // Timeout
            }
            const [, completionData] = result;
            return JSON.parse(completionData);
        }
        catch (error) {
            this.logger.error(`❌ Error waiting for completion of workflow ${workflowId}:`, error);
            throw error;
        }
    }
    /**
     * Get queue length for monitoring
     */
    async getQueueLength(roleId) {
        const queueKey = this.getRoleQueueKey(roleId);
        return await this.redis.llen(queueKey);
    }
    /**
     * Get all queue lengths for monitoring
     */
    async getAllQueueLengths() {
        const roles = ['architect', 'security', 'quality', 'performance', 'coordinator'];
        const lengths = {};
        for (const role of roles) {
            lengths[role] = await this.getQueueLength(role);
        }
        return lengths;
    }
    /**
     * Handle failed message with retry logic
     */
    async handleFailedMessage(message, error) {
        const { retryCount, maxRetries } = message.metadata;
        if (retryCount < maxRetries) {
            // Retry with incremented count
            const retryMessage = {
                ...message,
                metadata: {
                    ...message.metadata,
                    retryCount: retryCount + 1
                }
            };
            this.logger.warn(`🔄 Retrying message (attempt ${retryCount + 1}/${maxRetries})`, {
                workflowId: message.workflowId,
                roleId: message.roleId,
                error: error.message
            });
            await this.sendToRole(message.roleId, retryMessage);
        }
        else {
            // Send to dead letter queue
            const errorKey = this.getErrorQueueKey(message.roleId);
            const errorData = JSON.stringify({
                ...message,
                error: error.message,
                failedAt: Date.now()
            });
            await this.redis.lpush(errorKey, errorData);
            this.logger.error(`💀 Message sent to dead letter queue after ${maxRetries} retries`, {
                workflowId: message.workflowId,
                roleId: message.roleId,
                errorMessage: error.message
            });
            // Send error completion
            await this.sendCompletion({
                workflowId: message.workflowId,
                roleId: message.roleId,
                status: 'error',
                error: `Failed after ${maxRetries} retries: ${error.message}`,
                timestamp: Date.now()
            });
        }
    }
    /**
     * Clean up workflow data after completion
     */
    async cleanupWorkflow(workflowId) {
        const keys = [
            this.getWorkflowCompletionKey(workflowId),
            this.getWorkflowActiveRoleKey(workflowId),
            this.getWorkflowStatusKey(workflowId)
        ];
        await this.redis.del(...keys);
        this.logger.info(`🧹 Cleaned up workflow ${workflowId}`);
    }
    /**
     * Set workflow active role for monitoring
     */
    async setWorkflowActiveRole(workflowId, roleId) {
        const key = this.getWorkflowActiveRoleKey(workflowId);
        await this.redis.set(key, roleId, 'EX', 3600); // Expire after 1 hour
    }
    /**
     * Get workflow active role
     */
    async getWorkflowActiveRole(workflowId) {
        const key = this.getWorkflowActiveRoleKey(workflowId);
        return await this.redis.get(key);
    }
    // Key generation methods
    getRoleQueueKey(roleId) {
        return `role:${roleId}:queue`;
    }
    getWorkflowCompletionKey(workflowId) {
        return `workflow:${workflowId}:completion`;
    }
    getWorkflowActiveRoleKey(workflowId) {
        return `workflow:${workflowId}:active_role`;
    }
    getWorkflowStatusKey(workflowId) {
        return `workflow:${workflowId}:status`;
    }
    getErrorQueueKey(roleId) {
        return `role:${roleId}:errors`;
    }
}
exports.RedisQueue = RedisQueue;
exports.default = RedisQueue;
//# sourceMappingURL=redis-queue.js.map