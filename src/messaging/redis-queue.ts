/**
 * Redis-based message queue system for sequential workflow orchestration
 * 
 * Provides reliable message passing between workflow roles with blocking operations
 * and automatic cleanup. Each role has dedicated queues for input and completion.
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export interface WorkflowMessage {
  workflowId: string;
  roleId: string;
  previousRole?: string;
  input: {
    originalQuery: string;
    projectPath: string;
    toolResults?: any[];
    contextFromPrevious?: any;
  };
  metadata: {
    step: number;
    totalSteps: number;
    timestamp: number;
    priority: 'high' | 'normal';
    retryCount: number;
    maxRetries: number;
  };
}

export interface WorkflowCompletion {
  workflowId: string;
  roleId: string;
  status: 'complete' | 'error' | 'progress';
  result?: any;
  error?: string;
  timestamp: number;
}

export class RedisQueue {
  private redis: Redis;
  private subscriber: Redis;
  private logger = Logger.getInstance();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
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

  async connect(): Promise<void> {
    await Promise.all([
      this.redis.connect(),
      this.subscriber.connect()
    ]);
    this.logger.info('✅ Redis queue system ready');
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.redis.disconnect(),
      this.subscriber.disconnect()
    ]);
  }

  /**
   * Send message to a role's input queue
   */
  async sendToRole(roleId: string, message: WorkflowMessage): Promise<void> {
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
  async waitForWork(roleId: string, timeoutSeconds: number = 0): Promise<WorkflowMessage | null> {
    const queueKey = this.getRoleQueueKey(roleId);
    
    try {
      this.logger.info(`⏳ Role ${roleId} waiting for work on ${queueKey}`);
      
      // BRPOP blocks until message available or timeout
      const result = await this.redis.brpop(queueKey, timeoutSeconds);
      
      if (!result) {
        return null; // Timeout
      }

      const [, messageData] = result;
      const message: WorkflowMessage = JSON.parse(messageData);
      
      this.logger.info(`📩 Role ${roleId} received work`, {
        workflowId: message.workflowId,
        step: message.metadata.step
      });

      return message;
    } catch (error) {
      this.logger.error(`❌ Error waiting for work in role ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * Send completion notification
   */
  async sendCompletion(completion: WorkflowCompletion): Promise<void> {
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
  async waitForCompletion(workflowId: string, timeoutSeconds: number = 300): Promise<WorkflowCompletion | null> {
    const completionKey = this.getWorkflowCompletionKey(workflowId);
    
    try {
      const result = await this.redis.brpop(completionKey, timeoutSeconds);
      
      if (!result) {
        return null; // Timeout
      }

      const [, completionData] = result;
      return JSON.parse(completionData);
    } catch (error) {
      this.logger.error(`❌ Error waiting for completion of workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Get queue length for monitoring
   */
  async getQueueLength(roleId: string): Promise<number> {
    const queueKey = this.getRoleQueueKey(roleId);
    return await this.redis.llen(queueKey);
  }

  /**
   * Get all queue lengths for monitoring
   */
  async getAllQueueLengths(): Promise<Record<string, number>> {
    const roles = ['architect', 'security', 'quality', 'performance', 'coordinator'];
    const lengths: Record<string, number> = {};
    
    for (const role of roles) {
      lengths[role] = await this.getQueueLength(role);
    }
    
    return lengths;
  }

  /**
   * Handle failed message with retry logic
   */
  async handleFailedMessage(message: WorkflowMessage, error: Error): Promise<void> {
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
    } else {
      // Send to dead letter queue
      const errorKey = this.getErrorQueueKey(message.roleId);
      const errorData = JSON.stringify({
        ...message,
        error: error.message,
        failedAt: Date.now()
      });
      
      await this.redis.lpush(errorKey, errorData);
      
      this.logger.error(`💀 Message sent to dead letter queue after ${maxRetries} retries`, {
        workflowId: (message as any).workflowId,
        roleId: (message as any).roleId,
        errorMessage: error.message
      } as any);

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
  async cleanupWorkflow(workflowId: string): Promise<void> {
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
  private async setWorkflowActiveRole(workflowId: string, roleId: string): Promise<void> {
    const key = this.getWorkflowActiveRoleKey(workflowId);
    await this.redis.set(key, roleId, 'EX', 3600); // Expire after 1 hour
  }

  /**
   * Get workflow active role
   */
  async getWorkflowActiveRole(workflowId: string): Promise<string | null> {
    const key = this.getWorkflowActiveRoleKey(workflowId);
    return await this.redis.get(key);
  }

  // Key generation methods
  private getRoleQueueKey(roleId: string): string {
    return `role:${roleId}:queue`;
  }

  private getWorkflowCompletionKey(workflowId: string): string {
    return `workflow:${workflowId}:completion`;
  }

  private getWorkflowActiveRoleKey(workflowId: string): string {
    return `workflow:${workflowId}:active_role`;
  }

  private getWorkflowStatusKey(workflowId: string): string {
    return `workflow:${workflowId}:status`;
  }

  private getErrorQueueKey(roleId: string): string {
    return `role:${roleId}:errors`;
  }
}

export default RedisQueue;