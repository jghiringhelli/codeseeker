import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType } from './types';
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
    summarizationLevel: 0 | 1 | 2 | 3;
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
    willExceedIn: number;
}
export declare class ContextManager extends EventEmitter {
    private logger;
    private claudeLimits;
    private currentUsage;
    private contextWindows;
    private compressionStrategies;
    private pausedNodes;
    private waitQueue;
    constructor(logger: Logger);
    private initializeCompressionStrategies;
    detectClaudeLimitApproaching(executionId: string): Promise<boolean>;
    compressContext(content: any, roleType: RoleType, preserveEssential?: boolean): Promise<ContextWindow>;
    private extractEssentialInfo;
    private intelligentSummarization;
    pauseNode(nodeId: string, reason: string): Promise<void>;
    resumeNode(nodeId: string): Promise<void>;
    queueMessage(message: any, roleType: RoleType, priority?: number): Promise<void>;
    private processQueuedMessages;
    private canProcessMessage;
    private processMessage;
    private startMonitoring;
    private handleLimitApproaching;
    private increaseCompressionLevels;
    private startCooldownPeriod;
    private resetCompressionLevels;
    private estimateTokens;
    private generateSemanticHash;
    private generateVectorEmbedding;
    private calculatePriority;
    private hasNestedProperty;
    private getNestedProperty;
    private identifyDroppableKeys;
    private generateExecutiveSummary;
    private extractKeyPoints;
    private extractCriticalData;
    private extractActionableInfo;
    private saveNodeState;
    private checkRateLimits;
    private getCurrentConcurrentRequests;
    private getNodeRole;
    private getOriginalStrategy;
    getContextWindow(id: string): Promise<ContextWindow | null>;
    updateUsage(executionId: string, tokensUsed: number): Promise<void>;
    isPaused(nodeId: string): boolean;
    getQueueSize(): number;
}
//# sourceMappingURL=context-manager.d.ts.map