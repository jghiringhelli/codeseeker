#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisMessagingService = void 0;
exports.getRedisMessaging = getRedisMessaging;
const redis_1 = require("redis");
const logger_1 = require("../../utils/logger");
const events_1 = require("events");
class RedisMessagingService extends events_1.EventEmitter {
    redisUrl;
    instanceId;
    publisher;
    subscriber;
    logger = logger_1.Logger.getInstance();
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    reconnectDelay = 1000; // Start with 1 second
    // Channel names
    CHANNELS = {
        ORCHESTRATOR_COMMANDS: 'codemind:orchestrator:commands',
        TERMINAL_REQUESTS: 'codemind:terminal:requests',
        TERMINAL_RESPONSES: 'codemind:terminal:responses',
        WORKFLOW_UPDATES: 'codemind:workflows:updates',
        SYSTEM_STATUS: 'codemind:system:status',
        HEARTBEAT: 'codemind:heartbeat'
    };
    static buildRedisUrl() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || '6379';
        return `redis://${host}:${port}`;
    }
    constructor(redisUrl = process.env.REDIS_URL || RedisMessagingService.buildRedisUrl(), instanceId = `codemind-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`) {
        super();
        this.redisUrl = redisUrl;
        this.instanceId = instanceId;
        // Build Redis URL with password if provided
        if (process.env.REDIS_PASSWORD && !this.redisUrl.includes('@')) {
            const url = new URL(this.redisUrl);
            url.password = process.env.REDIS_PASSWORD;
            this.redisUrl = url.toString();
        }
        this.setupRedisClients();
    }
    async setupRedisClients() {
        try {
            // Create publisher client
            this.publisher = (0, redis_1.createClient)({
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
            this.subscriber = (0, redis_1.createClient)({
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
        }
        catch (error) {
            this.logger.error('Failed to setup Redis clients:', error);
            this.isConnected = false;
            await this.attemptReconnect();
        }
    }
    setupEventHandlers() {
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
    async setupSubscriptions() {
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
        }
        catch (error) {
            this.logger.error('Failed to setup Redis subscriptions:', error);
            throw error;
        }
    }
    async attemptReconnect() {
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
            }
            catch (error) {
                this.logger.error('Reconnection attempt failed:', error);
                await this.attemptReconnect();
            }
        }, delay);
    }
    startHeartbeat() {
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
    async handleOrchestratorCommand(message, channel) {
        try {
            const data = JSON.parse(message);
            this.logger.info(`Received orchestrator command: ${data.type}`, { data });
            this.emit('orchestrator_command', data);
        }
        catch (error) {
            this.logger.error('Failed to parse orchestrator command message:', error);
        }
    }
    async handleTerminalRequest(message, channel) {
        try {
            const data = JSON.parse(message);
            this.logger.info(`Received terminal request: ${data.payload.command}`, { data });
            this.emit('terminal_request', data);
        }
        catch (error) {
            this.logger.error('Failed to parse terminal request message:', error);
        }
    }
    async handleTerminalResponse(message, channel) {
        try {
            const data = JSON.parse(message);
            this.logger.info(`Received terminal response for request: ${data.payload.requestId}`);
            this.emit('terminal_response', data);
        }
        catch (error) {
            this.logger.error('Failed to parse terminal response message:', error);
        }
    }
    async handleWorkflowUpdate(message, channel) {
        try {
            const data = JSON.parse(message);
            this.logger.info(`Received workflow update: ${data.payload.status}`, { workflowId: data.workflowId });
            this.emit('workflow_update', data);
        }
        catch (error) {
            this.logger.error('Failed to parse workflow update message:', error);
        }
    }
    async handleSystemStatus(message, channel) {
        try {
            const data = JSON.parse(message);
            this.logger.debug('Received system status update');
            this.emit('system_status', data);
        }
        catch (error) {
            this.logger.error('Failed to parse system status message:', error);
        }
    }
    async handleHeartbeat(message, channel) {
        try {
            const data = JSON.parse(message);
            if (data.instanceId !== this.instanceId) {
                this.logger.debug(`Heartbeat from instance: ${data.instanceId}`);
                this.emit('heartbeat', data);
            }
        }
        catch (error) {
            this.logger.error('Failed to parse heartbeat message:', error);
        }
    }
    // Public methods
    async publishMessage(channel, data) {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        try {
            const message = JSON.stringify(data);
            await this.publisher.publish(channel, message);
            this.logger.debug(`Published message to ${channel}`, { data });
        }
        catch (error) {
            this.logger.error(`Failed to publish message to ${channel}:`, error);
            throw error;
        }
    }
    async sendWorkflowCommand(command) {
        const messageData = {
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
    async sendTerminalRequest(request) {
        const messageData = {
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'terminal_request',
            payload: request,
            timestamp: new Date(),
            source: this.instanceId,
            priority: 'high'
        };
        await this.publishMessage(this.CHANNELS.TERMINAL_REQUESTS, messageData);
    }
    async sendTerminalResponse(response) {
        const messageData = {
            id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'terminal_response',
            payload: response,
            timestamp: new Date(),
            source: this.instanceId,
            priority: 'high'
        };
        await this.publishMessage(this.CHANNELS.TERMINAL_RESPONSES, messageData);
    }
    async sendWorkflowUpdate(update) {
        const messageData = {
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
    async sendSystemStatus(status) {
        const messageData = {
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
    isHealthy() {
        return this.isConnected && this.publisher.isReady && this.subscriber.isReady;
    }
    getConnectionInfo() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            instanceId: this.instanceId
        };
    }
    async getChannelInfo() {
        if (!this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        const info = {};
        for (const [name, channel] of Object.entries(this.CHANNELS)) {
            try {
                // Get number of subscribers for each channel
                const subscribers = await this.publisher.pubSubNumSub([channel]);
                info[name] = {
                    channel,
                    subscribers: subscribers[channel] || 0
                };
            }
            catch (error) {
                info[name] = {
                    channel,
                    subscribers: 'unknown',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        return info;
    }
    async disconnect() {
        this.logger.info('Disconnecting Redis messaging service');
        try {
            await Promise.all([
                this.publisher.disconnect(),
                this.subscriber.disconnect()
            ]);
            this.isConnected = false;
            this.emit('disconnected');
            this.logger.info('Redis messaging service disconnected');
        }
        catch (error) {
            this.logger.error('Error during Redis disconnect:', error);
        }
    }
    // Static factory method
    static async create(redisUrl, instanceId) {
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
exports.RedisMessagingService = RedisMessagingService;
// Export singleton instance
let redisMessagingInstance = null;
async function getRedisMessaging() {
    if (!redisMessagingInstance) {
        redisMessagingInstance = await RedisMessagingService.create();
    }
    return redisMessagingInstance;
}
exports.default = RedisMessagingService;
//# sourceMappingURL=redis-messaging.js.map