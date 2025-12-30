#!/usr/bin/env node

import { createClient, RedisClientType } from 'redis';
import { Logger } from '../../utils/logger';
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

export class RedisMessagingService extends EventEmitter {
    private publisher: RedisClientType;
    private subscriber: RedisClientType;
    private logger = Logger.getInstance();
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000; // Start with 1 second

    // Channel names
    private readonly CHANNELS = {
        ORCHESTRATOR_COMMANDS: 'codemind:orchestrator:commands',
        TERMINAL_REQUESTS: 'codemind:terminal:requests',
        TERMINAL_RESPONSES: 'codemind:terminal:responses',
        WORKFLOW_UPDATES: 'codemind:workflows:updates',
        SYSTEM_STATUS: 'codemind:system:status',
        HEARTBEAT: 'codemind:heartbeat'
    };

    private static buildRedisUrl(): string {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || '6379';
        return `redis://${host}:${port}`;
    }

    constructor(
        private redisUrl: string = process.env.REDIS_URL || RedisMessagingService.buildRedisUrl(),
        private instanceId: string = `codemind-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    ) {
        super();
        // Build Redis URL with password if provided
        if (process.env.REDIS_PASSWORD && !this.redisUrl.includes('@')) {
            const url = new URL(this.redisUrl);
            url.password = process.env.REDIS_PASSWORD;
            this.redisUrl = url.toString();
        }
        this.setupRedisClients();
    }

    private async setupRedisClients() {
        try {
            // Create publisher client
            this.publisher = createClient({
                url: this.redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > this.maxReconnectAttempts) {
                            return new Error('Max reconnection attempts reached');
                        }
                        return Math.min(this.reconnectDelay * Math.pow(2, retries), 10000);
                    }
                }
            });

            // Create subscriber client
            this.subscriber = createClient({
                url: this.redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > this.maxReconnectAttempts) {
                            return new Error('Max reconnection attempts reached');
                        }
                        return Math.min(this.reconnectDelay * Math.pow(2, retries), 10000);
                    }
                }
            });

            // Setup event handlers
            this.setupEventHandlers();

            // Connect
            await Promise.all([
                this.publisher.connect(),
                this.subscriber.connect()
            ]);

            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.logger.info('Redis messaging service connected successfully');

            // Subscribe to channels
            await this.setupSubscriptions();

            // Start heartbeat
            this.startHeartbeat();

            this.emit('connected');

        } catch (error) {
            this.logger.error('Failed to setup Redis clients:', error as Error);
            this.isConnected = false;
            await this.attemptReconnect();
        }
    }

    private setupEventHandlers() {
        // Publisher events
        this.publisher.on('error', (error) => {
            this.logger.error('Redis publisher error:', error);
            this.isConnected = false;
            this.emit('error', error);
        });

        this.publisher.on('connect', () => {
            this.logger.info('Redis publisher connected');
        });

        this.publisher.on('disconnect', () => {
            this.logger.warn('Redis publisher disconnected');
            this.isConnected = false;
            this.emit('disconnected');
        });

        // Subscriber events
        this.subscriber.on('error', (error) => {
            this.logger.error('Redis subscriber error:', error);
            this.isConnected = false;
            this.emit('error', error);
        });

        this.subscriber.on('connect', () => {
            this.logger.info('Redis subscriber connected');
        });

        this.subscriber.on('disconnect', () => {
            this.logger.warn('Redis subscriber disconnected');
            this.isConnected = false;
            this.emit('disconnected');
        });
    }

    private async setupSubscriptions() {
        try {
            // Subscribe to all channels
            await Promise.all([
                this.subscriber.subscribe(this.CHANNELS.ORCHESTRATOR_COMMANDS, this.handleOrchestratorCommand.bind(this)),
                this.subscriber.subscribe(this.CHANNELS.TERMINAL_REQUESTS, this.handleTerminalRequest.bind(this)),
                this.subscriber.subscribe(this.CHANNELS.TERMINAL_RESPONSES, this.handleTerminalResponse.bind(this)),
                this.subscriber.subscribe(this.CHANNELS.WORKFLOW_UPDATES, this.handleWorkflowUpdate.bind(this)),
                this.subscriber.subscribe(this.CHANNELS.SYSTEM_STATUS, this.handleSystemStatus.bind(this)),
                this.subscriber.subscribe(this.CHANNELS.HEARTBEAT, this.handleHeartbeat.bind(this))
            ]);

            this.logger.info('Subscribed to all Redis channels');
        } catch (error) {
            this.logger.error('Failed to setup Redis subscriptions:', error as Error);
            throw error;
        }
    }

    private async attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached, giving up');
            this.emit('maxReconnectsReached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 10000);

        this.logger.info(`Attempting to reconnect to Redis (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

        setTimeout(async () => {
            try {
                await this.setupRedisClients();
            } catch (error) {
                this.logger.error('Reconnection attempt failed:', error as Error);
                await this.attemptReconnect();
            }
        }, delay);
    }

    private startHeartbeat() {
        setInterval(async () => {
            if (this.isConnected) {
                await this.publishMessage(this.CHANNELS.HEARTBEAT, {
                    instanceId: this.instanceId,
                    timestamp: new Date(),
                    status: 'alive'
                });
            }
        }, 30000); // 30 seconds
    }

    // Message handlers
    private async handleOrchestratorCommand(message: string, channel: string) {
        try {
            const data: MessageData = JSON.parse(message);
            this.logger.info(`Received orchestrator command: ${data.type}`, { data });
            this.emit('orchestrator_command', data);
        } catch (error) {
            this.logger.error('Failed to parse orchestrator command message:', error as Error);
        }
    }

    private async handleTerminalRequest(message: string, channel: string) {
        try {
            const data: MessageData = JSON.parse(message);
            this.logger.info(`Received terminal request: ${data.payload.command}`, { data });
            this.emit('terminal_request', data);
        } catch (error) {
            this.logger.error('Failed to parse terminal request message:', error as Error);
        }
    }

    private async handleTerminalResponse(message: string, channel: string) {
        try {
            const data: MessageData = JSON.parse(message);
            this.logger.info(`Received terminal response for request: ${data.payload.requestId}`);
            this.emit('terminal_response', data);
        } catch (error) {
            this.logger.error('Failed to parse terminal response message:', error as Error);
        }
    }

    private async handleWorkflowUpdate(message: string, channel: string) {
        try {
            const data: MessageData = JSON.parse(message);
            this.logger.info(`Received workflow update: ${data.payload.status}`, { workflowId: data.workflowId });
            this.emit('workflow_update', data);
        } catch (error) {
            this.logger.error('Failed to parse workflow update message:', error as Error);
        }
    }

    private async handleSystemStatus(message: string, channel: string) {
        try {
            const data: MessageData = JSON.parse(message);
            this.logger.debug('Received system status update');
            this.emit('system_status', data);
        } catch (error) {
            this.logger.error('Failed to parse system status message:', error as Error);
        }
    }

    private async handleHeartbeat(message: string, channel: string) {
        try {
            const data = JSON.parse(message);
            if (data.instanceId !== this.instanceId) {
                this.logger.debug(`Heartbeat from instance: ${data.instanceId}`);
                this.emit('heartbeat', data);
            }
        } catch (error) {
            this.logger.error('Failed to parse heartbeat message:', error as Error);
        }
    }

    // Public methods
    async publishMessage(channel: string, data: any): Promise<void> {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }

        try {
            const message = JSON.stringify(data);
            await this.publisher.publish(channel, message);
            this.logger.debug(`Published message to ${channel}`, { data });
        } catch (error) {
            this.logger.error(`Failed to publish message to ${channel}:`, error as Error);
            throw error;
        }
    }

    async sendWorkflowCommand(command: WorkflowCommand): Promise<void> {
        const messageData: MessageData = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'workflow_command',
            payload: command,
            timestamp: new Date(),
            source: this.instanceId,
            workflowId: command.workflowId,
            priority: 'medium'
        };

        await this.publishMessage(this.CHANNELS.ORCHESTRATOR_COMMANDS, messageData);
    }

    async sendTerminalRequest(request: TerminalRequest): Promise<void> {
        const messageData: MessageData = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'terminal_request',
            payload: request,
            timestamp: new Date(),
            source: this.instanceId,
            priority: 'high'
        };

        await this.publishMessage(this.CHANNELS.TERMINAL_REQUESTS, messageData);
    }

    async sendTerminalResponse(response: TerminalResponse): Promise<void> {
        const messageData: MessageData = {
            id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'terminal_response',
            payload: response,
            timestamp: new Date(),
            source: this.instanceId,
            priority: 'high'
        };

        await this.publishMessage(this.CHANNELS.TERMINAL_RESPONSES, messageData);
    }

    async sendWorkflowUpdate(update: WorkflowUpdate): Promise<void> {
        const messageData: MessageData = {
            id: `upd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'workflow_update',
            payload: update,
            timestamp: new Date(),
            source: this.instanceId,
            workflowId: update.workflowId,
            priority: 'medium'
        };

        await this.publishMessage(this.CHANNELS.WORKFLOW_UPDATES, messageData);
    }

    async sendSystemStatus(status: any): Promise<void> {
        const messageData: MessageData = {
            id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'orchestrator_status',
            payload: status,
            timestamp: new Date(),
            source: this.instanceId,
            priority: 'low'
        };

        await this.publishMessage(this.CHANNELS.SYSTEM_STATUS, messageData);
    }

    // Utility methods
    isHealthy(): boolean {
        return this.isConnected && this.publisher.isReady && this.subscriber.isReady;
    }

    getConnectionInfo(): { connected: boolean; reconnectAttempts: number; instanceId: string } {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            instanceId: this.instanceId
        };
    }

    async getChannelInfo(): Promise<Record<string, any>> {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }

        const info: Record<string, any> = {};
        
        for (const [name, channel] of Object.entries(this.CHANNELS)) {
            try {
                // Get number of subscribers for each channel
                const subscribers = await this.publisher.pubSubNumSub([channel]);
                info[name] = {
                    channel,
                    subscribers: subscribers[channel] || 0
                };
            } catch (error) {
                info[name] = {
                    channel,
                    subscribers: 'unknown',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        return info;
    }

    async disconnect(): Promise<void> {
        this.logger.info('Disconnecting Redis messaging service');
        
        try {
            await Promise.all([
                this.publisher.disconnect(),
                this.subscriber.disconnect()
            ]);
            this.isConnected = false;
            this.emit('disconnected');
            this.logger.info('Redis messaging service disconnected');
        } catch (error) {
            this.logger.error('Error during Redis disconnect:', error as Error);
        }
    }

    // Static factory method
    static async create(redisUrl?: string, instanceId?: string): Promise<RedisMessagingService> {
        const service = new RedisMessagingService(redisUrl, instanceId);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Redis connection timeout'));
            }, 10000);

            service.once('connected', () => {
                clearTimeout(timeout);
                resolve(service);
            });

            service.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
}

// Export singleton instance
let redisMessagingInstance: RedisMessagingService | null = null;

export async function getRedisMessaging(): Promise<RedisMessagingService> {
    if (!redisMessagingInstance) {
        redisMessagingInstance = await RedisMessagingService.create();
    }
    return redisMessagingInstance;
}

export default RedisMessagingService;