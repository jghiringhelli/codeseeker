#!/usr/bin/env node
import { EventEmitter } from 'events';
export interface MessageData {
    id: string;
    type: 'workflow_command' | 'terminal_request' | 'terminal_response' | 'orchestrator_status' | 'workflow_update';
    payload: any;
    timestamp: Date;
    source: string;
    target?: string;
    projectId?: string;
    workflowId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
}
export interface WorkflowCommand {
    action: 'start' | 'pause' | 'stop' | 'resume';
    workflowId: string;
    projectPath: string;
    parameters?: Record<string, any>;
}
export interface TerminalRequest {
    requestId: string;
    command: string;
    workingDirectory: string;
    environment?: Record<string, string>;
    timeout?: number;
}
export interface TerminalResponse {
    requestId: string;
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    duration: number;
}
export interface WorkflowUpdate {
    workflowId: string;
    status: 'running' | 'paused' | 'completed' | 'failed';
    currentStep?: string;
    progress?: number;
    message?: string;
}
export declare class RedisMessagingService extends EventEmitter {
    private redisUrl;
    private instanceId;
    private publisher;
    private subscriber;
    private logger;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private readonly CHANNELS;
    private static buildRedisUrl;
    constructor(redisUrl?: string, instanceId?: string);
    private setupRedisClients;
    private setupEventHandlers;
    private setupSubscriptions;
    private attemptReconnect;
    private startHeartbeat;
    private handleOrchestratorCommand;
    private handleTerminalRequest;
    private handleTerminalResponse;
    private handleWorkflowUpdate;
    private handleSystemStatus;
    private handleHeartbeat;
    publishMessage(channel: string, data: any): Promise<void>;
    sendWorkflowCommand(command: WorkflowCommand): Promise<void>;
    sendTerminalRequest(request: TerminalRequest): Promise<void>;
    sendTerminalResponse(response: TerminalResponse): Promise<void>;
    sendWorkflowUpdate(update: WorkflowUpdate): Promise<void>;
    sendSystemStatus(status: any): Promise<void>;
    isHealthy(): boolean;
    getConnectionInfo(): {
        connected: boolean;
        reconnectAttempts: number;
        instanceId: string;
    };
    getChannelInfo(): Promise<Record<string, any>>;
    disconnect(): Promise<void>;
    static create(redisUrl?: string, instanceId?: string): Promise<RedisMessagingService>;
}
export declare function getRedisMessaging(): Promise<RedisMessagingService>;
export default RedisMessagingService;
//# sourceMappingURL=redis-messaging.d.ts.map