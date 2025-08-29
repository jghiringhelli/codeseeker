"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisMiddleware = void 0;
const ws_1 = require("ws");
const redis_messaging_1 = require("../messaging/redis-messaging");
const logger_1 = require("../utils/logger");
class RedisMiddleware {
    static instance;
    redisMessaging = null;
    logger = logger_1.Logger.getInstance();
    wsConnections = new Map();
    pingInterval = null;
    static getInstance() {
        if (!RedisMiddleware.instance) {
            RedisMiddleware.instance = new RedisMiddleware();
        }
        return RedisMiddleware.instance;
    }
    async initialize() {
        try {
            this.redisMessaging = await (0, redis_messaging_1.getRedisMessaging)();
            this.setupRedisEventHandlers();
            this.startWebSocketPing();
            this.logger.info('Redis middleware initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize Redis middleware:', error);
            throw error;
        }
    }
    setupRedisEventHandlers() {
        if (!this.redisMessaging)
            return;
        // Forward Redis messages to WebSocket clients
        this.redisMessaging.on('workflow_update', (data) => {
            this.broadcastToSubscribers('workflow_update', data);
        });
        this.redisMessaging.on('terminal_response', (data) => {
            this.broadcastToSubscribers('terminal_response', data);
        });
        this.redisMessaging.on('orchestrator_command', (data) => {
            this.broadcastToSubscribers('orchestrator_command', data);
        });
        this.redisMessaging.on('system_status', (data) => {
            this.broadcastToSubscribers('system_status', data);
        });
        // Handle connection events
        this.redisMessaging.on('connected', () => {
            this.broadcastSystemMessage('redis_connected', { status: 'connected', timestamp: new Date() });
        });
        this.redisMessaging.on('disconnected', () => {
            this.broadcastSystemMessage('redis_disconnected', { status: 'disconnected', timestamp: new Date() });
        });
        this.redisMessaging.on('error', (error) => {
            this.broadcastSystemMessage('redis_error', { error: error.message, timestamp: new Date() });
        });
    }
    broadcastToSubscribers(eventType, data) {
        const message = JSON.stringify({
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        });
        this.wsConnections.forEach((connection, connectionId) => {
            if (connection.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    connection.ws.send(message);
                }
                catch (error) {
                    this.logger.error(`Failed to send message to WebSocket ${connectionId}:`, error);
                    this.removeWebSocketConnection(connectionId);
                }
            }
            else {
                this.removeWebSocketConnection(connectionId);
            }
        });
    }
    broadcastSystemMessage(type, data) {
        this.broadcastToSubscribers('system_message', { type, ...data });
    }
    startWebSocketPing() {
        this.pingInterval = setInterval(() => {
            this.wsConnections.forEach((connection, connectionId) => {
                if (connection.ws.readyState === ws_1.WebSocket.OPEN) {
                    try {
                        connection.ws.ping();
                        connection.lastPing = new Date();
                    }
                    catch (error) {
                        this.logger.error(`Failed to ping WebSocket ${connectionId}:`, error);
                        this.removeWebSocketConnection(connectionId);
                    }
                }
                else {
                    this.removeWebSocketConnection(connectionId);
                }
            });
        }, 30000); // Ping every 30 seconds
    }
    removeWebSocketConnection(connectionId) {
        const connection = this.wsConnections.get(connectionId);
        if (connection) {
            try {
                connection.ws.close();
            }
            catch (error) {
                // Ignore close errors
            }
            this.wsConnections.delete(connectionId);
            this.logger.debug(`Removed WebSocket connection: ${connectionId}`);
        }
    }
    // Middleware function for Express
    middleware() {
        return async (req, res, next) => {
            if (this.redisMessaging) {
                req.redisMessaging = this.redisMessaging;
            }
            next();
        };
    }
    // WebSocket upgrade handler
    handleWebSocketUpgrade(ws, req) {
        const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const connection = {
            ws,
            subscriptions: new Set(),
            lastPing: new Date()
        };
        this.wsConnections.set(connectionId, connection);
        // Setup WebSocket event handlers
        ws.on('message', (message) => {
            this.handleWebSocketMessage(connectionId, message);
        });
        ws.on('close', () => {
            this.removeWebSocketConnection(connectionId);
        });
        ws.on('error', (error) => {
            this.logger.error(`WebSocket error for ${connectionId}:`, error);
            this.removeWebSocketConnection(connectionId);
        });
        ws.on('pong', () => {
            const connection = this.wsConnections.get(connectionId);
            if (connection) {
                connection.lastPing = new Date();
            }
        });
        // Send initial connection success message
        ws.send(JSON.stringify({
            type: 'connection_established',
            connectionId,
            timestamp: new Date().toISOString()
        }));
        this.logger.info(`WebSocket connection established: ${connectionId}`);
        return connectionId;
    }
    async handleWebSocketMessage(connectionId, message) {
        const connection = this.wsConnections.get(connectionId);
        if (!connection)
            return;
        try {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case 'subscribe':
                    this.handleSubscribe(connectionId, data.channels);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(connectionId, data.channels);
                    break;
                case 'workflow_command':
                    await this.handleWorkflowCommand(data);
                    break;
                case 'terminal_request':
                    await this.handleTerminalRequest(data);
                    break;
                case 'ping':
                    connection.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    break;
                default:
                    this.logger.warn(`Unknown WebSocket message type: ${data.type}`);
            }
        }
        catch (error) {
            this.logger.error(`Error handling WebSocket message from ${connectionId}:`, error);
            connection.ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    }
    handleSubscribe(connectionId, channels) {
        const connection = this.wsConnections.get(connectionId);
        if (!connection)
            return;
        channels.forEach(channel => {
            connection.subscriptions.add(channel);
        });
        connection.ws.send(JSON.stringify({
            type: 'subscribed',
            channels,
            timestamp: new Date().toISOString()
        }));
        this.logger.debug(`WebSocket ${connectionId} subscribed to channels: ${channels.join(', ')}`);
    }
    handleUnsubscribe(connectionId, channels) {
        const connection = this.wsConnections.get(connectionId);
        if (!connection)
            return;
        channels.forEach(channel => {
            connection.subscriptions.delete(channel);
        });
        connection.ws.send(JSON.stringify({
            type: 'unsubscribed',
            channels,
            timestamp: new Date().toISOString()
        }));
        this.logger.debug(`WebSocket ${connectionId} unsubscribed from channels: ${channels.join(', ')}`);
    }
    async handleWorkflowCommand(data) {
        if (!this.redisMessaging)
            return;
        try {
            await this.redisMessaging.sendWorkflowCommand(data.payload);
            this.logger.info(`Workflow command sent: ${data.payload.action} for ${data.payload.workflowId}`);
        }
        catch (error) {
            this.logger.error('Failed to send workflow command:', error);
        }
    }
    async handleTerminalRequest(data) {
        if (!this.redisMessaging)
            return;
        try {
            await this.redisMessaging.sendTerminalRequest(data.payload);
            this.logger.info(`Terminal request sent: ${data.payload.command}`);
        }
        catch (error) {
            this.logger.error('Failed to send terminal request:', error);
        }
    }
    // API endpoints
    async getRedisStatus() {
        if (!this.redisMessaging) {
            return { connected: false, error: 'Redis messaging not initialized' };
        }
        return {
            ...this.redisMessaging.getConnectionInfo(),
            healthy: this.redisMessaging.isHealthy(),
            websocketConnections: this.wsConnections.size,
            channels: await this.redisMessaging.getChannelInfo()
        };
    }
    async sendWorkflowCommand(command) {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }
        await this.redisMessaging.sendWorkflowCommand(command);
    }
    async sendTerminalRequest(request) {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }
        await this.redisMessaging.sendTerminalRequest(request);
    }
    async sendWorkflowUpdate(update) {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }
        await this.redisMessaging.sendWorkflowUpdate(update);
    }
    async sendSystemStatus(status) {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }
        await this.redisMessaging.sendSystemStatus(status);
    }
    // Cleanup
    async shutdown() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        // Close all WebSocket connections
        this.wsConnections.forEach((connection, connectionId) => {
            try {
                connection.ws.close();
            }
            catch (error) {
                // Ignore close errors
            }
        });
        this.wsConnections.clear();
        if (this.redisMessaging) {
            await this.redisMessaging.disconnect();
            this.redisMessaging = null;
        }
        this.logger.info('Redis middleware shut down successfully');
    }
}
exports.RedisMiddleware = RedisMiddleware;
exports.default = RedisMiddleware;
//# sourceMappingURL=redis-middleware.js.map