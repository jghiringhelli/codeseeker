// ⚠️ DEPRECATED: Legacy Advanced Context Management System with Claude Limit Detection
// This file is part of the legacy parallel orchestration system.
// New implementations should use context optimization in sequential-workflow-orchestrator.ts instead.
// This file will be removed in a future version.

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { compress, decompress } from 'lz-string';
import { RoleType, WorkflowNode, WorkflowExecution } from './types';

export interface ContextWindow {
  id: string;
  roleType: RoleType;
  tokens: number;
  compressedContent: string;
  originalSize: number;
  compressionRatio: number;
  priority: number;
  timestamp: Date;
  metadata: ContextMetadata;
}

export interface ContextMetadata {
  essentialKeys: string[];
  droppableKeys: string[];
  summarizationLevel: 0 | 1 | 2 | 3; // 0=none, 3=maximum
  vectorEmbedding?: Float32Array;
  semanticHash: string;
}

export interface ClaudeLimits {
  maxTokensPerMessage: number;
  maxTokensPerConversation: number;
  maxMessagesPerMinute: number;
  maxConcurrentRequests: number;
  cooldownPeriodMs: number;
}

export interface TokenUsage {
  current: number;
  limit: number;
  percentage: number;
  estimatedRemaining: number;
  willExceedIn: number; // messages
}

export class ContextManager extends EventEmitter {
  private logger: Logger;
  private claudeLimits: ClaudeLimits;
  private currentUsage: Map<string, TokenUsage> = new Map();
  private contextWindows: Map<string, ContextWindow> = new Map();
  private compressionStrategies: Map<RoleType, CompressionStrategy> = new Map();
  private pausedNodes: Set<string> = new Set();
  private waitQueue: PriorityQueue<QueuedMessage> = new PriorityQueue();

  constructor(logger: Logger) {
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

  private initializeCompressionStrategies(): void {
    // Define compression strategies per role type
    const strategies: Record<RoleType, CompressionStrategy> = {
      [RoleType.ORCHESTRATOR]: {
        maxTokens: 8000,
        preserveKeys: ['workflowId', 'currentPhase', 'criticalDecisions', 'qualityGates'],
        summarizationLevel: 1,
        useVectorSearch: true
      },
      [RoleType.WORK_CLASSIFIER]: {
        maxTokens: 2000,
        preserveKeys: ['workType', 'priority', 'complexity'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.REQUIREMENT_ANALYST]: {
        maxTokens: 4000,
        preserveKeys: ['requirements', 'acceptanceCriteria', 'dependencies'],
        summarizationLevel: 1,
        useVectorSearch: true
      },
      [RoleType.TEST_DESIGNER]: {
        maxTokens: 3000,
        preserveKeys: ['testCases', 'coverage', 'criticalPaths'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.IMPLEMENTATION_DEVELOPER]: {
        maxTokens: 6000,
        preserveKeys: ['implementation', 'interfaces', 'dependencies', 'errors'],
        summarizationLevel: 1,
        useVectorSearch: true
      },
      [RoleType.CODE_REVIEWER]: {
        maxTokens: 4000,
        preserveKeys: ['issues', 'suggestions', 'qualityMetrics'],
        summarizationLevel: 2,
        useVectorSearch: true
      },
      [RoleType.SECURITY_AUDITOR]: {
        maxTokens: 3000,
        preserveKeys: ['vulnerabilities', 'securityScore', 'criticalIssues'],
        summarizationLevel: 1,
        useVectorSearch: true
      },
      [RoleType.PERFORMANCE_AUDITOR]: {
        maxTokens: 3000,
        preserveKeys: ['metrics', 'bottlenecks', 'optimization'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.QUALITY_AUDITOR]: {
        maxTokens: 3500,
        preserveKeys: ['qualityScores', 'violations', 'recommendations'],
        summarizationLevel: 2,
        useVectorSearch: true
      },
      [RoleType.COMPILER_BUILDER]: {
        maxTokens: 2500,
        preserveKeys: ['buildStatus', 'errors', 'artifacts'],
        summarizationLevel: 3,
        useVectorSearch: false
      },
      [RoleType.DEVOPS_ENGINEER]: {
        maxTokens: 3000,
        preserveKeys: ['pipeline', 'infrastructure', 'deploymentConfig'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.DEPLOYER]: {
        maxTokens: 2000,
        preserveKeys: ['deploymentStatus', 'environment', 'rollbackPlan'],
        summarizationLevel: 3,
        useVectorSearch: false
      },
      [RoleType.UNIT_TEST_EXECUTOR]: {
        maxTokens: 2500,
        preserveKeys: ['testResults', 'failures', 'coverage'],
        summarizationLevel: 3,
        useVectorSearch: false
      },
      [RoleType.INTEGRATION_TEST_ENGINEER]: {
        maxTokens: 3000,
        preserveKeys: ['integrationTests', 'apiContracts', 'failures'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.E2E_TEST_ENGINEER]: {
        maxTokens: 3500,
        preserveKeys: ['userJourneys', 'e2eResults', 'criticalPaths'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.TECHNICAL_DOCUMENTER]: {
        maxTokens: 3000,
        preserveKeys: ['documentation', 'apiSpecs', 'diagrams'],
        summarizationLevel: 2,
        useVectorSearch: true
      },
      [RoleType.USER_DOCUMENTER]: {
        maxTokens: 2500,
        preserveKeys: ['userGuides', 'tutorials', 'faqs'],
        summarizationLevel: 2,
        useVectorSearch: true
      },
      [RoleType.RELEASE_MANAGER]: {
        maxTokens: 2500,
        preserveKeys: ['version', 'changelog', 'releaseNotes'],
        summarizationLevel: 2,
        useVectorSearch: false
      },
      [RoleType.DOCUMENTATION_WRITER]: {
        maxTokens: 3000,
        preserveKeys: ['documentation', 'content', 'structure'],
        summarizationLevel: 2,
        useVectorSearch: true
      },
      [RoleType.COMMITTER]: {
        maxTokens: 1500,
        preserveKeys: ['commitMessage', 'changes', 'branch'],
        summarizationLevel: 3,
        useVectorSearch: false
      }
    };

    Object.entries(strategies).forEach(([roleType, strategy]) => {
      this.compressionStrategies.set(roleType as RoleType, strategy);
    });
  }

  async detectClaudeLimitApproaching(executionId: string): Promise<boolean> {
    const usage = this.currentUsage.get(executionId);
    if (!usage) return false;

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

  async compressContext(
    content: any,
    roleType: RoleType,
    preserveEssential: boolean = true
  ): Promise<ContextWindow> {
    const strategy = this.compressionStrategies.get(roleType)!;
    const originalSize = JSON.stringify(content).length;

    // Step 1: Extract essential information
    const essential = this.extractEssentialInfo(content, strategy.preserveKeys);
    
    // Step 2: Apply intelligent summarization
    const summarized = await this.intelligentSummarization(
      content,
      strategy.summarizationLevel,
      essential
    );

    // Step 3: Apply compression
    const compressed = compress(JSON.stringify(summarized));
    
    // Step 4: Generate semantic hash for deduplication
    const semanticHash = this.generateSemanticHash(summarized);
    
    // Step 5: Create vector embedding if needed
    const vectorEmbedding = strategy.useVectorSearch 
      ? await this.generateVectorEmbedding(summarized)
      : undefined;

    const contextWindow: ContextWindow = {
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

  private extractEssentialInfo(content: any, preserveKeys: string[]): any {
    const essential: any = {};
    
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

  private async intelligentSummarization(
    content: any,
    level: number,
    essential: any
  ): Promise<any> {
    if (level === 0) return content; // No summarization
    
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

  async pauseNode(nodeId: string, reason: string): Promise<void> {
    this.pausedNodes.add(nodeId);
    this.logger.info(`Node ${nodeId} paused: ${reason}`);
    
    // Save current state for potential rollback
    await this.saveNodeState(nodeId);
    
    this.emit('node-paused', { nodeId, reason, timestamp: new Date() });
  }

  async resumeNode(nodeId: string): Promise<void> {
    this.pausedNodes.delete(nodeId);
    this.logger.info(`Node ${nodeId} resumed`);
    
    // Process any queued messages for this node
    await this.processQueuedMessages(nodeId);
    
    this.emit('node-resumed', { nodeId, timestamp: new Date() });
  }

  async queueMessage(
    message: any,
    roleType: RoleType,
    priority: number = 5
  ): Promise<void> {
    const queuedMessage: QueuedMessage = {
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

  private async processQueuedMessages(nodeId?: string): Promise<void> {
    while (!this.waitQueue.isEmpty()) {
      const message = this.waitQueue.dequeue();
      if (!message) break;
      
      // Check if we can process this message
      if (await this.canProcessMessage(message)) {
        await this.processMessage(message);
      } else {
        // Re-queue with lower priority
        message.priority = Math.max(1, message.priority - 1);
        this.waitQueue.enqueue(message, message.priority);
        break; // Stop processing for now
      }
    }
  }

  private async canProcessMessage(message: QueuedMessage): Promise<boolean> {
    // Check Claude limits
    const limitCheck = await this.detectClaudeLimitApproaching('current');
    if (limitCheck) return false;
    
    // Check if role is paused
    if (this.pausedNodes.has(message.roleType)) return false;
    
    // Check concurrent request limits
    const concurrentRequests = this.getCurrentConcurrentRequests();
    if (concurrentRequests >= this.claudeLimits.maxConcurrentRequests) return false;
    
    return true;
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    try {
      // Compress the message
      const compressed = await this.compressContext(
        message.message,
        message.roleType
      );
      
      // Send to appropriate role handler
      this.emit('message-ready', {
        roleType: message.roleType,
        context: compressed,
        priority: message.priority
      });
      
    } catch (error) {
      this.logger.error(`Failed to process message for ${message.roleType}`, error);
      message.attempts++;
      
      if (message.attempts < message.maxAttempts) {
        // Re-queue for retry
        this.waitQueue.enqueue(message, message.priority - 1);
      }
    }
  }

  private startMonitoring(): void {
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

  private async handleLimitApproaching(executionId: string): Promise<void> {
    this.logger.warn(`Handling limit approaching for execution ${executionId}`);
    
    // Pause non-critical nodes
    const criticalRoles = [
      RoleType.ORCHESTRATOR,
      RoleType.SECURITY_AUDITOR,
      RoleType.DEPLOYER
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

  private increaseCompressionLevels(): void {
    for (const [roleType, strategy] of this.compressionStrategies) {
      strategy.summarizationLevel = Math.min(3, strategy.summarizationLevel + 1) as 0 | 1 | 2 | 3;
      strategy.maxTokens = Math.floor(strategy.maxTokens * 0.7); // Reduce by 30%
    }
    this.logger.info('Compression levels increased due to limit approaching');
  }

  private async startCooldownPeriod(): Promise<void> {
    this.logger.info(`Starting cooldown period: ${this.claudeLimits.cooldownPeriodMs}ms`);
    
    // Pause all non-critical operations
    this.emit('cooldown-started', { duration: this.claudeLimits.cooldownPeriodMs });
    
    await new Promise(resolve => setTimeout(resolve, this.claudeLimits.cooldownPeriodMs));
    
    // Resume operations with reduced rate
    this.emit('cooldown-ended');
    
    // Reset compression levels gradually
    this.resetCompressionLevels();
  }

  private resetCompressionLevels(): void {
    for (const [roleType, strategy] of this.compressionStrategies) {
      const original = this.getOriginalStrategy(roleType);
      strategy.summarizationLevel = original.summarizationLevel;
      strategy.maxTokens = original.maxTokens;
    }
  }

  // Helper methods
  private estimateTokens(content: any): number {
    // Rough estimation: 1 token ≈ 4 characters
    const contentStr = JSON.stringify(content);
    return Math.ceil(contentStr.length / 4);
  }

  private generateSemanticHash(content: any): string {
    // Generate a semantic hash for deduplication
    const key = JSON.stringify(content)
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
      .toString(36);
    return key;
  }

  private async generateVectorEmbedding(content: any): Promise<Float32Array> {
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

  private calculatePriority(roleType: RoleType, content: any): number {
    const rolePriorities: Record<RoleType, number> = {
      [RoleType.ORCHESTRATOR]: 10,
      [RoleType.SECURITY_AUDITOR]: 9,
      [RoleType.DEPLOYER]: 8,
      [RoleType.IMPLEMENTATION_DEVELOPER]: 7,
      [RoleType.TEST_DESIGNER]: 6,
      [RoleType.CODE_REVIEWER]: 6,
      [RoleType.QUALITY_AUDITOR]: 5,
      [RoleType.PERFORMANCE_AUDITOR]: 5,
      [RoleType.REQUIREMENT_ANALYST]: 4,
      [RoleType.WORK_CLASSIFIER]: 3,
      [RoleType.COMPILER_BUILDER]: 3,
      [RoleType.DEVOPS_ENGINEER]: 4,
      [RoleType.UNIT_TEST_EXECUTOR]: 3,
      [RoleType.INTEGRATION_TEST_ENGINEER]: 3,
      [RoleType.E2E_TEST_ENGINEER]: 3,
      [RoleType.TECHNICAL_DOCUMENTER]: 2,
      [RoleType.USER_DOCUMENTER]: 2,
      [RoleType.DOCUMENTATION_WRITER]: 2,
      [RoleType.RELEASE_MANAGER]: 2,
      [RoleType.COMMITTER]: 1
    };
    
    return rolePriorities[roleType] || 5;
  }

  private hasNestedProperty(obj: any, path: string): boolean {
    return path.split('.').reduce((current, key) => current?.[key], obj) !== undefined;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private identifyDroppableKeys(content: any, preserveKeys: string[]): string[] {
    const allKeys = Object.keys(content);
    return allKeys.filter(key => !preserveKeys.includes(key));
  }

  private generateExecutiveSummary(content: any): string {
    // Generate concise executive summary
    return `Summary of ${content.type || 'content'}: ${content.status || 'in-progress'}`;
  }

  private extractKeyPoints(content: any): string[] {
    // Extract key points from content
    const points: string[] = [];
    if (content.results) points.push(`Results: ${content.results.length} items`);
    if (content.errors) points.push(`Errors: ${content.errors.length}`);
    if (content.status) points.push(`Status: ${content.status}`);
    return points;
  }

  private extractCriticalData(content: any): any {
    // Extract only critical data
    return {
      id: content.id,
      status: content.status,
      errors: content.errors?.length || 0,
      critical: content.critical || content.important || content.required
    };
  }

  private extractActionableInfo(content: any): any {
    // Extract actionable information
    return {
      action: content.action || content.nextStep || 'continue',
      blockers: content.blockers || content.errors || [],
      decisions: content.decisions || content.choices || []
    };
  }

  private async saveNodeState(nodeId: string): Promise<void> {
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

  private async checkRateLimits(executionId: string): Promise<number> {
    // Check rate limit usage
    // Simplified implementation
    return 50; // Return percentage used
  }

  private getCurrentConcurrentRequests(): number {
    // Count current concurrent requests
    // Simplified implementation
    return 5;
  }

  private getNodeRole(nodeId: string): RoleType | null {
    // Get role type for a node
    // Simplified implementation
    return RoleType.IMPLEMENTATION_DEVELOPER;
  }

  private getOriginalStrategy(roleType: RoleType): CompressionStrategy {
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
  async getContextWindow(id: string): Promise<ContextWindow | null> {
    return this.contextWindows.get(id) || null;
  }

  async updateUsage(executionId: string, tokensUsed: number): Promise<void> {
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

  isPaused(nodeId: string): boolean {
    return this.pausedNodes.has(nodeId);
  }

  getQueueSize(): number {
    return this.waitQueue.size();
  }
}

// Supporting interfaces and classes
interface CompressionStrategy {
  maxTokens: number;
  preserveKeys: string[];
  summarizationLevel: 0 | 1 | 2 | 3;
  useVectorSearch: boolean;
}

interface QueuedMessage {
  id: string;
  roleType: RoleType;
  message: any;
  priority: number;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
}

class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number }> = [];

  enqueue(element: T, priority: number): void {
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

  dequeue(): T | null {
    if (this.isEmpty()) return null;
    return this.items.shift()!.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}