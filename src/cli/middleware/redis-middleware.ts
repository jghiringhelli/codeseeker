import { Request, Response, NextFunction } from 'express';
import { WebSocket } from 'ws';
import { getRedisMessaging, RedisMessagingService, MessageData } from '../../orchestrator/messaging/redis-messaging';
import { Logger } from '../../utils/logger';

interface ExtendedRequest extends Request {
    redisMessaging?: RedisMessagingService;
}

interface WebSocketConnection {
    ws: WebSocket;
    subscriptions: Set<string>;
    lastPing: Date;
}

export class RedisMiddleware {
    private static instance: RedisMiddleware;
    private redisMessaging: RedisMessagingService | null = null;
    private logger = Logger.getInstance();
    private wsConnections = new Map<string, WebSocketConnection>();
    private pingInterval: NodeJS.Timeout | null = null;

    static getInstance(): RedisMiddleware {
        if (!RedisMiddleware.instance) {
            RedisMiddleware.instance = new RedisMiddleware();
        }
        return RedisMiddleware.instance;
    }

    async initialize(): Promise<void> {
        try {
            this.redisMessaging = await getRedisMessaging();
            this.setupRedisEventHandlers();
            this.startWebSocketPing();
            this.logger.info('Redis middleware initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Redis middleware:', error as Error);
            throw error;
        }
    }

    private setupRedisEventHandlers(): void {
        if (!this.redisMessaging) return;

        // Forward Redis messages to WebSocket clients
        this.redisMessaging.on('workflow_update', (data: MessageData) => {
            this.broadcastToSubscribers('workflow_update', data);
        });

        this.redisMessaging.on('terminal_response', (data: MessageData) => {
            this.broadcastToSubscribers('terminal_response', data);
        });

        this.redisMessaging.on('orchestrator_command', (data: MessageData) => {
            this.broadcastToSubscribers('orchestrator_command', data);
        });

        this.redisMessaging.on('system_status', (data: MessageData) => {
            this.broadcastToSubscribers('system_status', data);
        });

        // Handle connection events
        this.redisMessaging.on('connected', () => {
            this.broadcastSystemMessage('redis_connected', { status: 'connected', timestamp: new Date() });
        });

        this.redisMessaging.on('disconnected', () => {
            this.broadcastSystemMessage('redis_disconnected', { status: 'disconnected', timestamp: new Date() });
        });

        this.redisMessaging.on('error', (error: Error) => {
            this.broadcastSystemMessage('redis_error', { error: error.message, timestamp: new Date() });
        });
    }

    private broadcastToSubscribers(eventType: string, data: any): void {
        const message = JSON.stringify({
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        });

        this.wsConnections.forEach((connection, connectionId) => {
            if (connection.ws.readyState === WebSocket.OPEN) {
                try {
                    connection.ws.send(message);
                } catch (error) {
                    this.logger.error(`Failed to send message to WebSocket ${connectionId}:`, error as Error);
                    this.removeWebSocketConnection(connectionId);
                }
            } else {
                this.removeWebSocketConnection(connectionId);
            }
        });
    }

    private broadcastSystemMessage(type: string, data: any): void {
        this.broadcastToSubscribers('system_message', { type, ...data });
    }

    private startWebSocketPing(): void {
        this.pingInterval = setInterval(() => {
            this.wsConnections.forEach((connection, connectionId) => {
                if (connection.ws.readyState === WebSocket.OPEN) {
                    try {
                        connection.ws.ping();
                        connection.lastPing = new Date();
                    } catch (error) {
                        this.logger.error(`Failed to ping WebSocket ${connectionId}:`, error as Error);
                        this.removeWebSocketConnection(connectionId);
                    }
                } else {
                    this.removeWebSocketConnection(connectionId);
                }
            });
        }, 30000); // Ping every 30 seconds
    }

    private removeWebSocketConnection(connectionId: string): void {
        const connection = this.wsConnections.get(connectionId);
        if (connection) {
            try {
                connection.ws.close();
            } catch (error) {
                // Ignore close errors
            }
            this.wsConnections.delete(connectionId);
            this.logger.debug(`Removed WebSocket connection: ${connectionId}`);
        }
    }

    // Middleware function for Express
    middleware() {
        return async (req: ExtendedRequest, res: Response, next: NextFunction) => {
            if (this.redisMessaging) {
                req.redisMessaging = this.redisMessaging;
            }
            next();
        };
    }

    // WebSocket upgrade handler
    handleWebSocketUpgrade(ws: WebSocket, req: Request): string {
        const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const connection: WebSocketConnection = {
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

    private async handleWebSocketMessage(connectionId: string, message: Buffer): Promise<void> {
        const connection = this.wsConnections.get(connectionId);
        if (!connection) return;

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
        } catch (error) {
            this.logger.error(`Error handling WebSocket message from ${connectionId}:`, error as Error);
            connection.ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    }

    private handleSubscribe(connectionId: string, channels: string[]): void {
        const connection = this.wsConnections.get(connectionId);
        if (!connection) return;

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

    private handleUnsubscribe(connectionId: string, channels: string[]): void {
        const connection = this.wsConnections.get(connectionId);
        if (!connection) return;

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

    private async handleWorkflowCommand(data: any): Promise<void> {
        if (!this.redisMessaging) return;

        try {
            await this.redisMessaging.sendWorkflowCommand(data.payload);
            this.logger.info(`Workflow command sent: ${data.payload.action} for ${data.payload.workflowId}`);
        } catch (error) {
            this.logger.error('Failed to send workflow command:', error as Error);
        }
    }

    private async handleTerminalRequest(data: any): Promise<void> {
        if (!this.redisMessaging) return;

        try {
            await this.redisMessaging.sendTerminalRequest(data.payload);
            this.logger.info(`Terminal request sent: ${data.payload.command}`);
        } catch (error) {
            this.logger.error('Failed to send terminal request:', error as Error);
        }
    }

    // API endpoints
    async getRedisStatus(): Promise<any> {
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

    async sendWorkflowCommand(command: any): Promise<void> {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }

        await this.redisMessaging.sendWorkflowCommand(command);
    }

    async sendTerminalRequest(request: any): Promise<void> {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }

        await this.redisMessaging.sendTerminalRequest(request);
    }

    async sendWorkflowUpdate(update: any): Promise<void> {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }

        await this.redisMessaging.sendWorkflowUpdate(update);
    }

    async sendSystemStatus(status: any): Promise<void> {
        if (!this.redisMessaging) {
            throw new Error('Redis messaging not initialized');
        }

        await this.redisMessaging.sendSystemStatus(status);
    }

    // Cleanup
    async shutdown(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Close all WebSocket connections
        this.wsConnections.forEach((connection, connectionId) => {
            try {
                connection.ws.close();
            } catch (error) {
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

export default RedisMiddleware;